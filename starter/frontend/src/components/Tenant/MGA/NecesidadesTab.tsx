import { useState, useEffect, Fragment } from 'react';
import { HelpCircle, Pencil, PlusCircle, Trash2, X, Check, AlertTriangle, Save } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import { useCatalogStore } from '../../../store/catalogStore';
import type { MgaNeed } from '../../../lib/mgaApi';
import {
  draftDeficit,
  draftFromRow,
  isDraftDirty,
  parseNeedInput,
  type NeedRowDraft,
} from '../../../lib/mgaNeeds';
import MgaAlert from './MgaAlert';
import { CountedTextarea } from '../../ui/CountedTextarea';

type NecesidadesTabProps = {
  project: Project;
};

const CURRENT_YEAR = new Date().getFullYear();
const EMPTY_NEEDS: MgaNeed[] = [];

const inputClass =
  'w-full p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none';

type NeedForm = {
  bienServicio: string;
  descripcion: string;
  descripcionOferta: string;
  descripcionDemanda: string;
  unidadMedidaId: string;
  anioInicial: number;
  anioFinal: number;
  ultimoAnioProyectado: number;
};

const EMPTY_FORM: NeedForm = {
  bienServicio: '',
  descripcion: '',
  descripcionOferta: '',
  descripcionDemanda: '',
  unidadMedidaId: '',
  anioInicial: CURRENT_YEAR - 5,
  anioFinal: CURRENT_YEAR,
  ultimoAnioProyectado: CURRENT_YEAR + 10,
};

const formatNumber = (n: number) => n.toLocaleString('es-CO');

/**
 * Grilla anual de una necesidad: una fila por año entre anio_inicial y ultimo_anio_proyectado.
 * Las filas arrancan en modo lectura. El lápiz habilita oferta y demanda de esa fila; mientras
 * se digita, el déficit (demanda - oferta) se recalcula; el diskette guarda solo esa fila contra
 * el backend y, si sale bien, la fila vuelve a modo lectura.
 */
function NeedYearsGrid({ projectId, need }: { projectId: string; need: MgaNeed }) {
  const saveNeedAnnualValue = useProjectMgaStore((s) => s.saveNeedAnnualValue);
  const [drafts, setDrafts] = useState<Record<number, NeedRowDraft>>({});
  const [savingYears, setSavingYears] = useState<Record<number, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const setField = (anio: number, base: NeedRowDraft, field: keyof NeedRowDraft, value: string) => {
    setDrafts((prev) => ({ ...prev, [anio]: { ...(prev[anio] ?? base), [field]: value } }));
    clearRowError(anio);
  };

  const clearRowError = (anio: number) =>
    setRowErrors((prev) => {
      if (!(anio in prev)) return prev;
      const { [anio]: _removed, ...rest } = prev;
      return rest;
    });

  const startEdit = (row: MgaNeed['valores_anuales'][number]) =>
    setDrafts((prev) => ({ ...prev, [row.anio]: draftFromRow(row) }));

  const cancelEdit = (anio: number) => {
    setDrafts((prev) => {
      const { [anio]: _discarded, ...rest } = prev;
      return rest;
    });
    clearRowError(anio);
  };

  const saveRow = async (anio: number, draft: NeedRowDraft) => {
    const oferta = parseNeedInput(draft.oferta);
    const demanda = parseNeedInput(draft.demanda);
    if (oferta === null || demanda === null) {
      setRowErrors((prev) => ({ ...prev, [anio]: 'Ingrese valores numéricos mayores o iguales a 0.' }));
      return;
    }

    setSavingYears((prev) => ({ ...prev, [anio]: true }));
    try {
      await saveNeedAnnualValue(projectId, need.id, anio, { oferta, demanda });
      setDrafts((prev) => {
        const { [anio]: _saved, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [anio]: err instanceof Error ? err.message : 'No se pudo guardar la fila.',
      }));
    } finally {
      setSavingYears((prev) => ({ ...prev, [anio]: false }));
    }
  };

  if (need.valores_anuales.length === 0) {
    return <p className="p-3 text-slate-500">Esta necesidad no tiene años en la serie.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded bg-white">
      <table className="w-full text-left" aria-label={`Serie anual de ${need.bien_servicio}`}>
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="p-2 border w-32 text-center">Año</th>
            <th className="p-2 border">Oferta</th>
            <th className="p-2 border">Demanda</th>
            <th className="p-2 border">Déficit</th>
            <th className="p-2 border w-24 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {need.valores_anuales.map((row) => {
            // La fila está en modo edición mientras exista un borrador para su año.
            const editing = row.anio in drafts;
            const draft = drafts[row.anio] ?? draftFromRow(row);
            const dirty = editing && isDraftDirty(draft, row);
            const liveDeficit = editing ? draftDeficit(draft) : row.deficit;
            const saving = Boolean(savingYears[row.anio]);
            const rowError = rowErrors[row.anio];

            return (
              <Fragment key={row.anio}>
                <tr className="border-b">
                  <td className="p-2 border text-center font-medium bg-slate-50">
                    {row.anio}
                    {row.anio > need.anio_final && (
                      <span className="ml-1 text-[10px] font-normal text-slate-500">(proyectado)</span>
                    )}
                  </td>
                  {(['oferta', 'demanda'] as const).map((field) => (
                    <td key={field} className="p-2 border">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={draft[field]}
                        disabled={!editing || saving}
                        aria-label={`${field === 'oferta' ? 'Oferta' : 'Demanda'} ${row.anio}`}
                        onChange={(e) => setField(row.anio, draft, field, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && dirty && liveDeficit !== null) void saveRow(row.anio, draft);
                        }}
                        className="w-full p-1 border border-slate-300 rounded outline-none focus:border-[#2980b9]"
                      />
                    </td>
                  ))}
                  <td
                    className="p-2 border text-right font-medium bg-slate-50"
                    aria-label={`Déficit ${row.anio}`}
                  >
                    {liveDeficit === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className={liveDeficit < 0 ? 'text-red-600' : 'text-slate-800'}>
                        {formatNumber(liveDeficit)}
                      </span>
                    )}
                  </td>
                  <td className="p-2 border text-center whitespace-nowrap">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void saveRow(row.anio, draft)}
                          disabled={!dirty || saving || liveDeficit === null}
                          aria-label={`Guardar año ${row.anio}`}
                          title="Guardar fila"
                          className="p-1 bg-[#2980b9] text-white rounded mr-1 disabled:opacity-40"
                        >
                          {saving ? (
                            <span className="block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelEdit(row.anio)}
                          disabled={saving}
                          aria-label={`Cancelar edición año ${row.anio}`}
                          title="Cancelar"
                          className="p-1 border border-slate-300 text-slate-600 rounded disabled:opacity-40"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        aria-label={`Editar año ${row.anio}`}
                        title="Editar fila"
                        className="p-1 bg-[#2980b9] text-white rounded"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
                {rowError && (
                  <tr>
                    <td colSpan={5} className="px-2 py-1 border text-red-600 bg-red-50" role="alert">
                      {rowError}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// key por proyecto: al cambiar de proyecto se reinicia todo el estado local (formulario, selección).
export default function NecesidadesTab({ project }: NecesidadesTabProps) {
  return <NecesidadesTabContent key={project.id} project={project} />;
}

function NecesidadesTabContent({ project }: NecesidadesTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const fetchNeeds = useProjectMgaStore((s) => s.fetchNeeds);
  const addNeed = useProjectMgaStore((s) => s.addNeed);
  const editNeed = useProjectMgaStore((s) => s.editNeed);
  const removeNeed = useProjectMgaStore((s) => s.removeNeed);
  const isSaving = useProjectMgaStore((s) => s.isSaving);
  const projectNeeds = useProjectMgaStore((s) => s.needsByProjectId[project.id]) ?? EMPTY_NEEDS;

  const measurementUnits = useCatalogStore((s) => s.measurementUnits);
  const fetchAllMeasurementUnits = useCatalogStore((s) => s.fetchAllMeasurementUnits);

  const formulation = getFormulation(project.id);
  const alternativas = formulation?.identificacion?.alternativas || [];

  const [pickedAlternativaId, setSelectedAlternativaId] = useState<string>('');
  // Si la elegida no existe (carga tardía de alternativas), se usa la primera.
  const selectedAlternativaId = alternativas.some((a) => a.id === pickedAlternativaId)
    ? pickedAlternativaId
    : (alternativas[0]?.id ?? '');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NeedForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const currentNeeds = projectNeeds.filter((n) => n.alternative_id === selectedAlternativaId);

  useEffect(() => {
    void fetchAllMeasurementUnits();
  }, [fetchAllMeasurementUnits]);

  useEffect(() => {
    void fetchNeeds(project.id);
  }, [fetchNeeds, project.id]);

  const setFormField = <K extends keyof NeedForm>(key: K, value: NeedForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openForm = (item?: MgaNeed) => {
    setError(null);
    if (item) {
      setEditingId(item.id);
      setForm({
        bienServicio: item.bien_servicio,
        descripcion: item.descripcion,
        descripcionOferta: item.descripcion_oferta,
        descripcionDemanda: item.descripcion_demanda,
        unidadMedidaId: String(item.unidad_medida_id),
        anioInicial: item.anio_inicial,
        anioFinal: item.anio_final,
        ultimoAnioProyectado: item.ultimo_anio_proyectado,
      });
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    setIsAdding(true);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedAlternativaId) {
      setError('Debe seleccionar una alternativa.');
      return;
    }
    if (!form.bienServicio.trim()) {
      setError('El Bien o Servicio es obligatorio.');
      return;
    }
    if (!form.unidadMedidaId) {
      setError('Debe seleccionar una unidad de medida.');
      return;
    }
    if (form.anioInicial > form.anioFinal) {
      setError('El Año inicial no puede ser mayor al Año final.');
      return;
    }
    if (form.ultimoAnioProyectado < form.anioFinal) {
      setError('El Último año proyectado debe ser mayor o igual al Año final.');
      return;
    }
    setError(null);

    const payload = {
      bien_servicio: form.bienServicio.trim(),
      descripcion: form.descripcion.trim(),
      descripcion_oferta: form.descripcionOferta.trim(),
      descripcion_demanda: form.descripcionDemanda.trim(),
      unidad_medida_id: Number(form.unidadMedidaId),
      anio_inicial: form.anioInicial,
      anio_final: form.anioFinal,
      ultimo_anio_proyectado: form.ultimoAnioProyectado,
    };

    try {
      if (editingId) {
        await editNeed(project.id, editingId, payload);
      } else {
        await addNeed(project.id, { alternative_id: selectedAlternativaId, ...payload });
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la necesidad.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta necesidad?')) return;
    try {
      await removeNeed(project.id, id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la necesidad.');
    }
  };

  if (alternativas.length === 0) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex gap-3 text-sm">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
        <div className="text-yellow-700">
          <p className="font-bold">No hay alternativas creadas.</p>
          <p>Para registrar las necesidades de su proyecto, primero debe crear al menos una alternativa en la pestaña de Identificación.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-normal text-[#2980b9]">Estudio de necesidades</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-emerald-600 font-medium">
            <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" /> Guardando...
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded border">
        <label htmlFor={`ns-alt-${project.id}`} className="font-semibold text-slate-700 whitespace-nowrap">Alternativa:</label>
        <select
          id={`ns-alt-${project.id}`}
          value={selectedAlternativaId}
          onChange={(e) => {
            setSelectedAlternativaId(e.target.value);
            closeForm();
          }}
          className="flex-1 p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
        >
          {alternativas.map((alt) => (
            <option key={alt.id} value={alt.id}>{alt.nombre}</option>
          ))}
        </select>
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      {!isAdding ? (
        <div className="space-y-4 mt-4">
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSaving || !selectedAlternativaId}
              onClick={() => openForm()}
              className="flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-semibold rounded disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar
            </button>
          </div>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-left">
              <thead className="bg-[#6c757d] text-white">
                <tr>
                  <th className="p-2 border">Acciones</th>
                  <th className="p-2 border">Bien o servicio</th>
                  <th className="p-2 border">Medido a través de</th>
                  <th className="p-2 border">Descripción</th>
                  <th className="p-2 border">Inicio historia</th>
                  <th className="p-2 border">Final historia</th>
                  <th className="p-2 border">Último año</th>
                </tr>
              </thead>
              <tbody>
                {currentNeeds.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-500">
                      No se han adicionado bienes o servicios a esta alternativa.
                    </td>
                  </tr>
                ) : (
                  currentNeeds.map((item) => {
                    const unidadNombre = measurementUnits.find((u) => Number(u.id) === item.unidad_medida_id)?.name || 'N/A';
                    return (
                      <Fragment key={item.id}>
                        <tr className="border-b hover:bg-gray-50 align-top">
                          <td className="p-2 border text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openForm(item)}
                              disabled={isSaving}
                              className="p-1 bg-[#2980b9] text-white rounded mr-1 disabled:opacity-60"
                              aria-label="Editar"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(item.id)}
                              disabled={isSaving}
                              className="p-1 bg-[#2980b9] text-white rounded disabled:opacity-60"
                              aria-label="Eliminar"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="p-2 border font-medium text-slate-800">{item.bien_servicio}</td>
                          <td className="p-2 border">{unidadNombre}</td>
                          <td className="p-2 border truncate max-w-xs" title={item.descripcion}>{item.descripcion}</td>
                          <td className="p-2 border text-center">{item.anio_inicial}</td>
                          <td className="p-2 border text-center">{item.anio_final}</td>
                          <td className="p-2 border text-center">{item.ultimo_anio_proyectado}</td>
                        </tr>
                        <tr>
                          <td colSpan={7} className="p-3 border bg-slate-50">
                            <NeedYearsGrid projectId={project.id} need={item} />
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="border rounded p-4 bg-gray-50 space-y-4 mt-4">
          <h3 className="font-semibold text-slate-700">{editingId ? 'Editar Necesidad' : 'Nueva Necesidad'}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AIAssistedField
              label="Bien o servicio"
              htmlFor={`ns-bien-${project.id}`}
              required
              currentValue={form.bienServicio}
              onAutoFill={(v: string) => setFormField('bienServicio', v)}
              maxLength={200}
            >
              <input
                id={`ns-bien-${project.id}`}
                type="text"
                value={form.bienServicio}
                onChange={(e) => setFormField('bienServicio', e.target.value)}
                className={inputClass}
              />
            </AIAssistedField>

            <div>
              <label htmlFor={`ns-unidad-${project.id}`} className="block text-slate-700 font-semibold mb-1">
                Unidad de medida <span className="text-red-500">*</span>
              </label>
              <select
                id={`ns-unidad-${project.id}`}
                value={form.unidadMedidaId}
                onChange={(e) => setFormField('unidadMedidaId', e.target.value)}
                className={inputClass}
              >
                <option value="">Seleccione una unidad...</option>
                {measurementUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <AIAssistedField
                label="Descripción del bien o servicio"
                htmlFor={`ns-desc-${project.id}`}
                currentValue={form.descripcion}
                onAutoFill={(v: string) => setFormField('descripcion', v)}
                maxLength={500}
              >
                <CountedTextarea
                  id={`ns-desc-${project.id}`}
                  rows={2}
                  value={form.descripcion}
                  onChange={(e) => setFormField('descripcion', e.target.value)}
                  className={inputClass}
                />
              </AIAssistedField>
            </div>

            <div>
              <AIAssistedField
                label="Descripción de la Oferta"
                htmlFor={`ns-oferta-${project.id}`}
                currentValue={form.descripcionOferta}
                onAutoFill={(v: string) => setFormField('descripcionOferta', v)}
                maxLength={500}
              >
                <CountedTextarea
                  id={`ns-oferta-${project.id}`}
                  rows={3}
                  value={form.descripcionOferta}
                  onChange={(e) => setFormField('descripcionOferta', e.target.value)}
                  className={inputClass}
                />
              </AIAssistedField>
            </div>

            <div>
              <AIAssistedField
                label="Descripción de la Demanda"
                htmlFor={`ns-demanda-${project.id}`}
                currentValue={form.descripcionDemanda}
                onAutoFill={(v: string) => setFormField('descripcionDemanda', v)}
                maxLength={500}
              >
                <CountedTextarea
                  id={`ns-demanda-${project.id}`}
                  rows={3}
                  value={form.descripcionDemanda}
                  onChange={(e) => setFormField('descripcionDemanda', e.target.value)}
                  className={inputClass}
                />
              </AIAssistedField>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-slate-700 mb-3 text-sm">Serie histórica de la necesidad (años)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor={`ns-ai-${project.id}`} className="block text-slate-600 mb-1">Año inicial</label>
                <input
                  id={`ns-ai-${project.id}`}
                  type="number"
                  value={form.anioInicial}
                  onChange={(e) => setFormField('anioInicial', Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor={`ns-af-${project.id}`} className="block text-slate-600 mb-1">Año final</label>
                <input
                  id={`ns-af-${project.id}`}
                  type="number"
                  value={form.anioFinal}
                  onChange={(e) => setFormField('anioFinal', Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor={`ns-up-${project.id}`} className="block text-slate-600 mb-1">Último año proyectado</label>
                <input
                  id={`ns-up-${project.id}`}
                  type="number"
                  value={form.ultimoAnioProyectado}
                  onChange={(e) => setFormField('ultimoAnioProyectado', Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="mt-2 text-slate-500">
              {editingId
                ? 'Al cambiar el rango, los años fuera del nuevo rango se descartan y los años nuevos inician en 0.'
                : 'Al guardar se genera la cuadrícula con una fila por año, donde podrá diligenciar la oferta y la demanda.'}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={closeForm}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-4 py-1.5 border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors rounded text-sm disabled:opacity-60"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-medium hover:bg-[#20638f] transition-colors shadow-sm rounded text-sm disabled:opacity-60"
            >
              <Check className="w-4 h-4" /> {editingId ? 'Actualizar' : 'Aceptar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
