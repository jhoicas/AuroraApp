package postgres

import (
	"log"
	"time"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Datos semilla de los diccionarios DNP. Es la ÚNICA fuente literal de verbos y
// unidades: tras el primer arranque, la tabla es la fuente de verdad y el
// SUPER_ADMIN la administra desde "Diccionarios DNP". Cada tabla se siembra solo
// si está vacía, así que ediciones y eliminaciones del administrador persisten.

const dnpGuideNote = "Guía DNP: Orientaciones para la definición de actividades (2026)"

// dnpStrongVerbsSeed: verbos rectores fuertes. Se excluyen Consolidar, Desarrollar,
// Fortalecer, Implementar, Mejorar y Proponer porque la guía DNP (p. 7) los
// califica expresamente como verbos inadecuados.
var dnpStrongVerbsSeed = []string{
	"Analizar", "Aplicar", "Auditar", "Calcular", "Clasificar", "Comparar", "Comprobar", "Construir",
	"Cuantificar", "Definir", "Demostrar", "Diagnosticar", "Diseñar", "Documentar", "Elaborar", "Ejecutar",
	"Evaluar", "Examinar", "Estructurar", "Establecer", "Estimar", "Formular", "Generar", "Identificar",
	"Inspeccionar", "Integrar", "Levantar", "Medir", "Monitorear", "Organizar", "Planificar", "Preparar",
	"Procesar", "Programar", "Proyectar", "Realizar", "Recopilar", "Registrar", "Reportar", "Revisar",
	"Sistematizar", "Supervisar", "Verificar", "Validar", "Actualizar", "Administrar", "Ajustar", "Alimentar",
	"Asignar", "Caracterizar", "Codificar", "Depurar", "Desagregar", "Detectar", "Determinar", "Digitalizar",
	"Disponer", "Distribuir", "Estandarizar", "Formatear", "Gestionar", "Graficar", "Inventariar", "Jerarquizar",
	"Mapear", "Optimizar", "Ordenar", "Priorizar", "Radicar", "Reconciliar", "Relacionar", "Segmentar",
	"Tabular", "Trazar", "Tramitar", "Transcribir", "Visualizar", "Contrastar", "Corroborar", "Inscribir",
	"Notificar", "Numerar", "Georreferenciar", "Calendarizar", "Cronometrar", "Dimensionar", "Presupuestar",
	"Costear", "Cotizar", "Conciliar", "Liquidar", "Facturar", "Recaudar", "Consignar", "Contabilizar",
	"Cotejar", "Foliar", "Archivar", "Indexar", "Catalogar", "Custodiar", "Remitir", "Responder", "Sustentar",
	"Argumentar", "Conceptuar", "Interpretar", "Sintetizar", "Pronosticar", "Modelar", "Simular", "Calibrar",
	"Ensayar", "Experimentar", "Muestrear", "Fiscalizar", "Controlar", "Vigilar", "Rastrear", "Evidenciar",
	"Certificar", "Acreditar", "Constatar", "Aprobar", "Rechazar", "Observar", "Requerir", "Subsanar",
	"Corregir", "Rectificar", "Modificar", "Reformular", "Reestructurar", "Operar", "Instalar", "Configurar",
	"Parametrizar", "Migrar", "Respaldar", "Restaurar", "Probar", "Desplegar", "Publicar", "Versionar",
	"Mantener", "Reparar", "Prevenir", "Mitigar", "Resolver", "Atender", "Coordinar", "Convocar", "Citar",
	"Agendar", "Articular", "Vincular", "Conectar", "Canalizar", "Derivar", "Escalar", "Comunicar", "Informar",
	"Divulgar", "Socializar", "Presentar", "Exponer", "Capacitar", "Orientar", "Asesorar", "Instruir",
	"Sensibilizar", "Entrenar", "Acompañar", "Facilitar", "Redactar", "Escribir", "Diligenciar", "Formalizar",
	"Suscribir", "Protocolizar", "Legalizar", "Difundir", "Agrupar", "Etiquetar", "Categorizar", "Seleccionar",
	"Filtrar", "Localizar", "Ubicar", "Delimitar", "Precisar", "Especificar", "Ponderar", "Valorar",
	"Correlacionar", "Cruzar", "Justificar", "Entregar", "Producir", "Emitir", "Expedir", "Plantear",
	"Adoptar", "Operacionalizar", "Materializar", "Instrumentar", "Incrementar", "Reducir", "Disminuir",
	"Ampliar", "Aumentar", "Eliminar", "Regular", "Homologar", "Unificar", "Simplificar", "Automatizar",
	"Modernizar", "Innovar", "Transformar", "Adecuar", "Adaptar", "Alinear", "Sincronizar",
}

// dnpWeakVerbsSeed: verbos débiles. Los primeros 14 provienen literalmente de la
// guía DNP (p. 7); el resto son verbos genéricos que ya usaba Aurora y que no
// determinan con claridad la acción a realizar.
var dnpWeakVerbsSeed = []struct {
	Verb string
	Note string
}{
	{"Apropiar", dnpGuideNote}, {"Asegurar", dnpGuideNote}, {"Colaborar", dnpGuideNote},
	{"Consolidar", dnpGuideNote}, {"Desarrollar", dnpGuideNote}, {"Fomentar", dnpGuideNote},
	{"Fortalecer", dnpGuideNote}, {"Garantizar", dnpGuideNote}, {"Implementar", dnpGuideNote},
	{"Impulsar", dnpGuideNote}, {"Mejorar", dnpGuideNote}, {"Movilizar", dnpGuideNote},
	{"Proponer", dnpGuideNote}, {"Promover", dnpGuideNote},
	{"Apoyar", ""}, {"Ayudar", ""}, {"Contribuir", ""}, {"Participar", ""}, {"Potenciar", ""},
	{"Propender", ""}, {"Procurar", ""}, {"Buscar", ""}, {"Velar", ""}, {"Manejar", ""}, {"Tratar", ""},
	{"Hacer", ""}, {"Efectuar", ""}, {"Brindar", ""}, {"Prestar", ""}, {"Ofrecer", ""}, {"Dar", ""},
	{"Tener", ""}, {"Contar", ""}, {"Continuar", ""}, {"Llevar", ""}, {"Adelantar", ""}, {"Adquirir", ""},
	{"Conseguir", ""}, {"Obtener", ""}, {"Lograr", ""}, {"Alcanzar", ""}, {"Cumplir", ""}, {"Solucionar", ""},
	{"Propiciar", ""}, {"Coadyuvar", ""},
}

// dnpStandardUnitsSeed: tipología de unidades de medida autorizadas (guía DNP p. 15).
var dnpStandardUnitsSeed = []models.DnpStandardUnit{
	{Name: "Hectáreas", Symbol: "ha", Typology: models.DnpUnitTypologySuperficie},
	{Name: "Metros cuadrados", Symbol: "m²", Typology: models.DnpUnitTypologySuperficie},
	{Name: "Kilómetros cuadrados", Symbol: "km²", Typology: models.DnpUnitTypologySuperficie},
	{Name: "Metros cúbicos", Symbol: "m³", Typology: models.DnpUnitTypologyVolumen},
	{Name: "Centímetros cúbicos", Symbol: "cm³", Typology: models.DnpUnitTypologyVolumen},
	{Name: "Litros", Symbol: "L", Typology: models.DnpUnitTypologyVolumen},
	{Name: "Mililitro", Symbol: "mL", Typology: models.DnpUnitTypologyVolumen},
	{Name: "Galones", Symbol: "gal", Typology: models.DnpUnitTypologyVolumen},
	{Name: "Mes", Symbol: "mes", Typology: models.DnpUnitTypologyTiempo},
	{Name: "Día", Symbol: "d", Typology: models.DnpUnitTypologyTiempo},
	{Name: "Semana", Symbol: "sem", Typology: models.DnpUnitTypologyTiempo},
	{Name: "Horas", Symbol: "h", Typology: models.DnpUnitTypologyTiempo},
	{Name: "Minutos", Symbol: "min", Typology: models.DnpUnitTypologyTiempo},
	{Name: "Segundo", Symbol: "s", Typology: models.DnpUnitTypologyTiempo},
	{Name: "Metros", Symbol: "m", Typology: models.DnpUnitTypologyLongitud},
	{Name: "Kilómetros", Symbol: "km", Typology: models.DnpUnitTypologyLongitud},
	{Name: "Megavatio", Symbol: "MW", Typology: models.DnpUnitTypologyEnergia},
	{Name: "Kilovatios", Symbol: "kW", Typology: models.DnpUnitTypologyEnergia},
	{Name: "Vatio", Symbol: "W", Typology: models.DnpUnitTypologyEnergia},
	{Name: "Kilogramos", Symbol: "kg", Typology: models.DnpUnitTypologyMasa},
	{Name: "Gramos", Symbol: "g", Typology: models.DnpUnitTypologyMasa},
	{Name: "Miligramo", Symbol: "mg", Typology: models.DnpUnitTypologyMasa},
	{Name: "Toneladas", Symbol: "t", Typology: models.DnpUnitTypologyMasa},
	{Name: "Número", Symbol: "No.", Typology: models.DnpUnitTypologyConteo},
}

// EnsureDnpDictionarySeed puebla dnp_verbs y dnp_standard_units con los valores
// de la guía DNP. Solo siembra tablas vacías y es idempotente (ON CONFLICT DO NOTHING).
func EnsureDnpDictionarySeed(db *gorm.DB) error {
	now := time.Now().UTC()

	var verbCount, unitCount int64
	if err := db.Model(&models.DnpVerb{}).Count(&verbCount).Error; err != nil {
		return err
	}
	if err := db.Model(&models.DnpStandardUnit{}).Count(&unitCount).Error; err != nil {
		return err
	}

	verbs := make([]models.DnpVerb, 0, len(dnpStrongVerbsSeed)+len(dnpWeakVerbsSeed))
	for _, v := range dnpWeakVerbsSeed {
		verbs = append(verbs, models.DnpVerb{
			Verb: models.CanonicalDnpVerb(v.Verb), Kind: models.DnpVerbKindWeak, Notes: v.Note,
			CreatedAt: now, UpdatedAt: now,
		})
	}
	for _, v := range dnpStrongVerbsSeed {
		verbs = append(verbs, models.DnpVerb{
			Verb: models.CanonicalDnpVerb(v), Kind: models.DnpVerbKindStrong,
			CreatedAt: now, UpdatedAt: now,
		})
	}
	if verbCount == 0 {
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "verb"}},
			DoNothing: true,
		}).CreateInBatches(&verbs, 100).Error; err != nil {
			return err
		}
		log.Printf("dnp dictionary seed: seeded %d verbs", len(verbs))
	}

	units := make([]models.DnpStandardUnit, len(dnpStandardUnitsSeed))
	for i, u := range dnpStandardUnitsSeed {
		u.Active = true
		u.CreatedAt = now
		u.UpdatedAt = now
		units[i] = u
	}
	if unitCount == 0 {
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "name"}},
			DoNothing: true,
		}).Create(&units).Error; err != nil {
			return err
		}
		log.Printf("dnp dictionary seed: seeded %d standard units", len(units))
	}
	return nil
}
