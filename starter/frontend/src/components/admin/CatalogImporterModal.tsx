import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, FileSpreadsheet, LoaderCircle, X } from 'lucide-react';
import { isAxiosError } from 'axios';

type CatalogImporterModalProps = {
  title: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<void>;
  onSuccess: () => void;
};

export default function CatalogImporterModal({
  title,
  description,
  isOpen,
  onClose,
  onImport,
  onSuccess,
}: CatalogImporterModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (selectedFile?: File | null) => {
    const sourceFile = selectedFile || file;
    if (!sourceFile) return;

    setFile(sourceFile);
    setIsProcessing(true);
    setError(null);

    try {
      await onImport(sourceFile);
      onSuccess();
      onClose();
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.error || err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error desconocido al importar el archivo.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/json': ['.json'],
    },
    multiple: false,
    disabled: isProcessing,
    onDrop: (acceptedFiles) => void handleUpload(acceptedFiles[0]),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="mb-6 text-sm text-slate-600">{description}</p>
          
          <div
            {...getRootProps()}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              isProcessing
                ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
                : isDragActive
                ? 'border-[#006162] bg-[#E6FFFA]'
                : 'border-slate-300 bg-white hover:border-[#006162] hover:bg-[#f9f9ff] cursor-pointer'
            }`}
          >
            <input {...getInputProps()} />
            <div className="mx-auto flex flex-col items-center gap-4">
              <div className="rounded-full bg-[#006162] p-4 text-white">
                {isProcessing ? (
                  <LoaderCircle className="h-8 w-8 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-8 w-8" />
                )}
              </div>
              <div>
                <p className="text-lg font-medium text-slate-800">
                  {isProcessing ? 'Procesando archivo...' : 'Arrastre aquí su archivo JSON'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {isProcessing
                    ? 'Por favor, espere un momento'
                    : 'o haga clic para seleccionar desde su equipo'}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
