package news

import (
	"context"
	"strings"
)

// Provider fetches news articles from a specific source.
// Each provider is independently configured via its own env vars.
type Provider interface {
	Name() string
	IsConfigured() bool
	Fetch(ctx context.Context, symbol string) ([]Article, error)
}

// mergeArticles combines results from multiple providers, removes duplicates
// (by title similarity), sorts by recency, and caps at maxArticles.
func mergeArticles(providerResults [][]Article, maxArticles int) []Article {
	seen := make(map[string]bool)
	var merged []Article

	for _, articles := range providerResults {
		for _, a := range articles {
			key := dedupKey(a.Title)
			if seen[key] {
				continue
			}
			seen[key] = true
			merged = append(merged, a)
		}
	}

	// Sort by published date (newest first)
	for i := 0; i < len(merged); i++ {
		for j := i + 1; j < len(merged); j++ {
			if merged[j].Published.After(merged[i].Published) {
				merged[i], merged[j] = merged[j], merged[i]
			}
		}
	}

	if len(merged) > maxArticles {
		merged = merged[:maxArticles]
	}

	return merged
}

// dedupKey normalizes a title for deduplication.
func dedupKey(title string) string {
	s := strings.ToLower(title)
	s = strings.TrimSpace(s)
	// Remove common suffix variations
	s = strings.TrimSuffix(s, " - reuters")
	s = strings.TrimSuffix(s, " | reuters")
	return s
}
