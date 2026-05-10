'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';
import type { Quote, AssetCategory } from '@/lib/types';
import { formatNumber, formatRelativeTime } from '@/lib/types';

interface PriceTickerProps {
  quote: Quote;
  category: AssetCategory;
}

export default function PriceTicker({ quote, category }: PriceTickerProps) {
  const isPositive = quote.change >= 0;
  const isFlat = quote.change === 0;

  const ChangeIcon = isPositive ? TrendingUp : isFlat ? Activity : TrendingDown;
  const changeColor = isPositive
    ? 'text-[var(--accent-success)]'
    : isFlat
    ? 'text-[var(--text-muted)]'
    : 'text-[var(--accent-danger)]';
  const bgColor = isPositive
    ? 'bg-[var(--bullish-bg)]'
    : isFlat
    ? 'bg-[var(--neutral-bg)]'
    : 'bg-[var(--bearish-bg)]';

  return (
    <div className="glass-card overflow-hidden">
      {/* ── Top strip gradient ── */}
      <div
        className={`h-1 w-full ${
          isPositive
            ? 'bg-gradient-to-r from-green-600 to-emerald-400'
            : isFlat
            ? 'bg-gradient-to-r from-yellow-600 to-amber-400'
            : 'bg-gradient-to-r from-red-600 to-rose-400'
        }`}
      />

      <div className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* ── Left: Symbol + Name ── */}
          <div className="flex items-center gap-4">
            {/* Asset icon */}
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${bgColor}`}
            >
              {category === 'crypto' ? '₿' : category === 'index' ? '📈' : category === 'commodity' ? '🏆' : '💹'}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight font-mono">
                  {quote.symbol}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${
                    category === 'crypto'
                      ? 'border-orange-500/20 text-orange-400 bg-orange-500/5'
                      : category === 'index'
                      ? 'border-blue-500/20 text-blue-400 bg-blue-500/5'
                      : category === 'commodity'
                      ? 'border-yellow-500/20 text-yellow-400 bg-yellow-500/5'
                      : 'border-slate-500/20 text-slate-400 bg-slate-500/5'
                  }`}
                >
                  {category}
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-0.5 line-clamp-1" title={quote.name || undefined}>
                {quote.name || quote.symbol}
              </p>
            </div>
          </div>

          {/* ── Center: Price ── */}
          <div className="flex items-baseline gap-3">
            <span className="text-[32px] font-extrabold text-[var(--text-primary)] tracking-[-0.02em] tabular-nums leading-none">
              ${quote.price.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: quote.price > 1000 ? 2 : 4,
              })}
            </span>
          </div>

          {/* ── Right: Change + Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Change */}
            <div className={`rounded-xl ${bgColor} border border-white/5 p-3 min-w-[100px]`}>
              <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Change
              </p>
              <div className={`flex items-center gap-1.5 text-lg font-bold tabular-nums ${changeColor}`}>
                <ChangeIcon size={16} strokeWidth={2.5} />
                <span>
                  {isPositive ? '+' : ''}
                  {quote.change_percent.toFixed(2)}%
                </span>
              </div>
              <p className={`text-xs tabular-nums mt-0.5 ${changeColor}`}>
                {isPositive ? '+' : ''}
                {quote.change.toFixed(2)}
              </p>
            </div>

            {/* Day Range */}
            <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-3 min-w-[110px]">
              <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Day Range
              </p>
              <p className="text-sm font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                ${quote.day_low.toFixed(2)} — ${quote.day_high.toFixed(2)}
              </p>
              {/* Mini progress bar showing where current price sits in range */}
              {quote.day_high > quote.day_low && (
                <div className="mt-2 h-1.5 rounded-full bg-[var(--border-primary)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isPositive ? 'bg-green-500' : isFlat ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          ((quote.price - quote.day_low) / (quote.day_high - quote.day_low)) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Volume */}
            <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-3 min-w-[100px]">
              <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Volume
              </p>
              <p className="text-sm font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                {formatNumber(quote.volume, 1)}
              </p>
            </div>

            {/* Previous Close */}
            <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-3 min-w-[100px]">
              <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Prev Close
              </p>
              <p className="text-sm font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                ${quote.previous_close.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Bottom: Timestamp ── */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--border-primary)]">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <Activity size={12} />
            <span>
              {quote.fetched_at
                ? formatRelativeTime(quote.fetched_at)
                : 'Live'}
            </span>
          </div>
          {quote.market_cap && quote.market_cap > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <BarChart3 size={12} />
              <span>Market Cap: ${formatNumber(quote.market_cap, 2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
