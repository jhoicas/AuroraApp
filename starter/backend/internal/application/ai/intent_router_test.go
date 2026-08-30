package ai_test

import (
	"testing"

	"aurora-backend/internal/application/ai"
	"aurora-backend/internal/config"

	"github.com/stretchr/testify/assert"
)

func TestClassifyIntent_FAQ(t *testing.T) {
	assert.Equal(t, ai.IntentFAQ, ai.ClassifyIntent("¿Qué es el MGA?"))
	assert.Equal(t, ai.IntentFAQ, ai.ClassifyIntent("  Explica la viabilidad del proyecto  "))
}

func TestClassifyIntent_MGAGenerate(t *testing.T) {
	tests := []string{
		"Ayúdame a redactar el objetivo general",
		"Quiero crear las causas del árbol de problemas",
		"Armar la cadena de valor del proyecto",
		"Estructurar el presupuesto por actividades",
		"Necesito estructurar la formulación",
	}
	for _, prompt := range tests {
		assert.Equal(t, ai.IntentMGAGenerate, ai.ClassifyIntent(prompt), "prompt: %s", prompt)
	}
}

func TestResolveModel(t *testing.T) {
	cfg := &config.Config{
		AnthropicModelFast:     "fast-model",
		AnthropicModelPowerful: "powerful-model",
		AnthropicModel:         "default-model",
	}
	assert.Equal(t, "fast-model", ai.ResolveModel(ai.IntentFAQ, cfg))
	assert.Equal(t, "powerful-model", ai.ResolveModel(ai.IntentMGAGenerate, cfg))
}

func TestResolveModel_NilConfig(t *testing.T) {
	assert.NotEmpty(t, ai.ResolveModel(ai.IntentFAQ, nil))
	assert.NotEmpty(t, ai.ResolveModel(ai.IntentMGAGenerate, nil))
}
