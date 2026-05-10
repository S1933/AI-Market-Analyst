"use client";

import { useState, useCallback } from "react";
import SearchBar from "@/components/SearchBar";
import PriceTicker from "@/components/PriceTicker";
import PriceChart from "@/components/PriceChart";
import { AnalysisCard } from "@/components/AnalysisCard";
import MarketAnalysisSection from "@/components/MarketAnalysisSection";
import NewsAnalysisSection from "@/components/NewsAnalysisSection";
import RiskAnalysisSection from "@/components/RiskAnalysisSection";
import StrategySection from "@/components/StrategySection";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorBanner } from "@/components/ErrorBanner";
import { analyze, ApiError } from "@/lib/api";
import type { AnalyzeResponse } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// STATE MACHINE
// ─────────────────────────────────────────────────────────────

type PageState =
  | { status: "idle" }
  | { status: "loading"; symbol: string; stage: string; progress: number }
  | { status: "success"; data: AnalyzeResponse }
  | { status: "error"; symbol: string; message: string };

// ─────────────────────────────────────────────────────────────
// STAGES for progress simulation
// ─────────────────────────────────────────────────────────────

const STAGES = [
  { at: 5, label: "Récupération des données de marché…" },
  { at: 15, label: "Données reçues. Lancement des agents…" },
  { at: 30, label: "Agent Marché analyse les indicateurs techniques…" },
  { at: 50, label: "Agent Actualités scrute les événements…" },
  { at: 65, label: "Agent Risques évalue les expositions…" },
  { at: 80, label: "Agent Stratégie construit les scénarios…" },
  { at: 95, label: "Compilation du rapport final…" },
];

// ─────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const [state, setState] = useState<PageState>({ status: "idle" });
  const [selectedPeriod, setSelectedPeriod] = useState<string>("6mo");

  // ── Handle search ──────────────────────────────────────

  const handleSearch = useCallback(async (symbol: string, _name: string) => {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return;

    setState({
      status: "loading",
      symbol: cleanSymbol,
      stage: "Starting…",
      progress: 0,
    });

    // Simulate progressive stages for responsive UX
    const stageInterval = setInterval(() => {
      setState((prev) => {
        if (prev.status !== "loading") return prev;
        const nextStage = STAGES.find((s) => s.at > prev.progress);
        if (nextStage) {
          return { ...prev, stage: nextStage.label, progress: nextStage.at };
        }
        return prev;
      });
    }, 600);

    try {
      const response = await analyze({
        symbol: cleanSymbol,
        force_refresh: false,
      });
      clearInterval(stageInterval);
      setState({ status: "success", data: response });
    } catch (err) {
      clearInterval(stageInterval);
      const message =
        err instanceof ApiError
          ? `${err.code}: ${err.details}`
          : err instanceof Error
            ? err.message
            : "An unexpected error occurred";

      setState((prev) =>
        prev.status === "loading"
          ? { status: "error", symbol: prev.symbol, message }
          : prev,
      );
    }
  }, []);

  // ── Refresh ────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    if (state.status === "success") {
      handleSearch(state.data.symbol, state.data.name);
    } else if (state.status === "error") {
      handleSearch(state.symbol, state.symbol);
    }
  }, [state, handleSearch]);

  const handleRetry = useCallback(() => {
    if (state.status === "error") {
      handleSearch(state.symbol, state.symbol);
    }
  }, [state, handleSearch]);

  // ── Render ─────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      {/* ═══════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: "rgba(10, 12, 16, 0.85)",
          backdropFilter: "blur(16px)",
          borderColor: "var(--border-primary)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
              style={{ backgroundColor: "rgba(59, 130, 246, 0.12)" }}
            >
              🧠
            </div>
            <div className="hidden sm:block">
              <h1
                className="text-sm font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                AI Market Analyst
              </h1>
              <p
                className="text-[10px] leading-tight"
                style={{ color: "var(--text-muted)" }}
              >
                Analyse Multi-Agents
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-auto">
            <SearchBar
              onSelect={handleSearch}
              isLoading={state.status === "loading"}
            />
          </div>

          {/* Refresh button */}
          {state.status === "success" && (
            <button
              onClick={handleRefresh}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all"
              style={{
                borderColor: "var(--border-primary)",
                color: "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.borderColor =
                  "var(--border-secondary)";
                (e.target as HTMLButtonElement).style.color =
                  "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.borderColor =
                  "var(--border-primary)";
                (e.target as HTMLButtonElement).style.color =
                  "var(--text-secondary)";
              }}
              title="Actualiser l'analyse"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
              </svg>
              Refresh
            </button>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* ── IDLE ───────────────────────────────── */}
        {state.status === "idle" && <WelcomeScreen onSelect={handleSearch} />}

        {/* ── LOADING ────────────────────────────── */}
        {state.status === "loading" && (
          <LoadingScreen
            symbol={state.symbol}
            stage={state.stage}
            progress={state.progress}
          />
        )}

        {/* ── ERROR ──────────────────────────────── */}
        {state.status === "error" && (
          <ErrorBanner
            symbol={state.symbol}
            message={state.message}
            onRetry={handleRetry}
          />
        )}

        {/* ── SUCCESS ────────────────────────────── */}
        {state.status === "success" && (
          <DashboardView
            data={state.data}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            onRefresh={handleRefresh}
          />
        )}
      </main>

      {/* ═══════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════ */}
      <footer
        className="border-t py-4 text-center"
        style={{ borderColor: "var(--border-primary)" }}
      >
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          AI Market Analyst v0.1 · Système Multi-Agents · Ne constitue pas un conseil financier
        </p>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// WELCOME SCREEN
// ═══════════════════════════════════════════════════════════

function WelcomeScreen({
  onSelect,
}: {
  onSelect: (symbol: string, name: string) => void;
}) {
  const suggestions = [
    { symbol: "AAPL", name: "Apple Inc." },
    { symbol: "NVDA", name: "NVIDIA Corporation" },
    { symbol: "SPY", name: "S&P 500 ETF" },
    { symbol: "BTC-USD", name: "Bitcoin" },
    { symbol: "MSFT", name: "Microsoft Corp." },
    { symbol: "TSLA", name: "Tesla Inc." },
    { symbol: "GC=F", name: "Gold Futures" },
    { symbol: "QQQ", name: "Nasdaq 100 ETF" },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24">
      {/* Hero */}
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 text-3xl"
          style={{ backgroundColor: "rgba(59, 130, 246, 0.1)" }}
        >
          🧠
        </div>
        <h2
          className="text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ color: "var(--text-primary)" }}
        >
          AI Market Analyst
        </h2>
        <p
          className="mt-3 max-w-md text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Powered by a multi-agent AI system. Four specialized agents — Market,
          News, Risk, and Strategy — collaborate to deliver comprehensive
          financial analysis.
        </p>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-10 max-w-2xl w-full">
        {[
          { emoji: "📊", name: "Agent Marché", desc: "Analyse technique" },
          { emoji: "📰", name: "Agent Actualités", desc: "Événements fondamentaux" },
          { emoji: "⚠️", name: "Agent Risques", desc: "Évaluation des risques" },
          {
            emoji: "🎯",
            name: "Agent Stratégie",
            desc: "Scénarios et synthèse",
          },
        ].map((agent) => (
          <div
            key={agent.name}
            className="flex flex-col items-center gap-1 rounded-xl border p-4 text-center"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-primary)",
            }}
          >
            <span className="text-xl">{agent.emoji}</span>
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {agent.name}
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {agent.desc}
            </span>
          </div>
        ))}
      </div>

      {/* Suggested searches */}
      <div className="w-full max-w-lg">
        <p
          className="text-xs mb-3 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          Essayez de rechercher un de ces actifs :
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s.symbol}
              onClick={() => onSelect(s.symbol, s.name)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                borderColor: "var(--border-primary)",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.borderColor =
                  "var(--border-secondary)";
                (e.target as HTMLButtonElement).style.color =
                  "var(--text-primary)";
                (e.target as HTMLButtonElement).style.backgroundColor =
                  "var(--bg-card)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.borderColor =
                  "var(--border-primary)";
                (e.target as HTMLButtonElement).style.color =
                  "var(--text-secondary)";
                (e.target as HTMLButtonElement).style.backgroundColor =
                  "var(--bg-secondary)";
              }}
            >
              <span
                className="font-mono text-[11px]"
                style={{ color: "var(--accent-primary)" }}
              >
                {s.symbol}
              </span>
              <span
                className="hidden sm:inline"
                style={{ color: "var(--text-muted)" }}
              >
                {s.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LOADING SCREEN
// ═══════════════════════════════════════════════════════════

function LoadingScreen({
  symbol,
  stage,
  progress,
}: {
  symbol: string;
  stage: string;
  progress: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <LoadingSpinner size="lg" label={`Analyse de ${symbol} en cours…`} />
      <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
        {stage}
      </p>

      {/* Progress bar */}
      <div className="mt-6 w-full max-w-md">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--border-primary)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: "var(--accent-success)",
            }}
          />
        </div>
        <p
          className="mt-2 text-center text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {Math.round(progress)}%
        </p>
      </div>

      {/* Stage timeline */}
      <div className="mt-8 w-full max-w-md space-y-1">
        {STAGES.map((s) => {
          const isDone = progress >= s.at + 5;
          const isActive = progress >= s.at && progress < s.at + 5;
          return (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs transition-all"
              style={{
                color: isActive
                  ? "var(--text-primary)"
                  : isDone
                    ? "var(--text-muted)"
                    : undefined,
                backgroundColor: isActive ? "var(--bg-card)" : undefined,
                opacity: !isActive && !isDone ? 0.4 : 1,
              }}
            >
              <span className={isActive ? "animate-pulse" : ""}>
                {isDone ? "✅" : "⏳"}
              </span>
              <span>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD VIEW (success state)
// ═══════════════════════════════════════════════════════════

function DashboardView({
  data,
  selectedPeriod,
  onPeriodChange,
  onRefresh,
}: {
  data: AnalyzeResponse;
  selectedPeriod: string;
  onPeriodChange: (p: string) => void;
  onRefresh: () => void;
}) {
  const {
    market_data,
    market_analysis,
    news_analysis,
    risk_analysis,
    strategy_analysis,
    symbol,
    category,
    cached,
    generated_at,
    errors,
    warnings,
  } = data;

  const quote = market_data?.quote;

  return (
    <div className="space-y-6 animate-in">
      {/* ── Price Ticker ─────────────────────────── */}
      {quote && <PriceTicker quote={quote} category={category} />}

      {/* ── Price Chart ─────────────────────────── */}
      {market_data?.historical_prices &&
        market_data.historical_prices.length > 0 && (
          <div
            className="rounded-2xl border p-5"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-primary)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Graphique des prix — {symbol}
              </h3>
              <PeriodSelector
                periods={["1mo", "3mo", "6mo", "1y"]}
                selected={selectedPeriod}
                onChange={onPeriodChange}
              />
            </div>
            <PriceChart
              data={market_data.historical_prices}
              indicators={market_data.technical}
              symbol={symbol}
            />
          </div>
        )}

      {/* ── Quick Metrics Grid ───────────────────── */}
      {market_data?.technical && (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          }}
        >
          {market_data.technical.rsi_14 > 0 && (
            <MetricItem
              label="RSI (14)"
              value={market_data.technical.rsi_14.toFixed(1)}
            />
          )}
          {market_data.technical.sma_50 > 0 && (
            <MetricItem
              label="SMA 50"
              value={`$${market_data.technical.sma_50.toFixed(2)}`}
              mono
            />
          )}
          {market_data.technical.sma_200 > 0 && (
            <MetricItem
              label="SMA 200"
              value={`$${market_data.technical.sma_200.toFixed(2)}`}
              mono
            />
          )}
          {market_data.technical.macd_histogram !== undefined && (
            <MetricItem
              label="MACD Histogram"
              value={market_data.technical.macd_histogram.toFixed(4)}
              mono
              color={
                market_data.technical.macd_histogram >= 0
                  ? "var(--accent-success)"
                  : "var(--accent-danger)"
              }
            />
          )}
          {market_data.volatility_30d > 0 && (
            <MetricItem
              label="Volatilité 30j"
              value={`${market_data.volatility_30d.toFixed(1)}%`}
            />
          )}
          {market_data.avg_volume_30d > 0 && (
            <MetricItem
              label="Volume moyen (30j)"
              value={
                market_data.avg_volume_30d >= 1_000_000
                  ? `${(market_data.avg_volume_30d / 1_000_000).toFixed(1)}M`
                  : market_data.avg_volume_30d.toLocaleString()
              }
              mono
            />
          )}
        </div>
      )}

      {/* ── Four Agent Cards ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AnalysisCard
          title="Analyse de Marché"
          icon={<span>📊</span>}
          variant="market"
          collapsible
        >
          {market_analysis ? (
            <MarketAnalysisSection
              analysis={market_analysis}
              marketData={market_data}
            />
          ) : (
            <EmptyAgentMessage agent="Marché" />
          )}
        </AnalysisCard>

        <AnalysisCard
          title="Analyse des Actualités"
          icon={<span>📰</span>}
          variant="news"
          collapsible
        >
          {news_analysis ? (
            <NewsAnalysisSection data={news_analysis} />
          ) : (
            <EmptyAgentMessage agent="Actualités" />
          )}
        </AnalysisCard>

        <AnalysisCard
          title="Analyse des Risques"
          icon={<span>⚠️</span>}
          variant="risk"
          collapsible
        >
          {risk_analysis ? (
            <RiskAnalysisSection data={risk_analysis} />
          ) : (
            <EmptyAgentMessage agent="Risques" />
          )}
        </AnalysisCard>

        <AnalysisCard
          title="Stratégie et Scénarios"
          icon={<span>🎯</span>}
          variant="strategy"
          collapsible
        >
          {strategy_analysis ? (
            <StrategySection data={strategy_analysis} symbol={symbol} />
          ) : (
            <EmptyAgentMessage agent="Stratégie" />
          )}
        </AnalysisCard>
      </div>

      {/* ── Errors & Warnings ────────────────────── */}
      {errors && errors.length > 0 && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{
            backgroundColor: "var(--bearish-bg)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          {errors.map((err, i) => (
            <div
              key={`err-${i}`}
              className="flex items-start gap-2 text-sm"
              style={{ color: "var(--bearish)" }}
            >
              <span className="shrink-0 mt-0.5">❌</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{
            backgroundColor: "var(--neutral-bg)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
          }}
        >
          {warnings.map((warn, i) => (
            <div
              key={`warn-${i}`}
              className="flex items-start gap-2 text-sm"
              style={{ color: "var(--neutral)" }}
            >
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer Info ──────────────────────────── */}
      <div className="flex items-center justify-between text-[11px] pt-2">
        <span style={{ color: "var(--text-muted)" }}>
          Analyse générée le {new Date(generated_at).toLocaleString()}
          {cached && " · en cache"}
        </span>
        <button
          onClick={onRefresh}
          className="hover:underline"
          style={{ color: "var(--accent-primary)" }}
        >
          Refresh
        </button>
      </div>

      <p
        className="text-center text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        Cette analyse est générée par un système IA et ne constitue pas
        de conseil financier. Effectuez toujours vos propres recherches avant de prendre
        des décisions d'investissement.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════

function PeriodSelector({
  periods,
  selected,
  onChange,
}: {
  periods: string[];
  selected: string;
  onChange: (p: string) => void;
}) {
  return (
    <div
      className="flex gap-1 rounded-lg border p-0.5"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border-primary)",
      }}
    >
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className="rounded-md px-3 py-1 text-[11px] font-medium transition-all"
          style={{
            backgroundColor: p === selected ? "var(--bg-card)" : "transparent",
            color: p === selected ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: p === selected ? "var(--shadow-card)" : "none",
          }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function MetricItem({
  label,
  value,
  mono = false,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border-primary)",
      }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-wider mb-1"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className={`text-lg font-bold tabular-nums ${mono ? "font-mono text-sm" : ""}`}
        style={{ color: color || "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyAgentMessage({ agent }: { agent: string }) {
  return (
    <p className="text-sm italic py-4" style={{ color: "var(--text-muted)" }}>
      L'analyse {agent} n'est pas disponible pour cet actif.
    </p>
  );
}
