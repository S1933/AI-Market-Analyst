package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// NewRouter creates and configures the main API router with all middleware and routes.
func NewRouter(h *Handler) http.Handler {
	r := chi.NewRouter()

	// ── Global Middleware ──────────────────────────
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(90 * time.Second))

	// CORS — allow frontend dev server
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"Link", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// ── Health ─────────────────────────────────────
	r.Get("/health", h.Health)

	// ── API v1 ─────────────────────────────────────
	r.Route("/api/v1", func(r chi.Router) {
		// Analysis — the main multi-agent pipeline
		r.Post("/analyze", h.Analyze)

		// Streaming analysis (SSE) — uses ?symbol= query param
		r.Get("/analyze/stream", h.AnalyzeStream)

		// Quick quote — uses ?symbol= query param
		r.Get("/quote", h.GetQuote)

		// Historical market data — uses ?symbol=&period=&interval=
		r.Get("/market-data", h.GetMarketData)

		// Symbol search / autocomplete — uses ?q= query param
		r.Get("/search", h.Search)

		// Cache management
		r.Get("/cache/stats", h.CacheStats)
		r.Delete("/cache", h.ClearCache)
	})

	return r
}
