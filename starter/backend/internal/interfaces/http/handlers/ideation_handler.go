package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	appai "aurora-backend/internal/application/ai"
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

// ─── Handler ────────────────────────────────────────────────────────

// IdeationHandler gestiona la entrevista adaptativa de ideación y las
// sugerencias enriquecidas con RAG para la pre-creación de proyectos MGA.
type IdeationHandler struct {
	repo      KnowledgeStore
	chatRepo  ChatStore
	embedder  services.EmbeddingProvider
	anthropic LLMClient
	gemini    LLMClient
	telemetry *services.TelemetryService
	cfg       *config.Config
	db        *gorm.DB
}

// NewIdeationHandler constructor con dependencias de producción.
func NewIdeationHandler(db *gorm.DB, cfg *config.Config, telemetry *services.TelemetryService) *IdeationHandler {
	return &IdeationHandler{
		repo:      postgres.NewAiKnowledgeRepository(db),
		chatRepo:  postgres.NewAiChatRepository(db),
		embedder:  services.NewEmbeddingProvider(cfg),
		anthropic: llm.NewAnthropicClient(cfg.AnthropicApiKey, cfg.AnthropicModel),
		gemini:    llm.NewGeminiClient(cfg.GeminiApiKey, cfg.GeminiModel),
		telemetry: telemetry,
		cfg:       cfg,
		db:        db,
	}
}

// ─── POST /api/v1/ai/ideation/chat ─────────────────────────────────

// Chat ejecuta un turno de la entrevista adaptativa de ideación.
//
// Flujo:
//  1. Valida identidad y parsea request.
//  2. Carga el historial de la sesión para contar turnos y construir
//     el contexto del LLM.
//  3. Genera contexto RAG con vector search global.
//  4. Construye el system prompt con conciencia de turno (force-close
//     al alcanzar MaxIdeationTurns).
//  5. Envía al LLM (Anthropic → fallback Gemini).
//  6. Detecta [CONTEXTO_COMPLETO] en la respuesta.
//  7. Persiste el par de mensajes (usuario + asistente).
//  8. Devuelve IdeationChatResponse con is_complete.
func (h *IdeationHandler) Chat(c *fiber.Ctx) error {
	userID, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}
	role, _ := c.Locals(httpmw.LocalsRole).(string)

	var req dto.IdeationChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Message = strings.TrimSpace(req.Message)
	req.SessionID = strings.TrimSpace(req.SessionID)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	sessionID := req.SessionID
	if sessionID == "" {
		sessionID = uuid.New().String()
	}

	// ── Historial y conteo de turnos ──────────────────────────────
	history, err := h.chatRepo.ListBySession(c.Context(), userID, sessionID, 40)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "no se pudo cargar el historial de la sesión",
		})
	}

	userTurnCount := 0
	for _, msg := range history {
		if msg.Role == models.ChatRoleUser {
			userTurnCount++
		}
	}
	currentTurn := userTurnCount + 1 // incluye el mensaje actual

	// ── RAG: vector search global ─────────────────────────────────
	ragContext := h.buildIdeationRAG(c, req.Message)

	// ── System prompt con conciencia de turno ─────────────────────
	system := appai.BuildIdeationInterviewSystemPrompt(ragContext, currentTurn)

	// ── Construir mensajes para el LLM ────────────────────────────
	messages := buildLLMMessagesFromHistory(history, req.Message)

	// ── Invocar LLM (Anthropic → Gemini fallback) ─────────────────
	selectedModel := appai.ResolveModel(appai.IntentProjectCreationInterview, h.cfg)
	raw, responseModel, err := h.ideationCompleteWithFallback(system, messages, selectedModel)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("no se pudo contactar a Aurora (proveedores IA): %v", err),
		})
	}

	// ── Detección de completitud ──────────────────────────────────
	isComplete := appai.IsContextComplete(raw)
	reply := raw
	if isComplete {
		reply = appai.CleanContextCompleteKeyword(raw)
	}

	// ── Persistir par de mensajes ─────────────────────────────────
	tenantIDPtr := &tenantID
	routeCtx := appai.RouteContextIdeationInterview

	userMsg := postgres.NewChatMessage(
		userID, tenantIDPtr, sessionID,
		models.ChatRoleUser, req.Message, "", "[]", routeCtx,
	)
	assistantMsg := postgres.NewChatMessage(
		userID, tenantIDPtr, sessionID,
		models.ChatRoleAssistant, reply, responseModel, "[]", routeCtx,
	)

	if err := h.chatRepo.SavePair(c.Context(), postgres.ChatMessagePair{
		User:      userMsg,
		Assistant: assistantMsg,
	}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "no se pudo persistir el historial de ideación",
		})
	}

	// ── Telemetría ────────────────────────────────────────────────
	if h.telemetry != nil {
		h.telemetry.LogCopilotAsync(userID, role, appai.IntentProjectCreationInterview, responseModel)
	}

	return c.JSON(dto.IdeationChatResponse{
		Reply:       reply,
		IsComplete:  isComplete,
		SessionID:   sessionID,
		Model:       responseModel,
		UserMsgID:   userMsg.ID.String(),
		AssistantID: assistantMsg.ID.String(),
	})
}

// ─── POST /api/v1/ai/ideation/suggest ───────────────────────────────

// SuggestProjectSetup genera sugerencias enriquecidas con RAG para el
// formulario de creación de proyecto, a partir del historial de ideación.
//
// Flujo:
//  1. Toma el preCreationContext (historial de la entrevista).
//  2. Realiza vector search global para recuperar proyectos MGA similares.
//  3. Pasa el historial + RAG al LLM para generar sugerencias de
//     Proceso, Objeto, Localización y Sector.
//  4. Resuelve los nombres sugeridos contra la BD para obtener IDs
//     válidos inyectables en el formulario.
//  5. Devuelve el JSON con sugerencias precisas.
func (h *IdeationHandler) SuggestProjectSetup(c *fiber.Ctx) error {
	userID, _, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}
	role, _ := c.Locals(httpmw.LocalsRole).(string)

	var req dto.SuggestProjectSetupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	// ── Concatenar contexto de la entrevista ──────────────────────
	ctxStr := strings.Join(req.PreCreationContext, "\n")

	// ── RAG: vector search global ─────────────────────────────────
	ragContext := h.buildIdeationRAG(c, ctxStr)

	// ── Serializar datos actuales del formulario ──────────────────
	cfdStr := ""
	if req.CurrentFormData != nil && len(req.CurrentFormData) > 0 {
		cfdBytes, err := json.Marshal(req.CurrentFormData)
		if err == nil {
			cfdStr = string(cfdBytes)
		}
	}

	// ── Prompt para generación de sugerencias ─────────────────────
	prompt := appai.BuildSuggestProjectSetupPrompt(ctxStr, ragContext, cfdStr)
	messages := []llm.Message{{Role: "user", Content: prompt}}
	selectedModel := appai.ResolveModel(appai.IntentMGAGenerate, h.cfg)

	raw, responseModel, err := h.ideationCompleteWithFallback("", messages, selectedModel)
	if err != nil {
		log.Printf("[IdeationHandler] SuggestProjectSetup LLM error: %v", err)
		// Fallback degradado: devolver sugerencias vacías en vez de error 502
		return c.JSON(dto.SuggestProjectSetupResponse{
			Suggestions: dto.ProjectSetupSuggestions{},
		})
	}

	// ── Parsear JSON del LLM ──────────────────────────────────────
	llmSuggestion := parseSuggestionsFromLLMResponse(raw)

	// ── Resolver nombres a IDs de BD ──────────────────────────────
	suggestions := h.resolveIdsFromSuggestions(c, llmSuggestion)

	// ── Telemetría ────────────────────────────────────────────────
	now := time.Now().UTC()
	usageLog := models.AiUsageLog{
		ID:        uuid.New(),
		UserID:    userID,
		Role:      role,
		Action:    "suggest_project_setup_rag",
		Intent:    "project_ideation",
		Model:     responseModel,
		CreatedAt: now,
	}
	if err := h.db.WithContext(c.Context()).Create(&usageLog).Error; err != nil {
		log.Printf("[IdeationHandler] warn: failed to persist usage log: %v", err)
	}

	if h.telemetry != nil {
		h.telemetry.LogCopilotAsync(userID, role, appai.IntentMGAGenerate, responseModel)
	}

	return c.JSON(dto.SuggestProjectSetupResponse{
		Suggestions: suggestions,
	})
}

// ─── Helpers privados ───────────────────────────────────────────────

// buildIdeationRAG genera contexto RAG para la ideación usando vector
// search global contra el Knowledge Graph de Aurora.
func (h *IdeationHandler) buildIdeationRAG(c *fiber.Ctx, query string) string {
	if strings.TrimSpace(query) == "" {
		return ""
	}
	vec, err := h.embedder.Embed(query)
	if err != nil {
		log.Printf("[IdeationHandler] embedding error (degraded mode): %v", err)
		return ""
	}
	nodes, err := h.repo.SearchSimilarGlobal(c.Context(), vec, 8)
	if err != nil || len(nodes) == 0 {
		return ""
	}
	return formatKnowledgeNodes(nodes)
}

// buildLLMMessagesFromHistory convierte el historial persistido +
// el mensaje actual en un slice de llm.Message para el LLM.
func buildLLMMessagesFromHistory(history []models.AiChatMessage, currentMessage string) []llm.Message {
	messages := make([]llm.Message, 0, len(history)+1)
	for _, m := range history {
		role := strings.TrimSpace(m.Role)
		if role != models.ChatRoleUser && role != models.ChatRoleAssistant {
			continue
		}
		content := strings.TrimSpace(m.Content)
		if content == "" {
			continue
		}
		messages = append(messages, llm.Message{Role: role, Content: content})
	}
	messages = append(messages, llm.Message{Role: models.ChatRoleUser, Content: currentMessage})
	return messages
}

// ideationCompleteWithFallback intenta Anthropic; si falla, reintenta
// con Google Gemini como proveedor de contingencia.
func (h *IdeationHandler) ideationCompleteWithFallback(
	system string,
	messages []llm.Message,
	selectedModel string,
) (raw string, telemetryModel string, err error) {
	raw, err = h.anthropic.ChatWithModel(system, messages, selectedModel)
	if err == nil {
		return raw, selectedModel, nil
	}

	anthropicErr := err
	log.Printf("[IdeationHandler] Anthropic failed (%v). Retrying with Gemini…", anthropicErr)

	if h.gemini == nil {
		return "", "", anthropicErr
	}

	geminiModel := h.cfg.GeminiModel
	if strings.TrimSpace(geminiModel) == "" {
		geminiModel = llm.DefaultGeminiModel
	}

	raw, err = h.gemini.ChatWithModel(system, messages, geminiModel)
	if err != nil {
		return "", "", fmt.Errorf("anthropic: %v; gemini: %w", anthropicErr, err)
	}

	telemetryModel = llm.FormatTelemetryModel(llm.TelemetryGeminiFallback, geminiModel)
	return raw, telemetryModel, nil
}

// ─── Parser de sugerencias del LLM ──────────────────────────────────

// llmSuggestionsRaw estructura intermedia del JSON que devuelve el LLM.
type llmSuggestionsRaw struct {
	Nombre               []string    `json:"nombre"`
	Proceso              []string    `json:"proceso"`
	Objeto               []string    `json:"objeto"`
	Localizaciones       interface{} `json:"localizaciones"`
	SectorSugerido       []string    `json:"sector_sugerido"`
	ProductoPrincipal    []string    `json:"producto_principal"`
}

// parseSuggestionsFromLLMResponse extrae el JSON de sugerencias de la
// respuesta cruda del LLM, tolerando markdown code-fences.
func parseSuggestionsFromLLMResponse(raw string) llmSuggestionsRaw {
	var result llmSuggestionsRaw

	cleaned := strings.TrimSpace(raw)

	// Quitar code-fences de markdown si el LLM las incluye
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```JSON")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		// Fallback: buscar el primer bloque JSON válido en la respuesta
		start := strings.Index(raw, "{")
		end := strings.LastIndex(raw, "}")
		if start >= 0 && end > start {
			jsonStr := raw[start : end+1]
			_ = json.Unmarshal([]byte(jsonStr), &result)
		}
	}

	return result
}

// ─── Resolución de IDs contra la BD ─────────────────────────────────

// resolveIdsFromSuggestions busca en la BD los IDs reales del proceso y
// sector sugeridos por el LLM. Si no encuentra coincidencia, devuelve
// los textos originales para que el usuario los use como guía visual.
func (h *IdeationHandler) resolveIdsFromSuggestions(
	c *fiber.Ctx,
	raw llmSuggestionsRaw,
) dto.ProjectSetupSuggestions {
	suggestions := dto.ProjectSetupSuggestions{
		Nombre:            raw.Nombre,
		Proceso:           raw.Proceso,
		Objeto:            raw.Objeto,
		Localizaciones:    raw.Localizaciones,
		SectorId:          []string{},
		ProductoPrincipal: raw.ProductoPrincipal,
	}

	// ── Resolver Sector: nombre → UUID ───────────────────────────
	for _, sectorName := range raw.SectorSugerido {
		if sn := strings.TrimSpace(sectorName); sn != "" {
			var sector models.Sector
			err := h.db.WithContext(c.Context()).
				Where("LOWER(nombre) LIKE ?", "%"+strings.ToLower(sn)+"%").
				First(&sector).Error
			if err == nil && sector.ID != uuid.Nil {
				suggestions.SectorId = append(suggestions.SectorId, sector.ID.String())
			}
		}
	}

	return suggestions
}
