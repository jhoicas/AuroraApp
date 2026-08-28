package handlers

import (
	"encoding/json"
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
	repo      KnowledgeStore
	chatRepo  ChatStore
	embedder  services.EmbeddingProvider
	anthropic LLMClient
	telemetry *services.TelemetryService
}

func NewAuroraChatHandler(db *gorm.DB, cfg *config.Config, telemetry *services.TelemetryService) *AuroraChatHandler {
	return NewAuroraChatHandlerWithDeps(
		postgres.NewAiKnowledgeRepository(db),
		postgres.NewAiChatRepository(db),
		services.NewEmbeddingProvider(cfg),
		llm.NewAnthropicClient(cfg.AnthropicApiKey, cfg.AnthropicModel),
		telemetry,
	)
}

// NewAuroraChatHandlerWithDeps inyección explícita de dependencias (tests / DI).
func NewAuroraChatHandlerWithDeps(
	repo KnowledgeStore,
	chatRepo ChatStore,
	embedder services.EmbeddingProvider,
	anthropic LLMClient,
	telemetry *services.TelemetryService,
) *AuroraChatHandler {
	return &AuroraChatHandler{
		repo:      repo,
		chatRepo:  chatRepo,
		embedder:  embedder,
		anthropic: anthropic,
		telemetry: telemetry,
	}
}

// Chat POST /api/v1/ai/aurora/chat — Anthropic + RAG + persistencia transaccional.
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
	req.RouteContext = strings.TrimSpace(req.RouteContext)
	req.SessionID = strings.TrimSpace(req.SessionID)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	sessionID := req.SessionID
	if sessionID == "" {
		sessionID = uuid.New().String()
	}

	tenantID := optionalTenantID(c)

	ragContext := h.buildRAGContext(c, tenantID, req.Message)
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
	cardsJSON, _ := json.Marshal(cards)

	userMsg := postgres.NewChatMessage(
		userID, tenantID, sessionID,
		models.ChatRoleUser, req.Message, "", "[]", req.RouteContext,
	)
	assistantMsg := postgres.NewChatMessage(
		userID, tenantID, sessionID,
		models.ChatRoleAssistant, reply, h.anthropic.Model(), string(cardsJSON), req.RouteContext,
	)

	if err := h.chatRepo.SavePair(c.Context(), postgres.ChatMessagePair{
		User:      userMsg,
		Assistant: assistantMsg,
	}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to persist chat history"})
	}

	if h.telemetry != nil {
		h.telemetry.LogAsync(userID, role, models.TelemetryAskCopilot)
	}

	return c.JSON(dto.AuroraChatResponse{
		Reply:       reply,
		ActionCards: cards,
		Model:       h.anthropic.Model(),
		SessionID:   sessionID,
		UserMsgID:   userMsg.ID.String(),
		AssistantID: assistantMsg.ID.String(),
	})
}

func (h *AuroraChatHandler) buildRAGContext(c *fiber.Ctx, tenantID *uuid.UUID, query string) string {
	vec, err := h.embedder.Embed(query)
	if err != nil {
		return ""
	}
	nodes, err := h.repo.SearchSimilar(c.Context(), tenantID, vec, 6)
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
