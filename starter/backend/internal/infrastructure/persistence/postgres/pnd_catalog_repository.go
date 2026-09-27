package postgres

import (
	"context"
	"fmt"
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
		likeOp := "ILIKE"
		if r.db.Dialector.Name() == "sqlite" {
			likeOp = "LIKE"
		}
		condition := fmt.Sprintf(
			"plan_name %[1]s ? OR pillar_description %[1]s ? OR objective_description %[1]s ? OR strategy_description %[1]s ? OR component_description %[1]s ?",
			likeOp,
		)
		likeSearch := "%" + search + "%"
		q = q.Where(condition, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count pnd_catalog: %w", err)
	}

	var items []models.PNDCatalog
	if err := q.Order("id asc").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list pnd_catalog: %w", err)
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
