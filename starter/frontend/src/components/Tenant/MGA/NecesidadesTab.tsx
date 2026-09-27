import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit3, HelpCircle, ArrowLeft, Check, PackageOpen } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type EstudioNecesidadItem } from '../../../store/projectMgaStore';
import { useCatalogStore } from '../../../store/catalogStore';
import MgaAlert from './MgaAlert';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import type { ProjectContext } from '../../../data/mgaFieldsKnowledge';

const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_FORM: EstudioNecesidadItem = {
  id: '',
  nombre: '',
  descripcion: '',
  descripcion_oferta: '',
  descripcion_demanda: '',
  unidad_medida_id: '',
  ano_inicial: CURRENT_YEAR - 5,
  ano_final: CURRENT_YEAR,
  ultimo_ano_proyectado: CURRENT_YEAR + 10,
};

export default function NecesidadesTab({ project }: { project: Project }) {
  const saveNecesidades = useProjectMgaStore((s) => s.saveNecesidades);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const measurementUnits = useCatalogStore((s) => s.measurementUnits);
  const fetchAllMeasurementUnits = useCatalogStore((s) => s.fetchAllMeasurementUnits);

  const initialItems = useMemo(() => {
    const form = useProjectMgaStore.getState().getFormulation(project.id);
    return form?.estudioNecesidades || form?.necesidades?.estudioNecesidades || [];
  }, [project.id]);

  const [items, setItems] = useState<EstudioNecesidadItem[]>(initialItems);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EstudioNecesidadItem>(DEFAULT_FORM);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchAllMeasurementUnits();
  }, [fetchAllMeasurementUnits]);

  const fieldProjectContext: ProjectContext = useMemo(() => ({
    projectName: project.name,
    sector: project.sector || undefined,
    productCode: project.product_code || undefined,
    procesoName: (project as any)?.proceso_id ? String((project as any)?.proceso_id) : undefined,
    objeto: (project as any)?.objeto || undefined,
  }), [project.name, project.sector, project.product_code, (project as any)?.proceso_id, (project as any)?.objeto]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      ...DEFAULT_FORM,
      id: crypto.randomUUID(),
    });
    setError(null);
    setMessage(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (item: EstudioNecesidadItem) => {
    setEditingId(item.id);
    setFormData({ ...item });
    setError(null);
    setMessage(null);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(DEFAULT_FORM);
    setError(null);
  };

  const handleAccept = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.nombre.trim()) {
      setError('El nombre del bien o servicio es obligatorio.');
      return;
    }
    if (!formData.unidad_medida_id) {
      setError('Debe seleccionar una unidad de medida.');
      return;
    }

    let updatedItems: EstudioNecesidadItem[];
    if (editingId) {
      updatedItems = items.map((it) => (it.id === editingId ? { ...formData } : it));
    } else {
      updatedItems = [...items, { ...formData, id: formData.id || crypto.randomUUID() }];
    }

    setItems(updatedItems);
    setIsAdding(false);
    setEditingId(null);
    setFormData(DEFAULT_FORM);
    setError(null);

    try {
      await saveNecesidades(project.id, {
        estudioNecesidades: updatedItems,
        items: updatedItems,
      });
      setMessage('Estudio de necesidades guardado exitosamente.');
    } catch (err) {
      setError('Error al guardar el estudio de necesidades en el servidor.');
    }
  };

  const handleDelete = async (id: string) => {
    const updatedItems = items.filter((it) => it.id !== id);
    setItems(updatedItems);
    try {
      await saveNecesidades(project.id, {
        estudioNecesidades: updatedItems,
        items: updatedItems,
      });
      setMessage('Elemento eliminado exitosamente.');
    } catch (err) {
      setError('Error al actualizar el estudio de necesidades.');
    }
  };

  const getUnitName = (unitId: number | string) => {
    if (!unitId) return '—';
    const found = measurementUnits.find((u) => String(u.id) === String(unitId));
    return found ? found.name : `Unidad (${unitId})`;
  };

  return (
    <div className="space-y-5 bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">Estudio de necesidades</h1>
            <HelpCircle className="w-5 h-5 text-slate-400" aria-hidden />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Caracterice los bienes y servicios del proyecto, su unidad de medida y el balance entre oferta y demanda.
          </p>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 bg-[#006162] hover:bg-[#004f50] text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        )}
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      {/* VISTA 1: FORMULARIO */}
      {isAdding ? (
        <form onSubmit={handleAccept} className="space-y-6 bg-slate-50/70 p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-base font-semibold text-slate-800">
              {editingId ? 'Editar Bien o Servicio' : 'Adicionar Bien o Servicio'}
            </h2>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="w-4 h-4" /> Volver a la tabla
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nombre del Bien o Servicio */}
            <div className="md:col-span-2">
              <AIAssistedField
                label="Bien o servicio *"
                htmlFor="necesidad-nombre"
                fieldHelpKey="bien_servicio"
                projectContext={fieldProjectContext}
                reactiveContext={formData}
                currentValue={formData.nombre}
                onAutoFill={(v) => setFormData((prev) => ({ ...prev, nombre: v }))}
                maxLength={500}
              >
                <input
                  spellCheck={true}
                  id="necesidad-nombre"
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Servicio de suministro de agua potable tratada"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </AIAssistedField>
            </div>

            {/* Unidad de Medida (Catálogo Dinámico) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Medido a través de (Unidad de Medida) *
              </label>
              <select
                required
                value={formData.unidad_medida_id}
                onChange={(e) => setFormData({ ...formData, unidad_medida_id: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">Seleccione una unidad de medida...</option>
                {measurementUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} (ID: {u.id})
                  </option>
                ))}
              </select>
              {measurementUnits.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Cargando catálogo de unidades de medida...</p>
              )}
            </div>

            {/* Descripción */}
            <div className="md:col-span-2">
              <AIAssistedField
                label="Descripción"
                htmlFor="necesidad-descripcion"
                fieldHelpKey="descripcion_necesidad"
                projectContext={fieldProjectContext}
                reactiveContext={formData}
                currentValue={formData.descripcion}
                onAutoFill={(v) => setFormData((prev) => ({ ...prev, descripcion: v }))}
                maxLength={1500}
              >
                <textarea
                  spellCheck={true}
                  id="necesidad-descripcion"
                  rows={3}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Detalle las especificaciones técnicas y características del bien o servicio..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </AIAssistedField>
            </div>

            {/* Descripción de la Oferta */}
            <div>
              <AIAssistedField
                label="Descripción de la oferta"
                htmlFor="necesidad-oferta"
                fieldHelpKey="descripcion_oferta"
                projectContext={fieldProjectContext}
                reactiveContext={formData}
                currentValue={formData.descripcion_oferta}
                onAutoFill={(v) => setFormData((prev) => ({ ...prev, descripcion_oferta: v }))}
                maxLength={1500}
              >
                <textarea
                  spellCheck={true}
                  id="necesidad-oferta"
                  rows={3}
                  value={formData.descripcion_oferta}
                  onChange={(e) => setFormData({ ...formData, descripcion_oferta: e.target.value })}
                  placeholder="Capacidad de producción o prestación actual del bien/servicio..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </AIAssistedField>
            </div>

            {/* Descripción de la Demanda */}
            <div>
              <AIAssistedField
                label="Descripción de la demanda"
                htmlFor="necesidad-demanda"
                fieldHelpKey="descripcion_demanda"
                projectContext={fieldProjectContext}
                reactiveContext={formData}
                currentValue={formData.descripcion_demanda}
                onAutoFill={(v) => setFormData((prev) => ({ ...prev, descripcion_demanda: v }))}
                maxLength={1500}
              >
                <textarea
                  spellCheck={true}
                  id="necesidad-demanda"
                  rows={3}
                  value={formData.descripcion_demanda}
                  onChange={(e) => setFormData({ ...formData, descripcion_demanda: e.target.value })}
                  placeholder="Requerimientos y necesidades estimadas de la población objetivo..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </AIAssistedField>
            </div>

            {/* Años de historia y proyección */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Inicio historia (Año Inicial)
              </label>
              <input
                spellCheck={true}
                type="number"
                value={formData.ano_inicial}
                onChange={(e) => setFormData({ ...formData, ano_inicial: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Final historia (Año Final)
              </label>
              <input
                spellCheck={true}
                type="number"
                value={formData.ano_final}
                onChange={(e) => setFormData({ ...formData, ano_final: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Último año proyectado
              </label>
              <input
                spellCheck={true}
                type="number"
                value={formData.ultimo_ano_proyectado}
                onChange={(e) => setFormData({ ...formData, ultimo_ano_proyectado: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none md:w-1/2"
              />
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-[#006162] hover:bg-[#004f50] text-white font-medium shadow-sm transition-colors text-sm disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Aceptar
            </button>
          </div>
        </form>
      ) : (
        /* VISTA 2: TABLA */
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-sm text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold">
                <tr>
                  <th className="px-4 py-3">Bien o servicio</th>
                  <th className="px-4 py-3">Medido a través de</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Descripción de la oferta</th>
                  <th className="px-4 py-3">Descripción de la demanda</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Inicio historia</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Final historia</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Último año</th>
                  <th className="px-4 py-3 text-center w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      <PackageOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                      <p className="font-medium text-slate-600">No hay bienes o servicios registrados.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Haga clic en "+ Adicionar" para crear el primer bien o servicio.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.nombre}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {getUnitName(item.unidad_medida_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={item.descripcion}>
                        {item.descripcion || '—'}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={item.descripcion_oferta}>
                        {item.descripcion_oferta || '—'}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={item.descripcion_demanda}>
                        {item.descripcion_demanda || '—'}
                      </td>
                      <td className="px-3 py-3 text-center">{item.ano_inicial || '—'}</td>
                      <td className="px-3 py-3 text-center">{item.ano_final || '—'}</td>
                      <td className="px-3 py-3 text-center">{item.ultimo_ano_proyectado || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#006162] text-[#006162] hover:bg-[#006162]/5 font-semibold rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Bien o Servicio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
