package middleware

import (
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	LocalsUserID   = "user_id"
	LocalsRole     = "role"
	LocalsTenantID = "tenant_id"
	tokenTypeClaim = "token_type"
)

type Claims struct {
	UserID    string  `json:"user_id"`
	Role      string  `json:"role"`
	TenantID  *string `json:"tenant_id,omitempty"`
	TokenType string  `json:"token_type,omitempty"` // access | refresh
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

		tokenStr := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		if tokenStr == "" || len(tokenStr) > 8192 {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid token format",
			})
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(jwtSecret), nil
		}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid or expired token",
			})
		}

		if claims.TokenType == "refresh" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "refresh token cannot be used for API access",
			})
		}

		if _, err := uuid.Parse(claims.UserID); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid token claims",
			})
		}

		role := strings.ToUpper(strings.TrimSpace(claims.Role))
		if role == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid token role",
			})
		}

		if claims.TenantID != nil && strings.TrimSpace(*claims.TenantID) != "" {
			if _, err := uuid.Parse(*claims.TenantID); err != nil {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "invalid tenant in token",
				})
			}
		}

		if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now().UTC()) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "token expired",
			})
		}

		c.Locals(LocalsUserID, claims.UserID)
		c.Locals(LocalsRole, role)
		if claims.TenantID != nil {
			c.Locals(LocalsTenantID, strings.TrimSpace(*claims.TenantID))
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

// ParseRefreshClaims valida un refresh token sin exigir access token.
func ParseRefreshClaims(jwtSecret, tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		return []byte(jwtSecret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid refresh token")
	}
	if claims.TokenType != "refresh" {
		return nil, fmt.Errorf("not a refresh token")
	}
	return claims, nil
}
