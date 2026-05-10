import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: {
          primary: "#0a0c10",
          secondary: "#11141b",
          tertiary: "#161b24",
          card: "#1a1f2b",
          "card-hover": "#1e2432",
          input: "#131820",
          tooltip: "#222836",
        },
        accent: {
          primary: "#3b82f6",
          secondary: "#6366f1",
          success: "#22c55e",
          danger: "#ef4444",
          warning: "#f59e0b",
          info: "#06b6d4",
        },
        text: {
          primary: "#f1f5f9",
          secondary: "#94a3b8",
          muted: "#64748b",
          inverse: "#0a0c10",
        },
        border: {
          primary: "#1e293b",
          secondary: "#273040",
          accent: "rgba(59, 130, 246, 0.3)",
        },
        bullish: {
          DEFAULT: "#22c55e",
          bg: "rgba(34, 197, 94, 0.1)",
        },
        bearish: {
          DEFAULT: "#ef4444",
          bg: "rgba(239, 68, 68, 0.1)",
        },
        neutral: {
          DEFAULT: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.1)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro Display",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Cascadia Code", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "22px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["18px", { lineHeight: "26px" }],
        "2xl": ["20px", { lineHeight: "28px" }],
        "3xl": ["28px", { lineHeight: "36px" }],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        "2xl": "24px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "card-hover": "0 4px 16px rgba(0, 0, 0, 0.5)",
        "glow-blue": "0 0 20px rgba(59, 130, 246, 0.15)",
        "glow-green": "0 0 16px rgba(34, 197, 94, 0.12)",
        "glow-red": "0 0 16px rgba(239, 68, 68, 0.12)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "fade-in": "fade-in 0.35s ease-out forwards",
        spin: "spin 0.8s linear infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
