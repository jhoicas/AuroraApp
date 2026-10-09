package models

import (
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// Tipos de verbo del diccionario DNP (Guía "Orientaciones para la definición de actividades").
const (
	DnpVerbKindStrong = "STRONG"
	DnpVerbKindWeak   = "WEAK"
)

// Tipologías de unidades de medida autorizadas por la guía DNP.
const (
	DnpUnitTypologySuperficie = "SUPERFICIE"
	DnpUnitTypologyVolumen    = "VOLUMEN"
	DnpUnitTypologyTiempo     = "TIEMPO"
	DnpUnitTypologyLongitud   = "LONGITUD"
	DnpUnitTypologyEnergia    = "ENERGIA"
	DnpUnitTypologyMasa       = "MASA"
	DnpUnitTypologyConteo     = "CONTEO"
)

// DnpUnitTypologies lista las tipologías válidas (para validación de entrada).
var DnpUnitTypologies = []string{
	DnpUnitTypologySuperficie, DnpUnitTypologyVolumen, DnpUnitTypologyTiempo,
	DnpUnitTypologyLongitud, DnpUnitTypologyEnergia, DnpUnitTypologyMasa, DnpUnitTypologyConteo,
}

// DnpVerb es un verbo rector del diccionario DNP, clasificado como fuerte o débil.
// Administrable por SUPER_ADMIN; lo consumen la auditoría y el asistente IA.
type DnpVerb struct {
	ID        uint      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Verb      string    `gorm:"column:verb;type:varchar(80);not null;uniqueIndex:idx_dnp_verbs_verb" json:"verb"`
	Kind      string    `gorm:"column:kind;type:varchar(10);not null;index" json:"kind"`
	Notes     string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
}

func (DnpVerb) TableName() string { return "dnp_verbs" }

// DnpStandardUnit es una unidad de medida estándar autorizada por la guía DNP
// para los indicadores de actividad.
type DnpStandardUnit struct {
	ID        uint      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"column:name;type:varchar(120);not null;uniqueIndex:idx_dnp_standard_units_name" json:"name"`
	Symbol    string    `gorm:"column:symbol;type:varchar(20)" json:"symbol"`
	Typology  string    `gorm:"column:typology;type:varchar(20);not null;index" json:"typology"`
	Active    bool      `gorm:"column:active;not null;default:true" json:"active"`
	CreatedAt time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
}

func (DnpStandardUnit) TableName() string { return "dnp_standard_units" }

var dnpAccentReplacer = strings.NewReplacer(
	"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u",
	"Á", "a", "É", "e", "Í", "i", "Ó", "o", "Ú", "u", "Ü", "u",
)

// DnpVerbKey normaliza un verbo para compararlo: minúsculas, sin tildes y sin espacios.
func DnpVerbKey(s string) string {
	return dnpAccentReplacer.Replace(strings.ToLower(strings.TrimSpace(s)))
}

// CanonicalDnpVerb devuelve el verbo con la primera letra en mayúscula y el resto
// en minúscula ("diseñar" -> "Diseñar"), forma con la que se almacena.
func CanonicalDnpVerb(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return s
	}
	r, size := utf8.DecodeRuneInString(s)
	return string(unicode.ToUpper(r)) + s[size:]
}
