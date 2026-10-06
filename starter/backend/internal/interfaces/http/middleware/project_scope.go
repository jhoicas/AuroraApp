package middleware

import (
	"net/http"
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

// CodeSuperAdminReadOnly identifica el rechazo de una escritura de SUPER_ADMIN sobre un proyecto.
const CodeSuperAdminReadOnly = "SUPER_ADMIN_READ_ONLY"

func isSuperAdmin(c *fiber.Ctx) bool {
	role, _ := c.Locals(LocalsRole).(string)
	return strings.EqualFold(strings.TrimSpace(role), constants.RoleSuperAdmin)
}

// SuperAdminProjectScope da al SUPER_ADMIN (identidad global, sin tenant) acceso de SOLO LECTURA
// al proyecto :id y a todos sus subrecursos:
//
//   - GET/HEAD: resuelve el tenant dueño del proyecto y lo expone como tenant del contexto, de modo
//     que los handlers de consulta existentes funcionan sin cambios (y sin filtro por creator_id).
//     Un proyecto inexistente responde 404.
//   - Cualquier escritura (PATCH/POST/PUT/DELETE) responde 403 SUPER_ADMIN_READ_ONLY. Única
//     excepción: PATCH …/reassign, la reasignación administrativa del formulador responsable.
//
// Para los demás roles no hace nada (rige ProjectOwnerGuard y PBAC). Debe ir antes de ProjectOwnerGuard.
func SuperAdminProjectScope(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !isSuperAdmin(c) {
			return c.Next()
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Next() // rutas no basadas en id
		}

		method := c.Method()
		if method != http.MethodGet && method != http.MethodHead {
			if method == http.MethodPatch && strings.HasSuffix(strings.TrimRight(c.Path(), "/"), "/reassign") {
				return c.Next()
			}
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "el SUPER_ADMIN solo tiene acceso de lectura a los proyectos",
				"code":  CodeSuperAdminReadOnly,
			})
		}

		var row struct{ TenantID uuid.UUID }
		res := db.WithContext(c.UserContext()).Table("projects").
			Select("tenant_id").Where("id = ? AND deleted_at IS NULL", id).Limit(1).Scan(&row)
		if res.Error != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
		}
		if res.RowsAffected == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		c.Locals(LocalsTenantID, row.TenantID.String())
		return c.Next()
	}
}
