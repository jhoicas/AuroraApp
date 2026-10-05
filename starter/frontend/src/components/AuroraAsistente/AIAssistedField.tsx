import { createPortal } from 'react-dom';
import {
  cloneElement,
  useCallback,
  useLayoutEffect,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type FocusEvent,
  type ReactNode,
} from 'react';
import {
  useAuroraCopilotStore,
  registerAutoFillCallback,
} from '../../store/auroraCopilotStore';
import { validateInfinitiveObjective } from '../../lib/mgaObjectiveValidation';
import { getFieldKnowledge, type ProjectContext } from '../../data/mgaFieldsKnowledge';

type AIAssistedFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  /** Guía metodológica breve mostrada en el popover. */
  guidance?: string;
  /** Prompt inyectado al abrir Aurora Asistente (modo chat completo). */
  askPrompt?: string;
  /** Contexto directivo adicional para imponer reglas metodológicas al prompt. */
  aiContext?: string;
  /** Valor actual para validación normativa en pantalla. */
  validationValue?: string;
  /** Regla de validación MGA aplicada bajo el campo. */
  validationRule?: 'infinitive-verb';
  children: ReactNode;
  className?: string;
  /** Estilo compacto para tablas Modo MGA. */
  compact?: boolean;
  /** Clave del campo en el catálogo de conocimiento MGA. */
  fieldHelpKey?: string;
  /** Contexto del proyecto para generar sugerencias contextualizadas. */
  projectContext?: ProjectContext;
  /** Callback para insertar el valor sugerido directamente en el campo. */
  onAutoFill?: (value: string) => void;
  /** Contexto reactivo para disparar sugerencias automáticas (debounce) */
  reactiveContext?: Record<string, any>;
  /** Valor actual del input. Si está vacío y el reactiveContext cambia, pide sugerencia. */
  currentValue?: string;
  /** Textos sugeridos por la IA en fases previas (ej: ideación). */
  prefilledSuggestions?: string[];
  /** Callback a ejecutar cuando se usa una sugerencia prellenada. */
  onApplySuggestion?: (value: string) => void;
  /** Longitud máxima de la respuesta sugerida por la IA. */
  maxLength?: number;
  /** Indica si el campo es un select/dropdown (requiere formato CODIGO|||Explicacion). */
  isList?: boolean;
  /** Opciones del catálogo si isList es true. */
  options?: { label: string; value: string }[];
};

/**
 * Envuelve un campo de formulario con ayuda contextual y CTA hacia Aurora Asistente.
 */
export default function AIAssistedField({
  label,
  htmlFor,
  required = false,
  guidance,
  askPrompt,
  aiContext,
  validationValue = '',
  validationRule,
  children,
  className = '',
  compact = false,
  fieldHelpKey,
  projectContext,
  reactiveContext,
  onAutoFill,
  prefilledSuggestions,
  onApplySuggestion,
  maxLength,
  isList,
  options,
}: AIAssistedFieldProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; arrowLeft: number } | null>(null);
  const automaticSuggestionTriggered = useRef(false);
  const askAurora = useAuroraCopilotStore((s) => s.askAurora);
  const askFieldHelp = useAuroraCopilotStore((s) => s.askFieldHelp);
  const suggestMgaField = useAuroraCopilotStore((s) => s.suggestMgaField);
  const storeSuggestions = useAuroraCopilotStore((s) => fieldHelpKey ? s.mgaFieldSuggestions[fieldHelpKey] : null);

  // Eliminado el auto-fetch masivo:
  // Se disparará solo onFocus o onClick en "Sugerir con Aurora"

  const activeSuggestions = prefilledSuggestions || storeSuggestions;

  // Register auto-fill callback so the chat ActionCard can dispatch back
  useEffect(() => {
    if (fieldHelpKey && onAutoFill) {
      return registerAutoFillCallback(fieldHelpKey, onAutoFill);
    }
  }, [fieldHelpKey, onAutoFill]);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  // El popover se renderiza en document.body (portal) con posición fija para que
  // ningún ancestro con overflow-hidden lo recorte ni quede bajo otros controles.
  const updatePopoverPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 16, window.innerWidth >= 640 ? 320 : 288);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPopoverPos({
      top: rect.bottom + 8,
      left,
      arrowLeft: Math.max(8, Math.min(rect.left + rect.width / 2 - left - 6, width - 20)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  const fieldKnowledge = fieldHelpKey ? getFieldKnowledge(fieldHelpKey) : null;



  const handleAskFieldHelp = () => {
    if (aiContext) {
      askAurora(aiContext);
    } else if (fieldHelpKey) {
      askFieldHelp(fieldHelpKey, projectContext ?? {});
    } else {
      askAurora(askPrompt || '');
    }
    setOpen(false);
  };

  const handleChildFocus = (_event: FocusEvent<HTMLElement>) => {
    if (automaticSuggestionTriggered.current) return;
    automaticSuggestionTriggered.current = true;

    if (fieldHelpKey) {
      suggestMgaField(fieldHelpKey, { ...(projectContext ?? {}), ...(reactiveContext ?? {}) }, maxLength, isList, options);
    }
  };

  const validationMessage =
    validationRule === 'infinitive-verb' ? validateInfinitiveObjective(validationValue) : null;

  return (
    <div className={`relative ${className}`}>
      <div className={`flex flex-wrap items-center gap-1.5 ${compact ? 'mb-0.5' : 'mb-1'}`}>
        <label
          htmlFor={htmlFor}
          className={`block font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
        <div
          className="relative"
          onMouseEnter={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
        >
          <button
            ref={triggerRef}
            type="button"
            aria-label={`Ayuda metodológica: ${label}`}
            aria-expanded={open}
            aria-controls={tipId}
            onClick={() => {
              clearCloseTimer();
              setOpen((v) => !v);
            }}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (!document.getElementById(tipId)?.contains(next)) {
                setOpen(false);
              }
            }}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[#006162] hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162]/40 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          </button>

          {open && popoverPos && createPortal(
            <div
              id={tipId}
              role="tooltip"
              onMouseEnter={clearCloseTimer}
              onMouseLeave={scheduleClose}
              style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left }}
              className="z-[100] w-72 max-w-[calc(100vw-1rem)] sm:w-80 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xl shadow-gray-900/10"
            >
              <p className="text-xs font-semibold text-[#006162] mb-1.5 inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lightbulb</span>
                Guía metodológica
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">{guidance}</p>

              {/* Pattern hint from knowledge catalog */}
              {fieldKnowledge && (
                <p className="text-xs text-gray-500 mb-3 italic">
                  Patrón: {fieldKnowledge.templatePattern}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (fieldHelpKey) {
                      suggestMgaField(fieldHelpKey, { ...(projectContext ?? {}), ...(reactiveContext ?? {}) }, maxLength, isList, options);
                      setOpen(false);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors bg-teal-100 hover:bg-teal-200 text-teal-800`}
                >
                  <span className="material-symbols-outlined text-sm">magic_button</span>
                  Sugerir con Aurora
                </button>
                {/* Secondary: Open chat with field-help */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAskFieldHelp}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors bg-[#006162] hover:bg-[#004f50] text-white`}
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                  Preguntar a Aurora
                </button>
              </div>

              <span
                style={{ left: popoverPos.arrowLeft }}
                className="absolute -top-1.5 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45"
                aria-hidden
              />
            </div>,
            document.body,
          )}
        </div>
        
        {activeSuggestions && activeSuggestions.length > 0 && (
          <span className="basis-full inline-flex flex-wrap items-center text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 gap-x-2 gap-y-1 max-w-full">
            ✨
            {activeSuggestions.map((sug, i) => {
              if (sug === "CARGANDO") {
                return (
                  <span key={i} className="inline-flex items-center text-teal-600 font-medium ml-1 italic animate-pulse">
                    <span className="material-symbols-outlined text-[14px] mr-1 animate-spin">sync</span>
                    Generando sugerencia...
                  </span>
                );
              }
              if (sug === "ESPERANDO_CUOTA") {
                return (
                  <span key={i} className="inline-flex items-center text-amber-600 font-medium ml-1">
                    ⏳ Límite alcanzado. Esperando para procesar sugerencia...
                  </span>
                );
              }

              let displayValue = sug;
              let applyValue = sug;

              if (sug.includes('|||')) {
                const parts = sug.split('|||');
                applyValue = parts[0].trim();
                displayValue = parts.slice(1).join('|||').trim();
              }

              return (
                <span key={i} className="inline-flex items-center">
                  <span className="truncate max-w-[min(300px,70vw)]" title={displayValue}>{displayValue}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      const finalValue = maxLength ? applyValue.substring(0, maxLength) : applyValue;
                      onApplySuggestion?.(finalValue);
                      onAutoFill?.(finalValue);
                    }}
                    className="ml-1 font-semibold hover:underline text-[#006162]"
                  >
                    [Usar]
                  </button>
                  {i < activeSuggestions.length - 1 && <span className="ml-2 text-teal-300">|</span>}
                </span>
              );
            })}
          </span>
        )}
      </div>
      <div
        onFocusCapture={handleChildFocus}
      >
        {isValidElement(children) && maxLength != null
          ? cloneElement(children as ReactElement<{ maxLength?: number }>, {
              maxLength: (children.props as { maxLength?: number }).maxLength ?? maxLength,
            })
          : children}
      </div>
      {validationMessage && (
        <p role="alert" className="mt-1 text-xs text-amber-700 font-medium">
          {validationMessage}
        </p>
      )}

    </div>
  );
}
