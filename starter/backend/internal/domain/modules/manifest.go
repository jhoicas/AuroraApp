// Package modules declara el manifiesto de módulos de la plataforma para PBAC
// (ver docs/adr/0001-pbac-modulos-y-permisos.md). Es la fuente de verdad: el
// arranque sincroniza este manifiesto con la tabla `modules` (EnsureModulesSeed).
//
// Para agregar un módulo: añade una entrada a Manifest y sube SeedVersion.
package modules

import (
	"fmt"
	"sort"
	"strings"

	"aurora-backend/internal/domain/constants"
)

// SeedVersion identifica la versión del manifiesto. Súbela cada vez que cambies
// Manifest: el seed solo re-sincroniza módulos con seed_version menor.
const SeedVersion = 1

// Kind de un nodo del manifiesto.
const (
	KindModule  = "MODULE"  // nodo raíz (sin padre)
	KindSection = "SECTION" // hijo de un MODULE (p. ej. etapas de la MGA, D6)
)

// Scope define quién puede recibir el módulo.
const (
	ScopeTenant   = "TENANT"   // asignable a tenants vía tenant_modules
	ScopePlatform = "PLATFORM" // solo SUPER_ADMIN; no se asigna a tenants
)

// Actions son los permisos granulares por módulo (D1).
type Actions struct {
	View   bool
	Create bool
	Edit   bool
	Delete bool
}

var (
	// V solo lectura.
	V = Actions{View: true}
	// VCE ver, crear y editar.
	VCE = Actions{View: true, Create: true, Edit: true}
	// VC ver y crear.
	VC = Actions{View: true, Create: true}
	// VE ver y editar.
	VE = Actions{View: true, Edit: true}
	// Full ver, crear, editar y eliminar.
	Full = Actions{View: true, Create: true, Edit: true, Delete: true}
)

// Def describe un módulo del manifiesto.
type Def struct {
	Code        string
	Name        string
	Description string
	Kind        string
	Scope       string
	Parent      string // código del padre; vacío para MODULE
	Route       string // ruta del frontend (única)
	Order       int
	// Defaults: permisos por rol (code de rol → acciones) usados para
	// RoleModuleDefault y para el backfill de usuarios. SUPER_ADMIN no se lista
	// (omite el chequeo) y TENANT_ADMIN recibe Full en todo módulo TENANT.
	Defaults map[string]Actions
}

// Códigos de módulo.
const (
	CodeProjects = "projects"
	CodeMGA      = "mga"
	CodeCatalog  = "catalog"
	CodeAI       = "ai"
	CodeReports  = "reports"
	CodeUsers    = "users"

	CodeMGAIdentificacion = "mga.identificacion"
	CodeMGAPreparacion    = "mga.preparacion"
	CodeMGAEvaluacion     = "mga.evaluacion"
	CodeMGAProgramacion   = "mga.programacion"
	CodeMGAPresentar      = "mga.presentar"

	CodeAdminTenants  = "admin.tenants"
	CodeAdminCatalogs = "admin.catalogs"
	CodeAdminAI       = "admin.ai"
)

// roles de tenant que no son administradores.
var nonAdminRoles = []string{
	constants.RoleFormulador,
	constants.RoleEvaluador,
	constants.RoleAnalista,
	constants.RoleViewer,
}

// readAll: todos los roles no admin conservan acceso de lectura (no se pierde
// el acceso que tenían antes de PBAC); w define las acciones de escritura.
func defaults(formulador, evaluador, analista, viewer Actions) map[string]Actions {
	return map[string]Actions{
		constants.RoleFormulador: formulador,
		constants.RoleEvaluador:  evaluador,
		constants.RoleAnalista:   analista,
		constants.RoleViewer:     viewer,
	}
}

// Manifest es la declaración de módulos. El orden no importa: Sorted() ordena
// padres antes que hijos.
var Manifest = []Def{
	{Code: CodeProjects, Name: "Proyectos", Description: "Tablero y gestión de proyectos de inversión", Kind: KindModule, Scope: ScopeTenant, Route: "/tenant/projects", Order: 10,
		Defaults: defaults(Full, V, V, V)},

	{Code: CodeMGA, Name: "Formulación MGA", Description: "Formulación de proyectos con la Metodología General Ajustada", Kind: KindModule, Scope: ScopeTenant, Route: "/tenant/projects/:id/formulation", Order: 20,
		Defaults: defaults(VCE, V, V, V)},
	{Code: CodeMGAIdentificacion, Name: "Identificación", Description: "Etapa 1 MGA: identificación del problema", Kind: KindSection, Scope: ScopeTenant, Parent: CodeMGA, Route: "/tenant/projects/:id/formulation#identificacion", Order: 21,
		Defaults: defaults(VCE, V, V, V)},
	{Code: CodeMGAPreparacion, Name: "Preparación", Description: "Etapa 2 MGA: preparación", Kind: KindSection, Scope: ScopeTenant, Parent: CodeMGA, Route: "/tenant/projects/:id/formulation#preparacion", Order: 22,
		Defaults: defaults(VCE, V, V, V)},
	{Code: CodeMGAEvaluacion, Name: "Evaluación", Description: "Etapa 3 MGA: evaluación", Kind: KindSection, Scope: ScopeTenant, Parent: CodeMGA, Route: "/tenant/projects/:id/formulation#evaluacion", Order: 23,
		Defaults: defaults(VCE, VCE, V, V)},
	{Code: CodeMGAProgramacion, Name: "Programación", Description: "Etapa 4 MGA: programación", Kind: KindSection, Scope: ScopeTenant, Parent: CodeMGA, Route: "/tenant/projects/:id/formulation#programacion", Order: 24,
		Defaults: defaults(VCE, V, V, V)},
	{Code: CodeMGAPresentar, Name: "Presentar", Description: "Etapa 5 MGA: presentación del proyecto", Kind: KindSection, Scope: ScopeTenant, Parent: CodeMGA, Route: "/tenant/projects/:id/formulation#presentar", Order: 25,
		Defaults: defaults(VCE, V, V, V)},

	{Code: CodeCatalog, Name: "Catálogo DNP", Description: "Consulta del catálogo oficial del DNP", Kind: KindModule, Scope: ScopeTenant, Route: "/tenant/catalog", Order: 30,
		Defaults: defaults(V, V, V, V)},
	{Code: CodeAI, Name: "Asistente IA", Description: "Exploración MGA y asistente Aurora", Kind: KindModule, Scope: ScopeTenant, Route: "/tenant/ai", Order: 40,
		Defaults: defaults(VCE, VC, VC, V)},
	{Code: CodeReports, Name: "Reportes", Description: "Reportes de inversión y seguimiento", Kind: KindModule, Scope: ScopeTenant, Route: "/tenant/reports", Order: 50,
		Defaults: defaults(V, V, VC, V)},
	{Code: CodeUsers, Name: "Usuarios y permisos", Description: "Administración de usuarios y permisos de la entidad", Kind: KindModule, Scope: ScopeTenant, Route: "/tenant/users", Order: 60,
		Defaults: map[string]Actions{}}, // solo TENANT_ADMIN

	{Code: CodeAdminTenants, Name: "Entidades (tenants)", Description: "Alta, estado y módulos de cada entidad", Kind: KindModule, Scope: ScopePlatform, Route: "/admin/tenants", Order: 100},
	{Code: CodeAdminCatalogs, Name: "Catálogos globales", Description: "Catálogos DNP, MGA y ubicaciones", Kind: KindModule, Scope: ScopePlatform, Route: "/admin/catalogs", Order: 110},
	{Code: CodeAdminAI, Name: "Conocimiento IA", Description: "Gestión de la base de conocimiento de IA", Kind: KindModule, Scope: ScopePlatform, Route: "/admin/ai", Order: 120},
}

// NonAdminRoles devuelve los roles de tenant que reciben defaults por módulo.
func NonAdminRoles() []string {
	return append([]string(nil), nonAdminRoles...)
}

// EffectiveDefaults devuelve los permisos por defecto de un rol para un módulo.
// TENANT_ADMIN recibe Full en módulos TENANT; SUPER_ADMIN no tiene defaults
// (omite el chequeo). ok=false si el rol no tiene permiso alguno.
func (d Def) EffectiveDefaults(role string) (Actions, bool) {
	if d.Scope != ScopeTenant {
		return Actions{}, false
	}
	if role == constants.RoleTenantAdmin {
		return Full, true
	}
	a, ok := d.Defaults[role]
	return a, ok
}

var knownRoles = map[string]struct{}{
	constants.RoleSuperAdmin:  {},
	constants.RoleTenantAdmin: {},
	constants.RoleFormulador:  {},
	constants.RoleEvaluador:   {},
	constants.RoleAnalista:    {},
	constants.RoleViewer:      {},
}

// Validate comprueba la integridad de un manifiesto: sin códigos duplicados ni
// vacíos, sin rutas duplicadas, sin padres huérfanos, sin ciclos, con jerarquía
// MODULE → SECTION de un solo nivel y defaults solo para roles conocidos.
func Validate(defs []Def) error {
	byCode := make(map[string]Def, len(defs))
	routes := make(map[string]string, len(defs))

	for _, d := range defs {
		if strings.TrimSpace(d.Code) == "" || d.Code != strings.TrimSpace(d.Code) {
			return fmt.Errorf("módulo con código vacío o con espacios: %q", d.Code)
		}
		if strings.TrimSpace(d.Name) == "" {
			return fmt.Errorf("módulo %q sin nombre", d.Code)
		}
		if _, dup := byCode[d.Code]; dup {
			return fmt.Errorf("código de módulo duplicado: %q", d.Code)
		}
		byCode[d.Code] = d

		if !strings.HasPrefix(d.Route, "/") {
			return fmt.Errorf("módulo %q: la ruta debe empezar con '/': %q", d.Code, d.Route)
		}
		if other, dup := routes[d.Route]; dup {
			return fmt.Errorf("ruta duplicada %q en %q y %q", d.Route, other, d.Code)
		}
		routes[d.Route] = d.Code

		if d.Kind != KindModule && d.Kind != KindSection {
			return fmt.Errorf("módulo %q: kind inválido %q", d.Code, d.Kind)
		}
		if d.Scope != ScopeTenant && d.Scope != ScopePlatform {
			return fmt.Errorf("módulo %q: scope inválido %q", d.Code, d.Scope)
		}
		for role := range d.Defaults {
			if _, ok := knownRoles[role]; !ok {
				return fmt.Errorf("módulo %q: rol desconocido en defaults: %q", d.Code, role)
			}
			if role == constants.RoleSuperAdmin || role == constants.RoleTenantAdmin {
				return fmt.Errorf("módulo %q: %s no se declara en defaults (se resuelve por rol)", d.Code, role)
			}
		}
	}

	for _, d := range defs {
		switch d.Kind {
		case KindModule:
			if d.Parent != "" {
				return fmt.Errorf("módulo raíz %q no puede tener padre (%q)", d.Code, d.Parent)
			}
		case KindSection:
			if d.Parent == "" {
				return fmt.Errorf("sección %q sin padre", d.Code)
			}
			parent, ok := byCode[d.Parent]
			if !ok {
				return fmt.Errorf("sección %q con padre huérfano %q", d.Code, d.Parent)
			}
			if parent.Kind != KindModule {
				return fmt.Errorf("sección %q: el padre %q debe ser MODULE", d.Code, d.Parent)
			}
			if parent.Scope != d.Scope {
				return fmt.Errorf("sección %q: scope distinto al de su padre %q", d.Code, d.Parent)
			}
		}
	}

	// Ciclos: seguir la cadena de padres con límite de pasos.
	for _, d := range defs {
		seen := map[string]struct{}{d.Code: {}}
		cur := d
		for cur.Parent != "" {
			next, ok := byCode[cur.Parent]
			if !ok {
				return fmt.Errorf("módulo %q con padre huérfano %q", cur.Code, cur.Parent)
			}
			if _, loop := seen[next.Code]; loop {
				return fmt.Errorf("ciclo en la jerarquía de módulos que incluye %q", d.Code)
			}
			seen[next.Code] = struct{}{}
			cur = next
		}
	}
	return nil
}

// Sorted devuelve las definiciones con los padres antes que sus hijos y, a igual
// nivel, por Order y código. Asume un manifiesto válido (ver Validate).
func Sorted(defs []Def) []Def {
	out := append([]Def(nil), defs...)
	sort.SliceStable(out, func(i, j int) bool {
		ri, rj := rank(out[i]), rank(out[j])
		if ri != rj {
			return ri < rj
		}
		if out[i].Order != out[j].Order {
			return out[i].Order < out[j].Order
		}
		return out[i].Code < out[j].Code
	})
	return out
}

func rank(d Def) int {
	if d.Parent == "" {
		return 0
	}
	return 1
}
