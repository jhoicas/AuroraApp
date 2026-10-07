package handlers

import (
	"errors"
	"strings"

	"aurora-backend/internal/infrastructure/persistence/postgres"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DocumentTemplateHandler expone el CRUD de plantillas del Documento Técnico (TENANT_ADMIN).
type DocumentTemplateHandler struct {
	repo *postgres.DocumentTemplateRepository
}

func NewDocumentTemplateHandler(db *gorm.DB) *DocumentTemplateHandler {
	return &DocumentTemplateHandler{repo: postgres.NewDocumentTemplateRepository(db)}
}

type createDocumentTemplateRequest struct {
	Name        string  `json:"name"`
	HTMLContent string  `json:"html_content"`
	CloneFromID *string `json:"clone_from_id"`
}

type updateDocumentTemplateRequest struct {
	Name        *string `json:"name"`
	HTMLContent *string `json:"html_content"`
}

const maxTemplateHTMLBytes = 512 * 1024

func templateError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, postgres.ErrTemplateNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "template not found"})
	case errors.Is(err, postgres.ErrTemplateReadOnly):
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "system templates are read-only; clone it first"})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "document template operation failed"})
}

func (h *DocumentTemplateHandler) ids(c *fiber.Ctx) (uuid.UUID, uuid.UUID, error) {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return uuid.Nil, uuid.Nil, c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, uuid.Nil, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid template id"})
	}
	return tenantID, id, nil
}

func (h *DocumentTemplateHandler) tenant(c *fiber.Ctx) (uuid.UUID, error) {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return uuid.Nil, c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}
	return tenantID, nil
}

func (h *DocumentTemplateHandler) List(c *fiber.Ctx) error {
	tenantID, err := h.tenant(c)
	if err != nil {
		return err
	}
	items, err := h.repo.List(c.Context(), tenantID)
	if err != nil {
		return templateError(c, err)
	}
	return c.JSON(fiber.Map{"data": items})
}

func (h *DocumentTemplateHandler) Create(c *fiber.Ctx) error {
	tenantID, err := h.tenant(c)
	if err != nil {
		return err
	}
	var req createDocumentTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len(req.Name) > 255 || len(req.HTMLContent) > maxTemplateHTMLBytes {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid name or content"})
	}
	var clone *uuid.UUID
	if req.CloneFromID != nil && *req.CloneFromID != "" {
		id, err := uuid.Parse(*req.CloneFromID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid clone_from_id"})
		}
		clone = &id
	}
	t, err := h.repo.Create(c.Context(), tenantID, req.Name, req.HTMLContent, clone)
	if err != nil {
		return templateError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": t})
}

func (h *DocumentTemplateHandler) Get(c *fiber.Ctx) error {
	tenantID, id, err := h.ids(c)
	if err != nil {
		return err
	}
	t, err := h.repo.Get(c.Context(), tenantID, id)
	if err != nil {
		return templateError(c, err)
	}
	return c.JSON(fiber.Map{"data": t})
}

// Update sirve PUT y PATCH (autoguardado): campos ausentes no se modifican.
func (h *DocumentTemplateHandler) Update(c *fiber.Ctx) error {
	tenantID, id, err := h.ids(c)
	if err != nil {
		return err
	}
	var req updateDocumentTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if req.Name != nil {
		trimmed := strings.TrimSpace(*req.Name)
		if trimmed == "" || len(trimmed) > 255 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid name"})
		}
		req.Name = &trimmed
	}
	if req.HTMLContent != nil && len(*req.HTMLContent) > maxTemplateHTMLBytes {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "template too large"})
	}
	t, err := h.repo.Update(c.Context(), tenantID, id, req.Name, req.HTMLContent)
	if err != nil {
		return templateError(c, err)
	}
	t.HTMLContent = "" // respuesta ligera para el autoguardado
	return c.JSON(fiber.Map{"data": t})
}

func (h *DocumentTemplateHandler) Activate(c *fiber.Ctx) error {
	tenantID, id, err := h.ids(c)
	if err != nil {
		return err
	}
	t, err := h.repo.Activate(c.Context(), tenantID, id)
	if err != nil {
		return templateError(c, err)
	}
	t.HTMLContent = ""
	return c.JSON(fiber.Map{"data": t})
}

// Delete elimina (soft delete) una plantilla propia; las del sistema responden 403.
func (h *DocumentTemplateHandler) Delete(c *fiber.Ctx) error {
	tenantID, id, err := h.ids(c)
	if err != nil {
		return err
	}
	if err := h.repo.Delete(c.Context(), tenantID, id); err != nil {
		return templateError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}
