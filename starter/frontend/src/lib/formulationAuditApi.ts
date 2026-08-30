import { api } from './api';

export type AuditResult = {
  passed: boolean;
  blockers: string[];
  warnings: string[];
};

export async function getProjectAudit(projectId: string): Promise<AuditResult> {
  const { data } = await api.get<AuditResult>(`/projects/${projectId}/audit`);
  return {
    passed: data.passed,
    blockers: data.blockers ?? [],
    warnings: data.warnings ?? [],
  };
}
