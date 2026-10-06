import { useSystemStatusStore } from '../../store/systemStatusStore';

export default function MaintenanceScreen({ onLogout }: { onLogout?: () => void }) {
  const email = useSystemStatusStore((s) => s.support_email);
  return (
    <div role="alert" className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <span className="material-symbols-outlined text-6xl text-[#006162]" aria-hidden>construction</span>
        <h1 className="font-headline text-3xl font-bold text-[#121c2c]">Sistema en Mantenimiento</h1>
        <p className="text-[#3f4949]">
          Estamos realizando mejoras en la plataforma. Volveremos a estar disponibles muy pronto.
        </p>
        {email && (
          <p className="text-sm text-[#3f4949]">
            ¿Necesitas ayuda? Escríbenos a{' '}
            <a className="text-[#006162] underline" href={`mailto:${email}`}>{email}</a>
          </p>
        )}
        {onLogout && (
          <button type="button" onClick={onLogout} className="rounded border border-[#bec9c8] px-4 py-2 text-sm text-[#3f4949] hover:bg-[#f0f3ff]">
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}
