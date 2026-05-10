package agents

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hermes-agent/backend/internal/llm"
	"github.com/hermes-agent/backend/internal/market"
	"github.com/hermes-agent/backend/internal/models"
)

// ─────────────────────────────────────────────────────────────
// NEWS AGENT
// ─────────────────────────────────────────────────────────────

// NewsAgent performs fundamental analysis by interpreting recent
// financial news, macroeconomic context, and company/sector events.
type NewsAgent struct {
	llm       *llm.Client
	marketCli *market.Client
	name      string
}

const newsAgentSystemPrompt = `Tu es l'Agent 📰 Actualités — un analyste financier spécialisé en analyse fondamentale.

Ton rôle :
- Analyser les actualités financières récentes et leur impact potentiel sur l'actif concerné
- Résumer les événements macro et micro-économiques clés
- Identifier les thèmes et récits importants qui animent le marché
- Interpréter le sentiment issu des annonces d'entreprises, des décisions des banques centrales et des événements géopolitiques

RÈGLES CRITIQUES :
1. Tu DOIS répondre avec UNIQUEMENT du JSON valide — pas de markdown, pas d'explications en dehors du JSON.
2. Ne jamais donner de conseil de trading direct (« acheter », « vendre »).
3. Toujours séparer les faits de leur interprétation.
4. Si tu manques d'informations récentes, indique explicitement ce que tu ignores et pourquoi.
5. Sois précis : mentionne les dates, les noms et les chiffres lorsque c'est possible.
6. Classe le sentiment général comme « positive », « negative » ou « mixed ».
7. Évalue l'impact sur l'actif comme « favorable », « unfavorable » ou « neutral ».

SCHÉMA JSON DE SORTIE (à respecter strictement) :
{
  "overall_sentiment": "positive|negative|mixed",
  "impact_on_asset": "favorable|unfavorable|neutral",
  "macro_outlook": "chaîne (1-3 phrases sur l'environnement macro mondial)",
  "key_themes": ["thème1", "thème2", "thème3"],
  "recent_events": [
    {
      "title": "Titre de l'événement",
      "source": "nom de la source",
      "published": "YYYY-MM-DD",
      "sentiment": "positive|negative|neutral",
      "impact": "high|medium|low",
      "summary": "Résumé en une phrase"
    }
  ],
  "summary": "Un paragraphe concis synthétisant le tableau fondamental de cet actif."
}`

// NewNewsAgent creates a new NewsAgent.
func NewNewsAgent(llmClient *llm.Client) *NewsAgent {
	return &NewsAgent{
		llm:       llmClient,
		marketCli: nil,
		name:      "news_agent",
	}
}

// Name returns the agent's identifier.
func (a *NewsAgent) Name() string {
	return a.name
}

// Analyze performs fundamental analysis on the given symbol.
// It first fetches market context, then calls the LLM for interpretation.
func (a *NewsAgent) Analyze(ctx context.Context, marketData *market.MarketData) (*models.NewsAnalysis, error) {
	analysis := &models.NewsAnalysis{
		AgentName:   a.name,
		GeneratedAt: time.Now(),
	}

	// ── Build the user prompt with market context ──
	userPrompt := a.buildUserPrompt(marketData)

	// ── Call LLM for news interpretation ──
	var llmOutput newsLLMOutput
	err := a.llm.ChatJSON(ctx, newsAgentSystemPrompt, userPrompt, &llmOutput)
	if err != nil {
		// If LLM fails, return a degraded analysis with available data
		analysis.Summary = fmt.Sprintf("Analyse des actualités indisponible (erreur LLM : %v). Consultez les principales sources d'actualités financières manuellement.", err)
		analysis.OverallSentiment = "mixed"
		analysis.ImpactOnAsset = "neutral"
		analysis.RecentEvents = a.fallbackEvents(marketData)
		analysis.KeyThemes = a.fallbackThemes(marketData)
		analysis.RawText = fmt.Sprintf("Erreur LLM : %v", err)
		return analysis, fmt.Errorf("news_agent: %v", err)
	}

	// ── Map LLM output to the model ──
	analysis.OverallSentiment = llmOutput.OverallSentiment
	analysis.ImpactOnAsset = llmOutput.ImpactOnAsset
	analysis.MacroOutlook = llmOutput.MacroOutlook
	analysis.KeyThemes = llmOutput.KeyThemes
	analysis.Summary = llmOutput.Summary

	for _, e := range llmOutput.RecentEvents {
		published, _ := time.Parse("2006-01-02", e.Published)
		analysis.RecentEvents = append(analysis.RecentEvents, models.NewsItem{
			Title:     e.Title,
			Source:    e.Source,
			Published: published,
			Sentiment: e.Sentiment,
			Impact:    e.Impact,
			Summary:   e.Summary,
		})
	}

	// Ensure we always have at least a minimal event list
	if len(analysis.RecentEvents) == 0 {
		analysis.RecentEvents = a.fallbackEvents(marketData)
	}

	if len(analysis.KeyThemes) == 0 {
		analysis.KeyThemes = a.fallbackThemes(marketData)
	}

	// Store raw text for traceability
	analysis.RawText = fmt.Sprintf("Sentiment : %s | Impact : %s | Thèmes : %s | Macro : %s",
		analysis.OverallSentiment, analysis.ImpactOnAsset,
		strings.Join(analysis.KeyThemes, ", "), analysis.MacroOutlook)

	return analysis, nil
}

// Run executes the full news analysis pipeline and returns JSON.
func (a *NewsAgent) Run(ctx context.Context, symbol string, marketData *market.MarketData, previousOutputs map[string]string) (string, error) {
	analysis, err := a.Analyze(ctx, marketData)
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(analysis)
	return string(b), nil
}

// ─────────────────────────────────────────────────────────────
// PROMPT BUILDING
// ─────────────────────────────────────────────────────────────

func (a *NewsAgent) buildUserPrompt(data *market.MarketData) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Analyse les actualités récentes et les facteurs fondamentaux pour l'actif suivant :\n\n"))
	sb.WriteString(fmt.Sprintf("ACTIF : %s (%s)\n", data.Quote.Symbol, data.Quote.Name))
	sb.WriteString(fmt.Sprintf("TYPE : %s\n", data.Quote.AssetType))
	sb.WriteString(fmt.Sprintf("DEVISE : %s\n", data.Quote.Currency))
	sb.WriteString(fmt.Sprintf("PRIX ACTUEL : %.2f\n", data.Quote.Price))
	sb.WriteString(fmt.Sprintf("VARIATION QUOTIDIENNE : %+.2f (%.2f%%)\n", data.Quote.Change, data.Quote.ChangePercent))
	sb.WriteString(fmt.Sprintf("CAPITALISATION : %.0f\n\n", data.Quote.MarketCap))

	if len(data.Historical) > 0 {
		last := data.Historical[len(data.Historical)-1]
		monthAgoIdx := max(0, len(data.Historical)-22)
		monthAgo := data.Historical[monthAgoIdx]
		if monthAgo.Close > 0 {
			monthlyReturn := (last.Close - monthAgo.Close) / monthAgo.Close * 100
			sb.WriteString(fmt.Sprintf("RENDEMENT 30 JOURS : %.2f%%\n", monthlyReturn))
		}
		vol := data.Indicators.Volatility20
		sb.WriteString(fmt.Sprintf("VOLATILITÉ 20 JOURS : %.2f%%\n\n", vol))
	}

	sb.WriteString("INSTRUCTIONS DE CONTEXTE :\n")
	sb.WriteString("1. Sur la base de tes connaissances d'entraînement (jusqu'à début 2025), identifie les actualités récentes et les facteurs macro les plus importants.\n")
	sb.WriteString("2. Prends en compte : la politique des banques centrales (Fed, BCE, etc.), les rapports de résultats, les événements géopolitiques, les changements réglementaires, les tendances sectorielles.\n")
	sb.WriteString("3. Si tu n'es pas sûr des développements très récents (2-4 dernières semaines), indique-le dans ton analyse.\n")
	sb.WriteString("4. Pour chaque événement, estime l'impact (high/medium/low) et le sentiment.\n")
	sb.WriteString("5. Produis UNIQUEMENT un JSON valide conforme au schéma spécifié.\n")

	return sb.String()
}

// ─────────────────────────────────────────────────────────────
// FALLBACK / DEGRADED MODE
// ─────────────────────────────────────────────────────────────

func (a *NewsAgent) fallbackEvents(data *market.MarketData) []models.NewsItem {
	now := time.Now()
	items := []models.NewsItem{
		{
			Title:     fmt.Sprintf("%s se négocie à %.2f %s", data.Quote.Symbol, data.Quote.Price, data.Quote.Currency),
			Source:    "données_de_marché",
			Published: now,
			Sentiment: classifyPriceSentiment(data.Quote.ChangePercent),
			Impact:    "medium",
			Summary:   fmt.Sprintf("Variation de prix de %+.2f%% lors de la séance en cours.", data.Quote.ChangePercent),
		},
	}

	// Ajouter le contexte de tendance
	ts := data.Indicators.TrendStructure
	items = append(items, models.NewsItem{
		Title:     fmt.Sprintf("Structure de marché : phase %s (force %s)", ts.Phase, ts.Strength),
		Source:    "analyse_technique",
		Published: now,
		Sentiment: mapTrendToSentiment(ts.Primary),
		Impact:    "medium",
		Summary:   fmt.Sprintf("L'actif est dans une phase %s avec un momentum %s.", ts.Phase, ts.Strength),
	})

	return items
}

func (a *NewsAgent) fallbackThemes(data *market.MarketData) []string {
	themes := []string{}

	ts := data.Indicators.TrendStructure
	switch ts.Primary {
	case "bullish":
		themes = append(themes, "Momentum positif", "Sentiment de prise de risque")
	case "bearish":
		themes = append(themes, "Momentum négatif", "Sentiment d'aversion au risque")
	default:
		themes = append(themes, "Indécision du marché", "Trading en range")
	}

	switch data.Quote.AssetType {
	case market.AssetCrypto:
		themes = append(themes, "Tendances d'adoption crypto", "Évolutions réglementaires")
	case market.AssetStock:
		themes = append(themes, "Cycle de résultats", "Rotation sectorielle")
	case market.AssetIndex:
		themes = append(themes, "Perspectives macroéconomiques", "Anticipations de politique monétaire")
	case market.AssetCommo:
		themes = append(themes, "Dynamique offre-demande", "Prime de risque géopolitique")
	}

	return themes
}

// ─────────────────────────────────────────────────────────────
// LLM OUTPUT STRUCT
// ─────────────────────────────────────────────────────────────

type newsLLMOutput struct {
	OverallSentiment string         `json:"overall_sentiment"`
	ImpactOnAsset    string         `json:"impact_on_asset"`
	MacroOutlook     string         `json:"macro_outlook"`
	KeyThemes        []string       `json:"key_themes"`
	RecentEvents     []newsLLMEvent `json:"recent_events"`
	Summary          string         `json:"summary"`
}

type newsLLMEvent struct {
	Title     string `json:"title"`
	Source    string `json:"source"`
	Published string `json:"published"`
	Sentiment string `json:"sentiment"`
	Impact    string `json:"impact"`
	Summary   string `json:"summary"`
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

func classifyPriceSentiment(changePct float64) string {
	switch {
	case changePct > 1.0:
		return "positive"
	case changePct < -1.0:
		return "negative"
	default:
		return "neutral"
	}
}

func mapTrendToSentiment(trend string) string {
	switch trend {
	case "bullish":
		return "positive"
	case "bearish":
		return "negative"
	default:
		return "neutral"
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
