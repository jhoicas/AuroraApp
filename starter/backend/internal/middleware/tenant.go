package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// TenantMiddleware extracts the tenant ID from the JWT or headers and injects it into context.
// This is a stub. In a real app, you would verify the JWT and extract claims.
func TenantMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing or invalid Authorization header",
		})
	}

	// For demonstration, let's assume the token itself is the tenant_id or
	// we extract it from claims.
	// token := strings.TrimPrefix(authHeader, "Bearer ")
	// tenantID := parseTokenAndGetTenantID(token)
	tenantID := "mock-tenant-id" 

	// Set tenant context
	c.Locals("tenant_id", tenantID)

	return c.Next()
}
