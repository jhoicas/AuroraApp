import { api } from './api';

export type AuditSeverity = 'CRITICAL' | 'WARNING' | 'SUCCESS';

export type AuditFinding = {
  id: string;
  message: string;
  severity: AuditSeverity;
  sectionKey: string;
  isResolved: boolean;
};

export type RawAuditFinding = {
  id?: string;
  message?: string;
  severity?: string;
  section_key?: string;
  sectionKey?: string;
  is_resolved?: boolean;
  isResolved?: boolean;
};

export type AuditResult = {
  passed: boolean;
  findings: AuditFinding[];
  blockers: string[];
  warnings: string[];
};

type RawAuditResponse = {
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
    severity: (f.severity === 'CRITICAL' || f.severity === 'WARNING' || f.severity === 'SUCCESS')
      ? f.severity
      : 'WARNING',
    sectionKey: f.section_key || f.sectionKey || 'identificacion',
    isResolved: Boolean(f.is_resolved ?? f.isResolved ?? false),
  }));

  return {
    passed: data.passed,
    findings,
    blockers: data.blockers ?? [],
    warnings: data.warnings ?? [],
  };
}
