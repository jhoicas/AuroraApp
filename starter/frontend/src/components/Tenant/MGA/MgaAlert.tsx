type MgaAlertProps = {
  message: string;
  variant?: 'error' | 'success' | 'warning';
  onDismiss?: () => void;
};

export default function MgaAlert({ message, variant = 'error', onDismiss }: MgaAlertProps) {
  const styles =
    variant === 'success'
      ? 'border-teal-200 bg-teal-50 text-[#006162]'
      : variant === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-red-200 bg-red-50 text-red-700';

  return (
    <div role="alert" className={`rounded border px-3 py-2 text-sm flex justify-between gap-2 ${styles}`}>
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Cerrar" className="shrink-0">
          ×
        </button>
      )}
    </div>
  );
}
