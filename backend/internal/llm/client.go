package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// Client wraps an OpenAI-compatible LLM API.
type Client struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
	model      string
}

// Message represents a chat message.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest is the request body for a chat completion.
type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
}

// ChatResponse is the response body from a chat completion.
type ChatResponse struct {
	ID      string `json:"id"`
	Choices []struct {
		Index   int     `json:"index"`
		Message Message `json:"message"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage,omitempty"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

// NewClient creates a new LLM client from environment variables.
// Required env: LLM_API_KEY, LLM_BASE_URL (defaults to OpenAI), LLM_MODEL (defaults to gpt-4o).
func NewClient() *Client {
	baseURL := os.Getenv("LLM_BASE_URL")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	model := os.Getenv("LLM_MODEL")
	if model == "" {
		model = "gpt-4o"
	}

	return &Client{
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
		baseURL: baseURL,
		apiKey:  os.Getenv("LLM_API_KEY"),
		model:   model,
	}
}

// NewClientWithConfig creates a client with explicit config (useful for testing).
func NewClientWithConfig(baseURL, apiKey, model string) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 120 * time.Second},
		baseURL:    baseURL,
		apiKey:     apiKey,
		model:      model,
	}
}

// IsConfigured returns true if the client has an API key set.
func (c *Client) IsConfigured() bool { return c.apiKey != "" }

// Chat sends a chat completion request and returns the response content.
func (c *Client) Chat(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	messages := []Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}
	return c.ChatWithMessages(ctx, messages)
}

// ChatWithMessages sends a multi-turn chat completion request.
func (c *Client) ChatWithMessages(ctx context.Context, messages []Message) (string, error) {
	// Enforce a 120s deadline on the LLM call regardless of the parent
	// context. Go's http.Client ignores Client.Timeout when the request
	// context already carries a deadline, so we must create our own.
	llmCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	reqBody := ChatRequest{
		Model:       c.model,
		Messages:    messages,
		Temperature: 0.3,
		MaxTokens:   4096,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/chat/completions", c.baseURL)
	req, err := http.NewRequestWithContext(llmCtx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(respBytes, &chatResp); err != nil {
		return "", fmt.Errorf("unmarshal response: %w (body: %s)", err, string(respBytes))
	}

	if chatResp.Error != nil {
		return "", fmt.Errorf("API error: %s (%s)", chatResp.Error.Message, chatResp.Error.Type)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	return chatResp.Choices[0].Message.Content, nil
}

// ChatJSON sends a chat request and unmarshals the response into the provided struct.
// The system prompt should instruct the model to output valid JSON.
func (c *Client) ChatJSON(ctx context.Context, systemPrompt, userPrompt string, target interface{}) error {
	content, err := c.Chat(ctx, systemPrompt, userPrompt)
	if err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(content), target); err != nil {
		cleaned := extractJSONFromMarkdown(content)
		if err2 := json.Unmarshal([]byte(cleaned), target); err2 != nil {
			return fmt.Errorf("unmarshal JSON response: %w (cleaned: %s)", err2, cleaned)
		}
	}
	return nil
}

// extractJSONFromMarkdown strips markdown code fences and returns the inner content.
// Handles ```json, ```, and leading/trailing whitespace.
func extractJSONFromMarkdown(content string) string {
	return extractFencedBlock(content, "```")
}

// extractFencedBlock finds content between opening and closing delimiters.
// The opening delimiter may be followed by a language tag (e.g. ```json).
func extractFencedBlock(content, delim string) string {
	// Find the first occurrence of the delimiter.
	startIdx := strings.Index(content, delim)
	if startIdx < 0 {
		return content
	}

	// Skip the delimiter and any language tag (everything up to the first newline).
	innerStart := startIdx + len(delim)
	if idx := strings.IndexByte(content[innerStart:], '\n'); idx >= 0 {
		innerStart += idx + 1
	}

	// Find the closing delimiter after innerStart.
	endIdx := strings.Index(content[innerStart:], delim)
	if endIdx < 0 {
		// No closing fence — return everything after the opening fence.
		return strings.TrimSpace(content[innerStart:])
	}

	return strings.TrimSpace(content[innerStart : innerStart+endIdx])
}
