package router

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"aurora-backend/internal/domain/constants"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// Toda escritura sobre /projects/:id/** de un SUPER_ADMIN debe responder 403 SUPER_ADMIN_READ_ONLY
// (salvo la reasignación). Falla si se registra una ruta de escritura fuera del guard de lectura.
func TestSuperAdminCannotWriteAnyProjectRoute(t *testing.T) {
	const secret = "ro-secret"
	app := fiber.New()
	RegisterProjectRoutes(app, nil, secret, httpmw.NewAccessGuard(denyAll{}, httpmw.EnforceOn))

	claims := httpmw.Claims{
		UserID: uuid.NewString(), Role: constants.RoleSuperAdmin, TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	require.NoError(t, err)

	param := regexp.MustCompile(`:[A-Za-z]+`)
	id := uuid.NewString()
	checked := 0
	for _, r := range app.GetRoutes(true) {
		if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" || r.Method == "CONNECT" || r.Method == "TRACE" {
			continue
		}
		if !strings.HasPrefix(r.Path, "/api/v1/projects/:id") || strings.HasSuffix(r.Path, "/reassign") {
			continue
		}
		path := param.ReplaceAllStringFunc(r.Path, func(p string) string {
			if p == ":id" {
				return id
			}
			return uuid.NewString()
		})
		req := httptest.NewRequest(r.Method, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := app.Test(req, -1)
		require.NoError(t, err, "%s %s", r.Method, r.Path)
		raw, _ := io.ReadAll(resp.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)
		require.Equal(t, 403, resp.StatusCode, "%s %s: %s", r.Method, r.Path, raw)
		require.Equal(t, httpmw.CodeSuperAdminReadOnly, body["code"], "%s %s", r.Method, r.Path)
		checked++
	}
	require.Greater(t, checked, 30, "se esperaba cubrir las ~45 rutas de escritura de proyecto")
}
