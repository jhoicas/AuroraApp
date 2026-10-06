// Package access implementa la autorización PBAC (ADR-0001): resuelve el árbol de
// módulos/permisos de un usuario y responde Can(user, módulo, acción) con una
// caché en memoria de vida corta.
//
// Reglas:
//   - SUPER_ADMIN: acceso supremo por lógica pura (sin consultar permisos ni tenant_modules).
//   - TENANT_ADMIN: acceso completo a los módulos TENANT habilitados para su tenant
//     (D2: un módulo deshabilitado se niega a todos), sin leer user_module_permissions.
//     Sin fila en tenant_modules, el módulo está habilitado (solo un false explícito lo apaga).
//   - Resto de roles: permiso explícito en user_module_permissions Y módulo habilitado.
//   - Módulos PLATFORM: solo SUPER_ADMIN. Módulo desconocido o inactivo: denegado.
//   - Una sección exige también que su módulo padre esté habilitado.
package access

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/modules"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DefaultCacheTTL es la vida de la caché en memoria.
const DefaultCacheTTL = 30 * time.Second

var (
	// ErrSessionRevoked: usuario inexistente/inactivo o token_version distinto.
	ErrSessionRevoked = errors.New("session revoked")
	// ErrUserNotFound: el usuario no existe (o fue eliminado).
	ErrUserNotFound = errors.New("user not found")
)

// Razones de decisión (útiles para logs y respuestas).
const (
	ReasonSuperAdmin     = "super_admin"
	ReasonTenantAdmin    = "tenant_admin"
	ReasonGranted        = "granted"
	ReasonNoPermission   = "no_permission"
	ReasonModuleDisabled = "module_disabled"
	ReasonModuleUnknown  = "module_unknown"
	ReasonPlatformModule = "platform_module"
	ReasonNoTenant       = "no_tenant"
	ReasonUserInactive   = "user_inactive"
)

// Decision es el resultado de Can.
type Decision struct {
	Allowed bool
	Reason  string
	Role    string
}

type userSnapshot struct {
	ID           uuid.UUID
	Role         string
	TenantID     *uuid.UUID
	Active       bool
	TokenVersion int
	Perms        map[uuid.UUID]modules.Actions // solo roles no admin
	expires      time.Time
}

type moduleCatalog struct {
	byCode  map[string]models.Module
	byID    map[uuid.UUID]models.Module
	expires time.Time
}

type tenantSnapshot struct {
	enabled map[uuid.UUID]bool // module_id → habilitado (solo filas existentes)
	expires time.Time
}

// isEnabled: sin fila en tenant_modules el módulo está habilitado por defecto
// (tenants y módulos nuevos funcionan sin sembrar filas); solo un false explícito lo apaga.
func (t *tenantSnapshot) isEnabled(moduleID uuid.UUID) bool {
	v, ok := t.enabled[moduleID]
	return !ok || v
}

// Service resuelve accesos con caché. Es seguro para uso concurrente.
type Service struct {
	db  *gorm.DB
	ttl time.Duration
	now func() time.Time

	mu      sync.RWMutex
	users   map[uuid.UUID]*userSnapshot
	tenants map[uuid.UUID]*tenantSnapshot
	catalog *moduleCatalog
}

// NewService crea el servicio; ttl<=0 usa DefaultCacheTTL.
func NewService(db *gorm.DB, ttl time.Duration) *Service {
	if ttl <= 0 {
		ttl = DefaultCacheTTL
	}
	return &Service{
		db:      db,
		ttl:     ttl,
		now:     time.Now,
		users:   make(map[uuid.UUID]*userSnapshot),
		tenants: make(map[uuid.UUID]*tenantSnapshot),
	}
}

// Invalidate descarta la caché de un usuario (llamar tras cambiar sus permisos).
func (s *Service) Invalidate(userID uuid.UUID) {
	s.mu.Lock()
	delete(s.users, userID)
	s.mu.Unlock()
}

// InvalidateTenant descarta los módulos habilitados de un tenant y los
// snapshots de sus usuarios.
func (s *Service) InvalidateTenant(tenantID uuid.UUID) {
	s.mu.Lock()
	delete(s.tenants, tenantID)
	for id, u := range s.users {
		if u.TenantID != nil && *u.TenantID == tenantID {
			delete(s.users, id)
		}
	}
	s.mu.Unlock()
}

// InvalidateAll vacía toda la caché.
func (s *Service) InvalidateAll() {
	s.mu.Lock()
	s.users = make(map[uuid.UUID]*userSnapshot)
	s.tenants = make(map[uuid.UUID]*tenantSnapshot)
	s.catalog = nil
	s.mu.Unlock()
}

// ValidateSession comprueba que el usuario exista, esté activo y que el
// token_version del JWT coincida con el vigente (con caché de vida corta).
func (s *Service) ValidateSession(ctx context.Context, userID uuid.UUID, tokenVersion int) error {
	u, err := s.user(ctx, userID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return ErrSessionRevoked
		}
		return err
	}
	if !u.Active || u.TokenVersion != tokenVersion {
		return ErrSessionRevoked
	}
	return nil
}

// Can responde si el usuario puede ejecutar la acción sobre el módulo.
func (s *Service) Can(ctx context.Context, userID uuid.UUID, moduleCode string, action modules.Action) (Decision, error) {
	u, err := s.user(ctx, userID)
	if err != nil {
		return Decision{}, err
	}
	d := Decision{Role: u.Role}

	if !u.Active {
		d.Reason = ReasonUserInactive
		return d, nil
	}
	// Acceso supremo por lógica pura.
	if u.Role == constants.RoleSuperAdmin {
		d.Allowed, d.Reason = true, ReasonSuperAdmin
		return d, nil
	}

	cat, err := s.modulesCatalog(ctx)
	if err != nil {
		return Decision{}, err
	}
	mod, ok := cat.byCode[moduleCode]
	if !ok || !mod.IsActive {
		d.Reason = ReasonModuleUnknown
		return d, nil
	}
	if mod.Scope != modules.ScopeTenant {
		d.Reason = ReasonPlatformModule
		return d, nil
	}
	if u.TenantID == nil {
		d.Reason = ReasonNoTenant
		return d, nil
	}

	enabled, err := s.moduleEnabled(ctx, *u.TenantID, mod, cat)
	if err != nil {
		return Decision{}, err
	}
	if !enabled {
		d.Reason = ReasonModuleDisabled
		return d, nil
	}

	if u.Role == constants.RoleTenantAdmin {
		d.Allowed, d.Reason = true, ReasonTenantAdmin
		return d, nil
	}

	if u.Perms[mod.ID].Allows(action) {
		d.Allowed, d.Reason = true, ReasonGranted
		return d, nil
	}
	d.Reason = ReasonNoPermission
	return d, nil
}

// Permissions son los flags resueltos de un módulo.
type Permissions struct {
	View   bool `json:"view"`
	Create bool `json:"create"`
	Edit   bool `json:"edit"`
	Delete bool `json:"delete"`
}

// ResolvedModule es un nodo del árbol de acceso.
type ResolvedModule struct {
	Code        string           `json:"code"`
	Name        string           `json:"name"`
	Description string           `json:"description,omitempty"`
	Kind        string           `json:"kind"`
	Scope       string           `json:"scope"`
	Route       string           `json:"route"`
	Order       int              `json:"order"`
	Enabled     bool             `json:"enabled"`
	Permissions Permissions      `json:"permissions"`
	Children    []ResolvedModule `json:"children,omitempty"`
}

// ResolvedAccess es el acceso completo de un usuario (GET /auth/me/access).
type ResolvedAccess struct {
	UserID        string           `json:"user_id"`
	Role          string           `json:"role"`
	TenantID      *string          `json:"tenant_id,omitempty"`
	IsSuperAdmin  bool             `json:"is_super_admin"`
	IsTenantAdmin bool             `json:"is_tenant_admin"`
	TokenVersion  int              `json:"token_version"`
	Modules       []ResolvedModule `json:"modules"`
}

// Resolve devuelve el árbol de módulos con los permisos efectivos del usuario.
// Los módulos deshabilitados para el tenant se incluyen con enabled=false y sin permisos.
func (s *Service) Resolve(ctx context.Context, userID uuid.UUID) (*ResolvedAccess, error) {
	u, err := s.user(ctx, userID)
	if err != nil {
		return nil, err
	}
	cat, err := s.modulesCatalog(ctx)
	if err != nil {
		return nil, err
	}

	out := &ResolvedAccess{
		UserID:        u.ID.String(),
		Role:          u.Role,
		IsSuperAdmin:  u.Role == constants.RoleSuperAdmin,
		IsTenantAdmin: u.Role == constants.RoleTenantAdmin,
		TokenVersion:  u.TokenVersion,
		Modules:       []ResolvedModule{},
	}
	if u.TenantID != nil {
		t := u.TenantID.String()
		out.TenantID = &t
	}

	nodes := make(map[uuid.UUID]*ResolvedModule, len(cat.byID))
	var ordered []models.Module
	for _, m := range cat.byID {
		if m.IsActive {
			ordered = append(ordered, m)
		}
	}
	sort.Slice(ordered, func(i, j int) bool {
		if ordered[i].SortOrder != ordered[j].SortOrder {
			return ordered[i].SortOrder < ordered[j].SortOrder
		}
		return ordered[i].Code < ordered[j].Code
	})

	for _, m := range ordered {
		// Los módulos de plataforma solo se exponen al SUPER_ADMIN.
		if m.Scope != modules.ScopeTenant && u.Role != constants.RoleSuperAdmin {
			continue
		}
		rm := ResolvedModule{
			Code: m.Code, Name: m.Name, Description: m.Description, Kind: m.Kind,
			Scope: m.Scope, Route: m.Route, Order: m.SortOrder,
		}
		switch {
		case !u.Active:
		case u.Role == constants.RoleSuperAdmin:
			rm.Enabled, rm.Permissions = true, fullPermissions()
		case u.TenantID == nil:
		default:
			enabled, err := s.moduleEnabled(ctx, *u.TenantID, m, cat)
			if err != nil {
				return nil, err
			}
			rm.Enabled = enabled
			if enabled {
				if u.Role == constants.RoleTenantAdmin {
					rm.Permissions = fullPermissions()
				} else {
					rm.Permissions = toPermissions(u.Perms[m.ID])
				}
			}
		}
		nodes[m.ID] = &rm
	}

	// Árbol de un nivel (MODULE → SECTION), respetando el orden estable.
	childrenOf := make(map[uuid.UUID][]uuid.UUID)
	var roots []uuid.UUID
	for _, m := range ordered {
		if _, ok := nodes[m.ID]; !ok {
			continue
		}
		if m.ParentID != nil {
			if _, ok := nodes[*m.ParentID]; ok {
				childrenOf[*m.ParentID] = append(childrenOf[*m.ParentID], m.ID)
				continue
			}
		}
		roots = append(roots, m.ID)
	}
	for _, id := range roots {
		n := *nodes[id]
		for _, cid := range childrenOf[id] {
			n.Children = append(n.Children, *nodes[cid])
		}
		out.Modules = append(out.Modules, n)
	}
	return out, nil
}

func fullPermissions() Permissions {
	return Permissions{View: true, Create: true, Edit: true, Delete: true}
}

func toPermissions(a modules.Actions) Permissions {
	return Permissions{View: a.View, Create: a.Create, Edit: a.Edit, Delete: a.Delete}
}

// moduleEnabled: el módulo y su padre (si lo tiene) deben estar habilitados para el tenant.
func (s *Service) moduleEnabled(ctx context.Context, tenantID uuid.UUID, m models.Module, cat *moduleCatalog) (bool, error) {
	t, err := s.tenant(ctx, tenantID)
	if err != nil {
		return false, err
	}
	if !t.isEnabled(m.ID) {
		return false, nil
	}
	if m.ParentID != nil {
		parent, ok := cat.byID[*m.ParentID]
		if !ok || !parent.IsActive || !t.isEnabled(parent.ID) {
			return false, nil
		}
	}
	return true, nil
}

// ── Carga con caché ─────────────────────────────────────────────────────────

type userRow struct {
	ID           uuid.UUID
	TenantID     *uuid.UUID
	IsActive     bool
	TokenVersion int
	RoleCode     string
}

func (s *Service) user(ctx context.Context, id uuid.UUID) (*userSnapshot, error) {
	now := s.now()
	s.mu.RLock()
	u, ok := s.users[id]
	s.mu.RUnlock()
	if ok && now.Before(u.expires) {
		return u, nil
	}

	var row userRow
	res := s.db.WithContext(ctx).Table("users AS u").
		Select("u.id AS id, u.tenant_id AS tenant_id, u.is_active AS is_active, u.token_version AS token_version, r.code AS role_code").
		Joins("JOIN roles r ON r.id = u.role_id").
		Where("u.id = ? AND u.deleted_at IS NULL", id).
		Limit(1).Scan(&row)
	if res.Error != nil {
		return nil, fmt.Errorf("leer usuario: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		s.mu.Lock()
		delete(s.users, id)
		s.mu.Unlock()
		return nil, ErrUserNotFound
	}

	snap := &userSnapshot{
		ID: row.ID, Role: row.RoleCode, TenantID: row.TenantID,
		Active: row.IsActive, TokenVersion: row.TokenVersion,
		expires: now.Add(s.ttl),
	}
	// Los administradores se resuelven por lógica pura: no se lee user_module_permissions.
	if snap.Role != constants.RoleSuperAdmin && snap.Role != constants.RoleTenantAdmin {
		var perms []models.UserModulePermission
		if err := s.db.WithContext(ctx).Where("user_id = ?", id).Find(&perms).Error; err != nil {
			return nil, fmt.Errorf("leer permisos: %w", err)
		}
		snap.Perms = make(map[uuid.UUID]modules.Actions, len(perms))
		for _, p := range perms {
			snap.Perms[p.ModuleID] = modules.Actions{View: p.CanView, Create: p.CanCreate, Edit: p.CanEdit, Delete: p.CanDelete}
		}
	}

	s.mu.Lock()
	s.users[id] = snap
	s.mu.Unlock()
	return snap, nil
}

func (s *Service) modulesCatalog(ctx context.Context) (*moduleCatalog, error) {
	now := s.now()
	s.mu.RLock()
	c := s.catalog
	s.mu.RUnlock()
	if c != nil && now.Before(c.expires) {
		return c, nil
	}

	var mods []models.Module
	if err := s.db.WithContext(ctx).Find(&mods).Error; err != nil {
		return nil, fmt.Errorf("leer módulos: %w", err)
	}
	c = &moduleCatalog{
		byCode:  make(map[string]models.Module, len(mods)),
		byID:    make(map[uuid.UUID]models.Module, len(mods)),
		expires: now.Add(s.ttl),
	}
	for _, m := range mods {
		c.byCode[m.Code] = m
		c.byID[m.ID] = m
	}
	s.mu.Lock()
	s.catalog = c
	s.mu.Unlock()
	return c, nil
}

func (s *Service) tenant(ctx context.Context, id uuid.UUID) (*tenantSnapshot, error) {
	now := s.now()
	s.mu.RLock()
	t, ok := s.tenants[id]
	s.mu.RUnlock()
	if ok && now.Before(t.expires) {
		return t, nil
	}

	var rows []models.TenantModule
	if err := s.db.WithContext(ctx).Where("tenant_id = ?", id).Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("leer tenant_modules: %w", err)
	}
	t = &tenantSnapshot{enabled: make(map[uuid.UUID]bool, len(rows)), expires: now.Add(s.ttl)}
	for _, r := range rows {
		t.enabled[r.ModuleID] = r.IsEnabled
	}
	s.mu.Lock()
	s.tenants[id] = t
	s.mu.Unlock()
	return t, nil
}
