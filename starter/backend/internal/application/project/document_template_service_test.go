package project

import (
	"strings"
	"testing"

	"aurora-backend/internal/domain/models"

	"github.com/stretchr/testify/require"
)

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
	tpl := &models.DocumentTemplate{HTMLContent: `<h1 style="text-align:center">Título</h1><p>Texto <strong>fuerte</strong> áéí ñ</p>` +
		`<ul><li>uno</li><li>dos</li></ul><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>` +
		`<p><span class="mga-var" data-id="project.name">N</span></p>`}
	data := BuildTemplateData(&models.Project{Name: "Proyecto Ñandú"}, nil, nil)
	pdf, err := NewDocumentTemplateService().RenderPDF(tpl, data)
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(string(pdf), "%PDF-"))
}
