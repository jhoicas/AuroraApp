package admin

import (
	"fmt"
	"strings"

	"aurora-backend/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DivipolaSyncService struct {
	db *gorm.DB
}

func NewDivipolaSyncService(db *gorm.DB) *DivipolaSyncService {
	return &DivipolaSyncService{db: db}
}

func (s *DivipolaSyncService) SyncDivipola(records []map[string]interface{}) error {
	departmentsMap := make(map[string]*models.Department)
	
	type MunTemp struct {
		Mun     *models.Municipality
		DepCode string
	}
	var municipalitiesList []MunTemp

	for _, rec := range records {
		depCode := getStringValue(rec, "codigo_departamento")
		depName := getStringValue(rec, "nombre_departamento")
		munCode := getStringValue(rec, "codigo_municipio")
		munName := getStringValue(rec, "nombre_municipio")

		if depCode == "" || munCode == "" {
			continue
		}

		if _, exists := departmentsMap[depCode]; !exists {
			departmentsMap[depCode] = &models.Department{
				Code: depCode,
				Name: depName,
			}
		}

		municipalitiesList = append(municipalitiesList, MunTemp{
			Mun: &models.Municipality{
				Code: munCode,
				Name: munName,
			},
			DepCode: depCode,
		})
	}

	// 1. Upsert Departments
	deps := make([]models.Department, 0, len(departmentsMap))
	for _, v := range departmentsMap {
		deps = append(deps, *v)
	}

	if len(deps) > 0 {
		err := s.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "code"}},
			DoUpdates: clause.AssignmentColumns([]string{"name", "updated_at"}),
		}).CreateInBatches(&deps, 100).Error
		if err != nil {
			return fmt.Errorf("failed to upsert departments: %w", err)
		}
	}

	// Fetch all departments to map code -> ID
	var allDeps []models.Department
	if err := s.db.Find(&allDeps).Error; err != nil {
		return fmt.Errorf("failed to load departments: %w", err)
	}
	depCodeToID := make(map[string]uint)
	for _, d := range allDeps {
		depCodeToID[d.Code] = d.ID
	}

	// 2. Set DepartmentID in Municipalities and Upsert
	muns := make([]models.Municipality, 0, len(municipalitiesList))
	for _, mt := range municipalitiesList {
		if depID, ok := depCodeToID[mt.DepCode]; ok {
			mt.Mun.DepartmentID = depID
			muns = append(muns, *mt.Mun)
		}
	}

	if len(muns) > 0 {
		err := s.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "code"}},
			DoUpdates: clause.AssignmentColumns([]string{"name", "department_id", "updated_at"}),
		}).CreateInBatches(&muns, 100).Error
		if err != nil {
			return fmt.Errorf("failed to upsert municipalities: %w", err)
		}
	}

	return nil
}

// getStringValue is a local helper or you can use an existing one if available in the package.
func getStringValue(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			return strings.TrimSpace(fmt.Sprintf("%v", v))
		}
	}
	return ""
}
