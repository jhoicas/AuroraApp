package models

// AllModels retorna los structs a registrar en AutoMigrate.
// Orden: entidades independientes primero, luego las que dependen de FKs.
func AllModels() []any {
	return []any{
		&Role{},
		&Tenant{},
		&User{},
		&Sector{},
		// Maestros planos antes de las vistas ligeras (Program / Product comparten
		// tabla con ellos): evita que la vista cree la tabla con columnas truncadas.
		&ProgramSubprogram{},
		&CatalogProduct{},
		&Program{},
		&Product{},
		&CatalogEdt{},
		&CatalogDeliverable{},
		&CatalogActivity{},
		&CatalogOds{},
		&Project{},
		&AILog{},
		&AiKnowledgeNode{},
		&AiKnowledgeLink{},
		&AiUsageLog{},
		&AiChatMessage{},
		&ProjectEvaluation{},
		&BudgetItem{},
		&MgaCause{},
		&MgaEffect{},
		&MgaSpecificObjective{},
		&MgaIndicator{},
		&MgaParticipant{},
		&MgaPopulation{},
		&MgaAlternative{},
		&ProjectCatalogLink{},
		&ProjectEdtNode{},
		&ProjectDeliverable{},
		&ProjectActivity{},
	}
}
