package postgres

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/xuri/excelize/v2"
)

// Índices fijos de la matriz MGA de 24 columnas (0-based).
const (
	mgaColSector           = 0
	mgaColNombreSector     = 1
	mgaColCodigoPrograma   = 2
	mgaColNombrePrograma   = 3
	mgaColCodigoProducto   = 4
	mgaColProducto         = 5
	mgaColDescripcion      = 6
	mgaColMedidoATravesDe  = 7
	mgaColCodigoIndicador  = 8
	mgaColIndicador        = 9
	mgaColUnidadMedida     = 10
	mgaColIndicadorPrin    = 11
	mgaColEsNacional       = 12
	mgaColEsTerritorial    = 13
	mgaColODS              = 14
	mgaColMetaODS          = 15
	mgaColTipologiaGeneral = 16
	mgaColTipologiaD       = 17
	mgaColTipologiaE       = 18
	mgaColTipologiaA       = 19
	mgaColTipologiaB       = 20
	mgaColTipologiaC       = 21
	mgaColTieneEDT         = 22
	mgaColEDT              = 23
	mgaProductColumnCount  = 24

	// Códigos DNP de programa/sector (cortos).
	mgaMaxProgramaCodigoLen = 15
	// Código de producto: alinea con varchar(50) del modelo.
	mgaMaxProductoCodigoLen = 50
	// Umbral para detectar una fila "engullida" por comillas rotas.
	mgaSwallowedFieldBytes = 8000
)

// ProductImportRow fila válida del catálogo lista para upsert.
type ProductImportRow struct {
	SourceRow               int // número de fila en el archivo (1 = cabecera)
	Sector                  string
	NombreSector            string
	CodigoPrograma          string
	NombrePrograma          string
	CodigoProducto          string
	Producto                string
	Descripcion             string
	MedidoATravesDe         string
	CodigoIndicadorProducto string
	IndicadorProducto       string
	UnidadDeMedida          string
	IndicadorPrincipal      bool
	EsNacional              bool
	EsTerritorial           bool
	ODS                     string
	MetaODS                 string
	TipologiaGeneralSUIFP   string
	TipologiaD              bool
	TipologiaE              bool
	TipologiaAPIIP          bool
	TipologiaBPIIP          bool
	TipologiaCPIIP          bool
	TieneEDT                bool
	EDT                     string
}

// ProductImportParseError registro omitido durante el parseo (fila incompleta / columnas desplazadas).
type ProductImportParseError struct {
	Row            int
	CodigoProducto string
	Message        string
}

// ProductParseResult resultado del parseo CSV/XLSX con filas válidas y bad records.
type ProductParseResult struct {
	Rows      []ProductImportRow
	Errors    []ProductImportParseError
	TotalRows int // filas de datos evaluadas (sin cabecera), incluyendo omitidas
}

func ParseProductsFromXLSX(r io.Reader) (*ProductParseResult, error) {
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
	return parseProductRowsFromSlice(rows)
}

// ParseProductsFromCSV lee el CSV en streaming (NO usa ReadAll).
// Errores de parseo por fila se registran y el bucle continúa hasta EOF real.
func ParseProductsFromCSV(r io.Reader) (*ProductParseResult, error) {
	raw, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read csv bytes: %w", err)
	}
	raw = sanitizeCSVBytes(raw)
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, fmt.Errorf("archivo CSV vacío")
	}

	delim := detectCSVDelimiter(raw)
	reader := csv.NewReader(bytes.NewReader(raw))
	reader.Comma = delim
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1 // filas irregulares no abortan el lector
	reader.ReuseRecord = false

	result := &ProductParseResult{
		Rows:   make([]ProductImportRow, 0, 1024),
		Errors: make([]ProductImportParseError, 0),
	}

	headerOK := false
	logicalRow := 0 // cuenta registros CSV leídos (1 = cabecera)

	for {
		rec, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			// Nunca abortar el archivo completo: registrar y continuar.
			line := logicalRow + 1
			var pe *csv.ParseError
			if errors.As(err, &pe) {
				if pe.Line > 0 {
					line = pe.Line
				}
				logicalRow = line
				result.Errors = append(result.Errors, ProductImportParseError{
					Row:     line,
					Message: fmt.Sprintf("Error de parseo CSV (se continúa con las siguientes filas): %v", pe.Err),
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
			result.Errors = append(result.Errors, ProductImportParseError{
				Row:     logicalRow,
				Message: fmt.Sprintf("Error de lectura CSV (se continúa): %v", err),
			})
			if headerOK {
				result.TotalRows++
			}
			continue
		}

		logicalRow++

		// Cabecera
		if !headerOK {
			if isProductRowEmpty(rec) {
				logicalRow-- // no contar líneas vacías iniciales
				continue
			}
			headers := normalizeProductHeaders(rec)
			if len(headers) < mgaProductColumnCount {
				return nil, fmt.Errorf(
					"cabecera incompleta: se encontraron %d columnas de %d esperadas (matriz MGA)",
					len(headers),
					mgaProductColumnCount,
				)
			}
			headerOK = true
			continue
		}

		result.TotalRows++

		// Comillas rotas pueden “engullir” miles de líneas en un solo campo.
		if isSwallowedCSVRecord(rec) {
			result.Errors = append(result.Errors, ProductImportParseError{
				Row: logicalRow,
				Message: fmt.Sprintf(
					"Fila con contenido anómalo (posible comilla sin cerrar). Se intenta recuperar %d sub-líneas",
					strings.Count(joinedRecord(rec), "\n")+1,
				),
			})
			for _, sub := range recoverSwallowedCSVRecord(rec, delim) {
				result.TotalRows++
				logicalRow++
				appendParsedProductRow(result, logicalRow, sub)
			}
			continue
		}

		appendParsedProductRow(result, logicalRow, rec)
	}

	if !headerOK {
		return nil, fmt.Errorf("archivo sin cabecera CSV válida")
	}
	if result.TotalRows == 0 && len(result.Rows) == 0 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}
	return result, nil
}

func parseProductRowsFromSlice(rows [][]string) (*ProductParseResult, error) {
	if len(rows) < 2 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}
	headers := normalizeProductHeaders(rows[0])
	if len(headers) < mgaProductColumnCount {
		return nil, fmt.Errorf(
			"cabecera incompleta: se encontraron %d columnas de %d esperadas (matriz MGA)",
			len(headers),
			mgaProductColumnCount,
		)
	}

	result := &ProductParseResult{
		Rows:   make([]ProductImportRow, 0, len(rows)-1),
		Errors: make([]ProductImportParseError, 0),
	}
	for i, row := range rows[1:] {
		result.TotalRows++
		appendParsedProductRow(result, i+2, row)
	}
	return result, nil
}

// appendParsedProductRow valida una fila MGA y la agrega a Rows o a Errors (nunca panics / return fatal).
func appendParsedProductRow(result *ProductParseResult, rowNum int, row []string) {
	if isProductRowEmpty(row) {
		return
	}

	if len(row) < mgaProductColumnCount {
		result.Errors = append(result.Errors, ProductImportParseError{
			Row:     rowNum,
			Message: fmt.Sprintf("Fila incompleta o descuadrada: se encontraron %d columnas de %d esperadas", len(row), mgaProductColumnCount),
		})
		return
	}

	codigoPrograma := productCellAt(row, mgaColCodigoPrograma)
	nombrePrograma := productCellAt(row, mgaColNombrePrograma)
	codigoProducto := productCellAt(row, mgaColCodigoProducto)
	producto := productCellAt(row, mgaColProducto)

	if codigoPrograma != "" && len(codigoPrograma) > mgaMaxProgramaCodigoLen {
		result.Errors = append(result.Errors, ProductImportParseError{
			Row:            rowNum,
			CodigoProducto: truncateForError(codigoProducto, mgaMaxProductoCodigoLen),
			Message:        "Estructura de columnas inválida o código mal formado (código de programa demasiado largo)",
		})
		return
	}
	if codigoProducto != "" && len(codigoProducto) > mgaMaxProductoCodigoLen {
		result.Errors = append(result.Errors, ProductImportParseError{
			Row:            rowNum,
			CodigoProducto: truncateForError(codigoProducto, mgaMaxProductoCodigoLen),
			Message:        "Estructura de columnas inválida o código mal formado (código de producto demasiado largo)",
		})
		return
	}

	if codigoProducto == "" && producto == "" {
		result.Errors = append(result.Errors, ProductImportParseError{
			Row:     rowNum,
			Message: "Fila vacía: se requieren código y nombre de producto",
		})
		return
	}

	ods := productCellAt(row, mgaColODS)
	metaODS := productCellAt(row, mgaColMetaODS)
	if ods == "" && metaODS != "" && strings.Contains(metaODS, "|") {
		parts := strings.SplitN(metaODS, "|", 2)
		ods = strings.TrimSpace(parts[0])
		if len(parts) > 1 {
			metaODS = strings.TrimSpace(parts[1])
		}
	}

	result.Rows = append(result.Rows, ProductImportRow{
		SourceRow:               rowNum,
		Sector:                  productCellAt(row, mgaColSector),
		NombreSector:            productCellAt(row, mgaColNombreSector),
		CodigoPrograma:          codigoPrograma,
		NombrePrograma:          nombrePrograma,
		CodigoProducto:          codigoProducto,
		Producto:                producto,
		Descripcion:             productCellAt(row, mgaColDescripcion),
		MedidoATravesDe:         productCellAt(row, mgaColMedidoATravesDe),
		CodigoIndicadorProducto: productCellAt(row, mgaColCodigoIndicador),
		IndicadorProducto:       productCellAt(row, mgaColIndicador),
		UnidadDeMedida:          productCellAt(row, mgaColUnidadMedida),
		IndicadorPrincipal:      parseProductBool(productCellAt(row, mgaColIndicadorPrin)),
		EsNacional:              parseProductBool(productCellAt(row, mgaColEsNacional)),
		EsTerritorial:           parseProductBool(productCellAt(row, mgaColEsTerritorial)),
		ODS:                     ods,
		MetaODS:                 metaODS,
		TipologiaGeneralSUIFP:   productCellAt(row, mgaColTipologiaGeneral),
		TipologiaD:              parseProductBool(productCellAt(row, mgaColTipologiaD)),
		TipologiaE:              parseProductBool(productCellAt(row, mgaColTipologiaE)),
		TipologiaAPIIP:          parseProductBool(productCellAt(row, mgaColTipologiaA)),
		TipologiaBPIIP:          parseProductBool(productCellAt(row, mgaColTipologiaB)),
		TipologiaCPIIP:          parseProductBool(productCellAt(row, mgaColTipologiaC)),
		TieneEDT:                parseProductBool(productCellAt(row, mgaColTieneEDT)),
		EDT:                     productCellAt(row, mgaColEDT),
	})
}

// sanitizeCSVBytes elimina NUL y corrige UTF-8 inválido para evitar EOF prematuros del lector.
func sanitizeCSVBytes(raw []byte) []byte {
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

func detectCSVDelimiter(raw []byte) rune {
	// Usa la primera línea no vacía como muestra.
	line := raw
	if idx := bytes.IndexByte(raw, '\n'); idx >= 0 {
		line = raw[:idx]
	}
	line = bytes.TrimRight(line, "\r")
	commas := bytes.Count(line, []byte{','})
	semis := bytes.Count(line, []byte{';'})
	if semis > commas {
		return ';'
	}
	return ','
}

func isSwallowedCSVRecord(rec []string) bool {
	if len(rec) == 0 {
		return false
	}
	// Pocos campos + un campo enorme con saltos de línea ⇒ el resto del archivo fue absorbido.
	if len(rec) < mgaProductColumnCount {
		for _, cell := range rec {
			if len(cell) >= mgaSwallowedFieldBytes || strings.Count(cell, "\n") >= 3 {
				return true
			}
		}
	}
	for _, cell := range rec {
		if len(cell) >= mgaSwallowedFieldBytes && strings.Count(cell, "\n") >= 3 {
			return true
		}
	}
	return false
}

func joinedRecord(rec []string) string {
	return strings.Join(rec, "\n")
}

// recoverSwallowedCSVRecord intenta rescatar filas individuales tras una comilla rota.
func recoverSwallowedCSVRecord(rec []string, delim rune) [][]string {
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
			// Fallback naive split si la línea sigue corrupta.
			sub = strings.Split(line, string(delim))
		}
		out = append(out, sub)
	}
	return out
}

func isProductRowEmpty(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(strings.TrimPrefix(cell, "\ufeff")) != "" {
			return false
		}
	}
	return true
}

func truncateForError(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}

func normalizeProductHeaders(headers []string) []string {
	out := make([]string, len(headers))
	for i, h := range headers {
		out[i] = normalizeProductHeader(h)
	}
	return out
}

func normalizeProductHeader(h string) string {
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

func productCellAt(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(row[idx], "\ufeff"))
}

func parseProductBool(v string) bool {
	v = strings.TrimSpace(strings.ToLower(v))
	switch v {
	case "1", "true", "t", "si", "sí", "yes", "y", "x":
		return true
	case "0", "false", "f", "no", "n", "":
		return false
	}
	if b, err := strconv.ParseBool(v); err == nil {
		return b
	}
	return false
}
