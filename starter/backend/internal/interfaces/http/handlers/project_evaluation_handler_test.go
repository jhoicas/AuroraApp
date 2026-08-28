package handlers

import (
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newEvalApp(repo *mockEvaluationRepo, finder *mockProjectFinder, id identity) *evalTestApp {
	if repo == nil {
		repo = &mockEvaluationRepo{}
	}
	if finder == nil {
		finder = &mockProjectFinder{}
	}
	h := NewProjectEvaluationHandlerWithDeps(appproject.NewEvaluationService(repo), finder)

	app := newTestApp()
	app.Post("/projects/:id/evaluate", injectIdentity(id), h.Evaluate)
	app.Get("/projects/:id/evaluations", injectIdentity(id), h.ListEvaluations)
	app.Get("/projects/evaluations/summary", injectIdentity(id), h.ListTenantEvaluations)

	return &evalTestApp{app: app, repo: repo, finder: finder}
}

type evalTestApp struct {
	app    *fiber.App
	repo   *mockEvaluationRepo
	finder *mockProjectFinder
}

func TestEvaluate_Success(t *testing.T) {
	id := validIdentity()
	env := newEvalApp(nil, nil, id)
	projectID := uuid.NewString()

	resp := doJSON(t, env.app, http.MethodPost, "/projects/"+projectID+"/evaluate", map[string]any{
		"discount_rate": 0.10,
		"alternatives": []map[string]any{
			{"name": "Red por gravedad", "cash_flows": []float64{-1000, 400, 400, 400}},
			{"name": "Sin retorno", "cash_flows": []float64{100, 100}},
		},
	})

	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body dto.EvaluateProjectResponse
	decodeBody(t, resp, &body)

	require.Len(t, body.Evaluations, 2)
	assert.Equal(t, projectID, body.ProjectID)

	first := body.Evaluations[0]
	assert.Equal(t, "Red por gravedad", first.AlternativeName)
	assert.InDelta(t, -5.259, first.VPN, 0.01)
	require.NotNil(t, first.TIR, "flujo con cambio de signo debe tener TIR")
	assert.InDelta(t, 0.096, *first.TIR, 0.01)

	second := body.Evaluations[1]
	assert.Nil(t, second.TIR, "flujo sin cambio de signo no debe tener TIR")

	assert.Equal(t, 1, env.repo.saveCalled)
	assert.Len(t, env.repo.saved, 2)
	assert.Equal(t, 1, env.finder.invocations, "debe validarse ownership del proyecto")
}

func TestEvaluate_ErrorTable(t *testing.T) {
	validProject := uuid.NewString()

	tests := []struct {
		name        string
		id          identity
		projectID   string
		body        any
		repo        *mockEvaluationRepo
		finder      *mockProjectFinder
		wantStatus  int
		wantErrPart string
	}{
		{
			name:        "sin identidad de tenant → 403",
			id:          identity{userID: uuid.NewString(), role: "SUPER_ADMIN"},
			projectID:   validProject,
			body:        map[string]any{"discount_rate": 0.1, "alternatives": []map[string]any{{"name": "A", "cash_flows": []float64{-1, 2}}}},
			wantStatus:  http.StatusForbidden,
			wantErrPart: "tenant identity",
		},
		{
			name:        "project id malformado → 400",
			id:          validIdentity(),
			projectID:   "no-es-uuid",
			body:        map[string]any{"discount_rate": 0.1, "alternatives": []map[string]any{{"name": "A", "cash_flows": []float64{-1, 2}}}},
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "invalid project id",
		},
		{
			name:        "proyecto de otro tenant → 404",
			id:          validIdentity(),
			projectID:   validProject,
			body:        map[string]any{"discount_rate": 0.1, "alternatives": []map[string]any{{"name": "A", "cash_flows": []float64{-1, 2}}}},
			finder:      &mockProjectFinder{forceNotFound: true},
			wantStatus:  http.StatusNotFound,
			wantErrPart: "project not found",
		},
		{
			name:        "fallo de BD al cargar proyecto → 500",
			id:          validIdentity(),
			projectID:   validProject,
			body:        map[string]any{"discount_rate": 0.1, "alternatives": []map[string]any{{"name": "A", "cash_flows": []float64{-1, 2}}}},
			finder:      &mockProjectFinder{err: errSimulatedDB},
			wantStatus:  http.StatusInternalServerError,
			wantErrPart: "failed to load project",
		},
		{
			name:        "JSON inválido → 400",
			id:          validIdentity(),
			projectID:   validProject,
			body:        `{"discount_rate":`,
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "invalid JSON body",
		},
		{
			name:        "sin alternativas → 400",
			id:          validIdentity(),
			projectID:   validProject,
			body:        map[string]any{"discount_rate": 0.1, "alternatives": []map[string]any{}},
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "Alternatives",
		},
		{
			name:        "tasa fuera de rango (>1) → 400",
			id:          validIdentity(),
			projectID:   validProject,
			body:        map[string]any{"discount_rate": 1.5, "alternatives": []map[string]any{{"name": "A", "cash_flows": []float64{-1, 2}}}},
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "DiscountRate",
		},
		{
			name:        "tasa negativa → 400",
			id:          validIdentity(),
			projectID:   validProject,
			body:        map[string]any{"discount_rate": -0.2, "alternatives": []map[string]any{{"name": "A", "cash_flows": []float64{-1, 2}}}},
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "DiscountRate",
		},
		{
			name:      "menos de 2 flujos de caja → 400",
			id:        validIdentity(),
			projectID: validProject,
			body: map[string]any{"discount_rate": 0.1, "alternatives": []map[string]any{
				{"name": "A", "cash_flows": []float64{-1000}},
			}},
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "CashFlows",
		},
		{
			name:      "nombre de alternativa vacío → 400",
			id:        validIdentity(),
			projectID: validProject,
			body: map[string]any{"discount_rate": 0.1, "alternatives": []map[string]any{
				{"name": "", "cash_flows": []float64{-1, 2}},
			}},
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "Name",
		},
		{
			name:      "nombre excede 255 caracteres → 400",
			id:        validIdentity(),
			projectID: validProject,
			body: map[string]any{"discount_rate": 0.1, "alternatives": []map[string]any{
				{"name": strings.Repeat("n", 256), "cash_flows": []float64{-1, 2}},
			}},
			wantStatus:  http.StatusBadRequest,
			wantErrPart: "Name",
		},
		{
			name:        "fallo al persistir evaluación → 500",
			id:          validIdentity(),
			projectID:   validProject,
			body:        map[string]any{"discount_rate": 0.1, "alternatives": []map[string]any{{"name": "A", "cash_flows": []float64{-1, 2}}}},
			repo:        &mockEvaluationRepo{saveErr: errSimulatedDB},
			wantStatus:  http.StatusInternalServerError,
			wantErrPart: "evaluation failed",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			env := newEvalApp(tt.repo, tt.finder, tt.id)
			resp := doJSON(t, env.app, http.MethodPost, "/projects/"+tt.projectID+"/evaluate", tt.body)
			payload := requireErrorJSON(t, resp, tt.wantStatus)
			assert.Contains(t, payload.Error, tt.wantErrPart)
		})
	}
}

func TestListEvaluations(t *testing.T) {
	projectID := uuid.New()
	tir := 0.12

	t.Run("éxito devuelve flujos deserializados", func(t *testing.T) {
		repo := &mockEvaluationRepo{
			byProject: []models.ProjectEvaluation{
				{
					ID:              uuid.New(),
					ProjectID:       projectID,
					AlternativeName: "Alt 1",
					DiscountRate:    0.1,
					CashFlows:       "[-1000,500,700]",
					VPN:             55.5,
					TIR:             &tir,
					CreatedAt:       time.Now().UTC(),
				},
			},
		}
		env := newEvalApp(repo, nil, validIdentity())
		resp := doJSON(t, env.app, http.MethodGet, "/projects/"+projectID.String()+"/evaluations", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body struct {
			Data []dto.EvaluationResultDTO `json:"data"`
		}
		decodeBody(t, resp, &body)
		require.Len(t, body.Data, 1)
		assert.Equal(t, []float64{-1000, 500, 700}, body.Data[0].CashFlows)
		require.NotNil(t, body.Data[0].TIR)
		assert.InDelta(t, 0.12, *body.Data[0].TIR, 1e-9)
	})

	t.Run("cash_flows corrupto no rompe la respuesta", func(t *testing.T) {
		repo := &mockEvaluationRepo{
			byProject: []models.ProjectEvaluation{
				{ID: uuid.New(), ProjectID: projectID, AlternativeName: "Alt", CashFlows: "{corrupto"},
			},
		}
		env := newEvalApp(repo, nil, validIdentity())
		resp := doJSON(t, env.app, http.MethodGet, "/projects/"+projectID.String()+"/evaluations", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body struct {
			Data []dto.EvaluationResultDTO `json:"data"`
		}
		decodeBody(t, resp, &body)
		require.Len(t, body.Data, 1)
		assert.Empty(t, body.Data[0].CashFlows)
	})

	t.Run("project id inválido → 400", func(t *testing.T) {
		env := newEvalApp(nil, nil, validIdentity())
		resp := doJSON(t, env.app, http.MethodGet, "/projects/abc/evaluations", nil)
		requireErrorJSON(t, resp, http.StatusBadRequest)
	})

	t.Run("sin tenant → 403", func(t *testing.T) {
		env := newEvalApp(nil, nil, identity{userID: uuid.NewString(), role: "SUPER_ADMIN"})
		resp := doJSON(t, env.app, http.MethodGet, "/projects/"+projectID.String()+"/evaluations", nil)
		requireErrorJSON(t, resp, http.StatusForbidden)
	})

	t.Run("fallo de BD → 500", func(t *testing.T) {
		env := newEvalApp(&mockEvaluationRepo{listErr: errors.New("db down")}, nil, validIdentity())
		resp := doJSON(t, env.app, http.MethodGet, "/projects/"+projectID.String()+"/evaluations", nil)
		payload := requireErrorJSON(t, resp, http.StatusInternalServerError)
		assert.Contains(t, payload.Error, "failed to load evaluations")
	})
}

func TestListTenantEvaluations(t *testing.T) {
	tir := 0.2

	t.Run("resumen con límite por defecto", func(t *testing.T) {
		repo := &mockEvaluationRepo{
			latest: []models.ProjectEvaluation{
				{ID: uuid.New(), ProjectID: uuid.New(), AlternativeName: "A", VPN: 100, TIR: &tir, CreatedAt: time.Now().UTC()},
			},
		}
		env := newEvalApp(repo, nil, validIdentity())
		resp := doJSON(t, env.app, http.MethodGet, "/projects/evaluations/summary", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body struct {
			Data []struct {
				ProjectID       string   `json:"project_id"`
				AlternativeName string   `json:"alternative_name"`
				VPN             float64  `json:"vpn"`
				TIR             *float64 `json:"tir"`
				CreatedAt       string   `json:"created_at"`
			} `json:"data"`
		}
		decodeBody(t, resp, &body)
		require.Len(t, body.Data, 1)
		assert.Equal(t, 20, repo.lastLimit)
		assert.NotEmpty(t, body.Data[0].CreatedAt)
	})

	t.Run("límite personalizado por query param", func(t *testing.T) {
		repo := &mockEvaluationRepo{}
		env := newEvalApp(repo, nil, validIdentity())
		resp := doJSON(t, env.app, http.MethodGet, "/projects/evaluations/summary?limit=5", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, 5, repo.lastLimit)
	})

	t.Run("sin tenant → 403", func(t *testing.T) {
		env := newEvalApp(nil, nil, identity{userID: uuid.NewString(), role: "SUPER_ADMIN"})
		resp := doJSON(t, env.app, http.MethodGet, "/projects/evaluations/summary", nil)
		requireErrorJSON(t, resp, http.StatusForbidden)
	})

	t.Run("fallo de BD → 500", func(t *testing.T) {
		env := newEvalApp(&mockEvaluationRepo{latestErr: errSimulatedDB}, nil, validIdentity())
		resp := doJSON(t, env.app, http.MethodGet, "/projects/evaluations/summary", nil)
		requireErrorJSON(t, resp, http.StatusInternalServerError)
	})
}
