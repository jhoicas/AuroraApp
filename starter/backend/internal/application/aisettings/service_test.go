package aisettings_test

import (
	"context"
	"testing"

	"aurora-backend/internal/application/aisettings"
	"aurora-backend/internal/config"
	"aurora-backend/internal/domain/models"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupAISettingsDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:aisettings_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.SystemSetting{}, &models.AccessAuditLog{}))
	return db
}

func TestMaskAndDetectMasked(t *testing.T) {
	assert.Equal(t, "", aisettings.MaskSecret(""))
	maskedShort := aisettings.MaskSecret("xxxxxxxxxxxxabcd")
	assert.True(t, len(maskedShort) >= 4)
	assert.Equal(t, "abcd", maskedShort[len(maskedShort)-4:])
	assert.Contains(t, maskedShort, "•")

	masked := aisettings.MaskSecret("sk-abcdefghijklmnopqrstuvwxyz")
	assert.Contains(t, masked, "wxyz")
	assert.True(t, aisettings.IsMaskedSecret(masked))
	assert.False(t, aisettings.IsMaskedSecret("sk-live-real-key-1234567890"))
	assert.False(t, aisettings.IsMaskedSecret(""))
}

func TestUpsertIgnoresMaskedKeys(t *testing.T) {
	db := setupAISettingsDB(t)
	svc := aisettings.NewService(db, &config.Config{})
	actor := uuid.New()

	_, err := svc.Upsert(context.Background(), actor, aisettings.AISettings{
		GeminiAPIKey:    "AIzaSyRealKeyForGeminiTests123456",
		GeminiModel:     "gemini-1.5-flash",
		AnthropicAPIKey: "sk-ant-real-key-abcdefghijklmnop",
		AnthropicModel:  "claude-haiku-4-5-20251001",
	})
	require.NoError(t, err)

	masked, err := svc.GetMasked(context.Background())
	require.NoError(t, err)
	assert.True(t, aisettings.IsMaskedSecret(masked.GeminiAPIKey))
	assert.Equal(t, "gemini-1.5-flash", masked.GeminiModel)

	_, err = svc.Upsert(context.Background(), actor, aisettings.AISettings{
		GeminiAPIKey:    masked.GeminiAPIKey,
		GeminiModel:     "gemini-2.0-flash",
		AnthropicAPIKey: masked.AnthropicAPIKey,
		AnthropicModel:  "claude-sonnet-4-5",
	})
	require.NoError(t, err)

	key, model, err := svc.GeminiCredentials(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "AIzaSyRealKeyForGeminiTests123456", key)
	assert.Equal(t, "gemini-2.0-flash", model)

	akey, amodel, err := svc.AnthropicCredentials(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "sk-ant-real-key-abcdefghijklmnop", akey)
	assert.Equal(t, "claude-sonnet-4-5", amodel)
}

func TestMissingCredentialsError(t *testing.T) {
	db := setupAISettingsDB(t)
	svc := aisettings.NewService(db, &config.Config{})
	_, _, err := svc.GeminiCredentials(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Gemini")
	_, _, err = svc.AnthropicCredentials(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Anthropic")
}

func TestEnvFallback(t *testing.T) {
	db := setupAISettingsDB(t)
	svc := aisettings.NewService(db, &config.Config{
		GeminiApiKey:    "env-gemini-key-1234567890",
		GeminiModel:     "gemini-from-env",
		AnthropicApiKey: "env-anthropic-key-1234567890",
		AnthropicModel:  "claude-from-env",
	})
	gKey, gModel, err := svc.GeminiCredentials(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "env-gemini-key-1234567890", gKey)
	assert.Equal(t, "gemini-from-env", gModel)
}
