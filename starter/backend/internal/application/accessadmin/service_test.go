package accessadmin

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"aurora-backend/internal/application/access"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/modules"
	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type recorder struct {
	users   []uuid.UUID
	tenants []uuid.UUID
	all     int
	inner   *access.Service
}

func (r *recorder) Invalidate(id uuid.UUID) { r.users = append(r.users, id); r.inner.Invalidate(id) }
func (r *recorder) InvalidateTenant(id uuid.UUID) {
	r.tenants = append(r.tenants, id)
	r.inner.InvalidateTenant(id)
}
func (r *recorder) InvalidateAll() { r.all++; r.inner.InvalidateAll() }

type env struct {
	db     *gorm.DB
	svc    *Service
	access *access.Service
	rec    *recorder
	actor  Actor
	tenant models.Tenant
}

func newEnv(t *testing.T) *env {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:accadm_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
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
	require.NoError(t, postgres.EnsureModulesSeed(db))

	acc := access.NewService(db, time.Minute)
	rec := &recorder{inner: acc}
	return &env{db: db, svc: NewService(db, rec), access: acc, rec: rec, actor: Actor{UserID: uuid.New()}, tenant: tenant}
}

func (e *env) newUser(t *testing.T, role, email string) *UserView {
	t.Helper()
	u, err := e.svc.CreateTenantUser(context.Background(), e.actor, e.tenant.ID, CreateUserInput{
		Email: email, FullName: "Usuario " + role, Password: "secreto123", RoleCode: role,
	})
	require.NoError(t, err)
	return u
}

func (e *env) audits(t *testing.T, action string) []models.AccessAuditLog {
	t.Helper()
	var logs []models.AccessAuditLog
	require.NoError(t, e.db.Where("action = ?", action).Find(&logs).Error)
	return logs
}

func (e *env) module(t *testing.T, code string) models.Module {
	t.Helper()
	var m models.Module
	require.NoError(t, e.db.Where("code = ?", code).First(&m).Error)
	return m
}

func TestCreateModule(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()

	m, err := e.svc.CreateModule(ctx, e.actor, CreateModuleInput{Code: "obras", Name: "Obras", Route: "/tenant/obras", SortOrder: 70})
	require.NoError(t, err)
	require.False(t, m.IsSystem)
	require.False(t, m.Customized)
	require.Equal(t, modules.KindModule, m.Kind)
	require.Equal(t, 1, e.rec.all, "invalida toda la caché")

	sec, err := e.svc.CreateModule(ctx, e.actor, CreateModuleInput{Code: "obras.planos", Name: "Planos", Kind: modules.KindSection, ParentCode: "obras", Route: "/tenant/obras#planos"})
	require.NoError(t, err)
	require.Equal(t, "obras", sec.ParentCode)

	logs := e.audits(t, models.AuditModuleCreated)
	require.Len(t, logs, 2)
	require.Equal(t, e.actor.UserID, *logs[0].ActorUserID)

	bad := []CreateModuleInput{
		{Code: "Mal Código", Name: "x", Route: "/x"},
		{Code: "x", Name: "", Route: "/x"},
		{Code: "x", Name: "x", Route: "sin-slash"},
		{Code: "x", Name: "x", Route: "/x", Kind: "OTRO"},
		{Code: "x", Name: "x", Route: "/x", Kind: modules.KindSection},                             // sin padre
		{Code: "x", Name: "x", Route: "/x", Kind: modules.KindSection, ParentCode: "no-existe"},    // padre inexistente
		{Code: "x", Name: "x", Route: "/x", Kind: modules.KindSection, ParentCode: "obras.planos"}, // padre sección
		{Code: "x", Name: "x", Route: "/x", ParentCode: "obras"},                                   // MODULE con padre
		{Code: "x", Name: "x", Route: "/x", Kind: modules.KindSection, ParentCode: "obras", Scope: modules.ScopePlatform},
	}
	for i, in := range bad {
		_, err := e.svc.CreateModule(ctx, e.actor, in)
		require.ErrorIs(t, err, ErrValidation, "caso %d", i)
	}

	_, err = e.svc.CreateModule(ctx, e.actor, CreateModuleInput{Code: "obras", Name: "Otra", Route: "/otra"})
	require.ErrorIs(t, err, ErrConflict, "code duplicado")
	_, err = e.svc.CreateModule(ctx, e.actor, CreateModuleInput{Code: "otra", Name: "Otra", Route: "/tenant/obras"})
	require.ErrorIs(t, err, ErrConflict, "route duplicada")
}

func TestUpdateModule_SystemBecomesCustomizedAndSeedDoesNotOverwrite(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	projects := e.module(t, modules.CodeProjects)
	require.True(t, projects.IsSystem)
	require.False(t, projects.Customized)

	name := "Mis Proyectos"
	v, err := e.svc.UpdateModule(ctx, e.actor, projects.ID, UpdateModuleInput{Name: &name})
	require.NoError(t, err)
	require.Equal(t, name, v.Name)
	require.True(t, v.Customized)
	require.Len(t, e.audits(t, models.AuditModuleUpdated), 1)

	// Un re-seed con una versión nueva no pisa el nombre editado.
	require.NoError(t, postgres.SyncModulesManifestForTest(e.db, modules.Manifest, modules.SeedVersion+1))
	require.Equal(t, name, e.module(t, modules.CodeProjects).Name)
	// ...pero sí actualiza los módulos no personalizados.
	e2 := e.module(t, modules.CodeReports)
	require.Equal(t, modules.SeedVersion+1, e2.SeedVersion)
	require.Equal(t, modules.SeedVersion+1, e.module(t, modules.CodeProjects).SeedVersion)

	// Sin cambios no audita ni marca nada.
	before := len(e.audits(t, models.AuditModuleUpdated))
	reports := e.module(t, modules.CodeReports)
	same := reports.Name
	v, err = e.svc.UpdateModule(ctx, e.actor, reports.ID, UpdateModuleInput{Name: &same})
	require.NoError(t, err)
	require.False(t, v.Customized)
	require.Len(t, e.audits(t, models.AuditModuleUpdated), before)

	// Validaciones y duplicados.
	empty := " "
	_, err = e.svc.UpdateModule(ctx, e.actor, reports.ID, UpdateModuleInput{Name: &empty})
	require.ErrorIs(t, err, ErrValidation)
	route := projects.Route
	_, err = e.svc.UpdateModule(ctx, e.actor, reports.ID, UpdateModuleInput{Route: &route})
	require.ErrorIs(t, err, ErrConflict)
	_, err = e.svc.UpdateModule(ctx, e.actor, uuid.New(), UpdateModuleInput{Name: &same})
	require.ErrorIs(t, err, ErrNotFound)
}

func TestDeleteModule(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()

	err := e.svc.DeleteModule(ctx, e.actor, e.module(t, modules.CodeReports).ID)
	require.ErrorIs(t, err, ErrForbidden, "los módulos de sistema no se borran")
	require.NotZero(t, e.module(t, modules.CodeReports).ID)

	parent, err := e.svc.CreateModule(ctx, e.actor, CreateModuleInput{Code: "obras", Name: "Obras", Route: "/tenant/obras"})
	require.NoError(t, err)
	_, err = e.svc.CreateModule(ctx, e.actor, CreateModuleInput{Code: "obras.a", Name: "A", Kind: modules.KindSection, ParentCode: "obras", Route: "/tenant/obras#a"})
	require.NoError(t, err)
	require.ErrorIs(t, e.svc.DeleteModule(ctx, e.actor, parent.ID), ErrConflict, "con secciones")

	child := e.module(t, "obras.a")
	// Una fila dependiente se borra junto con el módulo.
	require.NoError(t, e.db.Create(&models.TenantModule{ID: uuid.New(), TenantID: e.tenant.ID, ModuleID: child.ID, IsEnabled: false, CreatedAt: time.Now(), UpdatedAt: time.Now()}).Error)
	require.NoError(t, e.svc.DeleteModule(ctx, e.actor, child.ID))
	require.NoError(t, e.svc.DeleteModule(ctx, e.actor, parent.ID))

	var n int64
	e.db.Model(&models.Module{}).Where("code LIKE ?", "obras%").Count(&n)
	require.Zero(t, n)
	e.db.Model(&models.TenantModule{}).Where("module_id = ?", child.ID).Count(&n)
	require.Zero(t, n)
	require.Len(t, e.audits(t, models.AuditModuleDeleted), 2)
	require.ErrorIs(t, e.svc.DeleteModule(ctx, e.actor, uuid.New()), ErrNotFound)
}

func TestReorderModules(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	projects, reports := e.module(t, modules.CodeProjects), e.module(t, modules.CodeReports)

	require.NoError(t, e.svc.ReorderModules(ctx, e.actor, []ReorderItem{{ID: projects.ID, SortOrder: 99}, {ID: reports.ID, SortOrder: 5}}))
	p, r := e.module(t, modules.CodeProjects), e.module(t, modules.CodeReports)
	require.Equal(t, 99, p.SortOrder)
	require.Equal(t, 5, r.SortOrder)
	require.True(t, p.Customized && r.Customized, "reordenar un módulo de sistema lo marca customizado")
	require.Len(t, e.audits(t, models.AuditModulesReordered), 1)

	// El seed no revierte el orden.
	require.NoError(t, postgres.SyncModulesManifestForTest(e.db, modules.Manifest, modules.SeedVersion+1))
	require.Equal(t, 99, e.module(t, modules.CodeProjects).SortOrder)

	require.ErrorIs(t, e.svc.ReorderModules(ctx, e.actor, nil), ErrValidation)
	require.ErrorIs(t, e.svc.ReorderModules(ctx, e.actor, []ReorderItem{{ID: projects.ID}, {ID: projects.ID}}), ErrValidation)
	require.ErrorIs(t, e.svc.ReorderModules(ctx, e.actor, []ReorderItem{{ID: uuid.New(), SortOrder: 1}}), ErrNotFound)
}

func TestSetTenantModules_CapsAccessAndInvalidates(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	user := e.newUser(t, constants.RoleFormulador, "f@x.co")

	can := func() bool {
		d, err := e.access.Can(ctx, user.ID, modules.CodeReports, modules.ActionView)
		require.NoError(t, err)
		return d.Allowed
	}
	require.True(t, can())

	require.NoError(t, e.svc.SetTenantModules(ctx, e.actor, e.tenant.ID, []TenantModuleChange{{ModuleCode: modules.CodeReports, IsEnabled: false}}))
	require.Equal(t, []uuid.UUID{e.tenant.ID}, e.rec.tenants)
	require.False(t, can(), "el cambio es visible de inmediato: la caché se invalidó")

	mods, err := e.svc.GetTenantModules(ctx, e.tenant.ID)
	require.NoError(t, err)
	for _, m := range mods {
		require.Equal(t, m.ModuleCode != modules.CodeReports, m.IsEnabled, m.ModuleCode)
		require.NotEqual(t, modules.CodeAdminTenants, m.ModuleCode, "los módulos de plataforma no se listan")
	}

	require.NoError(t, e.svc.SetTenantModules(ctx, e.actor, e.tenant.ID, []TenantModuleChange{{ModuleCode: modules.CodeReports, IsEnabled: true}}))
	require.True(t, can())
	require.Len(t, e.audits(t, models.AuditTenantModulesUpdated), 2)

	// Un no-op no audita.
	require.NoError(t, e.svc.SetTenantModules(ctx, e.actor, e.tenant.ID, []TenantModuleChange{{ModuleCode: modules.CodeReports, IsEnabled: true}}))
	require.Len(t, e.audits(t, models.AuditTenantModulesUpdated), 2)

	require.ErrorIs(t, e.svc.SetTenantModules(ctx, e.actor, e.tenant.ID, []TenantModuleChange{{ModuleCode: modules.CodeAdminTenants, IsEnabled: false}}), ErrValidation)
	require.ErrorIs(t, e.svc.SetTenantModules(ctx, e.actor, e.tenant.ID, []TenantModuleChange{{ModuleCode: "no-existe"}}), ErrValidation)
	require.ErrorIs(t, e.svc.SetTenantModules(ctx, e.actor, e.tenant.ID, nil), ErrValidation)
	require.ErrorIs(t, e.svc.SetTenantModules(ctx, e.actor, uuid.New(), []TenantModuleChange{{ModuleCode: modules.CodeReports}}), ErrNotFound)
}

func TestCreateTenantUser(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()

	u := e.newUser(t, constants.RoleViewer, "  V@X.co ")
	require.Equal(t, "v@x.co", u.Email)
	require.Equal(t, constants.RoleViewer, u.Role)

	// Recibe los defaults de su rol (solo lectura).
	var perms []models.UserModulePermission
	require.NoError(t, e.db.Where("user_id = ?", u.ID).Find(&perms).Error)
	require.NotEmpty(t, perms)
	for _, p := range perms {
		require.True(t, p.CanView)
		require.False(t, p.CanCreate || p.CanEdit || p.CanDelete)
		require.Equal(t, e.actor.UserID, *p.GrantedBy)
	}

	// La contraseña se guarda con bcrypt y nunca en la auditoría.
	var row models.User
	require.NoError(t, e.db.First(&row, "id = ?", u.ID).Error)
	require.NoError(t, bcrypt.CompareHashAndPassword([]byte(row.PasswordHash), []byte("secreto123")))
	for _, l := range e.audits(t, models.AuditUserCreated) {
		require.NotContains(t, l.Details, "secreto123")
		require.NotContains(t, l.Details, row.PasswordHash)
	}

	// Un TENANT_ADMIN se resuelve por rol: sin filas por usuario.
	admin := e.newUser(t, constants.RoleTenantAdmin, "a@x.co")
	var n int64
	e.db.Model(&models.UserModulePermission{}).Where("user_id = ?", admin.ID).Count(&n)
	require.Zero(t, n)

	in := CreateUserInput{Email: "z@x.co", FullName: "Zeta", Password: "secreto123", RoleCode: constants.RoleViewer}
	dup := in
	dup.Email = "V@x.co"
	_, err := e.svc.CreateTenantUser(ctx, e.actor, e.tenant.ID, dup)
	require.ErrorIs(t, err, ErrConflict)

	for name, mutate := range map[string]func(*CreateUserInput){
		"email":       func(i *CreateUserInput) { i.Email = "sin-arroba" },
		"nombre":      func(i *CreateUserInput) { i.FullName = "x" },
		"password":    func(i *CreateUserInput) { i.Password = "corta" },
		"super":       func(i *CreateUserInput) { i.RoleCode = constants.RoleSuperAdmin },
		"rol vacío":   func(i *CreateUserInput) { i.RoleCode = "" },
		"rol inexist": func(i *CreateUserInput) { i.RoleCode = "NOPE" },
	} {
		bad := in
		mutate(&bad)
		_, err := e.svc.CreateTenantUser(ctx, e.actor, e.tenant.ID, bad)
		require.ErrorIs(t, err, ErrValidation, name)
	}
	_, err = e.svc.CreateTenantUser(ctx, e.actor, uuid.New(), in)
	require.ErrorIs(t, err, ErrNotFound)

	e.db.Model(&models.Tenant{}).Where("id = ?", e.tenant.ID).Update("is_active", false)
	_, err = e.svc.CreateTenantUser(ctx, e.actor, e.tenant.ID, in)
	require.ErrorIs(t, err, ErrConflict, "tenant inactivo")

	users, total, err := e.svc.ListTenantUsers(ctx, e.tenant.ID, 10, 0)
	require.NoError(t, err)
	require.EqualValues(t, 2, total)
	require.Len(t, users, 2)
	_, _, err = e.svc.ListTenantUsers(ctx, uuid.New(), 10, 0)
	require.ErrorIs(t, err, ErrNotFound)
}

func TestSetUserPermissions(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	viewer := e.newUser(t, constants.RoleViewer, "v@x.co")
	admin := e.newUser(t, constants.RoleTenantAdmin, "a@x.co")

	can := func(action modules.Action) bool {
		d, err := e.access.Can(ctx, viewer.ID, modules.CodeProjects, action)
		require.NoError(t, err)
		return d.Allowed
	}
	require.False(t, can(modules.ActionCreate)) // calienta la caché

	require.NoError(t, e.svc.SetUserPermissions(ctx, e.actor, viewer.ID, []PermissionInput{
		{ModuleCode: modules.CodeProjects, CanView: true, CanCreate: true},
	}))
	require.Equal(t, []uuid.UUID{viewer.ID}, e.rec.users)
	require.True(t, can(modules.ActionCreate), "visible al instante: se invalidó la caché del usuario")
	require.False(t, can(modules.ActionEdit))

	logs := e.audits(t, models.AuditUserPermissionsSet)
	require.Len(t, logs, 1)
	require.Equal(t, viewer.ID, *logs[0].TargetUserID)
	require.Equal(t, e.tenant.ID, *logs[0].TenantID)
	var details map[string]any
	require.NoError(t, json.Unmarshal([]byte(logs[0].Details), &details))
	require.Len(t, details["changes"], 1)

	// Reaplicar lo mismo no audita ni invalida de más.
	require.NoError(t, e.svc.SetUserPermissions(ctx, e.actor, viewer.ID, []PermissionInput{{ModuleCode: modules.CodeProjects, CanView: true, CanCreate: true}}))
	require.Len(t, e.audits(t, models.AuditUserPermissionsSet), 1)

	// GET refleja valores actuales y los defaults del rol.
	got, err := e.svc.GetUserPermissions(ctx, viewer.ID)
	require.NoError(t, err)
	require.False(t, got.ResolvedByRole)
	var pv *PermissionView
	for i := range got.Permissions {
		if got.Permissions[i].ModuleCode == modules.CodeProjects {
			pv = &got.Permissions[i]
		}
	}
	require.NotNil(t, pv)
	require.True(t, pv.CanCreate)
	require.False(t, pv.DefaultCreate)
	require.True(t, pv.DefaultView)

	gotAdmin, err := e.svc.GetUserPermissions(ctx, admin.ID)
	require.NoError(t, err)
	require.True(t, gotAdmin.ResolvedByRole)
	require.Empty(t, gotAdmin.Permissions)

	require.ErrorIs(t, e.svc.SetUserPermissions(ctx, e.actor, admin.ID, []PermissionInput{{ModuleCode: modules.CodeProjects, CanView: true}}), ErrValidation, "admins se resuelven por rol")
	require.ErrorIs(t, e.svc.SetUserPermissions(ctx, e.actor, viewer.ID, []PermissionInput{{ModuleCode: modules.CodeProjects, CanEdit: true}}), ErrValidation, "edit requiere view")
	require.ErrorIs(t, e.svc.SetUserPermissions(ctx, e.actor, viewer.ID, []PermissionInput{{ModuleCode: modules.CodeAdminTenants, CanView: true}}), ErrValidation, "plataforma")
	require.ErrorIs(t, e.svc.SetUserPermissions(ctx, e.actor, viewer.ID, []PermissionInput{{ModuleCode: "no-existe", CanView: true}}), ErrValidation)
	require.ErrorIs(t, e.svc.SetUserPermissions(ctx, e.actor, viewer.ID, []PermissionInput{{ModuleCode: modules.CodeReports, CanView: true}, {ModuleCode: modules.CodeReports}}), ErrValidation, "repetido")
	require.ErrorIs(t, e.svc.SetUserPermissions(ctx, e.actor, viewer.ID, nil), ErrValidation)
	require.ErrorIs(t, e.svc.SetUserPermissions(ctx, e.actor, uuid.New(), []PermissionInput{{ModuleCode: modules.CodeReports, CanView: true}}), ErrNotFound)
}

func tokenVersion(t *testing.T, e *env, id uuid.UUID) int {
	t.Helper()
	var u models.User
	require.NoError(t, e.db.First(&u, "id = ?", id).Error)
	return u.TokenVersion
}

func TestSetUserPassword_RevokesSessions(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	u := e.newUser(t, constants.RoleFormulador, "f@x.co")
	require.NoError(t, e.access.ValidateSession(ctx, u.ID, 0))

	require.NoError(t, e.svc.SetUserPassword(ctx, e.actor, u.ID, "nuevaClave99"))
	require.Equal(t, 1, tokenVersion(t, e, u.ID))
	require.Equal(t, []uuid.UUID{u.ID}, e.rec.users)
	require.ErrorIs(t, e.access.ValidateSession(ctx, u.ID, 0), access.ErrSessionRevoked, "el token viejo deja de servir de inmediato")

	var row models.User
	require.NoError(t, e.db.First(&row, "id = ?", u.ID).Error)
	require.NoError(t, bcrypt.CompareHashAndPassword([]byte(row.PasswordHash), []byte("nuevaClave99")))

	logs := e.audits(t, models.AuditUserPasswordChanged)
	require.Len(t, logs, 1)
	require.NotContains(t, logs[0].Details, "nuevaClave99")
	require.NotContains(t, logs[0].Details, row.PasswordHash)

	require.ErrorIs(t, e.svc.SetUserPassword(ctx, e.actor, u.ID, "corta"), ErrValidation)
	require.ErrorIs(t, e.svc.SetUserPassword(ctx, e.actor, uuid.New(), "nuevaClave99"), ErrNotFound)
}

func TestSetUserStatus(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	f := e.newUser(t, constants.RoleFormulador, "f@x.co")
	admin1 := e.newUser(t, constants.RoleTenantAdmin, "a1@x.co")

	require.NoError(t, e.svc.SetUserStatus(ctx, e.actor, f.ID, false))
	require.Equal(t, 1, tokenVersion(t, e, f.ID))
	require.ErrorIs(t, e.access.ValidateSession(ctx, f.ID, 1), access.ErrSessionRevoked, "inactivo")
	require.Len(t, e.audits(t, models.AuditUserStatusChanged), 1)

	require.NoError(t, e.svc.SetUserStatus(ctx, e.actor, f.ID, true))
	require.Equal(t, 2, tokenVersion(t, e, f.ID))
	require.NoError(t, e.access.ValidateSession(ctx, f.ID, 2))

	// Repetir el mismo estado es un no-op.
	require.NoError(t, e.svc.SetUserStatus(ctx, e.actor, f.ID, true))
	require.Equal(t, 2, tokenVersion(t, e, f.ID))

	// D3: el último Tenant Admin activo no se puede desactivar.
	require.ErrorIs(t, e.svc.SetUserStatus(ctx, e.actor, admin1.ID, false), ErrConflict)
	require.Equal(t, 0, tokenVersion(t, e, admin1.ID))
	admin2 := e.newUser(t, constants.RoleTenantAdmin, "a2@x.co")
	require.NoError(t, e.svc.SetUserStatus(ctx, e.actor, admin1.ID, false))
	require.ErrorIs(t, e.svc.SetUserStatus(ctx, e.actor, admin2.ID, false), ErrConflict, "ahora admin2 es el último")

	require.ErrorIs(t, e.svc.SetUserStatus(ctx, e.actor, e.actor.UserID, false), ErrValidation, "no se desactiva a sí mismo")
	require.ErrorIs(t, e.svc.SetUserStatus(ctx, e.actor, uuid.New(), true), ErrNotFound)
}
