import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type FocusEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import {
  useAuroraCopilotStore,
  registerAutoFillCallback,
} from '../../store/auroraCopilotStore';
import { validateInfinitiveObjective } from '../../lib/mgaObjectiveValidation';
import { useReadOnly } from '../../context/ReadOnlyContext';
import { extractSelectOptions, findSelectElement, resolveListSuggestion } from '../../lib/aiSelectOptions';
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
  isList: isListProp,
  options: optionsProp,
}: AIAssistedFieldProps) {
  const tipId = useId();
  const { readOnly } = useReadOnly();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Si el hijo es un <select>, las opciones se leen de sus <option>.
  const hasSelectChild = findSelectElement(children);
  const selectOptions = hasSelectChild ? extractSelectOptions(children) : [];
  const isList = isListProp ?? (hasSelectChild ? true : undefined);
  const options = optionsProp ?? (hasSelectChild ? selectOptions : undefined);
  const [open, setOpen] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<string>('');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
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

  const requestSuggestion = () => {
    if (!fieldHelpKey || readOnly) return;
    suggestMgaField(fieldHelpKey, { ...(projectContext ?? {}), ...(reactiveContext ?? {}) }, maxLength, isList, options);
  };

  // Foco o clic en el campo: pide sugerencia una sola vez por montaje.
  const triggerAutomaticSuggestion = () => {
    if (automaticSuggestionTriggered.current) return;
    automaticSuggestionTriggered.current = true;
    requestSuggestion();
  };

  const handleChildFocus = (_event: FocusEvent<HTMLElement>) => triggerAutomaticSuggestion();
  const handleChildClick = (_event: ReactMouseEvent<HTMLElement>) => triggerAutomaticSuggestion();

  /** Aplica un valor; en <select> sin callbacks, dispara el cambio nativo para React. */
  const applyValue = (value: string) => {
    const final = !hasSelectChild && maxLength ? value.substring(0, maxLength) : value;
    onApplySuggestion?.(final);
    onAutoFill?.(final);
    if (hasSelectChild && !onApplySuggestion && !onAutoFill) {
      const select = wrapperRef.current?.querySelector('select');
      if (select) {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(select, final);
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  };

  const validationMessage =
    validationRule === 'infinitive-verb' ? validateInfinitiveObjective(validationValue) : null;

  return (
    <div className={`relative w-full max-w-full min-w-0 ${className}`}>
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

        </div>

        {open && (
          <div
            id={tipId}
            role="tooltip"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            className="basis-full w-full max-w-full sm:max-w-md rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm"
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
                    requestSuggestion();
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

          </div>
        )}

        {activeSuggestions && activeSuggestions.length > 0 && (
          <div className="basis-full w-full max-w-full min-w-0 flex flex-col gap-1.5">
            {activeSuggestions.map((sug, i) => {
              if (sug === "CARGANDO") {
                return (
                  <span key={i} className="w-full max-w-full overflow-hidden flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-800 font-medium italic animate-pulse">
                    <span className="material-symbols-outlined text-[14px] mr-1 animate-spin">sync</span>
                    Generando sugerencia...
                  </span>
                );
              }
              if (sug === "ESPERANDO_CUOTA") {
                return (
                  <span key={i} className="w-full max-w-full overflow-hidden flex items-center gap-2 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700 font-medium">
                    ⏳ Límite alcanzado. Esperando para procesar sugerencia...
                  </span>
                );
              }

              let displayValue = sug;
              let applyTarget = sug;

              if (hasSelectChild) {
                // Solo se muestran sugerencias que coincidan estrictamente con una <option>.
                const resolved = resolveListSuggestion(sug, selectOptions);
                if (!resolved) return null;
                applyTarget = resolved.value;
                displayValue = resolved.explanation
                  ? `${resolved.label} — ${resolved.explanation}`
                  : resolved.label;
              } else if (sug.includes('|||')) {
                const parts = sug.split('|||');
                applyTarget = parts[0].trim();
                displayValue = parts.slice(1).join('|||').trim();
              }

              return (
                <div key={i} className="w-full max-w-full overflow-hidden flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded p-2">
                  <span className="flex-1 min-w-0 truncate text-xs text-emerald-800" title={displayValue}>✨ {displayValue}</span>
                  <div className="flex-shrink-0 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPreviewTarget(applyTarget);
                      setPreviewText(displayValue);
                    }}
                    className="shrink-0 px-1 text-xs font-semibold hover:underline text-[#006162]"
                  >
                    [Ver]
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      applyValue(applyTarget);
                    }}
                    className="shrink-0 px-1 text-xs font-semibold hover:underline text-[#006162]"
                  >
                    [Usar]
                  </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div
        ref={wrapperRef}
        onFocusCapture={handleChildFocus}
        onClickCapture={handleChildClick}
      >
        {isValidElement(children) && maxLength != null
          ? cloneElement(children as ReactElement<{ maxLength?: number }>, {
              maxLength: (children.props as { maxLength?: number }).maxLength ?? maxLength,
            })
          : children}
      </div>
      {previewText !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreviewText(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sugerencia de Aurora IA"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white p-5 shadow-xl"
          >
            <h3 className="mb-3 text-base font-semibold text-[#006162]">Sugerencia de Aurora IA</h3>
            <div className="flex-1 overflow-y-auto whitespace-pre-wrap break-words text-sm text-gray-700">
              {previewText}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewText(null)}
                className="h-9 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  applyValue(previewTarget);
                  setPreviewText(null);
                }}
                className="h-9 rounded-lg bg-[#006162] px-4 text-sm font-semibold text-white hover:bg-[#004f50]"
              >
                Usar esta sugerencia
              </button>
            </div>
          </div>
        </div>
      )}
      {validationMessage && (
        <p role="alert" className="mt-1 text-xs text-amber-700 font-medium">
          {validationMessage}
        </p>
      )}

    </div>
  );
}
