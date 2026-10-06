package handlers

import (
	"context"
	"errors"
	"log"

	"aurora-backend/internal/application/access"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// AccessResolver es lo que el handler necesita del AccessService.
type AccessResolver interface {
	ValidateSession(ctx context.Context, userID uuid.UUID, tokenVersion int) error
	Resolve(ctx context.Context, userID uuid.UUID) (*access.ResolvedAccess, error)
}

// AccessHandler expone el acceso resuelto del usuario autenticado.
type AccessHandler struct {
	svc AccessResolver
}

func NewAccessHandler(svc AccessResolver) *AccessHandler {
	return &AccessHandler{svc: svc}
}

// Me responde GET /api/v1/auth/me/access con el árbol de módulos y permisos
// efectivos del usuario del JWT. El frontend lo usa para pintar menú y acciones;
// la autorización real siempre se vuelve a comprobar en el backend.
func (h *AccessHandler) Me(c *fiber.Ctx) error {
	userIDRaw, _ := c.Locals(httpmw.LocalsUserID).(string)
	userID, err := uuid.Parse(userIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized", "code": "UNAUTHORIZED"})
	}
	tv, _ := c.Locals(httpmw.LocalsTokenVersion).(int)

	if err := h.svc.ValidateSession(c.UserContext(), userID, tv); err != nil {
		if errors.Is(err, access.ErrSessionRevoked) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "session revoked", "code": httpmw.CodeSessionRevoked})
		}
		log.Printf("access/me: validar sesión: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to resolve access"})
	}

	resolved, err := h.svc.Resolve(c.UserContext(), userID)
	if err != nil {
		if errors.Is(err, access.ErrUserNotFound) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "session revoked", "code": httpmw.CodeSessionRevoked})
		}
		log.Printf("access/me: resolver: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to resolve access"})
	}
	return c.JSON(resolved)
}
