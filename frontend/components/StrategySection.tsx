'use client';

import React from 'react';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  Shield,
} from 'lucide-react';
import type { StrategyAnalysis as StrategyAnalysisType, Scenario } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

interface StrategySectionProps {
  data: StrategyAnalysisType | null;
  symbol?: string;
}

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

const BIAS_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  bullish: {
    icon: <TrendingUp size={18} />,
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.08)',
    label: 'Bullish',
  },
  bearish: {
    icon: <TrendingDown size={18} />,
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.08)',
    label: 'Bearish',
  },
  neutral: {
    icon: <Minus size={18} />,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.08)',
    label: 'Neutral',
  },
};

const CONVICTION_CONFIG: Record<string, { color: string; width: number }> = {
  high: { color: '#22c55e', width: 90 },
  moderate: { color: '#f59e0b', width: 55 },
  low: { color: '#ef4444', width: 30 },
};

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

// ────────────────────────────────────────────────────────────
// SCENARIO CARD
// ────────────────────────────────────────────────────────────

function ScenarioCard({
  scenario,
  isPrimary,
}: {
  scenario: Scenario;
  isPrimary: boolean;
}) {
  const config = BIAS_CONFIG[scenario.bias] || BIAS_CONFIG.neutral;
  const probColor =
    scenario.probability >= 50
      ? '#22c55e'
      : scenario.probability >= 30
      ? '#f59e0b'
      : '#ef4444';

  return (
    <div
      className={`scenario-card ${scenario.bias}`}
      style={{
        position: 'relative',
        ...(isPrimary
          ? {
              borderColor: `${config.color}40`,
              boxShadow: `0 0 20px ${config.color}10`,
            }
          : {}),
      }}
    >
      {/* Primary badge */}
      {isPrimary && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: 20,
            background: config.color,
            color: '#0a0c10',
            padding: '2px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          PRIMARY SCENARIO
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, marginTop: isPrimary ? 10 : 0 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: config.bg,
            color: config.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {config.icon}
        </div>
        <div style={{ flex: 1 }}>
          <h4
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#f1f5f9',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {scenario.name}
          </h4>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: config.color,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {config.label} • {scenario.timeframe || '3-6 months'}
          </span>
        </div>

        {/* Probability */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: probColor,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {scenario.probability.toFixed(0)}%
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginTop: 2,
            }}
          >
            Probability
          </div>
        </div>
      </div>

      {/* Probability bar */}
      <div className="progress-bar" style={{ marginBottom: 14 }}>
        <div
          className="progress-bar-fill"
          style={{
            width: `${scenario.probability}%`,
            background:
              scenario.probability >= 50
                ? '#22c55e'
                : scenario.probability >= 30
                ? '#f59e0b'
                : '#ef4444',
          }}
        />
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: 13,
          color: '#94a3b8',
          lineHeight: 1.6,
          marginBottom: 16,
        }}
      >
        {scenario.description}
      </p>

      {/* Target price */}
      {scenario.target_price && scenario.target_price > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: '#11141b',
            borderRadius: 10,
            border: '1px solid #1e293b',
            marginBottom: 12,
          }}
        >
          <Target size={16} style={{ color: config.color }} />
          <div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Target Price
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#f1f5f9',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatPrice(scenario.target_price)}
            </div>
          </div>
          {scenario.invalidation_point && scenario.invalidation_point > 0 && (
            <>
              <div style={{ width: 1, height: 36, background: '#1e293b' }} />
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Invalidation
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#ef4444',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatPrice(scenario.invalidation_point)}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Key triggers */}
      {scenario.key_triggers && scenario.key_triggers.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Key Triggers
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {scenario.key_triggers.map((trigger, idx) => (
              <li
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 12,
                  color: '#94a3b8',
                  lineHeight: 1.5,
                }}
              >
                <ArrowRight size={12} style={{ color: config.color, marginTop: 3, flexShrink: 0 }} />
                <span>{trigger}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// CRITICAL LEVELS
// ────────────────────────────────────────────────────────────

function CriticalLevels({ levels, symbol }: { levels: number[]; symbol?: string }) {
  if (!levels || levels.length === 0) return null;

  const sorted = [...levels].sort((a, b) => a - b);

  return (
    <div
      style={{
        background: '#11141b',
        borderRadius: 12,
        border: '1px solid #1e293b',
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Shield size={16} style={{ color: '#6366f1' }} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          Critical Levels
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {sorted.map((level, idx) => (
          <span
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              borderRadius: 8,
              background: '#1a1f2b',
              border: '1px solid #1e293b',
              fontSize: 13,
              fontWeight: 600,
              color: '#f1f5f9',
              fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatPrice(level)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// UNCERTAINTIES
// ────────────────────────────────────────────────────────────

function Uncertainties({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div
      style={{
        background: 'rgba(245, 158, 11, 0.04)',
        borderRadius: 12,
        border: '1px solid rgba(245, 158, 11, 0.12)',
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <HelpCircle size={16} style={{ color: '#f59e0b' }} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#f59e0b',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          Key Uncertainties
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 13,
              color: '#94a3b8',
              lineHeight: 1.5,
            }}
          >
            <AlertTriangle size={13} style={{ color: '#f59e0b', marginTop: 3, flexShrink: 0 }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────

export default function StrategySection({ data, symbol }: StrategySectionProps) {
  // ── Loading / empty states ───────────────────────────────

  if (!data) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'rgba(34, 197, 94, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
          }}
        >
          <Target size={24} style={{ color: '#22c55e', opacity: 0.5 }} />
        </div>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Strategy analysis not yet available.
        </p>
        <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
          Run the multi-agent analysis to generate scenarios.
        </p>
      </div>
    );
  }

  const primaryBias = data.primary_bias || 'neutral';
  const biasConfig = BIAS_CONFIG[primaryBias] || BIAS_CONFIG.neutral;
  const conviction = data.conviction_level || 'moderate';
  const convictionConfig = CONVICTION_CONFIG[conviction] || CONVICTION_CONFIG.moderate;

  const scenarios = data.scenarios || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── PRIMARY BIAS + CONVICTION ──────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px 20px',
          background: biasConfig.bg,
          borderRadius: 14,
          border: `1px solid ${biasConfig.color}20`,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `${biasConfig.color}15`,
            color: biasConfig.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {biasConfig.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
            Primary Bias: <span style={{ color: biasConfig.color }}>{biasConfig.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Conviction:</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: convictionConfig.color,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {conviction}
            </span>
            <div className="progress-bar" style={{ width: 80 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${convictionConfig.width}%`,
                  background: convictionConfig.color,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── SCENARIOS ───────────────────────────────────── */}
      {scenarios.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Target size={16} style={{ color: '#22c55e' }} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#f1f5f9',
              }}
            >
              Market Scenarios
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              ({scenarios.length} scenarios)
            </span>
          </div>

          {scenarios.map((scenario, idx) => (
            <ScenarioCard
              key={`${scenario.name}-${idx}`}
              scenario={scenario}
              isPrimary={idx === 0}
            />
          ))}
        </div>
      )}

      {/* ── SUMMARY ─────────────────────────────────────── */}
      {data.summary && (
        <div
          style={{
            padding: '16px 20px',
            background: '#11141b',
            borderRadius: 12,
            border: '1px solid #1e293b',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 8,
            }}
          >
            Strategic Summary
          </div>
          <p
            style={{
              fontSize: 13,
              color: '#cbd5e1',
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {data.summary}
          </p>
        </div>
      )}

      {/* ── CONCLUSION ──────────────────────────────────── */}
      {data.conclusion && (
        <div
          style={{
            padding: '20px',
            background: `linear-gradient(135deg, ${biasConfig.bg} 0%, #1a1f2b 100%)`,
            borderRadius: 14,
            border: `1px solid ${biasConfig.color}20`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: biasConfig.color,
                boxShadow: `0 0 8px ${biasConfig.color}60`,
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#f1f5f9',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Conclusion
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#cbd5e1',
              lineHeight: 1.7,
            }}
            // Render markdown-like bold
            dangerouslySetInnerHTML={{
              __html: data.conclusion
                .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f1f5f9;font-weight:700;">$1</strong>')
                .replace(/\n\n/g, '<br/><br/>')
                .replace(/\n/g, '<br/>'),
            }}
          />
        </div>
      )}

      {/* ── CRITICAL LEVELS ─────────────────────────────── */}
      {data.critical_levels && data.critical_levels.length > 0 && (
        <CriticalLevels levels={data.critical_levels} symbol={symbol} />
      )}

      {/* ── UNCERTAINTIES ────────────────────────────────── */}
      {data.uncertainties && data.uncertainties.length > 0 && (
        <Uncertainties items={data.uncertainties} />
      )}

      {/* ── CROSS-ASSET NOTE ────────────────────────────── */}
      {data.cross_asset_note && (
        <div
          style={{
            padding: '14px 18px',
            background: 'rgba(99, 102, 241, 0.04)',
            borderRadius: 10,
            border: '1px solid rgba(99, 102, 241, 0.1)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#6366f1',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 6,
            }}
          >
            Cross-Asset Context
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
            {data.cross_asset_note}
          </p>
        </div>
      )}

      {/* ── DISCLAIMER ───────────────────────────────────── */}
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(239, 68, 68, 0.04)',
          borderRadius: 8,
          border: '1px solid rgba(239, 68, 68, 0.08)',
        }}
      >
        <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
          <strong style={{ color: '#ef4444' }}>Disclaimer:</strong> Scenarios represent probabilistic
          estimates based on available data. They are not predictions or guarantees. Market
          conditions can change rapidly. Always conduct your own research.
        </p>
      </div>
    </div>
  );
}
