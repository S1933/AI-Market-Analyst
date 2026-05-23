// Package agents implements the multi-agent financial analysis system.
// The Orchestrator coordinates the four specialized agents:
// MarketAgent, NewsAgent, RiskAgent, and StrategyAgent.
package agents

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/hermes-agent/backend/internal/llm"
	"github.com/hermes-agent/backend/internal/market"
	"github.com/hermes-agent/backend/internal/models"
	"github.com/hermes-agent/backend/internal/news"
)

// ProgressCallback is called during analysis to report stage progress.
type ProgressCallback func(stage string, progress int, message string)

// Orchestrator coordinates the multi-agent analysis pipeline.
type Orchestrator struct {
	llmClient     *llm.Client
	marketClient  *market.Client
	marketAgent   *MarketAgent
	newsAgent     *NewsAgent
	riskAgent     *RiskAgent
	strategyAgent *StrategyAgent
	onProgress    ProgressCallback
}

// NewOrchestrator creates a new orchestrator with all four agents.
func NewOrchestrator(llmClient *llm.Client, marketClient *market.Client, newsClient *news.Client) *Orchestrator {
	return &Orchestrator{
		llmClient:     llmClient,
		marketClient:  marketClient,
		marketAgent:   NewMarketAgent(llmClient),
		newsAgent:     NewNewsAgent(llmClient, newsClient),
		riskAgent:     NewRiskAgent(llmClient),
		strategyAgent: NewStrategyAgent(llmClient),
	}
}

// SetProgressCallback sets a callback for progress updates during analysis.
func (o *Orchestrator) SetProgressCallback(cb ProgressCallback) {
	o.onProgress = cb
}

// reportProgress safely calls the progress callback if set.
func (o *Orchestrator) reportProgress(stage string, progress int, message string) {
	if o.onProgress != nil {
		o.onProgress(stage, progress, message)
	}
}

// RunAnalysis executes the full multi-agent pipeline.
//
// Pipeline:
//  1. Fetch market data via marketClient
//  2. Run MarketAgent, NewsAgent, and RiskAgent in parallel
//  3. Run StrategyAgent (synthesis — consumes all outputs)
//
// Returns an AnalysisResult with all agent outputs plus any errors/warnings.
// The returned error is only for fatal failures (e.g. market data fetch).
func (o *Orchestrator) RunAnalysis(ctx context.Context, symbol string) (*AnalysisResult, error) {
	startTime := time.Now()
	result := &AnalysisResult{}

	// ── Step 1: Fetch market data ──────────────────────────────────
	o.reportProgress("fetching_data", 5, "Fetching market data for "+symbol)
	marketData, err := o.marketClient.FetchFullData(symbol)
	if err != nil {
		return nil, fmt.Errorf("market data fetch failed: %w", err)
	}
	result.MarketData = marketData
	o.reportProgress("fetching_data", 15, fmt.Sprintf("Market data fetched — %s $%.2f",
		marketData.Quote.Name, marketData.Quote.Price))

	// ── Step 2: Run MarketAgent, NewsAgent & RiskAgent in parallel ──
	o.reportProgress("agents_running", 20, "Running Market, News & Risk agents in parallel...")

	var marketAnalysis *models.MarketAnalysis
	var newsAnalysis *models.NewsAnalysis
	var riskAnalysis *models.RiskAnalysis
	var mu sync.Mutex
	var wg sync.WaitGroup

	wg.Add(3)

	// Market agent
	go func() {
		defer wg.Done()
		o.reportProgress("agents_running", 25, fmt.Sprintf("MarketAgent analyzing %s...", symbol))
		analysis, err := o.marketAgent.Analyze(ctx, marketData)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			log.Printf("[WARN] MarketAgent LLM error, using computed analysis: %v", err)
			result.Errors = append(result.Errors, fmt.Sprintf("market_agent: %v", err))
			// Fall back to pure rule-based technical analysis
			analysis = o.marketAgent.AnalyzeWithoutLLM(marketData)
		}
		marketAnalysis = analysis
		o.reportProgress("agents_running", 40, "MarketAgent completed")
	}()

	// News agent
	go func() {
		defer wg.Done()
		o.reportProgress("agents_running", 25, fmt.Sprintf("NewsAgent analyzing %s...", symbol))
		analysis, err := o.newsAgent.Analyze(ctx, marketData)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			log.Printf("[WARN] NewsAgent LLM error, using degraded analysis: %v", err)
			result.Errors = append(result.Errors, fmt.Sprintf("news_agent: %v", err))
			// analysis is non-nil even on LLM error (contains price/trend fallback)
		}
		if analysis != nil {
			newsAnalysis = analysis
		}
		o.reportProgress("agents_running", 40, "NewsAgent completed")
	}()

	// Risk agent — runs in parallel with Market & News.
	// Uses a provisional news summary built from market data while
	// the NewsAgent runs. The StrategyAgent will synthesize the final
	// picture with the real news analysis available.
	go func() {
		defer wg.Done()
		o.reportProgress("agents_running", 25, fmt.Sprintf("RiskAgent analyzing %s...", symbol))
		newsSummary := buildNewsSummary(nil) // provisional
		analysis, err := o.riskAgent.Run(ctx, symbol, marketData, newsSummary)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			log.Printf("[WARN] RiskAgent error: %v", err)
			result.Errors = append(result.Errors, fmt.Sprintf("risk_agent: %v", err))
		} else {
			riskAnalysis = analysis
		}
		o.reportProgress("agents_running", 40, "RiskAgent completed")
	}()

	wg.Wait()
	o.reportProgress("agents_running", 60, "Market, News & Risk agents completed")

	result.Market = marketAnalysis
	result.News = newsAnalysis
	result.Risk = riskAnalysis

	// ── Step 3: Run StrategyAgent (synthesis) ──────────────────────
	o.reportProgress("agents_running", 70, "Running Strategy agent (synthesis)...")

	strategyInput := StrategyInput{
		Symbol:    symbol,
		AssetName: marketData.Quote.Name,
		Category:  marketAssetTypeToCategory(marketData.Quote.AssetType),
		Quote:     marketQuoteToModelQuote(marketData.Quote, marketData.FetchedAt),
		Market:    marketAnalysis,
		News:      newsAnalysis,
		Risk:      riskAnalysis,
	}

	strategyAnalysis, err := o.strategyAgent.Run(ctx, strategyInput)
	if err != nil {
		log.Printf("[WARN] StrategyAgent error: %v", err)
		result.Errors = append(result.Errors, fmt.Sprintf("strategy_agent: %v", err))
	} else {
		result.Strategy = strategyAnalysis
	}
	o.reportProgress("agents_running", 95, "All agents completed")

	// ── Done ───────────────────────────────────────────────────────
	elapsed := time.Since(startTime)
	o.reportProgress("complete", 100, fmt.Sprintf("Analysis complete in %.1fs", elapsed.Seconds()))
	log.Printf("[INFO] Full analysis for %s completed in %v", symbol, elapsed)

	return result, nil
}

// RunAnalysisStreaming is like RunAnalysis but calls the progress callback more frequently.
func (o *Orchestrator) RunAnalysisStreaming(ctx context.Context, symbol string, cb ProgressCallback) (*AnalysisResult, error) {
	o.SetProgressCallback(cb)
	return o.RunAnalysis(ctx, symbol)
}

// ── Conversion helpers ──────────────────────────────────────────────

// marketQuoteToModelQuote converts a market.Quote to a models.Quote.
func marketQuoteToModelQuote(q market.Quote, fetchedAt time.Time) *models.Quote {
	return &models.Quote{
		Symbol:        q.Symbol,
		Name:          q.Name,
		Price:         q.Price,
		Change:        q.Change,
		ChangePercent: q.ChangePercent,
		PreviousClose: q.PrevClose,
		DayHigh:       q.High,
		DayLow:        q.Low,
		Volume:        q.Volume,
		MarketCap:     q.MarketCap,
		FetchedAt:     fetchedAt,
	}
}

// marketAssetTypeToCategory maps a market.AssetType to a models.AssetCategory.
func marketAssetTypeToCategory(t market.AssetType) models.AssetCategory {
	switch t {
	case market.AssetStock:
		return models.AssetStock
	case market.AssetCrypto:
		return models.AssetCrypto
	case market.AssetIndex:
		return models.AssetIndex
	case market.AssetCommo:
		return models.AssetCommodity
	case market.AssetForex:
		return models.AssetForex
	default:
		return models.AssetStock
	}
}

// buildNewsSummary extracts a textual summary from the news analysis for
// consumption by the RiskAgent. If the news analysis is nil or has an empty
// summary, returns a fallback string.
func buildNewsSummary(news *models.NewsAnalysis) string {
	if news == nil {
		return "News analysis unavailable."
	}
	if news.Summary != "" {
		return news.Summary
	}
	if news.OverallSentiment != "" {
		return fmt.Sprintf("Overall sentiment: %s. Impact on asset: %s. Key themes: %v.",
			news.OverallSentiment, news.ImpactOnAsset, news.KeyThemes)
	}
	return "No news summary available."
}
