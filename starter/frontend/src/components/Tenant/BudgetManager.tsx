import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useProjectEdtStore } from '../../store/projectEdtStore';
import DNPExplorerModal, { type SelectedDNPProduct } from './DNPExplorerModal';

type BudgetManagerProps = {
  projectId: string;
};

const currencyFmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number): string {
  return currencyFmt.format(amount);
}

export default function BudgetManager({ projectId }: BudgetManagerProps) {
  const budget = useProjectStore((s) => s.budget);
  const isSaving = useProjectStore((s) => s.isSaving);
  const addBudgetItem = useProjectStore((s) => s.addBudgetItem);
  const deleteBudgetItem = useProjectStore((s) => s.deleteBudgetItem);

  const getChain = useProjectEdtStore((s) => s.getChain);
  const fetchEdtChain = useProjectEdtStore((s) => s.fetchEdtChain);
  const edtIsLoading = useProjectEdtStore((s) => s.isLoading);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<SelectedDNPProduct | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { catalogLink, activities, deliverables } = getChain(projectId);
  const requiresEdt = catalogLink?.requires_edt === true;

  useEffect(() => {
    void fetchEdtChain(projectId);
  }, [fetchEdtChain, projectId]);

  const freeBudgetTotal = useMemo(
    () => budget.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [budget],
  );

  const edtBudgetTotal = useMemo(
    () => activities.reduce((sum, a) => sum + (Number(a.total_cost) || 0), 0),
    [activities],
  );

  const deliverableNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of deliverables) {
      map.set(d.id, `${d.code} — ${d.name}`);
    }
    return map;
  }, [deliverables]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount.replace(/,/g, '.'));
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Ingresa una descripción y un monto válido mayor a 0.');
      return;
    }

    try {
      await addBudgetItem(projectId, {
        description: description.trim(),
        amount: parsedAmount,
        product_id: selectedProduct?.product_id,
      });
      setDescription('');
      setAmount('');
      setSelectedProduct(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar ítem');
    }
  };

  const handleDelete = async (itemId: string) => {
    setError(null);
    setDeletingId(itemId);
    try {
      await deleteBudgetItem(projectId, itemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 p-6 space-y-5">
      <div className="flex items-center gap-2 text-[#006162]">
        <span className="material-symbols-outlined">payments</span>
        <h3 className="text-lg font-semibold text-gray-800">Presupuesto</h3>
      </div>

      {requiresEdt && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-blue-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-semibold text-[#2980b9] mb-1">Presupuesto estructurado por EDT</p>
          <p>
            Este proyecto requiere Estructura de Desglose de Trabajo (EDT). El presupuesto debe
            gestionarse desde la pestaña <strong>Cadena de Valor</strong> en el Modo MGA.
          </p>
        </div>
      )}

      {!requiresEdt && (
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label htmlFor="budget-desc" className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <input
                id="budget-desc"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#006162]"
                placeholder="Ej. Construcción de acueducto rural"
              />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="budget-amount" className="block text-sm font-medium text-gray-700 mb-1">
                Monto
              </label>
              <input
                id="budget-amount"
                required
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#006162]"
                placeholder="1000000"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => setExplorerOpen(true)}
                className="w-full inline-flex justify-center items-center gap-1 rounded border border-[#006162] text-[#006162] hover:bg-teal-50 px-3 py-2 text-sm font-medium"
                title="Vincular Producto DNP"
              >
                <span className="material-symbols-outlined text-base">manage_search</span>
                <span className="hidden sm:inline">Vincular DNP</span>
              </button>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full inline-flex justify-center items-center gap-1 rounded bg-[#006162] hover:bg-[#004f50] disabled:opacity-60 text-white px-4 py-2 text-sm font-medium"
              >
                <span className="material-symbols-outlined text-base">add</span>
                {isSaving ? '…' : 'Agregar'}
              </button>
            </div>
          </div>

          {selectedProduct && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 text-[#006162] border border-teal-200 px-3 py-1 text-xs font-medium max-w-full">
                <span className="material-symbols-outlined text-sm">link</span>
                <span className="truncate">
                  {selectedProduct.code_bpin || selectedProduct.code} — {selectedProduct.name}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="ml-1 hover:text-[#004f50]"
                  aria-label="Quitar producto DNP"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </span>
            </div>
          )}

          {!selectedProduct && (
            <p className="text-xs text-gray-500">
              Opcional: vincula un producto oficial del catálogo DNP antes de agregar el ítem.
            </p>
          )}
        </form>
      )}

      {error && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {requiresEdt ? (
        <div className="overflow-x-auto rounded border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Actividad</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Entregable</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Cantidad</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Costo unit.</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {edtIsLoading && activities.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Cargando actividades de la cadena de valor…
                  </td>
                </tr>
              )}
              {!edtIsLoading && activities.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No hay actividades registradas en la Cadena de Valor. Agréguelas desde el Modo
                    MGA.
                  </td>
                </tr>
              )}
              {activities.map((activity) => (
                <tr key={activity.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">
                    <span className="font-medium">{activity.code}</span> — {activity.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {deliverableNameById.get(activity.project_deliverable_id) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{activity.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(activity.unit_cost)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatMoney(activity.total_cost)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#2980b9]/[0.08]">
                <td colSpan={4} className="px-4 py-3 font-semibold text-gray-800">
                  Total presupuesto EDT (solo lectura)
                </td>
                <td className="px-4 py-3 text-right font-bold text-[#2980b9] tabular-nums">
                  {formatMoney(edtBudgetTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Descripción</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Producto DNP</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Monto</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {budget.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No hay ítems de presupuesto. Agrega el primero arriba.
                  </td>
                </tr>
              )}

              {budget.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{item.description}</td>
                  <td className="px-4 py-3">
                    {item.product_id ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-[#006162] px-2 py-0.5 text-xs font-medium">
                        <span className="material-symbols-outlined text-sm">verified</span>
                        Vinculado
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800 tabular-nums">
                    {formatMoney(item.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex items-center justify-center rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      title="Eliminar"
                      aria-label="Eliminar ítem"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#006162]/[0.06]">
                <td colSpan={2} className="px-4 py-3 font-semibold text-gray-800">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-[#006162] tabular-nums">
                  {formatMoney(freeBudgetTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <DNPExplorerModal
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        onSelect={setSelectedProduct}
      />
    </div>
  );
}
