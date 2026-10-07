import { api } from './api';

export type AuditSeverity = 'CRITICAL' | 'WARNING' | 'SUGGESTION' | 'SUCCESS';
export type AuditStatus = 'APROBADO' | 'CON_OBSERVACIONES' | 'REQUIERE_SUBSANACION';

export type AuditFinding = {
  id: string;
  message: string;
  severity: AuditSeverity;
  sectionKey: string;
  isResolved: boolean;
  title?: string;
  description?: string;
  recommendation?: string;
  /** Nombre amigable de la sección. */
  section?: string;
  tabId?: string;
  fieldKey?: string;
  /** error | warning | suggestion | ok */
  level?: string;
  targetUrl?: string;
};

export type RawAuditFinding = {
  id?: string;
  message?: string;
  severity?: string;
  section_key?: string;
  sectionKey?: string;
  is_resolved?: boolean;
  isResolved?: boolean;
  title?: string;
  description?: string;
  recommendation?: string;
  section?: string;
  tabId?: string;
  fieldKey?: string;
  level?: string;
  targetUrl?: string;
};

export type AuditResult = {
  overallScore?: number;
  status?: AuditStatus;
  passed: boolean;
  findings: AuditFinding[];
  blockers: string[];
  warnings: string[];
};

type RawAuditResponse = {
  overallScore?: number;
  status?: string;
  passed: boolean;
  findings?: RawAuditFinding[];
  blockers?: string[];
  warnings?: string[];
};

export async function getProjectAudit(projectId: string): Promise<AuditResult> {
  const { data } = await api.get<RawAuditResponse>(`/projects/${projectId}/audit`);
  const rawFindings = data.findings ?? [];
  const findings: AuditFinding[] = rawFindings.map((f, idx) => ({
    id: f.id || `finding-${idx}`,
    message: f.message || '',
    severity:
      f.severity === 'CRITICAL' ||
      f.severity === 'WARNING' ||
      f.severity === 'SUGGESTION' ||
      f.severity === 'SUCCESS'
        ? f.severity
        : 'WARNING',
    sectionKey: f.section_key || f.sectionKey || f.tabId || 'identificacion',
    isResolved: Boolean(f.is_resolved ?? f.isResolved ?? false),
    title: f.title || undefined,
    description: f.description || undefined,
    recommendation: f.recommendation || undefined,
    section: f.section || undefined,
    tabId: f.tabId || undefined,
    fieldKey: f.fieldKey || undefined,
    level: f.level || undefined,
    targetUrl: f.targetUrl || undefined,
  }));
  const status: AuditStatus | undefined =
    data.status === 'APROBADO' || data.status === 'CON_OBSERVACIONES' || data.status === 'REQUIERE_SUBSANACION'
      ? data.status
      : undefined;

  return {
    overallScore: typeof data.overallScore === 'number' ? data.overallScore : undefined,
    status,
    passed: data.passed,
    findings,
    blockers: data.blockers ?? [],
    warnings: data.warnings ?? [],
  };
}
