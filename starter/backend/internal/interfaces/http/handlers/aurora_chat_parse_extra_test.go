package handlers

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDescribeRoute_AllBranches(t *testing.T) {
	tests := []struct {
		route string
		want  string
	}{
		{"/admin/catalogs/ods", "Catálogo de ODS"},
		{"/admin/catalogs/products", "Catálogo de Productos DNP"},
		{"/admin/catalogs/sectors", "Catálogo de Sectores"},
		{"/admin/catalogs/programs", "Catálogo de Programas"},
		{"/admin/catalogs/edt", "Catálogo EDT"},
		{"/admin/catalogs/indicators", "Catálogo EDT"},
		{"/admin/catalogs/deliverables", "Catálogo de Entregables"},
		{"/admin/catalogs/funding", "Catálogo de Entregables"},
		{"/admin/catalogs/activities", "Lista de Actividades"},
		{"/admin/ai", "Knowledge Base MGA"},
		{"/admin/tenants", "Gestión de Tenants"},
		{"/ADMIN/CATALOGS/ODS", "Catálogo de ODS"},
		{"/dashboard", "AuroraApp (/dashboard)"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.route, func(t *testing.T) {
			assert.Contains(t, describeRoute(tt.route), tt.want)
		})
	}
}

func TestBuildAuroraSystemPrompt(t *testing.T) {
	t.Run("sin contexto ni RAG", func(t *testing.T) {
		prompt := buildAuroraSystemPrompt("  ", "  ")
		assert.Contains(t, prompt, "Eres Aurora")
		assert.NotContains(t, prompt, "Contexto de navegación")
		assert.NotContains(t, prompt, "Conocimiento MGA indexado")
	})

	t.Run("con ambos contextos", func(t *testing.T) {
		prompt := buildAuroraSystemPrompt("/admin/catalogs/ods", "1) [cause] Causa: texto")
		assert.Contains(t, prompt, "Contexto de navegación")
		assert.Contains(t, prompt, "Conocimiento MGA indexado")
		assert.Contains(t, prompt, "Causa: texto")
	})

	t.Run("nunca menciona OpenAI como proveedor", func(t *testing.T) {
		prompt := buildAuroraSystemPrompt("", "")
		assert.Contains(t, prompt, "Solo Anthropic Claude")
	})
}

func TestParseAuroraResponse_TableDriven(t *testing.T) {
	tests := []struct {
		name        string
		raw         string
		wantCards   int
		wantReply   string
		replyPrefix string
	}{
		{
			name:      "texto plano sin tarjetas",
			raw:       "Debes definir el problema central primero.",
			wantCards: 0,
			wantReply: "Debes definir el problema central primero.",
		},
		{
			name:      "bloque aurora-actions",
			raw:       "Usa este ODS.\n\n```aurora-actions\n{\"action_cards\":[{\"catalog\":\"ods\",\"code\":\"1.1\",\"label\":\"Fin de la pobreza\"}]}\n```",
			wantCards: 1,
			wantReply: "Usa este ODS.",
		},
		{
			name:      "bloque aurora-actions con JSON inválido",
			raw:       "Texto.\n\n```aurora-actions\n{no-es-json}\n```",
			wantCards: 0,
		},
		{
			name:      "envelope JSON con reply",
			raw:       `{"reply":"Respuesta estructurada","action_cards":[{"catalog":"products","code":"P1","label":"Producto"}]}`,
			wantCards: 1,
			wantReply: "Respuesta estructurada",
		},
		{
			name:      "envelope JSON con reply vacío usa el raw",
			raw:       `{"reply":"","action_cards":[]}`,
			wantCards: 0,
		},
		{
			name:      "JSON malformado que empieza con llave",
			raw:       `{"reply": incompleto`,
			wantCards: 0,
		},
		{
			name:        "action_cards embebido en texto",
			raw:         `Aquí tienes: {"action_cards":[{"catalog":"edt","code":"E-1","label":"Indicador"}]}`,
			wantCards:   1,
			replyPrefix: "Aquí tienes:",
		},
		{
			name:      "action_cards con entradas inválidas se descartan",
			raw:       "Texto.\n\n```aurora-actions\n{\"action_cards\":[{\"catalog\":\"\",\"code\":\"X\"},{\"catalog\":\"ods\",\"code\":\"\"},{\"catalog\":\" ODS \",\"code\":\" 2.1 \",\"label\":\" Hambre \"}]}\n```",
			wantCards: 1,
		},
		{
			name:      "respuesta vacía",
			raw:       "   ",
			wantCards: 0,
			wantReply: "",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			reply, cards := parseAuroraResponse(tt.raw)
			assert.Len(t, cards, tt.wantCards)
			if tt.wantReply != "" {
				assert.Equal(t, tt.wantReply, reply)
			}
			if tt.replyPrefix != "" {
				assert.True(t, strings.HasPrefix(reply, tt.replyPrefix), "reply=%q", reply)
			}
		})
	}
}

func TestParseAuroraResponse_NormalizesCardFields(t *testing.T) {
	raw := "ok\n\n```aurora-actions\n{\"action_cards\":[{\"catalog\":\" ODS \",\"code\":\" 2.1 \",\"label\":\" Hambre cero \"}]}\n```"
	_, cards := parseAuroraResponse(raw)
	require.Len(t, cards, 1)
	assert.Equal(t, "ods", cards[0].Catalog)
	assert.Equal(t, "2.1", cards[0].Code)
	assert.Equal(t, "Hambre cero", cards[0].Label)
}

func TestExtractActionCards_InvalidJSONReturnsNil(t *testing.T) {
	assert.Nil(t, extractActionCards("{no json}"))
	assert.Empty(t, extractActionCards(`{"action_cards":[]}`))
}
