"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Search,
  TrendingUp,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  FileText,
  Target,
} from "lucide-react";
import type { AnalyzeResponse, AnalysisProgress } from "@/lib/types";
import { analyze, analyzeStream, ApiError } from "@/lib/api";
import SearchBar from "./SearchBar";
import PriceChart from "./PriceChart";
import MarketAnalysis from "./MarketAnalysis";
import NewsAnalysis from "./NewsAnalysis";
import RiskAnalysis from "./RiskAnalysis";
import StrategyAnalysis from "./StrategyAnalysis";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type TabId = "market" | "news" | "risk" | "strategy";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: Tab[] = [
  {
    id: "market",
    label: "Marché",
    icon: <TrendingUp size={16} />,
    description: "Analyse technique et tendances de prix",
  },
  {
    id: "news",
    label: "Actualités",
    icon: <FileText size={16} />,
    description: "Analyse fondamentale et événementielle",
  },
  {
    id: "risk",
    label: "Risques",
    icon: <AlertTriangle size={16} />,
    description: "Évaluation des risques et expositions",
  },
  {
    id: "strategy",
    label: "Stratégie",
    icon: <Target size={16} />,
    description: "Scénarios et synthèse",
  },
];

// ─────────────────────────────────────────────────────────────
// DASHBOARD COMPONENT
// ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [symbol, setSymbol] = useState<string>("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("market");
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);

  // ── Handlers ──────────────────────────────────────────────

  const handleSearch = useCallback(async (searchSymbol: string) => {
    const cleanSymbol = searchSymbol.trim().toUpperCase();
    if (!cleanSymbol) return;

    // Abort any ongoing stream
    abortRef.current?.abort();

    setSymbol(cleanSymbol);
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress({
      request_id: "",
      stage: "fetching_data",
      progress: 5,
      message: "Démarrage de l'analyse...",
    });

    try {
      const response = await analyze({
        symbol: cleanSymbol,
        force_refresh: false,
      });
      setResult(response);

      if (response.errors && response.errors.length > 0) {
        console.warn("Analysis completed with errors:", response.errors);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.code}: ${err.details}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Une erreur inattendue s'est produite");
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!symbol) return;
    abortRef.current?.abort();
    setLoading(true);
    setError(null);
    setProgress({
      request_id: "",
      stage: "fetching_data",
      progress: 5,
      message: "Actualisation de l'analyse...",
    });

    try {
      const response = await analyze({ symbol, force_refresh: true });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'actualisation");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [symbol]);

  const handleStreamProgress = useCallback((p: AnalysisProgress) => {
    setProgress(p);
  }, []);

  const handleStreamComplete = useCallback((data: AnalyzeResponse) => {
    setResult(data);
    setLoading(false);
    setProgress(null);
  }, []);

  const handleStreamError = useCallback((err: Error) => {
    setError(err.message);
    setLoading(false);
    setProgress(null);
  }, []);

  // ── Render helpers ────────────────────────────────────────

  const renderTabContent = () => {
    if (!result) return null;

    switch (activeTab) {
      case "market":
        return (
          <MarketAnalysis
            data={result.market_analysis}
            marketData={result.market_data}
          />
        );
      case "news":
        return <NewsAnalysis data={result.news_analysis} />;
      case "risk":
        return <RiskAnalysis data={result.risk_analysis} />;
      case "strategy":
        return (
          <StrategyAnalysis
            data={result.strategy_analysis}
            symbol={result.symbol}
          />
        );
      default:
        return null;
    }
  };

  // ── Empty state ───────────────────────────────────────────

  const isEmpty = !result && !loading && !error;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-20">
      {/* ── HEADER ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border-primary)]">
        <div className="max-w-[1440px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                <BarChart3 size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)] leading-tight tracking-tight">
                  AI Market Analyst
                </h1>
                <p className="text-xs text-[var(--text-muted)]">
                  Analyse multi-agents
                </p>
              </div>
            </div>

            {/* Search bar */}
            <div className="flex-1 max-w-[560px]">
              <SearchBar onSearch={handleSearch} loading={loading} />
            </div>

            {/* Refresh button */}
            {result && (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Actualiser l'analyse"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                <span className="text-sm font-medium hidden sm:inline">
                  Actualiser
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main className="max-w-[1440px] mx-auto px-6 pt-6">
        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--bearish-bg)] border border-red-500/20 flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="text-[var(--accent-danger)] shrink-0 mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--accent-danger)]">
                Erreur d'analyse
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {error}
              </p>
              <button
                onClick={() => {
                  setError(null);
                  if (symbol) handleSearch(symbol);
                }}
                className="mt-2 text-xs font-medium text-[var(--accent-primary)] hover:underline"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {loading && progress && (
          <div className="mb-6">
            <div className="glass-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center">
                  <RefreshCw size={20} className="text-blue-400 animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {progress.message}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Étape : {progress.stage.replace(/_/g, " ")}
                  </p>
                </div>
                <span className="text-sm font-mono text-[var(--text-secondary)]">
                  {progress.progress}%
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill low"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-[var(--border-accent)] flex items-center justify-center mb-8">
              <Search
                size={40}
                className="text-[var(--accent-primary)] opacity-60"
              />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3 tracking-tight">
              Lancez votre analyse
            </h2>
            <p className="text-[var(--text-secondary)] max-w-[420px] leading-relaxed">
              Entrez un symbole boursier ci-dessus pour obtenir une analyse
              multi-agents complète. Nos agents IA analyseront le marché, les
              actualités, les risques et construiront des scénarios
              stratégiques.
            </p>
            <div className="flex flex-wrap gap-3 mt-8 justify-center">
              {["AAPL", "NVDA", "SPY", "BTC-USD", "GC=F"].map((ticker) => (
                <button
                  key={ticker}
                  onClick={() => handleSearch(ticker)}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] hover:bg-[var(--bg-card-hover)] transition-all duration-150"
                >
                  {ticker}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* ── TICKER BAR ─────────────────────────────── */}
            {result.market_data?.quote && (
              <div className="ticker-bar">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      {result.symbol}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">
                      {result.market_data.name || result.name || ""}
                    </span>
                    <span className="badge badge-info text-[10px]">
                      {result.category || "stock"}
                    </span>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-6">
                  <span className="ticker-price">
                    $
                    {result.market_data.quote.price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span
                    className={`ticker-change ${(result.market_data.quote.change_percent ?? 0) >= 0 ? "positive" : "negative"}`}
                  >
                    {(result.market_data.quote.change_percent ?? 0) >= 0
                      ? "+"
                      : ""}
                    {result.market_data.quote.change_percent?.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* ── CHART ──────────────────────────────────── */}
            {result.market_data?.historical_prices &&
              result.market_data.historical_prices.length > 0 && (
                <div className="chart-container">
                  <PriceChart
                    data={result.market_data.historical_prices}
                    symbol={result.symbol}
                    changePercent={
                      result.market_data.quote?.change_percent ?? 0
                    }
                  />
                </div>
              )}

            {/* ── METRIC GRID (quick stats) ──────────────── */}
            {result.market_data?.technical && (
              <div className="metric-grid">
                <div className="metric-item">
                  <div className="metric-label">RSI (14)</div>
                  <div
                    className={`metric-value mono ${result.market_data.technical.rsi_14 > 70 ? "text-[var(--accent-danger)]" : result.market_data.technical.rsi_14 < 30 ? "text-[var(--accent-success)]" : ""}`}
                  >
                    {result.market_data.technical.rsi_14?.toFixed(1) || "—"}
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">SMA 50</div>
                  <div className="metric-value mono">
                    ${result.market_data.technical.sma_50?.toFixed(2) || "—"}
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">SMA 200</div>
                  <div className="metric-value mono">
                    ${result.market_data.technical.sma_200?.toFixed(2) || "—"}
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">Histogramme MACD</div>
                  <div
                    className={`metric-value mono ${(result.market_data.technical.macd_histogram ?? 0) >= 0 ? "text-[var(--accent-success)]" : "text-[var(--accent-danger)]"}`}
                  >
                    {result.market_data.technical.macd_histogram?.toFixed(4) ||
                      "—"}
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">Volatilité 30 jours</div>
                  <div className="metric-value mono">
                    {result.market_data.volatility_30d?.toFixed(1) || "—"}%
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">Volume moyen (30j)</div>
                  <div className="metric-value mono">
                    {result.market_data.avg_volume_30d
                      ? (result.market_data.avg_volume_30d / 1_000_000).toFixed(
                          1,
                        ) + "M"
                      : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB NAVIGATION ─────────────────────────── */}
            <div className="tab-nav">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
                  title={tab.description}
                >
                  <span className="flex items-center gap-2">
                    {tab.icon}
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>

            {/* ── TAB CONTENT ────────────────────────────── */}
            <div className="min-h-[400px]">{renderTabContent()}</div>

            {/* ── WARNINGS ────────────────────────────────── */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-[var(--neutral-bg)] border border-yellow-500/15">
                <p className="text-xs font-semibold text-[var(--accent-warning)] uppercase tracking-wide mb-2">
                  Avertissements
                </p>
                <ul className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <li
                      key={i}
                      className="text-sm text-[var(--text-secondary)] flex items-start gap-2"
                    >
                      <span className="text-[var(--accent-warning)] shrink-0 mt-1">
                        •
                      </span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── FOOTER NOTE ────────────────────────────── */}
            <div className="text-center py-8">
              <p className="text-[11px] text-[var(--text-muted)] max-w-[600px] mx-auto leading-relaxed">
                Cette analyse est générée par des agents IA et est fournie à
                titre informatif uniquement. Elle ne constitue pas un conseil
                financier. Effectuez toujours vos propres recherches avant de
                prendre des décisions d'investissement. Les performances passées
                ne préjugent pas des résultats futurs.
              </p>
              {result.cached && (
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  • Issu du cache •{" "}
                  {new Date(result.generated_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CSS ANIMATION (add to globals.css or keep inline via <style>)
// ─────────────────────────────────────────────────────────────

// The animate-in class requires a small CSS addition.
// If not present in globals.css, uncomment the <style> tag below
// or add to app/globals.css:
//
// @keyframes fade-in {
//   from { opacity: 0; transform: translateY(8px); }
//   to   { opacity: 1; transform: translateY(0); }
// }
// .animate-in { animation: fade-in 0.3s ease-out; }
