package services

import (
	"errors"
	"testing"

	"aurora-backend/internal/domain/models"
)

func TestValidateNeedYears(t *testing.T) {
	cases := []struct {
		name                   string
		inicial, final, ultimo int
		wantErr                bool
	}{
		{"ok", 2020, 2022, 2025, false},
		{"un solo año", 2020, 2020, 2020, false},
		{"inicial mayor a final", 2023, 2022, 2025, true},
		{"ultimo menor a final", 2020, 2022, 2021, true},
		{"fuera de rango", 1800, 2022, 2025, true},
		{"serie demasiado larga", 1950, 2000, 2100, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateNeedYears(tc.inicial, tc.final, tc.ultimo)
			if (err != nil) != tc.wantErr {
				t.Fatalf("err=%v wantErr=%v", err, tc.wantErr)
			}
		})
	}
}

func TestResizeNeedSeries_GeneraFilasYCalculaDeficit(t *testing.T) {
	series := ResizeNeedSeries(2020, 2025, nil)
	if len(series) != 6 {
		t.Fatalf("len=%d want 6", len(series))
	}
	if series[0].Anio != 2020 || series[5].Anio != 2025 {
		t.Fatalf("rango incorrecto: %+v", series)
	}
}

func TestResizeNeedSeries_ConservaValoresYDescartaFuera(t *testing.T) {
	current := []models.NeedAnnualValue{
		{Anio: 2020, Oferta: 150, Demanda: 15000},
		{Anio: 2021, Oferta: 10, Demanda: 20},
		{Anio: 2030, Oferta: 1, Demanda: 1},
	}
	series := ResizeNeedSeries(2020, 2022, current)
	if len(series) != 3 {
		t.Fatalf("len=%d want 3", len(series))
	}
	if series[0].Deficit != 14850 {
		t.Fatalf("deficit 2020=%v want 14850", series[0].Deficit)
	}
	if series[1].Deficit != 10 {
		t.Fatalf("deficit 2021=%v want 10", series[1].Deficit)
	}
	if series[2].Oferta != 0 || series[2].Demanda != 0 || series[2].Deficit != 0 {
		t.Fatalf("año nuevo debe ir en cero: %+v", series[2])
	}
}

func TestNormalizeNeedSeries_IgnoraDeficitDelCliente(t *testing.T) {
	series, err := NormalizeNeedSeries(2020, 2021, []models.NeedAnnualValue{
		{Anio: 2021, Oferta: 5, Demanda: 8, Deficit: 999},
	})
	if err != nil {
		t.Fatal(err)
	}
	if series[1].Deficit != 3 {
		t.Fatalf("deficit=%v want 3", series[1].Deficit)
	}
}

func TestNormalizeNeedSeries_Errores(t *testing.T) {
	cases := map[string][]models.NeedAnnualValue{
		"fuera de rango": {{Anio: 2030}},
		"duplicado":      {{Anio: 2020}, {Anio: 2020}},
		"negativo":       {{Anio: 2020, Oferta: -1}},
	}
	for name, in := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := NormalizeNeedSeries(2020, 2021, in); err == nil {
				t.Fatal("se esperaba error")
			}
		})
	}
}

func TestSetNeedAnnualValue(t *testing.T) {
	series := ResizeNeedSeries(2020, 2021, nil)

	updated, err := SetNeedAnnualValue(series, 2021, 100, 40)
	if err != nil {
		t.Fatal(err)
	}
	if updated[1].Deficit != -60 {
		t.Fatalf("deficit=%v want -60", updated[1].Deficit)
	}

	if _, err := SetNeedAnnualValue(series, 1999, 1, 1); !errors.Is(err, ErrNeedYearNotInSeries) {
		t.Fatalf("err=%v want ErrNeedYearNotInSeries", err)
	}
}

func TestParseMarshalNeedSeries_RoundTrip(t *testing.T) {
	raw, err := MarshalNeedSeries([]models.NeedAnnualValue{{Anio: 2020, Oferta: 150, Demanda: 15000, Deficit: 14850}})
	if err != nil {
		t.Fatal(err)
	}
	got, err := ParseNeedSeries(raw)
	if err != nil || len(got) != 1 || got[0].Deficit != 14850 {
		t.Fatalf("got=%+v err=%v", got, err)
	}

	empty, err := ParseNeedSeries("")
	if err != nil || len(empty) != 0 {
		t.Fatalf("vacío: got=%+v err=%v", empty, err)
	}
	if _, err := ParseNeedSeries("{no json"); err == nil {
		t.Fatal("se esperaba error con JSON inválido")
	}
}
