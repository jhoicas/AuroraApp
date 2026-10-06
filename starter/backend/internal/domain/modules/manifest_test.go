package modules

import (
	"strings"
	"testing"

	"aurora-backend/internal/domain/constants"

	"github.com/stretchr/testify/require"
)

func TestManifest_IsValid(t *testing.T) {
	require.NoError(t, Validate(Manifest))
}

func TestManifest_NoDuplicateCodesOrRoutes(t *testing.T) {
	codes := map[string]bool{}
	routes := map[string]bool{}
	for _, d := range Manifest {
		require.False(t, codes[d.Code], "código duplicado %s", d.Code)
		require.False(t, routes[d.Route], "ruta duplicada %s", d.Route)
		codes[d.Code], routes[d.Route] = true, true
	}
}

func TestManifest_NoOrphanParents(t *testing.T) {
	codes := map[string]bool{}
	for _, d := range Manifest {
		codes[d.Code] = true
	}
	for _, d := range Manifest {
		if d.Parent != "" {
			require.True(t, codes[d.Parent], "%s tiene padre huérfano %s", d.Code, d.Parent)
		}
	}
}

func TestManifest_MGAHasFiveStageSections(t *testing.T) {
	n := 0
	for _, d := range Manifest {
		if d.Parent == CodeMGA {
			require.Equal(t, KindSection, d.Kind)
			n++
		}
	}
	require.Equal(t, 5, n, "D6: la MGA se controla por 5 etapas")
}

func TestManifest_SortedParentsFirst(t *testing.T) {
	seen := map[string]bool{}
	for _, d := range Sorted(Manifest) {
		if d.Parent != "" {
			require.True(t, seen[d.Parent], "%s aparece antes que su padre %s", d.Code, d.Parent)
		}
		seen[d.Code] = true
	}
}

func TestManifest_NonAdminRolesKeepViewOnTenantModules(t *testing.T) {
	for _, d := range Manifest {
		if d.Scope != ScopeTenant || d.Code == CodeUsers {
			continue
		}
		for _, role := range NonAdminRoles() {
			a, ok := d.EffectiveDefaults(role)
			if d.Code == CodeAI && role == constants.RoleViewer {
				// el visualizador conserva lectura del asistente
				require.True(t, ok && a.View)
				continue
			}
			require.True(t, ok && a.View, "%s/%s debe conservar View", d.Code, role)
		}
	}
}

func TestManifest_UsersModuleOnlyForTenantAdmin(t *testing.T) {
	var users Def
	for _, d := range Manifest {
		if d.Code == CodeUsers {
			users = d
		}
	}
	for _, role := range NonAdminRoles() {
		_, ok := users.EffectiveDefaults(role)
		require.False(t, ok)
	}
	a, ok := users.EffectiveDefaults(constants.RoleTenantAdmin)
	require.True(t, ok)
	require.Equal(t, Full, a)
}

func TestValidate_DetectsProblems(t *testing.T) {
	mod := func(code string) Def {
		return Def{Code: code, Name: code, Kind: KindModule, Scope: ScopeTenant, Route: "/" + code}
	}
	sec := func(code, parent string) Def {
		return Def{Code: code, Name: code, Kind: KindSection, Scope: ScopeTenant, Parent: parent, Route: "/" + code}
	}

	cases := []struct {
		name string
		defs []Def
		want string
	}{
		{"duplicado", []Def{mod("a"), {Code: "a", Name: "x", Kind: KindModule, Scope: ScopeTenant, Route: "/otra"}}, "duplicado"},
		{"ruta duplicada", []Def{mod("a"), {Code: "b", Name: "b", Kind: KindModule, Scope: ScopeTenant, Route: "/a"}}, "ruta duplicada"},
		{"huérfano", []Def{mod("a"), sec("s", "zzz")}, "huérfano"},
		{"sección sin padre", []Def{sec("s", "")}, "sin padre"},
		{"raíz con padre", []Def{mod("a"), {Code: "b", Name: "b", Kind: KindModule, Scope: ScopeTenant, Parent: "a", Route: "/b"}}, "no puede tener padre"},
		{"padre sección", []Def{mod("a"), sec("s", "a"), sec("t", "s")}, "debe ser MODULE"},
		{"ciclo", []Def{
			{Code: "a", Name: "a", Kind: KindSection, Scope: ScopeTenant, Parent: "b", Route: "/a"},
			{Code: "b", Name: "b", Kind: KindSection, Scope: ScopeTenant, Parent: "a", Route: "/b"},
		}, "debe ser MODULE"}, // un ciclo entre secciones se rechaza ya por la regla de jerarquía
		{"ruta inválida", []Def{{Code: "a", Name: "a", Kind: KindModule, Scope: ScopeTenant, Route: "x"}}, "empezar con '/'"},
		{"rol desconocido", []Def{{Code: "a", Name: "a", Kind: KindModule, Scope: ScopeTenant, Route: "/a", Defaults: map[string]Actions{"X": V}}}, "rol desconocido"},
		{"scope padre", []Def{mod("a"), {Code: "s", Name: "s", Kind: KindSection, Scope: ScopePlatform, Parent: "a", Route: "/s"}}, "scope distinto"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := Validate(tc.defs)
			require.Error(t, err)
			require.True(t, strings.Contains(err.Error(), tc.want), "got %q, want contains %q", err.Error(), tc.want)
		})
	}
}

func TestValidate_DetectsSelfParentCycle(t *testing.T) {
	// Un nodo raíz apuntando a sí mismo viola la regla de raíz sin padre.
	err := Validate([]Def{{Code: "a", Name: "a", Kind: KindModule, Scope: ScopeTenant, Parent: "a", Route: "/a"}})
	require.Error(t, err)
}
