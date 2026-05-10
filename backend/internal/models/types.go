// Package models defines all shared data types used across the hermes-agent backend.
package models

import (
	"encoding/json"
	"time"
)

// ──────────────────────────────────────────────
// ENUMS
// ──────────────────────────────────────────────

// Trend represents market directional bias.
type Trend string

const (
	TrendBullish Trend = "bullish"
	TrendBearish Trend = "bearish"
	TrendNeutral Trend = "neutral"
)

// RiskLevel categorises risk severity.
type RiskLevel string

const (
	RiskLow      RiskLevel = "low"
	RiskModerate RiskLevel = "moderate"
	RiskHigh     RiskLevel = "high"
	RiskCritical RiskLevel = "critical"
)

// AssetCategory classifies the type of financial instrument.
type AssetCategory string

const (
	AssetStock     AssetCategory = "stock"
	AssetCrypto    AssetCategory = "crypto"
	AssetIndex     AssetCategory = "index"
	AssetCommodity AssetCategory = "commodity"
	AssetForex     AssetCategory = "forex"
	AssetETF       AssetCategory = "etf"
)

// ScenarioBias labels a scenario's directional bias.
type ScenarioBias string

const (
	ScenarioBullish ScenarioBias = "bullish"
	ScenarioBearish ScenarioBias = "bearish"
	ScenarioNeutral ScenarioBias = "neutral"
)

// ──────────────────────────────────────────────
// MARKET DATA
// ──────────────────────────────────────────────

// PricePoint is a single OHLCV candle.
type PricePoint struct {
	Date     time.Time `json:"date"`
	Open     float64   `json:"open"`
	High     float64   `json:"high"`
	Low      float64   `json:"low"`
	Close    float64   `json:"close"`
	Volume   int64     `json:"volume"`
	AdjClose float64   `json:"adj_close,omitempty"`
}

// Quote is a real-time snapshot.
type Quote struct {
	Symbol        string    `json:"symbol"`
	Name          string    `json:"name"`
	Price         float64   `json:"price"`
	Change        float64   `json:"change"`
	ChangePercent float64   `json:"change_percent"`
	PreviousClose float64   `json:"previous_close"`
	DayHigh       float64   `json:"day_high"`
	DayLow        float64   `json:"day_low"`
	Volume        int64     `json:"volume"`
	MarketCap     float64   `json:"market_cap,omitempty"`
	FetchedAt     time.Time `json:"fetched_at"`
}

// TechnicalIndicators bundles common technical analysis values.
type TechnicalIndicators struct {
	RSI14        float64 `json:"rsi_14"`
	RSISignal    Trend   `json:"rsi_signal"`
	MACDLine     float64 `json:"macd_line"`
	MACDSignal   float64 `json:"macd_signal"`
	MACDHist     float64 `json:"macd_histogram"`
	MACDCross    string  `json:"macd_cross"` // "bullish", "bearish", "none"
	SMA20        float64 `json:"sma_20"`
	SMA50        float64 `json:"sma_50"`
	SMA200       float64 `json:"sma_200"`
	EMA12        float64 `json:"ema_12,omitempty"`
	EMA26        float64 `json:"ema_26,omitempty"`
	BollingerUp  float64 `json:"bollinger_upper,omitempty"`
	BollingerMid float64 `json:"bollinger_mid,omitempty"`
	BollingerLow float64 `json:"bollinger_lower,omitempty"`
	ATR14        float64 `json:"atr_14,omitempty"`
	VolumeSMA20  int64   `json:"volume_sma_20,omitempty"`
}

// SupportResistance holds key price levels.
type SupportResistance struct {
	Supports    []float64 `json:"supports"`
	Resistances []float64 `json:"resistances"`
	PivotPoint  float64   `json:"pivot_point"`
}

// MarketData is the aggregated market snapshot used by agents.
type MarketData struct {
	Symbol            string               `json:"symbol"`
	Name              string               `json:"name"`
	Category          AssetCategory        `json:"category"`
	Currency          string               `json:"currency"`
	Quote             *Quote               `json:"quote"`
	HistoricalPrices  []PricePoint         `json:"historical_prices"`
	Technical         *TechnicalIndicators `json:"technical"`
	SupportResistance *SupportResistance   `json:"support_resistance"`
	Volatility30D     float64              `json:"volatility_30d"`
	AvgVolume30D      int64                `json:"avg_volume_30d"`
	FetchedAt         time.Time            `json:"fetched_at"`
}

// ──────────────────────────────────────────────
// AGENT OUTPUTS
// ──────────────────────────────────────────────

// MarketAnalysis is the output of the Market Agent.
type MarketAnalysis struct {
	AgentName   string    `json:"agent_name"` // "market_agent"
	GeneratedAt time.Time `json:"generated_at"`

	Trend          Trend                `json:"trend"`
	TrendStrength  float64              `json:"trend_strength"` // 0..100
	Momentum       string               `json:"momentum"`       // "accelerating", "decelerating", "stable"
	Structure      string               `json:"structure"`      // "trending_up", "trending_down", "range", "breakout"
	Technical      *TechnicalIndicators `json:"technical"`
	KeyLevels      *SupportResistance   `json:"key_levels"`
	VolatilityNote string               `json:"volatility_note"`
	Summary        string               `json:"summary"`
	RawText        string               `json:"raw_text"` // Full LLM output
}

// NewsItem represents a single news article or event.
type NewsItem struct {
	Title     string    `json:"title"`
	Source    string    `json:"source"`
	URL       string    `json:"url,omitempty"`
	Published time.Time `json:"published"`
	Sentiment string    `json:"sentiment"` // "positive", "negative", "neutral"
	Impact    string    `json:"impact"`    // "high", "medium", "low"
	Summary   string    `json:"summary"`
}

// NewsAnalysis is the output of the News Agent.
type NewsAnalysis struct {
	AgentName   string    `json:"agent_name"` // "news_agent"
	GeneratedAt time.Time `json:"generated_at"`

	RecentEvents     []NewsItem `json:"recent_events"`
	KeyThemes        []string   `json:"key_themes"`
	OverallSentiment string     `json:"overall_sentiment"` // "positive", "negative", "mixed"
	MacroOutlook     string     `json:"macro_outlook"`
	ImpactOnAsset    string     `json:"impact_on_asset"` // "favorable", "unfavorable", "neutral"
	Summary          string     `json:"summary"`
	RawText          string     `json:"raw_text"`
}

// RiskFactor describes a single risk element.
type RiskFactor struct {
	Name        string    `json:"name"`
	Level       RiskLevel `json:"level"`
	Description string    `json:"description"`
	Mitigation  string    `json:"mitigation,omitempty"`
}

// RiskAnalysis is the output of the Risk Agent.
type RiskAnalysis struct {
	AgentName   string    `json:"agent_name"` // "risk_agent"
	GeneratedAt time.Time `json:"generated_at"`

	OverallRisk      RiskLevel    `json:"overall_risk"`
	RiskScore        float64      `json:"risk_score"` // 0..100
	Factors          []RiskFactor `json:"factors"`
	DrawdownRisk     float64      `json:"drawdown_risk_pct"` // estimated max drawdown %
	CorrelationNote  string       `json:"correlation_note"`
	TailRisk         string       `json:"tail_risk"`         // black swan potential
	VolatilityRegime string       `json:"volatility_regime"` // "low", "normal", "elevated", "extreme"
	Summary          string       `json:"summary"`
	RawText          string       `json:"raw_text"`
}

// Scenario defines a single market scenario with probability.
type Scenario struct {
	Bias           ScenarioBias `json:"bias"`
	Name           string       `json:"name"`
	Description    string       `json:"description"`
	Probability    float64      `json:"probability"` // 0..100
	TargetPrice    float64      `json:"target_price,omitempty"`
	Timeframe      string       `json:"timeframe"`
	KeyTriggers    []string     `json:"key_triggers"`
	InvalidationPt float64      `json:"invalidation_point,omitempty"`
}

// StrategyAnalysis is the output of the Strategy Agent — the synthesis.
type StrategyAnalysis struct {
	AgentName   string    `json:"agent_name"` // "strategy_agent"
	GeneratedAt time.Time `json:"generated_at"`

	Scenarios       []Scenario   `json:"scenarios"`
	PrimaryBias     ScenarioBias `json:"primary_bias"`
	ConvictionLevel string       `json:"conviction_level"` // "low", "moderate", "high"
	CriticalLevels  []float64    `json:"critical_levels"`
	Uncertainties   []string     `json:"uncertainties"`
	CrossAssetNote  string       `json:"cross_asset_note,omitempty"`
	Summary         string       `json:"summary"`
	Conclusion      string       `json:"conclusion"`
	RawText         string       `json:"raw_text"`
}

// ──────────────────────────────────────────────
// API TYPES
// ──────────────────────────────────────────────

// AnalyzeRequest is the incoming request from the frontend.
type AnalyzeRequest struct {
	Symbol       string        `json:"symbol"`
	Category     AssetCategory `json:"category,omitempty"` // auto-detected if empty
	ForceRefresh bool          `json:"force_refresh,omitempty"`
}

// AnalyzeResponse is the complete analysis payload returned to the client.
type AnalyzeResponse struct {
	RequestID   string        `json:"request_id"`
	Symbol      string        `json:"symbol"`
	Name        string        `json:"name"`
	Category    AssetCategory `json:"category"`
	GeneratedAt time.Time     `json:"generated_at"`

	MarketData *MarketData       `json:"market_data"`
	Market     *MarketAnalysis   `json:"market_analysis"`
	News       *NewsAnalysis     `json:"news_analysis"`
	Risk       *RiskAnalysis     `json:"risk_analysis"`
	Strategy   *StrategyAnalysis `json:"strategy_analysis"`

	Errors   []string `json:"errors,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
	Cached   bool     `json:"cached"`
}

// AnalysisProgress is sent via SSE for streaming progress updates.
type AnalysisProgress struct {
	RequestID string `json:"request_id"`
	Stage     string `json:"stage"`    // "fetching_data", "market_agent", "news_agent", "risk_agent", "strategy_agent", "complete"
	Progress  int    `json:"progress"` // 0..100
	Message   string `json:"message"`
}

// ErrorResponse is the standard error envelope.
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code"`
	Details string `json:"details,omitempty"`
}

// SearchResult is a lightweight ticker suggestion.
type SearchResult struct {
	Symbol   string        `json:"symbol"`
	Name     string        `json:"name"`
	Category AssetCategory `json:"category"`
	Exchange string        `json:"exchange,omitempty"`
	Currency string        `json:"currency,omitempty"`
}

// ──────────────────────────────────────────────
// CACHE
// ──────────────────────────────────────────────

// CacheEntry wraps a stored analysis with metadata.
type CacheEntry struct {
	Symbol    string          `json:"symbol"`
	Response  AnalyzeResponse `json:"response"`
	CreatedAt time.Time       `json:"created_at"`
	ExpiresAt time.Time       `json:"expires_at"`
	HitCount  int             `json:"hit_count"`
}

// ──────────────────────────────────────────────
// AGENT SYSTEM PROMPTS
// ──────────────────────────────────────────────

// AgentPrompt holds the system prompt configuration for each agent.
type AgentPrompt struct {
	AgentName    string `json:"agent_name"`
	Role         string `json:"role"`
	SystemPrompt string `json:"system_prompt"`
	OutputSchema string `json:"output_schema"`
}

// ──────────────────────────────────────────────
// SERIALISATION HELPERS
// ──────────────────────────────────────────────

// MarshalJSON implements custom JSON marshalling for Trend.
func (t Trend) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(t))
}

// MarshalJSON implements custom JSON marshalling for RiskLevel.
func (r RiskLevel) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(r))
}

// MarshalJSON implements custom JSON marshalling for AssetCategory.
func (a AssetCategory) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(a))
}

// MarshallJSON implements custom JSON marshalling for ScenarioBias.
func (s ScenarioBias) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(s))
}
