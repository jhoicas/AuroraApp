package soda

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

func TestSodaClient_FetchAll_Pagination(t *testing.T) {
	// Mock server that returns 25 items across 3 pages (limits: 10, 10, 5)
	totalItems := 25
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limitStr := r.URL.Query().Get("$limit")
		offsetStr := r.URL.Query().Get("$offset")

		limit, _ := strconv.Atoi(limitStr)
		if limit <= 0 {
			limit = 10
		}
		offset, _ := strconv.Atoi(offsetStr)

		if offset >= totalItems {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte("[]"))
			return
		}

		end := offset + limit
		if end > totalItems {
			end = totalItems
		}

		var items []map[string]any
		for i := offset; i < end; i++ {
			items = append(items, map[string]any{
				"id":    i,
				"title": fmt.Sprintf("Item %d", i),
			})
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(items)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-token", server.Client())

	// Test FetchPage
	page1, err := client.FetchPage(context.Background(), "test-dataset", 10, 0, nil)
	if err != nil {
		t.Fatalf("FetchPage failed: %v", err)
	}
	if len(page1) != 10 {
		t.Fatalf("expected 10 items in page 1, got %d", len(page1))
	}

	// Test FetchAll with custom limit via queryParams or default
	items, err := client.FetchAllInterfaces(context.Background(), "test-dataset", nil)
	if err != nil {
		t.Fatalf("FetchAllInterfaces failed: %v", err)
	}
	if len(items) != totalItems {
		t.Fatalf("expected %d items, got %d", totalItems, len(items))
	}

	// Test Raw
	rawBytes, err := client.FetchAllRaw(context.Background(), "test-dataset", nil)
	if err != nil {
		t.Fatalf("FetchAllRaw failed: %v", err)
	}
	if len(rawBytes) == 0 {
		t.Fatalf("expected raw bytes, got empty")
	}
}

func TestSodaClient_ErrorHandling(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error": true, "message": "dataset not found"}`, http.StatusNotFound)
	}))
	defer server.Close()

	client := NewClient(server.URL, "", server.Client())
	_, err := client.FetchAll(context.Background(), "invalid-dataset", nil)
	if err == nil {
		t.Fatalf("expected error on 404, got nil")
	}
}
