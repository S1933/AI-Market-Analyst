// API client library for the Hermes Agent backend.
// All requests are typed end-to-end using the shared types defined in types.ts.

import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalysisProgress,
  Quote,
  PricePoint,
  TechnicalIndicators,
  MarketData,
  SearchResult,
  ErrorResponse,
  AssetCategory,
} from "./types";

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const API_VERSION = "v1";

function apiUrl(path: string): string {
  return `${API_BASE}/api/${API_VERSION}${path}`;
}

// ─────────────────────────────────────────────────────────────
// GENERIC FETCH WRAPPER
// ─────────────────────────────────────────────────────────────

class ApiError extends Error {
  public code: string;
  public details: string;
  public status: number;

  constructor(status: number, code: string, details: string) {
    super(`${code}: ${details}`);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 180s timeout (aligns with backend)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let errorBody: ErrorResponse | null = null;
      try {
        errorBody = await res.json();
      } catch {
        // Response is not JSON — use status text
      }
      throw new ApiError(
        res.status,
        errorBody?.code || "unknown_error",
        errorBody?.details || res.statusText || "Request failed",
      );
    }

    // Handle empty responses (204 No Content, etc.)
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return {} as T;
    }

    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(408, "timeout", "Request timed out after 180 seconds");
    }
    throw new ApiError(
      0,
      "network_error",
      err instanceof Error ? err.message : "Unknown error",
    );
  }
}

// ─────────────────────────────────────────────────────────────
// ANALYSIS ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * Run a complete multi-agent analysis on the given symbol.
 * This calls all 4 agents (Market, News, Risk, Strategy).
 */
export async function analyze(
  params: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>(apiUrl("/analyze"), {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Stream the analysis progress via Server-Sent Events.
 * Returns an object with an `abort` method to cancel the stream.
 */
export function analyzeStream(
  symbol: string,
  onProgress: (progress: AnalysisProgress) => void,
  onComplete: (result: AnalyzeResponse) => void,
  onError: (error: Error) => void,
): { abort: () => void } {
  const controller = new AbortController();
  const url = apiUrl(`/analyze/${symbol}/stream`);

  const startStreaming = async () => {
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (!res.ok) {
        throw new ApiError(
          res.status,
          "stream_error",
          `HTTP ${res.status}: ${res.statusText}`,
        );
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("Stream not supported by this browser");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events — each event is `data: {...}\n\n`
        const lines = buffer.split("\n\n");
        // The last element may be incomplete — keep it in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6); // Remove 'data: ' prefix
          try {
            const event = JSON.parse(jsonStr);

            if (event.progress) {
              onProgress(event.progress as AnalysisProgress);
            }
            if (event.data) {
              // Final response received
              onComplete(event.data as AnalyzeResponse);
            }
          } catch {
            // Skip malformed events
            console.warn("Failed to parse SSE event:", jsonStr);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      onError(err instanceof Error ? err : new Error("Stream failed"));
    }
  };

  startStreaming();

  return { abort: () => controller.abort() };
}

// ─────────────────────────────────────────────────────────────
// MARKET DATA ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * Get a real-time quote for a symbol.
 */
export async function getQuote(symbol: string): Promise<Quote> {
  return request<Quote>(apiUrl(`/quote/${encodeURIComponent(symbol)}`));
}

/**
 * Get historical price data.
 */
export async function getHistorical(
  symbol: string,
  period: string = "6mo",
  interval: string = "1d",
): Promise<{ symbol: string; historical: PricePoint[]; count: number }> {
  return request(
    apiUrl(
      `/historical/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}`,
    ),
  );
}

/**
 * Get computed technical indicators for a symbol.
 */
export async function getIndicators(symbol: string): Promise<{
  symbol: string;
  indicators: TechnicalIndicators;
}> {
  return request(apiUrl(`/indicators/${encodeURIComponent(symbol)}`));
}

/**
 * Get full market data (quote + historical + indicators).
 */
export async function getFullMarketData(symbol: string): Promise<MarketData> {
  // This is assembled from multiple endpoints for flexibility
  const [quote, historical, indicators] = await Promise.all([
    getQuote(symbol),
    getHistorical(symbol),
    getIndicators(symbol),
  ]);

  return {
    symbol,
    quote,
    historical_prices: historical.historical,
    technical: indicators.indicators,
    fetched_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────

/**
 * Search for symbols matching a query string.
 */
export async function searchSymbols(query: string): Promise<{
  query: string;
  results: SearchResult[];
  count: number;
}> {
  return request(apiUrl(`/search?q=${encodeURIComponent(query)}`));
}

// ─────────────────────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────────────────────

/**
 * Clear all cached analyses on the server.
 */
export async function clearCache(): Promise<{ message: string }> {
  return request(apiUrl("/cache"), { method: "DELETE" });
}

/**
 * Clear cached analysis for a specific symbol.
 */
export async function clearSymbolCache(
  symbol: string,
): Promise<{ message: string }> {
  return request(apiUrl(`/cache/${encodeURIComponent(symbol)}`), {
    method: "DELETE",
  });
}

/**
 * Get cache statistics.
 */
export async function getCacheStats(): Promise<{ size: number }> {
  return request(apiUrl("/cache/stats"));
}

// ─────────────────────────────────────────────────────────────
// UTILITY HOOKS (for use with React Query or similar)
// ─────────────────────────────────────────────────────────────

/**
 * Build a query key for React Query / SWR cache invalidation.
 */
export function queryKeys() {
  return {
    analysis: (symbol: string) => ["analysis", symbol] as const,
    quote: (symbol: string) => ["quote", symbol] as const,
    historical: (symbol: string, period: string, interval: string) =>
      ["historical", symbol, period, interval] as const,
    search: (query: string) => ["search", query] as const,
    cacheStats: () => ["cacheStats"] as const,
  };
}

// ─────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────

export { ApiError };
