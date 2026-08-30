package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectCatalogLink snapshot del producto DNP vinculado a un proyecto.
type ProjectCatalogLink struct {
	ID          uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID    uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index:idx_project_catalog_links_tenant_project,priority:1" json:"tenant_id"`
	ProjectID   uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index:idx_project_catalog_links_tenant_project,priority:2" json:"project_id"`
	ProductID   uuid.UUID      `gorm:"column:product_id;type:uuid;not null" json:"product_id"`
	ProductCode string         `gorm:"column:product_code;type:varchar(50);not null" json:"product_code"`
	Tipologia   string         `gorm:"column:tipologia;type:varchar(10);not null;default:''" json:"tipologia"`
	RequiresEdt bool           `gorm:"column:requires_edt;not null;default:false" json:"requires_edt"`
	SectorCode  string         `gorm:"column:sector_code;type:varchar(50);not null;default:''" json:"sector_code"`
	ProgramCode string         `gorm:"column:program_code;type:varchar(50);not null;default:''" json:"program_code"`
	CreatedAt   time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant  Tenant  `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (ProjectCatalogLink) TableName() string {
	return "project_catalog_links"
}
