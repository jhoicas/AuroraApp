package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	LocalsUserID   = "user_id"
	LocalsRole     = "role"
	LocalsTenantID = "tenant_id"
)

type Claims struct {
	UserID   string  `json:"user_id"`
	Role     string  `json:"role"`
	TenantID *string `json:"tenant_id,omitempty"`
	jwt.RegisteredClaims
}

func RequireAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing or invalid authorization header",
			})
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.NewError(fiber.StatusUnauthorized, "unexpected signing method")
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid or expired token",
			})
		}

		if _, err := uuid.Parse(claims.UserID); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid token claims",
			})
		}

		c.Locals(LocalsUserID, claims.UserID)
		c.Locals(LocalsRole, claims.Role)
		if claims.TenantID != nil {
			c.Locals(LocalsTenantID, *claims.TenantID)
		}

		return c.Next()
	}
}

func RequireRole(roles ...string) fiber.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[strings.ToUpper(strings.TrimSpace(r))] = struct{}{}
	}

	return func(c *fiber.Ctx) error {
		role, _ := c.Locals(LocalsRole).(string)
		role = strings.ToUpper(strings.TrimSpace(role))
		if role == "" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "forbidden",
			})
		}

		if _, ok := allowed[role]; !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "insufficient role",
			})
		}

		return c.Next()
	}
}
