package handlers

import (
	"strings"

	"aurora-backend/internal/application/systemsettings"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// SystemSettingsHandler expone la configuración global (SUPER_ADMIN) y el estado público.
type SystemSettingsHandler struct {
	svc *systemsettings.Service
}

func NewSystemSettingsHandler(svc *systemsettings.Service) *SystemSettingsHandler {
	return &SystemSettingsHandler{svc: svc}
}

// Get GET /api/v1/admin/settings
func (h *SystemSettingsHandler) Get(c *fiber.Ctx) error {
	s, err := h.svc.Get(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load settings"})
	}
	return c.JSON(s)
}

// Update PUT /api/v1/admin/settings
func (h *SystemSettingsHandler) Update(c *fiber.Ctx) error {
	actor, err := uuid.Parse(strings.TrimSpace(asString(c.Locals(httpmw.LocalsUserID))))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid user identity"})
	}
	var req systemsettings.Settings
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	s, err := h.svc.Update(c.Context(), actor, req)
	if err != nil {
		if req.Validate() != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save settings"})
	}
	return c.JSON(s)
}

// PublicStatus GET /api/v1/system/status — banner y mantenimiento (sin datos sensibles).
func (h *SystemSettingsHandler) PublicStatus(c *fiber.Ctx) error {
	s := h.svc.Cached(c.Context())
	banner := ""
	if s.BannerEnabled {
		banner = s.BannerMessage
	}
	return c.JSON(fiber.Map{
		"maintenance_mode": s.MaintenanceMode,
		"banner_enabled":   s.BannerEnabled,
		"banner_message":   banner,
		"support_email":    s.SupportEmail,
	})
}
