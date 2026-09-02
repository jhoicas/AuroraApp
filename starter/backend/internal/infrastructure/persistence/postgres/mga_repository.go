package postgres

import (
	"context"
	"errors"
	"sync"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MgaRepository struct {
	db *gorm.DB
}

func NewMgaRepository(db *gorm.DB) *MgaRepository {
	return &MgaRepository{db: db}
}

func (r *MgaRepository) CountCauses(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.MgaCause{}).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Count(&count).Error
	return count, err
}

func (r *MgaRepository) CountSpecificObjectives(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.MgaSpecificObjective{}).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Count(&count).Error
	return count, err
}

func (r *MgaRepository) CountDirectCauses(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.MgaCause{}).
		Where("project_id = ? AND tenant_id = ? AND cause_type = ? AND parent_id IS NULL", projectID, tenantID, "directa").
		Count(&count).Error
	return count, err
}

func (r *MgaRepository) CountDirectEffects(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.MgaEffect{}).
		Where("project_id = ? AND tenant_id = ? AND effect_type = ? AND parent_id IS NULL", projectID, tenantID, "directo").
		Count(&count).Error
	return count, err
}

func (r *MgaRepository) ListCauses(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.MgaCause, error) {
	causes := make([]models.MgaCause, 0)
	err := r.db.WithContext(ctx).
		Preload("SpecificObjective").
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("sort_order ASC, created_at ASC").
		Find(&causes).Error
	return causes, err
}

func (r *MgaRepository) FindCause(ctx context.Context, causeID, projectID, tenantID uuid.UUID) (*models.MgaCause, error) {
	var cause models.MgaCause
	err := r.db.WithContext(ctx).
		Preload("SpecificObjective").
		Where("id = ? AND project_id = ? AND tenant_id = ?", causeID, projectID, tenantID).
		First(&cause).Error
	if err != nil {
		return nil, err
	}
	return &cause, nil
}

func (r *MgaRepository) CreateCause(ctx context.Context, cause *models.MgaCause, objective *models.MgaSpecificObjective) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(cause).Error; err != nil {
			return err
		}
		if objective != nil {
			objective.CauseID = cause.ID
			objective.TenantID = cause.TenantID
			objective.ProjectID = cause.ProjectID
			if err := tx.Create(objective).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *MgaRepository) UpdateCause(ctx context.Context, cause *models.MgaCause) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaCause{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", cause.ID, cause.ProjectID, cause.TenantID).
		Select("cause_type", "description", "parent_id", "sort_order", "updated_at").
		Updates(cause).Error
}

func (r *MgaRepository) DeleteCause(ctx context.Context, causeID, projectID, tenantID uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("cause_id = ? AND project_id = ? AND tenant_id = ?", causeID, projectID, tenantID).
			Delete(&models.MgaSpecificObjective{}).Error; err != nil {
			return err
		}
		result := tx.Where("id = ? AND project_id = ? AND tenant_id = ?", causeID, projectID, tenantID).
			Delete(&models.MgaCause{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (r *MgaRepository) FindObjective(ctx context.Context, objectiveID, projectID, tenantID uuid.UUID) (*models.MgaSpecificObjective, error) {
	var objective models.MgaSpecificObjective
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", objectiveID, projectID, tenantID).
		First(&objective).Error
	if err != nil {
		return nil, err
	}
	return &objective, nil
}

func (r *MgaRepository) UpdateObjective(ctx context.Context, objective *models.MgaSpecificObjective) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaSpecificObjective{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", objective.ID, objective.ProjectID, objective.TenantID).
		Select("description", "updated_at").
		Updates(objective).Error
}

func (r *MgaRepository) CreateObjective(ctx context.Context, objective *models.MgaSpecificObjective) error {
	return r.db.WithContext(ctx).Create(objective).Error
}

func (r *MgaRepository) DeleteObjective(ctx context.Context, objectiveID, projectID, tenantID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", objectiveID, projectID, tenantID).
		Delete(&models.MgaSpecificObjective{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *MgaRepository) ListIndicators(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.MgaIndicator, error) {
	indicators := make([]models.MgaIndicator, 0)
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("sort_order ASC, created_at ASC").
		Find(&indicators).Error
	return indicators, err
}

func (r *MgaRepository) FindIndicator(ctx context.Context, indicatorID, projectID, tenantID uuid.UUID) (*models.MgaIndicator, error) {
	var indicator models.MgaIndicator
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", indicatorID, projectID, tenantID).
		First(&indicator).Error
	if err != nil {
		return nil, err
	}
	return &indicator, nil
}

func (r *MgaRepository) CreateIndicator(ctx context.Context, indicator *models.MgaIndicator) error {
	return r.db.WithContext(ctx).Create(indicator).Error
}

func (r *MgaRepository) UpdateIndicator(ctx context.Context, indicator *models.MgaIndicator) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaIndicator{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", indicator.ID, indicator.ProjectID, indicator.TenantID).
		Select("name", "unit", "target", "source_type", "verification_source", "specific_objective_id", "sort_order", "updated_at").
		Updates(indicator).Error
}

func (r *MgaRepository) DeleteIndicator(ctx context.Context, indicatorID, projectID, tenantID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", indicatorID, projectID, tenantID).
		Delete(&models.MgaIndicator{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// MgaFullFormulation agrupa todas las entidades MGA de un proyecto.
type MgaFullFormulation struct {
	Causes       []models.MgaCause
	Effects      []models.MgaEffect
	Indicators   []models.MgaIndicator
	Participants []models.MgaParticipant
	Populations  []models.MgaPopulation
	Alternatives []models.MgaAlternative
}

// GetFullFormulation carga en paralelo todas las entidades MGA del proyecto.
func (r *MgaRepository) GetFullFormulation(ctx context.Context, projectID, tenantID uuid.UUID) (*MgaFullFormulation, error) {
	var (
		bundle MgaFullFormulation
		mu     sync.Mutex
		wg     sync.WaitGroup
		first  error
	)

	record := func(err error) {
		if err != nil && first == nil {
			first = err
		}
	}

	run := func(fn func() error) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := fn(); err != nil {
				mu.Lock()
				record(err)
				mu.Unlock()
			}
		}()
	}

	run(func() error {
		causes, err := r.ListCauses(ctx, projectID, tenantID)
		if err != nil {
			return err
		}
		mu.Lock()
		bundle.Causes = causes
		mu.Unlock()
		return nil
	})
	run(func() error {
		effects, err := r.ListEffects(ctx, projectID, tenantID)
		if err != nil {
			return err
		}
		mu.Lock()
		bundle.Effects = effects
		mu.Unlock()
		return nil
	})
	run(func() error {
		indicators, err := r.ListIndicators(ctx, projectID, tenantID)
		if err != nil {
			return err
		}
		mu.Lock()
		bundle.Indicators = indicators
		mu.Unlock()
		return nil
	})
	run(func() error {
		participants, err := r.ListParticipants(ctx, projectID, tenantID)
		if err != nil {
			return err
		}
		mu.Lock()
		bundle.Participants = participants
		mu.Unlock()
		return nil
	})
	run(func() error {
		populations, err := r.ListPopulations(ctx, projectID, tenantID)
		if err != nil {
			return err
		}
		mu.Lock()
		bundle.Populations = populations
		mu.Unlock()
		return nil
	})
	run(func() error {
		alternatives, err := r.ListAlternatives(ctx, projectID, tenantID)
		if err != nil {
			return err
		}
		mu.Lock()
		bundle.Alternatives = alternatives
		mu.Unlock()
		return nil
	})

	wg.Wait()
	if first != nil {
		return nil, first
	}

	return &bundle, nil
}

// --- Efectos ---

func (r *MgaRepository) ListEffects(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.MgaEffect, error) {
	effects := make([]models.MgaEffect, 0)
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("sort_order ASC, created_at ASC").
		Find(&effects).Error
	return effects, err
}

func (r *MgaRepository) FindEffect(ctx context.Context, effectID, projectID, tenantID uuid.UUID) (*models.MgaEffect, error) {
	var effect models.MgaEffect
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", effectID, projectID, tenantID).
		First(&effect).Error
	if err != nil {
		return nil, err
	}
	return &effect, nil
}

func (r *MgaRepository) CreateEffect(ctx context.Context, effect *models.MgaEffect) error {
	return r.db.WithContext(ctx).Create(effect).Error
}

func (r *MgaRepository) UpdateEffect(ctx context.Context, effect *models.MgaEffect) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaEffect{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", effect.ID, effect.ProjectID, effect.TenantID).
		Select("effect_type", "description", "parent_id", "sort_order", "updated_at").
		Updates(effect).Error
}

func (r *MgaRepository) DeleteEffect(ctx context.Context, effectID, projectID, tenantID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", effectID, projectID, tenantID).
		Delete(&models.MgaEffect{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// --- Participantes ---

func (r *MgaRepository) ListParticipants(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.MgaParticipant, error) {
	participants := make([]models.MgaParticipant, 0)
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("created_at ASC").
		Find(&participants).Error
	return participants, err
}

func (r *MgaRepository) FindParticipant(ctx context.Context, participantID, projectID, tenantID uuid.UUID) (*models.MgaParticipant, error) {
	var participant models.MgaParticipant
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", participantID, projectID, tenantID).
		First(&participant).Error
	if err != nil {
		return nil, err
	}
	return &participant, nil
}

func (r *MgaRepository) CreateParticipant(ctx context.Context, participant *models.MgaParticipant) error {
	return r.db.WithContext(ctx).Create(participant).Error
}

func (r *MgaRepository) UpdateParticipant(ctx context.Context, participant *models.MgaParticipant) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaParticipant{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", participant.ID, participant.ProjectID, participant.TenantID).
		Select("actor", "entity", "position", "interests", "contribution", "updated_at").
		Updates(participant).Error
}

func (r *MgaRepository) DeleteParticipant(ctx context.Context, participantID, projectID, tenantID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", participantID, projectID, tenantID).
		Delete(&models.MgaParticipant{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// --- Población ---

func (r *MgaRepository) ListPopulations(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.MgaPopulation, error) {
	populations := make([]models.MgaPopulation, 0)
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("population_type ASC, created_at ASC").
		Find(&populations).Error
	return populations, err
}

func (r *MgaRepository) FindPopulation(ctx context.Context, populationID, projectID, tenantID uuid.UUID) (*models.MgaPopulation, error) {
	var population models.MgaPopulation
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", populationID, projectID, tenantID).
		First(&population).Error
	if err != nil {
		return nil, err
	}
	return &population, nil
}

func (r *MgaRepository) CreatePopulation(ctx context.Context, population *models.MgaPopulation) error {
	return r.db.WithContext(ctx).Create(population).Error
}

func (r *MgaRepository) UpdatePopulation(ctx context.Context, population *models.MgaPopulation) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaPopulation{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", population.ID, population.ProjectID, population.TenantID).
		Select("population_type", "total_number", "source", "locations", "updated_at").
		Updates(population).Error
}

func (r *MgaRepository) DeletePopulation(ctx context.Context, populationID, projectID, tenantID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", populationID, projectID, tenantID).
		Delete(&models.MgaPopulation{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// --- Alternativas ---

func (r *MgaRepository) ListAlternatives(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.MgaAlternative, error) {
	alternatives := make([]models.MgaAlternative, 0)
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("created_at ASC").
		Find(&alternatives).Error
	return alternatives, err
}

func (r *MgaRepository) FindAlternative(ctx context.Context, alternativeID, projectID, tenantID uuid.UUID) (*models.MgaAlternative, error) {
	var alternative models.MgaAlternative
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", alternativeID, projectID, tenantID).
		First(&alternative).Error
	if err != nil {
		return nil, err
	}
	return &alternative, nil
}

func (r *MgaRepository) CreateAlternative(ctx context.Context, alternative *models.MgaAlternative) error {
	return r.db.WithContext(ctx).Create(alternative).Error
}

func (r *MgaRepository) UpdateAlternative(ctx context.Context, alternative *models.MgaAlternative) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaAlternative{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", alternative.ID, alternative.ProjectID, alternative.TenantID).
		Select("description", "evaluate_profitability", "evaluate_cost", "proceeds_to_preparation", "updated_at").
		Updates(alternative).Error
}

func (r *MgaRepository) DeleteAlternative(ctx context.Context, alternativeID, projectID, tenantID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", alternativeID, projectID, tenantID).
		Delete(&models.MgaAlternative{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func IsMgaNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
