package access

import (
	"context"
	"testing"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/modules"
	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type fixture struct {
	db     *gorm.DB
	svc    *Service
	tenant models.Tenant
	users  map[string]models.User // por código de rol
}

func newFixture(t *testing.T, roles ...string) *fixture {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:access_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	// roles/tenants/users usan gen_random_uuid() (solo Postgres): DDL mínimo para SQLite.
	for _, ddl := range []string{
		`CREATE TABLE roles (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)`,
		`CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT, nit TEXT, contact_email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', is_active BOOLEAN NOT NULL DEFAULT 1, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME)`,
		`CREATE TABLE users (id TEXT PRIMARY KEY, tenant_id TEXT, role_id TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT 1, token_version INTEGER NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME)`,
	} {
		require.NoError(t, db.Exec(ddl).Error)
	}
	require.NoError(t, db.AutoMigrate(&models.Module{}, &models.TenantModule{}, &models.RoleModuleDefault{}, &models.UserModulePermission{}, &models.AccessAuditLog{}))
	require.NoError(t, postgres.EnsureSystemRoles(db))

	now := time.Now().UTC()
	tenant := models.Tenant{ID: uuid.New(), Name: "Alcaldía", ContactEmail: "a@b.co", Status: "ACTIVE", IsActive: true, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, db.Create(&tenant).Error)

	f := &fixture{db: db, tenant: tenant, users: map[string]models.User{}}
	for _, code := range roles {
		var role models.Role
		require.NoError(t, db.Where("code = ?", code).First(&role).Error)
		u := models.User{ID: uuid.New(), RoleID: role.ID, Email: uuid.NewString() + "@x.co", PasswordHash: "x", FullName: code, IsActive: true, CreatedAt: now, UpdatedAt: now}
		if code != constants.RoleSuperAdmin {
			u.TenantID = &tenant.ID
		}
		require.NoError(t, db.Create(&u).Error)
		f.users[code] = u
	}
	// El seed lee usuarios y tenants existentes para el backfill.
	require.NoError(t, postgres.EnsureModulesSeed(db))
	f.svc = NewService(db, time.Minute)
	return f
}

func (f *fixture) can(t *testing.T, role, module string, action modules.Action) Decision {
	t.Helper()
	d, err := f.svc.Can(context.Background(), f.users[role].ID, module, action)
	require.NoError(t, err)
	return d
}

func (f *fixture) moduleID(t *testing.T, code string) uuid.UUID {
	t.Helper()
	var m models.Module
	require.NoError(t, f.db.Where("code = ?", code).First(&m).Error)
	return m.ID
}

func TestCan_SuperAdminIsPureLogic(t *testing.T) {
	f := newFixture(t, constants.RoleSuperAdmin)
	// Sin tablas de permisos ni de módulos habilitados: el SUPER_ADMIN sigue pasando.
	require.NoError(t, f.db.Migrator().DropTable("user_module_permissions", "tenant_modules"))

	for _, code := range []string{modules.CodeProjects, modules.CodeAdminTenants, modules.CodeMGAPresentar, "no-existe"} {
		d := f.can(t, constants.RoleSuperAdmin, code, modules.ActionDelete)
		require.True(t, d.Allowed, code)
		require.Equal(t, ReasonSuperAdmin, d.Reason)
	}
}

func TestCan_TenantAdminDoesNotReadPermissionsTable(t *testing.T) {
	f := newFixture(t, constants.RoleTenantAdmin)
	require.NoError(t, f.db.Migrator().DropTable("user_module_permissions"))

	for _, code := range []string{modules.CodeProjects, modules.CodeMGAEvaluacion, modules.CodeUsers} {
		d := f.can(t, constants.RoleTenantAdmin, code, modules.ActionDelete)
		require.True(t, d.Allowed, code)
		require.Equal(t, ReasonTenantAdmin, d.Reason)
	}
	// Los módulos de plataforma y los desconocidos no.
	require.Equal(t, ReasonPlatformModule, f.can(t, constants.RoleTenantAdmin, modules.CodeAdminCatalogs, modules.ActionView).Reason)
	require.Equal(t, ReasonModuleUnknown, f.can(t, constants.RoleTenantAdmin, "no-existe", modules.ActionView).Reason)
}

func TestCan_RegularRolesFollowGrantedPermissions(t *testing.T) {
	f := newFixture(t, constants.RoleFormulador, constants.RoleEvaluador, constants.RoleViewer)

	require.True(t, f.can(t, constants.RoleFormulador, modules.CodeMGAIdentificacion, modules.ActionEdit).Allowed)
	require.False(t, f.can(t, constants.RoleFormulador, modules.CodeMGAIdentificacion, modules.ActionDelete).Allowed)
	require.True(t, f.can(t, constants.RoleEvaluador, modules.CodeMGAEvaluacion, modules.ActionCreate).Allowed)
	require.False(t, f.can(t, constants.RoleEvaluador, modules.CodeMGAIdentificacion, modules.ActionEdit).Allowed)
	require.True(t, f.can(t, constants.RoleViewer, modules.CodeProjects, modules.ActionView).Allowed)

	d := f.can(t, constants.RoleViewer, modules.CodeProjects, modules.ActionCreate)
	require.False(t, d.Allowed)
	require.Equal(t, ReasonNoPermission, d.Reason)
	require.False(t, f.can(t, constants.RoleViewer, modules.CodeUsers, modules.ActionView).Allowed)
	require.Equal(t, ReasonPlatformModule, f.can(t, constants.RoleViewer, modules.CodeAdminTenants, modules.ActionView).Reason)
}

func TestCan_DisabledModuleDeniesEveryoneInTenant(t *testing.T) {
	f := newFixture(t, constants.RoleTenantAdmin, constants.RoleFormulador)
	require.True(t, f.can(t, constants.RoleFormulador, modules.CodeReports, modules.ActionView).Allowed)

	require.NoError(t, f.db.Model(&models.TenantModule{}).
		Where("tenant_id = ? AND module_id = ?", f.tenant.ID, f.moduleID(t, modules.CodeReports)).
		Update("is_enabled", false).Error)

	// Aún en caché (TTL): sigue permitido hasta invalidar.
	require.True(t, f.can(t, constants.RoleFormulador, modules.CodeReports, modules.ActionView).Allowed)
	f.svc.InvalidateTenant(f.tenant.ID)

	for _, role := range []string{constants.RoleTenantAdmin, constants.RoleFormulador} {
		d := f.can(t, role, modules.CodeReports, modules.ActionView)
		require.False(t, d.Allowed, role)
		require.Equal(t, ReasonModuleDisabled, d.Reason)
	}
}

func TestCan_SectionRequiresParentModuleEnabled(t *testing.T) {
	f := newFixture(t, constants.RoleFormulador)
	require.NoError(t, f.db.Model(&models.TenantModule{}).
		Where("tenant_id = ? AND module_id = ?", f.tenant.ID, f.moduleID(t, modules.CodeMGA)).
		Update("is_enabled", false).Error)
	f.svc.InvalidateAll()

	d := f.can(t, constants.RoleFormulador, modules.CodeMGAIdentificacion, modules.ActionView)
	require.False(t, d.Allowed)
	require.Equal(t, ReasonModuleDisabled, d.Reason)
}

func TestCache_ExpiresAfterTTL(t *testing.T) {
	f := newFixture(t, constants.RoleViewer)
	clock := time.Now()
	f.svc.now = func() time.Time { return clock }
	f.svc.ttl = 30 * time.Second

	require.True(t, f.can(t, constants.RoleViewer, modules.CodeProjects, modules.ActionView).Allowed)
	require.NoError(t, f.db.Model(&models.UserModulePermission{}).
		Where("user_id = ?", f.users[constants.RoleViewer].ID).
		Updates(map[string]any{"can_view": false}).Error)

	clock = clock.Add(10 * time.Second)
	require.True(t, f.can(t, constants.RoleViewer, modules.CodeProjects, modules.ActionView).Allowed, "dentro del TTL se sirve de caché")

	clock = clock.Add(31 * time.Second)
	require.False(t, f.can(t, constants.RoleViewer, modules.CodeProjects, modules.ActionView).Allowed, "vencido el TTL se relee de la BD")
}

func TestValidateSession_TokenVersion(t *testing.T) {
	f := newFixture(t, constants.RoleFormulador, constants.RoleTenantAdmin)
	u := f.users[constants.RoleFormulador]
	ctx := context.Background()

	require.NoError(t, f.svc.ValidateSession(ctx, u.ID, 0))
	require.ErrorIs(t, f.svc.ValidateSession(ctx, u.ID, 1), ErrSessionRevoked, "tv distinto")

	// Se revoca subiendo token_version; la caché corta lo ve tras invalidar.
	require.NoError(t, f.db.Model(&models.User{}).Where("id = ?", u.ID).Update("token_version", 1).Error)
	require.NoError(t, f.svc.ValidateSession(ctx, u.ID, 0), "caché aún vigente")
	f.svc.Invalidate(u.ID)
	require.ErrorIs(t, f.svc.ValidateSession(ctx, u.ID, 0), ErrSessionRevoked)
	require.NoError(t, f.svc.ValidateSession(ctx, u.ID, 1))

	// Usuario desactivado o inexistente.
	admin := f.users[constants.RoleTenantAdmin]
	require.NoError(t, f.db.Model(&models.User{}).Where("id = ?", admin.ID).Update("is_active", false).Error)
	f.svc.Invalidate(admin.ID)
	require.ErrorIs(t, f.svc.ValidateSession(ctx, admin.ID, 0), ErrSessionRevoked)
	require.ErrorIs(t, f.svc.ValidateSession(ctx, uuid.New(), 0), ErrSessionRevoked)
}

func TestResolve_BuildsTreeWithEffectivePermissions(t *testing.T) {
	f := newFixture(t, constants.RoleSuperAdmin, constants.RoleTenantAdmin, constants.RoleFormulador, constants.RoleViewer)
	ctx := context.Background()

	find := func(mods []ResolvedModule, code string) *ResolvedModule {
		for i := range mods {
			if mods[i].Code == code {
				return &mods[i]
			}
		}
		return nil
	}

	// Formulador: árbol MGA con 5 secciones y permisos de escritura; sin módulos de plataforma.
	acc, err := f.svc.Resolve(ctx, f.users[constants.RoleFormulador].ID)
	require.NoError(t, err)
	require.False(t, acc.IsSuperAdmin || acc.IsTenantAdmin)
	require.NotNil(t, acc.TenantID)
	mga := find(acc.Modules, modules.CodeMGA)
	require.NotNil(t, mga)
	require.Len(t, mga.Children, 5)
	require.Equal(t, modules.CodeMGAIdentificacion, mga.Children[0].Code, "orden estable")
	require.True(t, mga.Children[0].Enabled && mga.Children[0].Permissions.Edit)
	require.Nil(t, find(acc.Modules, modules.CodeAdminTenants))
	for _, m := range acc.Modules {
		require.Equal(t, modules.ScopeTenant, m.Scope)
	}
	users := find(acc.Modules, modules.CodeUsers)
	require.NotNil(t, users)
	require.False(t, users.Permissions.View, "el módulo users no se otorga a roles no admin")

	// Viewer: solo lectura.
	acc, err = f.svc.Resolve(ctx, f.users[constants.RoleViewer].ID)
	require.NoError(t, err)
	proj := find(acc.Modules, modules.CodeProjects)
	require.True(t, proj.Permissions.View)
	require.False(t, proj.Permissions.Create || proj.Permissions.Edit || proj.Permissions.Delete)

	// Tenant admin: todo en módulos TENANT.
	acc, err = f.svc.Resolve(ctx, f.users[constants.RoleTenantAdmin].ID)
	require.NoError(t, err)
	require.True(t, acc.IsTenantAdmin)
	require.Equal(t, Permissions{View: true, Create: true, Edit: true, Delete: true}, find(acc.Modules, modules.CodeUsers).Permissions)

	// Super admin: incluye módulos de plataforma, sin tenant.
	acc, err = f.svc.Resolve(ctx, f.users[constants.RoleSuperAdmin].ID)
	require.NoError(t, err)
	require.True(t, acc.IsSuperAdmin)
	require.Nil(t, acc.TenantID)
	at := find(acc.Modules, modules.CodeAdminTenants)
	require.NotNil(t, at)
	require.True(t, at.Enabled && at.Permissions.Delete)

	// Módulo deshabilitado: aparece con enabled=false y sin permisos.
	require.NoError(t, f.db.Model(&models.TenantModule{}).
		Where("tenant_id = ? AND module_id = ?", f.tenant.ID, f.moduleID(t, modules.CodeCatalog)).
		Update("is_enabled", false).Error)
	f.svc.InvalidateAll()
	acc, err = f.svc.Resolve(ctx, f.users[constants.RoleFormulador].ID)
	require.NoError(t, err)
	cat := find(acc.Modules, modules.CodeCatalog)
	require.False(t, cat.Enabled)
	require.Equal(t, Permissions{}, cat.Permissions)
}

func TestResolve_UnknownUser(t *testing.T) {
	f := newFixture(t)
	_, err := f.svc.Resolve(context.Background(), uuid.New())
	require.ErrorIs(t, err, ErrUserNotFound)
}
