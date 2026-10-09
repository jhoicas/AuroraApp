import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HelpCircle, AlertTriangle, Plus, Trash2, DollarSign, Target, ChevronDown, ChevronRight, X, Package, Activity, FileCheck } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import {
  useProjectMgaStore,
  debouncedPatchProject,
  type CadenaValorAlternativa,
  type ProductoCvJson,
  type ActividadCvJson,
  type EntregableCvJson,
  type CostoCvJson,
  type CostoMatrizCvJson,
  type NecesidadJson,
} from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';
import MgaAlert from './MgaAlert';
import { CountedTextarea } from '../../ui/CountedTextarea';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import { useDnpDictionary } from '../../../lib/useDnpDictionary';
import SearchableCombobox, { type ComboboxOption } from '../../Catalog/SearchableCombobox';
import { useCatalogStore, type Product as CatalogProductRow, type CatalogEdt } from '../../../store/catalogStore';

// ─── Constants ───────────────────────────────────────────────────────────────

const ETAPAS = ['Preinversión', 'Inversión', 'Operación'] as const;

const INSUMOS_MGA = [
  'Mano de obra calificada',
  'Mano de obra no calificada',
  'Materiales',
  'Servicios domiciliarios',
  'Terrenos',
  'Edificios',
  'Maquinaria y Equipo',
  'Transporte',
  'Servicios tecnológicos',
  'Gastos de viaje',
  'Imprevistos',
  'Interventoría',
  'Otros',
] as const;

/** Nombres de insumo usados antes de alinear el catálogo con la MGA web. */
const INSUMO_LEGACY_ALIAS: Record<string, string> = {
  'Maquinaria y equipo': 'Maquinaria y Equipo',
  Edificaciones: 'Edificios',
};

const DEFAULT_PERIODOS = 12;
const MAX_PERIODOS_LIMIT = 40;
const MIN_ENTREGABLES = 2;
const MIN_ACTIVIDADES = 2;
const EDT_FETCH_LIMIT = 5000;

const ACUMULATIVO = 'Acumulativo';
const NO_ACUMULATIVO = 'No acumulativo';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function sumCostos(costos: CostoCvJson[]): number {
  return costos.reduce((acc, c) => acc + (c.valor || 0), 0);
}

function sumActividadCostos(actividades: ActividadCvJson[]): number {
  return actividades.reduce((acc, a) => acc + sumCostos(a.costos), 0);
}

function sumEntregableCostos(entregables: EntregableCvJson[]): number {
  return entregables.reduce((acc, e) => acc + sumCostos(e.costos), 0);
}

function sumProductoCostos(producto: ProductoCvJson): number {
  return sumActividadCostos(producto.actividades) + sumEntregableCostos(producto.entregables);
}

function sumObjetivoCostos(productos: ProductoCvJson[]): number {
  return productos.reduce((acc, p) => acc + sumProductoCostos(p), 0);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function emptyProducto(etapa: string): ProductoCvJson {
  return {
    id: uuid(), etapa, productoId: '', medidoATraves: '', complemento: '', descripcion: '',
    unidadMedidaId: '', cantidad: 0,
    localizacion: { rural: false, ruralDisperso: false, urbano: false },
    poblacion: { usarObjetivo: false, numero: 0, tipoAcumulacion: ACUMULATIVO, descripcion: '' },
    actividades: [], entregables: [],
  };
}

/** Periodos (0..N) de una alternativa: el horizonte se infiere de sus necesidades; si no hay, 12. */
function resolvePeriodCount(necesidades: NecesidadJson[] | undefined): number {
  const horizon = (necesidades ?? []).reduce((max, n) => {
    const end = Math.max(Number(n.anoFinal) || 0, Number(n.ultimoAnoProyectado) || 0);
    const span = end - (Number(n.anoInicial) || 0);
    return Number.isFinite(span) && span > max ? span : max;
  }, 0);
  return horizon > 0 ? Math.min(horizon + 1, MAX_PERIODOS_LIMIT) : DEFAULT_PERIODOS;
}

function costosToMatriz(costos: CostoCvJson[]): CostoMatrizCvJson {
  const matriz: CostoMatrizCvJson = {};
  for (const insumo of INSUMOS_MGA) matriz[insumo] = {};
  for (const c of costos) {
    const insumo = INSUMO_LEGACY_ALIAS[c.insumo] ?? c.insumo;
    matriz[insumo] = matriz[insumo] ?? {};
    matriz[insumo][c.periodo] = (matriz[insumo][c.periodo] ?? 0) + c.valor;
  }
  return matriz;
}

function matrizToCostos(matriz: CostoMatrizCvJson): CostoCvJson[] {
  const costos: CostoCvJson[] = [];
  for (const [insumo, porPeriodo] of Object.entries(matriz)) {
    for (const [periodo, valor] of Object.entries(porPeriodo)) {
      if (valor > 0) costos.push({ insumo, periodo: Number(periodo), valor });
    }
  }
  return costos.sort((a, b) => a.periodo - b.periodo || a.insumo.localeCompare(b.insumo));
}

/** Entregables (niveles 1-3) del catálogo EDT de un producto, sin repetir códigos. */
function buildEdtDeliverableOptions(rows: CatalogEdt[], productCode: string): { code: string; name: string }[] {
  const ofProduct = rows.filter((r) => r.codigo_producto_estandarizado === productCode);
  const source = ofProduct.length > 0 ? ofProduct : rows;
  const byCode = new Map<string, string>();
  for (const r of source) {
    const levels: [string, string][] = [
      [r.codigo_entregable_l1, r.nombre_entregable_l1],
      [r.codigo_entregable_l2, r.nombre_entregable_l2],
      [r.codigo_entregable_l3, r.nombre_entregable_l3],
    ];
    for (const [code, name] of levels) {
      if (code && name && !byCode.has(code)) byCode.set(code, name);
    }
  }
  return Array.from(byCode, ([code, name]) => ({ code, name }));
}

// ─── Cost Modal ──────────────────────────────────────────────────────────────

type CostModalProps = {
  title: string;
  /** 'actividad' | 'entregable' — solo para rotular el total. */
  kind: 'actividad' | 'entregable';
  costos: CostoCvJson[];
  periodCount: number;
  onSave: (costos: CostoCvJson[]) => void;
  onClose: () => void;
};

function CostModal({ title, kind, costos: initialCostos, periodCount, onSave, onClose }: CostModalProps) {
  const [matrix, setMatrix] = useState<CostoMatrizCvJson>(() => costosToMatriz(initialCostos));

  // Si ya hay costos en periodos posteriores al horizonte, no se ocultan.
  const columns = useMemo(() => {
    const maxUsed = initialCostos.reduce((m, c) => Math.max(m, c.periodo), -1);
    return Math.max(periodCount, maxUsed + 1);
  }, [initialCostos, periodCount]);

  const insumos = useMemo(() => {
    const extra = Object.keys(matrix).filter((i) => !(INSUMOS_MGA as readonly string[]).includes(i));
    return [...INSUMOS_MGA, ...extra];
  }, [matrix]);

  const handleCellChange = (insumo: string, periodo: number, raw: string) => {
    const val = Math.max(0, parseFloat(raw) || 0);
    setMatrix((prev) => ({ ...prev, [insumo]: { ...prev[insumo], [periodo]: val } }));
  };

  const rowTotal = (insumo: string) => Object.values(matrix[insumo] ?? {}).reduce((s, v) => s + v, 0);
  const colTotal = (periodo: number) => insumos.reduce((acc, ins) => acc + (matrix[ins]?.[periodo] || 0), 0);
  const totalGeneral = insumos.reduce((acc, ins) => acc + rowTotal(ins), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Programar costos</h3>
            <p className="text-xs text-slate-500 mt-0.5">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors" aria-label="Cerrar">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-auto flex-1 p-4">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#2980b9] text-white">
                  <th className="p-2 text-left border border-[#2471a3] sticky left-0 bg-[#2980b9] z-10 min-w-[180px]">Insumo</th>
                  {Array.from({ length: columns }, (_, i) => (
                    <th key={i} className="p-2 text-center border border-[#2471a3] min-w-[100px]">Periodo {i}</th>
                  ))}
                  <th className="p-2 text-center border border-[#2471a3] min-w-[120px] bg-[#1a5276]">Total fila</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map(insumo => (
                  <tr key={insumo} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-medium text-slate-700 border sticky left-0 bg-white z-10">{insumo}</td>
                    {Array.from({ length: columns }, (_, i) => (
                      <td key={i} className="p-1 border">
                        <input
                          type="number"
                          min="0"
                          aria-label={`${insumo} periodo ${i}`}
                          value={matrix[insumo]?.[i] || ''}
                          onChange={e => handleCellChange(insumo, i, e.target.value)}
                          className="w-full p-1.5 text-right border border-slate-200 rounded text-xs focus:ring-1 focus:ring-[#2980b9] outline-none"
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="p-2 text-right font-semibold text-slate-800 border bg-slate-50">{formatCurrency(rowTotal(insumo))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 font-bold text-emerald-800">
                  <td className="p-2 border sticky left-0 bg-emerald-50 z-10">Total por periodo</td>
                  {Array.from({ length: columns }, (_, i) => (
                    <td key={i} className="p-2 text-right border">{formatCurrency(colTotal(i))}</td>
                  ))}
                  <td className="p-2 text-right border text-lg">{formatCurrency(totalGeneral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50">
          <div className="text-sm font-semibold text-emerald-700">
            Costo total de la {kind}: {formatCurrency(totalGeneral)}
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button onClick={() => onSave(matrizToCostos(matrix))} className="px-5 py-2 text-sm bg-[#006162] text-white rounded-lg hover:bg-[#004d4e] transition-colors font-medium shadow-sm">
              Guardar costos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Entregable Modal (catálogo EDT) ─────────────────────────────────────────

type EntregableModalProps = {
  productCode: string;
  etapa: string;
  /** Códigos EDT ya agregados al producto. */
  usedCodes: string[];
  onSave: (entregable: { code: string; name: string }) => void;
  onClose: () => void;
};

function EntregableModal({ productCode, etapa, usedCodes, onSave, onClose }: EntregableModalProps) {
  const fetchCatalogEdt = useCatalogStore((s) => s.fetchCatalogEdt);
  const catalogEdt = useCatalogStore((s) => s.catalogEdt);
  const isLoading = useCatalogStore((s) => s.isLoadingEdt);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    void fetchCatalogEdt({ search: productCode || undefined, limit: EDT_FETCH_LIMIT });
  }, [fetchCatalogEdt, productCode]);

  const options = useMemo(
    () => buildEdtDeliverableOptions(catalogEdt, productCode).filter((o) => !usedCodes.includes(o.code)),
    [catalogEdt, productCode, usedCodes],
  );

  const handleSave = () => {
    const opt = options.find((o) => o.code === selected);
    if (opt) onSave(opt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-800">Adicionar entregable</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors" aria-label="Cerrar">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="entregable-etapa" className="block text-xs font-semibold text-slate-600 mb-1">Etapa</label>
            <input id="entregable-etapa" type="text" readOnly value={etapa} className="w-full p-2 text-xs border border-slate-200 rounded bg-slate-50 text-slate-600" />
          </div>
          <div>
            <label htmlFor="entregable-nombre" className="block text-xs font-semibold text-slate-600 mb-1">Nombre del entregable</label>
            <select
              id="entregable-nombre"
              value={selected}
              onChange={e => setSelected(e.target.value)}
              disabled={isLoading}
              className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#2980b9] outline-none"
            >
              <option value="">{isLoading ? 'Cargando catálogo EDT...' : 'Seleccione un entregable'}</option>
              {options.map(o => <option key={o.code} value={o.code}>{o.code} - {o.name}</option>)}
            </select>
            {!isLoading && options.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">No hay entregables disponibles en el catálogo EDT para este producto.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!selected}
            className="px-5 py-2 text-sm bg-[#006162] text-white rounded-lg hover:bg-[#004d4e] transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar entregable
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product fields (compartidos por el borrador y la tarjeta guardada) ──────

type ProductFieldsProps = {
  product: ProductoCvJson;
  poblacionObjetivoNum: number;
  catalogProducts: CatalogProductRow[];
  mainProductCode: string;
  mainProductIndicatorCode: string;
  isLoadingCatalog: boolean;
  onChange: (updated: ProductoCvJson) => void;
};

function ProductFields({ product, poblacionObjetivoNum, catalogProducts, mainProductCode, mainProductIndicatorCode, isLoadingCatalog, onChange }: ProductFieldsProps) {
  // Resolve the unique row.id for the currently stored product (handles homonyms).
  const selectedRow = useMemo(() => {
    if (!product.productoId) return undefined;
    if (product.codigoIndicadorProducto !== undefined) {
      const exact = catalogProducts.find(
        (r) =>
          r.codigo_del_producto === product.productoId &&
          r.codigo_del_indicador_de_producto === product.codigoIndicadorProducto,
      );
      if (exact) return exact;
    }
    return catalogProducts.find((r) => r.codigo_del_producto === product.productoId);
  }, [catalogProducts, product.productoId, product.codigoIndicadorProducto]);
  const selectedRowId = selectedRow?.id ?? '';

  const productOptions = useMemo<ComboboxOption[]>(() => {
    const opts = catalogProducts.map((row) => {
      const baseLabel = `${row.producto} - [Cód. Ind: ${row.codigo_del_indicador_de_producto}]`;
      const isMainProduct =
        mainProductCode &&
        row.codigo_del_producto === mainProductCode &&
        (mainProductIndicatorCode
          ? row.codigo_del_indicador_de_producto === mainProductIndicatorCode
          : true);
      const label = isMainProduct ? `(${baseLabel})` : baseLabel;
      return {
        value: row.id,
        label,
        code: row.codigo_del_producto,
        hint: row.indicador_de_producto,
        indicatorCode: row.codigo_del_indicador_de_producto,
        indicatorLabel: row.indicador_de_producto,
      };
    });
    // Conserva valores heredados que no existen en el catálogo.
    if (product.productoId && !selectedRowId) {
      opts.unshift({ value: product.productoId, label: product.productoId, code: product.productoId, hint: '', indicatorCode: '', indicatorLabel: '' });
    }
    return opts;
  }, [catalogProducts, mainProductCode, mainProductIndicatorCode, product.productoId, selectedRowId]);

  const handleSelectProduct = (rowId: string) => {
    const row = catalogProducts.find((r) => r.id === rowId);
    onChange({
      ...product,
      productoId: row?.codigo_del_producto ?? rowId,
      codigoIndicadorProducto: row?.codigo_del_indicador_de_producto ?? '',
      indicadorProducto: row?.indicador_de_producto ?? '',
      medidoATraves: row?.medido_a_traves_de ?? '',
      unidadMedidaId: row?.unidad_de_medida || product.unidadMedidaId,
      ...(row ? { descripcion: (row.descripcion || row.producto || '').slice(0, 500) } : {}),
    });
  };

  const updateField = <K extends keyof ProductoCvJson>(field: K, value: ProductoCvJson[K]) => {
    if (field === 'etapa') {
      // Entregables y actividades heredan la etapa del producto.
      const etapa = value as string;
      onChange({
        ...product,
        etapa,
        entregables: product.entregables.map((e) => ({ ...e, etapa })),
        actividades: product.actividades.map((a) => ({ ...a, etapa })),
      });
      return;
    }
    onChange({ ...product, [field]: value });
  };

  const handleUsarPoblacionObjetivo = () => {
    onChange({
      ...product,
      poblacion: { ...product.poblacion, usarObjetivo: true, numero: poblacionObjetivoNum },
    });
  };

  const tipoAcumulacion = product.poblacion.tipoAcumulacion === NO_ACUMULATIVO ? NO_ACUMULATIVO : ACUMULATIVO;
  const medidoATraves = product.medidoATraves || selectedRow?.medido_a_traves_de || '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`producto-etapa-${product.id}`} className="block text-xs font-semibold text-slate-600 mb-1">Etapa</label>
          <select id={`producto-etapa-${product.id}`} value={product.etapa} onChange={e => updateField('etapa', e.target.value)} className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#2980b9] outline-none">
            {ETAPAS.map(et => <option key={et} value={et}>{et}</option>)}
          </select>
        </div>
        <div>
          <SearchableCombobox
            id={`producto-nombre-${product.id}`}
            label="Nombre del Producto"
            placeholder="Seleccione un producto del catálogo"
            loading={isLoadingCatalog}
            loadingMessage="Cargando catálogo de productos..."
            emptyMessage="No hay productos en el catálogo para el sector/programa del proyecto."
            noResultsMessage="Sin resultados"
            options={productOptions}
            value={selectedRowId || product.productoId}
            onChange={handleSelectProduct}
          />
        </div>
      </div>

      <AIAssistedField label="Complemento del producto" htmlFor={`producto-complemento-${product.id}`} fieldHelpKey={`producto_complemento_${product.id}`} reactiveContext={{ producto: product.productoId, etapa: product.etapa }} onAutoFill={(value) => updateField('complemento', value)} guidance="Precise las características que complementan el producto del proyecto." askPrompt="Ayúdame a redactar el complemento de un producto MGA.">
        <input id={`producto-complemento-${product.id}`} type="text" value={product.complemento} onChange={e => updateField('complemento', e.target.value)} placeholder="Complemento del producto" className="w-full rounded border border-slate-300 p-2 text-xs outline-none focus:ring-1 focus:ring-[#2980b9]" />
      </AIAssistedField>

      <AIAssistedField label="Descripción del producto" htmlFor={`producto-descripcion-${product.id}`} fieldHelpKey={`producto_descripcion_${product.id}`} reactiveContext={{ producto: product.productoId, complemento: product.complemento, etapa: product.etapa }} onAutoFill={(value) => updateField('descripcion', value)} guidance="Describa el producto, sus características y el resultado que entrega el proyecto." askPrompt="Ayúdame a redactar la descripción de un producto MGA.">
        <CountedTextarea id={`producto-descripcion-${product.id}`} value={product.descripcion} onChange={e => updateField('descripcion', e.target.value)} rows={2} maxLength={500} placeholder="Describa el producto..." className="w-full resize-y rounded border border-slate-300 p-2 text-xs outline-none focus:ring-1 focus:ring-[#2980b9]" />
      </AIAssistedField>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor={`producto-medido-${product.id}`} className="block text-xs font-semibold text-slate-600 mb-1">Medido a través de</label>
          <input id={`producto-medido-${product.id}`} type="text" readOnly value={medidoATraves} placeholder="Se completa al seleccionar el producto" className="w-full p-2 text-xs border border-slate-200 rounded bg-slate-50 text-slate-600" />
        </div>
        <div>
          <label htmlFor={`producto-cantidad-${product.id}`} className="block text-xs font-semibold text-slate-600 mb-1">Cantidad</label>
          <input id={`producto-cantidad-${product.id}`} type="number" min={0} value={product.cantidad || ''} onChange={e => updateField('cantidad', parseFloat(e.target.value) || 0)} className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#2980b9] outline-none" />
        </div>
        <fieldset>
          <legend className="block text-xs font-semibold text-slate-600 mb-1">Localización</legend>
          <div className="flex flex-wrap gap-3 mt-1">
            {(['rural', 'ruralDisperso', 'urbano'] as const).map(loc => (
              <label key={loc} className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={product.localizacion[loc]} onChange={e => updateField('localizacion', { ...product.localizacion, [loc]: e.target.checked })} className="rounded border-slate-300 text-[#006162] focus:ring-[#006162]" />
                {loc === 'ruralDisperso' ? 'Rural Disperso' : loc.charAt(0).toUpperCase() + loc.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-blue-800">Cuantificación de Población</span>
          <button
            type="button"
            onClick={handleUsarPoblacionObjetivo}
            className="text-xs px-3 py-1 bg-white border border-blue-200 text-blue-700 rounded hover:bg-blue-50 transition-colors font-medium shadow-sm"
          >
            <Target className="w-3 h-3 inline mr-1" />
            Utilizar la cantidad de población objetivo
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`producto-poblacion-num-${product.id}`} className="text-xs text-blue-700">Número de personas</label>
            <input id={`producto-poblacion-num-${product.id}`} type="number" min={0} value={product.poblacion.numero || ''} onChange={e => updateField('poblacion', { ...product.poblacion, numero: parseInt(e.target.value) || 0 })} className="w-full p-1.5 text-xs border border-blue-200 rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none" />
          </div>
          <fieldset>
            <legend className="text-xs text-blue-700">Tipo de población</legend>
            <div className="flex gap-4 mt-1.5">
              {[ACUMULATIVO, NO_ACUMULATIVO].map(tipo => (
                <label key={tipo} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name={`producto-acumulacion-${product.id}`}
                    checked={tipoAcumulacion === tipo}
                    onChange={() => updateField('poblacion', { ...product.poblacion, tipoAcumulacion: tipo })}
                    className="border-blue-300 text-[#006162] focus:ring-[#006162]"
                  />
                  {tipo}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <AIAssistedField label="Descripción de la población beneficiaria del producto" htmlFor={`producto-poblacion-${product.id}`} compact fieldHelpKey={`producto_poblacion_${product.id}`} reactiveContext={{ producto: product.productoId, cantidad: product.cantidad }} onAutoFill={(value) => updateField('poblacion', { ...product.poblacion, descripcion: value })} guidance="Describa la población vinculada a la entrega del producto." askPrompt="Ayúdame a describir la población asociada a un producto MGA.">
          <CountedTextarea id={`producto-poblacion-${product.id}`} value={product.poblacion.descripcion} onChange={e => updateField('poblacion', { ...product.poblacion, descripcion: e.target.value })} rows={2} maxLength={500} className="w-full resize-y rounded border border-blue-200 bg-white p-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400" placeholder="Descripción de la población beneficiaria..." />
        </AIAssistedField>
      </div>
    </div>
  );
}

// ─── Product draft (formulario de adición) ───────────────────────────────────

type ProductDraftFormProps = Omit<ProductFieldsProps, 'onChange'> & {
  onChange: (updated: ProductoCvJson) => void;
  onSave: () => void;
  onCancel: () => void;
};

function ProductDraftForm({ onSave, onCancel, ...fieldsProps }: ProductDraftFormProps) {
  const [showError, setShowError] = useState(false);
  const missingProduct = !fieldsProps.product.productoId;

  return (
    <div className="border-2 border-dashed border-[#2980b9] rounded-lg bg-blue-50/30">
      <div className="flex items-center gap-2 p-3 border-b border-blue-100">
        <Package className="w-4 h-4 text-[#2980b9]" />
        <span className="text-sm font-medium text-slate-800">Nuevo producto</span>
      </div>
      <div className="p-4 space-y-4">
        <ProductFields {...fieldsProps} />
        {showError && missingProduct && (
          <p role="alert" className="text-xs text-red-600">Seleccione el nombre del producto para guardarlo.</p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => (missingProduct ? setShowError(true) : onSave())}
            className="px-5 py-2 text-sm bg-[#006162] text-white rounded-lg hover:bg-[#004d4e] transition-colors font-medium shadow-sm"
          >
            Guardar producto
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product card (producto guardado) ────────────────────────────────────────

type ProductCardProps = Omit<ProductFieldsProps, 'onChange'> & {
  periodCount: number;
  onChange: (updated: ProductoCvJson) => void;
  onRemove: () => void;
};

function ProductCard({ periodCount, onChange, onRemove, ...fieldsProps }: ProductCardProps) {
  const { product, catalogProducts } = fieldsProps;
  const { strong_verbs: strongVerbs, weak_verbs: weakVerbs } = useDnpDictionary();

  const [expanded, setExpanded] = useState(true);
  const [entregableModalOpen, setEntregableModalOpen] = useState(false);
  const [costModalTarget, setCostModalTarget] = useState<{ type: 'actividad' | 'entregable'; idx: number } | null>(null);

  const selectedProductLabel =
    catalogProducts.find(
      (r) =>
        r.codigo_del_producto === product.productoId &&
        (!product.codigoIndicadorProducto ||
          r.codigo_del_indicador_de_producto === product.codigoIndicadorProducto),
    )?.producto || product.productoId;

  // ── Actividades (nombre manual, hereda etapa) ──
  const addActividad = () => {
    const newAct: ActividadCvJson = { id: uuid(), etapa: product.etapa, nombre: '', costos: [] };
    onChange({ ...product, actividades: [...product.actividades, newAct] });
  };

  const updateActividad = (idx: number, patch: Partial<ActividadCvJson>) => {
    onChange({ ...product, actividades: product.actividades.map((a, i) => (i === idx ? { ...a, ...patch } : a)) });
  };

  const removeActividad = (idx: number) => {
    if (!window.confirm('¿Eliminar esta actividad y sus costos?')) return;
    onChange({ ...product, actividades: product.actividades.filter((_, i) => i !== idx) });
  };

  // ── Entregables (catálogo EDT, hereda etapa) ──
  const addEntregable = ({ code, name }: { code: string; name: string }) => {
    const newEnt: EntregableCvJson = { id: uuid(), etapa: product.etapa, nombre: name, codigoEdt: code, costos: [] };
    onChange({ ...product, entregables: [...product.entregables, newEnt] });
    setEntregableModalOpen(false);
  };

  const updateEntregable = (idx: number, patch: Partial<EntregableCvJson>) => {
    onChange({ ...product, entregables: product.entregables.map((e, i) => (i === idx ? { ...e, ...patch } : e)) });
  };

  const removeEntregable = (idx: number) => {
    if (!window.confirm('¿Eliminar este entregable y sus costos?')) return;
    onChange({ ...product, entregables: product.entregables.filter((_, i) => i !== idx) });
  };

  const handleCostSave = (costos: CostoCvJson[]) => {
    if (!costModalTarget) return;
    if (costModalTarget.type === 'actividad') updateActividad(costModalTarget.idx, { costos });
    else updateEntregable(costModalTarget.idx, { costos });
    setCostModalTarget(null);
  };

  const totalProducto = sumProductoCostos(product);
  const faltanEntregables = product.entregables.length < MIN_ENTREGABLES;
  const faltanActividades = product.actividades.length < MIN_ACTIVIDADES;

  return (
    <div className="border border-slate-200 rounded-lg bg-white shadow-sm">
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-white border-b cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <Package className="w-4 h-4 text-[#2980b9]" />
          <span className="text-sm font-medium text-slate-800">{product.complemento || selectedProductLabel || 'Producto sin nombre'}</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{product.etapa}</span>
        </div>
        <div className="flex items-center flex-wrap gap-3">
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded" title="Costo total del producto">{formatCurrency(totalProducto)}</span>
          <button onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar producto" aria-label="Eliminar producto">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          <ProductFields {...fieldsProps} onChange={onChange} />

          <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-slate-200">
            <button onClick={() => setEntregableModalOpen(true)} className="text-xs px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded hover:bg-purple-100 transition-colors flex items-center gap-1 font-medium">
              <Plus className="w-3 h-3" /> Adicionar entregable
            </button>
            <button onClick={addActividad} className="text-xs px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded hover:bg-orange-100 transition-colors flex items-center gap-1 font-medium">
              <Plus className="w-3 h-3" /> Adicionar actividad
            </button>
          </div>

          {/* ── Entregables ── */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5 text-purple-500" /> Entregables ({product.entregables.length})
            </h4>
            {faltanEntregables && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Mínimo {MIN_ENTREGABLES} entregables requeridos ({product.entregables.length}/{MIN_ENTREGABLES}).
              </p>
            )}
            {product.entregables.map((ent, ei) => (
              <div key={ent.id} className="flex items-start gap-2 bg-purple-50/50 p-2 rounded border border-purple-100">
                <div className="flex-1 space-y-1">
                  <div className="flex gap-2">
                    <span className="flex-1 p-1.5 text-xs text-slate-800">{ent.codigoEdt ? `${ent.codigoEdt} - ` : ''}{ent.nombre}</span>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded self-start whitespace-nowrap">{ent.etapa}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Costo: <span className="font-semibold text-slate-700">{formatCurrency(sumCostos(ent.costos))}</span></span>
                    <button onClick={() => setCostModalTarget({ type: 'entregable', idx: ei })} className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 transition-colors flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Programar costos
                    </button>
                  </div>
                </div>
                <button onClick={() => removeEntregable(ei)} className="p-1 text-red-400 hover:text-red-600 rounded" title="Eliminar entregable" aria-label="Eliminar entregable">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* ── Actividades ── */}
          <div className="space-y-2 pt-2 border-t border-dashed border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-orange-500" /> Actividades ({product.actividades.length})
            </h4>
            {faltanActividades && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Mínimo {MIN_ACTIVIDADES} actividades requeridas ({product.actividades.length}/{MIN_ACTIVIDADES}).
              </p>
            )}
            {product.actividades.map((act, ai) => (
              <div key={act.id} className="flex items-start gap-2 bg-orange-50/50 p-2 rounded border border-orange-100">
                <div className="flex-1 space-y-1">
                  <div className="flex gap-2">
                    <AIAssistedField
                      label="Descripción de la actividad"
                      htmlFor={`actividad-${act.id}`}
                      compact
                      className="min-w-0 flex-1"
                      fieldHelpKey={`actividad_descripcion_${act.id}`}
                      reactiveContext={{ producto: product.productoId, etapa: act.etapa }}
                      onAutoFill={(value) => updateActividad(ai, { nombre: value })}
                      guidance="Las actividades describen acciones operativas concretas para producir los entregables del proyecto."
                      aiContext={`Actúa como experto en MGA y en la guía DNP de definición de actividades. Redacta el nombre de esta actividad con la fórmula obligatoria: Verbo rector fuerte en infinitivo + Sustantivo directo + Complemento del sustantivo (ej.: "Realizar diagnóstico de condiciones de infraestructura educativa en zonas rurales"). REGLA ESTRICTA e INQUEBRANTABLE: la primera palabra DEBE ser uno de estos verbos fuertes: ${strongVerbs.join(', ')}. PROHIBIDO usar los verbos débiles: ${weakVerbs.join(', ')}. No redactes actividades de adquisición de insumos. Genera solo el texto de la actividad, sin introducciones.`}
                    >
                      <CountedTextarea
                        id={`actividad-${act.id}`}
                        value={act.nombre}
                        onChange={e => updateActividad(ai, { nombre: e.target.value })}
                        rows={1}
                        maxLength={250}
                        placeholder="Nombre de la actividad"
                        className="w-full resize-y rounded border border-orange-200 p-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    </AIAssistedField>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded self-start whitespace-nowrap">{act.etapa}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Costo: <span className="font-semibold text-slate-700">{formatCurrency(sumCostos(act.costos))}</span></span>
                    <button onClick={() => setCostModalTarget({ type: 'actividad', idx: ai })} className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 transition-colors flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Programar costos
                    </button>
                  </div>
                </div>
                <button onClick={() => removeActividad(ai)} className="p-1 text-red-400 hover:text-red-600 rounded" title="Eliminar actividad" aria-label="Eliminar actividad">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {entregableModalOpen && (
        <EntregableModal
          productCode={product.productoId}
          etapa={product.etapa}
          usedCodes={product.entregables.map((e) => e.codigoEdt).filter((c): c is string => !!c)}
          onSave={addEntregable}
          onClose={() => setEntregableModalOpen(false)}
        />
      )}

      {costModalTarget && (
        <CostModal
          kind={costModalTarget.type}
          title={costModalTarget.type === 'actividad'
            ? product.actividades[costModalTarget.idx]?.nombre || `Actividad ${costModalTarget.idx + 1}`
            : product.entregables[costModalTarget.idx]?.nombre || `Entregable ${costModalTarget.idx + 1}`}
          costos={costModalTarget.type === 'actividad'
            ? product.actividades[costModalTarget.idx]?.costos || []
            : product.entregables[costModalTarget.idx]?.costos || []}
          periodCount={periodCount}
          onSave={handleCostSave}
          onClose={() => setCostModalTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type CadenaValorTabProps = {
  project: Project;
};

export default function CadenaValorTab({ project }: CadenaValorTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const formulation = getFormulation(project.id);
  const alternativasAll = formulation.identificacion?.alternativas || [];
  const alternatives = alternativasAll.filter((alt: any) => alt.pasaPreparacion === true);
  const objetivosEspecificos: Record<string, string> = formulation.identificacion?.objetivos?.objetivosEspecificos || {};
  const poblacionObjetivoNum = formulation.identificacion?.poblacion?.objetivo?.numero || 0;

  const fetchCatalogProducts = useCatalogStore((st) => st.fetchCatalogProducts);
  const allCatalogProducts = useCatalogStore((st) => st.catalogProducts);
  const isLoadingCatalog = useCatalogStore((st) => st.isLoadingProducts);
  const mainProductCode = (project.product_code ?? '').trim();
  const mainProductIndicatorCode = (project.product_indicator_code ?? '').trim();
  const projectProgramCode = (project.program_code ?? '').trim();
  const sectorKey = (project.sector ?? '').trim().toLowerCase();

  useEffect(() => {
    void fetchCatalogProducts({ search: projectProgramCode || mainProductCode || undefined });
  }, [fetchCatalogProducts, projectProgramCode, mainProductCode]);

  // Programa del producto principal (según catálogo DNP); fallback al programa del proyecto.
  const programCode = useMemo(() => {
    const main = mainProductCode
      ? allCatalogProducts.find((row) => row.codigo_del_producto === mainProductCode)
      : undefined;
    return (main?.codigo_del_programa ?? '').trim() || projectProgramCode;
  }, [allCatalogProducts, mainProductCode, projectProgramCode]);

  // Catálogo oficial filtrado por Programa y Sector del proyecto.
  const catalogProducts = useMemo(
    () =>
      allCatalogProducts.filter((row) => {
        if (programCode && row.codigo_del_programa !== programCode) return false;
        if (!programCode && sectorKey) {
          return (
            String(row.sector ?? '').trim().toLowerCase() === sectorKey ||
            row.nombre_del_sector.trim().toLowerCase() === sectorKey
          );
        }
        return true;
      }),
    [allCatalogProducts, programCode, sectorKey],
  );

  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>(alternatives.length > 0 ? alternatives[0].id : '');
  const [cadenaData, setCadenaData] = useState<CadenaValorAlternativa>({ objetivos: {} });
  /** Producto en edición (aún no guardado) por objetivo específico. */
  const [drafts, setDrafts] = useState<Record<string, ProductoCvJson>>({});
  const [error, setError] = useState<string | null>(null);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>('{}');

  const periodCount = resolvePeriodCount(
    (formulation.preparacion?.necesidades as Record<string, NecesidadJson[]> | undefined)?.[selectedAlternativeId],
  );

  // ── Load data for selected alternative ──
  const loadAlternativeData = useCallback((altId: string) => {
    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const prep = f.preparacion?.cadenaValorPrep || {};
    const altData = prep[altId] || { objetivos: {} };
    setCadenaData(altData);
    lastSavedRef.current = JSON.stringify(altData);
  }, [project.id]);

  const storeCadenaValorPrep = useProjectMgaStore((s) => s.getFormulation(project.id)?.preparacion?.cadenaValorPrep);

  useEffect(() => {
    if (storeCadenaValorPrep && selectedAlternativeId) {
      const altData = storeCadenaValorPrep[selectedAlternativeId] || { objetivos: {} };
      const serialized = JSON.stringify(altData);
      if (serialized !== lastSavedRef.current) {
        setCadenaData(altData);
        lastSavedRef.current = serialized;
      }
    }
  }, [storeCadenaValorPrep, selectedAlternativeId]);

  // Project change sync
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      isFirstMount.current = true;
      setDrafts({});
    }

    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const altsAll = f.identificacion?.alternativas || [];
    const alts = altsAll.filter((a: any) => a.pasaPreparacion === true);

    if (alts.length > 0) {
      const altId = selectedAlternativeId && alts.some((a: any) => a.id === selectedAlternativeId)
        ? selectedAlternativeId : alts[0].id;
      setSelectedAlternativeId(altId);
      loadAlternativeData(altId);
    } else {
      setSelectedAlternativeId('');
      setCadenaData({ objetivos: {} });
      lastSavedRef.current = '{}';
    }
  }, [project.id, loadAlternativeData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save ──
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (!selectedAlternativeId) return;

    const serialized = JSON.stringify(cadenaData);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    // Merge into preparacion
    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const currentPrep = f.preparacion || { necesidades: {} };
    const currentCV = currentPrep.cadenaValorPrep || {};
    const updatedCV = { ...currentCV, [selectedAlternativeId]: cadenaData };
    const newPrep = { ...currentPrep, cadenaValorPrep: updatedCV };

    // Optimistic update
    useProjectMgaStore.setState((state) => {
      const fm = state.byProjectId[project.id] || { causeRelations: [], generalIndicators: [], effects: [], participants: [], populations: [], alternatives: [], completedSections: {} };
      return {
        byProjectId: {
          ...state.byProjectId,
          [project.id]: { ...fm, preparacion: newPrep, completedSections: fm.completedSections },
        },
        isSaving: true,
      };
    });

    debouncedPatchProject(project.id, { preparacion: newPrep, completedSections: f.completedSections });
  }, [cadenaData, selectedAlternativeId, project.id]);

  // ── Alternative change handler ──
  const handleAlternativeChange = (newAltId: string) => {
    setSelectedAlternativeId(newAltId);
    setDrafts({});
    isFirstMount.current = true;
    loadAlternativeData(newAltId);
  };

  // ── Product CRUD ──
  const startDraft = (objetivoId: string) => {
    setDrafts(prev => (prev[objetivoId] ? prev : { ...prev, [objetivoId]: emptyProducto('Inversión') }));
  };

  const updateDraft = (objetivoId: string, updated: ProductoCvJson) => {
    setDrafts(prev => ({ ...prev, [objetivoId]: updated }));
  };

  const cancelDraft = (objetivoId: string) => {
    setDrafts(prev => {
      const { [objetivoId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const saveDraft = (objetivoId: string) => {
    const draft = drafts[objetivoId];
    if (!draft) return;
    setCadenaData(prev => {
      const obj = prev.objetivos[objetivoId] || { productos: [] };
      return {
        ...prev,
        objetivos: { ...prev.objetivos, [objetivoId]: { productos: [...obj.productos, draft] } },
      };
    });
    cancelDraft(objetivoId);
  };

  const updateProducto = (objetivoId: string, productoIdx: number, updated: ProductoCvJson) => {
    setCadenaData(prev => {
      const obj = prev.objetivos[objetivoId];
      if (!obj) return prev;
      const newProducts = obj.productos.map((p, i) => i === productoIdx ? updated : p);
      return {
        ...prev,
        objetivos: { ...prev.objetivos, [objetivoId]: { productos: newProducts } },
      };
    });
  };

  const removeProducto = (objetivoId: string, productoIdx: number) => {
    if (!window.confirm('¿Eliminar este producto y todos sus costos asociados?')) return;
    setCadenaData(prev => {
      const obj = prev.objetivos[objetivoId];
      if (!obj) return prev;
      return {
        ...prev,
        objetivos: { ...prev.objetivos, [objetivoId]: { productos: obj.productos.filter((_, i) => i !== productoIdx) } },
      };
    });
  };

  // ── Computed totals (cascada: actividad/entregable → producto → objetivo → alternativa) ──
  const costoTotalAlternativa = Object.values(cadenaData.objetivos).reduce((acc, obj) => acc + sumObjetivoCostos(obj.productos), 0);

  // ── No alternatives guard ──
  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Cadena de Valor</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="text-yellow-700">
            <p className="font-bold">No hay alternativas que pasen a preparación.</p>
            <p>Por favor, diríjase a la pestaña de "Identificación", módulo "Alternativas", y asegúrese de que al menos una alternativa tenga habilitada la opción "Pasa a preparación".</p>
          </div>
        </div>
      </div>
    );
  }

  // ── No objetivos guard ──
  const objEntries = Object.entries(objetivosEspecificos);
  if (objEntries.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Cadena de Valor</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="text-yellow-700">
            <p className="font-bold">No hay objetivos específicos definidos.</p>
            <p>Por favor, diríjase a la pestaña de "Identificación", módulo "Objetivos", y defina al menos un objetivo específico para construir la cadena de valor.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-normal text-[#2980b9]">Cadena de Valor</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            Costo total alternativa: {formatCurrency(costoTotalAlternativa)}
          </div>
          {isSaving && (
            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
              <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" /> Guardando...
            </div>
          )}
        </div>
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      {/* Alternative selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full max-w-full overflow-hidden bg-slate-50 p-3 rounded border">
        <label className="font-semibold text-slate-700 whitespace-nowrap">Alternativa:</label>
        <select
          value={selectedAlternativeId}
          onChange={(e) => handleAlternativeChange(e.target.value)}
          className="w-full min-w-0 flex-1 truncate max-w-full box-border p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
        >
          {alternatives.map((alt: any) => (
            <option key={alt.id} value={alt.id} title={alt.nombre}>{alt.nombre}</option>
          ))}
        </select>
      </div>

      {/* Objetivos específicos (solo lectura, siempre expandidos) */}
      {objEntries.map(([objId, objText]) => {
        const objData = cadenaData.objetivos[objId] || { productos: [] };
        const objTotal = sumObjetivoCostos(objData.productos);
        const draft = drafts[objId];
        const fieldsCommon = {
          poblacionObjetivoNum,
          catalogProducts,
          mainProductCode,
          mainProductIndicatorCode,
          isLoadingCatalog,
        };

        return (
          <MgaAccordion
            key={objId}
            title={objText || `Objetivo ${objId}`}
            number={`OE`}
            open={true}
            onToggle={() => {}}
          >
            <div className="space-y-4 p-1">
              {/* Cabecera del objetivo: total + Adicionar producto */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 p-2 rounded border border-emerald-100">
                <span className="text-xs font-semibold text-emerald-800">
                  <Target className="w-3.5 h-3.5 inline mr-1" />
                  Costo total del objetivo
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-emerald-700">{formatCurrency(objTotal)}</span>
                  <button
                    onClick={() => startDraft(objId)}
                    disabled={!!draft}
                    className="px-3 py-1.5 bg-[#006162] text-white rounded-lg hover:bg-[#004d4e] transition-colors flex items-center gap-1 text-xs font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar producto
                  </button>
                </div>
              </div>

              {objData.productos.map((prod, pi) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  periodCount={periodCount}
                  {...fieldsCommon}
                  onChange={(updated) => updateProducto(objId, pi, updated)}
                  onRemove={() => removeProducto(objId, pi)}
                />
              ))}

              {draft && (
                <ProductDraftForm
                  product={draft}
                  {...fieldsCommon}
                  onChange={(updated) => updateDraft(objId, updated)}
                  onSave={() => saveDraft(objId)}
                  onCancel={() => cancelDraft(objId)}
                />
              )}
            </div>
          </MgaAccordion>
        );
      })}
    </div>
  );
}
