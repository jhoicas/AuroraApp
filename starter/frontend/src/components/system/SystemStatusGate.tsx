import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isSuperAdmin } from '../../lib/roles';
import { useSystemStatusStore } from '../../store/systemStatusStore';
import MaintenanceScreen from './MaintenanceScreen';

const POLL_MS = 60_000;

/**
 * Carga el estado público del sistema (sondeo cada 60 s) y, en modo mantenimiento,
 * reemplaza el contenido por la pantalla de mantenimiento salvo para SUPER_ADMIN.
 */
export default function SystemStatusGate({ children, onLogout }: { children: ReactNode; onLogout?: () => void }) {
  const { user } = useAuth();
  const load = useSystemStatusStore((s) => s.load);
  const maintenance = useSystemStatusStore((s) => s.maintenance_mode);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  if (maintenance && !isSuperAdmin(user?.role)) return <MaintenanceScreen onLogout={onLogout} />;
  return <>{children}</>;
}
