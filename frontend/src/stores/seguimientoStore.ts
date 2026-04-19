/**
 * Store de Seguimiento de Requerimientos
 * Gestiona visitas programadas, requerimientos y estado del Kanban
 * Conectado a endpoints reales /seguimiento/* con fallback a datos mock
 */

import { writable, derived } from 'svelte/store';
import type {
  VisitaProgramada,
  Requerimiento,
  EstadoRequerimiento,
  Colaborador,
  Solicitante,
  RegistroAvance,
  Enlace,
} from '../types/seguimiento';
import {
  MOCK_COLABORADORES,
  MOCK_ENLACES,
  generateVisitaId,
  generateRequerimientoId,
} from '../data/mock-seguimiento';
import {
  actualizarEstadoVisitaAPI,
  crearRequerimientoSeguimiento,
  cambiarEstadoRequerimientoAPI,
  obtenerVisitasProgramadas,
  getRequerimientosSeguimiento,
  getColaboradores,
  getEnlaces,
  registrarVisita,
  registrarRequerimiento,
  obtenerRequerimientos,
} from '../api/visitas';
import type { ObtenerVisitasProgramadasItem, ObtenerRequerimientosItem } from '../api/visitas';
import type { RegistrarVisitaPayload, RequerimientoPayload } from '../types';

/* ============================================================
 *  STATE
 * ============================================================ */
interface SeguimientoState {
  visitas: VisitaProgramada[];
  requerimientos: Requerimiento[];
  colaboradores: Colaborador[];
  enlaces: Enlace[];
  loading: boolean;
  error: string | null;
}

const initialState: SeguimientoState = {
  visitas: [],
  requerimientos: [],
  colaboradores: [...MOCK_COLABORADORES],
  enlaces: [...MOCK_ENLACES],
  loading: false,
  error: null,
};

function createSeguimientoStore() {
  const { subscribe, update, set } = writable<SeguimientoState>(initialState);

  return {
    subscribe,

    /* ---- VISITAS ---- */

    /** Carga visitas programadas desde GET /obtener-visitas-programadas/ */
    loadVisitas: async () => {
      update((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await obtenerVisitasProgramadas();
        const mapped: VisitaProgramada[] = data.map((v: ObtenerVisitasProgramadasItem) => {
          // fecha viene dd/mm/yyyy → convertir a yyyy-mm-dd
          const [dd, mm, yyyy] = v.fecha_visita.split('/');
          const fechaISO = `${yyyy}-${mm}-${dd}`;

          // acompanantes puede ser un objeto, un array, o null
          const acompRaw = Array.isArray(v.acompanantes)
            ? v.acompanantes
            : v.acompanantes ? [v.acompanantes] : [];
          const acompList: Record<string, string>[] = acompRaw.filter(Boolean);

          const colaboradores: Colaborador[] = acompList.map((a, i) => ({
            id: `${v.vid}-acomp-${i}`,
            nombre: a.nombre_completo || '',
            email: a.email || '',
            telefono: a.telefono || '',
            cargo: '',
            centro_gestor: a.centro_gestor || '',
          }));

          return {
            id: v.vid,
            upid: '',
            direccion_manual: v.direccion_visita || undefined,
            barrio_vereda: v.barrio_vereda || undefined,
            comuna_corregimiento: v.comuna_corregimiento || undefined,
            latitud: v.coords?.coordinates?.[1] != null ? String(v.coords.coordinates[1]) : undefined,
            longitud: v.coords?.coordinates?.[0] != null ? String(v.coords.coordinates[0]) : undefined,
            geocoding_source: v.geocodificacion_fuente ? 'geocoded' as const : undefined,
            fecha_visita: fechaISO,
            hora_inicio: v.hora_visita || undefined,
            hora_fin: undefined,
            estado: 'programada' as const,
            colaboradores,
            observaciones: v.observaciones_visita || undefined,
            descripcion_visita: v.descripcion_visita,
            created_at: v.created_at,
            updated_at: v.timestamp || v.created_at,
          };
        });
        update((s) => ({ ...s, visitas: mapped, loading: false }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar visitas';
        console.error('loadVisitas failed:', err);
        update((s) => ({ ...s, loading: false, error: msg }));
      }
    },

    /** Carga requerimientos desde GET /obtener-requerimientos */
    loadRequerimientos: async () => {
      update((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await obtenerRequerimientos();
        const mapped: Requerimiento[] = data.map((item: ObtenerRequerimientosItem) => {
          const persona = item.datos_solicitante?.personas?.[0];
          const solicitante: Solicitante = {
            id: item.id,
            nombre_completo: persona?.nombre || 'Sin nombre',
            cedula: '',
            telefono: persona?.telefono || '',
            email: persona?.email || '',
            direccion: `${item.barrio_vereda}, ${item.comuna_corregimiento}`,
            barrio_vereda: item.barrio_vereda || '',
            comuna_corregimiento: item.comuna_corregimiento || '',
          };

          // Mapear estado de la API al tipo local
          const estadoMap: Record<string, EstadoRequerimiento> = {
            'pendiente': 'nuevo',
            'nuevo': 'nuevo',
            'radicado': 'radicado',
            'en-gestion': 'en-gestion',
            'asignado': 'asignado',
            'en-proceso': 'en-proceso',
            'resuelto': 'resuelto',
            'cerrado': 'cerrado',
            'cancelado': 'cancelado',
          };
          const estadoNorm = (item.estado || 'Pendiente').toLowerCase().trim();
          const estado: EstadoRequerimiento = estadoMap[estadoNorm] || 'nuevo';

          const lng = item.coords?.coordinates?.[0] ?? 0;
          const lat = item.coords?.coordinates?.[1] ?? 0;

          return {
            id: item.id,
            visita_id: item.vid,
            solicitante,
            centros_gestores: item.organismos_encargados || [],
            descripcion: item.requerimiento || '',
            observaciones: item.observaciones || '',
            direccion: `${item.barrio_vereda}, ${item.comuna_corregimiento}`,
            latitud: String(lat),
            longitud: String(lng),
            evidencia_fotos: [],
            nota_voz_url: item.nota_voz_url || null,
            documentos_adjuntos: (() => {
              const raw = item.documentos_con_enlaces || item.documentos_s3 || [];
              const arr = Array.isArray(raw) ? raw : [raw];
              return arr.filter((d: Record<string, unknown>) => d && typeof d === 'object' && Object.keys(d).length > 0).map((d: Record<string, string>) => ({
                nombre: d.filename || d.nombre || 'archivo',
                url: d.url_visualizar || d.url_presigned || d.s3_url || d.url || '',
                tipo: d.content_type || d.tipo || '',
              }));
            })(),
            rid: item.rid,
            tipo_requerimiento: item.tipo_requerimiento,
            estado,
            encargado: undefined,
            enlace_id: undefined,
            enlace_nombre: undefined,
            porcentaje_avance: estado === 'resuelto' || estado === 'cerrado' ? 100 : 0,
            prioridad: 'media' as const,
            historial: [],
            created_at: item.created_at || item.fecha_registro,
            updated_at: item.timestamp || item.created_at,
          };
        });
        update((s) => ({ ...s, requerimientos: mapped, loading: false }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar requerimientos';
        console.error('loadRequerimientos failed:', err);
        update((s) => ({ ...s, loading: false, error: msg }));
      }
    },

    /** Programa una nueva visita — calls POST /registrar-visita/ then updates local state */
    programarVisita: async (
      fecha: string,
      horaInicio: string,
      horaFin: string,
      colaboradoresIds: string[],
      observaciones: string,
      ubicacionManual?: {
        direccion: string;
        barrio_vereda: string;
        comuna_corregimiento: string;
        referencia: string;
        latitud: string;
        longitud: string;
        geocoding_source: 'gps' | 'manual' | 'geocoded';
      }
    ) => {
      // Build payload for POST /registrar-visita/
      let currentState: SeguimientoState | undefined;
      const unsub = seguimientoStore.subscribe((s) => { currentState = s; });
      unsub();

      const primerColab = currentState?.colaboradores.find((c) =>
        colaboradoresIds.includes(c.id)
      );
      const [y, m, d] = fecha.split('-');
      const payload: RegistrarVisitaPayload = {
        direccion_visita: ubicacionManual?.barrio_vereda
          ? `${ubicacionManual.barrio_vereda}, ${ubicacionManual.comuna_corregimiento || ''}`
          : 'Sin dirección',
        descripcion_visita: observaciones || 'Visita programada',
        observaciones_visita: observaciones || '',
        acompanantes: primerColab ? [{
          nombre_completo: primerColab.nombre || 'Sin acompañante',
          telefono: primerColab.telefono || '',
          email: primerColab.email || '',
          centro_gestor: primerColab.centro_gestor || '',
        }] : undefined,
        fecha_visita: `${d}/${m}/${y}`,
        hora_visita: horaInicio || '09:00',
      };

      let vid: string | undefined;
      try {
        const result = await registrarVisita(payload);
        vid = result.vid;
      } catch (err) {
        console.warn('POST /registrar-visita/ failed, using local fallback:', err);
      }

      // Update local state
      update((state) => {
        const colaboradoresSeleccionados = state.colaboradores.filter((c) =>
          colaboradoresIds.includes(c.id)
        );
        const nuevaVisita: VisitaProgramada = {
          id: vid || generateVisitaId(),
          upid: 'SIN-UP',
          direccion_manual: ubicacionManual?.direccion,
          barrio_vereda: ubicacionManual?.barrio_vereda,
          comuna_corregimiento: ubicacionManual?.comuna_corregimiento,
          referencia_ubicacion: ubicacionManual?.referencia,
          latitud: ubicacionManual?.latitud,
          longitud: ubicacionManual?.longitud,
          geocoding_source: ubicacionManual?.geocoding_source,
          fecha_visita: fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          estado: 'programada',
          colaboradores: colaboradoresSeleccionados,
          observaciones,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return {
          ...state,
          visitas: [nuevaVisita, ...state.visitas],
        };
      });
    },

    /** Actualiza el estado de una visita — calls PATCH /seguimiento/visitas/:id/estado
     *  Cuando se inicia (en-curso), también registra la visita vía POST /registrar-visita/
     */
    actualizarEstadoVisita: async (visitaId: string, estado: VisitaProgramada['estado']) => {
      // Try real API first
      try {
        await actualizarEstadoVisitaAPI(visitaId, estado);
      } catch (err) {
        console.warn('API PATCH estado failed, updating locally:', err);
      }

      // Si la visita se inicia, registrarla también en POST /registrar-visita/
      if (estado === 'en-curso') {
        let currentState: SeguimientoState | undefined;
        const unsub = seguimientoStore.subscribe((s) => { currentState = s; });
        unsub();
        const visita = currentState?.visitas.find((v) => v.id === visitaId);
        if (visita) {
          try {
            const [y, m, d] = visita.fecha_visita.split('-');
            const fechaFormatted = `${d}/${m}/${y}`;
            const primerColaborador = visita.colaboradores[0];
            const payload: RegistrarVisitaPayload = {
              direccion_visita: visita.direccion_manual || visita.barrio_vereda
                ? `${visita.barrio_vereda || ''}, ${visita.comuna_corregimiento || ''}`.replace(/^, |, $/g, '')
                : 'Sin dirección',
              descripcion_visita: visita.observaciones || 'Visita iniciada desde seguimiento',
              observaciones_visita: visita.observaciones || 'Visita iniciada desde seguimiento',
              acompanantes: primerColaborador ? [{
                nombre_completo: primerColaborador.nombre || 'Sin acompañante',
                telefono: primerColaborador.telefono || '',
                email: primerColaborador.email || '',
                centro_gestor: primerColaborador.centro_gestor || '',
              }] : undefined,
              fecha_visita: fechaFormatted,
              hora_visita: visita.hora_inicio || new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
            };
            const result = await registrarVisita(payload);
            console.log('Visita registrada en artefacto de captura:', result.vid);
          } catch (err) {
            console.warn('POST /registrar-visita/ failed (no-blocking):', err);
          }
        }
      }

      // Always update local state
      update((state) => ({
        ...state,
        visitas: state.visitas.map((v) =>
          v.id === visitaId
            ? { ...v, estado, updated_at: new Date().toISOString() }
            : v
        ),
      }));
    },

    /* ---- REQUERIMIENTOS ---- */

    /** Agrega un nuevo requerimiento — calls POST /seguimiento/requerimientos
     *  También registra en POST /registrar-requerimiento (artefacto de captura)
     */
    agregarRequerimiento: async (
      visitaId: string,
      solicitante: Solicitante,
      centrosGestores: string[],
      descripcion: string,
      observaciones: string,
      direccion: string,
      latitud: string,
      longitud: string,
      fotos: string[],
      prioridad: Requerimiento['prioridad']
    ) => {
      // También registrar en el artefacto de captura POST /registrar-requerimiento (no bloqueante)
      try {
        const datosSolicitante = JSON.stringify({
          personas: [{
            nombre: solicitante.nombre_completo,
            email: solicitante.email || undefined,
            telefono: solicitante.telefono || undefined,
            centro_gestor: centrosGestores[0] || undefined,
          }],
        });
        const coordsJson = (latitud && longitud)
          ? JSON.stringify({ type: 'Point', coordinates: [parseFloat(longitud), parseFloat(latitud)] })
          : JSON.stringify({ type: 'Point', coordinates: [0, 0] });
        const organismosJson = JSON.stringify(centrosGestores);

        const capturaPayload: RequerimientoPayload = {
          vid: visitaId,
          datos_solicitante: datosSolicitante,
          tipo_requerimiento: prioridad || 'media',
          requerimiento: descripcion,
          observaciones: observaciones || 'Sin observaciones',
          coords: coordsJson,
          organismos_encargados: organismosJson,
        };
        const capturaResult = await registrarRequerimiento(capturaPayload);
        console.log('Requerimiento registrado en artefacto de captura:', capturaResult.rid);
      } catch (err) {
        console.warn('POST /registrar-requerimiento failed (no-blocking):', err);
      }

      // Try real API first (seguimiento)
      try {
        const apiBody = {
          visita_id: visitaId,
          solicitante: {
            nombre_completo: solicitante.nombre_completo,
            cedula: solicitante.cedula,
            telefono: solicitante.telefono,
            email: solicitante.email,
            direccion: solicitante.direccion,
            barrio_vereda: solicitante.barrio_vereda,
            comuna_corregimiento: solicitante.comuna_corregimiento,
          },
          centros_gestores: centrosGestores,
          descripcion,
          observaciones,
          direccion,
          latitud,
          longitud,
          evidencia_fotos: fotos,
          prioridad,
        };
        const result = await crearRequerimientoSeguimiento(apiBody);
        update((state) => {
          const nuevoReq: Requerimiento = {
            id: result.id,
            visita_id: result.visita_id,
            solicitante,
            centros_gestores: result.centros_gestores,
            descripcion: result.descripcion,
            observaciones: result.observaciones,
            direccion: result.direccion,
            latitud: result.latitud,
            longitud: result.longitud,
            evidencia_fotos: result.evidencia_fotos,
            estado: (result.estado as Requerimiento['estado']) || 'nuevo',
            porcentaje_avance: result.porcentaje_avance || 0,
            prioridad: (result.prioridad as Requerimiento['prioridad']) || prioridad,
            historial: [],
            created_at: result.created_at,
            updated_at: result.updated_at,
          };
          return { ...state, requerimientos: [nuevoReq, ...state.requerimientos] };
        });
        return;
      } catch (err) {
        console.warn('API /seguimiento/requerimientos failed, using local fallback:', err);
      }

      // Fallback: local-only
      update((state) => {
        const nuevoReq: Requerimiento = {
          id: generateRequerimientoId(),
          visita_id: visitaId,
          solicitante,
          centros_gestores: centrosGestores,
          descripcion,
          observaciones,
          direccion,
          latitud,
          longitud,
          evidencia_fotos: fotos,
          estado: 'nuevo',
          porcentaje_avance: 0,
          prioridad,
          historial: [
            {
              id: `hist-${Date.now()}`,
              fecha: new Date().toISOString(),
              autor: 'Usuario actual',
              descripcion: 'Requerimiento registrado en campo',
              estado_anterior: 'nuevo',
              estado_nuevo: 'nuevo',
              evidencias: [],
              porcentaje_avance: 0,
            },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return {
          ...state,
          requerimientos: [nuevoReq, ...state.requerimientos],
        };
      });
    },

    /** Cambia el estado de un requerimiento — calls PATCH /seguimiento/requerimientos/:id/estado */
    cambiarEstadoRequerimiento: async (
      reqId: string,
      nuevoEstado: EstadoRequerimiento,
      descripcion: string,
      autor: string,
      porcentajeAvance: number
    ) => {
      // Try real API
      try {
        await cambiarEstadoRequerimientoAPI(reqId, {
          estado: nuevoEstado,
          descripcion,
          autor,
          porcentaje_avance: porcentajeAvance,
        });
      } catch (err) {
        console.warn('API PATCH estado requerimiento failed, updating locally:', err);
      }
      // Always update local state
      update((state) => ({
        ...state,
        requerimientos: state.requerimientos.map((r) => {
          if (r.id !== reqId) return r;
          const nuevoRegistro: RegistroAvance = {
            id: `hist-${Date.now()}`,
            fecha: new Date().toISOString(),
            autor,
            descripcion,
            estado_anterior: r.estado,
            estado_nuevo: nuevoEstado,
            evidencias: [],
            porcentaje_avance: porcentajeAvance,
          };
          return {
            ...r,
            estado: nuevoEstado,
            porcentaje_avance: porcentajeAvance,
            historial: [...r.historial, nuevoRegistro],
            updated_at: new Date().toISOString(),
          };
        }),
      }));
    },

    /** Asigna un encargado a un requerimiento */
    asignarEncargado: (reqId: string, encargado: string) => {
      update((state) => ({
        ...state,
        requerimientos: state.requerimientos.map((r) =>
          r.id === reqId
            ? { ...r, encargado, updated_at: new Date().toISOString() }
            : r
        ),
      }));
    },

    /** Asigna un enlace del organismo a un requerimiento */
    asignarEnlace: (reqId: string, enlaceId: string, enlaceNombre: string) => {
      update((state) => ({
        ...state,
        requerimientos: state.requerimientos.map((r) =>
          r.id === reqId
            ? { ...r, enlace_id: enlaceId, enlace_nombre: enlaceNombre, updated_at: new Date().toISOString() }
            : r
        ),
      }));
    },

    /** Asigna fecha propuesta de solución */
    asignarFechaPropuestaSolucion: (reqId: string, fecha: string) => {
      update((state) => ({
        ...state,
        requerimientos: state.requerimientos.map((r) =>
          r.id === reqId
            ? { ...r, fecha_propuesta_solucion: fecha, updated_at: new Date().toISOString() }
            : r
        ),
      }));
    },

    /** Guarda número de orfeo y datos de petición */
    actualizarOrfeo: (
      reqId: string,
      numeroOrfeo: string,
      fechaRadicado: string,
      docUrl?: string,
      docNombre?: string
    ) => {
      update((state) => ({
        ...state,
        requerimientos: state.requerimientos.map((r) =>
          r.id === reqId
            ? {
                ...r,
                numero_orfeo: numeroOrfeo,
                fecha_radicado_orfeo: fechaRadicado,
                documento_peticion_url: docUrl,
                documento_peticion_nombre: docNombre,
                updated_at: new Date().toISOString(),
              }
            : r
        ),
      }));
    },

    /** Cancela un requerimiento con documento oficial */
    cancelarRequerimiento: (
      reqId: string,
      motivo: string,
      autor: string,
      docUrl?: string,
      docNombre?: string
    ) => {
      update((state) => ({
        ...state,
        requerimientos: state.requerimientos.map((r) => {
          if (r.id !== reqId) return r;
          const registro = {
            id: `hist-${Date.now()}`,
            fecha: new Date().toISOString(),
            autor,
            descripcion: `Requerimiento cancelado: ${motivo}`,
            estado_anterior: r.estado,
            estado_nuevo: 'cancelado' as const,
            evidencias: docUrl
              ? [{ id: `ev-${Date.now()}`, tipo: 'documento' as const, url: docUrl, descripcion: docNombre || 'Doc. cancelación', fecha: new Date().toISOString() }]
              : [],
            porcentaje_avance: r.porcentaje_avance,
          };
          return {
            ...r,
            estado: 'cancelado' as const,
            motivo_cancelacion: motivo,
            documento_cancelacion_url: docUrl,
            documento_cancelacion_nombre: docNombre,
            historial: [...r.historial, registro],
            updated_at: new Date().toISOString(),
          };
        }),
      }));
    },

    /** Resetea error */
    clearError: () => {
      update((state) => ({ ...state, error: null }));
    },
  };
}

export const seguimientoStore = createSeguimientoStore();

/* ============================================================
 *  DERIVED STORES
 * ============================================================ */

/** Visitas activas (programadas y en-curso) */
export const visitasActivas = derived(seguimientoStore, ($s) =>
  $s.visitas.filter((v) => v.estado === 'programada' || v.estado === 'en-curso')
);

/** Requerimientos agrupados por estado (para Kanban) */
export const requerimientosPorEstado = derived(seguimientoStore, ($s) => {
  const grouped: Record<EstadoRequerimiento, Requerimiento[]> = {
    'nuevo': [],
    'radicado': [],
    'en-gestion': [],
    'asignado': [],
    'en-proceso': [],
    'resuelto': [],
    'cerrado': [],
    'cancelado': [],
  };
  for (const req of $s.requerimientos) {
    grouped[req.estado].push(req);
  }
  return grouped;
});

/** Requerimientos agrupados por centro gestor */
export const requerimientosPorCentroGestor = derived(seguimientoStore, ($s) => {
  const grouped: Record<string, Requerimiento[]> = {};
  for (const req of $s.requerimientos) {
    const cgs = req.centros_gestores.length > 0 ? req.centros_gestores : ['Sin asignar'];
    for (const cg of cgs) {
      if (!grouped[cg]) grouped[cg] = [];
      grouped[cg].push(req);
    }
  }
  return grouped;
});

/** Conteo de requerimientos por estado */
export const conteoEstados = derived(requerimientosPorEstado, ($rpe) => {
  const conteo: Record<string, number> = {};
  for (const [estado, reqs] of Object.entries($rpe)) {
    conteo[estado] = reqs.length;
  }
  return conteo;
});

/** Requerimientos de una visita específica */
export function getRequerimientosByVisita(visitaId: string) {
  return derived(seguimientoStore, ($s) =>
    $s.requerimientos.filter((r) => r.visita_id === visitaId)
  );
}
