// ─────────────────────────────────────────────────────────────
// TYPES — Shared between frontend and backend
// These mirror the Go models in backend/internal/models/types.go
// ─────────────────────────────────────────────────────────────

// ── ENUMS ──────────────────────────────────────────────────

export type Trend = "bullish" | "bearish" | "neutral";
export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type AssetCategory =
  | "stock"
  | "crypto"
  | "index"
  | "commodity"
  | "forex"
  | "etf";
export type ScenarioBias = "bullish" | "bearish" | "neutral";

// ── MARKET DATA ────────────────────────────────────────────

export interface PricePoint {
  date: string; // ISO 8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adj_close?: number;
}

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  previous_close: number;
  day_high: number;
  day_low: number;
  volume: number;
  market_cap?: number;
  fetched_at: string;
}

export interface TechnicalIndicators {
  rsi_14: number;
  rsi_signal: Trend;
  macd_line: number;
  macd_signal: number;
  macd_histogram: number;
  macd_cross: "bullish" | "bearish" | "none";
  sma_20: number;
  sma_50: number;
  sma_200: number;
  ema_12?: number;
  ema_26?: number;
  bollinger_upper?: number;
  bollinger_mid?: number;
  bollinger_lower?: number;
  atr_14?: number;
  volume_sma_20?: number;
}

export interface SupportResistance {
  supports: number[];
  resistances: number[];
  pivot_point: number;
}

export interface MarketData {
  symbol: string;
  name: string;
  category: AssetCategory;
  currency: string;
  quote: Quote;
  historical_prices: PricePoint[];
  technical: TechnicalIndicators;
  support_resistance: SupportResistance;
  volatility_30d: number;
  avg_volume_30d: number;
  fetched_at: string;
}

// ── AGENT OUTPUTS ──────────────────────────────────────────

export interface MarketAnalysis {
  agent_name: string;
  generated_at: string;
  trend: Trend;
  trend_strength: number; // 0..100
  momentum: "accelerating" | "decelerating" | "stable";
  structure: "trending_up" | "trending_down" | "range" | "breakout";
  technical: TechnicalIndicators;
  key_levels: SupportResistance;
  volatility_note: string;
  summary: string;
  raw_text: string;
}

export interface NewsItem {
  title: string;
  source: string;
  url?: string;
  published: string; // ISO 8601
  sentiment: "positive" | "negative" | "neutral";
  impact: "high" | "medium" | "low";
  summary: string;
}

export interface NewsAnalysis {
  agent_name: string;
  generated_at: string;
  recent_events: NewsItem[];
  key_themes: string[];
  overall_sentiment: "positive" | "negative" | "mixed";
  macro_outlook: string;
  impact_on_asset: "favorable" | "unfavorable" | "neutral";
  summary: string;
  raw_text: string;
}

export interface RiskFactor {
  name: string;
  level: RiskLevel;
  description: string;
  mitigation?: string;
}

export interface RiskAnalysis {
  agent_name: string;
  generated_at: string;
  overall_risk: RiskLevel;
  risk_score: number; // 0..100
  factors: RiskFactor[];
  drawdown_risk_pct: number;
  correlation_note: string;
  tail_risk: string;
  volatility_regime: "low" | "normal" | "elevated" | "extreme";
  summary: string;
  raw_text: string;
}

export interface Scenario {
  bias: ScenarioBias;
  name: string;
  description: string;
  probability: number; // 0..100
  target_price?: number;
  timeframe: string;
  key_triggers: string[];
  invalidation_point?: number;
}

export interface StrategyAnalysis {
  agent_name: string;
  generated_at: string;
  scenarios: Scenario[];
  primary_bias: ScenarioBias;
  conviction_level: "low" | "moderate" | "high";
  critical_levels: number[];
  uncertainties: string[];
  cross_asset_note?: string;
  summary: string;
  conclusion: string;
  raw_text: string;
}

// ── API TYPES ──────────────────────────────────────────────

export interface AnalyzeRequest {
  symbol: string;
  category?: AssetCategory;
  force_refresh?: boolean;
}

export interface AnalyzeResponse {
  request_id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  generated_at: string;
  market_data: MarketData;
  market_analysis: MarketAnalysis;
  news_analysis: NewsAnalysis;
  risk_analysis: RiskAnalysis;
  strategy_analysis: StrategyAnalysis;
  errors: string[];
  warnings: string[];
  cached: boolean;
}

export interface AnalysisProgress {
  request_id: string;
  stage: string;
  progress: number; // 0..100
  message: string;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  category: AssetCategory;
  exchange?: string;
  currency?: string;
}

// ── UI-SPECIFIC DERIVED TYPES ──────────────────────────────

/** Color mapping for each trend type */
export const TREND_COLORS: Record<Trend, string> = {
  bullish: "#22c55e",
  bearish: "#ef4444",
  neutral: "#f59e0b",
};

/** Libellés en français */
export const TREND_LABELS: Record<Trend, string> = {
  bullish: "Haussier ▲",
  bearish: "Baissier ▼",
  neutral: "Neutre ◆",
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#ef4444",
  critical: "#dc2626",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Faible",
  moderate: "Modéré",
  high: "Élevé",
  critical: "Critique",
};

/** Format a large number in compact form */
export function formatNumber(n: number, decimals: number = 2): string {
  if (n >= 1_000_000_000_000)
    return (n / 1_000_000_000_000).toFixed(decimals) + "T";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(decimals) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(decimals) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(decimals) + "K";
  return n.toFixed(decimals);
}

/** Format price change with + sign and % */
export function formatChange(change: number, percent: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
}

/** Format a timestamp into a readable date (French locale) */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a timestamp into relative time (French) */
export function formatRelativeTime(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return `Il y a ${Math.floor(diffMs / (1000 * 60))} min`;
  if (diffHours < 24) return `Il y a ${Math.floor(diffHours)} h`;
  if (diffHours < 48) return "Hier";
  if (diffHours < 168) return `Il y a ${Math.floor(diffHours / 24)} j`;
  return formatDate(iso);
}
