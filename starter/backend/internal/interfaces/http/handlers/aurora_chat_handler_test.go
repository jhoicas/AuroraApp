package handlers

import (
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type auroraDeps struct {
	knowledge *mockKnowledgeStore
	chat      *mockChatStore
	embedder  *mockEmbedder
	llm       *mockLLM
}

func TestAuroraChat_Success_PersistsPairAndReturnsCards(t *testing.T) {
	id := validIdentity()
	knowledge := &mockKnowledgeStore{
		similar: []models.AiKnowledgeNode{
			{ID: uuid.New(), NodeType: models.KnowledgeNodeAlternative, Label: "Alternativa 1", Content: "Red por gravedad"},
		},
	}
	chat := &mockChatStore{}
	llmMock := &mockLLM{
		reply: "Te recomiendo el ODS 6.1.\n\n```aurora-actions\n{\"action_cards\":[{\"catalog\":\"ods\",\"code\":\"6.1\",\"label\":\"Agua limpia\"}]}\n```",
	}

	h := NewAuroraChatHandlerWithDeps(knowledge, chat, &mockEmbedder{}, llmMock, nil, nil, testChatCfg())
	app := newTestApp()
	app.Post("/chat", injectIdentity(id), h.Chat)

	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{
		"message":       "¿Qué ODS aplica a un acueducto?",
		"route_context": "/admin/catalogs/ods",
	})

	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body dto.AuroraChatResponse
	decodeBody(t, resp, &body)

	assert.Contains(t, body.Reply, "ODS 6.1")
	require.Len(t, body.ActionCards, 1)
	assert.Equal(t, "ods", body.ActionCards[0].Catalog)
	assert.Equal(t, "6.1", body.ActionCards[0].Code)
	assert.NotEmpty(t, body.SessionID)
	assert.NotEmpty(t, body.UserMsgID)
	assert.NotEmpty(t, body.AssistantID)
	assert.Equal(t, "fast-model", body.Model)

	// RAG debe haberse consultado e inyectado en el system prompt.
	assert.Equal(t, 1, knowledge.SearchCalls())
	assert.Contains(t, llmMock.LastSystemPrompt(), "Red por gravedad")
	assert.Contains(t, llmMock.LastSystemPrompt(), "Catálogo de ODS")

	// Persistencia transaccional del par usuario/asistente.
	pairs := chat.SavedPairs()
	require.Len(t, pairs, 1)
	assert.Equal(t, models.ChatRoleUser, pairs[0].User.Role)
	assert.Equal(t, models.ChatRoleAssistant, pairs[0].Assistant.Role)
	assert.Equal(t, pairs[0].User.SessionID, pairs[0].Assistant.SessionID)
}

func TestAuroraChat_ReusesProvidedSessionID(t *testing.T) {
	id := validIdentity()
	chat := &mockChatStore{}
	h := NewAuroraChatHandlerWithDeps(&mockKnowledgeStore{}, chat, &mockEmbedder{}, &mockLLM{reply: "ok"}, nil, nil, testChatCfg())
	app := newTestApp()
	app.Post("/chat", injectIdentity(id), h.Chat)

	session := "sesion-persistente-123"
	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{
		"message":    "Hola",
		"session_id": session,
	})

	var body dto.AuroraChatResponse
	decodeBody(t, resp, &body)
	assert.Equal(t, session, body.SessionID)
	require.Len(t, chat.SavedPairs(), 1)
	assert.Equal(t, session, chat.SavedPairs()[0].User.SessionID)
}

func TestAuroraChat_ErrorTable(t *testing.T) {
	tests := []struct {
		name        string
		id          identity
		body        any
		deps        auroraDeps
		wantStatus  int
		wantErrPart string
	}{
		{
			name:        "usuario no autenticado (sin user_id)",
			id:          identity{role: "SUPER_ADMIN"},
			body:        map[string]any{"message": "hola"},
			wantStatus:  http.StatusUnauthorized,
			wantErrPart: "invalid user",
		},
		{
			name:        "user_id malformado en JWT",
			id:          identity{userID: "no-es-uuid", role: "TENANT"},
			body:        map[string]any{"message": "hola"},
			wantStatus:  http.StatusUnauthorized,
			wantErrPart: "invalid user",
		},
		{
			name:        "JSON inválido",
			id:          validIdentity(),
			body:        `{"message": `,
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "invalid JSON body",
		},
		{
			name:        "mensaje vacío falla validación",
			id:          validIdentity(),
			body:        map[string]any{"message": "   "},
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "Message",
		},
		{
			name:        "mensaje excede 8000 caracteres",
			id:          validIdentity(),
			body:        map[string]any{"message": strings.Repeat("a", 8001)},
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "Message",
		},
		{
			name:        "route_context excede 4000 caracteres",
			id:          validIdentity(),
			body:        map[string]any{"message": "hola", "route_context": strings.Repeat("r", 4001)},
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "RouteContext",
		},
		{
			name:        "Anthropic no disponible sin Gemini → 502",
			id:          validIdentity(),
			body:        map[string]any{"message": "hola"},
			deps:        auroraDeps{llm: &mockLLM{err: errors.New("connection refused")}},
			wantStatus:  http.StatusBadGateway,
			wantErrPart: "proveedores IA",
		},
		{
			name:        "respuesta vacía de Anthropic sin Gemini → 502",
			id:          validIdentity(),
			body:        map[string]any{"message": "hola"},
			deps:        auroraDeps{llm: &mockLLM{err: errors.New("empty response from anthropic")}},
			wantStatus:  http.StatusBadGateway,
			wantErrPart: "proveedores IA",
		},
		{
			name:        "fallo de BD al persistir historial → 500",
			id:          validIdentity(),
			body:        map[string]any{"message": "hola"},
			deps:        auroraDeps{chat: &mockChatStore{saveErr: errSimulatedDB}},
			wantStatus:  http.StatusInternalServerError,
			wantErrPart: "failed to persist chat history",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			deps := tt.deps
			if deps.knowledge == nil {
				deps.knowledge = &mockKnowledgeStore{}
			}
			if deps.chat == nil {
				deps.chat = &mockChatStore{}
			}
			if deps.embedder == nil {
				deps.embedder = &mockEmbedder{}
			}
			if deps.llm == nil {
				deps.llm = &mockLLM{reply: "ok"}
			}

			h := NewAuroraChatHandlerWithDeps(deps.knowledge, deps.chat, deps.embedder, deps.llm, nil, nil, testChatCfg())
			app := newTestApp()
			app.Post("/chat", injectIdentity(tt.id), h.Chat)

			resp := doJSON(t, app, http.MethodPost, "/chat", tt.body)
			payload := requireErrorJSON(t, resp, tt.wantStatus)
			assert.Contains(t, payload.Error, tt.wantErrPart)
		})
	}
}

func TestAuroraChat_RAGDegradesGracefully(t *testing.T) {
	tests := []struct {
		name     string
		deps     auroraDeps
		wantHint string
	}{
		{
			name: "embeddings fallan → responde sin RAG",
			deps: auroraDeps{embedder: &mockEmbedder{err: errors.New("embedding provider down")}},
		},
		{
			name: "búsqueda vectorial falla → responde sin RAG",
			deps: auroraDeps{knowledge: &mockKnowledgeStore{searchErr: errSimulatedDB}},
		},
		{
			name: "sin nodos similares → responde sin RAG",
			deps: auroraDeps{knowledge: &mockKnowledgeStore{}},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			deps := tt.deps
			if deps.knowledge == nil {
				deps.knowledge = &mockKnowledgeStore{}
			}
			if deps.embedder == nil {
				deps.embedder = &mockEmbedder{}
			}
			llmMock := &mockLLM{reply: "Respuesta sin contexto"}

			h := NewAuroraChatHandlerWithDeps(deps.knowledge, &mockChatStore{}, deps.embedder, llmMock, nil, nil, testChatCfg())
			app := newTestApp()
			app.Post("/chat", injectIdentity(validIdentity()), h.Chat)

			resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{"message": "hola"})
			require.Equal(t, http.StatusOK, resp.StatusCode)
			assert.NotContains(t, llmMock.LastSystemPrompt(), "Conocimiento MGA indexado")
		})
	}
}

func TestAuroraChat_RAGTruncatesLongContent(t *testing.T) {
	long := strings.Repeat("x", 900)
	knowledge := &mockKnowledgeStore{
		similar: []models.AiKnowledgeNode{
			{ID: uuid.New(), NodeType: models.KnowledgeNodeProduct, Label: "Producto largo", Content: long},
		},
	}
	llmMock := &mockLLM{reply: "ok"}
	h := NewAuroraChatHandlerWithDeps(knowledge, &mockChatStore{}, &mockEmbedder{}, llmMock, nil, nil, testChatCfg())
	app := newTestApp()
	app.Post("/chat", injectIdentity(validIdentity()), h.Chat)

	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{"message": "hola"})
	require.Equal(t, http.StatusOK, resp.StatusCode)

	prompt := llmMock.LastSystemPrompt()
	assert.Contains(t, prompt, "Conocimiento MGA indexado")
	assert.Contains(t, prompt, "…", "el contenido largo debe truncarse")
	assert.Less(t, strings.Count(prompt, "x"), 900)
}

func TestAuroraChat_WithoutTenantStillWorks(t *testing.T) {
	// SUPER_ADMIN no tiene tenant_id: el handler debe funcionar igualmente.
	id := identity{userID: uuid.NewString(), role: "SUPER_ADMIN"}
	chat := &mockChatStore{}
	h := NewAuroraChatHandlerWithDeps(&mockKnowledgeStore{}, chat, &mockEmbedder{}, &mockLLM{reply: "ok"}, nil, nil, testChatCfg())
	app := newTestApp()
	app.Post("/chat", injectIdentity(id), h.Chat)

	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{"message": "hola"})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	pairs := chat.SavedPairs()
	require.Len(t, pairs, 1)
	assert.Nil(t, pairs[0].User.TenantID)
}

func TestAuroraChat_InvalidTenantInLocalsIsIgnored(t *testing.T) {
	id := identity{userID: uuid.NewString(), role: "TENANT", tenantID: "no-es-uuid"}
	chat := &mockChatStore{}
	h := NewAuroraChatHandlerWithDeps(&mockKnowledgeStore{}, chat, &mockEmbedder{}, &mockLLM{reply: "ok"}, nil, nil, testChatCfg())
	app := newTestApp()
	app.Post("/chat", injectIdentity(id), h.Chat)

	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{"message": "hola"})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Len(t, chat.SavedPairs(), 1)
	assert.Nil(t, chat.SavedPairs()[0].User.TenantID)
}

func TestAuroraChat_IntentRouting(t *testing.T) {
	cfg := testChatCfg()
	llmMock := &mockLLM{reply: "ok"}

	h := NewAuroraChatHandlerWithDeps(&mockKnowledgeStore{}, &mockChatStore{}, &mockEmbedder{}, llmMock, nil, nil, cfg)
	app := newTestApp()
	app.Post("/chat", injectIdentity(validIdentity()), h.Chat)

	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{
		"message": "¿Qué es la viabilidad?",
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "fast-model", llmMock.LastModel())

	llmMock2 := &mockLLM{reply: "ok"}
	h2 := NewAuroraChatHandlerWithDeps(&mockKnowledgeStore{}, &mockChatStore{}, &mockEmbedder{}, llmMock2, nil, nil, cfg)
	app2 := newTestApp()
	app2.Post("/chat", injectIdentity(validIdentity()), h2.Chat)

	resp2 := doJSON(t, app2, http.MethodPost, "/chat", map[string]any{
		"message": "Ayúdame a redactar el objetivo general",
	})
	require.Equal(t, http.StatusOK, resp2.StatusCode)
	assert.Equal(t, "powerful-model", llmMock2.LastModel())
}

func TestAuroraChat_LogsCopilotTelemetry(t *testing.T) {
	repo := newCaptureUsageRepo()
	telemetry := services.NewTelemetryServiceWithRepo(repo, 8)
	defer telemetry.Close()

	llmMock := &mockLLM{reply: "ok"}
	h := NewAuroraChatHandlerWithDeps(&mockKnowledgeStore{}, &mockChatStore{}, &mockEmbedder{}, llmMock, nil, telemetry, testChatCfg())
	app := newTestApp()
	app.Post("/chat", injectIdentity(validIdentity()), h.Chat)

	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{
		"message": "Ayúdame a redactar el objetivo",
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)

	select {
	case entry := <-repo.entries:
		assert.Equal(t, models.TelemetryAskCopilot, entry.Action)
		assert.Equal(t, "INTENT_MGA_GENERATE", entry.Intent)
		assert.Equal(t, "powerful-model", entry.Model)
	case <-time.After(2 * time.Second):
		t.Fatal("expected telemetry entry")
	}
}

func TestAuroraChat_FallbackToGemini(t *testing.T) {
	anthropic := &mockLLM{err: errors.New("429 rate limit")}
	gemini := &mockLLM{reply: "Respuesta de contingencia"}
	chat := &mockChatStore{}

	h := NewAuroraChatHandlerWithDeps(
		&mockKnowledgeStore{}, chat, &mockEmbedder{}, anthropic, gemini, nil, testChatCfg(),
	)
	app := newTestApp()
	app.Post("/chat", injectIdentity(validIdentity()), h.Chat)

	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{"message": "hola"})
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body dto.AuroraChatResponse
	decodeBody(t, resp, &body)
	assert.Equal(t, "Respuesta de contingencia", body.Reply)
	assert.Equal(t, "gemini_fallback:gemini-1.5-flash", body.Model)
	assert.Equal(t, 1, anthropic.Calls())
	assert.Equal(t, 1, gemini.Calls())

	pairs := chat.SavedPairs()
	require.Len(t, pairs, 1)
	assert.Equal(t, "gemini_fallback:gemini-1.5-flash", pairs[0].Assistant.Model)
}

func TestAuroraChat_BothProvidersFail(t *testing.T) {
	anthropic := &mockLLM{err: errors.New("anthropic down")}
	gemini := &mockLLM{err: errors.New("gemini down")}

	h := NewAuroraChatHandlerWithDeps(
		&mockKnowledgeStore{}, &mockChatStore{}, &mockEmbedder{}, anthropic, gemini, nil, testChatCfg(),
	)
	app := newTestApp()
	app.Post("/chat", injectIdentity(validIdentity()), h.Chat)

	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{"message": "hola"})
	payload := requireErrorJSON(t, resp, http.StatusBadGateway)
	assert.Contains(t, payload.Error, "proveedores IA")
	assert.Contains(t, payload.Error, "anthropic down")
	assert.Contains(t, payload.Error, "gemini down")
}

func TestAuroraChat_FallbackLogsGeminiTelemetry(t *testing.T) {
	repo := newCaptureUsageRepo()
	telemetry := services.NewTelemetryServiceWithRepo(repo, 8)
	defer telemetry.Close()

	anthropic := &mockLLM{err: errors.New("500 server error")}
	gemini := &mockLLM{reply: "ok"}

	h := NewAuroraChatHandlerWithDeps(
		&mockKnowledgeStore{}, &mockChatStore{}, &mockEmbedder{}, anthropic, gemini, telemetry, testChatCfg(),
	)
	app := newTestApp()
	app.Post("/chat", injectIdentity(validIdentity()), h.Chat)

	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{"message": "hola"})
	require.Equal(t, http.StatusOK, resp.StatusCode)

	select {
	case entry := <-repo.entries:
		assert.Equal(t, "gemini_fallback:gemini-1.5-flash", entry.Model)
	case <-time.After(2 * time.Second):
		t.Fatal("expected telemetry entry")
	}
}
