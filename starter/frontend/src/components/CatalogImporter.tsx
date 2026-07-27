import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';
import type { CatalogImportResult } from '../store/catalogStore';

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
};

type CatalogImporterProps = {
  /** `full` = catálogo DNP multi-hoja legacy; `products` = catálogo de productos MGA. */
  variant?: 'full' | 'products';
  onImported?: (result: CatalogImportResult | CatalogSummary) => void;
  className?: string;
};

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
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || err.message || 'No se pudo importar el archivo';
  }
  if (err instanceof Error) return err.message;
  return 'No se pudo importar el archivo';
}

export default function CatalogImporter({
  variant = 'full',
  onImported,
  className = '',
}: CatalogImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState(
    variant === 'products'
      ? 'Esperando archivo CSV/XLSX de productos'
      : 'Esperando archivo Excel',
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<CatalogSummary | null>(null);
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
        : '⏳ Procesando miles de filas del catálogo. Por favor, no cierre esta ventana...',
    );
    setIsProcessing(true);
    setSummary(null);
    setError(null);

    try {
      if (variant === 'products') {
        const { data } = await api.post<CatalogImportResult>('/catalog/products/import', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000,
        });
        setSummary({
          status: data.status,
          message: data.message,
          inserted: data.inserted,
          updated: data.updated,
          skipped: data.skipped,
          total_rows_parsed: data.total_rows_parsed,
          productos_inserted: data.inserted,
        });
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
        setSummary(data);
        setStatus(data.message || 'Catálogo actualizado correctamente');
        onImported?.(data);
      }
    } catch (err) {
      const msg = extractUploadError(err);
      setError(msg);
      setStatus(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept:
      variant === 'products'
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
              : 'Actualizar Catálogo Oficial DNP'}
          </h3>
          <p className="text-sm text-[#3f4949]">
            {variant === 'products'
              ? 'Suba el Excel/CSV del catálogo de productos (MGA). Cada producto debe referenciar un código de programa ya existente.'
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
              : 'Actualizar Catálogo Oficial DNP (Archivo Excel)'}
          </p>
          <p className="text-base text-[#3f4949]">
            {variant === 'products'
              ? 'El sistema validará que el programa padre exista antes de insertar cada producto.'
              : 'Arrastre aquí el archivo .xlsx del catálogo oficial. El sistema lo procesará y actualizará la fuente de verdad para la IA.'}
          </p>
          <button
            type="button"
            className="rounded-2xl border border-[#bec9c8] bg-white px-5 py-3 text-base font-semibold text-[#121c2c] hover:bg-[#f0f3ff] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isProcessing}
          >
            {isProcessing
              ? 'Procesando archivo...'
              : variant === 'products'
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

      {summary && variant === 'products' && (
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
