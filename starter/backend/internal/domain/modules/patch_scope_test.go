package modules

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func parse(t *testing.T, s string) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(s), &m))
	return m
}

func mods(reqs []Requirement) []string {
	out := []string{}
	for _, r := range reqs {
		out = append(out, r.Module)
	}
	return out
}

func TestRequirementsForFormulationPatch_OnlyChangedKeysCount(t *testing.T) {
	existing := parse(t, `{"riesgos":{"a":1},"evaluacion":{"v":1},"effects":[],"completedSections":{"riesgos":true}}`)
	// Snapshot completo del frontend: solo cambia "evaluacion".
	incoming := parse(t, `{"riesgos":{"a":1},"evaluacion":{"v":2},"effects":[],"causeRelations":[],"completedSections":{"riesgos":true}}`)

	reqs := RequirementsForFormulationPatch(existing, incoming)
	require.Equal(t, []string{CodeMGAEvaluacion}, mods(reqs))
	require.Equal(t, ActionEdit, reqs[0].Action)
}

func TestRequirementsForFormulationPatch_NoChange(t *testing.T) {
	existing := parse(t, `{"riesgos":{"a":1}}`)
	require.Empty(t, RequirementsForFormulationPatch(existing, existing))
	// ausente == vacío
	require.Empty(t, RequirementsForFormulationPatch(map[string]any{}, parse(t, `{"effects":[],"completedSections":{},"estadoProyecto":"","x":null}`)))
	require.Empty(t, RequirementsForFormulationPatch(map[string]any{}, parse(t, `{"estadoProyecto":"EN_FORMULACION"}`)), "valor por defecto del cliente")
}

func TestRequirementsForFormulationPatch_CompletedSectionsPerTab(t *testing.T) {
	existing := parse(t, `{"completedSections":{"objetivos":true}}`)
	incoming := parse(t, `{"completedSections":{"objetivos":true,"evaluacion":true,"programacion":true}}`)
	require.Equal(t, []string{CodeMGAEvaluacion, CodeMGAProgramacion}, mods(RequirementsForFormulationPatch(existing, incoming)))
}

func TestRequirementsForFormulationPatch_UnknownKeysAreRestrictive(t *testing.T) {
	reqs := RequirementsForFormulationPatch(map[string]any{}, parse(t, `{"algoNuevo":{"x":1},"completedSections":{"tab-rara":true}}`))
	require.Equal(t, []string{CodeMGA}, mods(reqs), "claves y pestañas desconocidas exigen el módulo padre mga")
}

func TestRequirementsForFormulationPatch_MultipleStages(t *testing.T) {
	incoming := parse(t, `{"necesidades":{"x":1},"planDesarrollo":{"y":1},"estadoProyecto":"PRESENTADO"}`)
	require.Equal(t,
		[]string{CodeMGAIdentificacion, CodeMGAPreparacion, CodeMGAPresentar},
		mods(RequirementsForFormulationPatch(map[string]any{}, incoming)))
}

func TestScalarModuleAndMerge(t *testing.T) {
	m, ok := ScalarModule("problem_description")
	require.True(t, ok)
	require.Equal(t, CodeMGAIdentificacion, m)
	m, _ = ScalarModule("name")
	require.Equal(t, CodeProjects, m)
	_, ok = ScalarModule("zzz")
	require.False(t, ok)

	merged := MergeRequirements(
		[]Requirement{{CodeProjects, ActionEdit}, {CodeMGAEvaluacion, ActionEdit}},
		[]Requirement{{CodeMGAEvaluacion, ActionEdit}},
	)
	require.Equal(t, []string{CodeMGAEvaluacion, CodeProjects}, mods(merged))
}

func TestManifestCoversMappedModules(t *testing.T) {
	codes := map[string]bool{}
	for _, d := range Manifest {
		codes[d.Code] = true
	}
	for k, m := range formulationKeyModule {
		require.True(t, codes[m], "clave %s apunta a módulo inexistente %s", k, m)
	}
	for k, m := range tabModule {
		require.True(t, codes[m], "pestaña %s apunta a módulo inexistente %s", k, m)
	}
	for k, m := range scalarModule {
		require.True(t, codes[m], "campo %s apunta a módulo inexistente %s", k, m)
	}
}
