package models

import "time"

type PNDCatalog struct {
	ID                   uint      `gorm:"primaryKey" json:"id"`
	PlanID               *int      `json:"PlanId"`
	PlanName             *string   `json:"PlanName"`
	PillarID             int       `gorm:"index" json:"PillarId"`
	ObjectiveID          int       `gorm:"index" json:"ObjectiveId"`
	StrategyID           int       `gorm:"index" json:"StrategyId"`
	ComponentID          int       `gorm:"index" json:"ComponentId"`
	PillarDescription    string    `gorm:"type:text;index" json:"PillarDescription"`    // Transformación
	ObjectiveDescription string    `gorm:"type:text;index" json:"ObjectiveDescription"` // Pilar
	StrategyDescription  string    `gorm:"type:text;index" json:"StrategyDescription"`  // Catalizador
	ComponentDescription string    `gorm:"type:text;index" json:"ComponentDescription"` // Componente
	RowState             int       `json:"RowState"`
	UniqueIdentifier     *string   `json:"UniqueIdentifier"`
	CreatedAt            time.Time `json:"CreatedAt"`
	UpdatedAt            time.Time `json:"UpdatedAt"`
}
