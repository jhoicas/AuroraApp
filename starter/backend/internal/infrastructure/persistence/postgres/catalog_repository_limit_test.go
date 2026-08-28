package postgres

import "testing"

func TestNormalizeCatalogLimit(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		limit int
		want  int
	}{
		{name: "admin 5", limit: 5, want: 5},
		{name: "admin 10", limit: 10, want: 10},
		{name: "admin 20", limit: 20, want: 20},
		{name: "zero defaults", limit: 0, want: 10},
		{name: "negative defaults", limit: -3, want: 10},
		{name: "tenant full list 100", limit: 100, want: 100},
		{name: "tenant full list 5000", limit: 5000, want: 5000},
		{name: "caps excessive", limit: 99999, want: 5000},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := normalizeCatalogLimit(tt.limit); got != tt.want {
				t.Fatalf("normalizeCatalogLimit(%d) = %d, want %d", tt.limit, got, tt.want)
			}
		})
	}
}
