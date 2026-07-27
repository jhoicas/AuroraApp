package postgres

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
	"unicode"

	"github.com/xuri/excelize/v2"
)

type ProductImportRow struct {
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
	TipologiaD              string
	TipologiaE              string
	TipologiaAPIIP          string
	TipologiaBPIIP          string
	TipologiaCPIIP          string
	TieneEDT                bool
	EDT                     string
}

func ParseProductsFromXLSX(r io.Reader) ([]ProductImportRow, error) {
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
	return parseProductRows(rows)
}

func ParseProductsFromCSV(r io.Reader) ([]ProductImportRow, error) {
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
	return parseProductRows(rows)
}

func parseProductRows(rows [][]string) ([]ProductImportRow, error) {
	if len(rows) < 2 {
		return nil, fmt.Errorf("archivo sin datos (se requiere cabecera + filas)")
	}
	headers := normalizeProductHeaders(rows[0])
	idx := func(cands ...string) int { return productHeaderIndex(headers, cands...) }

	idxSector := idx("sector", "codigo_sector", "codigosector")
	idxNomSec := idx("nombre_del_sector", "nombre_sector", "nombresector", "nombre sector")
	idxCodProg := idx("codigo_del_programa", "codigo_programa", "codigoprograma", "codigo programa")
	idxNomProg := idx("nombre_del_programa", "nombre_programa", "nombreprograma", "nombre programa", "programa")
	idxCodProd := idx("codigo_del_producto", "codigo_producto", "codigoproducto", "codigo producto")
	idxProd := idx("producto", "nombre_producto", "nombreproducto")
	idxDesc := idx("descripcion", "descripción")
	idxMedido := idx("medido_a_traves_de", "medido_a_traves", "medido a traves de")
	idxCodInd := idx(
		"codigo_del_indicador_de_producto",
		"codigo_indicador_producto",
		"codigo_indicador",
		"codigo indicador producto",
	)
	idxInd := idx("indicador_de_producto", "indicador_producto", "indicador producto", "indicador")
	idxUnidad := idx("unidad_de_medida", "unidad_medida", "unidad de medida")
	idxIndPrin := idx("indicador_principal", "indicador principal")
	idxNac := idx("es_nacional", "nacional", "es nacional")
	idxTerr := idx("es_territorial", "territorial", "es territorial")
	idxODS := idx(
		"objetivos_de_desarrollo_sostenible_ods",
		"objetivos_de_desarrollo_sostenible",
		"ods",
		"objetivos de desarrollo sostenible",
	)
	idxMetaODS := idx("meta_ods", "meta ods", "ods_meta_ods", "ods meta ods")
	idxTipGen := idx("tipologia_general_suifp", "tipologia_general", "tipologia general suifp")
	idxTipD := idx("tipologia_d", "tipologia d")
	idxTipE := idx("tipologia_e", "tipologia e")
	idxTipA := idx("tipologia_a", "tipologia_a_piip", "tipologia a")
	idxTipB := idx("tipologia_b", "tipologia_b_piip", "tipologia b")
	idxTipC := idx("tipologia_c", "tipologia_c_piip", "tipologia c")
	idxTieneEDT := idx("tiene_edt", "tiene edt")
	idxEDT := idx("edt")

	if idxCodProd < 0 || idxProd < 0 {
		return nil, fmt.Errorf("cabeceras requeridas: Codigo Producto, Producto")
	}

	out := make([]ProductImportRow, 0, len(rows)-1)
	for _, row := range rows[1:] {
		codigo := productCellAt(row, idxCodProd)
		nombre := productCellAt(row, idxProd)
		if codigo == "" && nombre == "" {
			continue
		}
		ods := productCellAt(row, idxODS)
		metaODS := productCellAt(row, idxMetaODS)
		if ods == "" && metaODS != "" && strings.Contains(metaODS, "|") {
			// compat: valor combinado legado
			parts := strings.SplitN(metaODS, "|", 2)
			ods = strings.TrimSpace(parts[0])
			if len(parts) > 1 {
				metaODS = strings.TrimSpace(parts[1])
			}
		}
		item := ProductImportRow{
			Sector:                  productCellAt(row, idxSector),
			NombreSector:            productCellAt(row, idxNomSec),
			CodigoPrograma:          productCellAt(row, idxCodProg),
			NombrePrograma:          productCellAt(row, idxNomProg),
			CodigoProducto:          codigo,
			Producto:                nombre,
			Descripcion:             productCellAt(row, idxDesc),
			MedidoATravesDe:         productCellAt(row, idxMedido),
			CodigoIndicadorProducto: productCellAt(row, idxCodInd),
			IndicadorProducto:       productCellAt(row, idxInd),
			UnidadDeMedida:          productCellAt(row, idxUnidad),
			IndicadorPrincipal:      parseProductBool(productCellAt(row, idxIndPrin)),
			EsNacional:              parseProductBool(productCellAt(row, idxNac)),
			EsTerritorial:           parseProductBool(productCellAt(row, idxTerr)),
			ODS:                     ods,
			MetaODS:                 metaODS,
			TipologiaGeneralSUIFP:   productCellAt(row, idxTipGen),
			TipologiaD:              productCellAt(row, idxTipD),
			TipologiaE:              productCellAt(row, idxTipE),
			TipologiaAPIIP:          productCellAt(row, idxTipA),
			TipologiaBPIIP:          productCellAt(row, idxTipB),
			TipologiaCPIIP:          productCellAt(row, idxTipC),
			TieneEDT:                parseProductBool(productCellAt(row, idxTieneEDT)),
			EDT:                     productCellAt(row, idxEDT),
		}
		out = append(out, item)
	}
	return out, nil
}

func normalizeProductHeaders(headers []string) []string {
	out := make([]string, len(headers))
	for i, h := range headers {
		out[i] = normalizeProductHeader(h)
	}
	return out
}

func normalizeProductHeader(h string) string {
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

func productHeaderIndex(headers []string, candidates ...string) int {
	set := make(map[string]struct{}, len(candidates))
	for _, c := range candidates {
		set[normalizeProductHeader(c)] = struct{}{}
	}
	for i, h := range headers {
		if _, ok := set[h]; ok {
			return i
		}
	}
	return -1
}

func productCellAt(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
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
