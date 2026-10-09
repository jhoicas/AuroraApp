package postgres

import (
	"context"
	"errors"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

type ProducedGoodRepository struct {
	db *gorm.DB
}

func NewProducedGoodRepository(db *gorm.DB) *ProducedGoodRepository {
	return &ProducedGoodRepository{db: db}
}

type ProducedGoodListParams struct {
	Search string
	Page   int
	Limit  int
}

type PaginatedProducedGoods struct {
	Items    []models.ProducedGood
	Total    int64
	Page     int
	Limit    int
	LastPage int
}

func (r *ProducedGoodRepository) ListAll(ctx context.Context) ([]models.ProducedGood, error) {
	goods := []models.ProducedGood{}
	err := r.db.WithContext(ctx).Order("description ASC").Find(&goods).Error
	return goods, err
}

func (r *ProducedGoodRepository) ListPaginated(ctx context.Context, params ProducedGoodListParams) (*PaginatedProducedGoods, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 {
		params.Limit = 10
	}
	if params.Limit > 100 {
		params.Limit = 100
	}

	query := r.db.WithContext(ctx).Model(&models.ProducedGood{})
	if s := strings.TrimSpace(params.Search); s != "" {
		query = query.Where("description ILIKE ?", "%"+s+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	items := []models.ProducedGood{}
	offset := (params.Page - 1) * params.Limit
	if err := query.Order("description ASC, id ASC").Offset(offset).Limit(params.Limit).Find(&items).Error; err != nil {
		return nil, err
	}

	lastPage := int((total + int64(params.Limit) - 1) / int64(params.Limit))
	if lastPage < 1 {
		lastPage = 1
	}

	return &PaginatedProducedGoods{Items: items, Total: total, Page: params.Page, Limit: params.Limit, LastPage: lastPage}, nil
}

func (r *ProducedGoodRepository) Create(ctx context.Context, good *models.ProducedGood) error {
	now := time.Now().UTC()
	good.CreatedAt = now
	good.UpdatedAt = now
	return r.db.WithContext(ctx).Create(good).Error
}

func (r *ProducedGoodRepository) Update(ctx context.Context, good *models.ProducedGood) error {
	good.UpdatedAt = time.Now().UTC()
	res := r.db.WithContext(ctx).Model(&models.ProducedGood{}).
		Where("id = ?", good.ID).
		Updates(map[string]interface{}{
			"description": good.Description,
			"rpc":         good.Rpc,
			"updated_at":  good.UpdatedAt,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *ProducedGoodRepository) Delete(ctx context.Context, id uint) error {
	res := r.db.WithContext(ctx).Delete(&models.ProducedGood{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func IsProducedGoodNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
