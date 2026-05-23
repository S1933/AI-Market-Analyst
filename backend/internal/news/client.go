package news

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"
)

// Article represents a single news article fetched from a provider.
type Article struct {
	Title     string    `json:"title"`
	Source    string    `json:"source"`
	URL       string    `json:"url"`
	Published time.Time `json:"published"`
	Summary   string    `json:"summary"`
	Sentiment string    `json:"sentiment,omitempty"`
}

// Client orchestrates multiple news providers.
// It tries all configured providers in parallel, merges results,
// deduplicates, and filters by symbol relevance.
type Client struct {
	providers []Provider
}

// NewClient creates a news client with all available providers.
// Each provider is independently configured via its own env var:
//
//	FINNHUB_API_KEY  → Finnhub (general market news)
//	NEWSAPI_API_KEY  → NewsAPI.org (symbol-specific search, French)
func NewClient() *Client {
	return &Client{
		providers: []Provider{
			NewFinnhubProvider(),
			NewNewsAPIProvider(),
		},
	}
}

// IsConfigured returns true if at least one provider is ready.
func (c *Client) IsConfigured() bool {
	for _, p := range c.providers {
		if p.IsConfigured() {
			return true
		}
	}
	return false
}

// FetchNews retrieves real news articles for the given symbol from all
// configured providers. Results are merged, deduplicated, filtered for
// relevance, and capped at 8 articles.
// Returns nil, nil when no provider is configured.
func (c *Client) FetchNews(ctx context.Context, symbol string) ([]Article, error) {
	// Collect results from all configured providers in parallel
	type result struct {
		articles []Article
		err      error
		name     string
	}

	var results []result
	for _, p := range c.providers {
		if !p.IsConfigured() {
			continue
		}
		r := result{name: p.Name()}
		r.articles, r.err = p.Fetch(ctx, symbol)
		results = append(results, r)
	}

	if len(results) == 0 {
		return nil, nil
	}

	// Log errors but keep successful results
	var allArticles [][]Article
	for _, r := range results {
		if r.err != nil {
			log.Printf("[WARN] news: provider %s failed: %v", r.name, r.err)
			continue
		}
		allArticles = append(allArticles, r.articles)
	}

	if len(allArticles) == 0 {
		return nil, fmt.Errorf("all news providers failed")
	}

	merged := mergeArticles(allArticles, 16)

	filtered := filterBySymbol(merged, symbol)

	if len(filtered) > 8 {
		filtered = filtered[:8]
	}

	if len(filtered) == 0 {
		return nil, nil
	}

	return filtered, nil
}

// filterBySymbol keeps articles whose title or summary mentions the symbol.
func filterBySymbol(articles []Article, symbol string) []Article {
	symbol = strings.ToUpper(symbol)
	terms := []string{symbol}

	aliases := map[string][]string{
		"GC=F":  {"gold", "or", "gold futures", "métaux précieux"},
		"CL=F":  {"crude oil", "oil", "pétrole", "wti"},
		"SI=F":  {"silver", "argent"},
		"NG=F":  {"natural gas", "gaz naturel"},
		"BTC":   {"bitcoin", "crypto"},
		"ETH":   {"ethereum", "crypto"},
		"SPY":   {"s&p 500", "sp500", "wall street"},
		"QQQ":   {"nasdaq", "tech"},
		"IWM":   {"russell 2000", "small cap"},
		"EUR=X": {"euro", "eur/usd"},
		"JPY=X": {"yen", "usd/jpy"},
	}
	if extra, ok := aliases[symbol]; ok {
		terms = append(terms, extra...)
	}

	var filtered []Article
	for _, a := range articles {
		if matchesAny(a, terms) {
			filtered = append(filtered, a)
		}
	}
	return filtered
}

func matchesAny(a Article, terms []string) bool {
	title := strings.ToLower(a.Title)
	summary := strings.ToLower(a.Summary)
	for _, t := range terms {
		lt := strings.ToLower(t)
		if strings.Contains(title, lt) || strings.Contains(summary, lt) {
			return true
		}
	}
	return false
}
