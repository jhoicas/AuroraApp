package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

type DnpGrouping struct {
	Id   int    `json:"Id"`
	Name string `json:"Name"`
}

type DnpGroupingType struct {
	Id        int           `json:"Id"`
	Name      string        `json:"Name"`
	Groupings []DnpGrouping `json:"Groupings"`
}

type DnpMunicipality struct {
	Id            int               `json:"Id"`
	Name          string            `json:"Name"`
	GroupingTypes []DnpGroupingType `json:"GroupingTypes"`
}

type DnpDepartment struct {
	Id             int               `json:"Id"`
	Name             string            `json:"Name"`
	Completed      bool              `json:"Completed"`
	Municipalities []DnpMunicipality `json:"Municipalities"`
}

type DnpRegion struct {
	Id          int             `json:"Id"`
	Name        string          `json:"Name"`
	Departments []DnpDepartment `json:"Departments"`
}

func SeedMgaLocations(db *gorm.DB) error {
	// Define path to the JSON file
	jsonPath := filepath.Join("cmd", "seed", "data", "dnp_mga_data.json")
	file, err := os.Open(jsonPath)
	if err != nil {
		return fmt.Errorf("failed to open locations JSON file: %w", err)
	}
	defer file.Close()

	var regions []DnpRegion
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&regions); err != nil {
		return fmt.Errorf("failed to parse locations JSON: %w", err)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		// Paso A: Limpieza Previa (TRUNCATE)
		tables := []string{"agrupaciones", "tipos_agrupacion", "municipios", "departamentos", "regiones"}
		for _, table := range tables {
			if err := tx.Exec(fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table)).Error; err != nil {
				return fmt.Errorf("failed to truncate %s: %w", table, err)
			}
		}

		now := time.Now().UTC()
		
		// Map for unique GroupingTypes
		groupingTypesMap := make(map[int]models.TipoAgrupacion)
		
		var dbRegions []models.Region
		var dbDepartments []models.Departamento
		var dbMunicipalities []models.Municipio
		var dbGroupings []models.Agrupacion
		
		// Map structs
		for _, r := range regions {
			dbRegions = append(dbRegions, models.Region{
				ID:        r.Id,
				Name:      r.Name,
				IsActive:  true,
				CreatedAt: now,
				UpdatedAt: now,
			})
			for _, d := range r.Departments {
				dbDepartments = append(dbDepartments, models.Departamento{
					ID:        d.Id,
					Name:      d.Name,
					RegionID:  r.Id,
					IsActive:  true,
					CreatedAt: now,
					UpdatedAt: now,
				})
				for _, m := range d.Municipalities {
					dbMunicipalities = append(dbMunicipalities, models.Municipio{
						ID:             m.Id,
						Name:           m.Name,
						DepartamentoID: d.Id,
						IsActive:       true,
						CreatedAt:      now,
						UpdatedAt:      now,
					})
					for _, gt := range m.GroupingTypes {
						if _, exists := groupingTypesMap[gt.Id]; !exists {
							groupingTypesMap[gt.Id] = models.TipoAgrupacion{
								ID:        gt.Id,
								Name:      gt.Name,
								IsActive:  true,
								CreatedAt: now,
								UpdatedAt: now,
							}
						}
						for _, g := range gt.Groupings {
							dbGroupings = append(dbGroupings, models.Agrupacion{
								ID:               g.Id,
								Name:             g.Name,
								MunicipioID:      m.Id,
								TipoAgrupacionID: gt.Id,
								IsActive:         true,
								CreatedAt:        now,
								UpdatedAt:        now,
							})
						}
					}
				}
			}
		}

		// Insert Regiones
		if len(dbRegions) > 0 {
			if err := tx.CreateInBatches(dbRegions, 100).Error; err != nil {
				return fmt.Errorf("failed to insert regiones: %w", err)
			}
			log.Printf("[seed] %d regiones inserted", len(dbRegions))
		}

		// Insert Departamentos
		if len(dbDepartments) > 0 {
			if err := tx.CreateInBatches(dbDepartments, 100).Error; err != nil {
				return fmt.Errorf("failed to insert departamentos: %w", err)
			}
			log.Printf("[seed] %d departamentos inserted", len(dbDepartments))
		}

		// Insert Municipios
		if len(dbMunicipalities) > 0 {
			if err := tx.CreateInBatches(dbMunicipalities, 100).Error; err != nil {
				return fmt.Errorf("failed to insert municipios: %w", err)
			}
			log.Printf("[seed] %d municipios inserted", len(dbMunicipalities))
		}

		// Insert Tipos de Agrupacion
		var dbGroupingTypes []models.TipoAgrupacion
		for _, gt := range groupingTypesMap {
			dbGroupingTypes = append(dbGroupingTypes, gt)
		}
		if len(dbGroupingTypes) > 0 {
			if err := tx.CreateInBatches(dbGroupingTypes, 100).Error; err != nil {
				return fmt.Errorf("failed to insert tipos_agrupacion: %w", err)
			}
			log.Printf("[seed] %d tipos_agrupacion inserted", len(dbGroupingTypes))
		}

		// Insert Agrupaciones
		if len(dbGroupings) > 0 {
			// Need to set auto-incrementing ID if we just specify ID directly it will attempt to use it.
			// Let's specify it just as we got it from DNP
			if err := tx.CreateInBatches(dbGroupings, 100).Error; err != nil {
				return fmt.Errorf("failed to insert agrupaciones: %w", err)
			}
			log.Printf("[seed] %d agrupaciones inserted", len(dbGroupings))
		}

		return nil
	})
}

func runMgaLocationsSeed(db *gorm.DB) {
	if err := SeedMgaLocations(db); err != nil {
		log.Fatalf("[seed] mga locations catalogs: %v", err)
	}
	log.Println("[seed] mga locations catalogs: OK")
}
