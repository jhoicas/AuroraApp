import { useEffect, useState } from 'react';
import { fetchDnpDictionary, type DnpDictionary } from './dnpDictionaryApi';

const EMPTY: DnpDictionary = { strong_verbs: [], weak_verbs: [], units: [] };

// Caché a nivel de módulo: el diccionario cambia poco y lo comparten varias pestañas MGA.
let cache: DnpDictionary | null = null;
let inflight: Promise<DnpDictionary> | null = null;

function load(): Promise<DnpDictionary> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetchDnpDictionary()
      .then((d) => {
        cache = {
          strong_verbs: d.strong_verbs ?? [],
          weak_verbs: d.weak_verbs ?? [],
          units: d.units ?? [],
        };
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Diccionario DNP dinámico (verbos fuertes/débiles y unidades estándar) desde la BD. */
export function useDnpDictionary(): DnpDictionary {
  const [dict, setDict] = useState<DnpDictionary>(cache ?? EMPTY);

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => {
        if (alive) setDict(d);
      })
      .catch(() => {
        /* sin diccionario: las reglas IA se aplican desde el backend */
      });
    return () => {
      alive = false;
    };
  }, []);

  return dict;
}

/** Solo para pruebas: limpia la caché del diccionario. */
export function resetDnpDictionaryCache(): void {
  cache = null;
  inflight = null;
}
