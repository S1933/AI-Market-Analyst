'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, BarChart3, ArrowUpRight, ArrowDownRight, Gauge } from 'lucide-react';
import type { MarketAnalysis, MarketData, TechnicalIndicators, SupportResistance } from '@/lib/types';
import { AnalysisCard, Badge, Metric } from './AnalysisCard';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface MarketAnalysisSectionProps {
  analysis: MarketAnalysis;
  marketData?: MarketData;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'bullish':
      return <TrendingUp size={18} className="text-[#22c55e]" />;
    case 'bearish':
      return <TrendingDown size={18} className="text-[#ef4444]" />;
    default:
      return <Minus size={18} className="text-[#f59e0b]" />;
  }
}

function MomentumBadge({ momentum }: { momentum: string }) {
  const map: Record<string, { label: string; variant: 'bullish' | 'bearish' | 'neutral' }> = {
    accelerating: { label: 'Accelerating', variant: 'bullish' },
    decelerating: { label: 'Decelerating', variant: 'bearish' },
    stable: { label: 'Stable', variant: 'neutral' },
  };
  const info = map[momentum] || { label: momentum, variant: 'neutral' as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function StructureBadge({ structure }: { structure: string }) {
  const map: Record<string, { label: string; variant: 'bullish' | 'bearish' | 'neutral' }> = {
    trending_up: { label: 'Trending Up', variant: 'bullish' },
    trending_down: { label: 'Trending Down', variant: 'bearish' },
    range: { label: 'Range-Bound', variant: 'neutral' },
    breakout: { label: 'Breakout', variant: 'bullish' },
  };
  const info = map[structure] || { label: structure, variant: 'neutral' as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function RsiGauge({ value }: { value: number }) {
  // Determine color and position
  let color = '#22c55e';
  let label = 'Neutral';
  if (value >= 70) {
    color = '#ef4444';
    label = 'Overbought';
  } else if (value >= 60) {
    color = '#f59e0b';
    label = 'Bullish';
  } else if (value <= 30) {
    color = '#22c55e';
    label = 'Oversold';
  } else if (value <= 40) {
    color = '#f59e0b';
    label = 'Bearish';
  }

  // Clamp for the gauge display
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-[#11141b] rounded-xl border border-[#1e293b]">
      <Gauge size={20} style={{ color }} />
      <div className="text-2xl font-bold font-mono tabular-nums" style={{ color }}>
        {value.toFixed(1)}
      </div>
      <div className="text-[11px] font-semibold" style={{ color }}>
        {label}
      </div>
      {/* Mini bar */}
      <div className="w-full h-1.5 rounded-full bg-[#1e293b] overflow-hidden mt-1">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${clampedValue}%`,
            background:
              clampedValue >= 70
                ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                : clampedValue >= 50
                ? 'linear-gradient(90deg, #22c55e, #f59e0b)'
                : 'linear-gradient(90deg, #22c55e, #3b82f6)',
          }}
        />
      </div>
      <div className="flex justify-between w-full text-[10px] text-[#64748b]">
        <span>0</span>
        <span>30</span>
        <span>50</span>
        <span>70</span>
        <span>100</span>
      </div>
    </div>
  );
}

function MacdDisplay({ indicators }: { indicators?: TechnicalIndicators | null }) {
  if (!indicators || indicators.macd_line === undefined) return null;

  const histValue = indicators.macd_histogram ?? 0;
  const isPositive = histValue >= 0;

  return (
    <div className="p-4 bg-[#11141b] rounded-xl border border-[#1e293b]">
      <div className="text-[10px] font-medium text-[#64748b] uppercase tracking-[0.05em] mb-3">
        MACD
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-[#64748b]">Line</span>
          <span className="font-mono font-semibold text-[#f1f5f9] tabular-nums">
            {indicators.macd_line.toFixed(4)}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[#64748b]">Signal</span>
          <span className="font-mono font-semibold text-[#f1f5f9] tabular-nums">
            {indicators.macd_signal?.toFixed(4) || '—'}
          </span>
        </div>
        <div className="h-px bg-[#1e293b]" />
        <div className="flex justify-between text-xs items-center">
          <span className="text-[#64748b]">Histogram</span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'
            }`}
          >
            {isPositive ? '+' : ''}
            {histValue.toFixed(4)}
          </span>
        </div>
        <Badge variant={isPositive ? 'bullish' : 'bearish'}>
          {indicators.macd_cross === 'bullish'
            ? 'Bullish Cross'
            : indicators.macd_cross === 'bearish'
            ? 'Bearish Cross'
            : isPositive
            ? 'Bullish'
            : 'Bearish'}
        </Badge>
      </div>
    </div>
  );
}

function SupportResistanceDisplay({ levels }: { levels?: SupportResistance | null }) {
  if (!levels) return null;

  return (
    <div className="p-4 bg-[#11141b] rounded-xl border border-[#1e293b]">
      <div className="text-[10px] font-medium text-[#64748b] uppercase tracking-[0.05em] mb-3">
        Key Levels
      </div>
      <div className="space-y-3">
        {/* Resistances */}
        {levels.resistances && levels.resistances.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowUpRight size={12} className="text-[#ef4444]" />
              <span className="text-[11px] font-semibold text-[#ef4444]">Resistance</span>
            </div>
            <div className="space-y-1">
              {levels.resistances.slice(0, 3).map((r, i) => (
                <div
                  key={`r-${i}`}
                  className="flex items-center justify-between px-2 py-1 rounded bg-[#1a1f2b]"
                >
                  <span className="text-xs text-[#94a3b8]">R{i + 1}</span>
                  <span className="text-xs font-mono font-semibold text-[#ef4444] tabular-nums">
                    ${r.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pivot */}
        {levels.pivot_point > 0 && (
          <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#1e293b]/50">
            <span className="text-xs text-[#94a3b8]">Pivot</span>
            <span className="text-xs font-mono font-semibold text-[#f59e0b] tabular-nums">
              ${levels.pivot_point.toFixed(2)}
            </span>
          </div>
        )}

        {/* Supports */}
        {levels.supports && levels.supports.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowDownRight size={12} className="text-[#22c55e]" />
              <span className="text-[11px] font-semibold text-[#22c55e]">Support</span>
            </div>
            <div className="space-y-1">
              {levels.supports.slice(0, 3).map((s, i) => (
                <div
                  key={`s-${i}`}
                  className="flex items-center justify-between px-2 py-1 rounded bg-[#1a1f2b]"
                >
                  <span className="text-xs text-[#94a3b8]">S{i + 1}</span>
                  <span className="text-xs font-mono font-semibold text-[#22c55e] tabular-nums">
                    ${s.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MovingAverages({ indicators }: { indicators?: TechnicalIndicators | null }) {
  if (!indicators) return null;

  const mas = [
    { label: 'SMA 20', value: indicators.sma_20, color: '#8b5cf6' },
    { label: 'SMA 50', value: indicators.sma_50, color: '#06b6d4' },
    { label: 'SMA 200', value: indicators.sma_200, color: '#f59e0b' },
    { label: 'EMA 12', value: indicators.ema_12, color: '#a78bfa' },
    { label: 'EMA 26', value: indicators.ema_26, color: '#67e8f9' },
  ].filter((ma) => ma.value && ma.value > 0);

  if (mas.length === 0) return null;

  return (
    <div className="p-4 bg-[#11141b] rounded-xl border border-[#1e293b]">
      <div className="text-[10px] font-medium text-[#64748b] uppercase tracking-[0.05em] mb-3">
        Moving Averages
      </div>
      <div className="space-y-1.5">
        {mas.map((ma) => (
          <div key={ma.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: ma.color }}
              />
              <span className="text-xs text-[#94a3b8]">{ma.label}</span>
            </div>
            <span className="text-xs font-mono font-semibold text-[#f1f5f9] tabular-nums">
              ${ma.value!.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BollingerBands({ indicators }: { indicators?: TechnicalIndicators | null }) {
  if (!indicators || !indicators.bollinger_upper || !indicators.bollinger_lower) return null;

  return (
    <div className="p-4 bg-[#11141b] rounded-xl border border-[#1e293b]">
      <div className="text-[10px] font-medium text-[#64748b] uppercase tracking-[0.05em] mb-3">
        Bollinger Bands
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-[#64748b]">Upper</span>
          <span className="font-mono font-semibold text-[#ef4444] tabular-nums">
            ${indicators.bollinger_upper.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[#64748b]">Middle</span>
          <span className="font-mono font-semibold text-[#f59e0b] tabular-nums">
            ${(indicators.bollinger_mid || 0).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[#64748b]">Lower</span>
          <span className="font-mono font-semibold text-[#22c55e] tabular-nums">
            ${indicators.bollinger_lower.toFixed(2)}
          </span>
        </div>
      </div>
      {indicators.atr_14 && indicators.atr_14 > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1e293b]">
          <div className="flex justify-between text-xs">
            <span className="text-[#64748b]">ATR (14)</span>
            <span className="font-mono font-semibold text-[#f1f5f9] tabular-nums">
              {indicators.atr_14.toFixed(2)}
            </span>
          </div>
          <p className="text-[10px] text-[#64748b] mt-1">
            Average daily range over 14 periods
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export function MarketAnalysisSection({ analysis, marketData }: MarketAnalysisSectionProps) {
  if (!analysis) {
    return (
      <div className="text-center py-12">
        <Activity size={32} className="text-[#64748b] mx-auto mb-3" />
        <p className="text-sm text-[#64748b]">Market analysis data is not available.</p>
      </div>
    );
  }

  const indicators = analysis.technical || marketData?.technical || null;

  return (
    <div className="space-y-5">
      {/* ── TREND OVERVIEW ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Trend Card */}
        <div className="p-4 bg-[#11141b] rounded-xl border border-[#1e293b] flex flex-col items-center justify-center text-center">
          <TrendIcon trend={analysis.trend} />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b] mt-2">
            Trend
          </span>
          <span className="text-lg font-bold text-[#f1f5f9] mt-1 capitalize">
            {analysis.trend}
          </span>
          <div className="mt-2 w-full">
            <div className="progress-bar">
              <div
                className={`progress-bar-fill ${
                  analysis.trend_strength >= 70
                    ? 'high'
                    : analysis.trend_strength >= 40
                    ? 'moderate'
                    : 'low'
                }`}
                style={{ width: `${analysis.trend_strength}%` }}
              />
            </div>
            <p className="text-[10px] text-[#64748b] mt-1 text-right">
              Strength: {analysis.trend_strength.toFixed(0)}/100
            </p>
          </div>
        </div>

        {/* Structure & Momentum */}
        <div className="p-4 bg-[#11141b] rounded-xl border border-[#1e293b] flex flex-col justify-center">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748b]">Structure</span>
              <StructureBadge structure={analysis.structure} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748b]">Momentum</span>
              <MomentumBadge momentum={analysis.momentum} />
            </div>
            {indicators?.macd_cross && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748b]">MACD Cross</span>
                <Badge
                  variant={indicators.macd_cross === 'bullish' ? 'bullish' : indicators.macd_cross === 'bearish' ? 'bearish' : 'neutral'}
                >
                  {indicators.macd_cross === 'bullish'
                    ? 'Bullish'
                    : indicators.macd_cross === 'bearish'
                    ? 'Bearish'
                    : 'None'}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* RSI Gauge */}
        {indicators?.rsi_14 !== undefined && indicators.rsi_14 > 0 && (
          <RsiGauge value={indicators.rsi_14} />
        )}
      </div>

      {/* ── DETAILED INDICATORS ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MACD */}
        <MacdDisplay indicators={indicators} />

        {/* Support & Resistance */}
        <SupportResistanceDisplay
          levels={analysis.key_levels || marketData?.support_resistance || null}
        />

        {/* Moving Averages + Bollinger */}
        <div className="space-y-4">
          <MovingAverages indicators={indicators} />
          <BollingerBands indicators={indicators} />
        </div>
      </div>

      {/* ── VOLATILITY NOTE ──────────────────────────── */}
      {analysis.volatility_note && (
        <div className="p-4 bg-[rgba(245,158,11,0.05)] rounded-xl border border-[rgba(245,158,11,0.15)]">
          <div className="flex items-start gap-3">
            <Activity size={16} className="text-[#f59e0b] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#f59e0b] uppercase tracking-wide mb-1">
                Volatility Assessment
              </p>
              <p className="text-sm text-[#e2e8f0] leading-relaxed">
                {analysis.volatility_note}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SUMMARY ──────────────────────────────────── */}
      {analysis.summary && (
        <div className="p-4 bg-[#11141b] rounded-xl border border-[#1e293b]">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-[#3b82f6]" />
            <span className="text-xs font-semibold text-[#3b82f6] uppercase tracking-wide">
              Technical Summary
            </span>
          </div>
          <p className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-line">
            {analysis.summary}
          </p>
        </div>
      )}

      {/* ── METRICS GRID ─────────────────────────────── */}
      {indicators && (
        <div className="metric-grid">
          {indicators.ema_12 && indicators.ema_12 > 0 && (
            <Metric label="EMA 12" value={`$${indicators.ema_12.toFixed(2)}`} mono />
          )}
          {indicators.ema_26 && indicators.ema_26 > 0 && (
            <Metric label="EMA 26" value={`$${indicators.ema_26.toFixed(2)}`} mono />
          )}
          {indicators.atr_14 && indicators.atr_14 > 0 && (
            <Metric label="ATR (14)" value={indicators.atr_14.toFixed(3)} mono />
          )}
          {indicators.volume_sma_20 && indicators.volume_sma_20 > 0 && (
            <Metric
              label="Vol SMA 20"
              value={
                indicators.volume_sma_20 >= 1_000_000
                  ? `${(indicators.volume_sma_20 / 1_000_000).toFixed(1)}M`
                  : indicators.volume_sma_20.toLocaleString()
              }
              mono
            />
          )}
        </div>
      )}

      {/* ── RAW TEXT (expandable) ─────────────────────── */}
      {analysis.raw_text && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors select-none py-2">
            Show full agent output
          </summary>
          <pre className="mt-2 p-4 bg-[#0a0c10] rounded-xl border border-[#1e293b] text-[11px] text-[#94a3b8] overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed font-mono">
            {analysis.raw_text}
          </pre>
        </details>
      )}
    </div>
  );
}

export default MarketAnalysisSection;
