import type { AccessModule } from '../store/accessStore';
import { moduleRegistry, registeredModules, type RegistryEntry } from './moduleRegistry';

type Registry = Record<string, RegistryEntry>;

/** Módulo del menú: enlace simple o grupo con secciones registradas. */
export type NavItem = {
  node: AccessModule;
  entry: RegistryEntry;
  /** Secciones visibles y registradas con ruta propia (vacío ⇒ enlace simple). */
  children: Array<{ node: AccessModule; entry: RegistryEntry }>;
};

/** Ítems del menú: módulos de primer nivel registrados, con enlace propio (nav !== false). */
export function buildNavItems(nav: AccessModule[], registry: Registry = moduleRegistry): NavItem[] {
  const items: NavItem[] = [];
  for (const { node, entry } of registeredModules(nav, registry)) {
    if (node.kind === 'SECTION' || entry.nav === false) continue;
    const children = (node.children ?? [])
      .filter((c) => registry[c.code] && registry[c.code].nav !== false && registry[c.code].routes?.length)
      .map((c) => ({ node: c, entry: registry[c.code] }));
    // Un módulo sin pantalla ni secciones no genera enlace.
    if (!entry.routes?.length && children.length === 0) continue;
    items.push({ node, entry, children });
  }
  return items;
}

/** Destino al entrar a /tenant o /admin: primer ítem navegable. */
export function firstNavPath(nav: AccessModule[], registry: Registry = moduleRegistry): string | null {
  const first = buildNavItems(nav, registry)[0];
  if (!first) return null;
  return first.children.length > 0 && !first.entry.routes?.length ? first.children[0].node.route : first.node.route;
}

/** ¿Está activo el grupo del menú para esta URL? */
export function isGroupActive(item: NavItem, pathname: string): boolean {
  const prefixes = item.entry.activePrefixes ?? [item.node.route];
  const excluded = item.entry.excludePrefixes ?? [];
  return prefixes.some((p) => pathname.startsWith(p)) && !excluded.some((p) => pathname.startsWith(p));
}

/**
 * Título del header: nombre del módulo/sección activo (el prefijo de URL más largo gana).
 * Devuelve null si ninguno coincide.
 */
export function titleForPath(
  nav: AccessModule[],
  pathname: string,
  registry: Registry = moduleRegistry,
): string | null {
  let best: { len: number; title: string } | null = null;
  for (const { node, entry } of registeredModules(nav, registry)) {
    const prefixes = [node.route, ...(entry.titlePrefixes ?? [])].filter((p) => p && !p.includes(':') && !p.includes('#'));
    for (const prefix of prefixes) {
      if (pathname.startsWith(prefix) && (!best || prefix.length > best.len)) {
        best = { len: prefix.length, title: node.name };
      }
    }
  }
  return best?.title ?? null;
}
