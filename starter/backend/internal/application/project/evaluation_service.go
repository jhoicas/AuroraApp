package project

import (
	"context"
	"encoding/json"
	"math"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/pkg/finance"

	"github.com/google/uuid"
)

// EvaluationRepository persiste evaluaciones financieras (patrón Repository).
type EvaluationRepository interface {
	SaveBatch(ctx context.Context, rows []models.ProjectEvaluation) error
	ListByProject(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.ProjectEvaluation, error)
	ListLatestByTenant(ctx context.Context, tenantID uuid.UUID, limit int) ([]models.ProjectEvaluation, error)
}

// AlternativeInput flujos de caja de una alternativa MGA.
type AlternativeInput struct {
	Name      string    `json:"name"`
	CashFlows []float64 `json:"cash_flows"`
}

// EvaluateRequest entrada del caso de uso de evaluación financiera.
type EvaluateRequest struct {
	DiscountRate float64            `json:"discount_rate"`
	Alternatives []AlternativeInput `json:"alternatives"`
}

// EvaluationResult salida calculada por el motor nativo Go.
type EvaluationResult struct {
	AlternativeName string    `json:"alternative_name"`
	DiscountRate    float64   `json:"discount_rate"`
	CashFlows       []float64 `json:"cash_flows"`
	VPN             float64   `json:"vpn"`
	TIR             *float64  `json:"tir,omitempty"`
}

// EvaluationService orquesta VPN/TIR sin depender de IA.
type EvaluationService struct {
	repo EvaluationRepository
}

func NewEvaluationService(repo EvaluationRepository) *EvaluationService {
	return &EvaluationService{repo: repo}
}

func (s *EvaluationService) EvaluateAndPersist(
	ctx context.Context,
	projectID, tenantID uuid.UUID,
	req EvaluateRequest,
) ([]EvaluationResult, error) {
	results := make([]EvaluationResult, 0, len(req.Alternatives))
	rows := make([]models.ProjectEvaluation, 0, len(req.Alternatives))
	now := time.Now().UTC()

	for _, alt := range req.Alternatives {
		vpn := finance.CalculateVPN(req.DiscountRate, alt.CashFlows)
		tirRaw := finance.CalculateTIR(alt.CashFlows)

		var tirPtr *float64
		if !math.IsNaN(tirRaw) {
			t := tirRaw
			tirPtr = &t
		}

		flowsJSON, _ := json.Marshal(alt.CashFlows)
		rows = append(rows, models.ProjectEvaluation{
			ID:              uuid.New(),
			ProjectID:       projectID,
			TenantID:        tenantID,
			AlternativeName: alt.Name,
			DiscountRate:    req.DiscountRate,
			CashFlows:       string(flowsJSON),
			VPN:             vpn,
			TIR:             tirPtr,
			CreatedAt:       now,
		})

		results = append(results, EvaluationResult{
			AlternativeName: alt.Name,
			DiscountRate:    req.DiscountRate,
			CashFlows:       alt.CashFlows,
			VPN:             vpn,
			TIR:             tirPtr,
		})
	}

	if err := s.repo.SaveBatch(ctx, rows); err != nil {
		return nil, err
	}
	return results, nil
}

func (s *EvaluationService) ListByProject(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.ProjectEvaluation, error) {
	return s.repo.ListByProject(ctx, projectID, tenantID)
}

func (s *EvaluationService) ListLatestByTenant(ctx context.Context, tenantID uuid.UUID, limit int) ([]models.ProjectEvaluation, error) {
	return s.repo.ListLatestByTenant(ctx, tenantID, limit)
}
