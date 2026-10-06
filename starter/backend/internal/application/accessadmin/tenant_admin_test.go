package accessadmin_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"aurora-backend/internal/application/access"
	"aurora-backend/internal/application/accessadmin"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/modules"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	httpmw "aurora-backend/internal/interfaces/http/middleware"
	"aurora-backend/internal/interfaces/http/router"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type tenantEnv struct {
	app    *fiber.App
	db     *gorm.DB
	svc    *accessadmin.Service
	access *access.Service
	tenA   models.Tenant
	tenB   models.Tenant
	adminA models.User // TENANT_ADMIN de A (actor)
	adminB models.User
	userB  models.User // FORMULADOR de B
	userA  models.User // FORMULADOR de A
}

func mkUser(t *testing.T, db *gorm.DB, tenant uuid.UUID, role, email string) models.User {
	t.Helper()
	var r models.Role
	require.NoError(t, db.Where("code = ?", role).First(&r).Error)
	hash, _ := bcrypt.GenerateFromPassword([]byte("clave-original"), bcrypt.MinCost)
	now := time.Now().UTC()
	u := models.User{ID: uuid.New(), TenantID: &tenant, RoleID: r.ID, Email: email, PasswordHash: string(hash), FullName: "U " + email, IsActive: true, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, db.Create(&u).Error)
	return u
}

func newTenantEnv(t *testing.T, mode httpmw.EnforceMode) *tenantEnv {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:tenadm_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
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
	mkTenant := func(name string) models.Tenant {
		ten := models.Tenant{ID: uuid.New(), Name: name, ContactEmail: "a@b.co", Status: "ACTIVE", IsActive: true, CreatedAt: now, UpdatedAt: now}
		require.NoError(t, db.Create(&ten).Error)
		return ten
	}
	e := &tenantEnv{db: db, tenA: mkTenant("Alcaldía A"), tenB: mkTenant("Alcaldía B")}
	e.adminA = mkUser(t, db, e.tenA.ID, constants.RoleTenantAdmin, "admin-a@x.co")
	e.userA = mkUser(t, db, e.tenA.ID, constants.RoleFormulador, "user-a@x.co")
	e.adminB = mkUser(t, db, e.tenB.ID, constants.RoleTenantAdmin, "admin-b@x.co")
	e.userB = mkUser(t, db, e.tenB.ID, constants.RoleFormulador, "user-b@x.co")
	require.NoError(t, postgres.EnsureModulesSeed(db))

	e.access = access.NewService(db, time.Minute)
	e.svc = accessadmin.NewService(db, e.access)
	e.app = fiber.New()
	router.RegisterTenantAdminRoutes(e.app, db, secret, e.svc, httpmw.NewAccessGuard(e.access, mode))
	return e
}

func tenantToken(t *testing.T, u models.User, role string, tv int) string {
	t.Helper()
	tid := u.TenantID.String()
	claims := httpmw.Claims{
		UserID: u.ID.String(), Role: role, TenantID: &tid, TokenType: "access", TokenVersion: tv,
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	}
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	require.NoError(t, err)
	return s
}

func (e *tenantEnv) call(t *testing.T, method, path, tok string, body any) (int, []byte) {
	t.Helper()
	var rd io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rd = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rd)
	req.Header.Set("Content-Type", "application/json")
	if tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	resp, err := e.app.Test(req, -1)
	require.NoError(t, err)
	raw, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, raw
}

func decode(t *testing.T, raw []byte) map[string]any {
	t.Helper()
	var m map[string]any
	_ = json.Unmarshal(raw, &m)
	return m
}

func (e *tenantEnv) reload(t *testing.T, u models.User) models.User {
	t.Helper()
	var out models.User
	require.NoError(t, e.db.First(&out, "id = ?", u.ID).Error)
	return out
}

// Un Tenant Admin que intenta tocar a un usuario de otro tenant recibe 404 (no 403).
func TestTenantAdmin_CrossTenantTargetsReturn404(t *testing.T) {
	e := newTenantEnv(t, httpmw.EnforceOn)
	tok := tenantToken(t, e.adminA, constants.RoleTenantAdmin, 0)
	base := "/api/v1/tenant/users/" + e.userB.ID.String()
	before := e.reload(t, e.userB)
	var permsBefore int64
	e.db.Model(&models.UserModulePermission{}).Where("user_id = ?", e.userB.ID).Count(&permsBefore)

	attempts := []struct {
		method, path string
		body         any
	}{
		{"GET", base, nil},
		{"PATCH", base, map[string]any{"full_name": "Hackeado", "tenant_id": e.tenA.ID.String()}},
		{"PUT", base + "/password", map[string]any{"new_password": "hackeada123"}},
		{"PATCH", base + "/status", map[string]any{"is_active": false}},
		{"GET", base + "/permissions", nil},
		{"PUT", base + "/permissions", map[string]any{"permissions": []map[string]any{{"module_code": modules.CodeReports, "can_view": true, "can_edit": true}}}},
	}
	// Referencia: un usuario inexistente responde exactamente igual (no se filtra su existencia).
	ghost := "/api/v1/tenant/users/" + uuid.NewString()
	for _, a := range attempts {
		status, raw := e.call(t, a.method, a.path, tok, a.body)
		require.Equal(t, 404, status, "%s %s", a.method, a.path)
		gStatus, gRaw := e.call(t, a.method, ghost+a.path[len(base):], tok, a.body)
		require.Equal(t, gStatus, status)
		require.JSONEq(t, string(gRaw), string(raw), "misma respuesta que un usuario inexistente")
	}

	// Nada cambió en el usuario del otro tenant.
	after := e.reload(t, e.userB)
	require.Equal(t, before.FullName, after.FullName)
	require.Equal(t, before.PasswordHash, after.PasswordHash)
	require.Equal(t, before.TokenVersion, after.TokenVersion)
	require.True(t, after.IsActive)
	var permsAfter int64
	e.db.Model(&models.UserModulePermission{}).Where("user_id = ?", e.userB.ID).Count(&permsAfter)
	require.Equal(t, permsBefore, permsAfter)
	var audits int64
	e.db.Model(&models.AccessAuditLog{}).Where("target_user_id = ?", e.userB.ID).Count(&audits)
	require.Zero(t, audits)

	// Y a la inversa: el admin de B no toca a los de A.
	tokB := tenantToken(t, e.adminB, constants.RoleTenantAdmin, 0)
	status, _ := e.call(t, "PATCH", "/api/v1/tenant/users/"+e.userA.ID.String(), tokB, map[string]any{"full_name": "x"})
	require.Equal(t, 404, status)
	// El listado solo muestra su tenant.
	status, raw := e.call(t, "GET", "/api/v1/tenant/users", tok, nil)
	require.Equal(t, 200, status)
	for _, u := range decode(t, raw)["data"].([]any) {
		require.Equal(t, e.tenA.ID.String(), u.(map[string]any)["tenant_id"])
	}
}

func TestTenantAdmin_OwnTenantFlow_TenantComesFromJWT(t *testing.T) {
	e := newTenantEnv(t, httpmw.EnforceOn)
	tok := tenantToken(t, e.adminA, constants.RoleTenantAdmin, 0)

	// tenant_id del cuerpo se ignora: se crea en el tenant del JWT.
	status, raw := e.call(t, "POST", "/api/v1/tenant/users", tok, map[string]any{
		"email": "nuevo@x.co", "full_name": "Nuevo Usuario", "password": "secreto123", "role_code": constants.RoleViewer,
		"tenant_id": e.tenB.ID.String(),
	})
	require.Equal(t, 201, status, string(raw))
	created := decode(t, raw)
	require.Equal(t, e.tenA.ID.String(), created["tenant_id"])
	id := created["id"].(string)
	var row models.User
	require.NoError(t, e.db.First(&row, "id = ?", id).Error)
	require.Equal(t, e.tenA.ID, *row.TenantID)

	// GET y PATCH.
	status, raw = e.call(t, "GET", "/api/v1/tenant/users/"+id, tok, nil)
	require.Equal(t, 200, status)
	require.Equal(t, "nuevo@x.co", decode(t, raw)["email"])
	status, raw = e.call(t, "PATCH", "/api/v1/tenant/users/"+id, tok, map[string]any{
		"full_name": "Nombre Nuevo", "email": "OTRO@x.co", "tenant_id": e.tenB.ID.String(),
	})
	require.Equal(t, 200, status, string(raw))
	require.Equal(t, "Nombre Nuevo", decode(t, raw)["full_name"])
	require.Equal(t, "otro@x.co", decode(t, raw)["email"])
	require.Equal(t, e.tenA.ID.String(), decode(t, raw)["tenant_id"], "el PATCH no mueve al usuario de tenant")
	status, _ = e.call(t, "PATCH", "/api/v1/tenant/users/"+id, tok, map[string]any{"email": "user-a@x.co"})
	require.Equal(t, 409, status, "email duplicado")

	// Contraseña y estado revocan sesiones.
	status, _ = e.call(t, "PUT", "/api/v1/tenant/users/"+id+"/password", tok, map[string]any{"new_password": "otraClave123"})
	require.Equal(t, 204, status)
	require.NoError(t, e.db.First(&row, "id = ?", id).Error)
	require.Equal(t, 1, row.TokenVersion)
	require.NoError(t, bcrypt.CompareHashAndPassword([]byte(row.PasswordHash), []byte("otraClave123")))
	status, _ = e.call(t, "PUT", "/api/v1/tenant/users/"+id+"/password", tok, map[string]any{"new_password": "x"})
	require.Equal(t, 400, status)
	status, _ = e.call(t, "PATCH", "/api/v1/tenant/users/"+id+"/status", tok, map[string]any{"is_active": false})
	require.Equal(t, 204, status)
	require.NoError(t, e.db.First(&row, "id = ?", id).Error)
	require.False(t, row.IsActive)
	require.Equal(t, 2, row.TokenVersion)
	require.ErrorIs(t, e.access.ValidateSession(t.Context(), row.ID, 1), access.ErrSessionRevoked)

	// Permisos.
	status, raw = e.call(t, "PUT", "/api/v1/tenant/users/"+e.userA.ID.String()+"/permissions", tok, map[string]any{
		"permissions": []map[string]any{{"module_code": modules.CodeReports, "can_view": true, "can_create": true}},
	})
	require.Equal(t, 200, status, string(raw))
	status, raw = e.call(t, "GET", "/api/v1/tenant/users/"+e.userA.ID.String()+"/permissions", tok, nil)
	require.Equal(t, 200, status)
	require.NotEmpty(t, decode(t, raw)["permissions"])
	d, err := e.access.Can(t.Context(), e.userA.ID, modules.CodeReports, modules.ActionCreate)
	require.NoError(t, err)
	require.True(t, d.Allowed, "el cambio se ve de inmediato (caché invalidada)")

	// Todo quedó auditado en el tenant del actor.
	var n int64
	e.db.Model(&models.AccessAuditLog{}).Where("tenant_id = ? AND actor_user_id = ?", e.tenA.ID, e.adminA.ID).Count(&n)
	require.GreaterOrEqual(t, n, int64(5))
}

func TestTenantAdmin_CannotGrantOrPromoteSuperAdmin(t *testing.T) {
	e := newTenantEnv(t, httpmw.EnforceOn)
	tok := tenantToken(t, e.adminA, constants.RoleTenantAdmin, 0)

	status, raw := e.call(t, "POST", "/api/v1/tenant/users", tok, map[string]any{
		"email": "root@x.co", "full_name": "Root", "password": "secreto123", "role_code": "super_admin",
	})
	require.Equal(t, 403, status, string(raw))
	var n int64
	e.db.Model(&models.User{}).Where("email = ?", "root@x.co").Count(&n)
	require.Zero(t, n)

	status, _ = e.call(t, "PATCH", "/api/v1/tenant/users/"+e.userA.ID.String(), tok, map[string]any{"role_code": constants.RoleSuperAdmin})
	require.Equal(t, 403, status)
	require.Equal(t, constants.RoleFormulador, roleOf(t, e, e.userA))

	// Sí puede crear otro Tenant Admin (D3) y cambiar entre roles de entidad.
	status, raw = e.call(t, "POST", "/api/v1/tenant/users", tok, map[string]any{
		"email": "admin2@x.co", "full_name": "Admin Dos", "password": "secreto123", "role_code": constants.RoleTenantAdmin,
	})
	require.Equal(t, 201, status, string(raw))
	status, _ = e.call(t, "PATCH", "/api/v1/tenant/users/"+e.userA.ID.String(), tok, map[string]any{"role_code": constants.RoleEvaluador})
	require.Equal(t, 200, status)
	require.Equal(t, constants.RoleEvaluador, roleOf(t, e, e.userA))
	require.Equal(t, 1, e.reload(t, e.userA).TokenVersion, "el cambio de rol revoca sus sesiones")
}

func roleOf(t *testing.T, e *tenantEnv, u models.User) string {
	t.Helper()
	var code string
	require.NoError(t, e.db.Table("roles").Select("code").Where("id = ?", e.reload(t, u).RoleID).Scan(&code).Error)
	return code
}

func TestTenantAdmin_LastTenantAdminIsProtected(t *testing.T) {
	e := newTenantEnv(t, httpmw.EnforceOn)
	tok := tenantToken(t, e.adminA, constants.RoleTenantAdmin, 0)
	self := "/api/v1/tenant/users/" + e.adminA.ID.String()

	// Vía API: ni desactivarse ni degradarse a sí mismo.
	status, _ := e.call(t, "PATCH", self+"/status", tok, map[string]any{"is_active": false})
	require.Equal(t, 400, status)
	status, _ = e.call(t, "PATCH", self, tok, map[string]any{"role_code": constants.RoleViewer})
	require.Equal(t, 400, status)
	require.True(t, e.reload(t, e.adminA).IsActive)
	require.Equal(t, constants.RoleTenantAdmin, roleOf(t, e, e.adminA))

	// Con un segundo admin, el primero puede desactivarlo mientras el actor siga activo.
	admin2 := mkUser(t, e.db, e.tenA.ID, constants.RoleTenantAdmin, "admin2@x.co")
	status, _ = e.call(t, "PATCH", "/api/v1/tenant/users/"+admin2.ID.String()+"/status", tok, map[string]any{"is_active": false})
	require.Equal(t, 204, status)

	// A nivel de servicio (actor distinto, p. ej. una política obsoleta): el último admin no se toca.
	ghost := accessadmin.ActorPolicy{UserID: uuid.New(), TenantID: e.tenA.ID, Role: constants.RoleTenantAdmin}
	role := constants.RoleViewer
	_, err := e.svc.TenantUpdateUser(t.Context(), ghost, e.adminA.ID, accessadmin.TenantUpdateUserInput{RoleCode: &role})
	require.ErrorIs(t, err, accessadmin.ErrConflict)
	require.ErrorIs(t, e.svc.TenantSetUserStatus(t.Context(), ghost, e.adminA.ID, false), accessadmin.ErrConflict)
	require.True(t, e.reload(t, e.adminA).IsActive)
}

func TestTenantAdmin_ActorIsVerifiedAgainstDB(t *testing.T) {
	e := newTenantEnv(t, httpmw.EnforceOn)
	path := "/api/v1/tenant/users"

	// Rol no admin en el JWT: RequireRole.
	status, _ := e.call(t, "GET", path, tenantToken(t, e.userA, constants.RoleFormulador, 0), nil)
	require.Equal(t, 403, status)
	// Sin token.
	status, _ = e.call(t, "GET", path, "", nil)
	require.Equal(t, 401, status)
	// Token con token_version viejo: sesión revocada.
	require.NoError(t, e.db.Model(&models.User{}).Where("id = ?", e.adminA.ID).Update("token_version", 3).Error)
	status, raw := e.call(t, "GET", path, tenantToken(t, e.adminA, constants.RoleTenantAdmin, 0), nil)
	require.Equal(t, 401, status)
	require.Equal(t, httpmw.CodeSessionRevoked, decode(t, raw)["code"])
	status, _ = e.call(t, "GET", path, tenantToken(t, e.adminA, constants.RoleTenantAdmin, 3), nil)
	require.Equal(t, 200, status)

	// JWT dice TENANT_ADMIN pero en BD ya es FORMULADOR (degradado hace <1 h): 403.
	var r models.Role
	require.NoError(t, e.db.Where("code = ?", constants.RoleFormulador).First(&r).Error)
	require.NoError(t, e.db.Model(&models.User{}).Where("id = ?", e.adminB.ID).Update("role_id", r.ID).Error)
	status, _ = e.call(t, "GET", path, tenantToken(t, e.adminB, constants.RoleTenantAdmin, 0), nil)
	require.Equal(t, 403, status)

	// Desactivado: 401.
	require.NoError(t, e.db.Model(&models.User{}).Where("id = ?", e.adminA.ID).Update("is_active", false).Error)
	status, _ = e.call(t, "GET", path, tenantToken(t, e.adminA, constants.RoleTenantAdmin, 3), nil)
	require.Equal(t, 401, status)
}

func TestTenantAdmin_AssignableModules(t *testing.T) {
	e := newTenantEnv(t, httpmw.EnforceOn)
	tok := tenantToken(t, e.adminA, constants.RoleTenantAdmin, 0)

	codesOf := func(raw []byte) map[string]bool {
		out := map[string]bool{}
		for _, m := range decode(t, raw)["data"].([]any) {
			out[m.(map[string]any)["code"].(string)] = true
		}
		return out
	}

	status, raw := e.call(t, "GET", "/api/v1/tenant/modules/assignable", tok, nil)
	require.Equal(t, 200, status)
	codes := codesOf(raw)
	for _, want := range []string{modules.CodeProjects, modules.CodeMGA, modules.CodeMGAEvaluacion, modules.CodeReports, modules.CodeCatalog, modules.CodeAI} {
		require.True(t, codes[want], want)
	}
	require.False(t, codes[modules.CodeUsers], "la administración de usuarios no se delega")
	require.False(t, codes[modules.CodeAdminTenants], "los módulos de plataforma no se delegan")

	// Techo: el SUPER_ADMIN deshabilita reports y mga para A.
	require.NoError(t, e.svc.SetTenantModules(t.Context(), accessadmin.Actor{UserID: uuid.New()}, e.tenA.ID, []accessadmin.TenantModuleChange{
		{ModuleCode: modules.CodeReports, IsEnabled: false}, {ModuleCode: modules.CodeMGA, IsEnabled: false},
	}))
	_, raw = e.call(t, "GET", "/api/v1/tenant/modules/assignable", tok, nil)
	codes = codesOf(raw)
	require.False(t, codes[modules.CodeReports])
	require.False(t, codes[modules.CodeMGA])
	require.False(t, codes[modules.CodeMGAEvaluacion], "las secciones de un módulo deshabilitado tampoco")
	require.True(t, codes[modules.CodeProjects])

	// Un módulo inactivo del sistema tampoco.
	require.NoError(t, e.db.Model(&models.Module{}).Where("code = ?", modules.CodeCatalog).Update("is_active", false).Error)
	_, raw = e.call(t, "GET", "/api/v1/tenant/modules/assignable", tok, nil)
	require.False(t, codesOf(raw)[modules.CodeCatalog])

	// El techo de A no afecta a B.
	tokB := tenantToken(t, e.adminB, constants.RoleTenantAdmin, 0)
	_, raw = e.call(t, "GET", "/api/v1/tenant/modules/assignable", tokB, nil)
	require.True(t, codesOf(raw)[modules.CodeReports])

	// Delegar fuera del catálogo asignable se rechaza.
	for _, code := range []string{modules.CodeReports, modules.CodeUsers, modules.CodeAdminTenants, modules.CodeCatalog} {
		status, _ = e.call(t, "PUT", "/api/v1/tenant/users/"+e.userA.ID.String()+"/permissions", tok, map[string]any{
			"permissions": []map[string]any{{"module_code": code, "can_view": true}},
		})
		require.Equal(t, 400, status, code)
	}
	status, _ = e.call(t, "PUT", "/api/v1/tenant/users/"+e.userA.ID.String()+"/permissions", tok, map[string]any{
		"permissions": []map[string]any{{"module_code": modules.CodeProjects, "can_view": true, "can_edit": true}},
	})
	require.Equal(t, 200, status)
}

func TestTenantAdmin_UsersModuleCeilingAppliesToTenantAdmins(t *testing.T) {
	e := newTenantEnv(t, httpmw.EnforceOn)
	tok := tenantToken(t, e.adminA, constants.RoleTenantAdmin, 0)
	status, _ := e.call(t, "GET", "/api/v1/tenant/users", tok, nil)
	require.Equal(t, 200, status)

	// El SUPER_ADMIN apaga el módulo users para A: PBAC (enforce) devuelve el 403 estándar.
	require.NoError(t, e.svc.SetTenantModules(t.Context(), accessadmin.Actor{UserID: uuid.New()}, e.tenA.ID, []accessadmin.TenantModuleChange{
		{ModuleCode: modules.CodeUsers, IsEnabled: false},
	}))
	status, raw := e.call(t, "GET", "/api/v1/tenant/users", tok, nil)
	require.Equal(t, 403, status)
	require.Equal(t, httpmw.CodePermissionDenied, decode(t, raw)["code"])
	require.Equal(t, "module_disabled", decode(t, raw)["reason"])

	// En dry-run (log) no bloquea.
	logEnv := newTenantEnv(t, httpmw.EnforceLog)
	require.NoError(t, logEnv.svc.SetTenantModules(t.Context(), accessadmin.Actor{UserID: uuid.New()}, logEnv.tenA.ID, []accessadmin.TenantModuleChange{
		{ModuleCode: modules.CodeUsers, IsEnabled: false},
	}))
	status, _ = logEnv.call(t, "GET", "/api/v1/tenant/users", tenantToken(t, logEnv.adminA, constants.RoleTenantAdmin, 0), nil)
	require.Equal(t, 200, status)
}

func TestTenantAdmin_RoleChangeFillsMissingDefaults(t *testing.T) {
	e := newTenantEnv(t, httpmw.EnforceOn)
	tok := tenantToken(t, e.adminA, constants.RoleTenantAdmin, 0)

	// Crear admin2, bajarlo a VIEWER: recibe los defaults del rol.
	status, raw := e.call(t, "POST", "/api/v1/tenant/users", tok, map[string]any{
		"email": "ex-admin@x.co", "full_name": "Ex Admin", "password": "secreto123", "role_code": constants.RoleTenantAdmin,
	})
	require.Equal(t, 201, status, string(raw))
	id := decode(t, raw)["id"].(string)
	var n int64
	e.db.Model(&models.UserModulePermission{}).Where("user_id = ?", id).Count(&n)
	require.Zero(t, n)

	status, _ = e.call(t, "PATCH", "/api/v1/tenant/users/"+id, tok, map[string]any{"role_code": constants.RoleViewer})
	require.Equal(t, 200, status)
	e.db.Model(&models.UserModulePermission{}).Where("user_id = ?", id).Count(&n)
	require.Positive(t, n)
	status, _ = e.call(t, "PATCH", "/api/v1/tenant/users/"+id, tok, map[string]any{"role_code": "NO_EXISTE"})
	require.Equal(t, 400, status)
}

func TestSuperAdmin_UpdateUserAndRoleTemplates(t *testing.T) {
	e := newTenantEnv(t, httpmw.EnforceOn)
	actor := accessadmin.Actor{UserID: uuid.New()}

	name := "Nombre Nuevo"
	role := constants.RoleEvaluador
	v, err := e.svc.UpdateUser(context.Background(), actor, e.userB.ID, accessadmin.TenantUpdateUserInput{FullName: &name, RoleCode: &role})
	require.NoError(t, err)
	require.Equal(t, name, v.FullName)
	require.Equal(t, constants.RoleEvaluador, v.Role)

	sa := constants.RoleSuperAdmin
	_, err = e.svc.UpdateUser(context.Background(), actor, e.userB.ID, accessadmin.TenantUpdateUserInput{RoleCode: &sa})
	require.ErrorIs(t, err, accessadmin.ErrForbidden)

	tpl, err := e.svc.RoleTemplates(context.Background())
	require.NoError(t, err)
	require.Len(t, tpl, 4)
	require.Equal(t, constants.RoleFormulador, tpl[0].Role)
	require.True(t, tpl[0].Modules[modules.CodeProjects].CanDelete)
	require.False(t, tpl[3].Modules[modules.CodeProjects].CanCreate)
}
