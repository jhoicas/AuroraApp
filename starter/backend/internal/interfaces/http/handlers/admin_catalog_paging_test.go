package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"aurora-backend/internal/domain/models"
)

func pagingDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:paging_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	for _, ddl := range []string{
		`CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
		`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, full_name TEXT NOT NULL)`,
		`CREATE TABLE projects (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, creator_id TEXT NOT NULL, code_bpin TEXT, name TEXT NOT NULL,
			sector TEXT, proceso_id INTEGER, tipologia TEXT, tipo_inversion TEXT, fase_maduracion TEXT, status TEXT NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME)`,
	} {
		require.NoError(t, db.Exec(ddl).Error)
	}
	return db
}

func getJSON(t *testing.T, app *fiber.App, path string) (int, map[string]any) {
	t.Helper()
	resp, err := app.Test(httptest.NewRequest("GET", path, nil), -1)
	require.NoError(t, err)
	raw, _ := io.ReadAll(resp.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return resp.StatusCode, out
}

func TestAdminProjectHandler_FiltersAndPagination(t *testing.T) {
	db := pagingDB(t)
	tA, tB := uuid.New(), uuid.New()
	uA, uB := uuid.New(), uuid.New()
	require.NoError(t, db.Exec(`INSERT INTO tenants VALUES (?, 'Alcaldía A'), (?, 'Gobernación B')`, tA, tB).Error)
	require.NoError(t, db.Exec(`INSERT INTO users VALUES (?, 'ana@a.co', 'Ana'), (?, 'beto@b.co', 'Beto')`, uA, uB).Error)
	base := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
	ins := func(i int, tenant, user uuid.UUID, at time.Time, deleted bool) {
		var del any
		if deleted {
			del = at
		}
		require.NoError(t, db.Exec(`INSERT INTO projects (id, tenant_id, creator_id, name, status, fase_maduracion, created_at, updated_at, deleted_at)
			VALUES (?, ?, ?, ?, 'DRAFT', 'PERFIL', ?, ?, ?)`, uuid.New(), tenant, user, fmt.Sprintf("P%d", i), at, at, del).Error)
	}
	for i := 0; i < 5; i++ {
		ins(i, tA, uA, base.AddDate(0, 0, i), false) // 1..5 mar
	}
	ins(10, tB, uB, base.AddDate(0, 0, 2), false)
	ins(11, tB, uB, base, true) // borrado: no aparece

	app := fiber.New()
	app.Get("/p", NewAdminProjectHandler(db).List)

	status, body := getJSON(t, app, "/p")
	require.Equal(t, 200, status)
	require.EqualValues(t, 6, body["total"])

	status, body = getJSON(t, app, "/p?limit=2&page=3")
	require.Equal(t, 200, status)
	require.Len(t, body["data"], 2)
	require.EqualValues(t, 3, body["page"])

	status, body = getJSON(t, app, "/p?tenant_id="+tB.String())
	require.Equal(t, 200, status)
	require.EqualValues(t, 1, body["total"])
	row := body["data"].([]any)[0].(map[string]any)
	require.Equal(t, "Gobernación B", row["tenant_name"])
	require.Equal(t, "beto@b.co", row["creator_email"])

	status, body = getJSON(t, app, "/p?created_by="+uA.String())
	require.Equal(t, 200, status)
	require.EqualValues(t, 5, body["total"])
	status, body = getJSON(t, app, "/p?created_by=BETO@")
	require.Equal(t, 200, status)
	require.EqualValues(t, 1, body["total"])

	// end_date inclusivo: 2026-03-02 incluye el proyecto creado a las 12:00 de ese día.
	status, body = getJSON(t, app, "/p?tenant_id="+tA.String()+"&start_date=2026-03-02&end_date=2026-03-03")
	require.Equal(t, 200, status)
	require.EqualValues(t, 2, body["total"])

	for _, q := range []string{"tenant_id=x", "start_date=ayer", "end_date=mañana", "start_date=2026-03-05&end_date=2026-03-01"} {
		status, _ = getJSON(t, app, "/p?"+q)
		require.Equal(t, 400, status, q)
	}
}

func TestParticipantCatalogHandler_ListEntitiesPaging(t *testing.T) {
	db := pagingDB(t)
	require.NoError(t, db.AutoMigrate(&models.MgaCatalogActor{}, &models.MgaCatalogEntity{}))
	now := time.Now().UTC()
	require.NoError(t, db.Create(&models.MgaCatalogActor{ID: 1, Name: "A1", CreatedAt: now, UpdatedAt: now}).Error)
	require.NoError(t, db.Create(&models.MgaCatalogActor{ID: 2, Name: "A2", CreatedAt: now, UpdatedAt: now}).Error)
	for i := 1; i <= 25; i++ {
		actor := 1
		if i > 20 {
			actor = 2
		}
		require.NoError(t, db.Create(&models.MgaCatalogEntity{ID: i, ActorID: actor, Name: fmt.Sprintf("Entidad %d Ministerio", i), CreatedAt: now, UpdatedAt: now}).Error)
	}
	app := fiber.New()
	app.Get("/e", NewParticipantCatalogHandler(db).ListEntities)

	status, body := getJSON(t, app, "/e?page=2&limit=10")
	require.Equal(t, 200, status)
	require.EqualValues(t, 25, body["total"])
	require.Len(t, body["data"], 10)

	status, body = getJSON(t, app, "/e?actor_id=2")
	require.Equal(t, 200, status)
	require.EqualValues(t, 5, body["total"])

	status, body = getJSON(t, app, "/e?search=entidad%207")
	require.Equal(t, 200, status)
	require.EqualValues(t, 1, body["total"])
	status, body = getJSON(t, app, "/e?q=24")
	require.Equal(t, 200, status)
	require.EqualValues(t, 1, body["total"], "id=24 y nombre 'Entidad 24' son la misma fila")
	status, body = getJSON(t, app, "/e?q=zzz")
	require.Equal(t, 200, status)
	require.EqualValues(t, 0, body["total"])
	require.NotNil(t, body["data"])
}
