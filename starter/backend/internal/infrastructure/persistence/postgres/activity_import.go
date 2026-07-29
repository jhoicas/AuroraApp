package postgres

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/xuri/excelize/v2"
)

const (
	actColListado          = 0
	actColUnidad           = 1
	actColCodigo           = 2
	actColumnCount         = 3
	actMaxCodigoLen        = 50
	actSwallowedFieldBytes = 4000
)

// ActivityImportRow fila válida del catálogo de actividades.
type ActivityImportRow struct {
	SourceRow            int
	CodigoActividad      string
	ListadoDeActividades string
	UnidadDeMedida       string
}

// ActivityImportParseError registro omitido durante el parseo.
type ActivityImportParseError struct {
	Row             int
	CodigoActividad string
	Message         string
}

// ActivityParseResult resultado del parseo CSV/XLSX.
type ActivityParseResult struct {
	Rows      []ActivityImportRow
	Errors    []ActivityImportParseError
	TotalRows int
}

func ParseActivitiesFromXLSX(r io.Reader) (*ActivityParseResult, error) {
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
	return parseActivityRowsFromSlice(rows)
}

func ParseActivitiesFromCSV(r io.Reader) (*ActivityParseResult, error) {
	raw, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read csv bytes: %w", err)
	}
	raw = sanitizeActivityCSVBytes(raw)
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, fmt.Errorf("archivo CSV vacío")
	}

	delim := detectActivityCSVDelimiter(raw)
	reader := csv.NewReader(bytes.NewReader(raw))
	reader.Comma = delim
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	reader.ReuseRecord = false

	result := &ActivityParseResult{
		Rows:   make([]ActivityImportRow, 0, 1024),
		Errors: make([]ActivityImportParseError, 0),
	}

	headerOK := false
	logicalRow := 0
	colListado, colUnidad, colCodigo := actColListado, actColUnidad, actColCodigo

	for {
		rec, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			line := logicalRow + 1
			var pe *csv.ParseError
			if errors.As(err, &pe) {
				if pe.Line > 0 {
					line = pe.Line
				}
				logicalRow = line
				result.Errors = append(result.Errors, ActivityImportParseError{
					Row:     line,
					Message: fmt.Sprintf("Error de parseo CSV (se continúa): %v", pe.Err),
				})
				if !headerOK && line <= 1 {
					return nil, fmt.Errorf("no se pudo leer la cabecera CSV: %w", pe.Err)
				}
				if headerOK {
					result.TotalRows++
				}
				continue
			}
			logicalRow++
			result.Errors = append(result.Errors, ActivityImportParseError{
				Row:     logicalRow,
				Message: fmt.Sprintf("Error de lectura CSV (se continúa): %v", err),
			})
			if headerOK {
				result.TotalRows++
			}
			continue
		}

		logicalRow++
		if !headerOK {
			if isActivityRowEmpty(rec) {
				logicalRow--
				continue
			}
			headers := normalizeActivityHeaders(rec)
			if len(headers) < actColumnCount {
				return nil, fmt.Errorf(
					"cabecera incompleta: se encontraron %d columnas de %d esperadas (lista de actividades)",
					len(headers),
					actColumnCount,
				)
			}
			colListado, colUnidad, colCodigo = mapActivityColumns(headers)
			headerOK = true
			continue
		}

		result.TotalRows++
		if isActivitySwallowedRecord(rec) {
			result.Errors = append(result.Errors, ActivityImportParseError{
				Row:     logicalRow,
				Message: "Fila con contenido anómalo (posible comilla sin cerrar). Se intenta recuperar sub-líneas",
			})
			for _, sub := range recoverActivitySwallowedRecord(rec, delim) {
				result.TotalRows++
				logicalRow++
				appendParsedActivityRow(result, logicalRow, sub, colListado, colUnidad, colCodigo)
			}
			continue
		}
		appendParsedActivityRow(result, logicalRow, rec, colListado, colUnidad, colCodigo)
	}

	if !headerOK {
		return nil, fmt.Errorf("archivo sin cabecera CSV válida")
	}
	if result.TotalRows == 0 && len(result.Rows) == 0 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}
	return result, nil
}

func parseActivityRowsFromSlice(rows [][]string) (*ActivityParseResult, error) {
	if len(rows) < 2 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}
	headers := normalizeActivityHeaders(rows[0])
	if len(headers) < actColumnCount {
		return nil, fmt.Errorf(
			"cabecera incompleta: se encontraron %d columnas de %d esperadas (lista de actividades)",
			len(headers),
			actColumnCount,
		)
	}
	colListado, colUnidad, colCodigo := mapActivityColumns(headers)
	result := &ActivityParseResult{
		Rows:   make([]ActivityImportRow, 0, len(rows)-1),
		Errors: make([]ActivityImportParseError, 0),
	}
	for i, row := range rows[1:] {
		result.TotalRows++
		appendParsedActivityRow(result, i+2, row, colListado, colUnidad, colCodigo)
	}
	return result, nil
}

func mapActivityColumns(headers []string) (colListado, colUnidad, colCodigo int) {
	colListado, colUnidad, colCodigo = actColListado, actColUnidad, actColCodigo
	for i, h := range headers {
		switch {
		case strings.Contains(h, "codigo") && strings.Contains(h, "actividad"):
			colCodigo = i
		case strings.Contains(h, "unidad"):
			colUnidad = i
		case strings.Contains(h, "listado") || (strings.Contains(h, "nombre") && strings.Contains(h, "actividad")):
			colListado = i
		case h == "listado_de_actividades" || h == "descripcion":
			colListado = i
		}
	}
	return colListado, colUnidad, colCodigo
}

func appendParsedActivityRow(
	result *ActivityParseResult,
	rowNum int,
	row []string,
	colListado, colUnidad, colCodigo int,
) {
	if isActivityRowEmpty(row) {
		return
	}
	need := colListado
	if colUnidad > need {
		need = colUnidad
	}
	if colCodigo > need {
		need = colCodigo
	}
	if len(row) <= need {
		result.Errors = append(result.Errors, ActivityImportParseError{
			Row:     rowNum,
			Message: fmt.Sprintf("Fila incompleta: se encontraron %d columnas", len(row)),
		})
		return
	}

	// Códigos: SOLO strings + TrimSpace. Nunca strconv (preserva "000000003").
	codigo := activityPreserveCode(row, colCodigo)
	listado := activityCellAt(row, colListado)
	unidad := activityCellAt(row, colUnidad)

	if codigo == "" && listado == "" && unidad == "" {
		return
	}
	if codigo == "" {
		result.Errors = append(result.Errors, ActivityImportParseError{
			Row:     rowNum,
			Message: "Falta código actividad",
		})
		return
	}
	if len(codigo) > actMaxCodigoLen {
		result.Errors = append(result.Errors, ActivityImportParseError{
			Row:             rowNum,
			CodigoActividad: truncateActivity(codigo, actMaxCodigoLen),
			Message:         "Código actividad demasiado largo",
		})
		return
	}

	result.Rows = append(result.Rows, ActivityImportRow{
		SourceRow:            rowNum,
		CodigoActividad:      codigo,
		ListadoDeActividades: listado,
		UnidadDeMedida:       unidad,
	})
}

func sanitizeActivityCSVBytes(raw []byte) []byte {
	raw = bytes.TrimPrefix(raw, []byte("\xef\xbb\xbf"))
	if !bytes.Contains(raw, []byte{0}) && utf8.Valid(raw) {
		return raw
	}
	out := make([]byte, 0, len(raw))
	for i := 0; i < len(raw); {
		if raw[i] == 0 {
			i++
			continue
		}
		r, size := utf8.DecodeRune(raw[i:])
		if r == utf8.RuneError && size == 1 {
			out = append(out, '?')
			i++
			continue
		}
		out = append(out, raw[i:i+size]...)
		i += size
	}
	return out
}

func detectActivityCSVDelimiter(raw []byte) rune {
	line := raw
	if idx := bytes.IndexByte(raw, '\n'); idx >= 0 {
		line = raw[:idx]
	}
	line = bytes.TrimRight(line, "\r")
	if bytes.Count(line, []byte{';'}) > bytes.Count(line, []byte{','}) {
		return ';'
	}
	return ','
}

func isActivitySwallowedRecord(rec []string) bool {
	if len(rec) == 0 {
		return false
	}
	if len(rec) < actColumnCount {
		for _, cell := range rec {
			if len(cell) >= actSwallowedFieldBytes || strings.Count(cell, "\n") >= 3 {
				return true
			}
		}
	}
	return false
}

func recoverActivitySwallowedRecord(rec []string, delim rune) [][]string {
	blob := strings.Join(rec, "\n")
	lines := strings.Split(blob, "\n")
	out := make([][]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimRight(line, "\r")
		if strings.TrimSpace(line) == "" {
			continue
		}
		r := csv.NewReader(strings.NewReader(line))
		r.Comma = delim
		r.LazyQuotes = true
		r.FieldsPerRecord = -1
		sub, err := r.Read()
		if err != nil || len(sub) == 0 {
			sub = strings.Split(line, string(delim))
		}
		out = append(out, sub)
	}
	return out
}

func isActivityRowEmpty(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(strings.TrimPrefix(cell, "\ufeff")) != "" {
			return false
		}
	}
	return true
}

func truncateActivity(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}

func normalizeActivityHeaders(headers []string) []string {
	out := make([]string, len(headers))
	for i, h := range headers {
		out[i] = normalizeActivityHeader(h)
	}
	return out
}

func normalizeActivityHeader(h string) string {
	h = strings.TrimSpace(h)
	h = strings.TrimPrefix(h, "\ufeff")
	h = strings.ToLower(h)
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
	for strings.Contains(h, "__") {
		h = strings.ReplaceAll(h, "__", "_")
	}
	return strings.Trim(h, "_")
}

func activityCellAt(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(row[idx], "\ufeff"))
}

// activityPreserveCode extrae el código como string literal (sin conversión numérica).
func activityPreserveCode(row []string, idx int) string {
	raw := activityCellAt(row, idx)
	if raw == "" {
		return ""
	}
	raw = strings.TrimPrefix(raw, "'")
	if strings.HasSuffix(raw, ".0") && isActivityAllDigitsDotZero(raw) {
		raw = strings.TrimSuffix(raw, ".0")
	}
	return strings.TrimSpace(raw)
}

func isActivityAllDigitsDotZero(s string) bool {
	if !strings.HasSuffix(s, ".0") {
		return false
	}
	body := s[:len(s)-2]
	if body == "" {
		return false
	}
	for _, r := range body {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
