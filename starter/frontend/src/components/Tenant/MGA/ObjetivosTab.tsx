import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, HelpCircle, Minus, Pencil, Plus, PlusCircle, Trash2, X } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import {
  MGA_INFINITIVE_ASK_SUFFIX,
  MGA_INFINITIVE_GUIDANCE,
} from '../../../lib/mgaObjectiveValidation';
import { useProjectStore, type Project } from '../../../store/projectStore';
import {
  useProjectMgaStore,
  type CauseObjectiveRelation,
  type GeneralObjectiveIndicator,
} from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import type { ProjectContext } from '../../../data/mgaFieldsKnowledge';

type ObjetivosTabProps = {
  project: Project;
  /** Cuando el shell padre ya cargó la formulación, evita un segundo fetch. */
  skipInitialFetch?: boolean;
};

export default function ObjetivosTab({ project, skipInitialFetch = false }: ObjetivosTabProps) {
  const [acc1, setAcc1] = useState(true);
  const [acc2, setAcc2] = useState(true);
  const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
  const [draftObjectives, setDraftObjectives] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const generalObjective = project.general_objective ?? '';
  const problemDescription = project.problem_description ?? '';

  const patchCurrentProject = useProjectStore((s) => s.patchCurrentProject);
  const updateProjectDetails = useProjectStore((s) => s.updateProjectDetails);
  const isSaving = useProjectStore((s) => s.isSaving);

  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const fetchFormulation = useProjectMgaStore((s) => s.fetchFormulation);
  const seedDefaultFormulation = useProjectMgaStore((s) => s.seedDefaultFormulation);
  const updateSpecificObjective = useProjectMgaStore((s) => s.updateSpecificObjective);
  const isMgaLoading = useProjectMgaStore((s) => s.isLoading);
  const isMgaSaving = useProjectMgaStore((s) => s.isSaving);
  const mgaError = useProjectMgaStore((s) => s.error);
  const clearMgaError = useProjectMgaStore((s) => s.clearError);
  const saveObjetivos = useProjectMgaStore((s) => s.saveObjetivos);
  const createIndicator = useProjectMgaStore((s) => s.createIndicator);
  const editIndicator = useProjectMgaStore((s) => s.editIndicator);
  const deleteIndicator = useProjectMgaStore((s) => s.deleteIndicator);

  const formulation = getFormulation(project.id);
  const { causeRelations, generalIndicators, effects = [] } = formulation;

  const problemDesc = project.problem_description?.trim() || '';
  const hasDirectCauses = causeRelations.some((c) => c.causeType === 'Causa directa' && c.causeDescription?.trim());
  const hasIndirectCauses = causeRelations.some((c) => c.causeType === 'Causa indirecta' && c.causeDescription?.trim());
  const hasDirectEffects = effects.some((e) => e.effect_type === 'directo' && e.description?.trim());
  const hasIndirectEffects = effects.some((e) => e.effect_type === 'indirecto' && e.description?.trim());
  const isProblemTreeComplete = Boolean(
    problemDesc && hasDirectCauses && hasIndirectCauses && hasDirectEffects && hasIndirectEffects
  );

  const fieldProjectContext: ProjectContext = useMemo(
    () => ({
      projectName: project.name,
      sector: project.sector ?? undefined,
      productCode: project.product_code ?? undefined,
      problemDescription,
      generalObjective,
      objeto: (project as any)?.objeto ?? undefined,
    }),
    [project.name, project.sector, project.product_code, problemDescription, generalObjective, (project as any)?.objeto],
  );

  useEffect(() => {
    if (skipInitialFetch) {
      setIsInitializing(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsInitializing(true);
      clearMgaError();
      try {
        const loaded = await fetchFormulation(project.id);
        if (cancelled) return;

        if (loaded.causeRelations.length === 0) {
          await seedDefaultFormulation(project.id, problemDescription, generalObjective);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la formulación MGA');
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    clearMgaError,
    fetchFormulation,
    generalObjective,
    problemDescription,
    project.id,
    seedDefaultFormulation,
    skipInitialFetch,
  ]);

  const toggleEditing = useCallback(
    async (relation: CauseObjectiveRelation) => {
      const isEditing = Boolean(editingIds[relation.id]);

      if (isEditing) {
        const draft = draftObjectives[relation.id] ?? relation.specificObjective;
        try {
          await updateSpecificObjective(project.id, relation.id, draft);
          setEditingIds((prev) => ({ ...prev, [relation.id]: false }));
          setDraftObjectives((prev) => {
            const next = { ...prev };
            delete next[relation.id];
            return next;
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo guardar el objetivo específico');
        }
        return;
      }

      setDraftObjectives((prev) => ({ ...prev, [relation.id]: relation.specificObjective }));
      setEditingIds((prev) => ({ ...prev, [relation.id]: true }));
    },
    [draftObjectives, editingIds, project.id, updateSpecificObjective],
  );

  const handleGeneralObjectiveChange = useCallback(
    (value: string) => {
      patchCurrentProject({ general_objective: value });
    },
    [patchCurrentProject],
  );

  const handleDraftObjectiveChange = useCallback((relationId: string, value: string) => {
    setDraftObjectives((prev) => ({ ...prev, [relationId]: value }));
  }, []);

  const infinitiveAskPrompt = useMemo(
    () =>
      `¿Cómo debería redactar este objetivo para el proyecto "${project.name}"?${MGA_INFINITIVE_ASK_SUFFIX}`,
    [project.name],
  );

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!isProblemTreeComplete) {
      setError(
        'El Árbol de Problemas está incompleto. Según la metodología MGA, debe registrar obligatoriamente el Problema Central, Causas (directas e indirectas) y Efectos (directos e indirectos) en la sección de Problemática antes de guardar los Objetivos.'
      );
      return;
    }

    const pendingEdits = causeRelations.filter((rel) => editingIds[rel.id]);
    try {
      for (const rel of pendingEdits) {
        const draft = draftObjectives[rel.id] ?? rel.specificObjective;
        await updateSpecificObjective(project.id, rel.id, draft);
      }
      setEditingIds({});
      setDraftObjectives({});

      await updateProjectDetails(project.id, {
        problem_description: problemDescription,
        general_objective: generalObjective,
        situacion_existente: project.situacion_existente ?? '',
        magnitud_problema: project.magnitud_problema ?? '',
      });
      await saveObjetivos(project.id);
      setMessage('Objetivos guardados correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los objetivos');
    }
  };

  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);
  const [indicatorForm, setIndicatorForm] = useState({
    name: '',
    unit: '',
    target: '',
    source_type: 'Secundaria',
    verification_source: '',
  });

  const handleOpenAddIndicator = () => {
    setEditingIndicatorId(null);
    setIndicatorForm({
      name: '',
      unit: '',
      target: '',
      source_type: 'Secundaria',
      verification_source: '',
    });
    setShowIndicatorModal(true);
  };

  const handleOpenEditIndicator = (ind: GeneralObjectiveIndicator) => {
    setEditingIndicatorId(ind.id);
    setIndicatorForm({
      name: ind.indicator,
      unit: ind.measuredThrough,
      target: ind.target.replace(/\./g, '').replace(',', '.'),
      source_type: ind.sourceType || 'Secundaria',
      verification_source: ind.verificationSource || '',
    });
    setShowIndicatorModal(true);
  };

  const handleDeleteIndicator = async (id: string) => {
    try {
      await deleteIndicator(project.id, id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando indicador');
    }
  };

  const handleSaveIndicator = async (e: FormEvent) => {
    e.preventDefault();
    if (!indicatorForm.name.trim() || !indicatorForm.unit.trim()) {
      setError('El nombre del indicador y la unidad son obligatorios.');
      return;
    }
    const numTarget = parseFloat(indicatorForm.target) || 0;
    try {
      if (editingIndicatorId) {
        await editIndicator(project.id, editingIndicatorId, {
          name: indicatorForm.name.trim(),
          unit: indicatorForm.unit.trim(),
          target: numTarget,
          source_type: indicatorForm.source_type,
          verification_source: indicatorForm.verification_source.trim(),
        });
      } else {
        await createIndicator(project.id, {
          name: indicatorForm.name.trim(),
          unit: indicatorForm.unit.trim(),
          target: numTarget,
          source_type: indicatorForm.source_type,
          verification_source: indicatorForm.verification_source.trim(),
        });
      }
      setShowIndicatorModal(false);
      setEditingIndicatorId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando indicador');
    }
  };

  if (isInitializing || isMgaLoading) {
    return (
      <div className="bg-white p-6 border rounded-lg text-sm text-gray-500">
        Cargando formulación MGA…
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-4 bg-white p-4 border rounded-lg">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Objetivos generales y específicos</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db] cursor-pointer" aria-hidden />
      </div>

      {!isProblemTreeComplete && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800 space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️ Árbol de Problemas Incompleto</span>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed">
            Para formular los Objetivos según la Metodología de Marco Lógico (MGA), debe registrar primero el Problema Central, las Causas (directas e indirectas) y los Efectos (directos e indirectos) en la pestaña de Problemática.
          </p>
        </div>
      )}

      {(error || mgaError) && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? mgaError}
        </div>
      )}

      {/* 01: Objetivo General e Indicadores */}
      <div className="border border-gray-200 rounded">
        <button
          type="button"
          onClick={() => setAcc1((v) => !v)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 font-semibold text-sm text-gray-700"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2e7d32] text-white text-xs">
              <Check className="w-3 h-3" />
            </span>
            <span>01 - Objetivo general e indicadores de seguimiento</span>
          </div>
          <span className="flex items-center justify-center w-5 h-5 rounded-full border border-gray-400 text-gray-600">
            {acc1 ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          </span>
        </button>

        {acc1 && (
          <div className="p-4 space-y-4 text-xs">
            <div>
              <label className="font-semibold block mb-1 text-gray-500">Problema central</label>
              <div className="p-3 bg-gray-100 border rounded text-gray-600 cursor-not-allowed">
                {problemDescription.trim() || 'Sin problema central registrado.'}
              </div>
              <p className="mt-1 text-[11px] text-gray-500 italic">
                Regla MGA: El Objetivo General debe ser la redacción en positivo del Problema Central.
              </p>
            </div>

            <AIAssistedField
              label="Objetivo general - Propósito"
              htmlFor={`mga-general-objective-${project.id}`}
              required
              compact
              guidance={MGA_INFINITIVE_GUIDANCE}
              askPrompt={infinitiveAskPrompt}
              validationRule="infinitive-verb"
              validationValue={generalObjective}
              fieldHelpKey="general_objective"
              projectContext={fieldProjectContext}
              reactiveContext={{ generalObjective }}
              currentValue={generalObjective}
              onAutoFill={(v) => handleGeneralObjectiveChange(v)}
              maxLength={250}
            >
              <textarea spellCheck={true}
                id={`mga-general-objective-${project.id}`}
                rows={3}
                maxLength={250}
                value={generalObjective}
                onChange={(e) => handleGeneralObjectiveChange(e.target.value)}
                className="w-full p-2 border rounded bg-white text-xs"
                placeholder="Ej. Mejorar la transitabilidad de la red vial urbana…"
              />
            </AIAssistedField>

            <div className="space-y-2">
              <span className="font-bold text-gray-700 block">
                Indicadores para medir el objetivo general*
              </span>
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#6c757d] text-white">
                    <tr>
                      <th className="p-2 border">Acciones</th>
                      <th className="p-2 border">Indicador objetivo</th>
                      <th className="p-2 border">Medido a través de</th>
                      <th className="p-2 border">Meta</th>
                      <th className="p-2 border">Tipo fuente</th>
                      <th className="p-2 border">Fuente de verificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generalIndicators.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-3 text-center text-gray-500">
                          No hay indicadores registrados. Haga clic en "Adicionar" para registrar uno.
                        </td>
                      </tr>
                    ) : (
                      generalIndicators.map((ind: GeneralObjectiveIndicator) => (
                        <tr key={ind.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 border text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEditIndicator(ind)}
                              className="p-1 bg-[#2980b9] text-white rounded mr-1 hover:bg-[#1f6391]"
                              aria-label="Editar indicador"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteIndicator(ind.id)}
                              className="p-1 bg-red-600 text-white rounded hover:bg-red-700"
                              aria-label="Eliminar indicador"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="p-2 border font-medium">{ind.indicator}</td>
                          <td className="p-2 border">{ind.measuredThrough}</td>
                          <td className="p-2 border font-semibold">{ind.target}</td>
                          <td className="p-2 border">{ind.sourceType}</td>
                          <td className="p-2 border">{ind.verificationSource}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleOpenAddIndicator}
                  className="flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white text-xs font-semibold rounded hover:bg-[#1f6391]"
                >
                  <PlusCircle className="w-4 h-4" /> Adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {showIndicatorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl text-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-gray-800">
                  {editingIndicatorId ? 'Editar Indicador de Objetivo' : 'Adicionar Indicador de Objetivo General'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIndicatorModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="font-semibold block mb-1 text-gray-700">Indicador objetivo *</label>
                  <input
                    type="text"
                    value={indicatorForm.name}
                    onChange={(e) => setIndicatorForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full p-2 border rounded"
                    placeholder="Ej. Tasa de cobertura de acueducto..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1 text-gray-700">Medido a través de (Unidad) *</label>
                    <input
                      type="text"
                      value={indicatorForm.unit}
                      onChange={(e) => setIndicatorForm((f) => ({ ...f, unit: e.target.value }))}
                      className="w-full p-2 border rounded"
                      placeholder="Ej. Porcentaje, Número, Km..."
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1 text-gray-700">Meta *</label>
                    <input
                      type="number"
                      step="any"
                      value={indicatorForm.target}
                      onChange={(e) => setIndicatorForm((f) => ({ ...f, target: e.target.value }))}
                      className="w-full p-2 border rounded"
                      placeholder="Ej. 100"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1 text-gray-700">Tipo de fuente *</label>
                    <select
                      value={indicatorForm.source_type}
                      onChange={(e) => setIndicatorForm((f) => ({ ...f, source_type: e.target.value }))}
                      className="w-full p-2 border rounded bg-white"
                    >
                      <option value="Primaria">Primaria</option>
                      <option value="Secundaria">Secundaria</option>
                      <option value="Registro Administrativo">Registro Administrativo</option>
                      <option value="Estadísticas DANE">Estadísticas DANE</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1 text-gray-700">Fuente de verificación *</label>
                    <input
                      type="text"
                      value={indicatorForm.verification_source}
                      onChange={(e) => setIndicatorForm((f) => ({ ...f, verification_source: e.target.value }))}
                      className="w-full p-2 border rounded"
                      placeholder="Ej. Informes de interventoría, SISBEN..."
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowIndicatorModal(false)}
                  className="px-3 py-1.5 border rounded text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={(e) => void handleSaveIndicator(e)}
                  className="px-4 py-1.5 bg-[#2980b9] text-white font-semibold rounded hover:bg-[#1f6391]"
                >
                  Guardar Indicador
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 02: Relaciones entre causas y objetivos */}
      <div className="border border-gray-200 rounded">
        <button
          type="button"
          onClick={() => setAcc2((v) => !v)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 font-semibold text-sm text-gray-700"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2e7d32] text-white text-xs">
              <Check className="w-3 h-3" />
            </span>
            <span>02 - Relaciones entre las causas y los objetivos</span>
            <span className="text-[11px] text-gray-500 font-normal hidden md:inline">
              (Regla MGA: Las causas directas son directamente proporcionales a los objetivos específicos)
            </span>
          </div>
          <span className="flex items-center justify-center w-5 h-5 rounded-full border border-gray-400 text-gray-600">
            {acc2 ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          </span>
        </button>

        {acc2 && (
          <div className="p-4 overflow-x-auto text-xs">
            <table className="w-full text-left border">
              <thead className="bg-[#6c757d] text-white">
                <tr>
                  <th className="p-2 border">Acciones</th>
                  <th className="p-2 border">Tipo de Causa</th>
                  <th className="p-2 border">Causa relacionada</th>
                  <th className="p-2 border">Objetivos específicos</th>
                </tr>
              </thead>
              <tbody>
                {causeRelations.map((rel: CauseObjectiveRelation) => {
                  const isEditing = Boolean(editingIds[rel.id]);
                  const draftValue = draftObjectives[rel.id] ?? rel.specificObjective;
                  return (
                    <tr key={rel.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 border text-center">
                        <button
                          type="button"
                          onClick={() => void toggleEditing(rel)}
                          disabled={isMgaSaving}
                          className="p-1.5 bg-[#2980b9] text-white rounded hover:bg-[#1f6391] disabled:opacity-60"
                          aria-label={isEditing ? 'Confirmar edición' : 'Editar objetivo específico'}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="p-2 border font-semibold">{rel.causeType}</td>
                      <td className="p-2 border">{rel.causeDescription}</td>
                      <td className="p-2 border">
                        {isEditing ? (
                          <AIAssistedField
                            label="Objetivo específico"
                            htmlFor={`mga-specific-${rel.id}`}
                            compact
                            guidance={MGA_INFINITIVE_GUIDANCE}
                            askPrompt={`Para la causa "${rel.causeDescription.slice(0, 80)}…", ¿cómo redacto el objetivo específico?${MGA_INFINITIVE_ASK_SUFFIX}`}
                            validationRule="infinitive-verb"
                            validationValue={draftValue}
                            fieldHelpKey={`specific_objective_${rel.id}`}
                            projectContext={fieldProjectContext}
                            reactiveContext={{ draftValue, causeDescription: rel.causeDescription }}
                            currentValue={draftValue}
                            className="min-w-[280px]"
                            onAutoFill={(val) => handleDraftObjectiveChange(rel.id, val)}
                            maxLength={2000}
                          >
                            <textarea spellCheck={true}
                              id={`mga-specific-${rel.id}`}
                              rows={2}
                              maxLength={2000}
                              value={draftValue}
                              onChange={(e) => handleDraftObjectiveChange(rel.id, e.target.value)}
                              className="w-full p-1 border rounded bg-white text-xs"
                            />
                          </AIAssistedField>
                        ) : (
                          <span className="text-gray-800">{rel.specificObjective}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {message && (
        <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />
      )}

      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
        <button 
          type="submit"
          disabled={isSaving || isMgaSaving}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {(isSaving || isMgaSaving) ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          Guardar Objetivos
        </button>
      </div>
    </form>
  );
}
