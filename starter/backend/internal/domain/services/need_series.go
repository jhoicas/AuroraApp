package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"aurora-backend/internal/domain/models"
)

const (
	NeedMinYear = 1900
	NeedMaxYear = 2100
	// NeedMaxSpan máximo de años (filas) de la serie anual de una necesidad.
	NeedMaxSpan = 100
)

// ErrNeedYearNotInSeries el año pedido no existe en la serie de la necesidad.
var ErrNeedYearNotInSeries = errors.New("year not in need series")

// ComputeNeedDeficit déficit = demanda - oferta, redondeado a 4 decimales.
func ComputeNeedDeficit(oferta, demanda float64) float64 {
	return math.Round((demanda-oferta)*10000) / 10000
}

// ValidateNeedYears valida la serie histórica: inicial <= final <= último proyectado.
func ValidateNeedYears(inicial, final, ultimo int) error {
	switch {
	case inicial < NeedMinYear || ultimo > NeedMaxYear:
		return fmt.Errorf("los años deben estar entre %d y %d", NeedMinYear, NeedMaxYear)
	case inicial > final:
		return errors.New("anio_inicial no puede ser mayor a anio_final")
	case ultimo < final:
		return errors.New("ultimo_anio_proyectado debe ser mayor o igual a anio_final")
	case ultimo-inicial+1 > NeedMaxSpan:
		return fmt.Errorf("la serie no puede superar %d años", NeedMaxSpan)
	}
	return nil
}

// ResizeNeedSeries devuelve una fila por año entre inicial y ultimo (inclusive).
// Conserva oferta/demanda de los años ya existentes, descarta los que quedan fuera
// del rango, rellena con 0 los nuevos y recalcula el déficit de todas las filas.
func ResizeNeedSeries(inicial, ultimo int, current []models.NeedAnnualValue) []models.NeedAnnualValue {
	byYear := make(map[int]models.NeedAnnualValue, len(current))
	for _, v := range current {
		byYear[v.Anio] = v
	}

	if ultimo < inicial {
		return []models.NeedAnnualValue{}
	}
	series := make([]models.NeedAnnualValue, 0, ultimo-inicial+1)
	for y := inicial; y <= ultimo; y++ {
		v := byYear[y]
		v.Anio = y
		v.Deficit = ComputeNeedDeficit(v.Oferta, v.Demanda)
		series = append(series, v)
	}
	return series
}

// NormalizeNeedSeries valida una serie enviada por el cliente (años dentro del rango,
// sin duplicados, valores no negativos) y la completa/ordena con ResizeNeedSeries.
// El déficit enviado por el cliente se ignora.
func NormalizeNeedSeries(inicial, ultimo int, incoming []models.NeedAnnualValue) ([]models.NeedAnnualValue, error) {
	seen := make(map[int]struct{}, len(incoming))
	for _, v := range incoming {
		if v.Anio < inicial || v.Anio > ultimo {
			return nil, fmt.Errorf("el año %d está fuera del rango %d-%d", v.Anio, inicial, ultimo)
		}
		if _, dup := seen[v.Anio]; dup {
			return nil, fmt.Errorf("el año %d está duplicado", v.Anio)
		}
		seen[v.Anio] = struct{}{}
		if v.Oferta < 0 || v.Demanda < 0 {
			return nil, fmt.Errorf("oferta y demanda del año %d no pueden ser negativas", v.Anio)
		}
	}
	return ResizeNeedSeries(inicial, ultimo, incoming), nil
}

// SetNeedAnnualValue actualiza oferta/demanda de un año y recalcula su déficit.
func SetNeedAnnualValue(series []models.NeedAnnualValue, anio int, oferta, demanda float64) ([]models.NeedAnnualValue, error) {
	for i := range series {
		if series[i].Anio == anio {
			series[i].Oferta = oferta
			series[i].Demanda = demanda
			series[i].Deficit = ComputeNeedDeficit(oferta, demanda)
			return series, nil
		}
	}
	return nil, ErrNeedYearNotInSeries
}

// ParseNeedSeries decodifica el JSONB valores_anuales. Vacío equivale a serie vacía.
func ParseNeedSeries(raw string) ([]models.NeedAnnualValue, error) {
	if strings.TrimSpace(raw) == "" {
		return []models.NeedAnnualValue{}, nil
	}
	var series []models.NeedAnnualValue
	if err := json.Unmarshal([]byte(raw), &series); err != nil {
		return nil, fmt.Errorf("valores_anuales inválido: %w", err)
	}
	if series == nil {
		series = []models.NeedAnnualValue{}
	}
	return series, nil
}

// MarshalNeedSeries codifica la serie para la columna JSONB valores_anuales.
func MarshalNeedSeries(series []models.NeedAnnualValue) (string, error) {
	if series == nil {
		return "[]", nil
	}
	b, err := json.Marshal(series)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
