package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testSecret = "super-secret-key-for-tests"

type tokenOpts struct {
	userID    string
	role      string
	tenantID  *string
	tokenType string
	expiresAt *time.Time
	secret    string
	method    jwt.SigningMethod
}

func signToken(t *testing.T, o tokenOpts) string {
	t.Helper()

	if o.secret == "" {
		o.secret = testSecret
	}
	if o.method == nil {
		o.method = jwt.SigningMethodHS256
	}

	claims := httpmw.Claims{
		UserID:    o.userID,
		Role:      o.role,
		TenantID:  o.tenantID,
		TokenType: o.tokenType,
	}
	if o.expiresAt != nil {
		claims.ExpiresAt = jwt.NewNumericDate(*o.expiresAt)
	}

	token := jwt.NewWithClaims(o.method, claims)
	signed, err := token.SignedString([]byte(o.secret))
	require.NoError(t, err)
	return signed
}

func protectedApp() *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/protected", httpmw.RequireAuth(testSecret), func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"user_id":   c.Locals(httpmw.LocalsUserID),
			"role":      c.Locals(httpmw.LocalsRole),
			"tenant_id": c.Locals(httpmw.LocalsTenantID),
		})
	})
	return app
}

func callProtected(t *testing.T, app *fiber.App, authHeader string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	resp, err := app.Test(req, 5000)
	require.NoError(t, err)
	return resp
}

func TestRequireAuth_Success(t *testing.T) {
	tenant := uuid.NewString()
	userID := uuid.NewString()
	future := time.Now().Add(time.Hour)

	token := signToken(t, tokenOpts{
		userID:    userID,
		role:      "super_admin", // en minúsculas: debe normalizarse
		tenantID:  &tenant,
		tokenType: "access",
		expiresAt: &future,
	})

	resp := callProtected(t, protectedApp(), "Bearer "+token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body := readJSON(t, resp)
	assert.Equal(t, userID, body["user_id"])
	assert.Equal(t, "SUPER_ADMIN", body["role"], "el rol debe normalizarse a mayúsculas")
	assert.Equal(t, tenant, body["tenant_id"])
}

func TestRequireAuth_RejectionTable(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	future := time.Now().Add(time.Hour)
	validTenant := uuid.NewString()
	badTenant := "no-es-uuid"

	tests := []struct {
		name        string
		header      func(t *testing.T) string
		wantErrPart string
	}{
		{
			name:        "sin header Authorization",
			header:      func(*testing.T) string { return "" },
			wantErrPart: "missing or invalid authorization header",
		},
		{
			name:        "esquema incorrecto (Basic)",
			header:      func(*testing.T) string { return "Basic abc123" },
			wantErrPart: "missing or invalid authorization header",
		},
		{
			name:        "Bearer sin token",
			header:      func(*testing.T) string { return "Bearer " },
			wantErrPart: "missing or invalid authorization header",
		},
		{
			name:        "token basura",
			header:      func(*testing.T) string { return "Bearer no.es.un.jwt" },
			wantErrPart: "invalid or expired token",
		},
		{
			name: "firmado con secreto distinto",
			header: func(t *testing.T) string {
				return "Bearer " + signToken(t, tokenOpts{
					userID: uuid.NewString(), role: "TENANT", secret: "otro-secreto", expiresAt: &future,
				})
			},
			wantErrPart: "invalid or expired token",
		},
		{
			name: "refresh token usado como access",
			header: func(t *testing.T) string {
				return "Bearer " + signToken(t, tokenOpts{
					userID: uuid.NewString(), role: "TENANT", tokenType: "refresh", expiresAt: &future,
				})
			},
			wantErrPart: "refresh token cannot be used",
		},
		{
			name: "user_id no es UUID",
			header: func(t *testing.T) string {
				return "Bearer " + signToken(t, tokenOpts{
					userID: "12345", role: "TENANT", expiresAt: &future,
				})
			},
			wantErrPart: "invalid token claims",
		},
		{
			name: "rol vacío",
			header: func(t *testing.T) string {
				return "Bearer " + signToken(t, tokenOpts{
					userID: uuid.NewString(), role: "   ", expiresAt: &future,
				})
			},
			wantErrPart: "invalid token role",
		},
		{
			name: "tenant_id inválido",
			header: func(t *testing.T) string {
				return "Bearer " + signToken(t, tokenOpts{
					userID: uuid.NewString(), role: "TENANT", tenantID: &badTenant, expiresAt: &future,
				})
			},
			wantErrPart: "invalid tenant in token",
		},
		{
			name: "token expirado",
			header: func(t *testing.T) string {
				return "Bearer " + signToken(t, tokenOpts{
					userID: uuid.NewString(), role: "TENANT", tenantID: &validTenant, expiresAt: &past,
				})
			},
			wantErrPart: "invalid or expired token",
		},
	}

	app := protectedApp()
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			resp := callProtected(t, app, tt.header(t))
			require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
			body := readJSON(t, resp)
			assert.Contains(t, body["error"], tt.wantErrPart)
		})
	}
}

func TestRequireAuth_RejectsOversizedToken(t *testing.T) {
	// Requiere un buffer de lectura grande para que fasthttp acepte el header.
	app := fiber.New(fiber.Config{DisableStartupMessage: true, ReadBufferSize: 32768})
	app.Get("/protected", httpmw.RequireAuth(testSecret), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	long := make([]byte, 8300)
	for i := range long {
		long[i] = 'a'
	}

	resp := callProtected(t, app, "Bearer "+string(long))
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	assert.Contains(t, readJSON(t, resp)["error"], "invalid token format")
}

func TestRequireAuth_RejectsNonHMACSigningMethod(t *testing.T) {
	// Defensa contra "alg: none" y algoritmos asimétricos no esperados.
	claims := httpmw.Claims{UserID: uuid.NewString(), Role: "SUPER_ADMIN"}
	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	signed, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(t, err)

	resp := callProtected(t, protectedApp(), "Bearer "+signed)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	assert.Contains(t, readJSON(t, resp)["error"], "invalid or expired token")
}

func TestRequireAuth_TokenWithoutExpiryIsAccepted(t *testing.T) {
	token := signToken(t, tokenOpts{userID: uuid.NewString(), role: "TENANT"})
	resp := callProtected(t, protectedApp(), "Bearer "+token)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestRequireAuth_EmptyTenantStringIsAllowed(t *testing.T) {
	empty := "   "
	token := signToken(t, tokenOpts{userID: uuid.NewString(), role: "SUPER_ADMIN", tenantID: &empty})
	resp := callProtected(t, protectedApp(), "Bearer "+token)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestRequireRole(t *testing.T) {
	newApp := func(role string, allowed ...string) *fiber.App {
		app := fiber.New(fiber.Config{DisableStartupMessage: true})
		app.Get("/admin",
			func(c *fiber.Ctx) error {
				if role != "" {
					c.Locals(httpmw.LocalsRole, role)
				}
				return c.Next()
			},
			httpmw.RequireRole(allowed...),
			func(c *fiber.Ctx) error { return c.SendString("ok") },
		)
		return app
	}

	tests := []struct {
		name       string
		role       string
		allowed    []string
		wantStatus int
		wantErr    string
	}{
		{name: "rol permitido", role: "SUPER_ADMIN", allowed: []string{"SUPER_ADMIN"}, wantStatus: http.StatusOK},
		{name: "rol permitido case-insensitive", role: "super_admin", allowed: []string{"SUPER_ADMIN"}, wantStatus: http.StatusOK},
		{name: "rol en lista múltiple", role: "TENANT_ADMIN", allowed: []string{"SUPER_ADMIN", "TENANT_ADMIN"}, wantStatus: http.StatusOK},
		{name: "sin rol en contexto", role: "", allowed: []string{"SUPER_ADMIN"}, wantStatus: http.StatusForbidden, wantErr: "forbidden"},
		{name: "rol insuficiente", role: "TENANT", allowed: []string{"SUPER_ADMIN"}, wantStatus: http.StatusForbidden, wantErr: "insufficient role"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			app := newApp(tt.role, tt.allowed...)
			req := httptest.NewRequest(http.MethodGet, "/admin", nil)
			resp, err := app.Test(req, 5000)
			require.NoError(t, err)
			require.Equal(t, tt.wantStatus, resp.StatusCode)
			if tt.wantErr != "" {
				body := readJSON(t, resp)
				assert.Contains(t, body["error"], tt.wantErr)
			}
		})
	}
}

func TestRequireTenant(t *testing.T) {
	newApp := func(tenant, role string) *fiber.App {
		app := fiber.New(fiber.Config{DisableStartupMessage: true})
		app.Get("/t",
			func(c *fiber.Ctx) error {
				if tenant != "" {
					c.Locals(httpmw.LocalsTenantID, tenant)
				}
				if role != "" {
					c.Locals(httpmw.LocalsRole, role)
				}
				return c.Next()
			},
			httpmw.RequireTenant(),
			func(c *fiber.Ctx) error { return c.SendString("ok") },
		)
		return app
	}

	tests := []struct {
		name       string
		tenant     string
		role       string
		wantStatus int
	}{
		{name: "tenant válido", tenant: uuid.NewString(), wantStatus: http.StatusOK},
		{name: "sin tenant", tenant: "", wantStatus: http.StatusForbidden},
		{name: "tenant malformado", tenant: "abc", wantStatus: http.StatusForbidden},
		{name: "SUPER_ADMIN global sin tenant", role: "SUPER_ADMIN", wantStatus: http.StatusOK},
		{name: "SUPER_ADMIN case-insensitive", role: "super_admin", wantStatus: http.StatusOK},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/t", nil)
			resp, err := newApp(tt.tenant, tt.role).Test(req, 5000)
			require.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
		})
	}
}

func TestIdentityFromContext(t *testing.T) {
	userID, tenantID := uuid.New(), uuid.New()

	tests := []struct {
		name        string
		user        string
		tenant      string
		wantErr     bool
		errContains string
	}{
		{name: "identidad completa", user: userID.String(), tenant: tenantID.String()},
		{name: "user inválido", user: "abc", tenant: tenantID.String(), wantErr: true, errContains: "user identity"},
		{name: "tenant inválido", user: userID.String(), tenant: "abc", wantErr: true, errContains: "tenant identity"},
		{name: "ambos vacíos", wantErr: true, errContains: "user identity"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			app := fiber.New(fiber.Config{DisableStartupMessage: true})
			app.Get("/id", func(c *fiber.Ctx) error {
				if tt.user != "" {
					c.Locals(httpmw.LocalsUserID, tt.user)
				}
				if tt.tenant != "" {
					c.Locals(httpmw.LocalsTenantID, tt.tenant)
				}
				u, tid, err := httpmw.IdentityFromContext(c)
				if err != nil {
					return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
				}
				return c.JSON(fiber.Map{"user_id": u.String(), "tenant_id": tid.String()})
			})

			req := httptest.NewRequest(http.MethodGet, "/id", nil)
			resp, err := app.Test(req, 5000)
			require.NoError(t, err)

			body := readJSON(t, resp)
			if tt.wantErr {
				require.Equal(t, http.StatusForbidden, resp.StatusCode)
				assert.Contains(t, body["error"], tt.errContains)
				return
			}
			require.Equal(t, http.StatusOK, resp.StatusCode)
			assert.Equal(t, userID.String(), body["user_id"])
			assert.Equal(t, tenantID.String(), body["tenant_id"])
		})
	}
}

func TestParseRefreshClaims(t *testing.T) {
	future := time.Now().Add(24 * time.Hour)
	userID := uuid.NewString()

	t.Run("refresh válido", func(t *testing.T) {
		token := signToken(t, tokenOpts{userID: userID, role: "TENANT", tokenType: "refresh", expiresAt: &future})
		claims, err := httpmw.ParseRefreshClaims(testSecret, token)
		require.NoError(t, err)
		assert.Equal(t, userID, claims.UserID)
		assert.Equal(t, "refresh", claims.TokenType)
	})

	t.Run("access token rechazado", func(t *testing.T) {
		token := signToken(t, tokenOpts{userID: userID, role: "TENANT", tokenType: "access", expiresAt: &future})
		_, err := httpmw.ParseRefreshClaims(testSecret, token)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not a refresh token")
	})

	t.Run("secreto incorrecto", func(t *testing.T) {
		token := signToken(t, tokenOpts{userID: userID, role: "TENANT", tokenType: "refresh", secret: "otro", expiresAt: &future})
		_, err := httpmw.ParseRefreshClaims(testSecret, token)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid refresh token")
	})

	t.Run("token expirado", func(t *testing.T) {
		past := time.Now().Add(-time.Hour)
		token := signToken(t, tokenOpts{userID: userID, role: "TENANT", tokenType: "refresh", expiresAt: &past})
		_, err := httpmw.ParseRefreshClaims(testSecret, token)
		require.Error(t, err)
	})

	t.Run("cadena vacía", func(t *testing.T) {
		_, err := httpmw.ParseRefreshClaims(testSecret, "")
		require.Error(t, err)
	})
}
