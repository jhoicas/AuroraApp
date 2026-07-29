package services

import (
	"context"
	"log"
	"time"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TelemetryService registra uso de IA de forma asíncrona (no bloquea requests HTTP).
type TelemetryService struct {
	db *gorm.DB
	ch chan models.AiUsageLog
}

func NewTelemetryService(db *gorm.DB) *TelemetryService {
	s := &TelemetryService{
		db: db,
		ch: make(chan models.AiUsageLog, 256),
	}
	go s.worker()
	return s
}

func (s *TelemetryService) worker() {
	for entry := range s.ch {
		if err := s.db.Create(&entry).Error; err != nil {
			log.Printf("telemetry: insert failed: %v", err)
		}
	}
}

// LogAsync encola un evento de telemetría sin bloquear al caller.
func (s *TelemetryService) LogAsync(userID uuid.UUID, role, action string) {
	entry := models.AiUsageLog{
		ID:        uuid.New(),
		UserID:    userID,
		Role:      role,
		Action:    action,
		CreatedAt: time.Now().UTC(),
	}
	select {
	case s.ch <- entry:
	default:
		go func(e models.AiUsageLog) {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			if err := s.db.WithContext(ctx).Create(&e).Error; err != nil {
				log.Printf("telemetry: fallback insert failed: %v", err)
			}
		}(entry)
	}
}

// LogSync persiste de forma síncrona (tests / casos críticos).
func (s *TelemetryService) LogSync(ctx context.Context, userID uuid.UUID, role, action string) error {
	return s.db.WithContext(ctx).Create(&models.AiUsageLog{
		ID:        uuid.New(),
		UserID:    userID,
		Role:      role,
		Action:    action,
		CreatedAt: time.Now().UTC(),
	}).Error
}
