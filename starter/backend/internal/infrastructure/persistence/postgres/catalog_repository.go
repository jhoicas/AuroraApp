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

// ErrSectorNotFound indica que no existe un sector con el código indicado.
var ErrSectorNotFound = errors.New("sector not found")

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
	if sector == nil {
		return false, fmt.Errorf("sector is nil")
	}
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
// Si el sector no existe, retorna ErrSectorNotFound (nunca un ID nulo usable).
func (r *CatalogRepository) FindSectorIDByCode(ctx context.Context, code string) (uuid.UUID, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return uuid.Nil, fmt.Errorf("%w: código vacío", ErrSectorNotFound)
	}
	var sector models.Sector
	err := r.db.WithContext(ctx).Select("id").Where("code = ?", code).First(&sector).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return uuid.Nil, fmt.Errorf("%w: código %s", ErrSectorNotFound, code)
		}
		return uuid.Nil, err
	}
	if sector.ID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("%w: código %s", ErrSectorNotFound, code)
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

// CatalogProductListParams filtros para catalogo_productos.
type CatalogProductListParams struct {
	Page   int
	Limit  int
	Search string
}

// CatalogProductListResult resultado paginado.
type CatalogProductListResult struct {
	Items    []models.CatalogProduct
	Total    int64
	Page     int
	Limit    int
	LastPage int
}

// ListCatalogProducts lista con búsqueda ILIKE y paginación (5|10|20).
func (r *CatalogRepository) ListCatalogProducts(ctx context.Context, p CatalogProductListParams) (*CatalogProductListResult, error) {
	page := p.Page
	if page < 1 {
		page = 1
	}
	limit := normalizeCatalogLimit(p.Limit)
	offset := (page - 1) * limit

	q := r.db.WithContext(ctx).Model(&models.CatalogProduct{})
	if search := strings.TrimSpace(p.Search); search != "" {
		pattern := "%" + escapeILIKE(search) + "%"
		q = q.Where(
			`(producto ILIKE ? ESCAPE '\' OR codigo_producto ILIKE ? ESCAPE '\' OR
			  nombre_programa ILIKE ? ESCAPE '\' OR codigo_programa ILIKE ? ESCAPE '\' OR
			  nombre_sector ILIKE ? ESCAPE '\' OR sector ILIKE ? ESCAPE '\' OR
			  indicador_producto ILIKE ? ESCAPE '\')`,
			pattern, pattern, pattern, pattern, pattern, pattern, pattern,
		)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count catalogo_productos: %w", err)
	}

	items := make([]models.CatalogProduct, 0, limit)
	if err := q.Order("codigo_producto ASC").
		Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list catalogo_productos: %w", err)
	}

	lastPage := int(math.Ceil(float64(total) / float64(limit)))
	if lastPage == 0 {
		lastPage = 1
	}

	return &CatalogProductListResult{
		Items:    items,
		Total:    total,
		Page:     page,
		Limit:    limit,
		LastPage: lastPage,
	}, nil
}

// UpsertCatalogProductByCode inserta/actualiza por codigo_producto.
func (r *CatalogRepository) UpsertCatalogProductByCode(ctx context.Context, item *models.CatalogProduct) (created bool, err error) {
	now := time.Now().UTC()
	var existing models.CatalogProduct
	err = r.db.WithContext(ctx).
		Where("codigo_producto = ?", item.CodigoProducto).
		First(&existing).Error
	if err == nil {
		existing.TenantID = item.TenantID
		existing.Sector = item.Sector
		existing.NombreSector = item.NombreSector
		existing.CodigoPrograma = item.CodigoPrograma
		existing.NombrePrograma = item.NombrePrograma
		existing.Producto = item.Producto
		existing.Descripcion = item.Descripcion
		existing.MedidoATravesDe = item.MedidoATravesDe
		existing.CodigoIndicadorProducto = item.CodigoIndicadorProducto
		existing.IndicadorProducto = item.IndicadorProducto
		existing.UnidadDeMedida = item.UnidadDeMedida
		existing.IndicadorPrincipal = item.IndicadorPrincipal
		existing.EsNacional = item.EsNacional
		existing.EsTerritorial = item.EsTerritorial
		existing.ODS = item.ODS
		existing.MetaODS = item.MetaODS
		existing.TipologiaGeneralSUIFP = item.TipologiaGeneralSUIFP
		existing.TipologiaD = item.TipologiaD
		existing.TipologiaE = item.TipologiaE
		existing.TipologiaAPIIP = item.TipologiaAPIIP
		existing.TipologiaBPIIP = item.TipologiaBPIIP
		existing.TipologiaCPIIP = item.TipologiaCPIIP
		existing.TieneEDT = item.TieneEDT
		existing.EDT = item.EDT
		if err := r.db.WithContext(ctx).
			Model(&existing).
			Select(
				"TenantID", "Sector", "NombreSector", "CodigoPrograma", "NombrePrograma",
				"Producto", "Descripcion", "MedidoATravesDe", "CodigoIndicadorProducto",
				"IndicadorProducto", "UnidadDeMedida", "IndicadorPrincipal", "EsNacional",
				"EsTerritorial", "ODS", "MetaODS", "TipologiaGeneralSUIFP", "TipologiaD",
				"TipologiaE", "TipologiaAPIIP", "TipologiaBPIIP", "TipologiaCPIIP",
				"TieneEDT", "EDT",
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

// GetCatalogProductByID obtiene un producto del catálogo por UUID.
func (r *CatalogRepository) GetCatalogProductByID(ctx context.Context, id uuid.UUID) (*models.CatalogProduct, error) {
	var item models.CatalogProduct
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

// UpdateCatalogProductByID actualiza un producto del catálogo por UUID.
func (r *CatalogRepository) UpdateCatalogProductByID(ctx context.Context, id uuid.UUID, item *models.CatalogProduct) error {
	var existing models.CatalogProduct
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&existing).Error; err != nil {
		return err
	}
	existing.Sector = item.Sector
	existing.NombreSector = item.NombreSector
	existing.CodigoPrograma = item.CodigoPrograma
	existing.NombrePrograma = item.NombrePrograma
	existing.CodigoProducto = item.CodigoProducto
	existing.Producto = item.Producto
	existing.Descripcion = item.Descripcion
	existing.MedidoATravesDe = item.MedidoATravesDe
	existing.CodigoIndicadorProducto = item.CodigoIndicadorProducto
	existing.IndicadorProducto = item.IndicadorProducto
	existing.UnidadDeMedida = item.UnidadDeMedida
	existing.IndicadorPrincipal = item.IndicadorPrincipal
	existing.EsNacional = item.EsNacional
	existing.EsTerritorial = item.EsTerritorial
	existing.ODS = item.ODS
	existing.MetaODS = item.MetaODS
	existing.TipologiaGeneralSUIFP = item.TipologiaGeneralSUIFP
	existing.TipologiaD = item.TipologiaD
	existing.TipologiaE = item.TipologiaE
	existing.TipologiaAPIIP = item.TipologiaAPIIP
	existing.TipologiaBPIIP = item.TipologiaBPIIP
	existing.TipologiaCPIIP = item.TipologiaCPIIP
	existing.TieneEDT = item.TieneEDT
	existing.EDT = item.EDT
	if err := r.db.WithContext(ctx).
		Model(&existing).
		Select(
			"Sector", "NombreSector", "CodigoPrograma", "NombrePrograma", "CodigoProducto",
			"Producto", "Descripcion", "MedidoATravesDe", "CodigoIndicadorProducto",
			"IndicadorProducto", "UnidadDeMedida", "IndicadorPrincipal", "EsNacional",
			"EsTerritorial", "ODS", "MetaODS", "TipologiaGeneralSUIFP", "TipologiaD",
			"TipologiaE", "TipologiaAPIIP", "TipologiaBPIIP", "TipologiaCPIIP",
			"TieneEDT", "EDT",
		).
		Updates(&existing).Error; err != nil {
		return err
	}
	*item = existing
	return nil
}

// DeleteCatalogProductByID elimina un producto del catálogo por UUID.
func (r *CatalogRepository) DeleteCatalogProductByID(ctx context.Context, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Where("id = ?", id).Delete(&models.CatalogProduct{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
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
