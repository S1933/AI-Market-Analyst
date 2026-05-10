// Package agents implements the multi-agent financial analysis system.
// Each agent is responsible for a specific domain of analysis.
package agents

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hermes-agent/backend/internal/llm"
	"github.com/hermes-agent/backend/internal/market"
	"github.com/hermes-agent/backend/internal/models"
)

// MarketAgent performs technical price analysis.
// It analyses price action, trends, indicators, support/resistance levels,
// volatility, and momentum to produce a structured technical assessment.
type MarketAgent struct {
	llmClient *llm.Client
}

// NewMarketAgent creates a new market agent.
func NewMarketAgent(llmClient *llm.Client) *MarketAgent {
	return &MarketAgent{llmClient: llmClient}
}

//go:embed prompts/market_agent.md
var marketAgentSystemPrompt string

// userPromptTemplate builds the analysis request with actual market data.
const marketAgentUserPrompt = `Analyse les données de marché suivantes pour %s (%s) :

## COTATION
- Prix : %.2f %s
- Variation : %+.2f (%+.2f%%)
- Fourchette du jour : %.2f - %.2f
- Clôture précédente : %.2f
- Volume : %d

## INDICATEURS TECHNIQUES
- RSI (14) : %.1f
- Ligne MACD : %.4f | Signal : %.4f | Histogramme : %.4f
- SMA 20 : %.2f | SMA 50 : %.2f | SMA 200 : %.2f
- Bandes de Bollinger : Supérieure %.2f | Médiane %.2f | Inférieure %.2f
- ATR (14) : %.2f
- Volatilité 20 jours : %.2f%%

## STRUCTURE DE MARCHÉ
- Tendance principale : %s
- Force : %s
- Phase : %s
- Au-dessus de la MA 200 : %v
- Au-dessus de la MA 50 : %v
- Points hauts croissants : %v
- Points bas croissants : %v

## NIVEAUX DE SUPPORT
%s

## NIVEAUX DE RÉSISTANCE
%s

## ACTION RÉCENTE DES PRIX (10 dernières clôtures)
%s

Sur la base de ces données, produis ton analyse technique en suivant les instructions de ton prompt système.
Réponds UNIQUEMENT avec un JSON valide — pas d'encadrement markdown, pas de texte supplémentaire.`

// Analyze performs the technical analysis.
func (a *MarketAgent) Analyze(ctx context.Context, data *market.MarketData) (*models.MarketAnalysis, error) {
	// Build the user prompt with actual data
	prompt := buildMarketUserPrompt(data)

	// Call LLM
	var analysis models.MarketAnalysis
	err := a.llmClient.ChatJSON(ctx, marketAgentSystemPrompt, prompt, &analysis)
	if err != nil {
		return nil, fmt.Errorf("market agent LLM call failed: %w", err)
	}

	// Enrich with computed indicator values from our own calculations
	analysis.AgentName = "market_agent"
	analysis.GeneratedAt = time.Now()

	// Populate technical indicators struct from computed data
	analysis.Technical = &models.TechnicalIndicators{
		RSI14:        data.Indicators.RSI14,
		MACDLine:     data.Indicators.MACDLine,
		MACDSignal:   data.Indicators.MACDSignal,
		MACDHist:     data.Indicators.MACDHistogram,
		SMA20:        data.Indicators.SMA20,
		SMA50:        data.Indicators.SMA50,
		SMA200:       data.Indicators.SMA200,
		EMA12:        data.Indicators.EMA12,
		EMA26:        data.Indicators.EMA26,
		BollingerUp:  data.Indicators.BBUpper,
		BollingerMid: data.Indicators.BBMiddle,
		BollingerLow: data.Indicators.BBLower,
		ATR14:        data.Indicators.ATR14,
	}

	// Also set computed RSI signal
	switch {
	case data.Indicators.RSI14 > 70:
		analysis.Technical.RSISignal = models.TrendBearish // Overbought
	case data.Indicators.RSI14 < 30:
		analysis.Technical.RSISignal = models.TrendBullish // Oversold
	default:
		analysis.Technical.RSISignal = models.TrendNeutral
	}

	// Set MACD cross signal
	switch {
	case data.Indicators.MACDHistogram > 0 && analysis.Technical.MACDHist > 0:
		analysis.Technical.MACDCross = "bullish"
	case data.Indicators.MACDHistogram < 0 && analysis.Technical.MACDHist < 0:
		analysis.Technical.MACDCross = "bearish"
	default:
		analysis.Technical.MACDCross = "none"
	}

	// Populate key levels
	analysis.KeyLevels = &models.SupportResistance{
		Supports:    data.Indicators.SupportLevels,
		Resistances: data.Indicators.ResistLevels,
	}

	// If the LLM returned empty fields, provide fallback values from computed data
	if analysis.Trend == "" {
		analysis.Trend = models.Trend(data.Indicators.TrendStructure.Primary)
	}
	if analysis.Structure == "" {
		analysis.Structure = data.Indicators.TrendStructure.Phase
	}
	if analysis.TrendStrength == 0 {
		// Derive strength from RSI positioning
		switch {
		case data.Indicators.RSI14 > 60 || data.Indicators.RSI14 < 40:
			analysis.TrendStrength = 70
		case data.Indicators.RSI14 > 55 || data.Indicators.RSI14 < 45:
			analysis.TrendStrength = 55
		default:
			analysis.TrendStrength = 40
		}
	}

	return &analysis, nil
}

// Run implements the Agent interface. It calls Analyze and returns the
// JSON-serialised MarketAnalysis.
func (a *MarketAgent) Run(ctx context.Context, symbol string, marketData *market.MarketData, previousOutputs map[string]string) (string, error) {
	analysis, err := a.Analyze(ctx, marketData)
	if err != nil {
		return "", err
	}
	b, err := json.Marshal(analysis)
	if err != nil {
		return "", fmt.Errorf("failed to marshal market analysis: %w", err)
	}
	return string(b), nil
}

// buildMarketUserPrompt constructs the detailed data prompt.
func buildMarketUserPrompt(data *market.MarketData) string {
	// Format support levels
	supportStr := "None identified"
	if len(data.Indicators.SupportLevels) > 0 {
		supportStr = ""
		for _, s := range data.Indicators.SupportLevels {
			supportStr += fmt.Sprintf("  - %.2f\n", s)
		}
	}

	// Format resistance levels
	resistanceStr := "None identified"
	if len(data.Indicators.ResistLevels) > 0 {
		resistanceStr = ""
		for _, r := range data.Indicators.ResistLevels {
			resistanceStr += fmt.Sprintf("  - %.2f\n", r)
		}
	}

	// Format last 10 closes
	closeStr := ""
	start := len(data.Historical) - 10
	if start < 0 {
		start = 0
	}
	for i := start; i < len(data.Historical); i++ {
		p := data.Historical[i]
		closeStr += fmt.Sprintf("  %s: %.2f\n", p.Date.Format("2006-01-02"), p.Close)
	}

	return fmt.Sprintf(
		marketAgentUserPrompt,
		data.Quote.Symbol,
		data.Quote.Name,
		data.Quote.Price,
		data.Quote.Currency,
		data.Quote.Change,
		data.Quote.ChangePercent,
		data.Quote.Low,
		data.Quote.High,
		data.Quote.PrevClose,
		data.Quote.Volume,
		data.Indicators.RSI14,
		data.Indicators.MACDLine,
		data.Indicators.MACDSignal,
		data.Indicators.MACDHistogram,
		data.Indicators.SMA20,
		data.Indicators.SMA50,
		data.Indicators.SMA200,
		data.Indicators.BBUpper,
		data.Indicators.BBMiddle,
		data.Indicators.BBLower,
		data.Indicators.ATR14,
		data.Indicators.Volatility20,
		data.Indicators.TrendStructure.Primary,
		data.Indicators.TrendStructure.Strength,
		data.Indicators.TrendStructure.Phase,
		data.Indicators.TrendStructure.Above200MA,
		data.Indicators.TrendStructure.Above50MA,
		data.Indicators.TrendStructure.HigherHigh,
		data.Indicators.TrendStructure.HigherLow,
		supportStr,
		resistanceStr,
		closeStr,
	)
}

// AnalyzeWithoutLLM provides a pure computed-technical analysis when no LLM is available.
// This ensures the system can always produce a baseline analysis.
func (a *MarketAgent) AnalyzeWithoutLLM(data *market.MarketData) *models.MarketAnalysis {
	ti := data.Indicators
	ts := ti.TrendStructure

	analysis := &models.MarketAnalysis{
		AgentName:   "market_agent",
		GeneratedAt: time.Now(),
		Trend:       models.Trend(ts.Primary),
		Structure:   ts.Phase,
		Momentum:    "stable",
		Technical: &models.TechnicalIndicators{
			RSI14:        ti.RSI14,
			MACDLine:     ti.MACDLine,
			MACDSignal:   ti.MACDSignal,
			MACDHist:     ti.MACDHistogram,
			SMA20:        ti.SMA20,
			SMA50:        ti.SMA50,
			SMA200:       ti.SMA200,
			EMA12:        ti.EMA12,
			EMA26:        ti.EMA26,
			BollingerUp:  ti.BBUpper,
			BollingerMid: ti.BBMiddle,
			BollingerLow: ti.BBLower,
			ATR14:        ti.ATR14,
		},
		KeyLevels: &models.SupportResistance{
			Supports:    ti.SupportLevels,
			Resistances: ti.ResistLevels,
		},
	}

	// RSI signal
	switch {
	case ti.RSI14 > 70:
		analysis.Technical.RSISignal = models.TrendBearish
	case ti.RSI14 < 30:
		analysis.Technical.RSISignal = models.TrendBullish
	default:
		analysis.Technical.RSISignal = models.TrendNeutral
	}

	// MACD cross
	if ti.MACDHistogram > 0 {
		analysis.Technical.MACDCross = "bullish"
		analysis.Momentum = "accelerating"
	} else if ti.MACDHistogram < 0 {
		analysis.Technical.MACDCross = "bearish"
		analysis.Momentum = "decelerating"
	}

	// Trend strength from RSI
	switch {
	case ti.RSI14 >= 70 || ti.RSI14 <= 30:
		analysis.TrendStrength = 90
	case ti.RSI14 >= 60 || ti.RSI14 <= 40:
		analysis.TrendStrength = 70
	case ti.RSI14 >= 50 || ti.RSI14 <= 50:
		analysis.TrendStrength = 50
	default:
		analysis.TrendStrength = 40
	}

	// Note de volatilité
	switch {
	case ti.Volatility20 > 3:
		analysis.VolatilityNote = "Volatilité élevée — de fortes oscillations sont à prévoir. Le dimensionnement des positions doit en tenir compte."
	case ti.Volatility20 > 1.5:
		analysis.VolatilityNote = "Volatilité modérée — conditions de marché typiques."
	default:
		analysis.VolatilityNote = "Volatilité faible — le marché est relativement calme, mais des cassures pourraient être imminentes."
	}

	// Summary
	analysis.Summary = buildFallbackSummary(data, analysis)

	return analysis
}

// buildFallbackSummary generates a rule-based technical summary in French.
func buildFallbackSummary(data *market.MarketData, a *models.MarketAnalysis) string {
	ti := data.Indicators
	q := data.Quote

	parts := []string{}

	// Description de la tendance
	switch a.Trend {
	case models.TrendBullish:
		parts = append(parts, fmt.Sprintf(
			"%s est dans une %s %s. Le prix (%.2f $) évolue au-dessus de la SMA 50 jours (%.2f $) et de la SMA 200 jours (%.2f $), confirmant la structure haussière.",
			q.Symbol, a.Structure, a.Trend, q.Price, ti.SMA50, ti.SMA200,
		))
	case models.TrendBearish:
		parts = append(parts, fmt.Sprintf(
			"%s est dans une %s %s. Le prix (%.2f $) évolue sous les moyennes mobiles clés, indiquant une pression vendeuse persistante.",
			q.Symbol, a.Structure, a.Trend, q.Price,
		))
	default:
		parts = append(parts, fmt.Sprintf(
			"%s est dans une phase neutre/de consolidation autour de %.2f $. Aucun biais directionnel clair.",
			q.Symbol, q.Price,
		))
	}

	// Contexte RSI
	if ti.RSI14 > 70 {
		parts = append(parts, fmt.Sprintf("Le RSI est en surachat à %.1f — prudence sur les nouvelles entrées longues.", ti.RSI14))
	} else if ti.RSI14 < 30 {
		parts = append(parts, fmt.Sprintf("Le RSI est en survente à %.1f — potentiel de retour à la moyenne ou de rebond.", ti.RSI14))
	} else {
		parts = append(parts, fmt.Sprintf("Le RSI à %.1f est en territoire neutre.", ti.RSI14))
	}

	// MACD
	if ti.MACDHistogram > 0 {
		parts = append(parts, "L'histogramme MACD est positif, indiquant un momentum haussier.")
	} else {
		parts = append(parts, "L'histogramme MACD est négatif, indiquant un momentum baissier.")
	}

	// Niveaux clés
	if len(ti.SupportLevels) > 0 {
		parts = append(parts, fmt.Sprintf("Support clé à %.2f $.", ti.SupportLevels[0]))
	}
	if len(ti.ResistLevels) > 0 {
		parts = append(parts, fmt.Sprintf("Résistance clé à %.2f $.", ti.ResistLevels[0]))
	}

	result := ""
	for i, p := range parts {
		if i > 0 {
			result += " "
		}
		result += p
	}
	return result
}
