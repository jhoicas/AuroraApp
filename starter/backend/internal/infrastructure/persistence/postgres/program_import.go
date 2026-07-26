package postgres

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"strings"
	"unicode"

	"github.com/xuri/excelize/v2"
)

type ProgramImportRow struct {
	CodigoSector      string
	NombreSector      string
	CodigoPrograma    string
	NombrePrograma    string
	AmbitoAplicacion  string
	CodigoSubprograma string
	NombreSubprograma string
	Observaciones     string
}

func ParseProgramsFromXLSX(r io.Reader) ([]ProgramImportRow, error) {
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
	return parseProgramRows(rows)
}

func ParseProgramsFromCSV(r io.Reader) ([]ProgramImportRow, error) {
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
	return parseProgramRows(rows)
}

func parseProgramRows(rows [][]string) ([]ProgramImportRow, error) {
	if len(rows) < 2 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}
	headers := normalizeProgramHeaders(rows[0])
	idx := func(cands ...string) int { return programHeaderIndex(headers, cands...) }

	idxCodSec := idx("codigo_sector", "codigosector", "codigo sector")
	idxNomSec := idx("nombre_sector", "nombresector", "nombre sector", "sector")
	idxCodProg := idx("codigo_programa", "codigoprograma", "codigo programa")
	idxNomProg := idx("nombre_programa", "nombreprograma", "nombre programa", "programa")
	idxAmbito := idx("ambito_aplicacion", "ambitoaplicacion", "ambito aplicacion", "ambito", "aplicacion")
	idxCodSub := idx("codigo_subprograma", "codigosubprograma", "codigo subprograma")
	idxNomSub := idx("nombre_subprograma", "nombresubprograma", "nombre subprograma", "subprograma")
	idxObs := idx("observaciones", "observations", "obs")

	if idxCodSec < 0 || idxCodProg < 0 || idxNomProg < 0 || idxCodSub < 0 || idxNomSub < 0 {
		return nil, fmt.Errorf("cabeceras requeridas: Codigo Sector, Codigo/Nombre Programa, Codigo/Nombre Subprograma")
	}

	out := make([]ProgramImportRow, 0, len(rows)-1)
	for _, row := range rows[1:] {
		item := ProgramImportRow{
			CodigoSector:      programCellAt(row, idxCodSec),
			NombreSector:      programCellAt(row, idxNomSec),
			CodigoPrograma:    programCellAt(row, idxCodProg),
			NombrePrograma:    programCellAt(row, idxNomProg),
			AmbitoAplicacion:  programCellAt(row, idxAmbito),
			CodigoSubprograma: programCellAt(row, idxCodSub),
			NombreSubprograma: programCellAt(row, idxNomSub),
			Observaciones:     programCellAt(row, idxObs),
		}
		if item.CodigoPrograma == "" && item.CodigoSubprograma == "" {
			continue
		}
		out = append(out, item)
	}
	return out, nil
}

func normalizeProgramHeaders(headers []string) []string {
	out := make([]string, len(headers))
	for i, h := range headers {
		out[i] = normalizeProgramHeader(h)
	}
	return out
}

func normalizeProgramHeader(h string) string {
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

func programHeaderIndex(headers []string, candidates ...string) int {
	set := make(map[string]struct{}, len(candidates))
	for _, c := range candidates {
		set[normalizeProgramHeader(c)] = struct{}{}
	}
	for i, h := range headers {
		if _, ok := set[h]; ok {
			return i
		}
	}
	return -1
}

func programCellAt(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}
