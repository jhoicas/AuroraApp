package main

import (
	"log"

	"aurora-backend/internal/application/access"
	"aurora-backend/internal/application/accessadmin"
	"aurora-backend/internal/config"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	httpmw "aurora-backend/internal/interfaces/http/middleware"
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

	// PBAC (ADR-0001): servicio de acceso con caché de 30 s y guard por ruta.
	// PBAC_ENFORCE: enforce (por defecto) | log (dry-run) | off.
	accessSvc := access.NewService(db, access.DefaultCacheTTL)
	guard := httpmw.NewAccessGuard(accessSvc, httpmw.ParseEnforceMode(cfg.PBACEnforce))
	log.Printf("PBAC_ENFORCE=%s", guard.Mode())

	// Administración de acceso (SUPER_ADMIN): módulos, usuarios, permisos y auditoría.
	accessAdminSvc := accessadmin.NewService(db, accessSvc)
	router.RegisterAdminAccessRoutes(app, cfg.JWTSecret, accessAdminSvc)

	// Administración local (TENANT_ADMIN): usuarios y permisos de su entidad.
	router.RegisterTenantAdminRoutes(app, db, cfg.JWTSecret, accessAdminSvc, guard)

	// Auth (público) + /auth/me/access
	router.RegisterAuthRoutes(app, db, cfg.JWTSecret, accessSvc)

	// Paso 3 — Tenants (SUPER_ADMIN)
	router.RegisterAdminTenantRoutes(app, db, cfg.JWTSecret)

	// Paso 3b — Localizaciones y Procesos MGA (lectura: autenticado; import: SUPER_ADMIN)
	router.RegisterAdminLocationRoutes(app, db, cfg.JWTSecret, guard)

	// Paso 4 — Projects (multi-tenant)
	router.RegisterProjectRoutes(app, db, cfg.JWTSecret, guard)

	// Paso 5 — Asistente IA
	router.RegisterAIRoutes(app, db, cfg, guard)

	// Paso 6 — Catálogo DNP (solo lectura)
	router.RegisterCatalogRoutes(app, db, cfg.JWTSecret, guard)

	// Paso 7 — Catálogos relacionales MGA (actores, entidades, posiciones)
	router.RegisterMgaCatalogRoutes(app, db, cfg.JWTSecret, guard)

	// Sincronización SODA Datos Abiertos DNP (SUPER_ADMIN)
	router.RegisterAdminSyncRoutes(app, db, cfg.JWTSecret)

	log.Printf("Server starting on port %s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
