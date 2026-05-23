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

// FinnhubProvider fetches market news from https://finnhub.io.
// Configure via FINNHUB_API_KEY env var.
type FinnhubProvider struct {
	httpClient *http.Client
	apiKey     string
}

func NewFinnhubProvider() *FinnhubProvider {
	return &FinnhubProvider{
		httpClient: &http.Client{Timeout: 15 * time.Second},
		apiKey:     os.Getenv("FINNHUB_API_KEY"),
	}
}

func (p *FinnhubProvider) Name() string       { return "finnhub" }
func (p *FinnhubProvider) IsConfigured() bool { return p.apiKey != "" }

func (p *FinnhubProvider) Fetch(ctx context.Context, symbol string) ([]Article, error) {
	u, _ := url.Parse("https://finnhub.io/api/v1/news")
	q := u.Query()
	q.Set("category", "general")
	q.Set("token", p.apiKey)
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("finnhub: create request: %w", err)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("finnhub: http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("finnhub: API returned %d", resp.StatusCode)
	}

	var raw []finnhubNewsItem
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("finnhub: decode response: %w", err)
	}

	articles := make([]Article, 0, len(raw))
	for _, item := range raw {
		articles = append(articles, Article{
			Title:     item.Headline,
			Source:    item.Source,
			URL:       item.URL,
			Published: time.Unix(item.Datetime, 0),
			Summary:   item.Summary,
		})
	}
	return articles, nil
}

type finnhubNewsItem struct {
	Headline string `json:"headline"`
	Source   string `json:"source"`
	URL      string `json:"url"`
	Summary  string `json:"summary"`
	Datetime int64  `json:"datetime"`
}
