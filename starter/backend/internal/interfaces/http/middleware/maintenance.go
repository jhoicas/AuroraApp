package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// CodeMaintenance identifica el modo mantenimiento en las respuestas 503.
const CodeMaintenance = "MAINTENANCE_MODE"

// MaintenanceGuard bloquea con 503 a todo usuario distinto de SUPER_ADMIN mientras
// el modo mantenimiento esté activo. Quedan exentos /healthz, /api/v1/auth/* (para que
// el SUPER_ADMIN pueda iniciar sesión) y /api/v1/system/status (lo usa la pantalla de
// mantenimiento). El rol se lee del JWT sin exigir sesión: la validación completa sigue
// en RequireAuth.
func MaintenanceGuard(jwtSecret string, active func(c *fiber.Ctx) bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		p := c.Path()
		if p == "/healthz" || p == "/api/v1/system/status" || strings.HasPrefix(p, "/api/v1/auth/") {
			return c.Next()
		}
		if !active(c) {
			return c.Next()
		}
		if bearerRole(c, jwtSecret) == "SUPER_ADMIN" {
			return c.Next()
		}
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Sistema en Mantenimiento",
			"code":  CodeMaintenance,
		})
	}
}

func bearerRole(c *fiber.Ctx, secret string) string {
	h := c.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return ""
	}
	claims := &Claims{}
	tok, err := jwt.ParseWithClaims(strings.TrimSpace(h[7:]), claims, func(*jwt.Token) (any, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !tok.Valid || claims.TokenType == "refresh" {
		return ""
	}
	return strings.ToUpper(strings.TrimSpace(claims.Role))
}
