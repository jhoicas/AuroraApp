package handlers

import (
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

	"aurora-backend/internal/config"
	"aurora-backend/internal/domain/constants"
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

type AIHandler struct {
	db        *gorm.DB
	telemetry *services.TelemetryService
	repo      KnowledgeStore
	embedder  services.EmbeddingProvider
}

func NewAIHandler(db *gorm.DB, telemetry *services.TelemetryService, cfg *config.Config) *AIHandler {
	repo := postgres.NewAiKnowledgeRepository(db)
	embedder := services.NewEmbeddingProvider(cfg)
	return &AIHandler{
		db:        db,
		telemetry: telemetry,
		repo:      repo,
		embedder:  embedder,
	}
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
func (h *AIHandler) SuggestField(c *fiber.Ctx) error {
	userID, _, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	var req dto.SuggestFieldRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}

	req.FieldHelpKey = strings.TrimSpace(req.FieldHelpKey)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	sector, _ := req.ProjectContext["sector"].(string)
	projectName, _ := req.ProjectContext["projectName"].(string)
	query := fmt.Sprintf("%s - %s: %s", sector, projectName, req.FieldHelpKey)

	vec, errEmb := h.embedder.Embed(query)
	var examplesStr string
	if errEmb == nil {
		nodes, errSearch := h.repo.SearchSimilarGlobal(c.Context(), vec, 3)
		if errSearch == nil && len(nodes) > 0 {
			var examples []string
			for _, n := range nodes {
				examples = append(examples, n.Content)
			}
			examplesStr = strings.Join(examples, "\n\n")
		} else {
			examplesStr = "No hay ejemplos previos"
		}
	} else {
		examplesStr = "No hay ejemplos previos"
	}

	ctxStr := fmt.Sprintf("%v", req.ProjectContext)

	fieldRule := "Aplica los criterios estándar de la MGA."
	switch req.FieldHelpKey {
	case "situacion_existente":
		fieldRule = "Narra el contexto histórico y las condiciones actuales. Usa tono descriptivo."
	case "magnitud_problema":
		fieldRule = "Describe el problema cuantitativamente. Propone indicadores de referencia realistas o líneas base."
	case "causas", "efectos":
		fieldRule = "Redacta una única frase corta que exprese una condición negativa."
	}

	// 3. Generación Adaptativa
	prompt := fmt.Sprintf("Eres un experto estructurador del DNP (Colombia) en metodología MGA.\nCONTEXTO DEL PROYECTO ACTUAL: %v.\nEJEMPLOS DE PROYECTOS SIMILARES (Historial de Aurora): [%s]\nINSTRUCCIÓN: Si hay ejemplos similares relevantes, utilízalos como inspiración para mantener la misma línea técnica. Si no hay ejemplos, genéralo basándote en tu conocimiento del DNP.\nREGLA DEL CAMPO: %s", ctxStr, examplesStr, fieldRule)
	
	if req.IsList {
		optionsStr := fmt.Sprintf("%v", req.ListOptions)
		prompt += fmt.Sprintf("\nDebes elegir la opción más adecuada de este catálogo: %s. REGLA ESTRICTA DE FORMATO: Devuelve la respuesta utilizando EXCLUSIVAMENTE este formato: CODIGO|||Explicación detallada y amigable para el usuario de por qué se eligió esta opción (no menciones el código en la explicación).", optionsStr)
	} else {
		prompt += fmt.Sprintf("\nREGLA ESTRICTA: Devuelve ÚNICAMENTE el texto sugerido para el campo '%s'. NO incluyas saludos, explicaciones, opciones alternativas, comillas, ni formato markdown. Escribe directamente el valor final a insertar.", req.FieldHelpKey)
	}

	if req.MaxLength > 0 {
		prompt += fmt.Sprintf("\nREGLA CRÍTICA Y ESTRICTA: Tu respuesta FINAL NO DEBE SUPERAR los %d caracteres en total (incluyendo espacios). Resume la idea. Si te pasas, el sistema fallará.", req.MaxLength)
	}

	// Simular la llamada al LLM
	suggestion, err := h.callLLM(prompt)
	if err != nil {
		if strings.Contains(err.Error(), "⏳ Por favor, espera") {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "RATE_LIMIT_EXCEEDED"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Error generando sugerencia: " + err.Error()})
	}
	// Loggear la petición en AI usage si es necesario
	now := time.Now().UTC()
	
	usageLog := models.AiUsageLog{
		ID:        uuid.New(),
		UserID:    userID,
		Role:      constants.AIRoleUser,
		Action:    "suggest_field",
		Intent:    req.FieldHelpKey,
		Model:     constants.AIMockModel,
		CreatedAt: now,
	}
	h.db.WithContext(c.Context()).Create(&usageLog)

	return c.JSON(dto.SuggestFieldResponse{
		Suggestion: suggestion,
	})
}

func (h *AIHandler) callLLM(prompt string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY no configurada")
	}
	client := llm.NewGeminiClient(apiKey, "")
	messages := []llm.Message{{Role: "user", Content: prompt}}
	resp, err := client.Chat("", messages)
	if err != nil {
		return "", err
	}
	return resp, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
