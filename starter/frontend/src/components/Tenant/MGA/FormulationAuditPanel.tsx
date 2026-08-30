import { useEffect } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { useFormulationAuditStore } from '../../../store/formulationAuditStore';
import MgaAlert from './MgaAlert';

type FormulationAuditPanelProps = {
  projectId: string;
  /** Variante compacta para modal del encabezado del proyecto */
  compact?: boolean;
};

export default function FormulationAuditPanel({ projectId, compact = false }: FormulationAuditPanelProps) {
  const auditResult = useFormulationAuditStore((s) => s.auditResult);
  const isAuditing = useFormulationAuditStore((s) => s.isAuditing);
  const error = useFormulationAuditStore((s) => s.error);
  const lastProjectId = useFormulationAuditStore((s) => s.lastProjectId);
  const runAudit = useFormulationAuditStore((s) => s.runAudit);
  const clearAudit = useFormulationAuditStore((s) => s.clearAudit);
  const clearError = useFormulationAuditStore((s) => s.clearError);

  useEffect(() => {
    if (lastProjectId && lastProjectId !== projectId) {
      clearAudit();
    }
  }, [clearAudit, lastProjectId, projectId]);

  const handleRunAudit = () => {
    void runAudit(projectId);
  };

  const showResult = auditResult && lastProjectId === projectId;

  return (
    <section
      className={`rounded-lg border border-gray-200 bg-white shadow-sm ${
        compact ? 'p-4' : 'p-5'
      }`}
      aria-labelledby="formulation-audit-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="formulation-audit-heading"
            className="text-base font-semibold text-[#2980b9] flex items-center gap-2"
          >
            <ClipboardCheck className="h-5 w-5 shrink-0" aria-hidden />
            Simulacro de auditoría previa
          </h3>
          <p className="mt-1 text-sm text-gray-600 max-w-2xl">
            Verifica los requisitos mínimos de formulación MGA antes de enviar el proyecto a
            viabilidad. Los hallazgos críticos deben resolverse para evitar devoluciones.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunAudit}
          disabled={isAuditing}
          className="inline-flex items-center gap-2 rounded-md bg-[#2980b9] px-4 py-2 text-sm font-medium text-white hover:bg-[#2471a3] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAuditing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Auditando…
            </>
          ) : (
            'Ejecutar Simulacro de Auditoría'
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <MgaAlert message={error} onDismiss={clearError} />
        </div>
      )}

      {isAuditing && (
        <div
          className="mt-4 flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[#2980b9]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          Revisando formulación del proyecto…
        </div>
      )}

      {showResult && !isAuditing && (
        <div className="mt-4 space-y-4">
          {auditResult.passed ? (
            <div
              role="status"
              className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-[#006162]"
            >
              ¡Proyecto listo para viabilidad!
            </div>
          ) : (
            <div
              role="status"
              className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              El proyecto aún no cumple todos los requisitos mínimos. Revise los hallazgos
              críticos a continuación.
            </div>
          )}

          {auditResult.blockers.length > 0 && (
            <div className="rounded-md border border-red-100 bg-red-50/50 p-4">
              <h4 className="text-sm font-semibold text-red-800 mb-2">
                Hallazgos críticos ({auditResult.blockers.length})
              </h4>
              <ul className="space-y-2">
                {auditResult.blockers.map((blocker) => (
                  <li
                    key={blocker}
                    className="flex items-start gap-2 text-sm text-red-800"
                  >
                    <span className="shrink-0" aria-hidden>
                      ❌
                    </span>
                    <span>{blocker}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {auditResult.warnings.length > 0 && (
            <div className="rounded-md border border-amber-100 bg-amber-50/50 p-4">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">
                Advertencias ({auditResult.warnings.length})
              </h4>
              <ul className="space-y-2">
                {auditResult.warnings.map((warning) => (
                  <li
                    key={warning}
                    className="flex items-start gap-2 text-sm text-amber-900"
                  >
                    <span className="shrink-0" aria-hidden>
                      ⚠️
                    </span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {auditResult.passed &&
            auditResult.blockers.length === 0 &&
            auditResult.warnings.length === 0 && (
              <p className="text-sm text-gray-600">
                No se encontraron bloqueos ni advertencias en la formulación actual.
              </p>
            )}
        </div>
      )}
    </section>
  );
}
