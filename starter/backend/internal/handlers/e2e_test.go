package handlers

import (
	"bytes"
	"database/sql"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"

	"aurora-backend/internal/middleware"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
)

func TestE2EUploadAndFormulate(t *testing.T) {
	oldOpenDB := openDB
	defer func() { openDB = oldOpenDB }()

	dbUpload, mockUpload, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer dbUpload.Close()

	dbFormulate, mockFormulate, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer dbFormulate.Close()

	openDBCall := 0
	openDB = func() (*sql.DB, error) {
		if openDBCall == 0 {
			openDBCall++
			return dbUpload, nil
		}
		return dbFormulate, nil
	}

	app := fiber.New()
	app.Use(middleware.TenantMiddleware)
	tenantGroup := app.Group("/api/tenant")
	tenantGroup.Post("/wiki/upload", UploadWikiVault)
	tenantGroup.Post("/ai/formulate", FormulateProjectAI)

	content := "# Manual MGA\n\nPara formular un proyecto de agua potable se requiere un análisis de oferta y demanda proyectado a 10 años exactos."

	mockUpload.ExpectExec(`UPDATE public\.knowledge_wiki_notes SET content=\$1, updated_at=NOW\(\) WHERE tenant_id=\$2 AND title=\$3`).
		WithArgs(content, "mock-tenant-id", "manual_mga").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mockUpload.ExpectExec(`INSERT INTO public\.knowledge_wiki_notes \(tenant_id, title, content, created_at, updated_at\) VALUES \(\$1,\$2,\$3,NOW\(\),NOW\(\)\)`).
		WithArgs("mock-tenant-id", "manual_mga", content).
		WillReturnResult(sqlmock.NewResult(1, 1))

	body := new(bytes.Buffer)
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "manual_mga.md")
	if err != nil {
		t.Fatal(err)
	}
	_, err = io.Copy(part, strings.NewReader(content))
	if err != nil {
		t.Fatal(err)
	}
	writer.Close()

	req := httptest.NewRequest("POST", "/api/tenant/wiki/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer dummy")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 upload, got %d", resp.StatusCode)
	}

	mockFormulate.ExpectQuery(`SELECT content FROM public\.knowledge_wiki_notes WHERE tenant_id=\$1 AND title=\$2`).
		WithArgs("mock-tenant-id", "manual_mga").
		WillReturnRows(sqlmock.NewRows([]string{"content"}).AddRow(content))
	queryPayload := `{"query":"Voy a formular un proyecto de agua potable, ¿cuántos años debo proyectar la demanda según el manual?"}`
	req2 := httptest.NewRequest("POST", "/api/tenant/ai/formulate", strings.NewReader(queryPayload))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", "Bearer dummy")

	resp2, err := app.Test(req2, -1)
	if err != nil {
		t.Fatal(err)
	}
	if resp2.StatusCode != 200 {
		t.Fatalf("expected 200 formulate, got %d", resp2.StatusCode)
	}

	responseBytes, err := io.ReadAll(resp2.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(responseBytes), "10 años") {
		t.Fatalf("expected response to mention '10 años', got %s", string(responseBytes))
	}
	t.Logf("E2E response body: %s", string(responseBytes))

	if err := mockUpload.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
	if err := mockFormulate.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
