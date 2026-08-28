package handlers

import (
	"bytes"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const validMGAXML = `<?xml version="1.0" encoding="UTF-8"?>
<MGAProject>
  <ProjectName>Acueducto Test</ProjectName>
  <Sector>Agua Potable</Sector>
  <CentralProblem>Falta de cobertura</CentralProblem>
  <Causes><Cause>Infraestructura obsoleta</Cause></Causes>
  <Effects><Effect>Enfermedades</Effect></Effects>
  <Alternatives><Alternative>Red por gravedad</Alternative></Alternatives>
  <Products><Product>Red operativa</Product></Products>
  <Activities><Activity>Diseño técnico</Activity></Activities>
</MGAProject>`

func newKnowledgeApp(repo *mockKnowledgeStore, embedder services.EmbeddingProvider, id identity) (*fiber.App, *mockKnowledgeStore) {
	if repo == nil {
		repo = &mockKnowledgeStore{}
	}
	if embedder == nil {
		embedder = &mockEmbedder{}
	}
	h := NewAIKnowledgeHandlerWithDeps(repo, embedder, nil)

	app := newTestApp()
	app.Post("/ingest", injectIdentity(id), h.IngestKnowledge)
	app.Get("/graph", injectIdentity(id), h.GetKnowledgeGraph)
	return app, repo
}

func uploadXML(t *testing.T, app *fiber.App, fieldName, filename, content string) *http.Response {
	t.Helper()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	if filename != "" {
		part, err := writer.CreateFormFile(fieldName, filename)
		require.NoError(t, err)
		_, err = part.Write([]byte(content))
		require.NoError(t, err)
	} else {
		require.NoError(t, writer.WriteField("other", "value"))
	}
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "/ingest", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := app.Test(req, 10000)
	require.NoError(t, err)
	return resp
}

func TestIngestKnowledge_Success(t *testing.T) {
	id := validIdentity()
	app, repo := newKnowledgeApp(nil, nil, id)

	resp := uploadXML(t, app, "file", "acueducto.xml", validMGAXML)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var summary dto.KnowledgeIngestSummary
	decodeBody(t, resp, &summary)

	assert.Equal(t, "Acueducto Test", summary.ProjectName)
	assert.Greater(t, summary.NodesCreated, 0)
	assert.Greater(t, summary.LinksCreated, 0)
	assert.Equal(t, 1, summary.Alternatives)
	assert.Equal(t, 1, summary.Products)
	assert.Equal(t, 1, summary.Activities)
	assert.Equal(t, 1, summary.Causes)
	assert.Equal(t, 1, summary.Effects)
	assert.True(t, summary.CentralProblem)
	assert.Contains(t, summary.Message, "Acueducto Test")

	assert.Equal(t, 1, repo.InsertCalls())
	batch := repo.LastBatch()
	require.NotEmpty(t, batch.Nodes)
	assert.Len(t, batch.Nodes[0].Embedding, 384, "embeddings deben ser de 384 dims")
	assert.NotEmpty(t, batch.Nodes[0].Node.Metadata)
	require.NotNil(t, batch.Nodes[0].Node.TenantID)
	assert.Equal(t, uuid.MustParse(id.tenantID), *batch.Nodes[0].Node.TenantID)
}

func TestIngestKnowledge_GlobalSuperAdminStoresNullTenant(t *testing.T) {
	globalAdmin := identity{userID: uuid.NewString(), role: "SUPER_ADMIN"}
	app, repo := newKnowledgeApp(nil, nil, globalAdmin)

	resp := uploadXML(t, app, "file", "global.xml", validMGAXML)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	batch := repo.LastBatch()
	require.NotEmpty(t, batch.Nodes)
	require.NotEmpty(t, batch.Links)
	for _, node := range batch.Nodes {
		assert.Nil(t, node.Node.TenantID)
	}
	for _, link := range batch.Links {
		assert.Nil(t, link.Link.TenantID)
	}
}

func TestIngestKnowledge_ErrorTable(t *testing.T) {
	tests := []struct {
		name        string
		field       string
		filename    string
		content     string
		repo        *mockKnowledgeStore
		embedder    services.EmbeddingProvider
		wantStatus  int
		wantErrPart string
	}{
		{
			name:        "sin archivo → 400",
			field:       "file",
			filename:    "",
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "se requiere un archivo XML",
		},
		{
			name:        "campo incorrecto → 400",
			field:       "documento",
			filename:    "a.xml",
			content:     validMGAXML,
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "se requiere un archivo XML",
		},
		{
			name:        "extensión no XML → 400",
			field:       "file",
			filename:    "malicioso.exe",
			content:     validMGAXML,
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "solo se aceptan archivos .xml",
		},
		{
			name:        "XML corrupto → 400",
			field:       "file",
			filename:    "roto.xml",
			content:     `<MGAProject><Cause>sin cerrar`,
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "parse xml",
		},
		{
			name:        "XML sin nodos MGA → 400",
			field:       "file",
			filename:    "vacio.xml",
			content:     `<?xml version="1.0"?><Root></Root>`,
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "no se encontraron nodos",
		},
		{
			name:        "fallo de embeddings → 500",
			field:       "file",
			filename:    "ok.xml",
			content:     validMGAXML,
			embedder:    &mockEmbedder{err: errors.New("provider down")},
			wantStatus:  http.StatusInternalServerError,
			wantErrPart: "embeddings",
		},
		{
			name:        "fallo de BD al insertar grafo → 500",
			field:       "file",
			filename:    "ok.xml",
			content:     validMGAXML,
			repo:        &mockKnowledgeStore{insertErr: errSimulatedDB},
			wantStatus:  http.StatusInternalServerError,
			wantErrPart: "no se pudieron guardar",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			app, _ := newKnowledgeApp(tt.repo, tt.embedder, validIdentity())
			resp := uploadXML(t, app, tt.field, tt.filename, tt.content)
			payload := requireErrorJSON(t, resp, tt.wantStatus)
			assert.Contains(t, payload.Error, tt.wantErrPart)
		})
	}
}

func TestGetKnowledgeGraph(t *testing.T) {
	nodeA, nodeB := uuid.New(), uuid.New()

	t.Run("éxito devuelve nodes y links", func(t *testing.T) {
		repo := &mockKnowledgeStore{
			nodes: []models.AiKnowledgeNode{
				{ID: nodeA, Label: "Proyecto", NodeType: models.KnowledgeNodeProject, ProjectKey: "acueducto", Content: "contenido corto"},
				{ID: nodeB, Label: "Causa 1", NodeType: models.KnowledgeNodeCause, ProjectKey: "acueducto", Content: strings.Repeat("z", 800)},
			},
			links: []models.AiKnowledgeLink{
				{ID: uuid.New(), SourceNodeID: nodeA, TargetNodeID: nodeB, Relationship: models.RelHasCause},
			},
		}
		app, _ := newKnowledgeApp(repo, nil, validIdentity())

		resp := doJSON(t, app, http.MethodGet, "/graph", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body dto.KnowledgeGraphResponse
		decodeBody(t, resp, &body)

		require.Len(t, body.Nodes, 2)
		require.Len(t, body.Links, 1)
		assert.Equal(t, nodeA.String(), body.Links[0].Source)
		assert.Equal(t, models.RelHasCause, body.Links[0].Relationship)
		assert.LessOrEqual(t, len(body.Nodes[1].Content), 501+2, "contenido debe truncarse a 500 chars")
		assert.True(t, strings.HasSuffix(body.Nodes[1].Content, "…"))
	})

	t.Run("grafo vacío devuelve arrays vacíos", func(t *testing.T) {
		app, _ := newKnowledgeApp(&mockKnowledgeStore{}, nil, validIdentity())
		resp := doJSON(t, app, http.MethodGet, "/graph", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body dto.KnowledgeGraphResponse
		decodeBody(t, resp, &body)
		assert.Empty(t, body.Nodes)
		assert.Empty(t, body.Links)
	})

	t.Run("fallo al listar nodos → 500", func(t *testing.T) {
		app, _ := newKnowledgeApp(&mockKnowledgeStore{nodesErr: errSimulatedDB}, nil, validIdentity())
		resp := doJSON(t, app, http.MethodGet, "/graph", nil)
		payload := requireErrorJSON(t, resp, http.StatusInternalServerError)
		assert.Contains(t, payload.Error, "grafo de conocimiento")
	})

	t.Run("fallo al listar relaciones → 500", func(t *testing.T) {
		app, _ := newKnowledgeApp(&mockKnowledgeStore{linksErr: errSimulatedDB}, nil, validIdentity())
		resp := doJSON(t, app, http.MethodGet, "/graph", nil)
		payload := requireErrorJSON(t, resp, http.StatusInternalServerError)
		assert.Contains(t, payload.Error, "relaciones")
	})
}

func TestTelemetryHandler_LogTelemetry(t *testing.T) {
	newApp := func(telemetry *services.TelemetryService, id identity) *fiber.App {
		h := NewAITelemetryHandler(telemetry)
		app := newTestApp()
		app.Post("/log", injectIdentity(id), h.LogTelemetry)
		return app
	}

	t.Run("éxito con telemetría nil (no debe hacer panic)", func(t *testing.T) {
		app := newApp(nil, validIdentity())
		resp := doJSON(t, app, http.MethodPost, "/log", map[string]any{"action": "view_graph"})
		require.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Contains(t, bodyString(t, resp), "true")
	})

	t.Run("JSON inválido → 400", func(t *testing.T) {
		app := newApp(nil, validIdentity())
		resp := doJSON(t, app, http.MethodPost, "/log", `{"action":`)
		requireErrorJSON(t, resp, http.StatusBadRequest)
	})

	t.Run("acción vacía → 400", func(t *testing.T) {
		app := newApp(nil, validIdentity())
		resp := doJSON(t, app, http.MethodPost, "/log", map[string]any{"action": "  "})
		requireErrorJSON(t, resp, http.StatusBadRequest)
	})

	t.Run("acción excede 80 caracteres → 400", func(t *testing.T) {
		app := newApp(nil, validIdentity())
		resp := doJSON(t, app, http.MethodPost, "/log", map[string]any{"action": strings.Repeat("a", 81)})
		requireErrorJSON(t, resp, http.StatusBadRequest)
	})

	t.Run("usuario inválido → 401", func(t *testing.T) {
		app := newApp(nil, identity{userID: "no-uuid", role: "TENANT"})
		resp := doJSON(t, app, http.MethodPost, "/log", map[string]any{"action": "view_graph"})
		payload := requireErrorJSON(t, resp, http.StatusUnauthorized)
		assert.Contains(t, payload.Error, "invalid user")
	})
}

func TestTruncateHelper(t *testing.T) {
	assert.Equal(t, "abc", truncate("  abc  ", 10))
	assert.Equal(t, "ab…", truncate("abcdef", 2))
	assert.Equal(t, "", truncate("   ", 5))
}
