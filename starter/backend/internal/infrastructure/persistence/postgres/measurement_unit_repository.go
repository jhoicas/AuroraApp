package postgres

import (
	"context"
	"errors"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

type MeasurementUnitRepository struct {
	db *gorm.DB
}

func NewMeasurementUnitRepository(db *gorm.DB) *MeasurementUnitRepository {
	return &MeasurementUnitRepository{db: db}
}

type MeasurementUnitListParams struct {
	Search string
	Page   int
	Limit  int
}

type PaginatedMeasurementUnits struct {
	Items    []models.MeasurementUnit
	Total    int64
	Page     int
	Limit    int
	LastPage int
}

func (r *MeasurementUnitRepository) ListAll(ctx context.Context) ([]models.MeasurementUnit, error) {
	var units []models.MeasurementUnit
	err := r.db.WithContext(ctx).
		Order("name ASC").
		Find(&units).Error
	return units, err
}

func (r *MeasurementUnitRepository) ListPaginated(ctx context.Context, params MeasurementUnitListParams) (*PaginatedMeasurementUnits, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 {
		params.Limit = 10
	}
	if params.Limit > 100 {
		params.Limit = 100
	}

	query := r.db.WithContext(ctx).Model(&models.MeasurementUnit{})
	if strings.TrimSpace(params.Search) != "" {
		s := "%" + strings.TrimSpace(params.Search) + "%"
		query = query.Where("name ILIKE ?", s)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	var items []models.MeasurementUnit
	offset := (params.Page - 1) * params.Limit
	if err := query.Order("id ASC").Offset(offset).Limit(params.Limit).Find(&items).Error; err != nil {
		return nil, err
	}

	lastPage := int((total + int64(params.Limit) - 1) / int64(params.Limit))
	if lastPage < 1 {
		lastPage = 1
	}

	return &PaginatedMeasurementUnits{
		Items:    items,
		Total:    total,
		Page:     params.Page,
		Limit:    params.Limit,
		LastPage: lastPage,
	}, nil
}

func (r *MeasurementUnitRepository) GetByID(ctx context.Context, id int) (*models.MeasurementUnit, error) {
	var unit models.MeasurementUnit
	if err := r.db.WithContext(ctx).First(&unit, id).Error; err != nil {
		return nil, err
	}
	return &unit, nil
}

func (r *MeasurementUnitRepository) Create(ctx context.Context, unit *models.MeasurementUnit) error {
	if unit.ID <= 0 {
		var maxID int
		row := r.db.WithContext(ctx).Model(&models.MeasurementUnit{}).Select("COALESCE(MAX(id), 0)").Row()
		_ = row.Scan(&maxID)
		unit.ID = maxID + 1
	}
	now := time.Now().UTC()
	unit.CreatedAt = now
	unit.UpdatedAt = now
	return r.db.WithContext(ctx).Create(unit).Error
}

func (r *MeasurementUnitRepository) Update(ctx context.Context, unit *models.MeasurementUnit) error {
	unit.UpdatedAt = time.Now().UTC()
	res := r.db.WithContext(ctx).Model(&models.MeasurementUnit{}).
		Where("id = ?", unit.ID).
		Updates(map[string]interface{}{
			"name":       unit.Name,
			"updated_at": unit.UpdatedAt,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *MeasurementUnitRepository) Delete(ctx context.Context, id int) error {
	res := r.db.WithContext(ctx).Delete(&models.MeasurementUnit{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func IsMeasurementUnitNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
