package main

import (
	"log"

	"aurora-backend/internal/config"
	legacyhandlers "aurora-backend/internal/handlers"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/router"
	legacymw "aurora-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	cfg := config.LoadConfig()

	db, err := postgres.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	app := fiber.New(fiber.Config{
		AppName:   "AuroraApp Public Investment SaaS",
		BodyLimit: 50 * 1024 * 1024, // 50 MB — importaciones masivas de catálogo
	})
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:5173,http://127.0.0.1:5173",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
	}))

	// Auth (público)
	router.RegisterAuthRoutes(app, db, cfg.JWTSecret)

	// Paso 3 — Tenants (SUPER_ADMIN)
	router.RegisterAdminTenantRoutes(app, db, cfg.JWTSecret)

	// Paso 4 — Projects (multi-tenant)
	router.RegisterProjectRoutes(app, db, cfg.JWTSecret)

	// Paso 5 — Asistente IA
	router.RegisterAIRoutes(app, db, cfg.JWTSecret)

	// Paso 6 — Catálogo DNP (solo lectura)
	router.RegisterCatalogRoutes(app, db, cfg.JWTSecret)

	// Legacy starter routes (se migrarán en pasos posteriores)
	adminGroup := app.Group("/api/admin")
	adminGroup.Post("/catalog/upload", legacyhandlers.ImportCatalogExcel)
	app.Post("/api/catalog/upload", legacyhandlers.ImportCatalogExcel)

	tenantGroup := app.Group("/api/tenant", legacymw.TenantMiddleware)
	tenantGroup.Get("/projects", legacyhandlers.GetProjects)
	tenantGroup.Post("/ai/formulate", legacyhandlers.FormulateProjectAI)
	tenantGroup.Post("/wiki/upload", legacyhandlers.UploadWikiVault)
	tenantGroup.Get("/wiki/list", legacyhandlers.ListWikiNotes)
	tenantGroup.Get("/wiki/read", legacyhandlers.ReadWikiNote)
	tenantGroup.Post("/wiki/save", legacyhandlers.SaveWikiNote)
	tenantGroup.Post("/catalog/import", legacyhandlers.ImportCatalogExcel)

	log.Printf("Server starting on port %s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
