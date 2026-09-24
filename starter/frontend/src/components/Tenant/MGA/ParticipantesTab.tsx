import { useEffect, useState, useMemo } from 'react';
import { HelpCircle, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import type { Project } from '../../../store/projectStore';
import { useProjectStore } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import {
  type MgaParticipant,
  type MgaCatalogActor,
  type MgaCatalogEntity,
  type MgaCatalogPosition,
  getMgaActors,
  getMgaEntitiesByActor,
  getMgaPositions,
} from '../../../lib/mgaApi';
import MgaAlert from './MgaAlert';
import type { ProjectContext } from '../../../data/mgaFieldsKnowledge';

type ParticipantesTabProps = {
  project: Project;
};

type ParticipantDraft = {
  actor_id: number;
  entity_id: number | null;
  position_id: number;
  otro_participante: string;
  interests: string;
  contribution: string;
};

const EMPTY_DRAFT: ParticipantDraft = {
  actor_id: 0,
  entity_id: null,
  position_id: 0,
  otro_participante: '',
  interests: '',
  contribution: '',
};

export default function ParticipantesTab({ project }: ParticipantesTabProps) {
  const [draft, setDraft] = useState<ParticipantDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Catálogos
  const [actors, setActors] = useState<MgaCatalogActor[]>([]);
  const [positions, setPositions] = useState<MgaCatalogPosition[]>([]);
  const [entitiesByActor, setEntitiesByActor] = useState<Record<number, MgaCatalogEntity[]>>({});
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [loadingEntities, setLoadingEntities] = useState(false);

  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const addParticipant = useProjectMgaStore((s) => s.addParticipant);
  const editParticipant = useProjectMgaStore((s) => s.editParticipant);
  const removeParticipant = useProjectMgaStore((s) => s.removeParticipant);
  const saveParticipantes = useProjectMgaStore((s) => s.saveParticipantes);
  const isSaving = useProjectMgaStore((s) => s.isSaving);
  const patchProject = useProjectStore((s) => s.patchProject);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { participants } = getFormulation(project.id);

  // Carga inicial de Actores y Posiciones
  useEffect(() => {
    let isMounted = true;
    const loadCatalogs = async () => {
      setLoadingCatalogs(true);
      try {
        const [actorsData, positionsData] = await Promise.all([
          getMgaActors(),
          getMgaPositions(),
        ]);
        if (isMounted) {
          setActors(actorsData || []);
          setPositions(positionsData || []);
        }
      } catch (err) {
        if (isMounted) {
          setError('Error al cargar catálogos de participantes.');
        }
      } finally {
        if (isMounted) setLoadingCatalogs(false);
      }
    };
    void loadCatalogs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Carga entidades para actores que aparezcan en la lista de participantes existente
  useEffect(() => {
    if (!participants || participants.length === 0) return;
    const actorIdsToFetch = Array.from(
      new Set(
        participants
          .map((p) => p.actor_id ?? (typeof p.actor === 'number' ? p.actor : 0))
          .filter((id) => id > 0 && id !== 6 && !entitiesByActor[id])
      )
    );

    if (actorIdsToFetch.length === 0) return;

    actorIdsToFetch.forEach(async (actId) => {
      try {
        const data = await getMgaEntitiesByActor(actId);
        setEntitiesByActor((prev) => ({ ...prev, [actId]: data || [] }));
      } catch {
        // Silencioso para no bloquear la vista si una entidad falla
      }
    });
  }, [participants, entitiesByActor]);

  // Carga entidades al cambiar actor_id en draft
  const handleActorChange = async (actorId: number) => {
    setDraft((d) => ({
      ...d,
      actor_id: actorId,
      entity_id: null,
      otro_participante: actorId === 6 ? d.otro_participante : '',
    }));

    if (actorId > 0 && actorId !== 6 && !entitiesByActor[actorId]) {
      setLoadingEntities(true);
      try {
        const ents = await getMgaEntitiesByActor(actorId);
        setEntitiesByActor((prev) => ({ ...prev, [actorId]: ents || [] }));
      } catch (err) {
        setError('Error al cargar las entidades para este actor.');
      } finally {
        setLoadingEntities(false);
      }
    }
  };

  const currentEntities = useMemo(() => {
    if (!draft.actor_id || draft.actor_id === 6) return [];
    return entitiesByActor[draft.actor_id] || [];
  }, [draft.actor_id, entitiesByActor]);

  const fieldProjectContext: ProjectContext = {
    projectName: project.name,
    sector: project.sector || undefined,
    productCode: project.product_code || undefined,
    procesoName: (project as any)?.proceso_id ? String((project as any)?.proceso_id) : undefined,
    objeto: (project as any)?.objeto || undefined,
  };

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  };

  const handleAddParticipant = async () => {
    if (!draft.actor_id || draft.actor_id <= 0) {
      setError('Debe seleccionar un actor.');
      return;
    }

    if (draft.actor_id === 6) {
      if (!draft.otro_participante.trim()) {
        setError('Para el actor "Otro", debe especificar el nombre del participante.');
        return;
      }
    } else {
      if (!draft.entity_id || draft.entity_id <= 0) {
        setError('Debe seleccionar una entidad.');
        return;
      }
    }

    if (!draft.position_id || draft.position_id <= 0) {
      setError('Debe seleccionar una posición.');
      return;
    }

    if (!draft.interests.trim()) {
      setError('Los intereses del participante son obligatorios.');
      return;
    }

    if (!draft.contribution.trim()) {
      setError('La contribución del participante es obligatoria.');
      return;
    }

    setError(null);
    const payload = {
      actor_id: draft.actor_id,
      entity_id: draft.actor_id === 6 ? null : draft.entity_id,
      position_id: draft.position_id,
      otro_participante: draft.actor_id === 6 ? draft.otro_participante.trim() : null,
      interests: draft.interests.trim(),
      contribution: draft.contribution.trim(),
    };

    try {
      if (editingId) {
        await editParticipant(project.id, editingId, payload);
        setMessage('Participante actualizado.');
      } else {
        await addParticipant(project.id, payload);
        setMessage('Participante creado.');
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el participante');
    }
  };

  const handleSaveSection = async () => {
    try {
      await saveParticipantes(project.id);
      setSuccessMessage('Participantes guardados exitosamente.');
    } catch (err) {
      setError('Error al guardar la sección.');
    }
  };

  const startEdit = (p: MgaParticipant) => {
    const actId = p.actor_id || (typeof p.actor === 'number' ? p.actor : 0);
    const entId = p.entity_id ?? (typeof p.entity === 'number' ? p.entity : null);
    const posId = p.position_id || (typeof p.position === 'number' ? p.position : 0);

    setEditingId(p.id);
    setDraft({
      actor_id: actId,
      entity_id: entId,
      position_id: posId,
      otro_participante: p.otro_participante || '',
      interests: p.interests || '',
      contribution: p.contribution || '',
    });

    if (actId > 0 && actId !== 6 && !entitiesByActor[actId]) {
      void getMgaEntitiesByActor(actId).then((ents) => {
        setEntitiesByActor((prev) => ({ ...prev, [actId]: ents || [] }));
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este participante?')) return;
    setError(null);
    try {
      await removeParticipant(project.id, id);
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el participante');
    }
  };

  const selectedActorName = useMemo(() => {
    return actors.find((a) => a.id === draft.actor_id)?.name || 'participante';
  }, [actors, draft.actor_id]);

  const selectedEntityName = useMemo(() => {
    if (draft.actor_id === 6) return draft.otro_participante || 'este participante';
    return currentEntities.find((e) => e.id === draft.entity_id)?.name || 'esta entidad';
  }, [draft.actor_id, draft.entity_id, draft.otro_participante, currentEntities]);

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Participantes</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}
      {successMessage && <MgaAlert message={successMessage} variant="success" onDismiss={() => setSuccessMessage(null)} />}

      <div className="grid gap-3 sm:grid-cols-2 border rounded p-4 bg-gray-50">
        {/* Selector de Actor */}
        <div>
          <label className="font-semibold text-gray-600 block mb-1">
            Actor <span className="text-red-500">*</span>
          </label>
          <select
            value={draft.actor_id}
            onChange={(e) => void handleActorChange(Number(e.target.value))}
            className="w-full p-2 border rounded bg-white"
            disabled={loadingCatalogs}
          >
            <option value={0}>
              {loadingCatalogs ? 'Cargando actores...' : 'Seleccione un actor...'}
            </option>
            {actors.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        {/* Entidad o campo "Otro participante" (según regla actor_id === 6) */}
        {draft.actor_id === 6 ? (
          <div>
            <label className="font-semibold text-gray-600 block mb-1">
              Nombre del Participante (Otro) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={draft.otro_participante}
              onChange={(e) => setDraft((d) => ({ ...d, otro_participante: e.target.value }))}
              placeholder="Especifique el nombre del participante o entidad..."
              className="w-full p-2 border rounded bg-white"
              maxLength={500}
              required
            />
          </div>
        ) : (
          <div>
            <label className="font-semibold text-gray-600 block mb-1">
              Entidad <span className="text-red-500">*</span>
            </label>
            <select
              value={draft.entity_id ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  entity_id: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full p-2 border rounded bg-white"
              disabled={!draft.actor_id || loadingEntities}
            >
              <option value="">
                {loadingEntities
                  ? 'Cargando entidades...'
                  : !draft.actor_id
                  ? 'Seleccione primero un actor...'
                  : 'Seleccione una entidad...'}
              </option>
              {currentEntities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Selector de Posición */}
        <div>
          <label className="font-semibold text-gray-600 block mb-1">
            Posición <span className="text-red-500">*</span>
          </label>
          <select
            value={draft.position_id}
            onChange={(e) => setDraft((d) => ({ ...d, position_id: Number(e.target.value) }))}
            className="w-full p-2 border rounded bg-white"
            disabled={loadingCatalogs}
            required
          >
            <option value={0}>
              {loadingCatalogs ? 'Cargando posiciones...' : 'Seleccione una posición...'}
            </option>
            {positions.map((pos) => (
              <option key={pos.id} value={pos.id}>
                {pos.name}
              </option>
            ))}
          </select>
        </div>

        {/* Campo AIAssistedField: Intereses */}
        <div className="sm:col-span-2">
          <AIAssistedField
            label="Intereses"
            htmlFor={`participant-interests-${project.id}`}
            compact
            guidance="Describa los intereses del actor respecto al proyecto: beneficios esperados, riesgos percibidos y motivaciones."
            askPrompt={`¿Cómo redacto los intereses del actor "${selectedActorName}" en la formulación MGA del proyecto "${project.name}"?`}
            fieldHelpKey="intereses_participante"
            projectContext={fieldProjectContext}
            reactiveContext={draft}
            currentValue={draft.interests}
            onAutoFill={(v) => setDraft((d) => ({ ...d, interests: v }))}
            maxLength={5000}
          >
            <textarea
              spellCheck={true}
              id={`participant-interests-${project.id}`}
              rows={2}
              maxLength={5000}
              value={draft.interests}
              onChange={(e) => setDraft((d) => ({ ...d, interests: e.target.value }))}
              placeholder="Intereses del participante en el proyecto..."
              className="w-full p-2 border rounded bg-white mt-1"
            />
          </AIAssistedField>
        </div>

        {/* Campo AIAssistedField: Contribuciones */}
        <div className="sm:col-span-2">
          <AIAssistedField
            label="Contribuciones"
            htmlFor={`participant-contribution-${project.id}`}
            compact
            guidance="Indique qué aporta el participante al proyecto: recursos, conocimiento, legitimidad, gestión del territorio, etc."
            askPrompt={`¿Qué contribuciones puede aportar "${selectedEntityName}" al proyecto "${project.name}" según MGA?`}
            fieldHelpKey="contribucion_participante"
            projectContext={fieldProjectContext}
            reactiveContext={draft}
            currentValue={draft.contribution}
            onAutoFill={(v) => setDraft((d) => ({ ...d, contribution: v }))}
            maxLength={5000}
          >
            <textarea
              spellCheck={true}
              id={`participant-contribution-${project.id}`}
              rows={2}
              maxLength={5000}
              value={draft.contribution}
              onChange={(e) => setDraft((d) => ({ ...d, contribution: e.target.value }))}
              placeholder="Aportes o contribuciones que brindará..."
              className="w-full p-2 border rounded bg-white mt-1"
            />
          </AIAssistedField>
        </div>

        {/* Botones de acción del formulario */}
        <div className="sm:col-span-2 flex flex-wrap justify-end gap-2">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={handleAddParticipant}
            className="rounded bg-[#27ae60] px-4 py-2 font-medium text-white hover:bg-[#219150] disabled:opacity-60 text-xs flex items-center gap-1 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {editingId ? 'Actualizar Participante' : 'Agregar Participante'}
          </button>
        </div>
      </div>

      {/* Tabla de Participantes Registrados */}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-left">
          <thead className="bg-[#6c757d] text-white">
            <tr>
              <th className="p-2 border">Acciones</th>
              <th className="p-2 border">Actor</th>
              <th className="p-2 border">Entidad</th>
              <th className="p-2 border">Posición</th>
              <th className="p-2 border">Intereses</th>
              <th className="p-2 border">Contribuciones</th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No hay participantes registrados.
                </td>
              </tr>
            ) : (
              participants.map((p) => {
                const actId = p.actor_id ?? (typeof p.actor === 'number' ? p.actor : 0);
                const entId = p.entity_id ?? (typeof p.entity === 'number' ? p.entity : null);
                const posId = p.position_id ?? (typeof p.position === 'number' ? p.position : 0);

                const actorObj = actors.find((a) => a.id === actId);
                const actorDisplay = actorObj?.name || (actId > 0 ? `Actor #${actId}` : '—');

                let entityDisplay = '—';
                if (actId === 6) {
                  entityDisplay = p.otro_participante ? `Otro: ${p.otro_participante}` : 'Otro';
                } else if (entId) {
                  const entObj = entitiesByActor[actId]?.find((e) => e.id === entId);
                  entityDisplay = entObj?.name || `Entidad #${entId}`;
                }

                const posObj = positions.find((pos) => pos.id === posId);
                const positionDisplay = posObj?.name || (posId > 0 ? `Posición #${posId}` : '—');

                return (
                  <tr key={p.id} className="border-b hover:bg-gray-50 align-top">
                    <td className="p-2 border text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        disabled={isSaving}
                        className="p-1 bg-[#2980b9] text-white rounded mr-1 disabled:opacity-60 hover:bg-[#2471a3]"
                        aria-label="Editar participante"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(p.id)}
                        disabled={isSaving}
                        className="p-1 bg-[#2980b9] text-white rounded disabled:opacity-60 hover:bg-[#2471a3]"
                        aria-label="Eliminar participante"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="p-2 border font-medium">{actorDisplay}</td>
                    <td className="p-2 border">{entityDisplay}</td>
                    <td className="p-2 border">{positionDisplay}</td>
                    <td className="p-2 border max-w-xs">{p.interests || '—'}</td>
                    <td className="p-2 border max-w-xs">{p.contribution || '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Sección 02 - Análisis de los participantes */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-[#2980b9] mb-2 border-b pb-2">
          02 - Análisis de los participantes
        </h2>
        <p className="text-gray-600 mb-4">
          Indicar el tipo de consulta y coordinación que se ha dado o se dará entre los participantes.
        </p>
        <AIAssistedField
          label="Análisis de consulta y coordinación"
          htmlFor={`mga-analisis-participantes-${project.id}`}
          guidance="Describa cómo se ha coordinado con los actores involucrados, acuerdos logrados, mesas de trabajo, etc."
          askPrompt={`¿Cómo puedo redactar el análisis de consulta y coordinación entre los participantes para el proyecto "${project.name}"?`}
          fieldHelpKey="analisis_participantes"
          projectContext={fieldProjectContext}
          reactiveContext={{
            analisis_participantes: project.mga_formulation_data?.analisis_participantes,
            participants,
          }}
          currentValue={project.mga_formulation_data?.analisis_participantes as string | undefined}
          onAutoFill={(v) =>
            patchProject(project.id, {
              mga_formulation_data: {
                ...project.mga_formulation_data,
                analisis_participantes: v,
              },
            })
          }
          maxLength={2500}
        >
          <textarea
            spellCheck={true}
            id={`mga-analisis-participantes-${project.id}`}
            maxLength={2500}
            value={project.mga_formulation_data?.analisis_participantes || ''}
            onChange={(e) =>
              void patchProject(project.id, {
                mga_formulation_data: {
                  ...project.mga_formulation_data,
                  analisis_participantes: e.target.value,
                },
              })
            }
            className="min-h-[120px] w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-primary"
            placeholder="Describa el tipo de consulta y coordinación…"
          />
        </AIAssistedField>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
        <button
          type="button"
          onClick={handleSaveSection}
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : null}
          Guardar Participantes
        </button>
      </div>
    </div>
  );
}
