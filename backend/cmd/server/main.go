// Package main is the entry point for the Hermes Agent backend server.
// It initialises all subsystems (market data, LLM client, agents, cache)
// and starts the HTTP API server.
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"github.com/hermes-agent/backend/internal/agents"
	"github.com/hermes-agent/backend/internal/api"
	"github.com/hermes-agent/backend/internal/cache"
	"github.com/hermes-agent/backend/internal/llm"
	"github.com/hermes-agent/backend/internal/market"
	"github.com/hermes-agent/backend/internal/news"
)

func main() {
	// ── Load .env file (ignore error if missing) ──────────────────
	_ = godotenv.Load()

	// ── Configuration ──────────────────────────────────────────────
	port := envOrDefault("PORT", "8080")
	env := envOrDefault("ENV", "development")
	cacheTTL := parseDuration(envOrDefault("CACHE_TTL", "15m"), 15*time.Minute)
	maxCacheSize := parseInt(envOrDefault("CACHE_MAX_SIZE", "200"), 200)

	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	log.Printf("[hermes-agent] starting server | env=%s | port=%s", env, port)

	// ── Initialise Subsystems ──────────────────────────────────────
	marketClient := market.NewClient()
	newsClient := news.NewClient()
	llmClient := llm.NewClient()
	analysisCache := cache.New(cacheTTL, maxCacheSize)

	// ── Initialise Orchestrator ────────────────────────────────────
	orch := agents.NewOrchestrator(llmClient, marketClient, newsClient)

	// ── Initialise API Handler ─────────────────────────────────────
	handler := api.NewHandler(marketClient, orch, analysisCache)

	// ── Build Router ───────────────────────────────────────────────
	r := chi.NewRouter()

	// Middleware
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(180 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://127.0.0.1:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"Link", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", handler.Health)

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		// Analysis endpoints
		r.Post("/analyze", handler.Analyze)
		r.Get("/analyze/stream", handler.AnalyzeStream)

		// Market data endpoints
		r.Get("/quote", handler.GetQuote)
		r.Get("/market-data", handler.GetMarketData)

		// Search
		r.Get("/search", handler.Search)

		// Cache management
		r.Delete("/cache", handler.ClearCache)
		r.Get("/cache/stats", handler.CacheStats)
	})

	// ── Start Server ───────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 180 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("[hermes-agent] listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit
	log.Println("[hermes-agent] shutting down gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("forced shutdown: %v", err)
	}

	log.Println("[hermes-agent] server stopped")
}

// ── Helpers ──────────────────────────────────────────────────────────

func envOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func parseDuration(s string, fallback time.Duration) time.Duration {
	if d, err := time.ParseDuration(s); err == nil {
		return d
	}
	return fallback
}

func parseInt(s string, fallback int) int {
	var v int
	if _, err := fmt.Sscanf(s, "%d", &v); err == nil {
		return v
	}
	return fallback
}
