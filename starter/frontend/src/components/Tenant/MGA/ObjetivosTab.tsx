import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, HelpCircle, Minus, Pencil, Plus, PlusCircle, Trash2 } from 'lucide-react';
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

  const formulation = getFormulation(project.id);
  const { causeRelations, generalIndicators } = formulation;

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
      });
      setMessage('Objetivos guardados correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los objetivos');
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
            >
              <textarea
                id={`mga-general-objective-${project.id}`}
                rows={3}
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
                    {generalIndicators.map((ind: GeneralObjectiveIndicator) => (
                      <tr key={ind.id} className="border-b">
                        <td className="p-2 border text-center whitespace-nowrap">
                          <button
                            type="button"
                            className="p-1 bg-[#2980b9] text-white rounded mr-1"
                            aria-label="Editar indicador"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            className="p-1 bg-[#2980b9] text-white rounded"
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
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white text-xs font-semibold rounded"
                >
                  <PlusCircle className="w-4 h-4" /> Adicionar
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
                            className="min-w-[280px]"
                          >
                            <textarea
                              id={`mga-specific-${rel.id}`}
                              rows={2}
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
        <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-[#006162]">
          {message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving || isMgaSaving}
          className="inline-flex items-center gap-1 px-4 py-2 bg-[#2980b9] hover:bg-[#1f6391] disabled:opacity-60 text-white text-sm font-semibold rounded"
        >
          {isSaving || isMgaSaving ? 'Guardando…' : 'Guardar objetivos'}
        </button>
      </div>
    </form>
  );
}
