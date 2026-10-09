package postgres

import (
	"reflect"
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
	createBaseTables(t, db)
	require.NoError(t, db.AutoMigrate(
		&models.Module{}, &models.TenantModule{}, &models.RoleModuleDefault{},
		&models.UserModulePermission{}, &models.AccessAuditLog{},
	))
	require.NoError(t, EnsureSystemRoles(db))
	return db
}

// createBaseTables crea roles/tenants/users con DDL mínimo: sus modelos usan
// gen_random_uuid() (solo Postgres) y no se pueden migrar en SQLite.
func createBaseTables(t *testing.T, db *gorm.DB) {
	t.Helper()
	for _, ddl := range []string{
		`CREATE TABLE roles (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)`,
		`CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT, nit TEXT, contact_email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', is_active BOOLEAN NOT NULL DEFAULT 1, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME)`,
		`CREATE TABLE users (id TEXT PRIMARY KEY, tenant_id TEXT, role_id TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT 1, token_version INTEGER NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME)`,
	} {
		require.NoError(t, db.Exec(ddl).Error)
	}
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
	_, users := seedTenantWithUsers(t, db, constants.RoleEvaluador)
	require.NoError(t, EnsureModulesSeed(db))

	next := append([]modules.Def(nil), modules.Manifest...)
	next = append(next, modules.Def{
		Code: "nuevo", Name: "Nuevo", Kind: modules.KindModule, Scope: modules.ScopeTenant, Route: "/tenant/nuevo", Order: 70,
		Defaults: map[string]modules.Actions{constants.RoleEvaluador: modules.VC},
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

func TestAllModels_IncludesAccessControlModels(t *testing.T) {
	registered := map[string]bool{}
	for _, m := range models.AllModels() {
		registered[reflect.TypeOf(m).String()] = true
	}
	for _, m := range accessControlModels() {
		require.True(t, registered[reflect.TypeOf(m).String()], "%T falta en AllModels()", m)
	}
}

func TestEnsureAccessControlSchema_CreatesTables(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:acs_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	createBaseTables(t, db)

	require.NotEmpty(t, missingAccessControlTables(db))
	require.NoError(t, EnsureAccessControlSchema(db))
	require.Empty(t, missingAccessControlTables(db))

	// Tras migrar, el seed corre sin errores (el orden Schema → Seed funciona).
	require.NoError(t, EnsureSystemRoles(db))
	require.NoError(t, EnsureModulesSeed(db))
	require.EqualValues(t, len(modules.Manifest), count(t, db, &models.Module{}))
}

func TestAccessControlFallbackDDL_MatchesModels(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:acs_ddl_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	createBaseTables(t, db)

	for _, stmt := range accessControlSchemaSQL {
		require.NoError(t, db.Exec(stmt).Error, stmt)
	}
	require.Empty(t, missingAccessControlTables(db))

	// El seed funciona sobre el esquema creado por el DDL de respaldo.
	require.NoError(t, EnsureSystemRoles(db))
	seedTenantWithUsers(t, db, constants.RoleFormulador)
	require.NoError(t, EnsureModulesSeed(db))
	require.Positive(t, count(t, db, &models.UserModulePermission{}))
}

func TestEnsureModulesSeed_FailsWithoutTables(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:acs_none_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.Error(t, EnsureModulesSeed(db))
}

func TestEnsureModulesSeed_SystemFlagsAndCustomModules(t *testing.T) {
	db := newModulesTestDB(t)
	require.NoError(t, EnsureModulesSeed(db))

	var system int64
	db.Model(&models.Module{}).Where("is_system = ?", true).Count(&system)
	require.EqualValues(t, len(modules.Manifest), system, "todo el manifiesto es de sistema")

	// Un módulo creado por un SUPER_ADMIN (no de sistema) sobrevive a nuevas versiones del seed.
	custom := models.Module{ID: uuid.New(), Code: "obras", Name: "Obras", Kind: modules.KindModule, Scope: modules.ScopeTenant,
		Route: "/tenant/obras", IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	require.NoError(t, db.Create(&custom).Error)
	require.NoError(t, ensureModulesSeed(db, modules.Manifest, modules.SeedVersion+1))
	var got models.Module
	require.NoError(t, db.First(&got, "id = ?", custom.ID).Error)
	require.True(t, got.IsActive, "no se desactivan módulos que no son del manifiesto")
	require.False(t, got.IsSystem)

	// Customized: el seed no pisa nombre ni orden, pero sigue siendo de sistema.
	require.NoError(t, db.Model(&models.Module{}).Where("code = ?", modules.CodeReports).
		Updates(map[string]any{"name": "Informes", "sort_order": 77, "customized": true}).Error)
	require.NoError(t, ensureModulesSeed(db, modules.Manifest, modules.SeedVersion+2))
	var reports models.Module
	require.NoError(t, db.Where("code = ?", modules.CodeReports).First(&reports).Error)
	require.Equal(t, "Informes", reports.Name)
	require.Equal(t, 77, reports.SortOrder)
	require.True(t, reports.IsSystem)
	require.Equal(t, modules.SeedVersion+2, reports.SeedVersion)
}

func TestRetireRemovedRoles_MigratesAnalistaUsersToFormulador(t *testing.T) {
	db := newModulesTestDB(t)
	require.NoError(t, EnsureSystemRoles(db))

	var n int64
	db.Model(&models.Role{}).Where("code = ?", "ANALISTA").Count(&n)
	require.Zero(t, n, "el seed de roles ya no crea ANALISTA")

	// Datos heredados: rol ANALISTA con defaults y usuarios (uno con borrado lógico).
	now := time.Now().UTC()
	analista := models.Role{ID: uuid.New(), Code: "ANALISTA", Name: "Analista", CreatedAt: now, UpdatedAt: now}
	require.NoError(t, db.Create(&analista).Error)
	require.NoError(t, EnsureModulesSeed(db))
	var projects models.Module
	require.NoError(t, db.Where("code = ?", modules.CodeProjects).First(&projects).Error)
	require.NoError(t, db.Create(&models.RoleModuleDefault{RoleID: analista.ID, ModuleID: projects.ID,
		ActionFlags: models.ActionFlags{CanView: true, CanDelete: true}}).Error)

	tenant, users := seedTenantWithUsers(t, db, constants.RoleViewer, constants.RoleViewer, constants.RoleEvaluador)
	for _, u := range users[:2] {
		require.NoError(t, db.Model(&models.User{}).Where("id = ?", u.ID).Update("role_id", analista.ID).Error)
		// Permisos viejos (del rol anterior) que no deben sobrevivir.
		require.NoError(t, db.Create(&models.UserModulePermission{UserID: u.ID, ModuleID: projects.ID,
			ActionFlags: models.ActionFlags{CanView: true, CanDelete: true}, CreatedAt: now, UpdatedAt: now}).Error)
	}
	require.NoError(t, db.Delete(&models.User{}, "id = ?", users[1].ID).Error) // borrado lógico
	_ = tenant

	require.NoError(t, RetireRemovedRoles(db))

	// El rol y sus defaults desaparecen.
	db.Model(&models.Role{}).Where("code = ?", "ANALISTA").Count(&n)
	require.Zero(t, n)
	db.Model(&models.RoleModuleDefault{}).Where("role_id = ?", analista.ID).Count(&n)
	require.Zero(t, n)

	var formulador models.Role
	require.NoError(t, db.Where("code = ?", constants.RoleFormulador).First(&formulador).Error)

	// Ambos usuarios (incluido el eliminado lógicamente) quedan como FORMULADOR con sesiones revocadas.
	for _, u := range users[:2] {
		var got models.User
		require.NoError(t, db.Unscoped().First(&got, "id = ?", u.ID).Error)
		require.Equal(t, formulador.ID, got.RoleID)
		require.Equal(t, 1, got.TokenVersion)
	}
	var other models.User
	require.NoError(t, db.First(&other, "id = ?", users[2].ID).Error)
	require.Equal(t, 0, other.TokenVersion, "otros usuarios no se tocan")

	// El usuario activo tiene exactamente la matriz del FORMULADOR (sin el permiso heredado).
	var perms []models.UserModulePermission
	require.NoError(t, db.Where("user_id = ?", users[0].ID).Find(&perms).Error)
	var defaults []models.RoleModuleDefault
	require.NoError(t, db.Where("role_id = ?", formulador.ID).Find(&defaults).Error)
	require.Len(t, perms, len(defaults))
	want := map[string]models.ActionFlags{}
	for _, d := range defaults {
		want[d.ModuleID.String()] = d.ActionFlags
	}
	for _, p := range perms {
		require.Equal(t, want[p.ModuleID.String()], p.ActionFlags)
	}
	for _, p := range perms {
		if p.ModuleID == projects.ID {
			require.True(t, p.CanCreate && p.CanEdit && p.CanDelete, "projects: Full del FORMULADOR, no el del rol retirado")
		}
	}

	var audits int64
	db.Model(&models.AccessAuditLog{}).Where("action = ?", models.AuditRoleRetired).Count(&audits)
	require.EqualValues(t, 1, audits)

	// Idempotente: una segunda corrida no hace nada.
	require.NoError(t, RetireRemovedRoles(db))
	db.Model(&models.AccessAuditLog{}).Where("action = ?", models.AuditRoleRetired).Count(&audits)
	require.EqualValues(t, 1, audits)
}

func TestManifestHasNoAnalistaRole(t *testing.T) {
	for _, d := range modules.Manifest {
		_, ok := d.Defaults["ANALISTA"]
		require.False(t, ok, d.Code)
	}
	for _, r := range modules.NonAdminRoles() {
		require.NotEqual(t, "ANALISTA", r)
	}
}
