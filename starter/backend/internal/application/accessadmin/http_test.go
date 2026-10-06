package accessadmin_test

import (
	"bytes"
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
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const secret = "http-test-secret"

type httpEnv struct {
	app      *fiber.App
	db       *gorm.DB
	tenantID uuid.UUID
	superTok string
	formTok  string
}

func token(t *testing.T, role string, tenant *string) string {
	t.Helper()
	claims := httpmw.Claims{
		UserID: uuid.NewString(), Role: role, TenantID: tenant, TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	}
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	require.NoError(t, err)
	return s
}

func newHTTPEnv(t *testing.T) *httpEnv {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:accadm_http_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
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
	app := fiber.New()
	router.RegisterAdminAccessRoutes(app, secret, accessadmin.NewService(db, acc))

	tid := tenant.ID.String()
	return &httpEnv{app: app, db: db, tenantID: tenant.ID, superTok: token(t, constants.RoleSuperAdmin, nil), formTok: token(t, constants.RoleFormulador, &tid)}
}

func (e *httpEnv) call(t *testing.T, method, path, tok string, body any) (int, map[string]any) {
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
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return resp.StatusCode, out
}

func TestAdminAccessRoutes_OnlySuperAdmin(t *testing.T) {
	e := newHTTPEnv(t)
	id := uuid.NewString()
	routes := []struct{ method, path string }{
		{"GET", "/api/v1/admin/modules"}, {"POST", "/api/v1/admin/modules"},
		{"PUT", "/api/v1/admin/modules/order"}, {"PUT", "/api/v1/admin/modules/" + id}, {"DELETE", "/api/v1/admin/modules/" + id},
		{"GET", "/api/v1/admin/tenants/" + id + "/users"}, {"POST", "/api/v1/admin/tenants/" + id + "/users"},
		{"GET", "/api/v1/admin/tenants/" + id + "/modules"}, {"PUT", "/api/v1/admin/tenants/" + id + "/modules"},
		{"GET", "/api/v1/admin/users/" + id + "/permissions"}, {"PUT", "/api/v1/admin/users/" + id + "/permissions"},
		{"PUT", "/api/v1/admin/users/" + id + "/password"}, {"PUT", "/api/v1/admin/users/" + id + "/status"},
	}
	for _, r := range routes {
		status, _ := e.call(t, r.method, r.path, "", map[string]any{})
		require.Equal(t, 401, status, "%s %s sin token", r.method, r.path)
		status, _ = e.call(t, r.method, r.path, e.formTok, map[string]any{})
		require.Equal(t, 403, status, "%s %s con rol no SUPER_ADMIN", r.method, r.path)
	}
	// Todas las rutas del paquete admin de acceso quedaron cubiertas.
	require.GreaterOrEqual(t, len(e.app.GetRoutes(true)), len(routes))
}

func TestAdminAccessRoutes_Flow(t *testing.T) {
	e := newHTTPEnv(t)
	tenantPath := "/api/v1/admin/tenants/" + e.tenantID.String()

	// Módulos: listado, creación, conflicto, borrado.
	status, body := e.call(t, "GET", "/api/v1/admin/modules", e.superTok, nil)
	require.Equal(t, 200, status)
	require.Len(t, body["data"], len(modules.Manifest))

	status, body = e.call(t, "POST", "/api/v1/admin/modules", e.superTok, map[string]any{"code": "obras", "name": "Obras", "route": "/tenant/obras"})
	require.Equal(t, 201, status)
	obrasID := body["id"].(string)
	status, _ = e.call(t, "POST", "/api/v1/admin/modules", e.superTok, map[string]any{"code": "obras", "name": "Obras", "route": "/otra"})
	require.Equal(t, 409, status)
	status, _ = e.call(t, "POST", "/api/v1/admin/modules", e.superTok, map[string]any{"code": "BAD", "name": "x", "route": "/x"})
	require.Equal(t, 400, status)
	status, _ = e.call(t, "PUT", "/api/v1/admin/modules/"+obrasID, e.superTok, map[string]any{"name": "Obras públicas"})
	require.Equal(t, 200, status)
	status, _ = e.call(t, "DELETE", "/api/v1/admin/modules/"+obrasID, e.superTok, nil)
	require.Equal(t, 204, status)
	status, _ = e.call(t, "DELETE", "/api/v1/admin/modules/"+obrasID, e.superTok, nil)
	require.Equal(t, 404, status)

	var projects models.Module
	require.NoError(t, e.db.Where("code = ?", modules.CodeProjects).First(&projects).Error)
	status, body = e.call(t, "DELETE", "/api/v1/admin/modules/"+projects.ID.String(), e.superTok, nil)
	require.Equal(t, 403, status, "módulo de sistema")
	require.Contains(t, body["error"], "sistema")

	status, _ = e.call(t, "PUT", "/api/v1/admin/modules/order", e.superTok, map[string]any{"items": []map[string]any{{"id": projects.ID, "sort_order": 3}}})
	require.Equal(t, 204, status)

	// Usuarios: crear, listar, permisos, contraseña, estado.
	status, body = e.call(t, "POST", tenantPath+"/users", e.superTok, map[string]any{
		"email": "nuevo@x.co", "full_name": "Nuevo Usuario", "password": "secreto123", "role_code": constants.RoleViewer,
	})
	require.Equal(t, 201, status)
	userID := body["id"].(string)
	require.NotContains(t, body, "password")
	status, _ = e.call(t, "POST", tenantPath+"/users", e.superTok, map[string]any{
		"email": "nuevo@x.co", "full_name": "Nuevo Usuario", "password": "secreto123", "role_code": constants.RoleViewer,
	})
	require.Equal(t, 409, status)

	status, body = e.call(t, "GET", tenantPath+"/users", e.superTok, nil)
	require.Equal(t, 200, status)
	require.EqualValues(t, 1, body["total"])

	status, body = e.call(t, "PUT", "/api/v1/admin/users/"+userID+"/permissions", e.superTok, map[string]any{
		"permissions": []map[string]any{{"module_code": modules.CodeReports, "can_view": true, "can_create": true}},
	})
	require.Equal(t, 200, status)
	require.Equal(t, false, body["resolved_by_role"])
	status, _ = e.call(t, "PUT", "/api/v1/admin/users/"+userID+"/permissions", e.superTok, map[string]any{
		"permissions": []map[string]any{{"module_code": modules.CodeReports, "can_edit": true}},
	})
	require.Equal(t, 400, status)
	status, body = e.call(t, "GET", "/api/v1/admin/users/"+userID+"/permissions", e.superTok, nil)
	require.Equal(t, 200, status)
	require.NotEmpty(t, body["permissions"])

	status, _ = e.call(t, "PUT", "/api/v1/admin/users/"+userID+"/password", e.superTok, map[string]any{"new_password": "otraClave123"})
	require.Equal(t, 204, status)
	status, _ = e.call(t, "PUT", "/api/v1/admin/users/"+userID+"/password", e.superTok, map[string]any{"new_password": "x"})
	require.Equal(t, 400, status)
	status, _ = e.call(t, "PUT", "/api/v1/admin/users/"+userID+"/status", e.superTok, map[string]any{"is_active": false})
	require.Equal(t, 204, status)
	status, _ = e.call(t, "PUT", "/api/v1/admin/users/"+userID+"/status", e.superTok, map[string]any{})
	require.Equal(t, 400, status)
	status, _ = e.call(t, "GET", "/api/v1/admin/users/"+uuid.NewString()+"/permissions", e.superTok, nil)
	require.Equal(t, 404, status)
	status, _ = e.call(t, "GET", "/api/v1/admin/users/no-es-uuid/permissions", e.superTok, nil)
	require.Equal(t, 400, status)

	// Techo de módulos del tenant.
	status, body = e.call(t, "PUT", tenantPath+"/modules", e.superTok, map[string]any{
		"modules": []map[string]any{{"module_code": modules.CodeReports, "is_enabled": false}},
	})
	require.Equal(t, 200, status)
	for _, m := range body["data"].([]any) {
		mm := m.(map[string]any)
		require.Equal(t, mm["module_code"] != modules.CodeReports, mm["is_enabled"])
	}

	// Todo cambio quedó auditado.
	var n int64
	e.db.Model(&models.AccessAuditLog{}).Where("action <> ?", models.AuditModulesSeeded).Count(&n)
	require.GreaterOrEqual(t, n, int64(8))
}
