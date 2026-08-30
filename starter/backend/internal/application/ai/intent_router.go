package ai

import (
	"strings"

	"aurora-backend/internal/config"
)

const (
	IntentMGAGenerate = "INTENT_MGA_GENERATE"
	IntentFAQ         = "INTENT_FAQ"
)

var mgaGenerateKeywords = []string{
	"crear",
	"armar",
	"estructurar",
	"redactar",
	"presupuesto",
	"cadena de valor",
}

// ClassifyIntent clasifica heurísticamente la intención del prompt del usuario.
func ClassifyIntent(prompt string) string {
	normalized := strings.ToLower(strings.TrimSpace(prompt))
	for _, kw := range mgaGenerateKeywords {
		if strings.Contains(normalized, kw) {
			return IntentMGAGenerate
		}
	}
	return IntentFAQ
}

// ResolveModel selecciona el modelo Anthropic según la intención detectada.
func ResolveModel(intent string, cfg *config.Config) string {
	if cfg == nil {
		return defaultFastModel()
	}
	switch intent {
	case IntentMGAGenerate:
		if m := strings.TrimSpace(cfg.AnthropicModelPowerful); m != "" {
			return m
		}
		return defaultPowerfulModel()
	default:
		if m := strings.TrimSpace(cfg.AnthropicModelFast); m != "" {
			return m
		}
		if m := strings.TrimSpace(cfg.AnthropicModel); m != "" {
			return m
		}
		return defaultFastModel()
	}
}

func defaultFastModel() string {
	return "claude-haiku-4-5-20251001"
}

func defaultPowerfulModel() string {
	return defaultFastModel()
}
