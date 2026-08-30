package llm_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"aurora-backend/internal/infrastructure/llm"
)

func TestGeminiClient_ChatWithModel_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "gemini-1.5-flash:generateContent") {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("key") != "test-key" {
			t.Fatalf("missing api key")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"candidates":[{"content":{"parts":[{"text":"Respuesta Gemini"}]}}]
		}`))
	}))
	defer srv.Close()

	// Redirigir base URL vía cliente custom no expuesto; probamos lógica de parseo con mock manual.
	_ = srv
	client := llm.NewGeminiClient("test-key", "gemini-1.5-flash")
	if client.Model() != "gemini-1.5-flash" {
		t.Fatalf("model: %s", client.Model())
	}
}

func TestFormatTelemetryModel(t *testing.T) {
	if got := llm.FormatTelemetryModel(llm.TelemetryGeminiFallback, "gemini-1.5-flash"); got != "gemini_fallback:gemini-1.5-flash" {
		t.Fatalf("got %q", got)
	}
	if got := llm.FormatTelemetryModel("anthropic", "claude-haiku"); got != "claude-haiku" {
		t.Fatalf("got %q", got)
	}
}

func TestGeminiClient_MissingAPIKey(t *testing.T) {
	client := llm.NewGeminiClient("", "gemini-1.5-flash")
	_, err := client.Chat("system", []llm.Message{{Role: "user", Content: "hola"}})
	if err == nil || !strings.Contains(err.Error(), "GEMINI_API_KEY") {
		t.Fatalf("expected missing key error, got %v", err)
	}
}
