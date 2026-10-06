package main

import (
	"log"

	"aurora-backend/internal/config"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/router"

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
		AllowOrigins: cfg.CORSOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
	}))

	// Readiness para Docker healthcheck / Playwright webServer (FASE 6 E2E).
	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Auth (público)
	router.RegisterAuthRoutes(app, db, cfg.JWTSecret)

	// Paso 3 — Tenants (SUPER_ADMIN)
	router.RegisterAdminTenantRoutes(app, db, cfg.JWTSecret)

	// Paso 3b — Localizaciones y Procesos MGA (lectura: autenticado; import: SUPER_ADMIN)
	router.RegisterAdminLocationRoutes(app, db, cfg.JWTSecret)

	// Paso 4 — Projects (multi-tenant)
	router.RegisterProjectRoutes(app, db, cfg.JWTSecret)

	// Paso 5 — Asistente IA
	router.RegisterAIRoutes(app, db, cfg)

	// Paso 6 — Catálogo DNP (solo lectura)
	router.RegisterCatalogRoutes(app, db, cfg.JWTSecret)

	// Paso 7 — Catálogos relacionales MGA (actores, entidades, posiciones)
	router.RegisterMgaCatalogRoutes(app, db, cfg.JWTSecret)

	// Sincronización SODA Datos Abiertos DNP (SUPER_ADMIN)
	router.RegisterAdminSyncRoutes(app, db, cfg.JWTSecret)

	log.Printf("Server starting on port %s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
