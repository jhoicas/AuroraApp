import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Upload } from 'lucide-react';
import { useLocationStore } from '../../store/locationStore';
import type { Region, Departamento } from '../../store/locationStore';
import {
  adminCreateRegion, adminUpdateRegion,
  adminCreateDepartamento, adminUpdateDepartamento,
  adminCreateMunicipio, adminUpdateMunicipio,
  adminCreateTipoAgrupacion, adminUpdateTipoAgrupacion,
  adminCreateAgrupacion, adminUpdateAgrupacion,
  listTiposAgrupacion,
  adminImportLocations,
  type AdminTipoAgrupacion
} from '../../lib/adminApi';
import CatalogImporterModal from '../../components/admin/CatalogImporterModal';
import CatalogPagination from '../../components/admin/CatalogPagination';

type Tab = 'regiones' | 'departamentos' | 'municipios' | 'tipos_agrupacion' | 'agrupaciones';

export default function LocationsCatalogPage() {
  const { regions, adminLocations, adminLocationsMeta, isLoadingLocations, fetchLocations, fetchAdminLocations } = useLocationStore();
  const [activeTab, setActiveTab] = useState<Tab>('regiones');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<{ id: number; name: string; parentId?: number; tipoAgrupacionId?: number } | null>(null);
  const [formData, setFormData] = useState({ id: 0, name: '', parentId: 0, tipoAgrupacionId: 0 });
  const [tiposAgrupacionList, setTiposAgrupacionList] = useState<AdminTipoAgrupacion[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAdminLocations(activeTab, searchTerm, page, limit);
  }, [fetchAdminLocations, activeTab, searchTerm, page, limit]);

  useEffect(() => {
    fetchLocations(false);
    void listTiposAgrupacion().then(setTiposAgrupacionList).catch(() => {});
  }, [fetchLocations]);

  const departamentos = regions.flatMap((r: Region) => 
    r.departamentos.map((d: Departamento) => ({ ...d, regionName: r.name }))
  );

  const municipios = regions.flatMap((r: Region) =>
    r.departamentos.flatMap((d: Departamento) =>
      d.municipios.map((m: any) => ({ ...m, depName: d.name, regionName: r.name }))
    )
  );

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchTerm('');
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({ id: 0, name: '', parentId: 0, tipoAgrupacionId: 0 });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any, parentId?: number, tipoAgrupacionId?: number) => {
    setEditingItem({ id: item.id, name: item.name, parentId, tipoAgrupacionId });
    setFormData({ 
      id: item.id, 
      name: item.name, 
      parentId: parentId || item.municipio_id || item.departamento_id || item.region_id || 0,
      tipoAgrupacionId: tipoAgrupacionId || item.tipo_agrupacion_id || 0,
    });
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
      } else if (activeTab === 'municipios') {
        if (editingItem) await adminUpdateMunicipio(editingItem.id, formData.name);
        else await adminCreateMunicipio({ id: formData.id, name: formData.name, departamento_id: formData.parentId });
      } else if (activeTab === 'tipos_agrupacion') {
        if (editingItem) await adminUpdateTipoAgrupacion(editingItem.id, formData.name);
        else await adminCreateTipoAgrupacion({ id: formData.id || undefined, name: formData.name });
        void listTiposAgrupacion().then(setTiposAgrupacionList).catch(() => {});
      } else if (activeTab === 'agrupaciones') {
        if (!formData.parentId || !formData.tipoAgrupacionId) {
          alert('Debe seleccionar el Municipio y el Tipo de Agrupación.');
          setIsSubmitting(false);
          return;
        }
        if (editingItem) {
          await adminUpdateAgrupacion(editingItem.id, {
            name: formData.name,
            municipio_id: formData.parentId,
            tipo_agrupacion_id: formData.tipoAgrupacionId
          });
        } else {
          await adminCreateAgrupacion({
            id: formData.id || undefined,
            name: formData.name,
            municipio_id: formData.parentId,
            tipo_agrupacion_id: formData.tipoAgrupacionId
          });
        }
      }
      setIsModalOpen(false);
      fetchAdminLocations(activeTab, searchTerm, page, limit);
    } catch (err) {
      alert('Error al guardar. Verifique los datos.');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleImport = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';

          let parsedLocations: any[] = [];
          if (isCSV) {
            const lines = content.split(/\r?\n/).filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.trim());
              const obj: any = {};
              headers.forEach((header, index) => {
                if (header === 'regionid') obj.RegionId = parseInt(values[index], 10);
                if (header === 'regionname') obj.RegionName = values[index];
                if (header === 'departamentoid') obj.DepartamentoId = parseInt(values[index], 10);
                if (header === 'departamentoname') obj.DepartamentoName = values[index];
                if (header === 'municipioid') obj.MunicipioId = parseInt(values[index], 10);
                if (header === 'municipioname') obj.MunicipioName = values[index];
              });
              
              if (obj.RegionId && obj.RegionName) {
                // Find or create Region
                let region: any = parsedLocations.find((r: any) => r.Id === obj.RegionId);
                if (!region) {
                  region = { Id: obj.RegionId, Name: obj.RegionName, Departamentos: [] };
                  parsedLocations.push(region);
                }
                
                if (obj.DepartamentoId && obj.DepartamentoName) {
                  let dep = region.Departamentos.find((d: any) => d.Id === obj.DepartamentoId);
                  if (!dep) {
                    dep = { Id: obj.DepartamentoId, Name: obj.DepartamentoName, Municipios: [] };
                    region.Departamentos.push(dep);
                  }
                  
                  if (obj.MunicipioId && obj.MunicipioName) {
                    if (!dep.Municipios.find((m: any) => m.Id === obj.MunicipioId)) {
                      dep.Municipios.push({ Id: obj.MunicipioId, Name: obj.MunicipioName });
                    }
                  }
                }
              }
            }
          } else {
            const json = JSON.parse(content);
            if (!json.Localizaciones || !Array.isArray(json.Localizaciones)) {
              throw new Error('El JSON debe contener un array "Localizaciones".');
            }
            parsedLocations = json.Localizaciones;
          }
          
          if (parsedLocations.length === 0) throw new Error('No se encontraron localizaciones válidas en el archivo.');

          await adminImportLocations(parsedLocations);
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
            <Plus className="h-4 w-4" /> Nuevo/a {activeTab === 'regiones' ? 'Región' : activeTab === 'departamentos' ? 'Departamento' : activeTab === 'municipios' ? 'Municipio' : activeTab === 'tipos_agrupacion' ? 'Tipo de Agrupación' : 'Agrupación'}
          </button>
        </div>
      </div>

      <div className="mb-6 flex space-x-1 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => handleTabChange('regiones')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === 'regiones' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Regiones
        </button>
        <button
          onClick={() => handleTabChange('departamentos')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === 'departamentos' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Departamentos
        </button>
        <button
          onClick={() => handleTabChange('municipios')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === 'municipios' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Municipios
        </button>
        <button
          onClick={() => handleTabChange('tipos_agrupacion')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === 'tipos_agrupacion' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Tipos de Agrupación
        </button>
        <button
          onClick={() => handleTabChange('agrupaciones')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === 'agrupaciones' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Agrupaciones Étnicas
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Buscar en ${activeTab.replace('_', ' ')}...`}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162]"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="limit" className="text-sm text-slate-600">Mostrar:</label>
          <select
            id="limit"
            className="rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162]"
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
              <th className="px-6 py-4 font-semibold">{activeTab === 'tipos_agrupacion' || activeTab === 'agrupaciones' ? 'ID' : 'Código DANE'}</th>
              <th className="px-6 py-4 font-semibold">Nombre</th>
              {activeTab === 'departamentos' && <th className="px-6 py-4 font-semibold">Región</th>}
              {activeTab === 'municipios' && <th className="px-6 py-4 font-semibold">Departamento</th>}
              {activeTab === 'agrupaciones' && <th className="px-6 py-4 font-semibold">Municipio</th>}
              {activeTab === 'agrupaciones' && <th className="px-6 py-4 font-semibold">Tipo Agrupación</th>}
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingLocations ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">Cargando...</td>
              </tr>
            ) : activeTab === 'regiones' ? (
              adminLocations.map((r: any) => (
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
              adminLocations.map((d: any) => (
                <tr key={d.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{d.id}</td>
                  <td className="px-6 py-4">{d.name}</td>
                  <td className="px-6 py-4 text-slate-500">{d.region_id}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenEdit(d, d.region_id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#006162]">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : activeTab === 'municipios' ? (
              adminLocations.map((m: any) => (
                <tr key={m.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{m.id}</td>
                  <td className="px-6 py-4">{m.name}</td>
                  <td className="px-6 py-4 text-slate-500">{m.departamento_id}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenEdit(m, m.departamento_id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#006162]">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : activeTab === 'tipos_agrupacion' ? (
              adminLocations.map((t: any) => (
                <tr key={t.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{t.id}</td>
                  <td className="px-6 py-4">{t.name}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenEdit(t)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#006162]">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              adminLocations.map((a: any) => (
                <tr key={a.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{a.id}</td>
                  <td className="px-6 py-4">{a.name}</td>
                  <td className="px-6 py-4 text-slate-600">{a.municipio?.name || a.municipio_id}</td>
                  <td className="px-6 py-4 text-slate-600">{a.tipo_agrupacion?.name || a.tipo_agrupacion_id}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenEdit(a, a.municipio_id, a.tipo_agrupacion_id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#006162]">
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

      {adminLocationsMeta && (
        <CatalogPagination
          meta={adminLocationsMeta}
          onPageChange={setPage}
        />
      )}

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
                {editingItem ? 'Editar' : 'Nueva'} {
                  activeTab === 'regiones' ? 'Región' : 
                  activeTab === 'departamentos' ? 'Departamento' : 
                  activeTab === 'municipios' ? 'Municipio' :
                  activeTab === 'tipos_agrupacion' ? 'Tipo de Agrupación' : 'Agrupación Étnica'
                }
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              {activeTab !== 'tipos_agrupacion' && activeTab !== 'agrupaciones' && (
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
              )}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">Nombre</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162]"
                  placeholder={
                    activeTab === 'tipos_agrupacion' ? 'Ej. Resguardo, Consejo Comunitario...' :
                    activeTab === 'agrupaciones' ? 'Ej. Resguardo Indígena...' : ''
                  }
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
                    {regions.map((r: Region) => (
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
                    {departamentos.map((d: Departamento & { regionName: string }) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.regionName})</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'agrupaciones' && (
                <>
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Municipio <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.parentId}
                      onChange={(e) => setFormData({ ...formData, parentId: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162]"
                    >
                      <option value="">Seleccione un municipio...</option>
                      {municipios.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.depName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-6">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Tipo de Agrupación <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.tipoAgrupacionId}
                      onChange={(e) => setFormData({ ...formData, tipoAgrupacionId: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#006162] focus:outline-none focus:ring-1 focus:ring-[#006162]"
                    >
                      <option value="">Seleccione un tipo de agrupación...</option>
                      {tiposAgrupacionList.map((t: AdminTipoAgrupacion) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
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
