/**
 * Store del módulo Avanzadas: captura simple offline-first de avanzadas de
 * estrategia (una sola pantalla, reemplaza el flujo pesado de Visitas
 * Programadas → Registrar Requerimientos).
 *
 * Contrato offline-first de crearAvanzada():
 *   1. Se genera un client_id (UUID) en el cliente.
 *   2. La operación se encola en IndexedDB SIEMPRE, antes de intentar la red.
 *   3. Si hay conexión, se intenta el POST inmediatamente:
 *      - éxito → se saca de la cola y se limpia el flag isOffline.
 *      - falla → queda en cola para sincronizar más tarde.
 *   4. Si no hay conexión, no se intenta la red: queda en cola.
 *   5. syncOfflineQueue() reproduce la cola cuando vuelve la conexión.
 */
import { writable, get } from 'svelte/store';
import type { AsistenteAvanzada, Avanzada, CatalogosAvanzadas, RequerimientoAvanzada } from '../types/avanzadas';
import {
  getCatalogosAvanzadas,
  crearAvanzada as crearAvanzadaAPI,
  actualizarAvanzada as actualizarAvanzadaAPI,
  agregarRequerimientoAvanzada as agregarRequerimientoAvanzadaAPI,
  listarAvanzadas,
  getAvanzada as getAvanzadaAPI,
  type CrearAvanzadaDatos,
  type CrearAvanzadaFiles,
  type ActualizarAvanzadaDatos,
  type ActualizarAvanzadaFiles,
  type RequerimientoAvanzadaDatos,
  type ListarAvanzadasItem,
} from '../api/avanzadas';
import { CATALOGO_AVANZADAS_FALLBACK, mergeCatalogos } from '../data/avanzadas-catalogo';
import { enqueueOperation, getQueue, dequeueOperation, updateOperationError } from '../lib/offlineQueue';
import { offlineStore } from './offlineStore';

/** Payload persistido en la cola offline para una avanzada pendiente de sincronizar. */
interface AvanzadaQueuePayload {
  datos: CrearAvanzadaDatos;
  files: CrearAvanzadaFiles;
}

/**
 * TTLs para el patrón stale-while-revalidate de loadAvanzadas/loadCatalogos:
 * si los datos en memoria son más jóvenes que esto, se sirven tal cual sin
 * tocar la red. Avanzadas usa una ventana corta porque el listado cambia
 * seguido en campo; catálogos usa una ventana más larga porque son datos
 * casi estáticos y el backend re-streamea la colección completa en cada llamada.
 */
export const AVANZADAS_TTL_MS = 30_000;
export const CATALOGOS_TTL_MS = 5 * 60_000;

interface AvanzadasState {
  catalogos: CatalogosAvanzadas;
  catalogosLoaded: boolean;
  catalogosError: string | null;
  /** Timestamp (Date.now()) del último loadCatalogos() resuelto (éxito o fallback). */
  catalogosFetchedAt: number | null;
  avanzadas: ListarAvanzadasItem[];
  /** true SOLO durante la primera carga (sin datos previos en memoria). */
  loading: boolean;
  /** Error bloqueante: sólo se setea cuando la primera carga falla y no hay datos que mostrar. */
  error: string | null;
  /** true mientras se revalida en segundo plano datos ya visibles (stale-while-revalidate). */
  revalidating: boolean;
  /** Error no destructivo de una revalidación en segundo plano: los datos viejos se conservan. */
  revalidateError: string | null;
  /** Timestamp (Date.now()) de la última carga de avanzadas resuelta con éxito. */
  lastFetchedAt: number | null;
  /** Keyed cache of avanzada detail state, one entry per client_id. */
  detalle: Record<string, Avanzada>;
  detalleLoading: Record<string, boolean>;
  detalleError: Record<string, string | null>;
}

const initialState: AvanzadasState = {
  catalogos: CATALOGO_AVANZADAS_FALLBACK,
  catalogosLoaded: false,
  catalogosError: null,
  catalogosFetchedAt: null,
  avanzadas: [],
  loading: false,
  error: null,
  revalidating: false,
  revalidateError: null,
  lastFetchedAt: null,
  detalle: {},
  detalleLoading: {},
  detalleError: {},
};

/** Genera un UUID v4. Usa crypto.randomUUID cuando está disponible. */
function generateClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122-ish para entornos sin crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Descarta filas de asistentes sin nombre (regla del formulario: nombre es requerido por fila). */
function limpiarAsistentes(asistentes: AsistenteAvanzada[]): AsistenteAvanzada[] {
  return (asistentes || []).filter((a) => a.nombre && a.nombre.trim());
}

/**
 * Same nombre-required rule as limpiarAsistentes(), but keeps a parallel
 * fotos array (index-aligned with datos.asistentes per the backend
 * contract) in sync: when a row without nombre is dropped, its
 * corresponding foto entry is dropped too, so foto_asistente_{i} never
 * ends up misaligned with the asistente it was meant for.
 */
function limpiarAsistentesConFotos(
  asistentes: AsistenteAvanzada[],
  fotos: (File | null)[] = []
): { asistentes: AsistenteAvanzada[]; fotos: (File | null)[] } {
  const asistentesLimpios: AsistenteAvanzada[] = [];
  const fotosAlineadas: (File | null)[] = [];
  (asistentes || []).forEach((a, i) => {
    if (a.nombre && a.nombre.trim()) {
      asistentesLimpios.push(a);
      fotosAlineadas.push(fotos[i] ?? null);
    }
  });
  return { asistentes: asistentesLimpios, fotos: fotosAlineadas };
}

function createAvanzadasStore() {
  const store = writable<AvanzadasState>(initialState);
  const { subscribe, update } = store;

  /**
   * Concurrency fence for loadAvanzadas(): a monotonically increasing
   * request token. Every call captures the token issued when IT started;
   * when its request resolves, the result is only committed if that token
   * is still the latest one issued. This prevents a slow background
   * revalidate from overwriting a fresher response from a later call (e.g.
   * the "Reintentar" force:true button) — the classic SWR race where
   * whichever request happens to resolve LAST wins regardless of which one
   * actually started last / carries fresher data.
   */
  let avanzadasRequestToken = 0;

  /** Same fence as avanzadasRequestToken, but keyed per client_id for loadAvanzadaDetalle(). */
  const detalleRequestTokens: Record<string, number> = {};

  return {
    subscribe,

    /**
     * Carga catálogos desde la API y los combina con el respaldo local; si falla, usa sólo el respaldo.
     * TTL guard: si ya se cargaron y siguen frescos (< CATALOGOS_TTL_MS), no vuelve a pegarle a la red
     * — el backend re-streamea la colección completa en cada llamada. Usar { force: true } para forzar.
     */
    loadCatalogos: async (opts: { force?: boolean } = {}) => {
      const current = get(store);
      const isFresh =
        current.catalogosLoaded &&
        current.catalogosFetchedAt !== null &&
        Date.now() - current.catalogosFetchedAt < CATALOGOS_TTL_MS;
      if (isFresh && !opts.force) return;

      try {
        const remote = await getCatalogosAvanzadas();
        update((s) => ({
          ...s,
          catalogos: mergeCatalogos(remote, CATALOGO_AVANZADAS_FALLBACK),
          catalogosLoaded: true,
          catalogosError: null,
          catalogosFetchedAt: Date.now(),
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar catálogos';
        console.warn('avanzadasStore.loadCatalogos failed, using offline fallback:', err);
        update((s) => ({
          ...s,
          catalogos: CATALOGO_AVANZADAS_FALLBACK,
          catalogosLoaded: true,
          catalogosError: msg,
          catalogosFetchedAt: Date.now(),
        }));
      }
    },

    /**
     * Carga el listado de avanzadas desde GET /avanzadas y reincorpora las
     * avanzadas creadas offline que aún no se sincronizaron (encoladas en
     * IndexedDB), para que no desaparezcan de la lista al recargarla.
     *
     * Stale-while-revalidate:
     *   - Sin datos previos (primera carga): loading=true, bloquea hasta resolver.
     *   - Con datos frescos (< AVANZADAS_TTL_MS): no toca la red, retorna al toque.
     *   - Con datos viejos (>= AVANZADAS_TTL_MS): NO setea loading, revalida en
     *     segundo plano (revalidating=true) mostrando lo que ya había.
     *       · éxito → reemplaza avanzadas y limpia revalidateError.
     *       · falla → conserva los datos viejos y setea revalidateError (no
     *         destructivo); NO toca el error bloqueante.
     * Usar { force: true } para forzar el refetch aunque los datos estén frescos.
     */
    loadAvanzadas: async (opts: { force?: boolean } = {}) => {
      const current = get(store);
      const hasLoadedOnce = current.lastFetchedAt !== null;
      const isFresh = hasLoadedOnce && Date.now() - current.lastFetchedAt! < AVANZADAS_TTL_MS;

      if (isFresh && !opts.force) return;

      // Capture the token for THIS call before awaiting anything: if another
      // (later) loadAvanzadas() call starts before this one resolves, it
      // bumps avanzadasRequestToken and this call's result becomes stale.
      const token = ++avanzadasRequestToken;

      if (hasLoadedOnce) {
        update((s) => ({ ...s, revalidating: true, revalidateError: null }));
      } else {
        update((s) => ({ ...s, loading: true, error: null }));
      }

      try {
        const data = await listarAvanzadas();
        const queue = await getQueue();
        if (token !== avanzadasRequestToken) return; // superseded by a newer request — discard
        const serverIds = new Set(data.map((a) => a.client_id));
        const pendientes: ListarAvanzadasItem[] = queue
          .filter((item) => item.type === 'avanzada' && !serverIds.has(item.reqId))
          .map((item) => {
            const payload = item.payload as AvanzadaQueuePayload;
            return {
              ...payload.datos,
              requerimientos_count: payload.datos.requerimientos.length,
              isOffline: true,
            };
          });
        update((s) => ({
          ...s,
          avanzadas: [...pendientes, ...data],
          loading: false,
          revalidating: false,
          error: null,
          revalidateError: null,
          lastFetchedAt: Date.now(),
        }));
      } catch (err) {
        if (token !== avanzadasRequestToken) return; // superseded — don't clobber fresher state with a stale error
        const msg = err instanceof Error ? err.message : 'Error al cargar avanzadas';
        update((s) => {
          if (s.avanzadas.length > 0) {
            // Ya había datos en pantalla (stale-while-revalidate): no los pisamos
            // con una pantalla de error, sólo avisamos de forma no destructiva.
            return { ...s, loading: false, revalidating: false, revalidateError: msg };
          }
          return { ...s, loading: false, revalidating: false, error: msg };
        });
      }
    },

    /**
     * Crea una avanzada con comportamiento offline-first: encola SIEMPRE
     * antes de intentar la red; en éxito desencola, en falla/offline deja
     * el registro en cola para sincronizar después.
     */
    crearAvanzada: async (
      datosSinId: Omit<CrearAvanzadaDatos, 'client_id'>,
      files: CrearAvanzadaFiles = {}
    ): Promise<{ isOffline: boolean; client_id: string }> => {
      const client_id = generateClientId();
      const datos: CrearAvanzadaDatos = {
        ...datosSinId,
        asistentes: limpiarAsistentes(datosSinId.asistentes),
        client_id,
      };

      const queuePayload: AvanzadaQueuePayload = { datos, files };
      const queueItem = await enqueueOperation('avanzada', client_id, queuePayload);
      await offlineStore.refreshPendingCount();

      const localItem: ListarAvanzadasItem = {
        ...datos,
        requerimientos_count: datos.requerimientos.length,
        isOffline: true,
      };
      update((s) => ({ ...s, avanzadas: [localItem, ...s.avanzadas] }));

      const isOnline = typeof navigator === 'undefined' || navigator.onLine;
      if (!isOnline) {
        return { isOffline: true, client_id };
      }

      try {
        await crearAvanzadaAPI(datos, files);
        if (queueItem) await dequeueOperation(queueItem.id);
        await offlineStore.refreshPendingCount();
        update((s) => ({
          ...s,
          avanzadas: s.avanzadas.map((a) => (a.client_id === client_id ? { ...a, isOffline: false } : a)),
        }));
        return { isOffline: false, client_id };
      } catch (err) {
        console.warn('avanzadasStore.crearAvanzada: POST failed, item stays queued:', err);
        return { isOffline: true, client_id };
      }
    },

    /**
     * Carga el detalle de una avanzada (GET /avanzadas/{client_id}), con
     * caché por client_id. Si la avanzada fue creada offline y aún no se
     * sincronizó, el backend responde 404 (no existe el documento todavía);
     * en ese caso se reincorpora desde el payload encolado en IndexedDB en
     * vez de mostrar un error.
     *
     * { silent: true } is for background refresh/polling (e.g. DetalleAvanzada
     * checking for requerimientos added by other users): it does NOT flip
     * detalleLoading, so it never triggers the full skeleton, and a failure
     * is logged + swallowed instead of replacing already-visible content
     * with a blocking error state (same non-destructive spirit as
     * loadAvanzadas' revalidateError, just without a dedicated error field
     * since detail view has nowhere non-destructive to show it yet).
     *
     * The per-clientId token fence is shared between silent and non-silent
     * calls, so an in-flight silent refresh can't clobber a fresher explicit
     * load (or vice versa) — whichever call started LAST wins.
     */
    loadAvanzadaDetalle: async (clientId: string, opts: { silent?: boolean } = {}): Promise<void> => {
      const silent = !!opts.silent;

      // Per-clientId fence: capture the token for THIS call before awaiting
      // anything. If loadAvanzadaDetalle(clientId) is called again for the
      // SAME id before this call resolves (e.g. a second Reintentar tap, or
      // a silent poll firing mid-explicit-load), the later call bumps the
      // token and this call's eventual result is discarded, whichever order
      // the two network responses land in.
      const token = (detalleRequestTokens[clientId] = (detalleRequestTokens[clientId] ?? 0) + 1);

      if (!silent) {
        update((s) => ({
          ...s,
          detalleLoading: { ...s.detalleLoading, [clientId]: true },
          detalleError: { ...s.detalleError, [clientId]: null },
        }));
      }

      try {
        const data = await getAvanzadaAPI(clientId);
        if (detalleRequestTokens[clientId] !== token) return; // superseded — discard
        update((s) => ({
          ...s,
          detalle: { ...s.detalle, [clientId]: data },
          detalleLoading: { ...s.detalleLoading, [clientId]: false },
        }));
      } catch (err) {
        try {
          const queue = await getQueue();
          if (detalleRequestTokens[clientId] !== token) return; // superseded — discard
          const pending = queue.find((item) => item.type === 'avanzada' && item.reqId === clientId);
          if (pending) {
            const payload = pending.payload as AvanzadaQueuePayload;
            const offlineDetalle: Avanzada = {
              ...payload.datos,
              requerimientos_count: payload.datos.requerimientos.length,
              isOffline: true,
            };
            update((s) => ({
              ...s,
              detalle: { ...s.detalle, [clientId]: offlineDetalle },
              detalleLoading: { ...s.detalleLoading, [clientId]: false },
            }));
            return;
          }
        } catch (queueErr) {
          console.warn('avanzadasStore.loadAvanzadaDetalle: queue lookup failed:', queueErr);
        }

        if (detalleRequestTokens[clientId] !== token) return; // superseded — discard

        if (silent) {
          console.warn(`avanzadasStore.loadAvanzadaDetalle (silent) failed for ${clientId}:`, err);
          update((s) => ({ ...s, detalleLoading: { ...s.detalleLoading, [clientId]: false } }));
          return;
        }

        const msg = err instanceof Error ? err.message : 'Error al cargar la avanzada';
        update((s) => ({
          ...s,
          detalleLoading: { ...s.detalleLoading, [clientId]: false },
          detalleError: { ...s.detalleError, [clientId]: msg },
        }));
      }
    },

    clearDetalleError: (clientId: string) => {
      update((s) => ({ ...s, detalleError: { ...s.detalleError, [clientId]: null } }));
    },

    /**
     * Actualiza una avanzada existente (PATCH /avanzadas/{client_id}).
     * Requiere conectividad — a diferencia de crearAvanzada() no hay cola
     * offline aquí: editar un registro ya persistido en el backend no tiene
     * el mismo caso de uso "capturar en campo sin señal" que crear una
     * avanzada nueva. Los errores de red se propagan (no se silencian) para
     * que el formulario los muestre.
     */
    actualizarAvanzada: async (
      clientId: string,
      datosSinId: ActualizarAvanzadaDatos,
      files: ActualizarAvanzadaFiles = {}
    ): Promise<Avanzada> => {
      const { asistentes, fotos } = limpiarAsistentesConFotos(datosSinId.asistentes, files.fotosPorAsistente || []);
      const datos: ActualizarAvanzadaDatos = { ...datosSinId, asistentes };

      const actualizada = await actualizarAvanzadaAPI(clientId, datos, { fotosPorAsistente: fotos });
      update((s) => ({ ...s, detalle: { ...s.detalle, [clientId]: actualizada } }));
      return actualizada;
    },

    /**
     * Agrega un requerimiento a una avanzada ya creada (POST
     * /avanzadas/{client_id}/requerimientos). En éxito, el nuevo
     * requerimiento se inserta directamente en detalle[clientId] (si está
     * cargado) para reflejo inmediato sin esperar un refresh.
     */
    agregarRequerimiento: async (
      clientId: string,
      datos: RequerimientoAvanzadaDatos,
      fotos: File[] = []
    ): Promise<RequerimientoAvanzada> => {
      const nuevo = await agregarRequerimientoAvanzadaAPI(clientId, datos, fotos);
      update((s) => {
        const actual = s.detalle[clientId];
        if (!actual) return s;
        return {
          ...s,
          detalle: {
            ...s.detalle,
            [clientId]: {
              ...actual,
              requerimientos: [...(actual.requerimientos || []), nuevo],
              requerimientos_count: (actual.requerimientos_count ?? actual.requerimientos?.length ?? 0) + 1,
            },
          },
        };
      });
      return nuevo;
    },

    /** Reproduce la cola offline de avanzadas pendientes contra el backend. */
    syncOfflineQueue: async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const queue = await getQueue();
      const pendientes = queue.filter((item) => item.type === 'avanzada');
      if (pendientes.length === 0) return;

      for (const item of pendientes) {
        try {
          const payload = item.payload as AvanzadaQueuePayload;
          await crearAvanzadaAPI(payload.datos, payload.files);
          await dequeueOperation(item.id);
          update((s) => ({
            ...s,
            avanzadas: s.avanzadas.map((a) =>
              a.client_id === item.reqId ? { ...a, isOffline: false } : a
            ),
          }));
        } catch (err) {
          console.error(`avanzadasStore.syncOfflineQueue error on item ${item.id}:`, err);
          await updateOperationError(item.id, err instanceof Error ? err.message : String(err));
          break;
        }
      }

      await offlineStore.refreshPendingCount();
    },

    clearError: () => {
      update((s) => ({ ...s, error: null }));
    },
  };
}

export const avanzadasStore = createAvanzadasStore();
