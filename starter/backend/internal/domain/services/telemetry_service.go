package services

import (
	"context"
	"log"
	"time"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UsageLogRepository abstrae la persistencia de telemetría (permite mocks en tests).
type UsageLogRepository interface {
	Create(ctx context.Context, entry *models.AiUsageLog) error
}

type gormUsageLogRepo struct {
	db *gorm.DB
}

func (r *gormUsageLogRepo) Create(ctx context.Context, entry *models.AiUsageLog) error {
	return r.db.WithContext(ctx).Create(entry).Error
}

// TelemetryService registra uso de IA de forma asíncrona (no bloquea requests HTTP).
type TelemetryService struct {
	repo UsageLogRepository
	ch   chan models.AiUsageLog
}

// NewTelemetryService crea el servicio con persistencia GORM y buffer de 256.
func NewTelemetryService(db *gorm.DB) *TelemetryService {
	return NewTelemetryServiceWithRepo(&gormUsageLogRepo{db: db}, 256)
}

// NewTelemetryServiceWithRepo permite inyectar repositorio y tamaño de buffer (tests).
func NewTelemetryServiceWithRepo(repo UsageLogRepository, bufferSize int) *TelemetryService {
	if bufferSize < 1 {
		bufferSize = 1
	}
	s := &TelemetryService{
		repo: repo,
		ch:   make(chan models.AiUsageLog, bufferSize),
	}
	go s.worker()
	return s
}

func (s *TelemetryService) worker() {
	for entry := range s.ch {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := s.repo.Create(ctx, &entry); err != nil {
			log.Printf("telemetry: insert failed: %v", err)
		}
		cancel()
	}
}

// Close cierra el canal del worker (útil en tests para drenar sin deadlock).
func (s *TelemetryService) Close() {
	close(s.ch)
}

// LogAsync encola un evento de telemetría sin bloquear al caller.
func (s *TelemetryService) LogAsync(userID uuid.UUID, role, action string) {
	s.enqueue(models.AiUsageLog{
		ID:        uuid.New(),
		UserID:    userID,
		Role:      role,
		Action:    action,
		CreatedAt: time.Now().UTC(),
	})
}

// LogCopilotAsync registra uso del copiloto con intención y modelo para trazabilidad de costos.
func (s *TelemetryService) LogCopilotAsync(userID uuid.UUID, role, intent, model string) {
	s.enqueue(models.AiUsageLog{
		ID:        uuid.New(),
		UserID:    userID,
		Role:      role,
		Action:    models.TelemetryAskCopilot,
		Intent:    intent,
		Model:     model,
		CreatedAt: time.Now().UTC(),
	})
}

func (s *TelemetryService) enqueue(entry models.AiUsageLog) {
	select {
	case s.ch <- entry:
	default:
		go func(e models.AiUsageLog) {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			if err := s.repo.Create(ctx, &e); err != nil {
				log.Printf("telemetry: fallback insert failed: %v", err)
			}
		}(entry)
	}
}

// LogSync persiste de forma síncrona (tests / casos críticos).
func (s *TelemetryService) LogSync(ctx context.Context, userID uuid.UUID, role, action string) error {
	return s.repo.Create(ctx, &models.AiUsageLog{
		ID:        uuid.New(),
		UserID:    userID,
		Role:      role,
		Action:    action,
		CreatedAt: time.Now().UTC(),
	})
}
