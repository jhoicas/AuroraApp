package postgres

import (
	"log"
	"time"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var defaultMeasurementUnits = []struct {
	ID   int
	Name string
}{
	{ID: 544, Name: "Área "},
	{ID: 865, Name: "Bits x segundo"},
	{ID: 864, Name: "Bytes"},
	{ID: 24, Name: "Centímetros cúbicos"},
	{ID: 1, Name: "Día"},
	{ID: 25, Name: "Galones"},
	{ID: 2, Name: "Hectáreas"},
	{ID: 978, Name: "Héctareas"},
	{ID: 3, Name: "Horas"},
	{ID: 849, Name: "Kilogramos"},
	{ID: 4, Name: "Kilómetros"},
	{ID: 1159, Name: "Kilómetros carril"},
	{ID: 19, Name: "Kilómetros cuadrados"},
	{ID: 5, Name: "Kilovatios"},
	{ID: 22, Name: "Litros"},
	{ID: 541, Name: "Longitud"},
	{ID: 6, Name: "Megavatio"},
	{ID: 7, Name: "Mes"},
	{ID: 8, Name: "Metros "},
	{ID: 9, Name: "Metros cuadrados"},
	{ID: 10, Name: "Metros cúbicos"},
	{ID: 26, Name: "Metros lineales"},
	{ID: 1077, Name: "Millas náuticas"},
	{ID: 11, Name: "Millones"},
	{ID: 601, Name: "Millones de pesos"},
	{ID: 12, Name: "Minutos"},
	{ID: 13, Name: "Número"},
	{ID: 1236, Name: "Número de mecanismos"},
	{ID: 18, Name: "Peso m/c"},
	{ID: 14, Name: "Pesos"},
	{ID: 15, Name: "Porcentaje"},
	{ID: 27, Name: "Puntaje"},
	{ID: 20, Name: "Semana"},
	{ID: 16, Name: "Toneladas"},
	{ID: 17, Name: "Unidad"},
	{ID: 542, Name: "Volúmen"},
}

// EnsureMeasurementUnitsSeed inserta las unidades de medida iniciales si la tabla está vacía o faltan registros.
func EnsureMeasurementUnitsSeed(db *gorm.DB) error {
	var count int64
	if err := db.Model(&models.MeasurementUnit{}).Count(&count).Error; err != nil {
		log.Printf("check measurement units count: %v", err)
		return nil
	}

	if count > 0 {
		return nil
	}

	now := time.Now().UTC()
	for _, u := range defaultMeasurementUnits {
		unit := models.MeasurementUnit{
			ID:        u.ID,
			Name:      u.Name,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoNothing: true,
		}).Create(&unit).Error; err != nil {
			log.Printf("seed measurement unit %d (%s): %v", u.ID, u.Name, err)
		}
	}

	log.Printf("seeded %d default measurement units", len(defaultMeasurementUnits))
	return nil
}
