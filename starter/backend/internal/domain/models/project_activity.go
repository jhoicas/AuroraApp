package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectActivity actividad presupuestal de un entregable de proyecto.
type ProjectActivity struct {
	ID                   uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID             uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index:idx_project_activities_tenant_project,priority:1" json:"tenant_id"`
	ProjectID            uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index:idx_project_activities_tenant_project,priority:2" json:"project_id"`
	ProjectDeliverableID uuid.UUID      `gorm:"column:project_deliverable_id;type:uuid;not null;index" json:"project_deliverable_id"`
	CatalogActivityID    *uuid.UUID     `gorm:"column:catalog_activity_id;type:uuid" json:"catalog_activity_id,omitempty"`
	Code                 string         `gorm:"column:code;type:varchar(100);not null" json:"code"`
	Name                 string         `gorm:"column:name;type:text;not null" json:"name"`
	Quantity             float64        `gorm:"column:quantity;type:numeric(18,4);not null;default:0" json:"quantity"`
	UnitCost             float64        `gorm:"column:unit_cost;type:numeric(18,2);not null;default:0" json:"unit_cost"`
	TotalCost            float64        `gorm:"column:total_cost;type:numeric(18,2);not null;default:0" json:"total_cost"`
	CreatedAt            time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt            time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant             Tenant             `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project            Project            `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	ProjectDeliverable ProjectDeliverable `gorm:"foreignKey:ProjectDeliverableID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (ProjectActivity) TableName() string {
	return "project_activities"
}
