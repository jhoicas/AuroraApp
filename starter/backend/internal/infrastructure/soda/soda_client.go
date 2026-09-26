package soda

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	DefaultBaseURL = "https://www.datos.gov.co/resource/"
	DefaultLimit   = 1000
	DefaultTimeout = 60 * time.Second
)

// Client define la interfaz para consumir datasets de la API SODA / Socrata.
type Client interface {
	FetchAll(ctx context.Context, resourceID string, queryParams map[string]string) ([]json.RawMessage, error)
	FetchAllRaw(ctx context.Context, resourceID string, queryParams map[string]string) ([]byte, error)
	FetchAllInterfaces(ctx context.Context, resourceID string, queryParams map[string]string) ([]map[string]any, error)
	FetchPage(ctx context.Context, resourceID string, limit, offset int, queryParams map[string]string) ([]json.RawMessage, error)
}

// HTTPClient implementa la interfaz Client de SODA.
type HTTPClient struct {
	baseURL    string
	appToken   string
	httpClient *http.Client
}

// NewClient crea una instancia configurada de HTTPClient para SODA.
func NewClient(baseURL string, appToken string, client *http.Client) *HTTPClient {
	cleanURL := strings.TrimSpace(baseURL)
	if cleanURL == "" {
		cleanURL = DefaultBaseURL
	}
	if !strings.HasSuffix(cleanURL, "/") {
		cleanURL += "/"
	}

	if client == nil {
		client = &http.Client{
			Timeout: DefaultTimeout,
		}
	}

	return &HTTPClient{
		baseURL:    cleanURL,
		appToken:   strings.TrimSpace(appToken),
		httpClient: client,
	}
}

// FetchPage obtiene una única página de registros dado un límite y desplazamiento.
func (c *HTTPClient) FetchPage(ctx context.Context, resourceID string, limit, offset int, queryParams map[string]string) ([]json.RawMessage, error) {
	if limit <= 0 {
		limit = DefaultLimit
	}
	if offset < 0 {
		offset = 0
	}

	endpoint := strings.TrimSpace(resourceID)
	if !strings.HasSuffix(endpoint, ".json") {
		endpoint += ".json"
	}

	fullURL := c.baseURL + endpoint
	reqURL, err := url.Parse(fullURL)
	if err != nil {
		return nil, fmt.Errorf("soda client parse url %q: %w", fullURL, err)
	}

	q := reqURL.Query()
	for k, v := range queryParams {
		if strings.TrimSpace(k) != "" {
			q.Set(k, v)
		}
	}
	q.Set("$limit", fmt.Sprintf("%d", limit))
	q.Set("$offset", fmt.Sprintf("%d", offset))
	reqURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("soda client build request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	if c.appToken != "" {
		req.Header.Set("X-App-Token", c.appToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("soda client execute request to %s: %w", reqURL.String(), err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("soda client read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("soda client http status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var records []json.RawMessage
	if err := json.Unmarshal(bodyBytes, &records); err != nil {
		return nil, fmt.Errorf("soda client unmarshal json response: %w (body: %s)", err, string(bodyBytes))
	}

	return records, nil
}

// FetchAll consume el recurso paginando con $limit y $offset hasta agotar los registros.
func (c *HTTPClient) FetchAll(ctx context.Context, resourceID string, queryParams map[string]string) ([]json.RawMessage, error) {
	limit := DefaultLimit
	offset := 0
	var allRecords []json.RawMessage

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		page, err := c.FetchPage(ctx, resourceID, limit, offset, queryParams)
		if err != nil {
			return nil, fmt.Errorf("soda fetch all at offset %d: %w", offset, err)
		}

		if len(page) == 0 {
			break
		}

		allRecords = append(allRecords, page...)

		if len(page) < limit {
			break
		}

		offset += limit
	}

	return allRecords, nil
}

// FetchAllRaw obtiene todos los registros concatenados en un arreglo JSON en bytes.
func (c *HTTPClient) FetchAllRaw(ctx context.Context, resourceID string, queryParams map[string]string) ([]byte, error) {
	records, err := c.FetchAll(ctx, resourceID, queryParams)
	if err != nil {
		return nil, err
	}
	return json.Marshal(records)
}

// FetchAllInterfaces decodifica todos los registros a una lista de mapas genéricos.
func (c *HTTPClient) FetchAllInterfaces(ctx context.Context, resourceID string, queryParams map[string]string) ([]map[string]any, error) {
	records, err := c.FetchAll(ctx, resourceID, queryParams)
	if err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(records))
	for i, raw := range records {
		var item map[string]any
		if err := json.Unmarshal(raw, &item); err != nil {
			return nil, fmt.Errorf("soda decode item %d to map: %w", i, err)
		}
		result = append(result, item)
	}

	return result, nil
}
