// Package agents contains the multi-agent financial analysis system.
// Each agent is a specialised analysis unit that produces structured output.
package agents

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/hermes-agent/backend/internal/llm"
	"github.com/hermes-agent/backend/internal/market"
	"github.com/hermes-agent/backend/internal/models"
)

// RiskAgent evaluates risks associated with an asset.
type RiskAgent struct {
	llmClient *llm.Client
	name      string
}

// NewRiskAgent creates a new RiskAgent.
func NewRiskAgent(llmClient *llm.Client) *RiskAgent {
	return &RiskAgent{
		llmClient: llmClient,
		name:      "risk_agent",
	}
}

// Name returns the agent's identifier.
func (a *RiskAgent) Name() string { return a.name }

// Run executes the risk analysis for the given symbol and market data.
func (a *RiskAgent) Run(ctx context.Context, symbol string, data *market.MarketData, newsSummary string) (*models.RiskAnalysis, error) {
	analysis := &models.RiskAnalysis{
		AgentName:   a.name,
		GeneratedAt: time.Now(),
		Factors:     make([]models.RiskFactor, 0),
	}

	// 1. Compute quantitative risk metrics from market data
	analysis = a.computeQuantitativeRisk(analysis, data)

	// 2. If LLM is available, enrich with qualitative analysis
	if a.llmClient != nil && a.llmClient.IsConfigured() {
		llmAnalysis, err := a.callLLM(ctx, symbol, data, newsSummary, analysis)
		if err != nil {
			// LLM call failed — use computed metrics only
			analysis.Summary = a.buildFallbackSummary(analysis)
			analysis.RawText = fmt.Sprintf("LLM indisponible : %v", err)
		} else {
			analysis = llmAnalysis
		}
	} else {
		analysis.Summary = a.buildFallbackSummary(analysis)
		analysis.RawText = "Aucun LLM configuré — évaluation quantitative du risque uniquement."
	}

	return analysis, nil
}

// computeQuantitativeRisk calculates risk metrics from market data.
func (a *RiskAgent) computeQuantitativeRisk(analysis *models.RiskAnalysis, data *market.MarketData) *models.RiskAnalysis {
	indicators := data.Indicators
	vol := indicators.Volatility20

	// Volatility regime classification
	switch {
	case vol < 1.0:
		analysis.VolatilityRegime = "low"
	case vol < 2.0:
		analysis.VolatilityRegime = "normal"
	case vol < 4.0:
		analysis.VolatilityRegime = "elevated"
	default:
		analysis.VolatilityRegime = "extreme"
	}

	// Risk score (0-100)
	riskScore := 0.0

	// Volatility contribution (max 30 pts)
	if vol > 0 {
		riskScore += math.Min(vol*8, 30)
	}

	// RSI extremes contribution (max 20 pts)
	rsi := indicators.RSI14
	if rsi > 0 {
		if rsi > 75 {
			riskScore += 20 // Risque de surachat
		} else if rsi > 65 {
			riskScore += 10
		} else if rsi < 25 {
			riskScore += 20 // Risque de continuation en survente
		} else if rsi < 35 {
			riskScore += 10
		}
	}

	// Trend weakness contribution (max 10 pts)
	if indicators.TrendStructure.Primary == "neutral" {
		riskScore += 5
	}
	if indicators.TrendStructure.Strength == "weak" {
		riskScore += 5
	}

	// Distance from 200MA contribution (max 15 pts)
	if indicators.SMA200 > 0 && data.Quote.Price > 0 {
		distFrom200 := math.Abs(data.Quote.Price-indicators.SMA200) / indicators.SMA200 * 100
		if distFrom200 > 20 {
			riskScore += 15 // Éloigné de la moyenne long terme
		} else if distFrom200 > 12 {
			riskScore += 8
		}
	}

	analysis.RiskScore = math.Min(math.Round(riskScore), 100)

	// Overall risk level
	switch {
	case analysis.RiskScore >= 70:
		analysis.OverallRisk = models.RiskHigh
	case analysis.RiskScore >= 40:
		analysis.OverallRisk = models.RiskModerate
	default:
		analysis.OverallRisk = models.RiskLow
	}

	// Drawdown risk estimation
	atrPct := 0.0
	if data.Quote.Price > 0 && indicators.ATR14 > 0 {
		atrPct = indicators.ATR14 / data.Quote.Price * 100
	}
	analysis.DrawdownRisk = math.Round(vol*1.5 + atrPct*2)
	if analysis.DrawdownRisk < 2 {
		analysis.DrawdownRisk = 2
	}
	if analysis.DrawdownRisk > 40 {
		analysis.DrawdownRisk = 40
	}

	// Build risk factors from indicators
	factors := make([]models.RiskFactor, 0)

	// Volatility factor
	volLevel := models.RiskModerate
	if vol > 3.0 {
		volLevel = models.RiskHigh
	} else if vol < 1.0 {
		volLevel = models.RiskLow
	}
	factors = append(factors, models.RiskFactor{
		Name:        "Volatilité de marché",
		Level:       volLevel,
		Description: fmt.Sprintf("Volatilité à 30 jours de %.1f%%. Régime de volatilité : %s.", vol, analysis.VolatilityRegime),
		Mitigation:  "Réduire la taille des positions. Utiliser des stop-loss plus larges. Envisager une couverture.",
	})

	// RSI extremes factor
	if rsi > 70 {
		factors = append(factors, models.RiskFactor{
			Name:        "Conditions de surachat",
			Level:       models.RiskModerate,
			Description: fmt.Sprintf("Le RSI(14) à %.1f indique un territoire de surachat. Risque de retour à la moyenne ou de correction.", rsi),
			Mitigation:  "Éviter de poursuivre le mouvement. Attendre un repli vers les supports clés.",
		})
	} else if rsi < 30 {
		factors = append(factors, models.RiskFactor{
			Name:        "Conditions de survente",
			Level:       models.RiskModerate,
			Description: fmt.Sprintf("Le RSI(14) à %.1f indique un territoire de survente. Risque de pression vendeuse continue.", rsi),
			Mitigation:  "Attendre la confirmation d'un retournement avant d'entrer.",
		})
	}

	// Trend risk factor
	if indicators.TrendStructure.Primary == "bearish" {
		factors = append(factors, models.RiskFactor{
			Name:        "Structure de tendance baissière",
			Level:       models.RiskHigh,
			Description: "Le prix est sous la MA 200 et forme des plus bas décroissants. Le risque de contre-tendance est élevé.",
			Mitigation:  "Privilégier le côté vendeur ou rester à l'écart. Stops serrés sur toute position longue.",
		})
	} else if indicators.TrendStructure.Phase == "consolidation" && indicators.TrendStructure.Strength == "weak" {
		factors = append(factors, models.RiskFactor{
			Name:        "Indécision / Consolidation",
			Level:       models.RiskModerate,
			Description: "Marché en consolidation sans direction claire. Action de prix erratique attendue.",
			Mitigation:  "Stratégies de trading de range. Éviter les trades de cassure avant confirmation.",
		})
	}

	// Overextension factor
	if indicators.SMA200 > 0 && data.Quote.Price > 0 {
		dist200 := (data.Quote.Price - indicators.SMA200) / indicators.SMA200 * 100
		if dist200 > 15 {
			factors = append(factors, models.RiskFactor{
				Name:        "Surextension par rapport à la MA 200",
				Level:       models.RiskModerate,
				Description: fmt.Sprintf("Le prix est %.0f%% au-dessus de la moyenne mobile à 200 jours. Risque de retour à la moyenne élevé.", dist200),
				Mitigation:  "Alléger les positions étendues. Remonter les stops au point mort.",
			})
		}
	}

	analysis.Factors = factors

	// Tail risk note
	analysis.TailRisk = "Risque de queue standard lié aux événements cygne noir (choc géopolitique, krach éclair, surprise réglementaire)."
	if vol > 3.0 {
		analysis.TailRisk += " La volatilité élevée amplifie le risque de queue."
	}

	return analysis
}

// callLLM enriches the risk analysis using the language model.
func (a *RiskAgent) callLLM(ctx context.Context, symbol string, data *market.MarketData, newsSummary string, existing *models.RiskAnalysis) (*models.RiskAnalysis, error) {
	systemPrompt := a.buildSystemPrompt()
	userPrompt := a.buildUserPrompt(symbol, data, newsSummary, existing)

	type LLMRiskResponse struct {
		OverallRisk      string             `json:"overall_risk"`
		RiskScore        float64            `json:"risk_score"`
		Factors          []models.RiskFactor `json:"factors"`
		DrawdownRisk     float64            `json:"drawdown_risk_pct"`
		CorrelationNote  string             `json:"correlation_note"`
		TailRisk         string             `json:"tail_risk"`
		VolatilityRegime string             `json:"volatility_regime"`
		Summary          string             `json:"summary"`
	}

	var llmResp LLMRiskResponse
	if err := a.llmClient.ChatJSON(ctx, systemPrompt, userPrompt, &llmResp); err != nil {
		return nil, err
	}

	// Merge LLM response with computed data
	analysis := existing
	if llmResp.OverallRisk != "" {
		analysis.OverallRisk = models.RiskLevel(llmResp.OverallRisk)
	}
	if llmResp.RiskScore > 0 {
		analysis.RiskScore = llmResp.RiskScore
	}
	if len(llmResp.Factors) > 0 {
		// Merge: keep computed factors, add any new qualitative ones from LLM
		for _, f := range llmResp.Factors {
			if f.Name != "" && f.Description != "" {
				analysis.Factors = append(analysis.Factors, f)
			}
		}
	}
	if llmResp.DrawdownRisk > 0 {
		analysis.DrawdownRisk = llmResp.DrawdownRisk
	}
	analysis.CorrelationNote = llmResp.CorrelationNote
	analysis.TailRisk = llmResp.TailRisk
	if llmResp.VolatilityRegime != "" {
		analysis.VolatilityRegime = llmResp.VolatilityRegime
	}
	analysis.Summary = llmResp.Summary

	// Store raw LLM response for transparency
	rawJSON, _ := json.Marshal(llmResp)
	analysis.RawText = string(rawJSON)

	return analysis, nil
}

// buildSystemPrompt creates the system prompt for the Risk Agent.
func (a *RiskAgent) buildSystemPrompt() string {
	return `Tu es l'Agent Risque d'un système d'analyse financière multi-agents.
Ton rôle est d'évaluer les risques associés à un actif financier.

Tu dois TOUJOURS produire un JSON valide respectant exactement ce schéma :
{
  "overall_risk": "low|moderate|high|critical",
  "risk_score": <nombre 0-100>,
  "factors": [
    {
      "name": "<nom du facteur de risque>",
      "level": "low|moderate|high|critical",
      "description": "<explication détaillée du risque>",
      "mitigation": "<comment ce risque peut être géré>"
    }
  ],
  "drawdown_risk_pct": <pourcentage estimé de drawdown maximum>,
  "correlation_note": "<comment cet actif est corrélé au marché global>",
  "tail_risk": "<description des risques de queue ou cygnes noirs>",
  "volatility_regime": "low|normal|elevated|extreme",
  "summary": "<résumé de l'évaluation du risque en un paragraphe>"
}

Règles :
- Ne jamais donner de conseil d'investissement (pas de recommandations « acheter », « vendre », « conserver »)
- Être factuel et mesuré
- Identifier les risques, pas les certitudes
- Prendre en compte : risque de marché, risque de liquidité, risque de concentration, risque réglementaire, risque géopolitique, risque de queue
- Si tu ne disposes pas d'assez d'informations, indiquer explicitement ce qui manque
- Exprimer les scores et probabilités de risque comme des estimations, pas des certitudes`
}

// buildUserPrompt builds the user prompt with market context.
func (a *RiskAgent) buildUserPrompt(symbol string, data *market.MarketData, newsSummary string, analysis *models.RiskAnalysis) string {
	prompt := fmt.Sprintf(`Analyse les risques pour %s.

DONNÉES DE MARCHÉ ACTUELLES :
- Symbole : %s (%s)
- Prix : %.2f %s
- Variation : %.2f (%.2f%%)
- Fourchette du jour : %.2f - %.2f

INDICATEURS TECHNIQUES (calculés) :
- RSI(14) : %.1f
- SMA 20 : %.2f
- SMA 50 : %.2f
- SMA 200 : %.2f
- Ligne MACD : %.4f, Signal : %.4f
- ATR(14) : %.2f
- Volatilité 30 jours : %.2f%%
- Bollinger Supérieure : %.2f, Inférieure : %.2f
- Structure de tendance : %s (force : %s, phase : %s)
- Au-dessus MA 200 : %v, Au-dessus MA 50 : %v
- Plus hauts croissants : %v, Plus bas croissants : %v

NIVEAUX DE SUPPORT : %v
NIVEAUX DE RÉSISTANCE : %v

MÉTRIQUES DE RISQUE CALCULÉES :
- Score de risque : %.0f/100
- Régime de volatilité : %s
- Risque de drawdown estimé : %.0f%%
- Facteurs actuels : %d identifiés

CONTEXTE DES ACTUALITÉS RÉCENTES :
%s

Sur la base de toutes ces données, fournis une évaluation complète des risques.
Identifie les facteurs de risque clés avec leur niveau de sévérité.
Estime le risque de drawdown maximum.
Note tout risque de queue ou scénario cygne noir.
Produis UNIQUEMENT la réponse JSON.`,
		symbol,
		data.Quote.Symbol, data.Quote.Name,
		data.Quote.Price, data.Quote.Currency,
		data.Quote.Change, data.Quote.ChangePercent,
		data.Quote.Low, data.Quote.High,
		data.Indicators.RSI14,
		data.Indicators.SMA20,
		data.Indicators.SMA50,
		data.Indicators.SMA200,
		data.Indicators.MACDLine, data.Indicators.MACDSignal,
		data.Indicators.ATR14,
		data.Indicators.Volatility20,
		data.Indicators.BBUpper, data.Indicators.BBLower,
		data.Indicators.TrendStructure.Primary,
		data.Indicators.TrendStructure.Strength,
		data.Indicators.TrendStructure.Phase,
		data.Indicators.TrendStructure.Above200MA,
		data.Indicators.TrendStructure.Above50MA,
		data.Indicators.TrendStructure.HigherHigh,
		data.Indicators.TrendStructure.HigherLow,
		data.Indicators.SupportLevels,
		data.Indicators.ResistLevels,
		analysis.RiskScore,
		analysis.VolatilityRegime,
		analysis.DrawdownRisk,
		len(analysis.Factors),
		newsSummary,
	)
	return prompt
}

// buildFallbackSummary generates a summary when LLM is unavailable.
func (a *RiskAgent) buildFallbackSummary(analysis *models.RiskAnalysis) string {
	switch analysis.OverallRisk {
	case models.RiskLow:
		return fmt.Sprintf("Le risque global est FAIBLE (score : %.0f/100). Le régime de volatilité est %s. Les facteurs de risque clés sont limités. "+
			"Drawdown maximum estimé : %.0f%%. Surveiller les supports pour tout changement du profil de risque.",
			analysis.RiskScore, analysis.VolatilityRegime, analysis.DrawdownRisk)
	case models.RiskModerate:
		return fmt.Sprintf("Le risque global est MODÉRÉ (score : %.0f/100). Le régime de volatilité est %s. "+
			"Plusieurs facteurs de risque nécessitent une attention. Drawdown maximum estimé : %.0f%%. "+
			"Le dimensionnement des positions et la gestion des stops sont importants.",
			analysis.RiskScore, analysis.VolatilityRegime, analysis.DrawdownRisk)
	case models.RiskHigh:
		return fmt.Sprintf("Le risque global est ÉLEVÉ (score : %.0f/100). Le régime de volatilité est %s. "+
			"Facteurs de risque significatifs présents. Drawdown maximum estimé : %.0f%%. "+
			"Une exposition réduite et une couverture doivent être envisagées.",
			analysis.RiskScore, analysis.VolatilityRegime, analysis.DrawdownRisk)
	default:
		return fmt.Sprintf("Le risque global est CRITIQUE (score : %.0f/100). Le régime de volatilité est %s. "+
			"Multiples facteurs de risque sévères. Drawdown maximum estimé : %.0f%%. Une extrême prudence est de mise.",
			analysis.RiskScore, analysis.VolatilityRegime, analysis.DrawdownRisk)
	}
}
