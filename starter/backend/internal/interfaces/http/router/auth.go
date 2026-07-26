package router

import (
	"aurora-backend/internal/interfaces/http/handlers"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterAuthRoutes(app *fiber.App, db *gorm.DB, jwtSecret string) {
	h := handlers.NewAuthHandler(db, jwtSecret)
	app.Post("/api/v1/auth/login", h.Login)
	app.Post("/api/v1/auth/register", h.Register)
}
