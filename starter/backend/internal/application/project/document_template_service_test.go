package project

import (
	"os"
	"os/exec"
	"strings"
	"testing"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func skipWithoutChrome(t *testing.T) {
	t.Helper()
	if os.Getenv("CHROME_BIN") != "" {
		return
	}
	for _, b := range []string{"chromium", "chromium-browser", "google-chrome", "chrome"} {
		if _, err := exec.LookPath(b); err == nil {
			return
		}
	}
	t.Skip("chromium no disponible")
}

func TestRenderTemplateHTML_InjectsAndEscapes(t *testing.T) {
	tpl := `<p>Hola <span class="mga-var" data-id="project.name">Nombre</span> {{ .Secret }}</p>`
	out, err := RenderTemplateHTML(tpl, map[string]any{"project.name": `<script>x</script>`})
	require.NoError(t, err)
	require.Contains(t, out, "&lt;script&gt;x&lt;/script&gt;")
	require.NotContains(t, out, "<script>")
	require.Contains(t, out, "{{ .Secret }}", "acciones del usuario no se ejecutan")
	require.NotContains(t, out, "mga-var")
}

func TestRenderTemplateHTML_UnknownVarIsEmpty(t *testing.T) {
	out, err := RenderTemplateHTML(`<p><span data-id="no.existe" class="mga-var">x</span></p>`, nil)
	require.NoError(t, err)
	require.Equal(t, "<p></p>", out)
}

func TestRenderPDF_ProducesPDF(t *testing.T) {
	skipWithoutChrome(t)
	tpl := &models.DocumentTemplate{HTMLContent: `<h1 style="text-align:center">Título</h1><p>Texto <strong>fuerte</strong> áéí ñ</p>` +
		`<ul><li>uno</li><li>dos</li></ul><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>` +
		`<p><span class="mga-var" data-id="project.name">N</span></p>`}
	data := BuildTemplateData(&models.Project{Name: "Proyecto Ñandú"}, nil, nil, nil)
	pdf, err := NewDocumentTemplateService().RenderPDF(tpl, data)
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(string(pdf), "%PDF-"))
}

func TestSeedTemplate_RendersOfficialDocument(t *testing.T) {
	code := "2024760010123"
	pid := uuid.New()
	bundle := &postgres.MgaFullFormulation{
		Causes: []models.MgaCause{
			{ID: pid, CauseType: "directa", Description: "Falta de mantenimiento"},
			{ID: uuid.New(), ParentID: &pid, CauseType: "indirecta", Description: "Presupuesto <insuficiente>"},
		},
		Effects: []models.MgaEffect{{ID: uuid.New(), EffectType: "directo", Description: "Mayores costos"}},
	}
	data := BuildTemplateData(&models.Project{Name: "Vía", CodeBPIN: &code, Sector: "Transporte"}, bundle, nil, nil)
	html, err := RenderTemplateHTML(postgres.OfficialTechnicalDocumentHTML(), data)
	require.NoError(t, err)
	require.NotContains(t, html, "mga-var")
	require.Contains(t, html, "2024760010123")
	require.Contains(t, html, "<li>Falta de mantenimiento<ul><li>Presupuesto &lt;insuficiente&gt;</li></ul></li>")
	require.Contains(t, html, "Superar: Falta de mantenimiento")

	skipWithoutChrome(t)
	pdf, err := HTMLToPDF(html)
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(string(pdf), "%PDF-"))
}
