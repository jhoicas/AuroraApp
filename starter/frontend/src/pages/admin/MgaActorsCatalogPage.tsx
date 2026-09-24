import { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import {
  adminListMgaActors,
  adminCreateMgaActor,
  adminUpdateMgaActor,
  adminDeleteMgaActor,
  type AdminMgaActor,
} from '../../lib/adminApi';

export default function MgaActorsCatalogPage() {
  const [actors, setActors] = useState<AdminMgaActor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActor, setEditingActor] = useState<AdminMgaActor | null>(null);
  const [formData, setFormData] = useState({ id: 0, name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchActors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminListMgaActors();
      setActors(data || []);
    } catch (err) {
      setError('Error al cargar la lista de actores MGA.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchActors();
  }, []);

  const filteredActors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return actors;
    return actors.filter(
      (a) => a.name.toLowerCase().includes(term) || a.id.toString().includes(term)
    );
  }, [actors, searchTerm]);

  const handleOpenCreate = () => {
    setEditingActor(null);
    setFormData({ id: 0, name: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (actor: AdminMgaActor) => {
    setEditingActor(actor);
    setFormData({ id: actor.id, name: actor.name });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('El nombre es obligatorio.');
      return;
    }
    if (!editingActor && (!formData.id || formData.id <= 0)) {
      alert('Debe ingresar un ID mayor a 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingActor) {
        await adminUpdateMgaActor(editingActor.id, formData.name.trim());
      } else {
        await adminCreateMgaActor({ id: formData.id, name: formData.name.trim() });
      }
      setIsModalOpen(false);
      void fetchActors();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Error al guardar el actor MGA.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`¿Está seguro de eliminar el actor "${name}" (ID: ${id})?`)) return;
    try {
      await adminDeleteMgaActor(id);
      void fetchActors();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Error al eliminar el actor MGA.';
      alert(msg);
    }
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">
              Actores MGA
            </h3>
            <p className="text-base text-[#3f4949]">
              Catálogo de actores institucionales y comunitarios según la Metodología General Ajustada (DNP).
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-[#006162] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition-colors self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Nuevo Actor
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Buscador */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar actor por ID o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] text-sm"
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold w-28">ID (Código)</th>
                <th className="px-6 py-4 font-semibold">Nombre del Actor</th>
                <th className="px-6 py-4 font-semibold text-right w-32">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    Cargando actores MGA...
                  </td>
                </tr>
              ) : filteredActors.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    No se encontraron actores MGA.
                  </td>
                </tr>
              ) : (
                filteredActors.map((actor) => (
                  <tr key={actor.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 font-semibold text-slate-900">{actor.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{actor.name}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(actor)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#006162] transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(actor.id, actor.name)}
                          className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
                {editingActor ? 'Editar Actor MGA' : 'Nuevo Actor MGA'}
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
                  disabled={!!editingActor}
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
                  Nombre del Actor
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] text-sm"
                  placeholder="Ej: Departamental"
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
