package postgres

import (
	"errors"
	"log"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type roleSeed struct {
	Code        string
	Name        string
	Description string
}

// systemRoles define los códigos exactos que espera auth/register y el resto del RBAC.
var systemRoles = []roleSeed{
	{Code: constants.RoleSuperAdmin, Name: "Super Administrador", Description: "Administración global del sistema"},
	{Code: constants.RoleTenantAdmin, Name: "Administrador de entidad", Description: "Administra un tenant"},
	{Code: constants.RoleFormulador, Name: "Formulador", Description: "Formula proyectos de inversión"},
	{Code: constants.RoleEvaluador, Name: "Evaluador", Description: "Evalúa proyectos"},
	{Code: constants.RoleAnalista, Name: "Analista", Description: "Analiza proyectos"},
	{Code: constants.RoleViewer, Name: "Visualizador", Description: "Solo lectura"},
}

// EnsureSystemRoles inserta los roles del sistema si no existen (idempotente por code).
// Usa los mismos strings que constants.Role* / POST /api/v1/auth/register (WHERE code = 'TENANT_ADMIN').
func EnsureSystemRoles(db *gorm.DB) error {
	now := time.Now().UTC()

	for _, r := range systemRoles {
		role := models.Role{
			ID:          uuid.New(),
			Code:        r.Code,
			Name:        r.Name,
			Description: r.Description,
			CreatedAt:   now,
			UpdatedAt:   now,
		}

		// Upsert por code: si ya existe, no falla ni duplica.
		result := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "code"}},
			DoNothing: true,
		}).Create(&role)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			log.Printf("rol creado: %s", r.Code)
		}
	}

	return verifyRequiredRoles(db)
}

func verifyRequiredRoles(db *gorm.DB) error {
	required := []string{constants.RoleSuperAdmin, constants.RoleTenantAdmin}
	for _, code := range required {
		var role models.Role
		if err := db.Where("code = ?", code).First(&role).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("rol requerido no encontrado tras seed: " + code)
			}
			return err
		}
		log.Printf("rol verificado: %s (id=%s)", role.Code, role.ID)
	}
	return nil
}
