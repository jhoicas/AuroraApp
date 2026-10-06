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

type reassignRequest struct {
	CreatedBy string `json:"created_by"`
}

type reassignCandidate struct {
	ID       uuid.UUID `json:"id"`
	FullName string    `json:"full_name"`
	Email    string    `json:"email"`
}

// loadProjectForAdmin carga el proyecto :id. TENANT_ADMIN queda acotado a su tenant;
// SUPER_ADMIN (global) puede operar sobre cualquier tenant.
func (h *ProjectHandler) loadProjectForAdmin(c *fiber.Ctx) (*models.Project, uuid.UUID, bool) {
	actorID, err := uuid.Parse(strings.TrimSpace(asString(c.Locals(httpmw.LocalsUserID))))
	if err != nil {
		_ = c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "missing or invalid user identity"})
		return nil, uuid.Nil, false
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		_ = c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
		return nil, uuid.Nil, false
	}
	q := h.db.WithContext(c.Context()).Where("id = ?", id)
	role, _ := c.Locals(httpmw.LocalsRole).(string)
	if !strings.EqualFold(strings.TrimSpace(role), constants.RoleSuperAdmin) {
		_, tenantID, idErr := httpmw.IdentityFromContext(c)
		if idErr != nil {
			_ = c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": idErr.Error()})
			return nil, uuid.Nil, false
		}
		q = q.Where("tenant_id = ?", tenantID)
	}
	var project models.Project
	if err := q.First(&project).Error; err != nil {
		if isNotFound(err) {
			_ = c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		} else {
			_ = c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
		}
		return nil, uuid.Nil, false
	}
	return &project, actorID, true
}

func asString(v interface{}) string {
	s, _ := v.(string)
	return s
}

// ReassignCandidates GET /api/v1/projects/:id/reassign-candidates
// Formuladores activos del tenant del proyecto.
func (h *ProjectHandler) ReassignCandidates(c *fiber.Ctx) error {
	project, _, ok := h.loadProjectForAdmin(c)
	if !ok {
		return nil
	}
	var rows []reassignCandidate
	err := h.db.WithContext(c.Context()).
		Table("users").
		Select("users.id, users.full_name, users.email").
		Joins("JOIN roles ON roles.id = users.role_id").
		Where("users.tenant_id = ? AND users.is_active = ? AND users.deleted_at IS NULL AND roles.code = ?",
			project.TenantID, true, constants.RoleFormulador).
		Order("users.full_name ASC").
		Scan(&rows).Error
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list candidates"})
	}
	if rows == nil {
		rows = []reassignCandidate{}
	}
	return c.JSON(fiber.Map{"data": rows})
}

// Reassign PATCH /api/v1/projects/:id/reassign — cambia el formulador (creator_id) del proyecto.
func (h *ProjectHandler) Reassign(c *fiber.Ctx) error {
	project, actorID, ok := h.loadProjectForAdmin(c)
	if !ok {
		return nil
	}
	var req reassignRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	newOwner, err := uuid.Parse(strings.TrimSpace(req.CreatedBy))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid created_by"})
	}

	// El nuevo responsable debe ser un usuario activo del mismo tenant del proyecto.
	var n int64
	if err := h.db.WithContext(c.Context()).Table("users").
		Where("id = ? AND tenant_id = ? AND is_active = ? AND deleted_at IS NULL", newOwner, project.TenantID, true).
		Count(&n).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to validate user"})
	}
	if n == 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": "el usuario debe estar activo y pertenecer a la misma entidad"})
	}

	previous := project.CreatorID
	if previous == newOwner {
		return c.JSON(toProjectResponse(*project))
	}

	now := time.Now().UTC()
	details, _ := json.Marshal(map[string]string{
		"project_id":       project.ID.String(),
		"previous_user_id": previous.String(),
		"new_user_id":      newOwner.String(),
	})
	err = h.db.WithContext(c.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Project{}).Where("id = ?", project.ID).
			Updates(map[string]interface{}{"creator_id": newOwner, "updated_at": now}).Error; err != nil {
			return err
		}
		tenant := project.TenantID
		return tx.Create(&models.AccessAuditLog{
			TenantID:     &tenant,
			ActorUserID:  &actorID,
			TargetUserID: &newOwner,
			Action:       models.AuditProjectReassigned,
			Details:      string(details),
			CreatedAt:    now,
		}).Error
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to reassign project"})
	}
	project.CreatorID = newOwner
	project.UpdatedAt = now
	return c.JSON(toProjectResponse(*project))
}
