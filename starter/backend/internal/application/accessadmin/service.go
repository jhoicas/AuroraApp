// Package accessadmin implementa la administración de acceso para SUPER_ADMIN
// (ADR-0001, Fase 3): módulos, techo de módulos por tenant, usuarios y permisos.
//
// Invariantes:
//   - Todo cambio escribe un AccessAuditLog dentro de la misma transacción.
//   - Todo cambio de permisos, módulos, contraseña o estado invalida la caché del
//     AccessService; contraseña y estado además incrementan users.token_version
//     (revocan las sesiones vigentes).
//   - Los módulos de sistema (IsSystem) no se borran; editarlos marca Customized.
package accessadmin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/modules"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Errores tipados que el handler traduce a códigos HTTP.
var (
	ErrNotFound   = errors.New("not found")
	ErrValidation = errors.New("validation")
	ErrConflict   = errors.New("conflict")
	ErrForbidden  = errors.New("forbidden")
)

func validationf(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrValidation, fmt.Sprintf(format, a...))
}
func conflictf(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrConflict, fmt.Sprintf(format, a...))
}
func forbiddenf(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrForbidden, fmt.Sprintf(format, a...))
}
func notFoundf(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrNotFound, fmt.Sprintf(format, a...))
}

// Invalidator es la parte del AccessService que se usa para limpiar la caché.
type Invalidator interface {
	Invalidate(userID uuid.UUID)
	InvalidateTenant(tenantID uuid.UUID)
	InvalidateAll()
}

// Service es el servicio de administración de acceso.
type Service struct {
	db    *gorm.DB
	cache Invalidator
	now   func() time.Time
}

func NewService(db *gorm.DB, cache Invalidator) *Service {
	return &Service{db: db, cache: cache, now: func() time.Time { return time.Now().UTC() }}
}

// Actor es el SUPER_ADMIN que ejecuta la operación (para auditoría y granted_by).
type Actor struct{ UserID uuid.UUID }

const minPasswordLen = 8

var moduleCodeRe = regexp.MustCompile(`^[a-z0-9]+([._-][a-z0-9]+)*$`)

func (s *Service) audit(tx *gorm.DB, actor Actor, tenantID, targetUserID, moduleID *uuid.UUID, action string, details map[string]any) error {
	raw, err := json.Marshal(details)
	if err != nil {
		return err
	}
	a := uuid.UUID(actor.UserID)
	entry := models.AccessAuditLog{
		TenantID: tenantID, ActorUserID: &a, TargetUserID: targetUserID, ModuleID: moduleID,
		Action: action, Details: string(raw), CreatedAt: s.now(),
	}
	return tx.Create(&entry).Error
}

// ── Módulos ─────────────────────────────────────────────────────────────────

// ModuleView es la representación administrativa de un módulo.
type ModuleView struct {
	ID          uuid.UUID  `json:"id"`
	Code        string     `json:"code"`
	Name        string     `json:"name"`
	Description string     `json:"description,omitempty"`
	Kind        string     `json:"kind"`
	Scope       string     `json:"scope"`
	ParentID    *uuid.UUID `json:"parent_id,omitempty"`
	ParentCode  string     `json:"parent_code,omitempty"`
	Route       string     `json:"route"`
	SortOrder   int        `json:"sort_order"`
	IsActive    bool       `json:"is_active"`
	IsSystem    bool       `json:"is_system"`
	Customized  bool       `json:"customized"`
}

func moduleView(m models.Module, codes map[uuid.UUID]string) ModuleView {
	v := ModuleView{
		ID: m.ID, Code: m.Code, Name: m.Name, Description: m.Description, Kind: m.Kind, Scope: m.Scope,
		ParentID: m.ParentID, Route: m.Route, SortOrder: m.SortOrder, IsActive: m.IsActive,
		IsSystem: m.IsSystem, Customized: m.Customized,
	}
	if m.ParentID != nil {
		v.ParentCode = codes[*m.ParentID]
	}
	return v
}

func (s *Service) allModules(ctx context.Context, tx *gorm.DB) ([]models.Module, map[uuid.UUID]string, error) {
	var mods []models.Module
	if err := tx.WithContext(ctx).Order("sort_order ASC, code ASC").Find(&mods).Error; err != nil {
		return nil, nil, err
	}
	codes := make(map[uuid.UUID]string, len(mods))
	for _, m := range mods {
		codes[m.ID] = m.Code
	}
	return mods, codes, nil
}

// ListModules devuelve todos los módulos (incluidos inactivos) en orden.
func (s *Service) ListModules(ctx context.Context) ([]ModuleView, error) {
	mods, codes, err := s.allModules(ctx, s.db)
	if err != nil {
		return nil, err
	}
	out := make([]ModuleView, 0, len(mods))
	for _, m := range mods {
		out = append(out, moduleView(m, codes))
	}
	return out, nil
}

// ListModulesPage devuelve una página de módulos (orden sort_order, código). search filtra
// por nombre, código o código de la sección/módulo padre (sin distinguir mayúsculas).
func (s *Service) ListModulesPage(ctx context.Context, search string, page, limit int) ([]ModuleView, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	_, codes, err := s.allModules(ctx, s.db)
	if err != nil {
		return nil, 0, err
	}
	q := s.db.WithContext(ctx).Model(&models.Module{})
	if term := strings.ToLower(strings.TrimSpace(search)); term != "" {
		like := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(term) + "%"
		q = q.Where(`LOWER(modules.name) LIKE ? ESCAPE '\' OR LOWER(modules.code) LIKE ? ESCAPE '\' OR modules.parent_id IN (SELECT p.id FROM modules p WHERE LOWER(p.code) LIKE ? ESCAPE '\' OR LOWER(p.name) LIKE ? ESCAPE '\')`,
			like, like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var mods []models.Module
	if err := q.Order("modules.sort_order ASC, modules.code ASC").Limit(limit).Offset((page - 1) * limit).Find(&mods).Error; err != nil {
		return nil, 0, err
	}
	out := make([]ModuleView, 0, len(mods))
	for _, m := range mods {
		out = append(out, moduleView(m, codes))
	}
	return out, total, nil
}

// CreateModuleInput son los datos de un módulo nuevo (no de sistema).
type CreateModuleInput struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Kind        string `json:"kind"`
	Scope       string `json:"scope"`
	ParentCode  string `json:"parent_code"`
	Route       string `json:"route"`
	SortOrder   int    `json:"sort_order"`
}

func (s *Service) CreateModule(ctx context.Context, actor Actor, in CreateModuleInput) (*ModuleView, error) {
	in.Code = strings.TrimSpace(in.Code)
	in.Name = strings.TrimSpace(in.Name)
	in.Route = strings.TrimSpace(in.Route)
	if in.Kind == "" {
		in.Kind = modules.KindModule
	}
	if in.Scope == "" {
		in.Scope = modules.ScopeTenant
	}
	switch {
	case !moduleCodeRe.MatchString(in.Code) || len(in.Code) > 100:
		return nil, validationf("code inválido (minúsculas, dígitos y . _ -)")
	case in.Name == "" || len(in.Name) > 150:
		return nil, validationf("name es obligatorio (máx. 150)")
	case !strings.HasPrefix(in.Route, "/") || len(in.Route) > 255:
		return nil, validationf("route debe empezar con '/'")
	case in.Kind != modules.KindModule && in.Kind != modules.KindSection:
		return nil, validationf("kind debe ser MODULE o SECTION")
	case in.Scope != modules.ScopeTenant && in.Scope != modules.ScopePlatform:
		return nil, validationf("scope debe ser TENANT o PLATFORM")
	}

	var view *ModuleView
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var parent *models.Module
		if in.Kind == modules.KindSection {
			if in.ParentCode == "" {
				return validationf("una SECTION requiere parent_code")
			}
			var p models.Module
			if err := tx.Where("code = ?", in.ParentCode).First(&p).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return validationf("parent_code %q no existe", in.ParentCode)
				}
				return err
			}
			if p.Kind != modules.KindModule || p.Scope != in.Scope {
				return validationf("el padre debe ser un MODULE del mismo scope")
			}
			parent = &p
		} else if in.ParentCode != "" {
			return validationf("un MODULE no puede tener parent_code")
		}

		if err := s.ensureUnique(tx, in.Code, in.Route, uuid.Nil); err != nil {
			return err
		}

		now := s.now()
		m := models.Module{
			ID: uuid.New(), Code: in.Code, Name: in.Name, Description: in.Description, Kind: in.Kind, Scope: in.Scope,
			Route: in.Route, SortOrder: in.SortOrder, IsActive: true, CreatedAt: now, UpdatedAt: now,
		}
		if parent != nil {
			m.ParentID = &parent.ID
		}
		if err := tx.Create(&m).Error; err != nil {
			return err
		}
		// SQLite/GORM: Create ignora el default false de is_system/customized, ya son false.

		if err := s.audit(tx, actor, nil, nil, &m.ID, models.AuditModuleCreated, map[string]any{
			"code": m.Code, "kind": m.Kind, "scope": m.Scope, "parent_code": in.ParentCode, "route": m.Route,
		}); err != nil {
			return err
		}
		codes := map[uuid.UUID]string{}
		if parent != nil {
			codes[parent.ID] = parent.Code
		}
		v := moduleView(m, codes)
		view = &v
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.cache.InvalidateAll()
	return view, nil
}

func (s *Service) ensureUnique(tx *gorm.DB, code, route string, exceptID uuid.UUID) error {
	var n int64
	if code != "" {
		if err := tx.Model(&models.Module{}).Where("code = ? AND id <> ?", code, exceptID).Count(&n).Error; err != nil {
			return err
		}
		if n > 0 {
			return conflictf("ya existe un módulo con code %q", code)
		}
	}
	if err := tx.Model(&models.Module{}).Where("route = ? AND id <> ?", route, exceptID).Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return conflictf("ya existe un módulo con route %q", route)
	}
	return nil
}

// UpdateModuleInput: campos opcionales; code, kind, scope y parent no cambian.
type UpdateModuleInput struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Route       *string `json:"route"`
	SortOrder   *int    `json:"sort_order"`
	IsActive    *bool   `json:"is_active"`
}

func (s *Service) UpdateModule(ctx context.Context, actor Actor, id uuid.UUID, in UpdateModuleInput) (*ModuleView, error) {
	var view *ModuleView
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var m models.Module
		if err := tx.Where("id = ?", id).First(&m).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return notFoundf("módulo")
			}
			return err
		}

		updates := map[string]any{}
		changes := map[string]any{}
		if in.Name != nil {
			n := strings.TrimSpace(*in.Name)
			if n == "" || len(n) > 150 {
				return validationf("name es obligatorio (máx. 150)")
			}
			if n != m.Name {
				updates["name"], changes["name"] = n, map[string]any{"from": m.Name, "to": n}
			}
		}
		if in.Description != nil && *in.Description != m.Description {
			updates["description"], changes["description"] = *in.Description, true
		}
		if in.Route != nil {
			r := strings.TrimSpace(*in.Route)
			if !strings.HasPrefix(r, "/") || len(r) > 255 {
				return validationf("route debe empezar con '/'")
			}
			if r != m.Route {
				if err := s.ensureUnique(tx, "", r, m.ID); err != nil {
					return err
				}
				updates["route"], changes["route"] = r, map[string]any{"from": m.Route, "to": r}
			}
		}
		if in.SortOrder != nil && *in.SortOrder != m.SortOrder {
			updates["sort_order"], changes["sort_order"] = *in.SortOrder, map[string]any{"from": m.SortOrder, "to": *in.SortOrder}
		}
		if in.IsActive != nil && *in.IsActive != m.IsActive {
			updates["is_active"], changes["is_active"] = *in.IsActive, map[string]any{"from": m.IsActive, "to": *in.IsActive}
		}

		if len(updates) > 0 {
			// Editar un módulo de sistema impide que el seed lo pise.
			if m.IsSystem {
				updates["customized"] = true
				changes["customized"] = true
			}
			updates["updated_at"] = s.now()
			if err := tx.Model(&models.Module{}).Where("id = ?", m.ID).Updates(updates).Error; err != nil {
				return err
			}
			if err := s.audit(tx, actor, nil, nil, &m.ID, models.AuditModuleUpdated, map[string]any{"code": m.Code, "changes": changes}); err != nil {
				return err
			}
		}

		if err := tx.Where("id = ?", m.ID).First(&m).Error; err != nil {
			return err
		}
		_, codes, err := s.allModules(ctx, tx)
		if err != nil {
			return err
		}
		v := moduleView(m, codes)
		view = &v
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.cache.InvalidateAll()
	return view, nil
}

// DeleteModule borra un módulo no de sistema y sin hijos, con sus filas dependientes.
func (s *Service) DeleteModule(ctx context.Context, actor Actor, id uuid.UUID) error {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var m models.Module
		if err := tx.Where("id = ?", id).First(&m).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return notFoundf("módulo")
			}
			return err
		}
		if m.IsSystem {
			return fmt.Errorf("%w: los módulos de sistema no se pueden borrar (edítalos o desactívalos)", ErrForbidden)
		}
		var children int64
		if err := tx.Model(&models.Module{}).Where("parent_id = ?", m.ID).Count(&children).Error; err != nil {
			return err
		}
		if children > 0 {
			return conflictf("el módulo tiene %d sección(es); bórralas primero", children)
		}

		for _, dep := range []any{&models.TenantModule{}, &models.RoleModuleDefault{}, &models.UserModulePermission{}} {
			if err := tx.Where("module_id = ?", m.ID).Delete(dep).Error; err != nil {
				return err
			}
		}
		if err := tx.Delete(&models.Module{}, "id = ?", m.ID).Error; err != nil {
			return err
		}
		return s.audit(tx, actor, nil, nil, &m.ID, models.AuditModuleDeleted, map[string]any{"code": m.Code, "route": m.Route})
	})
	if err != nil {
		return err
	}
	s.cache.InvalidateAll()
	return nil
}

// ReorderItem fija el sort_order de un módulo.
type ReorderItem struct {
	ID        uuid.UUID `json:"id"`
	SortOrder int       `json:"sort_order"`
}

// ReorderModules actualiza el orden de varios módulos en una transacción.
// Reordenar un módulo de sistema lo marca Customized (el seed no revierte el orden).
func (s *Service) ReorderModules(ctx context.Context, actor Actor, items []ReorderItem) error {
	if len(items) == 0 {
		return validationf("items no puede estar vacío")
	}
	seen := map[uuid.UUID]bool{}
	for _, it := range items {
		if seen[it.ID] {
			return validationf("módulo repetido en items: %s", it.ID)
		}
		seen[it.ID] = true
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		changed := make([]map[string]any, 0, len(items))
		for _, it := range items {
			var m models.Module
			if err := tx.Where("id = ?", it.ID).First(&m).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return notFoundf("módulo %s", it.ID)
				}
				return err
			}
			if m.SortOrder == it.SortOrder {
				continue
			}
			updates := map[string]any{"sort_order": it.SortOrder, "updated_at": s.now()}
			if m.IsSystem {
				updates["customized"] = true
			}
			if err := tx.Model(&models.Module{}).Where("id = ?", m.ID).Updates(updates).Error; err != nil {
				return err
			}
			changed = append(changed, map[string]any{"code": m.Code, "from": m.SortOrder, "to": it.SortOrder})
		}
		if len(changed) == 0 {
			return nil
		}
		return s.audit(tx, actor, nil, nil, nil, models.AuditModulesReordered, map[string]any{"changed": changed})
	})
	if err != nil {
		return err
	}
	s.cache.InvalidateAll()
	return nil
}

// ── Módulos por tenant (techo) ─────────────────────────────────────────────

// TenantModuleView es el estado de un módulo para un tenant.
type TenantModuleView struct {
	ModuleCode string `json:"module_code"`
	Name       string `json:"name"`
	Kind       string `json:"kind"`
	ParentCode string `json:"parent_code,omitempty"`
	IsEnabled  bool   `json:"is_enabled"`
}

func (s *Service) requireTenant(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.Tenant, error) {
	var t models.Tenant
	if err := tx.WithContext(ctx).Where("id = ?", id).First(&t).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, notFoundf("tenant")
		}
		return nil, err
	}
	return &t, nil
}

// GetTenantModules lista los módulos TENANT activos con su estado para el tenant
// (sin fila = habilitado).
func (s *Service) GetTenantModules(ctx context.Context, tenantID uuid.UUID) ([]TenantModuleView, error) {
	if _, err := s.requireTenant(ctx, s.db, tenantID); err != nil {
		return nil, err
	}
	mods, codes, err := s.allModules(ctx, s.db)
	if err != nil {
		return nil, err
	}
	var rows []models.TenantModule
	if err := s.db.WithContext(ctx).Where("tenant_id = ?", tenantID).Find(&rows).Error; err != nil {
		return nil, err
	}
	state := make(map[uuid.UUID]bool, len(rows))
	for _, r := range rows {
		state[r.ModuleID] = r.IsEnabled
	}
	out := []TenantModuleView{}
	for _, m := range mods {
		if m.Scope != modules.ScopeTenant || !m.IsActive {
			continue
		}
		enabled, ok := state[m.ID]
		v := TenantModuleView{ModuleCode: m.Code, Name: m.Name, Kind: m.Kind, IsEnabled: !ok || enabled}
		if m.ParentID != nil {
			v.ParentCode = codes[*m.ParentID]
		}
		out = append(out, v)
	}
	return out, nil
}

// TenantModuleChange es un cambio solicitado de habilitación.
type TenantModuleChange struct {
	ModuleCode string `json:"module_code"`
	IsEnabled  bool   `json:"is_enabled"`
}

// SetTenantModules aplica el techo de módulos del tenant (upsert por módulo).
func (s *Service) SetTenantModules(ctx context.Context, actor Actor, tenantID uuid.UUID, changes []TenantModuleChange) error {
	if len(changes) == 0 {
		return validationf("modules no puede estar vacío")
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := s.requireTenant(ctx, tx, tenantID); err != nil {
			return err
		}
		applied := make([]map[string]any, 0, len(changes))
		for _, ch := range changes {
			var m models.Module
			if err := tx.Where("code = ?", ch.ModuleCode).First(&m).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return validationf("módulo %q no existe", ch.ModuleCode)
				}
				return err
			}
			if m.Scope != modules.ScopeTenant {
				return validationf("el módulo %q es de plataforma y no se asigna a tenants", ch.ModuleCode)
			}

			var row models.TenantModule
			err := tx.Where("tenant_id = ? AND module_id = ?", tenantID, m.ID).First(&row).Error
			switch {
			case errors.Is(err, gorm.ErrRecordNotFound):
				if ch.IsEnabled {
					continue // sin fila ya equivale a habilitado
				}
				now := s.now()
				row = models.TenantModule{ID: uuid.New(), TenantID: tenantID, ModuleID: m.ID, IsEnabled: false, CreatedAt: now, UpdatedAt: now}
				if err := tx.Create(&row).Error; err != nil {
					return err
				}
			case err != nil:
				return err
			default:
				if row.IsEnabled == ch.IsEnabled {
					continue
				}
				if err := tx.Model(&models.TenantModule{}).Where("id = ?", row.ID).
					Updates(map[string]any{"is_enabled": ch.IsEnabled, "updated_at": s.now()}).Error; err != nil {
					return err
				}
			}
			applied = append(applied, map[string]any{"module": m.Code, "is_enabled": ch.IsEnabled})
		}
		if len(applied) == 0 {
			return nil
		}
		return s.audit(tx, actor, &tenantID, nil, nil, models.AuditTenantModulesUpdated, map[string]any{"changes": applied})
	})
	if err != nil {
		return err
	}
	s.cache.InvalidateTenant(tenantID)
	return nil
}

// ── Usuarios ────────────────────────────────────────────────────────────────

// UserView es la representación administrativa de un usuario.
type UserView struct {
	ID        uuid.UUID  `json:"id"`
	TenantID  *uuid.UUID `json:"tenant_id,omitempty"`
	Email     string     `json:"email"`
	FullName  string     `json:"full_name"`
	Role      string     `json:"role"`
	IsActive  bool       `json:"is_active"`
	CreatedAt time.Time  `json:"created_at"`
}

type userRow struct {
	ID        uuid.UUID
	TenantID  *uuid.UUID
	Email     string
	FullName  string
	IsActive  bool
	CreatedAt time.Time
	RoleCode  string
	RoleID    uuid.UUID
}

func (r userRow) view() UserView {
	return UserView{ID: r.ID, TenantID: r.TenantID, Email: r.Email, FullName: r.FullName, Role: r.RoleCode, IsActive: r.IsActive, CreatedAt: r.CreatedAt}
}

func (s *Service) userQuery(ctx context.Context, tx *gorm.DB) *gorm.DB {
	return tx.WithContext(ctx).Table("users AS u").
		Select("u.id AS id, u.tenant_id AS tenant_id, u.email AS email, u.full_name AS full_name, u.is_active AS is_active, u.created_at AS created_at, r.code AS role_code, r.id AS role_id").
		Joins("JOIN roles r ON r.id = u.role_id").
		Where("u.deleted_at IS NULL")
}

func (s *Service) loadUser(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*userRow, error) {
	var row userRow
	res := s.userQuery(ctx, tx).Where("u.id = ?", id).Limit(1).Scan(&row)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, notFoundf("usuario")
	}
	return &row, nil
}

// loadUserIn carga un usuario; con scope (API de Tenant Admin) un usuario de otro tenant
// o sin tenant se trata como inexistente (no se filtra su existencia).
func (s *Service) loadUserIn(ctx context.Context, tx *gorm.DB, id uuid.UUID, scope *uuid.UUID) (*userRow, error) {
	u, err := s.loadUser(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	if scope != nil && (u.TenantID == nil || *u.TenantID != *scope) {
		return nil, notFoundf("usuario")
	}
	return u, nil
}

// ListTenantUsers lista los usuarios de un tenant con paginación.
func (s *Service) ListTenantUsers(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]UserView, int64, error) {
	if _, err := s.requireTenant(ctx, s.db, tenantID); err != nil {
		return nil, 0, err
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	var total int64
	if err := s.db.WithContext(ctx).Model(&models.User{}).Where("tenant_id = ?", tenantID).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []userRow
	if err := s.userQuery(ctx, s.db).Where("u.tenant_id = ?", tenantID).
		Order("u.created_at ASC, u.email ASC").Limit(limit).Offset(offset).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	out := make([]UserView, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.view())
	}
	return out, total, nil
}

// CreateUserInput son los datos para crear un usuario en un tenant.
type CreateUserInput struct {
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Password string `json:"password"`
	RoleCode string `json:"role_code"`
}

func validatePassword(p string) error {
	if len(p) < minPasswordLen || len(p) > 72 {
		return validationf("la contraseña debe tener entre %d y 72 caracteres", minPasswordLen)
	}
	return nil
}

// CreateTenantUser crea un usuario (TENANT_ADMIN o rol no admin) y le copia los
// permisos por defecto de su rol.
func (s *Service) CreateTenantUser(ctx context.Context, actor Actor, tenantID uuid.UUID, in CreateUserInput) (*UserView, error) {
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.FullName = strings.TrimSpace(in.FullName)
	in.RoleCode = strings.ToUpper(strings.TrimSpace(in.RoleCode))
	switch {
	case in.Email == "" || len(in.Email) > 255 || !strings.Contains(in.Email, "@"):
		return nil, validationf("email inválido")
	case len(in.FullName) < 2 || len(in.FullName) > 255:
		return nil, validationf("full_name debe tener entre 2 y 255 caracteres")
	case in.RoleCode == "" || in.RoleCode == constants.RoleSuperAdmin:
		return nil, validationf("role_code inválido (SUPER_ADMIN no se crea en un tenant)")
	}
	if err := validatePassword(in.Password); err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	var view *UserView
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		tenant, err := s.requireTenant(ctx, tx, tenantID)
		if err != nil {
			return err
		}
		if !tenant.IsActive {
			return conflictf("el tenant está inactivo")
		}
		var role models.Role
		if err := tx.Where("code = ?", in.RoleCode).First(&role).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return validationf("rol %q no existe", in.RoleCode)
			}
			return err
		}
		var dup int64
		if err := tx.Unscoped().Model(&models.User{}).Where("email = ?", in.Email).Count(&dup).Error; err != nil {
			return err
		}
		if dup > 0 {
			return conflictf("el email ya está registrado")
		}

		now := s.now()
		u := models.User{
			ID: uuid.New(), TenantID: &tenantID, RoleID: role.ID, Email: in.Email, PasswordHash: string(hash),
			FullName: in.FullName, IsActive: true, CreatedAt: now, UpdatedAt: now,
		}
		if err := tx.Create(&u).Error; err != nil {
			return err
		}

		granted := 0
		if in.RoleCode != constants.RoleTenantAdmin {
			granted, err = s.copyRoleDefaults(tx, u.ID, in.RoleCode, actor.UserID, now)
			if err != nil {
				return err
			}
		}
		if err := s.audit(tx, actor, &tenantID, &u.ID, nil, models.AuditUserCreated, map[string]any{
			"email": u.Email, "role": in.RoleCode, "default_permissions": granted,
		}); err != nil {
			return err
		}
		view = &UserView{ID: u.ID, TenantID: u.TenantID, Email: u.Email, FullName: u.FullName, Role: in.RoleCode, IsActive: true, CreatedAt: now}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return view, nil
}

// copyRoleDefaults inserta en user_module_permissions los defaults del rol.
func (s *Service) copyRoleDefaults(tx *gorm.DB, userID uuid.UUID, roleCode string, grantedBy uuid.UUID, now time.Time) (int, error) {
	var defaults []models.RoleModuleDefault
	if err := tx.Joins("JOIN roles r ON r.id = role_module_defaults.role_id").
		Where("r.code = ?", roleCode).Find(&defaults).Error; err != nil {
		return 0, err
	}
	if len(defaults) == 0 {
		return 0, nil
	}
	rows := make([]models.UserModulePermission, 0, len(defaults))
	for _, d := range defaults {
		gb := grantedBy
		rows = append(rows, models.UserModulePermission{
			ID: uuid.New(), UserID: userID, ModuleID: d.ModuleID, ActionFlags: d.ActionFlags,
			GrantedBy: &gb, CreatedAt: now, UpdatedAt: now,
		})
	}
	if err := tx.CreateInBatches(rows, 100).Error; err != nil {
		return 0, err
	}
	return len(rows), nil
}

// ── Permisos de usuario ─────────────────────────────────────────────────────

// PermissionView es el permiso de un usuario sobre un módulo.
type PermissionView struct {
	ModuleCode      string `json:"module_code"`
	Name            string `json:"name"`
	Kind            string `json:"kind"`
	ParentCode      string `json:"parent_code,omitempty"`
	EnabledInTenant bool   `json:"enabled_in_tenant"`
	CanView         bool   `json:"can_view"`
	CanCreate       bool   `json:"can_create"`
	CanEdit         bool   `json:"can_edit"`
	CanDelete       bool   `json:"can_delete"`
	// Default*: valores por defecto del rol (referencia para la UI).
	DefaultView   bool `json:"default_view"`
	DefaultCreate bool `json:"default_create"`
	DefaultEdit   bool `json:"default_edit"`
	DefaultDelete bool `json:"default_delete"`
}

// UserPermissions agrupa el usuario y sus permisos.
type UserPermissions struct {
	User UserView `json:"user"`
	// ResolvedByRole: SUPER_ADMIN y TENANT_ADMIN no usan permisos por usuario.
	ResolvedByRole bool             `json:"resolved_by_role"`
	Permissions    []PermissionView `json:"permissions"`
}

func isAdminRole(code string) bool {
	return code == constants.RoleSuperAdmin || code == constants.RoleTenantAdmin
}

// GetUserPermissions devuelve los permisos configurados de un usuario.
func (s *Service) GetUserPermissions(ctx context.Context, userID uuid.UUID) (*UserPermissions, error) {
	return s.getUserPermissions(ctx, userID, nil)
}

func (s *Service) getUserPermissions(ctx context.Context, userID uuid.UUID, scope *uuid.UUID) (*UserPermissions, error) {
	u, err := s.loadUserIn(ctx, s.db, userID, scope)
	if err != nil {
		return nil, err
	}
	out := &UserPermissions{User: u.view(), ResolvedByRole: isAdminRole(u.RoleCode), Permissions: []PermissionView{}}
	if out.ResolvedByRole {
		return out, nil
	}

	mods, codes, err := s.allModules(ctx, s.db)
	if err != nil {
		return nil, err
	}
	var perms []models.UserModulePermission
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).Find(&perms).Error; err != nil {
		return nil, err
	}
	permByModule := make(map[uuid.UUID]models.UserModulePermission, len(perms))
	for _, p := range perms {
		permByModule[p.ModuleID] = p
	}
	var defaults []models.RoleModuleDefault
	if err := s.db.WithContext(ctx).Where("role_id = ?", u.RoleID).Find(&defaults).Error; err != nil {
		return nil, err
	}
	defByModule := make(map[uuid.UUID]models.RoleModuleDefault, len(defaults))
	for _, d := range defaults {
		defByModule[d.ModuleID] = d
	}
	var tenantRows []models.TenantModule
	if u.TenantID != nil {
		if err := s.db.WithContext(ctx).Where("tenant_id = ?", *u.TenantID).Find(&tenantRows).Error; err != nil {
			return nil, err
		}
	}
	tenantState := make(map[uuid.UUID]bool, len(tenantRows))
	for _, r := range tenantRows {
		tenantState[r.ModuleID] = r.IsEnabled
	}

	for _, m := range mods {
		if m.Scope != modules.ScopeTenant || !m.IsActive {
			continue
		}
		enabled, has := tenantState[m.ID]
		v := PermissionView{ModuleCode: m.Code, Name: m.Name, Kind: m.Kind, EnabledInTenant: !has || enabled}
		if m.ParentID != nil {
			v.ParentCode = codes[*m.ParentID]
		}
		if p, ok := permByModule[m.ID]; ok {
			v.CanView, v.CanCreate, v.CanEdit, v.CanDelete = p.CanView, p.CanCreate, p.CanEdit, p.CanDelete
		}
		if d, ok := defByModule[m.ID]; ok {
			v.DefaultView, v.DefaultCreate, v.DefaultEdit, v.DefaultDelete = d.CanView, d.CanCreate, d.CanEdit, d.CanDelete
		}
		out.Permissions = append(out.Permissions, v)
	}
	return out, nil
}

// PermissionInput es un permiso solicitado para un módulo.
type PermissionInput struct {
	ModuleCode string `json:"module_code"`
	CanView    bool   `json:"can_view"`
	CanCreate  bool   `json:"can_create"`
	CanEdit    bool   `json:"can_edit"`
	CanDelete  bool   `json:"can_delete"`
}

// SetUserPermissions hace upsert de los permisos indicados. Escribir (create/edit/delete)
// exige view. Los administradores se resuelven por rol y no admiten permisos por usuario.
func (s *Service) SetUserPermissions(ctx context.Context, actor Actor, userID uuid.UUID, inputs []PermissionInput) error {
	return s.setUserPermissions(ctx, actor, userID, inputs, nil)
}

// setUserPermissions: con scope (Tenant Admin) el usuario debe ser del tenant y solo se
// pueden delegar los módulos asignables (activos, TENANT, no reservados y habilitados en el tenant).
func (s *Service) setUserPermissions(ctx context.Context, actor Actor, userID uuid.UUID, inputs []PermissionInput, scope *uuid.UUID) error {
	if len(inputs) == 0 {
		return validationf("permissions no puede estar vacío")
	}
	seen := map[string]bool{}
	for _, in := range inputs {
		if in.ModuleCode == "" {
			return validationf("module_code es obligatorio")
		}
		if seen[in.ModuleCode] {
			return validationf("módulo repetido: %s", in.ModuleCode)
		}
		seen[in.ModuleCode] = true
		if (in.CanCreate || in.CanEdit || in.CanDelete) && !in.CanView {
			return validationf("%s: create/edit/delete requieren can_view", in.ModuleCode)
		}
	}

	var tenantID *uuid.UUID
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		u, err := s.loadUserIn(ctx, tx, userID, scope)
		if err != nil {
			return err
		}
		var assignable map[string]struct{}
		if scope != nil {
			assignable, err = s.assignableCodes(ctx, tx, *scope)
			if err != nil {
				return err
			}
		}
		if isAdminRole(u.RoleCode) {
			return validationf("%s se resuelve por rol: no admite permisos por usuario", u.RoleCode)
		}
		tenantID = u.TenantID

		changes := make([]map[string]any, 0, len(inputs))
		now := s.now()
		for _, in := range inputs {
			var m models.Module
			if err := tx.Where("code = ?", in.ModuleCode).First(&m).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return validationf("módulo %q no existe", in.ModuleCode)
				}
				return err
			}
			if m.Scope != modules.ScopeTenant {
				return validationf("el módulo %q es de plataforma", in.ModuleCode)
			}
			if assignable != nil {
				if _, ok := assignable[m.Code]; !ok {
					return validationf("el módulo %q no es asignable en esta entidad", in.ModuleCode)
				}
			}

			actorID := actor.UserID
			var existing models.UserModulePermission
			err := tx.Where("user_id = ? AND module_id = ?", userID, m.ID).First(&existing).Error
			switch {
			case errors.Is(err, gorm.ErrRecordNotFound):
				row := models.UserModulePermission{
					ID: uuid.New(), UserID: userID, ModuleID: m.ID,
					ActionFlags: models.ActionFlags{CanView: in.CanView, CanCreate: in.CanCreate, CanEdit: in.CanEdit, CanDelete: in.CanDelete},
					GrantedBy:   &actorID, CreatedAt: now, UpdatedAt: now,
				}
				if err := tx.Create(&row).Error; err != nil {
					return err
				}
			case err != nil:
				return err
			default:
				if existing.CanView == in.CanView && existing.CanCreate == in.CanCreate &&
					existing.CanEdit == in.CanEdit && existing.CanDelete == in.CanDelete {
					continue
				}
				if err := tx.Model(&models.UserModulePermission{}).Where("id = ?", existing.ID).Updates(map[string]any{
					"can_view": in.CanView, "can_create": in.CanCreate, "can_edit": in.CanEdit, "can_delete": in.CanDelete,
					"granted_by": actorID, "updated_at": now,
				}).Error; err != nil {
					return err
				}
			}
			changes = append(changes, map[string]any{
				"module": m.Code, "view": in.CanView, "create": in.CanCreate, "edit": in.CanEdit, "delete": in.CanDelete,
			})
		}
		if len(changes) == 0 {
			return nil
		}
		return s.audit(tx, actor, tenantID, &userID, nil, models.AuditUserPermissionsSet, map[string]any{"changes": changes})
	})
	if err != nil {
		return err
	}
	s.cache.Invalidate(userID)
	return nil
}

// ── Contraseña y estado ─────────────────────────────────────────────────────

// SetUserPassword cambia la contraseña y revoca las sesiones (token_version++).
func (s *Service) SetUserPassword(ctx context.Context, actor Actor, userID uuid.UUID, newPassword string) error {
	return s.setUserPassword(ctx, actor, userID, newPassword, nil)
}

func (s *Service) setUserPassword(ctx context.Context, actor Actor, userID uuid.UUID, newPassword string, scope *uuid.UUID) error {
	if err := validatePassword(newPassword); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		u, err := s.loadUserIn(ctx, tx, userID, scope)
		if err != nil {
			return err
		}
		if err := tx.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]any{
			"password_hash": string(hash),
			"token_version": gorm.Expr("token_version + 1"),
			"updated_at":    s.now(),
		}).Error; err != nil {
			return err
		}
		// Nunca se registra la contraseña ni su hash.
		return s.audit(tx, actor, u.TenantID, &userID, nil, models.AuditUserPasswordChanged, map[string]any{"sessions_revoked": true})
	})
	if err != nil {
		return err
	}
	s.cache.Invalidate(userID)
	return nil
}

// SetUserStatus activa/desactiva un usuario y revoca sus sesiones (token_version++).
// No permite desactivar al último TENANT_ADMIN activo de un tenant (D3) ni a uno mismo.
func (s *Service) SetUserStatus(ctx context.Context, actor Actor, userID uuid.UUID, active bool) error {
	return s.setUserStatus(ctx, actor, userID, active, nil)
}

func (s *Service) setUserStatus(ctx context.Context, actor Actor, userID uuid.UUID, active bool, scope *uuid.UUID) error {
	if !active && userID == actor.UserID {
		return validationf("no puedes desactivar tu propio usuario")
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		u, err := s.loadUserIn(ctx, tx, userID, scope)
		if err != nil {
			return err
		}
		if u.IsActive == active {
			return nil
		}
		if !active {
			if err := s.ensureNotLastTenantAdmin(tx, u); err != nil {
				return err
			}
		}
		if err := tx.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]any{
			"is_active":     active,
			"token_version": gorm.Expr("token_version + 1"),
			"updated_at":    s.now(),
		}).Error; err != nil {
			return err
		}
		return s.audit(tx, actor, u.TenantID, &userID, nil, models.AuditUserStatusChanged, map[string]any{
			"is_active": active, "sessions_revoked": true,
		})
	})
	if err != nil {
		return err
	}
	s.cache.Invalidate(userID)
	return nil
}

// ensureNotLastTenantAdmin impide dejar a una entidad sin Tenant Admin activo (D3):
// vale para desactivar y para degradar al último administrador.
func (s *Service) ensureNotLastTenantAdmin(tx *gorm.DB, u *userRow) error {
	if u.RoleCode != constants.RoleTenantAdmin || u.TenantID == nil || !u.IsActive {
		return nil
	}
	var others int64
	if err := tx.Table("users AS u").Joins("JOIN roles r ON r.id = u.role_id").
		Where("u.tenant_id = ? AND r.code = ? AND u.is_active = ? AND u.deleted_at IS NULL AND u.id <> ?",
			*u.TenantID, constants.RoleTenantAdmin, true, u.ID).Count(&others).Error; err != nil {
		return err
	}
	if others == 0 {
		return conflictf("no se puede desactivar ni degradar al último Tenant Admin activo de la entidad")
	}
	return nil
}
