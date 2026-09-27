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
	CatalogNameSectors = "SECTORS"
)

// RawSodaSectorRow representa los campos admitidos para el catálogo de sectores.
type RawSodaSectorRow struct {
	Codigo       string `json:"codigo"`
	Code         string `json:"code"`
	CodSector    string `json:"cod_sector"`
	CodigoSector string `json:"codigo_sector"`
	Nombre       string `json:"nombre"`
	Name         string `json:"name"`
	NombreSector string `json:"nombre_sector"`
	Sector       string `json:"sector"`
	Aplicacion   string `json:"aplicacion"`
	Application  string `json:"application"`
	Descripcion  string `json:"descripcion"`
}

// SectorSyncResult resume el resultado de la sincronización de sectores.
type SectorSyncResult struct {
	SyncLogID        uuid.UUID `json:"sync_log_id"`
	CatalogName      string    `json:"catalog_name"`
	RecordsProcessed int       `json:"records_processed"`
	Status           string    `json:"status"`
	DurationMs       int64     `json:"duration_ms"`
}

// SectorSyncService coordina la carga (Upsert Protegido) de Sectores desde JSON local.
type SectorSyncService struct {
	db *gorm.DB
}

// NewSectorSyncService inicializa el servicio de sincronización de sectores.
func NewSectorSyncService(db *gorm.DB) *SectorSyncService {
	if db == nil {
		panic("db is required for SectorSyncService")
	}
	return &SectorSyncService{
		db: db,
	}
}

// GetLatestSyncStatus consulta y devuelve la última entrada de auditoría para el catálogo de sectores.
func (s *SectorSyncService) GetLatestSyncStatus(ctx context.Context, catalogName string) (*models.CatalogSyncLog, error) {
	name := strings.TrimSpace(catalogName)
	if name == "" {
		name = CatalogNameSectors
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

// SyncSectors ejecuta la sincronización de Sectores desde data JSON aplicando Upsert Protegido sobre 'observaciones'.
func (s *SectorSyncService) SyncSectors(ctx context.Context, data []map[string]interface{}) (*SectorSyncResult, error) {
	startTime := time.Now()

	// 1. Crear registro de auditoría en estado IN_PROGRESS
	syncLog := models.CatalogSyncLog{
		ID:               uuid.New(),
		CatalogName:      CatalogNameSectors,
		StartedAt:        startTime,
		Status:           models.SyncStatusInProgress,
		RecordsProcessed: 0,
	}

	if err := s.db.WithContext(ctx).Create(&syncLog).Error; err != nil {
		return nil, fmt.Errorf("create initial sectors sync log: %w", err)
	}

	if len(data) == 0 {
		completedAt := time.Now()
		_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", syncLog.ID).Updates(map[string]any{
			"completed_at":       &completedAt,
			"status":             models.SyncStatusSuccess,
			"records_processed":  0,
			"error_message":      "",
		})
		return &SectorSyncResult{
			SyncLogID:        syncLog.ID,
			CatalogName:      CatalogNameSectors,
			RecordsProcessed: 0,
			Status:           string(models.SyncStatusSuccess),
			DurationMs:       time.Since(startTime).Milliseconds(),
		}, nil
	}

	// 2. Transformar filas a modelos Sector
	sectorItems := make([]models.Sector, 0, len(data))
	seenCodes := make(map[string]struct{}, len(data))

	for i, item := range data {
		raw, err := json.Marshal(item)
		if err != nil {
			err = fmt.Errorf("marshal sector row %d: %w", i, err)
			s.failSync(ctx, syncLog.ID, err)
			return nil, err
		}

		var row RawSodaSectorRow
		if err := json.Unmarshal(raw, &row); err != nil {
			err = fmt.Errorf("unmarshal sector row %d: %w", i, err)
			s.failSync(ctx, syncLog.ID, err)
			return nil, err
		}

		code := strings.TrimSpace(row.Codigo)
		if code == "" {
			code = strings.TrimSpace(row.Code)
		}
		if code == "" {
			code = strings.TrimSpace(row.CodSector)
		}
		if code == "" {
			code = strings.TrimSpace(row.CodigoSector)
		}

		name := strings.TrimSpace(row.Nombre)
		if name == "" {
			name = strings.TrimSpace(row.Name)
		}
		if name == "" {
			name = strings.TrimSpace(row.NombreSector)
		}
		if name == "" {
			name = strings.TrimSpace(row.Sector)
		}

		if code == "" || name == "" {
			continue // Omitir filas sin identificador esencial
		}

		if _, exists := seenCodes[code]; exists {
			continue // Evitar códigos duplicados en el mismo payload
		}
		seenCodes[code] = struct{}{}

		appDesc := strings.TrimSpace(row.Aplicacion)
		if appDesc == "" {
			appDesc = strings.TrimSpace(row.Application)
		}
		if appDesc == "" {
			appDesc = strings.TrimSpace(row.Descripcion)
		}

		sector := models.Sector{
			ID:          uuid.New(),
			Code:        code,
			Name:        name,
			Application: appDesc,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		sectorItems = append(sectorItems, sector)
	}

	// 4. Upsert Protegido: se actualizan 'nombre', 'aplicacion' y 'updated_at',
	// preservando estrictamente el campo 'observaciones' en la base de datos.
	if len(sectorItems) > 0 {
		err := s.db.WithContext(ctx).
			Table("sectores").
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "codigo"}},
				DoUpdates: clause.AssignmentColumns([]string{"nombre", "aplicacion", "updated_at"}),
			}).
			CreateInBatches(sectorItems, 100).Error

		if err != nil {
			s.failSync(ctx, syncLog.ID, fmt.Errorf("bulk upsert sectors: %w", err))
			return nil, fmt.Errorf("bulk upsert sectors: %w", err)
		}
	}

	// 5. Finalizar registro de auditoría con estado SUCCESS
	completedAt := time.Now()
	processedCount := len(sectorItems)

	_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", syncLog.ID).Updates(map[string]any{
		"completed_at":       &completedAt,
		"status":             models.SyncStatusSuccess,
		"records_processed":  processedCount,
		"error_message":      "",
	})

	return &SectorSyncResult{
		SyncLogID:        syncLog.ID,
		CatalogName:      CatalogNameSectors,
		RecordsProcessed: processedCount,
		Status:           string(models.SyncStatusSuccess),
		DurationMs:       time.Since(startTime).Milliseconds(),
	}, nil
}

func (s *SectorSyncService) failSync(ctx context.Context, logID uuid.UUID, syncErr error) {
	completedAt := time.Now()
	errMsg := syncErr.Error()
	_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", logID).Updates(map[string]any{
		"completed_at":  &completedAt,
		"status":        models.SyncStatusFailed,
		"error_message": errMsg,
	})
}
