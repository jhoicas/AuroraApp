package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Module es un módulo funcional controlable por PBAC (ver internal/domain/modules).
// Se sincroniza desde el manifiesto declarativo en el arranque (EnsureModulesSeed).
type Module struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Code        string     `gorm:"type:varchar(100);uniqueIndex:idx_modules_code;not null" json:"code"`
	Name        string     `gorm:"type:varchar(150);not null" json:"name"`
	Description string     `gorm:"type:text" json:"description,omitempty"`
	Kind        string     `gorm:"type:varchar(20);not null;default:'MODULE'" json:"kind"`  // MODULE | SECTION
	Scope       string     `gorm:"type:varchar(20);not null;default:'TENANT'" json:"scope"` // TENANT | PLATFORM
	ParentID    *uuid.UUID `gorm:"type:uuid;index" json:"parent_id,omitempty"`
	Route       string     `gorm:"type:varchar(255);not null" json:"route"`
	SortOrder   int        `gorm:"not null;default:0" json:"sort_order"`
	IsActive    bool       `gorm:"not null;default:true" json:"is_active"`
	// IsSystem: declarado por el manifiesto; no se puede borrar, solo editar.
	IsSystem bool `gorm:"not null;default:false" json:"is_system"`
	// Customized: un SUPER_ADMIN editó el módulo; el seed ya no sobrescribe sus campos.
	Customized  bool      `gorm:"not null;default:false" json:"customized"`
	SeedVersion int       `gorm:"not null;default:0" json:"seed_version"`
	CreatedAt   time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt   time.Time `gorm:"not null" json:"updated_at"`

	Parent *Module `gorm:"foreignKey:ParentID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
}

func (Module) TableName() string { return "modules" }

func (m *Module) BeforeCreate(*gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

// ActionFlags agrupa los permisos granulares view/create/edit/delete (D1).
type ActionFlags struct {
	CanView   bool `gorm:"column:can_view;not null;default:false" json:"can_view"`
	CanCreate bool `gorm:"column:can_create;not null;default:false" json:"can_create"`
	CanEdit   bool `gorm:"column:can_edit;not null;default:false" json:"can_edit"`
	CanDelete bool `gorm:"column:can_delete;not null;default:false" json:"can_delete"`
}

// TenantModule indica si un módulo está habilitado para un tenant (D2).
// Lo administra el SUPER_ADMIN. Un módulo deshabilitado niega acceso a todos
// los usuarios del tenant, sin importar sus permisos.
type TenantModule struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID  uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_tenant_modules_tenant_module" json:"tenant_id"`
	ModuleID  uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_tenant_modules_tenant_module;index" json:"module_id"`
	IsEnabled bool      `gorm:"not null;default:true" json:"is_enabled"`
	CreatedAt time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null" json:"updated_at"`

	Tenant Tenant `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Module Module `gorm:"foreignKey:ModuleID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (TenantModule) TableName() string { return "tenant_modules" }

func (t *TenantModule) BeforeCreate(*gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}

// RoleModuleDefault son los permisos por defecto de un rol sobre un módulo.
type RoleModuleDefault struct {
	ID       uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	RoleID   uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_role_module_defaults_role_module" json:"role_id"`
	ModuleID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_role_module_defaults_role_module;index" json:"module_id"`
	ActionFlags
	CreatedAt time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null" json:"updated_at"`

	Role   Role   `gorm:"foreignKey:RoleID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Module Module `gorm:"foreignKey:ModuleID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (RoleModuleDefault) TableName() string { return "role_module_defaults" }

func (r *RoleModuleDefault) BeforeCreate(*gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

// UserModulePermission son los permisos efectivos de un usuario sobre un módulo.
// Una fila existente (aunque todo false) significa "configurado explícitamente".
type UserModulePermission struct {
	ID       uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID   uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_module_permissions_user_module" json:"user_id"`
	ModuleID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_module_permissions_user_module;index" json:"module_id"`
	ActionFlags
	// GrantedBy es el usuario que otorgó el permiso (NULL = backfill/sistema).
	GrantedBy *uuid.UUID `gorm:"type:uuid" json:"granted_by,omitempty"`
	CreatedAt time.Time  `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time  `gorm:"not null" json:"updated_at"`

	User   User   `gorm:"foreignKey:UserID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Module Module `gorm:"foreignKey:ModuleID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (UserModulePermission) TableName() string { return "user_module_permissions" }

func (u *UserModulePermission) BeforeCreate(*gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// AccessAuditLog registra cambios de acceso (módulos, permisos, administradores).
// Sin FKs duras: la auditoría debe sobrevivir al borrado de usuarios/tenants.
type AccessAuditLog struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID     *uuid.UUID `gorm:"type:uuid;index" json:"tenant_id,omitempty"`
	ActorUserID  *uuid.UUID `gorm:"type:uuid;index" json:"actor_user_id,omitempty"`
	TargetUserID *uuid.UUID `gorm:"type:uuid;index" json:"target_user_id,omitempty"`
	ModuleID     *uuid.UUID `gorm:"type:uuid" json:"module_id,omitempty"`
	Action       string     `gorm:"type:varchar(60);not null;index" json:"action"`
	Details      string     `gorm:"type:jsonb;not null;default:'{}'" json:"details"`
	CreatedAt    time.Time  `gorm:"not null;index" json:"created_at"`
}

func (AccessAuditLog) TableName() string { return "access_audit_logs" }

func (a *AccessAuditLog) BeforeCreate(*gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// Acciones de auditoría de acceso.
const (
	AuditModulesSeeded         = "MODULES_SEEDED"
	AuditPermissionsBackfilled = "PERMISSIONS_BACKFILLED"

	AuditModuleCreated        = "MODULE_CREATED"
	AuditModuleUpdated        = "MODULE_UPDATED"
	AuditModuleDeleted        = "MODULE_DELETED"
	AuditModulesReordered     = "MODULES_REORDERED"
	AuditTenantModulesUpdated = "TENANT_MODULES_UPDATED"
	AuditUserCreated          = "USER_CREATED"
	AuditUserPermissionsSet   = "USER_PERMISSIONS_UPDATED"
	AuditUserPasswordChanged  = "USER_PASSWORD_CHANGED"
	AuditUserStatusChanged    = "USER_STATUS_CHANGED"
	AuditUserUpdated          = "USER_UPDATED"
	AuditRoleTemplateUpdated  = "ROLE_TEMPLATE_UPDATED"
)
