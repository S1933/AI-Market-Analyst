'use client';

import React from 'react';
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus, Calendar, AlertCircle } from 'lucide-react';
import type { NewsAnalysis, NewsItem } from '@/lib/types';
import { AnalysisCard, Badge } from './AnalysisCard';
import { formatDate, formatRelativeTime } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

interface NewsAnalysisSectionProps {
  data: NewsAnalysis;
  className?: string;
}

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function SentimentIcon({ sentiment }: { sentiment: string }) {
  switch (sentiment) {
    case 'positive':
      return <TrendingUp size={14} className="text-[#22c55e]" />;
    case 'negative':
      return <TrendingDown size={14} className="text-[#ef4444]" />;
    default:
      return <Minus size={14} className="text-[#f59e0b]" />;
  }
}

function ImpactBadge({ impact }: { impact: string }) {
  const styles: Record<string, string> = {
    high: 'bg-[rgba(239,68,68,0.12)] text-[#ef4444] border border-[rgba(239,68,68,0.2)]',
    medium: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b] border border-[rgba(245,158,11,0.2)]',
    low: 'bg-[rgba(148,163,184,0.1)] text-[#94a3b8] border border-[rgba(148,163,184,0.15)]',
  };

  return (
    <span
      className={[
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
        styles[impact] || styles.low,
      ].join(' ')}
    >
      {impact}
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: 'positive' | 'negative' | 'mixed' }) {
  const config: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    positive: {
      bg: 'bg-[rgba(34,197,94,0.1)]',
      text: 'text-[#22c55e]',
      icon: '▲',
      label: 'Positive',
    },
    negative: {
      bg: 'bg-[rgba(239,68,68,0.1)]',
      text: 'text-[#ef4444]',
      icon: '▼',
      label: 'Negative',
    },
    mixed: {
      bg: 'bg-[rgba(245,158,11,0.1)]',
      text: 'text-[#f59e0b]',
      icon: '◆',
      label: 'Mixed',
    },
  };

  const c = config[sentiment] || config.mixed;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      <span className="text-[10px]">{c.icon}</span>
      {c.label}
    </span>
  );
}

function ImpactOnAssetBadge({ impact }: { impact: 'favorable' | 'unfavorable' | 'neutral' }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    favorable: {
      bg: 'bg-[rgba(34,197,94,0.08)]',
      text: 'text-[#22c55e]',
      label: 'Favorable',
    },
    unfavorable: {
      bg: 'bg-[rgba(239,68,68,0.08)]',
      text: 'text-[#ef4444]',
      label: 'Unfavorable',
    },
    neutral: {
      bg: 'bg-[rgba(148,163,184,0.08)]',
      text: 'text-[#94a3b8]',
      label: 'Neutral',
    },
  };

  const c = config[impact] || config.neutral;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// NEWS ITEM COMPONENT
// ────────────────────────────────────────────────────────────

function NewsItemCard({ item, isLast }: { item: NewsItem; isLast: boolean }) {
  return (
    <div className={`news-item ${isLast ? 'mb-0' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Sentiment indicator line */}
        <div
          className={[
            'w-1 h-full min-h-[40px] rounded-full flex-shrink-0 mt-1',
            item.sentiment === 'positive'
              ? 'bg-[#22c55e]'
              : item.sentiment === 'negative'
              ? 'bg-[#ef4444]'
              : 'bg-[#f59e0b]',
          ].join(' ')}
        />

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug">
              {item.title}
            </h4>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <ImpactBadge impact={item.impact} />
              <SentimentIcon sentiment={item.sentiment} />
            </div>
          </div>

          {/* Summary */}
          {item.summary && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">
              {item.summary}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {formatRelativeTime(item.published)}
            </span>
            {item.source && (
              <span className="font-medium uppercase tracking-wider">
                {item.source}
              </span>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-[var(--accent-primary)] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={10} />
                Source
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// THEME SECTION
// ────────────────────────────────────────────────────────────

function ThemeChip({ theme }: { theme: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[11px] font-medium text-[var(--text-secondary)]">
      {theme}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────

export default function NewsAnalysisSection({ data, className = '' }: NewsAnalysisSectionProps) {
  const {
    overall_sentiment,
    impact_on_asset,
    macro_outlook,
    key_themes,
    recent_events,
    summary,
    generated_at,
    agent_name,
  } = data;

  const hasEvents = recent_events && recent_events.length > 0;
  const hasThemes = key_themes && key_themes.length > 0;

  return (
    <div className={`space-y-5 ${className}`}>
      {/* ── SENTIMENT OVERVIEW BAR ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Sentiment
          </span>
          <SentimentBadge sentiment={overall_sentiment} />
        </div>

        <div className="w-px h-5 bg-[var(--border-primary)] hidden sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Impact
          </span>
          <ImpactOnAssetBadge impact={impact_on_asset} />
        </div>

        {macro_outlook && (
          <>
            <div className="w-px h-5 bg-[var(--border-primary)] hidden sm:block" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                <span className="font-semibold text-[var(--text-muted)] uppercase tracking-wider mr-1">
                  Macro:
                </span>
                {macro_outlook}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── SUMMARY ────────────────────────────────────── */}
      {summary && (
        <div className="p-4 rounded-xl bg-[rgba(59,130,246,0.04)] border border-[rgba(59,130,246,0.1)]">
          <div className="flex items-start gap-2">
            <AlertCircle size={15} className="text-[var(--accent-primary)] mt-0.5 flex-shrink-0" />
            <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">
              {summary}
            </p>
          </div>
        </div>
      )}

      {/* ── KEY THEMES ─────────────────────────────────── */}
      {hasThemes && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Key Themes
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {key_themes.map((theme, i) => (
              <ThemeChip key={i} theme={theme} />
            ))}
          </div>
        </div>
      )}

      {/* ── RECENT EVENTS ──────────────────────────────── */}
      {hasEvents && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Recent Events ({recent_events.length})
            </h4>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 no-scrollbar">
            {recent_events.map((event, i) => (
              <NewsItemCard
                key={`${event.title}-${i}`}
                item={event}
                isLast={i === recent_events.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ────────────────────────────────── */}
      {!hasEvents && !hasThemes && !summary && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Newspaper size={32} className="text-[var(--text-muted)] mb-3 opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">
            No news data available for this asset.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">
            News analysis requires an active LLM connection or recent market events.
          </p>
        </div>
      )}

      {/* ── META FOOTER ────────────────────────────────── */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-primary)]">
        <span>
          Agent: <span className="font-mono">{agent_name || 'news_agent'}</span>
        </span>
        {generated_at && (
          <span>
            Generated: {formatDate(generated_at)}
          </span>
        )}
      </div>
    </div>
  );
}
