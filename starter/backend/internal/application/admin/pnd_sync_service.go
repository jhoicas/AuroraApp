package admin

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/soda"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	PndDatasetResourceID = "uds4-jdij.json"
	CatalogNamePnd       = "PND"
)

// RawSodaPndRow representa la estructura JSON devuelta por la API de Datos Abiertos para PND.
type RawSodaPndRow struct {
	TipoPlanDesarrollo             string `json:"tipoplandesarrollo"`
	NombrePlanDesarrollo           string `json:"nombreplandesarrollo"`
	NombreIndicador                string `json:"nombreindicador"`
	UnidadMedida                   string `json:"unidadmedida"`
	MetaTotal                      string `json:"metatotal"`
	NivelPlanDesarrollo            string `json:"nivelplandesarrollo"`
	DescripcionNivelPlanDesarrollo string `json:"descripcionnivelplandesarrollo"`
	Meta                           string `json:"meta"`
	LineaBase                      string `json:"lineabase"`
	ValorLineaBase                 string `json:"valorlineabase"`
}

// PndSyncResult resume el resultado de la sincronización.
type PndSyncResult struct {
	SyncLogID        uuid.UUID `json:"sync_log_id"`
	CatalogName      string    `json:"catalog_name"`
	RecordsProcessed int       `json:"records_processed"`
	Status           string    `json:"status"`
	DurationMs       int64     `json:"duration_ms"`
}

// PndSyncService coordina la extracción, transformación y carga (ETL/Upsert) de datos PND desde SODA.
type PndSyncService struct {
	db         *gorm.DB
	sodaClient soda.Client
}

// NewPndSyncService inicializa el servicio de sincronización con dependencias obligatorias.
func NewPndSyncService(db *gorm.DB, sodaClient soda.Client) *PndSyncService {
	if db == nil {
		panic("db is required for PndSyncService")
	}
	if sodaClient == nil {
		sodaClient = soda.NewClient(soda.DefaultBaseURL, "", nil)
	}
	return &PndSyncService{
		db:         db,
		sodaClient: sodaClient,
	}
}

// GetLatestSyncStatus consulta y retorna la última entrada de auditoría para el catálogo especificado.
func (s *PndSyncService) GetLatestSyncStatus(ctx context.Context, catalogName string) (*models.CatalogSyncLog, error) {
	name := strings.TrimSpace(catalogName)
	if name == "" {
		name = CatalogNamePnd
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

// SyncPnd ejecuta la sincronización completa del PND contra SODA datos.gov.co.
func (s *PndSyncService) SyncPnd(ctx context.Context) (*PndSyncResult, error) {
	startTime := time.Now()

	// 1. Crear registro de auditoría en estado IN_PROGRESS
	syncLog := models.CatalogSyncLog{
		ID:               uuid.New(),
		CatalogName:      CatalogNamePnd,
		StartedAt:        startTime,
		Status:           models.SyncStatusInProgress,
		RecordsProcessed: 0,
	}

	if err := s.db.WithContext(ctx).Create(&syncLog).Error; err != nil {
		return nil, fmt.Errorf("create initial catalog sync log: %w", err)
	}

	// 2. Extraer registros desde la API SODA
	rawMessages, err := s.sodaClient.FetchAll(ctx, PndDatasetResourceID, nil)
	if err != nil {
		s.failSync(ctx, syncLog.ID, fmt.Errorf("fetch data from SODA API: %w", err))
		return nil, fmt.Errorf("fetch data from SODA API: %w", err)
	}

	if len(rawMessages) == 0 {
		completedAt := time.Now()
		_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", syncLog.ID).Updates(map[string]any{
			"completed_at":       &completedAt,
			"status":             models.SyncStatusSuccess,
			"records_processed":  0,
			"error_message":      "",
		})
		return &PndSyncResult{
			SyncLogID:        syncLog.ID,
			CatalogName:      CatalogNamePnd,
			RecordsProcessed: 0,
			Status:           string(models.SyncStatusSuccess),
			DurationMs:       time.Since(startTime).Milliseconds(),
		}, nil
	}

	// 3. Transformar JSON plano a estructuras jerárquicas de PNDCatalog
	catalogItems := make([]models.PNDCatalog, 0, len(rawMessages))
	seenIdentifiers := make(map[string]struct{}, len(rawMessages))

	for i, raw := range rawMessages {
		var row RawSodaPndRow
		if err := json.Unmarshal(raw, &row); err != nil {
			err = fmt.Errorf("unmarshal soda row %d: %w", i, err)
			s.failSync(ctx, syncLog.ID, err)
			return nil, err
		}

		uniqueID := generateDeterministicUniqueIdentifier(row)
		if _, exists := seenIdentifiers[uniqueID]; exists {
			continue // Evitar duplicados dentro del mismo payload de inserción
		}
		seenIdentifiers[uniqueID] = struct{}{}

		planName := strings.TrimSpace(row.NombrePlanDesarrollo)
		if planName == "" {
			planName = "Plan Nacional de Desarrollo"
		}

		pillarDesc := strings.TrimSpace(row.TipoPlanDesarrollo)
		if pillarDesc == "" {
			pillarDesc = planName
		}

		objectiveDesc := strings.TrimSpace(row.DescripcionNivelPlanDesarrollo)
		if objectiveDesc == "" {
			objectiveDesc = strings.TrimSpace(row.NivelPlanDesarrollo)
		}

		strategyDesc := strings.TrimSpace(row.NivelPlanDesarrollo)
		if strategyDesc == "" {
			strategyDesc = "Estrategia General"
		}

		componentDesc := strings.TrimSpace(row.NombreIndicador)
		if componentDesc == "" {
			componentDesc = strings.TrimSpace(row.Meta)
		}

		metaInt, _ := strconv.Atoi(strings.TrimSpace(row.Meta))

		item := models.PNDCatalog{
			PlanName:             &planName,
			PillarID:             1,
			ObjectiveID:          1,
			StrategyID:           1,
			ComponentID:          metaInt,
			PillarDescription:    pillarDesc,
			ObjectiveDescription: objectiveDesc,
			StrategyDescription:  strategyDesc,
			ComponentDescription: componentDesc,
			RowState:             1,
			UniqueIdentifier:     &uniqueID,
			UpdatedAt:            time.Now(),
		}

		catalogItems = append(catalogItems, item)
	}

	// 4. Upsert masivo en lotes de 100 usando clause.OnConflict{UpdateAll: true}
	if len(catalogItems) > 0 {
		err = s.db.WithContext(ctx).
			Table("pnd_catalog").
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "unique_identifier"}},
				UpdateAll: true,
			}).
			CreateInBatches(catalogItems, 100).Error

		if err != nil {
			s.failSync(ctx, syncLog.ID, fmt.Errorf("bulk upsert pnd catalogs: %w", err))
			return nil, fmt.Errorf("bulk upsert pnd catalogs: %w", err)
		}
	}

	// 5. Finalizar registro de auditoría con estado SUCCESS
	completedAt := time.Now()
	processedCount := len(catalogItems)

	_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", syncLog.ID).Updates(map[string]any{
		"completed_at":       &completedAt,
		"status":             models.SyncStatusSuccess,
		"records_processed":  processedCount,
		"error_message":      "",
	})

	return &PndSyncResult{
		SyncLogID:        syncLog.ID,
		CatalogName:      CatalogNamePnd,
		RecordsProcessed: processedCount,
		Status:           string(models.SyncStatusSuccess),
		DurationMs:       time.Since(startTime).Milliseconds(),
	}, nil
}

func (s *PndSyncService) failSync(ctx context.Context, logID uuid.UUID, syncErr error) {
	completedAt := time.Now()
	errMsg := syncErr.Error()
	_ = s.db.WithContext(ctx).Model(&models.CatalogSyncLog{}).Where("id = ?", logID).Updates(map[string]any{
		"completed_at":  &completedAt,
		"status":        models.SyncStatusFailed,
		"error_message": errMsg,
	})
}

func generateDeterministicUniqueIdentifier(row RawSodaPndRow) string {
	raw := fmt.Sprintf("%s|%s|%s|%s|%s|%s",
		strings.TrimSpace(row.TipoPlanDesarrollo),
		strings.TrimSpace(row.NombrePlanDesarrollo),
		strings.TrimSpace(row.NivelPlanDesarrollo),
		strings.TrimSpace(row.DescripcionNivelPlanDesarrollo),
		strings.TrimSpace(row.NombreIndicador),
		strings.TrimSpace(row.Meta),
	)
	hash := sha256.Sum256([]byte(raw))
	return "SODA-PND-" + hex.EncodeToString(hash[:16])
}
