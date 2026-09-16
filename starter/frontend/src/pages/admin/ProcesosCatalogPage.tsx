import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Archive, ArchiveRestore, Upload } from 'lucide-react';
import { useCatalogStore } from '../../store/catalogStore';
import { adminCreateProceso, adminUpdateProceso, adminToggleProceso, adminImportProcesos } from '../../lib/adminApi';
import CatalogImporterModal from '../../components/admin/CatalogImporterModal';
import CatalogPagination from '../../components/admin/CatalogPagination';

export default function ProcesosCatalogPage() {
  const { procesos, procesosMeta, isLoadingProcesos, fetchProcesos } = useCatalogStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [editingProceso, setEditingProceso] = useState<{ id: number; name: string } | null>(null);
  const [formData, setFormData] = useState({ id: 0, name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProcesos(undefined, searchTerm, page, limit);
  }, [fetchProcesos, searchTerm, page, limit]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const filteredProcesos = procesos;

  const handleOpenCreate = () => {
    setEditingProceso(null);
    setFormData({ id: 0, name: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: { id: number; name: string }) => {
    setEditingProceso(p);
    setFormData({ id: p.id, name: p.name });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingProceso) {
        await adminUpdateProceso(editingProceso.id, formData.name);
      } else {
        await adminCreateProceso({ id: formData.id, name: formData.name });
      }
      setIsModalOpen(false);
      fetchProcesos();
    } catch (err) {
      alert('Error al guardar el proceso. Verifique que el ID no exista y que los datos sean correctos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    if (!window.confirm('¿Está seguro de cambiar el estado de este proceso?')) return;
    try {
      await adminToggleProceso(id);
      fetchProcesos(undefined, searchTerm, page, limit);
    } catch (err) {
      alert('Error al cambiar el estado.');
    }
  };

  const handleImport = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';
          
          let parsedProcesos = [];
          if (isCSV) {
            const lines = content.split(/\r?\n/).filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.trim());
              const obj: any = {};
              headers.forEach((header, index) => {
                if (header === 'id') obj.Id = parseInt(values[index], 10);
                if (header === 'name' || header === 'nombre') obj.Name = values[index];
              });
              if (obj.Id && obj.Name) {
                parsedProcesos.push({ id: obj.Id, name: obj.Name });
              }
            }
          } else {
            const json = JSON.parse(content);
            if (!json.Procesos || !Array.isArray(json.Procesos)) {
              throw new Error('El JSON debe contener un array "Procesos".');
            }
            parsedProcesos = json.Procesos;
          }
          
          if (parsedProcesos.length === 0) throw new Error('No se encontraron procesos válidos en el archivo.');

          await adminImportProcesos(parsedProcesos);
          resolve();
        } catch (error: any) {
          reject(new Error(error.message || 'Error parsing file'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  };

  return (
    <div className="mx-auto max-w-6xl py-8 px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catálogo de Procesos MGA</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestione los verbos rectores utilizados en la MGA.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsImporterOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" /> Importar JSON
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 rounded-lg bg-[#006162] px-4 py-2 font-medium text-white transition-colors hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" /> Nuevo Proceso
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ID o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162]"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ID o nombre..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="limit" className="text-sm text-slate-600">Mostrar:</label>
          <select
            id="limit"
            className="rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-800">
            <tr>
              <th className="px-6 py-4 font-semibold">ID MGA</th>
              <th className="px-6 py-4 font-semibold">Nombre</th>
              <th className="px-6 py-4 font-semibold">Estado</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingProcesos ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-500">
                  Cargando procesos...
                </td>
              </tr>
            ) : filteredProcesos.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-500">
                  No se encontraron procesos.
                </td>
              </tr>
            ) : (
              filteredProcesos.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{p.id}</td>
                  <td className="px-6 py-4">{p.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.is_active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {p.is_active !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#006162]"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(p.id)}
                        className={`rounded-lg p-2 ${p.is_active !== false ? 'text-amber-500 hover:bg-amber-50 hover:text-amber-700' : 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700'}`}
                        title={p.is_active !== false ? 'Desactivar' : 'Activar'}
                      >
                        {p.is_active !== false ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {procesosMeta && (
        <CatalogPagination
          meta={procesosMeta}
          onPageChange={setPage}
        />
      )}

      <CatalogImporterModal
        title="Importar Procesos MGA"
        description="Suba el archivo JSON oficial que contiene el arreglo de Procesos. Si el ID ya existe, actualizará su nombre."
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImport={handleImport}
        onSuccess={() => {
          alert('Procesos importados exitosamente.');
          fetchProcesos();
        }}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingProceso ? 'Editar Proceso' : 'Nuevo Proceso'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">ID (Código MGA)</label>
                <input
                  type="number"
                  required
                  disabled={!!editingProceso}
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] disabled:bg-slate-100"
                />
              </div>
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-slate-700">Nombre del Proceso</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162]"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-[#006162] px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
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
