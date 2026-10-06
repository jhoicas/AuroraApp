package middleware

import (
	"strings"

	"aurora-backend/internal/domain/constants"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IsFormulador indica si el rol del JWT es FORMULADOR (ve solo sus proyectos).
func IsFormulador(c *fiber.Ctx) bool {
	role, _ := c.Locals(LocalsRole).(string)
	return strings.EqualFold(strings.TrimSpace(role), constants.RoleFormulador)
}

// ProjectOwnerGuard aísla los proyectos por formulador: si el actor es FORMULADOR y el
// proyecto :id no fue creado por él (o no existe en su tenant), responde 404 igual que si
// no existiera, para no permitir enumeración. Otros roles pasan sin cambios.
// Cubre el proyecto y todos sus subrecursos (/:id/...).
func ProjectOwnerGuard(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !IsFormulador(c) {
			return c.Next()
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Next() // rutas no basadas en id (p. ej. /evaluations/summary)
		}
		userID, tenantID, err := IdentityFromContext(c)
		if err != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		}
		var n int64
		if err := db.WithContext(c.Context()).Table("projects").
			Where("id = ? AND tenant_id = ? AND creator_id = ? AND deleted_at IS NULL", id, tenantID, userID).
			Count(&n).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
		}
		if n == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Next()
	}
}
