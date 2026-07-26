package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	DatabaseURL  string
	JWTSecret    string
	OpenAIApiKey string
}

// LoadConfig carga variables desde .env (si existe) y el entorno del proceso.
// DATABASE_URL es obligatoria: no hay fallback a localhost/Docker/aurora-db.
func LoadConfig() *Config {
	// Intenta rutas habituales sin pisar variables ya definidas en el entorno.
	_ = godotenv.Load()
	_ = godotenv.Load(".env")
	_ = godotenv.Load("backend/.env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-only-change-me"
		log.Println("WARNING: JWT_SECRET not set; using insecure default")
	}

	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required: set it in .env (no local Docker/postgres fallback)")
	}

	return &Config{
		Port:         port,
		DatabaseURL:  databaseURL,
		JWTSecret:    jwtSecret,
		OpenAIApiKey: os.Getenv("ANTHROPIC_API_KEY"),
	}
}
