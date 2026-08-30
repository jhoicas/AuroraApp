package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// EmbeddingProvider genera vectores para indexación semántica (open-source).
type EmbeddingProvider interface {
	Dimensions() int
	Embed(text string) ([]float32, error)
}

// MockEmbeddingProvider embedding determinístico para desarrollo sin API externa.
type MockEmbeddingProvider struct {
	dim int
}

func NewMockEmbeddingProvider() *MockEmbeddingProvider {
	return &MockEmbeddingProvider{dim: DefaultEmbeddingDimensions}
}

func (p *MockEmbeddingProvider) Dimensions() int {
	return p.dim
}

func (p *MockEmbeddingProvider) Embed(text string) ([]float32, error) {
	return deterministicEmbed(text, p.dim), nil
}

// HuggingFaceEmbeddingProvider usa la Inference API con all-MiniLM-L6-v2 (384 dims).
type HuggingFaceEmbeddingProvider struct {
	apiKey string
	model  string
	client *http.Client
}

func NewHuggingFaceEmbeddingProvider(apiKey, model string) *HuggingFaceEmbeddingProvider {
	if model == "" {
		model = "sentence-transformers/all-MiniLM-L6-v2"
	}
	return &HuggingFaceEmbeddingProvider{
		apiKey: apiKey,
		model:  model,
		client: &http.Client{Timeout: 45 * time.Second},
	}
}

func (p *HuggingFaceEmbeddingProvider) Dimensions() int {
	return DefaultEmbeddingDimensions
}

func (p *HuggingFaceEmbeddingProvider) Embed(text string) ([]float32, error) {
	url := fmt.Sprintf("https://api-inference.huggingface.co/pipeline/feature-extraction/%s", p.model)
	body, _ := json.Marshal(map[string]string{"inputs": text})

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("huggingface embedding error (%d): %s", resp.StatusCode, string(raw))
	}

	vec, err := parseHFEmbedding(raw)
	if err != nil {
		return nil, err
	}
	if len(vec) != DefaultEmbeddingDimensions {
		return nil, fmt.Errorf("unexpected embedding dims: got %d want %d", len(vec), DefaultEmbeddingDimensions)
	}
	return vec, nil
}

func parseHFEmbedding(raw []byte) ([]float32, error) {
	// Token-level: [][]float64
	var tokenMatrix [][]float64
	if err := json.Unmarshal(raw, &tokenMatrix); err == nil && len(tokenMatrix) > 0 {
		if len(tokenMatrix[0]) > 0 && !isNestedMatrix(tokenMatrix) {
			return meanPool(tokenMatrix), nil
		}
	}

	// Sentence-level flat: []float64
	var flat []float64
	if err := json.Unmarshal(raw, &flat); err == nil && len(flat) > 0 {
		out := make([]float32, len(flat))
		for i, v := range flat {
			out[i] = float32(v)
		}
		return out, nil
	}

	// Batch: [[]float64]
	var batch [][]float64
	if err := json.Unmarshal(raw, &batch); err == nil && len(batch) > 0 {
		return meanPool(batch), nil
	}

	return nil, fmt.Errorf("unable to parse huggingface embedding response")
}

func isNestedMatrix(m [][]float64) bool {
	if len(m) == 0 {
		return false
	}
	return len(m[0]) > 0 && len(m) > 1
}

func meanPool(tokens [][]float64) []float32 {
	if len(tokens) == 0 {
		return nil
	}
	dim := len(tokens[0])
	out := make([]float32, dim)
	for _, tok := range tokens {
		for i, v := range tok {
			if i < dim {
				out[i] += float32(v)
			}
		}
	}
	n := float32(len(tokens))
	for i := range out {
		out[i] /= n
	}
	return out
}

// OllamaEmbeddingProvider embeddings locales vía Ollama (ej. nomic-embed-text).
type OllamaEmbeddingProvider struct {
	baseURL string
	model   string
	client  *http.Client
}

func NewOllamaEmbeddingProvider(baseURL, model string) *OllamaEmbeddingProvider {
	return &OllamaEmbeddingProvider{
		baseURL: baseURL,
		model:   model,
		client:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *OllamaEmbeddingProvider) Dimensions() int {
	return DefaultEmbeddingDimensions
}

func (p *OllamaEmbeddingProvider) Embed(text string) ([]float32, error) {
	body, _ := json.Marshal(map[string]string{
		"model":  p.model,
		"prompt": text,
	})
	resp, err := p.client.Post(p.baseURL+"/api/embeddings", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ollama embedding error: %s", string(raw))
	}

	var parsed struct {
		Embedding []float64 `json:"embedding"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	out := make([]float32, len(parsed.Embedding))
	for i, v := range parsed.Embedding {
		out[i] = float32(v)
	}
	// Truncar o rellenar a 384 para consistencia con pgvector
	return adjustEmbeddingDims(out), nil
}

const (
	geminiEmbeddingModel = "text-embedding-004"
	geminiEmbedBaseURL   = "https://generativelanguage.googleapis.com/v1beta/models"
)

// GeminiEmbeddingProvider usa la API de Google Embeddings (text-embedding-004).
type GeminiEmbeddingProvider struct {
	apiKey string
	model  string
	client *http.Client
}

func NewGeminiEmbeddingProvider(apiKey string) *GeminiEmbeddingProvider {
	return &GeminiEmbeddingProvider{
		apiKey: strings.TrimSpace(apiKey),
		model:  geminiEmbeddingModel,
		client: &http.Client{Timeout: 45 * time.Second},
	}
}

func (p *GeminiEmbeddingProvider) Dimensions() int {
	return DefaultEmbeddingDimensions
}

func (p *GeminiEmbeddingProvider) Embed(text string) ([]float32, error) {
	if p.apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not configured")
	}

	reqBody := map[string]any{
		"content": map[string]any{
			"parts": []map[string]string{{"text": text}},
		},
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/%s:embedContent?key=%s", geminiEmbedBaseURL, p.model, p.apiKey)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("gemini embedding error (%d): %s", resp.StatusCode, string(raw))
	}

	var parsed struct {
		Embedding *struct {
			Values []float64 `json:"values"`
		} `json:"embedding"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	if parsed.Error != nil {
		return nil, fmt.Errorf("gemini embedding: %s", parsed.Error.Message)
	}
	if parsed.Embedding == nil || len(parsed.Embedding.Values) == 0 {
		return nil, fmt.Errorf("empty embedding from gemini")
	}

	out := make([]float32, len(parsed.Embedding.Values))
	for i, v := range parsed.Embedding.Values {
		out[i] = float32(v)
	}
	return adjustEmbeddingDims(out), nil
}

func adjustEmbeddingDims(vec []float32) []float32 {
	if len(vec) > DefaultEmbeddingDimensions {
		return vec[:DefaultEmbeddingDimensions]
	}
	if len(vec) < DefaultEmbeddingDimensions {
		padded := make([]float32, DefaultEmbeddingDimensions)
		copy(padded, vec)
		return padded
	}
	return vec
}
