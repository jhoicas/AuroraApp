import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';

// Errores de React que nunca deben aparecer: delatan actualizaciones de estado
// fuera de act() o props inválidas, y hacen los tests no deterministas.
const FATAL_CONSOLE_PATTERNS = [
  /not wrapped in act\(/i,
  /Warning: Each child in a list should have a unique "key"/i,
  /Warning: Failed prop type/i,
];

const fatalConsoleMessages: string[] = [];

function recordIfFatal(args: unknown[]): void {
  const message = args.map(String).join(' ');
  if (FATAL_CONSOLE_PATTERNS.some((pattern) => pattern.test(message))) {
    fatalConsoleMessages.push(message);
  }
}

// Silencia ruido esperado de Axios/React en consola; los tests que lo necesiten
// pueden spyOn y restaurar el mock localmente.
const silentConsole = {
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(recordIfFatal),
};

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  silentConsole.warn.mockClear();
  silentConsole.error.mockClear();
  vi.clearAllMocks();
  // Reaplicar silencio tras clearAllMocks (vitest restoreMocks puede desactivarlos).
  silentConsole.warn.mockImplementation(() => {});
  silentConsole.error.mockImplementation(recordIfFatal);

  if (fatalConsoleMessages.length > 0) {
    const messages = fatalConsoleMessages.join('\n---\n');
    fatalConsoleMessages.length = 0;
    throw new Error(`Advertencias de React detectadas durante el test:\n${messages}`);
  }
});

afterAll(() => {
  server.close();
  silentConsole.warn.mockRestore();
  silentConsole.error.mockRestore();
});

// jsdom no implementa estas APIs usadas por recharts / react-window / scroll infinito.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
