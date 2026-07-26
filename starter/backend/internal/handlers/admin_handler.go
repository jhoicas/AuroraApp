package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// GetTenants returns a list of tenants (Superadmin only)
func GetTenants(c *fiber.Ctx) error {
	// Implement DB query
	return c.JSON(fiber.Map{
		"message": "List of tenants",
		"data":    []string{},
	})
}
