package market

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ============================================================================
// TYPES
// ============================================================================

// AssetType classifies the kind of financial instrument.
type AssetType string

const (
	AssetStock  AssetType = "stock"
	AssetIndex  AssetType = "index"
	AssetCrypto AssetType = "crypto"
	AssetForex  AssetType = "forex"
	AssetCommo  AssetType = "commodity"
)

// PricePoint represents a single OHLCV candle.
type PricePoint struct {
	Date   time.Time `json:"date"`
	Open   float64   `json:"open"`
	High   float64   `json:"high"`
	Low    float64   `json:"low"`
	Close  float64   `json:"close"`
	Volume int64     `json:"volume"`
}

// Quote represents a real-time or latest quote.
type Quote struct {
	Symbol        string    `json:"symbol"`
	Name          string    `json:"name"`
	Price         float64   `json:"price"`
	Change        float64   `json:"change"`
	ChangePercent float64   `json:"change_percent"`
	High          float64   `json:"high"`
	Low           float64   `json:"low"`
	Open          float64   `json:"open"`
	PrevClose     float64   `json:"prev_close"`
	Volume        int64     `json:"volume"`
	MarketCap     float64   `json:"market_cap,omitempty"`
	Currency      string    `json:"currency"`
	AssetType     AssetType `json:"asset_type"`
}

// TechnicalIndicators bundles all computed indicators.
type TechnicalIndicators struct {
	RSI14          float64        `json:"rsi_14"`
	MACDLine       float64        `json:"macd_line"`
	MACDSignal     float64        `json:"macd_signal"`
	MACDHistogram  float64        `json:"macd_histogram"`
	SMA20          float64        `json:"sma_20"`
	SMA50          float64        `json:"sma_50"`
	SMA200         float64        `json:"sma_200"`
	EMA12          float64        `json:"ema_12"`
	EMA26          float64        `json:"ema_26"`
	BBUpper        float64        `json:"bb_upper"`
	BBMiddle       float64        `json:"bb_middle"`
	BBLower        float64        `json:"bb_lower"`
	ATR14          float64        `json:"atr_14"`
	Volatility20   float64        `json:"volatility_20"`
	SupportLevels  []float64      `json:"support_levels"`
	ResistLevels   []float64      `json:"resistance_levels"`
	TrendStructure TrendStructure `json:"trend_structure"`
}

// TrendStructure describes the current market structure.
type TrendStructure struct {
	Primary    string `json:"primary"`  // "bullish", "bearish", "neutral"
	Strength   string `json:"strength"` // "strong", "moderate", "weak"
	Phase      string `json:"phase"`    // "uptrend", "downtrend", "consolidation", "breakout"
	Above200MA bool   `json:"above_200ma"`
	Above50MA  bool   `json:"above_50ma"`
	HigherHigh bool   `json:"higher_high"`
	HigherLow  bool   `json:"higher_low"`
}

// MarketData bundles everything for a symbol.
type MarketData struct {
	Quote      Quote               `json:"quote"`
	Historical []PricePoint        `json:"historical"`
	Indicators TechnicalIndicators `json:"indicators"`
	FetchedAt  time.Time           `json:"fetched_at"`
}

// ============================================================================
// CLIENT
// ============================================================================

// Client fetches market data from Yahoo Finance (unofficial API).
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient creates a new market data client.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 60 * time.Second},
		baseURL:    "https://query1.finance.yahoo.com",
	}
}

// ============================================================================
// QUOTE FETCHING
// ============================================================================

// FetchQuote retrieves the latest quote for a symbol.
func (c *Client) FetchQuote(symbol string) (Quote, error) {
	symbol = normalizeSymbol(symbol)

	// Use Yahoo Finance v8 chart endpoint for a quick 1d quote
	url := fmt.Sprintf("%s/v8/finance/chart/%s?range=1d&interval=1d", c.baseURL, symbol)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return Quote{}, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return Quote{}, fmt.Errorf("fetch quote: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Quote{}, fmt.Errorf("yahoo finance returned status %d for %s", resp.StatusCode, symbol)
	}

	var result yahooChartResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return Quote{}, fmt.Errorf("decode response: %w", err)
	}

	if len(result.Chart.Result) == 0 {
		return Quote{}, fmt.Errorf("empty result for %s", symbol)
	}
	meta := result.Chart.Result[0].Meta
	q := Quote{
		Symbol:    symbol,
		Name:      meta.Symbol,
		Price:     meta.RegularMarketPrice,
		High:      meta.RegularMarketDayHigh,
		Low:       meta.RegularMarketDayLow,
		Open:      meta.RegularMarketDayOpen,
		PrevClose: meta.PrevClose,
		Volume:    meta.RegularMarketVolume,
		Currency:  meta.Currency,
	}
	if meta.PrevClose > 0 {
		q.Change = round(meta.RegularMarketPrice-meta.PrevClose, 2)
		q.ChangePercent = round((meta.RegularMarketPrice-meta.PrevClose)/meta.PrevClose*100, 2)
	}

	q.AssetType = classifyAsset(symbol)
	return q, nil
}

// ============================================================================
// HISTORICAL DATA
// ============================================================================

// FetchHistorical retrieves OHLCV data for a given period.
// period examples: "1mo", "3mo", "6mo", "1y", "2y", "5y"
func (c *Client) FetchHistorical(symbol, period, interval string) ([]PricePoint, error) {
	symbol = normalizeSymbol(symbol)

	url := fmt.Sprintf("%s/v8/finance/chart/%s?range=%s&interval=%s",
		c.baseURL, symbol, period, interval)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch historical: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yahoo finance returned status %d", resp.StatusCode)
	}

	var result yahooChartResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if len(result.Chart.Result) == 0 {
		return nil, fmt.Errorf("no data for symbol %s", symbol)
	}

	timestamps := result.Chart.Result[0].Timestamp
	quotes := result.Chart.Result[0].Indicators.Quote[0]

	points := make([]PricePoint, 0, len(timestamps))
	for i, ts := range timestamps {
		if i >= len(quotes.Open) || quotes.Open[i] == nil {
			continue
		}
		pp := PricePoint{
			Date:   time.Unix(ts, 0),
			Open:   round(*quotes.Open[i], 4),
			High:   round(*quotes.High[i], 4),
			Low:    round(*quotes.Low[i], 4),
			Close:  round(*quotes.Close[i], 4),
			Volume: 0,
		}
		if i < len(quotes.Volume) && quotes.Volume[i] != nil {
			pp.Volume = *quotes.Volume[i]
		}
		points = append(points, pp)
	}

	return points, nil
}

// ============================================================================
// FULL MARKET DATA (QUOTE + HISTORICAL + INDICATORS)
// ============================================================================

// FetchFullData retrieves a complete market data snapshot.
// It returns partial data even when some fetches fail — the caller should
// check for empty fields rather than treating errors as fatal.
func (c *Client) FetchFullData(symbol string) (*MarketData, error) {
	type result struct {
		quote      Quote
		historical []PricePoint
		err        error
	}

	qChan := make(chan result, 1)
	hChan := make(chan result, 1)

	go func() {
		q, err := c.FetchQuote(symbol)
		qChan <- result{quote: q, err: err}
	}()

	go func() {
		h, err := c.FetchHistorical(symbol, "1y", "1d")
		hChan <- result{historical: h, err: err}
	}()

	qRes := <-qChan
	hRes := <-hChan

	// Log errors but don't fail — return whatever we got
	var errs []string
	if qRes.err != nil {
		errs = append(errs, "quote: "+qRes.err.Error())
	}
	if hRes.err != nil {
		errs = append(errs, "historical: "+hRes.err.Error())
	}

	// If both failed, return a minimal MarketData with just the symbol
	if qRes.err != nil && hRes.err != nil {
		return &MarketData{
			Quote: Quote{
				Symbol:    symbol,
				Name:      symbol,
				Currency:  "USD",
				AssetType: classifyAsset(symbol),
			},
			Historical: nil,
			Indicators: TechnicalIndicators{},
			FetchedAt:  time.Now(),
		}, fmt.Errorf("all data fetches failed: %s", strings.Join(errs, "; "))
	}

	// Use whatever data we have
	quote := qRes.quote
	historical := hRes.historical
	if quote.Symbol == "" {
		quote = Quote{Symbol: symbol, Name: symbol, Currency: "USD", AssetType: classifyAsset(symbol)}
	}

	indicators := ComputeIndicators(historical)

	var finalErr error
	if len(errs) > 0 {
		finalErr = fmt.Errorf("partial data: %s", strings.Join(errs, "; "))
	}

	return &MarketData{
		Quote:      quote,
		Historical: historical,
		Indicators: indicators,
		FetchedAt:  time.Now(),
	}, finalErr
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

// ComputeIndicators calculates all technical indicators from historical data.
func ComputeIndicators(points []PricePoint) TechnicalIndicators {
	if len(points) < 200 {
		// Not enough data — return zero values
		return TechnicalIndicators{}
	}

	closes := make([]float64, len(points))
	highs := make([]float64, len(points))
	lows := make([]float64, len(points))
	for i, p := range points {
		closes[i] = p.Close
		highs[i] = p.High
		lows[i] = p.Low
	}

	lastClose := closes[len(closes)-1]

	ti := TechnicalIndicators{
		RSI14:         computeRSI(closes, 14),
		SMA20:         computeSMA(closes, 20),
		SMA50:         computeSMA(closes, 50),
		SMA200:        computeSMA(closes, 200),
		EMA12:         computeEMA(closes, 12),
		EMA26:         computeEMA(closes, 26),
		ATR14:         computeATR(highs, lows, closes, 14),
		Volatility20:  computeVolatility(closes, 20),
		SupportLevels: findSupportLevels(closes),
		ResistLevels:  findResistanceLevels(closes),
	}

	// MACD
	ti.MACDLine, ti.MACDSignal, ti.MACDHistogram = computeMACD(closes)

	// Bollinger Bands
	ti.BBMiddle = ti.SMA20
	stdDev := computeStdDev(closes, 20)
	ti.BBUpper = ti.BBMiddle + 2*stdDev
	ti.BBLower = ti.BBMiddle - 2*stdDev

	// Trend structure
	ti.TrendStructure = analyzeTrendStructure(closes, ti, lastClose)

	return ti
}

// ============================================================================
// INDICATOR CALCULATIONS
// ============================================================================

func computeRSI(closes []float64, period int) float64 {
	if len(closes) < period+1 {
		return 0
	}

	var avgGain, avgLoss float64
	// Initial average
	for i := len(closes) - period; i < len(closes); i++ {
		change := closes[i] - closes[i-1]
		if change > 0 {
			avgGain += change
		} else {
			avgLoss += -change
		}
	}
	avgGain /= float64(period)
	avgLoss /= float64(period)

	if avgLoss == 0 {
		return 100
	}

	rs := avgGain / avgLoss
	rsi := 100 - (100 / (1 + rs))
	return round(rsi, 1)
}

func computeSMA(closes []float64, period int) float64 {
	if len(closes) < period {
		return 0
	}
	sum := 0.0
	for i := len(closes) - period; i < len(closes); i++ {
		sum += closes[i]
	}
	return round(sum/float64(period), 2)
}

func computeEMA(closes []float64, period int) float64 {
	if len(closes) < period {
		return 0
	}
	multiplier := 2.0 / float64(period+1)

	// Start with SMA
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += closes[i]
	}
	ema := sum / float64(period)

	// Apply EMA formula
	for i := period; i < len(closes); i++ {
		ema = (closes[i]-ema)*multiplier + ema
	}
	return round(ema, 2)
}

func computeMACD(closes []float64) (line, signal, histogram float64) {
	if len(closes) < 26+9 {
		return 0, 0, 0
	}
	ema12 := computeEMAFull(closes, 12)
	ema26 := computeEMAFull(closes, 26)

	// Build MACD line series
	macdLine := make([]float64, len(closes))
	for i := range closes {
		macdLine[i] = ema12[i] - ema26[i]
	}

	// Signal line = 9-period EMA of MACD line
	signalLine := computeEMASeries(macdLine, 9)

	line = round(macdLine[len(macdLine)-1], 4)
	signal = round(signalLine[len(signalLine)-1], 4)
	histogram = round(line-signal, 4)
	return
}

func computeEMAFull(closes []float64, period int) []float64 {
	ema := make([]float64, len(closes))
	if len(closes) < period {
		return ema
	}
	multiplier := 2.0 / float64(period+1)

	// Initial SMA
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += closes[i]
	}
	ema[period-1] = sum / float64(period)

	for i := period; i < len(closes); i++ {
		ema[i] = (closes[i]-ema[i-1])*multiplier + ema[i-1]
	}
	return ema
}

func computeEMASeries(series []float64, period int) []float64 {
	result := make([]float64, len(series))
	if len(series) < period {
		return result
	}
	multiplier := 2.0 / float64(period+1)

	sum := 0.0
	for i := 0; i < period; i++ {
		sum += series[i]
	}
	result[period-1] = sum / float64(period)

	for i := period; i < len(series); i++ {
		result[i] = (series[i]-result[i-1])*multiplier + result[i-1]
	}
	return result
}

func computeATR(highs, lows, closes []float64, period int) float64 {
	if len(closes) < period+1 {
		return 0
	}
	trValues := make([]float64, 0, len(closes)-1)
	for i := 1; i < len(closes); i++ {
		tr := math.Max(highs[i]-lows[i], math.Abs(highs[i]-closes[i-1]))
		tr = math.Max(tr, math.Abs(lows[i]-closes[i-1]))
		trValues = append(trValues, tr)
	}

	// First ATR = simple average
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += trValues[len(trValues)-period+i]
	}
	atr := sum / float64(period)
	return round(atr, 2)
}

func computeVolatility(closes []float64, period int) float64 {
	if len(closes) < period {
		return 0
	}
	returns := make([]float64, 0, period-1)
	start := len(closes) - period
	for i := start; i < len(closes)-1; i++ {
		if closes[i] != 0 {
			r := (closes[i+1] - closes[i]) / closes[i]
			returns = append(returns, r)
		}
	}
	stdDev := computeStdDevSeries(returns)
	return round(stdDev*100, 2) // Annualized daily vol approximation
}

func computeStdDev(closes []float64, period int) float64 {
	if len(closes) < period {
		return 0
	}
	subset := closes[len(closes)-period:]
	return computeStdDevSeries(subset)
}

func computeStdDevSeries(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	mean := 0.0
	for _, v := range values {
		mean += v
	}
	mean /= float64(len(values))

	variance := 0.0
	for _, v := range values {
		diff := v - mean
		variance += diff * diff
	}
	variance /= float64(len(values))
	return math.Sqrt(variance)
}

// ============================================================================
// SUPPORT / RESISTANCE
// ============================================================================

func findSupportLevels(closes []float64) []float64 {
	return findPivotLevels(closes, true)
}

func findResistanceLevels(closes []float64) []float64 {
	return findPivotLevels(closes, false)
}

func findPivotLevels(closes []float64, isSupport bool) []float64 {
	if len(closes) < 20 {
		return nil
	}

	window := 5
	levels := make(map[float64]int)
	subset := closes[len(closes)-60:] // Look at last 60 candles

	for i := window; i < len(subset)-window; i++ {
		pivot := true
		for j := i - window; j <= i+window; j++ {
			if j == i {
				continue
			}
			if isSupport && subset[j] < subset[i] {
				pivot = false
				break
			}
			if !isSupport && subset[j] > subset[i] {
				pivot = false
				break
			}
		}
		if pivot {
			// Round to nearest significant level
			level := roundToSignificant(subset[i])
			levels[level]++
		}
	}

	// Sort by frequency and return top 3
	type levelCount struct {
		level float64
		count int
	}
	var sorted []levelCount
	for l, c := range levels {
		sorted = append(sorted, levelCount{l, c})
	}
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].count > sorted[j].count
	})

	result := make([]float64, 0, 3)
	for i := 0; i < len(sorted) && i < 3; i++ {
		result = append(result, sorted[i].level)
	}
	sort.Float64s(result)
	if !isSupport {
		// Resistance: sort descending
		sort.Sort(sort.Reverse(sort.Float64Slice(result)))
	}
	return result
}

func roundToSignificant(price float64) float64 {
	if price > 1000 {
		return math.Round(price/10) * 10
	}
	if price > 100 {
		return math.Round(price/5) * 5
	}
	if price > 10 {
		return math.Round(price*2) / 2
	}
	return math.Round(price*20) / 20
}

// ============================================================================
// TREND STRUCTURE
// ============================================================================

func analyzeTrendStructure(closes []float64, ti TechnicalIndicators, lastClose float64) TrendStructure {
	ts := TrendStructure{
		Above200MA: lastClose > ti.SMA200 && ti.SMA200 > 0,
		Above50MA:  lastClose > ti.SMA50 && ti.SMA50 > 0,
	}

	// Detect higher highs / higher lows on swing points
	swingHighs, swingLows := findSwings(closes, 10)

	hh := true
	for i := 1; i < len(swingHighs) && i < 4; i++ {
		if swingHighs[i] <= swingHighs[i-1] {
			hh = false
			break
		}
	}

	hl := true
	for i := 1; i < len(swingLows) && i < 4; i++ {
		if swingLows[i] <= swingLows[i-1] {
			hl = false
			break
		}
	}

	ts.HigherHigh = hh
	ts.HigherLow = hl

	// Primary trend
	if ts.Above200MA && ts.HigherLow {
		ts.Primary = "bullish"
		if ts.HigherHigh {
			ts.Phase = "uptrend"
		} else {
			ts.Phase = "consolidation"
		}
	} else if !ts.Above200MA && !ts.HigherLow {
		ts.Primary = "bearish"
		if !ts.HigherHigh {
			ts.Phase = "downtrend"
		} else {
			ts.Phase = "consolidation"
		}
	} else {
		ts.Primary = "neutral"
		ts.Phase = "consolidation"
	}

	// Detect breakout
	if ts.Above200MA && ti.RSI14 > 65 && lastClose > ti.BBUpper {
		ts.Phase = "breakout"
		ts.Primary = "bullish"
	} else if !ts.Above200MA && ti.RSI14 < 35 && lastClose < ti.BBLower {
		ts.Phase = "breakout"
		ts.Primary = "bearish"
	}

	// Strength
	if ti.RSI14 > 70 || ti.RSI14 < 30 {
		ts.Strength = "strong"
	} else if ti.RSI14 > 55 || ti.RSI14 < 45 {
		ts.Strength = "moderate"
	} else {
		ts.Strength = "weak"
	}

	return ts
}

func findSwings(closes []float64, window int) (highs, lows []float64) {
	if len(closes) < 2*window+1 {
		return closes, closes
	}
	for i := window; i < len(closes)-window; i++ {
		isHigh := true
		isLow := true
		for j := i - window; j <= i+window; j++ {
			if j == i {
				continue
			}
			if closes[j] >= closes[i] {
				isHigh = false
			}
			if closes[j] <= closes[i] {
				isLow = false
			}
		}
		if isHigh {
			highs = append(highs, closes[i])
		}
		if isLow {
			lows = append(lows, closes[i])
		}
	}
	return
}

// ============================================================================
// YAHOO FINANCE JSON STRUCTURES
// ============================================================================

type yahooChartResponse struct {
	Chart struct {
		Result []struct {
			Meta       yahooMeta       `json:"meta"`
			Timestamp  []int64         `json:"timestamp"`
			Indicators yahooIndicators `json:"indicators"`
		} `json:"result"`
		Error interface{} `json:"error"`
	} `json:"chart"`
}

type yahooMeta struct {
	Symbol               string  `json:"symbol"`
	Currency             string  `json:"currency"`
	RegularMarketPrice   float64 `json:"regularMarketPrice"`
	PrevClose            float64 `json:"chartPreviousClose"`
	RegularMarketDayHigh float64 `json:"regularMarketDayHigh"`
	RegularMarketDayLow  float64 `json:"regularMarketDayLow"`
	RegularMarketDayOpen float64 `json:"regularMarketDayOpen"`
	RegularMarketVolume  int64   `json:"regularMarketVolume"`
}

type yahooIndicators struct {
	Quote []struct {
		Open   []*float64 `json:"open"`
		High   []*float64 `json:"high"`
		Low    []*float64 `json:"low"`
		Close  []*float64 `json:"close"`
		Volume []*int64   `json:"volume"`
	} `json:"quote"`
}

// ============================================================================
// HELPERS
// ============================================================================

func round(v float64, decimals int) float64 {
	if math.IsInf(v, 0) || math.IsNaN(v) {
		return 0
	}
	pow := math.Pow(10, float64(decimals))
	return math.Round(v*pow) / pow
}

func normalizeSymbol(symbol string) string {
	symbol = strings.TrimSpace(strings.ToUpper(symbol))
	// Convert common crypto suffix patterns for Yahoo Finance
	if strings.HasSuffix(symbol, "-USD") {
		symbol = strings.TrimSuffix(symbol, "-USD") + "-USD"
	}
	return symbol
}

func classifyAsset(symbol string) AssetType {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))

	// Major indices
	indices := map[string]bool{
		"^GSPC": true, "^SPX": true, "SPY": true,
		"^IXIC": true, "^NDX": true, "QQQ": true,
		"^DJI": true, "DIA": true,
		"^FTSE": true, "^N225": true, "^HSI": true,
		"^FCHI": true, "^GDAXI": true,
	}
	if indices[symbol] {
		return AssetIndex
	}

	// Crypto
	if strings.HasSuffix(symbol, "-USD") || strings.HasSuffix(symbol, "USD") {
		if _, err := strconv.Atoi(symbol[:1]); err == nil {
			return AssetCrypto
		}
	}
	cryptoSymbols := map[string]bool{
		"BTC": true, "ETH": true, "SOL": true, "XRP": true,
		"ADA": true, "DOGE": true, "DOT": true,
	}
	if cryptoSymbols[symbol] {
		return AssetCrypto
	}

	// Forex
	if strings.Contains(symbol, "=X") || len(symbol) == 6 && strings.Count(symbol, "") == 7 {
		return AssetForex
	}

	// Commodities (ETFs / futures)
	commodities := map[string]bool{
		"GC=F": true, "CL=F": true, "SI=F": true, "NG=F": true,
		"GLD": true, "SLV": true, "USO": true, "UNG": true,
		"XAU": true, "XAG": true,
	}
	if commodities[symbol] {
		return AssetCommo
	}

	return AssetStock
}

// ============================================================================
// SEARCH / AUTOCOMPLETE
// ============================================================================

// SearchResult is a simple symbol search result.
type SearchResult struct {
	Symbol    string `json:"symbol"`
	Name      string `json:"name"`
	Exchange  string `json:"exchange"`
	AssetType string `json:"asset_type"`
}

// SearchSymbols looks up symbols matching a query.
func (c *Client) SearchSymbols(query string) ([]SearchResult, error) {
	url := fmt.Sprintf(
		"https://query1.finance.yahoo.com/v1/finance/search?q=%s&quotesCount=8&newsCount=0",
		query,
	)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result yahooSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	var results []SearchResult
	for _, q := range result.Quotes {
		results = append(results, SearchResult{
			Symbol:    q.Symbol,
			Name:      q.Shortname,
			Exchange:  q.Exchange,
			AssetType: string(classifyAsset(q.Symbol)),
		})
	}
	return results, nil
}

type yahooSearchResponse struct {
	Quotes []struct {
		Symbol    string `json:"symbol"`
		Shortname string `json:"shortname"`
		Exchange  string `json:"exchange"`
	} `json:"quotes"`
}
