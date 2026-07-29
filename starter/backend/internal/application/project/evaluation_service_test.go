package project_test

import (
	"context"
	"testing"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
)

type memEvalRepo struct {
	rows []models.ProjectEvaluation
}

func (m *memEvalRepo) SaveBatch(_ context.Context, rows []models.ProjectEvaluation) error {
	m.rows = append(m.rows, rows...)
	return nil
}
func (m *memEvalRepo) ListByProject(_ context.Context, _, _ uuid.UUID) ([]models.ProjectEvaluation, error) {
	return m.rows, nil
}
func (m *memEvalRepo) ListLatestByTenant(_ context.Context, _ uuid.UUID, _ int) ([]models.ProjectEvaluation, error) {
	return m.rows, nil
}

func TestEvaluationService(t *testing.T) {
	repo := &memEvalRepo{}
	svc := appproject.NewEvaluationService(repo)

	results, err := svc.EvaluateAndPersist(context.Background(), uuid.New(), uuid.New(), appproject.EvaluateRequest{
		DiscountRate: 0.1,
		Alternatives: []appproject.AlternativeInput{{
			Name:      "Alt A",
			CashFlows: []float64{-1000, 400, 400, 400},
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if len(repo.rows) != 1 {
		t.Fatalf("expected 1 persisted row")
	}
}
