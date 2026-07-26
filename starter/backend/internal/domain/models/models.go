package models

// AllModels retorna los structs a registrar en AutoMigrate.
// Orden: entidades independientes primero, luego las que dependen de FKs.
func AllModels() []any {
	return []any{
		&Role{},
		&Tenant{},
		&User{},
		&Sector{},
		&Program{},
		&ProgramSubprogram{},
		&Product{},
		&Project{},
		&AILog{},
		&BudgetItem{},
	}
}
