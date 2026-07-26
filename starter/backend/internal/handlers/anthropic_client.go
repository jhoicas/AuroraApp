package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"aurora-backend/internal/config"
)

type AnthropicResponse struct {
	Text string `json:"text"`
}

func callAnthropic(systemPrompt, userPrompt string) (string, error) {
	cfg := config.LoadConfig()
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		apiKey = cfg.OpenAIApiKey
	}

	model := os.Getenv("ANTHROPIC_MODEL")
	if model == "" {
		model = "claude-haiku-4-5-20251001"
	}

	if apiKey == "" {
		// Fallback mock tool-calling flow when Anthropic key is not configured.
		lower := strings.ToLower(userPrompt)
		if strings.Contains(lower, "toolresult:") {
			return `{"action":"final","text":"Debes proyectar la demanda a 10 años, según el manual."}`, nil
		}
		if strings.Contains(lower, "manual") || strings.Contains(lower, "agua potable") || strings.Contains(lower, "demanda") {
			return `{"action":"call","tool":"read_note","args":{"title":"manual_mga"}}`, nil
		}
		return `{"action":"final","text":"Mock Claude response: no Anthropic API key configured."}`, nil
	}

	endpoint := os.Getenv("ANTHROPIC_API_URL")
	if endpoint == "" {
		endpoint = "https://api.anthropic.com/v1/complete"
	}

	body := map[string]interface{}{
		"model":      model,
		"system":     systemPrompt,
		"prompt":     userPrompt,
		"max_tokens": 800,
	}

	b, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", endpoint, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("anthropic error: %s", string(data))
	}

	// Try to parse JSON {text: "..."} else return raw
	var ar AnthropicResponse
	if err := json.Unmarshal(data, &ar); err == nil && ar.Text != "" {
		return ar.Text, nil
	}
	return string(data), nil
}
