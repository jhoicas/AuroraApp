package handlers

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"aurora-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type WikiNote struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

var openDB = func() (*sql.DB, error) {
	cfg := config.LoadConfig()
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL not configured")
	}
	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	return db, nil
}

func UploadWikiVault(c *fiber.Ctx) error {
	tenantID, ok := c.Locals("tenant_id").(string)
	if !ok || tenantID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant_id missing"})
	}

	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid multipart form"})
	}

	files := make([]*multipart.FileHeader, 0)
	if ff, ok := form.File["files"]; ok {
		files = append(files, ff...)
	}
	// accept single zip as 'zip'
	if zf, ok := form.File["zip"]; ok && len(zf) > 0 {
		files = append(files, zf[0])
	}

	if len(files) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "no files provided"})
	}

	db, err := openDB()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer db.Close()

	processed := 0

	for _, fh := range files {
		name := strings.ToLower(fh.Filename)
		if strings.HasSuffix(name, ".md") {
			content, err := readMultipartFile(fh)
			if err != nil {
				continue
			}
			title := strings.TrimSuffix(filepath.Base(fh.Filename), ".md")
			upsertNote(db, tenantID, title, content)
			processed++
			continue
		}
		if strings.HasSuffix(name, ".zip") {
			opened, err := fh.Open()
			if err != nil {
				continue
			}
			data, err := io.ReadAll(opened)
			opened.Close()
			if err != nil {
				continue
			}
			zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
			if err != nil {
				continue
			}
			for _, f := range zr.File {
				if strings.HasSuffix(strings.ToLower(f.Name), ".md") {
					rc, err := f.Open()
					if err != nil {
						continue
					}
					b, _ := io.ReadAll(rc)
					rc.Close()
					title := strings.TrimSuffix(filepath.Base(f.Name), ".md")
					upsertNote(db, tenantID, title, string(b))
					processed++
				}
			}
		}
	}

	return c.JSON(fiber.Map{"message": "wiki uploaded", "processed": processed})
}

func readMultipartFile(fh *multipart.FileHeader) (string, error) {
	opened, err := fh.Open()
	if err != nil {
		return "", err
	}
	defer opened.Close()
	b, err := io.ReadAll(opened)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func upsertNote(db *sql.DB, tenantID, title, content string) error {
	// try update
	res, err := db.Exec(`UPDATE public.knowledge_wiki_notes SET content=$1, updated_at=NOW() WHERE tenant_id=$2 AND title=$3`, content, tenantID, title)
	if err == nil {
		if rows, _ := res.RowsAffected(); rows > 0 {
			return nil
		}
	}
	_, err = db.Exec(`INSERT INTO public.knowledge_wiki_notes (tenant_id, title, content, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`, tenantID, title, content)
	return err
}

func ListWikiNotes(c *fiber.Ctx) error {
	tenantID, ok := c.Locals("tenant_id").(string)
	if !ok || tenantID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant_id missing"})
	}
	db, err := openDB()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer db.Close()

	rows, err := db.Query(`SELECT title, updated_at FROM public.knowledge_wiki_notes WHERE tenant_id=$1 ORDER BY updated_at DESC`, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var titles []string
	for rows.Next() {
		var t string
		var ut time.Time
		rows.Scan(&t, &ut)
		titles = append(titles, t)
	}
	return c.JSON(fiber.Map{"titles": titles})
}

func ReadWikiNote(c *fiber.Ctx) error {
	tenantID, ok := c.Locals("tenant_id").(string)
	if !ok || tenantID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant_id missing"})
	}
	title := c.Query("title")
	if title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "title required"})
	}
	db, err := openDB()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer db.Close()

	var content string
	err = db.QueryRow(`SELECT content FROM public.knowledge_wiki_notes WHERE tenant_id=$1 AND title=$2`, tenantID, title).Scan(&content)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "note not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"title": title, "content": content})
}

func SaveWikiNote(c *fiber.Ctx) error {
	tenantID, ok := c.Locals("tenant_id").(string)
	if !ok || tenantID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant_id missing"})
	}
	var payload struct {
		Title   string `json:"title"`
		Content string `json:"content"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	db, err := openDB()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer db.Close()
	if err := upsertNote(db, tenantID, payload.Title, payload.Content); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "saved"})
}
