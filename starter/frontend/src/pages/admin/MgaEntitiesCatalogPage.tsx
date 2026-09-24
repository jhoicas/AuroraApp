import { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import {
  adminListMgaEntities,
  adminListMgaActors,
  adminCreateMgaEntity,
  adminUpdateMgaEntity,
  adminDeleteMgaEntity,
  type AdminMgaEntity,
  type AdminMgaActor,
} from '../../lib/adminApi';

export default function MgaEntitiesCatalogPage() {
  const [entities, setEntities] = useState<AdminMgaEntity[]>([]);
  const [actors, setActors] = useState<AdminMgaActor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActorFilter, setSelectedActorFilter] = useState<number>(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<AdminMgaEntity | null>(null);
  const [formData, setFormData] = useState({ id: 0, actor_id: 0, name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [entitiesData, actorsData] = await Promise.all([
        adminListMgaEntities(),
        adminListMgaActors(),
      ]);
      setEntities(entitiesData || []);
      setActors(actorsData || []);
    } catch (err) {
      setError('Error al cargar datos de entidades y actores MGA.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const actorMap = useMemo(() => {
    const map = new Map<number, string>();
    actors.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [actors]);

  const filteredEntities = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return entities.filter((ent) => {
      const matchesActor = selectedActorFilter === 0 || ent.actor_id === selectedActorFilter;
      if (!matchesActor) return false;
      if (!term) return true;
      const actorName = actorMap.get(ent.actor_id)?.toLowerCase() || '';
      return (
        ent.name.toLowerCase().includes(term) ||
        ent.id.toString().includes(term) ||
        actorName.includes(term)
      );
    });
  }, [entities, searchTerm, selectedActorFilter, actorMap]);

  const handleOpenCreate = () => {
    setEditingEntity(null);
    setFormData({ id: 0, actor_id: selectedActorFilter || (actors[0]?.id ?? 0), name: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entity: AdminMgaEntity) => {
    setEditingEntity(entity);
    setFormData({ id: entity.id, actor_id: entity.actor_id, name: entity.name });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('El nombre de la entidad es obligatorio.');
      return;
    }
    if (!formData.actor_id || formData.actor_id <= 0) {
      alert('Debe asociar la entidad a un actor válido.');
      return;
    }
    if (!editingEntity && (!formData.id || formData.id <= 0)) {
      alert('Debe ingresar un ID mayor a 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEntity) {
        await adminUpdateMgaEntity(editingEntity.id, {
          actor_id: formData.actor_id,
          name: formData.name.trim(),
        });
      } else {
        await adminCreateMgaEntity({
          id: formData.id,
          actor_id: formData.actor_id,
          name: formData.name.trim(),
        });
      }
      setIsModalOpen(false);
      void loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Error al guardar la entidad MGA.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`¿Está seguro de eliminar la entidad "${name}" (ID: ${id})?`)) return;
    try {
      await adminDeleteMgaEntity(id);
      void loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Error al eliminar la entidad MGA.';
      alert(msg);
    }
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">
              Entidades MGA
            </h3>
            <p className="text-base text-[#3f4949]">
              Catálogo de entidades institucionales asociadas a los actores de la MGA (DNP).
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-[#006162] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition-colors self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Nueva Entidad
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Filtros */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar entidad por ID, nombre o actor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] text-sm"
            />
          </div>
          <div className="w-full sm:w-64">
            <select
              value={selectedActorFilter}
              onChange={(e) => setSelectedActorFilter(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] bg-white"
            >
              <option value={0}>Todos los actores</option>
              {actors.map((act) => (
                <option key={act.id} value={act.id}>
                  {act.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold w-28">ID (Código)</th>
                <th className="px-6 py-4 font-semibold w-64">Actor Asociado</th>
                <th className="px-6 py-4 font-semibold">Nombre de la Entidad</th>
                <th className="px-6 py-4 font-semibold text-right w-32">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500">
                    Cargando entidades MGA...
                  </td>
                </tr>
              ) : filteredEntities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500">
                    No se encontraron entidades MGA.
                  </td>
                </tr>
              ) : (
                filteredEntities.map((ent) => {
                  const actorName = actorMap.get(ent.actor_id) || `Actor #${ent.actor_id}`;
                  return (
                    <tr key={ent.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4 font-semibold text-slate-900">{ent.id}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-[#E6FFFA] px-2.5 py-0.5 text-xs font-medium text-[#006a68]">
                          {actorName}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">{ent.name}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ent)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#006162] transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(ent.id, ent.name)}
                            className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingEntity ? 'Editar Entidad MGA' : 'Nueva Entidad MGA'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  ID (Código DNP)
                </label>
                <input
                  type="number"
                  required
                  disabled={!!editingEntity}
                  value={formData.id || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, id: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] disabled:bg-slate-100 text-sm"
                  placeholder="Ej: 1"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Actor Asociado
                </label>
                <select
                  required
                  value={formData.actor_id}
                  onChange={(e) =>
                    setFormData({ ...formData, actor_id: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] bg-white text-sm"
                >
                  <option value={0}>Seleccione un actor...</option>
                  {actors.map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.name} (ID: {act.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nombre de la Entidad
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] text-sm"
                  placeholder="Ej: Ministerio de Hacienda y Crédito Público"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-[#006162] px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-50 text-sm"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
