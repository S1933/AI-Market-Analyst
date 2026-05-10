# 🧠 AI Market Analyst — Plateforme Multi-Agent d'Intelligence Financière

Une application web de production qui utilise un **système à 4 agents IA** pour analyser les marchés financiers. Chaque agent se spécialise dans un domaine — analyse technique, actualités & fondamentaux, évaluation des risques, et synthèse stratégique — et ils collaborent pour produire des rapports de marché complets.

---

## 📐 Aperçu de l'Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 14)                    │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐   │
│  │SearchBar│ │PriceChart│ │ 4 Agent  │ │Strategy Section │   │
│  │         │ │(Recharts)│ │  Cards   │ │  (Scenarios)    │   │
│  └─────────┘ └──────────┘ └──────────┘ └─────────────────┘   │
│                         │ API Client                         │
└─────────────────────────┼────────────────────────────────────┘
                          │ HTTP REST + SSE
┌─────────────────────────┼─────────────────────────────────────┐
│              BACKEND (Go 1.21 + Chi Router)                   │
│  ┌───────────────────────────────────────────────────────────┐│
│  │                   ORCHESTRATEUR                           ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐    ││
│  │  │📊 Agent  │ │📰 Agent  │ │⚠️ Agent  │ │🎯 Agent   │   ││
│  │  │ Marché   │ │ Actualités│ │ Risques  │ │ Stratégie  │    ││
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘    ││
│  │       │             │            │              │         ││
│  │       └─────────────┴────────────┴──────────────┘         ││
│  │                         │                                 ││
│  │                   Client LLM                              ││
│  │              (OpenAI / Mistral / Claude)                  ││
│  └───────────────────────────────────────────────────────────┘│
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐    │
│  │ Données    │  │   Cache     │  │   Gestionnaires API  │    │
│  │ Marché     │  │ (Mémoire)   │  │ (REST + SSE Stream)  │    │
│  │ (Yahoo Fin)│  │             │  │                      │    │
│  └────────────┘  └─────────────┘  └──────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

---

## 🧩 Les 4 Agents

| Agent | Emoji | Responsabilité | Sortie |
|-------|-------|---------------|--------|
| **Agent Marché** | 📊 | Analyse technique — RSI, MACD, moyennes mobiles, supports/résistances, structure de tendance | Biais marché, momentum, niveaux clés |
| **Agent Actualités** | 📰 | Analyse fondamentale — événements récents, macro-économie, sentiment | Impact événementiel, thèmes, sentiment |
| **Agent Risques** | ⚠️ | Évaluation des risques — volatilité, drawdown, risques extrêmes, corrélation | Score risque, facteurs, atténuation |
| **Agent Stratégie** | 🎯 | Synthèse & scénarios — fusionne toutes les sorties des agents en vues cohérentes | 2-3 scénarios avec probabilités |

Chaque agent peut fonctionner selon deux modes :
- **Mode LLM** (défaut) : Utilise l'API OpenAI/Mistral/Claude pour une analyse approfondie
- **Mode repli** : Calcul quantitatif pur quand aucun LLM n'est disponible

---

## 🗂️ Structure du Projet

```
hermes-agent/
├── backend/
│   ├── cmd/server/main.go              # Point d'entrée — initialise & démarre le serveur HTTP
│   └── internal/
│       ├── agents/
│       │   ├── market_agent.go         # 📊 Agent d'analyse technique
│       │   ├── news_agent.go           # 📰 Agent d'analyse fondamentale/actualités
│       │   ├── risk_agent.go           # ⚠️ Agent d'évaluation des risques
│       │   ├── strategy_agent.go       # 🎯 Agent de synthèse & scénarios
│       │   └── orchestrator.go         # Coordonne les 4 agents
│       ├── api/
│       │   ├── handlers.go            # Gestionnaires HTTP (analyze, search, quote, cache)
│       │   └── router.go              # Routeur Chi avec middleware
│       ├── market/
│       │   └── data.go                # Récupérateur de données Yahoo Finance + indicateurs techniques
│       ├── llm/
│       │   └── client.go             # Client API LLM compatible OpenAI
│       ├── cache/
│       │   └── cache.go              # Cache TTL en mémoire pour les résultats d'analyse
│       └── models/
│           └── types.go              # Types de données partagés (structs Go)
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                # Layout racine avec polices & métadonnées
│   │   ├── page.tsx                  # Page tableau de bord principale
│   │   └── globals.css               # Système de design fintech thème sombre
│   ├── components/
│   │   ├── SearchBar.tsx             # Recherche de ticker avec autocomplétion
│   │   ├── PriceTicker.tsx           # Barre de prix en temps réel
│   │   ├── PriceChart.tsx            # Graphique OHLCV interactif (Recharts)
│   │   ├── AnalysisCard.tsx          # Conteneur de carte réutilisable
│   │   ├── MarketAnalysisSection.tsx # 📊 Résultats agent marché
│   │   ├── NewsAnalysisSection.tsx   # 📰 Résultats agent actualités
│   │   ├── RiskAnalysisSection.tsx   # ⚠️ Résultats agent risques
│   │   ├── StrategySection.tsx       # 🎯 Résultats agent stratégie
│   │   ├── LoadingSpinner.tsx        # États de chargement
│   │   ├── ErrorBanner.tsx           # Affichage d'erreur avec suggestions
│   │   └── Dashboard.tsx            # Tableau de bord alternatif à onglets
│   ├── lib/
│   │   ├── api.ts                   # Client API typé (wrapper fetch)
│   │   └── types.ts                 # Types TypeScript (miroir des modèles Go)
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── postcss.config.js
└── README.md
```

---

## 🚀 Démarrage Rapide

### Prérequis

- **Go** 1.21+
- **Node.js** 18+ et npm
- **Clé API LLM** (OpenAI, Mistral, ou tout fournisseur compatible OpenAI)

### 1. Backend

```bash
cd backend

# Définir les variables d'environnement
export LLM_API_KEY="sk-votre-clé-api"
export LLM_BASE_URL="https://api.openai.com/v1"  # défaut
export LLM_MODEL="gpt-4o"                         # défaut
export PORT="8080"                                # défaut
export CACHE_TTL="15m"                            # défaut

# Installer les dépendances
go mod tidy

# Lancer le serveur
go run cmd/server/main.go
```

Le backend démarre sur `http://localhost:8080`.

### 2. Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Définir l'URL de l'API (optionnel, par défaut localhost:8080)
export NEXT_PUBLIC_API_BASE_URL="http://localhost:8080"

# Lancer le serveur de développement
npm run dev
```

Le frontend démarre sur `http://localhost:3000`.

---

## 📡 Points d'API

### Analyse

| Méthode | Chemin | Description |
|--------|-------|-------------|
| `POST` | `/api/v1/analyze` | Exécuter l'analyse multi-agent complète sur un symbole |
| `GET` | `/api/v1/analyze/{symbol}` | Obtenir l'analyse en cache |
| `GET` | `/api/v1/analyze/{symbol}/stream` | Streamer l'analyse via SSE |

### Données Marché

| Méthode | Chemin | Description |
|--------|-------|-------------|
| `GET` | `/api/v1/quote/{symbol}` | Obtenir le cours en temps réel |
| `GET` | `/api/v1/historical/{symbol}?period=6mo&interval=1d` | Obtenir l'historique OHLCV |
| `GET` | `/api/v1/indicators/{symbol}` | Obtenir les indicateurs techniques calculés |

### Recherche & Cache

| Méthode | Chemin | Description |
|--------|-------|-------------|
| `GET` | `/api/v1/search?q=apple` | Rechercher des symboles |
| `DELETE` | `/api/v1/cache` | Vider tous les caches d'analyse |
| `GET` | `/api/v1/cache/stats` | Statistiques du cache |

### Exemple : Lancer une Analyse

```bash
curl -X POST http://localhost:8080/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "force_refresh": false}'
```

---

## 📊 Exemple de Réponse JSON

Une réponse d'analyse complète contient les 4 sorties des agents. Voici un exemple tronqué :

```json
{
  "request_id": "abc-123",
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "category": "stock",
  "generated_at": "2025-01-15T10:30:00Z",
  "market_data": {
    "quote": {
      "symbol": "AAPL",
      "price": 185.50,
      "change": 2.30,
      "change_percent": 1.25,
      "volume": 52000000
    },
    "technical": {
      "rsi_14": 58.3,
      "macd_line": 1.24,
      "macd_signal": 0.98,
      "sma_50": 180.25,
      "sma_200": 175.40,
      "bollinger_upper": 190.10,
      "bollinger_lower": 175.90
    },
    "support_resistance": {
      "supports": [178.00, 172.50],
      "resistances": [190.00, 195.20]
    }
  },
  "market_analysis": {
    "agent_name": "market_agent",
    "trend": "bullish",
    "trend_strength": 65,
    "momentum": "accelerating",
    "structure": "trending_up",
    "summary": "AAPL est dans une tendance haussière au-dessus des MM50 et MM200..."
  },
  "news_analysis": {
    "agent_name": "news_agent",
    "overall_sentiment": "positive",
    "impact_on_asset": "favorable",
    "key_themes": ["Forte croissance des services", "Stratégie IA"],
    "recent_events": [...]
  },
  "risk_analysis": {
    "agent_name": "risk_agent",
    "overall_risk": "moderate",
    "risk_score": 45,
    "volatility_regime": "normal",
    "drawdown_risk_pct": 12.5,
    "factors": [...]
  },
  "strategy_analysis": {
    "agent_name": "strategy_agent",
    "primary_bias": "bullish",
    "conviction_level": "moderate",
    "scenarios": [
      {
        "bias": "bullish",
        "name": "Continuation de la tendance haussière",
        "probability": 55,
        "target_price": 200.00,
        "timeframe": "3-6 mois",
        "key_triggers": ["Cassure au-dessus de 190$", "RSI se maintient au-dessus de 60"],
        "invalidation_point": 172.00
      }
    ],
    "conclusion": "Le poids des preuves suggère une probabilité raisonnable de résolution haussière..."
  }
}
```

---

## 🎨 UI/UX

Le frontend propose un **tableau de bord fintech thème sombre** inspiré de Bloomberg Terminal et TradingView :

- **Cartes glass-morphism** avec dégradés subtils
- **Graphiques de prix interactifs** avec moyennes mobiles, barres de volume et sélecteurs de plage
- **Jauge de risque** avec visualisation semi-circulaire du score
- **Cartes d'analyse repliables** pour chaque agent
- **Cartes de scénario** avec indicateurs de biais colorés et barres de probabilité
- **Recherche en temps réel** avec autocomplétion et navigation clavier
- **Disposition responsive** — fonctionne sur desktop et tablette
- **États de squelette de chargement** avec indicateurs de progression
- **Récupération d'erreur** avec suggestions contextuelles

---

## 🔧 Variables d'Environnement

### Backend

| Variable | Défaut | Description |
|----------|--------|-------------|
| `LLM_API_KEY` | (requis) | Clé API pour le fournisseur LLM |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | URL de base de l'API LLM |
| `LLM_MODEL` | `gpt-4o` | Nom du modèle |
| `PORT` | `8080` | Port du serveur HTTP |
| `CACHE_TTL` | `15m` | Durée du cache d'analyse |
| `CACHE_MAX_SIZE` | `200` | Nombre max d'entrées en cache |

### Frontend

| Variable | Défaut | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | URL de l'API backend |

---

## 🧠 Comment Fonctionnent les Agents

### Pipeline des Agents

```
Requête Utilisateur ("AAPL")
        │
        ▼
┌───────────────────┐
│ 1. Récupération   │  API Yahoo Finance → Cours + Historique + Indicateurs
│    Données Marché  │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ 2. Exécution      │
│    Parallèle      │
│  ┌─────┐ ┌─────┐ │  Agent Marché ←→ Agent Actualités (simultanés)
│  │ 📊  │ │ 📰  │ │
│  └──┬──┘ └──┬──┘ │
│     │       │     │
│     ▼       ▼     │
│  ┌─────────────┐  │  Agent Risques (utilise contexte marché + actualités)
│  │     ⚠️      │  │
│  └──────┬──────┘  │
│         │         │
│         ▼         │
│  ┌─────────────┐  │  Agent Stratégie (utilise toutes les sorties)
│  │     🎯      │  │
│  └─────────────┘  │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ 3. Cache & Retour │  Stocker résultat → Retour au client
└───────────────────┘
```

### Mode Repli

Quand le LLM est indisponible, chaque agent s'appuie sur du **calcul pur** :

- **Agent Marché** : Calcule RSI, MACD, SMA, Bandes de Bollinger, supports/résistances à partir des données de prix
- **Agent Actualités** : Retourne le contexte de structure de marché et les thèmes sectoriels
- **Agent Risques** : Calcule un score de risque quantitatif à partir de la volatilité, des estimations de drawdown et des extrêmes d'indicateurs
- **Agent Stratégie** : Utilise un système de score basé sur des règles pour pondérer les signaux marché/actualités/risques en probabilités de scénarios

Cela garantit que le système est **toujours opérationnel**, même sans LLM.

---

## 🚫 Principes de Conception

1. **Pas de conseil financier** — Le système fournit des analyses, jamais de recommandations "acheter" ou "vendre"
2. **Pensée probabiliste** — Tous les scénarios incluent des estimations de probabilité, pas des certitudes
3. **Séparation des faits et de l'interprétation** — Les données brutes sont toujours disponibles parallèlement à l'analyse des agents
4. **Dégradation gracieuse** — Chaque composant a un repli quand les données ou le LLM sont indisponibles
5. **Transparence** — Les sorties des agents incluent le texte LLM brut pour la traçabilité

---

## 📝 Licence

MIT — Utilisation libre. Pas un conseil financier.

---

## 🔮 Feuille de Route Future

- [ ] Flux de prix WebSocket en temps réel
- [ ] Analyse multi-portefeuille (plusieurs symboles)
- [ ] Backtesting historique des scénarios des agents
- [ ] Prompts d'agents configurables par l'utilisateur
- [ ] Support multilingue (Français, Espagnol, etc.)
- [ ] Application mobile (React Native)
- [ ] Intégration avec plus de fournisseurs de données (Polygon, Alpha Vantage)
- [ ] Tableau de bord des métriques de performance des agents

---

*Construit avec ❤️ en Go, Next.js, et une architecture multi-agent IA.*
