package services

import (
	"log"

	"aurora-backend/internal/config"
)

// DefaultEmbeddingDimensions dimensión de all-MiniLM-L6-v2 (Hugging Face).
const DefaultEmbeddingDimensions = 384

// NewEmbeddingProvider selecciona el proveedor open-source según configuración.
// NO usa OpenAI.
func NewEmbeddingProvider(cfg *config.Config) EmbeddingProvider {
	if cfg == nil {
		return NewMockEmbeddingProvider()
	}

	switch cfg.EmbeddingProvider {
	case "huggingface":
		if cfg.HuggingFaceApiKey != "" {
			log.Printf("embeddings: Hugging Face (%s, %d dims)", cfg.EmbeddingModel, DefaultEmbeddingDimensions)
			return NewHuggingFaceEmbeddingProvider(cfg.HuggingFaceApiKey, cfg.EmbeddingModel)
		}
		log.Println("embeddings: HUGGINGFACE_API_KEY missing, falling back to mock")
	case "ollama":
		log.Printf("embeddings: Ollama (%s @ %s)", cfg.EmbeddingModel, cfg.OllamaBaseURL)
		return NewOllamaEmbeddingProvider(cfg.OllamaBaseURL, cfg.EmbeddingModel)
	case "gemini":
		if cfg.GeminiApiKey != "" {
			log.Println("embeddings: Gemini (text-embedding-004, 384 dims)")
			return NewGeminiEmbeddingProvider(cfg.GeminiApiKey)
		}
		log.Println("embeddings: GEMINI_API_KEY missing, falling back to mock")
	}

	log.Printf("embeddings: mock provider (%d dims)", DefaultEmbeddingDimensions)
	return NewMockEmbeddingProvider()
}
