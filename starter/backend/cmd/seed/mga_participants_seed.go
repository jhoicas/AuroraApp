package main

import (
	"log"
	"time"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SeedMgaParticipantCatalogs inserta los catálogos de actores, posiciones y
// entidades con los IDs oficiales del DNP. Usa ON CONFLICT DO UPDATE para ser
// idempotente (seguro ejecutar múltiples veces).
func SeedMgaParticipantCatalogs(db *gorm.DB) error {
	now := time.Now().UTC()

	// ── 1. Actores ──────────────────────────────────────────────────────────
	actors := []models.MgaCatalogActor{
		{ID: 1, Name: "Nacional", CreatedAt: now, UpdatedAt: now},
		{ID: 2, Name: "Departamental", CreatedAt: now, UpdatedAt: now},
		{ID: 4, Name: "Municipal", CreatedAt: now, UpdatedAt: now},
		{ID: 5, Name: "Embajada", CreatedAt: now, UpdatedAt: now},
		{ID: 6, Name: "Otro", CreatedAt: now, UpdatedAt: now},
		{ID: 7, Name: "Localidad", CreatedAt: now, UpdatedAt: now},
		{ID: 17, Name: "EICE", CreatedAt: now, UpdatedAt: now},
	}
	for _, a := range actors {
		actor := a
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"name", "updated_at"}),
		}).Create(&actor).Error; err != nil {
			return err
		}
	}
	log.Printf("[seed] mga_catalog_actors: %d registros insertados/actualizados", len(actors))

	// ── 2. Posiciones ────────────────────────────────────────────────────────
	positions := []models.MgaCatalogPosition{
		{ID: 1, Name: "Beneficiario", CreatedAt: now, UpdatedAt: now},
		{ID: 2, Name: "Cooperante", CreatedAt: now, UpdatedAt: now},
		{ID: 3, Name: "Oponente", CreatedAt: now, UpdatedAt: now},
		{ID: 4, Name: "Perjudicado", CreatedAt: now, UpdatedAt: now},
	}
	for _, p := range positions {
		pos := p
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"name", "updated_at"}),
		}).Create(&pos).Error; err != nil {
			return err
		}
	}
	log.Printf("[seed] mga_catalog_positions: %d registros insertados/actualizados", len(positions))

	// ── 3. Entidades (mapeo actor_id → entidades) ────────────────────────────
	// Los IDs de entidades se asignan secuencialmente por orden de inserción DNP.
	// actor_id=1 Nacional
	entidades := []models.MgaCatalogEntity{
		// Nacional (actor_id=1)
		{ID: 1, ActorID: 1, Name: "Ministerio de Agricultura y Desarrollo Rural", CreatedAt: now, UpdatedAt: now},
		{ID: 2, ActorID: 1, Name: "Ministerio de Ambiente y Desarrollo Sostenible", CreatedAt: now, UpdatedAt: now},
		{ID: 3, ActorID: 1, Name: "Ministerio de Ciencia, Tecnología e Innovación", CreatedAt: now, UpdatedAt: now},
		{ID: 4, ActorID: 1, Name: "Ministerio de Comercio, Industria y Turismo", CreatedAt: now, UpdatedAt: now},
		{ID: 5, ActorID: 1, Name: "Ministerio de Cultura", CreatedAt: now, UpdatedAt: now},
		{ID: 6, ActorID: 1, Name: "Ministerio de Defensa Nacional", CreatedAt: now, UpdatedAt: now},
		{ID: 7, ActorID: 1, Name: "Ministerio de Educación Nacional", CreatedAt: now, UpdatedAt: now},
		{ID: 8, ActorID: 1, Name: "Ministerio de Hacienda y Crédito Público", CreatedAt: now, UpdatedAt: now},
		{ID: 9, ActorID: 1, Name: "Ministerio de Igualdad y Equidad", CreatedAt: now, UpdatedAt: now},
		{ID: 10, ActorID: 1, Name: "Ministerio de Interior", CreatedAt: now, UpdatedAt: now},
		{ID: 11, ActorID: 1, Name: "Ministerio de Justicia y del Derecho", CreatedAt: now, UpdatedAt: now},
		{ID: 12, ActorID: 1, Name: "Ministerio de Minas y Energía", CreatedAt: now, UpdatedAt: now},
		{ID: 13, ActorID: 1, Name: "Ministerio de Relaciones Exteriores", CreatedAt: now, UpdatedAt: now},
		{ID: 14, ActorID: 1, Name: "Ministerio de Salud y Protección Social", CreatedAt: now, UpdatedAt: now},
		{ID: 15, ActorID: 1, Name: "Ministerio de Tecnologías de la Información y las Comunicaciones", CreatedAt: now, UpdatedAt: now},
		{ID: 16, ActorID: 1, Name: "Ministerio de Transporte", CreatedAt: now, UpdatedAt: now},
		{ID: 17, ActorID: 1, Name: "Ministerio de Vivienda, Ciudad y Territorio", CreatedAt: now, UpdatedAt: now},
		{ID: 18, ActorID: 1, Name: "Ministerio del Deporte", CreatedAt: now, UpdatedAt: now},
		{ID: 19, ActorID: 1, Name: "Ministerio del Trabajo", CreatedAt: now, UpdatedAt: now},
		{ID: 20, ActorID: 1, Name: "Departamento Administrativo de la Función Pública", CreatedAt: now, UpdatedAt: now},
		{ID: 21, ActorID: 1, Name: "Departamento Administrativo Nacional de Estadística (DANE)", CreatedAt: now, UpdatedAt: now},
		{ID: 22, ActorID: 1, Name: "Departamento Nacional de Planeación (DNP)", CreatedAt: now, UpdatedAt: now},
		{ID: 23, ActorID: 1, Name: "Agencia Presidencial de Cooperación Internacional (APC)", CreatedAt: now, UpdatedAt: now},
		// Departamental (actor_id=2)
		{ID: 101, ActorID: 2, Name: "Gobernación de Amazonas", CreatedAt: now, UpdatedAt: now},
		{ID: 102, ActorID: 2, Name: "Gobernación de Antioquia", CreatedAt: now, UpdatedAt: now},
		{ID: 103, ActorID: 2, Name: "Gobernación de Arauca", CreatedAt: now, UpdatedAt: now},
		{ID: 104, ActorID: 2, Name: "Gobernación de Atlántico", CreatedAt: now, UpdatedAt: now},
		{ID: 105, ActorID: 2, Name: "Gobernación de Bolívar", CreatedAt: now, UpdatedAt: now},
		{ID: 106, ActorID: 2, Name: "Gobernación de Boyacá", CreatedAt: now, UpdatedAt: now},
		{ID: 107, ActorID: 2, Name: "Gobernación de Caldas", CreatedAt: now, UpdatedAt: now},
		{ID: 108, ActorID: 2, Name: "Gobernación de Caquetá", CreatedAt: now, UpdatedAt: now},
		{ID: 109, ActorID: 2, Name: "Gobernación de Casanare", CreatedAt: now, UpdatedAt: now},
		{ID: 110, ActorID: 2, Name: "Gobernación de Cauca", CreatedAt: now, UpdatedAt: now},
		{ID: 111, ActorID: 2, Name: "Gobernación de Cesar", CreatedAt: now, UpdatedAt: now},
		{ID: 112, ActorID: 2, Name: "Gobernación de Chocó", CreatedAt: now, UpdatedAt: now},
		{ID: 113, ActorID: 2, Name: "Gobernación de Córdoba", CreatedAt: now, UpdatedAt: now},
		{ID: 114, ActorID: 2, Name: "Gobernación de Cundinamarca", CreatedAt: now, UpdatedAt: now},
		{ID: 115, ActorID: 2, Name: "Gobernación de Guainía", CreatedAt: now, UpdatedAt: now},
		{ID: 116, ActorID: 2, Name: "Gobernación de Guaviare", CreatedAt: now, UpdatedAt: now},
		{ID: 117, ActorID: 2, Name: "Gobernación de Huila", CreatedAt: now, UpdatedAt: now},
		{ID: 118, ActorID: 2, Name: "Gobernación de La Guajira", CreatedAt: now, UpdatedAt: now},
		{ID: 119, ActorID: 2, Name: "Gobernación de Magdalena", CreatedAt: now, UpdatedAt: now},
		{ID: 120, ActorID: 2, Name: "Gobernación de Meta", CreatedAt: now, UpdatedAt: now},
		{ID: 121, ActorID: 2, Name: "Gobernación de Nariño", CreatedAt: now, UpdatedAt: now},
		{ID: 122, ActorID: 2, Name: "Gobernación de Norte de Santander", CreatedAt: now, UpdatedAt: now},
		{ID: 123, ActorID: 2, Name: "Gobernación de Putumayo", CreatedAt: now, UpdatedAt: now},
		{ID: 124, ActorID: 2, Name: "Gobernación de Quindío", CreatedAt: now, UpdatedAt: now},
		{ID: 125, ActorID: 2, Name: "Gobernación de Risaralda", CreatedAt: now, UpdatedAt: now},
		{ID: 126, ActorID: 2, Name: "Gobernación de San Andrés, Providencia y Santa Catalina", CreatedAt: now, UpdatedAt: now},
		{ID: 127, ActorID: 2, Name: "Gobernación de Santander", CreatedAt: now, UpdatedAt: now},
		{ID: 128, ActorID: 2, Name: "Gobernación de Sucre", CreatedAt: now, UpdatedAt: now},
		{ID: 129, ActorID: 2, Name: "Gobernación de Tolima", CreatedAt: now, UpdatedAt: now},
		{ID: 130, ActorID: 2, Name: "Gobernación de Valle del Cauca", CreatedAt: now, UpdatedAt: now},
		{ID: 131, ActorID: 2, Name: "Gobernación de Vaupés", CreatedAt: now, UpdatedAt: now},
		{ID: 132, ActorID: 2, Name: "Gobernación de Vichada", CreatedAt: now, UpdatedAt: now},
		{ID: 133, ActorID: 2, Name: "Alcaldía Mayor de Bogotá D.C.", CreatedAt: now, UpdatedAt: now},
		{ID: 134, ActorID: 2, Name: "Alcaldía de Barranquilla", CreatedAt: now, UpdatedAt: now},
		{ID: 135, ActorID: 2, Name: "Alcaldía de Buenaventura", CreatedAt: now, UpdatedAt: now},
		{ID: 136, ActorID: 2, Name: "Alcaldía de Cartagena de Indias", CreatedAt: now, UpdatedAt: now},
		{ID: 137, ActorID: 2, Name: "Alcaldía de Santa Marta", CreatedAt: now, UpdatedAt: now},
		// Municipal (actor_id=4)
		{ID: 201, ActorID: 4, Name: "Alcaldía Municipal", CreatedAt: now, UpdatedAt: now},
		{ID: 202, ActorID: 4, Name: "Concejo Municipal", CreatedAt: now, UpdatedAt: now},
		{ID: 203, ActorID: 4, Name: "Personería Municipal", CreatedAt: now, UpdatedAt: now},
		{ID: 204, ActorID: 4, Name: "Contraloría Municipal", CreatedAt: now, UpdatedAt: now},
		// Embajada (actor_id=5)
		{ID: 301, ActorID: 5, Name: "Embajada de Alemania", CreatedAt: now, UpdatedAt: now},
		{ID: 302, ActorID: 5, Name: "Embajada de Canada", CreatedAt: now, UpdatedAt: now},
		{ID: 303, ActorID: 5, Name: "Embajada de España", CreatedAt: now, UpdatedAt: now},
		{ID: 304, ActorID: 5, Name: "Embajada de Estados Unidos de América", CreatedAt: now, UpdatedAt: now},
		{ID: 305, ActorID: 5, Name: "Embajada de Francia", CreatedAt: now, UpdatedAt: now},
		{ID: 306, ActorID: 5, Name: "Embajada de Japón", CreatedAt: now, UpdatedAt: now},
		{ID: 307, ActorID: 5, Name: "Embajada de Países Bajos", CreatedAt: now, UpdatedAt: now},
		{ID: 308, ActorID: 5, Name: "Embajada de Reino Unido", CreatedAt: now, UpdatedAt: now},
		{ID: 309, ActorID: 5, Name: "Embajada de Suecia", CreatedAt: now, UpdatedAt: now},
		{ID: 310, ActorID: 5, Name: "Embajada de Suiza", CreatedAt: now, UpdatedAt: now},
		// Localidad (actor_id=7) — Bogotá D.C.
		{ID: 401, ActorID: 7, Name: "Localidad de Usaquén", CreatedAt: now, UpdatedAt: now},
		{ID: 402, ActorID: 7, Name: "Localidad de Chapinero", CreatedAt: now, UpdatedAt: now},
		{ID: 403, ActorID: 7, Name: "Localidad de Santa Fe", CreatedAt: now, UpdatedAt: now},
		{ID: 404, ActorID: 7, Name: "Localidad de San Cristóbal", CreatedAt: now, UpdatedAt: now},
		{ID: 405, ActorID: 7, Name: "Localidad de Usme", CreatedAt: now, UpdatedAt: now},
		{ID: 406, ActorID: 7, Name: "Localidad de Tunjuelito", CreatedAt: now, UpdatedAt: now},
		{ID: 407, ActorID: 7, Name: "Localidad de Bosa", CreatedAt: now, UpdatedAt: now},
		{ID: 408, ActorID: 7, Name: "Localidad de Kennedy", CreatedAt: now, UpdatedAt: now},
		{ID: 409, ActorID: 7, Name: "Localidad de Fontibón", CreatedAt: now, UpdatedAt: now},
		{ID: 410, ActorID: 7, Name: "Localidad de Engativá", CreatedAt: now, UpdatedAt: now},
		{ID: 411, ActorID: 7, Name: "Localidad de Suba", CreatedAt: now, UpdatedAt: now},
		{ID: 412, ActorID: 7, Name: "Localidad de Barrios Unidos", CreatedAt: now, UpdatedAt: now},
		{ID: 413, ActorID: 7, Name: "Localidad de Teusaquillo", CreatedAt: now, UpdatedAt: now},
		{ID: 414, ActorID: 7, Name: "Localidad de Los Mártires", CreatedAt: now, UpdatedAt: now},
		{ID: 415, ActorID: 7, Name: "Localidad de Antonio Nariño", CreatedAt: now, UpdatedAt: now},
		{ID: 416, ActorID: 7, Name: "Localidad de Puente Aranda", CreatedAt: now, UpdatedAt: now},
		{ID: 417, ActorID: 7, Name: "Localidad de La Candelaria", CreatedAt: now, UpdatedAt: now},
		{ID: 418, ActorID: 7, Name: "Localidad de Rafael Uribe Uribe", CreatedAt: now, UpdatedAt: now},
		{ID: 419, ActorID: 7, Name: "Localidad de Ciudad Bolívar", CreatedAt: now, UpdatedAt: now},
		{ID: 420, ActorID: 7, Name: "Localidad de Sumapaz", CreatedAt: now, UpdatedAt: now},
		// EICE (actor_id=17) — Empresas Industriales y Comerciales del Estado
		{ID: 501, ActorID: 17, Name: "Empresa de Acueducto y Alcantarillado de Bogotá (EAAB)", CreatedAt: now, UpdatedAt: now},
		{ID: 502, ActorID: 17, Name: "Empresa de Energía de Bogotá (EEB)", CreatedAt: now, UpdatedAt: now},
		{ID: 503, ActorID: 17, Name: "Empresa de Telecomunicaciones de Bogotá (ETB)", CreatedAt: now, UpdatedAt: now},
		{ID: 504, ActorID: 17, Name: "Empresas Públicas de Medellín (EPM)", CreatedAt: now, UpdatedAt: now},
		{ID: 505, ActorID: 17, Name: "Industrial de Colombia (INDUMIL)", CreatedAt: now, UpdatedAt: now},
		{ID: 506, ActorID: 17, Name: "Servicios Postales Nacionales (4-72)", CreatedAt: now, UpdatedAt: now},
		{ID: 507, ActorID: 17, Name: "Agencia Logística de las Fuerzas Militares", CreatedAt: now, UpdatedAt: now},
	}

	for _, e := range entidades {
		ent := e
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"actor_id", "name", "updated_at"}),
		}).Create(&ent).Error; err != nil {
			return err
		}
	}
	log.Printf("[seed] mga_catalog_entities: %d registros insertados/actualizados", len(entidades))

	return nil
}

// runMgaCatalogSeed ejecuta el seeder desde el punto de entrada del seed package.
// Llámalo desde main() en cmd/seed/main.go.
func runMgaCatalogSeed(db *gorm.DB) {
	if err := SeedMgaParticipantCatalogs(db); err != nil {
		log.Fatalf("[seed] mga participant catalogs: %v", err)
	}
	log.Println("[seed] mga participant catalogs: OK")
}
