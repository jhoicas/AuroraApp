package router

import (
	"aurora-backend/internal/application/accessadmin"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/modules"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterTenantAdminRoutes registra la API de administración local (TENANT_ADMIN).
//
//	GET/POST          /api/v1/tenant/users
//	GET/PATCH         /api/v1/tenant/users/:id
//	PUT               /api/v1/tenant/users/:id/password
//	PATCH             /api/v1/tenant/users/:id/status
//	GET/PUT           /api/v1/tenant/users/:id/permissions
//	GET               /api/v1/tenant/modules/assignable
//
// Cadena por ruta: RequireAuth → RequireTenant → RequireRole(TENANT_ADMIN) → verificación del
// actor en BD → TenantTargetGuard (rutas con :id; otro tenant ⇒ 404) → permiso PBAC del módulo
// `users` (respeta PBAC_ENFORCE y el techo de tenant_modules).
func RegisterTenantAdminRoutes(app *fiber.App, db *gorm.DB, jwtSecret string, svc *accessadmin.Service, guard *httpmw.AccessGuard) {
	h := handlers.NewTenantAdminHandler(svc)
	target := httpmw.TenantTargetGuard(httpmw.UserTenantResolver(db, "id"))
	chain := []fiber.Handler{
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireTenant(),
		httpmw.RequireRole(constants.RoleTenantAdmin),
		h.Actor,
	}

	users := app.Group("/api/v1/tenant/users", chain...)
	users.Get("/", guard.Require(modules.CodeUsers, modules.ActionView), h.ListUsers)
	users.Post("/", guard.Require(modules.CodeUsers, modules.ActionCreate), h.CreateUser)
	users.Get("/:id", target, guard.Require(modules.CodeUsers, modules.ActionView), h.GetUser)
	users.Patch("/:id", target, guard.Require(modules.CodeUsers, modules.ActionEdit), h.UpdateUser)
	users.Put("/:id/password", target, guard.Require(modules.CodeUsers, modules.ActionEdit), h.SetPassword)
	users.Patch("/:id/status", target, guard.Require(modules.CodeUsers, modules.ActionEdit), h.SetStatus)
	users.Get("/:id/permissions", target, guard.Require(modules.CodeUsers, modules.ActionView), h.GetPermissions)
	users.Put("/:id/permissions", target, guard.Require(modules.CodeUsers, modules.ActionEdit), h.SetPermissions)

	mods := app.Group("/api/v1/tenant/modules", chain...)
	mods.Get("/assignable", guard.Require(modules.CodeUsers, modules.ActionView), h.AssignableModules)
}
