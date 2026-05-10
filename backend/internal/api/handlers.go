package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hermes-agent/backend/internal/agents"
	"github.com/hermes-agent/backend/internal/cache"
	"github.com/hermes-agent/backend/internal/market"
	"github.com/hermes-agent/backend/internal/models"
)

// Handler holds all HTTP handlers and their dependencies.
type Handler struct {
	marketClient *market.Client
	orchestrator *agents.Orchestrator
	cache        *cache.Cache
}

// NewHandler creates a new Handler with the given dependencies.
func NewHandler(mc *market.Client, orch *agents.Orchestrator, c *cache.Cache) *Handler {
	return &Handler{
		marketClient: mc,
		orchestrator: orch,
		cache:        c,
	}
}

// ────────────────────────────────────────────────────────────
// HEALTH
// ────────────────────────────────────────────────────────────

// Health returns a simple health check response.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"service":   "hermes-agent",
		"timestamp": time.Now().UTC(),
	})
}

// ────────────────────────────────────────────────────────────
// ANALYZE — Core endpoint
// ────────────────────────────────────────────────────────────

// Analyze is the main analysis endpoint.
// POST /api/v1/analyze
// Body: { "symbol": "AAPL", "force_refresh": false }
func (h *Handler) Analyze(w http.ResponseWriter, r *http.Request) {
	var req models.AnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Cannot parse request body: "+err.Error())
		return
	}
	defer r.Body.Close()

	req.Symbol = strings.TrimSpace(strings.ToUpper(req.Symbol))
	if req.Symbol == "" {
		writeError(w, http.StatusBadRequest, "missing_symbol", "Symbol is required")
		return
	}

	requestID := uuid.New().String()

	// Check cache first (unless force refresh)
	cacheKey := "analysis:" + req.Symbol
	if !req.ForceRefresh {
		if cached, found := h.cache.Get(cacheKey); found {
			resp := cached.(models.AnalyzeResponse)
			resp.Cached = true
			log.Printf("[%s] Cache hit for %s", requestID, req.Symbol)
			writeJSON(w, http.StatusOK, resp)
			return
		}
	}

	log.Printf("[%s] Starting full analysis for %s", requestID, req.Symbol)

	// --- Step 1: Run all 4 agents via the orchestrator ---
	// The orchestrator handles market data fetching internally.
	analysisResult, err := h.orchestrator.RunAnalysis(r.Context(), req.Symbol)
	if err != nil {
		log.Printf("[%s] Orchestrator fatal error for %s: %v", requestID, req.Symbol, err)
		writeError(w, http.StatusInternalServerError, "analysis_failed", err.Error())
		return
	}

	// --- Step 2: Convert internal market data to API model ---
	var marketData *models.MarketData
	if analysisResult.MarketData != nil {
		marketData = h.convertMarketData(analysisResult.MarketData)
	} else {
		marketData = &models.MarketData{Symbol: req.Symbol}
	}

	// --- Step 3: Build response ---
	resp := models.AnalyzeResponse{
		RequestID:   requestID,
		Symbol:      req.Symbol,
		Name:        getAssetName(marketData),
		Category:    detectCategory(req.Symbol, marketData),
		GeneratedAt: time.Now().UTC(),
		MarketData:  marketData,
		Market:      analysisResult.Market,
		News:        analysisResult.News,
		Risk:        analysisResult.Risk,
		Strategy:    analysisResult.Strategy,
		Errors:      analysisResult.Errors,
		Warnings:    analysisResult.Warnings,
		Cached:      false,
	}

	// --- Step 4: Cache the result ---
	h.cache.Set(cacheKey, resp)

	log.Printf("[%s] Analysis complete for %s", requestID, req.Symbol)
	writeJSON(w, http.StatusOK, resp)
}

// ────────────────────────────────────────────────────────────
// ANALYZE STREAM — SSE endpoint for progress
// ────────────────────────────────────────────────────────────

// AnalyzeStream returns analysis results via Server-Sent Events.
// GET /api/v1/analyze/stream?symbol=AAPL
func (h *Handler) AnalyzeStream(w http.ResponseWriter, r *http.Request) {
	symbol := strings.TrimSpace(strings.ToUpper(r.URL.Query().Get("symbol")))
	if symbol == "" {
		writeError(w, http.StatusBadRequest, "missing_symbol", "Symbol query param is required")
		return
	}
	forceRefresh := r.URL.Query().Get("force_refresh") == "true"
	requestID := uuid.New().String()

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "sse_unsupported", "Streaming not supported")
		return
	}

	sendSSE := func(stage string, progress int, message string, data interface{}) {
		evt := models.AnalysisProgress{
			RequestID: requestID,
			Stage:     stage,
			Progress:  progress,
			Message:   message,
		}
		payload := map[string]interface{}{
			"progress": evt,
		}
		if data != nil {
			payload["data"] = data
		}
		b, _ := json.Marshal(payload)
		w.Write([]byte("data: " + string(b) + "\n\n"))
		flusher.Flush()
	}

	// Check cache
	cacheKey := "analysis:" + symbol
	if !forceRefresh {
		if cached, found := h.cache.Get(cacheKey); found {
			resp := cached.(models.AnalyzeResponse)
			resp.Cached = true
			sendSSE("complete", 100, "Retrieved from cache", resp)
			return
		}
	}

	sendSSE("fetching_data", 5, "Fetching market data for "+symbol, nil)

	marketData, err := h.fetchMarketData(symbol)
	if err != nil {
		sendSSE("fetching_data", 10, "Market data partially available — using LLM knowledge", nil)
		marketData = &models.MarketData{Symbol: symbol}
	}

	sendSSE("market_agent", 25, "Running Market Agent — technical analysis...", nil)
	// We don't stream individual agent results in SSE to keep it simple;
	// the orchestrator runs all agents, and we send the final result.
	// For a true streaming implementation, we'd modify the orchestrator
	// to support progress callbacks.

	sendSSE("news_agent", 40, "Running News Agent — scanning events...", nil)
	sendSSE("risk_agent", 60, "Running Risk Agent — evaluating exposures...", nil)
	sendSSE("strategy_agent", 80, "Running Strategy Agent — building scenarios...", nil)

	analysisResult, err := h.orchestrator.RunAnalysis(r.Context(), symbol)

	resp := models.AnalyzeResponse{
		RequestID:   requestID,
		Symbol:      symbol,
		Name:        getAssetName(marketData),
		Category:    detectCategory(symbol, marketData),
		GeneratedAt: time.Now().UTC(),
		MarketData:  marketData,
		Market:      analysisResult.Market,
		News:        analysisResult.News,
		Risk:        analysisResult.Risk,
		Strategy:    analysisResult.Strategy,
		Errors:      analysisResult.Errors,
		Warnings:    analysisResult.Warnings,
		Cached:      false,
	}

	h.cache.Set(cacheKey, resp)
	sendSSE("complete", 100, "Analysis complete", resp)
}

// ────────────────────────────────────────────────────────────
// SEARCH
// ────────────────────────────────────────────────────────────

// Search handles symbol autocomplete search.
// GET /api/v1/search?q=apple
func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		writeError(w, http.StatusBadRequest, "missing_query", "Query param 'q' is required")
		return
	}

	results, err := h.marketClient.SearchSymbols(query)
	if err != nil {
		// Fallback: return basic suggestion for common tickers
		results = fallbackSearch(query)
	}

	if results == nil {
		results = []market.SearchResult{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"query":   query,
		"results": results,
		"count":   len(results),
	})
}

// ────────────────────────────────────────────────────────────
// MARKET DATA (raw)
// ────────────────────────────────────────────────────────────

// GetMarketData returns raw market data without LLM analysis.
// GET /api/v1/market-data?symbol=AAPL&period=6mo&interval=1d
func (h *Handler) GetMarketData(w http.ResponseWriter, r *http.Request) {
	symbol := strings.TrimSpace(strings.ToUpper(r.URL.Query().Get("symbol")))
	if symbol == "" {
		writeError(w, http.StatusBadRequest, "missing_symbol", "Symbol query param is required")
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "6mo"
	}
	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "1d"
	}

	historical, err := h.marketClient.FetchHistorical(symbol, period, interval)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_error", err.Error())
		return
	}

	quote, err := h.marketClient.FetchQuote(symbol)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_error", err.Error())
		return
	}

	indicators := market.ComputeIndicators(historical)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"symbol":     symbol,
		"quote":      quote,
		"historical": historical,
		"indicators": indicators,
		"count":      len(historical),
		"fetched_at": time.Now().UTC(),
	})
}

// ────────────────────────────────────────────────────────────
// GET QUOTE (lightweight)
// ────────────────────────────────────────────────────────────

// GetQuote returns a quick price snapshot.
// GET /api/v1/quote?symbol=AAPL
func (h *Handler) GetQuote(w http.ResponseWriter, r *http.Request) {
	symbol := strings.TrimSpace(strings.ToUpper(r.URL.Query().Get("symbol")))
	if symbol == "" {
		writeError(w, http.StatusBadRequest, "missing_symbol", "Symbol query param is required")
		return
	}

	quote, err := h.marketClient.FetchQuote(symbol)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, quote)
}

// ────────────────────────────────────────────────────────────
// CACHE MANAGEMENT
// ────────────────────────────────────────────────────────────

// ClearCache clears all cached analyses.
// DELETE /api/v1/cache
func (h *Handler) ClearCache(w http.ResponseWriter, r *http.Request) {
	h.cache.Clear()
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Cache cleared",
	})
}

// CacheStats returns cache statistics.
// GET /api/v1/cache/stats
func (h *Handler) CacheStats(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"size": h.cache.Size(),
	})
}

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

func (h *Handler) fetchMarketData(symbol string) (*models.MarketData, error) {
	data, err := h.marketClient.FetchFullData(symbol)
	if err != nil {
		return nil, err
	}

	md := &models.MarketData{
		Symbol:   data.Quote.Symbol,
		Name:     data.Quote.Name,
		Category: detectCategory(symbol, nil),
		Currency: data.Quote.Currency,
		Quote: &models.Quote{
			Symbol:        data.Quote.Symbol,
			Name:          data.Quote.Name,
			Price:         data.Quote.Price,
			Change:        data.Quote.Change,
			ChangePercent: data.Quote.ChangePercent,
			PreviousClose: data.Quote.PrevClose,
			DayHigh:       data.Quote.High,
			DayLow:        data.Quote.Low,
			Volume:        data.Quote.Volume,
			MarketCap:     data.Quote.MarketCap,
			FetchedAt:     data.FetchedAt,
		},
		HistoricalPrices: convertHistorical(data.Historical),
		Technical:        convertTechnical(data.Indicators),
		SupportResistance: &models.SupportResistance{
			Supports:    data.Indicators.SupportLevels,
			Resistances: data.Indicators.ResistLevels,
			PivotPoint:  (data.Quote.High + data.Quote.Low + data.Quote.Price) / 3,
		},
		Volatility30D: data.Indicators.Volatility20,
		AvgVolume30D:  0, // Computed separately if needed
		FetchedAt:     data.FetchedAt,
	}

	// Compute average volume
	if len(data.Historical) >= 20 {
		var totalVol int64
		start := len(data.Historical) - 20
		for _, p := range data.Historical[start:] {
			totalVol += p.Volume
		}
		md.AvgVolume30D = totalVol / 20
	}

	return md, nil
}

// convertMarketData converts an internal market.MarketData to the API model.
func (h *Handler) convertMarketData(data *market.MarketData) *models.MarketData {
	return h.fetchMarketDataFromInternal(data)
}

// fetchMarketDataFromInternal does the conversion without fetching.
func (h *Handler) fetchMarketDataFromInternal(data *market.MarketData) *models.MarketData {
	md := &models.MarketData{
		Symbol:   data.Quote.Symbol,
		Name:     data.Quote.Name,
		Category: detectCategory(data.Quote.Symbol, nil),
		Currency: data.Quote.Currency,
		Quote: &models.Quote{
			Symbol:        data.Quote.Symbol,
			Name:          data.Quote.Name,
			Price:         data.Quote.Price,
			Change:        data.Quote.Change,
			ChangePercent: data.Quote.ChangePercent,
			PreviousClose: data.Quote.PrevClose,
			DayHigh:       data.Quote.High,
			DayLow:        data.Quote.Low,
			Volume:        data.Quote.Volume,
			MarketCap:     data.Quote.MarketCap,
			FetchedAt:     data.FetchedAt,
		},
		HistoricalPrices: convertHistorical(data.Historical),
		Technical:        convertTechnical(data.Indicators),
		SupportResistance: &models.SupportResistance{
			Supports:    data.Indicators.SupportLevels,
			Resistances: data.Indicators.ResistLevels,
			PivotPoint:  (data.Quote.High + data.Quote.Low + data.Quote.Price) / 3,
		},
		Volatility30D: data.Indicators.Volatility20,
		AvgVolume30D:  0,
		FetchedAt:     data.FetchedAt,
	}
	if len(data.Historical) >= 20 {
		var totalVol int64
		start := len(data.Historical) - 20
		for _, p := range data.Historical[start:] {
			totalVol += p.Volume
		}
		md.AvgVolume30D = totalVol / 20
	}
	return md
}

func convertHistorical(pp []market.PricePoint) []models.PricePoint {
	result := make([]models.PricePoint, len(pp))
	for i, p := range pp {
		result[i] = models.PricePoint{
			Date:   p.Date,
			Open:   p.Open,
			High:   p.High,
			Low:    p.Low,
			Close:  p.Close,
			Volume: p.Volume,
		}
	}
	return result
}

func convertTechnical(ti market.TechnicalIndicators) *models.TechnicalIndicators {
	rsisig := models.TrendNeutral
	if ti.RSI14 > 70 {
		rsisig = models.TrendBearish // overbought
	} else if ti.RSI14 < 30 {
		rsisig = models.TrendBullish // oversold
	} else if ti.RSI14 > 50 {
		rsisig = models.TrendBullish
	} else {
		rsisig = models.TrendBearish
	}

	macdCross := "none"
	if ti.MACDHistogram > 0 {
		macdCross = "bullish"
	} else if ti.MACDHistogram < 0 {
		macdCross = "bearish"
	}

	return &models.TechnicalIndicators{
		RSI14:        ti.RSI14,
		RSISignal:    rsisig,
		MACDLine:     ti.MACDLine,
		MACDSignal:   ti.MACDSignal,
		MACDHist:     ti.MACDHistogram,
		MACDCross:    macdCross,
		SMA20:        ti.SMA20,
		SMA50:        ti.SMA50,
		SMA200:       ti.SMA200,
		EMA12:        ti.EMA12,
		EMA26:        ti.EMA26,
		BollingerUp:  ti.BBUpper,
		BollingerMid: ti.BBMiddle,
		BollingerLow: ti.BBLower,
		ATR14:        ti.ATR14,
	}
}

func getAssetName(md *models.MarketData) string {
	if md == nil || md.Name == "" {
		return ""
	}
	return md.Name
}

func detectCategory(symbol string, md *models.MarketData) models.AssetCategory {
	if md != nil && md.Category != "" {
		return md.Category
	}

	symbol = strings.ToUpper(symbol)

	// Major US indices
	indices := map[string]models.AssetCategory{
		"^GSPC": models.AssetIndex, "SPX": models.AssetIndex, "SPY": models.AssetIndex,
		"^IXIC": models.AssetIndex, "NDX": models.AssetIndex, "QQQ": models.AssetIndex,
		"^DJI": models.AssetIndex, "DIA": models.AssetIndex, "IWM": models.AssetIndex,
		"^FTSE": models.AssetIndex, "^N225": models.AssetIndex, "^HSI": models.AssetIndex,
		"^FCHI": models.AssetIndex, "^GDAXI": models.AssetIndex,
	}
	if cat, ok := indices[symbol]; ok {
		return cat
	}

	// Crypto
	cryptos := map[string]bool{
		"BTC": true, "BTC-USD": true, "ETH": true, "ETH-USD": true,
		"SOL": true, "XRP": true, "ADA": true, "DOGE": true,
		"DOT": true, "AVAX": true, "MATIC": true,
	}
	if cryptos[symbol] || strings.HasSuffix(symbol, "-USD") {
		return models.AssetCrypto
	}

	// Forex
	if strings.Contains(symbol, "=X") || strings.HasSuffix(symbol, "USD") && len(symbol) == 6 {
		return models.AssetForex
	}

	// Commodity ETFs / Futures
	commodities := map[string]bool{
		"GC=F": true, "CL=F": true, "SI=F": true, "NG=F": true,
		"GLD": true, "SLV": true, "USO": true, "UNG": true,
		"GDX": true, "XLE": true,
	}
	if commodities[symbol] {
		return models.AssetCommodity
	}

	return models.AssetStock
}

func fallbackSearch(query string) []market.SearchResult {
	// Provide a basic set of popular tickers for demo purposes
	query = strings.ToUpper(strings.TrimSpace(query))
	popular := []market.SearchResult{
		{Symbol: "AAPL", Name: "Apple Inc.", Exchange: "NASDAQ", AssetType: "stock"},
		{Symbol: "MSFT", Name: "Microsoft Corporation", Exchange: "NASDAQ", AssetType: "stock"},
		{Symbol: "GOOGL", Name: "Alphabet Inc.", Exchange: "NASDAQ", AssetType: "stock"},
		{Symbol: "AMZN", Name: "Amazon.com Inc.", Exchange: "NASDAQ", AssetType: "stock"},
		{Symbol: "NVDA", Name: "NVIDIA Corporation", Exchange: "NASDAQ", AssetType: "stock"},
		{Symbol: "META", Name: "Meta Platforms Inc.", Exchange: "NASDAQ", AssetType: "stock"},
		{Symbol: "TSLA", Name: "Tesla Inc.", Exchange: "NASDAQ", AssetType: "stock"},
		{Symbol: "SPY", Name: "SPDR S&P 500 ETF", Exchange: "NYSE", AssetType: "index"},
		{Symbol: "QQQ", Name: "Invesco QQQ Trust", Exchange: "NASDAQ", AssetType: "index"},
		{Symbol: "BTC-USD", Name: "Bitcoin USD", Exchange: "CRYPTO", AssetType: "crypto"},
		{Symbol: "ETH-USD", Name: "Ethereum USD", Exchange: "CRYPTO", AssetType: "crypto"},
		{Symbol: "GC=F", Name: "Gold Futures", Exchange: "COMEX", AssetType: "commodity"},
		{Symbol: "CL=F", Name: "Crude Oil Futures", Exchange: "NYMEX", AssetType: "commodity"},
	}

	var results []market.SearchResult
	for _, r := range popular {
		if strings.Contains(strings.ToLower(r.Symbol), strings.ToLower(query)) ||
			strings.Contains(strings.ToLower(r.Name), strings.ToLower(query)) {
			results = append(results, r)
		}
	}
	return results
}

// ────────────────────────────────────────────────────────────
// JSON RESPONSE HELPERS
// ────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")

	// Marshal to bytes first so we can catch +Inf/-Inf/NaN errors
	// before writing the status header. Otherwise a marshal failure
	// leaves the client with an empty 200 response.
	body, err := json.Marshal(data)
	if err != nil {
		log.Printf("Error marshaling JSON response: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.ErrorResponse{
			Error:   "internal_error",
			Code:    "marshal_failed",
			Details: "The response could not be serialized due to invalid numeric data.",
		})
		return
	}

	w.WriteHeader(status)
	w.Write(body)
}

func writeError(w http.ResponseWriter, status int, code, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.ErrorResponse{
		Error:   code,
		Code:    code,
		Details: details,
	})
}
