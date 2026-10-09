package handlers

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

type identityView struct {
	ID            string `json:"id"`
	ProcesoID     *int   `json:"proceso_id"`
	Tipologia     string `json:"tipologia"`
	TipoInversion string `json:"tipo_inversion"`
}

func (e *locationRuleEnv) getIdentity(t *testing.T, id string) identityView {
	t.Helper()
	resp := doJSON(t, e.app, http.MethodGet, "/projects/"+id, nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var v identityView
	decodeBody(t, resp, &v)
	return v
}

func TestCreateProject_PersisteProcesoTipologiaYTipoInversion(t *testing.T) {
	env := newLocationRuleEnv(t)
	p := env.createProject(t, []map[string]interface{}{loc(76, 76001)})

	var row struct {
		ProcesoID     *int
		Tipologia     string
		TipoInversion string
	}
	require.NoError(t, env.db.Raw(`SELECT proceso_id, tipologia, tipo_inversion FROM projects WHERE id = ?`, p.ID).Scan(&row).Error)
	require.NotNil(t, row.ProcesoID)
	require.Equal(t, 1, *row.ProcesoID)
	require.Equal(t, "General - Esquemas SUIFP", row.Tipologia)
	require.Equal(t, "Infraestructura", row.TipoInversion)

	got := env.getIdentity(t, p.ID)
	require.NotNil(t, got.ProcesoID)
	require.Equal(t, 1, *got.ProcesoID)
	require.Equal(t, "General - Esquemas SUIFP", got.Tipologia)
}

func TestPatch_ProcesoEditableTipologiaYTipoInversionInmutables(t *testing.T) {
	env := newLocationRuleEnv(t)
	p := env.createProject(t, []map[string]interface{}{loc(76, 76001)})

	resp := doJSON(t, env.app, http.MethodPatch, "/projects/"+p.ID, map[string]interface{}{
		"proceso_id":     4,
		"tipologia":      "E - PIIP - Pueblos y Comunidades Indígenas",
		"tipo_inversion": "Nacional",
		"mga_formulation_data": map[string]interface{}{
			"identificacion": map[string]interface{}{"proceso_id": 4, "tipologia": "otra", "tipo_inversion": "Nacional"},
		},
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)

	got := env.getIdentity(t, p.ID)
	require.NotNil(t, got.ProcesoID)
	require.Equal(t, 4, *got.ProcesoID)
	require.Equal(t, "General - Esquemas SUIFP", got.Tipologia)
	require.Equal(t, "Infraestructura", got.TipoInversion)

	full := env.getProject(t, p.ID)
	iden := full.MgaFormulationData["identificacion"].(map[string]interface{})
	require.Equal(t, "General - Esquemas SUIFP", iden["tipologia"])
	require.Equal(t, "Infraestructura", iden["tipo_inversion"])
}
