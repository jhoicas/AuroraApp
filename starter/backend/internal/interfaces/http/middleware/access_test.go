package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http/httptest"
	"os"
	"testing"

	"aurora-backend/internal/application/access"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/modules"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type fakeChecker struct {
	sessionErr error
	decision   access.Decision
	canErr     error
	calls      int
	gotTV      int
}

func (f *fakeChecker) ValidateSession(_ context.Context, _ uuid.UUID, tv int) error {
	f.calls++
	f.gotTV = tv
	return f.sessionErr
}

func (f *fakeChecker) Can(context.Context, uuid.UUID, string, modules.Action) (access.Decision, error) {
	f.calls++
	return f.decision, f.canErr
}

func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })
	return &buf
}

func permApp(checker AccessChecker, mode EnforceMode) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(LocalsUserID, uuid.NewString())
		c.Locals(LocalsRole, constants.RoleViewer)
		c.Locals(LocalsTokenVersion, 3)
		return c.Next()
	})
	app.Post("/p", RequirePermission(checker, mode, modules.CodeProjects, modules.ActionCreate), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})
	return app
}

func do(t *testing.T, app *fiber.App) (int, map[string]any) {
	t.Helper()
	resp, err := app.Test(httptest.NewRequest("POST", "/p", nil))
	require.NoError(t, err)
	raw, _ := io.ReadAll(resp.Body)
	var body map[string]any
	_ = json.Unmarshal(raw, &body)
	return resp.StatusCode, body
}

func TestParseEnforceMode(t *testing.T) {
	cases := map[string]EnforceMode{"": EnforceLog, "log": EnforceLog, "LOG": EnforceLog, "enforce": EnforceOn, " Enforce ": EnforceOn, "off": EnforceOff, "basura": EnforceLog}
	for in, want := range cases {
		require.Equal(t, want, ParseEnforceMode(in), "entrada %q", in)
	}
}

func TestRequirePermission_Enforce(t *testing.T) {
	deny := &fakeChecker{decision: access.Decision{Allowed: false, Reason: access.ReasonNoPermission}}
	status, body := do(t, permApp(deny, EnforceOn))
	require.Equal(t, 403, status)
	require.Equal(t, "forbidden", body["error"])
	require.Equal(t, CodePermissionDenied, body["code"])
	require.Equal(t, "projects", body["module"])
	require.Equal(t, "create", body["action"])
	require.Equal(t, access.ReasonNoPermission, body["reason"])
	require.Equal(t, 3, deny.gotTV, "el token_version del JWT llega al servicio")

	allow := &fakeChecker{decision: access.Decision{Allowed: true}}
	status, _ = do(t, permApp(allow, EnforceOn))
	require.Equal(t, 200, status)
}

func TestRequirePermission_LogModeDoesNotBlockButLogs(t *testing.T) {
	buf := captureLog(t)
	deny := &fakeChecker{decision: access.Decision{Allowed: false, Reason: access.ReasonNoPermission}}

	status, _ := do(t, permApp(deny, EnforceLog))
	require.Equal(t, 200, status, "dry-run no bloquea")
	require.Contains(t, buf.String(), "[PBAC] dry-run")
	require.Contains(t, buf.String(), "module=projects")
	require.Contains(t, buf.String(), "action=create")
	require.Contains(t, buf.String(), "POST /p")
}

func TestRequirePermission_LogModeSilentWhenAllowed(t *testing.T) {
	buf := captureLog(t)
	status, _ := do(t, permApp(&fakeChecker{decision: access.Decision{Allowed: true}}, EnforceLog))
	require.Equal(t, 200, status)
	require.NotContains(t, buf.String(), "dry-run")
}

func TestRequirePermission_OffSkipsEverything(t *testing.T) {
	c := &fakeChecker{decision: access.Decision{Allowed: false}}
	status, _ := do(t, permApp(c, EnforceOff))
	require.Equal(t, 200, status)
	require.Zero(t, c.calls)
}

func TestRequirePermission_RevokedSession(t *testing.T) {
	buf := captureLog(t)
	c := &fakeChecker{sessionErr: access.ErrSessionRevoked}

	status, body := do(t, permApp(c, EnforceOn))
	require.Equal(t, 401, status)
	require.Equal(t, CodeSessionRevoked, body["code"])

	status, _ = do(t, permApp(c, EnforceLog))
	require.Equal(t, 200, status)
	require.Contains(t, buf.String(), "sesión revocada")
}

func TestRequirePermission_ServiceErrors(t *testing.T) {
	captureLog(t)
	c := &fakeChecker{canErr: errors.New("db caída")}

	status, body := do(t, permApp(c, EnforceOn))
	require.Equal(t, 503, status, "enforce falla cerrado")
	require.Equal(t, CodeAccessUnavail, body["code"])

	status, _ = do(t, permApp(c, EnforceLog))
	require.Equal(t, 200, status, "dry-run no rompe peticiones por un fallo del servicio")
}

func TestRequirePermission_MissingIdentity(t *testing.T) {
	captureLog(t)
	app := fiber.New()
	app.Post("/p", RequirePermission(&fakeChecker{}, EnforceOn, modules.CodeProjects, modules.ActionView), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})
	resp, err := app.Test(httptest.NewRequest("POST", "/p", nil))
	require.NoError(t, err)
	require.Equal(t, 401, resp.StatusCode)
}

func TestAccessGuard_Require(t *testing.T) {
	g := NewAccessGuard(&fakeChecker{decision: access.Decision{Allowed: false}}, EnforceOn)
	require.Equal(t, EnforceOn, g.Mode())
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(LocalsUserID, uuid.NewString())
		return c.Next()
	})
	app.Get("/x", g.Require(modules.CodeReports, modules.ActionView), func(c *fiber.Ctx) error { return c.SendString("ok") })
	resp, err := app.Test(httptest.NewRequest("GET", "/x", nil))
	require.NoError(t, err)
	require.Equal(t, 403, resp.StatusCode)
}

// ── TenantTargetGuard ───────────────────────────────────────────────────────

func guardApp(role string, actorTenant *uuid.UUID, resolve TenantResolver) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(LocalsUserID, uuid.NewString())
		c.Locals(LocalsRole, role)
		if actorTenant != nil {
			c.Locals(LocalsTenantID, actorTenant.String())
		}
		return c.Next()
	})
	app.Get("/users/:id", TenantTargetGuard(resolve), func(c *fiber.Ctx) error { return c.SendString("ok") })
	return app
}

func status(t *testing.T, app *fiber.App) int {
	t.Helper()
	resp, err := app.Test(httptest.NewRequest("GET", "/users/"+uuid.NewString(), nil))
	require.NoError(t, err)
	return resp.StatusCode
}

func TestTenantTargetGuard(t *testing.T) {
	captureLog(t)
	mine, other := uuid.New(), uuid.New()
	target := func(id *uuid.UUID, err error) TenantResolver {
		return func(*fiber.Ctx) (*uuid.UUID, error) { return id, err }
	}

	require.Equal(t, 200, status(t, guardApp(constants.RoleTenantAdmin, &mine, target(&mine, nil))), "mismo tenant")
	require.Equal(t, 404, status(t, guardApp(constants.RoleTenantAdmin, &mine, target(&other, nil))), "otro tenant: 404, no filtra existencia")
	require.Equal(t, 404, status(t, guardApp(constants.RoleTenantAdmin, &mine, target(nil, ErrTargetNotFound))), "inexistente")
	require.Equal(t, 404, status(t, guardApp(constants.RoleTenantAdmin, &mine, target(nil, nil))), "objetivo global (SUPER_ADMIN) no accesible")
	require.Equal(t, 403, status(t, guardApp(constants.RoleTenantAdmin, nil, target(&mine, nil))), "actor sin tenant")
	require.Equal(t, 500, status(t, guardApp(constants.RoleTenantAdmin, &mine, target(nil, errors.New("boom")))))

	// SUPER_ADMIN pasa siempre, sin resolver siquiera.
	called := false
	sa := guardApp(constants.RoleSuperAdmin, nil, func(*fiber.Ctx) (*uuid.UUID, error) { called = true; return &other, nil })
	require.Equal(t, 200, status(t, sa))
	require.False(t, called)
}

func TestTenantParamResolver(t *testing.T) {
	mine, other := uuid.New(), uuid.New()
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(LocalsRole, constants.RoleTenantAdmin)
		c.Locals(LocalsTenantID, mine.String())
		return c.Next()
	})
	app.Get("/tenants/:tenantId", TenantTargetGuard(TenantParamResolver("tenantId")), func(c *fiber.Ctx) error { return c.SendString("ok") })

	get := func(id string) int {
		resp, err := app.Test(httptest.NewRequest("GET", "/tenants/"+id, nil))
		require.NoError(t, err)
		return resp.StatusCode
	}
	captureLog(t)
	require.Equal(t, 200, get(mine.String()))
	require.Equal(t, 404, get(other.String()))
	require.Equal(t, 404, get("no-es-uuid"))
}

// ── RequireProjectPatchPermission ───────────────────────────────────────────

type moduleChecker struct {
	allowed map[string]bool // módulo → permitido
	asked   []string
}

func (m *moduleChecker) ValidateSession(context.Context, uuid.UUID, int) error { return nil }
func (m *moduleChecker) Can(_ context.Context, _ uuid.UUID, code string, _ modules.Action) (access.Decision, error) {
	m.asked = append(m.asked, code)
	return access.Decision{Allowed: m.allowed[code], Reason: access.ReasonNoPermission}, nil
}

func patchApp(checker AccessChecker, mode EnforceMode, snap *ProjectSnapshot, loadErr error) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(LocalsUserID, uuid.NewString())
		c.Locals(LocalsRole, constants.RoleEvaluador)
		return c.Next()
	})
	load := func(*fiber.Ctx, uuid.UUID) (*ProjectSnapshot, error) { return snap, loadErr }
	g := NewAccessGuard(checker, mode)
	app.Patch("/projects/:id", g.RequireProjectPatchPermission(load), func(c *fiber.Ctx) error { return c.SendString("ok") })
	return app
}

func doPatch(t *testing.T, app *fiber.App, id, body string) int {
	t.Helper()
	req := httptest.NewRequest("PATCH", "/projects/"+id, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	return resp.StatusCode
}

func TestRequireProjectPatchPermission(t *testing.T) {
	captureLog(t)
	snap := &ProjectSnapshot{
		Scalars:            map[string]string{"name": "Proyecto", "problem_description": "P"},
		MgaFormulationData: map[string]any{"riesgos": map[string]any{"a": 1.0}, "evaluacion": map[string]any{"v": 1.0}},
	}
	id := uuid.NewString()
	// Evaluador: solo puede editar la etapa de evaluación.
	evaluador := func() *moduleChecker {
		return &moduleChecker{allowed: map[string]bool{modules.CodeMGAEvaluacion: true}}
	}

	// Snapshot completo donde solo cambia "evaluacion": permitido y solo se consulta esa etapa.
	c := evaluador()
	body := `{"name":"Proyecto","mga_formulation_data":{"riesgos":{"a":1},"evaluacion":{"v":2},"effects":[]}}`
	require.Equal(t, 200, doPatch(t, patchApp(c, EnforceOn, snap, nil), id, body))
	require.Equal(t, []string{modules.CodeMGAEvaluacion}, c.asked)

	// Cambia una clave de preparación: 403 en enforce.
	c = evaluador()
	body = `{"mga_formulation_data":{"riesgos":{"a":2}}}`
	require.Equal(t, 403, doPatch(t, patchApp(c, EnforceOn, snap, nil), id, body))
	require.Equal(t, []string{modules.CodeMGAPreparacion}, c.asked)

	// Cambia una columna escalar de identificación: 403.
	require.Equal(t, 403, doPatch(t, patchApp(evaluador(), EnforceOn, snap, nil), id, `{"problem_description":"otro"}`))
	// Cambia el nombre: exige projects.
	c = evaluador()
	require.Equal(t, 403, doPatch(t, patchApp(c, EnforceOn, snap, nil), id, `{"name":"Nuevo"}`))
	require.Equal(t, []string{modules.CodeProjects}, c.asked)

	// Sin cambios reales: no se consulta nada y pasa.
	c = evaluador()
	require.Equal(t, 200, doPatch(t, patchApp(c, EnforceOn, snap, nil), id, `{"name":"Proyecto","mga_formulation_data":{"riesgos":{"a":1}}}`))
	require.Empty(t, c.asked)

	// Clave desconocida: exige el módulo padre mga.
	c = evaluador()
	require.Equal(t, 403, doPatch(t, patchApp(c, EnforceOn, snap, nil), id, `{"mga_formulation_data":{"nuevo":{"x":1}}}`))
	require.Equal(t, []string{modules.CodeMGA}, c.asked)

	// completedSections por pestaña.
	c = evaluador()
	require.Equal(t, 200, doPatch(t, patchApp(c, EnforceOn, snap, nil), id, `{"mga_formulation_data":{"completedSections":{"evaluacion":true}}}`))
	require.Equal(t, 403, doPatch(t, patchApp(evaluador(), EnforceOn, snap, nil), id, `{"mga_formulation_data":{"completedSections":{"riesgos":true}}}`))
}

func TestRequireProjectPatchPermission_ModesAndEdgeCases(t *testing.T) {
	buf := captureLog(t)
	snap := &ProjectSnapshot{Scalars: map[string]string{}, MgaFormulationData: map[string]any{}}
	id := uuid.NewString()
	deny := func() *moduleChecker { return &moduleChecker{allowed: map[string]bool{}} }
	body := `{"mga_formulation_data":{"riesgos":{"a":1}}}`

	// dry-run: no bloquea pero registra.
	require.Equal(t, 200, doPatch(t, patchApp(deny(), EnforceLog, snap, nil), id, body))
	require.Contains(t, buf.String(), "[PBAC] dry-run")
	require.Contains(t, buf.String(), "module="+modules.CodeMGAPreparacion)

	// off: no consulta.
	c := deny()
	require.Equal(t, 200, doPatch(t, patchApp(c, EnforceOff, snap, nil), id, body))
	require.Empty(t, c.asked)

	// id inválido o cuerpo inválido: lo resuelve el handler (400).
	require.Equal(t, 200, doPatch(t, patchApp(deny(), EnforceOn, snap, nil), "no-uuid", body))
	require.Equal(t, 200, doPatch(t, patchApp(deny(), EnforceOn, snap, nil), id, `{no es json`))
	// proyecto inexistente: lo resuelve el handler (404).
	require.Equal(t, 200, doPatch(t, patchApp(deny(), EnforceOn, nil, ErrTargetNotFound), id, body))
	// error del loader: enforce falla cerrado.
	require.Equal(t, 503, doPatch(t, patchApp(deny(), EnforceOn, nil, errors.New("db")), id, body))
	require.Equal(t, 200, doPatch(t, patchApp(deny(), EnforceLog, nil, errors.New("db")), id, body))
}
