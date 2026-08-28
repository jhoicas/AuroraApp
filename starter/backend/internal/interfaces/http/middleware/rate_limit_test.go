package middleware_test

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func readJSON(t *testing.T, resp *http.Response) map[string]string {
	t.Helper()
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	var generic map[string]any
	require.NoError(t, json.Unmarshal(raw, &generic), "body: %s", string(raw))

	out := make(map[string]string, len(generic))
	for k, v := range generic {
		if v == nil {
			out[k] = ""
			continue
		}
		out[k] = fmt.Sprintf("%v", v)
	}
	return out
}

func rateLimitedApp(perMinute string, userID string) *fiber.App {
	limit := 0
	_, _ = fmt.Sscanf(perMinute, "%d", &limit)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/limited",
		func(c *fiber.Ctx) error {
			if userID != "" {
				c.Locals(httpmw.LocalsUserID, userID)
			}
			return c.Next()
		},
		httpmw.RateLimitPerUser(limit),
		func(c *fiber.Ctx) error { return c.SendString("ok") },
	)
	return app
}

func hit(t *testing.T, app *fiber.App) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/limited", nil)
	resp, err := app.Test(req, 5000)
	require.NoError(t, err)
	return resp
}

func TestRateLimitPerUser_AllowsUpToBurst(t *testing.T) {
	app := rateLimitedApp("3", uuid.NewString())

	for i := 1; i <= 3; i++ {
		resp := hit(t, app)
		assert.Equal(t, http.StatusOK, resp.StatusCode, "petición %d debería permitirse", i)
		_ = resp.Body.Close()
	}
}

func TestRateLimitPerUser_BlocksAfterBurst(t *testing.T) {
	app := rateLimitedApp("2", uuid.NewString())

	for i := 0; i < 2; i++ {
		resp := hit(t, app)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		_ = resp.Body.Close()
	}

	resp := hit(t, app)
	require.Equal(t, http.StatusTooManyRequests, resp.StatusCode)

	body := readJSON(t, resp)
	assert.Contains(t, body["error"], "rate limit exceeded")
	assert.Contains(t, body["error"], "max 2 requests per minute", "el mensaje debe reflejar el límite real")
}

func TestRateLimitPerUser_DefaultWhenInvalid(t *testing.T) {
	// perMinute < 1 debe caer al default de 10.
	app := rateLimitedApp("0", uuid.NewString())

	for i := 0; i < 10; i++ {
		resp := hit(t, app)
		require.Equal(t, http.StatusOK, resp.StatusCode, "petición %d", i+1)
		_ = resp.Body.Close()
	}

	resp := hit(t, app)
	require.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
	body := readJSON(t, resp)
	assert.Contains(t, body["error"], "max 10 requests per minute")
}

func TestRateLimitPerUser_IsolatedPerUser(t *testing.T) {
	userA, userB := uuid.NewString(), uuid.NewString()
	current := userA

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/limited",
		func(c *fiber.Ctx) error {
			c.Locals(httpmw.LocalsUserID, current)
			return c.Next()
		},
		httpmw.RateLimitPerUser(1),
		func(c *fiber.Ctx) error { return c.SendString("ok") },
	)

	resp := hit(t, app)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	resp = hit(t, app)
	require.Equal(t, http.StatusTooManyRequests, resp.StatusCode, "userA ya agotó su cuota")
	_ = resp.Body.Close()

	current = userB
	resp = hit(t, app)
	assert.Equal(t, http.StatusOK, resp.StatusCode, "userB debe tener su propio limitador")
	_ = resp.Body.Close()
}

func TestRateLimitPerUser_FallsBackToIP(t *testing.T) {
	// Sin user_id en Locals el limitador usa la IP como clave.
	app := rateLimitedApp("1", "")

	resp := hit(t, app)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	resp = hit(t, app)
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
	_ = resp.Body.Close()
}
