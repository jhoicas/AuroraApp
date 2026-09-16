import { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Edit2, Archive, ArchiveRestore, Upload } from 'lucide-react';
import { useLocationStore, type Region, type Departamento, type Municipio } from '../../store/locationStore';
import {
  adminCreateRegion, adminUpdateRegion, adminToggleRegion,
  adminCreateDepartamento, adminUpdateDepartamento, adminToggleDepartamento,
  adminCreateMunicipio, adminUpdateMunicipio, adminToggleMunicipio,
  adminImportLocations
} from '../../lib/adminApi';
import CatalogImporterModal from '../../components/admin/CatalogImporterModal';

type Tab = 'regiones' | 'departamentos' | 'municipios';

export default function LocationsCatalogPage() {
  const { regions, isLoadingLocations, fetchLocations } = useLocationStore();
  const [activeTab, setActiveTab] = useState<Tab>('regiones');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<{ id: number; name: string; parentId?: number } | null>(null);
  const [formData, setFormData] = useState({ id: 0, name: '', parentId: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLocations(true); // fetch with force=true to bypass cache on mount
  }, [fetchLocations]);

  // Derived arrays
  const departamentos = useMemo(() => {
    return regions.flatMap(r => r.departamentos.map(d => ({ ...d, regionName: r.name })));
  }, [regions]);

  const municipios = useMemo(() => {
    return departamentos.flatMap(d => d.municipios.map(m => ({ ...m, departamentoName: d.name })));
  }, [departamentos]);

  // Filters
  const filteredRegiones = useMemo(() => {
    if (!searchTerm) return regions;
    const lower = searchTerm.toLowerCase();
    return regions.filter(r => r.name.toLowerCase().includes(lower) || String(r.id).includes(lower));
  }, [regions, searchTerm]);

  const filteredDepartamentos = useMemo(() => {
    if (!searchTerm) return departamentos;
    const lower = searchTerm.toLowerCase();
    return departamentos.filter(d => d.name.toLowerCase().includes(lower) || String(d.id).includes(lower));
  }, [departamentos, searchTerm]);

  const filteredMunicipios = useMemo(() => {
    if (!searchTerm) return municipios;
    const lower = searchTerm.toLowerCase();
    return municipios.filter(m => m.name.toLowerCase().includes(lower) || String(m.id).includes(lower));
  }, [municipios, searchTerm]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({ id: 0, name: '', parentId: 0 });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any, parentId?: number) => {
    setEditingItem({ id: item.id, name: item.name, parentId });
    setFormData({ id: item.id, name: item.name, parentId: parentId || 0 });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (activeTab === 'regiones') {
        if (editingItem) await adminUpdateRegion(editingItem.id, formData.name);
        else await adminCreateRegion({ id: formData.id, name: formData.name });
      } else if (activeTab === 'departamentos') {
        if (editingItem) await adminUpdateDepartamento(editingItem.id, formData.name);
        else await adminCreateDepartamento({ id: formData.id, name: formData.name, region_id: formData.parentId });
      } else {
        if (editingItem) await adminUpdateMunicipio(editingItem.id, formData.name);
        else await adminCreateMunicipio({ id: formData.id, name: formData.name, departamento_id: formData.parentId });
      }
      setIsModalOpen(false);
      fetchLocations(true);
    } catch (err) {
      alert('Error al guardar. Verifique los datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    if (!window.confirm('¿Está seguro de cambiar el estado?')) return;
    try {
      if (activeTab === 'regiones') await adminToggleRegion(id);
      else if (activeTab === 'departamentos') await adminToggleDepartamento(id);
      else await adminToggleMunicipio(id);
      fetchLocations(true);
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
          const json = JSON.parse(content);
          if (!json.Localizaciones || !Array.isArray(json.Localizaciones)) {
            throw new Error('El JSON debe contener un array "Localizaciones".');
          }
          await adminImportLocations(json.Localizaciones);
          resolve();
        } catch (error: any) {
          reject(new Error(error.message || 'Error parsing JSON'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  };

  return (
    <div className="mx-auto max-w-7xl py-8 px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catálogo de Localizaciones DANE</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestione regiones, departamentos y municipios.
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
            <Plus className="h-4 w-4" /> Nueva {activeTab === 'regiones' ? 'Región' : activeTab === 'departamentos' ? 'Departamento' : 'Municipio'}
          </button>
        </div>
      </div>

      <div className="mb-6 flex space-x-1 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setActiveTab('regiones')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === 'regiones' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Regiones
        </button>
        <button
          onClick={() => setActiveTab('departamentos')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === 'departamentos' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Departamentos
        </button>
        <button
          onClick={() => setActiveTab('municipios')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === 'municipios' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Municipios
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Buscar en ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Código DANE</th>
              <th className="px-6 py-4 font-semibold">Nombre</th>
              {activeTab === 'departamentos' && <th className="px-6 py-4 font-semibold">Región</th>}
              {activeTab === 'municipios' && <th className="px-6 py-4 font-semibold">Departamento</th>}
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingLocations ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">Cargando...</td>
              </tr>
            ) : activeTab === 'regiones' ? (
              filteredRegiones.map((r: any) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{r.id}</td>
                  <td className="px-6 py-4">{r.name}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenEdit(r)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#006162]">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : activeTab === 'departamentos' ? (
              filteredDepartamentos.map((d: any) => (
                <tr key={d.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{d.id}</td>
                  <td className="px-6 py-4">{d.name}</td>
                  <td className="px-6 py-4 text-slate-500">{d.regionName}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenEdit(d, d.region_id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#006162]">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              filteredMunicipios.map((m: any) => (
                <tr key={m.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{m.id}</td>
                  <td className="px-6 py-4">{m.name}</td>
                  <td className="px-6 py-4 text-slate-500">{m.departamentoName}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenEdit(m, m.departamento_id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#006162]">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CatalogImporterModal
        title="Importar Localizaciones"
        description="Suba el archivo JSON oficial con Regiones, Departamentos y Municipios. Los datos se actualizarán masivamente."
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImport={handleImport}
        onSuccess={() => {
          alert('Localizaciones importadas exitosamente.');
          fetchLocations(true);
        }}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingItem ? 'Editar' : 'Nueva'} {activeTab === 'regiones' ? 'Región' : activeTab === 'departamentos' ? 'Departamento' : 'Municipio'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">Código DANE</label>
                <input
                  type="number"
                  required
                  disabled={!!editingItem}
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] disabled:bg-slate-100"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">Nombre</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162]"
                />
              </div>
              {activeTab === 'departamentos' && (
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Región</label>
                  <select
                    required
                    disabled={!!editingItem}
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] disabled:bg-slate-100"
                  >
                    <option value="">Seleccione una región...</option>
                    {regions.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {activeTab === 'municipios' && (
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Departamento</label>
                  <select
                    required
                    disabled={!!editingItem}
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162] disabled:bg-slate-100"
                  >
                    <option value="">Seleccione un departamento...</option>
                    {departamentos.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.regionName})</option>
                    ))}
                  </select>
                </div>
              )}
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
