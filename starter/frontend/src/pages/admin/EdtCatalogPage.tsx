import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import CatalogImporter from '../../components/CatalogImporter';
import CatalogPagination from '../../components/admin/CatalogPagination';
import EdtDetailModal from '../../components/admin/EdtDetailModal';
import { useCatalogStore, type CatalogEdt } from '../../store/catalogStore';
import { useCopilotSearchSync } from '../../store/auroraCopilotStore';
import { getSyncStatus, triggerEdtSync, type CatalogSyncLog } from '../../lib/adminApi';

const LIMIT_OPTIONS = [5, 10, 20] as const;

function formatSyncDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function cellText(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v || v === '0') return '—';
  return v;
}

export default function EdtCatalogPage() {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('productCode') || searchParams.get('q') || '';

  const catalogEdt = useCatalogStore((s) => s.catalogEdt);
  const catalogEdtMeta = useCatalogStore((s) => s.catalogEdtMeta);
  const isLoadingEdt = useCatalogStore((s) => s.isLoadingEdt);
  const error = useCatalogStore((s) => s.error);
  const fetchCatalogEdt = useCatalogStore((s) => s.fetchCatalogEdt);
  const clearError = useCatalogStore((s) => s.clearError);

  const [query, setQuery] = useState(initialQ);
  useCopilotSearchSync('edt', setQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ.trim());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewingEdt, setViewingEdt] = useState<CatalogEdt | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Estado de sincronización SODA DNP
  const [syncLog, setSyncLog] = useState<CatalogSyncLog | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await getSyncStatus('EDT');
      setSyncLog(status);
    } catch {
      // Ignorar fallo no crítico en lectura de status
    }
  }, []);

  useEffect(() => {
    void loadSyncStatus();
  }, [loadSyncStatus]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, limit]);

  useEffect(() => {
    void fetchCatalogEdt({ page, limit, search: debouncedQuery });
  }, [page, limit, debouncedQuery, fetchCatalogEdt]);

  const refreshList = () => {
    void fetchCatalogEdt({ page: 1, limit, search: debouncedQuery });
    setPage(1);
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      setFlash(null);
      clearError();
      const res = await triggerEdtSync();

      const count = res?.records_processed ?? 0;
      setFlash(`Sincronización con Datos Abiertos DNP exitosa: ${count.toLocaleString('es-CO')} registros procesados.`);

      // Actualizar estado de sincronización local de inmediato
      if (res) {
        setSyncLog({
          id: res.sync_log_id,
          catalog_name: res.catalog_name || 'EDT',
          started_at: new Date(Date.now() - (res.duration_ms || 0)).toISOString(),
          completed_at: new Date().toISOString(),
          status: 'SUCCESS',
          records_processed: count,
        });
      }

      // Recargar de inmediato los datos del catálogo y confirmar estado de auditoría sin F5
      await Promise.allSettled([
        fetchCatalogEdt({ page: 1, limit, search: debouncedQuery }),
        loadSyncStatus(),
      ]);
      setPage(1);
    } catch (err: any) {
      const msg =
        err?.response?.data?.details ||
        err?.response?.data?.error ||
        err?.message ||
        'Error al sincronizar con Datos Abiertos DNP';
      setSyncError(msg);
      await loadSyncStatus();
    } finally {
      // Regla de Oro de UI: setIsSyncing(false) estrictamente en el finally
      setIsSyncing(false);
    }
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">
              Catálogo EDT
            </h3>
            <p className="text-base text-[#3f4949]">
              Matriz de entregables y actividades DNP. Unicidad por producto estandarizado +
              código de actividad.
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm text-[#6f7979]">
              {isSyncing ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Sincronización en curso con DNP...
                </span>
              ) : syncLog?.completed_at ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Última sincronización: {formatSyncDate(syncLog.completed_at)}
                  {syncLog.records_processed > 0 && ` (${syncLog.records_processed.toLocaleString('es-CO')} registros)`}
                </span>
              ) : syncLog?.status === 'IN_PROGRESS' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Sincronización en curso con DNP...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-slate-500 bg-slate-50 border border-slate-200">
                  Sin sincronización previa registrada
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-12 px-4 bg-[#006162] hover:bg-[#004e4f] text-white font-medium rounded-lg inline-flex items-center gap-2 shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Disparar sincronización con datos.gov.co"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar con DNP'}</span>
            </button>
          </div>
        </div>

        {syncError && (
          <div className="mb-6 bg-[#FFF5F5] border-l-4 border-[#E53E3E] text-[#C53030] p-4 rounded-r shadow-sm flex items-center justify-between">
            <div>
              <p className="font-semibold">Error al sincronizar con Datos Abiertos</p>
              <p className="text-sm">{syncError}</p>
            </div>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="text-[#C53030] hover:text-[#9B2C2C] p-1 rounded-md transition-colors hover:bg-[#FED7D7]"
              title="Cerrar"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}

        <CatalogImporter
          variant="edt"
          onImported={(result) => {
            const msg =
              'message' in result && result.message
                ? `${result.message}${
                    'inserted' in result
                      ? `: ${result.inserted ?? 0} nuevos, ${result.updated ?? 0} actualizados`
                      : ''
                  }`
                : 'Importación EDT completada.';
            setFlash(msg);
            clearError();
            refreshList();
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div
            className={`md:col-span-8 glass-card bg-white/95 p-5 rounded-xl border border-[#E2E8F0] flex items-center gap-4 transition-all duration-300 hover:border-[#319795] ${
              searchFocused ? 'ring-2 ring-[#006162] ring-offset-2' : ''
            }`}
          >
            <span className="material-symbols-outlined text-[#6f7979]">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Buscar por producto, entregable o actividad..."
              className="w-full bg-transparent border-none outline-none focus:ring-0 text-lg text-[#121c2c] placeholder:text-[#6f7979]"
            />
          </div>
          <div className="md:col-span-4 glass-card bg-white/95 p-5 rounded-xl border border-[#E2E8F0] flex items-center justify-between gap-3">
            <label htmlFor="edt-limit" className="font-semibold text-lg text-[#3f4949] shrink-0">
              Por página
            </label>
            <select
              id="edt-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full max-w-[120px] bg-transparent border border-[#bec9c8] rounded-lg px-3 py-2 text-lg text-[#3f4949] font-semibold"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(error || flash) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              error && !flash
                ? 'border-red-200 bg-red-50 text-red-700'
                : flash?.toLowerCase().includes('error') ||
                    flash?.toLowerCase().includes('no se pudo')
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-teal-200 bg-teal-50 text-teal-800'
            }`}
          >
            {flash || error}
            {flash && (
              <button
                type="button"
                className="ml-3 underline font-semibold"
                onClick={() => setFlash(null)}
              >
                Cerrar
              </button>
            )}
          </div>
        )}

        <div className="glass-card bg-white/95 rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[1400px] text-left border-collapse table-auto">
              <thead className="bg-[#2c7a7b] text-[#c1ffff]">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">
                    Cód. Producto
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap min-w-[250px]">
                    Nombre Producto
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">
                    Ent. L1
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap min-w-[200px]">
                    Nombre Ent. L1
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">
                    Ent. L2
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">
                    Ent. L3
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">
                    Cód. Actividad
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap min-w-[280px]">
                    Actividad
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">
                    Unidad
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap text-right sticky right-0 z-20 bg-[#2c7a7b] shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.15)]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm text-[#121c2c]">
                {isLoadingEdt && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-[#3f4949] whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[#006162]">
                          progress_activity
                        </span>
                        Cargando catálogo EDT…
                      </span>
                    </td>
                  </tr>
                )}
                {!isLoadingEdt && catalogEdt.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-[#3f4949] whitespace-nowrap">
                      No hay registros EDT. Importe el CSV de la matriz.
                    </td>
                  </tr>
                )}
                {!isLoadingEdt &&
                  catalogEdt.map((row) => (
                    <tr
                      key={row.id}
                      className="even:bg-[#E6FFFA] odd:bg-white hover:bg-[#e7eeff] transition-colors group"
                    >
                      <td className="px-4 py-3 font-bold whitespace-nowrap">
                        {cellText(row.codigo_producto_estandarizado)}
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap min-w-[250px] max-w-[320px] truncate"
                        title={row.nombre_producto}
                      >
                        {cellText(row.nombre_producto)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                        {cellText(row.codigo_entregable_l1)}
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap min-w-[200px] max-w-[280px] truncate text-[#3f4949]"
                        title={row.nombre_entregable_l1}
                      >
                        {cellText(row.nombre_entregable_l1)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                        {cellText(row.codigo_entregable_l2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                        {cellText(row.codigo_entregable_l3)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold">
                        {cellText(row.codigo_actividad)}
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap min-w-[280px] max-w-[360px] truncate"
                        title={row.actividad}
                      >
                        {cellText(row.actividad)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {cellText(row.unidad_de_medida)}
                      </td>
                      <td className="px-4 py-3 sticky right-0 z-10 whitespace-nowrap text-right border-l border-[#E2E8F0] bg-white group-even:bg-[#E6FFFA] group-hover:bg-[#e7eeff] shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.08)]">
                        <button
                          type="button"
                          onClick={() => setViewingEdt(row)}
                          className="h-9 px-3 rounded-lg border border-[#006a68] text-[#006a68] text-xs font-bold inline-flex items-center gap-1 hover:bg-[#E6FFFA]"
                          title="Ver ficha EDT"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <CatalogPagination
            meta={{
              total: catalogEdtMeta?.total ?? 0,
              page,
              limit,
              last_page: catalogEdtMeta?.last_page ?? 1,
            }}
            shown={catalogEdt.length}
            onPageChange={setPage}
          />
        </div>
      </div>

      {viewingEdt && (
        <EdtDetailModal edt={viewingEdt} onClose={() => setViewingEdt(null)} />
      )}
    </div>
  );
}
