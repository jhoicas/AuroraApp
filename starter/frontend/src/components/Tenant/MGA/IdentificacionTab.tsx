import { useCallback, useState } from 'react';
import { HelpCircle, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import { useProjectStore, type Project } from '../../../store/projectStore';
import {
  useProjectMgaStore,
  type CauseObjectiveRelation,
  type EffectType,
} from '../../../store/projectMgaStore';
import type { MgaEffect, MgaEffectType } from '../../../lib/mgaApi';
import MgaAccordion from './MgaAccordion';
import MgaAlert from './MgaAlert';

type IdentificacionTabProps = {
  project: Project;
};

function effectTypeLabel(type: MgaEffectType): EffectType {
  return type === 'directo' ? 'Efecto directo' : 'Efecto indirecto';
}

const EMPTY_EFFECT_DRAFT = {
  effect_type: 'directo' as MgaEffectType,
  description: '',
};

export default function IdentificacionTab({ project }: IdentificacionTabProps) {
  const [accCauses, setAccCauses] = useState(true);
  const [accEffects, setAccEffects] = useState(true);
  const [editingCauseId, setEditingCauseId] = useState<string | null>(null);
  const [causeDraft, setCauseDraft] = useState('');
  const [effectDraft, setEffectDraft] = useState(EMPTY_EFFECT_DRAFT);
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const problemDescription = project.problem_description ?? '';
  const patchCurrentProject = useProjectStore((s) => s.patchCurrentProject);
  const updateProjectDetails = useProjectStore((s) => s.updateProjectDetails);
  const isProjectSaving = useProjectStore((s) => s.isSaving);

  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const updateCauseRelation = useProjectMgaStore((s) => s.updateCauseRelation);
  const addCause = useProjectMgaStore((s) => s.addCause);
  const removeCause = useProjectMgaStore((s) => s.removeCause);
  const addEffect = useProjectMgaStore((s) => s.addEffect);
  const editEffect = useProjectMgaStore((s) => s.editEffect);
  const removeEffect = useProjectMgaStore((s) => s.removeEffect);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const { causeRelations, effects } = getFormulation(project.id);

  const handleSaveProblem = async () => {
    setMessage(null);
    setError(null);
    try {
      await updateProjectDetails(project.id, {
        problem_description: problemDescription,
        general_objective: project.general_objective ?? '',
      });
      setMessage('Problema central guardado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el problema central');
    }
  };

  const startEditCause = useCallback((rel: CauseObjectiveRelation) => {
    setEditingCauseId(rel.id);
    setCauseDraft(rel.causeDescription);
  }, []);

  const saveCauseEdit = async (rel: CauseObjectiveRelation) => {
    setError(null);
    try {
      await updateCauseRelation(project.id, rel.id, { causeDescription: causeDraft });
      setEditingCauseId(null);
      setCauseDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la causa');
    }
  };

  const handleAddCause = async (causeType: 'directa' | 'indirecta') => {
    setError(null);
    try {
      await addCause(project.id, {
        cause_type: causeType,
        description: 'Nueva causa — describa la situación.',
        sort_order: causeRelations.length,
        specific_objective: 'Redacte el objetivo específico asociado.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la causa');
    }
  };

  const handleDeleteCause = async (causeId: string) => {
    if (!window.confirm('¿Eliminar esta causa y su objetivo específico asociado?')) return;
    setError(null);
    try {
      await removeCause(project.id, causeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la causa');
    }
  };

  const resetEffectForm = () => {
    setEffectDraft(EMPTY_EFFECT_DRAFT);
    setEditingEffectId(null);
  };

  const handleSaveEffect = async () => {
    if (!effectDraft.description.trim()) {
      setError('La descripción del efecto es obligatoria.');
      return;
    }
    setError(null);
    try {
      if (editingEffectId) {
        await editEffect(project.id, editingEffectId, {
          effect_type: effectDraft.effect_type,
          description: effectDraft.description.trim(),
        });
      } else {
        await addEffect(project.id, {
          effect_type: effectDraft.effect_type,
          description: effectDraft.description.trim(),
          sort_order: effects.length,
        });
      }
      resetEffectForm();
      setMessage(editingEffectId ? 'Efecto actualizado.' : 'Efecto creado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el efecto');
    }
  };

  const startEditEffect = (effect: MgaEffect) => {
    setEditingEffectId(effect.id);
    setEffectDraft({ effect_type: effect.effect_type, description: effect.description });
  };

  const handleDeleteEffect = async (effectId: string) => {
    if (!window.confirm('¿Eliminar este efecto?')) return;
    setError(null);
    try {
      await removeEffect(project.id, effectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el efecto');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Identificación del problema</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      <div className="space-y-3 text-xs">
        <AIAssistedField
          label="Problema central"
          htmlFor={`mga-problem-${project.id}`}
          required
          guidance="El problema central es la situación negativa que el proyecto busca atenuar. Debe ser verificable, sin incluir soluciones, y coherente con el árbol de problemas MGA."
          askPrompt={`¿Cómo redacto el problema central del proyecto "${project.name}" según la metodología MGA del DNP?`}
        >
          <textarea
            id={`mga-problem-${project.id}`}
            rows={4}
            value={problemDescription}
            onChange={(e) => patchCurrentProject({ problem_description: e.target.value })}
            className="w-full p-2 border rounded bg-white text-xs"
            placeholder="Describa el problema central…"
          />
        </AIAssistedField>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={isProjectSaving}
            onClick={() => void handleSaveProblem()}
            className="px-4 py-1.5 bg-[#2980b9] hover:bg-[#1f6391] disabled:opacity-60 text-white text-xs font-semibold rounded"
          >
            {isProjectSaving ? 'Guardando…' : 'Guardar problema central'}
          </button>
        </div>
      </div>

      <MgaAccordion
        number="01"
        title="Causas directas e indirectas"
        open={accCauses}
        onToggle={() => setAccCauses((v) => !v)}
      >
        <div className="space-y-3">
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-left">
              <thead className="bg-[#6c757d] text-white">
                <tr>
                  <th className="p-2 border">Acciones</th>
                  <th className="p-2 border">Tipo</th>
                  <th className="p-2 border">Descripción de la causa</th>
                </tr>
              </thead>
              <tbody>
                {causeRelations.map((rel) => {
                  const isEditing = editingCauseId === rel.id;
                  return (
                    <tr key={rel.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 border text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            isEditing ? void saveCauseEdit(rel) : startEditCause(rel)
                          }
                          disabled={isSaving}
                          className="p-1 bg-[#2980b9] text-white rounded mr-1 disabled:opacity-60"
                          aria-label={isEditing ? 'Guardar causa' : 'Editar causa'}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCause(rel.id)}
                          disabled={isSaving}
                          className="p-1 bg-[#2980b9] text-white rounded disabled:opacity-60"
                          aria-label="Eliminar causa"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="p-2 border font-semibold whitespace-nowrap">{rel.causeType}</td>
                      <td className="p-2 border">
                        {isEditing ? (
                          <AIAssistedField
                            label="Descripción de la causa"
                            htmlFor={`cause-desc-${rel.id}`}
                            compact
                            guidance="Describa la causa como un factor que contribuye al problema central. Diferencie causas directas (inmediatas) de indirectas (estructurales)."
                            askPrompt={`Para el problema "${problemDescription.slice(0, 80)}", ¿cómo redacto una ${rel.causeType.toLowerCase()} según MGA?`}
                          >
                            <textarea
                              id={`cause-desc-${rel.id}`}
                              rows={2}
                              value={causeDraft}
                              onChange={(e) => setCauseDraft(e.target.value)}
                              className="w-full p-1 border rounded bg-white"
                            />
                          </AIAssistedField>
                        ) : (
                          rel.causeDescription
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleAddCause('directa')}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#2e7d32] text-white text-xs font-semibold rounded disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4" /> Causa directa
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleAddCause('indirecta')}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#2980b9] text-white text-xs font-semibold rounded disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4" /> Causa indirecta
            </button>
          </div>
        </div>
      </MgaAccordion>

      <MgaAccordion
        number="02"
        title="Efectos directos e indirectos"
        open={accEffects}
        onToggle={() => setAccEffects((v) => !v)}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="font-semibold text-gray-600 block mb-1">Tipo de efecto</label>
              <select
                value={effectDraft.effect_type}
                onChange={(e) =>
                  setEffectDraft((d) => ({
                    ...d,
                    effect_type: e.target.value as MgaEffectType,
                  }))
                }
                className="w-full p-2 border rounded bg-white"
              >
                <option value="directo">Efecto directo</option>
                <option value="indirecto">Efecto indirecto</option>
              </select>
            </div>
          </div>

          <AIAssistedField
            label="Descripción del efecto"
            htmlFor={`effect-desc-${project.id}`}
            required
            compact
            guidance="Los efectos son consecuencias del problema central. Los directos se manifiestan de inmediato; los indirectos son de mediano o largo plazo."
            askPrompt={`¿Cómo redacto un ${effectTypeLabel(effectDraft.effect_type).toLowerCase()} asociado al problema del proyecto "${project.name}"?`}
          >
            <textarea
              id={`effect-desc-${project.id}`}
              rows={3}
              value={effectDraft.description}
              onChange={(e) => setEffectDraft((d) => ({ ...d, description: e.target.value }))}
              className="w-full p-2 border rounded bg-white"
              placeholder="Describa el efecto…"
            />
          </AIAssistedField>

          <div className="flex flex-wrap gap-2 justify-end">
            {editingEffectId && (
              <button
                type="button"
                onClick={resetEffectForm}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded"
              >
                Cancelar edición
              </button>
            )}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSaveEffect()}
              className="px-4 py-1.5 bg-[#2980b9] text-white text-xs font-semibold rounded disabled:opacity-60"
            >
              {editingEffectId ? 'Actualizar efecto' : 'Adicionar efecto'}
            </button>
          </div>

          <div className="overflow-x-auto border rounded">
            <table className="w-full text-left">
              <thead className="bg-[#6c757d] text-white">
                <tr>
                  <th className="p-2 border">Acciones</th>
                  <th className="p-2 border">Tipo</th>
                  <th className="p-2 border">Efecto</th>
                </tr>
              </thead>
              <tbody>
                {effects.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-gray-500">
                      No hay efectos registrados.
                    </td>
                  </tr>
                ) : (
                  effects.map((effect) => (
                    <tr key={effect.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 border text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEditEffect(effect)}
                          disabled={isSaving}
                          className="p-1 bg-[#2980b9] text-white rounded mr-1 disabled:opacity-60"
                          aria-label="Editar efecto"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteEffect(effect.id)}
                          disabled={isSaving}
                          className="p-1 bg-[#2980b9] text-white rounded disabled:opacity-60"
                          aria-label="Eliminar efecto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="p-2 border font-semibold whitespace-nowrap">
                        {effectTypeLabel(effect.effect_type)}
                      </td>
                      <td className="p-2 border">{effect.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </MgaAccordion>
    </div>
  );
}
