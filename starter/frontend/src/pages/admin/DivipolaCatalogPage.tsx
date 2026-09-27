import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import { useCatalogStore } from '../../store/catalogStore';
import { triggerDivipolaSync } from '../../lib/adminApi';

export default function DivipolaCatalogPage() {
  const departments = useCatalogStore((s) => s.departments);
  const isLoadingDivipola = useCatalogStore((s) => s.isLoadingDivipola);
  const fetchDepartments = useCatalogStore((s) => s.fetchDepartments);

  const [isSyncing, setIsSyncing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchDepartments();
  }, [fetchDepartments]);

  const handleSync = async (file: File) => {
    if (!file) return;
    try {
      setIsSyncing(true);
      setSyncError(null);
      setFlash(null);

      const res = await triggerDivipolaSync(file);
      setFlash(`Sincronización exitosa: ${res.records_processed.toLocaleString('es-CO')} registros procesados.`);
      
      await fetchDepartments();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Error al sincronizar catálogo DIVIPOLA';
      setSyncError(msg);
    } finally {
      setIsSyncing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleSync(file);
    }
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">Catálogo Geográfico (DIVIPOLA)</h3>
            <p className="text-base text-[#3f4949]">
              Catálogo de Departamentos y Municipios.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={fileInputRef}
              onChange={onFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#006162] hover:bg-[#004e4f] text-white text-sm font-medium rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Cargar archivo JSON DIVIPOLA"
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{isSyncing ? 'Sincronizando...' : 'Cargar JSON (Datos Abiertos)'}</span>
            </button>
          </div>
        </div>

        {syncError && (
          <div className="bg-[#FFF5F5] border-l-4 border-[#E53E3E] text-[#C53030] p-4 rounded-r shadow-sm flex items-center justify-between">
            <div>
              <p className="font-semibold">Error al cargar archivo</p>
              <p className="text-sm">{syncError}</p>
            </div>
            <button
              onClick={() => setSyncError(null)}
              className="text-[#C53030] hover:text-[#9B2C2C] p-1 rounded-md transition-colors hover:bg-[#FED7D7]"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}

        {flash && (
          <div className="bg-[#F0FFF4] border-l-4 border-[#38A169] text-[#2F855A] p-4 rounded-r shadow-sm flex items-center justify-between">
            <div>
              <p className="font-semibold">Éxito</p>
              <p className="text-sm">{flash}</p>
            </div>
            <button
              onClick={() => setFlash(null)}
              className="text-[#2F855A] hover:text-[#22543D] p-1 rounded-md transition-colors hover:bg-[#C6F6D5]"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}

        <div className="glass-card bg-white/90 border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[400px] relative">
            {isLoadingDivipola && departments.length === 0 ? (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#E2E8F0] border-t-[#006162]"></div>
              </div>
            ) : null}

            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#3f4949]">
                <tr>
                  <th className="p-4 font-semibold w-24">Código DANE</th>
                  <th className="p-4 font-semibold">Departamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {departments.length === 0 && !isLoadingDivipola ? (
                  <tr>
                    <td colSpan={2} className="p-8 text-center text-[#6f7979]">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <span className="material-symbols-outlined text-5xl text-[#CBD5E0]">
                          find_in_page
                        </span>
                        <p className="text-lg">No se encontraron departamentos</p>
                        <p className="text-sm">Importa un archivo JSON de la DIVIPOLA.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  departments.map((dep) => (
                    <tr
                      key={dep.id}
                      className="hover:bg-[#F0FDF4] transition-colors group"
                    >
                      <td className="p-4 align-top text-[#6f7979] font-mono font-medium">
                        {dep.code}
                      </td>
                      <td className="p-4 align-top">
                        <div className="text-[#121c2c] font-medium leading-relaxed">
                          {dep.name}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
