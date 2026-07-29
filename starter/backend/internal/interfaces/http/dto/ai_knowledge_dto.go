package dto

type KnowledgeIngestSummary struct {
	ProjectKey        string `json:"project_key"`
	ProjectName       string `json:"project_name"`
	NodesCreated      int    `json:"nodes_created"`
	LinksCreated      int    `json:"links_created"`
	Alternatives      int    `json:"alternatives"`
	Products          int    `json:"products"`
	Activities        int    `json:"activities"`
	Causes            int    `json:"causes"`
	Effects           int    `json:"effects"`
	CentralProblem    bool   `json:"central_problem"`
	SpecificObjective bool   `json:"specific_objective"`
	Message           string `json:"message"`
}

type KnowledgeGraphNode struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Type    string `json:"type"`
	Group   string `json:"group"`
	Content string `json:"content,omitempty"`
}

type KnowledgeGraphLink struct {
	Source       string `json:"source"`
	Target       string `json:"target"`
	Relationship string `json:"relationship"`
}

type KnowledgeGraphResponse struct {
	Nodes []KnowledgeGraphNode `json:"nodes"`
	Links []KnowledgeGraphLink `json:"links"`
}
