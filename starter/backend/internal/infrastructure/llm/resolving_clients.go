package llm

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// CredentialResolver obtiene claves/modelos de IA en runtime (BD + fallback env).
type CredentialResolver interface {
	AnthropicCredentials(ctx context.Context) (apiKey, model string, err error)
	GeminiCredentials(ctx context.Context) (apiKey, model string, err error)
}

// ResolvingAnthropicClient resuelve la API key en cada llamada.
type ResolvingAnthropicClient struct {
	resolver CredentialResolver
	client   *http.Client
}

func NewResolvingAnthropicClient(resolver CredentialResolver) *ResolvingAnthropicClient {
	return &ResolvingAnthropicClient{
		resolver: resolver,
		client:   &http.Client{Timeout: 60 * time.Second},
	}
}

func (c *ResolvingAnthropicClient) Model() string {
	_, model, err := c.resolver.AnthropicCredentials(context.Background())
	if err != nil || strings.TrimSpace(model) == "" {
		return defaultAnthropicModel
	}
	return model
}

func (c *ResolvingAnthropicClient) Chat(systemPrompt string, messages []Message) (string, error) {
	return c.ChatWithModel(systemPrompt, messages, "")
}

func (c *ResolvingAnthropicClient) ChatWithModel(systemPrompt string, messages []Message, model string) (string, error) {
	apiKey, defaultModel, err := c.resolver.AnthropicCredentials(context.Background())
	if err != nil {
		return "", err
	}
	inner := &AnthropicClient{
		apiKey: apiKey,
		model:  defaultModel,
		client: c.client,
	}
	return inner.ChatWithModel(systemPrompt, messages, model)
}

// ResolvingGeminiClient resuelve la API key en cada llamada.
type ResolvingGeminiClient struct {
	resolver CredentialResolver
	client   *http.Client
}

func NewResolvingGeminiClient(resolver CredentialResolver) *ResolvingGeminiClient {
	return &ResolvingGeminiClient{
		resolver: resolver,
		client:   &http.Client{Timeout: 60 * time.Second},
	}
}

func (c *ResolvingGeminiClient) Model() string {
	_, model, err := c.resolver.GeminiCredentials(context.Background())
	if err != nil || strings.TrimSpace(model) == "" {
		return DefaultGeminiModel
	}
	return model
}

func (c *ResolvingGeminiClient) Chat(systemPrompt string, messages []Message) (string, error) {
	return c.ChatWithModel(systemPrompt, messages, "")
}

func (c *ResolvingGeminiClient) ChatWithModel(systemPrompt string, messages []Message, model string) (string, error) {
	apiKey, defaultModel, err := c.resolver.GeminiCredentials(context.Background())
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(model) == "" {
		model = defaultModel
	}
	inner := &GeminiClient{
		apiKey: apiKey,
		model:  defaultModel,
		client: c.client,
	}
	return inner.ChatWithModel(systemPrompt, messages, model)
}

// Ensure interface compliance at compile time.
var (
	_ interface {
		Chat(string, []Message) (string, error)
		ChatWithModel(string, []Message, string) (string, error)
		Model() string
	} = (*ResolvingAnthropicClient)(nil)
	_ interface {
		Chat(string, []Message) (string, error)
		ChatWithModel(string, []Message, string) (string, error)
		Model() string
	} = (*ResolvingGeminiClient)(nil)
)

// ErrMissingResolver se usa cuando no hay resolver inyectado.
var ErrMissingResolver = fmt.Errorf("credential resolver not configured")
