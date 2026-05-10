'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

export type CardVariant = 'default' | 'bullish' | 'bearish' | 'neutral' | 'market' | 'news' | 'risk' | 'strategy';

export interface AnalysisCardProps {
  /** Title displayed in the card header */
  title: string;
  /** Optional subtitle / description */
  subtitle?: string;
  /** Icon component to display before the title */
  icon?: React.ReactNode;
  /** The visual variant of the card, affecting borders and gradients */
  variant?: CardVariant;
  /** Main content of the card */
  children: React.ReactNode;
  /** Optional footer content */
  footer?: React.ReactNode;
  /** Optional action button in the header */
  action?: React.ReactNode;
  /** Whether the card is collapsible */
  collapsible?: boolean;
  /** Whether the card starts collapsed (only applies if collapsible) */
  defaultCollapsed?: boolean;
  /** Badge / status indicator next to the title */
  badge?: React.ReactNode;
  /** Extra CSS classes */
  className?: string;
  /** Loading state — shows a shimmer effect */
  loading?: boolean;
  /** Tooltip shown on hover of the info icon */
  tooltip?: string;
  /** Click handler for the entire card header */
  onHeaderClick?: () => void;
}

// ────────────────────────────────────────────────────────────
// VARIANT MAPPING
// ────────────────────────────────────────────────────────────

const VARIANT_BORDERS: Record<CardVariant, string> = {
  default: 'border-[#1e293b] hover:border-[#273040]',
  bullish: 'border-[rgba(34,197,94,0.15)] hover:border-[rgba(34,197,94,0.25)]',
  bearish: 'border-[rgba(239,68,68,0.15)] hover:border-[rgba(239,68,68,0.25)]',
  neutral: 'border-[rgba(245,158,11,0.12)] hover:border-[rgba(245,158,11,0.20)]',
  market: 'border-[rgba(59,130,246,0.15)] hover:border-[rgba(59,130,246,0.25)]',
  news: 'border-[rgba(99,102,241,0.15)] hover:border-[rgba(99,102,241,0.25)]',
  risk: 'border-[rgba(239,68,68,0.15)] hover:border-[rgba(239,68,68,0.25)]',
  strategy: 'border-[rgba(34,197,94,0.15)] hover:border-[rgba(34,197,94,0.25)]',
};

const VARIANT_ACCENTS: Record<CardVariant, string> = {
  default: 'bg-[#1a1f2b]',
  bullish: 'bg-gradient-to-br from-[#1a1f2b] to-[rgba(34,197,94,0.03)]',
  bearish: 'bg-gradient-to-br from-[#1a1f2b] to-[rgba(239,68,68,0.03)]',
  neutral: 'bg-gradient-to-br from-[#1a1f2b] to-[rgba(245,158,11,0.02)]',
  market: 'bg-gradient-to-br from-[#1a1f2b] to-[rgba(59,130,246,0.03)]',
  news: 'bg-gradient-to-br from-[#1a1f2b] to-[rgba(99,102,241,0.03)]',
  risk: 'bg-gradient-to-br from-[#1a1f2b] to-[rgba(239,68,68,0.03)]',
  strategy: 'bg-gradient-to-br from-[#1a1f2b] to-[rgba(34,197,94,0.03)]',
};

const VARIANT_LEFT_BORDERS: Record<CardVariant, string> = {
  default: '',
  bullish: 'border-l-[3px] border-l-[#22c55e]',
  bearish: 'border-l-[3px] border-l-[#ef4444]',
  neutral: 'border-l-[3px] border-l-[#f59e0b]',
  market: 'border-l-[3px] border-l-[#3b82f6]',
  news: 'border-l-[3px] border-l-[#6366f1]',
  risk: 'border-l-[3px] border-l-[#ef4444]',
  strategy: 'border-l-[3px] border-l-[#22c55e]',
};

// ────────────────────────────────────────────────────────────
// SKELETON SHIMMER (for loading state)
// ────────────────────────────────────────────────────────────

const ShimmerBlock = ({ lines = 3 }: { lines?: number }) => (
  <div className="space-y-3 p-2 animate-pulse">
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="h-4 rounded bg-[#1e293b]"
        style={{ width: `${85 - i * 12}%` }}
      />
    ))}
  </div>
);

// ────────────────────────────────────────────────────────────
// ANALYSIS CARD COMPONENT
// ────────────────────────────────────────────────────────────

export function AnalysisCard({
  title,
  subtitle,
  icon,
  variant = 'default',
  children,
  footer,
  action,
  collapsible = false,
  defaultCollapsed = false,
  badge,
  className = '',
  loading = false,
  tooltip,
  onHeaderClick,
}: AnalysisCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const handleHeaderClick = () => {
    if (collapsible) {
      setCollapsed((prev) => !prev);
    }
    onHeaderClick?.();
  };

  const isClickable = collapsible || onHeaderClick;

  // Build combined border classes
  const borderClasses = [
    'border',
    VARIANT_BORDERS[variant],
    VARIANT_LEFT_BORDERS[variant],
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={[
        'relative rounded-2xl overflow-hidden',
        'transition-all duration-200',
        'shadow-[0_1px_3px_rgba(0,0,0,0.4)]',
        'hover:shadow-[0_4px_16px_rgba(0,0,0,0.5)]',
        VARIANT_ACCENTS[variant],
        borderClasses,
        className,
      ].join(' ')}
    >
      {/* ── Header ─────────────────────────────────── */}
      <div
        className={[
          'flex items-center gap-3 px-5 py-4',
          isClickable ? 'cursor-pointer select-none' : '',
          !collapsed && (footer || React.Children.count(children) > 0)
            ? 'border-b border-[#1e293b]'
            : '',
        ].join(' ')}
        onClick={handleHeaderClick}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleHeaderClick();
          }
        }}
        aria-expanded={collapsible ? !collapsed : undefined}
      >
        {/* Icon */}
        {icon && (
          <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-[rgba(59,130,246,0.1)] text-[#3b82f6]">
            {icon}
          </div>
        )}

        {/* Title + Subtitle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-bold text-[#f1f5f9] tracking-[-0.01em] leading-tight">
              {title}
            </h3>
            {badge && (
              <span className="inline-flex">{badge}</span>
            )}
            {tooltip && (
              <span
                className="inline-flex text-[#64748b] hover:text-[#94a3b8] transition-colors cursor-help"
                title={tooltip}
              >
                <Info size={14} />
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-[#64748b] mt-0.5 leading-tight">
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {action}
          {collapsible && (
            <button
              type="button"
              className={[
                'w-7 h-7 rounded-lg flex items-center justify-center',
                'text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e293b]',
                'transition-colors duration-150',
              ].join(' ')}
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed((prev) => !prev);
              }}
              aria-label={collapsed ? 'Expand section' : 'Collapse section'}
            >
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────── */}
      {!collapsed && (
        <div>
          <div className="px-5 py-4">
            {loading ? <ShimmerBlock /> : children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-5 py-3 border-t border-[#1e293b] bg-[rgba(0,0,0,0.15)]">
              {footer}
            </div>
          )}
        </div>
      )}

      {/* Collapsed indicator pulse */}
      {collapsed && (
        <div className="px-5 pb-4">
          <div className="h-1 rounded-full bg-[#1e293b] overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#3b82f6]/30 to-transparent animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// NAMED SUB-COMPONENTS
// ────────────────────────────────────────────────────────────

/** A metric display inside a card (e.g., RSI value, price level). */
export function Metric({
  label,
  value,
  change,
  mono = false,
  className = '',
}: {
  label: string;
  value: string | number;
  change?: { value: number; positive: boolean };
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={['bg-[#11141b] rounded-xl p-3 border border-[#1e293b]', className].join(' ')}>
      <div className="text-[10px] font-medium text-[#64748b] uppercase tracking-[0.05em] mb-1">
        {label}
      </div>
      <div
        className={[
          'text-lg font-bold text-[#f1f5f9] tabular-nums',
          mono ? 'font-mono text-sm' : '',
        ].join(' ')}
      >
        {value}
      </div>
      {change && (
        <div
          className={[
            'text-[11px] font-semibold mt-0.5',
            change.positive ? 'text-[#22c55e]' : 'text-[#ef4444]',
          ].join(' ')}
        >
          {change.positive ? '+' : ''}{change.value.toFixed(2)}%
        </div>
      )}
    </div>
  );
}

/** A badge pill for displaying status (bullish, bearish, risk level, etc.). */
export function Badge({
  children,
  variant = 'info',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'bullish' | 'bearish' | 'neutral' | 'info' | 'risk-low' | 'risk-moderate' | 'risk-high' | 'risk-critical';
  className?: string;
}) {
  const colors: Record<string, string> = {
    bullish: 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]',
    bearish: 'bg-[rgba(239,68,68,0.1)] text-[#ef4444]',
    neutral: 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b]',
    info: 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6]',
    'risk-low': 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]',
    'risk-moderate': 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b]',
    'risk-high': 'bg-[rgba(239,68,68,0.1)] text-[#ef4444]',
    'risk-critical': 'bg-[rgba(239,68,68,0.2)] text-[#fca5a5] border border-[rgba(239,68,68,0.3)]',
  };

  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-[0.01em] whitespace-nowrap',
        colors[variant] || colors.info,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

export default AnalysisCard;
