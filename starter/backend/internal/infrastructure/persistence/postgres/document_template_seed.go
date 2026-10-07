package postgres

import (
	"errors"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

func mv(id, label string) string {
	return `<span class="mga-var" data-id="` + id + `">` + label + `</span>`
}

// Plantillas globales del sistema (tenant_id NULL, is_system_default true).
var systemDocumentTemplates = []struct{ Name, HTML string }{
	{
		Name: "Documento Técnico estándar (Dec. 1278)",
		HTML: `<h1 style="text-align: center">DOCUMENTO TÉCNICO DEL PROYECTO DE INVERSIÓN</h1>` +
			`<p style="text-align: center">` + mv("tenant.name", "Entidad") + `</p>` +
			`<h2>1. Identificación</h2>` +
			`<p><strong>Proyecto:</strong> ` + mv("project.name", "Nombre del Proyecto") + `</p>` +
			`<p><strong>Código BPIN:</strong> ` + mv("project.code", "Código BPIN") + `</p>` +
			`<p><strong>Sector:</strong> ` + mv("project.sector", "Sector") + `</p>` +
			`<p><strong>Fase:</strong> ` + mv("project.phase", "Fase de maduración") + `</p>` +
			`<h2>2. Problema y objetivo</h2>` +
			`<p>` + mv("problem.description", "Descripción del problema") + `</p>` +
			`<h3>Causas</h3><p>` + mv("problem.causes", "Causas") + `</p>` +
			`<h3>Efectos</h3><p>` + mv("problem.effects", "Efectos") + `</p>` +
			`<p><strong>Objetivo general:</strong> ` + mv("objective.general", "Objetivo general") + `</p>` +
			`<h2>3. Presupuesto</h2>` +
			`<p>` + mv("budget.items", "Detalle del presupuesto") + `</p>` +
			`<p><strong>Total:</strong> ` + mv("budget.total", "Total") + `</p>` +
			`<p style="text-align: right">Generado el ` + mv("today", "Fecha") + `</p>`,
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
