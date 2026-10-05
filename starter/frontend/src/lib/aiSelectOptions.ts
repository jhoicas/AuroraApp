import { Children, isValidElement, type ReactNode } from 'react';

export type SelectOption = { label: string; value: string };

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement(node)) return nodeText((node.props as { children?: ReactNode }).children);
  return '';
}

function collectOptions(nodes: ReactNode, out: SelectOption[]) {
  Children.forEach(nodes, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
    if (child.type === 'option') {
      const label = nodeText(props.children).trim();
      const value = props.value != null ? String(props.value) : label;
      if (value !== '' && !props.disabled) out.push({ label, value });
    } else {
      // optgroup, fragmentos y wrappers
      collectOptions(props.children, out);
    }
  });
}

/** Devuelve el elemento `<select>` hijo directo (o dentro de fragmentos), si existe. */
export function findSelectElement(children: ReactNode): boolean {
  let found = false;
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || found) return;
    if (child.type === 'select') found = true;
    else if ((child.props as { children?: ReactNode }).children) {
      found = findSelectElement((child.props as { children?: ReactNode }).children);
    }
  });
  return found;
}

/** Lee las `<option>` seleccionables (no vacías ni deshabilitadas) de un `<select>` hijo. */
export function extractSelectOptions(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === 'select') {
      collectOptions((child.props as { children?: ReactNode }).children, out);
    } else if ((child.props as { children?: ReactNode }).children) {
      out.push(...extractSelectOptions((child.props as { children?: ReactNode }).children));
    }
  });
  return out;
}

/**
 * Resuelve la respuesta de la IA ("CODIGO|||Explicación" o texto libre) contra las
 * opciones disponibles. Solo devuelve un `value` que exista estrictamente en la lista.
 */
export function resolveListSuggestion(
  suggestion: string,
  options: SelectOption[],
): { value: string; label: string; explanation: string } | null {
  const [rawCode, ...rest] = suggestion.split('|||');
  const code = rawCode.trim();
  const norm = (v: string) => v.trim().toLowerCase();
  const match =
    options.find((o) => o.value === code) ??
    options.find((o) => norm(o.value) === norm(code)) ??
    options.find((o) => norm(o.label) === norm(code));
  if (!match) return null;
  return { value: match.value, label: match.label, explanation: rest.join('|||').trim() };
}
