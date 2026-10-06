package handlers

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"aurora-backend/internal/domain/models"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// SUPER_ADMIN (sin tenant) consulta cualquier proyecto con los handlers reales pero no puede
// modificarlo; solo el formulador asignado escribe.
func TestSuperAdminReadsButCannotWriteProjects(t *testing.T) {
	db := newReassignDB(t)
	tenant := uuid.New()
	formulador, other, admin, super := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	require.NoError(t, db.Exec(`INSERT INTO roles (id, code) VALUES ('r-f','FORMULADOR'), ('r-a','TENANT_ADMIN')`).Error)
	seedUser(t, db, tenant, formulador, "r-f", "F", true)
	seedUser(t, db, tenant, other, "r-f", "O", true)
	seedUser(t, db, tenant, admin, "r-a", "A", true)

	now := time.Now().UTC()
	projectID := uuid.New()
	require.NoError(t, db.Create(&models.Project{
		ID: projectID, TenantID: tenant, CreatorID: formulador, Name: "Acueducto rural",
		ProblemDescription: "Problema original", Status: "IN_FORMULATION", CreatedAt: now, UpdatedAt: now,
	}).Error)

	ph := NewProjectHandler(db)
	app := func(userID uuid.UUID, role string, tenantID string) func(method, path string, body any) *http.Response {
		a := newTestApp()
		a.Use(injectIdentity(identity{userID: userID.String(), role: role, tenantID: tenantID}))
		a.Use("/projects/:id", httpmw.SuperAdminProjectScope(db), httpmw.ProjectOwnerGuard(db))
		a.Get("/projects/:id", ph.GetByID)
		a.Patch("/projects/:id", ph.Patch)
		a.Patch("/projects/:id/details", ph.UpdateDetails)
		a.Patch("/projects/:id/reassign", httpmw.RequireRole("TENANT_ADMIN", "SUPER_ADMIN"), ph.Reassign)
		return func(method, path string, body any) *http.Response { return doJSON(t, a, method, path, body) }
	}
	path := "/projects/" + projectID.String()
	patchBody := map[string]any{"problem_description": "Modificado por alguien que no debe"}

	storedProblem := func() string {
		var p models.Project
		require.NoError(t, db.First(&p, "id = ?", projectID).Error)
		return p.ProblemDescription
	}

	t.Run("SUPER_ADMIN sin tenant lee el proyecto completo (GET /projects/:id)", func(t *testing.T) {
		resp := app(super, "SUPER_ADMIN", "")(http.MethodGet, path, nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var got map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
		require.Equal(t, "Acueducto rural", got["name"])
		require.Equal(t, tenant.String(), got["tenant_id"])
		require.Equal(t, formulador.String(), got["creator_id"], "no se filtra por creator_id")
	})

	t.Run("SUPER_ADMIN no puede modificar (PATCH ni details)", func(t *testing.T) {
		call := app(super, "SUPER_ADMIN", "")
		require.Equal(t, http.StatusForbidden, call(http.MethodPatch, path, patchBody).StatusCode)
		require.Equal(t, http.StatusForbidden, call(http.MethodPatch, path+"/details", map[string]any{"problem_description": "x"}).StatusCode)
		require.Equal(t, "Problema original", storedProblem())
	})

	t.Run("otro formulador no puede ni leer ni modificar (404)", func(t *testing.T) {
		call := app(other, "FORMULADOR", tenant.String())
		require.Equal(t, http.StatusNotFound, call(http.MethodGet, path, nil).StatusCode)
		require.Equal(t, http.StatusNotFound, call(http.MethodPatch, path, patchBody).StatusCode)
		require.Equal(t, "Problema original", storedProblem())
	})

	t.Run("el formulador asignado sí modifica", func(t *testing.T) {
		resp := app(formulador, "FORMULADOR", tenant.String())(http.MethodPatch, path, patchBody)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Equal(t, "Modificado por alguien que no debe", storedProblem())
	})

	t.Run("SUPER_ADMIN conserva la reasignación administrativa", func(t *testing.T) {
		resp := app(super, "SUPER_ADMIN", "")(http.MethodPatch, path+"/reassign", map[string]any{"created_by": other.String()})
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("proyecto inexistente: 404 para SUPER_ADMIN", func(t *testing.T) {
		resp := app(super, "SUPER_ADMIN", "")(http.MethodGet, "/projects/"+uuid.NewString(), nil)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}
