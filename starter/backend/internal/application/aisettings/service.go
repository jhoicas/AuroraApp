// Package aisettings gestiona claves y modelos de proveedores IA (SUPER_ADMIN)
// como filas independientes en system_settings, con caché corta en memoria.
package aisettings

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
	"unicode"

	"aurora-backend/internal/config"
	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	KeyGeminiAPIKey    = "GEMINI_API_KEY"
	KeyGeminiModel     = "GEMINI_MODEL"
	KeyAnthropicAPIKey = "ANTHROPIC_API_KEY"
	KeyAnthropicModel  = "ANTHROPIC_MODEL"

	CacheTTL = 10 * time.Second

	defaultGeminiModel    = "gemini-1.5-flash"
	defaultAnthropicModel = "claude-haiku-4-5-20251001"
)

var managedKeys = []string{
	KeyGeminiAPIKey,
	KeyGeminiModel,
	KeyAnthropicAPIKey,
	KeyAnthropicModel,
}

var keyDescriptions = map[string]string{
	KeyGeminiAPIKey:    "API Key de Google Gemini",
	KeyGeminiModel:     "Modelo de chat Gemini (ej. gemini-1.5-flash)",
	KeyAnthropicAPIKey: "API Key de Anthropic Claude",
	KeyAnthropicModel:  "Modelo de chat Anthropic (ej. claude-haiku-4-5-20251001)",
}

// AISettings es la vista administrativa (keys enmascaradas en lecturas).
type AISettings struct {
	GeminiAPIKey    string `json:"gemini_api_key"`
	GeminiModel     string `json:"gemini_model"`
	AnthropicAPIKey string `json:"anthropic_api_key"`
	AnthropicModel  string `json:"anthropic_model"`
}

// Credentials son valores resueltos (sin enmascarar) para los clientes LLM.
type Credentials struct {
	GeminiAPIKey    string
	GeminiModel     string
	AnthropicAPIKey string
	AnthropicModel  string
}

// Service lee/escribe settings de IA y resuelve credenciales (DB → env).
type Service struct {
	db  *gorm.DB
	cfg *config.Config

	mu      sync.RWMutex
	cached  Credentials
	expires time.Time
}

func NewService(db *gorm.DB, cfg *config.Config) *Service {
	return &Service{db: db, cfg: cfg}
}

// GetMasked devuelve la configuración actual con API keys enmascaradas.
func (s *Service) GetMasked(ctx context.Context) (AISettings, error) {
	creds, err := s.loadFromDB(ctx)
	if err != nil {
		return AISettings{}, err
	}
	// Si la BD está vacía, mostrar fallback de env (también enmascarado) para que el admin vea el estado efectivo.
	effective := s.mergeEnv(creds)
	return AISettings{
		GeminiAPIKey:    MaskSecret(effective.GeminiAPIKey),
		GeminiModel:     effective.GeminiModel,
		AnthropicAPIKey: MaskSecret(effective.AnthropicAPIKey),
		AnthropicModel:  effective.AnthropicModel,
	}, nil
}

// Upsert actualiza o crea las claves enviadas. Ignora valores enmascarados.
func (s *Service) Upsert(ctx context.Context, actorID uuid.UUID, req AISettings) (AISettings, error) {
	current, err := s.loadFromDB(ctx)
	if err != nil {
		return AISettings{}, err
	}

	updates := map[string]string{}
	if !IsMaskedSecret(req.GeminiAPIKey) {
		updates[KeyGeminiAPIKey] = strings.TrimSpace(req.GeminiAPIKey)
	}
	if !IsMaskedSecret(req.GeminiModel) {
		updates[KeyGeminiModel] = strings.TrimSpace(req.GeminiModel)
	}
	if !IsMaskedSecret(req.AnthropicAPIKey) {
		updates[KeyAnthropicAPIKey] = strings.TrimSpace(req.AnthropicAPIKey)
	}
	if !IsMaskedSecret(req.AnthropicModel) {
		updates[KeyAnthropicModel] = strings.TrimSpace(req.AnthropicModel)
	}

	if len(updates) == 0 {
		return s.GetMasked(ctx)
	}

	now := time.Now().UTC()
	actor := actorID.String()
	before := current

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for key, value := range updates {
			raw, marshalErr := json.Marshal(value)
			if marshalErr != nil {
				return marshalErr
			}
			row := models.SystemSetting{
				Key:         key,
				Value:       string(raw),
				Description: keyDescriptions[key],
				UpdatedBy:   &actor,
				UpdatedAt:   now,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "key"}},
				DoUpdates: clause.AssignmentColumns([]string{"value", "description", "updated_by", "updated_at"}),
			}).Create(&row).Error; err != nil {
				return err
			}
		}
		details, _ := json.Marshal(map[string]any{
			"before": sanitizeForAudit(before),
			"after":  sanitizeForAudit(applyUpdates(before, updates)),
		})
		return tx.Create(&models.AccessAuditLog{
			ActorUserID: &actorID,
			Action:      models.AuditAISettingsUpdated,
			Details:     string(details),
			CreatedAt:   now,
		}).Error
	})
	if err != nil {
		return AISettings{}, err
	}

	s.invalidateCache()
	return s.GetMasked(ctx)
}

// ResolveCredentials combina BD + env (BD gana si no vacío). Cachea el resultado.
func (s *Service) ResolveCredentials(ctx context.Context) Credentials {
	s.mu.RLock()
	if time.Now().Before(s.expires) {
		v := s.cached
		s.mu.RUnlock()
		return v
	}
	prev := s.cached
	s.mu.RUnlock()

	dbCreds, err := s.loadFromDB(ctx)
	if err != nil {
		if prev != (Credentials{}) {
			return prev
		}
		return s.mergeEnv(Credentials{})
	}
	merged := s.mergeEnv(dbCreds)
	s.mu.Lock()
	s.cached, s.expires = merged, time.Now().Add(CacheTTL)
	s.mu.Unlock()
	return merged
}

// AnthropicCredentials retorna key/model o error claro si falta la key.
func (s *Service) AnthropicCredentials(ctx context.Context) (apiKey, model string, err error) {
	c := s.ResolveCredentials(ctx)
	if strings.TrimSpace(c.AnthropicAPIKey) == "" {
		return "", "", errors.New("API Key de Anthropic no configurada en el sistema")
	}
	model = strings.TrimSpace(c.AnthropicModel)
	if model == "" {
		model = defaultAnthropicModel
	}
	return c.AnthropicAPIKey, model, nil
}

// GeminiCredentials retorna key/model o error claro si falta la key.
func (s *Service) GeminiCredentials(ctx context.Context) (apiKey, model string, err error) {
	c := s.ResolveCredentials(ctx)
	if strings.TrimSpace(c.GeminiAPIKey) == "" {
		return "", "", errors.New("API Key de Gemini no configurada en el sistema")
	}
	model = strings.TrimSpace(c.GeminiModel)
	if model == "" {
		model = defaultGeminiModel
	}
	return c.GeminiAPIKey, model, nil
}

func (s *Service) invalidateCache() {
	s.mu.Lock()
	s.expires = time.Time{}
	s.mu.Unlock()
}

func (s *Service) loadFromDB(ctx context.Context) (Credentials, error) {
	var rows []models.SystemSetting
	if err := s.db.WithContext(ctx).Where("key IN ?", managedKeys).Find(&rows).Error; err != nil {
		return Credentials{}, err
	}
	out := Credentials{}
	for _, row := range rows {
		val, err := decodeSettingValue(row.Value)
		if err != nil {
			continue
		}
		switch row.Key {
		case KeyGeminiAPIKey:
			out.GeminiAPIKey = val
		case KeyGeminiModel:
			out.GeminiModel = val
		case KeyAnthropicAPIKey:
			out.AnthropicAPIKey = val
		case KeyAnthropicModel:
			out.AnthropicModel = val
		}
	}
	return out, nil
}

func (s *Service) mergeEnv(db Credentials) Credentials {
	out := db
	if out.GeminiAPIKey == "" {
		out.GeminiAPIKey = firstNonEmpty(envOrCfgGeminiKey(s.cfg), os.Getenv(KeyGeminiAPIKey))
	}
	if out.GeminiModel == "" {
		out.GeminiModel = firstNonEmpty(envOrCfgGeminiModel(s.cfg), os.Getenv(KeyGeminiModel), defaultGeminiModel)
	}
	if out.AnthropicAPIKey == "" {
		out.AnthropicAPIKey = firstNonEmpty(envOrCfgAnthropicKey(s.cfg), os.Getenv(KeyAnthropicAPIKey))
	}
	if out.AnthropicModel == "" {
		out.AnthropicModel = firstNonEmpty(envOrCfgAnthropicModel(s.cfg), os.Getenv(KeyAnthropicModel), defaultAnthropicModel)
	}
	return out
}

func envOrCfgGeminiKey(cfg *config.Config) string {
	if cfg != nil {
		return strings.TrimSpace(cfg.GeminiApiKey)
	}
	return ""
}

func envOrCfgGeminiModel(cfg *config.Config) string {
	if cfg != nil {
		return strings.TrimSpace(cfg.GeminiModel)
	}
	return ""
}

func envOrCfgAnthropicKey(cfg *config.Config) string {
	if cfg != nil {
		return strings.TrimSpace(cfg.AnthropicApiKey)
	}
	return ""
}

func envOrCfgAnthropicModel(cfg *config.Config) string {
	if cfg != nil {
		if m := strings.TrimSpace(cfg.AnthropicModel); m != "" {
			return m
		}
		if m := strings.TrimSpace(cfg.AnthropicModelPowerful); m != "" {
			return m
		}
		return strings.TrimSpace(cfg.AnthropicModelFast)
	}
	return ""
}

func decodeSettingValue(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "{}" || raw == "null" {
		return "", nil
	}
	var s string
	if err := json.Unmarshal([]byte(raw), &s); err == nil {
		return s, nil
	}
	// Compatibilidad: valor no JSON (texto plano).
	return raw, nil
}

// MaskSecret oculta secretos mostrando solo los últimos 4 caracteres.
func MaskSecret(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	const visible = 4
	if len(value) <= visible {
		return strings.Repeat("•", len(value))
	}
	return strings.Repeat("•", 12) + value[len(value)-visible:]
}

// IsMaskedSecret detecta payloads que no deben sobrescribir la clave real.
func IsMaskedSecret(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	hasMaskRune := false
	for _, r := range value {
		if r == '•' || r == '*' {
			hasMaskRune = true
			break
		}
	}
	if !hasMaskRune {
		return false
	}
	// Si contiene muchos caracteres de máscara, tratarlo como enmascarado.
	maskCount := 0
	for _, r := range value {
		if r == '•' || r == '*' {
			maskCount++
		}
	}
	return maskCount >= 4 || (maskCount > 0 && !looksLikeAPIKey(value))
}

func looksLikeAPIKey(value string) bool {
	// Claves reales suelen empezar con prefijos conocidos y no con bullets.
	if strings.HasPrefix(value, "sk-") || strings.HasPrefix(value, "AIza") {
		return true
	}
	for _, r := range value {
		if r == '•' || r == '*' {
			return false
		}
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '-' && r != '_' {
			return false
		}
	}
	return len(value) >= 16
}

func applyUpdates(base Credentials, updates map[string]string) Credentials {
	out := base
	for k, v := range updates {
		switch k {
		case KeyGeminiAPIKey:
			out.GeminiAPIKey = v
		case KeyGeminiModel:
			out.GeminiModel = v
		case KeyAnthropicAPIKey:
			out.AnthropicAPIKey = v
		case KeyAnthropicModel:
			out.AnthropicModel = v
		}
	}
	return out
}

func sanitizeForAudit(c Credentials) map[string]string {
	return map[string]string{
		"gemini_api_key":    MaskSecret(c.GeminiAPIKey),
		"gemini_model":      c.GeminiModel,
		"anthropic_api_key": MaskSecret(c.AnthropicAPIKey),
		"anthropic_model":   c.AnthropicModel,
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// EnsureSchema garantiza la columna description (idempotente).
func EnsureSchema(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("aisettings: db nil")
	}
	if err := db.AutoMigrate(&models.SystemSetting{}); err != nil {
		return err
	}
	return nil
}
