import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';
import type { CatalogImportResult, CatalogImportRowError } from '../store/catalogStore';

type CatalogSummary = {
  status?: string;
  message?: string;
  sheets?: number;
  rows?: number;
  sectores_inserted?: number;
  programas_inserted?: number;
  productos_inserted?: number;
  edt_inserted?: number;
  ods_inserted?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  total_rows_parsed?: number;
  errors?: CatalogImportRowError[];
  details?: CatalogImportRowError[] | string;
};

type CatalogImporterProps = {
  /** `full` = DNP multi-hoja; matriciales: products | edt | deliverables | activities | ods. */
  variant?: 'full' | 'products' | 'edt' | 'deliverables' | 'activities' | 'ods';
  onImported?: (result: CatalogImportResult | CatalogSummary) => void;
  className?: string;
};

const EDT_TEMPLATE_HEADERS = [
  'Código producto estandarizado',
  'Nombre Producto',
  'Codigo entregable nivel 1',
  'Nombre entregable nivel 1',
  'Codigo entregable nivel 2',
  'Nombre entregable nivel 2',
  'Codigo entregable nivel 3',
  'Nombre entregable nivel 3',
  'Codigo actividad',
  'Actividad',
  'Unidad de medida',
] as const;

const EDT_TEMPLATE_EXAMPLE = [
  '0101001',
  'Documentos normativos',
  '0101001-01',
  'Entregable nivel 1',
  '0101001-01-01',
  'Entregable nivel 2',
  '0101001-01-01-01',
  'Entregable nivel 3',
  'ACT-001',
  'Elaborar documento',
  'Número',
] as const;

/** Genera y descarga la plantilla CSV EDT con BOM UTF-8. */
export function downloadEdtTemplate(): void {
  const csv = `\uFEFF${EDT_TEMPLATE_HEADERS.join(',')}\n${EDT_TEMPLATE_EXAMPLE.join(',')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_edt.csv';
  link.click();
  URL.revokeObjectURL(url);
}

const DELIVERABLE_TEMPLATE_HEADERS = ['Listado de Entregables', 'Código entregable'] as const;
const DELIVERABLE_TEMPLATE_EXAMPLE = ['Infraestructura en obra blanca', '000000004'] as const;

/** Genera y descarga la plantilla CSV de entregables con BOM UTF-8. */
export function downloadDeliverableTemplate(): void {
  const csv = `\uFEFF${DELIVERABLE_TEMPLATE_HEADERS.join(',')}\n${DELIVERABLE_TEMPLATE_EXAMPLE.join(',')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_entregables.csv';
  link.click();
  URL.revokeObjectURL(url);
}

const ACTIVITY_TEMPLATE_HEADERS = [
  'Listado de actividades',
  'Unidad de medida',
  'Código actividad',
] as const;
const ACTIVITY_TEMPLATE_EXAMPLE = [
  'Realizar suministro e instalación de cielo raso',
  'Metros cuadrados',
  '000000003',
] as const;

/** Genera y descarga la plantilla CSV de actividades con BOM UTF-8. */
export function downloadActivityTemplate(): void {
  const csv = `\uFEFF${ACTIVITY_TEMPLATE_HEADERS.join(',')}\n${ACTIVITY_TEMPLATE_EXAMPLE.join(',')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_actividades.csv';
  link.click();
  URL.revokeObjectURL(url);
}

const ODS_TEMPLATE_HEADERS = [
  'Cod. Objetivo ODS',
  'Descripción Objetivo ODS',
  'Código Meta ODS',
  'Descripción Meta ODS',
] as const;
const ODS_TEMPLATE_EXAMPLE = [
  '1',
  'Fin de la pobreza',
  '1.1',
  'Erradicar la pobreza extrema',
] as const;

/** Genera y descarga la plantilla CSV ODS con BOM UTF-8. */
export function downloadOdsTemplate(): void {
  const csv = `\uFEFF${ODS_TEMPLATE_HEADERS.join(',')}\n${ODS_TEMPLATE_EXAMPLE.join(',')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_ods.csv';
  link.click();
  URL.revokeObjectURL(url);
}

const PRODUCT_TEMPLATE_HEADERS = [
  'Sector',
  'Nombre del Sector',
  'Código del Programa',
  'Nombre del Programa',
  'Código del Producto',
  'Producto',
  'Descripción',
  'Medido a través de',
  'Código del Indicador de Producto',
  'Indicador de Producto',
  'Unidad de medida',
  'Indicador Principal',
  'Es Nacional',
  'Es Territorial',
  'Objetivos de Desarrollo Sostenible - ODS',
  'Meta ODS',
  'Tipología General SUIFP',
  'Tipología D',
  'Tipología E',
  'Tipología A',
  'Tipología B',
  'Tipología C',
  'Tiene EDT',
  'EDT',
] as const;

const PRODUCT_TEMPLATE_EXAMPLE = [
  '01',
  'CONGRESO',
  '0101',
  'Mejoramiento de la eficiencia',
  '0101001',
  'Documentos normativos',
  'Descripción del producto',
  'Número de proyectos',
  '010100100',
  'Proyectos de ley',
  'Número',
  'Sí',
  'Sí',
  'No',
  '16. Paz justicia e instituciones fuertes',
  '16.6 Crear instituciones eficaces',
  'No',
  'No',
  'No',
  'Sí',
  'No',
  'No',
  'No',
  'No',
] as const;

/** Genera y descarga la plantilla CSV MGA (24 columnas) con BOM UTF-8 para Excel. */
export function downloadProductTemplate(): void {
  const csv = `\uFEFF${PRODUCT_TEMPLATE_HEADERS.join(',')}\n${PRODUCT_TEMPLATE_EXAMPLE.join(',')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_productos.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function extractUploadError(err: unknown): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as
      | { error?: string; details?: string | CatalogImportRowError[] }
      | undefined;
    if (data?.error) return data.error;
    if (typeof data?.details === 'string' && data.details.trim()) return data.details;
    return err.message || 'No se pudo importar el archivo';
  }
  if (err instanceof Error) return err.message;
  return 'No se pudo importar el archivo';
}

function extractImportRowErrors(
  data: CatalogImportResult | CatalogSummary | null | undefined,
): CatalogImportRowError[] {
  if (!data) return [];

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.filter((item) => Boolean(item?.message?.trim()));
  }

  if (Array.isArray(data.details)) {
    return data.details.filter((item) => Boolean(item?.message?.trim()));
  }

  if (typeof data.details === 'string' && data.details.trim()) {
    return [{ message: data.details.trim() }];
  }

  return [];
}

function formatImportRowError(item: CatalogImportRowError, index: number): string {
  const parts: string[] = [];
  if (item.row != null && item.row > 0) {
    parts.push(`Fila ${item.row}`);
  }
  if (item.codigo_producto?.trim()) {
    parts.push(`Código ${item.codigo_producto.trim()}`);
  }
  const prefix = parts.length > 0 ? `${parts.join(' · ')}: ` : `Registro ${index + 1}: `;
  return `${prefix}${item.message}`;
}

export default function CatalogImporter({
  variant = 'full',
  onImported,
  className = '',
}: CatalogImporterProps) {
  const isMatrixImport =
    variant === 'products' ||
    variant === 'edt' ||
    variant === 'deliverables' ||
    variant === 'activities' ||
    variant === 'ods';
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState(
    variant === 'products'
      ? 'Esperando archivo CSV/XLSX de productos'
      : variant === 'edt'
        ? 'Esperando archivo CSV/XLSX de EDT'
        : variant === 'deliverables'
          ? 'Esperando archivo CSV/XLSX de entregables'
          : variant === 'activities'
            ? 'Esperando archivo CSV/XLSX de actividades'
            : variant === 'ods'
              ? 'Esperando archivo CSV/XLSX de ODS'
              : 'Esperando archivo Excel',
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<CatalogSummary | null>(null);
  const [importErrors, setImportErrors] = useState<CatalogImportRowError[]>([]);
  const [error, setError] = useState<string | null>(null);

  const uploadCatalog = async (selectedFile?: File | null) => {
    const sourceFile = selectedFile || file;
    if (!sourceFile) return;

    const formData = new FormData();
    formData.append('file', sourceFile);
    setFile(sourceFile);
    setStatus(
      variant === 'products'
        ? 'Procesando catálogo de productos. Por favor, espere…'
        : variant === 'edt'
          ? 'Procesando catálogo EDT. Por favor, espere…'
          : variant === 'deliverables'
            ? 'Procesando catálogo de entregables. Por favor, espere…'
            : variant === 'activities'
              ? 'Procesando lista de actividades. Por favor, espere…'
              : variant === 'ods'
                ? 'Procesando catálogo ODS. Por favor, espere…'
                : '⏳ Procesando miles de filas del catálogo. Por favor, no cierre esta ventana...',
    );
    setIsProcessing(true);
    setSummary(null);
    setImportErrors([]);
    setError(null);

    try {
      if (isMatrixImport) {
        const endpoint =
          variant === 'edt'
            ? '/catalog/edt/import'
            : variant === 'deliverables'
              ? '/catalog/deliverables/import'
              : variant === 'activities'
                ? '/catalog/activities/import'
                : variant === 'ods'
                  ? '/catalog/ods/import'
                  : '/catalog/products/import';
        const { data } = await api.post<CatalogImportResult>(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000,
        });
        const rowErrors = extractImportRowErrors(data);
        setSummary({
          status: data.status,
          message: data.message,
          inserted: data.inserted,
          updated: data.updated,
          skipped: data.skipped,
          total_rows_parsed: data.total_rows_parsed,
          productos_inserted: variant === 'products' ? data.inserted : undefined,
          edt_inserted: variant === 'edt' ? data.inserted : undefined,
          ods_inserted: variant === 'ods' ? data.inserted : undefined,
          errors: rowErrors,
        });
        setImportErrors(rowErrors);
        setStatus(
          `${data.message}: ${data.inserted} nuevos, ${data.updated} actualizados, ${data.skipped} omitidos.`,
        );
        onImported?.(data);
      } else {
        const response = await fetch('/api/catalog/upload', {
          method: 'POST',
          body: formData,
        });
        const data = (await response.json()) as CatalogSummary;
        if (!response.ok) {
          throw new Error(data.message || 'No se pudo importar el catálogo');
        }
        const rowErrors = extractImportRowErrors(data);
        setSummary(data);
        setImportErrors(rowErrors);
        setStatus(data.message || 'Catálogo actualizado correctamente');
        onImported?.(data);
      }
    } catch (err) {
      const msg = extractUploadError(err);
      const rowErrors =
        isAxiosError(err) && err.response?.data
          ? extractImportRowErrors(err.response.data as CatalogSummary)
          : [{ message: msg }];
      setError(msg);
      setImportErrors(rowErrors);
      setStatus(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: isMatrixImport
      ? {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xls'],
          'text/csv': ['.csv'],
        }
      : {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
    multiple: false,
    disabled: isProcessing,
    onDrop: (acceptedFiles) => void uploadCatalog(acceptedFiles[0]),
  });

  return (
    <div
      className={`rounded-2xl border border-[#E2E8F0] bg-white/95 p-6 shadow-sm glass-card ${className}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[#121c2c]">
            {variant === 'products'
              ? 'Importar Catálogo de Productos'
              : variant === 'edt'
                ? 'Importar Catálogo EDT'
                : variant === 'deliverables'
                  ? 'Importar Catálogo de Entregables'
                  : variant === 'activities'
                    ? 'Importar Lista de actividades'
                    : variant === 'ods'
                      ? 'Importar Catálogo ODS'
                      : 'Actualizar Catálogo Oficial DNP'}
          </h3>
          <p className="text-sm text-[#3f4949]">
            {variant === 'products'
              ? 'Suba el Excel/CSV del catálogo de productos (MGA). Cada producto debe referenciar un código de programa ya existente.'
              : variant === 'edt'
                ? 'Suba el Excel/CSV de la matriz EDT (producto, entregables nivel 1–3 y actividades).'
                : variant === 'deliverables'
                  ? 'Suba el Excel/CSV con listado de entregables y código entregable (preserva ceros a la izquierda).'
                  : variant === 'activities'
                    ? 'Suba el Excel/CSV con listado de actividades, unidad de medida y código actividad (preserva ceros a la izquierda).'
                    : variant === 'ods'
                      ? 'Suba el Excel/CSV de objetivos y metas ODS (códigos como 1.10 y 1.a se guardan como texto).'
                      : 'Suba el archivo oficial del DNP para actualizar sectores, programas, productos, EDT y ODS en la base relacional del sistema.'}
          </p>
        </div>
        {variant === 'products' && (
          <button
            type="button"
            onClick={downloadProductTemplate}
            className="h-12 shrink-0 px-4 py-2 bg-gray-100/50 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors font-medium inline-flex items-center gap-2"
          >
            <Download className="h-5 w-5" aria-hidden />
            Descargar Plantilla
          </button>
        )}
        {variant === 'edt' && (
          <button
            type="button"
            onClick={downloadEdtTemplate}
            className="h-12 shrink-0 px-4 py-2 bg-gray-100/50 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors font-medium inline-flex items-center gap-2"
          >
            <Download className="h-5 w-5" aria-hidden />
            Descargar Plantilla
          </button>
        )}
        {variant === 'deliverables' && (
          <button
            type="button"
            onClick={downloadDeliverableTemplate}
            className="h-12 shrink-0 px-4 py-2 bg-gray-100/50 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors font-medium inline-flex items-center gap-2"
          >
            <Download className="h-5 w-5" aria-hidden />
            Descargar Plantilla
          </button>
        )}
        {variant === 'activities' && (
          <button
            type="button"
            onClick={downloadActivityTemplate}
            className="h-12 shrink-0 px-4 py-2 bg-gray-100/50 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors font-medium inline-flex items-center gap-2"
          >
            <Download className="h-5 w-5" aria-hidden />
            Descargar Plantilla
          </button>
        )}
        {variant === 'ods' && (
          <button
            type="button"
            onClick={downloadOdsTemplate}
            className="h-12 shrink-0 px-4 py-2 bg-gray-100/50 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors font-medium inline-flex items-center gap-2"
          >
            <Download className="h-5 w-5" aria-hidden />
            Descargar Plantilla
          </button>
        )}
      </div>

      <div
        {...getRootProps()}
        className={`rounded-3xl border-2 border-dashed border-[#006a68] bg-[#E6FFFA]/50 p-8 text-center transition ${isProcessing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'} ${isDragActive ? 'bg-teal-50 ring-2 ring-teal-300' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <div className="rounded-full bg-[#006162] p-4 text-white">
            {isProcessing ? (
              <LoaderCircle className="h-8 w-8 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-8 w-8" />
            )}
          </div>
          <p className="text-xl font-semibold text-[#121c2c]">
            {variant === 'products'
              ? 'Arrastre aquí el archivo de productos (.xlsx / .csv)'
              : variant === 'edt'
                ? 'Arrastre aquí el archivo EDT (.xlsx / .csv)'
                : variant === 'deliverables'
                  ? 'Arrastre aquí el archivo de entregables (.xlsx / .csv)'
                  : variant === 'activities'
                    ? 'Arrastre aquí el archivo de actividades (.xlsx / .csv)'
                    : variant === 'ods'
                      ? 'Arrastre aquí el archivo ODS (.xlsx / .csv)'
                      : 'Actualizar Catálogo Oficial DNP (Archivo Excel)'}
          </p>
          <p className="text-base text-[#3f4949]">
            {variant === 'products'
              ? 'El sistema validará que el programa padre exista antes de insertar cada producto.'
              : variant === 'edt'
                ? 'La unicidad se define por código de producto estandarizado + código de actividad.'
                : variant === 'deliverables'
                  ? 'La unicidad se define por código entregable (varchar; p. ej. 000000004).'
                  : variant === 'activities'
                    ? 'La unicidad se define por código actividad (varchar; p. ej. 000000003).'
                    : variant === 'ods'
                      ? 'La unicidad se define por código objetivo + código meta (p. ej. 1 + 1.10).'
                      : 'Arrastre aquí el archivo .xlsx del catálogo oficial. El sistema lo procesará y actualizará la fuente de verdad para la IA.'}
          </p>
          <button
            type="button"
            className="rounded-2xl border border-[#bec9c8] bg-white px-5 py-3 text-base font-semibold text-[#121c2c] hover:bg-[#f0f3ff] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isProcessing}
          >
            {isProcessing
              ? 'Procesando archivo...'
              : isMatrixImport
                ? 'Seleccionar CSV/XLSX'
                : 'Seleccionar archivo Excel'}
          </button>
        </div>
      </div>

      <div
        className={`mt-4 rounded-2xl border p-4 text-sm ${
          error
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-[#E2E8F0] bg-[#f8faf9] text-[#3f4949]'
        }`}
      >
        <div className="font-semibold text-[#121c2c]">Estado</div>
        <p className="mt-1">{status}</p>
      </div>

      {summary && isMatrixImport && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Nuevos
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.inserted ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Actualizados
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.updated ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <CheckCircle2 className="h-4 w-4" /> Omitidos
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.skipped ?? 0}</div>
          </div>
        </div>
      )}

      {importErrors.length > 0 && (
        <div
          className={`mt-4 rounded-2xl border p-4 ${
            error ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-sm font-semibold ${
              error ? 'text-red-800' : 'text-amber-800'
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Detalle de Errores
            <span className="font-normal">({importErrors.length})</span>
          </div>
          <p className={`mt-1 text-sm ${error ? 'text-red-700' : 'text-amber-700'}`}>
            {error
              ? 'La importación no se completó. Revise los registros señalados:'
              : 'Algunas filas fueron omitidas o requieren corrección:'}
          </p>
          <ul
            className={`mt-3 max-h-64 overflow-y-auto rounded-xl border bg-white/80 text-sm divide-y ${
              error ? 'border-red-100 divide-red-100 text-red-700' : 'border-amber-100 divide-amber-100 text-amber-800'
            }`}
          >
            {importErrors.map((item, index) => (
              <li key={`${item.row ?? 'row'}-${item.codigo_producto ?? 'code'}-${index}`} className="px-3 py-2">
                {formatImportRowError(item, index)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary && variant === 'full' && (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Sectores
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">
              {summary.sectores_inserted ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Programas
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">
              {summary.programas_inserted ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Productos
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">
              {summary.productos_inserted ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> EDT
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">
              {summary.edt_inserted ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> ODS
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">
              {summary.ods_inserted ?? 0}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
