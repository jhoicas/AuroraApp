package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CatalogSyncStatus string

const (
	SyncStatusInProgress CatalogSyncStatus = "IN_PROGRESS"
	SyncStatusSuccess    CatalogSyncStatus = "SUCCESS"
	SyncStatusFailed     CatalogSyncStatus = "FAILED"
)

// CatalogSyncLog registra la trazabilidad y auditoría de sincronizaciones
// periódicas o manuales de catálogos gubernamentales (ej. SODA DNP PND, DIVIPOLA).
type CatalogSyncLog struct {
	ID               uuid.UUID         `gorm:"column:id;type:uuid;primaryKey" json:"id"`
	CatalogName      string            `gorm:"column:catalog_name;type:varchar(100);not null;index" json:"catalog_name"`
	StartedAt        time.Time         `gorm:"column:started_at;not null;index" json:"started_at"`
	CompletedAt      *time.Time        `gorm:"column:completed_at" json:"completed_at,omitempty"`
	Status           CatalogSyncStatus `gorm:"column:status;type:varchar(50);not null;index" json:"status"`
	RecordsProcessed int               `gorm:"column:records_processed;default:0" json:"records_processed"`
	ErrorMessage     string            `gorm:"column:error_message;type:text" json:"error_message,omitempty"`
	CreatedAt        time.Time         `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time         `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (l *CatalogSyncLog) BeforeCreate(tx *gorm.DB) (err error) {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}

func (CatalogSyncLog) TableName() string {
	return "catalog_sync_logs"
}
