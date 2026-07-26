package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// GetProjects returns projects for the current tenant
func GetProjects(c *fiber.Ctx) error {
	tenantID := c.Locals("tenant_id")
	
	// Implement DB query using tenantID for isolation
	return c.JSON(fiber.Map{
		"message": "List of projects for tenant",
		"tenant_id": tenantID,
		"data":    []string{},
	})
}
