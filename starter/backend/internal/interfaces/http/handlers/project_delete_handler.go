package handlers

import (
	"encoding/json"
	"strings"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Delete DELETE /api/v1/projects/:id — borrado lógico (deleted_at) del proyecto.
// Solo TENANT_ADMIN (cualquier proyecto de su tenant) o FORMULADOR (únicamente si es el creador).
// Cualquier otro rol, o un formulador ajeno al proyecto, recibe 403.
func (h *ProjectHandler) Delete(c *fiber.Ctx) error {
	userID, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}
	role, _ := c.Locals(httpmw.LocalsRole).(string)
	role = strings.ToUpper(strings.TrimSpace(role))
	if role != constants.RoleTenantAdmin && role != constants.RoleFormulador {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "no tiene permisos para eliminar proyectos"})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	var project models.Project
	if err := h.db.WithContext(c.Context()).
		Where("id = ? AND tenant_id = ?", id, tenantID).First(&project).Error; err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
	}

	if role == constants.RoleFormulador && project.CreatorID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "solo el creador del proyecto puede eliminarlo"})
	}

	now := time.Now().UTC()
	details, _ := json.Marshal(map[string]string{
		"project_id":   project.ID.String(),
		"project_name": project.Name,
	})
	err = h.db.WithContext(c.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&models.Project{}, "id = ?", project.ID).Error; err != nil {
			return err
		}
		tenant := project.TenantID
		return tx.Create(&models.AccessAuditLog{
			TenantID:    &tenant,
			ActorUserID: &userID,
			Action:      models.AuditProjectDeleted,
			Details:     string(details),
			CreatedAt:   now,
		}).Error
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete project"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
