package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"aurora-backend/internal/config"
)

type identity struct {
	userID   string
	role     string
	tenantID string
}

func validIdentity() identity {
	return identity{userID: uuid.NewString(), role: "SUPER_ADMIN", tenantID: uuid.NewString()}
}

func testChatCfg() *config.Config {
	return &config.Config{
		AnthropicModelFast:     "fast-model",
		AnthropicModelPowerful: "powerful-model",
		AnthropicModel:         "fast-model",
		GeminiModel:            "gemini-2.0-flash",
	}
}

// injectIdentity simula el middleware RequireAuth poblando Locals desde el JWT.
func injectIdentity(id identity) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if id.userID != "" {
			c.Locals(httpmw.LocalsUserID, id.userID)
		}
		if id.role != "" {
			c.Locals(httpmw.LocalsRole, id.role)
		}
		if id.tenantID != "" {
			c.Locals(httpmw.LocalsTenantID, id.tenantID)
		}
		return c.Next()
	}
}

func newTestApp() *fiber.App {
	return fiber.New(fiber.Config{DisableStartupMessage: true})
}

func doJSON(t *testing.T, app *fiber.App, method, path string, body any) *http.Response {
	t.Helper()

	var reader io.Reader
	if body != nil {
		switch v := body.(type) {
		case string:
			reader = bytes.NewBufferString(v)
		default:
			raw, err := json.Marshal(v)
			require.NoError(t, err)
			reader = bytes.NewReader(raw)
		}
	}

	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := app.Test(req, 5000)
	require.NoError(t, err)
	return resp
}

func decodeBody(t *testing.T, resp *http.Response, target any) {
	t.Helper()
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, target), "body: %s", string(raw))
}

func bodyString(t *testing.T, resp *http.Response) string {
	t.Helper()
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return string(raw)
}

// errorPayload estructura de error JSON estándar de la API.
type errorPayload struct {
	Error string `json:"error"`
}

func requireErrorJSON(t *testing.T, resp *http.Response, wantStatus int) errorPayload {
	t.Helper()
	require.Equal(t, wantStatus, resp.StatusCode)
	var payload errorPayload
	decodeBody(t, resp, &payload)
	require.NotEmpty(t, payload.Error, "se esperaba JSON estructurado con campo 'error'")
	return payload
}
