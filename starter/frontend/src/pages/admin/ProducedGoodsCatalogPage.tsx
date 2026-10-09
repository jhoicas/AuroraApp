import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Check, Loader2 } from 'lucide-react';
import CatalogPagination from '../../components/admin/CatalogPagination';
import type { CatalogPageMeta } from '../../store/catalogStore';
import {
  adminCreateProducedGood,
  adminDeleteProducedGood,
  adminListProducedGoods,
  adminUpdateProducedGood,
  producedGoodsErrorMessage,
  type ProducedGood,
} from '../../lib/producedGoodsApi';

const PAGE_SIZE = 15;

const inputCls =
  'w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-[#006162] focus:border-[#006162] outline-none';

export default function ProducedGoodsCatalogPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [goods, setGoods] = useState<ProducedGood[]>([]);
  const [meta, setMeta] = useState<CatalogPageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [rpc, setRpc] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminListProducedGoods({ page, limit: PAGE_SIZE, search: debouncedQuery });
      setGoods(res.data ?? []);
      setMeta(res.meta);
    } catch (err) {
      setError(producedGoodsErrorMessage(err, 'No se pudo cargar el catálogo de bienes producidos.'));
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setDescription('');
    setRpc('1');
    setError(null);
    setIsModalOpen(true);
  };

  const openEdit = (g: ProducedGood) => {
    setEditingId(g.id);
    setDescription(g.description);
    setRpc(String(g.rpc));
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const rpcValue = Number(rpc);
  const canSubmit = description.trim().length > 0 && rpc.trim() !== '' && Number.isFinite(rpcValue) && rpcValue >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const input = { description: description.trim(), rpc: rpcValue };
      if (editingId) await adminUpdateProducedGood(editingId, input);
      else await adminCreateProducedGood(input);
      setFlashMessage(`Bien "${input.description}" ${editingId ? 'actualizado' : 'creado'} exitosamente.`);
      closeModal();
      void load();
    } catch (err) {
      setError(producedGoodsErrorMessage(err, 'Error al guardar el bien producido.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (g: ProducedGood) => {
    if (!window.confirm(`¿Está seguro de eliminar el bien "${g.description}"?`)) return;
    try {
      await adminDeleteProducedGood(g.id);
      setFlashMessage(`Bien "${g.description}" eliminado exitosamente.`);
      void load();
    } catch (err) {
      setError(producedGoodsErrorMessage(err, 'Error al eliminar el bien producido.'));
    }
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">Bienes Producidos (RPC)</h3>
            <p className="text-base text-[#3f4949]">
              Bienes producidos y su Razón Precio Cuenta. El módulo Ingresos y Beneficios de la preparación MGA
              toma el RPC de este catálogo.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#006162] hover:bg-[#004f50] text-white font-semibold rounded-lg shadow-sm transition-colors text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nuevo Bien
          </button>
        </div>

        {flashMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
            <span>{flashMessage}</span>
            <button type="button" onClick={() => setFlashMessage(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && !isModalOpen && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 focus-within:ring-2 focus-within:ring-[#006162]">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar bien producido..."
            aria-label="Buscar"
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 w-32 text-right">RPC</th>
                  <th className="px-6 py-4 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#006162]" />
                      <p>Cargando bienes producidos...</p>
                    </td>
                  </tr>
                ) : goods.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No se encontraron registros.
                    </td>
                  </tr>
                ) : (
                  goods.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{g.description}</td>
                      <td className="px-6 py-4 text-right font-mono">{g.rpc.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(g)}
                            className="p-1.5 text-slate-600 hover:text-[#006162] hover:bg-[#006162]/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(g)}
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
          {meta && (
            <div className="p-4 border-t border-slate-200">
              <CatalogPagination meta={meta} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h4 className="text-lg font-semibold text-slate-800">{editingId ? 'Editar' : 'Nuevo'} bien producido</h4>
              <button type="button" onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
              <div>
                <label htmlFor="pg-description" className="block text-sm font-semibold text-slate-700 mb-1">
                  Descripción *
                </label>
                <textarea
                  id="pg-description"
                  rows={3}
                  required
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="pg-rpc" className="block text-sm font-semibold text-slate-700 mb-1">
                  Razón Precio Cuenta (RPC) *
                </label>
                <input
                  id="pg-rpc"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={rpc}
                  onChange={(e) => setRpc(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !canSubmit}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#006162] hover:bg-[#004f50] text-white font-medium shadow-sm transition-colors text-sm disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
