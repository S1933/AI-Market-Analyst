"use client";

import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { PricePoint, TechnicalIndicators } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type RangeKey = "1M" | "3M" | "6M" | "1Y" | "ALL";

interface ChartDatum {
  date: string;
  price: number;
  volume: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
}

interface PriceChartProps {
  data: PricePoint[];
  indicators?: TechnicalIndicators | null;
  symbol: string;
  color?: string;
  height?: number;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const RANGE_DAYS: Record<RangeKey, number | null> = {
  "1M": 22,
  "3M": 66,
  "6M": 132,
  "1Y": 264,
  ALL: null,
};

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatDate(dateStr: string, range: RangeKey): string {
  const date = new Date(dateStr);
  if (range === "1M" || range === "3M") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function computeSMA(prices: number[], period: number): (number | undefined)[] {
  const sma: (number | undefined)[] = new Array(prices.length).fill(undefined);
  if (prices.length < period) return sma;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  sma[period - 1] = sum / period;
  for (let i = period; i < prices.length; i++) {
    sum = sum - prices[i - period] + prices[i];
    sma[i] = sum / period;
  }
  return sma;
}

// ─────────────────────────────────────────────────────────────
// CUSTOM TOOLTIP
// ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="tooltip" style={{ minWidth: 160 }}>
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#94a3b8",
          marginBottom: 6,
        }}
      >
        {new Date(label).toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </p>
      {payload.map((entry: any, idx: number) => (
        <div
          key={idx}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            marginBottom: 2,
          }}
        >
          <span style={{ color: entry.color, fontWeight: 500 }}>
            {entry.name}
          </span>
          <span style={{ color: "#f1f5f9", fontWeight: 600, marginLeft: 20 }}>
            {entry.name === "Volume"
              ? formatVolume(entry.value)
              : formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function PriceChart({
  data,
  indicators,
  symbol,
  color = "#3b82f6",
  height = 400,
}: PriceChartProps) {
  const [range, setRange] = useState<RangeKey>("6M");

  // Filter data by selected range
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const days = RANGE_DAYS[range];
    if (days === null) return data;
    return data.slice(-days);
  }, [data, range]);

  // Build chart-ready data with moving averages
  const chartData: ChartDatum[] = useMemo(() => {
    if (!filteredData.length) return [];

    const prices = filteredData.map((p) => p.close);
    const sma20 = indicators?.sma_20
      ? undefined
      : computeSMA(prices, 20);
    const sma50 = indicators?.sma_50
      ? undefined
      : computeSMA(prices, 50);
    const sma200 = indicators?.sma_200
      ? undefined
      : computeSMA(prices, 200);

    return filteredData.map((p, i) => ({
      date: p.date,
      price: p.close,
      volume: p.volume,
      sma20: indicators?.sma_20 ? (i === filteredData.length - 1 ? indicators.sma_20 : undefined) : sma20[i],
      sma50: indicators?.sma_50 ? (i === filteredData.length - 1 ? indicators.sma_50 : undefined) : sma50[i],
      sma200: indicators?.sma_200 ? (i === filteredData.length - 1 ? indicators.sma_200 : undefined) : sma200[i],
    }));
  }, [filteredData, indicators]);

  // Price range for Y-axis domain
  const priceRange = useMemo(() => {
    if (!chartData.length) return { min: 0, max: 100 };
    const prices = chartData.map((d) => d.price).filter((p) => p > 0);
    if (!prices.length) return { min: 0, max: 100 };
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    return {
      min: Math.max(0, min - padding),
      max: max + padding,
    };
  }, [chartData]);

  // Current price vs first price → color theme
  const firstPrice = chartData[0]?.price || 0;
  const lastPrice = chartData[chartData.length - 1]?.price || 0;
  const isUp = lastPrice >= firstPrice;
  const chartColor = isUp ? "#22c55e" : "#ef4444";

  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <div className="flex items-center justify-center" style={{ height }}>
          <p style={{ color: "#64748b" }}>
            No price data available for {symbol}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      {/* ── Header with range selector ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#f1f5f9",
              margin: 0,
            }}
          >
            {symbol} — Price Chart
          </h3>
          <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
            {filteredData.length} data points
          </p>
        </div>

        {/* Range selector tabs */}
        <div className="tab-nav">
          {(Object.keys(RANGE_DAYS) as RangeKey[]).map((r) => (
            <button
              key={r}
              className={`tab-item ${range === r ? "active" : ""}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart ── */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
        >
          {/* Grid */}
          <CartesianGrid
            stroke="rgba(148, 163, 184, 0.08)"
            strokeDasharray="3 3"
            vertical={false}
          />

          {/* X Axis */}
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatDate(d, range)}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />

          {/* Price Y Axis */}
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={[priceRange.min, priceRange.max]}
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={70}
          />

          {/* Volume Y Axis (hidden) */}
          <YAxis
            yAxisId="volume"
            orientation="left"
            hide
          />

          {/* Tooltip */}
          <Tooltip content={<CustomTooltip />} />

          {/* Legend */}
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 10 }}
          />

          {/* SMA 200 */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="sma200"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            dot={false}
            name="SMA 200"
            connectNulls
          />

          {/* SMA 50 */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="sma50"
            stroke="#06b6d4"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            name="SMA 50"
            connectNulls
          />

          {/* SMA 20 */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="sma20"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            strokeDasharray="3 2"
            dot={false}
            name="SMA 20"
            connectNulls
          />

          {/* Price Area (gradient fill) */}
          <defs>
            <linearGradient id={`priceGradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke={chartColor}
            strokeWidth={2}
            fill={`url(#priceGradient-${symbol})`}
            dot={false}
            name="Price"
          />

          {/* Volume Bars */}
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="rgba(148, 163, 184, 0.2)"
            name="Volume"
            maxBarSize={20}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* ── Indicators Summary Bar ── */}
      {indicators && (
        <div
          className="metric-grid"
          style={{ marginTop: 16, gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
        >
          {indicators.rsi_14 > 0 && (
            <div className="metric-item">
              <div className="metric-label">RSI (14)</div>
              <div className="metric-value mono" style={{ fontSize: 15 }}>
                {indicators.rsi_14.toFixed(1)}
              </div>
              <div
                className={`metric-change ${
                  indicators.rsi_14 > 70
                    ? "negative"
                    : indicators.rsi_14 < 30
                    ? "positive"
                    : ""
                }`}
                style={{ color: indicators.rsi_14 > 70 ? "#ef4444" : indicators.rsi_14 < 30 ? "#22c55e" : "#94a3b8" }}
              >
                {indicators.rsi_14 > 70
                  ? "Overbought"
                  : indicators.rsi_14 < 30
                  ? "Oversold"
                  : "Neutral"}
              </div>
            </div>
          )}

          {indicators.sma_20 > 0 && (
            <div className="metric-item">
              <div className="metric-label">SMA 20</div>
              <div className="metric-value mono" style={{ fontSize: 15 }}>
                {formatCurrency(indicators.sma_20)}
              </div>
            </div>
          )}

          {indicators.sma_50 > 0 && (
            <div className="metric-item">
              <div className="metric-label">SMA 50</div>
              <div className="metric-value mono" style={{ fontSize: 15 }}>
                {formatCurrency(indicators.sma_50)}
              </div>
            </div>
          )}

          {indicators.sma_200 > 0 && (
            <div className="metric-item">
              <div className="metric-label">SMA 200</div>
              <div className="metric-value mono" style={{ fontSize: 15 }}>
                {formatCurrency(indicators.sma_200)}
              </div>
            </div>
          )}

          {indicators.atr_14 > 0 && (
            <div className="metric-item">
              <div className="metric-label">ATR (14)</div>
              <div className="metric-value mono" style={{ fontSize: 15 }}>
                {indicators.atr_14.toFixed(2)}
              </div>
            </div>
          )}

          {indicators.macd_line !== undefined && (
            <div className="metric-item">
              <div className="metric-label">MACD</div>
              <div className="metric-value mono" style={{ fontSize: 15 }}>
                {indicators.macd_line.toFixed(4)}
              </div>
              <div
                className={`metric-change ${
                  (indicators.macd_histogram ?? 0) >= 0 ? "positive" : "negative"
                }`}
              >
                {(indicators.macd_histogram ?? 0) >= 0 ? "Bullish" : "Bearish"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
