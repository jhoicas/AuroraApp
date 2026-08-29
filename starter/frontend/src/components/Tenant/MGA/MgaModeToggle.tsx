type MgaModeToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

/**
 * Interruptor Modo MGA (interfaz clásica del gobierno).
 */
export default function MgaModeToggle({ enabled, onChange }: MgaModeToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600">Vista Aurora</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Alternar Modo MGA"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2980b9] focus-visible:ring-offset-2 ${
          enabled ? 'bg-[#2980b9]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={`text-sm font-semibold ${enabled ? 'text-[#2980b9]' : 'text-gray-500'}`}>
        Modo MGA
      </span>
    </div>
  );
}
