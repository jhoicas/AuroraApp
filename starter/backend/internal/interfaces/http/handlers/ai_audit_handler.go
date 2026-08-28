package handlers

import (
	"html"
	"math"
	"strconv"
	"strings"
	"time"

	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type AIAuditHandler struct {
	usageRepo UsageLogStore
	chatRepo  ChatStore
}

func NewAIAuditHandler(db *gorm.DB) *AIAuditHandler {
	return NewAIAuditHandlerWithDeps(
		postgres.NewAiUsageLogRepository(db),
		postgres.NewAiChatRepository(db),
	)
}

// NewAIAuditHandlerWithDeps inyección explícita de dependencias (tests / DI).
func NewAIAuditHandlerWithDeps(usageRepo UsageLogStore, chatRepo ChatStore) *AIAuditHandler {
	return &AIAuditHandler{usageRepo: usageRepo, chatRepo: chatRepo}
}

func (h *AIAuditHandler) ListUsageLogs(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	rows, total, err := h.usageRepo.ListPaginated(c.Context(), page, pageSize)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "query failed"})
	}

	data := make([]dto.AuditUsageLogItem, 0, len(rows))
	for _, r := range rows {
		data = append(data, dto.AuditUsageLogItem{
			ID:        r.ID.String(),
			UserID:    r.UserID.String(),
			Role:      sanitizeText(r.Role),
			Action:    sanitizeText(r.Action),
			CreatedAt: r.CreatedAt.UTC().Format(time.RFC3339),
		})
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))
	if totalPages == 0 {
		totalPages = 1
	}

	return c.JSON(dto.PaginatedAuditResponse[dto.AuditUsageLogItem]{
		Data:       data,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *AIAuditHandler) ListChatMessages(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))

	rows, total, err := h.chatRepo.ListPaginated(c.Context(), page, pageSize)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "query failed"})
	}

	data := make([]dto.AuditChatMessageItem, 0, len(rows))
	for _, r := range rows {
		data = append(data, dto.AuditChatMessageItem{
			ID:           r.ID.String(),
			UserID:       r.UserID.String(),
			Role:         sanitizeText(r.Role),
			Content:      sanitizeText(r.Content),
			Model:        sanitizeText(r.Model),
			RouteContext: sanitizeText(r.RouteContext),
			CreatedAt:    r.CreatedAt.UTC().Format(time.RFC3339),
		})
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))
	if totalPages == 0 {
		totalPages = 1
	}

	return c.JSON(dto.PaginatedAuditResponse[dto.AuditChatMessageItem]{
		Data:       data,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	})
}

func sanitizeText(s string) string {
	s = strings.TrimSpace(s)
	return html.EscapeString(s)
}
