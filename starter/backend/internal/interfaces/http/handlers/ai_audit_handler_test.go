package handlers

import (
	"net/http"
	"testing"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newAuditApp(usage *mockUsageStore, chat *mockChatStore) *fiber.App {
	if usage == nil {
		usage = &mockUsageStore{}
	}
	if chat == nil {
		chat = &mockChatStore{}
	}
	h := NewAIAuditHandlerWithDeps(usage, chat)

	app := newTestApp()
	app.Get("/audit/usage", injectIdentity(validIdentity()), h.ListUsageLogs)
	app.Get("/audit/chat", injectIdentity(validIdentity()), h.ListChatMessages)
	return app
}

func TestListUsageLogs(t *testing.T) {
	t.Run("éxito con paginación y sanitización XSS", func(t *testing.T) {
		usage := &mockUsageStore{
			rows: []postgres.AiUsageLogAuditRow{
				{
					ID:        uuid.New(),
					UserID:    uuid.New(),
					Role:      "SUPER_ADMIN",
					Action:    `<script>alert("xss")</script>`,
					UserEmail: "admin@aurora.test",
					CreatedAt: time.Now().UTC(),
				},
			},
			total: 45,
		}
		app := newAuditApp(usage, nil)

		resp := doJSON(t, app, http.MethodGet, "/audit/usage?page=2&page_size=20", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body dto.PaginatedAuditResponse[dto.AuditUsageLogItem]
		decodeBody(t, resp, &body)

		require.Len(t, body.Data, 1)
		assert.Equal(t, 2, body.Page)
		assert.Equal(t, 20, body.PageSize)
		assert.Equal(t, int64(45), body.Total)
		assert.Equal(t, 3, body.TotalPages)

		assert.NotContains(t, body.Data[0].Action, "<script>", "el contenido debe sanitizarse (XSS)")
		assert.Contains(t, body.Data[0].Action, "&lt;script&gt;")
		assert.Equal(t, "Sistema", body.Data[0].TenantName)
		assert.Equal(t, "admin@aurora.test", body.Data[0].UserEmail)
		assert.Equal(t, 2, usage.lastPage)
		assert.Equal(t, 20, usage.lastSize)
	})

	t.Run("normaliza parámetros inválidos", func(t *testing.T) {
		tests := []struct {
			query    string
			wantPage int
			wantSize int
		}{
			{"?page=0&page_size=0", 1, 20},
			{"?page=-5&page_size=999", 1, 20},
			{"?page=abc&page_size=xyz", 1, 20},
			{"?page=3&page_size=50", 3, 50},
			{"", 1, 20},
		}
		for _, tt := range tests {
			usage := &mockUsageStore{}
			app := newAuditApp(usage, nil)
			resp := doJSON(t, app, http.MethodGet, "/audit/usage"+tt.query, nil)
			require.Equal(t, http.StatusOK, resp.StatusCode)
			assert.Equal(t, tt.wantPage, usage.lastPage, "query=%s", tt.query)
			assert.Equal(t, tt.wantSize, usage.lastSize, "query=%s", tt.query)
		}
	})

	t.Run("sin registros → total_pages mínimo 1", func(t *testing.T) {
		app := newAuditApp(&mockUsageStore{total: 0}, nil)
		resp := doJSON(t, app, http.MethodGet, "/audit/usage", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body dto.PaginatedAuditResponse[dto.AuditUsageLogItem]
		decodeBody(t, resp, &body)
		assert.Equal(t, 1, body.TotalPages)
		assert.Empty(t, body.Data)
	})

	t.Run("fallo de BD → 500", func(t *testing.T) {
		app := newAuditApp(&mockUsageStore{err: errSimulatedDB}, nil)
		resp := doJSON(t, app, http.MethodGet, "/audit/usage", nil)
		payload := requireErrorJSON(t, resp, http.StatusInternalServerError)
		assert.Contains(t, payload.Error, "query failed")
	})
}

func TestListChatMessages(t *testing.T) {
	t.Run("éxito sanitiza contenido y ruta", func(t *testing.T) {
		chat := &mockChatStore{
			messages: []models.AiChatMessage{
				{
					ID:           uuid.New(),
					UserID:       uuid.New(),
					Role:         models.ChatRoleAssistant,
					Content:      `<img src=x onerror="alert(1)">respuesta`,
					Model:        "claude-haiku-4-5-20251001",
					RouteContext: "/admin/catalogs/ods",
					CreatedAt:    time.Now().UTC(),
				},
			},
			total: 10,
		}
		app := newAuditApp(nil, chat)

		resp := doJSON(t, app, http.MethodGet, "/audit/chat?page=1&page_size=10", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body dto.PaginatedAuditResponse[dto.AuditChatMessageItem]
		decodeBody(t, resp, &body)

		require.Len(t, body.Data, 1)
		assert.NotContains(t, body.Data[0].Content, "<img")
		assert.Contains(t, body.Data[0].Content, "&lt;img")
		assert.Equal(t, "claude-haiku-4-5-20251001", body.Data[0].Model)
		assert.Equal(t, 1, body.TotalPages)
	})

	t.Run("fallo de BD → 500", func(t *testing.T) {
		app := newAuditApp(nil, &mockChatStore{listErr: errSimulatedDB})
		resp := doJSON(t, app, http.MethodGet, "/audit/chat", nil)
		payload := requireErrorJSON(t, resp, http.StatusInternalServerError)
		assert.Contains(t, payload.Error, "query failed")
	})

	t.Run("total cero → total_pages 1", func(t *testing.T) {
		app := newAuditApp(nil, &mockChatStore{total: 0})
		resp := doJSON(t, app, http.MethodGet, "/audit/chat", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body dto.PaginatedAuditResponse[dto.AuditChatMessageItem]
		decodeBody(t, resp, &body)
		assert.Equal(t, 1, body.TotalPages)
	})
}

func TestSanitizeText(t *testing.T) {
	tests := []struct{ in, want string }{
		{"  hola  ", "hola"},
		{`<script>`, "&lt;script&gt;"},
		{`a & b`, "a &amp; b"},
		{"", ""},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.want, sanitizeText(tt.in))
	}
}

func TestAuditTenantNameAndEmail(t *testing.T) {
	assert.Equal(t, "Acme Corp", auditTenantName("Acme Corp", "TENANT"))
	assert.Equal(t, "Sistema", auditTenantName("", "SUPER_ADMIN"))
	assert.Equal(t, "N/A", auditTenantName("", "TENANT"))
	assert.Equal(t, "user@test.com", auditUserEmail("user@test.com"))
	assert.Equal(t, "N/A", auditUserEmail(""))
}
