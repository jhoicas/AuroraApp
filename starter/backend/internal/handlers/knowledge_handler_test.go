package handlers

import (
	"strings"
	"testing"
)

func TestChunkTextSplitsLongText(t *testing.T) {
	text := strings.Repeat("Esto es un texto de prueba para chunking. ", 12)
	chunks := chunkText(text, 80)
	if len(chunks) == 0 {
		t.Fatal("expected at least one chunk")
	}
	for _, chunk := range chunks {
		if len(chunk) > 80 {
			t.Fatalf("chunk too large: %d", len(chunk))
		}
	}
}
