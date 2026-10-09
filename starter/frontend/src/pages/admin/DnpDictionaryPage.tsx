import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Check, Loader2 } from 'lucide-react';
import CatalogPagination from '../../components/admin/CatalogPagination';
import type { CatalogPageMeta } from '../../store/catalogStore';
import {
  DNP_UNIT_TYPOLOGY_LABELS,
  adminCreateDnpUnit,
  adminCreateDnpVerb,
  adminDeleteDnpUnit,
  adminDeleteDnpVerb,
  adminListDnpUnits,
  adminListDnpVerbs,
  adminUpdateDnpUnit,
  adminUpdateDnpVerb,
  dnpErrorMessage,
  type DnpStandardUnit,
  type DnpUnitInput,
  type DnpUnitTypology,
  type DnpVerb,
  type DnpVerbInput,
  type DnpVerbKind,
} from '../../lib/dnpDictionaryApi';

type Tab = 'verbs' | 'units';

const TYPOLOGIES = Object.keys(DNP_UNIT_TYPOLOGY_LABELS) as DnpUnitTypology[];
const PAGE_SIZE = 15;

const inputCls =
  'w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-[#006162] focus:border-[#006162] outline-none';

function KindBadge({ kind }: { kind: DnpVerbKind }) {
  return kind === 'STRONG' ? (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      Fuerte
    </span>
  ) : (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      Débil
    </span>
  );
}

export default function DnpDictionaryPage() {
  const [tab, setTab] = useState<Tab>('verbs');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);

  const [verbs, setVerbs] = useState<DnpVerb[]>([]);
  const [units, setUnits] = useState<DnpStandardUnit[]>([]);
  const [meta, setMeta] = useState<CatalogPageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [verbForm, setVerbForm] = useState<DnpVerbInput>({ verb: '', kind: 'STRONG', notes: '' });
  const [unitForm, setUnitForm] = useState<DnpUnitInput>({ name: '', symbol: '', typology: 'CONTEO', active: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filter, tab]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (tab === 'verbs') {
        const res = await adminListDnpVerbs({ page, limit: PAGE_SIZE, search: debouncedQuery, kind: filter as DnpVerbKind | '' });
        setVerbs(res.data ?? []);
        setMeta(res.meta);
      } else {
        const res = await adminListDnpUnits({ page, limit: PAGE_SIZE, search: debouncedQuery, typology: filter as DnpUnitTypology | '' });
        setUnits(res.data ?? []);
        setMeta(res.meta);
      }
    } catch (err) {
      setError(dnpErrorMessage(err, 'No se pudo cargar el diccionario DNP.'));
    } finally {
      setIsLoading(false);
    }
  }, [tab, page, debouncedQuery, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
    setFilter('');
    setQuery('');
    setMeta(null);
  };

  const openCreate = () => {
    setEditingId(null);
    setVerbForm({ verb: '', kind: 'STRONG', notes: '' });
    setUnitForm({ name: '', symbol: '', typology: 'CONTEO', active: true });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditVerb = (v: DnpVerb) => {
    setEditingId(v.id);
    setVerbForm({ verb: v.verb, kind: v.kind, notes: v.notes ?? '' });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditUnit = (u: DnpStandardUnit) => {
    setEditingId(u.id);
    setUnitForm({ name: u.name, symbol: u.symbol ?? '', typology: u.typology, active: u.active });
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (tab === 'verbs') {
        const input = { ...verbForm, verb: verbForm.verb.trim(), notes: verbForm.notes.trim() };
        if (editingId) await adminUpdateDnpVerb(editingId, input);
        else await adminCreateDnpVerb(input);
        setFlashMessage(`Verbo "${input.verb}" ${editingId ? 'actualizado' : 'creado'} exitosamente.`);
      } else {
        const input = { ...unitForm, name: unitForm.name.trim(), symbol: unitForm.symbol.trim() };
        if (editingId) await adminUpdateDnpUnit(editingId, input);
        else await adminCreateDnpUnit(input);
        setFlashMessage(`Unidad "${input.name}" ${editingId ? 'actualizada' : 'creada'} exitosamente.`);
      }
      closeModal();
      void load();
    } catch (err) {
      setError(dnpErrorMessage(err, 'Error al guardar el registro.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVerb = async (v: DnpVerb) => {
    if (!window.confirm(`¿Está seguro de eliminar el verbo "${v.verb}"?`)) return;
    try {
      await adminDeleteDnpVerb(v.id);
      setFlashMessage(`Verbo "${v.verb}" eliminado exitosamente.`);
      void load();
    } catch (err) {
      setError(dnpErrorMessage(err, 'Error al eliminar el verbo.'));
    }
  };

  const handleDeleteUnit = async (u: DnpStandardUnit) => {
    if (!window.confirm(`¿Está seguro de eliminar la unidad "${u.name}"?`)) return;
    try {
      await adminDeleteDnpUnit(u.id);
      setFlashMessage(`Unidad "${u.name}" eliminada exitosamente.`);
      void load();
    } catch (err) {
      setError(dnpErrorMessage(err, 'Error al eliminar la unidad.'));
    }
  };

  const rows = tab === 'verbs' ? verbs.length : units.length;
  const canSubmit = tab === 'verbs' ? verbForm.verb.trim().length > 1 : unitForm.name.trim().length > 0;

  const actionButtons = (onEdit: () => void, onDelete: () => void) => (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="p-1.5 text-slate-600 hover:text-[#006162] hover:bg-[#006162]/10 rounded-lg transition-colors"
        title="Editar"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        title="Eliminar"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">Diccionarios DNP</h3>
            <p className="text-base text-[#3f4949]">
              Verbos rectores y unidades de medida estándar de la guía DNP para la definición de actividades. La
              auditoría de formulación y el asistente IA usan estos valores.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#006162] hover:bg-[#004f50] text-white font-semibold rounded-lg shadow-sm transition-colors text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            {tab === 'verbs' ? 'Nuevo Verbo' : 'Nueva Unidad'}
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-200" role="tablist">
          {(['verbs', 'units'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => switchTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-[#006162] text-[#006162]' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'verbs' ? 'Verbos rectores' : 'Unidades de medida'}
            </button>
          ))}
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8 bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 focus-within:ring-2 focus-within:ring-[#006162]">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'verbs' ? 'Buscar verbo...' : 'Buscar unidad o símbolo...'}
              aria-label="Buscar"
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={tab === 'verbs' ? 'Filtrar por tipo' : 'Filtrar por tipología'}
            className="md:col-span-4 bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#006162]"
          >
            {tab === 'verbs' ? (
              <>
                <option value="">Todos los verbos</option>
                <option value="STRONG">Fuertes</option>
                <option value="WEAK">Débiles</option>
              </>
            ) : (
              <>
                <option value="">Todas las tipologías</option>
                {TYPOLOGIES.map((t) => (
                  <option key={t} value={t}>
                    {DNP_UNIT_TYPOLOGY_LABELS[t]}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                {tab === 'verbs' ? (
                  <tr>
                    <th className="px-6 py-4">Verbo</th>
                    <th className="px-6 py-4 w-32">Tipo</th>
                    <th className="px-6 py-4">Notas</th>
                    <th className="px-6 py-4 text-center w-28">Acciones</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-6 py-4">Unidad</th>
                    <th className="px-6 py-4 w-28">Símbolo</th>
                    <th className="px-6 py-4 w-36">Tipología</th>
                    <th className="px-6 py-4 w-28">Estado</th>
                    <th className="px-6 py-4 text-center w-28">Acciones</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#006162]" />
                      <p>Cargando diccionario...</p>
                    </td>
                  </tr>
                ) : rows === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No se encontraron registros.
                    </td>
                  </tr>
                ) : tab === 'verbs' ? (
                  verbs.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{v.verb}</td>
                      <td className="px-6 py-4">
                        <KindBadge kind={v.kind} />
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{v.notes || '—'}</td>
                      <td className="px-6 py-4">{actionButtons(() => openEditVerb(v), () => handleDeleteVerb(v))}</td>
                    </tr>
                  ))
                ) : (
                  units.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{u.name}</td>
                      <td className="px-6 py-4 font-mono text-slate-600">{u.symbol || '—'}</td>
                      <td className="px-6 py-4">{DNP_UNIT_TYPOLOGY_LABELS[u.typology] ?? u.typology}</td>
                      <td className="px-6 py-4 text-xs">
                        {u.active ? (
                          <span className="text-emerald-700 font-semibold">Activa</span>
                        ) : (
                          <span className="text-slate-400">Inactiva</span>
                        )}
                      </td>
                      <td className="px-6 py-4">{actionButtons(() => openEditUnit(u), () => handleDeleteUnit(u))}</td>
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
              <h4 className="text-lg font-semibold text-slate-800">
                {editingId ? 'Editar' : 'Nuevo'} {tab === 'verbs' ? 'verbo rector' : 'unidad de medida'}
              </h4>
              <button type="button" onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

              {tab === 'verbs' ? (
                <>
                  <div>
                    <label htmlFor="dnp-verb" className="block text-sm font-semibold text-slate-700 mb-1">
                      Verbo en infinitivo *
                    </label>
                    <input
                      id="dnp-verb"
                      type="text"
                      required
                      autoFocus
                      value={verbForm.verb}
                      onChange={(e) => setVerbForm({ ...verbForm, verb: e.target.value })}
                      placeholder="Ej: Diagnosticar"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="dnp-kind" className="block text-sm font-semibold text-slate-700 mb-1">
                      Tipo *
                    </label>
                    <select
                      id="dnp-kind"
                      value={verbForm.kind}
                      onChange={(e) => setVerbForm({ ...verbForm, kind: e.target.value as DnpVerbKind })}
                      className={inputCls}
                    >
                      <option value="STRONG">Fuerte (permitido como verbo rector)</option>
                      <option value="WEAK">Débil (la auditoría lo marca como hallazgo)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="dnp-notes" className="block text-sm font-semibold text-slate-700 mb-1">
                      Notas
                    </label>
                    <textarea
                      id="dnp-notes"
                      rows={2}
                      value={verbForm.notes}
                      onChange={(e) => setVerbForm({ ...verbForm, notes: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="dnp-unit-name" className="block text-sm font-semibold text-slate-700 mb-1">
                      Nombre de la unidad *
                    </label>
                    <input
                      id="dnp-unit-name"
                      type="text"
                      required
                      autoFocus
                      value={unitForm.name}
                      onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                      placeholder="Ej: Metros cúbicos"
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="dnp-unit-symbol" className="block text-sm font-semibold text-slate-700 mb-1">
                        Símbolo
                      </label>
                      <input
                        id="dnp-unit-symbol"
                        type="text"
                        value={unitForm.symbol}
                        onChange={(e) => setUnitForm({ ...unitForm, symbol: e.target.value })}
                        placeholder="m³"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="dnp-unit-typology" className="block text-sm font-semibold text-slate-700 mb-1">
                        Tipología *
                      </label>
                      <select
                        id="dnp-unit-typology"
                        value={unitForm.typology}
                        onChange={(e) => setUnitForm({ ...unitForm, typology: e.target.value as DnpUnitTypology })}
                        className={inputCls}
                      >
                        {TYPOLOGIES.map((t) => (
                          <option key={t} value={t}>
                            {DNP_UNIT_TYPOLOGY_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={unitForm.active}
                      onChange={(e) => setUnitForm({ ...unitForm, active: e.target.checked })}
                    />
                    Unidad activa (disponible en formularios e IA)
                  </label>
                </>
              )}

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
