package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestDocumentTemplateHandler_Delete(t *testing.T) {
	db := newSQLiteDB(t)
	require.NoError(t, db.AutoMigrate(&models.DocumentTemplate{}))
	require.NoError(t, postgres.EnsureDocumentTemplatesSeed(db))

	repo := postgres.NewDocumentTemplateRepository(db)
	tenantA, tenantB := uuid.New(), uuid.New()
	own, err := repo.Create(t.Context(), tenantA, "Mía", "<p>x</p>", nil)
	require.NoError(t, err)
	list, err := repo.List(t.Context(), tenantA)
	require.NoError(t, err)
	var system models.DocumentTemplate
	for _, tpl := range list {
		if tpl.IsSystemDefault {
			system = tpl
			break
		}
	}
	require.NotEqual(t, uuid.Nil, system.ID)

	h := NewDocumentTemplateHandler(db)
	asTenant := func(tid uuid.UUID) *fiber.App {
		app := fiber.New()
		app.Delete("/templates/:id", func(c *fiber.Ctx) error {
			c.Locals(httpmw.LocalsUserID, uuid.NewString())
			c.Locals(httpmw.LocalsTenantID, tid.String())
			return h.Delete(c)
		})
		return app
	}
	del := func(app *fiber.App, id uuid.UUID) int {
		resp, err := app.Test(httptest.NewRequest(http.MethodDelete, "/templates/"+id.String(), nil))
		require.NoError(t, err)
		return resp.StatusCode
	}

	require.Equal(t, http.StatusForbidden, del(asTenant(tenantA), system.ID), "sistema no se elimina")
	require.Equal(t, http.StatusNotFound, del(asTenant(tenantB), own.ID), "otro tenant no ve la plantilla")
	require.Equal(t, http.StatusNoContent, del(asTenant(tenantA), own.ID))
	require.Equal(t, http.StatusNotFound, del(asTenant(tenantA), own.ID), "ya eliminada")

	var n int64
	require.NoError(t, db.Model(&models.DocumentTemplate{}).Where("id = ?", system.ID).Count(&n).Error)
	require.EqualValues(t, 1, n, "global intacta")
}
