package services

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"aurora-backend/internal/config"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewEmbeddingProvider_TableDriven(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		cfg  *config.Config
		want string // mock | hf | ollama
	}{
		{name: "nil config → mock", cfg: nil, want: "mock"},
		{name: "empty provider → mock", cfg: &config.Config{}, want: "mock"},
		{name: "huggingface sin key → mock", cfg: &config.Config{EmbeddingProvider: "huggingface"}, want: "mock"},
		{
			name: "huggingface con key",
			cfg:  &config.Config{EmbeddingProvider: "huggingface", HuggingFaceApiKey: "hf_x", EmbeddingModel: "m"},
			want: "hf",
		},
		{
			name: "ollama",
			cfg:  &config.Config{EmbeddingProvider: "ollama", OllamaBaseURL: "http://localhost:11434", EmbeddingModel: "nomic"},
			want: "ollama",
		},
		{name: "gemini sin key → mock", cfg: &config.Config{EmbeddingProvider: "gemini"}, want: "mock"},
		{
			name: "gemini con key",
			cfg:  &config.Config{EmbeddingProvider: "gemini", GeminiApiKey: "gem_x"},
			want: "gemini",
		},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			p := NewEmbeddingProvider(tt.cfg)
			require.NotNil(t, p)
			assert.Equal(t, DefaultEmbeddingDimensions, p.Dimensions())
			switch tt.want {
			case "mock":
				_, ok := p.(*MockEmbeddingProvider)
				assert.True(t, ok)
			case "hf":
				_, ok := p.(*HuggingFaceEmbeddingProvider)
				assert.True(t, ok)
			case "ollama":
				_, ok := p.(*OllamaEmbeddingProvider)
				assert.True(t, ok)
			case "gemini":
				_, ok := p.(*GeminiEmbeddingProvider)
				assert.True(t, ok)
			}
		})
	}
}

func TestMockEmbedding_EmptyAndDeterministic(t *testing.T) {
	t.Parallel()
	p := NewMockEmbeddingProvider()
	empty, err := p.Embed("")
	require.NoError(t, err)
	assert.Len(t, empty, DefaultEmbeddingDimensions)
	for _, v := range empty {
		assert.Equal(t, float32(0), v)
	}
	a, _ := p.Embed("hola")
	b, _ := p.Embed("hola")
	c, _ := p.Embed("adios")
	assert.Equal(t, a, b)
	assert.NotEqual(t, a, c)
}

func TestParseHFEmbedding_TableDriven(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		raw     string
		wantLen int
		wantErr bool
	}{
		{
			name:    "flat sentence vector",
			raw:     mustJSON(make([]float64, DefaultEmbeddingDimensions)),
			wantLen: DefaultEmbeddingDimensions,
		},
		{
			name: "token matrix mean pool",
			raw: mustJSON([][]float64{
				{1, 2, 3},
				{3, 4, 5},
			}),
			wantLen: 3,
		},
		{
			name:    "invalid json",
			raw:     `{not-json`,
			wantErr: true,
		},
		{
			name: "batch nested vectors",
			raw: mustJSON([][]float64{
				append(make([]float64, DefaultEmbeddingDimensions-1), 1),
			}),
			wantLen: DefaultEmbeddingDimensions,
		},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			vec, err := parseHFEmbedding([]byte(tt.raw))
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Len(t, vec, tt.wantLen)
		})
	}
}

func TestMeanPool_AndNested(t *testing.T) {
	t.Parallel()
	assert.Nil(t, meanPool(nil))
	assert.False(t, isNestedMatrix(nil))
	assert.False(t, isNestedMatrix([][]float64{}))
	assert.True(t, isNestedMatrix([][]float64{{1}, {2}}))
	out := meanPool([][]float64{{2, 4}, {4, 6}})
	assert.InDelta(t, 3, float64(out[0]), 1e-6)
	assert.InDelta(t, 5, float64(out[1]), 1e-6)
}

func TestHuggingFaceEmbed_WithMockServer(t *testing.T) {
	t.Parallel()
	flat := make([]float64, DefaultEmbeddingDimensions)
	for i := range flat {
		flat[i] = 0.1
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer tok", r.Header.Get("Authorization"))
		_ = json.NewEncoder(w).Encode(flat)
	}))
	defer srv.Close()

	p := NewHuggingFaceEmbeddingProvider("tok", "")
	p.client = srv.Client()
	// Reescribir Embed vía URL custom: usamos RoundTripper que redirige
	p.client.Transport = rewriteHost(srv.URL)

	vec, err := p.Embed("texto")
	require.NoError(t, err)
	assert.Len(t, vec, DefaultEmbeddingDimensions)
}

func TestHuggingFaceEmbed_HTTPError(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusBadRequest)
	}))
	defer srv.Close()

	p := NewHuggingFaceEmbeddingProvider("tok", "model-x")
	p.client = &http.Client{Transport: rewriteHost(srv.URL)}
	_, err := p.Embed("x")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "huggingface")
}

func TestHuggingFaceEmbed_WrongDims(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]float64{1, 2, 3})
	}))
	defer srv.Close()
	p := NewHuggingFaceEmbeddingProvider("tok", "m")
	p.client = &http.Client{Transport: rewriteHost(srv.URL)}
	_, err := p.Embed("x")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unexpected embedding dims")
}

func TestGeminiEmbed_PadAndTruncate(t *testing.T) {
	t.Run("default model from env fallback", func(t *testing.T) {
		t.Setenv("GEMINI_EMBEDDING_MODEL", "")
		p := NewGeminiEmbeddingProvider("test-key")
		assert.Equal(t, "gemini-embedding-2", p.model)
	})

	t.Run("custom model from GEMINI_EMBEDDING_MODEL", func(t *testing.T) {
		t.Setenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
		p := NewGeminiEmbeddingProvider("test-key")
		assert.Equal(t, "text-embedding-004", p.model)
	})

	t.Run("truncate 768 dims", func(t *testing.T) {
		t.Setenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2")
		long := make([]float64, 768)
		for i := range long {
			long[i] = float64(i)
		}
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Contains(t, r.URL.Path, "gemini-embedding-2:embedContent")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"embedding": map[string]any{"values": long},
			})
		}))
		defer srv.Close()

		p := NewGeminiEmbeddingProvider("test-key")
		p.client = &http.Client{Transport: rewriteHost(srv.URL)}
		vec, err := p.Embed("hola")
		require.NoError(t, err)
		assert.Len(t, vec, DefaultEmbeddingDimensions)
		assert.Equal(t, float32(0), vec[0])
		assert.Equal(t, float32(383), vec[383])
	})

	t.Run("pad short", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"embedding": map[string]any{"values": []float64{1, 2, 3}},
			})
		}))
		defer srv.Close()

		p := NewGeminiEmbeddingProvider("test-key")
		p.client = &http.Client{Transport: rewriteHost(srv.URL)}
		vec, err := p.Embed("hola")
		require.NoError(t, err)
		assert.Len(t, vec, DefaultEmbeddingDimensions)
		assert.Equal(t, float32(1), vec[0])
	})

	t.Run("missing api key", func(t *testing.T) {
		p := NewGeminiEmbeddingProvider("")
		_, err := p.Embed("x")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "GEMINI_API_KEY")
	})

	t.Run("http error", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "quota", http.StatusTooManyRequests)
		}))
		defer srv.Close()
		p := NewGeminiEmbeddingProvider("test-key")
		p.client = &http.Client{Transport: rewriteHost(srv.URL)}
		_, err := p.Embed("x")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "gemini embedding")
	})

	t.Run("bad json", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`not-json`))
		}))
		defer srv.Close()
		p := NewGeminiEmbeddingProvider("test-key")
		p.client = &http.Client{Transport: rewriteHost(srv.URL)}
		_, err := p.Embed("x")
		require.Error(t, err)
	})
}

func TestOllamaEmbed_PadAndTruncate(t *testing.T) {
	t.Parallel()

	t.Run("pad short", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{"embedding": []float64{1, 2, 3}})
		}))
		defer srv.Close()
		p := NewOllamaEmbeddingProvider(srv.URL, "nomic")
		vec, err := p.Embed("hola")
		require.NoError(t, err)
		assert.Len(t, vec, DefaultEmbeddingDimensions)
		assert.Equal(t, float32(1), vec[0])
	})

	t.Run("truncate long", func(t *testing.T) {
		long := make([]float64, DefaultEmbeddingDimensions+10)
		for i := range long {
			long[i] = float64(i)
		}
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{"embedding": long})
		}))
		defer srv.Close()
		p := NewOllamaEmbeddingProvider(srv.URL, "nomic")
		vec, err := p.Embed("hola")
		require.NoError(t, err)
		assert.Len(t, vec, DefaultEmbeddingDimensions)
	})

	t.Run("http error", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "down", 500)
		}))
		defer srv.Close()
		p := NewOllamaEmbeddingProvider(srv.URL, "nomic")
		_, err := p.Embed("x")
		require.Error(t, err)
	})

	t.Run("bad json", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`not-json`))
		}))
		defer srv.Close()
		p := NewOllamaEmbeddingProvider(srv.URL, "nomic")
		_, err := p.Embed("x")
		require.Error(t, err)
	})
}

type hostRewriter struct {
	base http.RoundTripper
	url  string
}

func rewriteHost(target string) http.RoundTripper {
	return &hostRewriter{base: http.DefaultTransport, url: target}
}

func (h *hostRewriter) RoundTrip(req *http.Request) (*http.Response, error) {
	target, err := http.NewRequest(req.Method, h.url+req.URL.Path, req.Body)
	if err != nil {
		return nil, err
	}
	target.Header = req.Header
	return h.base.RoundTrip(target)
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}
