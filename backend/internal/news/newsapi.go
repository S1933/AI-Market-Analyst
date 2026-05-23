package news

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"
)

// NewsAPIProvider fetches articles from https://newsapi.org.
// Configure via NEWSAPI_API_KEY env var.
type NewsAPIProvider struct {
	httpClient *http.Client
	apiKey     string
}

func NewNewsAPIProvider() *NewsAPIProvider {
	return &NewsAPIProvider{
		httpClient: &http.Client{Timeout: 15 * time.Second},
		apiKey:     os.Getenv("NEWSAPI_API_KEY"),
	}
}

func (p *NewsAPIProvider) Name() string       { return "newsapi" }
func (p *NewsAPIProvider) IsConfigured() bool { return p.apiKey != "" }

func (p *NewsAPIProvider) Fetch(ctx context.Context, symbol string) ([]Article, error) {
	// Build search query from symbol + aliases
	query := buildNewsAPIQuery(symbol)

	u, _ := url.Parse("https://newsapi.org/v2/everything")
	q := u.Query()
	q.Set("q", query)
	q.Set("language", "fr")
	q.Set("sortBy", "publishedAt")
	q.Set("pageSize", "10")
	q.Set("apiKey", p.apiKey)
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("newsapi: create request: %w", err)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("newsapi: http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("newsapi: API returned %d", resp.StatusCode)
	}

	var raw newsAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("newsapi: decode response: %w", err)
	}

	articles := make([]Article, 0, len(raw.Articles))
	for _, item := range raw.Articles {
		published, _ := time.Parse(time.RFC3339, item.PublishedAt)
		articles = append(articles, Article{
			Title:     item.Title,
			Source:    item.Source.Name,
			URL:       item.URL,
			Published: published,
			Summary:   item.Description,
		})
	}
	return articles, nil
}

// buildNewsAPIQuery builds a search query string from the symbol and aliases.
func buildNewsAPIQuery(symbol string) string {
	aliases := map[string]string{
		"GC=F":  "or OR gold OR (métaux précieux)",
		"CL=F":  "pétrole OR (brut OR crude oil)",
		"SI=F":  "argent OR silver",
		"NG=F":  "(gaz naturel) OR (natural gas)",
		"BTC":   "bitcoin OR crypto-monnaie",
		"ETH":   "ethereum OR crypto",
		"SPY":   "(s&p 500) OR wall street",
		"QQQ":   "nasdaq OR tech",
		"EUR=X": "euro OR (eur usd)",
	}
	if q, ok := aliases[symbol]; ok {
		return q
	}
	return symbol
}

type newsAPIResponse struct {
	Status   string `json:"status"`
	Articles []struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		URL         string `json:"url"`
		PublishedAt string `json:"publishedAt"`
		Source      struct {
			Name string `json:"name"`
		} `json:"source"`
	} `json:"articles"`
}
