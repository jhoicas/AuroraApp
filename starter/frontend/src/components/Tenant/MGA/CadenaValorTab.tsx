import { useMemo, useState } from 'react';
import { HelpCircle, Link2, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectEdtStore } from '../../../store/projectEdtStore';
import type {
  ProjectActivity,
  ProjectDeliverable,
  ProjectEdtNode,
} from '../../../lib/projectEdtApi';
import MgaAccordion from './MgaAccordion';
import MgaAlert from './MgaAlert';

type CadenaValorTabProps = {
  project: Project;
};

const EMPTY_NODE = { code: '', level: 1, name: '' };
const EMPTY_DELIVERABLE = { project_edt_node_id: '', code: '', name: '', amount: '' };
const EMPTY_ACTIVITY = {
  project_deliverable_id: '',
  code: '',
  name: '',
  quantity: '',
  unit_cost: '',
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CadenaValorTab({ project }: CadenaValorTabProps) {
  const [accCatalog, setAccCatalog] = useState(true);
  const [accEdt, setAccEdt] = useState(true);
  const [nodeDraft, setNodeDraft] = useState(EMPTY_NODE);
  const [deliverableDraft, setDeliverableDraft] = useState(EMPTY_DELIVERABLE);
  const [activityDraft, setActivityDraft] = useState(EMPTY_ACTIVITY);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingDeliverableId, setEditingDeliverableId] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const getChain = useProjectEdtStore((s) => s.getChain);
  const linkProduct = useProjectEdtStore((s) => s.linkProduct);
  const addEdtNode = useProjectEdtStore((s) => s.addEdtNode);
  const editEdtNode = useProjectEdtStore((s) => s.editEdtNode);
  const removeEdtNode = useProjectEdtStore((s) => s.removeEdtNode);
  const addDeliverable = useProjectEdtStore((s) => s.addDeliverable);
  const editDeliverable = useProjectEdtStore((s) => s.editDeliverable);
  const removeDeliverable = useProjectEdtStore((s) => s.removeDeliverable);
  const addActivity = useProjectEdtStore((s) => s.addActivity);
  const editActivity = useProjectEdtStore((s) => s.editActivity);
  const removeActivity = useProjectEdtStore((s) => s.removeActivity);
  const isSaving = useProjectEdtStore((s) => s.isSaving);
  const storeError = useProjectEdtStore((s) => s.error);
  const clearError = useProjectEdtStore((s) => s.clearError);

  const { catalogLink, edtNodes, deliverables, activities } = getChain(project.id);
  const displayError = localError ?? storeError;

  const productCodeHint = project.product_code?.trim() ?? '';

  const deliverablesByNode = useMemo(() => {
    const map = new Map<string, ProjectDeliverable[]>();
    for (const d of deliverables) {
      const list = map.get(d.project_edt_node_id) ?? [];
      list.push(d);
      map.set(d.project_edt_node_id, list);
    }
    return map;
  }, [deliverables]);

  const activitiesByDeliverable = useMemo(() => {
    const map = new Map<string, ProjectActivity[]>();
    for (const a of activities) {
      const list = map.get(a.project_deliverable_id) ?? [];
      list.push(a);
      map.set(a.project_deliverable_id, list);
    }
    return map;
  }, [activities]);

  const handleLinkProduct = async () => {
    const code = productCodeHint;
    if (!code) {
      setLocalError('El proyecto no tiene código de producto. Regístrelo en la ficha del proyecto.');
      return;
    }
    setLocalError(null);
    clearError();
    try {
      await linkProduct(project.id, code);
      setMessage('Producto vinculado y tipología resuelta correctamente.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo vincular el catálogo');
    }
  };

  const resetNodeForm = () => {
    setNodeDraft(EMPTY_NODE);
    setEditingNodeId(null);
  };

  const handleSaveNode = async () => {
    if (!nodeDraft.code.trim() || !nodeDraft.name.trim()) {
      setLocalError('Código y nombre del nodo EDT son obligatorios.');
      return;
    }
    setLocalError(null);
    try {
      const payload = {
        code: nodeDraft.code.trim(),
        level: nodeDraft.level,
        name: nodeDraft.name.trim(),
      };
      if (editingNodeId) {
        await editEdtNode(project.id, editingNodeId, payload);
        setMessage('Nodo EDT actualizado.');
      } else {
        await addEdtNode(project.id, payload);
        setMessage('Nodo EDT creado.');
      }
      resetNodeForm();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo guardar el nodo EDT');
    }
  };

  const startEditNode = (node: ProjectEdtNode) => {
    setEditingNodeId(node.id);
    setNodeDraft({ code: node.code, level: node.level, name: node.name });
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!window.confirm('¿Eliminar este nodo EDT? Los entregables y actividades asociados quedarán huérfanos en pantalla hasta recargar.')) return;
    setLocalError(null);
    try {
      await removeEdtNode(project.id, nodeId);
      if (editingNodeId === nodeId) resetNodeForm();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo eliminar el nodo');
    }
  };

  const resetDeliverableForm = () => {
    setDeliverableDraft(EMPTY_DELIVERABLE);
    setEditingDeliverableId(null);
  };

  const handleSaveDeliverable = async () => {
    if (!deliverableDraft.project_edt_node_id || !deliverableDraft.code.trim() || !deliverableDraft.name.trim()) {
      setLocalError('Seleccione un nodo EDT y complete código y nombre del entregable.');
      return;
    }
    const amount = Number.parseFloat(deliverableDraft.amount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0) {
      setLocalError('Indique un monto válido para el entregable.');
      return;
    }
    setLocalError(null);
    const payload = {
      project_edt_node_id: deliverableDraft.project_edt_node_id,
      code: deliverableDraft.code.trim(),
      name: deliverableDraft.name.trim(),
      amount,
    };
    try {
      if (editingDeliverableId) {
        await editDeliverable(project.id, editingDeliverableId, payload);
        setMessage('Entregable actualizado.');
      } else {
        await addDeliverable(project.id, payload);
        setMessage('Entregable creado.');
      }
      resetDeliverableForm();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo guardar el entregable');
    }
  };

  const startEditDeliverable = (item: ProjectDeliverable) => {
    setEditingDeliverableId(item.id);
    setDeliverableDraft({
      project_edt_node_id: item.project_edt_node_id,
      code: item.code,
      name: item.name,
      amount: String(item.amount),
    });
  };

  const handleDeleteDeliverable = async (id: string) => {
    if (!window.confirm('¿Eliminar este entregable?')) return;
    setLocalError(null);
    try {
      await removeDeliverable(project.id, id);
      if (editingDeliverableId === id) resetDeliverableForm();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo eliminar el entregable');
    }
  };

  const resetActivityForm = () => {
    setActivityDraft(EMPTY_ACTIVITY);
    setEditingActivityId(null);
  };

  const handleSaveActivity = async () => {
    if (!activityDraft.project_deliverable_id || !activityDraft.code.trim() || !activityDraft.name.trim()) {
      setLocalError('Seleccione un entregable y complete código y nombre de la actividad.');
      return;
    }
    const quantity = Number.parseFloat(activityDraft.quantity.replace(',', '.'));
    const unitCost = Number.parseFloat(activityDraft.unit_cost.replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      setLocalError('Cantidad y costo unitario deben ser valores numéricos válidos.');
      return;
    }
    setLocalError(null);
    const payload = {
      project_deliverable_id: activityDraft.project_deliverable_id,
      code: activityDraft.code.trim(),
      name: activityDraft.name.trim(),
      quantity,
      unit_cost: unitCost,
    };
    try {
      if (editingActivityId) {
        await editActivity(project.id, editingActivityId, payload);
        setMessage('Actividad actualizada.');
      } else {
        await addActivity(project.id, payload);
        setMessage('Actividad creada.');
      }
      resetActivityForm();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo guardar la actividad');
    }
  };

  const startEditActivity = (item: ProjectActivity) => {
    setEditingActivityId(item.id);
    setActivityDraft({
      project_deliverable_id: item.project_deliverable_id,
      code: item.code,
      name: item.name,
      quantity: String(item.quantity),
      unit_cost: String(item.unit_cost),
    });
  };

  const handleDeleteActivity = async (id: string) => {
    if (!window.confirm('¿Eliminar esta actividad?')) return;
    setLocalError(null);
    try {
      await removeActivity(project.id, id);
      if (editingActivityId === id) resetActivityForm();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo eliminar la actividad');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Cadena de valor</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {displayError && (
        <MgaAlert
          message={displayError}
          onDismiss={() => {
            setLocalError(null);
            clearError();
          }}
        />
      )}
      {message && (
        <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />
      )}

      <MgaAccordion
        number="01"
        title="Vínculo con el catálogo DNP"
        open={accCatalog}
        onToggle={() => setAccCatalog((v) => !v)}
      >
        {catalogLink ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="p-3 border rounded bg-gray-50">
              <span className="text-gray-500 block">Código producto</span>
              <span className="font-semibold text-[#2980b9]">{catalogLink.product_code}</span>
            </div>
            <div className="p-3 border rounded bg-gray-50">
              <span className="text-gray-500 block">Tipología PIIP</span>
              <span className="font-semibold">
                {catalogLink.tipologia || '—'}
                {catalogLink.requires_edt && (
                  <span className="ml-2 text-[#2e7d32] font-bold">(Tipología A — EDT)</span>
                )}
              </span>
            </div>
            <div className="p-3 border rounded bg-gray-50">
              <span className="text-gray-500 block">Sector / Programa</span>
              <span className="font-medium">
                {catalogLink.sector_code || '—'} / {catalogLink.program_code || '—'}
              </span>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="button"
                disabled={isSaving || !productCodeHint}
                onClick={() => void handleLinkProduct()}
                className="flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-semibold rounded disabled:opacity-60"
              >
                <Link2 className="w-4 h-4" />
                Revalidar tipología
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-600">
              {productCodeHint
                ? `Producto del proyecto: ${productCodeHint}. Vincule el catálogo para resolver la tipología PIIP.`
                : 'Este proyecto no tiene código de producto asignado. Configure el producto en la ficha del proyecto antes de vincular.'}
            </p>
            <button
              type="button"
              disabled={isSaving || !productCodeHint}
              onClick={() => void handleLinkProduct()}
              className="flex items-center gap-1 px-4 py-2 bg-[#2e7d32] text-white font-semibold rounded disabled:opacity-60"
            >
              <Link2 className="w-4 h-4" />
              Validar tipología / Vincular catálogo
            </button>
          </div>
        )}
      </MgaAccordion>

      {catalogLink && (
        <MgaAccordion
          number="02"
          title="Estructura de desglose (EDT)"
          open={accEdt}
          onToggle={() => setAccEdt((v) => !v)}
        >
          {catalogLink.requires_edt ? (
            <div className="space-y-6">
              <div className="rounded border border-[#2980b9]/30 bg-blue-50 px-3 py-2 text-[#2980b9]">
                Este proyecto corresponde a <strong>Tipología A</strong> y requiere estructurar el
                presupuesto mediante la cadena EDT → Entregables → Actividades según el catálogo
                oficial DNP.
              </div>

              {/* Nodos EDT */}
              <section className="space-y-3">
                <h3 className="font-bold text-gray-700">1. Nodos EDT</h3>
                <div className="grid gap-2 sm:grid-cols-3 border rounded p-3 bg-gray-50">
                  <input
                    type="text"
                    placeholder="Código"
                    value={nodeDraft.code}
                    onChange={(e) => setNodeDraft((d) => ({ ...d, code: e.target.value }))}
                    className="p-2 border rounded bg-white"
                  />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={nodeDraft.level}
                    onChange={(e) =>
                      setNodeDraft((d) => ({ ...d, level: Number.parseInt(e.target.value, 10) || 1 }))
                    }
                    className="p-2 border rounded bg-white"
                    aria-label="Nivel"
                  />
                  <input
                    type="text"
                    placeholder="Nombre del nodo"
                    value={nodeDraft.name}
                    onChange={(e) => setNodeDraft((d) => ({ ...d, name: e.target.value }))}
                    className="p-2 border rounded bg-white sm:col-span-3"
                  />
                  <div className="sm:col-span-3 flex justify-end gap-2">
                    {editingNodeId && (
                      <button type="button" onClick={resetNodeForm} className="px-3 py-1 border rounded">
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleSaveNode()}
                      className="flex items-center gap-1 px-3 py-1 bg-[#2980b9] text-white rounded disabled:opacity-60"
                    >
                      <PlusCircle className="w-4 h-4" />
                      {editingNodeId ? 'Actualizar nodo' : 'Adicionar nodo'}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-left">
                    <thead className="bg-[#6c757d] text-white">
                      <tr>
                        <th className="p-2 border">Acciones</th>
                        <th className="p-2 border">Código</th>
                        <th className="p-2 border">Nivel</th>
                        <th className="p-2 border">Nombre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {edtNodes.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-500">
                            No hay nodos EDT registrados.
                          </td>
                        </tr>
                      ) : (
                        edtNodes.map((node) => (
                          <tr key={node.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 border whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => startEditNode(node)}
                                className="p-1 bg-[#2980b9] text-white rounded mr-1"
                                aria-label="Editar nodo"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteNode(node.id)}
                                className="p-1 bg-[#2980b9] text-white rounded"
                                aria-label="Eliminar nodo"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                            <td className="p-2 border font-medium">{node.code}</td>
                            <td className="p-2 border">{node.level}</td>
                            <td className="p-2 border">{node.name}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Entregables */}
              <section className="space-y-3">
                <h3 className="font-bold text-gray-700">2. Entregables</h3>
                <div className="grid gap-2 sm:grid-cols-2 border rounded p-3 bg-gray-50">
                  <select
                    value={deliverableDraft.project_edt_node_id}
                    onChange={(e) =>
                      setDeliverableDraft((d) => ({ ...d, project_edt_node_id: e.target.value }))
                    }
                    className="p-2 border rounded bg-white sm:col-span-2"
                  >
                    <option value="">— Nodo EDT —</option>
                    {edtNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.code} — {n.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Código entregable"
                    value={deliverableDraft.code}
                    onChange={(e) => setDeliverableDraft((d) => ({ ...d, code: e.target.value }))}
                    className="p-2 border rounded bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Monto"
                    value={deliverableDraft.amount}
                    onChange={(e) => setDeliverableDraft((d) => ({ ...d, amount: e.target.value }))}
                    className="p-2 border rounded bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Nombre del entregable"
                    value={deliverableDraft.name}
                    onChange={(e) => setDeliverableDraft((d) => ({ ...d, name: e.target.value }))}
                    className="p-2 border rounded bg-white sm:col-span-2"
                  />
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    {editingDeliverableId && (
                      <button type="button" onClick={resetDeliverableForm} className="px-3 py-1 border rounded">
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSaving || edtNodes.length === 0}
                      onClick={() => void handleSaveDeliverable()}
                      className="flex items-center gap-1 px-3 py-1 bg-[#2980b9] text-white rounded disabled:opacity-60"
                    >
                      <PlusCircle className="w-4 h-4" />
                      {editingDeliverableId ? 'Actualizar entregable' : 'Adicionar entregable'}
                    </button>
                  </div>
                </div>
                {edtNodes.map((node) => {
                  const nodeDeliverables = deliverablesByNode.get(node.id) ?? [];
                  if (nodeDeliverables.length === 0) return null;
                  return (
                    <div key={node.id} className="border rounded overflow-hidden">
                      <div className="bg-gray-100 px-3 py-2 font-semibold text-gray-700">
                        Nodo: {node.code} — {node.name}
                      </div>
                      <table className="w-full text-left">
                        <thead className="bg-[#6c757d] text-white">
                          <tr>
                            <th className="p-2 border">Acciones</th>
                            <th className="p-2 border">Código</th>
                            <th className="p-2 border">Nombre</th>
                            <th className="p-2 border">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nodeDeliverables.map((d) => (
                            <tr key={d.id} className="border-b">
                              <td className="p-2 border whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => startEditDeliverable(d)}
                                  className="p-1 bg-[#2980b9] text-white rounded mr-1"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteDeliverable(d.id)}
                                  className="p-1 bg-[#2980b9] text-white rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                              <td className="p-2 border">{d.code}</td>
                              <td className="p-2 border">{d.name}</td>
                              <td className="p-2 border font-semibold">{formatMoney(d.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </section>

              {/* Actividades */}
              <section className="space-y-3">
                <h3 className="font-bold text-gray-700">3. Actividades</h3>
                <div className="grid gap-2 sm:grid-cols-2 border rounded p-3 bg-gray-50">
                  <select
                    value={activityDraft.project_deliverable_id}
                    onChange={(e) =>
                      setActivityDraft((d) => ({ ...d, project_deliverable_id: e.target.value }))
                    }
                    className="p-2 border rounded bg-white sm:col-span-2"
                  >
                    <option value="">— Entregable —</option>
                    {deliverables.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Código actividad"
                    value={activityDraft.code}
                    onChange={(e) => setActivityDraft((d) => ({ ...d, code: e.target.value }))}
                    className="p-2 border rounded bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Cantidad"
                    value={activityDraft.quantity}
                    onChange={(e) => setActivityDraft((d) => ({ ...d, quantity: e.target.value }))}
                    className="p-2 border rounded bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Costo unitario"
                    value={activityDraft.unit_cost}
                    onChange={(e) => setActivityDraft((d) => ({ ...d, unit_cost: e.target.value }))}
                    className="p-2 border rounded bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Nombre de la actividad"
                    value={activityDraft.name}
                    onChange={(e) => setActivityDraft((d) => ({ ...d, name: e.target.value }))}
                    className="p-2 border rounded bg-white sm:col-span-2"
                  />
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    {editingActivityId && (
                      <button type="button" onClick={resetActivityForm} className="px-3 py-1 border rounded">
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSaving || deliverables.length === 0}
                      onClick={() => void handleSaveActivity()}
                      className="flex items-center gap-1 px-3 py-1 bg-[#2980b9] text-white rounded disabled:opacity-60"
                    >
                      <PlusCircle className="w-4 h-4" />
                      {editingActivityId ? 'Actualizar actividad' : 'Adicionar actividad'}
                    </button>
                  </div>
                </div>
                {deliverables.map((del) => {
                  const delActivities = activitiesByDeliverable.get(del.id) ?? [];
                  if (delActivities.length === 0) return null;
                  return (
                    <div key={del.id} className="border rounded overflow-hidden">
                      <div className="bg-gray-100 px-3 py-2 font-semibold text-gray-700">
                        Entregable: {del.code} — {del.name}
                      </div>
                      <table className="w-full text-left">
                        <thead className="bg-[#6c757d] text-white">
                          <tr>
                            <th className="p-2 border">Acciones</th>
                            <th className="p-2 border">Código</th>
                            <th className="p-2 border">Nombre</th>
                            <th className="p-2 border">Cantidad</th>
                            <th className="p-2 border">Costo unit.</th>
                            <th className="p-2 border">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {delActivities.map((a) => (
                            <tr key={a.id} className="border-b">
                              <td className="p-2 border whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => startEditActivity(a)}
                                  className="p-1 bg-[#2980b9] text-white rounded mr-1"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteActivity(a.id)}
                                  className="p-1 bg-[#2980b9] text-white rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                              <td className="p-2 border">{a.code}</td>
                              <td className="p-2 border">{a.name}</td>
                              <td className="p-2 border">{a.quantity}</td>
                              <td className="p-2 border">{formatMoney(a.unit_cost)}</td>
                              <td className="p-2 border font-semibold">{formatMoney(a.total_cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </section>
            </div>
          ) : (
            <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700">
              El producto seleccionado (<strong>{catalogLink.product_code}</strong>, tipología{' '}
              <strong>{catalogLink.tipologia || '—'}</strong>) no requiere EDT. El presupuesto puede
              gestionarse libremente.
            </div>
          )}
        </MgaAccordion>
      )}
    </div>
  );
}
