package postgres

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/modules"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// EnsureModulesSeed sincroniza el manifiesto de módulos (internal/domain/modules)
// con la base de datos. Es idempotente y no destructivo:
//
//   - Crea/actualiza `modules` cuyo seed_version sea menor al del manifiesto; los
//     módulos que salen del manifiesto se desactivan (no se borran).
//   - Reescribe `role_module_defaults` solo de los módulos nuevos o modificados.
//   - Habilita en `tenant_modules` todo módulo TENANT para los tenants que aún no
//     tengan fila (nunca reactiva un módulo que un SUPER_ADMIN deshabilitó).
//   - Backfill: copia los defaults de rol a `user_module_permissions` de los
//     usuarios no admin SIN fila para los módulos nuevos o modificados, de modo
//     que nadie pierda el acceso que tenía antes de PBAC. No pisa permisos ya
//     configurados.
func EnsureModulesSeed(db *gorm.DB) error {
	return ensureModulesSeed(db, modules.Manifest, modules.SeedVersion)
}

func ensureModulesSeed(db *gorm.DB, defs []modules.Def, version int) error {
	if err := modules.Validate(defs); err != nil {
		return fmt.Errorf("manifiesto de módulos inválido: %w", err)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()

		var existing []models.Module
		if err := tx.Find(&existing).Error; err != nil {
			return fmt.Errorf("leer modules: %w", err)
		}
		existingByCode := make(map[string]models.Module, len(existing))
		for _, m := range existing {
			existingByCode[m.Code] = m
		}

		idByCode := make(map[string]uuid.UUID, len(defs))
		changed := make(map[string]bool)
		inManifest := make(map[string]bool, len(defs))

		for _, d := range modules.Sorted(defs) {
			inManifest[d.Code] = true

			var parentID *uuid.UUID
			if d.Parent != "" {
				pid := idByCode[d.Parent]
				parentID = &pid
			}

			ex, found := existingByCode[d.Code]
			switch {
			case !found:
				m := models.Module{
					ID: uuid.New(), Code: d.Code, Name: d.Name, Description: d.Description,
					Kind: d.Kind, Scope: d.Scope, ParentID: parentID, Route: d.Route,
					SortOrder: d.Order, IsActive: true, SeedVersion: version,
					CreatedAt: now, UpdatedAt: now,
				}
				if err := tx.Create(&m).Error; err != nil {
					return fmt.Errorf("crear módulo %s: %w", d.Code, err)
				}
				idByCode[d.Code] = m.ID
				changed[d.Code] = true
			case ex.SeedVersion < version || !ex.IsActive:
				updates := map[string]any{
					"name": d.Name, "description": d.Description, "kind": d.Kind, "scope": d.Scope,
					"parent_id": parentID, "route": d.Route, "sort_order": d.Order,
					"is_active": true, "seed_version": version, "updated_at": now,
				}
				if err := tx.Model(&models.Module{}).Where("id = ?", ex.ID).Updates(updates).Error; err != nil {
					return fmt.Errorf("actualizar módulo %s: %w", d.Code, err)
				}
				idByCode[d.Code] = ex.ID
				changed[d.Code] = true
			default:
				idByCode[d.Code] = ex.ID
			}
		}

		// Módulos retirados del manifiesto: se desactivan, no se borran.
		deactivated := 0
		for _, ex := range existing {
			if !inManifest[ex.Code] && ex.IsActive {
				if err := tx.Model(&models.Module{}).Where("id = ?", ex.ID).
					Updates(map[string]any{"is_active": false, "updated_at": now}).Error; err != nil {
					return fmt.Errorf("desactivar módulo %s: %w", ex.Code, err)
				}
				deactivated++
			}
		}

		var roles []models.Role
		if err := tx.Find(&roles).Error; err != nil {
			return fmt.Errorf("leer roles: %w", err)
		}
		roleIDByCode := make(map[string]uuid.UUID, len(roles))
		roleCodeByID := make(map[uuid.UUID]string, len(roles))
		for _, r := range roles {
			roleIDByCode[r.Code] = r.ID
			roleCodeByID[r.ID] = r.Code
		}

		defByCode := make(map[string]modules.Def, len(defs))
		for _, d := range defs {
			defByCode[d.Code] = d
		}

		// role_module_defaults de los módulos nuevos/modificados.
		defaultRoles := append([]string{constants.RoleTenantAdmin}, modules.NonAdminRoles()...)
		for code := range changed {
			d := defByCode[code]
			for _, roleCode := range defaultRoles {
				roleID, ok := roleIDByCode[roleCode]
				if !ok {
					continue
				}
				a, has := d.EffectiveDefaults(roleCode)
				if !has {
					if err := tx.Where("role_id = ? AND module_id = ?", roleID, idByCode[code]).
						Delete(&models.RoleModuleDefault{}).Error; err != nil {
						return fmt.Errorf("limpiar default %s/%s: %w", roleCode, code, err)
					}
					continue
				}
				row := models.RoleModuleDefault{
					ID: uuid.New(), RoleID: roleID, ModuleID: idByCode[code],
					ActionFlags: flagsOf(a), CreatedAt: now, UpdatedAt: now,
				}
				if err := tx.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "role_id"}, {Name: "module_id"}},
					DoUpdates: clause.AssignmentColumns([]string{"can_view", "can_create", "can_edit", "can_delete", "updated_at"}),
				}).Create(&row).Error; err != nil {
					return fmt.Errorf("default %s/%s: %w", roleCode, code, err)
				}
			}
		}

		tenantRows, err := backfillTenantModules(tx, defs, idByCode, now)
		if err != nil {
			return err
		}
		userRows, err := backfillUserPermissions(tx, defByCode, idByCode, changed, roleCodeByID, now)
		if err != nil {
			return err
		}

		if len(changed) > 0 || deactivated > 0 || tenantRows > 0 || userRows > 0 {
			details, _ := json.Marshal(map[string]any{
				"seed_version":           version,
				"modules_changed":        len(changed),
				"modules_deactivated":    deactivated,
				"tenant_modules_added":   tenantRows,
				"user_permissions_added": userRows,
			})
			audit := models.AccessAuditLog{
				Action: models.AuditModulesSeeded, Details: string(details), CreatedAt: now,
			}
			if err := tx.Create(&audit).Error; err != nil {
				return fmt.Errorf("auditar seed: %w", err)
			}
			log.Printf("modules seed v%d: changed=%d deactivated=%d tenant_modules+%d user_permissions+%d",
				version, len(changed), deactivated, tenantRows, userRows)
		}
		return nil
	})
}

func flagsOf(a modules.Actions) models.ActionFlags {
	return models.ActionFlags{CanView: a.View, CanCreate: a.Create, CanEdit: a.Edit, CanDelete: a.Delete}
}

// backfillTenantModules habilita cada módulo TENANT del manifiesto para los
// tenants que no tengan fila todavía.
func backfillTenantModules(tx *gorm.DB, defs []modules.Def, idByCode map[string]uuid.UUID, now time.Time) (int, error) {
	var tenantIDs []uuid.UUID
	if err := tx.Model(&models.Tenant{}).Pluck("id", &tenantIDs).Error; err != nil {
		return 0, fmt.Errorf("leer tenants: %w", err)
	}
	if len(tenantIDs) == 0 {
		return 0, nil
	}

	var moduleIDs []uuid.UUID
	for _, d := range defs {
		if d.Scope == modules.ScopeTenant {
			moduleIDs = append(moduleIDs, idByCode[d.Code])
		}
	}

	var present []models.TenantModule
	if err := tx.Select("tenant_id", "module_id").Where("module_id IN ?", moduleIDs).Find(&present).Error; err != nil {
		return 0, fmt.Errorf("leer tenant_modules: %w", err)
	}
	have := make(map[[2]uuid.UUID]struct{}, len(present))
	for _, p := range present {
		have[[2]uuid.UUID{p.TenantID, p.ModuleID}] = struct{}{}
	}

	var rows []models.TenantModule
	for _, tid := range tenantIDs {
		for _, mid := range moduleIDs {
			if _, ok := have[[2]uuid.UUID{tid, mid}]; ok {
				continue
			}
			rows = append(rows, models.TenantModule{
				ID: uuid.New(), TenantID: tid, ModuleID: mid, IsEnabled: true, CreatedAt: now, UpdatedAt: now,
			})
		}
	}
	if len(rows) == 0 {
		return 0, nil
	}
	if err := tx.CreateInBatches(rows, 200).Error; err != nil {
		return 0, fmt.Errorf("insertar tenant_modules: %w", err)
	}
	return len(rows), nil
}

// backfillUserPermissions asigna los defaults de rol a los usuarios no admin de
// un tenant que no tengan fila para los módulos nuevos o modificados.
func backfillUserPermissions(
	tx *gorm.DB,
	defByCode map[string]modules.Def,
	idByCode map[string]uuid.UUID,
	changed map[string]bool,
	roleCodeByID map[uuid.UUID]string,
	now time.Time,
) (int, error) {
	var moduleIDs []uuid.UUID
	for code := range changed {
		if defByCode[code].Scope == modules.ScopeTenant {
			moduleIDs = append(moduleIDs, idByCode[code])
		}
	}
	if len(moduleIDs) == 0 {
		return 0, nil
	}

	var users []models.User
	if err := tx.Select("id", "role_id", "tenant_id").Where("tenant_id IS NOT NULL").Find(&users).Error; err != nil {
		return 0, fmt.Errorf("leer usuarios: %w", err)
	}
	if len(users) == 0 {
		return 0, nil
	}

	var present []models.UserModulePermission
	if err := tx.Select("user_id", "module_id").Where("module_id IN ?", moduleIDs).Find(&present).Error; err != nil {
		return 0, fmt.Errorf("leer user_module_permissions: %w", err)
	}
	have := make(map[[2]uuid.UUID]struct{}, len(present))
	for _, p := range present {
		have[[2]uuid.UUID{p.UserID, p.ModuleID}] = struct{}{}
	}

	codeByModuleID := make(map[uuid.UUID]string, len(moduleIDs))
	for code := range changed {
		codeByModuleID[idByCode[code]] = code
	}

	var rows []models.UserModulePermission
	for _, u := range users {
		roleCode := roleCodeByID[u.RoleID]
		// Los administradores se resuelven por rol; no reciben filas por usuario.
		if roleCode == "" || roleCode == constants.RoleSuperAdmin || roleCode == constants.RoleTenantAdmin {
			continue
		}
		for _, mid := range moduleIDs {
			if _, ok := have[[2]uuid.UUID{u.ID, mid}]; ok {
				continue
			}
			a, ok := defByCode[codeByModuleID[mid]].EffectiveDefaults(roleCode)
			if !ok {
				continue
			}
			rows = append(rows, models.UserModulePermission{
				ID: uuid.New(), UserID: u.ID, ModuleID: mid, ActionFlags: flagsOf(a),
				CreatedAt: now, UpdatedAt: now,
			})
		}
	}
	if len(rows) == 0 {
		return 0, nil
	}
	if err := tx.CreateInBatches(rows, 200).Error; err != nil {
		return 0, fmt.Errorf("insertar user_module_permissions: %w", err)
	}
	return len(rows), nil
}
