/**
 * Store de la vista georeferenciada del módulo Avanzadas (GET /avanzadas/geo).
 *
 * Patrón stale-while-revalidate (mismo espíritu que estadisticasStore):
 *   - Sin datos previos (primera carga): loading=true, bloquea hasta resolver.
 *   - Con datos frescos (< GEO_TTL_MS): no toca la red, retorna al toque.
 *   - Con datos viejos (>= GEO_TTL_MS): NO setea loading, revalida en
 *     segundo plano (revalidating=true) MANTENIENDO los datos ya renderizados
 *     (sin parpadeo de skeleton).
 *       · éxito → reemplaza data y limpia revalidateError.
 *       · falla → conserva los datos viejos y setea revalidateError (no
 *         destructivo); NO toca el error bloqueante.
 * Usar { force: true } para forzar el refetch aunque los datos estén frescos.
 */
import { writable, get } from 'svelte/store';
import { getAvanzadasGeo, type AvanzadasGeo } from '../api/avanzadas-geo';
import { toUserMessage } from '../lib/auth-error-messages';

export const GEO_TTL_MS = 60_000;

interface GeoState {
  data: AvanzadasGeo | null;
  /** true SOLO durante la primera carga (sin datos previos en memoria). */
  loading: boolean;
  /** Error bloqueante: sólo se setea cuando la primera carga falla y no hay datos que mostrar. */
  error: string | null;
  /** true mientras se revalida en segundo plano datos ya visibles (stale-while-revalidate). */
  revalidating: boolean;
  /** Error no destructivo de una revalidación en segundo plano: los datos viejos se conservan. */
  revalidateError: string | null;
  /** Timestamp (Date.now()) de la última carga resuelta con éxito. */
  lastFetchedAt: number | null;
}

const initialState: GeoState = {
  data: null,
  loading: false,
  error: null,
  revalidating: false,
  revalidateError: null,
  lastFetchedAt: null,
};

function createGeoStore() {
  const store = writable<GeoState>(initialState);
  const { subscribe, update } = store;

  /**
   * Concurrency fence: un token monotónicamente creciente. Cada llamada
   * captura el token vigente al empezar; si al resolver ya no es el más
   * reciente, el resultado se descarta. Evita que una revalidación lenta
   * pise una respuesta más fresca de una llamada posterior (p.ej. un botón
   * "Actualizar" repetido).
   */
  let requestToken = 0;

  return {
    subscribe,

    load: async (opts: { force?: boolean } = {}) => {
      const current = get(store);
      const hasLoadedOnce = current.lastFetchedAt !== null;
      const isFresh = hasLoadedOnce && Date.now() - current.lastFetchedAt! < GEO_TTL_MS;

      if (isFresh && !opts.force) return;

      const token = ++requestToken;

      if (hasLoadedOnce) {
        update((s) => ({ ...s, revalidating: true, revalidateError: null }));
      } else {
        update((s) => ({ ...s, loading: true, error: null }));
      }

      try {
        const data = await getAvanzadasGeo();
        if (token !== requestToken) return; // superseded by a newer request — discard
        update((s) => ({
          ...s,
          data,
          loading: false,
          revalidating: false,
          error: null,
          revalidateError: null,
          lastFetchedAt: Date.now(),
        }));
      } catch (err) {
        if (token !== requestToken) return; // superseded — don't clobber fresher state
        const msg = toUserMessage(err);
        update((s) => {
          if (s.data !== null) {
            // Ya había datos en pantalla (stale-while-revalidate): no los
            // pisamos con una pantalla de error, sólo avisamos de forma no destructiva.
            return { ...s, loading: false, revalidating: false, revalidateError: msg };
          }
          return { ...s, loading: false, revalidating: false, error: msg };
        });
      }
    },

    clearError: () => {
      update((s) => ({ ...s, error: null }));
    },
  };
}

export const geoStore = createGeoStore();
