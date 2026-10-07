package postgres

import (
	"errors"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

func mv(id, label string) string {
	return `<span class="mga-var" data-id="` + id + `">` + label + `</span>`
}

// OfficialTechnicalDocumentHTML replica el Documento Técnico del Proyecto de Inversión
// (Decreto 1278 de 2023, Art. 13 lit. e). Solo usa etiquetas soportadas por HTMLToPDF (gofpdf);
// las listas (causas, efectos, objetivos, entregables) llegan ya como <ul> desde BuildTemplateData.
func OfficialTechnicalDocumentHTML() string {
	h2 := func(t string) string { return `<h2>` + t + `</h2>` }
	h3 := func(t string) string { return `<h3>` + t + `</h3>` }
	p := func(t string) string { return `<p>` + t + `</p>` }
	kv := func(label, id, ph string) string {
		return `<p><strong>` + label + `:</strong> ` + mv(id, ph) + `</p>`
	}
	return `<h2 style="text-align: center">DEPARTAMENTO ADMINISTRATIVO DE PLANEACIÓN - BANCO DE PROGRAMAS Y PROYECTOS</h2>` +
		`<h1 style="text-align: center">DOCUMENTO TÉCNICO DEL PROYECTO DE INVERSIÓN (DECRETO BPPD 1278 DE 2023, ART. 13 LIT. E)</h1>` +
		kv("Entidad formuladora", "tenant.name", "Entidad") +
		kv("Fecha de emisión", "system.date", "Fecha") +
		h2("1. Nombre del proyecto") +
		p(mv("project.name", "Nombre del Proyecto")) +
		kv("Código BPIN", "project.bpin", "Código BPIN") +
		kv("Sector DNP", "project.sector", "Sector") +
		h2("2. Contribución al plan nacional y departamental de desarrollo") +
		h3("2.1 Plan Nacional de Desarrollo (PND)") +
		p(mv("plan-desarrollo.nacional", "Articulación PND")) +
		h3("2.2 Plan de Desarrollo Departamental (PDD)") +
		p(mv("plan-desarrollo.departamental", "Articulación PDD")) +
		h3("2.3 Planes de Desarrollo Municipales") +
		p(mv("plan-desarrollo.municipal", "Articulación municipal")) +
		h2("3. Problema, oportunidad o necesidad") +
		p(mv("problematica.problemaCentral", "Problema central")) +
		h2("4. Descripción de la situación existente y antecedentes") +
		p(mv("problematica.descripcionSituacion", "Situación existente")) +
		h2("5. Justificación") +
		p(mv("problematica.magnitudIndicadores", "Justificación")) +
		h2("6. Objetivos") +
		h3("6.1 Objetivo General") +
		p(mv("objetivos.objetivoGeneral", "Objetivo general")) +
		h3("6.2 Objetivos Específicos") +
		p(mv("objetivos.especificos", "Objetivos específicos")) +
		h2("7. Árbol de problemas y soluciones") +
		h3("7.1 Árbol de Problemas") +
		kv("Problema central", "problematica.problemaCentral", "Problema central") +
		p(`<strong>Causas directas e indirectas:</strong>`) +
		p(mv("arbol.causas", "Causas")) +
		p(`<strong>Efectos directos e indirectos:</strong>`) +
		p(mv("arbol.efectos", "Efectos")) +
		h3("7.2 Árbol de Soluciones") +
		kv("Propósito", "objetivos.objetivoGeneral", "Objetivo general") +
		p(`<strong>Medios:</strong>`) +
		p(mv("arbol.medios", "Medios")) +
		p(`<strong>Fines:</strong>`) +
		p(mv("arbol.fines", "Fines")) +
		h2("8. Población afectada y objetivo") +
		kv("Población afectada", "poblacion.afectada", "Población afectada") +
		kv("Población objetivo", "poblacion.objetivo", "Población objetivo") +
		h2("9. Descripción de la alternativa seleccionada") +
		p(mv("identificacion.alternativa", "Alternativa seleccionada")) +
		h2("10. Productos y componentes de la inversión") +
		kv("Producto principal", "preparacion.producto", "Producto") +
		p(`<strong>Entregables:</strong>`) +
		p(mv("preparacion.entregables", "Entregables")) +
		h2("11. Cronograma de actividades") +
		p("Las actividades operativas y cronograma de ejecución se encuentran en fase de costeo presupuestal y programación detallada en la cadena de valor EDT.") +
		h2("12. Localización del proyecto") +
		kv("Departamento", "localizacion.departamento", "Departamento") +
		kv("Municipio", "localizacion.municipio", "Municipio") +
		`<hr>` +
		`<p style="text-align: center"><em>Constancia de formulación técnica generada automáticamente por el sistema Aurora Gov. Documento válido para el cumplimiento de los requisitos de radicación del Decreto 1278 de 2023.</em></p>`
}

// Plantillas globales del sistema (tenant_id NULL, is_system_default true).
var systemDocumentTemplates = []struct{ Name, HTML string }{
	{
		Name: "Documento Técnico estándar (Dec. 1278)",
		HTML: OfficialTechnicalDocumentHTML(),
	},
	{
		Name: "Documento Técnico resumido",
		HTML: `<h1>` + mv("project.name", "Nombre del Proyecto") + `</h1>` +
			`<p>` + mv("tenant.name", "Entidad") + ` · BPIN ` + mv("project.code", "Código BPIN") + `</p>` +
			`<h2>Resumen</h2><p>` + mv("project.object", "Objeto del proyecto") + `</p>` +
			`<h2>Objetivo general</h2><p>` + mv("objective.general", "Objetivo general") + `</p>` +
			`<h2>Costo total</h2><p>` + mv("budget.total", "Total") + `</p>`,
	},
}

// EnsureDocumentTemplatesSeed siembra las plantillas globales si no existen (idempotente por nombre).
func EnsureDocumentTemplatesSeed(db *gorm.DB) error {
	for _, s := range systemDocumentTemplates {
		var existing models.DocumentTemplate
		err := db.Where("tenant_id IS NULL AND is_system_default = ? AND name = ?", true, s.Name).First(&existing).Error
		if err == nil {
			// Refresca el contenido de la plantilla de sistema sembrada previamente.
			if existing.HTMLContent != s.HTML {
				if err := db.Model(&existing).Update("html_content", s.HTML).Error; err != nil {
					return err
				}
			}
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := db.Create(&models.DocumentTemplate{Name: s.Name, HTMLContent: s.HTML, IsSystemDefault: true}).Error; err != nil {
			return err
		}
	}
	return nil
}
