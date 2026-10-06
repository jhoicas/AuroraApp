package router

import (
	"aurora-backend/internal/application/accessadmin"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
)

// RegisterAdminAccessRoutes registra la API de administración de acceso (PBAC).
// Solo SUPER_ADMIN; cada cambio queda en access_audit_logs e invalida la caché.
//
//	/api/v1/admin/modules                      CRUD + PUT /order
//	/api/v1/admin/tenants/:tenantId/users      GET, POST
//	/api/v1/admin/tenants/:tenantId/modules    GET, PUT (techo de módulos del tenant)
//	/api/v1/admin/users/:id/permissions        GET, PUT
//	/api/v1/admin/users/:id/password           PUT
//	/api/v1/admin/users/:id/status             PUT
func RegisterAdminAccessRoutes(app *fiber.App, jwtSecret string, svc *accessadmin.Service) {
	h := handlers.NewAccessAdminHandler(svc)

	admin := app.Group("/api/v1/admin",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)

	admin.Get("/modules", h.ListModules)
	admin.Post("/modules", h.CreateModule)
	admin.Put("/modules/order", h.ReorderModules) // antes de /:id
	admin.Put("/modules/:id", h.UpdateModule)
	admin.Delete("/modules/:id", h.DeleteModule)

	admin.Get("/tenants/:tenantId/users", h.ListTenantUsers)
	admin.Post("/tenants/:tenantId/users", h.CreateTenantUser)
	admin.Get("/tenants/:tenantId/modules", h.GetTenantModules)
	admin.Put("/tenants/:tenantId/modules", h.SetTenantModules)

	admin.Get("/users/:id/permissions", h.GetUserPermissions)
	admin.Put("/users/:id/permissions", h.SetUserPermissions)
	admin.Put("/users/:id/password", h.SetUserPassword)
	admin.Put("/users/:id/status", h.SetUserStatus)
}
