package postgres

import (
	"context"
	"sync"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectEdtRepository persiste la cadena de valor EDT por proyecto (multi-tenant).
type ProjectEdtRepository struct {
	db *gorm.DB
}

func NewProjectEdtRepository(db *gorm.DB) *ProjectEdtRepository {
	return &ProjectEdtRepository{db: db}
}

// ProjectEdtChain agrupa todas las entidades EDT de un proyecto.
type ProjectEdtChain struct {
	CatalogLink  *models.ProjectCatalogLink
	EdtNodes     []models.ProjectEdtNode
	Deliverables []models.ProjectDeliverable
	Activities   []models.ProjectActivity
}

func (r *ProjectEdtRepository) FindCatalogLink(
	ctx context.Context,
	projectID, tenantID uuid.UUID,
) (*models.ProjectCatalogLink, error) {
	var link models.ProjectCatalogLink
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		First(&link).Error
	if err != nil {
		return nil, err
	}
	return &link, nil
}

func (r *ProjectEdtRepository) UpsertCatalogLink(
	ctx context.Context,
	link *models.ProjectCatalogLink,
) error {
	var existing models.ProjectCatalogLink
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", link.ProjectID, link.TenantID).
		First(&existing).Error

	if err == nil {
		link.ID = existing.ID
		link.CreatedAt = existing.CreatedAt
		return r.db.WithContext(ctx).
			Model(&models.ProjectCatalogLink{}).
			Where("id = ? AND project_id = ? AND tenant_id = ?", link.ID, link.ProjectID, link.TenantID).
			Select(
				"product_id", "product_code", "tipologia", "requires_edt",
				"sector_code", "program_code", "updated_at",
			).
			Updates(link).Error
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	return r.db.WithContext(ctx).Create(link).Error
}

func (r *ProjectEdtRepository) ListEdtNodes(
	ctx context.Context,
	projectID, tenantID uuid.UUID,
) ([]models.ProjectEdtNode, error) {
	nodes := make([]models.ProjectEdtNode, 0)
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("level ASC, code ASC, created_at ASC").
		Find(&nodes).Error
	return nodes, err
}

func (r *ProjectEdtRepository) FindEdtNode(
	ctx context.Context,
	nodeID, projectID, tenantID uuid.UUID,
) (*models.ProjectEdtNode, error) {
	var node models.ProjectEdtNode
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", nodeID, projectID, tenantID).
		First(&node).Error
	if err != nil {
		return nil, err
	}
	return &node, nil
}

func (r *ProjectEdtRepository) CreateEdtNode(ctx context.Context, node *models.ProjectEdtNode) error {
	return r.db.WithContext(ctx).Create(node).Error
}

func (r *ProjectEdtRepository) UpdateEdtNode(ctx context.Context, node *models.ProjectEdtNode) error {
	return r.db.WithContext(ctx).
		Model(&models.ProjectEdtNode{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", node.ID, node.ProjectID, node.TenantID).
		Select("catalog_edt_id", "code", "level", "name", "updated_at").
		Updates(node).Error
}

func (r *ProjectEdtRepository) DeleteEdtNode(
	ctx context.Context,
	nodeID, projectID, tenantID uuid.UUID,
) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", nodeID, projectID, tenantID).
		Delete(&models.ProjectEdtNode{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *ProjectEdtRepository) ListDeliverables(
	ctx context.Context,
	projectID, tenantID uuid.UUID,
) ([]models.ProjectDeliverable, error) {
	items := make([]models.ProjectDeliverable, 0)
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("code ASC, created_at ASC").
		Find(&items).Error
	return items, err
}

func (r *ProjectEdtRepository) FindDeliverable(
	ctx context.Context,
	deliverableID, projectID, tenantID uuid.UUID,
) (*models.ProjectDeliverable, error) {
	var item models.ProjectDeliverable
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", deliverableID, projectID, tenantID).
		First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *ProjectEdtRepository) CreateDeliverable(ctx context.Context, item *models.ProjectDeliverable) error {
	return r.db.WithContext(ctx).Create(item).Error
}

func (r *ProjectEdtRepository) UpdateDeliverable(ctx context.Context, item *models.ProjectDeliverable) error {
	return r.db.WithContext(ctx).
		Model(&models.ProjectDeliverable{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", item.ID, item.ProjectID, item.TenantID).
		Select("project_edt_node_id", "catalog_deliverable_id", "code", "name", "amount", "updated_at").
		Updates(item).Error
}

func (r *ProjectEdtRepository) DeleteDeliverable(
	ctx context.Context,
	deliverableID, projectID, tenantID uuid.UUID,
) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", deliverableID, projectID, tenantID).
		Delete(&models.ProjectDeliverable{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *ProjectEdtRepository) ListActivities(
	ctx context.Context,
	projectID, tenantID uuid.UUID,
) ([]models.ProjectActivity, error) {
	items := make([]models.ProjectActivity, 0)
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("code ASC, created_at ASC").
		Find(&items).Error
	return items, err
}

func (r *ProjectEdtRepository) FindActivity(
	ctx context.Context,
	activityID, projectID, tenantID uuid.UUID,
) (*models.ProjectActivity, error) {
	var item models.ProjectActivity
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", activityID, projectID, tenantID).
		First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *ProjectEdtRepository) CreateActivity(ctx context.Context, item *models.ProjectActivity) error {
	return r.db.WithContext(ctx).Create(item).Error
}

func (r *ProjectEdtRepository) UpdateActivity(ctx context.Context, item *models.ProjectActivity) error {
	return r.db.WithContext(ctx).
		Model(&models.ProjectActivity{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", item.ID, item.ProjectID, item.TenantID).
		Select(
			"project_deliverable_id", "catalog_activity_id", "code", "name",
			"quantity", "unit_cost", "total_cost", "updated_at",
		).
		Updates(item).Error
}

func (r *ProjectEdtRepository) DeleteActivity(
	ctx context.Context,
	activityID, projectID, tenantID uuid.UUID,
) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", activityID, projectID, tenantID).
		Delete(&models.ProjectActivity{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// GetEdtChain carga en paralelo el vínculo de catálogo, nodos, entregables y actividades.
func (r *ProjectEdtRepository) GetEdtChain(
	ctx context.Context,
	projectID, tenantID uuid.UUID,
) (*ProjectEdtChain, error) {
	var (
		chain ProjectEdtChain
		mu    sync.Mutex
		wg    sync.WaitGroup
		first error
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
		link, err := r.FindCatalogLink(ctx, projectID, tenantID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		mu.Lock()
		chain.CatalogLink = link
		mu.Unlock()
		return nil
	})

	run(func() error {
		nodes, err := r.ListEdtNodes(ctx, projectID, tenantID)
		if err != nil {
			return err
		}
		mu.Lock()
		chain.EdtNodes = nodes
		mu.Unlock()
		return nil
	})

	run(func() error {
		deliverables, err := r.ListDeliverables(ctx, projectID, tenantID)
		if err != nil {
			return err
		}
		mu.Lock()
		chain.Deliverables = deliverables
		mu.Unlock()
		return nil
	})

	run(func() error {
		activities, err := r.ListActivities(ctx, projectID, tenantID)
		if err != nil {
			return err
		}
		mu.Lock()
		chain.Activities = activities
		mu.Unlock()
		return nil
	})

	wg.Wait()
	if first != nil {
		return nil, first
	}
	return &chain, nil
}
