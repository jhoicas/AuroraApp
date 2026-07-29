package finance_test

import (
	"math"
	"testing"

	"aurora-backend/pkg/finance"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCalculateVPN_TableDriven(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		tasa     float64
		flujos   []float64
		expected float64
		delta    float64
	}{
		{
			name:     "flujo vacío retorna cero",
			tasa:     0.10,
			flujos:   nil,
			expected: 0,
			delta:    1e-12,
		},
		{
			name:     "slice vacío explícito",
			tasa:     0.05,
			flujos:   []float64{},
			expected: 0,
			delta:    1e-12,
		},
		{
			name:     "tasa cero equivale a suma aritmética",
			tasa:     0,
			flujos:   []float64{-1000, 400, 400, 400},
			expected: 200,
			delta:    1e-9,
		},
		{
			name:     "tasa negativa (descuento inverso)",
			tasa:     -0.05,
			flujos:   []float64{-100, 50, 50},
			expected: -100 + 50/0.95 + 50/(0.95*0.95),
			delta:    1e-6,
		},
		{
			name:     "caso clásico VPN negativo ~-5.26",
			tasa:     0.10,
			flujos:   []float64{-1000, 400, 400, 400},
			expected: -5.259,
			delta:    0.01,
		},
		{
			name:     "único flujo periodo 0",
			tasa:     0.12,
			flujos:   []float64{-500},
			expected: -500,
			delta:    1e-12,
		},
		{
			name:     "todos positivos (VPN > 0)",
			tasa:     0.10,
			flujos:   []float64{100, 100, 100},
			expected: 100 + 100/1.1 + 100/(1.1*1.1),
			delta:    1e-6,
		},
		{
			name:     "tasa alta diluye flujos futuros",
			tasa:     1.0, // 100%
			flujos:   []float64{-100, 200},
			expected: -100 + 200/2.0,
			delta:    1e-9,
		},
		{
			name:     "flujos con ceros intermedios",
			tasa:     0.10,
			flujos:   []float64{-1000, 0, 0, 1210},
			expected: -1000 + 1210/math.Pow(1.1, 3),
			delta:    1e-6,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := finance.CalculateVPN(tt.tasa, tt.flujos)
			assert.InDelta(t, tt.expected, got, tt.delta)
		})
	}
}

func TestCalculateTIR_TableDriven(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		flujos      []float64
		wantNaN     bool
		approxTIR   float64
		approxDelta float64
		checkVPN0   bool
	}{
		{
			name:    "menos de 2 flujos → NaN",
			flujos:  []float64{-100},
			wantNaN: true,
		},
		{
			name:    "slice vacío → NaN",
			flujos:  nil,
			wantNaN: true,
		},
		{
			name:    "sin cambio de signo (todos positivos) → NaN",
			flujos:  []float64{100, 100, 100},
			wantNaN: true,
		},
		{
			name:    "sin cambio de signo (todos negativos) → NaN",
			flujos:  []float64{-100, -50, -50},
			wantNaN: true,
		},
		{
			name:        "caso clásico ~9.6%",
			flujos:      []float64{-1000, 400, 400, 400},
			approxTIR:   0.096,
			approxDelta: 0.01,
			checkVPN0:   true,
		},
		{
			name:        "TIR exacta 10% (flujo simple)",
			flujos:      []float64{-100, 110},
			approxTIR:   0.10,
			approxDelta: 1e-6,
			checkVPN0:   true,
		},
		{
			name:        "TIR cero (VPN=0 a tasa 0)",
			flujos:      []float64{-100, 50, 50},
			approxTIR:   0.0,
			approxDelta: 1e-6,
			checkVPN0:   true,
		},
		{
			// Con bisección en [-0.99, 10], si VPN(lo) y VPN(hi) tienen el mismo signo
			// no hay garantía de raíz → NaN (comportamiento documentado del motor).
			name:    "múltiples cambios de signo sin raíz en rango → NaN",
			flujos:  []float64{-100, 230, -132},
			wantNaN: true,
		},
		{
			name:        "flujos con ceros y recuperación final",
			flujos:      []float64{-1000, 0, 0, 1500},
			checkVPN0:   true,
			approxDelta: 0.05,
		},
		{
			name:        "proyecto rentable alta TIR",
			flujos:      []float64{-1000, 1500},
			approxTIR:   0.50,
			approxDelta: 1e-4,
			checkVPN0:   true,
		},
		{
			name:        "inversión recuperada en varios periodos",
			flujos:      []float64{-5000, 1500, 1500, 1500, 1500},
			checkVPN0:   true,
			approxDelta: 0.02,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			tir := finance.CalculateTIR(tt.flujos)

			if tt.wantNaN {
				assert.True(t, math.IsNaN(tir), "esperaba NaN, got %v", tir)
				return
			}

			require.False(t, math.IsNaN(tir), "TIR no debería ser NaN")

			if tt.checkVPN0 {
				vpn := finance.CalculateVPN(tir, tt.flujos)
				assert.InDelta(t, 0, vpn, 1e-4, "VPN(TIR) debería ~0")
			}

			if tt.approxDelta > 0 && tt.approxTIR != 0 {
				assert.InDelta(t, tt.approxTIR, tir, tt.approxDelta)
			}
			if tt.name == "TIR cero (VPN=0 a tasa 0)" {
				assert.InDelta(t, 0.0, tir, 1e-6)
			}
		})
	}
}

func TestCalculateTIR_BisectionConverges(t *testing.T) {
	t.Parallel()
	// Flujo con TIR conocida: -1 + 1.25/(1+r) = 0 ⇒ r = 0.25
	flujos := []float64{-1, 1.25}
	tir := finance.CalculateTIR(flujos)
	require.False(t, math.IsNaN(tir))
	assert.InDelta(t, 0.25, tir, 1e-6)
	assert.InDelta(t, 0, finance.CalculateVPN(tir, flujos), 1e-8)
}

func TestCalculateVPN_IdentityAtTIR(t *testing.T) {
	t.Parallel()
	cases := [][]float64{
		{-2000, 800, 900, 1000},
		{-100, 0, 0, 0, 150},
		{-50, 60},
	}
	for i, flujos := range cases {
		tir := finance.CalculateTIR(flujos)
		if math.IsNaN(tir) {
			continue
		}
		vpn := finance.CalculateVPN(tir, flujos)
		assert.InDelta(t, 0, vpn, 1e-4, "caso %d", i)
	}
}
