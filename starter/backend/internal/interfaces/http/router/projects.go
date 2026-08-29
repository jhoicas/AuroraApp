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

	projects.Post("/:id/budget", bh.Create)
	projects.Get("/:id/budget", bh.List)
	projects.Delete("/:id/budget/:itemId", bh.Delete)

	// Formulación MGA (causas, objetivos específicos, indicadores)
	projects.Get("/:id/mga/formulation", mh.GetFormulation)
	projects.Get("/:id/mga/causes", mh.ListCauses)
	projects.Post("/:id/mga/causes", mh.CreateCause)
	projects.Put("/:id/mga/causes/:causeId", mh.UpdateCause)
	projects.Delete("/:id/mga/causes/:causeId", mh.DeleteCause)
	projects.Put("/:id/mga/objectives/:objId", mh.UpdateObjective)
	projects.Get("/:id/mga/indicators", mh.ListIndicators)
	projects.Post("/:id/mga/indicators", mh.CreateIndicator)
	projects.Put("/:id/mga/indicators/:indicatorId", mh.UpdateIndicator)
	projects.Delete("/:id/mga/indicators/:indicatorId", mh.DeleteIndicator)
}
