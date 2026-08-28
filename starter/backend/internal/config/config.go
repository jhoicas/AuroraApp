package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	DatabaseURL       string
	JWTSecret         string
	CORSOrigins       string
	AnthropicApiKey   string
	AnthropicModel    string
	HuggingFaceApiKey string
	EmbeddingProvider string // huggingface | ollama | mock
	EmbeddingModel    string
	OllamaBaseURL     string
}

// LoadConfig carga variables desde .env (si existe) y el entorno del proceso.
func LoadConfig() *Config {
	_ = godotenv.Load()
	_ = godotenv.Load(".env")
	_ = godotenv.Load("backend/.env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-only-change-me"
		log.Println("WARNING: JWT_SECRET not set; using insecure default")
	}

	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required: set it in .env (no local Docker/postgres fallback)")
	}

	anthropicModel := strings.TrimSpace(os.Getenv("ANTHROPIC_MODEL"))
	if anthropicModel == "" {
		anthropicModel = "claude-haiku-4-5-20251001"
	}

	embeddingProvider := strings.ToLower(strings.TrimSpace(os.Getenv("EMBEDDING_PROVIDER")))
	if embeddingProvider == "" {
		if strings.TrimSpace(os.Getenv("HUGGINGFACE_API_KEY")) != "" {
			embeddingProvider = "huggingface"
		} else if strings.TrimSpace(os.Getenv("OLLAMA_BASE_URL")) != "" {
			embeddingProvider = "ollama"
		} else {
			embeddingProvider = "mock"
		}
	}

	embeddingModel := strings.TrimSpace(os.Getenv("EMBEDDING_MODEL"))
	if embeddingModel == "" {
		switch embeddingProvider {
		case "ollama":
			embeddingModel = "nomic-embed-text"
		default:
			embeddingModel = "sentence-transformers/all-MiniLM-L6-v2"
		}
	}

	ollamaURL := strings.TrimSpace(os.Getenv("OLLAMA_BASE_URL"))
	if ollamaURL == "" {
		ollamaURL = "http://127.0.0.1:11434"
	}

	corsOrigins := strings.TrimSpace(os.Getenv("CORS_ORIGINS"))
	if corsOrigins == "" {
		corsOrigins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
	}

	return &Config{
		Port:              port,
		DatabaseURL:       databaseURL,
		JWTSecret:         jwtSecret,
		CORSOrigins:       corsOrigins,
		AnthropicApiKey:   strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY")),
		AnthropicModel:    anthropicModel,
		HuggingFaceApiKey: strings.TrimSpace(os.Getenv("HUGGINGFACE_API_KEY")),
		EmbeddingProvider: embeddingProvider,
		EmbeddingModel:    embeddingModel,
		OllamaBaseURL:     ollamaURL,
	}
}
