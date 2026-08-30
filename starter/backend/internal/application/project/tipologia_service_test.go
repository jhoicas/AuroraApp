package project_test

import (
	"context"
	"errors"
	"testing"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"
)

type stubCatalogQuerier struct {
	products []models.CatalogProduct
	err      error
}

func (s *stubCatalogQuerier) ListByProductCode(_ context.Context, _ string) ([]models.CatalogProduct, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.products, nil
}

func TestTipologiaService_ResolveTipologia_TipologiaA_TieneEDT(t *testing.T) {
	svc := appproject.NewTipologiaService(&stubCatalogQuerier{
		products: []models.CatalogProduct{{
			CodigoProducto: "P-001",
			TieneEDT:       true,
		}},
	})

	tipologia, requiresEdt, err := svc.ResolveTipologia(context.Background(), "P-001")
	if err != nil {
		t.Fatal(err)
	}
	if tipologia != "A" || !requiresEdt {
		t.Fatalf("expected A/true, got %q/%v", tipologia, requiresEdt)
	}
}

func TestTipologiaService_ResolveTipologia_TipologiaA_FlagPIIP(t *testing.T) {
	svc := appproject.NewTipologiaService(&stubCatalogQuerier{
		products: []models.CatalogProduct{{
			CodigoProducto: "P-002",
			TipologiaAPIIP: true,
		}},
	})

	tipologia, requiresEdt, err := svc.ResolveTipologia(context.Background(), "P-002")
	if err != nil {
		t.Fatal(err)
	}
	if tipologia != "A" || !requiresEdt {
		t.Fatalf("expected A/true, got %q/%v", tipologia, requiresEdt)
	}
}

func TestTipologiaService_ResolveTipologia_NotFound(t *testing.T) {
	svc := appproject.NewTipologiaService(&stubCatalogQuerier{products: nil})

	_, _, err := svc.ResolveTipologia(context.Background(), "MISSING")
	if !errors.Is(err, appproject.ErrProductNotFound) {
		t.Fatalf("expected ErrProductNotFound, got %v", err)
	}
}

func TestTipologiaService_ResolveTipologia_TipologiaB(t *testing.T) {
	svc := appproject.NewTipologiaService(&stubCatalogQuerier{
		products: []models.CatalogProduct{{
			CodigoProducto: "P-003",
			TipologiaBPIIP: true,
		}},
	})

	tipologia, requiresEdt, err := svc.ResolveTipologia(context.Background(), "P-003")
	if err != nil {
		t.Fatal(err)
	}
	if tipologia != "B" || requiresEdt {
		t.Fatalf("expected B/false, got %q/%v", tipologia, requiresEdt)
	}
}
