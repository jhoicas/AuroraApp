package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectDeliverable entregable de proyecto asociado a un nodo EDT.
type ProjectDeliverable struct {
	ID                   uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID             uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index:idx_project_deliverables_tenant_project,priority:1" json:"tenant_id"`
	ProjectID            uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index:idx_project_deliverables_tenant_project,priority:2" json:"project_id"`
	ProjectEdtNodeID     uuid.UUID      `gorm:"column:project_edt_node_id;type:uuid;not null;index" json:"project_edt_node_id"`
	CatalogDeliverableID *uuid.UUID     `gorm:"column:catalog_deliverable_id;type:uuid" json:"catalog_deliverable_id,omitempty"`
	Code                 string         `gorm:"column:code;type:varchar(100);not null" json:"code"`
	Name                 string         `gorm:"column:name;type:text;not null" json:"name"`
	Amount               float64        `gorm:"column:amount;type:numeric(18,2);not null;default:0" json:"amount"`
	CreatedAt            time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt            time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant         Tenant         `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project        Project        `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	ProjectEdtNode ProjectEdtNode `gorm:"foreignKey:ProjectEdtNodeID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (ProjectDeliverable) TableName() string {
	return "project_deliverables"
}
