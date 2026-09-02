import { useEffect } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { useFormulationAuditStore } from '../../../store/formulationAuditStore';
import MgaAlert from './MgaAlert';

export type MgaAuditTabId =
  | 'identificacion'
  | 'participantes'
  | 'poblacion'
  | 'objetivos'
  | 'cadena-valor'
  | 'alternativas';

const TAB_LABELS: Record<MgaAuditTabId, string> = {
  identificacion: 'Identificación',
  participantes: 'Participantes',
  poblacion: 'Población',
  objetivos: 'Objetivos',
  'cadena-valor': 'Cadena de Valor',
  alternativas: 'Alternativas',
};

function normalizeAuditMessage(message: string): string {
  return message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Determina la pestaña MGA donde el usuario debe corregir un hallazgo de auditoría. */
export function getTabForAuditIssue(message: string): { tabId: MgaAuditTabId; label: string } {
  const m = normalizeAuditMessage(message);

  if (
    m.includes('objetivo general') ||
    m.includes('objetivo especifico') ||
    m.includes('indicador')
  ) {
    return { tabId: 'objetivos', label: TAB_LABELS.objetivos };
  }
  if (
    m.includes('cadena de valor') ||
    /\bedt\b/.test(m) ||
    m.includes('entregable') ||
    m.includes('actividad')
  ) {
    return { tabId: 'cadena-valor', label: TAB_LABELS['cadena-valor'] };
  }
  if (m.includes('alternativa')) {
    return { tabId: 'alternativas', label: TAB_LABELS.alternativas };
  }
  if (m.includes('participante') || /\bactor\b/.test(m)) {
    return { tabId: 'participantes', label: TAB_LABELS.participantes };
  }
  if (
    m.includes('poblacion') ||
    m.includes('poblacion afectada') ||
    m.includes('demografia') ||
    /\bobjetivo\b/.test(m)
  ) {
    return { tabId: 'poblacion', label: TAB_LABELS.poblacion };
  }
  if (
    m.includes('situacion existente') ||
    m.includes('magnitud') ||
    m.includes('arbol de problemas')
  ) {
    return { tabId: 'identificacion', label: TAB_LABELS.identificacion };
  }
  if (
    m.includes('problema central') ||
    m.includes('problema') ||
    m.includes('causa') ||
    m.includes('efecto')
  ) {
    return { tabId: 'identificacion', label: TAB_LABELS.identificacion };
  }

  return { tabId: 'identificacion', label: TAB_LABELS.identificacion };
}

type FormulationAuditPanelProps = {
  projectId: string;
  /** Variante compacta para modal del encabezado del proyecto */
  compact?: boolean;
  onNavigateToTab?: (tabId: MgaAuditTabId) => void;
};

type AuditIssueRowProps = {
  message: string;
  variant: 'blocker' | 'warning';
  onNavigateToTab?: (tabId: MgaAuditTabId) => void;
};

function AuditIssueRow({ message, variant, onNavigateToTab }: AuditIssueRowProps) {
  const target = getTabForAuditIssue(message);
  const isBlocker = variant === 'blocker';

  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-md px-2 py-1.5 -mx-2 ${
        isBlocker ? 'hover:bg-red-100/60' : 'hover:bg-amber-100/60'
      }`}
    >
      <div
        className={`flex items-start gap-2 text-sm min-w-0 ${
          isBlocker ? 'text-red-800' : 'text-amber-900'
        }`}
      >
        <span className="shrink-0" aria-hidden>
          {isBlocker ? '❌' : '⚠️'}
        </span>
        <span>{message}</span>
      </div>
      {onNavigateToTab && (
        <button
          type="button"
          onClick={() => onNavigateToTab(target.tabId)}
          className={`shrink-0 text-xs font-medium whitespace-nowrap rounded px-2 py-1 transition-colors ${
            isBlocker
              ? 'text-[#c0392b] hover:bg-red-100 hover:text-red-900'
              : 'text-amber-800 hover:bg-amber-100 hover:text-amber-950'
          }`}
          title={`Ir a ${target.label}`}
        >
          Ir a corregir ↗
        </button>
      )}
    </li>
  );
}

export default function FormulationAuditPanel({
  projectId,
  compact = false,
  onNavigateToTab,
}: FormulationAuditPanelProps) {
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
              <ul className="space-y-1">
                {auditResult.blockers.map((blocker) => (
                  <AuditIssueRow
                    key={blocker}
                    message={blocker}
                    variant="blocker"
                    onNavigateToTab={onNavigateToTab}
                  />
                ))}
              </ul>
            </div>
          )}

          {auditResult.warnings.length > 0 && (
            <div className="rounded-md border border-amber-100 bg-amber-50/50 p-4">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">
                Advertencias ({auditResult.warnings.length})
              </h4>
              <ul className="space-y-1">
                {auditResult.warnings.map((warning) => (
                  <AuditIssueRow
                    key={warning}
                    message={warning}
                    variant="warning"
                    onNavigateToTab={onNavigateToTab}
                  />
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
