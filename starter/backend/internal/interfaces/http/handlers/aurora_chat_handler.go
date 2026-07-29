package handlers

import (
	"fmt"
	"strings"

	"aurora-backend/internal/config"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"
	"aurora-backend/internal/infrastructure/llm"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuroraChatHandler struct {
	db        *gorm.DB
	repo      *postgres.AiKnowledgeRepository
	embedder  services.EmbeddingProvider
	anthropic *llm.AnthropicClient
	telemetry *services.TelemetryService
}

func NewAuroraChatHandler(db *gorm.DB, cfg *config.Config, telemetry *services.TelemetryService) *AuroraChatHandler {
	return &AuroraChatHandler{
		db:        db,
		repo:      postgres.NewAiKnowledgeRepository(db),
		embedder:  services.NewEmbeddingProvider(cfg),
		anthropic: llm.NewAnthropicClient(cfg.AnthropicApiKey, cfg.AnthropicModel),
		telemetry: telemetry,
	}
}

// Chat POST /api/v1/ai/aurora/chat — Aurora Copilot con Anthropic + RAG MGA.
func (h *AuroraChatHandler) Chat(c *fiber.Ctx) error {
	userIDStr, _ := c.Locals(httpmw.LocalsUserID).(string)
	role, _ := c.Locals(httpmw.LocalsRole).(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid user"})
	}

	var req dto.AuroraChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "message is required"})
	}

	ragContext := h.buildRAGContext(c, req.Message)
	system := buildAuroraSystemPrompt(req.RouteContext, ragContext)

	raw, err := h.anthropic.Chat(system, []llm.Message{
		{Role: "user", Content: req.Message},
	})
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("no se pudo contactar a Aurora (Anthropic): %v", err),
		})
	}

	reply, cards := parseAuroraResponse(raw)

	if h.telemetry != nil {
		h.telemetry.LogAsync(userID, role, models.TelemetryAskCopilot)
	}

	return c.JSON(dto.AuroraChatResponse{
		Reply:       reply,
		ActionCards: cards,
		Model:       h.anthropic.Model(),
	})
}

func (h *AuroraChatHandler) buildRAGContext(c *fiber.Ctx, query string) string {
	vec, err := h.embedder.Embed(query)
	if err != nil {
		return ""
	}
	nodes, err := h.repo.SearchSimilar(c.Context(), vec, 4)
	if err != nil || len(nodes) == 0 {
		return ""
	}
	var b strings.Builder
	for i, n := range nodes {
		excerpt := n.Content
		if len(excerpt) > 400 {
			excerpt = excerpt[:400] + "…"
		}
		fmt.Fprintf(&b, "%d) [%s] %s: %s\n", i+1, n.NodeType, n.Label, excerpt)
	}
	return b.String()
}
