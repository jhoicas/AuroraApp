import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import { useProjectStore, type Project } from '../../../store/projectStore';
import { useProjectMgaStore, type CauseObjectiveRelation } from '../../../store/projectMgaStore';
import type { MgaEffect } from '../../../lib/mgaApi';
import MgaAlert from './MgaAlert';
import {
  groupCausesByParent,
  groupEffectsByParent,
  type ParentChildGroup,
} from './mgaProblemTree';

type IdentificacionTabProps = {
  project: Project;
};

type EditTarget =
  | { kind: 'effect'; id: string; draft: string }
  | { kind: 'cause'; id: string; draft: string }
  | null;

function NodeActions({
  onEdit,
  onDelete,
  disabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="absolute right-2 top-2 flex gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onEdit}
        className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-50"
        aria-label="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
        aria-label="Eliminar"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function IdentificacionTab({ project }: IdentificacionTabProps) {
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const problemDescription = project.problem_description ?? '';
  const situacionExistente = project.situacion_existente ?? '';
  const magnitudProblema = project.magnitud_problema ?? '';
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

  const effectGroups = useMemo(() => groupEffectsByParent(effects), [effects]);
  const causeGroups = useMemo(() => groupCausesByParent(causeRelations), [causeRelations]);

  const buildDetailsPayload = () => ({
    problem_description: problemDescription,
    general_objective: project.general_objective ?? '',
    situacion_existente: situacionExistente,
    magnitud_problema: magnitudProblema,
  });

  const handleSaveIdentification = async () => {
    setMessage(null);
    setError(null);
    try {
      await updateProjectDetails(project.id, buildDetailsPayload());
      setMessage('Identificación del problema guardada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la identificación');
    }
  };

  const handleAddDirectEffect = async () => {
    setError(null);
    try {
      await addEffect(project.id, {
        effect_type: 'directo',
        description: 'Nuevo efecto directo — describa la consecuencia inmediata.',
        sort_order: effects.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el efecto directo');
    }
  };

  const handleAddIndirectEffect = async (parentId: string) => {
    setError(null);
    try {
      await addEffect(project.id, {
        effect_type: 'indirecto',
        description: 'Nuevo efecto indirecto — describa la consecuencia de mediano o largo plazo.',
        parent_id: parentId,
        sort_order: effects.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el efecto indirecto');
    }
  };

  const handleAddDirectCause = async () => {
    setError(null);
    try {
      await addCause(project.id, {
        cause_type: 'directa',
        description: 'Nueva causa directa — describa el factor inmediato.',
        sort_order: causeRelations.length,
        specific_objective: 'Redacte el objetivo específico asociado.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la causa directa');
    }
  };

  const handleAddIndirectCause = async (parentId: string) => {
    setError(null);
    try {
      await addCause(project.id, {
        cause_type: 'indirecta',
        description: 'Nueva causa indirecta — describa el factor estructural.',
        parent_id: parentId,
        sort_order: causeRelations.length,
        specific_objective: 'Redacte el objetivo específico asociado.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la causa indirecta');
    }
  };

  const saveEffectEdit = async (effect: MgaEffect) => {
    if (!editTarget || editTarget.kind !== 'effect' || editTarget.id !== effect.id) return;
    setError(null);
    try {
      await editEffect(project.id, effect.id, {
        description: editTarget.draft.trim(),
      });
      setEditTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el efecto');
    }
  };

  const saveCauseEdit = async (relation: CauseObjectiveRelation) => {
    if (!editTarget || editTarget.kind !== 'cause' || editTarget.id !== relation.id) return;
    setError(null);
    try {
      await updateCauseRelation(project.id, relation.id, {
        causeDescription: editTarget.draft,
      });
      setEditTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la causa');
    }
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

  const handleDeleteCause = async (causeId: string) => {
    if (!window.confirm('¿Eliminar esta causa y su objetivo específico asociado?')) return;
    setError(null);
    try {
      await removeCause(project.id, causeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la causa');
    }
  };

  const startEditEffect = useCallback((effect: MgaEffect) => {
    setEditTarget({ kind: 'effect', id: effect.id, draft: effect.description });
  }, []);

  const startEditCause = useCallback((relation: CauseObjectiveRelation) => {
    setEditTarget({ kind: 'cause', id: relation.id, draft: relation.causeDescription });
  }, []);

  const renderEffectCard = (effect: MgaEffect, label: string, isIndirect = false) => {
    const isEditing = editTarget?.kind === 'effect' && editTarget.id === effect.id;

    return (
      <div
        key={effect.id}
        className={`relative bg-white p-4 border border-gray-200 rounded-lg shadow-sm ${
          isIndirect ? 'p-3' : ''
        }`}
      >
        <NodeActions
          disabled={isSaving}
          onEdit={() => startEditEffect(effect)}
          onDelete={() => void handleDeleteEffect(effect.id)}
        />
        {isIndirect ? (
          <span className="mb-2 inline-block rounded bg-secondary-container/40 px-2 py-0.5 text-xs font-medium text-primary">
            {label}
          </span>
        ) : (
          <span className="mb-2 block font-bold text-primary">{label}</span>
        )}
        {isEditing ? (
          <div className="space-y-2 pr-10">
            <textarea
              rows={3}
              value={editTarget.draft}
              onChange={(e) =>
                setEditTarget({ kind: 'effect', id: effect.id, draft: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveEffectEdit(effect)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="pr-8 text-sm text-gray-700">{effect.description}</p>
        )}
      </div>
    );
  };

  const renderCauseCard = (relation: CauseObjectiveRelation, label: string, isIndirect = false) => {
    const isEditing = editTarget?.kind === 'cause' && editTarget.id === relation.id;

    return (
      <div
        key={relation.id}
        className={`relative bg-white p-4 border border-gray-200 rounded-lg shadow-sm ${
          isIndirect ? 'p-3' : ''
        }`}
      >
        <NodeActions
          disabled={isSaving}
          onEdit={() => startEditCause(relation)}
          onDelete={() => void handleDeleteCause(relation.id)}
        />
        {isIndirect ? (
          <span className="mb-2 inline-block rounded bg-secondary-container/40 px-2 py-0.5 text-xs font-medium text-primary">
            {label}
          </span>
        ) : (
          <span className="mb-2 block font-bold text-primary">{label}</span>
        )}
        {isEditing ? (
          <div className="space-y-2 pr-10">
            <textarea
              rows={3}
              value={editTarget.draft}
              onChange={(e) =>
                setEditTarget({ kind: 'cause', id: relation.id, draft: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveCauseEdit(relation)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="pr-8 text-sm text-gray-700">{relation.causeDescription}</p>
        )}
      </div>
    );
  };

  const renderTreePanel = <T extends { id: string }>(
    title: string,
    indirectLabel: string,
    groups: ParentChildGroup<T>[],
    renderParent: (item: T, index: number) => ReactNode,
    renderChild: (item: T) => ReactNode,
    onAddIndirect: (parentId: string) => void,
    emptyMessage: string,
  ) => (
    <div className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-5 py-3 font-semibold text-gray-800">
        {title}
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {groups.length === 0 ? (
          <p className="text-center text-sm text-gray-500">{emptyMessage}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-500">
              <span>Directos</span>
              <span>Indirectos</span>
            </div>
            {groups.map((group, index) => (
              <div
                key={group.parent.id}
                className="flex items-start gap-4 border-b border-gray-100 pb-4 last:border-b-0"
              >
                <div className="w-1/2">{renderParent(group.parent, index)}</div>
                <div className="w-1/2 space-y-3 border-l-2 border-dashed border-gray-200 pl-4">
                  {group.children.map((child) => renderChild(child))}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => onAddIndirect(group.parent.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {indirectLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Columna izquierda — Problema central (40%) */}
        <div className="flex w-full flex-col space-y-4 lg:w-[40%]">
          <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <AIAssistedField
              label="Problema central"
              htmlFor={`mga-problem-${project.id}`}
              required
              guidance="El problema central es la situación negativa que el proyecto busca atenuar. Debe ser verificable, sin incluir soluciones, y coherente con el árbol de problemas MGA."
              askPrompt={`¿Cómo redacto el problema central del proyecto "${project.name}" según la metodología MGA del DNP?`}
            >
              <textarea
                id={`mga-problem-${project.id}`}
                value={problemDescription}
                onChange={(e) => patchCurrentProject({ problem_description: e.target.value })}
                className="min-h-[150px] w-full flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-primary"
                placeholder="Describa el problema central…"
              />
            </AIAssistedField>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleAddDirectEffect()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-aurora-dark disabled:opacity-60"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Efecto directo
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleAddDirectCause()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-aurora-dark disabled:opacity-60"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Causa directa
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={isProjectSaving}
                onClick={() => void handleSaveIdentification()}
                className="rounded-lg bg-[#2980b9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f6391] disabled:opacity-60"
              >
                {isProjectSaving ? 'Guardando…' : 'Guardar identificación'}
              </button>
            </div>
          </div>
        </div>

        {/* Columna derecha — Efectos y Causas (60%) */}
        <div className="flex w-full flex-col space-y-6 lg:w-[60%]">
          {renderTreePanel(
            'Efectos',
            'Efecto indirecto',
            effectGroups,
            (item, index) => renderEffectCard(item, `Efecto Directo ${index + 1}`),
            (item) => renderEffectCard(item, 'Efecto Indirecto', true),
            (parentId) => void handleAddIndirectEffect(parentId),
            'No hay efectos registrados. Use [+] Efecto directo desde el problema central.',
          )}

          {renderTreePanel(
            'Causas',
            'Causa indirecta',
            causeGroups,
            (item, index) => renderCauseCard(item, `Causa Directa ${index + 1}`),
            (item) => renderCauseCard(item, 'Causa Indirecta', true),
            (parentId) => void handleAddIndirectCause(parentId),
            'No hay causas registradas. Use [+] Causa directa desde el problema central.',
          )}
        </div>
      </div>

      {/* Campos inferiores — ancho completo */}
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <label
            htmlFor={`mga-situation-${project.id}`}
            className="mb-4 block font-semibold text-gray-800"
          >
            Descripción de la situación existente con respecto al problema
          </label>
          <textarea
            id={`mga-situation-${project.id}`}
            value={situacionExistente}
            onChange={(e) => patchCurrentProject({ situacion_existente: e.target.value })}
            onBlur={() => void handleSaveIdentification()}
            className="min-h-[150px] w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-primary"
            placeholder="Describa el contexto territorial, social o institucional actual…"
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <label
            htmlFor={`mga-magnitude-${project.id}`}
            className="mb-4 block font-semibold text-gray-800"
          >
            Magnitud actual del problema e indicadores de referencia
          </label>
          <textarea
            id={`mga-magnitude-${project.id}`}
            value={magnitudProblema}
            onChange={(e) => patchCurrentProject({ magnitud_problema: e.target.value })}
            onBlur={() => void handleSaveIdentification()}
            className="min-h-[150px] w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-primary"
            placeholder="Indique magnitud, fuentes y línea base del problema…"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={isProjectSaving}
            onClick={() => void handleSaveIdentification()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-aurora-dark disabled:opacity-60"
          >
            {isProjectSaving ? 'Guardando…' : 'Guardar campos de contexto'}
          </button>
        </div>
      </div>
    </div>
  );
}
