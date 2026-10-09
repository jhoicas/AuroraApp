package handlers

import (
	"net/http"
	"testing"
	"time"

	"aurora-backend/internal/domain/models"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestProjectDelete(t *testing.T) {
	db := newReassignDB(t)
	tenant, otherTenant := uuid.New(), uuid.New()
	owner, other, admin, viewer, foreignAdmin := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	now := time.Now().UTC()

	newProject := func(name string) uuid.UUID {
		id := uuid.New()
		require.NoError(t, db.Create(&models.Project{
			ID: id, TenantID: tenant, CreatorID: owner, Name: name,
			Status: "IN_FORMULATION", CreatedAt: now, UpdatedAt: now,
		}).Error)
		return id
	}
	isDeleted := func(id uuid.UUID) bool {
		var n int64
		require.NoError(t, db.Unscoped().Model(&models.Project{}).
			Where("id = ? AND deleted_at IS NOT NULL", id).Count(&n).Error)
		return n == 1
	}

	ph := NewProjectHandler(db)
	call := func(userID, tenantID uuid.UUID, role string, projectID uuid.UUID) int {
		app := newTestApp()
		app.Use(injectIdentity(identity{userID: userID.String(), role: role, tenantID: tenantID.String()}))
		app.Use("/projects/:id", httpmw.ProjectOwnerGuard(db))
		app.Delete("/projects/:id", ph.Delete)
		return doJSON(t, app, http.MethodDelete, "/projects/"+projectID.String(), nil).StatusCode
	}

	t.Run("formulador creador elimina (borrado lógico + auditoría)", func(t *testing.T) {
		id := newProject("propio")
		require.Equal(t, http.StatusNoContent, call(owner, tenant, "FORMULADOR", id))
		require.True(t, isDeleted(id))

		var n int64
		require.NoError(t, db.Model(&models.Project{}).Where("id = ?", id).Count(&n).Error)
		require.Zero(t, n, "el proyecto ya no aparece en consultas normales")

		var logs []models.AccessAuditLog
		require.NoError(t, db.Where("action = ?", models.AuditProjectDeleted).Find(&logs).Error)
		require.Len(t, logs, 1)
		require.Equal(t, owner, *logs[0].ActorUserID)
	})

	t.Run("tenant admin elimina proyecto de otro formulador", func(t *testing.T) {
		id := newProject("ajeno")
		require.Equal(t, http.StatusNoContent, call(admin, tenant, "TENANT_ADMIN", id))
		require.True(t, isDeleted(id))
	})

	t.Run("formulador que no es creador recibe 403", func(t *testing.T) {
		id := newProject("de otro")
		require.Equal(t, http.StatusForbidden, call(other, tenant, "FORMULADOR", id))
		require.False(t, isDeleted(id))
	})

	t.Run("viewer y otros roles reciben 403", func(t *testing.T) {
		id := newProject("protegido")
		for _, role := range []string{"VIEWER", "EVALUADOR", "SUPER_ADMIN"} {
			require.Equal(t, http.StatusForbidden, call(viewer, tenant, role, id), role)
		}
		require.False(t, isDeleted(id))
	})

	t.Run("admin de otro tenant no encuentra el proyecto", func(t *testing.T) {
		id := newProject("aislado")
		require.Equal(t, http.StatusNotFound, call(foreignAdmin, otherTenant, "TENANT_ADMIN", id))
		require.False(t, isDeleted(id))
	})

	t.Run("id inválido responde 400", func(t *testing.T) {
		app := newTestApp()
		app.Use(injectIdentity(identity{userID: admin.String(), role: "TENANT_ADMIN", tenantID: tenant.String()}))
		app.Delete("/projects/:id", ph.Delete)
		require.Equal(t, http.StatusBadRequest, doJSON(t, app, http.MethodDelete, "/projects/xx", nil).StatusCode)
	})
}
