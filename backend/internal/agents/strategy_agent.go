// Package agents implements the multi-agent financial analysis system.
// Strategy Agent: synthesizes all agent outputs into coherent market scenarios.
package agents

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/hermes-agent/backend/internal/llm"
	"github.com/hermes-agent/backend/internal/models"
)

// ────────────────────────────────────────────────────────────
// STRATEGY AGENT
// ────────────────────────────────────────────────────────────

// StrategyAgent synthesizes analyses from Market, News, and Risk agents
// to produce coherent market scenarios with probability estimates.
type StrategyAgent struct {
	client *llm.Client
	name   string
}

// NewStrategyAgent creates a new Strategy Agent.
func NewStrategyAgent(client *llm.Client) *StrategyAgent {
	return &StrategyAgent{
		client: client,
		name:   "strategy_agent",
	}
}

// Name returns the agent's identifier.
func (a *StrategyAgent) Name() string {
	return a.name
}

// StrategyInput bundles the outputs from the other three agents.
type StrategyInput struct {
	Symbol    string                 `json:"symbol"`
	AssetName string                 `json:"asset_name"`
	Category  models.AssetCategory   `json:"category"`
	Quote     *models.Quote          `json:"quote"`
	Market    *models.MarketAnalysis `json:"market"`
	News      *models.NewsAnalysis   `json:"news"`
	Risk      *models.RiskAnalysis   `json:"risk"`
}

// Run executes the strategy agent's analysis pipeline.
// It can operate with or without an LLM client.
func (a *StrategyAgent) Run(ctx context.Context, input StrategyInput) (*models.StrategyAnalysis, error) {
	// If we have an LLM client, use it for a richer analysis.
	if a.client != nil {
		analysis, err := a.runLLM(ctx, input)
		if err == nil {
			return analysis, nil
		}
		// Fall through to rule-based on LLM failure.
		fmt.Printf("[strategy_agent] Échec de l'appel LLM, basculement vers l'analyse basée sur les règles : %v\n", err)
	}
	return a.runRuleBased(input), nil
}

// ────────────────────────────────────────────────────────────
// LLM-BASED ANALYSIS
// ────────────────────────────────────────────────────────────

// strategyLLMResponse is the top-level JSON structure returned by the LLM.
type strategyLLMResponse struct {
	Scenarios       []scenarioItemJSON `json:"scenarios"`
	PrimaryBias     string             `json:"primary_bias"`
	ConvictionLevel string             `json:"conviction_level"`
	CriticalLevels  []float64          `json:"critical_levels"`
	Uncertainties   []string           `json:"uncertainties"`
	CrossAssetNote  string             `json:"cross_asset_note"`
	Summary         string             `json:"summary"`
	Conclusion      string             `json:"conclusion"`
}

func (a *StrategyAgent) runLLM(ctx context.Context, input StrategyInput) (*models.StrategyAnalysis, error) {
	systemPrompt := a.buildSystemPrompt()
	userPrompt := a.buildUserPrompt(input)

	var rawOutput struct {
		Scenarios       []scenarioItemJSON `json:"scenarios"`
		PrimaryBias     string             `json:"primary_bias"`
		ConvictionLevel string             `json:"conviction_level"`
		CriticalLevels  []float64          `json:"critical_levels"`
		Uncertainties   []string           `json:"uncertainties"`
		CrossAssetNote  string             `json:"cross_asset_note"`
		Summary         string             `json:"summary"`
		Conclusion      string             `json:"conclusion"`
	}

	if err := a.client.ChatJSON(ctx, systemPrompt, userPrompt, &rawOutput); err != nil {
		return nil, fmt.Errorf("llm chat: %w", err)
	}

	return a.hydrateFromLLM(input, rawOutput), nil
}

type scenarioItemJSON struct {
	Bias           string   `json:"bias"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	Probability    float64  `json:"probability"`
	TargetPrice    float64  `json:"target_price"`
	Timeframe      string   `json:"timeframe"`
	KeyTriggers    []string `json:"key_triggers"`
	InvalidationPt float64  `json:"invalidation_point"`
}

//go:embed prompts/strategy_agent.md
var strategyAgentSystemPrompt string

func (a *StrategyAgent) buildSystemPrompt() string {
	return strategyAgentSystemPrompt
}

func (a *StrategyAgent) buildUserPrompt(input StrategyInput) string {
	var sb strings.Builder
	sb.WriteString("## DEMANDE DE SYNTHÈSE STRATÉGIQUE\n\n")
	sb.WriteString(fmt.Sprintf("**Actif :** %s (%s)\n", input.Symbol, input.AssetName))
	sb.WriteString(fmt.Sprintf("**Catégorie :** %s\n", input.Category))

	if input.Quote != nil {
		sb.WriteString(fmt.Sprintf("**Prix actuel :** %.2f\n", input.Quote.Price))
		sb.WriteString(fmt.Sprintf("**Variation du jour :** %.2f (%.2f%%)\n\n", input.Quote.Change, input.Quote.ChangePercent))
	}

	// ── Market Agent Input ──
	sb.WriteString("---\n### 📊 ANALYSE DE MARCHÉ\n\n")
	if input.Market != nil {
		sb.WriteString(fmt.Sprintf("**Tendance :** %s | **Force :** %.0f/100 | **Momentum :** %s\n",
			input.Market.Trend, input.Market.TrendStrength, input.Market.Momentum))
		sb.WriteString(fmt.Sprintf("**Structure :** %s\n", input.Market.Structure))
		if input.Market.Technical != nil {
			t := input.Market.Technical
			sb.WriteString(fmt.Sprintf("**RSI(14) :** %.1f | **MACD :** %.4f (signal : %.4f)\n", t.RSI14, t.MACDLine, t.MACDSignal))
			sb.WriteString(fmt.Sprintf("**SMA20 :** %.2f | **SMA50 :** %.2f | **SMA200 :** %.2f\n", t.SMA20, t.SMA50, t.SMA200))
		}
		if input.Market.KeyLevels != nil {
			sb.WriteString(fmt.Sprintf("**Supports :** %v\n", input.Market.KeyLevels.Supports))
			sb.WriteString(fmt.Sprintf("**Résistances :** %v\n", input.Market.KeyLevels.Resistances))
		}
		sb.WriteString(fmt.Sprintf("**Note de volatilité :** %s\n", input.Market.VolatilityNote))
		sb.WriteString(fmt.Sprintf("**Résumé :** %s\n", input.Market.Summary))
	} else {
		sb.WriteString("*Aucune analyse de marché disponible*\n")
	}

	// ── News Agent Input ──
	sb.WriteString("\n---\n### 📰 ANALYSE DES ACTUALITÉS\n\n")
	if input.News != nil {
		sb.WriteString(fmt.Sprintf("**Sentiment global :** %s\n", input.News.OverallSentiment))
		sb.WriteString(fmt.Sprintf("**Impact sur l'actif :** %s\n", input.News.ImpactOnAsset))
		sb.WriteString(fmt.Sprintf("**Perspectives macro :** %s\n", input.News.MacroOutlook))
		sb.WriteString("**Thèmes clés :**\n")
		for _, theme := range input.News.KeyThemes {
			sb.WriteString(fmt.Sprintf("  • %s\n", theme))
		}
		sb.WriteString("**Événements récents :**\n")
		for i, event := range input.News.RecentEvents {
			if i >= 5 {
				sb.WriteString(fmt.Sprintf("  ... et %d événement(s) supplémentaire(s)\n", len(input.News.RecentEvents)-5))
				break
			}
			sb.WriteString(fmt.Sprintf("  • [%s] %s (%s)\n", event.Sentiment, event.Title, event.Impact))
		}
		sb.WriteString(fmt.Sprintf("**Résumé :** %s\n", input.News.Summary))
	} else {
		sb.WriteString("*Aucune analyse des actualités disponible*\n")
	}

	// ── Risk Agent Input ──
	sb.WriteString("\n---\n### ⚠️ ANALYSE DES RISQUES\n\n")
	if input.Risk != nil {
		sb.WriteString(fmt.Sprintf("**Risque global :** %s | **Score :** %.0f/100\n", input.Risk.OverallRisk, input.Risk.RiskScore))
		sb.WriteString(fmt.Sprintf("**Régime de volatilité :** %s\n", input.Risk.VolatilityRegime))
		sb.WriteString(fmt.Sprintf("**Risque de drawdown :** %.1f%%\n", input.Risk.DrawdownRisk))
		sb.WriteString(fmt.Sprintf("**Risque de queue :** %s\n", input.Risk.TailRisk))
		sb.WriteString("**Facteurs de risque :**\n")
		for _, f := range input.Risk.Factors {
			sb.WriteString(fmt.Sprintf("  • %s [%s] : %s\n", f.Name, f.Level, f.Description))
		}
		sb.WriteString(fmt.Sprintf("**Note de corrélation :** %s\n", input.Risk.CorrelationNote))
		sb.WriteString(fmt.Sprintf("**Résumé :** %s\n", input.Risk.Summary))
	} else {
		sb.WriteString("*Aucune analyse des risques disponible*\n")
	}

	sb.WriteString("\n---\n")
	sb.WriteString("Synthétise ce qui précède en une stratégie cohérente avec 2-3 scénarios, des probabilités et une conclusion claire.\n")

	return sb.String()
}

func (a *StrategyAgent) hydrateFromLLM(input StrategyInput, raw strategyLLMResponse) *models.StrategyAnalysis {
	scenarios := make([]models.Scenario, 0, len(raw.Scenarios))
	for _, s := range raw.Scenarios {
		scenarios = append(scenarios, models.Scenario{
			Bias:           models.ScenarioBias(s.Bias),
			Name:           s.Name,
			Description:    s.Description,
			Probability:    s.Probability,
			TargetPrice:    s.TargetPrice,
			Timeframe:      s.Timeframe,
			KeyTriggers:    s.KeyTriggers,
			InvalidationPt: s.InvalidationPt,
		})
	}

	// Normalize probabilities to sum to ~100%
	scenarios = normalizeProbabilities(scenarios)

	rawBytes, _ := json.Marshal(raw)

	return &models.StrategyAnalysis{
		AgentName:       a.name,
		GeneratedAt:     time.Now(),
		Scenarios:       scenarios,
		PrimaryBias:     models.ScenarioBias(raw.PrimaryBias),
		ConvictionLevel: raw.ConvictionLevel,
		CriticalLevels:  raw.CriticalLevels,
		Uncertainties:   raw.Uncertainties,
		CrossAssetNote:  raw.CrossAssetNote,
		Summary:         raw.Summary,
		Conclusion:      raw.Conclusion,
		RawText:         string(rawBytes),
	}
}

// ────────────────────────────────────────────────────────────
// RULE-BASED FALLBACK
// ────────────────────────────────────────────────────────────

func (a *StrategyAgent) runRuleBased(input StrategyInput) *models.StrategyAnalysis {
	scenarios := a.buildRuleBasedScenarios(input)
	primaryBias := a.determinePrimaryBias(scenarios)
	conviction := a.determineConviction(input)
	criticalLevels := a.extractCriticalLevels(input)
	uncertainties := a.extractUncertainties(input)
	summary := a.buildSummary(input, scenarios, primaryBias)
	conclusion := a.buildConclusion(input, scenarios, primaryBias, conviction)

	return &models.StrategyAnalysis{
		AgentName:       a.name,
		GeneratedAt:     time.Now(),
		Scenarios:       scenarios,
		PrimaryBias:     primaryBias,
		ConvictionLevel: conviction,
		CriticalLevels:  criticalLevels,
		Uncertainties:   uncertainties,
		CrossAssetNote:  a.buildCrossAssetNote(input),
		Summary:         summary,
		Conclusion:      conclusion,
		RawText:         "", // No raw LLM text for rule-based
	}
}

func (a *StrategyAgent) buildRuleBasedScenarios(input StrategyInput) []models.Scenario {
	var basePrice float64
	if input.Quote != nil {
		basePrice = input.Quote.Price
	}

	// Determine scores from each agent
	marketScore := a.scoreMarket(input.Market)
	newsScore := a.scoreNews(input.News)
	riskScore := a.scoreRisk(input.Risk)

	// Aggregate into scenario probabilities
	// Market + News push bullish, Risk constrains it
	bullishWeight := (marketScore*0.40 + newsScore*0.35 + (100-riskScore)*0.25)
	bearishWeight := ((100-marketScore)*0.40 + (100-newsScore)*0.35 + riskScore*0.25)
	neutralWeight := 100 - (bullishWeight+bearishWeight)/2

	total := bullishWeight + bearishWeight + neutralWeight
	if total == 0 {
		total = 1
	}

	bullProb := math.Round(bullishWeight/total*100*10) / 10
	bearProb := math.Round(bearishWeight/total*100*10) / 10
	neutProb := math.Round(neutralWeight/total*100*10) / 10

	// Ensure they sum to ~100
	diff := 100.0 - (bullProb + bearProb + neutProb)
	bullProb += diff

	trendStr := "neutral"
	if input.Market != nil {
		trendStr = string(input.Market.Trend)
	}

	scenarios := []models.Scenario{
		{
			Bias:           models.ScenarioBullish,
			Name:           a.buildScenarioName("bullish", trendStr),
			Description:    a.buildBullishDescription(input, basePrice),
			Probability:    bullProb,
			TargetPrice:    roundPrice(basePrice * a.bullishMultiplier(input)),
			Timeframe:      "3-6 mois",
			KeyTriggers:    a.bullishTriggers(input),
			InvalidationPt: roundPrice(basePrice * a.bullishInvalidationMultiplier(input)),
		},
		{
			Bias:        models.ScenarioNeutral,
			Name:        "Consolidation en range",
			Description: a.buildNeutralDescription(input, basePrice),
			Probability: neutProb,
			TargetPrice: basePrice,
			Timeframe:   "3-6 mois",
			KeyTriggers: []string{
				"Données économiques mitigées sans direction claire",
				"Volatilité contenue dans la fourchette actuelle",
				"Aucun catalyseur majeur n'émerge",
			},
			InvalidationPt: 0,
		},
		{
			Bias:           models.ScenarioBearish,
			Name:           a.buildScenarioName("bearish", trendStr),
			Description:    a.buildBearishDescription(input, basePrice),
			Probability:    bearProb,
			TargetPrice:    roundPrice(basePrice * a.bearishMultiplier(input)),
			Timeframe:      "3-6 mois",
			KeyTriggers:    a.bearishTriggers(input),
			InvalidationPt: roundPrice(basePrice * a.bearishInvalidationMultiplier(input)),
		},
	}

	return normalizeProbabilities(scenarios)
}

// ────────────────────────────────────────────────────────────
// SCORING
// ────────────────────────────────────────────────────────────

func (a *StrategyAgent) scoreMarket(m *models.MarketAnalysis) float64 {
	if m == nil {
		return 50 // Neutral when no data
	}

	score := 50.0
	switch m.Trend {
	case models.TrendBullish:
		score += m.TrendStrength * 0.3
	case models.TrendBearish:
		score -= m.TrendStrength * 0.3
	}

	if m.Technical != nil {
		// RSI contribution
		if m.Technical.RSI14 > 60 {
			score += 10
		} else if m.Technical.RSI14 < 40 {
			score -= 10
		}
		// MACD
		if m.Technical.MACDHist > 0 {
			score += 5
		} else {
			score -= 5
		}
		// SMA alignment
		if m.Technical.SMA20 > m.Technical.SMA50 && m.Technical.SMA50 > m.Technical.SMA200 {
			score += 10
		}
	}

	if m.Momentum == "accelerating" {
		score += 10
	} else if m.Momentum == "decelerating" {
		score -= 5
	}

	return clamp(score, 0, 100)
}

// scoreNews converts news analysis to a 0-100 favorable score.
func (a *StrategyAgent) scoreNews(n *models.NewsAnalysis) float64 {
	if n == nil {
		return 50
	}

	switch strings.ToLower(n.OverallSentiment) {
	case "positive":
		return 75
	case "negative":
		return 25
	case "mixed":
		return 50
	default:
		return 50
	}
}

// scoreRisk converts risk analysis to a 0-100 risk score (higher = riskier).
func (a *StrategyAgent) scoreRisk(r *models.RiskAnalysis) float64 {
	if r == nil {
		return 50
	}
	return r.RiskScore
}

// ────────────────────────────────────────────────────────────
// SCENARIO BUILDING HELPERS
// ────────────────────────────────────────────────────────────

func (a *StrategyAgent) buildScenarioName(bias, trend string) string {
	switch bias {
	case "bullish":
		switch trend {
		case "bullish":
			return "Poursuite de la tendance haussière"
		case "bearish":
			return "Retournement de tendance à la hausse"
		default:
			return "Cassure haussière"
		}
	case "bearish":
		switch trend {
		case "bearish":
			return "Poursuite de la tendance baissière"
		case "bullish":
			return "Piège haussier — Correction à la baisse"
		default:
			return "Rupture baissière"
		}
	}
	return "Consolidation latérale"
}

func (a *StrategyAgent) buildBullishDescription(input StrategyInput, base float64) string {
	parts := []string{"Le momentum positif se poursuit"}

	if input.Market != nil && input.Market.Trend == models.TrendBullish {
		parts = append(parts, "avec la tendance haussière existante qui s'étend davantage")
	}
	if input.News != nil && input.News.OverallSentiment == "positive" {
		parts = append(parts, "soutenu par des catalyseurs macro et fondamentaux favorables")
	}
	if input.Risk != nil && input.Risk.OverallRisk == models.RiskLow {
		parts = append(parts, "dans un environnement de risque faible")
	}

	target := roundPrice(base * a.bullishMultiplier(input))
	parts = append(parts, fmt.Sprintf("vers un objectif d'environ %.2f", target))

	return strings.Join(parts, " ") + "."
}

func (a *StrategyAgent) buildBearishDescription(input StrategyInput, base float64) string {
	parts := []string{"La pression vendeuse s'intensifie"}

	if input.Market != nil && input.Market.Trend == models.TrendBearish {
		parts = append(parts, "renforçant la tendance baissière existante")
	}
	if input.Risk != nil && input.Risk.OverallRisk == models.RiskHigh {
		parts = append(parts, "alors que les facteurs de risque élevés se matérialisent")
	}
	if input.News != nil && input.News.OverallSentiment == "negative" {
		parts = append(parts, "poussée par la détérioration des fondamentaux et un flux d'actualités négatives")
	}

	target := roundPrice(base * a.bearishMultiplier(input))
	parts = append(parts, fmt.Sprintf("vers un objectif d'environ %.2f", target))

	return strings.Join(parts, " ") + "."
}

func (a *StrategyAgent) buildNeutralDescription(input StrategyInput, base float64) string {
	support := roundPrice(base * 0.93)
	resistance := roundPrice(base * 1.07)
	return fmt.Sprintf(
		"L'actif évolue dans une fourchette entre un support à %.2f et une résistance à %.2f, "+
			"car des signaux contradictoires empêchent un mouvement directionnel clair. "+
			"La volatilité se contracte tandis que le marché attend un catalyseur.",
		support, resistance,
	)
}

// ────────────────────────────────────────────────────────────
// MULTIPLIERS
// ────────────────────────────────────────────────────────────

func (a *StrategyAgent) bullishMultiplier(input StrategyInput) float64 {
	base := 1.12 // Par défaut +12 %
	if input.Risk != nil && input.Risk.VolatilityRegime == "elevated" {
		base = 1.18
	}
	return base
}

func (a *StrategyAgent) bearishMultiplier(input StrategyInput) float64 {
	base := 0.85 // Par défaut -15 %
	if input.Risk != nil && input.Risk.DrawdownRisk > 20 {
		base = 0.75
	}
	return base
}

func (a *StrategyAgent) bullishInvalidationMultiplier(input StrategyInput) float64 {
	return 0.93 // -7 % depuis le prix actuel invalide la thèse haussière
}

func (a *StrategyAgent) bearishInvalidationMultiplier(input StrategyInput) float64 {
	return 1.07 // +7 % depuis le prix actuel invalide la thèse baissière
}

// ────────────────────────────────────────────────────────────
// TRIGGERS
// ────────────────────────────────────────────────────────────

func (a *StrategyAgent) bullishTriggers(input StrategyInput) []string {
	triggers := []string{
		"Cassure et maintien au-dessus de la résistance à court terme",
		"Le RSI(14) se maintient au-dessus de 60 sans divergence",
	}
	if input.News != nil {
		triggers = append(triggers, "Surprise positive macro ou sur les résultats")
	}
	return triggers
}

func (a *StrategyAgent) bearishTriggers(input StrategyInput) []string {
	triggers := []string{
		"Cassure et clôture sous le niveau de support clé",
		"Le RSI(14) passe sous 40 avec un volume croissant",
	}
	if input.News != nil {
		triggers = append(triggers, "Catalyseur négatif (résultats décevants, banque centrale restrictive)")
	}
	return triggers
}

// ────────────────────────────────────────────────────────────
// SYNTHESIS HELPERS
// ────────────────────────────────────────────────────────────

func (a *StrategyAgent) determinePrimaryBias(scenarios []models.Scenario) models.ScenarioBias {
	if len(scenarios) == 0 {
		return models.ScenarioNeutral
	}

	var best models.Scenario
	for _, s := range scenarios {
		if s.Probability > best.Probability {
			best = s
		}
	}
	return best.Bias
}

func (a *StrategyAgent) determineConviction(input StrategyInput) string {
	// Conviction élevée = tous les agents sont d'accord
	// Conviction faible = signaux contradictoires
	marketBullish := input.Market != nil && input.Market.Trend == models.TrendBullish
	newsPositive := input.News != nil && input.News.OverallSentiment == "positive"
	riskLow := input.Risk != nil && input.Risk.OverallRisk == models.RiskLow

	marketBearish := input.Market != nil && input.Market.Trend == models.TrendBearish
	newsNegative := input.News != nil && input.News.OverallSentiment == "negative"
	riskHigh := input.Risk != nil && (input.Risk.OverallRisk == models.RiskHigh || input.Risk.OverallRisk == models.RiskCritical)

	bullishAlignment := 0
	bearishAlignment := 0
	if marketBullish {
		bullishAlignment++
	}
	if newsPositive {
		bullishAlignment++
	}
	if riskLow {
		bullishAlignment++
	}
	if marketBearish {
		bearishAlignment++
	}
	if newsNegative {
		bearishAlignment++
	}
	if riskHigh {
		bearishAlignment++
	}

	if bullishAlignment >= 2 || bearishAlignment >= 2 {
		if bullishAlignment == 3 || bearishAlignment == 3 {
			return "high"
		}
		return "moderate"
	}
	return "low"
}

func (a *StrategyAgent) extractCriticalLevels(input StrategyInput) []float64 {
	var levels []float64

	if input.Quote != nil {
		levels = append(levels, input.Quote.Price)
	}
	if input.Market != nil && input.Market.KeyLevels != nil {
		for _, s := range input.Market.KeyLevels.Supports {
			levels = append(levels, s)
		}
		for _, r := range input.Market.KeyLevels.Resistances {
			levels = append(levels, r)
		}
	}
	if input.Market != nil && input.Market.Technical != nil {
		if input.Market.Technical.SMA50 > 0 {
			levels = append(levels, input.Market.Technical.SMA50)
		}
		if input.Market.Technical.SMA200 > 0 {
			levels = append(levels, input.Market.Technical.SMA200)
		}
	}

	// Deduplicate and sort
	seen := make(map[float64]bool)
	var unique []float64
	for _, l := range levels {
		rounded := roundPrice(l)
		if !seen[rounded] {
			seen[rounded] = true
			unique = append(unique, rounded)
		}
	}
	// Keep only meaningful levels (within ±20% of current price)
	if input.Quote != nil && input.Quote.Price > 0 {
		cp := input.Quote.Price
		var filtered []float64
		for _, l := range unique {
			if l >= cp*0.8 && l <= cp*1.2 {
				filtered = append(filtered, l)
			}
		}
		unique = filtered
	}
	return unique
}

func (a *StrategyAgent) extractUncertainties(input StrategyInput) []string {
	uncertainties := []string{
		"La trajectoire des données macroéconomiques reste incertaine",
		"La trajectoire de la politique des banques centrales dépend des données",
	}

	if input.News != nil && input.News.MacroOutlook != "" {
		uncertainties = append(uncertainties, input.News.MacroOutlook)
	}
	if input.Risk != nil && input.Risk.TailRisk != "" {
		uncertainties = append(uncertainties, "Risque de queue : "+input.Risk.TailRisk)
	}

	return uncertainties
}

func (a *StrategyAgent) buildCrossAssetNote(input StrategyInput) string {
	if input.Category == models.AssetCrypto {
		return "Les actifs crypto montrent une corrélation variable avec les actions ; le Bitcoin mène souvent les rotations de prise/aversion au risque. Surveiller le S&P 500 et le DXY pour les signaux inter-actifs."
	}
	if input.Category == models.AssetCommodity {
		return "Les matières premières sont sensibles à la force du USD et aux attentes de croissance mondiale. Surveiller le DXY et les rendements obligataires pour les signaux directionnels."
	}
	if input.Category == models.AssetIndex {
		return "Les indices actions sont corrélés aux spreads de crédit et à la volatilité obligataire (indice MOVE). Une vente simultanée des obligations et des actions signalerait un changement de régime."
	}
	return "Les corrélations inter-actifs doivent être surveillées pour détecter les signaux de changement de régime. La divergence entre obligations, actions et matières premières précède souvent des événements de volatilité."
}

func (a *StrategyAgent) buildSummary(input StrategyInput, scenarios []models.Scenario, bias models.ScenarioBias) string {
	parts := []string{}

	// Market snapshot
	if input.Quote != nil && input.Market != nil {
		parts = append(parts, fmt.Sprintf(
			"%s se négocie à %.2f avec une structure technique %s.",
			input.Symbol, input.Quote.Price, input.Market.Trend,
		))
	} else if input.Quote != nil {
		parts = append(parts, fmt.Sprintf(
			"%s se négocie à %.2f.", input.Symbol, input.Quote.Price,
		))
	}

	// Primary scenario
	if len(scenarios) > 0 {
		primary := scenarios[0] // Already sorted by probability
		parts = append(parts, fmt.Sprintf(
			"Le scénario principal (%.0f%% de probabilité) est %s : %s",
			primary.Probability, primary.Bias, primary.Name,
		))
	}

	// Risk note
	if input.Risk != nil {
		parts = append(parts, fmt.Sprintf(
			"Le risque global est évalué comme %s.", input.Risk.OverallRisk,
		))
	}

	return strings.Join(parts, " ")
}

func (a *StrategyAgent) buildConclusion(input StrategyInput, scenarios []models.Scenario, bias models.ScenarioBias, conviction string) string {
	var sb strings.Builder

	biasLabel := "NEUTRE"
	switch bias {
	case models.ScenarioBullish:
		biasLabel = "LÉGÈREMENT HAUSSIER"
	case models.ScenarioBearish:
		biasLabel = "LÉGÈREMENT BAISSIER"
	}

	sb.WriteString(fmt.Sprintf("**Biais :** %s | **Conviction :** %s\n\n", biasLabel, strings.ToUpper(conviction)))

	if input.Market != nil {
		sb.WriteString(fmt.Sprintf("Techniquement, %s. ", input.Market.Summary))
	}
	if input.News != nil {
		sb.WriteString(fmt.Sprintf("Fondamentalement, %s. ", input.News.Summary))
	}
	if input.Risk != nil {
		sb.WriteString(fmt.Sprintf("Du point de vue du risque, %s.", input.Risk.Summary))
	}

	sb.WriteString("\n\n")
	sb.WriteString("La prépondérance des preuves suggère ")
	switch conviction {
	case "high":
		sb.WriteString("une forte probabilité de ")
	case "moderate":
		sb.WriteString("une probabilité raisonnable de ")
	default:
		sb.WriteString("des perspectives incertaines avec une légère inclinaison vers ")
	}
	sb.WriteString(string(bias) + ". ")

	if len(scenarios) > 0 && len(scenarios) > 1 {
		sb.WriteString(fmt.Sprintf(
			"Cependant, le scénario alternatif (%.0f%% de probabilité) doit être respecté si les niveaux clés d'invalidation sont franchis.",
			scenarios[1].Probability,
		))
	}

	return sb.String()
}

// ────────────────────────────────────────────────────────────
// UTILITIES
// ────────────────────────────────────────────────────────────

func normalizeProbabilities(scenarios []models.Scenario) []models.Scenario {
	if len(scenarios) == 0 {
		return scenarios
	}

	total := 0.0
	for _, s := range scenarios {
		total += s.Probability
	}

	if total == 0 {
		even := 100.0 / float64(len(scenarios))
		for i := range scenarios {
			scenarios[i].Probability = math.Round(even*10) / 10
		}
		return scenarios
	}

	// Normalize to 100
	scale := 100.0 / total
	for i := range scenarios {
		scenarios[i].Probability = math.Round(scenarios[i].Probability*scale*10) / 10
	}

	// Fix rounding error — adjust largest scenario
	sum := 0.0
	for _, s := range scenarios {
		sum += s.Probability
	}
	diff := 100.0 - sum
	if diff != 0 && len(scenarios) > 0 {
		// Find the scenario with highest probability
		maxIdx := 0
		for i := 1; i < len(scenarios); i++ {
			if scenarios[i].Probability > scenarios[maxIdx].Probability {
				maxIdx = i
			}
		}
		scenarios[maxIdx].Probability = math.Round((scenarios[maxIdx].Probability+diff)*10) / 10
	}

	// Sort by probability descending
	sortScenariosByProbability(scenarios)

	return scenarios
}

func sortScenariosByProbability(scenarios []models.Scenario) {
	// Simple insertion sort by probability descending
	for i := 1; i < len(scenarios); i++ {
		j := i
		for j > 0 && scenarios[j].Probability > scenarios[j-1].Probability {
			scenarios[j], scenarios[j-1] = scenarios[j-1], scenarios[j]
			j--
		}
	}
}

func roundPrice(p float64) float64 {
	if p >= 1000 {
		return math.Round(p/10) * 10
	}
	if p >= 100 {
		return math.Round(p)
	}
	if p >= 10 {
		return math.Round(p*10) / 10
	}
	return math.Round(p*100) / 100
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
