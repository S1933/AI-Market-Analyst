"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  X,
  Loader2,
  TrendingUp,
  Coins,
  Building2,
  Globe,
} from "lucide-react";
import { searchSymbols } from "@/lib/api";
import type { SearchResult } from "@/lib/types";

interface SearchBarProps {
  onSelect: (symbol: string, name: string) => void;
  isLoading?: boolean;
}

export default function SearchBar({
  onSelect,
  isLoading = false,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const debouncedSearch = useCallback((searchQuery: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchQuery.length < 1) {
      setResults([]);
      setIsOpen(false);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const data = await searchSymbols(searchQuery);
        setResults(data.results || []);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        setError("Search unavailable");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    debouncedSearch(query);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, debouncedSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        } else if (results.length > 0) {
          handleSelect(results[0]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    setQuery(result.symbol);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect(result.symbol, result.name || result.symbol);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  const getAssetIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case "crypto":
        return <Coins size={14} className="text-orange-400" />;
      case "index":
        return <TrendingUp size={14} className="text-blue-400" />;
      case "commodity":
        return <Globe size={14} className="text-yellow-400" />;
      default:
        return <Building2 size={14} className="text-slate-400" />;
    }
  };

  const getAssetBadge = (type: string) => {
    const base =
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider";
    switch (type?.toLowerCase()) {
      case "crypto":
        return (
          <span
            className={`${base} bg-orange-500/10 text-orange-400 border border-orange-500/20`}
          >
            Crypto
          </span>
        );
      case "index":
        return (
          <span
            className={`${base} bg-blue-500/10 text-blue-400 border border-blue-500/20`}
          >
            Index
          </span>
        );
      case "commodity":
        return (
          <span
            className={`${base} bg-yellow-500/10 text-yellow-400 border border-yellow-500/20`}
          >
            Commo
          </span>
        );
      case "forex":
        return (
          <span
            className={`${base} bg-purple-500/10 text-purple-400 border border-purple-500/20`}
          >
            Forex
          </span>
        );
      default:
        return (
          <span
            className={`${base} bg-slate-500/10 text-slate-400 border border-slate-500/20`}
          >
            Stock
          </span>
        );
    }
  };

  // Popular tickers for empty state
  const popularTickers = [
    { symbol: "AAPL", name: "Apple Inc." },
    { symbol: "NVDA", name: "NVIDIA Corp." },
    { symbol: "SPY", name: "S&P 500 ETF" },
    { symbol: "BTC-USD", name: "Bitcoin USD" },
    { symbol: "GC=F", name: "Gold Futures" },
    { symbol: "MSFT", name: "Microsoft Corp." },
  ];

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Search input */}
      <div className="relative group">
        {/* Glow effect on focus */}
        <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur" />

        <div className="relative flex items-center bg-[#11141b] border border-[#1e293b] rounded-xl transition-all duration-200 focus-within:border-blue-500/40 focus-within:shadow-[0_0_20px_rgba(59,130,246,0.08)]">
          {/* Search icon */}
          <div className="pl-4 pr-2 flex items-center">
            {isSearching || isLoading ? (
              <Loader2 size={18} className="text-blue-400 animate-spin" />
            ) : (
              <Search size={18} className="text-slate-500" />
            )}
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0 || query.length === 0) setIsOpen(true);
            }}
            placeholder="Search ticker...  e.g. AAPL, BTC-USD, SPY"
            className="flex-1 bg-transparent border-none outline-none py-3.5 text-sm font-medium text-[#f1f5f9] placeholder:text-[#475569] font-mono tracking-wide"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search financial instrument"
            aria-autocomplete="list"
            role="combobox"
            aria-expanded={isOpen}
          />

          {/* Clear button */}
          {query && (
            <button
              onClick={handleClear}
              className="mr-3 p-1 rounded-md hover:bg-[#1e2432] text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="mr-4 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[11px] text-slate-500 font-medium">
                Analyzing...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 w-full bg-[#161b24] border border-[#1e293b] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 backdrop-blur-xl"
        >
          {/* Popular tickers (when query is empty) */}
          {query.length === 0 && (
            <div className="p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
                Popular Tickers
              </p>
              <div className="flex flex-wrap gap-1.5">
                {popularTickers.map((ticker) => (
                  <button
                    key={ticker.symbol}
                    onClick={() => {
                      setQuery(ticker.symbol);
                      onSelect(ticker.symbol, ticker.name);
                      setIsOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-slate-300 bg-[#1a1f2b] hover:bg-[#1e2432] hover:text-white border border-[#1e293b] hover:border-[#273040] transition-all"
                  >
                    {ticker.symbol}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-4 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <p className="text-xs text-slate-600 mt-1">
                Try again or enter a valid ticker symbol.
              </p>
            </div>
          )}

          {/* No results */}
          {!isSearching &&
            !error &&
            query.length > 0 &&
            results.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-sm text-slate-400">
                  No results found for &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Check the ticker symbol or try a different search.
                </p>
              </div>
            )}

          {/* Results list */}
          {results.length > 0 && (
            <div className="max-h-72 overflow-y-auto no-scrollbar">
              {/* Header */}
              <div className="px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-[#1e293b]">
                Results ({results.length})
              </div>

              {results.map((result, index) => (
                <button
                  key={`${result.symbol}-${index}`}
                  onClick={() => handleSelect(result)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-[#1e293b]/50 last:border-b-0 ${
                    index === selectedIndex
                      ? "bg-blue-500/10 border-l-2 border-l-blue-500"
                      : "hover:bg-[#1a1f2b] border-l-2 border-l-transparent"
                  }`}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg bg-[#1a1f2b] border border-[#1e293b] flex items-center justify-center flex-shrink-0">
                    {getAssetIcon(result.asset_type || result.type || "stock")}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#f1f5f9] font-mono tracking-wide">
                        {result.symbol}
                      </span>
                      {getAssetBadge(
                        result.asset_type || result.type || "stock",
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {result.name || result.symbol}
                      {result.exchange && (
                        <span className="text-slate-600 ml-1">
                          · {result.exchange}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Enter hint */}
                  <span className="text-[10px] text-slate-600 bg-[#1a1f2b] px-1.5 py-0.5 rounded border border-[#1e293b]">
                    ↵
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[#1e293b] flex items-center justify-between text-[10px] text-slate-600">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      )}

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
