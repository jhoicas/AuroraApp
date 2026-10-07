package project

import (
	"fmt"
	"strings"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
)

// TechnicalDocumentValleService genera el Documento Técnico del Proyecto de Inversión
// requerido por el Artículo 13, literal e) del Decreto 1278 de 2023 del Valle del Cauca.
type TechnicalDocumentValleService struct{}

func NewTechnicalDocumentValleService() *TechnicalDocumentValleService {
	return &TechnicalDocumentValleService{}
}

// PlanDesarrolloPayload estructura los datos del plan de desarrollo en mga_formulation_data.
type PlanDesarrolloPayload struct {
	PndLinks []struct {
		ID         string `json:"id"`
		PndID      string `json:"pndId"`
		Nacional   string `json:"nacional"`
		Pilar      string `json:"pilar"`
		Estrategia string `json:"estrategia"`
		Programa   string `json:"programa"`
	} `json:"pndLinks"`
	Departamental *struct {
		Plan       string `json:"plan"`
		Estrategia string `json:"estrategia"`
		Programa   string `json:"programa"`
	} `json:"departamental"`
	Municipal *struct {
		Plan       string `json:"plan"`
		Estrategia string `json:"estrategia"`
		Programa   string `json:"programa"`
	} `json:"municipal"`
	Etnico *struct {
		TipoComunidad string `json:"tipoComunidad"`
		Instrumentos  string `json:"instrumentos"`
	} `json:"etnico"`
	Otros *struct {
		Plan       string `json:"plan"`
		Estrategia string `json:"estrategia"`
		Programa   string `json:"programa"`
	} `json:"otros"`
}

// LocalizacionPayload estructura la información de localización en mga_formulation_data.
type LocalizacionPayload struct {
	Items map[string]struct {
		Type     string `json:"type"`
		Specific string `json:"specific"`
	} `json:"items"`
}

// LocationSelectionPayload selección inicial de ubicaciones en el proyecto.
type LocationSelectionPayload struct {
	RegionID         *int   `json:"regionId"`
	RegionName       string `json:"regionName"`
	DepartamentoID   *int   `json:"departamentoId"`
	DepartamentoName string `json:"departamentoName"`
	MunicipioID      *int   `json:"municipioId"`
	MunicipioName    string `json:"municipioName"`
}

// FormulationDataWrapper mapea la columna JSONB mga_formulation_data.
type FormulationDataWrapper struct {
	PlanDesarrollo *PlanDesarrolloPayload     `json:"planDesarrollo"`
	Localizacion   *LocalizacionPayload       `json:"localizacion"`
	Localizaciones []LocationSelectionPayload `json:"localizaciones"`
	Objeto         string                     `json:"objeto"`
	Necesidades    *struct {
		BienesServicios string `json:"bienesServicios"`
		Analisis        string `json:"analisis"`
	} `json:"necesidades"`
}

func formatCurrency(val float64) string {
	// Formato $ 1.234.567,89
	isNeg := val < 0
	if isNeg {
		val = -val
	}
	intPart := int64(val)
	fracPart := int64((val - float64(intPart)) * 100)

	intStr := fmt.Sprintf("%d", intPart)
	var formattedInt strings.Builder
	l := len(intStr)
	for i, c := range intStr {
		if i > 0 && (l-i)%3 == 0 {
			formattedInt.WriteRune('.')
		}
		formattedInt.WriteRune(c)
	}

	res := fmt.Sprintf("$ %s,%02d", formattedInt.String(), fracPart)
	if isNeg {
		return "-" + res
	}
	return res
}

// GenerateValleDocumentPDF renderiza la plantilla oficial (Dec. 1278) con los datos del proyecto.
func (s *TechnicalDocumentValleService) GenerateValleDocumentPDF(
	project *models.Project,
	bundle *postgres.MgaFullFormulation,
	edtChain *postgres.ProjectEdtChain,
) ([]byte, error) {
	rendered, err := RenderTemplateHTML(postgres.OfficialTechnicalDocumentHTML(), BuildTemplateData(project, bundle, nil, edtChain))
	if err != nil {
		return nil, err
	}
	return HTMLToPDF(rendered)
}
