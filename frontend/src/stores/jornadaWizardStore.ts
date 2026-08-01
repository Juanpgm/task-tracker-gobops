/**
 * Store del wizard de Jornadas Integrales: mantiene la jornada activa
 * (client_id + detalle cargado del servidor) y expone una función explícita
 * por acción (crear compromiso, agregar seguimiento, guardar verificación,
 * etc.) — cada una persiste de inmediato con su propia llamada a la API,
 * nunca un submit monolítico al final del wizard.
 *
 * También mantiene el listado de jornadas (para ListaJornadas.svelte) con el
 * mismo patrón stale-while-revalidate + concurrency fence que avanzadasStore
 * y estadisticasStore.
 */
import { writable, derived, get } from 'svelte/store';
import {
  crearJornada as crearJornadaAPI,
  actualizarJornada as actualizarJornadaAPI,
  subirCroquisJornada as subirCroquisJornadaAPI,
  crearCompromiso as crearCompromisoAPI,
  actualizarCompromiso as actualizarCompromisoAPI,
  eliminarCompromiso as eliminarCompromisoAPI,
  crearSeguimiento as crearSeguimientoAPI,
  guardarVerificacion as guardarVerificacionAPI,
  crearEncuesta as crearEncuestaAPI,
  eliminarEncuesta as eliminarEncuestaAPI,
  crearRequerimientosJornada as crearRequerimientosJornadaAPI,
  listarJornadas,
  getJornada,
  isConflictError,
  type JornadaDetalle,
  type CrearJornadaDatos,
  type ActualizarJornadaDatos,
  type CrearCompromisoDatos,
  type ActualizarCompromisoDatos,
  type Compromiso,
  type CrearSeguimientoDatos,
  type GuardarVerificacionDatos,
  type CrearEncuestaDatos,
  type RequerimientoJornadaInput,
  type JornadaListaItem,
} from '../api/jornadas';
import { toUserMessage } from '../lib/auth-error-messages';

export const JORNADAS_LISTA_TTL_MS = 30_000;

interface JornadaWizardState {
  current: JornadaDetalle | null;
  loadingCurrent: boolean;
  errorCurrent: string | null;

  lista: JornadaListaItem[];
  listaLoading: boolean;
  listaError: string | null;
  listaRevalidating: boolean;
  listaRevalidateError: string | null;
  listaFetchedAt: number | null;
}

const initialState: JornadaWizardState = {
  current: null,
  loadingCurrent: false,
  errorCurrent: null,

  lista: [],
  listaLoading: false,
  listaError: null,
  listaRevalidating: false,
  listaRevalidateError: null,
  listaFetchedAt: null,
};

/** Genera un UUID v4 con el prefijo pedido por el backend (jor_, com_, seg_, enc_). */
function generateClientId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return `${prefix}${uuid}`;
}

/** Completa arrays ausentes en una respuesta recién creada por el backend. */
function normalizeJornada(raw: JornadaDetalle): JornadaDetalle {
  return {
    ...raw,
    direcciones_recuperadas: raw.direcciones_recuperadas || [],
    peticiones_comunidad: raw.peticiones_comunidad || [],
    compromisos: raw.compromisos || [],
    encuestas: raw.encuestas || [],
    requerimientos: raw.requerimientos || [],
  };
}

function upsertLista(lista: JornadaListaItem[], item: JornadaListaItem): JornadaListaItem[] {
  const idx = lista.findIndex((j) => j.client_id === item.client_id);
  if (idx === -1) return [item, ...lista];
  const copy = [...lista];
  copy[idx] = { ...copy[idx], ...item };
  return copy;
}

function jornadaDetalleToListaItem(j: JornadaDetalle): JornadaListaItem {
  return {
    client_id: j.client_id,
    nombre_jornada: j.nombre_jornada,
    fecha: j.fecha,
    comuna: j.comuna,
    barrio: j.barrio,
    estado: j.estado,
    asistencia_aproximada: j.asistencia_aproximada ?? 0,
    compromisos_count: j.compromisos?.length ?? 0,
  };
}

function createJornadaWizardStore() {
  const store = writable<JornadaWizardState>(initialState);
  const { subscribe, update } = store;

  /** Concurrency fence for cargarJornada(): discards a response superseded
   *  by a later call for the same or a different jornada (same idea as
   *  avanzadasStore's detalleRequestTokens, but the wizard only ever shows
   *  one jornada at a time so a single counter is enough). */
  let currentRequestToken = 0;

  /** Same fence, for loadLista(). */
  let listaRequestToken = 0;

  return {
    subscribe,

    /** Limpia la jornada activa (al salir del wizard / empezar una nueva). */
    reset: () => {
      update((s) => ({ ...s, current: null, loadingCurrent: false, errorCurrent: null }));
    },

    /**
     * Crea (o recupera, si ya existía — POST /jornadas es idempotente por
     * client_id) la jornada y la deja como activa. Devuelve el client_id
     * generado para que el llamador pueda seguir usándolo (p.ej. navegar con
     * ?client_id= para poder resumir la jornada después).
     */
    iniciarJornada: async (
      datosSinId: Omit<CrearJornadaDatos, 'client_id'>
    ): Promise<{ client_id: string }> => {
      const client_id = generateClientId('jor_');
      update((s) => ({ ...s, loadingCurrent: true, errorCurrent: null }));
      try {
        const raw = await crearJornadaAPI({ ...datosSinId, client_id });
        const jornada = normalizeJornada(raw);
        update((s) => ({
          ...s,
          current: jornada,
          loadingCurrent: false,
          lista: upsertLista(s.lista, jornadaDetalleToListaItem(jornada)),
        }));
        return { client_id: jornada.client_id };
      } catch (err) {
        const msg = toUserMessage(err);
        update((s) => ({ ...s, loadingCurrent: false, errorCurrent: msg }));
        throw err;
      }
    },

    /** Carga (o recarga) el detalle completo de una jornada existente, para resumirla en el wizard. */
    cargarJornada: async (clientId: string): Promise<void> => {
      const token = ++currentRequestToken;
      update((s) => ({ ...s, loadingCurrent: true, errorCurrent: null }));
      try {
        const raw = await getJornada(clientId);
        if (token !== currentRequestToken) return; // superseded — discard
        update((s) => ({ ...s, current: normalizeJornada(raw), loadingCurrent: false }));
      } catch (err) {
        if (token !== currentRequestToken) return; // superseded — discard
        const msg = toUserMessage(err);
        update((s) => ({ ...s, loadingCurrent: false, errorCurrent: msg }));
      }
    },

    /** Guarda cambios parciales a los datos generales de la jornada (Fase 1). */
    guardarPlanificacion: async (datos: ActualizarJornadaDatos): Promise<void> => {
      const current = get(store).current;
      if (!current) throw new Error('No hay jornada activa.');
      const raw = await actualizarJornadaAPI(current.client_id, datos);
      update((s) => {
        if (!s.current) return s;
        const merged = normalizeJornada({ ...s.current, ...raw });
        return { ...s, current: merged, lista: upsertLista(s.lista, jornadaDetalleToListaItem(merged)) };
      });
    },

    /** Sube/reemplaza el croquis de distribución (foto -> S3 -> url_croquis). */
    subirCroquis: async (file: File): Promise<void> => {
      const current = get(store).current;
      if (!current) throw new Error('No hay jornada activa.');
      const { url_croquis } = await subirCroquisJornadaAPI(current.client_id, file);
      update((s) => (s.current ? { ...s, current: { ...s.current, url_croquis } } : s));
    },

    /** Agrega un compromiso (una oferta/servicio de un organismo) a la jornada. */
    agregarCompromiso: async (
      datos: Omit<CrearCompromisoDatos, 'client_id'>
    ): Promise<Compromiso> => {
      const current = get(store).current;
      if (!current) throw new Error('No hay jornada activa.');
      const client_id = generateClientId('com_');
      // Regla dura del backend: meta_cuantitativa sólo viaja si tipo es
      // cuantitativo — enviarla en un compromiso cualitativo devuelve 422.
      const payload: CrearCompromisoDatos = { ...datos, client_id };
      if (payload.tipo !== 'cuantitativo') delete payload.meta_cuantitativa;
      const compromiso = await crearCompromisoAPI(current.client_id, payload);
      update((s) =>
        s.current ? { ...s, current: { ...s.current, compromisos: [...s.current.compromisos, compromiso] } } : s
      );
      return compromiso;
    },

    /** Edita un compromiso existente. */
    actualizarCompromiso: async (clientId: string, datos: ActualizarCompromisoDatos): Promise<void> => {
      const payload = { ...datos };
      if (payload.tipo && payload.tipo !== 'cuantitativo') delete payload.meta_cuantitativa;
      const actualizado = await actualizarCompromisoAPI(clientId, payload);
      update((s) =>
        s.current
          ? {
              ...s,
              current: {
                ...s.current,
                compromisos: s.current.compromisos.map((c) => (c.client_id === clientId ? { ...c, ...actualizado } : c)),
              },
            }
          : s
      );
    },

    /**
     * Elimina un compromiso. El backend responde 409 (y NO borra) cuando el
     * compromiso ya tiene seguimientos registrados — en ese caso este
     * método relanza un error con mensaje claro para la UI y deja el estado
     * intacto (el compromiso sigue en la lista, tal como sigue en el server).
     */
    eliminarCompromiso: async (clientId: string): Promise<void> => {
      try {
        await eliminarCompromisoAPI(clientId);
      } catch (err) {
        if (isConflictError(err)) {
          throw new Error('No se puede eliminar un compromiso con seguimientos registrados.');
        }
        throw err;
      }
      update((s) =>
        s.current
          ? { ...s, current: { ...s.current, compromisos: s.current.compromisos.filter((c) => c.client_id !== clientId) } }
          : s
      );
    },

    /**
     * Registra un seguimiento para un compromiso. Si la jornada seguía en
     * 'planificacion', la hace avanzar a 'seguimiento' (falla en silencio —
     * no bloquea el registro del seguimiento si ese PATCH secundario falla).
     */
    agregarSeguimiento: async (
      compromisoClientId: string,
      datos: Omit<CrearSeguimientoDatos, 'client_id'>
    ): Promise<void> => {
      const current = get(store).current;
      if (!current) throw new Error('No hay jornada activa.');
      const client_id = generateClientId('seg_');
      const seguimiento = await crearSeguimientoAPI(compromisoClientId, { ...datos, client_id });

      update((s) =>
        s.current
          ? {
              ...s,
              current: {
                ...s.current,
                compromisos: s.current.compromisos.map((c) =>
                  c.client_id === compromisoClientId
                    ? { ...c, seguimientos: [...(c.seguimientos || []), seguimiento], estado_seguimiento: seguimiento.estado }
                    : c
                ),
              },
            }
          : s
      );

      if (current.estado === 'planificacion') {
        try {
          await actualizarJornadaAPI(current.client_id, { estado: 'seguimiento' });
          update((s) => (s.current ? { ...s, current: { ...s.current, estado: 'seguimiento' } } : s));
        } catch (err) {
          console.warn('jornadaWizardStore.agregarSeguimiento: auto-avance a "seguimiento" falló:', err);
        }
      }
    },

    /** Avanza explícitamente la jornada a 'ejecucion' al pasar a la fase de Verificación. */
    avanzarAVerificacion: async (): Promise<void> => {
      const current = get(store).current;
      if (!current) return;
      if (current.estado !== 'planificacion' && current.estado !== 'seguimiento') return;
      await actualizarJornadaAPI(current.client_id, { estado: 'ejecucion' });
      update((s) => (s.current ? { ...s, current: { ...s.current, estado: 'ejecucion' } } : s));
    },

    /** Guarda (o edita) la verificación de campo de un compromiso, con sus fotos. */
    guardarVerificacion: async (
      compromisoClientId: string,
      datos: GuardarVerificacionDatos,
      fotos: File[] = []
    ): Promise<void> => {
      const payload = { ...datos };
      const current = get(store).current;
      const compromiso = current?.compromisos.find((c) => c.client_id === compromisoClientId);
      if (compromiso && compromiso.tipo !== 'cuantitativo') payload.resultado_obtenido = null;
      const actualizado = await guardarVerificacionAPI(compromisoClientId, payload, fotos);
      update((s) =>
        s.current
          ? {
              ...s,
              current: {
                ...s.current,
                compromisos: s.current.compromisos.map((c) => (c.client_id === compromisoClientId ? { ...c, ...actualizado } : c)),
              },
            }
          : s
      );
    },

    /** Guarda los datos de cierre de la jornada (asistencia, observaciones, peticiones). */
    guardarCierre: async (datos: {
      asistencia_aproximada?: number;
      observaciones_generales?: string;
      peticiones_comunidad?: string[];
    }): Promise<void> => {
      const current = get(store).current;
      if (!current) throw new Error('No hay jornada activa.');
      const raw = await actualizarJornadaAPI(current.client_id, datos);
      update((s) => (s.current ? { ...s, current: { ...s.current, ...raw } } : s));
    },

    /** Agrega una encuesta de experiencia ciudadana. */
    agregarEncuesta: async (datos: Omit<CrearEncuestaDatos, 'client_id'>): Promise<void> => {
      const current = get(store).current;
      if (!current) throw new Error('No hay jornada activa.');
      const client_id = generateClientId('enc_');
      const encuesta = await crearEncuestaAPI(current.client_id, { ...datos, client_id });
      update((s) => (s.current ? { ...s, current: { ...s.current, encuestas: [...s.current.encuestas, encuesta] } } : s));
    },

    /** Elimina una encuesta. */
    eliminarEncuesta: async (clientId: string): Promise<void> => {
      await eliminarEncuestaAPI(clientId);
      update((s) =>
        s.current ? { ...s, current: { ...s.current, encuestas: s.current.encuestas.filter((e) => e.client_id !== clientId) } } : s
      );
    },

    /** Registra uno o más requerimientos levantados durante la jornada (colección compartida). */
    agregarRequerimientos: async (
      requerimientos: RequerimientoJornadaInput[],
      fotosPorRequerimiento: File[][] = []
    ): Promise<void> => {
      const current = get(store).current;
      if (!current) throw new Error('No hay jornada activa.');
      const creados = await crearRequerimientosJornadaAPI(current.client_id, requerimientos, fotosPorRequerimiento);
      update((s) => (s.current ? { ...s, current: { ...s.current, requerimientos: [...s.current.requerimientos, ...creados] } } : s));
    },

    /** Marca la jornada como completada. Sólo debe llamarse cuando el gate de Finalizar está habilitado. */
    finalizarJornada: async (): Promise<void> => {
      const current = get(store).current;
      if (!current) throw new Error('No hay jornada activa.');
      await actualizarJornadaAPI(current.client_id, { estado: 'completada' });
      update((s) => (s.current ? { ...s, current: { ...s.current, estado: 'completada' } } : s));
    },

    /**
     * Carga el listado de jornadas (GET /jornadas?limit=100), stale-while-revalidate:
     * primera carga bloquea (listaLoading), recargas con datos frescos se sirven
     * tal cual, recargas con datos viejos revalidan en segundo plano sin parpadeo.
     */
    loadLista: async (opts: { force?: boolean } = {}) => {
      const current = get(store);
      const hasLoadedOnce = current.listaFetchedAt !== null;
      const isFresh = hasLoadedOnce && Date.now() - current.listaFetchedAt! < JORNADAS_LISTA_TTL_MS;
      if (isFresh && !opts.force) return;

      const token = ++listaRequestToken;
      if (hasLoadedOnce) {
        update((s) => ({ ...s, listaRevalidating: true, listaRevalidateError: null }));
      } else {
        update((s) => ({ ...s, listaLoading: true, listaError: null }));
      }

      try {
        const data = await listarJornadas();
        if (token !== listaRequestToken) return; // superseded — discard
        update((s) => ({
          ...s,
          lista: data,
          listaLoading: false,
          listaRevalidating: false,
          listaError: null,
          listaRevalidateError: null,
          listaFetchedAt: Date.now(),
        }));
      } catch (err) {
        if (token !== listaRequestToken) return; // superseded — discard
        const msg = toUserMessage(err);
        update((s) => {
          if (s.lista.length > 0) {
            return { ...s, listaLoading: false, listaRevalidating: false, listaRevalidateError: msg };
          }
          return { ...s, listaLoading: false, listaRevalidating: false, listaError: msg };
        });
      }
    },

    clearErrorCurrent: () => update((s) => ({ ...s, errorCurrent: null })),
    clearListaError: () => update((s) => ({ ...s, listaError: null })),
  };
}

export const jornadaWizardStore = createJornadaWizardStore();

/* ============================================================
 *  DERIVED STORES
 * ============================================================ */

/** Compromisos que siguen vivos para Verificación: estado_seguimiento en {ok, novedad}. Los 'cancelado' quedan fuera pero no se borran. */
export const compromisosPendientesVerificacion = derived(jornadaWizardStore, ($s) =>
  ($s.current?.compromisos || []).filter((c) => c.estado_seguimiento === 'ok' || c.estado_seguimiento === 'novedad')
);

/** Organismos únicos presentes en la jornada (excluye compromisos cancelados), para las encuestas de experiencia. */
export const organismosParaEncuesta = derived(jornadaWizardStore, ($s) => {
  const nombres = ($s.current?.compromisos || [])
    .filter((c) => c.estado_seguimiento !== 'cancelado')
    .map((c) => (c.organismo || '').split(' - ')[0].trim())
    .filter(Boolean);
  return Array.from(new Set(nombres));
});

/**
 * Gate de Finalizar: habilitado exactamente cuando la jornada tiene al menos
 * un compromiso, un seguimiento, una verificación y una encuesta.
 */
export const finalizarHabilitado = derived(jornadaWizardStore, ($s) => {
  const j = $s.current;
  if (!j) return false;
  const tieneCompromisos = j.compromisos.length > 0;
  const tieneSeguimientos = j.compromisos.some((c) => (c.seguimientos?.length ?? 0) > 0);
  const tieneVerificaciones = j.compromisos.some((c) => !!c.verificacion);
  const tieneEncuestas = j.encuestas.length > 0;
  return tieneCompromisos && tieneSeguimientos && tieneVerificaciones && tieneEncuestas;
});
