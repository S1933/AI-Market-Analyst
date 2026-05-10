'use client';

import React from 'react';
import {
  ShieldAlert,
  TrendingDown,
  Gauge,
  AlertTriangle,
  Zap,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { RiskAnalysis } from '@/lib/types';
import { RISK_COLORS, RISK_LABELS, formatNumber } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

interface RiskAnalysisSectionProps {
  data: RiskAnalysis;
  compact?: boolean;
}

// ────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────

const RISK_ICONS: Record<string, React.ReactNode> = {
  low: <ShieldAlert size={16} className="text-green-400" />,
  moderate: <AlertTriangle size={16} className="text-yellow-400" />,
  high: <AlertTriangle size={16} className="text-orange-400" />,
  critical: <AlertTriangle size={16} className="text-red-400" />,
};

const VOLATILITY_REGIME_LABELS: Record<string, string> = {
  low: 'Low — Calm markets, tight ranges',
  normal: 'Normal — Typical daily swings',
  elevated: 'Elevated — Wider swings, increased uncertainty',
  extreme: 'Extreme — Turbulent market conditions',
};

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function riskScoreColor(score: number): string {
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#f59e0b';
  return '#22c55e';
}

function riskScoreLabel(score: number): string {
  if (score >= 70) return 'High Risk';
  if (score >= 40) return 'Moderate Risk';
  return 'Low Risk';
}

function riskScoreGradient(score: number): string {
  if (score >= 70) return 'from-red-500/20 to-red-600/5';
  if (score >= 40) return 'from-yellow-500/20 to-yellow-600/5';
  return 'from-green-500/20 to-green-600/5';
}

// ────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ────────────────────────────────────────────────────────────

/** The main risk gauge: a semi-circular or linear score display. */
function RiskGauge({ score, level }: { score: number; level: string }) {
  const color = riskScoreColor(score);
  const rotation = (score / 100) * 180; // For a semi-circle gauge
  const gradient = riskScoreGradient(score);

  return (
    <div className="relative flex flex-col items-center">
      {/* Score Circle */}
      <div className="relative w-36 h-36">
        {/* Background ring */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="rgba(30, 41, 59, 0.6)"
            strokeWidth="10"
          />
          {/* Progress arc */}
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 327} 327`}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-extrabold tabular-nums"
            style={{ color }}
          >
            {Math.round(score)}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
            / 100
          </span>
        </div>
      </div>

      {/* Level label */}
      <div
        className="mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
        style={{
          backgroundColor: `${color}15`,
          color: color,
          border: `1px solid ${color}30`,
        }}
      >
        {RISK_LABELS[level] || level}
      </div>
    </div>
  );
}

/** A single risk factor row. */
function RiskFactorRow({
  factor,
}: {
  factor: {
    name: string;
    level: string;
    description: string;
    mitigation?: string;
  };
}) {
  const levelColor =
    RISK_COLORS[factor.level] || RISK_COLORS.moderate;
  const levelLabel = RISK_LABELS[factor.level] || factor.level;

  return (
    <div className="risk-factor group">
      {/* Severity indicator */}
      <div
        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
        style={{ backgroundColor: levelColor }}
      />

      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h4 className="text-sm font-semibold text-slate-200">
            {factor.name}
          </h4>
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${levelColor}12`,
              color: levelColor,
            }}
          >
            {levelLabel}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-400 leading-relaxed">
          {factor.description}
        </p>

        {/* Mitigation (shown on hover or always visible) */}
        {factor.mitigation && (
          <div className="mt-2 flex items-start gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ArrowRight size={12} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-400/80 leading-relaxed">
              <span className="font-semibold">Mitigation:</span>{' '}
              {factor.mitigation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** A small stat card for a single metric. */
function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-[#11141b] rounded-xl p-4 border border-[#1e293b] hover:border-[#273040] transition-colors duration-150">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-500">{icon}</span>
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div
        className="text-xl font-bold text-slate-100 tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {sub && (
        <p className="text-[11px] text-slate-500 mt-1">{sub}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────

export default function RiskAnalysisSection({
  data,
  compact = false,
}: RiskAnalysisSectionProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <ShieldAlert size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No risk data available</p>
        </div>
      </div>
    );
  }

  const {
    overall_risk,
    risk_score,
    factors,
    drawdown_risk_pct,
    correlation_note,
    tail_risk,
    volatility_regime,
    summary,
  } = data;

  return (
    <div className="space-y-6">
      {/* ── TOP ROW: Gauge + Key Stats ─────────────────── */}
      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
        {/* Risk Gauge */}
        <div className="flex justify-center md:justify-start">
          <RiskGauge score={risk_score || 0} level={overall_risk || 'moderate'} />
        </div>

        {/* Key stats */}
        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          <StatCard
            icon={<TrendingDown size={15} />}
            label="Max Drawdown"
            value={`${(drawdown_risk_pct || 0).toFixed(1)}%`}
            sub="Estimated"
            color={drawdown_risk_pct > 20 ? '#ef4444' : drawdown_risk_pct > 10 ? '#f59e0b' : '#22c55e'}
          />
          <StatCard
            icon={<Zap size={15} />}
            label="Volatility Regime"
            value={volatility_regime || 'normal'}
            sub={VOLATILITY_REGIME_LABELS[volatility_regime] || ''}
            color={
              volatility_regime === 'extreme'
                ? '#ef4444'
                : volatility_regime === 'elevated'
                ? '#f59e0b'
                : '#22c55e'
            }
          />
          <StatCard
            icon={<Gauge size={15} />}
            label="Risk Score"
            value={`${Math.round(risk_score || 0)}/100`}
            sub={riskScoreLabel(risk_score || 0)}
            color={riskScoreColor(risk_score || 0)}
          />
          <StatCard
            icon={<Info size={15} />}
            label="Factors Identified"
            value={factors?.length || 0}
            sub="Active risk factors"
          />
        </div>
      </div>

      {/* ── SUMMARY ────────────────────────────────────── */}
      {summary && (
        <div className="p-4 rounded-xl bg-[#11141b] border border-[#1e293b]">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Info size={15} className="text-blue-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Risk Summary
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── RISK FACTORS ───────────────────────────────── */}
      {factors && factors.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <AlertTriangle size={15} className="text-yellow-400" />
            Risk Factors ({factors.length})
          </h4>
          <div className="space-y-2">
            {factors.map((factor, idx) => (
              <RiskFactorRow key={`${factor.name}-${idx}`} factor={factor} />
            ))}
          </div>
        </div>
      )}

      {/* ── ADDITIONAL NOTES ───────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Correlation Note */}
        {correlation_note && (
          <div className="p-4 rounded-xl bg-[#11141b] border border-[#1e293b]">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <TrendingDown size={13} />
              Correlation Note
            </h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              {correlation_note}
            </p>
          </div>
        )}

        {/* Tail Risk */}
        {tail_risk && (
          <div className="p-4 rounded-xl bg-[#11141b] border border-[#1e293b]">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Zap size={13} />
              Tail Risk
            </h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              {tail_risk}
            </p>
          </div>
        )}
      </div>

      {/* ── RISK SCORE BAR ─────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Low Risk</span>
          <span>Moderate</span>
          <span>High</span>
          <span>Critical</span>
        </div>
        <div className="relative h-2 rounded-full bg-[#1e293b] overflow-hidden">
          {/* Gradient background: green → yellow → orange → red */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'linear-gradient(to right, #22c55e 0%, #22c55e 25%, #f59e0b 25%, #f59e0b 50%, #ef4444 50%, #ef4444 75%, #dc2626 75%, #dc2626 100%)',
              opacity: 0.3,
            }}
          />
          {/* Score indicator */}
          <div
            className="absolute top-0 h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(risk_score || 0, 100)}%`,
              backgroundColor: riskScoreColor(risk_score || 0),
            }}
          />
          {/* Marker dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-md transition-all duration-500"
            style={{
              left: `${Math.min(risk_score || 0, 100)}%`,
              marginLeft: '-6px',
              backgroundColor: riskScoreColor(risk_score || 0),
            }}
          />
        </div>
      </div>

      {/* ── DISCLAIMER ─────────────────────────────────── */}
      <p className="text-[10px] text-slate-600 text-center leading-relaxed">
        Risk assessment is based on historical data and current market
        conditions. It is an estimate, not a prediction. Risk can change
        rapidly — reassess regularly.
      </p>
    </div>
  );
}
