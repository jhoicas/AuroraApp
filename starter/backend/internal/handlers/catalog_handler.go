package handlers

import (
	"database/sql"
	"fmt"
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/xuri/excelize/v2"
)

type CatalogImportResponse struct {
	Status            string `json:"status"`
	Message           string `json:"message"`
	Sheets            int    `json:"sheets"`
	Rows              int    `json:"rows"`
	SectoresInserted  int    `json:"sectores_inserted"`
	ProgramasInserted int    `json:"programas_inserted"`
	ProductosInserted int    `json:"productos_inserted"`
	EdtInserted       int    `json:"edt_inserted"`
	OdsInserted       int    `json:"ods_inserted"`
}

func ImportCatalogExcel(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Excel file is required"})
	}

	if !strings.HasSuffix(strings.ToLower(file.Filename), ".xlsx") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Only .xlsx files are supported"})
	}

	opened, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Unable to open uploaded file"})
	}
	defer opened.Close()

	workbook, err := excelize.OpenReader(opened)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": fmt.Sprintf("Invalid Excel file: %v", err)})
	}

	sheets := workbook.GetSheetList()
	response := CatalogImportResponse{Status: "success", Message: "Catalog import processed successfully"}

	db, err := openDB()
	if err != nil {
		response.Status = "partial"
		response.Message = fmt.Sprintf("Excel parsed but database is not available: %v", err)
		for _, sheet := range sheets {
			rows, err := workbook.GetRows(sheet)
			if err == nil {
				response.Rows += len(rows)
				response.Sheets++
			}
		}
		return c.JSON(response)
	}
	defer db.Close()

	for _, sheet := range sheets {
		rows, err := workbook.GetRows(sheet)
		if err != nil || len(rows) == 0 {
			continue
		}
		response.Sheets++
		target := detectCatalogTarget(sheet, normalizeHeaders(rows[0]))
		if target == "" {
			continue
		}
		for _, row := range rows[1:] {
			if isEmptyRow(row) {
				continue
			}
			response.Rows++
			switch target {
			case "sectores":
				if _, err := upsertSector(db, row, normalizeHeaders(rows[0])); err == nil {
					response.SectoresInserted++
				}
			case "programas_subprogramas":
				if _, err := upsertPrograma(db, row, normalizeHeaders(rows[0])); err == nil {
					response.ProgramasInserted++
				}
			case "catalogo_productos":
				if _, err := upsertProducto(db, row, normalizeHeaders(rows[0])); err == nil {
					response.ProductosInserted++
				}
			case "catalogo_edt":
				if _, err := upsertEdt(db, row, normalizeHeaders(rows[0])); err == nil {
					response.EdtInserted++
				}
			case "ods":
				if _, err := upsertOds(db, row, normalizeHeaders(rows[0])); err == nil {
					response.OdsInserted++
				}
			}
		}
	}

	return c.JSON(response)
}

func normalizeHeader(input string) string {
	input = strings.ToLower(strings.TrimSpace(input))
	input = strings.ReplaceAll(input, "-", "_")
	input = strings.ReplaceAll(input, "/", "_")
	input = strings.ReplaceAll(input, "(", "")
	input = strings.ReplaceAll(input, ")", "")
	input = strings.ReplaceAll(input, " ", "_")
	input = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(input, "_")
	return strings.Trim(strings.ReplaceAll(input, "__", "_"), "_")
}

func normalizeHeaders(headers []string) []string {
	normalized := make([]string, 0, len(headers))
	for _, header := range headers {
		normalized = append(normalized, normalizeHeader(header))
	}
	return normalized
}

func detectCatalogTarget(sheetName string, headers []string) string {
	sheet := normalizeHeader(sheetName)
	joined := strings.Join(headers, " ")
	if strings.Contains(sheet, "sector") || strings.Contains(joined, "codigo_sector") || strings.Contains(joined, "nombre_sector") {
		return "sectores"
	}
	if strings.Contains(sheet, "edt") || strings.Contains(joined, "codigo_producto_estandarizado") || strings.Contains(joined, "codigo_entregable_l1") {
		return "catalogo_edt"
	}
	if strings.Contains(sheet, "ods") || strings.Contains(joined, "codigo_objetivo_ods") || strings.Contains(joined, "codigo_meta_ods") {
		return "ods"
	}
	if strings.Contains(sheet, "program") || strings.Contains(joined, "codigo_programa") || strings.Contains(joined, "nombre_programa") {
		return "programas_subprogramas"
	}
	if strings.Contains(sheet, "producto") || strings.Contains(joined, "codigo_producto") || strings.Contains(joined, "producto") {
		return "catalogo_productos"
	}
	return ""
}

func isEmptyRow(row []string) bool {
	for _, value := range row {
		if strings.TrimSpace(value) != "" {
			return false
		}
	}
	return true
}

func valueAt(row []string, headers []string, candidates ...string) string {
	indexByName := make(map[string]int, len(headers))
	for i, header := range headers {
		indexByName[header] = i
	}
	for _, candidate := range candidates {
		if idx, ok := indexByName[candidate]; ok && idx < len(row) {
			if value := strings.TrimSpace(row[idx]); value != "" {
				return value
			}
		}
	}
	return ""
}

func parseBool(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	return value == "true" || value == "si" || value == "sí" || value == "1" || value == "x"
}

func upsertSector(db *sql.DB, row []string, headers []string) (int64, error) {
	codigo := valueAt(row, headers, "codigo", "codigo_sector", "sector")
	nombre := valueAt(row, headers, "nombre", "nombre_sector", "sector")
	aplicacion := valueAt(row, headers, "aplicacion")
	observaciones := valueAt(row, headers, "observaciones")
	if codigo == "" {
		return 0, fmt.Errorf("missing codigo")
	}
	res, err := db.Exec(`
		INSERT INTO public.sectores (tenant_id, codigo, nombre, aplicacion, observaciones)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (codigo) DO UPDATE SET
			nombre = EXCLUDED.nombre,
			aplicacion = EXCLUDED.aplicacion,
			observaciones = EXCLUDED.observaciones
	`, nil, codigo, nombre, aplicacion, observaciones)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func upsertPrograma(db *sql.DB, row []string, headers []string) (int64, error) {
	codigoSector := valueAt(row, headers, "codigo_sector", "sector")
	nombreSector := valueAt(row, headers, "nombre_sector", "sector")
	codigoPrograma := valueAt(row, headers, "codigo_programa", "programa")
	nombrePrograma := valueAt(row, headers, "nombre_programa", "programa_nombre", "programa")
	ambito := valueAt(row, headers, "ambito_aplicacion")
	codigoSubprograma := valueAt(row, headers, "codigo_subprograma", "subprograma")
	nombreSubprograma := valueAt(row, headers, "nombre_subprograma", "subprograma_nombre")
	observaciones := valueAt(row, headers, "observaciones")
	if codigoPrograma == "" {
		return 0, fmt.Errorf("missing codigo_programa")
	}
	res, err := db.Exec(`
		INSERT INTO public.programas_subprogramas (
			tenant_id, sector_id, codigo_sector, nombre_sector, codigo_programa, nombre_programa,
			ambito_aplicacion, codigo_subprograma, nombre_subprograma, observaciones
		) VALUES (
			$1, NULL, $2, $3, $4, $5, $6, $7, $8, $9
		)
		ON CONFLICT (codigo_programa, COALESCE(codigo_subprograma, '')) DO UPDATE SET
			nombre_programa = EXCLUDED.nombre_programa,
			codigo_sector = EXCLUDED.codigo_sector,
			nombre_sector = EXCLUDED.nombre_sector,
			ambito_aplicacion = EXCLUDED.ambito_aplicacion,
			nombre_subprograma = EXCLUDED.nombre_subprograma,
			observaciones = EXCLUDED.observaciones
	`, nil, codigoSector, nombreSector, codigoPrograma, nombrePrograma, ambito, codigoSubprograma, nombreSubprograma, observaciones)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func upsertProducto(db *sql.DB, row []string, headers []string) (int64, error) {
	sector := valueAt(row, headers, "sector", "nombre_sector", "codigo_sector")
	nombreSector := valueAt(row, headers, "nombre_sector", "sector")
	codigoPrograma := valueAt(row, headers, "codigo_programa", "programa")
	nombrePrograma := valueAt(row, headers, "nombre_programa", "programa_nombre", "programa")
	codigoProducto := valueAt(row, headers, "codigo_producto", "producto")
	producto := valueAt(row, headers, "producto", "nombre_producto", "codigo_producto")
	descripcion := valueAt(row, headers, "descripcion")
	medido := valueAt(row, headers, "medido_a_traves_de")
	codigoIndicador := valueAt(row, headers, "codigo_indicador_producto")
	indicadorProducto := valueAt(row, headers, "indicador_producto")
	unidad := valueAt(row, headers, "unidad_de_medida")
	indicadorPrincipal := parseBool(valueAt(row, headers, "indicador_principal"))
	esNacional := parseBool(valueAt(row, headers, "es_nacional"))
	esTerritorial := parseBool(valueAt(row, headers, "es_territorial"))
	odsMeta := valueAt(row, headers, "ods_meta_ods")
	tipologiaGeneral := valueAt(row, headers, "tipologia_general_suifp")
	tipologiaD := valueAt(row, headers, "tipologia_d")
	tipologiaE := valueAt(row, headers, "tipologia_e")
	tipologiaAPIIP := valueAt(row, headers, "tipologia_a_piip")
	tipologiaBPIIP := valueAt(row, headers, "tipologia_b_piip")
	tipologiaCPIIP := valueAt(row, headers, "tipologia_c_piip")
	tieneEdt := parseBool(valueAt(row, headers, "tiene_edt"))
	edtValue := valueAt(row, headers, "edt")
	if codigoProducto == "" {
		return 0, fmt.Errorf("missing codigo_producto")
	}
	res, err := db.Exec(`
		INSERT INTO public.catalogo_productos (
			tenant_id, sector, nombre_sector, codigo_programa, nombre_programa, codigo_producto, producto,
			descripcion, medido_a_traves_de, codigo_indicador_producto, indicador_producto, unidad_de_medida,
			indicador_principal, es_nacional, es_territorial, ods_meta_ods, tipologia_general_suifp,
			tipologia_d, tipologia_e, tipologia_a_piip, tipologia_b_piip, tipologia_c_piip, tiene_edt, edt
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
		)
		ON CONFLICT (codigo_producto) DO UPDATE SET
			sector = EXCLUDED.sector,
			nombre_sector = EXCLUDED.nombre_sector,
			codigo_programa = EXCLUDED.codigo_programa,
			nombre_programa = EXCLUDED.nombre_programa,
			producto = EXCLUDED.producto,
			descripcion = EXCLUDED.descripcion,
			medido_a_traves_de = EXCLUDED.medido_a_traves_de,
			codigo_indicador_producto = EXCLUDED.codigo_indicador_producto,
			indicador_producto = EXCLUDED.indicador_producto,
			unidad_de_medida = EXCLUDED.unidad_de_medida,
			indicador_principal = EXCLUDED.indicador_principal,
			es_nacional = EXCLUDED.es_nacional,
			es_territorial = EXCLUDED.es_territorial,
			ods_meta_ods = EXCLUDED.ods_meta_ods,
			tipologia_general_suifp = EXCLUDED.tipologia_general_suifp,
			tipologia_d = EXCLUDED.tipologia_d,
			tipologia_e = EXCLUDED.tipologia_e,
			tipologia_a_piip = EXCLUDED.tipologia_a_piip,
			tipologia_b_piip = EXCLUDED.tipologia_b_piip,
			tipologia_c_piip = EXCLUDED.tipologia_c_piip,
			tiene_edt = EXCLUDED.tiene_edt,
			edt = EXCLUDED.edt
	`, nil, sector, nombreSector, codigoPrograma, nombrePrograma, codigoProducto, producto, descripcion, medido, codigoIndicador, indicadorProducto, unidad, indicadorPrincipal, esNacional, esTerritorial, odsMeta, tipologiaGeneral, tipologiaD, tipologiaE, tipologiaAPIIP, tipologiaBPIIP, tipologiaCPIIP, tieneEdt, edtValue)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func upsertEdt(db *sql.DB, row []string, headers []string) (int64, error) {
	codigoProducto := valueAt(row, headers, "codigo_producto_estandarizado", "codigo_producto")
	nombreProducto := valueAt(row, headers, "nombre_producto", "producto")
	codigoEntregableL1 := valueAt(row, headers, "codigo_entregable_l1")
	nombreEntregableL1 := valueAt(row, headers, "nombre_entregable_l1")
	codigoEntregableL2 := valueAt(row, headers, "codigo_entregable_l2")
	nombreEntregableL2 := valueAt(row, headers, "nombre_entregable_l2")
	codigoEntregableL3 := valueAt(row, headers, "codigo_entregable_l3")
	nombreEntregableL3 := valueAt(row, headers, "nombre_entregable_l3")
	codigoActividad := valueAt(row, headers, "codigo_actividad")
	actividad := valueAt(row, headers, "actividad")
	unidad := valueAt(row, headers, "unidad_de_medida")
	if codigoProducto == "" {
		return 0, fmt.Errorf("missing codigo_producto_estandarizado")
	}
	res, err := db.Exec(`
		INSERT INTO public.catalogo_edt (
			tenant_id, codigo_producto_estandarizado, nombre_producto, codigo_entregable_l1, nombre_entregable_l1,
			codigo_entregable_l2, nombre_entregable_l2, codigo_entregable_l3, nombre_entregable_l3,
			codigo_actividad, actividad, unidad_de_medida
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (codigo_producto_estandarizado, COALESCE(codigo_entregable_l1, ''), COALESCE(codigo_entregable_l2, ''), COALESCE(codigo_entregable_l3, ''), COALESCE(codigo_actividad, '')) DO UPDATE SET
			nombre_producto = EXCLUDED.nombre_producto,
			nombre_entregable_l1 = EXCLUDED.nombre_entregable_l1,
			nombre_entregable_l2 = EXCLUDED.nombre_entregable_l2,
			nombre_entregable_l3 = EXCLUDED.nombre_entregable_l3,
			actividad = EXCLUDED.actividad,
			unidad_de_medida = EXCLUDED.unidad_de_medida
	`, nil, codigoProducto, nombreProducto, codigoEntregableL1, nombreEntregableL1, codigoEntregableL2, nombreEntregableL2, codigoEntregableL3, nombreEntregableL3, codigoActividad, actividad, unidad)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func upsertOds(db *sql.DB, row []string, headers []string) (int64, error) {
	codigoObjetivo := valueAt(row, headers, "codigo_objetivo_ods", "objetivo_ods")
	descripcionObjetivo := valueAt(row, headers, "descripcion_objetivo_ods", "objetivo_ods")
	codigoMeta := valueAt(row, headers, "codigo_meta_ods", "meta_ods")
	descripcionMeta := valueAt(row, headers, "descripcion_meta_ods", "meta_ods")
	res, err := db.Exec(`
		INSERT INTO public.ods (tenant_id, codigo_objetivo_ods, descripcion_objetivo_ods, codigo_meta_ods, descripcion_meta_ods)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (codigo_objetivo_ods, COALESCE(codigo_meta_ods, '')) DO UPDATE SET
			descripcion_objetivo_ods = EXCLUDED.descripcion_objetivo_ods,
			descripcion_meta_ods = EXCLUDED.descripcion_meta_ods
	`, nil, codigoObjetivo, descripcionObjetivo, codigoMeta, descripcionMeta)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
