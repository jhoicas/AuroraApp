package handlers

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AIHandler struct {
	db        *gorm.DB
	telemetry *services.TelemetryService
}

func NewAIHandler(db *gorm.DB, telemetry *services.TelemetryService) *AIHandler {
	return &AIHandler{db: db, telemetry: telemetry}
}

func (h *AIHandler) Chat(c *fiber.Ctx) error {
	userID, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	var req dto.ChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}

	req.Message = strings.TrimSpace(req.Message)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var projectID *uuid.UUID
	var projectIDStr *string
	if req.ProjectID != nil && strings.TrimSpace(*req.ProjectID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*req.ProjectID))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project_id"})
		}

		var count int64
		if err := h.db.WithContext(c.Context()).
			Model(&models.Project{}).
			Where("id = ? AND tenant_id = ?", parsed, tenantID).
			Count(&count).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify project"})
		}
		if count == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}

		projectID = &parsed
		s := parsed.String()
		projectIDStr = &s
	}

	reply := mockAIReply(req.Message)
	now := time.Now().UTC()

	userLog := models.AILog{
		ID:        uuid.New(),
		TenantID:  tenantID,
		UserID:    userID,
		ProjectID: projectID,
		Role:      constants.AIRoleUser,
		Content:   req.Message,
		Model:     "",
		CreatedAt: now,
	}
	assistantLog := models.AILog{
		ID:         uuid.New(),
		TenantID:   tenantID,
		UserID:     userID,
		ProjectID:  projectID,
		Role:       constants.AIRoleAssistant,
		Content:    reply,
		Model:      constants.AIMockModel,
		TokensUsed: 0,
		CreatedAt:  now.Add(time.Millisecond),
	}

	err = h.db.WithContext(c.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&userLog).Error; err != nil {
			return err
		}
		return tx.Create(&assistantLog).Error
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to persist ai logs"})
	}

	if h.telemetry != nil {
		role, _ := c.Locals(httpmw.LocalsRole).(string)
		h.telemetry.LogAsync(userID, role, models.TelemetryAskCopilot)
	}

	return c.JSON(dto.ChatResponse{
		Reply:              reply,
		Model:              constants.AIMockModel,
		UserMessageID:      userLog.ID.String(),
		AssistantMessageID: assistantLog.ID.String(),
		ProjectID:          projectIDStr,
	})
}

func (h *AIHandler) History(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	var count int64
	if err := h.db.WithContext(c.Context()).
		Model(&models.Project{}).
		Where("id = ? AND tenant_id = ?", projectID, tenantID).
		Count(&count).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify project"})
	}
	if count == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "50"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	q := h.db.WithContext(c.Context()).
		Model(&models.AILog{}).
		Where("tenant_id = ? AND project_id = ?", tenantID, projectID)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count messages"})
	}

	var logs []models.AILog
	if err := q.Order("created_at ASC").Limit(pageSize).Offset(offset).Find(&logs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load history"})
	}

	data := make([]dto.AIMessageResponse, 0, len(logs))
	for _, l := range logs {
		data = append(data, toAIMessageResponse(l))
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))
	if totalPages == 0 {
		totalPages = 1
	}

	return c.JSON(dto.PaginatedAIMessagesResponse{
		Data:       data,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	})
}

func mockAIReply(message string) string {
	return fmt.Sprintf(
		"[Aurora Mock] He recibido tu mensaje sobre formulación MGA: %q. "+
			"En la siguiente iteración conectaremos el modelo real para sugerir árbol de problemas, objetivos y productos del catálogo.",
		message,
	)
}

func toAIMessageResponse(l models.AILog) dto.AIMessageResponse {
	var projectID *string
	if l.ProjectID != nil {
		s := l.ProjectID.String()
		projectID = &s
	}
	return dto.AIMessageResponse{
		ID:        l.ID.String(),
		Role:      l.Role,
		Content:   l.Content,
		Model:     l.Model,
		ProjectID: projectID,
		CreatedAt: l.CreatedAt.UTC().Format(time.RFC3339),
	}
}
