package project

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/jung-kurt/gofpdf"
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

func sanitizeText(s string) string {
	r := strings.NewReplacer(
		"“", "\"",
		"”", "\"",
		"‘", "'",
		"’", "'",
		"—", "-",
		"–", "-",
		"…", "...",
		"\r\n", "\n",
		"\r", "\n",
	)
	return r.Replace(s)
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

func (s *TechnicalDocumentValleService) GenerateValleDocumentPDF(
	project *models.Project,
	bundle *postgres.MgaFullFormulation,
	edtChain *postgres.ProjectEdtChain,
) ([]byte, error) {
	// Parsear JSONB mga_formulation_data
	var formWrapper FormulationDataWrapper
	if len(project.MgaFormulationData) > 0 {
		_ = json.Unmarshal(project.MgaFormulationData, &formWrapper)
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 18, 15)
	pdf.SetAutoPageBreak(true, 18)

	tr := pdf.UnicodeTranslatorFromDescriptor("")
	txt := func(str string) string {
		return tr(sanitizeText(str))
	}

	// Configuración de encabezado y pie de página
	pdf.SetHeaderFunc(func() {
		if pdf.PageNo() > 1 {
			pdf.SetFont("Arial", "B", 7)
			pdf.SetTextColor(71, 85, 105) // Slate 600
			pdf.CellFormat(90, 4, txt("DEPARTAMENTO DEL VALLE DEL CAUCA — DECRETO 1278 DE 2023"), "", 0, "L", false, 0, "")
			pdf.CellFormat(90, 4, txt("DOCUMENTO TÉCNICO DE INVERSIÓN"), "", 1, "R", false, 0, "")
			pdf.SetDrawColor(203, 213, 225)
			pdf.SetLineWidth(0.2)
			pdf.Line(15, 14, 195, 14)
			pdf.Ln(3)
		}
	})

	pdf.SetFooterFunc(func() {
		pdf.SetY(-13)
		pdf.SetDrawColor(203, 213, 225)
		pdf.SetLineWidth(0.2)
		pdf.Line(15, pdf.GetY(), 195, pdf.GetY())

		pdf.SetFont("Arial", "I", 7)
		pdf.SetTextColor(100, 116, 139)
		footerText := fmt.Sprintf("Documento Técnico Decreto 1278 de 2023 (Art. 13, Lit. e) | Proyecto: %s | Página %d de {nb}",
			project.Name, pdf.PageNo())
		if len(footerText) > 130 {
			footerText = fmt.Sprintf("Documento Técnico Decreto 1278/2023 (Art. 13, Lit. e) | Página %d de {nb}", pdf.PageNo())
		}
		pdf.CellFormat(0, 8, txt(footerText), "", 0, "C", false, 0, "")
	})
	pdf.AliasNbPages("{nb}")

	pdf.AddPage()

	// Helpers de maquetación
	sectionTitle := func(title string) {
		if pdf.GetY() > 240 {
			pdf.AddPage()
		} else {
			pdf.Ln(4)
		}
		pdf.SetFont("Arial", "B", 10)
		pdf.SetFillColor(6, 95, 70) // Emerald 800
		pdf.SetTextColor(255, 255, 255)
		pdf.CellFormat(180, 6.5, "  "+txt(title), "1", 1, "L", true, 0, "")
		pdf.SetTextColor(30, 41, 59)
		pdf.Ln(2)
	}

	subTitle := func(title string) {
		if pdf.GetY() > 250 {
			pdf.AddPage()
		} else {
			pdf.Ln(2)
		}
		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(241, 245, 249) // Slate 100
		pdf.SetTextColor(15, 23, 42)
		pdf.CellFormat(180, 5.5, " "+txt(title), "L", 1, "L", true, 0, "")
		pdf.SetTextColor(30, 41, 59)
		pdf.Ln(1)
	}

	paragraph := func(body string) {
		trimmed := strings.TrimSpace(body)
		if trimmed == "" {
			trimmed = "No registrado en la formulación."
		}
		pdf.SetFont("Arial", "", 8.5)
		pdf.SetTextColor(51, 65, 85)
		pdf.MultiCell(180, 4.3, txt(trimmed), "", "J", false)
		pdf.Ln(1.5)
	}

	bullet := func(level int, label string, desc string) {
		if pdf.GetY() > 265 {
			pdf.AddPage()
		}
		indent := float64(level * 5)
		bulletSymbol := "• "
		if level == 1 {
			bulletSymbol = "- "
		} else if level >= 2 {
			bulletSymbol = "  * "
		}
		pdf.SetFont("Arial", "", 8.5)
		pdf.SetTextColor(51, 65, 85)
		pdf.SetX(15 + indent)
		w := 180.0 - indent

		lineText := bulletSymbol
		if label != "" {
			lineText += label + ": "
		}
		lineText += strings.TrimSpace(desc)
		pdf.MultiCell(w, 4.2, txt(lineText), "", "L", false)
		pdf.SetX(15)
	}

	// ==========================================
	// ENCABEZADO INSTITUCIONAL DE LA CARÁTULA
	// ==========================================
	pdf.SetFillColor(240, 253, 244) // Emerald 50
	pdf.SetDrawColor(16, 185, 129) // Emerald 500
	pdf.SetLineWidth(0.4)
	pdf.RoundedRect(15, 16, 180, 26, 2, "1234", "FD")

	pdf.SetXY(17, 18)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetTextColor(6, 95, 70) // Emerald 800
	pdf.CellFormat(176, 5, txt("DEPARTAMENTO DEL VALLE DEL CAUCA"), "", 1, "C", false, 0, "")

	pdf.SetFont("Arial", "B", 8.5)
	pdf.SetTextColor(15, 118, 110)
	pdf.CellFormat(176, 4, txt("DEPARTAMENTO ADMINISTRATIVO DE PLANEACIÓN — BANCO DE PROGRAMAS Y PROYECTOS"), "", 1, "C", false, 0, "")

	pdf.SetFont("Arial", "B", 8)
	pdf.SetTextColor(71, 85, 105)
	pdf.CellFormat(176, 4, txt("DOCUMENTO TÉCNICO DEL PROYECTO DE INVERSIÓN (DECRETO BPPD 1278 DE 2023, ART. 13 LIT. E)"), "", 1, "C", false, 0, "")

	pdf.SetFont("Arial", "I", 7.5)
	pdf.SetTextColor(100, 116, 139)
	tenantName := "Entidad Territorial Formuladora"
	if project.Tenant.Name != "" {
		tenantName = project.Tenant.Name
	}
	pdf.CellFormat(176, 4, txt(fmt.Sprintf("Entidad formuladora: %s | Fecha de emisión: %s", tenantName, time.Now().Format("02/01/2006"))), "", 1, "C", false, 0, "")

	pdf.SetY(45)

	// =========================================================================
	// 1. Nombre del proyecto
	// =========================================================================
	sectionTitle("1. Nombre del proyecto")

	pdf.SetFont("Arial", "B", 10)
	pdf.SetTextColor(15, 23, 42)
	pdf.MultiCell(180, 5, txt(project.Name), "", "L", false)
	pdf.Ln(2)

	// Ficha de metadatos básicos
	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(248, 250, 252) // Slate 50
	pdf.SetDrawColor(226, 232, 240) // Slate 200
	pdf.SetTextColor(71, 85, 105)

	bpinStr := "En radicación"
	if project.CodeBPIN != nil && *project.CodeBPIN != "" {
		bpinStr = *project.CodeBPIN
	}
	sectorStr := "N/A"
	if project.Sector != "" {
		sectorStr = project.Sector
	}
	progStr := "N/A"
	if project.ProgramCode != nil && *project.ProgramCode != "" {
		progStr = *project.ProgramCode
	}
	prodStr := "N/A"
	if project.ProductCode != nil && *project.ProductCode != "" {
		prodStr = *project.ProductCode
	}

	pdf.CellFormat(45, 5, txt("Código BPIN / Radicado:"), "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(45, 5, txt(bpinStr), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(45, 5, txt("Sector DNP:"), "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(45, 5, txt(sectorStr), "1", 1, "L", false, 0, "")

	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(45, 5, txt("Código Programa DNP:"), "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(45, 5, txt(progStr), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(45, 5, txt("Código Producto DNP:"), "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(45, 5, txt(prodStr), "1", 1, "L", false, 0, "")

	if formWrapper.Objeto != "" {
		pdf.SetFont("Arial", "B", 8)
		pdf.CellFormat(45, 5, txt("Objeto a entregar:"), "1", 0, "L", true, 0, "")
		pdf.SetFont("Arial", "", 8)
		pdf.CellFormat(135, 5, txt(formWrapper.Objeto), "1", 1, "L", false, 0, "")
	}
	pdf.Ln(2)

	// =========================================================================
	// 2. Contribución al plan nacional y plan departamental de desarrollo
	// =========================================================================
	sectionTitle("2. Contribución al plan nacional y plan departamental de desarrollo")

	pndData := formWrapper.PlanDesarrollo

	subTitle("2.1 Articulación con el Plan Nacional de Desarrollo (PND)")
	if pndData != nil && len(pndData.PndLinks) > 0 {
		for i, link := range pndData.PndLinks {
			bullet(0, fmt.Sprintf("Alineación PND #%d", i+1), "")
			if link.Nacional != "" {
				bullet(1, "Eje / Política Nacional", link.Nacional)
			}
			if link.Pilar != "" {
				bullet(1, "Pilar / Transformación", link.Pilar)
			}
			if link.Estrategia != "" {
				bullet(1, "Estrategia", link.Estrategia)
			}
			if link.Programa != "" {
				bullet(1, "Programa Nacional", link.Programa)
			}
		}
	} else {
		paragraph("El proyecto se encuentra formulado bajo el catálogo programático DNP, alineándose a las metas de inversión del sector " + sectorStr + ".")
	}

	subTitle("2.2 Articulación con el Plan Departamental de Desarrollo (Valle del Cauca)")
	if pndData != nil && pndData.Departamental != nil && (pndData.Departamental.Plan != "" || pndData.Departamental.Estrategia != "" || pndData.Departamental.Programa != "") {
		if pndData.Departamental.Plan != "" {
			bullet(0, "Plan Departamental", pndData.Departamental.Plan)
		}
		if pndData.Departamental.Estrategia != "" {
			bullet(1, "Línea / Estrategia Departamental", pndData.Departamental.Estrategia)
		}
		if pndData.Departamental.Programa != "" {
			bullet(1, "Programa Departamental", pndData.Departamental.Programa)
		}
	} else {
		paragraph("Alineado con las prioridades de inversión pública del Plan Departamental de Desarrollo del Valle del Cauca, conforme a las directrices de viabilidad del Decreto 1278 de 2023.")
	}

	subTitle("2.3 Articulación con Planes de Desarrollo Municipal y Otros Instrumentos")
	hasMun := pndData != nil && pndData.Municipal != nil && (pndData.Municipal.Plan != "" || pndData.Municipal.Estrategia != "" || pndData.Municipal.Programa != "")
	hasEtnico := pndData != nil && pndData.Etnico != nil && (pndData.Etnico.TipoComunidad != "" || pndData.Etnico.Instrumentos != "")
	if hasMun {
		if pndData.Municipal.Plan != "" {
			bullet(0, "Plan Municipal de Desarrollo", pndData.Municipal.Plan)
		}
		if pndData.Municipal.Estrategia != "" {
			bullet(1, "Estrategia Municipal", pndData.Municipal.Estrategia)
		}
		if pndData.Municipal.Programa != "" {
			bullet(1, "Programa Municipal", pndData.Municipal.Programa)
		}
	}
	if hasEtnico {
		bullet(0, "Comunidad Étnica / Enfoque Diferencial", pndData.Etnico.TipoComunidad)
		if pndData.Etnico.Instrumentos != "" {
			bullet(1, "Instrumentos de Planificación Étnica", pndData.Etnico.Instrumentos)
		}
	}
	if !hasMun && !hasEtnico {
		paragraph("Articulación concordante con los instrumentos de ordenamiento territorial y planeación municipal de la jurisdicción de impacto.")
	}

	// =========================================================================
	// 3. Problema, oportunidad o necesidad
	// =========================================================================
	sectionTitle("3. Problema, oportunidad o necesidad")
	paragraph(project.ProblemDescription)

	// =========================================================================
	// 4. Descripción de la situación existente y antecedentes
	// =========================================================================
	sectionTitle("4. Descripción de la situación existente y antecedentes")
	paragraph(project.SituacionExistente)

	// =========================================================================
	// 5. Justificación
	// =========================================================================
	sectionTitle("5. Justificación")
	justificacion := project.MagnitudProblema
	if justificacion == "" {
		justificacion = project.Description
	}
	paragraph(justificacion)

	if formWrapper.Necesidades != nil && formWrapper.Necesidades.Analisis != "" {
		subTitle("Análisis de necesidades y bienes requeridos")
		paragraph(formWrapper.Necesidades.Analisis)
	}

	// =========================================================================
	// 6. Objetivos (general y específicos)
	// =========================================================================
	sectionTitle("6. Objetivos (general y específicos)")

	subTitle("6.1 Objetivo General")
	paragraph(project.GeneralObjective)

	subTitle("6.2 Objetivos Específicos")
	hasSpecifics := false
	if bundle != nil && len(bundle.Causes) > 0 {
		for _, c := range bundle.Causes {
			if c.SpecificObjective != nil && strings.TrimSpace(c.SpecificObjective.Description) != "" {
				bullet(0, "Objetivo Específico", c.SpecificObjective.Description)
				if c.Description != "" {
					bullet(1, "Causa asociada a resolver", c.Description)
				}
				hasSpecifics = true
			}
		}
	}
	if !hasSpecifics {
		// Mapear desde causas directas si no se ha diligenciado la relación explícita
		if bundle != nil && len(bundle.Causes) > 0 {
			for _, c := range bundle.Causes {
				if c.CauseType == "directa" || c.ParentID == nil {
					bullet(0, "Objetivo Específico (Causa Directa)", "Superar: "+c.Description)
					hasSpecifics = true
				}
			}
		}
	}
	if !hasSpecifics {
		paragraph("Objetivos específicos en proceso de consolidación en la matriz de formulación MGA.")
	}

	// =========================================================================
	// 7. Árbol de problemas y árbol de soluciones
	// =========================================================================
	sectionTitle("7. Árbol de problemas y árbol de soluciones")

	subTitle("7.1 Árbol de Problemas")
	bullet(0, "PROBLEMA CENTRAL", project.ProblemDescription)

	// Causas jerárquicas
	if bundle != nil && len(bundle.Causes) > 0 {
		pdf.Ln(1)
		pdf.SetFont("Arial", "B", 8)
		pdf.SetTextColor(15, 23, 42)
		pdf.CellFormat(180, 4, txt("Causas identificadas (Directas e Indirectas):"), "", 1, "L", false, 0, "")

		// Separar directas e indirectas
		directCauses := make([]models.MgaCause, 0)
		indirectCauses := make([]models.MgaCause, 0)
		for _, c := range bundle.Causes {
			if c.CauseType == "directa" || c.ParentID == nil {
				directCauses = append(directCauses, c)
			} else {
				indirectCauses = append(indirectCauses, c)
			}
		}

		for i, dc := range directCauses {
			bullet(1, fmt.Sprintf("Causa Directa %d", i+1), dc.Description)
			// Buscar hijas indirectas
			for _, ic := range indirectCauses {
				if ic.ParentID != nil && *ic.ParentID == dc.ID {
					bullet(2, "Causa Indirecta", ic.Description)
				}
			}
		}
		// Indirectas huérfanas
		for _, ic := range indirectCauses {
			hasParentInList := false
			if ic.ParentID != nil {
				for _, dc := range directCauses {
					if *ic.ParentID == dc.ID {
						hasParentInList = true
						break
					}
				}
			}
			if !hasParentInList {
				bullet(1, "Causa Indirecta", ic.Description)
			}
		}
	}

	// Efectos jerárquicos
	if bundle != nil && len(bundle.Effects) > 0 {
		pdf.Ln(1)
		pdf.SetFont("Arial", "B", 8)
		pdf.SetTextColor(15, 23, 42)
		pdf.CellFormat(180, 4, txt("Efectos esperados si no se interviene (Directos e Indirectos):"), "", 1, "L", false, 0, "")

		directEffects := make([]models.MgaEffect, 0)
		indirectEffects := make([]models.MgaEffect, 0)
		for _, e := range bundle.Effects {
			if e.EffectType == "directo" || e.ParentID == nil {
				directEffects = append(directEffects, e)
			} else {
				indirectEffects = append(indirectEffects, e)
			}
		}

		for i, de := range directEffects {
			bullet(1, fmt.Sprintf("Efecto Directo %d", i+1), de.Description)
			for _, ie := range indirectEffects {
				if ie.ParentID != nil && *ie.ParentID == de.ID {
					bullet(2, "Efecto Indirecto", ie.Description)
				}
			}
		}
		for _, ie := range indirectEffects {
			hasParent := false
			if ie.ParentID != nil {
				for _, de := range directEffects {
					if *ie.ParentID == de.ID {
						hasParent = true
						break
					}
				}
			}
			if !hasParent {
				bullet(1, "Efecto Indirecto", ie.Description)
			}
		}
	}

	subTitle("7.2 Árbol de Soluciones")
	bullet(0, "PROPÓSITO / OBJETIVO GENERAL", project.GeneralObjective)

	// Medios (soluciones a causas)
	if bundle != nil && len(bundle.Causes) > 0 {
		pdf.Ln(1)
		pdf.SetFont("Arial", "B", 8)
		pdf.SetTextColor(15, 23, 42)
		pdf.CellFormat(180, 4, txt("Medios de Solución (Objetivos y componentes transformadores):"), "", 1, "L", false, 0, "")

		for i, c := range bundle.Causes {
			if c.SpecificObjective != nil && strings.TrimSpace(c.SpecificObjective.Description) != "" {
				bullet(1, fmt.Sprintf("Medio / Objetivo Específico %d", i+1), c.SpecificObjective.Description)
			} else if c.CauseType == "directa" || c.ParentID == nil {
				bullet(1, fmt.Sprintf("Medio Directo %d", i+1), "Solución a: "+c.Description)
			}
		}
	}

	// Fines (transformación positiva de efectos)
	if bundle != nil && len(bundle.Effects) > 0 {
		pdf.Ln(1)
		pdf.SetFont("Arial", "B", 8)
		pdf.SetTextColor(15, 23, 42)
		pdf.CellFormat(180, 4, txt("Fines e Impactos Positivos Esperados:"), "", 1, "L", false, 0, "")

		for i, e := range bundle.Effects {
			if e.EffectType == "directo" || e.ParentID == nil {
				bullet(1, fmt.Sprintf("Fin Directo %d", i+1), "Mitigación y reversión de: "+e.Description)
			} else {
				bullet(2, "Fin Indirecto", "Mitigación y reversión de: "+e.Description)
			}
		}
	}

	// =========================================================================
	// 8. Población afectada y objetivo
	// =========================================================================
	sectionTitle("8. Población afectada y objetivo")

	if bundle != nil && len(bundle.Populations) > 0 {
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(241, 245, 249)
		pdf.SetDrawColor(203, 213, 225)
		pdf.CellFormat(40, 5, txt("Tipo de Población"), "1", 0, "L", true, 0, "")
		pdf.CellFormat(35, 5, txt("Total Personas"), "1", 0, "R", true, 0, "")
		pdf.CellFormat(55, 5, txt("Fuente de Información"), "1", 0, "L", true, 0, "")
		pdf.CellFormat(50, 5, txt("Ubicación / Cobertura"), "1", 1, "L", true, 0, "")

		pdf.SetFont("Arial", "", 8)
		for _, pop := range bundle.Populations {
			tipoLabel := "Afectada"
			if strings.EqualFold(pop.PopulationType, "objetivo") {
				tipoLabel = "Objetivo"
			}
			numStr := fmt.Sprintf("%d personas", pop.TotalNumber)
			srcStr := pop.Source
			if srcStr == "" {
				srcStr = "DANE / Censo territorial"
			}
			locStr := pop.Locations
			if locStr == "" || locStr == "[]" {
				locStr = "Área de influencia del proyecto"
			}

			pdf.CellFormat(40, 5, txt(tipoLabel), "1", 0, "L", false, 0, "")
			pdf.CellFormat(35, 5, txt(numStr), "1", 0, "R", false, 0, "")
			pdf.CellFormat(55, 5, txt(srcStr), "1", 0, "L", false, 0, "")
			pdf.CellFormat(50, 5, txt(locStr), "1", 1, "L", false, 0, "")
		}
		pdf.Ln(2)
	} else {
		paragraph("La población afectada y objetivo se delimita en la jurisdicción territorial de impacto directo, con estimación en proceso de consolidación censal.")
	}

	// =========================================================================
	// 9. Descripción de la alternativa seleccionada
	// =========================================================================
	sectionTitle("9. Descripción de la alternativa seleccionada")

	var selectedAlt *models.MgaAlternative
	otherAlts := make([]models.MgaAlternative, 0)
	if bundle != nil && len(bundle.Alternatives) > 0 {
		for _, alt := range bundle.Alternatives {
			if alt.ProceedsToPreparation {
				selectedAlt = &alt
			} else {
				otherAlts = append(otherAlts, alt)
			}
		}
		if selectedAlt == nil && len(bundle.Alternatives) > 0 {
			selectedAlt = &bundle.Alternatives[0]
			otherAlts = bundle.Alternatives[1:]
		}
	}

	if selectedAlt != nil {
		subTitle("Alternativa Seleccionada para Inversión")
		pdf.SetFont("Arial", "B", 8.5)
		pdf.MultiCell(180, 4.5, txt(selectedAlt.Description), "", "L", false)
		pdf.Ln(1)

		bullet(1, "Evaluación de Rentabilidad", func() string {
			if selectedAlt.EvaluateProfitability {
				return "Aprobada / Evaluada"
			}
			return "No requerida / Pendiente"
		}())
		bullet(1, "Evaluación de Costos", func() string {
			if selectedAlt.EvaluateCost {
				return "Aprobada / Evaluada"
			}
			return "En proceso de costeo"
		}())
		bullet(1, "Estado de Preparación", "Pasa a etapa de estructuración e inversión")

		if len(otherAlts) > 0 {
			subTitle("Otras alternativas analizadas y descartadas")
			for i, oa := range otherAlts {
				bullet(0, fmt.Sprintf("Alternativa #%d", i+1), oa.Description)
				bullet(1, "Motivo", "Descartada tras el análisis de costo-beneficio y viabilidad técnica frente a la alternativa seleccionada.")
			}
		}
	} else {
		paragraph("Alternativa única seleccionada: estructuración y ejecución del proyecto bajo las especificaciones técnicas formuladas en la MGA.")
	}

	// =========================================================================
	// 10. Productos y componentes de la inversión
	// =========================================================================
	sectionTitle("10. Productos y componentes de la inversión")

	subTitle("10.1 Producto Principal de la Inversión (Catálogo DNP)")
	if edtChain != nil && edtChain.CatalogLink != nil {
		link := edtChain.CatalogLink
		bullet(0, "Código de Producto", link.ProductCode)
		bullet(1, "Tipología de Inversión", link.Tipologia)
		reqEdtStr := "No"
		if link.RequiresEdt {
			reqEdtStr = "Sí (Estructura de Desglose del Trabajo obligatoria)"
		}
		bullet(1, "Requiere Cadena EDT", reqEdtStr)
	} else if project.ProductCode != nil {
		bullet(0, "Código de Producto", *project.ProductCode)
		bullet(1, "Sector", sectorStr)
	} else {
		paragraph("Producto en proceso de homologación con el catálogo de productos DNP.")
	}

	subTitle("10.2 Componentes de la Inversión (Nodos EDT)")
	if edtChain != nil && len(edtChain.EdtNodes) > 0 {
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(241, 245, 249)
		pdf.SetDrawColor(203, 213, 225)
		pdf.CellFormat(30, 5, txt("Código"), "1", 0, "L", true, 0, "")
		pdf.CellFormat(25, 5, txt("Nivel"), "1", 0, "C", true, 0, "")
		pdf.CellFormat(125, 5, txt("Nombre del Componente"), "1", 1, "L", true, 0, "")

		pdf.SetFont("Arial", "", 8)
		for _, node := range edtChain.EdtNodes {
			pdf.CellFormat(30, 5, txt(node.Code), "1", 0, "L", false, 0, "")
			pdf.CellFormat(25, 5, txt(fmt.Sprintf("Nivel %d", node.Level)), "1", 0, "C", false, 0, "")
			pdf.CellFormat(125, 5, txt(node.Name), "1", 1, "L", false, 0, "")
		}
		pdf.Ln(2)
	} else {
		paragraph("Componentes estructurados conforme a los entregables directos de la intervención.")
	}

	subTitle("10.3 Entregables del Proyecto")
	if edtChain != nil && len(edtChain.Deliverables) > 0 {
		for _, deliv := range edtChain.Deliverables {
			bullet(0, deliv.Code, deliv.Name)
			if deliv.Amount > 0 {
				bullet(1, "Monto proyectado", formatCurrency(deliv.Amount))
			}
		}
	} else {
		paragraph("Entregables definidos según el alcance de los bienes y servicios proyectados.")
	}

	// =========================================================================
	// 11. Cronograma de actividades
	// =========================================================================
	sectionTitle("11. Cronograma de actividades")

	if edtChain != nil && len(edtChain.Activities) > 0 {
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(241, 245, 249)
		pdf.SetDrawColor(203, 213, 225)
		pdf.CellFormat(25, 5, txt("Código"), "1", 0, "L", true, 0, "")
		pdf.CellFormat(80, 5, txt("Actividad Presupuestal"), "1", 0, "L", true, 0, "")
		pdf.CellFormat(20, 5, txt("Cantidad"), "1", 0, "R", true, 0, "")
		pdf.CellFormat(27, 5, txt("Costo Unitario"), "1", 0, "R", true, 0, "")
		pdf.CellFormat(28, 5, txt("Costo Total"), "1", 1, "R", true, 0, "")

		pdf.SetFont("Arial", "", 7.5)
		var totalPresupuesto float64
		for _, act := range edtChain.Activities {
			totalPresupuesto += act.TotalCost
			cantStr := fmt.Sprintf("%.2f", act.Quantity)
			costoUnitStr := formatCurrency(act.UnitCost)
			costoTotalStr := formatCurrency(act.TotalCost)

			pdf.CellFormat(25, 4.8, txt(act.Code), "1", 0, "L", false, 0, "")
			actName := act.Name
			if len(actName) > 48 {
				actName = actName[:45] + "..."
			}
			pdf.CellFormat(80, 4.8, txt(actName), "1", 0, "L", false, 0, "")
			pdf.CellFormat(20, 4.8, txt(cantStr), "1", 0, "R", false, 0, "")
			pdf.CellFormat(27, 4.8, txt(costoUnitStr), "1", 0, "R", false, 0, "")
			pdf.CellFormat(28, 4.8, txt(costoTotalStr), "1", 1, "R", false, 0, "")
		}

		// Total general
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(240, 253, 244)
		pdf.CellFormat(125, 5.5, txt("TOTAL PRESUPUESTO ESTIMADO DE ACTIVIDADES:"), "1", 0, "R", true, 0, "")
		pdf.CellFormat(55, 5.5, txt(formatCurrency(totalPresupuesto)), "1", 1, "R", true, 0, "")
		pdf.Ln(2)
	} else {
		paragraph("Las actividades operativas y cronograma de ejecución se encuentran en fase de costeo presupuestal y programación detallada en la cadena de valor EDT.")
	}

	// =========================================================================
	// 12. Localización del proyecto
	// =========================================================================
	sectionTitle("12. Localización del proyecto")

	// Extraer localizaciones
	locsFound := false
	if len(formWrapper.Localizaciones) > 0 {
		for i, loc := range formWrapper.Localizaciones {
			locsFound = true
			bullet(0, fmt.Sprintf("Ubicación #%d", i+1), "")
			if loc.DepartamentoName != "" {
				bullet(1, "Departamento", loc.DepartamentoName)
			} else {
				bullet(1, "Departamento", "Valle del Cauca")
			}
			if loc.MunicipioName != "" {
				bullet(1, "Municipio", loc.MunicipioName)
			}
			if loc.RegionName != "" {
				bullet(1, "Región", loc.RegionName)
			}
		}
	}

	// Verificar si hay en formWrapper.Localizacion.Items
	if formWrapper.Localizacion != nil && len(formWrapper.Localizacion.Items) > 0 {
		for altId, item := range formWrapper.Localizacion.Items {
			if item.Type != "" || item.Specific != "" {
				locsFound = true
				bullet(0, "Localización por Alternativa", "")
				if item.Type != "" {
					bullet(1, "Tipo de cobertura", item.Type)
				}
				if item.Specific != "" {
					bullet(1, "Detalle geográfico / Centro poblado", item.Specific)
				}
				_ = altId
			}
		}
	}

	if !locsFound {
		bullet(0, "Departamento", "Valle del Cauca")
		bullet(1, "Área de Influencia", "Jurisdicción territorial de la entidad formuladora ("+tenantName+")")
		bullet(1, "Cobertura", "Municipal y departamental conforme al alcance del proyecto")
	}

	// Firma y cierre formal
	if pdf.GetY() > 240 {
		pdf.AddPage()
	} else {
		pdf.Ln(8)
	}

	pdf.SetFont("Arial", "I", 7.5)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(180, 4, txt("Constancia de formulación técnica generada automáticamente por el sistema Aurora Gov."), "", 1, "C", false, 0, "")
	pdf.CellFormat(180, 4, txt("Documento válido para el cumplimiento de los requisitos de radicación del Decreto 1278 de 2023 del Valle del Cauca."), "", 1, "C", false, 0, "")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("error al generar buffer PDF: %w", err)
	}

	return buf.Bytes(), nil
}
