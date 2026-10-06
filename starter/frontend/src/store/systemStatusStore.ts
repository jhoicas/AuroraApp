import { create } from 'zustand';
import { setMaintenanceHandler } from '../lib/api';
import { fetchSystemStatus, type SystemStatus } from '../lib/systemSettingsApi';

type SystemStatusState = SystemStatus & {
  load: () => Promise<void>;
  /** El backend respondió 503 MAINTENANCE_MODE: bloquear la UI sin esperar al sondeo. */
  markMaintenance: () => void;
};

export const useSystemStatusStore = create<SystemStatusState>((set) => ({
  maintenance_mode: false,
  banner_enabled: false,
  banner_message: '',
  support_email: '',
  load: async () => {
    try {
      set(await fetchSystemStatus());
    } catch {
      // Estado no crítico: ante error se conserva el último valor conocido.
    }
  },
  markMaintenance: () => set({ maintenance_mode: true }),
}));

setMaintenanceHandler(() => useSystemStatusStore.getState().markMaintenance());
