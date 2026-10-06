package middleware

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"aurora-backend/internal/domain/constants"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type scopeEnv struct {
	db                       *gorm.DB
	tenant, otherTenant      uuid.UUID
	creator, otherFormulador uuid.UUID
	admin, superAdmin        uuid.UUID
	projectID                uuid.UUID
}

func newScopeEnv(t *testing.T) *scopeEnv {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:pscope_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.Exec(`CREATE TABLE projects (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, creator_id TEXT NOT NULL, name TEXT, deleted_at DATETIME)`).Error)

	e := &scopeEnv{
		db: db, tenant: uuid.New(), otherTenant: uuid.New(),
		creator: uuid.New(), otherFormulador: uuid.New(), admin: uuid.New(), superAdmin: uuid.New(), projectID: uuid.New(),
	}
	require.NoError(t, db.Exec(`INSERT INTO projects (id, tenant_id, creator_id, name) VALUES (?, ?, ?, 'P')`,
		e.projectID.String(), e.tenant.String(), e.creator.String()).Error)
	return e
}

// app monta la misma cadena que el router de proyectos: SuperAdminProjectScope → ProjectOwnerGuard.
func (e *scopeEnv) app(userID uuid.UUID, role string, tenant *uuid.UUID) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(LocalsUserID, userID.String())
		c.Locals(LocalsRole, role)
		if tenant != nil {
			c.Locals(LocalsTenantID, tenant.String())
		}
		return c.Next()
	})
	app.Use("/projects/:id", SuperAdminProjectScope(e.db), ProjectOwnerGuard(e.db))
	echo := func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true, "tenant_id": c.Locals(LocalsTenantID)})
	}
	app.All("/projects/:id", echo)
	app.All("/projects/:id/*", echo)
	app.Get("/projects", echo)
	return app
}

func (e *scopeEnv) do(t *testing.T, app *fiber.App, method, path string) (int, map[string]any) {
	t.Helper()
	resp, err := app.Test(httptest.NewRequest(method, path, nil))
	require.NoError(t, err)
	raw, _ := io.ReadAll(resp.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return resp.StatusCode, out
}

func TestSuperAdminProjectScope_ReadsAnyProjectWithItsTenant(t *testing.T) {
	e := newScopeEnv(t)
	app := e.app(e.superAdmin, constants.RoleSuperAdmin, nil) // SUPER_ADMIN no tiene tenant

	for _, path := range []string{
		"/projects/" + e.projectID.String(),
		"/projects/" + e.projectID.String() + "/mga/formulation",
		"/projects/" + e.projectID.String() + "/budget",
	} {
		status, body := e.do(t, app, "GET", path)
		require.Equal(t, 200, status, path)
		// Los handlers de consulta reciben el tenant del proyecto, sin filtro por creator_id.
		require.Equal(t, e.tenant.String(), body["tenant_id"], path)
	}

	status, _ := e.do(t, app, "GET", "/projects/"+uuid.NewString())
	require.Equal(t, 404, status, "proyecto inexistente")
	status, _ = e.do(t, app, "GET", "/projects") // colección: no es :id
	require.Equal(t, 200, status)
}

func TestSuperAdminProjectScope_WritesAreForbidden(t *testing.T) {
	e := newScopeEnv(t)
	app := e.app(e.superAdmin, constants.RoleSuperAdmin, nil)
	base := "/projects/" + e.projectID.String()

	for _, tc := range []struct{ method, path string }{
		{"PATCH", base},
		{"PATCH", base + "/details"},
		{"POST", base + "/budget"},
		{"PUT", base + "/mga/causes/x"},
		{"DELETE", base + "/mga/causes/x"},
		{"POST", base + "/evaluate"},
		{"PATCH", base + "/reassign-candidates"},
	} {
		status, body := e.do(t, app, tc.method, tc.path)
		require.Equal(t, 403, status, "%s %s", tc.method, tc.path)
		require.Equal(t, CodeSuperAdminReadOnly, body["code"], "%s %s", tc.method, tc.path)
	}

	// Única escritura permitida: la reasignación administrativa.
	status, _ := e.do(t, app, "PATCH", base+"/reassign")
	require.Equal(t, 200, status)
	status, _ = e.do(t, app, "PATCH", base+"/reassign/")
	require.Equal(t, 200, status)
	status, _ = e.do(t, app, "POST", base+"/reassign")
	require.Equal(t, 403, status, "solo PATCH")
}

// Un usuario que no es el formulador asignado no puede modificar el proyecto (404, igual que si no existiera).
func TestProjectOwnerGuard_OnlyAssignedFormuladorCanWrite(t *testing.T) {
	e := newScopeEnv(t)
	base := "/projects/" + e.projectID.String()

	owner := e.app(e.creator, constants.RoleFormulador, &e.tenant)
	other := e.app(e.otherFormulador, constants.RoleFormulador, &e.tenant)
	outsider := e.app(e.creator, constants.RoleFormulador, &e.otherTenant) // mismo user id, otro tenant

	for _, method := range []string{"PATCH", "POST", "PUT", "DELETE"} {
		status, _ := e.do(t, owner, method, base)
		require.Equal(t, 200, status, "el formulador asignado sí puede (%s)", method)
		status, _ = e.do(t, other, method, base)
		require.Equal(t, 404, status, "otro formulador no puede (%s)", method)
		status, _ = e.do(t, outsider, method, base)
		require.Equal(t, 404, status, "otro tenant no puede (%s)", method)
	}
	status, _ := e.do(t, other, "GET", base+"/mga/formulation")
	require.Equal(t, 404, status, "tampoco lee subrecursos ajenos")

	// El SUPER_ADMIN lee pero no escribe aunque el guard de formulador no lo detenga.
	super := e.app(e.superAdmin, constants.RoleSuperAdmin, nil)
	status, _ = e.do(t, super, "PATCH", base)
	require.Equal(t, 403, status)
}

func TestSuperAdminProjectScope_IgnoresOtherRoles(t *testing.T) {
	e := newScopeEnv(t)
	admin := e.app(e.admin, constants.RoleTenantAdmin, &e.tenant)
	status, body := e.do(t, admin, "PATCH", "/projects/"+e.projectID.String())
	require.Equal(t, 200, status)
	require.Equal(t, e.tenant.String(), body["tenant_id"], "el tenant del actor no se altera")
}
