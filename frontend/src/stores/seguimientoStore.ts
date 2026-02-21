/**
 * Store de Seguimiento de Requerimientos
 * Gestiona visitas programadas, requerimientos y estado del Kanban
 * Usa datos mock en local, preparado para migrar a endpoints reales
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
import type { UnidadProyecto } from '../types';
import {
  MOCK_VISITAS,
  MOCK_REQUERIMIENTOS,
  MOCK_COLABORADORES,
  MOCK_ENLACES,
  generateVisitaId,
  generateRequerimientoId,
} from '../data/mock-seguimiento';

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
  visitas: [...MOCK_VISITAS],
  requerimientos: [...MOCK_REQUERIMIENTOS],
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

    /** Programa una nueva visita */
    programarVisita: (
      up: UnidadProyecto,
      fecha: string,
      horaInicio: string,
      horaFin: string,
      colaboradoresIds: string[],
      observaciones: string
    ) => {
      update((state) => {
        const colaboradoresSeleccionados = state.colaboradores.filter((c) =>
          colaboradoresIds.includes(c.id)
        );
        const nuevaVisita: VisitaProgramada = {
          id: generateVisitaId(),
          upid: up.upid,
          unidad_proyecto: up,
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

    /** Actualiza el estado de una visita */
    actualizarEstadoVisita: (visitaId: string, estado: VisitaProgramada['estado']) => {
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

    /** Agrega un nuevo requerimiento a una visita */
    agregarRequerimiento: (
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

    /** Cambia el estado de un requerimiento y agrega al historial */
    cambiarEstadoRequerimiento: (
      reqId: string,
      nuevoEstado: EstadoRequerimiento,
      descripcion: string,
      autor: string,
      porcentajeAvance: number
    ) => {
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
