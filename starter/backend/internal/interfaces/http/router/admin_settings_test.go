package router

import (
	"net/http/httptest"
	"testing"
	"time"

	"aurora-backend/internal/domain/constants"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func signTestToken(t *testing.T, secret, role string) string {
	t.Helper()
	tenant := uuid.NewString()
	claims := httpmw.Claims{
		UserID: uuid.NewString(), Role: role, TenantID: &tenant, TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	require.NoError(t, err)
	return tok
}

// GET y PUT /admin/settings: 403 para todo rol distinto de SUPER_ADMIN (el servicio nunca se alcanza).
func TestAdminSettingsForbiddenForNonSuperAdmin(t *testing.T) {
	const secret = "test-secret"
	app := fiber.New()
	RegisterSystemSettingsRoutes(app, nil, secret)

	roles := []string{
		constants.RoleTenantAdmin, constants.RoleFormulador, constants.RoleEvaluador,
		constants.RoleViewer,
	}
	for _, role := range roles {
		for _, method := range []string{"GET", "PUT"} {
			req := httptest.NewRequest(method, "/api/v1/admin/settings", nil)
			req.Header.Set("Authorization", "Bearer "+signTestToken(t, secret, role))
			resp, err := app.Test(req, -1)
			require.NoError(t, err)
			require.Equal(t, 403, resp.StatusCode, "%s %s", method, role)
		}
	}

	for _, method := range []string{"GET", "PUT"} {
		resp, err := app.Test(httptest.NewRequest(method, "/api/v1/admin/settings", nil), -1)
		require.NoError(t, err)
		require.Equal(t, 401, resp.StatusCode)
	}
}

func TestMaintenanceGuard(t *testing.T) {
	const secret = "test-secret"
	app := fiber.New()
	active := true
	app.Use(httpmw.MaintenanceGuard(secret, func(*fiber.Ctx) bool { return active }))
	ok := func(c *fiber.Ctx) error { return c.SendStatus(200) }
	app.Get("/api/v1/projects", ok)
	app.Get("/api/v1/system/status", ok)
	app.Post("/api/v1/auth/login", ok)
	app.Get("/healthz", ok)

	do := func(method, path, role string) int {
		req := httptest.NewRequest(method, path, nil)
		if role != "" {
			req.Header.Set("Authorization", "Bearer "+signTestToken(t, secret, role))
		}
		resp, err := app.Test(req, -1)
		require.NoError(t, err)
		return resp.StatusCode
	}

	require.Equal(t, 503, do("GET", "/api/v1/projects", constants.RoleFormulador))
	require.Equal(t, 503, do("GET", "/api/v1/projects", constants.RoleTenantAdmin))
	require.Equal(t, 503, do("GET", "/api/v1/projects", ""))
	require.Equal(t, 200, do("GET", "/api/v1/projects", constants.RoleSuperAdmin))
	require.Equal(t, 200, do("GET", "/api/v1/system/status", ""))
	require.Equal(t, 200, do("POST", "/api/v1/auth/login", ""))
	require.Equal(t, 200, do("GET", "/healthz", ""))

	active = false
	require.Equal(t, 200, do("GET", "/api/v1/projects", constants.RoleFormulador))
}
