package handlers

import (
	"log"
	"strconv"

	"aurora-backend/internal/application/accessadmin"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
)

const localsTenantActor = "tenant_actor"

// TenantAdminHandler expone la API de administración local (TENANT_ADMIN).
// El tenant y el actor salen SIEMPRE del JWT verificado contra la BD, nunca del cuerpo.
type TenantAdminHandler struct {
	svc *accessadmin.Service
}

func NewTenantAdminHandler(svc *accessadmin.Service) *TenantAdminHandler {
	return &TenantAdminHandler{svc: svc}
}

// Actor verifica en cada petición que el llamante siga siendo un TENANT_ADMIN activo de su
// entidad, con el token_version vigente (independiente de PBAC_ENFORCE: API privilegiada).
func (h *TenantAdminHandler) Actor(c *fiber.Ctx) error {
	userID, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "tenant context required"})
	}
	tv, _ := c.Locals(httpmw.LocalsTokenVersion).(int)
	policy, err := h.svc.ResolveTenantActor(c.UserContext(), userID, tenantID, tv)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	c.Locals(localsTenantActor, *policy)
	return c.Next()
}

func policyOf(c *fiber.Ctx) accessadmin.ActorPolicy {
	p, _ := c.Locals(localsTenantActor).(accessadmin.ActorPolicy)
	return p
}

func (h *TenantAdminHandler) ListUsers(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	users, total, err := h.svc.TenantListUsers(c.UserContext(), policyOf(c), limit, offset)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(fiber.Map{"data": users, "total": total, "limit": limit, "offset": offset})
}

func (h *TenantAdminHandler) CreateUser(c *fiber.Ctx) error {
	var in accessadmin.CreateUserInput // sin tenant_id: cualquier valor del cuerpo se ignora
	if !bind(c, &in) {
		return nil
	}
	u, err := h.svc.TenantCreateUser(c.UserContext(), policyOf(c), in)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(u)
}

func (h *TenantAdminHandler) GetUser(c *fiber.Ctx) error {
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	u, err := h.svc.TenantGetUser(c.UserContext(), policyOf(c), id)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(u)
}

func (h *TenantAdminHandler) UpdateUser(c *fiber.Ctx) error {
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	var in accessadmin.TenantUpdateUserInput
	if !bind(c, &in) {
		return nil
	}
	u, err := h.svc.TenantUpdateUser(c.UserContext(), policyOf(c), id, in)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(u)
}

func (h *TenantAdminHandler) SetPassword(c *fiber.Ctx) error {
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	var body struct {
		NewPassword string `json:"new_password"`
	}
	if !bind(c, &body) {
		return nil
	}
	if err := h.svc.TenantSetUserPassword(c.UserContext(), policyOf(c), id, body.NewPassword); err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *TenantAdminHandler) SetStatus(c *fiber.Ctx) error {
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	var body struct {
		IsActive *bool `json:"is_active"`
	}
	if !bind(c, &body) {
		return nil
	}
	if body.IsActive == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "is_active es obligatorio"})
	}
	if err := h.svc.TenantSetUserStatus(c.UserContext(), policyOf(c), id, *body.IsActive); err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *TenantAdminHandler) GetPermissions(c *fiber.Ctx) error {
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	p, err := h.svc.TenantGetUserPermissions(c.UserContext(), policyOf(c), id)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(p)
}

func (h *TenantAdminHandler) SetPermissions(c *fiber.Ctx) error {
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	var body struct {
		Permissions []accessadmin.PermissionInput `json:"permissions"`
	}
	if !bind(c, &body) {
		return nil
	}
	policy := policyOf(c)
	if err := h.svc.TenantSetUserPermissions(c.UserContext(), policy, id, body.Permissions); err != nil {
		return respondAccessAdminError(c, err)
	}
	p, err := h.svc.TenantGetUserPermissions(c.UserContext(), policy, id)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(p)
}

// AssignableModules responde GET /tenant/modules/assignable.
func (h *TenantAdminHandler) AssignableModules(c *fiber.Ctx) error {
	mods, err := h.svc.AssignableModules(c.UserContext(), policyOf(c).TenantID)
	if err != nil {
		log.Printf("tenant admin: assignable: %v", err)
		return respondAccessAdminError(c, err)
	}
	return c.JSON(fiber.Map{"data": mods})
}
