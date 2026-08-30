import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

type AuditUsageLogItem = {
  id: string;
  user_id: string;
  role?: string;
  action: string;
  tenant_name: string;
  user_email: string;
  created_at: string;
};

type AuditChatMessageItem = {
  id: string;
  user_id: string;
  role: string;
  content: string;
  model?: string;
  route_context?: string;
  created_at: string;
};

type PaginatedResponse<T> = {
  data: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type Tab = 'usage' | 'chat';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-CO');
  } catch {
    return iso;
  }
}

export default function AiAuditPanel() {
  const [tab, setTab] = useState<Tab>('usage');
  const [usageLogs, setUsageLogs] = useState<AuditUsageLogItem[]>([]);
  const [chatLogs, setChatLogs] = useState<AuditChatMessageItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = tab === 'usage' ? '/ai/audit/usage' : '/ai/audit/chat';
        const { data } = await api.get<PaginatedResponse<AuditUsageLogItem | AuditChatMessageItem>>(
          endpoint,
          { params: { page: nextPage, page_size: 25 } },
        );

        if (tab === 'usage') {
          const items = data.data as AuditUsageLogItem[];
          setUsageLogs((prev) => (reset ? items : [...prev, ...items]));
        } else {
          const items = data.data as AuditChatMessageItem[];
          setChatLogs((prev) => (reset ? items : [...prev, ...items]));
        }

        setPage(nextPage);
        setHasMore(nextPage < data.total_pages);
      } catch {
        setError('No se pudieron cargar los registros de auditoría.');
      } finally {
        setLoading(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    setUsageLogs([]);
    setChatLogs([]);
    setPage(1);
    setHasMore(true);
    void loadPage(1, true);
  }, [tab, loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadPage(page + 1, false);
        }
      },
      { rootMargin: '120px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadPage, page]);

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Panel de auditoría IA</h3>
          <p className="text-sm text-gray-500">Telemetría de uso y mensajes de Aurora Copilot.</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setTab('usage')}
            className={`px-4 py-2 font-medium ${tab === 'usage' ? 'bg-[#006162] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            AiUsageLog
          </button>
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={`px-4 py-2 font-medium ${tab === 'chat' ? 'bg-[#006162] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            AiChatMessage
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-100">
        {tab === 'usage' && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Tenant</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {usageLogs.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2">{row.tenant_name || 'N/A'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.action}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 truncate max-w-[220px]" title={row.user_email}>
                    {row.user_email || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'chat' && (
          <ul className="divide-y divide-gray-100">
            {chatLogs.map((row) => (
              <li key={row.id} className="px-3 py-3 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase text-[#006162]">{row.role}</span>
                  <span className="text-xs text-gray-400">{formatDate(row.created_at)}</span>
                </div>
                <p className="text-sm text-gray-800 line-clamp-3">{row.content}</p>
                {row.route_context && (
                  <p className="text-[10px] text-gray-400 mt-1 truncate">{row.route_context}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {!loading && tab === 'usage' && usageLogs.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">Sin registros de telemetría.</p>
        )}
        {!loading && tab === 'chat' && chatLogs.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">Sin mensajes de chat.</p>
        )}

        <div ref={sentinelRef} className="h-8 flex items-center justify-center">
          {loading && <span className="text-xs text-gray-400">Cargando…</span>}
          {!hasMore && (usageLogs.length > 0 || chatLogs.length > 0) && (
            <span className="text-xs text-gray-400">Fin del historial</span>
          )}
        </div>
      </div>
    </section>
  );
}
