package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	DefaultGeminiModel      = "gemini-1.5-flash-latest"
	geminiGenerateBaseURL   = "https://generativelanguage.googleapis.com/v1beta/models"
	TelemetryGeminiFallback = "gemini_fallback"
)

// FormatTelemetryModel registra el modelo con prefijo de proveedor de contingencia.
func FormatTelemetryModel(provider, model string) string {
	if provider == TelemetryGeminiFallback {
		return TelemetryGeminiFallback + ":" + model
	}
	return model
}

type GeminiClient struct {
	apiKey string
	model  string
	client *http.Client
}

func NewGeminiClient(apiKey, model string) *GeminiClient {
	if strings.TrimSpace(model) == "" {
		model = os.Getenv("GEMINI_MODEL")
		if strings.TrimSpace(model) == "" {
			model = "gemini-1.5-flash"
		}
	}
	return &GeminiClient{
		apiKey: strings.TrimSpace(apiKey),
		model:  model,
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiGenerateRequest struct {
	SystemInstruction *geminiContent  `json:"systemInstruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
	GenerationConfig  struct {
		MaxOutputTokens int `json:"maxOutputTokens,omitempty"`
	} `json:"generationConfig,omitempty"`
}

type geminiGenerateResponse struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error"`
}

// Chat envía mensajes a la API de Gemini (misma firma que AnthropicClient).
func (c *GeminiClient) Chat(systemPrompt string, messages []Message) (string, error) {
	return c.ChatWithModel(systemPrompt, messages, c.model)
}

// ChatWithModel genera contenido con el modelo Gemini indicado.
func (c *GeminiClient) ChatWithModel(systemPrompt string, messages []Message, model string) (string, error) {
	if model == "" {
		model = c.model
	}
	if c.apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY not configured")
	}

	reqBody := geminiGenerateRequest{}
	if strings.TrimSpace(systemPrompt) != "" {
		reqBody.SystemInstruction = &geminiContent{
			Parts: []geminiPart{{Text: systemPrompt}},
		}
	}
	reqBody.GenerationConfig.MaxOutputTokens = 1200

	for _, msg := range messages {
		role := strings.ToLower(strings.TrimSpace(msg.Role))
		switch role {
		case "assistant", "model":
			role = "model"
		default:
			role = "user"
		}
		reqBody.Contents = append(reqBody.Contents, geminiContent{
			Role:  role,
			Parts: []geminiPart{{Text: msg.Content}},
		})
	}

	if len(reqBody.Contents) == 0 {
		return "", fmt.Errorf("gemini: no messages to send")
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	cleanModel := strings.TrimPrefix(model, "models/")
	url := fmt.Sprintf("%s/%s:generateContent?key=%s", geminiGenerateBaseURL, cleanModel, c.apiKey)

	var raw []byte
	var lastErr error
	var statusCode int

	for attempt := 1; attempt <= 3; attempt++ {
		// Creamos el request de nuevo en cada intento porque el body (Reader) se consume
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.client.Do(req)
		if err != nil {
			return "", err
		}
		
		raw, _ = io.ReadAll(resp.Body)
		statusCode = resp.StatusCode
		resp.Body.Close()

		if statusCode == http.StatusServiceUnavailable || statusCode == http.StatusTooManyRequests {
			if attempt < 3 {
				time.Sleep(1500 * time.Millisecond)
				continue
			}
			lastErr = fmt.Errorf("⏳ Por favor, espera unos segundos a que Aurora procese la información antes de pedir otra sugerencia.")
			break
		}
		
		if statusCode >= 400 {
			return "", fmt.Errorf("gemini api error (%d): %s", statusCode, string(raw))
		}
		
		lastErr = nil
		break
	}

	if lastErr != nil {
		return "", lastErr
	}

	var parsed geminiGenerateResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if parsed.Error != nil {
		return "", fmt.Errorf("gemini: %s", parsed.Error.Message)
	}

	var text string
	for _, candidate := range parsed.Candidates {
		for _, part := range candidate.Content.Parts {
			text += part.Text
		}
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return "", fmt.Errorf("empty response from gemini")
	}
	return text, nil
}

func (c *GeminiClient) Model() string {
	return c.model
}
