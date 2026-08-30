package router

import (
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterProjectRoutes(app *fiber.App, db *gorm.DB, jwtSecret string) {
	ph := handlers.NewProjectHandler(db)
	bh := handlers.NewBudgetHandler(db)
	eh := handlers.NewProjectEvaluationHandler(db)
	mh := handlers.NewMgaHandler(db)
	peh := handlers.NewProjectEdtHandler(db)
	fah := handlers.NewFormulationAuditHandler(db)

	projects := app.Group("/api/v1/projects",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireTenant(),
	)

	projects.Post("/", ph.Create)
	projects.Get("/", ph.List)
	projects.Get("/evaluations/summary", eh.ListTenantEvaluations)
	projects.Get("/:id", ph.GetByID)
	projects.Patch("/:id/details", ph.UpdateDetails)
	projects.Post("/:id/evaluate", eh.Evaluate)
	projects.Get("/:id/evaluations", eh.ListEvaluations)
	projects.Get("/:id/audit", fah.GetAuditReport)

	projects.Post("/:id/budget", bh.Create)
	projects.Get("/:id/budget", bh.List)
	projects.Delete("/:id/budget/:itemId", bh.Delete)

	// Formulación MGA (causas, objetivos, indicadores y entidades extendidas)
	projects.Get("/:id/mga/formulation", mh.GetFullFormulation)
	projects.Get("/:id/mga/causes", mh.ListCauses)
	projects.Post("/:id/mga/causes", mh.CreateCause)
	projects.Put("/:id/mga/causes/:causeId", mh.UpdateCause)
	projects.Delete("/:id/mga/causes/:causeId", mh.DeleteCause)
	projects.Put("/:id/mga/objectives/:objId", mh.UpdateObjective)
	projects.Get("/:id/mga/indicators", mh.ListIndicators)
	projects.Post("/:id/mga/indicators", mh.CreateIndicator)
	projects.Put("/:id/mga/indicators/:indicatorId", mh.UpdateIndicator)
	projects.Delete("/:id/mga/indicators/:indicatorId", mh.DeleteIndicator)

	projects.Post("/:id/mga/effects", mh.CreateEffect)
	projects.Put("/:id/mga/effects/:effectId", mh.UpdateEffect)
	projects.Delete("/:id/mga/effects/:effectId", mh.DeleteEffect)

	projects.Post("/:id/mga/participants", mh.CreateParticipant)
	projects.Put("/:id/mga/participants/:participantId", mh.UpdateParticipant)
	projects.Delete("/:id/mga/participants/:participantId", mh.DeleteParticipant)

	projects.Post("/:id/mga/populations", mh.CreatePopulation)
	projects.Put("/:id/mga/populations/:populationId", mh.UpdatePopulation)
	projects.Delete("/:id/mga/populations/:populationId", mh.DeletePopulation)

	projects.Post("/:id/mga/alternatives", mh.CreateAlternative)
	projects.Put("/:id/mga/alternatives/:alternativeId", mh.UpdateAlternative)
	projects.Delete("/:id/mga/alternatives/:alternativeId", mh.DeleteAlternative)

	// Cadena de valor EDT (Tipología A)
	projects.Post("/:id/catalog-link", peh.LinkProduct)
	projects.Get("/:id/edt-chain", peh.GetEdtChain)
	projects.Post("/:id/edt-nodes", peh.CreateEdtNode)
	projects.Put("/:id/edt-nodes/:nodeId", peh.UpdateEdtNode)
	projects.Delete("/:id/edt-nodes/:nodeId", peh.DeleteEdtNode)
	projects.Post("/:id/deliverables", peh.CreateDeliverable)
	projects.Put("/:id/deliverables/:delivId", peh.UpdateDeliverable)
	projects.Delete("/:id/deliverables/:delivId", peh.DeleteDeliverable)
	projects.Post("/:id/activities", peh.CreateActivity)
	projects.Put("/:id/activities/:actId", peh.UpdateActivity)
	projects.Delete("/:id/activities/:actId", peh.DeleteActivity)
}
