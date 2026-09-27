import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Check, Loader2 } from 'lucide-react';
import { useCatalogStore, type MeasurementUnit } from '../../store/catalogStore';
import CatalogPagination from '../../components/admin/CatalogPagination';

export default function MeasurementUnitsCatalogPage() {
  const measurementUnits = useCatalogStore((s) => s.measurementUnits);
  const measurementUnitsMeta = useCatalogStore((s) => s.measurementUnitsMeta);
  const isLoadingMeasurementUnits = useCatalogStore((s) => s.isLoadingMeasurementUnits);
  const error = useCatalogStore((s) => s.error);
  const fetchMeasurementUnits = useCatalogStore((s) => s.fetchMeasurementUnits);
  const createMeasurementUnit = useCatalogStore((s) => s.createMeasurementUnit);
  const updateMeasurementUnit = useCatalogStore((s) => s.updateMeasurementUnit);
  const deleteMeasurementUnit = useCatalogStore((s) => s.deleteMeasurementUnit);
  const clearError = useCatalogStore((s) => s.clearError);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchFocused, setSearchFocused] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<MeasurementUnit | null>(null);
  const [formData, setFormData] = useState({ id: 0, name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, limit]);

  useEffect(() => {
    void fetchMeasurementUnits({ page, limit, search: debouncedQuery });
  }, [page, limit, debouncedQuery, fetchMeasurementUnits]);

  const handleOpenCreate = () => {
    setEditingUnit(null);
    setFormData({ id: 0, name: '' });
    clearError();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: MeasurementUnit) => {
    setEditingUnit(unit);
    setFormData({ id: unit.id, name: unit.name });
    clearError();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUnit(null);
    setFormData({ id: 0, name: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingUnit) {
        await updateMeasurementUnit(editingUnit.id, formData.name.trim());
        setFlashMessage(`Unidad "${formData.name.trim()}" actualizada exitosamente.`);
      } else {
        await createMeasurementUnit({
          id: formData.id > 0 ? formData.id : undefined,
          name: formData.name.trim(),
        });
        setFlashMessage(`Unidad "${formData.name.trim()}" creada exitosamente.`);
      }
      handleCloseModal();
      void fetchMeasurementUnits({ page, limit, search: debouncedQuery });
    } catch (err: any) {
      alert(err.message || 'Error al guardar la unidad de medida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (unit: MeasurementUnit) => {
    if (!window.confirm(`¿Está seguro de eliminar la unidad de medida "${unit.name}" (ID: ${unit.id})?`)) {
      return;
    }
    try {
      await deleteMeasurementUnit(unit.id);
      setFlashMessage(`Unidad "${unit.name}" eliminada exitosamente.`);
      void fetchMeasurementUnits({ page, limit, search: debouncedQuery });
    } catch (err: any) {
      alert(err.message || 'Error al eliminar la unidad de medida.');
    }
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">
              Catálogo de Unidades de Medida
            </h3>
            <p className="text-base text-[#3f4949]">
              Gestiona las unidades de medida oficiales utilizadas en la formulación de proyectos MGA y estudio de necesidades.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#006162] hover:bg-[#004f50] text-white font-semibold rounded-lg shadow-sm transition-colors text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nueva Unidad
          </button>
        </div>

        {flashMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
            <span>{flashMessage}</span>
            <button
              type="button"
              onClick={() => setFlashMessage(null)}
              className="text-emerald-600 hover:text-emerald-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div
            className={`md:col-span-8 bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 transition-all ${
              searchFocused ? 'ring-2 ring-[#006162] border-transparent' : ''
            }`}
          >
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Buscar por nombre de unidad de medida..."
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 w-24">ID</th>
                  <th className="px-6 py-4">Nombre de la Unidad</th>
                  <th className="px-6 py-4">Fecha de Registro</th>
                  <th className="px-6 py-4 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {isLoadingMeasurementUnits ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#006162]" />
                      <p>Cargando unidades de medida...</p>
                    </td>
                  </tr>
                ) : measurementUnits.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      <p className="font-medium text-slate-600">No se encontraron unidades de medida.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {query ? 'Pruebe con otro término de búsqueda.' : 'Haga clic en "Nueva Unidad" para agregar una.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  measurementUnits.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-600">{u.id}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{u.name}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('es-CO') : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 text-slate-600 hover:text-[#006162] hover:bg-[#006162]/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
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

          {/* Pagination */}
          {measurementUnitsMeta && (
            <div className="p-4 border-t border-slate-200">
              <CatalogPagination
                meta={measurementUnitsMeta}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h4 className="text-lg font-semibold text-slate-800">
                {editingUnit ? 'Editar Unidad de Medida' : 'Nueva Unidad de Medida'}
              </h4>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingUnit && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    ID (Opcional - se autogenera si se deja en 0)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.id || ''}
                    onChange={(e) => setFormData({ ...formData, id: parseInt(e.target.value, 10) || 0 })}
                    placeholder="Auto"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-[#006162] focus:border-[#006162] outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nombre de la Unidad *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Kilogramos, Metros cúbicos, etc."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-[#006162] focus:border-[#006162] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#006162] hover:bg-[#004f50] text-white font-medium shadow-sm transition-colors text-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {editingUnit ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
