"use client";

import React from "react";
import { AlertTriangle, RefreshCw, XCircle } from "lucide-react";

interface ErrorBannerProps {
  /** The symbol that was being analyzed when the error occurred */
  symbol?: string;
  /** The error message to display */
  message: string;
  /** Optional callback to retry the analysis */
  onRetry?: () => void;
  /** Optional callback to dismiss the error */
  onDismiss?: () => void;
  /** Whether a retry is in progress */
  retrying?: boolean;
  /** Visual variant */
  variant?: "error" | "warning" | "info";
}

const VARIANT_STYLES: Record<
  string,
  {
    container: string;
    border: string;
    icon: string;
    text: string;
    subtext: string;
    button: string;
    buttonHover: string;
  }
> = {
  error: {
    container: "bg-[rgba(239,68,68,0.06)]",
    border: "border-red-500/20",
    icon: "text-red-400",
    text: "text-red-400",
    subtext: "text-red-300/70",
    button: "bg-red-500/10 text-red-400 border-red-500/20",
    buttonHover: "hover:bg-red-500/20 hover:border-red-500/30",
  },
  warning: {
    container: "bg-[rgba(245,158,11,0.06)]",
    border: "border-yellow-500/20",
    icon: "text-yellow-400",
    text: "text-yellow-400",
    subtext: "text-yellow-300/70",
    button: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    buttonHover: "hover:bg-yellow-500/20 hover:border-yellow-500/30",
  },
  info: {
    container: "bg-[rgba(59,130,246,0.06)]",
    border: "border-blue-500/20",
    icon: "text-blue-400",
    text: "text-blue-400",
    subtext: "text-blue-300/70",
    button: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    buttonHover: "hover:bg-blue-500/20 hover:border-blue-500/30",
  },
};

const VARIANT_ICONS = {
  error: XCircle,
  warning: AlertTriangle,
  info: AlertTriangle,
};

const VARIANT_TITLES = {
  error: "Analyse échouée",
  warning: "Avertissement",
  info: "Remarque",
};

export function ErrorBanner({
  symbol,
  message,
  onRetry,
  onDismiss,
  retrying = false,
  variant = "error",
}: ErrorBannerProps) {
  const styles = VARIANT_STYLES[variant];
  const Icon = VARIANT_ICONS[variant];
  const title = VARIANT_TITLES[variant];

  // Parse common error patterns for better user-facing messages
  const userMessage = parseErrorMessage(message);

  return (
    <div
      className={[
        "relative rounded-2xl border p-5",
        styles.container,
        styles.border,
        "backdrop-blur-sm",
        "animate-in fade-in duration-300",
      ].join(" ")}
      role="alert"
      aria-live="assertive"
    >
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
          aria-label="Fermer la notification"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={[
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            `bg-current/10`,
          ].join(" ")}
          style={{ color: styles.icon.split("text-")[1] || "#ef4444" }}
        >
          <Icon size={20} className={styles.icon} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={["text-sm font-bold", styles.text].join(" ")}>
              {title}
            </h4>
            {symbol && (
              <span className="text-[11px] font-mono font-semibold text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-md border border-[var(--border-primary)]">
                {symbol}
              </span>
            )}
          </div>

          {/* Detailed message */}
          <p
            className={["mt-2 text-sm leading-relaxed", styles.subtext].join(
              " ",
            )}
          >
            {userMessage}
          </p>

          {/* Technical details (collapsed by default) */}
          {message !== userMessage && (
            <details className="mt-2 group">
              <summary className="text-[11px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors select-none">
                Détails techniques
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[11px] font-mono text-[var(--text-muted)] overflow-x-auto whitespace-pre-wrap break-all">
                {message}
              </pre>
            </details>
          )}

          {/* Suggestions */}
          <div className="mt-3 space-y-1">
            {getSuggestions(message).map((suggestion, i) => (
              <p
                key={i}
                className="text-[11px] text-[var(--text-muted)] flex items-start gap-1.5"
              >
                <span className="text-[var(--text-muted)] shrink-0 mt-0.5">
                  •
                </span>
                {suggestion}
              </p>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={retrying}
                className={[
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-150",
                  styles.button,
                  styles.buttonHover,
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                <RefreshCw
                  size={14}
                  className={retrying ? "animate-spin" : ""}
                />
                {retrying ? "Nouvelle tentative..." : "Réessayer l'analyse"}
              </button>
            )}

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ERROR MESSAGE PARSING
// ─────────────────────────────────────────────────────────────

/**
 * Parse technical error messages into user-friendly text.
 */
function parseErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();

  // API errors
  if (lower.includes("invalid_request") || lower.includes("bad request")) {
    return "Le serveur a rejeté la requête. Le symbole est peut-être invalide ou la requête mal formulée.";
  }
  if (lower.includes("missing_symbol")) {
    return "Aucun symbole n'a été fourni. Veuillez entrer un symbole valide (ex. : AAPL, BTC-USD, SPY).";
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "Le symbole est introuvable. Vérifiez l'orthographe ou essayez un autre symbole.";
  }
  if (
    lower.includes("fetch") &&
    (lower.includes("quote") || lower.includes("market"))
  ) {
    return "Impossible de récupérer les données de marché. Le fournisseur de données est peut-être temporairement indisponible. Réessayez dans un instant.";
  }
  if (
    lower.includes("llm") ||
    lower.includes("openai") ||
    lower.includes("api key")
  ) {
    return "Le moteur d'analyse IA est temporairement indisponible. Le système utilisera les données disponibles pour une analyse limitée.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "L'analyse a pris trop de temps. Cela peut arriver lorsque les marchés sont très actifs. Veuillez réessayer.";
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("econnrefused")
  ) {
    return "Impossible de se connecter au serveur d'analyse. Vérifiez que le service backend est en cours d'exécution et réessayez.";
  }
  if (lower.includes("cache")) {
    return "Un problème est survenu avec les données en cache. L'analyse sera effectuée à nouveau.";
  }
  if (lower.includes("abort") || lower.includes("cancelled")) {
    return "L'analyse précédente a été annulée car une nouvelle requête a été lancée.";
  }

  // Default: return the raw message but trim it
  if (raw.length > 200) {
    return raw.substring(0, 200) + "...";
  }
  return raw;
}

/**
 * Generate contextual suggestions based on the error.
 */
function getSuggestions(message: string): string[] {
  const lower = message.toLowerCase();
  const suggestions: string[] = [];

  if (
    lower.includes("not found") ||
    lower.includes("invalid") ||
    lower.includes("symbol")
  ) {
    suggestions.push(
      "Vérifiez le symbole sur Yahoo Finance ou une source similaire.",
    );
    suggestions.push(
      "Pour les cryptos, utilisez le format BTC-USD ou ETH-USD.",
    );
    suggestions.push(
      "Pour les indices, essayez SPY (S&P 500) ou QQQ (Nasdaq 100).",
    );
  }

  if (
    lower.includes("network") ||
    lower.includes("connect") ||
    lower.includes("fetch")
  ) {
    suggestions.push(
      "Assurez-vous que le serveur backend est en cours d'exécution sur le port 8080.",
    );
    suggestions.push("Vérifiez votre connexion internet.");
    suggestions.push(
      "Si vous utilisez un VPN, essayez de le désactiver temporairement.",
    );
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    suggestions.push(
      "Le fournisseur de données limite peut-être le nombre de requêtes.",
    );
    suggestions.push("Attendez quelques secondes et réessayez.");
  }

  if (lower.includes("llm") || lower.includes("api key")) {
    suggestions.push(
      "Assurez-vous que la variable d'environnement LLM_API_KEY est définie dans le backend.",
    );
    suggestions.push(
      "Vérifiez que le fournisseur LLM est accessible depuis votre réseau.",
    );
  }

  // Always add these
  if (suggestions.length === 0) {
    suggestions.push("Essayez de rafraîchir l'analyse.");
    suggestions.push(
      "Consultez la console du navigateur pour plus de détails sur l'erreur.",
    );
  }

  suggestions.push(
    "Si le problème persiste, la source de données de marché est peut-être temporairement indisponible.",
  );

  return suggestions.slice(0, 4); // Limit to 4 suggestions
}

export default ErrorBanner;
