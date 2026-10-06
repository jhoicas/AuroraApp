package router

import (
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterAuthRoutes(app *fiber.App, db *gorm.DB, jwtSecret string) {
	h := handlers.NewAuthHandler(db, jwtSecret)
	// Endpoints públicos: limitados por IP para frenar fuerza bruta y abuso de registro.
	app.Post("/api/v1/auth/login", httpmw.RateLimitPerUser(30), h.Login)
	app.Post("/api/v1/auth/register", httpmw.RateLimitPerUser(10), h.Register)
	app.Post("/api/v1/auth/refresh", httpmw.RateLimitPerUser(60), h.Refresh)
}
