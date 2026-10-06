package postgres

import (
	"testing"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/modules"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newModulesTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:mods_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	// Roles/tenants/users usan gen_random_uuid() (solo Postgres): DDL mínimo para SQLite.
	for _, ddl := range []string{
		`CREATE TABLE roles (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)`,
		`CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT, nit TEXT, contact_email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', is_active BOOLEAN NOT NULL DEFAULT 1, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME)`,
		`CREATE TABLE users (id TEXT PRIMARY KEY, tenant_id TEXT, role_id TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT 1, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME)`,
	} {
		require.NoError(t, db.Exec(ddl).Error)
	}
	require.NoError(t, db.AutoMigrate(
		&models.Module{}, &models.TenantModule{}, &models.RoleModuleDefault{},
		&models.UserModulePermission{}, &models.AccessAuditLog{},
	))
	require.NoError(t, EnsureSystemRoles(db))
	return db
}

func seedTenantWithUsers(t *testing.T, db *gorm.DB, roleCodes ...string) (models.Tenant, []models.User) {
	t.Helper()
	now := time.Now().UTC()
	tenant := models.Tenant{ID: uuid.New(), Name: "Alcaldía " + uuid.NewString()[:6], ContactEmail: "a@b.co", Status: "ACTIVE", IsActive: true, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, db.Create(&tenant).Error)

	var users []models.User
	for _, code := range roleCodes {
		var role models.Role
		require.NoError(t, db.Where("code = ?", code).First(&role).Error)
		u := models.User{ID: uuid.New(), TenantID: &tenant.ID, RoleID: role.ID, Email: uuid.NewString() + "@x.co", PasswordHash: "x", FullName: code, IsActive: true, CreatedAt: now, UpdatedAt: now}
		require.NoError(t, db.Create(&u).Error)
		users = append(users, u)
	}
	return tenant, users
}

func count(t *testing.T, db *gorm.DB, model any) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Model(model).Count(&n).Error)
	return n
}

func TestEnsureModulesSeed_CreatesHierarchyAndDefaults(t *testing.T) {
	db := newModulesTestDB(t)
	require.NoError(t, EnsureModulesSeed(db))

	require.EqualValues(t, len(modules.Manifest), count(t, db, &models.Module{}))

	var mga models.Module
	require.NoError(t, db.Where("code = ?", modules.CodeMGA).First(&mga).Error)
	var sections []models.Module
	require.NoError(t, db.Where("parent_id = ?", mga.ID).Find(&sections).Error)
	require.Len(t, sections, 5)
	for _, s := range sections {
		require.Equal(t, modules.SeedVersion, s.SeedVersion)
	}

	// TENANT_ADMIN: Full en módulos TENANT; VIEWER: solo lectura en proyectos.
	var admin, viewer models.Role
	require.NoError(t, db.Where("code = ?", constants.RoleTenantAdmin).First(&admin).Error)
	require.NoError(t, db.Where("code = ?", constants.RoleViewer).First(&viewer).Error)
	var projects models.Module
	require.NoError(t, db.Where("code = ?", modules.CodeProjects).First(&projects).Error)

	var adminDef, viewerDef models.RoleModuleDefault
	require.NoError(t, db.Where("role_id = ? AND module_id = ?", admin.ID, projects.ID).First(&adminDef).Error)
	require.True(t, adminDef.CanView && adminDef.CanCreate && adminDef.CanEdit && adminDef.CanDelete)
	require.NoError(t, db.Where("role_id = ? AND module_id = ?", viewer.ID, projects.ID).First(&viewerDef).Error)
	require.True(t, viewerDef.CanView)
	require.False(t, viewerDef.CanCreate || viewerDef.CanEdit || viewerDef.CanDelete)

	// El módulo de usuarios no tiene default para roles no admin.
	var users models.Module
	require.NoError(t, db.Where("code = ?", modules.CodeUsers).First(&users).Error)
	require.EqualValues(t, 0, func() int64 {
		var n int64
		db.Model(&models.RoleModuleDefault{}).Where("role_id = ? AND module_id = ?", viewer.ID, users.ID).Count(&n)
		return n
	}())
}

func TestEnsureModulesSeed_IsIdempotent(t *testing.T) {
	db := newModulesTestDB(t)
	seedTenantWithUsers(t, db, constants.RoleTenantAdmin, constants.RoleFormulador)

	require.NoError(t, EnsureModulesSeed(db))
	mods, defaults := count(t, db, &models.Module{}), count(t, db, &models.RoleModuleDefault{})
	tms, ups := count(t, db, &models.TenantModule{}), count(t, db, &models.UserModulePermission{})
	audits := count(t, db, &models.AccessAuditLog{})

	require.NoError(t, EnsureModulesSeed(db))
	require.Equal(t, mods, count(t, db, &models.Module{}))
	require.Equal(t, defaults, count(t, db, &models.RoleModuleDefault{}))
	require.Equal(t, tms, count(t, db, &models.TenantModule{}))
	require.Equal(t, ups, count(t, db, &models.UserModulePermission{}))
	require.Equal(t, audits, count(t, db, &models.AccessAuditLog{}), "una segunda corrida sin cambios no audita")
}

func TestEnsureModulesSeed_BackfillKeepsAccessForExistingUsers(t *testing.T) {
	db := newModulesTestDB(t)
	tenant, users := seedTenantWithUsers(t, db,
		constants.RoleTenantAdmin, constants.RoleFormulador, constants.RoleEvaluador, constants.RoleViewer)
	admin, formulador, evaluador, viewer := users[0], users[1], users[2], users[3]

	require.NoError(t, EnsureModulesSeed(db))

	tenantModules := 0
	for _, d := range modules.Manifest {
		if d.Scope == modules.ScopeTenant {
			tenantModules++
		}
	}

	// Todos los módulos TENANT quedan habilitados para el tenant existente.
	var enabled int64
	require.NoError(t, db.Model(&models.TenantModule{}).Where("tenant_id = ? AND is_enabled = ?", tenant.ID, true).Count(&enabled).Error)
	require.EqualValues(t, tenantModules, enabled)

	// Admin: sin filas por usuario (se resuelve por rol).
	var adminRows int64
	db.Model(&models.UserModulePermission{}).Where("user_id = ?", admin.ID).Count(&adminRows)
	require.EqualValues(t, 0, adminRows)

	// Cada no admin conserva View en todo módulo TENANT salvo "users".
	for _, u := range []models.User{formulador, evaluador, viewer} {
		var perms []models.UserModulePermission
		require.NoError(t, db.Where("user_id = ?", u.ID).Find(&perms).Error)
		require.Len(t, perms, tenantModules-1, "rol %s", u.FullName)
		for _, p := range perms {
			require.True(t, p.CanView, "rol %s perdió View", u.FullName)
			require.Nil(t, p.GrantedBy)
		}
	}

	// Formulador puede crear/editar en MGA identificación; evaluador solo ve.
	var ident models.Module
	require.NoError(t, db.Where("code = ?", modules.CodeMGAIdentificacion).First(&ident).Error)
	var pf, pe models.UserModulePermission
	require.NoError(t, db.Where("user_id = ? AND module_id = ?", formulador.ID, ident.ID).First(&pf).Error)
	require.NoError(t, db.Where("user_id = ? AND module_id = ?", evaluador.ID, ident.ID).First(&pe).Error)
	require.True(t, pf.CanCreate && pf.CanEdit && !pf.CanDelete)
	require.False(t, pe.CanCreate || pe.CanEdit)
}

func TestEnsureModulesSeed_DoesNotOverrideCustomizations(t *testing.T) {
	db := newModulesTestDB(t)
	tenant, users := seedTenantWithUsers(t, db, constants.RoleFormulador)
	require.NoError(t, EnsureModulesSeed(db))

	var projects models.Module
	require.NoError(t, db.Where("code = ?", modules.CodeProjects).First(&projects).Error)

	// El tenant admin quita permisos y el SUPER_ADMIN deshabilita el módulo.
	require.NoError(t, db.Model(&models.UserModulePermission{}).
		Where("user_id = ? AND module_id = ?", users[0].ID, projects.ID).
		Updates(map[string]any{"can_view": false, "can_create": false, "can_edit": false, "can_delete": false}).Error)
	require.NoError(t, db.Model(&models.TenantModule{}).
		Where("tenant_id = ? AND module_id = ?", tenant.ID, projects.ID).
		Update("is_enabled", false).Error)

	// Nueva versión del manifiesto: re-sincroniza pero respeta lo configurado.
	require.NoError(t, ensureModulesSeed(db, modules.Manifest, modules.SeedVersion+1))

	var p models.UserModulePermission
	require.NoError(t, db.Where("user_id = ? AND module_id = ?", users[0].ID, projects.ID).First(&p).Error)
	require.False(t, p.CanView, "el backfill no debe pisar permisos existentes")
	var tm models.TenantModule
	require.NoError(t, db.Where("tenant_id = ? AND module_id = ?", tenant.ID, projects.ID).First(&tm).Error)
	require.False(t, tm.IsEnabled, "no debe reactivar un módulo deshabilitado")
}

func TestEnsureModulesSeed_NewModuleIsBackfilledAndRemovedIsDeactivated(t *testing.T) {
	db := newModulesTestDB(t)
	_, users := seedTenantWithUsers(t, db, constants.RoleAnalista)
	require.NoError(t, EnsureModulesSeed(db))

	next := append([]modules.Def(nil), modules.Manifest...)
	next = append(next, modules.Def{
		Code: "nuevo", Name: "Nuevo", Kind: modules.KindModule, Scope: modules.ScopeTenant, Route: "/tenant/nuevo", Order: 70,
		Defaults: map[string]modules.Actions{constants.RoleAnalista: modules.VC},
	})
	// Se retira "reports" del manifiesto.
	filtered := next[:0:0]
	for _, d := range next {
		if d.Code != modules.CodeReports {
			filtered = append(filtered, d)
		}
	}
	require.NoError(t, ensureModulesSeed(db, filtered, modules.SeedVersion+1))

	var nuevo models.Module
	require.NoError(t, db.Where("code = ?", "nuevo").First(&nuevo).Error)
	var perm models.UserModulePermission
	require.NoError(t, db.Where("user_id = ? AND module_id = ?", users[0].ID, nuevo.ID).First(&perm).Error)
	require.True(t, perm.CanView && perm.CanCreate && !perm.CanEdit)

	var reports models.Module
	require.NoError(t, db.Where("code = ?", modules.CodeReports).First(&reports).Error)
	require.False(t, reports.IsActive)
}

func TestEnsureModulesSeed_RejectsInvalidManifest(t *testing.T) {
	db := newModulesTestDB(t)
	bad := []modules.Def{
		{Code: "a", Name: "a", Kind: modules.KindSection, Scope: modules.ScopeTenant, Parent: "no-existe", Route: "/a"},
	}
	require.Error(t, ensureModulesSeed(db, bad, 1))
	require.EqualValues(t, 0, count(t, db, &models.Module{}))
}
