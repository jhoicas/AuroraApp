package dto

import "aurora-backend/internal/domain/models"

type ProducedGoodRequest struct {
	Description string  `json:"description" validate:"required,min=1,max=1000"`
	Rpc         float64 `json:"rpc" validate:"gte=0"`
}

type PaginatedProducedGoodsResponse struct {
	Data []models.ProducedGood `json:"data"`
	Meta PaginationMeta        `json:"meta"`
}
