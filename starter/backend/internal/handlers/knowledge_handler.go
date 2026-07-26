package handlers

import (
	"fmt"
	"io"
	"mime/multipart"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type KnowledgeUploadResponse struct {
	Message string   `json:"message"`
	Files   []string `json:"files"`
	Chunks  int      `json:"chunks"`
}

func chunkText(content string, maxSize int) []string {
	content = strings.TrimSpace(content)
	if content == "" {
		return []string{}
	}

	words := strings.Fields(content)
	if len(words) == 0 {
		return []string{}
	}

	var chunks []string
	var current strings.Builder
	for _, word := range words {
		if current.Len() > 0 && current.Len()+len(word)+1 > maxSize {
			chunks = append(chunks, strings.TrimSpace(current.String()))
			current.Reset()
		}
		if current.Len() > 0 {
			current.WriteByte(' ')
		}
		current.WriteString(word)
	}
	if current.Len() > 0 {
		chunks = append(chunks, strings.TrimSpace(current.String()))
	}
	return chunks
}

func readTextFromMultipart(file *multipart.FileHeader) (string, error) {
	opened, err := file.Open()
	if err != nil {
		return "", err
	}
	defer opened.Close()

	data, err := io.ReadAll(opened)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func generateMockEmbedding(text string) []float64 {
	seed := 0
	for _, r := range text {
		seed += int(r)
	}
	return []float64{float64(seed%10) / 10, float64((seed+3)%10) / 10, float64((seed+7)%10) / 10}
}

func UploadKnowledgeBase(c *fiber.Ctx) error {
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid multipart form"})
	}

	files := form.File["files"]
	if len(files) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No files provided"})
	}

	processed := make([]string, 0, len(files))
	chunkCount := 0
	for _, file := range files {
		if !strings.HasSuffix(strings.ToLower(file.Filename), ".md") && !strings.HasSuffix(strings.ToLower(file.Filename), ".xml") {
			continue
		}

		content, err := readTextFromMultipart(file)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Unable to read file %s", file.Filename)})
		}

		chunks := chunkText(content, 400)
		chunkCount += len(chunks)
		for _, chunk := range chunks {
			_ = generateMockEmbedding(chunk)
		}
		processed = append(processed, file.Filename)
	}

	return c.JSON(KnowledgeUploadResponse{
		Message: "Knowledge base updated successfully",
		Files:   processed,
		Chunks:  chunkCount,
	})
}
