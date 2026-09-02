import { useCallback, useMemo, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import { useProjectEdtStore } from '../../../store/projectEdtStore';
import MgaPdfReport, { type MgaPdfReportMeta } from './MgaPdfReport';

type MgaPdfExportButtonProps = {
  project: Project;
  formuladorLabel: string;
  formuladorType?: string;
  tenantName?: string;
  className?: string;
  variant?: 'primary' | 'outline';
};

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[^\w\s-áéíóúñÁÉÍÓÚÑ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

const PRINT_PAGE_STYLE = `
  @page { size: A4; margin: 10mm; }
  @media print {
    html, body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

export default function MgaPdfExportButton({
  project,
  formuladorLabel,
  formuladorType = 'Oficial',
  tenantName,
  className = '',
  variant = 'primary',
}: MgaPdfExportButtonProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const fetchFormulation = useProjectMgaStore((s) => s.fetchFormulation);
  const getChain = useProjectEdtStore((s) => s.getChain);
  const fetchEdtChain = useProjectEdtStore((s) => s.fetchEdtChain);

  const formulation = getFormulation(project.id);
  const edtChain = getChain(project.id);

  const meta: MgaPdfReportMeta = useMemo(
    () => ({
      printedAt: new Date().toLocaleString('es-CO', {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
      formuladorLabel,
      formuladorType,
      tenantName,
    }),
    [formuladorLabel, formuladorType, tenantName],
  );

  const documentTitle = useMemo(
    () => `Ficha_MGA_${sanitizeFilename(project.name) || 'proyecto'}`,
    [project.name],
  );

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle,
    pageStyle: PRINT_PAGE_STYLE,
    onAfterPrint: () => setIsPreparing(false),
    onPrintError: () => {
      setIsPreparing(false);
      setError('No se pudo abrir el diálogo de impresión.');
    },
  });

  const onExportClick = useCallback(async () => {
    setIsPreparing(true);
    setError(null);
    try {
      await Promise.all([fetchFormulation(project.id), fetchEdtChain(project.id)]);
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      handlePrint();
    } catch (err) {
      setIsPreparing(false);
      setError(err instanceof Error ? err.message : 'No se pudo generar la ficha MGA.');
    }
  }, [fetchEdtChain, fetchFormulation, handlePrint, project.id]);

  const buttonClass =
    variant === 'primary'
      ? 'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-aurora-dark disabled:opacity-60'
      : 'inline-flex items-center gap-2 rounded-lg border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60';

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={isPreparing}
          onClick={() => void onExportClick()}
          className={`${buttonClass} ${className}`}
        >
          <Printer className="h-4 w-4" aria-hidden />
          {isPreparing ? 'Preparando ficha…' : 'Descargar Ficha MGA (PDF)'}
        </button>
        {error && (
          <p className="max-w-xs text-right text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] h-0 w-0 overflow-hidden opacity-0">
        <MgaPdfReport
          ref={printRef}
          project={project}
          formulation={formulation}
          edtChain={edtChain}
          meta={meta}
        />
      </div>
    </>
  );
}
