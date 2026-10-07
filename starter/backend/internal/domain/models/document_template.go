package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DocumentTemplate es una plantilla HTML del Documento Técnico (Dec. 1278).
// TenantID nulo + IsSystemDefault = plantilla global del sistema (solo lectura para entidades).
// Cada tenant puede tener varias plantillas, pero a lo sumo una con IsActive=true.
type DocumentTemplate struct {
	ID              uuid.UUID      `gorm:"column:id;type:uuid;primaryKey" json:"id"`
	TenantID        *uuid.UUID     `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id"`
	Name            string         `gorm:"column:name;type:varchar(255);not null" json:"name"`
	HTMLContent     string         `gorm:"column:html_content;type:text;not null" json:"html_content,omitempty"`
	IsActive        bool           `gorm:"column:is_active;not null;default:false" json:"is_active"`
	IsSystemDefault bool           `gorm:"column:is_system_default;not null;default:false;index" json:"is_system_default"`
	CreatedAt       time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt       time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`
}

func (DocumentTemplate) TableName() string {
	return "document_templates"
}

// BeforeCreate asigna UUID en aplicación (portable entre Postgres y SQLite de pruebas).
func (t *DocumentTemplate) BeforeCreate(_ *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}
