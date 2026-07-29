package finance

import "math"

// CalculateVPN calcula el Valor Presente Neto (VPN/NPV) de una serie de flujos de caja.
// flujos[0] corresponde al periodo 0 (inversión inicial, usualmente negativa).
func CalculateVPN(tasa float64, flujos []float64) float64 {
	if len(flujos) == 0 {
		return 0
	}
	var vpn float64
	den := 1.0
	for _, f := range flujos {
		vpn += f / den
		den *= 1 + tasa
	}
	return vpn
}

// CalculateTIR estima la Tasa Interna de Retorno (TIR/IRR) usando bisección.
// Devuelve NaN si no existe una TIR en el rango [-0.99, 10].
func CalculateTIR(flujos []float64) float64 {
	if len(flujos) < 2 {
		return math.NaN()
	}

	lo, hi := -0.99, 10.0
	vLo := CalculateVPN(lo, flujos)
	vHi := CalculateVPN(hi, flujos)

	if math.IsNaN(vLo) || math.IsNaN(vHi) || vLo*vHi > 0 {
		return math.NaN()
	}

	for i := 0; i < 128; i++ {
		mid := (lo + hi) / 2
		vMid := CalculateVPN(mid, flujos)
		if math.Abs(vMid) < 1e-9 {
			return mid
		}
		if vLo*vMid <= 0 {
			hi = mid
			vHi = vMid
		} else {
			lo = mid
			vLo = vMid
		}
	}
	return (lo + hi) / 2
}
