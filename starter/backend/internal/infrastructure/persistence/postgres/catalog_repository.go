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

// ErrProgramNotFound indica que no existe un programa con el código indicado.
var ErrProgramNotFound = errors.New("program not found")

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
			"(codigo ILIKE ? ESCAPE '\\' OR nombre ILIKE ? ESCAPE '\\')",
			pattern, pattern,
		)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count sectors: %w", err)
	}

	items := make([]models.Sector, 0, limit)
	if err := q.Order("codigo ASC").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
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
	err = r.db.WithContext(ctx).Where("codigo = ?", sector.Code).First(&existing).Error
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
		// Carrera: otro proceso insertó el mismo codigo.
		if err2 := r.db.WithContext(ctx).
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "codigo"}},
				DoUpdates: clause.AssignmentColumns([]string{"nombre", "aplicacion", "observaciones", "updated_at"}),
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
	err := r.db.WithContext(ctx).Select("id").Where("codigo = ?", code).First(&sector).Error
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

// ProgramExistsByCode verifica integridad referencial: el código debe existir en programas_subprogramas.
func (r *CatalogRepository) ProgramExistsByCode(ctx context.Context, code string) (bool, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return false, fmt.Errorf("%w: código vacío", ErrProgramNotFound)
	}
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ProgramSubprogram{}).
		Where("codigo_programa = ?", code).
		Limit(1).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	if count == 0 {
		return false, fmt.Errorf("%w: código %s", ErrProgramNotFound, code)
	}
	return true, nil
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

// UpsertCatalogProductByCode inserta/actualiza por (codigo_producto, codigo_indicador_producto).
func (r *CatalogRepository) UpsertCatalogProductByCode(ctx context.Context, item *models.CatalogProduct) (created bool, err error) {
	now := time.Now().UTC()
	item.CodigoProducto = strings.TrimSpace(item.CodigoProducto)
	item.CodigoIndicadorProducto = strings.TrimSpace(item.CodigoIndicadorProducto)

	var existing models.CatalogProduct
	err = r.db.WithContext(ctx).
		Where(
			"codigo_producto = ? AND codigo_indicador_producto = ?",
			item.CodigoProducto,
			item.CodigoIndicadorProducto,
		).
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
				"Producto", "Descripcion", "MedidoATravesDe",
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

// catalogProductUpsertColumns columnas actualizadas en ON CONFLICT.
// No incluye codigo_producto ni codigo_indicador_producto (llave compuesta).
var catalogProductUpsertColumns = []string{
	"tenant_id", "sector", "nombre_sector", "codigo_programa", "nombre_programa",
	"producto", "descripcion", "medido_a_traves_de",
	"indicador_producto", "unidad_de_medida", "indicador_principal", "es_nacional",
	"es_territorial", "ods", "meta_ods", "tipologia_general_suifp", "tipologia_d",
	"tipologia_e", "tipologia_a_piip", "tipologia_b_piip", "tipologia_c_piip",
	"tiene_edt", "edt",
}

const catalogProductBatchSize = 500

// ProductBulkUpsertResult contadores de una importación masiva.
type ProductBulkUpsertResult struct {
	Inserted    int
	Updated     int
	BatchErrors []string
}

// LoadProgramCodeSet carga los códigos de programa existentes (una sola consulta).
func (r *CatalogRepository) LoadProgramCodeSet(ctx context.Context) (map[string]struct{}, error) {
	var codes []string
	if err := r.db.WithContext(ctx).Model(&models.ProgramSubprogram{}).
		Distinct("codigo_programa").
		Pluck("codigo_programa", &codes).Error; err != nil {
		return nil, fmt.Errorf("load program codes: %w", err)
	}
	set := make(map[string]struct{}, len(codes))
	for _, c := range codes {
		c = strings.TrimSpace(c)
		if c != "" {
			set[c] = struct{}{}
		}
	}
	return set, nil
}

// ExistingProductCompositeKeys devuelve las llaves "codigo_producto_codigo_indicador"
// que ya existen en catalogo_productos (para los códigos de producto del lote).
func (r *CatalogRepository) ExistingProductCompositeKeys(ctx context.Context, productCodes []string) (map[string]struct{}, error) {
	set := make(map[string]struct{})
	if len(productCodes) == 0 {
		return set, nil
	}
	// Dedup códigos de producto para la consulta IN.
	uniq := make([]string, 0, len(productCodes))
	seen := make(map[string]struct{}, len(productCodes))
	for _, c := range productCodes {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		if _, ok := seen[c]; ok {
			continue
		}
		seen[c] = struct{}{}
		uniq = append(uniq, c)
	}

	const chunk = 1000
	for i := 0; i < len(uniq); i += chunk {
		end := i + chunk
		if end > len(uniq) {
			end = len(uniq)
		}
		var rows []struct {
			CodigoProducto          string `gorm:"column:codigo_producto"`
			CodigoIndicadorProducto string `gorm:"column:codigo_indicador_producto"`
		}
		if err := r.db.WithContext(ctx).Model(&models.CatalogProduct{}).
			Select("codigo_producto, codigo_indicador_producto").
			Where("codigo_producto IN ?", uniq[i:end]).
			Find(&rows).Error; err != nil {
			return nil, fmt.Errorf("existing product composite keys: %w", err)
		}
		for _, row := range rows {
			set[models.ProductCompositeKey(row.CodigoProducto, row.CodigoIndicadorProducto)] = struct{}{}
		}
	}
	return set, nil
}

// BulkUpsertCatalogProducts inserta/actualiza por (codigo_producto, codigo_indicador_producto).
// Deduplica por esa llave compuesta (última aparición gana). Un fallo en un lote
// NO aborta los lotes restantes: reintenta fila a fila y registra el error.
func (r *CatalogRepository) BulkUpsertCatalogProducts(ctx context.Context, items []models.CatalogProduct) (*ProductBulkUpsertResult, error) {
	if len(items) == 0 {
		return &ProductBulkUpsertResult{}, nil
	}

	byKey := make(map[string]models.CatalogProduct, len(items))
	order := make([]string, 0, len(items))
	productCodes := make([]string, 0, len(items))
	for _, it := range items {
		it.CodigoProducto = strings.TrimSpace(it.CodigoProducto)
		it.CodigoIndicadorProducto = strings.TrimSpace(it.CodigoIndicadorProducto)
		if it.CodigoProducto == "" {
			continue
		}
		key := models.ProductCompositeKey(it.CodigoProducto, it.CodigoIndicadorProducto)
		if _, seen := byKey[key]; !seen {
			order = append(order, key)
			productCodes = append(productCodes, it.CodigoProducto)
		}
		byKey[key] = it
	}

	deduped := make([]models.CatalogProduct, 0, len(order))
	keys := make([]string, 0, len(order))
	now := time.Now().UTC()
	for _, key := range order {
		it := byKey[key]
		if it.ID == uuid.Nil {
			it.ID = uuid.New()
		}
		if it.CreatedAt.IsZero() {
			it.CreatedAt = now
		}
		deduped = append(deduped, it)
		keys = append(keys, key)
	}

	existing, err := r.ExistingProductCompositeKeys(ctx, productCodes)
	if err != nil {
		return nil, err
	}

	result := &ProductBulkUpsertResult{
		BatchErrors: make([]string, 0),
	}

	conflict := clause.OnConflict{
		Columns: []clause.Column{
			{Name: "codigo_producto"},
			{Name: "codigo_indicador_producto"},
		},
		DoUpdates: clause.AssignmentColumns(catalogProductUpsertColumns),
	}

	for i := 0; i < len(deduped); i += catalogProductBatchSize {
		end := i + catalogProductBatchSize
		if end > len(deduped) {
			end = len(deduped)
		}
		batch := deduped[i:end]
		if err := r.db.WithContext(ctx).Clauses(conflict).Create(&batch).Error; err != nil {
			for _, item := range batch {
				one := item
				if errOne := r.db.WithContext(ctx).Clauses(conflict).Create(&one).Error; errOne != nil {
					result.BatchErrors = append(result.BatchErrors, fmt.Sprintf(
						"clave %s: %v",
						models.ProductCompositeKey(one.CodigoProducto, one.CodigoIndicadorProducto),
						errOne,
					))
				}
			}
		}
	}

	failed := make(map[string]struct{}, len(result.BatchErrors))
	for _, msg := range result.BatchErrors {
		if strings.HasPrefix(msg, "clave ") {
			rest := strings.TrimPrefix(msg, "clave ")
			if idx := strings.Index(rest, ":"); idx > 0 {
				failed[rest[:idx]] = struct{}{}
			}
		}
	}

	updated := 0
	for _, key := range keys {
		if _, bad := failed[key]; bad {
			continue
		}
		if _, ok := existing[key]; ok {
			updated++
		}
	}
	result.Updated = updated
	result.Inserted = len(keys) - updated - len(failed)
	if result.Inserted < 0 {
		result.Inserted = 0
	}
	return result, nil
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

// --- Catálogo EDT -----------------------------------------------------------

// CatalogEdtListParams filtros para catalogo_edt.
type CatalogEdtListParams struct {
	Page   int
	Limit  int
	Search string
}

// CatalogEdtListResult resultado paginado.
type CatalogEdtListResult struct {
	Items    []models.CatalogEdt
	Total    int64
	Page     int
	Limit    int
	LastPage int
}

const catalogEdtBatchSize = 500

var catalogEdtUpsertColumns = []string{
	"tenant_id", "nombre_producto",
	"codigo_entregable_l1", "nombre_entregable_l1",
	"codigo_entregable_l2", "nombre_entregable_l2",
	"codigo_entregable_l3", "nombre_entregable_l3",
	"actividad", "unidad_de_medida",
}

// EdtBulkUpsertResult contadores de importación masiva EDT.
type EdtBulkUpsertResult struct {
	Inserted    int
	Updated     int
	BatchErrors []string
}

// ListCatalogEdt lista con búsqueda ILIKE y paginación.
func (r *CatalogRepository) ListCatalogEdt(ctx context.Context, p CatalogEdtListParams) (*CatalogEdtListResult, error) {
	page := p.Page
	if page < 1 {
		page = 1
	}
	limit := normalizeCatalogLimit(p.Limit)
	offset := (page - 1) * limit

	q := r.db.WithContext(ctx).Model(&models.CatalogEdt{})
	if search := strings.TrimSpace(p.Search); search != "" {
		pattern := "%" + escapeILIKE(search) + "%"
		q = q.Where(
			`(codigo_producto_estandarizado ILIKE ? ESCAPE '\' OR nombre_producto ILIKE ? ESCAPE '\' OR
			  codigo_actividad ILIKE ? ESCAPE '\' OR actividad ILIKE ? ESCAPE '\' OR
			  codigo_entregable_l1 ILIKE ? ESCAPE '\' OR nombre_entregable_l1 ILIKE ? ESCAPE '\' OR
			  codigo_entregable_l2 ILIKE ? ESCAPE '\' OR nombre_entregable_l2 ILIKE ? ESCAPE '\' OR
			  codigo_entregable_l3 ILIKE ? ESCAPE '\' OR nombre_entregable_l3 ILIKE ? ESCAPE '\')`,
			pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern,
		)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count catalogo_edt: %w", err)
	}

	items := make([]models.CatalogEdt, 0, limit)
	if err := q.Order("codigo_producto_estandarizado ASC, codigo_actividad ASC").
		Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list catalogo_edt: %w", err)
	}

	lastPage := int(math.Ceil(float64(total) / float64(limit)))
	if lastPage == 0 {
		lastPage = 1
	}
	return &CatalogEdtListResult{
		Items:    items,
		Total:    total,
		Page:     page,
		Limit:    limit,
		LastPage: lastPage,
	}, nil
}

// ExistingEdtCompositeKeys carga llaves producto_actividad ya existentes.
func (r *CatalogRepository) ExistingEdtCompositeKeys(ctx context.Context, productCodes []string) (map[string]struct{}, error) {
	set := make(map[string]struct{})
	if len(productCodes) == 0 {
		return set, nil
	}
	uniq := make([]string, 0, len(productCodes))
	seen := make(map[string]struct{}, len(productCodes))
	for _, c := range productCodes {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		if _, ok := seen[c]; ok {
			continue
		}
		seen[c] = struct{}{}
		uniq = append(uniq, c)
	}

	const chunk = 1000
	for i := 0; i < len(uniq); i += chunk {
		end := i + chunk
		if end > len(uniq) {
			end = len(uniq)
		}
		var rows []struct {
			CodigoProductoEstandarizado string `gorm:"column:codigo_producto_estandarizado"`
			CodigoActividad             string `gorm:"column:codigo_actividad"`
		}
		if err := r.db.WithContext(ctx).Model(&models.CatalogEdt{}).
			Select("codigo_producto_estandarizado, codigo_actividad").
			Where("codigo_producto_estandarizado IN ?", uniq[i:end]).
			Find(&rows).Error; err != nil {
			return nil, fmt.Errorf("existing edt keys: %w", err)
		}
		for _, row := range rows {
			set[models.EdtCompositeKey(row.CodigoProductoEstandarizado, row.CodigoActividad)] = struct{}{}
		}
	}
	return set, nil
}

// BulkUpsertCatalogEdt upsert por (codigo_producto_estandarizado, codigo_actividad) en lotes de 500.
func (r *CatalogRepository) BulkUpsertCatalogEdt(ctx context.Context, items []models.CatalogEdt) (*EdtBulkUpsertResult, error) {
	if len(items) == 0 {
		return &EdtBulkUpsertResult{}, nil
	}

	byKey := make(map[string]models.CatalogEdt, len(items))
	order := make([]string, 0, len(items))
	productCodes := make([]string, 0, len(items))
	for _, it := range items {
		it.CodigoProductoEstandarizado = strings.TrimSpace(it.CodigoProductoEstandarizado)
		it.CodigoActividad = strings.TrimSpace(it.CodigoActividad)
		if it.CodigoProductoEstandarizado == "" {
			continue
		}
		key := models.EdtCompositeKey(it.CodigoProductoEstandarizado, it.CodigoActividad)
		if _, seen := byKey[key]; !seen {
			order = append(order, key)
			productCodes = append(productCodes, it.CodigoProductoEstandarizado)
		}
		byKey[key] = it
	}

	deduped := make([]models.CatalogEdt, 0, len(order))
	keys := make([]string, 0, len(order))
	now := time.Now().UTC()
	for _, key := range order {
		it := byKey[key]
		if it.ID == uuid.Nil {
			it.ID = uuid.New()
		}
		if it.CreatedAt.IsZero() {
			it.CreatedAt = now
		}
		deduped = append(deduped, it)
		keys = append(keys, key)
	}

	existing, err := r.ExistingEdtCompositeKeys(ctx, productCodes)
	if err != nil {
		return nil, err
	}

	result := &EdtBulkUpsertResult{BatchErrors: make([]string, 0)}
	// Equivale a: ON CONFLICT (codigo_producto_estandarizado, codigo_actividad) DO UPDATE SET ...
	// La PK `id` no participa en el conflicto; se conserva el registro existente.
	conflict := clause.OnConflict{
		Columns: []clause.Column{
			{Name: "codigo_producto_estandarizado"},
			{Name: "codigo_actividad"},
		},
		DoUpdates: clause.AssignmentColumns(catalogEdtUpsertColumns),
	}

	for i := 0; i < len(deduped); i += catalogEdtBatchSize {
		end := i + catalogEdtBatchSize
		if end > len(deduped) {
			end = len(deduped)
		}
		batch := deduped[i:end]
		if err := r.db.WithContext(ctx).Clauses(conflict).Create(&batch).Error; err != nil {
			for _, item := range batch {
				one := item
				if errOne := r.db.WithContext(ctx).Clauses(conflict).Create(&one).Error; errOne != nil {
					result.BatchErrors = append(result.BatchErrors, fmt.Sprintf(
						"clave %s: %v",
						models.EdtCompositeKey(one.CodigoProductoEstandarizado, one.CodigoActividad),
						errOne,
					))
				}
			}
		}
	}

	failed := make(map[string]struct{}, len(result.BatchErrors))
	for _, msg := range result.BatchErrors {
		if strings.HasPrefix(msg, "clave ") {
			rest := strings.TrimPrefix(msg, "clave ")
			if idx := strings.Index(rest, ":"); idx > 0 {
				failed[rest[:idx]] = struct{}{}
			}
		}
	}
	updated := 0
	for _, key := range keys {
		if _, bad := failed[key]; bad {
			continue
		}
		if _, ok := existing[key]; ok {
			updated++
		}
	}
	result.Updated = updated
	result.Inserted = len(keys) - updated - len(failed)
	if result.Inserted < 0 {
		result.Inserted = 0
	}
	return result, nil
}

// GetCatalogEdtByID obtiene una fila EDT por UUID.
func (r *CatalogRepository) GetCatalogEdtByID(ctx context.Context, id uuid.UUID) (*models.CatalogEdt, error) {
	var item models.CatalogEdt
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
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
