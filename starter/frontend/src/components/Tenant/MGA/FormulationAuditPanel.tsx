import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { useFormulationAuditStore } from '../../../store/formulationAuditStore';
import { useProjectStore } from '../../../store/projectStore';
import type { AuditFinding, AuditSeverity } from '../../../lib/formulationAuditApi';
import MgaAlert from './MgaAlert';

export type MgaAuditTabId =
  | 'identificacion'
  | 'participantes'
  | 'poblacion'
  | 'objetivos'
  | 'cadena-valor'
  | 'alternativas'
  | 'localizacion'
  | 'plan-desarrollo'
  | 'necesidades'
  | 'analisis-tecnico'
  | 'riesgos'
  | 'ingresos-beneficios'
  | 'prestamos'
  | 'depreciacion'
  | 'evaluacion'
  | 'programacion';

const TAB_LABELS: Record<MgaAuditTabId, string> = {
  identificacion: 'Problemática',
  participantes: 'Participantes',
  poblacion: 'Población',
  objetivos: 'Objetivos',
  'cadena-valor': 'Cadena de Valor',
  alternativas: 'Alternativas',
  localizacion: 'Localización',
  'plan-desarrollo': 'Plan de Desarrollo',
  necesidades: 'Necesidades',
  'analisis-tecnico': 'Análisis Técnico',
  riesgos: 'Riesgos',
  'ingresos-beneficios': 'Ingresos y Beneficios',
  prestamos: 'Préstamos',
  depreciacion: 'Depreciación',
  evaluacion: 'Evaluación Económica',
  programacion: 'Programación',
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Resuelve la pestaña MGA exacta correspondiente a un hallazgo de auditoría
 * usando tanto el `SectionKey` estructurado como el contenido del mensaje.
 */
export function getTabForAuditFinding(finding: {
  sectionKey?: string;
  message?: string;
}): { tabId: MgaAuditTabId; label: string } {
  const sk = normalizeText(finding.sectionKey || '');
  const m = normalizeText(finding.message || '');

  // 1. Coincidencia por SectionKey
  if (sk.includes('cadena-valor') || sk.includes('edt') || sk.includes('actividad')) {
    return { tabId: 'cadena-valor', label: TAB_LABELS['cadena-valor'] };
  }
  if (sk.includes('localizacion') || sk.includes('geografica')) {
    return { tabId: 'localizacion', label: TAB_LABELS.localizacion };
  }
  if (sk.includes('poblacion') || sk.includes('demografia')) {
    return { tabId: 'poblacion', label: TAB_LABELS.poblacion };
  }
  if (sk.includes('objetivo')) {
    return { tabId: 'objetivos', label: TAB_LABELS.objetivos };
  }
  if (sk.includes('alternativa')) {
    return { tabId: 'alternativas', label: TAB_LABELS.alternativas };
  }
  if (sk.includes('participante') || sk.includes('actor')) {
    return { tabId: 'participantes', label: TAB_LABELS.participantes };
  }
  if (
    sk.includes('identificacion') ||
    sk.includes('problematica') ||
    sk.includes('causa') ||
    sk.includes('efecto') ||
    sk.includes('arbol')
  ) {
    return { tabId: 'identificacion', label: TAB_LABELS.identificacion };
  }
  if (sk.includes('plan-desarrollo')) {
    return { tabId: 'plan-desarrollo', label: TAB_LABELS['plan-desarrollo'] };
  }
  if (sk.includes('analisis-tecnico')) {
    return { tabId: 'analisis-tecnico', label: TAB_LABELS['analisis-tecnico'] };
  }
  if (sk.includes('necesidad')) {
    return { tabId: 'necesidades', label: TAB_LABELS.necesidades };
  }
  if (sk.includes('riesgo')) {
    return { tabId: 'riesgos', label: TAB_LABELS.riesgos };
  }
  if (sk.includes('ingreso') || sk.includes('beneficio')) {
    return { tabId: 'ingresos-beneficios', label: TAB_LABELS['ingresos-beneficios'] };
  }
  if (sk.includes('prestamo')) {
    return { tabId: 'prestamos', label: TAB_LABELS.prestamos };
  }
  if (sk.includes('depreciacion')) {
    return { tabId: 'depreciacion', label: TAB_LABELS.depreciacion };
  }
  if (sk.includes('evaluacion')) {
    return { tabId: 'evaluacion', label: TAB_LABELS.evaluacion };
  }
  if (sk.includes('programacion')) {
    return { tabId: 'programacion', label: TAB_LABELS.programacion };
  }

  // 2. Coincidencia por mensaje
  if (m.includes('cadena de valor') || /\bedt\b/.test(m) || m.includes('actividad') || m.includes('entregable')) {
    return { tabId: 'cadena-valor', label: TAB_LABELS['cadena-valor'] };
  }
  if (m.includes('localizacion') || m.includes('geografica') || m.includes('departamento') || m.includes('municipio')) {
    return { tabId: 'localizacion', label: TAB_LABELS.localizacion };
  }
  if (m.includes('poblacion')) {
    return { tabId: 'poblacion', label: TAB_LABELS.poblacion };
  }
  if (m.includes('objetivo general') || m.includes('objetivo especifico') || m.includes('indicador')) {
    return { tabId: 'objetivos', label: TAB_LABELS.objetivos };
  }
  if (m.includes('alternativa')) {
    return { tabId: 'alternativas', label: TAB_LABELS.alternativas };
  }
  if (m.includes('participante') || /\bactor\b/.test(m)) {
    return { tabId: 'participantes', label: TAB_LABELS.participantes };
  }
  if (
    m.includes('problema central') ||
    m.includes('causa') ||
    m.includes('efecto') ||
    m.includes('situacion existente') ||
    m.includes('magnitud')
  ) {
    return { tabId: 'identificacion', label: TAB_LABELS.identificacion };
  }

  return { tabId: 'identificacion', label: TAB_LABELS.identificacion };
}

/** Retrocompatibilidad para getTabForAuditIssue */
export function getTabForAuditIssue(message: string): { tabId: MgaAuditTabId; label: string } {
  return getTabForAuditFinding({ message });
}

type FormulationAuditPanelProps = {
  projectId: string;
  /** Variante compacta para modal del encabezado del proyecto */
  compact?: boolean;
  onNavigateToTab?: (tabId: MgaAuditTabId) => void;
  onSentToViability?: () => void;
};

type FindingItemCardProps = {
  finding: AuditFinding;
  onNavigateToTab?: (tabId: MgaAuditTabId) => void;
  onToggleResolved: (findingId: string) => void;
};

function FindingItemCard({ finding, onNavigateToTab, onToggleResolved }: FindingItemCardProps) {
  const target = getTabForAuditFinding(finding);
  const isCritical = finding.severity === 'CRITICAL';
  const isWarning = finding.severity === 'WARNING';
  const isSuccess = finding.severity === 'SUCCESS';

  return (
    <li
      className={`group rounded-lg border p-3.5 transition-all ${
        isCritical
          ? 'border-red-200 bg-red-50/70 hover:border-red-300 hover:bg-red-50'
          : isWarning
          ? 'border-amber-200 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50'
          : 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 shrink-0">
            {isCritical ? (
              <AlertOctagon className="h-5 w-5 text-red-600" aria-label="Hallazgo Crítico" />
            ) : isWarning ? (
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-label="Advertencia" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Verificado" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase ${
                  isCritical
                    ? 'bg-red-600 text-white'
                    : isWarning
                    ? 'bg-amber-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {isCritical ? 'Bloqueante' : isWarning ? 'Advertencia MGA' : 'Verificado'}
              </span>

              <span className="inline-flex items-center gap-1 rounded bg-white/80 border border-black/5 px-2 py-0.5 text-xs font-medium text-gray-600">
                Sección: {target.label}
              </span>

              {finding.isResolved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-semibold">
                  ✓ Marcado como resuelto
                </span>
              )}
            </div>

            <p
              className={`text-sm leading-relaxed ${
                isCritical
                  ? 'text-red-950 font-medium'
                  : isWarning
                  ? 'text-amber-950'
                  : 'text-emerald-950'
              } ${finding.isResolved ? 'line-through opacity-70' : ''}`}
            >
              {finding.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
          {!isSuccess && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none bg-white/70 px-2 py-1 rounded border border-gray-200 hover:bg-white transition-colors">
              <input
                type="checkbox"
                checked={finding.isResolved}
                onChange={() => onToggleResolved(finding.id)}
                className="rounded border-gray-300 text-[#006162] focus:ring-[#006162] h-3.5 w-3.5"
              />
              <span className="hidden sm:inline">Resuelto</span>
            </label>
          )}

          {onNavigateToTab && !isSuccess && (
            <button
              type="button"
              onClick={() => onNavigateToTab(target.tabId)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold shadow-xs transition-all ${
                isCritical
                  ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                  : 'bg-amber-700 text-white hover:bg-amber-800 active:scale-95'
              }`}
              title={`Ir a la pestaña ${target.label} para corregir este hallazgo`}
            >
              <span>Ir a gestionar</span>
              <ExternalLink className="h-3 w-3" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function FormulationAuditPanel({
  projectId,
  compact = false,
  onNavigateToTab,
  onSentToViability,
}: FormulationAuditPanelProps) {
  const auditResult = useFormulationAuditStore((s) => s.auditResult);
  const isAuditing = useFormulationAuditStore((s) => s.isAuditing);
  const error = useFormulationAuditStore((s) => s.error);
  const lastProjectId = useFormulationAuditStore((s) => s.lastProjectId);
  const runAudit = useFormulationAuditStore((s) => s.runAudit);
  const toggleFindingResolved = useFormulationAuditStore((s) => s.toggleFindingResolved);
  const clearAudit = useFormulationAuditStore((s) => s.clearAudit);
  const clearError = useFormulationAuditStore((s) => s.clearError);

  const patchProject = useProjectStore((s) => s.patchProject);

  const [isSendingToViability, setIsSendingToViability] = useState(false);
  const [viabilitySuccessMessage, setViabilitySuccessMessage] = useState<string | null>(null);
  const [viabilityErrorMessage, setViabilityErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (lastProjectId && lastProjectId !== projectId) {
      clearAudit();
    }
  }, [clearAudit, lastProjectId, projectId]);

  const handleRunAudit = () => {
    setViabilitySuccessMessage(null);
    setViabilityErrorMessage(null);
    void runAudit(projectId);
  };

  const showResult = Boolean(auditResult && lastProjectId === projectId);

  // Clasificación estricta de hallazgos
  const rawFindings: AuditFinding[] = auditResult?.findings ?? [];
  const fallbackBlockers = auditResult?.blockers ?? [];
  const fallbackWarnings = auditResult?.warnings ?? [];

  // Si findings viene con datos estructurados, los usamos; si no, reconstruimos a partir de blockers y warnings
  const normalizedFindings: AuditFinding[] =
    rawFindings.length > 0
      ? rawFindings
      : [
          ...fallbackBlockers.map((b, idx) => ({
            id: `blocker-${idx}`,
            message: b,
            severity: 'CRITICAL' as AuditSeverity,
            sectionKey: getTabForAuditIssue(b).tabId,
            isResolved: false,
          })),
          ...fallbackWarnings.map((w, idx) => ({
            id: `warning-${idx}`,
            message: w,
            severity: 'WARNING' as AuditSeverity,
            sectionKey: getTabForAuditIssue(w).tabId,
            isResolved: false,
          })),
        ];

  const criticalFindings = normalizedFindings.filter((f) => f.severity === 'CRITICAL');
  const warningFindings = normalizedFindings.filter((f) => f.severity === 'WARNING');
  const successFindings = normalizedFindings.filter((f) => f.severity === 'SUCCESS');

  // Bloqueo estricto de viabilidad
  const hasCriticalFindings = criticalFindings.length > 0;
  const unresolvedCriticalCount = criticalFindings.filter((f) => !f.isResolved).length;

  const handleSendToViability = async () => {
    if (hasCriticalFindings) return;
    setIsSendingToViability(true);
    setViabilitySuccessMessage(null);
    setViabilityErrorMessage(null);

    try {
      await patchProject(projectId, { status: 'EN_VIABILIDAD' });
      setViabilitySuccessMessage(
        '¡Proyecto enviado exitosamente a la etapa de Viabilidad! Ha superado todos los requisitos mínimos MGA.'
      );
      onSentToViability?.();
    } catch (err) {
      setViabilityErrorMessage(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado del proyecto a Viabilidad.'
      );
    } finally {
      setIsSendingToViability(false);
    }
  };

  return (
    <section
      className={`rounded-xl border border-gray-200 bg-white shadow-sm transition-all ${
        compact ? 'p-4' : 'p-6'
      }`}
      aria-labelledby="formulation-audit-heading"
    >
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h3
            id="formulation-audit-heading"
            className="text-base font-bold text-[#006162] flex items-center gap-2"
          >
            <ClipboardCheck className="h-5 w-5 shrink-0 text-[#006162]" aria-hidden />
            Simulacro de Auditoría Previa (MGA - DNP)
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-600 max-w-2xl leading-relaxed">
            Validador estricto que analiza la columna vertebral del proyecto (Problema, Población,
            Objetivos y Cadena de Valor) para evitar devoluciones formales ante el Banco de Programas
            y Proyectos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunAudit}
          disabled={isAuditing}
          className="inline-flex items-center gap-2 rounded-lg bg-[#006162] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#004d4e] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
        >
          {isAuditing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span>Auditando requisitos…</span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-4 w-4" aria-hidden />
              <span>Ejecutar Simulacro de Auditoría</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <MgaAlert message={error} onDismiss={clearError} />
        </div>
      )}

      {viabilitySuccessMessage && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{viabilitySuccessMessage}</span>
        </div>
      )}

      {viabilityErrorMessage && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">
          <span>{viabilityErrorMessage}</span>
        </div>
      )}

      {isAuditing && (
        <div
          className="mt-5 flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50/60 p-4 text-sm text-[#006162]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-5 w-5 animate-spin shrink-0 text-[#006162]" aria-hidden />
          <div>
            <p className="font-semibold">Examinando requisitos mínimos estructurales MGA…</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Verificando consistencia del Árbol de Problemas, Población y Localización, Objetivos y
              Alternativas, y Cadena de Valor (EDT).
            </p>
          </div>
        </div>
      )}

      {/* Resultados de Auditoría */}
      {showResult && !isAuditing && (
        <div className="mt-5 space-y-5">
          {/* Banner de Estado General */}
          {hasCriticalFindings ? (
            <div
              role="alert"
              className="rounded-lg border-2 border-red-300 bg-red-50 p-4 text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <AlertOctagon className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-red-900">
                    Bloqueo de Viabilidad Activo: Se detectaron {criticalFindings.length} hallazgo(s)
                    crítico(s)
                  </h4>
                  <p className="text-xs text-red-800 mt-0.5">
                    El proyecto no cumple con los requisitos mínimos indispensables de la MGA.
                    Corrija los elementos bloqueantes en las secciones señaladas para poder radicar o
                    enviar a viabilidad.
                  </p>
                </div>
              </div>
            </div>
          ) : auditResult?.passed ? (
            <div
              role="status"
              className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-950 flex items-center gap-3 shadow-xs"
            >
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900">
                  ¡Requisitos Estructurales MGA Cumplidos!
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  La formulación supera los controles deterministas de la metodología MGA. El
                  proyecto está listo para su envío a Viabilidad.
                </p>
              </div>
            </div>
          ) : (
            <div
              role="status"
              className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 flex items-center gap-3"
            >
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  Formulación con Advertencias de Calidad ({warningFindings.length})
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Revise las recomendaciones para fortalecer la sustentación del proyecto antes de
                  la evaluación formal.
                </p>
              </div>
            </div>
          )}

          {/* 1. Hallazgos Críticos (Bloqueantes en Rojo) */}
          {criticalFindings.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="text-sm font-bold text-red-900 flex items-center gap-2">
                  <AlertOctagon className="h-4 w-4 text-red-600" />
                  Hallazgos Críticos Bloqueantes ({criticalFindings.length})
                </h4>
                <span className="text-xs text-red-700 font-medium">
                  {unresolvedCriticalCount === 0
                    ? 'Todos marcados como resueltos'
                    : `${unresolvedCriticalCount} pendientes de corregir`}
                </span>
              </div>
              <ul className="space-y-2.5">
                {criticalFindings.map((finding) => (
                  <FindingItemCard
                    key={finding.id}
                    finding={finding}
                    onNavigateToTab={onNavigateToTab}
                    onToggleResolved={toggleFindingResolved}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* 2. Advertencias de Calidad y Coherencia (Ámbar) */}
          {warningFindings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Advertencias de Coherencia Narrativa ({warningFindings.length})
                </h4>
              </div>
              <ul className="space-y-2.5">
                {warningFindings.map((finding) => (
                  <FindingItemCard
                    key={finding.id}
                    finding={finding}
                    onNavigateToTab={onNavigateToTab}
                    onToggleResolved={toggleFindingResolved}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* 3. Requisitos Verificados Exitosamente (Verde) */}
          {successFindings.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Requisitos Estructurales Verificados ({successFindings.length})
                </h4>
              </div>
              <ul className="space-y-2.5">
                {successFindings.map((finding) => (
                  <FindingItemCard
                    key={finding.id}
                    finding={finding}
                    onNavigateToTab={onNavigateToTab}
                    onToggleResolved={toggleFindingResolved}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* 4. BLOQUEO DE VIABILIDAD / ACCIÓN FINAL */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                Paso a Viabilidad del Proyecto
                {hasCriticalFindings && (
                  <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                    Bloqueado
                  </span>
                )}
              </h4>
              <p className="text-xs text-gray-600 mt-1 max-w-xl">
                {hasCriticalFindings
                  ? 'El envío a Viabilidad se encuentra inhabilitado porque el proyecto presenta hallazgos críticos sin resolver en la formulación.'
                  : 'Todos los requisitos mínimos se encuentran satisfechos. Puede proceder a radicar el proyecto en la etapa de viabilidad.'}
              </p>
            </div>

            <div className="relative group shrink-0">
              <button
                type="button"
                onClick={handleSendToViability}
                disabled={hasCriticalFindings || isSendingToViability}
                className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold shadow-sm transition-all ${
                  hasCriticalFindings
                    ? 'cursor-not-allowed bg-gray-300 text-gray-500 opacity-80'
                    : 'bg-[#006162] text-white hover:bg-[#004d4e] active:scale-95'
                }`}
                title={
                  hasCriticalFindings
                    ? 'Debe corregir todos los hallazgos críticos de formulación (señalados en rojo) antes de enviar a viabilidad.'
                    : 'Enviar proyecto a revisión de viabilidad'
                }
              >
                {isSendingToViability ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Enviando…</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Enviar a Viabilidad</span>
                  </>
                )}
              </button>

              {/* Tooltip visible al hacer hover sobre botón bloqueado */}
              {hasCriticalFindings && (
                <div className="pointer-events-none absolute right-0 top-full mt-2 hidden group-hover:block w-72 rounded-lg border border-red-300 bg-white p-3 text-xs text-red-900 shadow-xl z-30">
                  <div className="flex items-start gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Envío Bloqueado:</strong> Debe resolver los{' '}
                      {criticalFindings.length} hallazgo(s) crítico(s) señalados arriba para
                      desbloquear el paso a Viabilidad.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
