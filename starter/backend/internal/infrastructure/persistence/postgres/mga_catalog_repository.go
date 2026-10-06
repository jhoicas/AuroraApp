package postgres

import (
	"context"
	"strconv"
	"strings"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// MgaCatalogRepository gestiona los catálogos globales de actores, entidades y posiciones MGA.
// Estas tablas son globales (no tienen tenant_id) porque provienen del DNP.
type MgaCatalogRepository struct {
	db *gorm.DB
}

func NewMgaCatalogRepository(db *gorm.DB) *MgaCatalogRepository {
	return &MgaCatalogRepository{db: db}
}

// --- Actores ---

func (r *MgaCatalogRepository) ListActors(ctx context.Context) ([]models.MgaCatalogActor, error) {
	var actors []models.MgaCatalogActor
	err := r.db.WithContext(ctx).Order("id ASC").Find(&actors).Error
	return actors, err
}

func (r *MgaCatalogRepository) FindActor(ctx context.Context, id int) (*models.MgaCatalogActor, error) {
	var actor models.MgaCatalogActor
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&actor).Error
	if err != nil {
		return nil, err
	}
	return &actor, nil
}

func (r *MgaCatalogRepository) CreateActor(ctx context.Context, actor *models.MgaCatalogActor) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "updated_at"}),
	}).Create(actor).Error
}

func (r *MgaCatalogRepository) UpdateActor(ctx context.Context, actor *models.MgaCatalogActor) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaCatalogActor{}).
		Where("id = ?", actor.ID).
		Select("name", "updated_at").
		Updates(actor).Error
}

func (r *MgaCatalogRepository) DeleteActor(ctx context.Context, id int) error {
	result := r.db.WithContext(ctx).Where("id = ?", id).Delete(&models.MgaCatalogActor{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// --- Entidades ---

func (r *MgaCatalogRepository) ListEntities(ctx context.Context) ([]models.MgaCatalogEntity, error) {
	var entities []models.MgaCatalogEntity
	err := r.db.WithContext(ctx).Order("actor_id ASC, id ASC").Find(&entities).Error
	return entities, err
}

// ListEntitiesPage devuelve una página de entidades. actorID>0 filtra por actor; search busca
// (sin distinguir mayúsculas) en el nombre o, si es numérico, en el id.
func (r *MgaCatalogRepository) ListEntitiesPage(ctx context.Context, actorID int, search string, page, limit int) ([]models.MgaCatalogEntity, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	q := r.db.WithContext(ctx).Model(&models.MgaCatalogEntity{})
	if actorID > 0 {
		q = q.Where("actor_id = ?", actorID)
	}
	if term := strings.ToLower(strings.TrimSpace(search)); term != "" {
		like := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(term) + "%"
		if id, err := strconv.Atoi(term); err == nil {
			q = q.Where(`LOWER(name) LIKE ? ESCAPE '\' OR id = ?`, like, id)
		} else {
			q = q.Where(`LOWER(name) LIKE ? ESCAPE '\'`, like)
		}
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var entities []models.MgaCatalogEntity
	err := q.Order("actor_id ASC, id ASC").Limit(limit).Offset((page - 1) * limit).Find(&entities).Error
	return entities, total, err
}

func (r *MgaCatalogRepository) ListEntitiesByActor(ctx context.Context, actorID int) ([]models.MgaCatalogEntity, error) {
	var entities []models.MgaCatalogEntity
	err := r.db.WithContext(ctx).
		Where("actor_id = ?", actorID).
		Order("id ASC").
		Find(&entities).Error
	return entities, err
}

func (r *MgaCatalogRepository) FindEntity(ctx context.Context, id int) (*models.MgaCatalogEntity, error) {
	var entity models.MgaCatalogEntity
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&entity).Error
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

func (r *MgaCatalogRepository) CreateEntity(ctx context.Context, entity *models.MgaCatalogEntity) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"actor_id", "name", "updated_at"}),
	}).Create(entity).Error
}

func (r *MgaCatalogRepository) UpdateEntity(ctx context.Context, entity *models.MgaCatalogEntity) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaCatalogEntity{}).
		Where("id = ?", entity.ID).
		Select("actor_id", "name", "updated_at").
		Updates(entity).Error
}

func (r *MgaCatalogRepository) DeleteEntity(ctx context.Context, id int) error {
	result := r.db.WithContext(ctx).Where("id = ?", id).Delete(&models.MgaCatalogEntity{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// --- Posiciones ---

func (r *MgaCatalogRepository) ListPositions(ctx context.Context) ([]models.MgaCatalogPosition, error) {
	var positions []models.MgaCatalogPosition
	err := r.db.WithContext(ctx).Order("id ASC").Find(&positions).Error
	return positions, err
}

func (r *MgaCatalogRepository) FindPosition(ctx context.Context, id int) (*models.MgaCatalogPosition, error) {
	var position models.MgaCatalogPosition
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&position).Error
	if err != nil {
		return nil, err
	}
	return &position, nil
}

func (r *MgaCatalogRepository) CreatePosition(ctx context.Context, position *models.MgaCatalogPosition) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "updated_at"}),
	}).Create(position).Error
}

func (r *MgaCatalogRepository) UpdatePosition(ctx context.Context, position *models.MgaCatalogPosition) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaCatalogPosition{}).
		Where("id = ?", position.ID).
		Select("name", "updated_at").
		Updates(position).Error
}

func (r *MgaCatalogRepository) DeletePosition(ctx context.Context, id int) error {
	result := r.db.WithContext(ctx).Where("id = ?", id).Delete(&models.MgaCatalogPosition{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// IsMgaCatalogNotFound reporta si el error corresponde a registro no encontrado.
func IsMgaCatalogNotFound(err error) bool {
	return err == gorm.ErrRecordNotFound
}
