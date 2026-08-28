package middleware

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// IdentityFromContext extrae userID y tenantID del JWT (Locals).
// Jamás usar valores del body para aislamiento multi-tenant.
func IdentityFromContext(c *fiber.Ctx) (userID, tenantID uuid.UUID, err error) {
	uidRaw, _ := c.Locals(LocalsUserID).(string)
	tidRaw, _ := c.Locals(LocalsTenantID).(string)

	userID, err = uuid.Parse(uidRaw)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("missing or invalid user identity")
	}

	tenantID, err = uuid.Parse(tidRaw)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("missing or invalid tenant identity")
	}

	return userID, tenantID, nil
}

// RequireTenant exige tenant_id para usuarios de entidad. SUPER_ADMIN es una
// identidad global y puede continuar sin tenant.
func RequireTenant() fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, _ := c.Locals(LocalsRole).(string)
		if strings.EqualFold(strings.TrimSpace(role), "SUPER_ADMIN") {
			return c.Next()
		}

		tidRaw, _ := c.Locals(LocalsTenantID).(string)
		if _, err := uuid.Parse(tidRaw); err != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "tenant context required",
			})
		}
		return c.Next()
	}
}
