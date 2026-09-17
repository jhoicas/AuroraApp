package postgres

import (
	"context"
	"math"
	"strings"

	"aurora-backend/internal/domain/models"
)

type PndListParams struct {
	Page   int
	Limit  int
	Search string
}

type PndListResult struct {
	Items    []models.PNDCatalog
	Total    int64
	Page     int
	Limit    int
	LastPage int
}

func (r *CatalogRepository) ListPndCatalogs(ctx context.Context, p PndListParams) (*PndListResult, error) {
	page := p.Page
	if page < 1 {
		page = 1
	}
	limit := p.Limit
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit

	q := r.db.WithContext(ctx).Model(&models.PNDCatalog{})
	if search := strings.TrimSpace(p.Search); search != "" {
		likeSearch := "%" + search + "%"
		q = q.Where("pillar_description ILIKE ? OR objective_description ILIKE ? OR strategy_description ILIKE ? OR component_description ILIKE ?",
			likeSearch, likeSearch, likeSearch, likeSearch)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, err
	}

	var items []models.PNDCatalog
	if err := q.Order("id asc").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, err
	}

	lastPage := int(math.Ceil(float64(total) / float64(limit)))

	return &PndListResult{
		Items:    items,
		Total:    total,
		Page:     page,
		Limit:    limit,
		LastPage: lastPage,
	}, nil
}

func (r *CatalogRepository) BulkInsertPnd(ctx context.Context, items []models.PNDCatalog) error {
	if len(items) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(items, 100).Error
}
