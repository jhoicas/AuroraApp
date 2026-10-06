package router

import (
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/modules"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterProjectRoutes registra proyectos, presupuesto, formulación MGA y reportes.
// Cada ruta de negocio declara su módulo/acción PBAC (ADR-0001); ver PBAC_ENFORCE.
func RegisterProjectRoutes(app *fiber.App, db *gorm.DB, jwtSecret string, guard *httpmw.AccessGuard) {
	ph := handlers.NewProjectHandler(db)
	bh := handlers.NewBudgetHandler(db)
	eh := handlers.NewProjectEvaluationHandler(db)
	mh := handlers.NewMgaHandler(db)
	peh := handlers.NewProjectEdtHandler(db)
	fah := handlers.NewFormulationAuditHandler(db)
	pex := handlers.NewProjectExportHandler(db)

	projects := app.Group("/api/v1/projects",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireTenant(),
	)

	// Aislamiento por formulador: un FORMULADOR solo accede a proyectos propios (404 si no).
	owner := httpmw.ProjectOwnerGuard(db)
	projects.Use("/:id", owner)

	// Ruta de exportación de Documento Técnico Valle del Cauca (Decreto 1278 de 2023)
	projects.Get("/:id/export/technical-document-valle", guard.Require(modules.CodeProjects, modules.ActionView), pex.ExportTechnicalDocumentValle)

	// Grupo complementario para compatibilidad estricta con /api/v1/tenant/projects
	tenantProjects := app.Group("/api/v1/tenant/projects",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireTenant(),
	)
	tenantProjects.Use("/:id", owner)
	tenantProjects.Get("/:id/export/technical-document-valle", guard.Require(modules.CodeProjects, modules.ActionView), pex.ExportTechnicalDocumentValle)

	// Grupo de reportes de tenant (Visión Directiva e inversión)
	tenantReports := app.Group("/api/v1/tenant/reports",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireTenant(),
	)
	tenantReports.Get("/investment-pipeline", guard.Require(modules.CodeReports, modules.ActionView), ph.GetInvestmentPipelineReport)
	tenantReports.Get("/audit-radar", guard.Require(modules.CodeReports, modules.ActionView), ph.GetAuditRadarReport)

	reports := app.Group("/api/v1/reports",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireTenant(),
	)
	reports.Get("/investment-pipeline", guard.Require(modules.CodeReports, modules.ActionView), ph.GetInvestmentPipelineReport)
	reports.Get("/audit-radar", guard.Require(modules.CodeReports, modules.ActionView), ph.GetAuditRadarReport)

	projects.Post("/", guard.Require(modules.CodeProjects, modules.ActionCreate), ph.Create)
	projects.Get("/", guard.Require(modules.CodeProjects, modules.ActionView), ph.List)
	projects.Get("/evaluations/summary", guard.Require(modules.CodeMGAEvaluacion, modules.ActionView), eh.ListTenantEvaluations)
	projects.Get("/:id", guard.Require(modules.CodeProjects, modules.ActionView), ph.GetByID)
	// PATCH guarda cualquier etapa de la MGA (snapshot completo): se autoriza según lo que cambia.
	projects.Patch("/:id", guard.RequireProjectPatchPermission(httpmw.ProjectSnapshotFromDB(db)), ph.Patch)
	// Reasignación de autoría: solo administradores (la lista de candidatos y el cambio).
	adminOnly := httpmw.RequireRole(constants.RoleTenantAdmin, constants.RoleSuperAdmin)
	projects.Get("/:id/reassign-candidates", guard.Require(modules.CodeProjects, modules.ActionEdit), adminOnly, ph.ReassignCandidates)
	projects.Patch("/:id/reassign", guard.Require(modules.CodeProjects, modules.ActionEdit), adminOnly, ph.Reassign)
	projects.Patch("/:id/details", guard.Require(modules.CodeProjects, modules.ActionEdit), ph.UpdateDetails)
	projects.Post("/:id/evaluate", guard.Require(modules.CodeMGAEvaluacion, modules.ActionCreate), eh.Evaluate)
	projects.Get("/:id/evaluations", guard.Require(modules.CodeMGAEvaluacion, modules.ActionView), eh.ListEvaluations)
	projects.Get("/:id/audit", guard.Require(modules.CodeMGAEvaluacion, modules.ActionView), fah.GetAuditReport)

	projects.Post("/:id/budget", guard.Require(modules.CodeProjects, modules.ActionCreate), bh.Create)
	projects.Get("/:id/budget", guard.Require(modules.CodeProjects, modules.ActionView), bh.List)
	projects.Delete("/:id/budget/:itemId", guard.Require(modules.CodeProjects, modules.ActionDelete), bh.Delete)

	// Formulación MGA (causas, objetivos, indicadores y entidades extendidas)
	projects.Get("/:id/mga/formulation", guard.Require(modules.CodeMGA, modules.ActionView), mh.GetFullFormulation)
	projects.Get("/:id/mga/causes", guard.Require(modules.CodeMGAIdentificacion, modules.ActionView), mh.ListCauses)
	projects.Post("/:id/mga/causes", guard.Require(modules.CodeMGAIdentificacion, modules.ActionCreate), mh.CreateCause)
	projects.Put("/:id/mga/causes/:causeId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionEdit), mh.UpdateCause)
	projects.Delete("/:id/mga/causes/:causeId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionDelete), mh.DeleteCause)
	projects.Put("/:id/mga/objectives/:objId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionEdit), mh.UpdateObjective)
	projects.Get("/:id/mga/indicators", guard.Require(modules.CodeMGAIdentificacion, modules.ActionView), mh.ListIndicators)
	projects.Post("/:id/mga/indicators", guard.Require(modules.CodeMGAIdentificacion, modules.ActionCreate), mh.CreateIndicator)
	projects.Put("/:id/mga/indicators/:indicatorId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionEdit), mh.UpdateIndicator)
	projects.Delete("/:id/mga/indicators/:indicatorId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionDelete), mh.DeleteIndicator)

	projects.Post("/:id/mga/effects", guard.Require(modules.CodeMGAIdentificacion, modules.ActionCreate), mh.CreateEffect)
	projects.Put("/:id/mga/effects/:effectId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionEdit), mh.UpdateEffect)
	projects.Delete("/:id/mga/effects/:effectId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionDelete), mh.DeleteEffect)

	projects.Post("/:id/mga/participants", guard.Require(modules.CodeMGAIdentificacion, modules.ActionCreate), mh.CreateParticipant)
	projects.Put("/:id/mga/participants/:participantId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionEdit), mh.UpdateParticipant)
	projects.Delete("/:id/mga/participants/:participantId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionDelete), mh.DeleteParticipant)

	projects.Post("/:id/mga/populations", guard.Require(modules.CodeMGAIdentificacion, modules.ActionCreate), mh.CreatePopulation)
	projects.Put("/:id/mga/populations/:populationId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionEdit), mh.UpdatePopulation)
	projects.Delete("/:id/mga/populations/:populationId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionDelete), mh.DeletePopulation)

	projects.Post("/:id/mga/alternatives", guard.Require(modules.CodeMGAIdentificacion, modules.ActionCreate), mh.CreateAlternative)
	projects.Put("/:id/mga/alternatives/:alternativeId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionEdit), mh.UpdateAlternative)
	projects.Delete("/:id/mga/alternatives/:alternativeId", guard.Require(modules.CodeMGAIdentificacion, modules.ActionDelete), mh.DeleteAlternative)

	// Estudio de necesidades (bien/servicio + serie anual oferta/demanda)
	projects.Get("/:id/mga/needs", guard.Require(modules.CodeMGAPreparacion, modules.ActionView), mh.ListNeeds)
	projects.Post("/:id/mga/needs", guard.Require(modules.CodeMGAPreparacion, modules.ActionCreate), mh.CreateNeed)
	projects.Put("/:id/mga/needs/:needId", guard.Require(modules.CodeMGAPreparacion, modules.ActionEdit), mh.UpdateNeed)
	projects.Put("/:id/mga/needs/:needId/annual-values/:anio", guard.Require(modules.CodeMGAPreparacion, modules.ActionEdit), mh.UpdateNeedAnnualValue)
	projects.Delete("/:id/mga/needs/:needId", guard.Require(modules.CodeMGAPreparacion, modules.ActionDelete), mh.DeleteNeed)

	// Cadena de valor EDT (Tipología A)
	projects.Post("/:id/catalog-link", guard.Require(modules.CodeMGAPreparacion, modules.ActionCreate), peh.LinkProduct)
	projects.Get("/:id/edt-chain", guard.Require(modules.CodeMGAPreparacion, modules.ActionView), peh.GetEdtChain)
	projects.Post("/:id/edt-nodes", guard.Require(modules.CodeMGAPreparacion, modules.ActionCreate), peh.CreateEdtNode)
	projects.Put("/:id/edt-nodes/:nodeId", guard.Require(modules.CodeMGAPreparacion, modules.ActionEdit), peh.UpdateEdtNode)
	projects.Delete("/:id/edt-nodes/:nodeId", guard.Require(modules.CodeMGAPreparacion, modules.ActionDelete), peh.DeleteEdtNode)
	projects.Post("/:id/deliverables", guard.Require(modules.CodeMGAPreparacion, modules.ActionCreate), peh.CreateDeliverable)
	projects.Put("/:id/deliverables/:delivId", guard.Require(modules.CodeMGAPreparacion, modules.ActionEdit), peh.UpdateDeliverable)
	projects.Delete("/:id/deliverables/:delivId", guard.Require(modules.CodeMGAPreparacion, modules.ActionDelete), peh.DeleteDeliverable)
	projects.Post("/:id/activities", guard.Require(modules.CodeMGAPreparacion, modules.ActionCreate), peh.CreateActivity)
	projects.Put("/:id/activities/:actId", guard.Require(modules.CodeMGAPreparacion, modules.ActionEdit), peh.UpdateActivity)
	projects.Delete("/:id/activities/:actId", guard.Require(modules.CodeMGAPreparacion, modules.ActionDelete), peh.DeleteActivity)
}
