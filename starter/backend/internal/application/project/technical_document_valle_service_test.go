package project_test

import (
	"bytes"
	"testing"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

func TestTechnicalDocumentValleService_GenerateValleDocumentPDF(t *testing.T) {
	svc := appproject.NewTechnicalDocumentValleService()

	projectID := uuid.New()
	tenantID := uuid.New()
	bpin := "2026760010045"
	prog := "4001"
	prod := "4001001"

	formulationDataJSON := []byte(`{
		"objeto": "Construir 5km de placa huella en el municipio de Palmira",
		"planDesarrollo": {
			"pndLinks": [
				{
					"nacional": "Paz Total y Justicia Social",
					"pilar": "Ordenamiento del territorio",
					"estrategia": "Vías terciarias para la vida",
					"programa": "Infraestructura vial y transporte"
				}
			],
			"departamental": {
				"plan": "Valle del Cauca Tierra de Oportunidades",
				"estrategia": "Competitividad e infraestructura rural",
				"programa": "Conectividad productiva"
			},
			"municipal": {
				"plan": "Palmira Ejemplar",
				"estrategia": "Desarrollo rural sostenible",
				"programa": "Vías comunitarias"
			}
		},
		"localizaciones": [
			{
				"departamentoName": "Valle del Cauca",
				"municipioName": "Palmira",
				"regionName": "Pacífico"
			}
		]
	}`)

	proj := &models.Project{
		ID:                 projectID,
		TenantID:           tenantID,
		Name:               "Mejoramiento de vías terciarias en corredores productivos del Valle del Cauca",
		CodeBPIN:           &bpin,
		Sector:             "Transporte",
		ProgramCode:        &prog,
		ProductCode:        &prod,
		ProblemDescription: "Dificultad de movilidad y altos costos de transporte para los campesinos de la zona rural.",
		GeneralObjective:   "Garantizar la conectividad y transitabilidad segura en los corredores productivos.",
		SituacionExistente: "Las vías se encuentran en afirmado deteriorado con pérdida de banca en época de lluvias.",
		MagnitudProblema:   "Afecta directamente a más de 2.500 familias productoras agrícolas y pecuarias.",
		MgaFormulationData: datatypes.JSON(formulationDataJSON),
		Tenant: models.Tenant{
			Name: "Alcaldía Municipal de Palmira",
		},
	}

	causeID := uuid.New()
	mgaBundle := &postgres.MgaFullFormulation{
		Causes: []models.MgaCause{
			{
				ID:          causeID,
				CauseType:   "directa",
				Description: "Falta de obras de drenaje y placa huella en puntos críticos.",
				SpecificObjective: &models.MgaSpecificObjective{
					Description: "Construir obras de arte y pavimento en placa huella.",
				},
			},
			{
				ID:          uuid.New(),
				ParentID:    &causeID,
				CauseType:   "indirecta",
				Description: "Escasez de recursos municipales para mantenimiento vial rutinario.",
			},
		},
		Effects: []models.MgaEffect{
			{
				ID:          uuid.New(),
				EffectType:  "directo",
				Description: "Aumento de pérdidas postcosecha y tiempos de desplazamiento.",
			},
		},
		Populations: []models.MgaPopulation{
			{
				PopulationType: "afectada",
				TotalNumber:    5000,
				Source:         "Censo agropecuario municipal",
				Locations:      "Veredas La Quisquina y Toche",
			},
			{
				PopulationType: "objetivo",
				TotalNumber:    2500,
				Source:         "Familias asociadas a cooperativas agrícolas",
				Locations:      "Corredor Palmira - Toche",
			},
		},
		Alternatives: []models.MgaAlternative{
			{
				ID:                    uuid.New(),
				Description:           "Pavimentación en placa huella con cunetas reforzadas",
				ProceedsToPreparation: true,
				EvaluateProfitability: true,
				EvaluateCost:          true,
			},
		},
	}

	edtChain := &postgres.ProjectEdtChain{
		CatalogLink: &models.ProjectCatalogLink{
			ProductCode: "4001001",
			Tipologia:   "Tipología A",
			RequiresEdt: true,
		},
		EdtNodes: []models.ProjectEdtNode{
			{
				Code:  "EDT.01",
				Level: 1,
				Name:  "Obras preliminares y localización",
			},
			{
				Code:  "EDT.02",
				Level: 1,
				Name:  "Estructura de pavimento en placa huella",
			},
		},
		Deliverables: []models.ProjectDeliverable{
			{
				Code:   "ENT.01",
				Name:   "Subrasante mejorada y filtros",
				Amount: 250000000,
			},
		},
		Activities: []models.ProjectActivity{
			{
				Code:      "ACT.01.01",
				Name:      "Excavación y conformación de la subrasante",
				Quantity:  5000,
				UnitCost:  35000,
				TotalCost: 175000000,
			},
			{
				Code:      "ACT.02.01",
				Name:      "Fundida de concreto clase D para placa huella",
				Quantity:  1200,
				UnitCost:  650000,
				TotalCost: 780000000,
			},
		},
	}

	pdfBytes, err := svc.GenerateValleDocumentPDF(proj, mgaBundle, edtChain)
	if err != nil {
		t.Fatalf("expected no error generating PDF, got: %v", err)
	}

	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF bytes")
	}

	// Verify standard PDF header magic bytes %PDF-
	if !bytes.HasPrefix(pdfBytes, []byte("%PDF-")) {
		t.Fatalf("expected PDF magic header %%PDF-, got: %s", string(pdfBytes[:min(len(pdfBytes), 10)]))
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
