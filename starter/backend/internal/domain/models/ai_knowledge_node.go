package models

import (
	"time"

	"github.com/google/uuid"
)

// AiKnowledgeNode fragmento de conocimiento MGA indexado para RAG / grafo IA.
// El embedding vector(384) se persiste vía SQL crudo (pgvector; all-MiniLM-L6-v2).
type AiKnowledgeNode struct {
	ID         uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID   *uuid.UUID `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id,omitempty"`
	ProjectKey string     `gorm:"column:project_key;type:varchar(255);not null;index" json:"project_key"`
	NodeType   string     `gorm:"column:node_type;type:varchar(80);not null;index" json:"node_type"`
	Label      string     `gorm:"column:label;type:varchar(500)" json:"label"`
	Content    string     `gorm:"column:content;type:text;not null" json:"content"`
	Metadata   string     `gorm:"column:metadata;type:jsonb;default:'{}'" json:"metadata"`
	CreatedAt  time.Time  `gorm:"column:created_at;not null" json:"created_at"`
}

func (AiKnowledgeNode) TableName() string {
	return "ai_knowledge_nodes"
}

// AiKnowledgeLink relación semántica entre nodos del grafo MGA.
type AiKnowledgeLink struct {
	ID           uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID     *uuid.UUID `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id,omitempty"`
	ProjectKey   string     `gorm:"column:project_key;type:varchar(255);not null;index" json:"project_key"`
	SourceNodeID uuid.UUID  `gorm:"column:source_node_id;type:uuid;not null;index" json:"source_node_id"`
	TargetNodeID uuid.UUID  `gorm:"column:target_node_id;type:uuid;not null;index" json:"target_node_id"`
	Relationship string     `gorm:"column:relationship;type:varchar(80);not null;index" json:"relationship"`
	CreatedAt    time.Time  `gorm:"column:created_at;not null" json:"created_at"`
}

func (AiKnowledgeLink) TableName() string {
	return "ai_knowledge_links"
}

// Tipos de nodo MGA reconocidos por el parser / grafo.
const (
	KnowledgeNodeProject           = "project"
	KnowledgeNodeCentralProblem    = "central_problem"
	KnowledgeNodeCause             = "cause"
	KnowledgeNodeEffect            = "effect"
	KnowledgeNodeSpecificObjective = "specific_objective"
	KnowledgeNodeAlternative       = "alternative"
	KnowledgeNodeProduct           = "product"
	KnowledgeNodeActivity          = "activity"
)

// Relaciones semánticas del grafo MGA.
const (
	RelHasProblem     = "has_problem"
	RelHasCause       = "has_cause"
	RelHasEffect      = "has_effect"
	RelHasObjective   = "has_objective"
	RelHasAlternative = "has_alternative"
	RelHasProduct     = "has_product"
	RelHasActivity    = "has_activity"
)
