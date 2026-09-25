import { useState, useCallback } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { downloadTechnicalDocumentValle } from '../../../lib/mgaApi';

type TechnicalDocumentValleExportButtonProps = {
  projectId: string;
  projectName: string;
  className?: string;
  variant?: 'outline' | 'filled';
};

export default function TechnicalDocumentValleExportButton({
  projectId,
  projectName,
  className = '',
  variant = 'outline',
}: TechnicalDocumentValleExportButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setError(null);
    try {
      await downloadTechnicalDocumentValle(projectId, projectName);
    } catch (err) {
      console.error('Error al descargar documento técnico Valle 1278:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo descargar el Documento Técnico. Verifique su conexión.',
      );
    } finally {
      setIsDownloading(false);
    }
  }, [projectId, projectName]);

  const baseStyle =
    variant === 'filled'
      ? 'inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors disabled:opacity-60'
      : 'inline-flex items-center gap-2 rounded-lg border-2 border-emerald-600 bg-emerald-50/70 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100 hover:border-emerald-700 transition-colors disabled:opacity-60';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isDownloading}
        onClick={() => void handleDownload()}
        className={`${baseStyle} ${className}`}
        title="Generar Documento Técnico requerido por el Decreto 1278 de 2023 del Valle del Cauca (Art. 13, Lit. e)"
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-700" aria-hidden />
        ) : (
          <FileText className="h-4 w-4 text-emerald-700" aria-hidden />
        )}
        <span>
          {isDownloading
            ? 'Generando Documento...'
            : 'Descargar Documento Técnico (Dec. 1278)'}
        </span>
      </button>
      {error && (
        <p className="max-w-xs text-right text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
