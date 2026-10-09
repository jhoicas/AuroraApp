package postgres

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

//go:embed seeds/produced_goods.json
var producedGoodsSeedJSON []byte

type producedGoodSeedRow struct {
	Description string  `json:"Description"`
	Rpc         float64 `json:"Rpc"`
}

func parseProducedGoodsSeed(raw []byte) ([]models.ProducedGood, error) {
	var rows []producedGoodSeedRow
	if err := json.Unmarshal(raw, &rows); err != nil {
		return nil, fmt.Errorf("parse produced goods seed: %w", err)
	}
	now := time.Now().UTC()
	goods := make([]models.ProducedGood, 0, len(rows))
	for _, row := range rows {
		desc := strings.Join(strings.Fields(row.Description), " ")
		if desc == "" {
			continue
		}
		goods = append(goods, models.ProducedGood{Description: desc, Rpc: row.Rpc, CreatedAt: now, UpdatedAt: now})
	}
	return goods, nil
}

// EnsureProducedGoodsSeed puebla el catálogo de bienes producidos (RPC) solo si la tabla está vacía,
// para no pisar los cambios hechos por el SUPER_ADMIN.
func EnsureProducedGoodsSeed(db *gorm.DB) error {
	var count int64
	if err := db.Model(&models.ProducedGood{}).Count(&count).Error; err != nil {
		return fmt.Errorf("count produced goods: %w", err)
	}
	if count > 0 {
		return nil
	}
	goods, err := parseProducedGoodsSeed(producedGoodsSeedJSON)
	if err != nil {
		return err
	}
	return db.CreateInBatches(&goods, 100).Error
}
