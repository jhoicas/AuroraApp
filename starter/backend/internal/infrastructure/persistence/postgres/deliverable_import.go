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
	delivColListado          = 0
	delivColCodigo           = 1
	delivColumnCount         = 2
	delivMaxCodigoLen        = 50
	delivSwallowedFieldBytes = 4000
)

// DeliverableImportRow fila válida del catálogo de entregables.
type DeliverableImportRow struct {
	SourceRow            int
	CodigoEntregable     string
	ListadoDeEntregables string
}

// DeliverableImportParseError registro omitido durante el parseo.
type DeliverableImportParseError struct {
	Row              int
	CodigoEntregable string
	Message          string
}

// DeliverableParseResult resultado del parseo CSV/XLSX.
type DeliverableParseResult struct {
	Rows      []DeliverableImportRow
	Errors    []DeliverableImportParseError
	TotalRows int
}

func ParseDeliverablesFromXLSX(r io.Reader) (*DeliverableParseResult, error) {
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
	return parseDeliverableRowsFromSlice(rows)
}

func ParseDeliverablesFromCSV(r io.Reader) (*DeliverableParseResult, error) {
	raw, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read csv bytes: %w", err)
	}
	raw = sanitizeDeliverableCSVBytes(raw)
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, fmt.Errorf("archivo CSV vacío")
	}

	delim := detectDeliverableCSVDelimiter(raw)
	reader := csv.NewReader(bytes.NewReader(raw))
	reader.Comma = delim
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	reader.ReuseRecord = false

	result := &DeliverableParseResult{
		Rows:   make([]DeliverableImportRow, 0, 1024),
		Errors: make([]DeliverableImportParseError, 0),
	}

	headerOK := false
	logicalRow := 0
	colListado, colCodigo := delivColListado, delivColCodigo

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
				result.Errors = append(result.Errors, DeliverableImportParseError{
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
			result.Errors = append(result.Errors, DeliverableImportParseError{
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
			if isDeliverableRowEmpty(rec) {
				logicalRow--
				continue
			}
			headers := normalizeDeliverableHeaders(rec)
			if len(headers) < delivColumnCount {
				return nil, fmt.Errorf(
					"cabecera incompleta: se encontraron %d columnas de %d esperadas (lista de entregables)",
					len(headers),
					delivColumnCount,
				)
			}
			colListado, colCodigo = mapDeliverableColumns(headers)
			headerOK = true
			continue
		}

		result.TotalRows++
		if isDeliverableSwallowedRecord(rec) {
			result.Errors = append(result.Errors, DeliverableImportParseError{
				Row:     logicalRow,
				Message: "Fila con contenido anómalo (posible comilla sin cerrar). Se intenta recuperar sub-líneas",
			})
			for _, sub := range recoverDeliverableSwallowedRecord(rec, delim) {
				result.TotalRows++
				logicalRow++
				appendParsedDeliverableRow(result, logicalRow, sub, colListado, colCodigo)
			}
			continue
		}
		appendParsedDeliverableRow(result, logicalRow, rec, colListado, colCodigo)
	}

	if !headerOK {
		return nil, fmt.Errorf("archivo sin cabecera CSV válida")
	}
	if result.TotalRows == 0 && len(result.Rows) == 0 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}
	return result, nil
}

func parseDeliverableRowsFromSlice(rows [][]string) (*DeliverableParseResult, error) {
	if len(rows) < 2 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}
	headers := normalizeDeliverableHeaders(rows[0])
	if len(headers) < delivColumnCount {
		return nil, fmt.Errorf(
			"cabecera incompleta: se encontraron %d columnas de %d esperadas (lista de entregables)",
			len(headers),
			delivColumnCount,
		)
	}
	colListado, colCodigo := mapDeliverableColumns(headers)
	result := &DeliverableParseResult{
		Rows:   make([]DeliverableImportRow, 0, len(rows)-1),
		Errors: make([]DeliverableImportParseError, 0),
	}
	for i, row := range rows[1:] {
		result.TotalRows++
		appendParsedDeliverableRow(result, i+2, row, colListado, colCodigo)
	}
	return result, nil
}

func mapDeliverableColumns(headers []string) (colListado, colCodigo int) {
	colListado, colCodigo = delivColListado, delivColCodigo
	for i, h := range headers {
		switch {
		case strings.Contains(h, "codigo") && strings.Contains(h, "entregable"):
			colCodigo = i
		case strings.Contains(h, "listado") || (strings.Contains(h, "nombre") && strings.Contains(h, "entregable")):
			colListado = i
		case h == "listado_de_entregables" || h == "descripcion":
			colListado = i
		}
	}
	return colListado, colCodigo
}

func appendParsedDeliverableRow(result *DeliverableParseResult, rowNum int, row []string, colListado, colCodigo int) {
	if isDeliverableRowEmpty(row) {
		return
	}
	need := colListado
	if colCodigo > need {
		need = colCodigo
	}
	if len(row) <= need {
		result.Errors = append(result.Errors, DeliverableImportParseError{
			Row:     rowNum,
			Message: fmt.Sprintf("Fila incompleta: se encontraron %d columnas", len(row)),
		})
		return
	}

	// Códigos: SOLO strings + TrimSpace. Nunca strconv (preserva "000000004").
	codigo := deliverablePreserveCode(row, colCodigo)
	listado := deliverableCellAt(row, colListado)

	if codigo == "" && listado == "" {
		return
	}
	if codigo == "" {
		result.Errors = append(result.Errors, DeliverableImportParseError{
			Row:     rowNum,
			Message: "Falta código entregable",
		})
		return
	}
	if len(codigo) > delivMaxCodigoLen {
		result.Errors = append(result.Errors, DeliverableImportParseError{
			Row:              rowNum,
			CodigoEntregable: truncateDeliverable(codigo, delivMaxCodigoLen),
			Message:          "Código entregable demasiado largo",
		})
		return
	}

	result.Rows = append(result.Rows, DeliverableImportRow{
		SourceRow:            rowNum,
		CodigoEntregable:     codigo,
		ListadoDeEntregables: listado,
	})
}

func sanitizeDeliverableCSVBytes(raw []byte) []byte {
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

func detectDeliverableCSVDelimiter(raw []byte) rune {
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

func isDeliverableSwallowedRecord(rec []string) bool {
	if len(rec) == 0 {
		return false
	}
	if len(rec) < delivColumnCount {
		for _, cell := range rec {
			if len(cell) >= delivSwallowedFieldBytes || strings.Count(cell, "\n") >= 3 {
				return true
			}
		}
	}
	return false
}

func recoverDeliverableSwallowedRecord(rec []string, delim rune) [][]string {
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

func isDeliverableRowEmpty(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(strings.TrimPrefix(cell, "\ufeff")) != "" {
			return false
		}
	}
	return true
}

func truncateDeliverable(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}

func normalizeDeliverableHeaders(headers []string) []string {
	out := make([]string, len(headers))
	for i, h := range headers {
		out[i] = normalizeDeliverableHeader(h)
	}
	return out
}

func normalizeDeliverableHeader(h string) string {
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

func deliverableCellAt(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(row[idx], "\ufeff"))
}

// deliverablePreserveCode extrae el código como string literal (sin conversión numérica).
func deliverablePreserveCode(row []string, idx int) string {
	raw := deliverableCellAt(row, idx)
	if raw == "" {
		return ""
	}
	raw = strings.TrimPrefix(raw, "'")
	if strings.HasSuffix(raw, ".0") && isDeliverableAllDigitsDotZero(raw) {
		raw = strings.TrimSuffix(raw, ".0")
	}
	return strings.TrimSpace(raw)
}

func isDeliverableAllDigitsDotZero(s string) bool {
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
