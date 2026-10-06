import { useLocation } from 'react-router-dom';

const LABELS: Record<string, string> = {
  users: 'Usuarios',
  settings: 'Configuración',
  reports: 'Reportes',
  security: 'Seguridad',
};

/** Marcador de posición de secciones de administración que aún no tienen pantalla. */
export default function ComingSoonPage() {
  const { pathname } = useLocation();
  const key = pathname.split('/').filter(Boolean).pop() ?? '';
  return <div className="p-4 text-gray-600">{LABELS[key] ?? 'Sección'} (próximamente)</div>;
}
