package services_test

import (
	"strings"
	"testing"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func TestParseMGAProjectXML_HappyPath(t *testing.T) {
	t.Parallel()
	meta, graph, err := services.ParseMGAProjectXML(strings.NewReader(sampleMGA), "acueducto.xml")
	require.NoError(t, err)
	assert.Equal(t, "Acueducto Rural Norte", meta.ProjectName)
	assert.Equal(t, "Agua Potable", meta.Sector)

	counts := map[string]int{}
	for _, n := range graph.Nodes {
		counts[n.NodeType]++
	}
	assert.Equal(t, 1, counts[models.KnowledgeNodeProject])
	assert.Equal(t, 1, counts[models.KnowledgeNodeCentralProblem])
	assert.Equal(t, 2, counts[models.KnowledgeNodeCause])
	assert.Equal(t, 1, counts[models.KnowledgeNodeEffect])
	assert.Equal(t, 2, counts[models.KnowledgeNodeAlternative])
	assert.Equal(t, 2, counts[models.KnowledgeNodeProduct])
	assert.Equal(t, 3, counts[models.KnowledgeNodeActivity])
	assert.NotEmpty(t, graph.Links)
}

func TestParseMGAProjectXML_TableDriven(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		xml         string
		filename    string
		wantErr     bool
		errContains string
		assertFn    func(t *testing.T, meta services.MGAProjectMeta, graph services.MGAProjectGraph)
	}{
		{
			name:        "XML vacío / sin nodos reconocibles",
			xml:         `<?xml version="1.0"?><Root></Root>`,
			filename:    "vacio.xml",
			wantErr:     true,
			errContains: "no se encontraron nodos",
		},
		{
			name:        "XML malformado no hace panic",
			xml:         `<MGAProject><ProjectName>X</ProjectName><Cause>sin cerrar`,
			filename:    "roto.xml",
			wantErr:     true,
			errContains: "parse xml",
		},
		{
			name: "solo nombre de proyecto → error sin nodos MGA",
			xml: `<?xml version="1.0"?>
<MGAProject><ProjectName>Solo Nombre</ProjectName></MGAProject>`,
			filename:    "solo-nombre.xml",
			wantErr:     true,
			errContains: "no se encontraron nodos",
		},
		{
			name: "etiquetas en español alternativas",
			xml: `<?xml version="1.0"?>
<Proyecto>
  <NombreProyecto>Planta Solar</NombreProyecto>
  <SectorName>Energía</SectorName>
  <ProblemaCentral>Déficit energético rural</ProblemaCentral>
  <Causa>Falta de infraestructura</Causa>
  <Efecto>Apagones frecuentes</Efecto>
  <ObjetivoEspecifico>Instalar 2 MW solares</ObjetivoEspecifico>
  <Alternativa>Paneles fotovoltaicos</Alternativa>
  <Producto>Parque solar 2MW</Producto>
  <Actividad>Montaje de estructuras</Actividad>
</Proyecto>`,
			filename: "solar.xml",
			assertFn: func(t *testing.T, meta services.MGAProjectMeta, graph services.MGAProjectGraph) {
				assert.Equal(t, "Planta Solar", meta.ProjectName)
				assert.Equal(t, "Energía", meta.Sector)
				require.GreaterOrEqual(t, len(graph.Nodes), 5)
			},
		},
		{
			name: "CentralProblem anidado con Causes/Effects",
			xml: `<?xml version="1.0"?>
<MGA>
  <ProjectName>Riego</ProjectName>
  <CentralProblem>
    <Description>Escasez de agua para riego</Description>
    <Causes>
      <Cause>Sequía prolongada</Cause>
    </Causes>
    <Effects>
      <Effect>Pérdida de cultivos</Effect>
    </Effects>
  </CentralProblem>
  <SpecificObjective>Ampliar distritos de riego</SpecificObjective>
</MGA>`,
			filename: "riego.xml",
			assertFn: func(t *testing.T, meta services.MGAProjectMeta, graph services.MGAProjectGraph) {
				assert.Equal(t, "Riego", meta.ProjectName)
				var causes, effects, problems int
				for _, n := range graph.Nodes {
					switch n.NodeType {
					case models.KnowledgeNodeCause:
						causes++
					case models.KnowledgeNodeEffect:
						effects++
					case models.KnowledgeNodeCentralProblem:
						problems++
						assert.Contains(t, n.Content, "Escasez")
					}
				}
				assert.Equal(t, 1, problems)
				assert.Equal(t, 1, causes)
				assert.Equal(t, 1, effects)
			},
		},
		{
			name: "nodos con texto vacío se ignoran sin panic",
			xml: `<?xml version="1.0"?>
<MGAProject>
  <ProjectName>Proyecto Hueco</ProjectName>
  <Cause></Cause>
  <Effect>   </Effect>
  <Alternative></Alternative>
  <CentralProblem>Problema real válido</CentralProblem>
  <Cause>Causa válida</Cause>
</MGAProject>`,
			filename: "huecos.xml",
			assertFn: func(t *testing.T, _ services.MGAProjectMeta, graph services.MGAProjectGraph) {
				var causes int
				for _, n := range graph.Nodes {
					if n.NodeType == models.KnowledgeNodeCause {
						causes++
						assert.NotEmpty(t, n.Content)
					}
				}
				assert.Equal(t, 1, causes)
			},
		},
		{
			name: "sin ProjectName usa filename",
			xml: `<?xml version="1.0"?>
<MGAProject>
  <CentralProblem>Falta de vías</CentralProblem>
  <Cause>Terreno difícil</Cause>
</MGAProject>`,
			filename: "mi-proyecto-vias.xml",
			assertFn: func(t *testing.T, meta services.MGAProjectMeta, graph services.MGAProjectGraph) {
				assert.Equal(t, "mi-proyecto-vias", meta.ProjectName)
				assert.NotEmpty(t, meta.ProjectKey)
				assert.GreaterOrEqual(t, len(graph.Nodes), 2)
			},
		},
		{
			name: "contenedores SpecificObjectives / Alternatives",
			xml: `<?xml version="1.0"?>
<MGAProject>
  <ProjectName>Educación Rural</ProjectName>
  <SpecificObjectives>
    <SpecificObjective>Mejorar cobertura primaria</SpecificObjective>
    <SpecificObjective>Reducir deserción</SpecificObjective>
  </SpecificObjectives>
  <Alternatives>
    <Alternative>Construcción de escuelas</Alternative>
  </Alternatives>
  <Products>
    <Product>Escuela construida</Product>
  </Products>
  <Activities>
    <Activity>Obra civil</Activity>
  </Activities>
</MGAProject>`,
			filename: "edu.xml",
			assertFn: func(t *testing.T, _ services.MGAProjectMeta, graph services.MGAProjectGraph) {
				counts := map[string]int{}
				for _, n := range graph.Nodes {
					counts[n.NodeType]++
				}
				assert.Equal(t, 2, counts[models.KnowledgeNodeSpecificObjective])
				assert.Equal(t, 1, counts[models.KnowledgeNodeAlternative])
				assert.Equal(t, 1, counts[models.KnowledgeNodeProduct])
				assert.Equal(t, 1, counts[models.KnowledgeNodeActivity])
			},
		},
		{
			name: "caracteres especiales y espacios",
			xml: `<?xml version="1.0"?>
<MGAProject>
  <ProjectName>  Proyecto   con   espacios  </ProjectName>
  <CentralProblem>  Texto
	con
saltos  </CentralProblem>
  <Cause>A &amp; B &lt; C</Cause>
</MGAProject>`,
			filename: "espacios.xml",
			assertFn: func(t *testing.T, meta services.MGAProjectMeta, graph services.MGAProjectGraph) {
				assert.Equal(t, "Proyecto con espacios", meta.ProjectName)
				for _, n := range graph.Nodes {
					if n.NodeType == models.KnowledgeNodeCentralProblem {
						assert.NotContains(t, n.Content, "\n")
						assert.NotContains(t, n.Content, "\t")
					}
				}
			},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.NotPanics(t, func() {
				meta, graph, err := services.ParseMGAProjectXML(strings.NewReader(tt.xml), tt.filename)
				if tt.wantErr {
					require.Error(t, err)
					if tt.errContains != "" {
						assert.Contains(t, err.Error(), tt.errContains)
					}
					return
				}
				require.NoError(t, err)
				if tt.assertFn != nil {
					tt.assertFn(t, meta, graph)
				}
			})
		})
	}
}

func TestParseMGAProjectXML_LinksAreSemantic(t *testing.T) {
	t.Parallel()
	_, graph, err := services.ParseMGAProjectXML(strings.NewReader(sampleMGA), "acueducto.xml")
	require.NoError(t, err)

	rels := map[string]int{}
	for _, l := range graph.Links {
		rels[l.Relationship]++
		assert.NotEmpty(t, l.SourceLocalID)
		assert.NotEmpty(t, l.TargetLocalID)
		assert.NotEqual(t, l.SourceLocalID, l.TargetLocalID)
	}
	assert.Greater(t, rels[models.RelHasProblem], 0)
	assert.Greater(t, rels[models.RelHasCause], 0)
}

func TestMockEmbeddingDimensions(t *testing.T) {
	t.Parallel()
	p := services.NewMockEmbeddingProvider()
	vec, err := p.Embed("texto de prueba")
	require.NoError(t, err)
	assert.Len(t, vec, services.DefaultEmbeddingDimensions)
}
