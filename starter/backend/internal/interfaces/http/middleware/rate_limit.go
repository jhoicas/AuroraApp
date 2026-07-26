package middleware

import (
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/time/rate"
)

// RateLimitPerUser limita peticiones por usuario JWT (fallback: IP).
// limit = peticiones por minuto permitidas.
func RateLimitPerUser(perMinute int) fiber.Handler {
	if perMinute < 1 {
		perMinute = 10
	}

	var (
		mu       sync.Mutex
		limiters = make(map[string]*rate.Limiter)
	)

	getLimiter := func(key string) *rate.Limiter {
		mu.Lock()
		defer mu.Unlock()

		if lim, ok := limiters[key]; ok {
			return lim
		}
		lim := rate.NewLimiter(rate.Every(time.Minute/time.Duration(perMinute)), perMinute)
		limiters[key] = lim
		return lim
	}

	return func(c *fiber.Ctx) error {
		key, _ := c.Locals(LocalsUserID).(string)
		if key == "" {
			key = c.IP()
		}

		if !getLimiter(key).Allow() {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "rate limit exceeded: max 10 requests per minute",
			})
		}
		return c.Next()
	}
}
