package postgres

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"strings"
	"unicode"

	"aurora-backend/internal/domain/models"

	"github.com/xuri/excelize/v2"
)

type SectorImportRow struct {
	Code         string
	Name         string
	Application  string
	Observations string
}

func ParseSectorsFromXLSX(r io.Reader) ([]SectorImportRow, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return nil, fmt.Errorf("open xlsx: %w", err)
	}
	defer func() { _ = f.Close() }()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("xlsx sin hojas")
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("read sheet: %w", err)
	}
	return parseSectorRows(rows)
}

func ParseSectorsFromCSV(r io.Reader) ([]SectorImportRow, error) {
	raw, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read csv bytes: %w", err)
	}

	parseWith := func(comma rune) ([][]string, error) {
		reader := csv.NewReader(bytes.NewReader(raw))
		reader.Comma = comma
		reader.LazyQuotes = true
		reader.TrimLeadingSpace = true
		reader.FieldsPerRecord = -1
		return reader.ReadAll()
	}

	rows, err := parseWith(';')
	if err != nil || len(rows) == 0 || (len(rows) > 0 && len(rows[0]) < 2) {
		rows, err = parseWith(',')
	}
	if err != nil {
		return nil, fmt.Errorf("read csv: %w", err)
	}
	return parseSectorRows(rows)
}

func parseSectorRows(rows [][]string) ([]SectorImportRow, error) {
	if len(rows) < 2 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}

	headers := normalizeSectorHeaders(rows[0])
	idxCode := sectorHeaderIndex(headers, "codigo", "code", "cod", "codigo_sector")
	idxName := sectorHeaderIndex(headers, "nombre", "name", "nombre_sector", "sector")
	idxApp := sectorHeaderIndex(headers, "aplicacion", "application")
	idxObs := sectorHeaderIndex(headers, "observaciones", "observations", "obs")

	if idxCode < 0 || idxName < 0 {
		return nil, fmt.Errorf("cabeceras requeridas no encontradas: Codigo y Nombre")
	}

	out := make([]SectorImportRow, 0, len(rows)-1)
	for _, row := range rows[1:] {
		code := sectorCellAt(row, idxCode)
		name := sectorCellAt(row, idxName)
		if code == "" && name == "" {
			continue
		}
		out = append(out, SectorImportRow{
			Code:         code,
			Name:         name,
			Application:  sectorCellAt(row, idxApp),
			Observations: sectorCellAt(row, idxObs),
		})
	}
	return out, nil
}

func (r SectorImportRow) ToModel() models.Sector {
	return models.Sector{
		Code:         strings.TrimSpace(r.Code),
		Name:         strings.TrimSpace(r.Name),
		Application:  strings.TrimSpace(r.Application),
		Observations: strings.TrimSpace(r.Observations),
	}
}

func normalizeSectorHeaders(headers []string) []string {
	out := make([]string, len(headers))
	for i, h := range headers {
		out[i] = normalizeSectorHeader(h)
	}
	return out
}

func normalizeSectorHeader(h string) string {
	h = strings.TrimSpace(strings.ToLower(h))
	h = strings.Map(func(r rune) rune {
		switch r {
		case 'á', 'à', 'ä', 'â':
			return 'a'
		case 'é', 'è', 'ë', 'ê':
			return 'e'
		case 'í', 'ì', 'ï', 'î':
			return 'i'
		case 'ó', 'ò', 'ö', 'ô':
			return 'o'
		case 'ú', 'ù', 'ü', 'û':
			return 'u'
		case 'ñ':
			return 'n'
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' {
			return r
		}
		if r == ' ' || r == '-' {
			return '_'
		}
		return -1
	}, h)
	return h
}

func sectorHeaderIndex(headers []string, candidates ...string) int {
	set := make(map[string]struct{}, len(candidates))
	for _, c := range candidates {
		set[normalizeSectorHeader(c)] = struct{}{}
	}
	for i, h := range headers {
		if _, ok := set[h]; ok {
			return i
		}
	}
	return -1
}

func sectorCellAt(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}
