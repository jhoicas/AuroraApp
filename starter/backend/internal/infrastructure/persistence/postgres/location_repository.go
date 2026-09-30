package postgres

import (
	"context"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

type LocationRepository struct {
	db *gorm.DB
}

func NewLocationRepository(db *gorm.DB) *LocationRepository {
	return &LocationRepository{db: db}
}

func (r *LocationRepository) ListRegions(ctx context.Context) ([]models.Region, error) {
	var regions []models.Region
	err := r.db.WithContext(ctx).Where("is_active = ?", true).Order("id ASC").Find(&regions).Error
	return regions, err
}

func (r *LocationRepository) ListDepartmentsByRegion(ctx context.Context, regionId int) ([]models.Departamento, error) {
	var departments []models.Departamento
	err := r.db.WithContext(ctx).Where("region_id = ? AND is_active = ?", regionId, true).Order("id ASC").Find(&departments).Error
	return departments, err
}

func (r *LocationRepository) ListMunicipalitiesByDepartment(ctx context.Context, departmentId int) ([]models.Municipio, error) {
	var municipalities []models.Municipio
	err := r.db.WithContext(ctx).Where("departamento_id = ? AND is_active = ?", departmentId, true).Order("id ASC").Find(&municipalities).Error
	return municipalities, err
}

// GroupingResult represents a grouping and its associated grouping type
type GroupingResult struct {
	ID               int    `json:"id"`
	Name             string `json:"name"`
	TipoAgrupacionID int    `json:"tipo_agrupacion_id"`
	TipoAgrupacion   string `json:"tipo_agrupacion"`
}

func (r *LocationRepository) ListGroupingsByMunicipality(ctx context.Context, municipalityId int) ([]GroupingResult, error) {
	var results []GroupingResult
	
	err := r.db.WithContext(ctx).
		Table("agrupaciones a").
		Select("a.id, a.name, a.tipo_agrupacion_id, t.name as tipo_agrupacion").
		Joins("JOIN tipos_agrupacion t ON a.tipo_agrupacion_id = t.id").
		Where("a.municipio_id = ? AND a.is_active = ? AND t.is_active = ?", municipalityId, true, true).
		Order("t.id ASC, a.id ASC").
		Scan(&results).Error
		
	return results, err
}
