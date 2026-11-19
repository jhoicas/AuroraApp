package handlers

import (
	"strings"

	"aurora-backend/internal/application/aisettings"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// AISettingsHandler expone GET/PUT /api/v1/admin/settings/ai (SUPER_ADMIN).
type AISettingsHandler struct {
	svc *aisettings.Service
}

func NewAISettingsHandler(svc *aisettings.Service) *AISettingsHandler {
	return &AISettingsHandler{svc: svc}
}

// Get GET /api/v1/admin/settings/ai
func (h *AISettingsHandler) Get(c *fiber.Ctx) error {
	s, err := h.svc.GetMasked(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load AI settings"})
	}
	return c.JSON(s)
}

// Update PUT /api/v1/admin/settings/ai
func (h *AISettingsHandler) Update(c *fiber.Ctx) error {
	actor, err := uuid.Parse(strings.TrimSpace(asString(c.Locals(httpmw.LocalsUserID))))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid user identity"})
	}
	var req aisettings.AISettings
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	s, err := h.svc.Upsert(c.Context(), actor, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save AI settings"})
	}
	return c.JSON(s)
}
