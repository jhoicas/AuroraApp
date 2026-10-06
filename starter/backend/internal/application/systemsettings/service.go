// Package systemsettings gestiona la configuración global de la plataforma
// (SUPER_ADMIN): avisos, seguridad de sesión y modo mantenimiento.
package systemsettings

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	DefaultTokenExpiryMinutes = 60
	MinTokenExpiryMinutes     = 5
	MaxTokenExpiryMinutes     = 1440
	// CacheTTL acota la lectura por petición del modo mantenimiento.
	CacheTTL = 5 * time.Second
)

// Settings es el objeto de configuración global.
type Settings struct {
	SupportEmail       string `json:"support_email"`
	BannerEnabled      bool   `json:"banner_enabled"`
	BannerMessage      string `json:"banner_message"`
	TokenExpiryMinutes int    `json:"token_expiry_minutes"`
	ForceSessionExpiry bool   `json:"force_session_expiry"`
	MaintenanceMode    bool   `json:"maintenance_mode"`
}

// Defaults devuelve los valores iniciales.
func Defaults() Settings {
	return Settings{TokenExpiryMinutes: DefaultTokenExpiryMinutes}
}

// Validate normaliza y valida los campos.
func (s *Settings) Validate() error {
	s.SupportEmail = strings.TrimSpace(s.SupportEmail)
	s.BannerMessage = strings.TrimSpace(s.BannerMessage)
	if s.SupportEmail != "" {
		at := strings.Index(s.SupportEmail, "@")
		if len(s.SupportEmail) > 254 || at < 1 || at == len(s.SupportEmail)-1 || strings.ContainsAny(s.SupportEmail, " \t") {
			return errors.New("support_email inválido")
		}
	}
	if len(s.BannerMessage) > 500 {
		return errors.New("banner_message excede 500 caracteres")
	}
	if s.BannerEnabled && s.BannerMessage == "" {
		return errors.New("banner_message requerido para activar el banner")
	}
	if s.TokenExpiryMinutes < MinTokenExpiryMinutes || s.TokenExpiryMinutes > MaxTokenExpiryMinutes {
		return fmt.Errorf("token_expiry_minutes debe estar entre %d y %d", MinTokenExpiryMinutes, MaxTokenExpiryMinutes)
	}
	return nil
}

// Service lee/escribe la configuración con caché corta en memoria.
type Service struct {
	db *gorm.DB

	mu      sync.RWMutex
	cached  Settings
	expires time.Time
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

// Get devuelve la configuración; si no existe la inicializa con valores por defecto.
func (s *Service) Get(ctx context.Context) (Settings, error) {
	var row models.SystemSetting
	err := s.db.WithContext(ctx).Where("key = ?", models.SystemSettingsKeyGlobal).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		def := Defaults()
		raw, _ := json.Marshal(def)
		seed := models.SystemSetting{Key: models.SystemSettingsKeyGlobal, Value: string(raw), UpdatedAt: time.Now().UTC()}
		if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&seed).Error; err != nil {
			return Settings{}, err
		}
		return def, nil
	}
	if err != nil {
		return Settings{}, err
	}
	cur := Defaults()
	if err := json.Unmarshal([]byte(row.Value), &cur); err != nil {
		return Settings{}, err
	}
	return cur, nil
}

// Cached es como Get pero con caché de CacheTTL; ante error devuelve el último valor conocido.
func (s *Service) Cached(ctx context.Context) Settings {
	s.mu.RLock()
	if time.Now().Before(s.expires) {
		v := s.cached
		s.mu.RUnlock()
		return v
	}
	prev := s.cached
	s.mu.RUnlock()

	cur, err := s.Get(ctx)
	if err != nil {
		if prev == (Settings{}) {
			return Defaults()
		}
		return prev
	}
	s.mu.Lock()
	s.cached, s.expires = cur, time.Now().Add(CacheTTL)
	s.mu.Unlock()
	return cur
}

// Update persiste la configuración y registra la auditoría en la misma transacción.
func (s *Service) Update(ctx context.Context, actorID uuid.UUID, next Settings) (Settings, error) {
	if err := next.Validate(); err != nil {
		return Settings{}, err
	}
	prev, err := s.Get(ctx)
	if err != nil {
		return Settings{}, err
	}
	raw, _ := json.Marshal(next)
	details, _ := json.Marshal(map[string]any{"before": prev, "after": next})
	now := time.Now().UTC()
	actor := actorID.String()
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		row := models.SystemSetting{Key: models.SystemSettingsKeyGlobal, Value: string(raw), UpdatedBy: &actor, UpdatedAt: now}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "key"}},
			DoUpdates: clause.AssignmentColumns([]string{"value", "updated_by", "updated_at"}),
		}).Create(&row).Error; err != nil {
			return err
		}
		return tx.Create(&models.AccessAuditLog{
			ActorUserID: &actorID,
			Action:      models.AuditSystemSettingsUpdated,
			Details:     string(details),
			CreatedAt:   now,
		}).Error
	})
	if err != nil {
		return Settings{}, err
	}
	s.mu.Lock()
	s.cached, s.expires = next, time.Now().Add(CacheTTL)
	s.mu.Unlock()
	return next, nil
}

// TokenTTLs implementa handlers.SessionPolicy. Con force_session_expiry el refresh token
// dura lo mismo que el access token: la sesión no se renueva en silencio.
func (s *Service) TokenTTLs(ctx context.Context) (time.Duration, time.Duration, bool) {
	cur := s.Cached(ctx)
	access := time.Duration(cur.TokenExpiryMinutes) * time.Minute
	if access <= 0 {
		return 0, 0, false
	}
	refresh := 7 * 24 * time.Hour
	if cur.ForceSessionExpiry {
		refresh = access
	}
	return access, refresh, true
}
