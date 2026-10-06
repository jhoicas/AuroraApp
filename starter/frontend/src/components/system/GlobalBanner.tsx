import { useSystemStatusStore } from '../../store/systemStatusStore';

/** Aviso global configurado por el SUPER_ADMIN; visible en la parte superior de los layouts. */
export default function GlobalBanner() {
  const enabled = useSystemStatusStore((s) => s.banner_enabled);
  const message = useSystemStatusStore((s) => s.banner_message);
  if (!enabled || !message) return null;
  return (
    <div
      role="status"
      data-testid="global-banner"
      className="w-full shrink-0 bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-sm flex items-center justify-center gap-2 print:hidden"
    >
      <span className="material-symbols-outlined text-base" aria-hidden>campaign</span>
      <span>{message}</span>
    </div>
  );
}
