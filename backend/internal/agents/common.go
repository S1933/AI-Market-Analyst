// Package agents contains the multi-agent financial analysis system.
// This file defines shared types, constants, and interfaces used by all agents.
package agents

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/hermes-agent/backend/internal/market"
	"github.com/hermes-agent/backend/internal/models"
)

// ─────────────────────────────────────────────────────────────
// AGENT NAME CONSTANTS
// ─────────────────────────────────────────────────────────────

const (
	MarketAgentName   = "market_agent"
	NewsAgentName     = "news_agent"
	RiskAgentName     = "risk_agent"
	StrategyAgentName = "strategy_agent"
)

// ─────────────────────────────────────────────────────────────
// AGENT ERROR
// ─────────────────────────────────────────────────────────────

// AgentError represents an error returned by an agent during analysis.
type AgentError struct {
	Agent string
	Code  string
	Err   error
}

// Error returns a formatted error string.
func (e *AgentError) Error() string {
	return fmt.Sprintf("agent %s error [%s]: %v", e.Agent, e.Code, e.Err)
}

// NewAgentError creates a new AgentError.
func NewAgentError(agent, code string, err error) *AgentError {
	return &AgentError{
		Agent: agent,
		Code:  code,
		Err:   err,
	}
}

// ─────────────────────────────────────────────────────────────
// ANALYSIS RESULT
// ─────────────────────────────────────────────────────────────

// AnalysisResult holds the structured output from the full multi-agent pipeline.
type AnalysisResult struct {
	MarketData *market.MarketData
	Market     *models.MarketAnalysis
	News       *models.NewsAnalysis
	Risk       *models.RiskAnalysis
	Strategy   *models.StrategyAnalysis
	Errors     []string
	Warnings   []string
}

// agentErrorOutput is a helper struct for detecting error JSON from agents.
type agentErrorOutput struct {
	Error string `json:"error"`
}

// parseAgentOutput unmarshals a raw JSON agent output into the target struct.
// If the output starts with an error envelope, it reports it via warnings.
func parseAgentOutput(raw string, target interface{}, agentName string, warnings *[]string) error {
	// Check for error envelope first
	var errOut agentErrorOutput
	if err := json.Unmarshal([]byte(raw), &errOut); err == nil && errOut.Error != "" {
		*warnings = append(*warnings, fmt.Sprintf("agent %s: %s", agentName, errOut.Error))
		return fmt.Errorf("agent %s: %s", agentName, errOut.Error)
	}

	if err := json.Unmarshal([]byte(raw), target); err != nil {
		return fmt.Errorf("failed to parse %s output: %w", agentName, err)
	}
	return nil
}

// ─────────────────────────────────────────────────────────────
// AGENT INTERFACE
// ─────────────────────────────────────────────────────────────

// Agent defines the interface that every agent must implement.
type Agent interface {
	Name() string
	Run(ctx context.Context, symbol string, marketData *market.MarketData, previousOutputs map[string]string) (string, error)
}
