package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectEdtNode nodo EDT instanciado en un proyecto (cadena de valor Tipología A).
type ProjectEdtNode struct {
	ID           uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID     uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index:idx_project_edt_nodes_tenant_project,priority:1" json:"tenant_id"`
	ProjectID    uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index:idx_project_edt_nodes_tenant_project,priority:2" json:"project_id"`
	CatalogEdtID *uuid.UUID     `gorm:"column:catalog_edt_id;type:uuid" json:"catalog_edt_id,omitempty"`
	Code         string         `gorm:"column:code;type:varchar(100);not null" json:"code"`
	Level        int            `gorm:"column:level;not null;default:1" json:"level"`
	Name         string         `gorm:"column:name;type:text;not null" json:"name"`
	CreatedAt    time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant  Tenant  `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (ProjectEdtNode) TableName() string {
	return "project_edt_nodes"
}
