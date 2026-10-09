package postgres

import (
	"errors"
	"fmt"
	"log"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// retiredRoleCodes son roles eliminados del sistema y el rol que hereda a sus usuarios.
// ANALISTA se eliminó a pedido del cliente: sus usuarios pasan a FORMULADOR.
var retiredRoleCodes = []struct{ Retired, Successor string }{
	{Retired: "ANALISTA", Successor: constants.RoleFormulador},
}

// RetireRemovedRoles migra a los usuarios de los roles eliminados a su sucesor y borra el rol
// (y sus role_module_defaults) para evitar conflictos de llave foránea. Cada usuario migrado
// queda con la matriz de permisos del nuevo rol y con las sesiones revocadas (token_version+1).
// Debe correr DESPUÉS de EnsureModulesSeed (necesita los defaults del sucesor). Idempotente.
func RetireRemovedRoles(db *gorm.DB) error {
	for _, r := range retiredRoleCodes {
		if err := retireRole(db, r.Retired, r.Successor); err != nil {
			return fmt.Errorf("retirar rol %s: %w", r.Retired, err)
		}
	}
	return nil
}

func retireRole(db *gorm.DB, retiredCode, successorCode string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var retired models.Role
		if err := tx.Where("code = ?", retiredCode).First(&retired).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil // ya retirado
			}
			return err
		}
		var successor models.Role
		if err := tx.Where("code = ?", successorCode).First(&successor).Error; err != nil {
			return fmt.Errorf("rol sucesor %s no existe: %w", successorCode, err)
		}

		// Usuarios activos (no eliminados) que recibirán la matriz del sucesor.
		var userIDs []uuid.UUID
		if err := tx.Model(&models.User{}).Where("role_id = ?", retired.ID).Pluck("id", &userIDs).Error; err != nil {
			return err
		}

		// Incluye usuarios con borrado lógico: la FK role_id es RESTRICT y bloquearía el DELETE del rol.
		now := time.Now().UTC()
		if err := tx.Exec(
			"UPDATE users SET role_id = ?, token_version = token_version + 1, updated_at = ? WHERE role_id = ?",
			successor.ID, now, retired.ID).Error; err != nil {
			return err
		}

		var defaults []models.RoleModuleDefault
		if err := tx.Where("role_id = ?", successor.ID).Find(&defaults).Error; err != nil {
			return err
		}
		for _, uid := range userIDs {
			if err := tx.Where("user_id = ?", uid).Delete(&models.UserModulePermission{}).Error; err != nil {
				return err
			}
			rows := make([]models.UserModulePermission, 0, len(defaults))
			for _, d := range defaults {
				rows = append(rows, models.UserModulePermission{
					ID: uuid.New(), UserID: uid, ModuleID: d.ModuleID, ActionFlags: d.ActionFlags,
					CreatedAt: now, UpdatedAt: now,
				})
			}
			if len(rows) > 0 {
				if err := tx.CreateInBatches(rows, 100).Error; err != nil {
					return err
				}
			}
		}

		if err := tx.Where("role_id = ?", retired.ID).Delete(&models.RoleModuleDefault{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.Role{}, "id = ?", retired.ID).Error; err != nil {
			return err
		}
		if err := tx.Create(&models.AccessAuditLog{
			Action:    models.AuditRoleRetired,
			Details:   fmt.Sprintf(`{"retired":%q,"successor":%q,"users_migrated":%d}`, retiredCode, successorCode, len(userIDs)),
			CreatedAt: now,
		}).Error; err != nil {
			return err
		}
		log.Printf("rol %s retirado: %d usuario(s) reasignados a %s", retiredCode, len(userIDs), successorCode)
		return nil
	})
}
