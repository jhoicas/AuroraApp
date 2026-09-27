package admin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	CatalogNameProducts = "PRODUCTS"
)

// RawSodaProductRow captura los campos del catálogo de productos provenientes de la API SODA / DNP.
type RawSodaProductRow struct {
	CodigoProducto          string `json:"codigo_producto"`
	CodProducto             string `json:"cod_producto"`
	Code                    string `json:"code"`
	Codigo                  string `json:"codigo"`
	Producto                string `json:"producto"`
	NombreProducto          string `json:"nombre_producto"`
	Name                    string `json:"name"`
	Nombre                  string `json:"nombre"`
	Descripcion             string `json:"descripcion"`
	Description             string `json:"description"`
	CodigoPrograma          string `json:"codigo_programa"`
	CodPrograma             string `json:"cod_programa"`
	ProgramaCodigo          string `json:"programa_codigo"`
	NombrePrograma          string `json:"nombre_programa"`
	ProgramaNombre          string `json:"programa_nombre"`
	Programa                string `json:"programa"`
	Sector                  string `json:"sector"`
	CodigoSector            string `json:"codigo_sector"`
	CodSector               string `json:"cod_sector"`
	NombreSector            string `json:"nombre_sector"`
	SectorNombre            string `json:"sector_nombre"`
	MedidoATravesDe         string `json:"medido_a_traves_de"`
	MedidoATravesDeAlt      string `json:"medido_a_trav_s_de"`
	MedidoATraves           string `json:"medido_a_traves"`
	CodigoIndicadorProducto string `json:"codigo_indicador_producto"`
	CodIndicadorProducto    string `json:"cod_indicador_producto"`
	CodIndicador            string `json:"cod_indicador"`
	IndicadorProducto       string `json:"indicador_producto"`
	Indicador               string `json:"indicador"`
	UnidadDeMedida          string `json:"unidad_de_medida"`
	UnidadMedida            string `json:"unidad_medida"`
	MeasureUnit             string `json:"measure_unit"`
	Unidad                  string `json:"unidad"`
	IndicadorPrincipal      any    `json:"indicador_principal"`
	EsNacional              any    `json:"es_nacional"`
	Nacional                any    `json:"nacional"`
	IsNational              any    `json:"is_national"`
	EsTerritorial           any    `json:"es_territorial"`
	Territorial             any    `json:"territorial"`
	IsTerritorial           any    `json:"is_territorial"`
	ODS                     string `json:"ods"`
	MetaODS                 string `json:"meta_ods"`
	TipologiaGeneralSUIFP   string `json:"tipologia_general_suifp"`
	TipologiaSUIFP          string `json:"tipologia_suifp"`
	Tipologia               string `json:"tipologia"`
	TipologiaD              any    `json:"tipologia_d"`
	TipologiaE              any    `json:"tipologia_e"`
	TipologiaAPIIP          any    `json:"tipologia_a_piip"`
	TipologiaBPIIP          any    `json:"tipologia_b_piip"`
	TipologiaCPIIP          any    `json:"tipologia_c_piip"`
	TieneEDT                any    `json:"tiene_edt"`
	EDT                     string `json:"edt"`
	Observaciones           string `json:"observaciones"`
}

// ProductSyncResult resume el resultado de la sincronización de productos.
type ProductSyncResult struct {
	SyncLogID        uuid.UUID `json:"sync_log_id"`
	CatalogName      string    `json:"catalog_name"`
	RecordsProcessed int       `json:"records_processed"`
	Status           string    `json:"status"`
	DurationMs       int64     `json:"duration_ms"`
}

// ProductSyncService coordina la carga (Upsert Protegido) de Productos MGA resolviendo la FK con Programas.
type ProductSyncService struct {
	db *gorm.DB
}

// NewProductSyncService inicializa el servicio de sincronización de productos.
func NewProductSyncService(db *gorm.DB) *ProductSyncService {
	if db == nil {
		panic("db is required for ProductSyncService")
	}
	return &ProductSyncService{
		db: db,
	}
}

// GetLatestSyncStatus consulta y devuelve la última entrada de auditoría para el catálogo de productos.
func (s *ProductSyncService) GetLatestSyncStatus(ctx context.Context, catalogName string) (*models.CatalogSyncLog, error) {
	name := strings.TrimSpace(catalogName)
	if name == "" {
		name = CatalogNameProducts
	}

	var logEntry models.CatalogSyncLog
	err := s.db.WithContext(ctx).
		Where("LOWER(catalog_name) = LOWER(?)", name).
		Order("started_at DESC").
		First(&logEntry).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("query latest catalog sync log for %s: %w", name, err)
	}

	return &logEntry, nil
}

// SyncProducts ejecuta la sincronización de Productos desde data JSON resolviendo la FK con Programas y aplicando Upsert Protegido.
func (s *ProductSyncService) SyncProducts(ctx context.Context, data []map[string]interface{}) (*ProductSyncResult, error) {
	startTime := time.Now()

	// 1. Crear registro de auditoría en estado IN_PROGRESS
	syncLog := models.CatalogSyncLog{
		ID:               uuid.New(),
		CatalogName:      CatalogNameProducts,
		StartedAt:        startTime,
		Status:           models.SyncStatusInProgress,
		RecordsProcessed: 0,
	}

	if err := s.db.WithContext(ctx).Create(&syncLog).Error; err != nil {
		return nil, fmt.Errorf("create initial products sync log: %w", err)
	}

	if len(data) == 0 {
		completedAt := time.Now()
		_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", syncLog.ID).Updates(map[string]any{
			"completed_at":      &completedAt,
			"status":            models.SyncStatusSuccess,
			"records_processed": 0,
			"error_message":     "",
		})
		return &ProductSyncResult{
			SyncLogID:        syncLog.ID,
			CatalogName:      CatalogNameProducts,
			RecordsProcessed: 0,
			Status:           string(models.SyncStatusSuccess),
			DurationMs:       time.Since(startTime).Milliseconds(),
		}, nil
	}

	// 2. Consultar programas existentes en memoria para resolución de FK (ProgramID)
	var programs []models.ProgramSubprogram
	if err := s.db.WithContext(ctx).Find(&programs).Error; err != nil {
		s.failSync(ctx, syncLog.ID, fmt.Errorf("query existing programs for relation mapping: %w", err))
		return nil, fmt.Errorf("query existing programs for relation mapping: %w", err)
	}

	programByCode := make(map[string]models.ProgramSubprogram, len(programs)*2)
	for _, prog := range programs {
		trimmedCode := strings.TrimSpace(prog.CodigoPrograma)
		if trimmedCode != "" {
			programByCode[trimmedCode] = prog
			programByCode[strings.ToLower(trimmedCode)] = prog
			cleanLeading := strings.TrimLeft(trimmedCode, "0")
			if cleanLeading != "" {
				programByCode[cleanLeading] = prog
			}
		}
	}

	// 3. Transformar filas a modelos CatalogProduct resolviendo la FK con Programas
	productItems := make([]models.CatalogProduct, 0, len(data))
	seenKeys := make(map[string]struct{}, len(data))
	now := time.Now().UTC()

	for i, item := range data {
		raw, err := json.Marshal(item)
		if err != nil {
			err = fmt.Errorf("marshal product row %d: %w", i, err)
			s.failSync(ctx, syncLog.ID, err)
			return nil, err
		}

		var row RawSodaProductRow
		if err := json.Unmarshal(raw, &row); err != nil {
			err = fmt.Errorf("unmarshal product row %d: %w", i, err)
			s.failSync(ctx, syncLog.ID, err)
			return nil, err
		}

		// Extraer código de producto
		productCode := strings.TrimSpace(row.CodigoProducto)
		if productCode == "" {
			productCode = strings.TrimSpace(row.CodProducto)
		}
		if productCode == "" {
			productCode = strings.TrimSpace(row.Code)
		}
		if productCode == "" {
			productCode = strings.TrimSpace(row.Codigo)
		}

		// Extraer nombre de producto
		productName := strings.TrimSpace(row.Producto)
		if productName == "" {
			productName = strings.TrimSpace(row.NombreProducto)
		}
		if productName == "" {
			productName = strings.TrimSpace(row.Name)
		}
		if productName == "" {
			productName = strings.TrimSpace(row.Nombre)
		}

		if productCode == "" || productName == "" {
			continue // Omitir filas sin datos de producto indispensables
		}

		// Extraer código de programa y resolver FK
		progCode := strings.TrimSpace(row.CodigoPrograma)
		if progCode == "" {
			progCode = strings.TrimSpace(row.CodPrograma)
		}
		if progCode == "" {
			progCode = strings.TrimSpace(row.ProgramaCodigo)
		}

		if progCode == "" {
			continue // Omitir productos sin código de programa
		}

		matchedProg, exists := programByCode[progCode]
		if !exists {
			matchedProg, exists = programByCode[strings.ToLower(progCode)]
		}
		if !exists {
			matchedProg, exists = programByCode[strings.TrimLeft(progCode, "0")]
		}
		if !exists {
			// El programa no existe en la base de datos; omitir de forma segura para proteger la integridad referencial
			continue
		}

		progID := matchedProg.ID
		progName := strings.TrimSpace(row.NombrePrograma)
		if progName == "" {
			progName = strings.TrimSpace(row.ProgramaNombre)
		}
		if progName == "" {
			progName = strings.TrimSpace(row.Programa)
		}
		if progName == "" {
			progName = matchedProg.NombrePrograma
		}

		sectorCode := strings.TrimSpace(row.Sector)
		if sectorCode == "" {
			sectorCode = strings.TrimSpace(row.CodigoSector)
		}
		if sectorCode == "" {
			sectorCode = strings.TrimSpace(row.CodSector)
		}
		if sectorCode == "" {
			sectorCode = matchedProg.CodigoSector
		}

		sectorName := strings.TrimSpace(row.NombreSector)
		if sectorName == "" {
			sectorName = strings.TrimSpace(row.SectorNombre)
		}
		if sectorName == "" {
			sectorName = matchedProg.NombreSector
		}

		desc := strings.TrimSpace(row.Descripcion)
		if desc == "" {
			desc = strings.TrimSpace(row.Description)
		}

		medido := strings.TrimSpace(row.MedidoATravesDe)
		if medido == "" {
			medido = strings.TrimSpace(row.MedidoATravesDeAlt)
		}
		if medido == "" {
			medido = strings.TrimSpace(row.MedidoATraves)
		}

		codIndicador := strings.TrimSpace(row.CodigoIndicadorProducto)
		if codIndicador == "" {
			codIndicador = strings.TrimSpace(row.CodIndicadorProducto)
		}
		if codIndicador == "" {
			codIndicador = strings.TrimSpace(row.CodIndicador)
		}

		indicador := strings.TrimSpace(row.IndicadorProducto)
		if indicador == "" {
			indicador = strings.TrimSpace(row.Indicador)
		}

		unidad := strings.TrimSpace(row.UnidadDeMedida)
		if unidad == "" {
			unidad = strings.TrimSpace(row.UnidadMedida)
		}
		if unidad == "" {
			unidad = strings.TrimSpace(row.MeasureUnit)
		}
		if unidad == "" {
			unidad = strings.TrimSpace(row.Unidad)
		}

		isNacional := parseSodaBool(row.EsNacional) || parseSodaBool(row.Nacional) || parseSodaBool(row.IsNational)
		isTerritorial := parseSodaBool(row.EsTerritorial) || parseSodaBool(row.Territorial) || parseSodaBool(row.IsTerritorial)
		isPrincipal := parseSodaBool(row.IndicadorPrincipal)

		ods := strings.TrimSpace(row.ODS)
		metaODS := strings.TrimSpace(row.MetaODS)

		tipologia := strings.TrimSpace(row.TipologiaGeneralSUIFP)
		if tipologia == "" {
			tipologia = strings.TrimSpace(row.TipologiaSUIFP)
		}
		if tipologia == "" {
			tipologia = strings.TrimSpace(row.Tipologia)
		}

		tipoD := parseSodaBool(row.TipologiaD)
		tipoE := parseSodaBool(row.TipologiaE)
		tipoA := parseSodaBool(row.TipologiaAPIIP)
		tipoB := parseSodaBool(row.TipologiaBPIIP)
		tipoC := parseSodaBool(row.TipologiaCPIIP)
		tieneEDT := parseSodaBool(row.TieneEDT)
		edt := strings.TrimSpace(row.EDT)

		uniqueKey := models.ProductCompositeKey(productCode, codIndicador)
		if _, seen := seenKeys[uniqueKey]; seen {
			continue // Evitar duplicados dentro del mismo lote
		}
		seenKeys[uniqueKey] = struct{}{}

		productItem := models.CatalogProduct{
			ID:                      uuid.New(),
			ProgramID:               &progID,
			Sector:                  sectorCode,
			NombreSector:            sectorName,
			CodigoPrograma:          matchedProg.CodigoPrograma,
			NombrePrograma:          progName,
			CodigoProducto:          productCode,
			Code:                    productCode,
			Producto:                productName,
			Nombre:                  productName,
			Descripcion:             desc,
			MedidoATravesDe:         medido,
			CodigoIndicadorProducto: codIndicador,
			IndicadorProducto:       indicador,
			UnidadDeMedida:          unidad,
			IndicadorPrincipal:      isPrincipal,
			EsNacional:              isNacional,
			EsTerritorial:           isTerritorial,
			ODS:                     ods,
			MetaODS:                 metaODS,
			TipologiaGeneralSUIFP:   tipologia,
			TipologiaD:              tipoD,
			TipologiaE:              tipoE,
			TipologiaAPIIP:          tipoA,
			TipologiaBPIIP:          tipoB,
			TipologiaCPIIP:          tipoC,
			TieneEDT:                tieneEDT,
			EDT:                     edt,
			CreatedAt:               now,
			UpdatedAt:               now,
		}

		productItems = append(productItems, productItem)
	}

	// 5. Upsert Protegido: Se actualizan los atributos oficiales pero EXCLUYENDO 'observaciones'
	if len(productItems) > 0 {
		err := s.db.WithContext(ctx).
			Table("catalogo_productos").
			Clauses(clause.OnConflict{
				Columns: []clause.Column{
					{Name: "codigo_producto"},
					{Name: "codigo_indicador_producto"},
				},
				DoUpdates: clause.AssignmentColumns([]string{
					"program_id",
					"sector",
					"nombre_sector",
					"codigo_programa",
					"nombre_programa",
					"codigo",
					"nombre",
					"producto",
					"descripcion",
					"medido_a_traves_de",
					"indicador_producto",
					"unidad_de_medida",
					"indicador_principal",
					"es_nacional",
					"es_territorial",
					"ods",
					"meta_ods",
					"tipologia_general_suifp",
					"tipologia_d",
					"tipologia_e",
					"tipologia_a_piip",
					"tipologia_b_piip",
					"tipologia_c_piip",
					"tiene_edt",
					"edt",
					"updated_at",
				}),
			}).
			CreateInBatches(productItems, 100).Error

		if err != nil {
			s.failSync(ctx, syncLog.ID, fmt.Errorf("bulk upsert products: %w", err))
			return nil, fmt.Errorf("bulk upsert products: %w", err)
		}
	}

	// 6. Finalizar auditoría con estado SUCCESS
	completedAt := time.Now()
	processedCount := len(productItems)

	_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", syncLog.ID).Updates(map[string]any{
		"completed_at":      &completedAt,
		"status":            models.SyncStatusSuccess,
		"records_processed": processedCount,
		"error_message":     "",
	})

	return &ProductSyncResult{
		SyncLogID:        syncLog.ID,
		CatalogName:      CatalogNameProducts,
		RecordsProcessed: processedCount,
		Status:           string(models.SyncStatusSuccess),
		DurationMs:       time.Since(startTime).Milliseconds(),
	}, nil
}

func (s *ProductSyncService) failSync(ctx context.Context, logID uuid.UUID, syncErr error) {
	completedAt := time.Now()
	errMsg := syncErr.Error()
	_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", logID).Updates(map[string]any{
		"completed_at":  &completedAt,
		"status":        models.SyncStatusFailed,
		"error_message": errMsg,
	})
}

// parseSodaBool interpreta con seguridad campos booleanos provenientes de SODA en formato bool, string o numérico.
func parseSodaBool(val any) bool {
	if val == nil {
		return false
	}
	switch v := val.(type) {
	case bool:
		return v
	case string:
		clean := strings.ToLower(strings.TrimSpace(v))
		return clean == "true" || clean == "si" || clean == "sí" || clean == "1" || clean == "t" || clean == "yes" || clean == "x"
	case float64:
		return v == 1
	case int:
		return v == 1
	case int64:
		return v == 1
	default:
		return false
	}
}
