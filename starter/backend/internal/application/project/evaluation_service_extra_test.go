package project_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubEvalRepo struct {
	saveErr   error
	listErr   error
	latestErr error
	rows      []models.ProjectEvaluation
	saved     []models.ProjectEvaluation
	lastLimit int
	lastProj  uuid.UUID
	lastTen   uuid.UUID
}

func (s *stubEvalRepo) SaveBatch(_ context.Context, rows []models.ProjectEvaluation) error {
	if s.saveErr != nil {
		return s.saveErr
	}
	s.saved = append(s.saved, rows...)
	return nil
}

func (s *stubEvalRepo) ListByProject(_ context.Context, projectID, tenantID uuid.UUID) ([]models.ProjectEvaluation, error) {
	s.lastProj, s.lastTen = projectID, tenantID
	if s.listErr != nil {
		return nil, s.listErr
	}
	return s.rows, nil
}

func (s *stubEvalRepo) ListLatestByTenant(_ context.Context, tenantID uuid.UUID, limit int) ([]models.ProjectEvaluation, error) {
	s.lastTen, s.lastLimit = tenantID, limit
	if s.latestErr != nil {
		return nil, s.latestErr
	}
	return s.rows, nil
}

func TestEvaluateAndPersist_TableDriven(t *testing.T) {
	projectID, tenantID := uuid.New(), uuid.New()

	tests := []struct {
		name       string
		req        appproject.EvaluateRequest
		wantLen    int
		wantVPN    []float64
		wantTIRNil []bool
	}{
		{
			name: "inversión con retorno: VPN y TIR calculados",
			req: appproject.EvaluateRequest{
				DiscountRate: 0.10,
				Alternatives: []appproject.AlternativeInput{
					{Name: "Alt A", CashFlows: []float64{-1000, 400, 400, 400}},
				},
			},
			wantLen:    1,
			wantVPN:    []float64{-5.2592},
			wantTIRNil: []bool{false},
		},
		{
			name: "flujos sin cambio de signo: TIR nil",
			req: appproject.EvaluateRequest{
				DiscountRate: 0.05,
				Alternatives: []appproject.AlternativeInput{
					{Name: "Solo ingresos", CashFlows: []float64{100, 100, 100}},
				},
			},
			wantLen:    1,
			wantTIRNil: []bool{true},
		},
		{
			name: "tasa cero suma nominal",
			req: appproject.EvaluateRequest{
				DiscountRate: 0,
				Alternatives: []appproject.AlternativeInput{
					{Name: "Nominal", CashFlows: []float64{-500, 300, 300}},
				},
			},
			wantLen:    1,
			wantVPN:    []float64{100},
			wantTIRNil: []bool{false},
		},
		{
			name: "múltiples alternativas",
			req: appproject.EvaluateRequest{
				DiscountRate: 0.12,
				Alternatives: []appproject.AlternativeInput{
					{Name: "A", CashFlows: []float64{-1000, 600, 600}},
					{Name: "B", CashFlows: []float64{-2000, 900, 900, 900}},
				},
			},
			wantLen:    2,
			wantTIRNil: []bool{false, false},
		},
		{
			name: "flujos vacíos: VPN 0 y TIR nil",
			req: appproject.EvaluateRequest{
				DiscountRate: 0.1,
				Alternatives: []appproject.AlternativeInput{
					{Name: "Vacía", CashFlows: []float64{}},
				},
			},
			wantLen:    1,
			wantVPN:    []float64{0},
			wantTIRNil: []bool{true},
		},
		{
			name: "sin alternativas devuelve slice vacío",
			req: appproject.EvaluateRequest{
				DiscountRate: 0.1,
				Alternatives: []appproject.AlternativeInput{},
			},
			wantLen: 0,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			repo := &stubEvalRepo{}
			svc := appproject.NewEvaluationService(repo)

			results, err := svc.EvaluateAndPersist(context.Background(), projectID, tenantID, tt.req)
			require.NoError(t, err)
			require.Len(t, results, tt.wantLen)
			require.Len(t, repo.saved, tt.wantLen)

			for i := range results {
				assert.Equal(t, tt.req.Alternatives[i].Name, results[i].AlternativeName)
				assert.Equal(t, tt.req.DiscountRate, results[i].DiscountRate)
				assert.Equal(t, projectID, repo.saved[i].ProjectID)
				assert.Equal(t, tenantID, repo.saved[i].TenantID)
				assert.NotEqual(t, uuid.Nil, repo.saved[i].ID)
				assert.False(t, repo.saved[i].CreatedAt.IsZero())

				// Los flujos se serializan a JSON válido para la columna jsonb.
				var flows []float64
				require.NoError(t, json.Unmarshal([]byte(repo.saved[i].CashFlows), &flows))
				assert.Equal(t, tt.req.Alternatives[i].CashFlows, flows)

				if len(tt.wantVPN) > i {
					assert.InDelta(t, tt.wantVPN[i], results[i].VPN, 0.01)
				}
				if len(tt.wantTIRNil) > i {
					if tt.wantTIRNil[i] {
						assert.Nil(t, results[i].TIR, "alternativa %s no debería tener TIR", results[i].AlternativeName)
					} else {
						require.NotNil(t, results[i].TIR, "alternativa %s debería tener TIR", results[i].AlternativeName)
					}
				}
				assert.Equal(t, results[i].TIR == nil, repo.saved[i].TIR == nil)
			}
		})
	}
}

func TestEvaluateAndPersist_PropagatesRepositoryError(t *testing.T) {
	repo := &stubEvalRepo{saveErr: errors.New("db down")}
	svc := appproject.NewEvaluationService(repo)

	results, err := svc.EvaluateAndPersist(context.Background(), uuid.New(), uuid.New(), appproject.EvaluateRequest{
		DiscountRate: 0.1,
		Alternatives: []appproject.AlternativeInput{{Name: "A", CashFlows: []float64{-100, 200}}},
	})

	require.Error(t, err)
	assert.Nil(t, results)
	assert.Contains(t, err.Error(), "db down")
}

func TestEvaluationService_ListByProject(t *testing.T) {
	projectID, tenantID := uuid.New(), uuid.New()

	t.Run("delega en el repositorio con aislamiento de tenant", func(t *testing.T) {
		repo := &stubEvalRepo{rows: []models.ProjectEvaluation{{ID: uuid.New(), AlternativeName: "A"}}}
		svc := appproject.NewEvaluationService(repo)

		rows, err := svc.ListByProject(context.Background(), projectID, tenantID)
		require.NoError(t, err)
		require.Len(t, rows, 1)
		assert.Equal(t, projectID, repo.lastProj)
		assert.Equal(t, tenantID, repo.lastTen)
	})

	t.Run("propaga el error", func(t *testing.T) {
		svc := appproject.NewEvaluationService(&stubEvalRepo{listErr: errors.New("boom")})
		_, err := svc.ListByProject(context.Background(), projectID, tenantID)
		require.Error(t, err)
	})
}

func TestEvaluationService_ListLatestByTenant(t *testing.T) {
	tenantID := uuid.New()

	t.Run("propaga el límite solicitado", func(t *testing.T) {
		repo := &stubEvalRepo{rows: []models.ProjectEvaluation{{ID: uuid.New()}}}
		svc := appproject.NewEvaluationService(repo)

		rows, err := svc.ListLatestByTenant(context.Background(), tenantID, 7)
		require.NoError(t, err)
		require.Len(t, rows, 1)
		assert.Equal(t, 7, repo.lastLimit)
		assert.Equal(t, tenantID, repo.lastTen)
	})

	t.Run("propaga el error", func(t *testing.T) {
		svc := appproject.NewEvaluationService(&stubEvalRepo{latestErr: errors.New("boom")})
		_, err := svc.ListLatestByTenant(context.Background(), tenantID, 10)
		require.Error(t, err)
	})
}
