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
	odsColCodObjetivo  = 0
	odsColDescObjetivo = 1
	odsColCodigoMeta   = 2
	odsColDescMeta     = 3
	odsColumnCount     = 4
	odsMaxCodigoLen    = 50
	odsSwallowedBytes  = 4000
)

// OdsImportRow fila válida del catálogo ODS.
type OdsImportRow struct {
	SourceRow              int
	CodObjetivoOds         string
	DescripcionObjetivoOds string
	CodigoMetaOds          string
	DescripcionMetaOds     string
}

// OdsImportParseError registro omitido durante el parseo.
type OdsImportParseError struct {
	Row            int
	CodObjetivoOds string
	CodigoMetaOds  string
	Message        string
}

// OdsParseResult resultado del parseo CSV/XLSX.
type OdsParseResult struct {
	Rows      []OdsImportRow
	Errors    []OdsImportParseError
	TotalRows int
}

func ParseOdsFromXLSX(r io.Reader) (*OdsParseResult, error) {
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
	return parseOdsRowsFromSlice(rows)
}

func ParseOdsFromCSV(r io.Reader) (*OdsParseResult, error) {
	raw, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read csv bytes: %w", err)
	}
	raw = sanitizeOdsCSVBytes(raw)
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, fmt.Errorf("archivo CSV vacío")
	}

	delim := detectOdsCSVDelimiter(raw)
	reader := csv.NewReader(bytes.NewReader(raw))
	reader.Comma = delim
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	reader.ReuseRecord = false

	result := &OdsParseResult{
		Rows:   make([]OdsImportRow, 0, 1024),
		Errors: make([]OdsImportParseError, 0),
	}

	headerOK := false
	logicalRow := 0
	cols := [4]int{odsColCodObjetivo, odsColDescObjetivo, odsColCodigoMeta, odsColDescMeta}

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
				result.Errors = append(result.Errors, OdsImportParseError{
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
			result.Errors = append(result.Errors, OdsImportParseError{
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
			if isOdsRowEmpty(rec) {
				logicalRow--
				continue
			}
			headers := normalizeOdsHeaders(rec)
			if len(headers) < odsColumnCount {
				return nil, fmt.Errorf(
					"cabecera incompleta: se encontraron %d columnas de %d esperadas (catálogo ODS)",
					len(headers),
					odsColumnCount,
				)
			}
			cols = mapOdsColumns(headers)
			headerOK = true
			continue
		}

		result.TotalRows++
		if isOdsSwallowedRecord(rec) {
			result.Errors = append(result.Errors, OdsImportParseError{
				Row:     logicalRow,
				Message: "Fila con contenido anómalo (posible comilla sin cerrar). Se intenta recuperar sub-líneas",
			})
			for _, sub := range recoverOdsSwallowedRecord(rec, delim) {
				result.TotalRows++
				logicalRow++
				appendParsedOdsRow(result, logicalRow, sub, cols)
			}
			continue
		}
		appendParsedOdsRow(result, logicalRow, rec, cols)
	}

	if !headerOK {
		return nil, fmt.Errorf("archivo sin cabecera CSV válida")
	}
	if result.TotalRows == 0 && len(result.Rows) == 0 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}
	return result, nil
}

func parseOdsRowsFromSlice(rows [][]string) (*OdsParseResult, error) {
	if len(rows) < 2 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}
	headers := normalizeOdsHeaders(rows[0])
	if len(headers) < odsColumnCount {
		return nil, fmt.Errorf(
			"cabecera incompleta: se encontraron %d columnas de %d esperadas (catálogo ODS)",
			len(headers),
			odsColumnCount,
		)
	}
	cols := mapOdsColumns(headers)
	result := &OdsParseResult{
		Rows:   make([]OdsImportRow, 0, len(rows)-1),
		Errors: make([]OdsImportParseError, 0),
	}
	for i, row := range rows[1:] {
		result.TotalRows++
		appendParsedOdsRow(result, i+2, row, cols)
	}
	return result, nil
}

func mapOdsColumns(headers []string) [4]int {
	cols := [4]int{odsColCodObjetivo, odsColDescObjetivo, odsColCodigoMeta, odsColDescMeta}
	for i, h := range headers {
		switch {
		case strings.Contains(h, "cod") && strings.Contains(h, "obj") && !strings.Contains(h, "meta"):
			cols[0] = i
		case (strings.Contains(h, "desc") || strings.Contains(h, "descripcion")) &&
			strings.Contains(h, "obj") && !strings.Contains(h, "meta"):
			cols[1] = i
		case strings.Contains(h, "meta") && (strings.Contains(h, "cod") || strings.Contains(h, "codigo")):
			cols[2] = i
		case strings.Contains(h, "meta") && (strings.Contains(h, "desc") || strings.Contains(h, "descripcion")):
			cols[3] = i
		}
	}
	return cols
}

func appendParsedOdsRow(result *OdsParseResult, rowNum int, row []string, cols [4]int) {
	if isOdsRowEmpty(row) {
		return
	}
	need := cols[0]
	for _, c := range cols[1:] {
		if c > need {
			need = c
		}
	}
	if len(row) <= need {
		result.Errors = append(result.Errors, OdsImportParseError{
			Row:     rowNum,
			Message: fmt.Sprintf("Fila incompleta: se encontraron %d columnas", len(row)),
		})
		return
	}

	// Códigos: SOLO strings + TrimSpace. Nunca strconv (preserva "1.10" ≠ "1.1").
	codObj := odsPreserveCode(row, cols[0])
	descObj := odsCellAt(row, cols[1])
	codMeta := odsPreserveCode(row, cols[2])
	descMeta := odsCellAt(row, cols[3])

	if codObj == "" && descObj == "" && codMeta == "" && descMeta == "" {
		return
	}
	if codObj == "" {
		result.Errors = append(result.Errors, OdsImportParseError{
			Row:     rowNum,
			Message: "Falta código de objetivo ODS",
		})
		return
	}
	if codMeta == "" {
		result.Errors = append(result.Errors, OdsImportParseError{
			Row:            rowNum,
			CodObjetivoOds: codObj,
			Message:        "Falta código de meta ODS",
		})
		return
	}
	if len(codObj) > odsMaxCodigoLen || len(codMeta) > odsMaxCodigoLen {
		result.Errors = append(result.Errors, OdsImportParseError{
			Row:            rowNum,
			CodObjetivoOds: truncateOds(codObj, odsMaxCodigoLen),
			CodigoMetaOds:  truncateOds(codMeta, odsMaxCodigoLen),
			Message:        "Código ODS demasiado largo",
		})
		return
	}

	result.Rows = append(result.Rows, OdsImportRow{
		SourceRow:              rowNum,
		CodObjetivoOds:         codObj,
		DescripcionObjetivoOds: descObj,
		CodigoMetaOds:          codMeta,
		DescripcionMetaOds:     descMeta,
	})
}

func sanitizeOdsCSVBytes(raw []byte) []byte {
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

func detectOdsCSVDelimiter(raw []byte) rune {
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

func isOdsSwallowedRecord(rec []string) bool {
	if len(rec) == 0 {
		return false
	}
	if len(rec) < odsColumnCount {
		for _, cell := range rec {
			if len(cell) >= odsSwallowedBytes || strings.Count(cell, "\n") >= 3 {
				return true
			}
		}
	}
	return false
}

func recoverOdsSwallowedRecord(rec []string, delim rune) [][]string {
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

func isOdsRowEmpty(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(strings.TrimPrefix(cell, "\ufeff")) != "" {
			return false
		}
	}
	return true
}

func truncateOds(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}

func normalizeOdsHeaders(headers []string) []string {
	out := make([]string, len(headers))
	for i, h := range headers {
		out[i] = normalizeOdsHeader(h)
	}
	return out
}

func normalizeOdsHeader(h string) string {
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

func odsCellAt(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(row[idx], "\ufeff"))
}

// odsPreserveCode extrae códigos ODS como string literal (sin conversión numérica).
func odsPreserveCode(row []string, idx int) string {
	raw := odsCellAt(row, idx)
	if raw == "" {
		return ""
	}
	raw = strings.TrimPrefix(raw, "'")
	// No tocar valores con punto (1.10) ni letras (1.a); solo strip ".0" numérico puro.
	if strings.HasSuffix(raw, ".0") && isOdsAllDigitsDotZero(raw) {
		raw = strings.TrimSuffix(raw, ".0")
	}
	return strings.TrimSpace(raw)
}

func isOdsAllDigitsDotZero(s string) bool {
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
