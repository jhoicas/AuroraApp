package handlers

import (
	"os"
	"testing"
)

// TestMain evita que config.LoadConfig aborte el binario de test:
// estos handlers legacy usan sqlmock, nunca una conexión real.
func TestMain(m *testing.M) {
	if os.Getenv("DATABASE_URL") == "" {
		_ = os.Setenv("DATABASE_URL", "postgres://test:test@127.0.0.1:5432/test?sslmode=disable")
	}
	if os.Getenv("JWT_SECRET") == "" {
		_ = os.Setenv("JWT_SECRET", "test-secret")
	}
	os.Exit(m.Run())
}
