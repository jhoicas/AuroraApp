package router

import (
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"aurora-backend/internal/application/access"
	"aurora-backend/internal/config"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/modules"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type denyAll struct{}

func (denyAll) ValidateSession(context.Context, uuid.UUID, int) error { return nil }
func (denyAll) Can(context.Context, uuid.UUID, string, modules.Action) (access.Decision, error) {
	return access.Decision{Allowed: false, Reason: access.ReasonNoPermission}, nil
}

// Rutas que no pasan por PBAC a propósito (auth pública, SUPER_ADMIN por rol, telemetría).
var pbacExempt = []string{
	"/healthz",
	"/api/v1/auth/",
	"/api/v1/admin/",
	"/api/v1/ai/telemetry/",
	"/api/v1/ai/knowledge/ingest",
	"/api/v1/ai/audit/",
}

// TestEveryBusinessRouteRequiresPermission falla si se registra una ruta de negocio
// sin guard.Require: con un guard que deniega todo en modo enforce, toda ruta no
// exenta debe responder el 403 PERMISSION_DENIED de PBAC.
func TestEveryBusinessRouteRequiresPermission(t *testing.T) {
	const secret = "test-secret"
	guard := httpmw.NewAccessGuard(denyAll{}, httpmw.EnforceOn)

	app := fiber.New()
	RegisterAdminTenantRoutes(app, nil, secret)
	RegisterAdminLocationRoutes(app, nil, secret, guard)
	RegisterProjectRoutes(app, nil, secret, guard)
	RegisterAIRoutes(app, nil, &config.Config{JWTSecret: secret}, guard)
	RegisterCatalogRoutes(app, nil, secret, guard)
	RegisterMgaCatalogRoutes(app, nil, secret, guard)

	tenant := uuid.NewString()
	claims := httpmw.Claims{
		UserID: uuid.NewString(), Role: constants.RoleFormulador, TenantID: &tenant, TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	require.NoError(t, err)

	param := regexp.MustCompile(`:[A-Za-z]+`)
	checked := 0
	for _, r := range app.GetRoutes(true) {
		if r.Method == "HEAD" || r.Method == "OPTIONS" || r.Method == "CONNECT" || r.Method == "TRACE" {
			continue
		}
		exempt := false
		for _, p := range pbacExempt {
			if strings.HasPrefix(r.Path, p) {
				exempt = true
			}
		}
		if exempt {
			continue
		}

		path := param.ReplaceAllString(r.Path, "1")
		req := httptest.NewRequest(r.Method, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := app.Test(req, -1)
		require.NoError(t, err, "%s %s", r.Method, r.Path)
		raw, _ := io.ReadAll(resp.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)

		require.Equal(t, 403, resp.StatusCode, "%s %s no está protegida por PBAC: %s", r.Method, r.Path, raw)
		require.Equal(t, httpmw.CodePermissionDenied, body["code"], "%s %s", r.Method, r.Path)
		require.NotEmpty(t, body["module"], "%s %s", r.Method, r.Path)
		checked++
	}
	require.Greater(t, checked, 90, "se esperaba cubrir las ~98 rutas de negocio")
}
