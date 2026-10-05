package postgres

import (
	"context"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// --- Necesidades ---

// ListNeeds lista las necesidades del proyecto; alternativeID vacío no filtra por alternativa.
func (r *MgaRepository) ListNeeds(ctx context.Context, projectID, tenantID uuid.UUID, alternativeID string) ([]models.MgaNeed, error) {
	needs := make([]models.MgaNeed, 0)
	q := r.db.WithContext(ctx).Where("project_id = ? AND tenant_id = ?", projectID, tenantID)
	if alternativeID != "" {
		q = q.Where("alternative_id = ?", alternativeID)
	}
	err := q.Order("created_at ASC").Find(&needs).Error
	return needs, err
}

func (r *MgaRepository) FindNeed(ctx context.Context, needID, projectID, tenantID uuid.UUID) (*models.MgaNeed, error) {
	var need models.MgaNeed
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", needID, projectID, tenantID).
		First(&need).Error
	if err != nil {
		return nil, err
	}
	return &need, nil
}

func (r *MgaRepository) CreateNeed(ctx context.Context, need *models.MgaNeed) error {
	return r.db.WithContext(ctx).Create(need).Error
}

func (r *MgaRepository) UpdateNeed(ctx context.Context, need *models.MgaNeed) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaNeed{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", need.ID, need.ProjectID, need.TenantID).
		Select("bien_servicio", "descripcion", "descripcion_oferta", "descripcion_demanda",
			"unidad_medida_id", "anio_inicial", "anio_final", "ultimo_anio_proyectado",
			"valores_anuales", "updated_at").
		Updates(need).Error
}

// UpdateNeedAnnualValue guarda oferta/demanda de un año dentro del JSONB valores_anuales.
// Lee con FOR UPDATE dentro de una transacción para que dos filas guardadas casi a la vez
// no se pisen entre sí (read-modify-write sobre la misma columna).
func (r *MgaRepository) UpdateNeedAnnualValue(ctx context.Context, needID, projectID, tenantID uuid.UUID, anio int, oferta, demanda float64) (*models.MgaNeed, error) {
	var need models.MgaNeed
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND project_id = ? AND tenant_id = ?", needID, projectID, tenantID).
			First(&need).Error; err != nil {
			return err
		}

		series, err := services.ParseNeedSeries(need.ValoresAnuales)
		if err != nil {
			return err
		}
		series, err = services.SetNeedAnnualValue(series, anio, oferta, demanda)
		if err != nil {
			return err
		}
		raw, err := services.MarshalNeedSeries(series)
		if err != nil {
			return err
		}

		need.ValoresAnuales = raw
		need.UpdatedAt = time.Now().UTC()
		return tx.Model(&models.MgaNeed{}).
			Where("id = ?", need.ID).
			Select("valores_anuales", "updated_at").
			Updates(&need).Error
	})
	if err != nil {
		return nil, err
	}
	return &need, nil
}

func (r *MgaRepository) DeleteNeed(ctx context.Context, needID, projectID, tenantID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", needID, projectID, tenantID).
		Delete(&models.MgaNeed{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
