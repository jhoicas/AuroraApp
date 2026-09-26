import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import { useProjectStore, type Project } from '../../../store/projectStore';
import { useProjectMgaStore, debouncedPatchProject, type CauseObjectiveRelation } from '../../../store/projectMgaStore';
import { useAuroraCopilotStore } from '../../../store/auroraCopilotStore';
import type { ProjectContext } from '../../../data/mgaFieldsKnowledge';
import {
  buildMgaCausesEffectsPrompt,
  MGA_CAUSES_EFFECTS_ROUTE,
  type MgaCausesEffectsFocus,
} from '../../../lib/mgaAuroraAssist';
import type { MgaEffect } from '../../../lib/mgaApi';
import MgaAlert from './MgaAlert';
import {
  groupCausesByParent,
  groupEffectsByParent,
  type ParentChildGroup,
} from './mgaProblemTree';
import debounce from 'lodash.debounce';

type IdentificacionTabProps = {
  project: Project;
};

type EditTarget =
  | { kind: 'effect'; id: string; draft: string }
  | { kind: 'cause'; id: string; draft: string }
  | null;

function AuroraAssistButton({
  label,
  onClick,
  compact = false,
  disabled = false,
  title,
}: {
  label: string;
  onClick: () => void;
  compact?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border border-primary/30 bg-white font-medium text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed ${
        compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const problemDescription = project.problem_description ?? '';
  const situacionExistente =
    (project as any).situation ??
    project.situacion_existente ??
    (project.mga_formulation_data as any)?.situation ??
    (project.mga_formulation_data as any)?.situacion_existente ??
    '';
  const magnitudProblema =
    (project as any).magnitude ??
    project.magnitud_problema ??
    (project.mga_formulation_data as any)?.magnitude ??
    (project.mga_formulation_data as any)?.magnitud_problema ??
    '';
  const patchCurrentProject = useProjectStore((s) => s.patchCurrentProject);
  const isProjectSaving = useProjectStore((s) => s.isSaving);

  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const updateCauseRelation = useProjectMgaStore((s) => s.updateCauseRelation);
  const addCause = useProjectMgaStore((s) => s.addCause);
  const removeCause = useProjectMgaStore((s) => s.removeCause);
  const addEffect = useProjectMgaStore((s) => s.addEffect);
  const editEffect = useProjectMgaStore((s) => s.editEffect);
  const removeEffect = useProjectMgaStore((s) => s.removeEffect);
  const saveProblematica = useProjectMgaStore((s) => s.saveProblematica);
  const isSaving = useProjectMgaStore((s) => s.isSaving);
  const sendMessage = useAuroraCopilotStore((s) => s.sendMessage);
  const openCopilot = useAuroraCopilotStore((s) => s.open);
  const clearCopilotError = useAuroraCopilotStore((s) => s.clearError);

  const projectContext = useMemo(
    () => ({
      problem_description: problemDescription,
      situacion_existente: situacionExistente,
      magnitud_problema: magnitudProblema,
    }),
    [problemDescription, situacionExistente, magnitudProblema],
  );

  const fieldProjectContext: ProjectContext = useMemo(
    () => ({
      projectName: project.name,
      sector: project.sector ?? undefined,
      productCode: project.product_code ?? undefined,
      problemDescription,
      generalObjective: project.general_objective ?? undefined,
      objeto: (project as any)?.objeto ?? undefined,
    }),
    [project.name, project.sector, project.product_code, problemDescription, project.general_objective, (project as any)?.objeto],
  );

  const requestAuroraAssist = useCallback(
    (prompt: string, routeContext: string) => {
      clearCopilotError();
      openCopilot();
      void sendMessage(prompt, routeContext, projectContext);
    },
    [clearCopilotError, openCopilot, sendMessage, projectContext],
  );

  const { causeRelations, effects } = getFormulation(project.id);

  const directCauses = useMemo(
    () => causeRelations.filter((r) => r.causeType === 'Causa directa' && r.causeDescription?.trim() !== ''),
    [causeRelations],
  );
  const indirectCauses = useMemo(
    () => causeRelations.filter((r) => r.causeType === 'Causa indirecta' && r.causeDescription?.trim() !== ''),
    [causeRelations],
  );
  const directEffects = useMemo(
    () => effects.filter((e) => e.effect_type === 'directo' && e.description?.trim() !== ''),
    [effects],
  );
  const indirectEffects = useMemo(
    () => effects.filter((e) => e.effect_type === 'indirecto' && e.description?.trim() !== ''),
    [effects],
  );

  const hasCauses = directCauses.length > 0 && indirectCauses.length > 0;

  const effectGroups = useMemo(() => groupEffectsByParent(effects), [effects]);
  const causeGroups = useMemo(() => groupCausesByParent(causeRelations), [causeRelations]);

  const suggestWithAurora = useCallback(
    (focus: MgaCausesEffectsFocus, parentId?: string) => {
      if (focus === 'effects' && !hasCauses) {
        setError('Debe registrar primero las causas antes de identificar los efectos.');
        return;
      }
      requestAuroraAssist(
        buildMgaCausesEffectsPrompt(focus, project.name, parentId),
        MGA_CAUSES_EFFECTS_ROUTE,
      );
    },
    [requestAuroraAssist, project.name, hasCauses],
  );

  const reactiveContext = {
    problemDescription,
    situacionExistente,
    magnitudProblema
  };

  const handleSaveIdentification = useMemo(
    () =>
      debounce(async () => {
        setMessage(null);
        setError(null);
        try {
          const curProj = useProjectStore.getState().currentProject;
          const sitVal =
            (curProj as any)?.situation ??
            curProj?.situacion_existente ??
            '';
          const magVal =
            (curProj as any)?.magnitude ??
            curProj?.magnitud_problema ??
            '';
          await useProjectStore.getState().updateProjectDetails(project.id, {
            problem_description: curProj?.problem_description ?? '',
            general_objective: curProj?.general_objective ?? '',
            situacion_existente: sitVal,
            magnitud_problema: magVal,
            situation: sitVal,
            magnitude: magVal,
          });
          debouncedPatchProject(project.id, {
            situation: sitVal,
            magnitude: magVal,
            situacion_existente: sitVal,
            magnitud_problema: magVal,
          });
          setMessage('Identificación del problema guardada.');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo guardar la identificación');
        }
      }, 1000),
    [project.id],
  );

  const handleSaveSection = async () => {
    setError(null);
    setSuccessMessage(null);

    const missingParts: string[] = [];
    if (!problemDescription.trim()) missingParts.push('Problema Central');
    if (directCauses.length === 0) missingParts.push('al menos una Causa Directa');
    if (indirectCauses.length === 0) missingParts.push('al menos una Causa Indirecta');
    if (directEffects.length === 0) missingParts.push('al menos un Efecto Directo');
    if (indirectEffects.length === 0) missingParts.push('al menos un Efecto Indirecto');

    if (missingParts.length > 0) {
      setError(
        `El Árbol de Problemas está incompleto. Según la metodología MGA, debe registrar obligatoriamente: ${missingParts.join(', ')} para poder guardar la problemática y continuar.`
      );
      return;
    }

    try {
      await handleSaveIdentification();
      await saveProblematica(project.id);
      setSuccessMessage('Problemática guardada exitosamente.');
    } catch (err) {
      setError('Error al guardar la sección.');
    }
  };

  const handleAddDirectEffect = async () => {
    if (!hasCauses) {
      setError('Debe registrar primero las causas antes de identificar los efectos.');
      return;
    }
    setError(null);
    try {
      const created = await addEffect(project.id, {
        effect_type: 'directo',
        description: '',
        sort_order: effects.length,
      });
      if (created) {
        setEditTarget({ kind: 'effect', id: created.id, draft: '' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el efecto directo');
    }
  };

  const handleAddIndirectEffect = async (parentId: string) => {
    if (!hasCauses) {
      setError('Debe registrar primero las causas antes de identificar los efectos.');
      return;
    }
    setError(null);
    try {
      const created = await addEffect(project.id, {
        effect_type: 'indirecto',
        description: '',
        parent_id: parentId,
        sort_order: effects.length,
      });
      if (created) {
        setEditTarget({ kind: 'effect', id: created.id, draft: '' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el efecto indirecto');
    }
  };

  const handleAddDirectCause = async () => {
    setError(null);
    try {
      const created = await addCause(project.id, {
        cause_type: 'directa',
        description: '',
        sort_order: causeRelations.length,
        specific_objective: '',
      });
      if (created) {
        setEditTarget({ kind: 'cause', id: created.id, draft: '' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la causa directa');
    }
  };

  const handleAddIndirectCause = async (parentId: string) => {
    setError(null);
    try {
      const created = await addCause(project.id, {
        cause_type: 'indirecta',
        description: '',
        parent_id: parentId,
        sort_order: causeRelations.length,
        specific_objective: '',
      });
      if (created) {
        setEditTarget({ kind: 'cause', id: created.id, draft: '' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la causa indirecta');
    }
  };

  const saveEffectEdit = async (effect: MgaEffect, explicitDraft?: string) => {
    const draft = explicitDraft !== undefined ? explicitDraft : (editTarget?.kind === 'effect' && editTarget.id === effect.id ? editTarget.draft : effect.description);
    setError(null);
    try {
      await editEffect(project.id, effect.id, {
        description: (draft ?? '').trim(),
      });
      setEditTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el efecto');
    }
  };

  const saveCauseEdit = async (relation: CauseObjectiveRelation, explicitDraft?: string) => {
    const draft = explicitDraft !== undefined ? explicitDraft : (editTarget?.kind === 'cause' && editTarget.id === relation.id ? editTarget.draft : relation.causeDescription);
    setError(null);
    try {
      await updateCauseRelation(project.id, relation.id, {
        causeDescription: draft ?? '',
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
    const isTargetEditing = editTarget?.kind === 'effect' && editTarget.id === effect.id;
    const isEditing = isTargetEditing || (!effect.description?.trim() && !editTarget);
    const draftValue = isTargetEditing ? editTarget.draft : (effect.description ?? '');

    return (
      <div
        key={effect.id}
        className={`relative bg-white p-4 border border-gray-200 rounded-lg shadow-sm ${
          isIndirect ? 'p-3' : ''
        }`}
      >
        <NodeActions
          disabled={isSaving || !hasCauses}
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
            <AIAssistedField
              label={isIndirect ? 'Efecto Indirecto' : 'Efecto Directo'}
              htmlFor={`effect-${effect.id}`}
              fieldHelpKey={`effect-${isIndirect ? 'indirect' : 'direct'}-${effect.id}`}
              projectContext={fieldProjectContext}
              reactiveContext={reactiveContext}
              currentValue={draftValue}
              askPrompt={`Sugiere una redacción para este efecto ${isIndirect ? 'indirecto' : 'directo'} del problema: ${problemDescription}`}
              onAutoFill={(val) => setEditTarget({ kind: 'effect', id: effect.id, draft: val })}
              maxLength={250}
            >
              <textarea spellCheck={true}
                id={`effect-${effect.id}`}
                rows={3}
                maxLength={250}
                placeholder={isIndirect ? 'Describa el efecto indirecto...' : 'Describa el efecto directo...'}
                value={draftValue}
                onChange={(e) =>
                  setEditTarget({ kind: 'effect', id: effect.id, draft: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary mt-1"
                autoFocus={!effect.description?.trim()}
              />
            </AIAssistedField>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveEffectEdit(effect, draftValue)}
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
          <p className="pr-8 text-sm text-gray-700">{effect.description || <span className="italic text-gray-400">Sin descripción</span>}</p>
        )}
      </div>
    );
  };

  const renderCauseCard = (relation: CauseObjectiveRelation, label: string, isIndirect = false) => {
    const isTargetEditing = editTarget?.kind === 'cause' && editTarget.id === relation.id;
    const isEditing = isTargetEditing || (!relation.causeDescription?.trim() && !editTarget);
    const draftValue = isTargetEditing ? editTarget.draft : (relation.causeDescription ?? '');

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
            <AIAssistedField
              label={isIndirect ? 'Causa Indirecta' : 'Causa Directa'}
              htmlFor={`cause-${relation.id}`}
              fieldHelpKey={`cause-${isIndirect ? 'indirect' : 'direct'}-${relation.id}`}
              projectContext={fieldProjectContext}
              reactiveContext={reactiveContext}
              currentValue={draftValue}
              askPrompt={`Sugiere una redacción para esta causa ${isIndirect ? 'indirecta' : 'directa'} del problema: ${problemDescription}`}
              onAutoFill={(val) => setEditTarget({ kind: 'cause', id: relation.id, draft: val })}
              maxLength={250}
            >
              <textarea spellCheck={true}
                id={`cause-${relation.id}`}
                rows={3}
                maxLength={250}
                placeholder={isIndirect ? 'Describa la causa indirecta...' : 'Describa la causa directa...'}
                value={draftValue}
                onChange={(e) =>
                  setEditTarget({ kind: 'cause', id: relation.id, draft: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary mt-1"
                autoFocus={!relation.causeDescription?.trim()}
              />
            </AIAssistedField>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveCauseEdit(relation, draftValue)}
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
          <p className="pr-8 text-sm text-gray-700">{relation.causeDescription || <span className="italic text-gray-400">Sin descripción</span>}</p>
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
    auroraFocus: MgaCausesEffectsFocus,
    disabled = false,
    disabledMessage?: string,
  ) => (
    <div className={`flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${disabled ? 'opacity-70 bg-gray-50/80' : ''}`}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">{title}</span>
          {disabled && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              🔒 Bloqueado
            </span>
          )}
        </div>
        <AuroraAssistButton
          label="Sugerir con Aurora"
          disabled={disabled || isSaving}
          title={disabled ? disabledMessage : undefined}
          onClick={() => {
            if (disabled) return;
            suggestWithAurora(auroraFocus);
          }}
        />
      </div>
      {disabled && disabledMessage && (
        <div className="border-b border-amber-200 bg-amber-50/90 px-5 py-2 text-xs text-amber-800 flex items-center gap-1.5 font-medium">
          <span>⚠️ {disabledMessage}</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-5">
        {disabled && groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400 space-y-1">
            <p className="text-sm font-medium text-gray-600">
              {disabledMessage || 'Sección bloqueada'}
            </p>
            <p className="text-xs text-gray-400">
              Registre primero al menos una causa directa y una indirecta para habilitar esta sección.
            </p>
          </div>
        ) : groups.length === 0 ? (
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isSaving || disabled}
                      onClick={() => !disabled && onAddIndirect(group.parent.id)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={disabled ? disabledMessage : undefined}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      {indirectLabel}
                    </button>
                    <AuroraAssistButton
                      label="Aurora"
                      compact
                      disabled={disabled || isSaving}
                      title={disabled ? disabledMessage : undefined}
                      onClick={() => {
                        if (disabled) return;
                        suggestWithAurora(auroraFocus, group.parent.id);
                      }}
                    />
                  </div>
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
      {successMessage && <MgaAlert message={successMessage} variant="success" onDismiss={() => setSuccessMessage(null)} />}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Columna izquierda — Problema central (40%) */}
        <div className="flex w-full flex-col space-y-4 lg:w-[40%]">
          <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <AIAssistedField
              label="Problema central"
              htmlFor={`mga-problem-${project.id}`}
              guidance="Identifique la situación negativa que afecta a la población. Debe ser real, verificable y redactarse como una condición, no como ausencia de solución."
              askPrompt={`Ayúdame a redactar el problema central del proyecto "${project.name}" (Sector: ${project.sector})`}
              fieldHelpKey="problema_central"
              projectContext={fieldProjectContext}
              reactiveContext={reactiveContext}
              currentValue={problemDescription}
              onAutoFill={(v) => patchCurrentProject({ problem_description: v })}
              maxLength={2000}
            >
              <textarea spellCheck={true}
                id={`mga-problem-${project.id}`}
                maxLength={2000}
                value={problemDescription}
                onChange={(e) => patchCurrentProject({ problem_description: e.target.value })}
                onBlur={() => void handleSaveIdentification()}
                className="min-h-[150px] w-full flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-primary"
                placeholder="Describa el problema central…"
              />
            </AIAssistedField>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isSaving || !hasCauses}
                    onClick={() => void handleAddDirectEffect()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!hasCauses ? 'Debe registrar primero las causas antes de identificar los efectos' : undefined}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    + Efecto directo
                  </button>
                  <AuroraAssistButton
                    label="Aurora"
                    compact
                    disabled={isSaving || !hasCauses}
                    title={!hasCauses ? 'Debe registrar primero las causas antes de identificar los efectos' : undefined}
                    onClick={() => {
                      if (!hasCauses) return;
                      suggestWithAurora('effects');
                    }}
                  />
                </div>
                {!hasCauses && (
                  <p className="text-[11px] text-amber-600 font-medium leading-tight">
                    Debe registrar primero las causas antes de identificar los efectos
                  </p>
                )}
              </div>
              <div className="flex flex-1 gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleAddDirectCause()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  + Causa directa
                </button>
                <AuroraAssistButton
                  label="Aurora"
                  compact
                  onClick={() => suggestWithAurora('causes')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha — Causas y Efectos (60%) */}
        <div className="flex w-full flex-col space-y-6 lg:w-[60%]">
          {renderTreePanel(
            'Causas',
            'Causa indirecta',
            causeGroups,
            (item) => renderCauseCard(item, 'Causa Directa'),
            (item) => renderCauseCard(item, 'Causa Indirecta', true),
            (parentId) => void handleAddIndirectCause(parentId),
            'No hay causas registradas. Use [+] Causa directa desde el problema central.',
            'causes',
          )}

          {renderTreePanel(
            'Efectos',
            'Efecto indirecto',
            effectGroups,
            (item) => renderEffectCard(item, 'Efecto Directo'),
            (item) => renderEffectCard(item, 'Efecto Indirecto', true),
            (parentId) => void handleAddIndirectEffect(parentId),
            'No hay efectos registrados. Use [+] Efecto directo desde el problema central.',
            'effects',
            !hasCauses,
            'Debe registrar primero las causas antes de identificar los efectos',
          )}
        </div>
      </div>

      {/* Campos inferiores — ancho completo */}
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <AIAssistedField
            label="Descripción de la situación existente con respecto al problema"
            htmlFor={`mga-situation-${project.id}`}
            guidance="Describa el estado actual de la problemática en el territorio con cifras y fuentes verificables."
            askPrompt={`¿Cómo redacto la situación existente del proyecto "${project.name}"?`}
            fieldHelpKey="situacion_existente"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={situacionExistente}
            onAutoFill={(v) => patchCurrentProject({ situacion_existente: v, situation: v } as any)}
            maxLength={2000}
          >
            <textarea spellCheck={true}
              id={`mga-situation-${project.id}`}
              name="situation"
              maxLength={2000}
              value={situacionExistente}
              onChange={(e) => patchCurrentProject({ situacion_existente: e.target.value, situation: e.target.value } as any)}
              onBlur={() => void handleSaveIdentification()}
              className="min-h-[150px] w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-primary"
              placeholder="Describa el contexto territorial, social o institucional actual…"
            />
          </AIAssistedField>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <AIAssistedField
            label="Magnitud actual del problema e indicadores de referencia"
            htmlFor={`mga-magnitude-${project.id}`}
            guidance="Indicadores cuantitativos de referencia que dimensionan la magnitud del problema."
            askPrompt={`¿Qué indicadores y métricas debo usar para la magnitud del problema del proyecto "${project.name}"?`}
            fieldHelpKey="magnitud_problema"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={magnitudProblema}
            onAutoFill={(v) => patchCurrentProject({ magnitud_problema: v, magnitude: v } as any)}
            maxLength={2000}
          >
            <textarea spellCheck={true}
              id={`mga-magnitude-${project.id}`}
              name="magnitude"
              maxLength={2000}
              value={magnitudProblema}
              onChange={(e) => patchCurrentProject({ magnitud_problema: e.target.value, magnitude: e.target.value } as any)}
              onBlur={() => void handleSaveIdentification()}
              className="min-h-[150px] w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-primary"
              placeholder="Indique magnitud, fuentes y línea base del problema…"
            />
          </AIAssistedField>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
          <button 
            type="button"
            onClick={handleSaveSection} 
            disabled={isProjectSaving || isSaving}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {(isProjectSaving || isSaving) ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            Guardar Problemática
          </button>
        </div>
      </div>
    </div>
  );
}
