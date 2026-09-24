package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MgaParticipant actor o entidad involucrada en la formulación MGA.
// Los campos actor_id, entity_id y position_id referencian catálogos
// globales del DNP. Cuando actor_id == 6 (Otro), entity_id es nulo y
// otro_participante debe contener la descripción libre.
type MgaParticipant struct {
	ID                 uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID           uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ProjectID          uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index" json:"project_id"`
	ActorID            int            `gorm:"column:actor_id;not null" json:"actor_id"`
	EntityID           *int           `gorm:"column:entity_id" json:"entity_id"`
	PositionID         int            `gorm:"column:position_id;not null" json:"position_id"`
	OtroParticipante   *string        `gorm:"column:otro_participante;type:text" json:"otro_participante"`
	Interests          string         `gorm:"column:interests;type:text;not null" json:"interests"`
	Contribution       string         `gorm:"column:contribution;type:text;not null" json:"contribution"`
	CreatedAt          time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt          time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant   Tenant             `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project  Project            `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Actor    MgaCatalogActor    `gorm:"foreignKey:ActorID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
	Position MgaCatalogPosition `gorm:"foreignKey:PositionID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
}

func (MgaParticipant) TableName() string {
	return "mga_participants"
}
