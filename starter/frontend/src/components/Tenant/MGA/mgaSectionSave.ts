/**
 * Guardado por sección: el tab montado registra aquí su persistencia y la barra única
 * "Guardar y Continuar" de MGALayout la ejecuta antes de marcar la sección como completada.
 * Un handler que lanza error cancela el avance.
 */
type SectionSaveHandler = () => Promise<unknown> | unknown;

let activeHandler: SectionSaveHandler | null = null;

export function registerSectionSave(handler: SectionSaveHandler): () => void {
  activeHandler = handler;
  return () => {
    if (activeHandler === handler) activeHandler = null;
  };
}

export async function runSectionSave(): Promise<void> {
  if (activeHandler) await activeHandler();
}
