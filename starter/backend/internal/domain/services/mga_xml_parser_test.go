package services_test

import (
	"strings"
	"testing"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"
)

const sampleMGA = `<?xml version="1.0" encoding="UTF-8"?>
<MGAProject>
  <ProjectName>Acueducto Rural Norte</ProjectName>
  <Sector>Agua Potable</Sector>
  <CentralProblem>Falta de cobertura de agua potable en veredas rurales.</CentralProblem>
  <Causes>
    <Cause>Infraestructura obsoleta.</Cause>
    <Cause>Baja inversión histórica.</Cause>
  </Causes>
  <Effects>
    <Effect>Enfermedades hídricas.</Effect>
  </Effects>
  <GeneralObjective>Mejorar el acceso al servicio de acueducto en 12 veredas.</GeneralObjective>
  <Alternatives>
    <Alternative>Construcción de red de distribución por gravedad.</Alternative>
    <Alternative>Ampliación de planta de tratamiento existente.</Alternative>
  </Alternatives>
  <Products>
    <Product>Red de acueducto operativa en 12 veredas.</Product>
    <Product>Planta de tratamiento ampliada.</Product>
  </Products>
  <Activities>
    <Activity>Diseño técnico de la red.</Activity>
    <Activity>Construcción de tanques de almacenamiento.</Activity>
    <Activity>Capacitación a Juntas de Agua.</Activity>
  </Activities>
</MGAProject>`

func TestParseMGAProjectXML(t *testing.T) {
	meta, graph, err := services.ParseMGAProjectXML(strings.NewReader(sampleMGA), "acueducto.xml")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if meta.ProjectName != "Acueducto Rural Norte" {
		t.Fatalf("project name: got %q", meta.ProjectName)
	}

	counts := map[string]int{}
	for _, n := range graph.Nodes {
		counts[n.NodeType]++
	}

	if counts[models.KnowledgeNodeProject] != 1 {
		t.Fatalf("expected 1 project, got %d", counts[models.KnowledgeNodeProject])
	}
	if counts[models.KnowledgeNodeCentralProblem] != 1 {
		t.Fatalf("expected 1 central problem, got %d", counts[models.KnowledgeNodeCentralProblem])
	}
	if counts[models.KnowledgeNodeCause] != 2 {
		t.Fatalf("expected 2 causes, got %d", counts[models.KnowledgeNodeCause])
	}
	if counts[models.KnowledgeNodeEffect] != 1 {
		t.Fatalf("expected 1 effect, got %d", counts[models.KnowledgeNodeEffect])
	}
	if counts[models.KnowledgeNodeAlternative] != 2 {
		t.Fatalf("expected 2 alternatives, got %d", counts[models.KnowledgeNodeAlternative])
	}
	if len(graph.Links) == 0 {
		t.Fatal("expected semantic links")
	}
}

func TestMockEmbeddingDimensions(t *testing.T) {
	p := services.NewMockEmbeddingProvider()
	vec, err := p.Embed("texto de prueba")
	if err != nil {
		t.Fatal(err)
	}
	if len(vec) != services.DefaultEmbeddingDimensions {
		t.Fatalf("expected %d dims, got %d", services.DefaultEmbeddingDimensions, len(vec))
	}
}
