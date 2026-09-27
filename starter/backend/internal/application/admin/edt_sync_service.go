package admin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/soda"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	// DefaultEdtDatasetResourceID dataset oficial o genérico para EDT MGA DNP
	// TODO: Confirmar el resource ID definitivo de datos.gov.co para catálogo EDT / matriz de actividades MGA (DNP)
	DefaultEdtDatasetResourceID = "edt-mga-dnp.json"
	CatalogNameEdt              = "EDT"
)

// RawSodaEdtRow captura los campos del catálogo EDT provenientes de la API SODA / DNP.
type RawSodaEdtRow struct {
	CodigoProductoEstandarizado string `json:"codigo_producto_estandarizado"`
	CodigoProducto              string `json:"codigo_producto"`
	CodProducto                 string `json:"cod_producto"`
	ProductoCodigo              string `json:"producto_codigo"`
	NombreProducto              string `json:"nombre_producto"`
	Producto                    string `json:"producto"`
	CodigoEntregableL1          string `json:"codigo_entregable_l1"`
	CodEntregableL1             string `json:"cod_entregable_l1"`
	EntregableL1                string `json:"entregable_l1"`
	NombreEntregableL1          string `json:"nombre_entregable_l1"`
	Entregable1                 string `json:"entregable_1"`
	CodigoEntregableL2          string `json:"codigo_entregable_l2"`
	CodEntregableL2             string `json:"cod_entregable_l2"`
	EntregableL2                string `json:"entregable_l2"`
	NombreEntregableL2          string `json:"nombre_entregable_l2"`
	Entregable2                 string `json:"entregable_2"`
	CodigoEntregableL3          string `json:"codigo_entregable_l3"`
	CodEntregableL3             string `json:"cod_entregable_l3"`
	EntregableL3                string `json:"entregable_l3"`
	NombreEntregableL3          string `json:"nombre_entregable_l3"`
	Entregable3                 string `json:"entregable_3"`
	CodigoActividad             string `json:"codigo_actividad"`
	CodActividad                string `json:"cod_actividad"`
	ActividadCodigo             string `json:"actividad_codigo"`
	Actividad                   string `json:"actividad"`
	NombreActividad             string `json:"nombre_actividad"`
	DescripcionActividad        string `json:"descripcion_actividad"`
	DescripcionEdt              string `json:"descripcion_edt"`
	UnidadDeMedida              string `json:"unidad_de_medida"`
	UnidadMedida                string `json:"unidad_medida"`
	MeasureUnit                 string `json:"measure_unit"`
	Observaciones               string `json:"observaciones"`
}

// EdtSyncResult resume el resultado de la sincronización de EDT.
type EdtSyncResult struct {
	SyncLogID        uuid.UUID `json:"sync_log_id"`
	CatalogName      string    `json:"catalog_name"`
	RecordsProcessed int       `json:"records_processed"`
	Status           string    `json:"status"`
	DurationMs       int64     `json:"duration_ms"`
}

// EdtSyncService coordina la extracción y carga (Upsert Protegido) de EDT MGA resolviendo la FK con Productos.
type EdtSyncService struct {
	db         *gorm.DB
	sodaClient soda.Client
	resourceID string
}

// NewEdtSyncService inicializa el servicio de sincronización de EDT.
func NewEdtSyncService(db *gorm.DB, sodaClient soda.Client) *EdtSyncService {
	if db == nil {
		panic("db is required for EdtSyncService")
	}
	if sodaClient == nil {
		sodaClient = soda.NewClient(soda.DefaultBaseURL, "", nil)
	}
	return &EdtSyncService{
		db:         db,
		sodaClient: sodaClient,
		resourceID: DefaultEdtDatasetResourceID,
	}
}

// WithResourceID permite configurar un resource ID alternativo de SODA.
func (s *EdtSyncService) WithResourceID(resourceID string) *EdtSyncService {
	clean := strings.TrimSpace(resourceID)
	if clean != "" {
		s.resourceID = clean
	}
	return s
}

// GetLatestSyncStatus consulta y devuelve la última entrada de auditoría para el catálogo EDT.
func (s *EdtSyncService) GetLatestSyncStatus(ctx context.Context, catalogName string) (*models.CatalogSyncLog, error) {
	name := strings.TrimSpace(catalogName)
	if name == "" {
		name = CatalogNameEdt
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

// SyncEdt ejecuta la sincronización de EDT desde SODA resolviendo la FK con Productos y aplicando Upsert Protegido.
func (s *EdtSyncService) SyncEdt(ctx context.Context) (*EdtSyncResult, error) {
	startTime := time.Now()

	// 1. Crear registro de auditoría en estado IN_PROGRESS
	syncLog := models.CatalogSyncLog{
		ID:               uuid.New(),
		CatalogName:      CatalogNameEdt,
		StartedAt:        startTime,
		Status:           models.SyncStatusInProgress,
		RecordsProcessed: 0,
	}

	if err := s.db.WithContext(ctx).Create(&syncLog).Error; err != nil {
		return nil, fmt.Errorf("create initial edt sync log: %w", err)
	}

	// 2. Extraer registros desde la API SODA
	rawMessages, err := s.sodaClient.FetchAll(ctx, s.resourceID, nil)
	if err != nil {
		s.failSync(ctx, syncLog.ID, fmt.Errorf("fetch edt data from SODA API: %w", err))
		return nil, fmt.Errorf("fetch edt data from SODA API: %w", err)
	}

	if len(rawMessages) == 0 {
		completedAt := time.Now()
		_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", syncLog.ID).Updates(map[string]any{
			"completed_at":      &completedAt,
			"status":            models.SyncStatusSuccess,
			"records_processed": 0,
			"error_message":     "",
		})
		return &EdtSyncResult{
			SyncLogID:        syncLog.ID,
			CatalogName:      CatalogNameEdt,
			RecordsProcessed: 0,
			Status:           string(models.SyncStatusSuccess),
			DurationMs:       time.Since(startTime).Milliseconds(),
		}, nil
	}

	// 3. Consultar productos existentes en memoria para resolución de FK (ProductID)
	var products []models.CatalogProduct
	if err := s.db.WithContext(ctx).Find(&products).Error; err != nil {
		s.failSync(ctx, syncLog.ID, fmt.Errorf("query existing products for relation mapping: %w", err))
		return nil, fmt.Errorf("query existing products for relation mapping: %w", err)
	}

	productByCode := make(map[string]models.CatalogProduct, len(products)*2)
	for _, p := range products {
		trimmedCode := strings.TrimSpace(p.CodigoProducto)
		if trimmedCode != "" {
			if _, exists := productByCode[trimmedCode]; !exists {
				productByCode[trimmedCode] = p
				productByCode[strings.ToLower(trimmedCode)] = p
				cleanLeading := strings.TrimLeft(trimmedCode, "0")
				if cleanLeading != "" {
					productByCode[cleanLeading] = p
				}
			}
		}
	}

	// 4. Transformar filas planas a modelos CatalogEdt resolviendo la FK con Productos
	edtItems := make([]models.CatalogEdt, 0, len(rawMessages))
	seenKeys := make(map[string]struct{}, len(rawMessages))
	now := time.Now().UTC()

	for i, raw := range rawMessages {
		var row RawSodaEdtRow
		if err := json.Unmarshal(raw, &row); err != nil {
			err = fmt.Errorf("unmarshal soda edt row %d: %w", i, err)
			s.failSync(ctx, syncLog.ID, err)
			return nil, err
		}

		// Extraer código del producto
		prodCode := strings.TrimSpace(row.CodigoProductoEstandarizado)
		if prodCode == "" {
			prodCode = strings.TrimSpace(row.CodigoProducto)
		}
		if prodCode == "" {
			prodCode = strings.TrimSpace(row.CodProducto)
		}
		if prodCode == "" {
			prodCode = strings.TrimSpace(row.ProductoCodigo)
		}

		if prodCode == "" {
			continue // Omitir EDT sin código de producto
		}

		matchedProd, exists := productByCode[prodCode]
		if !exists {
			matchedProd, exists = productByCode[strings.ToLower(prodCode)]
		}
		if !exists {
			matchedProd, exists = productByCode[strings.TrimLeft(prodCode, "0")]
		}
		if !exists {
			// El producto no existe en la base de datos; omitir de forma segura para proteger la integridad referencial
			continue
		}

		prodID := matchedProd.ID
		prodName := strings.TrimSpace(row.NombreProducto)
		if prodName == "" {
			prodName = strings.TrimSpace(row.Producto)
		}
		if prodName == "" {
			prodName = matchedProd.Producto
		}

		l1Code := strings.TrimSpace(row.CodigoEntregableL1)
		if l1Code == "" {
			l1Code = strings.TrimSpace(row.CodEntregableL1)
		}
		if l1Code == "" {
			l1Code = strings.TrimSpace(row.EntregableL1)
		}

		l1Name := strings.TrimSpace(row.NombreEntregableL1)
		if l1Name == "" {
			l1Name = strings.TrimSpace(row.Entregable1)
		}

		l2Code := strings.TrimSpace(row.CodigoEntregableL2)
		if l2Code == "" {
			l2Code = strings.TrimSpace(row.CodEntregableL2)
		}
		if l2Code == "" {
			l2Code = strings.TrimSpace(row.EntregableL2)
		}

		l2Name := strings.TrimSpace(row.NombreEntregableL2)
		if l2Name == "" {
			l2Name = strings.TrimSpace(row.Entregable2)
		}

		l3Code := strings.TrimSpace(row.CodigoEntregableL3)
		if l3Code == "" {
			l3Code = strings.TrimSpace(row.CodEntregableL3)
		}
		if l3Code == "" {
			l3Code = strings.TrimSpace(row.EntregableL3)
		}

		l3Name := strings.TrimSpace(row.NombreEntregableL3)
		if l3Name == "" {
			l3Name = strings.TrimSpace(row.Entregable3)
		}

		actCode := strings.TrimSpace(row.CodigoActividad)
		if actCode == "" {
			actCode = strings.TrimSpace(row.CodActividad)
		}
		if actCode == "" {
			actCode = strings.TrimSpace(row.ActividadCodigo)
		}

		actName := strings.TrimSpace(row.Actividad)
		if actName == "" {
			actName = strings.TrimSpace(row.NombreActividad)
		}
		if actName == "" {
			actName = strings.TrimSpace(row.DescripcionActividad)
		}
		if actName == "" {
			actName = strings.TrimSpace(row.DescripcionEdt)
		}

		unit := strings.TrimSpace(row.UnidadDeMedida)
		if unit == "" {
			unit = strings.TrimSpace(row.UnidadMedida)
		}
		if unit == "" {
			unit = strings.TrimSpace(row.MeasureUnit)
		}

		uniqueKey := models.EdtCompositeKey(matchedProd.CodigoProducto, l1Code, l2Code, l3Code, actCode)
		if _, seen := seenKeys[uniqueKey]; seen {
			continue // Evitar duplicados dentro del mismo lote
		}
		seenKeys[uniqueKey] = struct{}{}

		edtItem := models.CatalogEdt{
			ID:                          uuid.New(),
			ProductID:                   &prodID,
			CodigoProductoEstandarizado: matchedProd.CodigoProducto,
			NombreProducto:              prodName,
			CodigoEntregableL1:          l1Code,
			NombreEntregableL1:          l1Name,
			CodigoEntregableL2:          l2Code,
			NombreEntregableL2:          l2Name,
			CodigoEntregableL3:          l3Code,
			NombreEntregableL3:          l3Name,
			CodigoActividad:             actCode,
			Actividad:                   actName,
			UnidadDeMedida:              unit,
			CreatedAt:                   now,
			UpdatedAt:                   now,
		}

		edtItems = append(edtItems, edtItem)
	}

	// 5. Upsert Protegido: Se actualizan los atributos oficiales pero EXCLUYENDO ESTRICTAMENTE 'observaciones'
	if len(edtItems) > 0 {
		err = s.db.WithContext(ctx).
			Table("catalogo_edt").
			Clauses(clause.OnConflict{
				Columns: []clause.Column{
					{Name: "codigo_producto_estandarizado"},
					{Name: "codigo_entregable_l1"},
					{Name: "codigo_entregable_l2"},
					{Name: "codigo_entregable_l3"},
					{Name: "codigo_actividad"},
				},
				DoUpdates: clause.AssignmentColumns([]string{
					"product_id",
					"nombre_producto",
					"nombre_entregable_l1",
					"nombre_entregable_l2",
					"nombre_entregable_l3",
					"actividad",
					"unidad_de_medida",
					"updated_at",
				}),
			}).
			CreateInBatches(edtItems, 100).Error

		if err != nil {
			s.failSync(ctx, syncLog.ID, fmt.Errorf("bulk upsert edt: %w", err))
			return nil, fmt.Errorf("bulk upsert edt: %w", err)
		}
	}

	// 6. Finalizar auditoría con estado SUCCESS
	completedAt := time.Now()
	processedCount := len(edtItems)

	_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", syncLog.ID).Updates(map[string]any{
		"completed_at":      &completedAt,
		"status":            models.SyncStatusSuccess,
		"records_processed": processedCount,
		"error_message":     "",
	})

	return &EdtSyncResult{
		SyncLogID:        syncLog.ID,
		CatalogName:      CatalogNameEdt,
		RecordsProcessed: processedCount,
		Status:           string(models.SyncStatusSuccess),
		DurationMs:       time.Since(startTime).Milliseconds(),
	}, nil
}

func (s *EdtSyncService) failSync(ctx context.Context, logID uuid.UUID, syncErr error) {
	completedAt := time.Now()
	errMsg := syncErr.Error()
	_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", logID).Updates(map[string]any{
		"completed_at":  &completedAt,
		"status":        models.SyncStatusFailed,
		"error_message": errMsg,
	})
}
