package handlers

import (
	"context"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/llm"
	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/google/uuid"
)

// KnowledgeStore abstrae el repositorio de la Knowledge Base MGA (pgvector).
type KnowledgeStore interface {
	InsertGraph(ctx context.Context, batch postgres.KnowledgeGraphBatch) error
	ListAllNodes(ctx context.Context, tenantID *uuid.UUID) ([]models.AiKnowledgeNode, error)
	ListAllLinks(ctx context.Context, tenantID *uuid.UUID) ([]models.AiKnowledgeLink, error)
	SearchSimilar(ctx context.Context, tenantID *uuid.UUID, embedding []float32, limit int) ([]models.AiKnowledgeNode, error)
	SearchSimilarByNodeTypes(ctx context.Context, embedding []float32, limit int, nodeTypes []string) ([]models.AiKnowledgeNode, error)
}

// ChatStore abstrae la persistencia transaccional del historial de Aurora.
type ChatStore interface {
	SavePair(ctx context.Context, pair postgres.ChatMessagePair) error
	ListPaginated(ctx context.Context, page, pageSize int) ([]models.AiChatMessage, int64, error)
}

// UsageLogStore abstrae la lectura paginada de telemetría para auditoría.
type UsageLogStore interface {
	ListPaginated(ctx context.Context, page, pageSize int) ([]postgres.AiUsageLogAuditRow, int64, error)
}

// ProjectFinder resuelve ownership multi-tenant de proyectos.
type ProjectFinder interface {
	FindOwned(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error)
}

// LLMClient abstrae proveedores de lenguaje (Anthropic primario, Gemini contingencia).
type LLMClient interface {
	Chat(systemPrompt string, messages []llm.Message) (string, error)
	ChatWithModel(systemPrompt string, messages []llm.Message, model string) (string, error)
	Model() string
}
