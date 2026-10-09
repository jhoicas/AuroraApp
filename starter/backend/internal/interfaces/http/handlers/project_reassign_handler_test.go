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
	"gorm.io/gorm"
)

func newReassignDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := newSQLiteDB(t)
	for _, ddl := range []string{
		`CREATE TABLE projects (
			id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, creator_id TEXT NOT NULL, code_bpin TEXT,
			name TEXT NOT NULL, description TEXT, sector TEXT, sector_id TEXT, program_code TEXT,
			product_code TEXT, product_indicator_code TEXT, problem_description TEXT, general_objective TEXT,
			situacion_existente TEXT, magnitud_problema TEXT, proceso_id INTEGER, tipologia TEXT, tipo_inversion TEXT, fase_maduracion TEXT DEFAULT 'PERFIL',
			mga_formulation_data TEXT DEFAULT '{}', status TEXT NOT NULL DEFAULT 'DRAFT',
			created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME
		)`,
		`CREATE TABLE roles (id TEXT PRIMARY KEY, code TEXT NOT NULL)`,
		`CREATE TABLE users (
			id TEXT PRIMARY KEY, tenant_id TEXT, role_id TEXT NOT NULL, email TEXT, full_name TEXT,
			is_active BOOLEAN NOT NULL DEFAULT 1, deleted_at DATETIME
		)`,
		`CREATE TABLE access_audit_logs (
			id TEXT PRIMARY KEY, tenant_id TEXT, actor_user_id TEXT, target_user_id TEXT, module_id TEXT,
			action TEXT NOT NULL, details TEXT NOT NULL DEFAULT '{}', created_at DATETIME NOT NULL
		)`,
	} {
		require.NoError(t, db.Exec(ddl).Error)
	}
	return db
}

func seedUser(t *testing.T, db *gorm.DB, tenant, id uuid.UUID, roleID, name string, active bool) {
	t.Helper()
	require.NoError(t, db.Exec(
		`INSERT INTO users (id, tenant_id, role_id, email, full_name, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
		id.String(), tenant.String(), roleID, name+"@x.co", name, active).Error)
}

func TestProjectIsolationAndReassign(t *testing.T) {
	db := newReassignDB(t)
	tenant, otherTenant := uuid.New(), uuid.New()
	formA, formB, formInactive, formOther, admin := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()

	require.NoError(t, db.Exec(`INSERT INTO roles (id, code) VALUES ('r-f','FORMULADOR'), ('r-a','TENANT_ADMIN')`).Error)
	seedUser(t, db, tenant, formA, "r-f", "A", true)
	seedUser(t, db, tenant, formB, "r-f", "B", true)
	seedUser(t, db, tenant, formInactive, "r-f", "Inactivo", false)
	seedUser(t, db, otherTenant, formOther, "r-f", "Otro", true)
	seedUser(t, db, tenant, admin, "r-a", "Admin", true)

	now := time.Now().UTC()
	projectID := uuid.New()
	require.NoError(t, db.Create(&models.Project{
		ID: projectID, TenantID: tenant, CreatorID: formA, Name: "Proyecto de A",
		Status: "IN_FORMULATION", CreatedAt: now, UpdatedAt: now,
	}).Error)

	ph := NewProjectHandler(db)
	appFor := func(userID uuid.UUID, role string) func(method, path string, body any) int {
		app := newTestApp()
		app.Use(injectIdentity(identity{userID: userID.String(), role: role, tenantID: tenant.String()}))
		app.Use("/projects/:id", httpmw.ProjectOwnerGuard(db))
		app.Get("/projects", ph.List)
		app.Get("/projects/:id", ph.GetByID)
		app.Patch("/projects/:id/reassign", ph.Reassign)
		app.Get("/projects/:id/reassign-candidates", ph.ReassignCandidates)
		return func(method, path string, body any) int {
			return doJSON(t, app, method, path, body).StatusCode
		}
	}
	listCount := func(userID uuid.UUID, role string) int {
		app := newTestApp()
		app.Use(injectIdentity(identity{userID: userID.String(), role: role, tenantID: tenant.String()}))
		app.Get("/projects", ph.List)
		resp := doJSON(t, app, http.MethodGet, "/projects", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var out struct {
			Data []map[string]any `json:"data"`
		}
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
		return len(out.Data)
	}

	path := "/projects/" + projectID.String()

	t.Run("formulador B no lista ni lee el proyecto de A", func(t *testing.T) {
		require.Equal(t, 0, listCount(formB, "FORMULADOR"))
		require.Equal(t, http.StatusNotFound, appFor(formB, "FORMULADOR")(http.MethodGet, path, nil))
		require.Equal(t, http.StatusNotFound, appFor(formB, "FORMULADOR")(http.MethodGet, "/projects/"+uuid.NewString(), nil))
	})

	t.Run("formulador A sí ve su proyecto; admin ve todos", func(t *testing.T) {
		require.Equal(t, 1, listCount(formA, "FORMULADOR"))
		require.Equal(t, http.StatusOK, appFor(formA, "FORMULADOR")(http.MethodGet, path, nil))
		require.Equal(t, 1, listCount(admin, "TENANT_ADMIN"))
	})

	t.Run("formulador no puede reasignar", func(t *testing.T) {
		// El guard de dueño lo deja pasar a A; el bloqueo por rol vive en el router (RequireRole).
		app := newTestApp()
		app.Use(injectIdentity(identity{userID: formA.String(), role: "FORMULADOR", tenantID: tenant.String()}))
		app.Patch("/projects/:id/reassign", httpmw.RequireRole("TENANT_ADMIN", "SUPER_ADMIN"), ph.Reassign)
		resp := doJSON(t, app, http.MethodPatch, path+"/reassign", map[string]any{"created_by": formB.String()})
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	adminCall := appFor(admin, "TENANT_ADMIN")

	t.Run("destinos inválidos se rechazan", func(t *testing.T) {
		require.Equal(t, http.StatusUnprocessableEntity, adminCall(http.MethodPatch, path+"/reassign", map[string]any{"created_by": formOther.String()}))
		require.Equal(t, http.StatusUnprocessableEntity, adminCall(http.MethodPatch, path+"/reassign", map[string]any{"created_by": formInactive.String()}))
		require.Equal(t, http.StatusBadRequest, adminCall(http.MethodPatch, path+"/reassign", map[string]any{"created_by": "x"}))
	})

	t.Run("candidatos: solo formuladores activos del tenant", func(t *testing.T) {
		app := newTestApp()
		app.Use(injectIdentity(identity{userID: admin.String(), role: "TENANT_ADMIN", tenantID: tenant.String()}))
		app.Get("/projects/:id/reassign-candidates", ph.ReassignCandidates)
		resp := doJSON(t, app, http.MethodGet, path+"/reassign-candidates", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var out struct {
			Data []reassignCandidate `json:"data"`
		}
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
		require.Len(t, out.Data, 2)
	})

	t.Run("admin reasigna A -> B: B gana acceso, A lo pierde, queda auditoría", func(t *testing.T) {
		require.Equal(t, http.StatusOK, adminCall(http.MethodPatch, path+"/reassign", map[string]any{"created_by": formB.String()}))

		require.Equal(t, http.StatusOK, appFor(formB, "FORMULADOR")(http.MethodGet, path, nil))
		require.Equal(t, 1, listCount(formB, "FORMULADOR"))
		require.Equal(t, http.StatusNotFound, appFor(formA, "FORMULADOR")(http.MethodGet, path, nil))
		require.Equal(t, 0, listCount(formA, "FORMULADOR"))

		var logs []models.AccessAuditLog
		require.NoError(t, db.Where("action = ?", models.AuditProjectReassigned).Find(&logs).Error)
		require.Len(t, logs, 1)
		var d map[string]string
		require.NoError(t, json.Unmarshal([]byte(logs[0].Details), &d))
		require.Equal(t, formA.String(), d["previous_user_id"])
		require.Equal(t, formB.String(), d["new_user_id"])
		require.Equal(t, admin, *logs[0].ActorUserID)
	})
}
