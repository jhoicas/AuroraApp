package handlers

import (
	"context"
	"net/http"
	"testing"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type auditProjectReader struct {
	project *models.Project
	err     error
}

func (m *auditProjectReader) FindOwned(_ context.Context, _, _ uuid.UUID) (*models.Project, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.project, nil
}

type auditMgaCounter struct {
	causes     int64
	objectives int64
}

func (m *auditMgaCounter) CountCauses(_ context.Context, _, _ uuid.UUID) (int64, error) {
	return m.causes, nil
}

func (m *auditMgaCounter) CountSpecificObjectives(_ context.Context, _, _ uuid.UUID) (int64, error) {
	return m.objectives, nil
}

func newFormulationAuditApp(svc *appproject.FormulationAuditService, id identity) *fiber.App {
	h := NewFormulationAuditHandlerWithDeps(svc)
	app := newTestApp()
	app.Get("/projects/:id/audit", injectIdentity(id), h.GetAuditReport)
	return app
}

func TestGetAuditReport_Passed(t *testing.T) {
	svc := appproject.NewFormulationAuditService(
		&auditProjectReader{project: &models.Project{
			ProblemDescription: "Problema",
			GeneralObjective:   "Objetivo",
		}},
		&auditMgaCounter{causes: 1, objectives: 1},
	)
	app := newFormulationAuditApp(svc, validIdentity())

	resp := doJSON(t, app, http.MethodGet, "/projects/"+uuid.NewString()+"/audit", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body dto.FormulationAuditResponse
	decodeBody(t, resp, &body)
	assert.True(t, body.Passed)
	assert.Empty(t, body.Blockers)
}

func TestGetAuditReport_Blockers(t *testing.T) {
	svc := appproject.NewFormulationAuditService(
		&auditProjectReader{project: &models.Project{}},
		&auditMgaCounter{},
	)
	app := newFormulationAuditApp(svc, validIdentity())

	resp := doJSON(t, app, http.MethodGet, "/projects/"+uuid.NewString()+"/audit", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body dto.FormulationAuditResponse
	decodeBody(t, resp, &body)
	assert.False(t, body.Passed)
	assert.NotEmpty(t, body.Blockers)
}

func TestGetAuditReport_NotFound(t *testing.T) {
	svc := appproject.NewFormulationAuditService(
		&auditProjectReader{err: gorm.ErrRecordNotFound},
		&auditMgaCounter{},
	)
	app := newFormulationAuditApp(svc, validIdentity())

	resp := doJSON(t, app, http.MethodGet, "/projects/"+uuid.NewString()+"/audit", nil)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestGetAuditReport_InvalidProjectID(t *testing.T) {
	svc := appproject.NewFormulationAuditService(&auditProjectReader{}, &auditMgaCounter{})
	app := newFormulationAuditApp(svc, validIdentity())

	resp := doJSON(t, app, http.MethodGet, "/projects/not-a-uuid/audit", nil)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
