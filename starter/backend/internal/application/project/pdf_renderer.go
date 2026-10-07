package project

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"time"

	"github.com/chromedp/chromedp"
)

// DocumentCSS son las reglas de impresión compartidas con el editor TipTap (clase .tpl-prose,
// frontend/src/index.css). Mantener ambos sincronizados para que el editor sea WYSIWYG.
const DocumentCSS = `
@page { size: A4; margin: 24mm 18mm 20mm 18mm;
  @top-left { content: "DEPARTAMENTO DEL VALLE DEL CAUCA-DECRETO 1278 DE 2023"; font: 700 7pt Arial, Helvetica, sans-serif; color: #475569; vertical-align: bottom; padding-bottom: 2mm; border-bottom: 1px solid #cbd5e1; width: 112mm; text-align: left; }
  @top-right { content: "DOCUMENTO TÉCNICO DE INVERSIÓN"; font: 700 7pt Arial, Helvetica, sans-serif; color: #475569; vertical-align: bottom; padding-bottom: 2mm; border-bottom: 1px solid #cbd5e1; width: 62mm; text-align: right; }
}
@page :first { margin-top: 18mm; @top-left { content: none; border: 0; } @top-right { content: none; border: 0; } }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.4; color: #000; }
.doc > :first-child { padding-top: 18mm; }
h1 { font-size: 15pt; font-weight: 700; margin: 6pt 0; }
h2 { font-size: 12.5pt; font-weight: 700; margin: 12pt 0 4pt; }
h3 { font-size: 11.5pt; font-weight: 700; margin: 8pt 0 3pt; }
p { margin: 4pt 0; }
ul { list-style: disc; padding-left: 18pt; margin: 4pt 0; }
ol { list-style: decimal; padding-left: 18pt; margin: 4pt 0; }
li { margin: 2pt 0; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0; table-layout: fixed; }
th, td { border: 1px solid #000; padding: 4pt 6pt; text-align: left; vertical-align: top; word-wrap: break-word; }
th { background: #e5e7eb; font-weight: 700; }
tr { page-break-inside: avoid; }
hr { border: 0; border-top: 1px solid #94a3b8; margin: 10pt 0; }
h1, h2, h3 { page-break-after: avoid; }
`

const pdfFooterTemplate = `<div style="width:100%;font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#64748b;text-align:center;">` +
	`Documento Técnico Decreto 1278/2023 (Art. 13, Lit. e) | Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`

// WrapDocumentHTML envuelve el contenido en un documento HTML completo con el CSS oficial.
func WrapDocumentHTML(body string) string {
	return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>` + DocumentCSS +
		`</style></head><body><div class="doc">` + body + `</div></body></html>`
}

// HTMLToPDF renderiza el HTML con Chromium headless y devuelve un PDF A4 con encabezado y pie.
// El encabezado oficial se pinta con cajas de margen CSS (@top-left/@top-right, Chromium >= 131)
// porque headerTemplate no puede omitirse en la primera página; el pie sí usa footerTemplate.
func HTMLToPDF(src string) ([]byte, error) {
	opts := append([]chromedp.ExecAllocatorOption{}, chromedp.DefaultExecAllocatorOptions[:]...)
	opts = append(opts,
		chromedp.NoSandbox,
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("disable-dev-shm-usage", true),
	)
	if bin := os.Getenv("CHROME_BIN"); bin != "" {
		opts = append(opts, chromedp.ExecPath(bin))
	}
	allocCtx, cancelAlloc := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancelAlloc()
	ctx, cancelCtx := chromedp.NewContext(allocCtx)
	defer cancelCtx()
	ctx, cancelTimeout := context.WithTimeout(ctx, 60*time.Second)
	defer cancelTimeout()

	dataURL := "data:text/html;charset=utf-8;base64," + base64.StdEncoding.EncodeToString([]byte(WrapDocumentHTML(src)))
	if err := chromedp.Do(ctx, chromedp.Navigate(dataURL)); err != nil {
		return nil, fmt.Errorf("chromedp navigate: %w", err)
	}
	pdf, err := chromedp.Run(ctx, chromedp.PrintToPDF(
		chromedp.PDFPaper(chromedp.PaperA4),
		chromedp.PDFPreferCSSPageSize(),
		chromedp.PDFPrintBackground(),
		chromedp.PDFHeaderTemplate(`<span></span>`), // encabezado: ver @page en DocumentCSS
		chromedp.PDFFooterTemplate(pdfFooterTemplate),
	))
	if err != nil {
		return nil, fmt.Errorf("chromedp print to pdf: %w", err)
	}
	return pdf, nil
}
