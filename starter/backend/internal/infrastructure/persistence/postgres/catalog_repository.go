package postgres

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SectorListParams filtros de listado paginado.
type SectorListParams struct {
	Page   int
	Limit  int
	Search string
}

// SectorListResult resultado del listado.
type SectorListResult struct {
	Items    []models.Sector
	Total    int64
	Page     int
	Limit    int
	LastPage int
}

// CatalogRepository acceso a catálogo DNP (sectores, etc.).
type CatalogRepository struct {
	db *gorm.DB
}

func NewCatalogRepository(db *gorm.DB) *CatalogRepository {
	return &CatalogRepository{db: db}
}

// ListSectors lista sectores con búsqueda ILIKE y paginación (limit 5|10|20).
func (r *CatalogRepository) ListSectors(ctx context.Context, p SectorListParams) (*SectorListResult, error) {
	page := p.Page
	if page < 1 {
		page = 1
	}
	limit := normalizeCatalogLimit(p.Limit)
	offset := (page - 1) * limit

	q := r.db.WithContext(ctx).Model(&models.Sector{})
	if search := strings.TrimSpace(p.Search); search != "" {
		pattern := "%" + escapeILIKE(search) + "%"
		q = q.Where(
			"(code ILIKE ? ESCAPE '\\' OR name ILIKE ? ESCAPE '\\')",
			pattern, pattern,
		)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count sectors: %w", err)
	}

	items := make([]models.Sector, 0, limit)
	if err := q.Order("code ASC").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list sectors: %w", err)
	}

	lastPage := int(math.Ceil(float64(total) / float64(limit)))
	if lastPage == 0 {
		lastPage = 1
	}

	return &SectorListResult{
		Items:    items,
		Total:    total,
		Page:     page,
		Limit:    limit,
		LastPage: lastPage,
	}, nil
}

// UpsertSectorByCode inserta o actualiza un sector por código único.
// Devuelve created=true si fue inserción.
func (r *CatalogRepository) UpsertSectorByCode(ctx context.Context, sector *models.Sector) (created bool, err error) {
	now := time.Now().UTC()
	var existing models.Sector
	err = r.db.WithContext(ctx).Where("code = ?", sector.Code).First(&existing).Error
	if err == nil {
		existing.Name = sector.Name
		existing.Application = sector.Application
		existing.Observations = sector.Observations
		existing.UpdatedAt = now
		if err := r.db.WithContext(ctx).
			Model(&existing).
			Select("Name", "Application", "Observations", "UpdatedAt").
			Updates(&existing).Error; err != nil {
			return false, err
		}
		*sector = existing
		return false, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, err
	}

	if sector.ID == uuid.Nil {
		sector.ID = uuid.New()
	}
	sector.CreatedAt = now
	sector.UpdatedAt = now
	if err := r.db.WithContext(ctx).Create(sector).Error; err != nil {
		// Carrera: otro proceso insertó el mismo code.
		if err2 := r.db.WithContext(ctx).
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "code"}},
				DoUpdates: clause.AssignmentColumns([]string{"name", "application", "observations", "updated_at"}),
			}).Create(sector).Error; err2 != nil {
			return false, err2
		}
		return false, nil
	}
	return true, nil
}

// ProgramListParams filtros para programas_subprogramas.
type ProgramListParams struct {
	Page   int
	Limit  int
	Search string
}

// ProgramListResult resultado paginado.
type ProgramListResult struct {
	Items    []models.ProgramSubprogram
	Total    int64
	Page     int
	Limit    int
	LastPage int
}

// ListProgramsSubprograms lista con búsqueda ILIKE y paginación (5|10|20).
func (r *CatalogRepository) ListProgramsSubprograms(ctx context.Context, p ProgramListParams) (*ProgramListResult, error) {
	page := p.Page
	if page < 1 {
		page = 1
	}
	limit := normalizeCatalogLimit(p.Limit)
	offset := (page - 1) * limit

	q := r.db.WithContext(ctx).Model(&models.ProgramSubprogram{})
	if search := strings.TrimSpace(p.Search); search != "" {
		pattern := "%" + escapeILIKE(search) + "%"
		q = q.Where(
			`(nombre_programa ILIKE ? ESCAPE '\' OR codigo_programa ILIKE ? ESCAPE '\' OR
			  nombre_subprograma ILIKE ? ESCAPE '\' OR nombre_sector ILIKE ? ESCAPE '\')`,
			pattern, pattern, pattern, pattern,
		)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count programas_subprogramas: %w", err)
	}

	items := make([]models.ProgramSubprogram, 0, limit)
	if err := q.Order("codigo_programa ASC, codigo_subprograma ASC").
		Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list programas_subprogramas: %w", err)
	}

	lastPage := int(math.Ceil(float64(total) / float64(limit)))
	if lastPage == 0 {
		lastPage = 1
	}

	return &ProgramListResult{
		Items:    items,
		Total:    total,
		Page:     page,
		Limit:    limit,
		LastPage: lastPage,
	}, nil
}

// FindSectorIDByCode resuelve sector_id por código DNP.
func (r *CatalogRepository) FindSectorIDByCode(ctx context.Context, code string) (uuid.UUID, error) {
	var sector models.Sector
	err := r.db.WithContext(ctx).Select("id").Where("code = ?", strings.TrimSpace(code)).First(&sector).Error
	if err != nil {
		return uuid.Nil, err
	}
	return sector.ID, nil
}

// UpsertProgramSubprogramByCode inserta/actualiza por (codigo_programa, codigo_subprograma).
func (r *CatalogRepository) UpsertProgramSubprogramByCode(ctx context.Context, item *models.ProgramSubprogram) (created bool, err error) {
	now := time.Now().UTC()
	var existing models.ProgramSubprogram
	err = r.db.WithContext(ctx).
		Where("codigo_programa = ? AND codigo_subprograma = ?", item.CodigoPrograma, item.CodigoSubprograma).
		First(&existing).Error
	if err == nil {
		existing.TenantID = item.TenantID
		existing.SectorID = item.SectorID
		existing.CodigoSector = item.CodigoSector
		existing.NombreSector = item.NombreSector
		existing.NombrePrograma = item.NombrePrograma
		existing.AmbitoAplicacion = item.AmbitoAplicacion
		existing.NombreSubprograma = item.NombreSubprograma
		existing.Observaciones = item.Observaciones
		if err := r.db.WithContext(ctx).
			Model(&existing).
			Select(
				"TenantID", "SectorID", "CodigoSector", "NombreSector",
				"NombrePrograma", "AmbitoAplicacion", "NombreSubprograma", "Observaciones",
			).
			Updates(&existing).Error; err != nil {
			return false, err
		}
		*item = existing
		return false, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, err
	}

	if item.ID == uuid.Nil {
		item.ID = uuid.New()
	}
	item.CreatedAt = now
	if err := r.db.WithContext(ctx).Create(item).Error; err != nil {
		return false, err
	}
	return true, nil
}

func normalizeCatalogLimit(limit int) int {
	switch limit {
	case 5, 10, 20:
		return limit
	default:
		return 10
	}
}

func escapeILIKE(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}
