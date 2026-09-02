package handlers

import (
	"context"
	"errors"
	"sync"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/llm"
	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var errSimulatedDB = errors.New("simulated database failure")

// ---------------------------------------------------------------------------
// KnowledgeStore mock
// ---------------------------------------------------------------------------

type mockKnowledgeStore struct {
	mu sync.Mutex

	insertErr         error
	nodesErr          error
	linksErr          error
	searchErr         error
	nodes             []models.AiKnowledgeNode
	links             []models.AiKnowledgeLink
	similar           []models.AiKnowledgeNode
	lastBatch         postgres.KnowledgeGraphBatch
	insertCall        int
	searchCall        int
	searchByTypesCall int
}

func (m *mockKnowledgeStore) InsertGraph(_ context.Context, batch postgres.KnowledgeGraphBatch) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.insertCall++
	m.lastBatch = batch
	return m.insertErr
}

func (m *mockKnowledgeStore) ListAllNodes(context.Context, *uuid.UUID) ([]models.AiKnowledgeNode, error) {
	return m.nodes, m.nodesErr
}

func (m *mockKnowledgeStore) ListAllLinks(context.Context, *uuid.UUID) ([]models.AiKnowledgeLink, error) {
	return m.links, m.linksErr
}

func (m *mockKnowledgeStore) SearchSimilar(_ context.Context, _ *uuid.UUID, _ []float32, _ int) ([]models.AiKnowledgeNode, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.searchCall++
	return m.similar, m.searchErr
}

func (m *mockKnowledgeStore) SearchSimilarByNodeTypes(_ context.Context, _ []float32, limit int, nodeTypes []string) ([]models.AiKnowledgeNode, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.searchByTypesCall++
	if m.searchErr != nil {
		return nil, m.searchErr
	}
	if limit <= 0 || len(m.similar) == 0 || len(nodeTypes) == 0 {
		return nil, nil
	}
	typeSet := make(map[string]struct{}, len(nodeTypes))
	for _, t := range nodeTypes {
		typeSet[t] = struct{}{}
	}
	filtered := make([]models.AiKnowledgeNode, 0, len(m.similar))
	for _, n := range m.similar {
		if _, ok := typeSet[n.NodeType]; ok {
			filtered = append(filtered, n)
		}
	}
	if limit > len(filtered) {
		limit = len(filtered)
	}
	if limit == 0 {
		return nil, nil
	}
	return filtered[:limit], nil
}

func (m *mockKnowledgeStore) InsertCalls() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.insertCall
}

func (m *mockKnowledgeStore) SearchCalls() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.searchCall
}

func (m *mockKnowledgeStore) SearchByTypesCalls() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.searchByTypesCall
}

func (m *mockKnowledgeStore) LastBatch() postgres.KnowledgeGraphBatch {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.lastBatch
}

// ---------------------------------------------------------------------------
// ChatStore mock
// ---------------------------------------------------------------------------

type mockChatStore struct {
	mu sync.Mutex

	saveErr  error
	listErr  error
	messages []models.AiChatMessage
	total    int64
	saved    []postgres.ChatMessagePair
	lastPage int
	lastSize int
}

func (m *mockChatStore) SavePair(_ context.Context, pair postgres.ChatMessagePair) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.saveErr != nil {
		return m.saveErr
	}
	m.saved = append(m.saved, pair)
	return nil
}

func (m *mockChatStore) ListPaginated(_ context.Context, page, pageSize int) ([]models.AiChatMessage, int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.lastPage, m.lastSize = page, pageSize
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.messages, m.total, nil
}

func (m *mockChatStore) SavedPairs() []postgres.ChatMessagePair {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]postgres.ChatMessagePair, len(m.saved))
	copy(out, m.saved)
	return out
}

// ---------------------------------------------------------------------------
// UsageLogStore mock
// ---------------------------------------------------------------------------

type mockUsageStore struct {
	rows     []postgres.AiUsageLogAuditRow
	total    int64
	err      error
	lastPage int
	lastSize int
}

func (m *mockUsageStore) ListPaginated(_ context.Context, page, pageSize int) ([]postgres.AiUsageLogAuditRow, int64, error) {
	m.lastPage, m.lastSize = page, pageSize
	if m.err != nil {
		return nil, 0, m.err
	}
	return m.rows, m.total, nil
}

// ---------------------------------------------------------------------------
// ProjectFinder mock
// ---------------------------------------------------------------------------

type mockProjectFinder struct {
	project       *models.Project
	err           error
	lastProject   uuid.UUID
	lastTenant    uuid.UUID
	invocations   int
	forceNotFound bool
}

func (m *mockProjectFinder) FindOwned(_ context.Context, projectID, tenantID uuid.UUID) (*models.Project, error) {
	m.invocations++
	m.lastProject, m.lastTenant = projectID, tenantID
	if m.forceNotFound {
		return nil, gorm.ErrRecordNotFound
	}
	if m.err != nil {
		return nil, m.err
	}
	if m.project != nil {
		return m.project, nil
	}
	return &models.Project{ID: projectID, TenantID: tenantID, Name: "Proyecto Test"}, nil
}

// ---------------------------------------------------------------------------
// LLMClient mock (Anthropic)
// ---------------------------------------------------------------------------

type mockLLM struct {
	mu sync.Mutex

	reply        string
	err          error
	model        string
	lastModel    string
	lastSystem   string
	lastMessages []llm.Message
	calls        int
}

func (m *mockLLM) Chat(systemPrompt string, messages []llm.Message) (string, error) {
	return m.ChatWithModel(systemPrompt, messages, m.Model())
}

func (m *mockLLM) ChatWithModel(systemPrompt string, messages []llm.Message, model string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls++
	m.lastSystem = systemPrompt
	m.lastMessages = messages
	m.lastModel = model
	if m.err != nil {
		return "", m.err
	}
	return m.reply, nil
}

func (m *mockLLM) Model() string {
	if m.model == "" {
		return "claude-haiku-4-5-20251001"
	}
	return m.model
}

func (m *mockLLM) LastSystemPrompt() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.lastSystem
}

func (m *mockLLM) Calls() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.calls
}

func (m *mockLLM) LastModel() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.lastModel
}

// ---------------------------------------------------------------------------
// EmbeddingProvider mock
// ---------------------------------------------------------------------------

type mockEmbedder struct {
	err  error
	dims int
}

func (m *mockEmbedder) Dimensions() int {
	if m.dims == 0 {
		return 384
	}
	return m.dims
}

func (m *mockEmbedder) Embed(string) ([]float32, error) {
	if m.err != nil {
		return nil, m.err
	}
	return make([]float32, m.Dimensions()), nil
}

// ---------------------------------------------------------------------------
// EvaluationRepository mock (capa application)
// ---------------------------------------------------------------------------

type mockEvaluationRepo struct {
	saveErr    error
	listErr    error
	latestErr  error
	saved      []models.ProjectEvaluation
	byProject  []models.ProjectEvaluation
	latest     []models.ProjectEvaluation
	lastLimit  int
	saveCalled int
}

func (m *mockEvaluationRepo) SaveBatch(_ context.Context, rows []models.ProjectEvaluation) error {
	m.saveCalled++
	if m.saveErr != nil {
		return m.saveErr
	}
	m.saved = append(m.saved, rows...)
	return nil
}

func (m *mockEvaluationRepo) ListByProject(context.Context, uuid.UUID, uuid.UUID) ([]models.ProjectEvaluation, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	return m.byProject, nil
}

func (m *mockEvaluationRepo) ListLatestByTenant(_ context.Context, _ uuid.UUID, limit int) ([]models.ProjectEvaluation, error) {
	m.lastLimit = limit
	if m.latestErr != nil {
		return nil, m.latestErr
	}
	return m.latest, nil
}
