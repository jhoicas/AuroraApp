import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { getProjectAudit, type AuditResult } from '../lib/formulationAuditApi';

type FormulationAuditStoreState = {
  auditResult: AuditResult | null;
  isAuditing: boolean;
  error: string | null;
  lastProjectId: string | null;
  runAudit: (projectId: string) => Promise<AuditResult>;
  clearAudit: () => void;
  clearError: () => void;
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export const useFormulationAuditStore = create<FormulationAuditStoreState>((set) => ({
  auditResult: null,
  isAuditing: false,
  error: null,
  lastProjectId: null,

  runAudit: async (projectId: string) => {
    set({ isAuditing: true, error: null, lastProjectId: projectId });
    try {
      const result = await getProjectAudit(projectId);
      set({ auditResult: result, isAuditing: false, error: null, lastProjectId: projectId });
      return result;
    } catch (err) {
      const message = extractError(err, 'No se pudo ejecutar la auditoría de formulación');
      set({ isAuditing: false, error: message });
      throw err;
    }
  },

  clearAudit: () => set({ auditResult: null, error: null, lastProjectId: null }),

  clearError: () => set({ error: null }),
}));
