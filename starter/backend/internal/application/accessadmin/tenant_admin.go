package accessadmin

import (
	"context"
	"errors"
	"strings"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/modules"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ErrSessionRevoked: el actor ya no es válido (inactivo, token_version distinto o eliminado).
var ErrSessionRevoked = errors.New("session revoked")

// nonDelegableModules son módulos que un Tenant Admin no puede delegar: la
// administración de usuarios es exclusiva del rol TENANT_ADMIN.
var nonDelegableModules = map[string]struct{}{
	modules.CodeUsers: {},
}

// ActorPolicy encapsula lo que un Tenant Admin puede hacer. El tenant SIEMPRE sale del
// actor verificado (JWT + BD), nunca del cuerpo de la petición.
type ActorPolicy struct {
	UserID   uuid.UUID
	TenantID uuid.UUID
	Role     string
}

// Actor convierte la política en el actor de auditoría.
func (p ActorPolicy) Actor() Actor { return Actor{UserID: p.UserID} }

func (p ActorPolicy) scope() *uuid.UUID { t := p.TenantID; return &t }

// CheckRoleAssignable: un Tenant Admin no crea ni promueve a nadie a SUPER_ADMIN.
func (p ActorPolicy) CheckRoleAssignable(roleCode string) error {
	if strings.EqualFold(strings.TrimSpace(roleCode), constants.RoleSuperAdmin) {
		return forbiddenf("no puedes asignar el rol SUPER_ADMIN")
	}
	return nil
}

// ResolveTenantActor verifica contra la BD que quien llama sigue siendo un TENANT_ADMIN
// activo del tenant del JWT, con el token_version vigente. Se ejecuta en cada petición de
// la API de Tenant Admin, con independencia de PBAC_ENFORCE (es una API privilegiada).
func (s *Service) ResolveTenantActor(ctx context.Context, userID, jwtTenantID uuid.UUID, tokenVersion int) (*ActorPolicy, error) {
	var row struct {
		TenantID     *uuid.UUID
		IsActive     bool
		TokenVersion int
		RoleCode     string
	}
	res := s.db.WithContext(ctx).Table("users AS u").
		Select("u.tenant_id AS tenant_id, u.is_active AS is_active, u.token_version AS token_version, r.code AS role_code").
		Joins("JOIN roles r ON r.id = u.role_id").
		Where("u.id = ? AND u.deleted_at IS NULL", userID).Limit(1).Scan(&row)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 || !row.IsActive || row.TokenVersion != tokenVersion {
		return nil, ErrSessionRevoked
	}
	if row.RoleCode != constants.RoleTenantAdmin || row.TenantID == nil || *row.TenantID != jwtTenantID {
		return nil, forbiddenf("se requiere rol TENANT_ADMIN de la entidad")
	}
	return &ActorPolicy{UserID: userID, TenantID: *row.TenantID, Role: row.RoleCode}, nil
}

// ── Usuarios ────────────────────────────────────────────────────────────────

// TenantListUsers lista los usuarios del tenant del actor.
func (s *Service) TenantListUsers(ctx context.Context, p ActorPolicy, limit, offset int) ([]UserView, int64, error) {
	return s.ListTenantUsers(ctx, p.TenantID, limit, offset)
}

// TenantCreateUser crea un usuario en el tenant del actor (nunca en otro).
func (s *Service) TenantCreateUser(ctx context.Context, p ActorPolicy, in CreateUserInput) (*UserView, error) {
	if err := p.CheckRoleAssignable(in.RoleCode); err != nil {
		return nil, err
	}
	return s.CreateTenantUser(ctx, p.Actor(), p.TenantID, in)
}

// TenantGetUser devuelve un usuario del tenant del actor (otro tenant ⇒ no encontrado).
func (s *Service) TenantGetUser(ctx context.Context, p ActorPolicy, id uuid.UUID) (*UserView, error) {
	u, err := s.loadUserIn(ctx, s.db, id, p.scope())
	if err != nil {
		return nil, err
	}
	v := u.view()
	return &v, nil
}

// TenantUpdateUserInput: campos editables. tenant_id no existe aquí a propósito.
type TenantUpdateUserInput struct {
	FullName *string `json:"full_name"`
	Email    *string `json:"email"`
	RoleCode *string `json:"role_code"`
}

// TenantUpdateUser edita nombre, email y rol de un usuario del tenant. Un cambio de rol
// revoca sus sesiones y nunca puede llegar a SUPER_ADMIN ni dejar la entidad sin Tenant Admin.
func (s *Service) TenantUpdateUser(ctx context.Context, p ActorPolicy, id uuid.UUID, in TenantUpdateUserInput) (*UserView, error) {
	return s.updateUser(ctx, p.Actor(), p.scope(), id, in)
}

// UpdateUser es la variante de SUPER_ADMIN: sin restricción de tenant (scope nil).
func (s *Service) UpdateUser(ctx context.Context, actor Actor, id uuid.UUID, in TenantUpdateUserInput) (*UserView, error) {
	return s.updateUser(ctx, actor, nil, id, in)
}

func (s *Service) updateUser(ctx context.Context, actor Actor, scope *uuid.UUID, id uuid.UUID, in TenantUpdateUserInput) (*UserView, error) {
	if in.RoleCode != nil && strings.EqualFold(strings.TrimSpace(*in.RoleCode), constants.RoleSuperAdmin) {
		return nil, forbiddenf("no puedes asignar el rol SUPER_ADMIN")
	}

	var view *UserView
	revokeUser := false
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		u, err := s.loadUserIn(ctx, tx, id, scope)
		if err != nil {
			return err
		}
		updates := map[string]any{}
		changes := map[string]any{}

		if in.FullName != nil {
			n := strings.TrimSpace(*in.FullName)
			if len(n) < 2 || len(n) > 255 {
				return validationf("full_name debe tener entre 2 y 255 caracteres")
			}
			if n != u.FullName {
				updates["full_name"], changes["full_name"] = n, true
			}
		}
		if in.Email != nil {
			e := strings.ToLower(strings.TrimSpace(*in.Email))
			if e == "" || len(e) > 255 || !strings.Contains(e, "@") {
				return validationf("email inválido")
			}
			if e != u.Email {
				var dup int64
				if err := tx.Unscoped().Model(&models.User{}).Where("email = ? AND id <> ?", e, u.ID).Count(&dup).Error; err != nil {
					return err
				}
				if dup > 0 {
					return conflictf("el email ya está registrado")
				}
				updates["email"], changes["email"] = e, true
			}
		}

		newRole := u.RoleCode
		if in.RoleCode != nil {
			code := strings.ToUpper(strings.TrimSpace(*in.RoleCode))
			if code != u.RoleCode {
				if u.ID == actor.UserID {
					return validationf("no puedes cambiar tu propio rol")
				}
				var role models.Role
				if err := tx.Where("code = ?", code).First(&role).Error; err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						return validationf("rol %q no existe", code)
					}
					return err
				}
				if code != constants.RoleTenantAdmin {
					if err := s.ensureNotLastTenantAdmin(tx, u); err != nil {
						return err
					}
				}
				updates["role_id"] = role.ID
				updates["token_version"] = gorm.Expr("token_version + 1")
				changes["role"] = map[string]any{"from": u.RoleCode, "to": code}
				newRole = code
				revokeUser = true
			}
		}

		if len(updates) > 0 {
			now := s.now()
			updates["updated_at"] = now
			if err := tx.Model(&models.User{}).Where("id = ?", u.ID).Updates(updates).Error; err != nil {
				return err
			}
			// Pasar a un rol no admin: completar permisos faltantes con los defaults del rol.
			if _, roleChanged := changes["role"]; roleChanged && newRole != constants.RoleTenantAdmin {
				if err := s.fillMissingRoleDefaults(tx, u.ID, newRole, actor.UserID, now); err != nil {
					return err
				}
			}
			if err := s.audit(tx, actor, u.TenantID, &u.ID, nil, models.AuditUserUpdated, map[string]any{"changes": changes}); err != nil {
				return err
			}
		}

		updated, err := s.loadUserIn(ctx, tx, id, scope)
		if err != nil {
			return err
		}
		v := updated.view()
		view = &v
		return nil
	})
	if err != nil {
		return nil, err
	}
	if revokeUser {
		s.cache.Invalidate(id)
	}
	return view, nil
}

// fillMissingRoleDefaults inserta los defaults del rol solo para los módulos sin fila.
func (s *Service) fillMissingRoleDefaults(tx *gorm.DB, userID uuid.UUID, roleCode string, grantedBy uuid.UUID, now time.Time) error {
	var defaults []models.RoleModuleDefault
	if err := tx.Joins("JOIN roles r ON r.id = role_module_defaults.role_id").
		Where("r.code = ?", roleCode).Find(&defaults).Error; err != nil {
		return err
	}
	var have []models.UserModulePermission
	if err := tx.Select("module_id").Where("user_id = ?", userID).Find(&have).Error; err != nil {
		return err
	}
	exists := make(map[uuid.UUID]struct{}, len(have))
	for _, h := range have {
		exists[h.ModuleID] = struct{}{}
	}
	var rows []models.UserModulePermission
	for _, d := range defaults {
		if _, ok := exists[d.ModuleID]; ok {
			continue
		}
		gb := grantedBy
		rows = append(rows, models.UserModulePermission{
			ID: uuid.New(), UserID: userID, ModuleID: d.ModuleID, ActionFlags: d.ActionFlags,
			GrantedBy: &gb, CreatedAt: now, UpdatedAt: now,
		})
	}
	if len(rows) == 0 {
		return nil
	}
	return tx.CreateInBatches(rows, 100).Error
}

// TenantSetUserPassword cambia la contraseña de un usuario del tenant (revoca sus sesiones).
func (s *Service) TenantSetUserPassword(ctx context.Context, p ActorPolicy, id uuid.UUID, newPassword string) error {
	return s.setUserPassword(ctx, p.Actor(), id, newPassword, p.scope())
}

// TenantSetUserStatus activa/desactiva un usuario del tenant (revoca sus sesiones).
// No deja a la entidad sin Tenant Admin activo ni permite desactivarse a uno mismo.
func (s *Service) TenantSetUserStatus(ctx context.Context, p ActorPolicy, id uuid.UUID, active bool) error {
	return s.setUserStatus(ctx, p.Actor(), id, active, p.scope())
}

// TenantGetUserPermissions devuelve los permisos de un usuario del tenant.
func (s *Service) TenantGetUserPermissions(ctx context.Context, p ActorPolicy, id uuid.UUID) (*UserPermissions, error) {
	return s.getUserPermissions(ctx, id, p.scope())
}

// TenantSetUserPermissions asigna permisos a un usuario del tenant, solo sobre módulos asignables.
func (s *Service) TenantSetUserPermissions(ctx context.Context, p ActorPolicy, id uuid.UUID, inputs []PermissionInput) error {
	return s.setUserPermissions(ctx, p.Actor(), id, inputs, p.scope())
}

// ── Catálogo asignable ──────────────────────────────────────────────────────

// AssignableModule es un módulo que el Tenant Admin puede delegar.
type AssignableModule struct {
	Code        string   `json:"code"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Kind        string   `json:"kind"`
	ParentCode  string   `json:"parent_code,omitempty"`
	Route       string   `json:"route"`
	Order       int      `json:"order"`
	Actions     []string `json:"actions"`
}

// AssignableModules devuelve la intersección entre los módulos activos del sistema (scope
// TENANT, no reservados) y el techo del tenant (tenant_modules; sin fila = habilitado). Una
// sección exige que su módulo padre también esté habilitado.
func (s *Service) AssignableModules(ctx context.Context, tenantID uuid.UUID) ([]AssignableModule, error) {
	if _, err := s.requireTenant(ctx, s.db, tenantID); err != nil {
		return nil, err
	}
	mods, codes, err := s.assignableSet(ctx, s.db, tenantID)
	if err != nil {
		return nil, err
	}
	out := make([]AssignableModule, 0, len(mods))
	for _, m := range mods {
		am := AssignableModule{
			Code: m.Code, Name: m.Name, Description: m.Description, Kind: m.Kind, Route: m.Route, Order: m.SortOrder,
			Actions: []string{string(modules.ActionView), string(modules.ActionCreate), string(modules.ActionEdit), string(modules.ActionDelete)},
		}
		if m.ParentID != nil {
			am.ParentCode = codes[*m.ParentID]
		}
		out = append(out, am)
	}
	return out, nil
}

func (s *Service) assignableCodes(ctx context.Context, tx *gorm.DB, tenantID uuid.UUID) (map[string]struct{}, error) {
	mods, _, err := s.assignableSet(ctx, tx, tenantID)
	if err != nil {
		return nil, err
	}
	set := make(map[string]struct{}, len(mods))
	for _, m := range mods {
		set[m.Code] = struct{}{}
	}
	return set, nil
}

func (s *Service) assignableSet(ctx context.Context, tx *gorm.DB, tenantID uuid.UUID) ([]models.Module, map[uuid.UUID]string, error) {
	all, codes, err := s.allModules(ctx, tx)
	if err != nil {
		return nil, nil, err
	}
	var rows []models.TenantModule
	if err := tx.WithContext(ctx).Where("tenant_id = ?", tenantID).Find(&rows).Error; err != nil {
		return nil, nil, err
	}
	state := make(map[uuid.UUID]bool, len(rows))
	for _, r := range rows {
		state[r.ModuleID] = r.IsEnabled
	}
	enabled := func(id uuid.UUID) bool { v, ok := state[id]; return !ok || v }
	byID := make(map[uuid.UUID]models.Module, len(all))
	for _, m := range all {
		byID[m.ID] = m
	}

	var out []models.Module
	for _, m := range all {
		if !m.IsActive || m.Scope != modules.ScopeTenant || !enabled(m.ID) {
			continue
		}
		if _, reserved := nonDelegableModules[m.Code]; reserved {
			continue
		}
		if m.ParentID != nil {
			parent, ok := byID[*m.ParentID]
			if !ok || !parent.IsActive || !enabled(parent.ID) {
				continue
			}
			if _, reserved := nonDelegableModules[parent.Code]; reserved {
				continue
			}
		}
		out = append(out, m)
	}
	return out, codes, nil
}

// RoleTemplate son los permisos por defecto de un rol, por módulo.
type RoleTemplate struct {
	Role    string                    `json:"role"`
	Modules map[string]TemplateAction `json:"modules"`
}

// TemplateAction son las acciones de un módulo en una plantilla de rol.
type TemplateAction struct {
	CanView   bool `json:"can_view"`
	CanCreate bool `json:"can_create"`
	CanEdit   bool `json:"can_edit"`
	CanDelete bool `json:"can_delete"`
}

// RoleTemplates devuelve los defaults (role_module_defaults) de los roles no administradores.
// Los administradores se resuelven por rol y no tienen plantilla editable.
func (s *Service) RoleTemplates(ctx context.Context) ([]RoleTemplate, error) {
	var rows []struct {
		RoleCode   string
		ModuleCode string
		models.ActionFlags
	}
	err := s.db.WithContext(ctx).Table("role_module_defaults AS d").
		Select("r.code AS role_code, m.code AS module_code, d.can_view, d.can_create, d.can_edit, d.can_delete").
		Joins("JOIN roles r ON r.id = d.role_id").
		Joins("JOIN modules m ON m.id = d.module_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	byRole := map[string]*RoleTemplate{}
	for _, code := range []string{constants.RoleFormulador, constants.RoleEvaluador, constants.RoleAnalista, constants.RoleViewer} {
		byRole[code] = &RoleTemplate{Role: code, Modules: map[string]TemplateAction{}}
	}
	for _, r := range rows {
		t, ok := byRole[r.RoleCode]
		if !ok {
			continue
		}
		t.Modules[r.ModuleCode] = TemplateAction{CanView: r.CanView, CanCreate: r.CanCreate, CanEdit: r.CanEdit, CanDelete: r.CanDelete}
	}
	out := make([]RoleTemplate, 0, len(byRole))
	for _, code := range []string{constants.RoleFormulador, constants.RoleEvaluador, constants.RoleAnalista, constants.RoleViewer} {
		out = append(out, *byRole[code])
	}
	return out, nil
}
