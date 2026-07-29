package services_test

import (
	"strings"
	"testing"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseMGA_CentralProblemVariants(t *testing.T) {
	t.Parallel()

	xml := `<?xml version="1.0"?>
<MGAProject>
  <ProjectName>Variantes</ProjectName>
  <CentralProblem>
    Texto directo del problema
    <Descripcion>Descripcion anidada</Descripcion>
    <Cause>Causa directa anidada</Cause>
    <Effect>Efecto directo anidado</Effect>
    <ExtraTag>Texto extra al default</ExtraTag>
  </CentralProblem>
  <ObjetivoGeneral>Objetivo general del proyecto</ObjetivoGeneral>
  <Description>Descripcion raiz ignorada como nodo</Description>
</MGAProject>`

	meta, graph, err := services.ParseMGAProjectXML(strings.NewReader(xml), "var.xml")
	require.NoError(t, err)
	assert.Equal(t, "Variantes", meta.ProjectName)

	var problem, cause, effect, objective int
	for _, n := range graph.Nodes {
		switch n.NodeType {
		case models.KnowledgeNodeCentralProblem:
			problem++
			assert.Contains(t, n.Content, "Descripcion anidada")
		case models.KnowledgeNodeCause:
			cause++
		case models.KnowledgeNodeEffect:
			effect++
		case models.KnowledgeNodeSpecificObjective:
			objective++
			assert.Contains(t, n.Label, "Objetivo general")
		}
	}
	assert.Equal(t, 1, problem)
	assert.Equal(t, 1, cause)
	assert.Equal(t, 1, effect)
	assert.Equal(t, 1, objective)
}

func TestParseMGA_NestedElementText(t *testing.T) {
	t.Parallel()
	xml := `<?xml version="1.0"?>
<MGAProject>
  <ProjectName>Anidado</ProjectName>
  <Cause><Inner>Parte A</Inner> Parte B</Cause>
  <CentralProblem>Problema base</CentralProblem>
</MGAProject>`
	_, graph, err := services.ParseMGAProjectXML(strings.NewReader(xml), "anid.xml")
	require.NoError(t, err)
	found := false
	for _, n := range graph.Nodes {
		if n.NodeType == models.KnowledgeNodeCause {
			found = true
			assert.Contains(t, n.Content, "Parte A")
			assert.Contains(t, n.Content, "Parte B")
		}
	}
	assert.True(t, found)
}

func TestParseMGA_OrphanAlternativesProducts(t *testing.T) {
	t.Parallel()
	xml := `<?xml version="1.0"?>
<MGAProject>
  <ProjectName>Huerfanos</ProjectName>
  <Alternative>Alt sin objetivo</Alternative>
  <Product>Prod sin alt</Product>
  <Activity>Act sin prod</Activity>
  <Cause>Causa suelta</Cause>
  <Effect>Efecto suelto</Effect>
  <SpecificObjective>Obj tardio</SpecificObjective>
</MGAProject>`
	_, graph, err := services.ParseMGAProjectXML(strings.NewReader(xml), "h.xml")
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(graph.Nodes), 6)
	assert.NotEmpty(t, graph.Links)
}

func TestParseMGA_NamespaceLocalNames(t *testing.T) {
	t.Parallel()
	xml := `<?xml version="1.0"?>
<mga:MGAProject xmlns:mga="http://example.com/mga">
  <mga:ProjectName>Con Namespace</mga:ProjectName>
  <mga:CentralProblem>Problema NS</mga:CentralProblem>
  <mga:Cause>Causa NS</mga:Cause>
</mga:MGAProject>`
	meta, graph, err := services.ParseMGAProjectXML(strings.NewReader(xml), "ns.xml")
	// Dependiendo del decoder, Name.Local puede o no incluir prefijo; no debe panic.
	assert.NotPanics(t, func() {
		_, _, _ = services.ParseMGAProjectXML(strings.NewReader(xml), "ns2.xml")
	})
	if err == nil {
		assert.NotEmpty(t, meta.ProjectName+meta.ProjectKey)
		assert.GreaterOrEqual(t, len(graph.Nodes), 1)
	}
}
