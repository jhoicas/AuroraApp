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
	CatalogNamePrograms = "PROGRAMS"
)

// RawSodaProgramRow representa los campos esperados para el catálogo de programas.
type RawSodaProgramRow struct {
	CodigoPrograma    string `json:"codigo_programa"`
	Code              string `json:"code"`
	CodPrograma       string `json:"cod_programa"`
	NombrePrograma    string `json:"nombre_programa"`
	Name              string `json:"name"`
	Programa          string `json:"programa"`
	CodigoSector      string `json:"codigo_sector"`
	CodSector         string `json:"cod_sector"`
	Sector            string `json:"sector"`
	NombreSector      string `json:"nombre_sector"`
	NameSector        string `json:"name_sector"`
	CodigoSubprograma string `json:"codigo_subprograma"`
	CodSubprograma    string `json:"cod_subprograma"`
	NombreSubprograma string `json:"nombre_subprograma"`
	Subprograma       string `json:"subprograma"`
	AmbitoAplicacion  string `json:"ambito_aplicacion"`
	Ambito            string `json:"ambito"`
}

// ProgramSyncResult resume el resultado de la sincronización de programas.
type ProgramSyncResult struct {
	SyncLogID        uuid.UUID `json:"sync_log_id"`
	CatalogName      string    `json:"catalog_name"`
	RecordsProcessed int       `json:"records_processed"`
	Status           string    `json:"status"`
	DurationMs       int64     `json:"duration_ms"`
}

// ProgramSyncService coordina la carga (Upsert Protegido) de Programas MGA resolviendo la FK de Sectores.
type ProgramSyncService struct {
	db *gorm.DB
}

// NewProgramSyncService inicializa el servicio de sincronización de programas.
func NewProgramSyncService(db *gorm.DB) *ProgramSyncService {
	if db == nil {
		panic("db is required for ProgramSyncService")
	}
	return &ProgramSyncService{
		db: db,
	}
}

// GetLatestSyncStatus consulta y devuelve la última entrada de auditoría para el catálogo de programas.
func (s *ProgramSyncService) GetLatestSyncStatus(ctx context.Context, catalogName string) (*models.CatalogSyncLog, error) {
	name := strings.TrimSpace(catalogName)
	if name == "" {
		name = CatalogNamePrograms
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

// SyncPrograms ejecuta la sincronización de Programas desde data JSON aplicando resolución de FK con Sectores y Upsert Protegido.
func (s *ProgramSyncService) SyncPrograms(ctx context.Context, data []map[string]interface{}) (*ProgramSyncResult, error) {
	startTime := time.Now()

	// 1. Crear registro de auditoría en estado IN_PROGRESS
	syncLog := models.CatalogSyncLog{
		ID:               uuid.New(),
		CatalogName:      CatalogNamePrograms,
		StartedAt:        startTime,
		Status:           models.SyncStatusInProgress,
		RecordsProcessed: 0,
	}

	if err := s.db.WithContext(ctx).Create(&syncLog).Error; err != nil {
		return nil, fmt.Errorf("create initial programs sync log: %w", err)
	}

	if len(data) == 0 {
		completedAt := time.Now()
		_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", syncLog.ID).Updates(map[string]any{
			"completed_at":      &completedAt,
			"status":            models.SyncStatusSuccess,
			"records_processed": 0,
			"error_message":     "",
		})
		return &ProgramSyncResult{
			SyncLogID:        syncLog.ID,
			CatalogName:      CatalogNamePrograms,
			RecordsProcessed: 0,
			Status:           string(models.SyncStatusSuccess),
			DurationMs:       time.Since(startTime).Milliseconds(),
		}, nil
	}

	// 2. Consultar sectores existentes en la base de datos para mapeo en memoria de SectorID
	var sectors []models.Sector
	if err := s.db.WithContext(ctx).Find(&sectors).Error; err != nil {
		s.failSync(ctx, syncLog.ID, fmt.Errorf("query existing sectors for relation mapping: %w", err))
		return nil, fmt.Errorf("query existing sectors for relation mapping: %w", err)
	}

	sectorByCode := make(map[string]models.Sector, len(sectors)*2)
	for _, sec := range sectors {
		trimmedCode := strings.TrimSpace(sec.Code)
		if trimmedCode != "" {
			sectorByCode[trimmedCode] = sec
			sectorByCode[strings.ToLower(trimmedCode)] = sec
			// Soporte para variantes numéricas sin ceros a la izquierda (ej. "01" y "1")
			cleanLeading := strings.TrimLeft(trimmedCode, "0")
			if cleanLeading != "" {
				sectorByCode[cleanLeading] = sec
			}
		}
	}

	// 3. Transformar filas a modelos ProgramSubprogram resolviendo la FK con Sectores
	programItems := make([]models.ProgramSubprogram, 0, len(data))
	seenKeys := make(map[string]struct{}, len(data))

	for i, item := range data {
		raw, err := json.Marshal(item)
		if err != nil {
			err = fmt.Errorf("marshal program row %d: %w", i, err)
			s.failSync(ctx, syncLog.ID, err)
			return nil, err
		}

		var row RawSodaProgramRow
		if err := json.Unmarshal(raw, &row); err != nil {
			err = fmt.Errorf("unmarshal program row %d: %w", i, err)
			s.failSync(ctx, syncLog.ID, err)
			return nil, err
		}

		// Extraer código de programa
		progCode := strings.TrimSpace(row.CodigoPrograma)
		if progCode == "" {
			progCode = strings.TrimSpace(row.Code)
		}
		if progCode == "" {
			progCode = strings.TrimSpace(row.CodPrograma)
		}

		// Extraer nombre de programa
		progName := strings.TrimSpace(row.NombrePrograma)
		if progName == "" {
			progName = strings.TrimSpace(row.Name)
		}
		if progName == "" {
			progName = strings.TrimSpace(row.Programa)
		}

		if progCode == "" || progName == "" {
			continue // Omitir filas sin datos de programa indispensables
		}

		// Extraer código de sector y resolver FK
		sectorCode := strings.TrimSpace(row.CodigoSector)
		if sectorCode == "" {
			sectorCode = strings.TrimSpace(row.CodSector)
		}
		if sectorCode == "" {
			sectorCode = strings.TrimSpace(row.Sector)
		}

		if sectorCode == "" {
			continue // No se puede relacionar sin código de sector
		}

		matchedSector, exists := sectorByCode[sectorCode]
		if !exists {
			matchedSector, exists = sectorByCode[strings.ToLower(sectorCode)]
		}
		if !exists {
			matchedSector, exists = sectorByCode[strings.TrimLeft(sectorCode, "0")]
		}
		if !exists {
			// El sector no existe en base de datos; omitir para mantener integridad referencial
			continue
		}

		sectorName := strings.TrimSpace(row.NombreSector)
		if sectorName == "" {
			sectorName = strings.TrimSpace(row.NameSector)
		}
		if sectorName == "" {
			sectorName = matchedSector.Name
		}

		// Extraer o generar subprograma
		subprogCode := strings.TrimSpace(row.CodigoSubprograma)
		if subprogCode == "" {
			subprogCode = strings.TrimSpace(row.CodSubprograma)
		}
		if subprogCode == "" {
			subprogCode = "00" // Subprograma genérico por defecto
		}

		subprogName := strings.TrimSpace(row.NombreSubprograma)
		if subprogName == "" {
			subprogName = strings.TrimSpace(row.Subprograma)
		}
		if subprogName == "" {
			subprogName = progName
		}

		scope := strings.TrimSpace(row.AmbitoAplicacion)
		if scope == "" {
			scope = strings.TrimSpace(row.Ambito)
		}

		uniqueKey := fmt.Sprintf("%s:%s", progCode, subprogCode)
		if _, exists := seenKeys[uniqueKey]; exists {
			continue // Evitar duplicados dentro del mismo payload
		}
		seenKeys[uniqueKey] = struct{}{}

		programItem := models.ProgramSubprogram{
			ID:                uuid.New(),
			SectorID:          matchedSector.ID,
			CodigoSector:      matchedSector.Code,
			NombreSector:      sectorName,
			CodigoPrograma:    progCode,
			NombrePrograma:    progName,
			AmbitoAplicacion:  scope,
			CodigoSubprograma: subprogCode,
			NombreSubprograma: subprogName,
			CreatedAt:         time.Now(),
		}

		programItems = append(programItems, programItem)
	}

	// 5. Upsert Protegido: Se actualizan únicamente las columnas oficiales,
	// protegiendo y manteniendo intacto el campo 'observaciones' existente.
	if len(programItems) > 0 {
		err := s.db.WithContext(ctx).
			Table("programas_subprogramas").
			Clauses(clause.OnConflict{
				Columns: []clause.Column{
					{Name: "codigo_programa"},
					{Name: "codigo_subprograma"},
				},
				DoUpdates: clause.AssignmentColumns([]string{
					"sector_id",
					"codigo_sector",
					"nombre_sector",
					"nombre_programa",
					"ambito_aplicacion",
					"nombre_subprograma",
				}),
			}).
			CreateInBatches(programItems, 100).Error

		if err != nil {
			s.failSync(ctx, syncLog.ID, fmt.Errorf("bulk upsert programs: %w", err))
			return nil, fmt.Errorf("bulk upsert programs: %w", err)
		}
	}

	// 6. Finalizar auditoría con estado SUCCESS
	completedAt := time.Now()
	processedCount := len(programItems)

	_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", syncLog.ID).Updates(map[string]any{
		"completed_at":      &completedAt,
		"status":            models.SyncStatusSuccess,
		"records_processed": processedCount,
		"error_message":     "",
	})

	return &ProgramSyncResult{
		SyncLogID:        syncLog.ID,
		CatalogName:      CatalogNamePrograms,
		RecordsProcessed: processedCount,
		Status:           string(models.SyncStatusSuccess),
		DurationMs:       time.Since(startTime).Milliseconds(),
	}, nil
}

func (s *ProgramSyncService) failSync(ctx context.Context, logID uuid.UUID, syncErr error) {
	completedAt := time.Now()
	errMsg := syncErr.Error()
	_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", logID).Updates(map[string]any{
		"completed_at":  &completedAt,
		"status":        models.SyncStatusFailed,
		"error_message": errMsg,
	})
}
