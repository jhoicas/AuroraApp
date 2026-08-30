package project

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"aurora-backend/internal/domain/models"
)

// ErrProductNotFound indica que no existe un producto con el código indicado en catalogo_productos.
var ErrProductNotFound = errors.New("catalog product not found")

// CatalogProductQuerier consulta filas del catálogo DNP por código de producto.
type CatalogProductQuerier interface {
	ListByProductCode(ctx context.Context, productCode string) ([]models.CatalogProduct, error)
}

// TipologiaService resuelve la tipología PIIP y si el producto exige EDT.
type TipologiaService struct {
	catalog CatalogProductQuerier
}

func NewTipologiaService(catalog CatalogProductQuerier) *TipologiaService {
	return &TipologiaService{catalog: catalog}
}

// ResolveTipologia consulta catalogo_productos por codigo_producto.
// Si tiene_edt o tipologia_a_piip es verdadero en alguna fila, retorna tipología "A" y requiresEdt=true.
func (s *TipologiaService) ResolveTipologia(
	ctx context.Context,
	productCode string,
) (tipologia string, requiresEdt bool, err error) {
	code := strings.TrimSpace(productCode)
	if code == "" {
		return "", false, fmt.Errorf("product code is required")
	}

	products, err := s.catalog.ListByProductCode(ctx, code)
	if err != nil {
		return "", false, err
	}
	if len(products) == 0 {
		return "", false, ErrProductNotFound
	}

	for _, p := range products {
		if p.TieneEDT || p.TipologiaAPIIP {
			return "A", true, nil
		}
	}

	return resolveNonEdtTipologia(products), false, nil
}

func resolveNonEdtTipologia(products []models.CatalogProduct) string {
	for _, p := range products {
		switch {
		case p.TipologiaBPIIP:
			return "B"
		case p.TipologiaCPIIP:
			return "C"
		case p.TipologiaD:
			return "D"
		case p.TipologiaE:
			return "E"
		}
	}

	for _, p := range products {
		if t := strings.TrimSpace(p.TipologiaGeneralSUIFP); t != "" {
			return strings.ToUpper(t[:1])
		}
	}

	return ""
}
