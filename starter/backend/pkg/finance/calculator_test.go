package finance_test

import (
	"math"
	"testing"

	"aurora-backend/pkg/finance"
)

func TestCalculateVPN(t *testing.T) {
	flujos := []float64{-1000, 400, 400, 400}
	vpn := finance.CalculateVPN(0.10, flujos)
	if math.Abs(vpn-(-5.259)) > 0.01 {
		t.Fatalf("VPN esperado ~-5.26, got %.3f", vpn)
	}
}

func TestCalculateTIR(t *testing.T) {
	flujos := []float64{-1000, 400, 400, 400}
	tir := finance.CalculateTIR(flujos)
	if math.IsNaN(tir) {
		t.Fatal("TIR no debería ser NaN")
	}
	if math.Abs(finance.CalculateVPN(tir, flujos)) > 1e-4 {
		t.Fatalf("VPN a TIR debería ser ~0, got VPN=%.6f", finance.CalculateVPN(tir, flujos))
	}
	if math.Abs(tir-0.096) > 0.01 {
		t.Fatalf("TIR esperada ~9.6%%, got %.4f", tir)
	}
}
