import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CheckCircle2, FileSpreadsheet, LoaderCircle } from 'lucide-react';

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
};

export default function CatalogImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('Esperando archivo Excel');
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<CatalogSummary | null>(null);

  const uploadCatalog = async (selectedFile?: File | null) => {
    const sourceFile = selectedFile || file;
    if (!sourceFile) return;

    const formData = new FormData();
    formData.append('file', sourceFile);
    setFile(sourceFile);
    setStatus('⏳ Procesando miles de filas del catálogo. Por favor, no cierre esta ventana...');
    setIsProcessing(true);
    setSummary(null);

    try {
      const response = await fetch('/api/catalog/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setSummary(data);
      setStatus(data.message || 'Catálogo actualizado correctamente');
    } catch {
      setStatus('No se pudo importar el catálogo');
    } finally {
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
    disabled: isProcessing,
    onDrop: (acceptedFiles) => uploadCatalog(acceptedFiles[0]),
  });

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-800">Actualizar Catálogo Oficial DNP</h3>
        <p className="text-sm text-slate-700">Suba el archivo oficial del DNP para actualizar sectores, programas, productos, EDT y ODS en la base relacional del sistema.</p>
      </div>

      <div
        {...getRootProps()}
        className={`rounded-3xl border-2 border-dashed border-teal-700 bg-stone-100 p-8 text-center transition ${isProcessing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'} ${isDragActive ? 'bg-teal-50 ring-2 ring-teal-300' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <div className="rounded-full bg-teal-700 p-4 text-stone-50">
            {isProcessing ? <LoaderCircle className="h-8 w-8 animate-spin" /> : <FileSpreadsheet className="h-8 w-8" />}
          </div>
          <p className="text-xl font-semibold text-slate-800">Actualizar Catálogo Oficial DNP (Archivo Excel)</p>
          <p className="text-base text-slate-700">Arrastre aquí el archivo .xlsx del catálogo oficial. El sistema lo procesará y actualizará la fuente de verdad para la IA.</p>
          <button type="button" className="rounded-2xl border border-stone-300 bg-stone-50 px-5 py-3 text-base font-semibold text-slate-800 hover:bg-stone-200 disabled:cursor-not-allowed disabled:bg-stone-200" disabled={isProcessing}>
            {isProcessing ? 'Procesando archivo...' : 'Seleccionar archivo Excel'}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-slate-700">
        <div className="font-semibold text-slate-800">Estado</div>
        <p className="mt-1">{status}</p>
      </div>

      {summary && (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Sectores</div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.sectores_inserted ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Programas</div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.programas_inserted ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Productos</div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.productos_inserted ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> EDT</div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.edt_inserted ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> ODS</div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">{summary.ods_inserted ?? 0}</div>
          </div>
        </div>
      )}
    </div>
  );
}
