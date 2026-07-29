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
}
