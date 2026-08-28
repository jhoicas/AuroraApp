package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type KnowledgeNodeInput struct {
	LocalID   string
	Node      models.AiKnowledgeNode
	Embedding []float32
}

type KnowledgeLinkInput struct {
	SourceLocalID string
	TargetLocalID string
	Link          models.AiKnowledgeLink
}

type KnowledgeGraphBatch struct {
	Nodes []KnowledgeNodeInput
	Links []KnowledgeLinkInput
}

type AiKnowledgeRepository struct {
	db *gorm.DB
}

func NewAiKnowledgeRepository(db *gorm.DB) *AiKnowledgeRepository {
	return &AiKnowledgeRepository{db: db}
}

func (r *AiKnowledgeRepository) InsertGraph(ctx context.Context, batch KnowledgeGraphBatch) error {
	if len(batch.Nodes) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		localToUUID := make(map[string]uuid.UUID, len(batch.Nodes))

		for _, n := range batch.Nodes {
			if n.Node.ID == uuid.Nil {
				n.Node.ID = uuid.New()
			}
			if n.Node.CreatedAt.IsZero() {
				n.Node.CreatedAt = time.Now().UTC()
			}
			if strings.TrimSpace(n.Node.Metadata) == "" {
				n.Node.Metadata = "{}"
			}

			vec := formatVector(n.Embedding)
			sql := `INSERT INTO ai_knowledge_nodes
				(id, tenant_id, project_key, node_type, label, content, metadata, embedding, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::vector, ?)`
			if err := tx.Exec(sql,
				n.Node.ID,
				n.Node.TenantID,
				n.Node.ProjectKey,
				n.Node.NodeType,
				n.Node.Label,
				n.Node.Content,
				n.Node.Metadata,
				vec,
				n.Node.CreatedAt,
			).Error; err != nil {
				return fmt.Errorf("insert knowledge node: %w", err)
			}
			if n.LocalID != "" {
				localToUUID[n.LocalID] = n.Node.ID
			}
		}

		for _, l := range batch.Links {
			src, okSrc := localToUUID[l.SourceLocalID]
			tgt, okTgt := localToUUID[l.TargetLocalID]
			if !okSrc || !okTgt {
				continue
			}
			link := l.Link
			if link.ID == uuid.Nil {
				link.ID = uuid.New()
			}
			if link.CreatedAt.IsZero() {
				link.CreatedAt = time.Now().UTC()
			}
			link.SourceNodeID = src
			link.TargetNodeID = tgt

			if err := tx.Create(&link).Error; err != nil {
				return fmt.Errorf("insert knowledge link: %w", err)
			}
		}
		return nil
	})
}

func (r *AiKnowledgeRepository) ListAllNodes(ctx context.Context, tenantID *uuid.UUID) ([]models.AiKnowledgeNode, error) {
	var rows []models.AiKnowledgeNode
	query := knowledgeTenantScope(r.db.WithContext(ctx), tenantID)
	err := query.Order("created_at ASC").Find(&rows).Error
	return rows, err
}

func (r *AiKnowledgeRepository) ListAllLinks(ctx context.Context, tenantID *uuid.UUID) ([]models.AiKnowledgeLink, error) {
	var rows []models.AiKnowledgeLink
	query := knowledgeTenantScope(r.db.WithContext(ctx), tenantID)
	err := query.Order("created_at ASC").Find(&rows).Error
	return rows, err
}

func (r *AiKnowledgeRepository) SearchSimilar(ctx context.Context, tenantID *uuid.UUID, embedding []float32, limit int) ([]models.AiKnowledgeNode, error) {
	if limit <= 0 {
		limit = 5
	}
	vec := formatVector(embedding)
	var rows []models.AiKnowledgeNode
	query := `
		SELECT id, tenant_id, project_key, node_type, label, content, metadata, created_at
		FROM ai_knowledge_nodes
		WHERE embedding IS NOT NULL AND tenant_id IS NULL
		ORDER BY embedding <=> ?::vector
		LIMIT ?
	`
	args := []any{vec, limit}
	if tenantID != nil {
		query = `
			SELECT id, tenant_id, project_key, node_type, label, content, metadata, created_at
			FROM ai_knowledge_nodes
			WHERE embedding IS NOT NULL
			  AND (tenant_id = ? OR tenant_id IS NULL)
			ORDER BY embedding <=> ?::vector
			LIMIT ?
		`
		args = []any{*tenantID, vec, limit}
	}
	err := r.db.WithContext(ctx).Raw(query, args...).Scan(&rows).Error
	return rows, err
}

// knowledgeTenantScope aplica aislamiento híbrido:
// - tenant: conocimiento privado propio + conocimiento global;
// - identidad global (tenant nil): únicamente conocimiento global.
func knowledgeTenantScope(db *gorm.DB, tenantID *uuid.UUID) *gorm.DB {
	if tenantID == nil {
		return db.Where("tenant_id IS NULL")
	}
	return db.Where("(tenant_id = ? OR tenant_id IS NULL)", *tenantID)
}

func formatVector(v []float32) string {
	if len(v) == 0 {
		return "[]"
	}
	parts := make([]string, len(v))
	for i, f := range v {
		parts[i] = strconv.FormatFloat(float64(f), 'f', 6, 32)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func MergeMetadata(fragMeta map[string]string, projectMeta map[string]string) (string, error) {
	merged := make(map[string]string, len(fragMeta)+len(projectMeta))
	for k, v := range projectMeta {
		merged[k] = v
	}
	for k, v := range fragMeta {
		merged[k] = v
	}
	raw, err := json.Marshal(merged)
	if err != nil {
		return "{}", err
	}
	return string(raw), nil
}

func NodeGroup(projectKey, nodeType string) string {
	return projectKey + ":" + nodeType
}
