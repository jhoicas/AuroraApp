import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  HelpCircle,
  Link2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectEdtStore } from '../../../store/projectEdtStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import type {
  ProjectActivity,
  ProjectDeliverable,
  ProjectEdtNode,
} from '../../../lib/projectEdtApi';
import MgaAlert from './MgaAlert';

type CadenaValorTabProps = {
  project: Project;
};

interface ProductMeta {
  indicador?: string;
  unidad_medida?: string;
  cantidad?: number | string;
  etapa?: string;
  objective_id?: string;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CadenaValorTab({ project }: CadenaValorTabProps) {
  const [accCatalog, setAccCatalog] = useState(false);
  const [openObjectives, setOpenObjectives] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modales
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productModalMode, setProductModalMode] = useState<'create' | 'edit'>('create');
  const [targetObjectiveId, setTargetObjectiveId] = useState<string>('');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    code: '',
    name: '',
    indicador: '',
    unidad_medida: '',
    cantidad: '1',
    etapa: 'Inversión',
  });

  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityModalMode, setActivityModalMode] = useState<'create' | 'edit'>('create');
  const [targetProduct, setTargetProduct] = useState<ProjectEdtNode | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState({
    code: '',
    name: '',
    quantity: '1',
    unit_cost: '0',
    etapa: 'Inversión',
  });

  const [isProgramarModalOpen, setIsProgramarModalOpen] = useState(false);
  const [selectedProgramarActivity, setSelectedProgramarActivity] = useState<ProjectActivity | null>(null);

  // Metadata de productos
  const [productMetadata, setProductMetadata] = useState<Record<string, ProductMeta>>(() => {
    return (
      project.mga_formulation_data?.cadena_valor?.product_metadata ||
      project.mga_formulation_data?.cadenaValor?.product_metadata ||
      {}
    );
  });

  // Stores
  const getChain = useProjectEdtStore((s) => s.getChain);
  const fetchEdtChain = useProjectEdtStore((s) => s.fetchEdtChain);
  const linkProduct = useProjectEdtStore((s) => s.linkProduct);
  const addEdtNode = useProjectEdtStore((s) => s.addEdtNode);
  const editEdtNode = useProjectEdtStore((s) => s.editEdtNode);
  const removeEdtNode = useProjectEdtStore((s) => s.removeEdtNode);
  const addDeliverable = useProjectEdtStore((s) => s.addDeliverable);
  const addActivity = useProjectEdtStore((s) => s.addActivity);
  const editActivity = useProjectEdtStore((s) => s.editActivity);
  const removeActivity = useProjectEdtStore((s) => s.removeActivity);
  const isEdtSaving = useProjectEdtStore((s) => s.isSaving);
  const clearEdtError = useProjectEdtStore((s) => s.clearError);

  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const saveCadenaDeValor = useProjectMgaStore((s) => s.saveCadenaDeValor);
  const isMgaSaving = useProjectMgaStore((s) => s.isSaving);

  const formulation = getFormulation(project.id);
  const { catalogLink, edtNodes, deliverables, activities } = getChain(project.id);

  // Carga inicial EDT
  useEffect(() => {
    void fetchEdtChain(project.id).catch(() => {});
  }, [fetchEdtChain, project.id]);

  const productCodeHint = project.product_code?.trim() ?? '';

  // Entregables indexados por nodo EDT
  const deliverablesByNode = useMemo(() => {
    const map = new Map<string, ProjectDeliverable[]>();
    for (const d of deliverables) {
      const list = map.get(d.project_edt_node_id) ?? [];
      list.push(d);
      map.set(d.project_edt_node_id, list);
    }
    return map;
  }, [deliverables]);

  // Actividades indexadas por entregable
  const activitiesByDeliverable = useMemo(() => {
    const map = new Map<string, ProjectActivity[]>();
    for (const a of activities) {
      const list = map.get(a.project_deliverable_id) ?? [];
      list.push(a);
      map.set(a.project_deliverable_id, list);
    }
    return map;
  }, [activities]);

  // Obtener todas las actividades de un Producto (Nodo EDT)
  const getActivitiesForProduct = (nodeId: string): ProjectActivity[] => {
    const dels = deliverablesByNode.get(nodeId) ?? [];
    const acts: ProjectActivity[] = [];
    for (const d of dels) {
      const dActs = activitiesByDeliverable.get(d.id) ?? [];
      acts.push(...dActs);
    }
    return acts;
  };

  // Costo total de un producto (suma de sus actividades)
  const getProductCost = (nodeId: string): number => {
    const acts = getActivitiesForProduct(nodeId);
    return acts.reduce(
      (sum, a) => sum + (Number(a.total_cost) || Number(a.quantity) * Number(a.unit_cost) || 0),
      0
    );
  };

  // Extraer objetivos específicos del MGA
  const specificObjectives = useMemo(() => {
    const direct = (formulation.causeRelations || []).filter(
      (c) => c.causeType === 'Causa directa' && c.specificObjective?.trim()
    );
    if (direct.length > 0) return direct;

    const anyObj = (formulation.causeRelations || []).filter((c) => c.specificObjective?.trim());
    if (anyObj.length > 0) return anyObj;

    return [
      {
        id: 'default-obj-1',
        causeType: 'Causa directa' as const,
        causeDescription: project.problem_description || 'Problema central del proyecto',
        specificObjective: project.general_objective || 'Objetivo específico 1',
      },
    ];
  }, [formulation.causeRelations, project.problem_description, project.general_objective]);

  // Alternativa activa
  const activeAlternative =
    formulation.alternatives?.[0]?.description || project.name || 'Alternativa 1';

  // Inicializar estado de acordeones de objetivos (todos abiertos por defecto)
  useEffect(() => {
    setOpenObjectives((prev) => {
      const updated = { ...prev };
      specificObjectives.forEach((obj) => {
        if (updated[obj.id] === undefined) {
          updated[obj.id] = true;
        }
      });
      return updated;
    });
  }, [specificObjectives]);

  // Agrupación de productos por objetivo
  const productsByObjective = useMemo(() => {
    const map = new Map<string, ProjectEdtNode[]>();
    specificObjectives.forEach((obj) => map.set(obj.id, []));

    edtNodes.forEach((node) => {
      const meta = productMetadata[node.id];
      let assignedObjId = meta?.objective_id;

      if (!assignedObjId) {
        const match = node.code.match(/^(\d+)\./);
        if (match) {
          const objIndex = parseInt(match[1], 10) - 1;
          if (objIndex >= 0 && objIndex < specificObjectives.length) {
            assignedObjId = specificObjectives[objIndex].id;
          }
        }
      }

      if (!assignedObjId || !map.has(assignedObjId)) {
        assignedObjId = specificObjectives[0].id;
      }

      map.get(assignedObjId)!.push(node);
    });

    return map;
  }, [edtNodes, specificObjectives, productMetadata]);

  // Costo total de un objetivo
  const getObjectiveCost = (objId: string): number => {
    const prods = productsByObjective.get(objId) ?? [];
    return prods.reduce((sum, p) => sum + getProductCost(p.id), 0);
  };

  // Costo total de la alternativa
  const totalAlternativeCost = useMemo(() => {
    return activities.reduce(
      (sum, a) => sum + (Number(a.total_cost) || Number(a.quantity) * Number(a.unit_cost) || 0),
      0
    );
  }, [activities]);

  const toggleObjective = (objId: string) => {
    setOpenObjectives((prev) => ({ ...prev, [objId]: !prev[objId] }));
  };

  const handleLinkProduct = async () => {
    const code = productCodeHint;
    if (!code) {
      setLocalError('El proyecto no tiene código de producto. Regístrelo en la ficha del proyecto.');
      return;
    }
    setLocalError(null);
    clearEdtError();
    try {
      await linkProduct(project.id, code);
      setMessage('Producto vinculado y tipología resuelta correctamente.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo vincular el catálogo');
    }
  };

  // Guardar Sección
  const handleSaveSection = async () => {
    setLocalError(null);
    setSuccessMessage(null);
    try {
      await saveCadenaDeValor(project.id, {
        product_metadata: productMetadata,
      });
      setSuccessMessage('Cadena de Valor guardada exitosamente.');
    } catch (err) {
      setLocalError('Error al guardar la sección.');
    }
  };

  // --- Handlers de Productos ---
  const handleOpenAddProduct = (objectiveId: string, objIndex: number) => {
    setTargetObjectiveId(objectiveId);
    setProductModalMode('create');
    setEditingNodeId(null);
    const existingCount = (productsByObjective.get(objectiveId) ?? []).length;
    setProductForm({
      code: `${objIndex}.${existingCount + 1}`,
      name: '',
      indicador: 'Número de intervenciones ejecutadas',
      unidad_medida: 'Unidad',
      cantidad: '1',
      etapa: 'Inversión',
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (node: ProjectEdtNode) => {
    setEditingNodeId(node.id);
    setProductModalMode('edit');
    const meta = productMetadata[node.id] || {};
    setProductForm({
      code: node.code,
      name: node.name,
      indicador: meta.indicador || 'Número de intervenciones ejecutadas',
      unidad_medida: meta.unidad_medida || 'Unidad',
      cantidad: String(meta.cantidad ?? '1'),
      etapa: meta.etapa || 'Inversión',
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.code.trim() || !productForm.name.trim()) {
      setLocalError('Código y nombre del producto son requeridos.');
      return;
    }
    setLocalError(null);
    try {
      if (productModalMode === 'edit' && editingNodeId) {
        await editEdtNode(project.id, editingNodeId, {
          code: productForm.code.trim(),
          name: productForm.name.trim(),
        });
        setProductMetadata((prev) => ({
          ...prev,
          [editingNodeId]: {
            ...prev[editingNodeId],
            indicador: productForm.indicador.trim(),
            unidad_medida: productForm.unidad_medida.trim(),
            cantidad: Number(productForm.cantidad) || 1,
            etapa: productForm.etapa,
          },
        }));
        setMessage('Producto actualizado exitosamente.');
      } else {
        const createdNode = await addEdtNode(project.id, {
          code: productForm.code.trim(),
          level: 1,
          name: productForm.name.trim(),
        });

        // Crear automáticamente el entregable base para hospedar actividades
        await addDeliverable(project.id, {
          project_edt_node_id: createdNode.id,
          code: `${productForm.code.trim()}.1`,
          name: `Entregable de ${productForm.name.trim()}`,
          amount: 0,
        });

        setProductMetadata((prev) => ({
          ...prev,
          [createdNode.id]: {
            objective_id: targetObjectiveId,
            indicador: productForm.indicador.trim(),
            unidad_medida: productForm.unidad_medida.trim(),
            cantidad: Number(productForm.cantidad) || 1,
            etapa: productForm.etapa,
          },
        }));
        setMessage('Producto adicionado exitosamente.');
      }
      setIsProductModalOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Error al guardar producto');
    }
  };

  const handleDeleteProduct = async (nodeId: string) => {
    if (!window.confirm('¿Está seguro de eliminar este Producto y todas sus actividades asociadas?')) return;
    setLocalError(null);
    try {
      await removeEdtNode(project.id, nodeId);
      setProductMetadata((prev) => {
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });
      setMessage('Producto eliminado exitosamente.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Error al eliminar producto');
    }
  };

  // --- Handlers de Actividades ---
  const handleOpenAddActivity = async (product: ProjectEdtNode) => {
    setTargetProduct(product);
    setActivityModalMode('create');
    setEditingActivityId(null);

    const currentActs = getActivitiesForProduct(product.id);
    setActivityForm({
      code: `${product.code}.${currentActs.length + 1}`,
      name: '',
      quantity: '1',
      unit_cost: '0',
      etapa: 'Inversión',
    });
    setIsActivityModalOpen(true);
  };

  const handleOpenEditActivity = (act: ProjectActivity, product: ProjectEdtNode) => {
    setTargetProduct(product);
    setActivityModalMode('edit');
    setEditingActivityId(act.id);
    setActivityForm({
      code: act.code,
      name: act.name,
      quantity: String(act.quantity),
      unit_cost: String(act.unit_cost),
      etapa: 'Inversión',
    });
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = async () => {
    if (!activityForm.code.trim() || !activityForm.name.trim()) {
      setLocalError('Código y nombre de la actividad son requeridos.');
      return;
    }
    const qty = Number.parseFloat(activityForm.quantity.replace(',', '.'));
    const unitCost = Number.parseFloat(activityForm.unit_cost.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      setLocalError('Ingrese una cantidad válida (> 0) y un costo unitario válido (>= 0).');
      return;
    }
    if (!targetProduct) return;

    setLocalError(null);
    try {
      if (activityModalMode === 'edit' && editingActivityId) {
        await editActivity(project.id, editingActivityId, {
          code: activityForm.code.trim(),
          name: activityForm.name.trim(),
          quantity: qty,
          unit_cost: unitCost,
        });
        setMessage('Actividad actualizada exitosamente.');
      } else {
        // Encontrar o crear entregable para este producto
        let dels = deliverablesByNode.get(targetProduct.id) ?? [];
        let delId = dels[0]?.id;
        if (!delId) {
          const createdDel = await addDeliverable(project.id, {
            project_edt_node_id: targetProduct.id,
            code: `${targetProduct.code}.1`,
            name: `Entregable de ${targetProduct.name}`,
            amount: 0,
          });
          delId = createdDel.id;
        }

        await addActivity(project.id, {
          project_deliverable_id: delId,
          code: activityForm.code.trim(),
          name: activityForm.name.trim(),
          quantity: qty,
          unit_cost: unitCost,
        });
        setMessage('Actividad adicionada exitosamente.');
      }
      setIsActivityModalOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Error al guardar la actividad');
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!window.confirm('¿Está seguro de eliminar esta actividad?')) return;
    setLocalError(null);
    try {
      await removeActivity(project.id, activityId);
      setMessage('Actividad eliminada exitosamente.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Error al eliminar actividad');
    }
  };

  // Programar Costos
  const handleOpenProgramCostos = (act: ProjectActivity) => {
    setSelectedProgramarActivity(act);
    setIsProgramarModalOpen(true);
  };

  return (
    <div className="space-y-6 bg-white p-6 border rounded-xl shadow-sm text-sm">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-[#006162] rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Cadena de valor</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Estructuración metodológica oficial MGA: Objetivos específicos, Productos y Actividades.
            </p>
          </div>
        </div>

        {/* Acceso opcional al catálogo */}
        <button
          type="button"
          onClick={() => setAccCatalog((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Link2 className="w-3.5 h-3.5 text-[#006162]" />
          <span>{accCatalog ? 'Ocultar catálogo DNP' : 'Vínculo catálogo DNP'}</span>
        </button>
      </div>

      {localError && <MgaAlert message={localError} onDismiss={() => setLocalError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}
      {successMessage && <MgaAlert message={successMessage} variant="success" onDismiss={() => setSuccessMessage(null)} />}

      {/* Panel Plegable del Catálogo DNP */}
      {accCatalog && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
              Vínculo con el catálogo DNP
            </span>
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </div>

          {catalogLink ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              <div className="p-3 border rounded-lg bg-white">
                <span className="text-slate-500 block text-[11px]">Código producto</span>
                <span className="font-semibold text-[#006162]">{catalogLink.product_code}</span>
              </div>
              <div className="p-3 border rounded-lg bg-white">
                <span className="text-slate-500 block text-[11px]">Tipología PIIP</span>
                <span className="font-semibold text-slate-800">
                  {catalogLink.tipologia || '—'}
                  {catalogLink.requires_edt && (
                    <span className="ml-2 text-teal-700 font-bold">(Tipología A — EDT)</span>
                  )}
                </span>
              </div>
              <div className="p-3 border rounded-lg bg-white">
                <span className="text-slate-500 block text-[11px]">Sector / Programa</span>
                <span className="font-medium text-slate-800">
                  {catalogLink.sector_code || '—'} / {catalogLink.program_code || '—'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <p className="text-slate-600">
                {productCodeHint
                  ? `Producto del proyecto: ${productCodeHint}. Valide la tipología PIIP.`
                  : 'Configure el producto en la ficha del proyecto antes de vincular.'}
              </p>
              <button
                type="button"
                disabled={isEdtSaving || !productCodeHint}
                onClick={() => void handleLinkProduct()}
                className="px-3.5 py-1.5 bg-[#006162] text-white rounded-lg hover:bg-teal-800 text-xs font-medium disabled:opacity-50 transition-colors"
              >
                Validar tipología DNP
              </button>
            </div>
          )}
        </div>
      )}

      {/* Listado de Objetivos Específicos (Estructura de Acordeón MGA Oficial) */}
      <div className="space-y-6">
        {specificObjectives.map((obj, objIndex) => {
          const isOpen = openObjectives[obj.id] ?? true;
          const objCost = getObjectiveCost(obj.id);
          const products = productsByObjective.get(obj.id) ?? [];

          return (
            <div
              key={obj.id}
              className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs transition-all"
            >
              {/* Cabecera del Acordeón por Objetivo */}
              <div
                onClick={() => toggleObjective(obj.id)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200 cursor-pointer select-none hover:bg-slate-100/80 transition-colors"
              >
                {/* Lado Izquierdo: Nombre del Objetivo */}
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#006162] text-white text-xs font-bold shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-semibold text-sm text-slate-800">
                    ✓ {objIndex + 1}. Objetivo específico {objIndex + 1}: {obj.specificObjective}
                  </span>
                </div>

                {/* Lado Derecho: Costo Total del Objetivo + Toggle */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 font-medium mr-1.5">Costo: $</span>
                    <span className="text-sm font-bold text-slate-800">{formatMoney(objCost).replace('COP', '').trim()}</span>
                  </div>
                  <div className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-300 text-slate-600 bg-white">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Contenido Desplegable del Objetivo */}
              {isOpen && (
                <div className="p-4 sm:p-5 space-y-6">
                  {/* Bloque superior gris claro: Descripción de Alternativa/Objetivo + Botón Adicionar producto */}
                  <div className="bg-slate-100 p-4 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-slate-200">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="text-[#006162] font-bold">Alternativa:</span>
                        <span>{activeAlternative}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {obj.causeDescription
                          ? `Causa asociada: ${obj.causeDescription}`
                          : `Objetivo: ${obj.specificObjective}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddProduct(obj.id, objIndex + 1)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#002855] hover:bg-[#001f42] text-white text-xs font-medium rounded-lg shadow-sm transition-colors shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Adicionar producto</span>
                    </button>
                  </div>

                  {/* Layout de Nodos (Producto a la izquierda vs Actividades a la derecha) */}
                  {products.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2">
                      <p className="text-xs text-slate-500 font-medium">
                        No hay productos registrados en este objetivo específico.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Haga clic en "+ Adicionar producto" para estructurar la cadena de valor.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {products.map((prod, prodIdx) => {
                        const meta = productMetadata[prod.id] || {};
                        const prodActs = getActivitiesForProduct(prod.id);
                        const prodCost = getProductCost(prod.id);

                        return (
                          <div
                            key={prod.id}
                            className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start"
                          >
                            {/* Tarjeta de Producto (Izquierda - col-span-5) */}
                            <div className="lg:col-span-5 bg-slate-100 border border-slate-300 rounded-xl overflow-hidden flex flex-col justify-between shadow-xs">
                              {/* Cuerpo de información del producto */}
                              <div className="p-4 space-y-2 text-xs text-slate-800">
                                <h3 className="font-bold text-slate-900 text-sm leading-snug">
                                  {prod.code} Producto {prodIdx + 1}: {prod.name}
                                </h3>

                                <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                                  <div className="flex items-baseline justify-between">
                                    <span className="text-slate-600 font-medium">Indicador principal :</span>
                                    <span className="text-slate-900 font-semibold text-right">
                                      {meta.indicador || 'Número de intervenciones ejecutadas'}
                                    </span>
                                  </div>

                                  <div className="flex items-baseline justify-between">
                                    <span className="text-slate-600 font-medium">Unidad de Medida :</span>
                                    <span className="text-slate-900 font-semibold text-right">
                                      {meta.unidad_medida || 'Unidad'}
                                    </span>
                                  </div>

                                  <div className="flex items-baseline justify-between">
                                    <span className="text-slate-600 font-medium">Cantidad :</span>
                                    <span className="text-slate-900 font-semibold text-right">
                                      {meta.cantidad ?? 1}
                                    </span>
                                  </div>

                                  <div className="flex items-baseline justify-between">
                                    <span className="text-slate-600 font-medium">Costo $</span>
                                    <span className="text-slate-900 font-bold text-right">
                                      {formatMoney(prodCost).replace('COP', '').trim()}
                                    </span>
                                  </div>

                                  <div className="flex items-baseline justify-between">
                                    <span className="text-slate-600 font-medium">Etapa :</span>
                                    <span className="text-slate-900 font-semibold text-right">
                                      {meta.etapa || 'Inversión'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Barra de acción inferior (Gris oscuro / Morado) */}
                              <div className="bg-slate-700 px-3.5 py-2.5 flex items-center justify-between text-white text-xs">
                                <button
                                  type="button"
                                  onClick={() => void handleOpenAddActivity(prod)}
                                  className="inline-flex items-center gap-1.5 hover:text-slate-200 font-medium"
                                  title="Adicionar actividad al producto"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Adicionar actividad</span>
                                </button>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditProduct(prod)}
                                    className="p-1 hover:bg-slate-600 rounded transition-colors"
                                    title="Editar producto"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteProduct(prod.id)}
                                    className="p-1 hover:bg-red-500 rounded transition-colors"
                                    title="Eliminar producto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Contenedor de Actividades (Derecha - col-span-7) */}
                            <div className="lg:col-span-7 flex flex-col space-y-2.5">
                              {prodActs.length === 0 ? (
                                <div className="h-full min-h-[140px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">
                                  <span>Sin actividades registradas para este producto.</span>
                                  <span className="text-[11px] text-slate-400 mt-1">
                                    Use "+ Adicionar actividad" en la tarjeta izquierda para registrar la primera.
                                  </span>
                                </div>
                              ) : (
                                prodActs.map((act, actIdx) => {
                                  const actCost = Number(act.total_cost) || Number(act.quantity) * Number(act.unit_cost) || 0;

                                  return (
                                    <div
                                      key={act.id}
                                      className="bg-blue-50/70 border border-blue-200 rounded-xl overflow-hidden flex flex-col justify-between shadow-xs transition-all hover:border-blue-300"
                                    >
                                      {/* Campos de la Actividad */}
                                      <div className="p-3.5 space-y-1.5 text-xs text-slate-800">
                                        <h4 className="font-bold text-slate-900 text-xs">
                                          {act.code} Actividad {actIdx + 1}: {act.name}
                                        </h4>

                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-700 text-xs pt-1">
                                          <div>
                                            <span className="font-semibold text-slate-600">Costo : $ </span>
                                            <span className="font-bold text-slate-900">
                                              {formatMoney(actCost).replace('COP', '').trim()}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="font-semibold text-slate-600">Etapa : </span>
                                            <span className="font-medium text-slate-800">Inversión</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Barra de acción inferior (Azul 700) */}
                                      <div className="bg-blue-700 px-3.5 py-2 flex items-center justify-between text-white text-xs">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenProgramCostos(act)}
                                          className="inline-flex items-center gap-1.5 hover:text-blue-100 font-medium"
                                          title="Programar costos de la actividad"
                                        >
                                          <Calendar className="w-3.5 h-3.5" />
                                          <span>+ Programar costos</span>
                                        </button>

                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEditActivity(act, prod)}
                                            className="p-1 hover:bg-blue-600 rounded transition-colors"
                                            title="Editar actividad"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void handleDeleteActivity(act.id)}
                                            className="p-1 hover:bg-red-500 rounded transition-colors"
                                            title="Eliminar actividad"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pie de página de la Cadena de Valor */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500">
          Metodología General Ajustada (MGA) — Cadena de Valor y Presupuesto EDT.
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-slate-500 block uppercase tracking-wider font-semibold">
              Costo total de la alternativa:
            </span>
            <span className="text-lg font-bold text-[#006162]">
              {formatMoney(totalAlternativeCost)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveSection}
            disabled={isEdtSaving || isMgaSaving}
            className="px-6 py-2.5 bg-[#006162] text-white font-medium rounded-lg hover:bg-teal-800 flex items-center gap-2 transition-colors disabled:opacity-50 text-sm shadow-sm"
          >
            {isEdtSaving || isMgaSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            Guardar Cadena de Valor
          </button>
        </div>
      </div>

      {/* --- Modal de Producto --- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden text-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-800">
                {productModalMode === 'edit' ? 'Editar Producto' : 'Adicionar Producto'}
              </span>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productForm.code}
                  onChange={(e) => setProductForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="ej. 1.1"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nombre del Producto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="ej. Vía pavimentada construida"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Indicador principal
                </label>
                <input
                  type="text"
                  value={productForm.indicador}
                  onChange={(e) => setProductForm((f) => ({ ...f, indicador: e.target.value }))}
                  placeholder="ej. Kilómetros construidos"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Unidad de Medida
                  </label>
                  <input
                    type="text"
                    value={productForm.unidad_medida}
                    onChange={(e) => setProductForm((f) => ({ ...f, unidad_medida: e.target.value }))}
                    placeholder="ej. Metros / Unidad"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={productForm.cantidad}
                    onChange={(e) => setProductForm((f) => ({ ...f, cantidad: e.target.value }))}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Etapa</label>
                <select
                  value={productForm.etapa}
                  onChange={(e) => setProductForm((f) => ({ ...f, etapa: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                >
                  <option value="Inversión">Inversión</option>
                  <option value="Preinversión">Preinversión</option>
                  <option value="Operación">Operación</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isEdtSaving}
                onClick={() => void handleSaveProduct()}
                className="px-4 py-2 bg-[#006162] hover:bg-teal-800 text-white rounded-lg text-xs font-medium disabled:opacity-50"
              >
                {productModalMode === 'edit' ? 'Actualizar Producto' : 'Guardar Producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal de Actividad --- */}
      {isActivityModalOpen && targetProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden text-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-slate-800 block">
                  {activityModalMode === 'edit' ? 'Editar Actividad' : 'Adicionar Actividad'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Producto: {targetProduct.code} — {targetProduct.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsActivityModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Código de Actividad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={activityForm.code}
                  onChange={(e) => setActivityForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="ej. 1.1.1"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nombre de la Actividad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={activityForm.name}
                  onChange={(e) => setActivityForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="ej. Excavación y movimiento de tierras"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Cantidad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={activityForm.quantity}
                    onChange={(e) => setActivityForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Costo Unitario ($ COP) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={activityForm.unit_cost}
                    onChange={(e) => setActivityForm((f) => ({ ...f, unit_cost: e.target.value }))}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Total Calculado en tiempo real */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">Costo Total Calculado:</span>
                <span className="font-bold text-slate-900">
                  {formatMoney(
                    (Number(activityForm.quantity) || 0) * (Number(activityForm.unit_cost) || 0)
                  )}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsActivityModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isEdtSaving}
                onClick={() => void handleSaveActivity()}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-medium disabled:opacity-50"
              >
                {activityModalMode === 'edit' ? 'Actualizar Actividad' : 'Guardar Actividad'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal Informativo de Programar Costos --- */}
      {isProgramarModalOpen && selectedProgramarActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden text-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-700" />
                <span className="font-semibold text-sm text-slate-800">
                  Programación de Costos de Actividad
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsProgramarModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="font-bold text-slate-900 block text-xs">
                  {selectedProgramarActivity.code} — {selectedProgramarActivity.name}
                </span>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                  <span>Costo total presupuestado:</span>
                  <span className="font-bold text-slate-900">
                    {formatMoney(
                      Number(selectedProgramarActivity.total_cost) ||
                        Number(selectedProgramarActivity.quantity) * Number(selectedProgramarActivity.unit_cost)
                    )}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-slate-700 text-xs leading-relaxed">
                <p className="font-semibold text-slate-800 mb-1">Distribución temporal MGA:</p>
                Los costos de esta actividad quedan programados para la etapa de <strong>Inversión</strong> en el flujo de caja del proyecto. Puede ajustar la distribución plurianual por vigencias en la pestaña <strong>Programación</strong>.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsProgramarModalOpen(false)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-medium"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
