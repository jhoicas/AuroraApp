package router

import (
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterAIRoutes(app *fiber.App, db *gorm.DB, jwtSecret string) {
	h := handlers.NewAIHandler(db)

	ai := app.Group("/api/v1/ai",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireTenant(),
	)

	ai.Post("/chat", httpmw.RateLimitPerUser(10), h.Chat)
	ai.Get("/projects/:projectId/history", h.History)
}
