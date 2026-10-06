package models

import "time"

// SystemSetting almacena un parámetro global de la plataforma (clave → JSON).
// La configuración completa vive bajo la clave SystemSettingsKeyGlobal.
type SystemSetting struct {
	Key       string    `gorm:"column:key;type:varchar(100);primaryKey" json:"key"`
	Value     string    `gorm:"column:value;type:jsonb;not null;default:'{}'" json:"value"`
	UpdatedBy *string   `gorm:"column:updated_by;type:uuid" json:"updated_by,omitempty"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
}

func (SystemSetting) TableName() string { return "system_settings" }

// SystemSettingsKeyGlobal es la clave del objeto de configuración global.
const SystemSettingsKeyGlobal = "global"

// AuditSystemSettingsUpdated registra cada cambio de configuración global.
const AuditSystemSettingsUpdated = "SYSTEM_SETTINGS_UPDATED"
