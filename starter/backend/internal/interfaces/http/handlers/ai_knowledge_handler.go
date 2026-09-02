package handlers

import (
	"fmt"
	"strings"
	"time"

	"aurora-backend/internal/config"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AIKnowledgeHandler struct {
	repo      KnowledgeStore
	embedder  services.EmbeddingProvider
	telemetry *services.TelemetryService
}

func NewAIKnowledgeHandler(db *gorm.DB, cfg *config.Config, telemetry *services.TelemetryService) *AIKnowledgeHandler {
	return NewAIKnowledgeHandlerWithDeps(
		postgres.NewAiKnowledgeRepository(db),
		services.NewEmbeddingProvider(cfg),
		telemetry,
	)
}

// NewAIKnowledgeHandlerWithDeps inyección explícita de dependencias (tests / DI).
func NewAIKnowledgeHandlerWithDeps(
	repo KnowledgeStore,
	embedder services.EmbeddingProvider,
	telemetry *services.TelemetryService,
) *AIKnowledgeHandler {
	return &AIKnowledgeHandler{
		repo:      repo,
		embedder:  embedder,
		telemetry: telemetry,
	}
}

func (h *AIKnowledgeHandler) logTelemetry(c *fiber.Ctx, action string) {
	if h.telemetry == nil {
		return
	}
	userIDStr, _ := c.Locals(httpmw.LocalsUserID).(string)
	role, _ := c.Locals(httpmw.LocalsRole).(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return
	}
	h.telemetry.LogAsync(userID, role, action)
}

// IngestKnowledge POST /api/v1/ai/knowledge/ingest
func (h *AIKnowledgeHandler) IngestKnowledge(c *fiber.Ctx) error {
	tenantID := optionalTenantID(c)

	file, err := c.FormFile("file")
	if err != nil || file == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "se requiere un archivo XML en el campo 'file'"})
	}

	filename := strings.ToLower(file.Filename)
	if !strings.HasSuffix(filename, ".xml") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "solo se aceptan archivos .xml MGA"})
	}

	opened, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "no se pudo leer el archivo"})
	}
	defer opened.Close()

	meta, graph, err := services.ParseMGAProjectXML(opened, file.Filename)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	exists, err := h.repo.ExistsByProjectKey(c.Context(), meta.ProjectKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "no se pudo verificar duplicados en la base de conocimiento"})
	}
	if exists {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": fmt.Sprintf(
				"El proyecto con BPIN/Clave '%s' ya existe en la base de conocimiento y no puede ser duplicado.",
				meta.ProjectKey,
			),
		})
	}

	projectMeta := map[string]string{
		"project_key":  meta.ProjectKey,
		"project_name": meta.ProjectName,
		"sector":       meta.Sector,
		"phase":        meta.Phase,
		"source_file":  file.Filename,
	}

	batch := postgres.KnowledgeGraphBatch{
		Nodes: make([]postgres.KnowledgeNodeInput, 0, len(graph.Nodes)),
		Links: make([]postgres.KnowledgeLinkInput, 0, len(graph.Links)),
	}
	counts := map[string]int{}

	for _, node := range graph.Nodes {
		metaJSON, err := postgres.MergeMetadata(node.Metadata, projectMeta)
		if err != nil {
			metaJSON = "{}"
		}

		embedding, err := h.embedder.Embed(node.Content)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "falló la generación de embeddings"})
		}

		batch.Nodes = append(batch.Nodes, postgres.KnowledgeNodeInput{
			LocalID: node.LocalID,
			Node: models.AiKnowledgeNode{
				ID:         uuid.New(),
				TenantID:   tenantID,
				ProjectKey: meta.ProjectKey,
				NodeType:   node.NodeType,
				Label:      node.Label,
				Content:    node.Content,
				Metadata:   metaJSON,
				CreatedAt:  time.Now().UTC(),
			},
			Embedding: embedding,
		})
		if node.NodeType != models.KnowledgeNodeProject {
			counts[node.NodeType]++
		}
	}

	for _, link := range graph.Links {
		batch.Links = append(batch.Links, postgres.KnowledgeLinkInput{
			SourceLocalID: link.SourceLocalID,
			TargetLocalID: link.TargetLocalID,
			Link: models.AiKnowledgeLink{
				ID:           uuid.New(),
				TenantID:     tenantID,
				ProjectKey:   meta.ProjectKey,
				Relationship: link.Relationship,
				CreatedAt:    time.Now().UTC(),
			},
		})
	}

	if err := h.repo.InsertGraph(c.Context(), batch); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "no se pudieron guardar los nodos de conocimiento"})
	}

	h.logTelemetry(c, models.TelemetryIngestXML)

	summary := dto.KnowledgeIngestSummary{
		ProjectKey:        meta.ProjectKey,
		ProjectName:       meta.ProjectName,
		NodesCreated:      len(batch.Nodes),
		LinksCreated:      len(batch.Links),
		Alternatives:      counts[models.KnowledgeNodeAlternative],
		Products:          counts[models.KnowledgeNodeProduct],
		Activities:        counts[models.KnowledgeNodeActivity],
		Causes:            counts[models.KnowledgeNodeCause],
		Effects:           counts[models.KnowledgeNodeEffect],
		CentralProblem:    counts[models.KnowledgeNodeCentralProblem] > 0,
		SpecificObjective: counts[models.KnowledgeNodeSpecificObjective] > 0,
		Message: fmt.Sprintf(
			"Se aprendieron %d alternativas, %d productos y %d actividades del proyecto %s (%d relaciones)",
			counts[models.KnowledgeNodeAlternative],
			counts[models.KnowledgeNodeProduct],
			counts[models.KnowledgeNodeActivity],
			meta.ProjectName,
			len(batch.Links),
		),
	}

	return c.Status(fiber.StatusCreated).JSON(summary)
}

// GetKnowledgeGraph GET /api/v1/ai/knowledge/graph
func (h *AIKnowledgeHandler) GetKnowledgeGraph(c *fiber.Ctx) error {
	tenantID := optionalTenantID(c)
	rows, err := h.repo.ListAllNodes(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "no se pudo cargar el grafo de conocimiento"})
	}

	links, err := h.repo.ListAllLinks(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "no se pudieron cargar las relaciones"})
	}

	nodes := make([]dto.KnowledgeGraphNode, 0, len(rows))
	for _, row := range rows {
		nodes = append(nodes, dto.KnowledgeGraphNode{
			ID:      row.ID.String(),
			Label:   row.Label,
			Type:    row.NodeType,
			Group:   row.ProjectKey,
			Content: truncate(row.Content, 500),
		})
	}

	graphLinks := make([]dto.KnowledgeGraphLink, 0, len(links))
	for _, l := range links {
		graphLinks = append(graphLinks, dto.KnowledgeGraphLink{
			Source:       l.SourceNodeID.String(),
			Target:       l.TargetNodeID.String(),
			Relationship: l.Relationship,
		})
	}

	return c.JSON(dto.KnowledgeGraphResponse{Nodes: nodes, Links: graphLinks})
}

// optionalTenantID retorna nil para identidades globales (SUPER_ADMIN). Auth
// ya valida cualquier tenant_id presente antes de guardarlo en Locals.
func optionalTenantID(c *fiber.Ctx) *uuid.UUID {
	tidRaw, _ := c.Locals(httpmw.LocalsTenantID).(string)
	tid, err := uuid.Parse(strings.TrimSpace(tidRaw))
	if err != nil {
		return nil
	}
	return &tid
}

type AITelemetryHandler struct {
	telemetry *services.TelemetryService
}

func NewAITelemetryHandler(telemetry *services.TelemetryService) *AITelemetryHandler {
	return &AITelemetryHandler{telemetry: telemetry}
}

func (h *AITelemetryHandler) log(userID uuid.UUID, role, action string) {
	if h.telemetry == nil {
		return
	}
	h.telemetry.LogAsync(userID, role, action)
}

// LogTelemetry POST /api/v1/ai/telemetry/log
func (h *AITelemetryHandler) LogTelemetry(c *fiber.Ctx) error {
	var req dto.TelemetryLogRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Action = strings.TrimSpace(req.Action)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	userIDStr, _ := c.Locals(httpmw.LocalsUserID).(string)
	role, _ := c.Locals(httpmw.LocalsRole).(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid user"})
	}

	h.log(userID, role, req.Action)
	return c.JSON(fiber.Map{"ok": true})
}

func truncate(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
