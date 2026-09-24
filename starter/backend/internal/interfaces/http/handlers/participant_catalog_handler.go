package handlers

import (
	"strconv"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// ParticipantCatalogHandler gestiona los catálogos globales MGA de actores,
// entidades y posiciones. Expone tanto rutas públicas (tenant autenticado)
// como rutas de administración (SUPER_ADMIN).
type ParticipantCatalogHandler struct {
	repo *postgres.MgaCatalogRepository
}

func NewParticipantCatalogHandler(db *gorm.DB) *ParticipantCatalogHandler {
	return &ParticipantCatalogHandler{repo: postgres.NewMgaCatalogRepository(db)}
}

// ─── Actores ──────────────────────────────────────────────────────────────────

// ListActors devuelve todos los actores MGA ordenados por ID.
// GET /api/v1/mga/catalogs/actors
func (h *ParticipantCatalogHandler) ListActors(c *fiber.Ctx) error {
	actors, err := h.repo.ListActors(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list actors"})
	}
	resp := make([]dto.MgaCatalogActorResponse, 0, len(actors))
	for _, a := range actors {
		resp = append(resp, dto.MgaCatalogActorResponse{ID: a.ID, Name: a.Name})
	}
	return c.JSON(resp)
}

// CreateActor crea o actualiza (upsert) un actor MGA.
// POST /api/v1/admin/mga/catalogs/actors
func (h *ParticipantCatalogHandler) CreateActor(c *fiber.Ctx) error {
	var req dto.CreateMgaCatalogActorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	now := time.Now().UTC()
	actor := &models.MgaCatalogActor{ID: req.ID, Name: req.Name, CreatedAt: now, UpdatedAt: now}
	if err := h.repo.CreateActor(c.Context(), actor); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create actor"})
	}
	return c.Status(fiber.StatusCreated).JSON(dto.MgaCatalogActorResponse{ID: actor.ID, Name: actor.Name})
}

// UpdateActor actualiza el nombre de un actor.
// PUT /api/v1/admin/mga/catalogs/actors/:id
func (h *ParticipantCatalogHandler) UpdateActor(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid actor id"})
	}
	var req dto.UpdateMgaCatalogActorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	actor := &models.MgaCatalogActor{ID: id, Name: req.Name, UpdatedAt: time.Now().UTC()}
	if err := h.repo.UpdateActor(c.Context(), actor); err != nil {
		if postgres.IsMgaCatalogNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "actor not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update actor"})
	}
	return c.JSON(dto.MgaCatalogActorResponse{ID: actor.ID, Name: actor.Name})
}

// DeleteActor elimina un actor (y sus entidades por CASCADE).
// DELETE /api/v1/admin/mga/catalogs/actors/:id
func (h *ParticipantCatalogHandler) DeleteActor(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid actor id"})
	}
	if err := h.repo.DeleteActor(c.Context(), id); err != nil {
		if postgres.IsMgaCatalogNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "actor not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete actor"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ─── Entidades ────────────────────────────────────────────────────────────────

// ListEntitiesByActor devuelve entidades filtradas por actor_id.
// GET /api/v1/mga/catalogs/actors/:id/entities
func (h *ParticipantCatalogHandler) ListEntitiesByActor(c *fiber.Ctx) error {
	actorID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid actor id"})
	}
	entities, err := h.repo.ListEntitiesByActor(c.Context(), actorID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list entities"})
	}
	resp := make([]dto.MgaCatalogEntityResponse, 0, len(entities))
	for _, e := range entities {
		resp = append(resp, dto.MgaCatalogEntityResponse{ID: e.ID, ActorID: e.ActorID, Name: e.Name})
	}
	return c.JSON(resp)
}

// ListEntities devuelve todas las entidades (admin).
// GET /api/v1/admin/mga/catalogs/entities
func (h *ParticipantCatalogHandler) ListEntities(c *fiber.Ctx) error {
	entities, err := h.repo.ListEntities(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list entities"})
	}
	resp := make([]dto.MgaCatalogEntityResponse, 0, len(entities))
	for _, e := range entities {
		resp = append(resp, dto.MgaCatalogEntityResponse{ID: e.ID, ActorID: e.ActorID, Name: e.Name})
	}
	return c.JSON(resp)
}

// CreateEntity crea o actualiza una entidad MGA.
// POST /api/v1/admin/mga/catalogs/entities
func (h *ParticipantCatalogHandler) CreateEntity(c *fiber.Ctx) error {
	var req dto.CreateMgaCatalogEntityRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	now := time.Now().UTC()
	entity := &models.MgaCatalogEntity{ID: req.ID, ActorID: req.ActorID, Name: req.Name, CreatedAt: now, UpdatedAt: now}
	if err := h.repo.CreateEntity(c.Context(), entity); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create entity"})
	}
	return c.Status(fiber.StatusCreated).JSON(dto.MgaCatalogEntityResponse{ID: entity.ID, ActorID: entity.ActorID, Name: entity.Name})
}

// UpdateEntity actualiza una entidad MGA.
// PUT /api/v1/admin/mga/catalogs/entities/:id
func (h *ParticipantCatalogHandler) UpdateEntity(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid entity id"})
	}
	var req dto.UpdateMgaCatalogEntityRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	entity := &models.MgaCatalogEntity{ID: id, ActorID: req.ActorID, Name: req.Name, UpdatedAt: time.Now().UTC()}
	if err := h.repo.UpdateEntity(c.Context(), entity); err != nil {
		if postgres.IsMgaCatalogNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "entity not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update entity"})
	}
	return c.JSON(dto.MgaCatalogEntityResponse{ID: entity.ID, ActorID: entity.ActorID, Name: entity.Name})
}

// DeleteEntity elimina una entidad MGA.
// DELETE /api/v1/admin/mga/catalogs/entities/:id
func (h *ParticipantCatalogHandler) DeleteEntity(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid entity id"})
	}
	if err := h.repo.DeleteEntity(c.Context(), id); err != nil {
		if postgres.IsMgaCatalogNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "entity not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete entity"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ─── Posiciones ───────────────────────────────────────────────────────────────

// ListPositions devuelve todas las posiciones MGA.
// GET /api/v1/mga/catalogs/positions
func (h *ParticipantCatalogHandler) ListPositions(c *fiber.Ctx) error {
	positions, err := h.repo.ListPositions(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list positions"})
	}
	resp := make([]dto.MgaCatalogPositionResponse, 0, len(positions))
	for _, p := range positions {
		resp = append(resp, dto.MgaCatalogPositionResponse{ID: p.ID, Name: p.Name})
	}
	return c.JSON(resp)
}

// CreatePosition crea o actualiza una posición MGA.
// POST /api/v1/admin/mga/catalogs/positions
func (h *ParticipantCatalogHandler) CreatePosition(c *fiber.Ctx) error {
	var req dto.CreateMgaCatalogPositionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	now := time.Now().UTC()
	pos := &models.MgaCatalogPosition{ID: req.ID, Name: req.Name, CreatedAt: now, UpdatedAt: now}
	if err := h.repo.CreatePosition(c.Context(), pos); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create position"})
	}
	return c.Status(fiber.StatusCreated).JSON(dto.MgaCatalogPositionResponse{ID: pos.ID, Name: pos.Name})
}

// UpdatePosition actualiza una posición MGA.
// PUT /api/v1/admin/mga/catalogs/positions/:id
func (h *ParticipantCatalogHandler) UpdatePosition(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid position id"})
	}
	var req dto.UpdateMgaCatalogPositionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	pos := &models.MgaCatalogPosition{ID: id, Name: req.Name, UpdatedAt: time.Now().UTC()}
	if err := h.repo.UpdatePosition(c.Context(), pos); err != nil {
		if postgres.IsMgaCatalogNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "position not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update position"})
	}
	return c.JSON(dto.MgaCatalogPositionResponse{ID: pos.ID, Name: pos.Name})
}

// DeletePosition elimina una posición MGA.
// DELETE /api/v1/admin/mga/catalogs/positions/:id
func (h *ParticipantCatalogHandler) DeletePosition(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid position id"})
	}
	if err := h.repo.DeletePosition(c.Context(), id); err != nil {
		if postgres.IsMgaCatalogNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "position not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete position"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
