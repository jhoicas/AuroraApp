package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http/httptest"
	"testing"

	"aurora-backend/internal/application/access"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type fakeResolver struct {
	sessionErr error
	resolved   *access.ResolvedAccess
	resolveErr error
	gotTV      int
}

func (f *fakeResolver) ValidateSession(_ context.Context, _ uuid.UUID, tv int) error {
	f.gotTV = tv
	return f.sessionErr
}

func (f *fakeResolver) Resolve(context.Context, uuid.UUID) (*access.ResolvedAccess, error) {
	return f.resolved, f.resolveErr
}

func meApp(r AccessResolver, withIdentity bool) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		if withIdentity {
			c.Locals(httpmw.LocalsUserID, uuid.NewString())
			c.Locals(httpmw.LocalsTokenVersion, 2)
		}
		return c.Next()
	})
	app.Get("/me/access", NewAccessHandler(r).Me)
	return app
}

func getMe(t *testing.T, app *fiber.App) (int, map[string]any) {
	t.Helper()
	resp, err := app.Test(httptest.NewRequest("GET", "/me/access", nil))
	require.NoError(t, err)
	raw, _ := io.ReadAll(resp.Body)
	var body map[string]any
	_ = json.Unmarshal(raw, &body)
	return resp.StatusCode, body
}

func TestAccessHandler_Me_ReturnsResolvedTree(t *testing.T) {
	r := &fakeResolver{resolved: &access.ResolvedAccess{
		UserID: "u1", Role: "FORMULADOR", Modules: []access.ResolvedModule{{
			Code: "mga", Name: "Formulación MGA", Enabled: true,
			Permissions: access.Permissions{View: true, Edit: true},
			Children:    []access.ResolvedModule{{Code: "mga.identificacion", Enabled: true}},
		}},
	}}
	status, body := getMe(t, meApp(r, true))
	require.Equal(t, 200, status)
	require.Equal(t, "FORMULADOR", body["role"])
	mods := body["modules"].([]any)
	require.Len(t, mods, 1)
	mga := mods[0].(map[string]any)
	require.Equal(t, "mga", mga["code"])
	require.Equal(t, true, mga["permissions"].(map[string]any)["edit"])
	require.Len(t, mga["children"].([]any), 1)
	require.Equal(t, 2, r.gotTV, "el token_version del JWT se valida")
}

func TestAccessHandler_Me_Errors(t *testing.T) {
	status, body := getMe(t, meApp(&fakeResolver{sessionErr: access.ErrSessionRevoked}, true))
	require.Equal(t, 401, status)
	require.Equal(t, httpmw.CodeSessionRevoked, body["code"])

	status, _ = getMe(t, meApp(&fakeResolver{resolveErr: access.ErrUserNotFound}, true))
	require.Equal(t, 401, status)

	status, _ = getMe(t, meApp(&fakeResolver{sessionErr: errors.New("db")}, true))
	require.Equal(t, 500, status)

	status, _ = getMe(t, meApp(&fakeResolver{}, false))
	require.Equal(t, 401, status)
}
