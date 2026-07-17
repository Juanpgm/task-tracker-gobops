/**
 * API para las estadísticas agregadas del módulo Avanzadas. Usa la misma
 * base URL y convenciones de autenticación Bearer que src/api/avanzadas.ts.
 */
import { apiClient } from '../lib/api-client';

export interface TotalesEstadisticas {
  avanzadas: number;
  requerimientos: number;
  comunas: number;
  entidades: number;
  asistentes: number;
  promedio_requerimientos: number;
}

export interface PorEntidadEstadistica {
  sigla: string;
  entidad: string;
  total: number;
}

export interface PorCategoriaEstadistica {
  categoria: string;
  sigla: string;
  total: number;
}

export interface PorComunaEstadistica {
  comuna: string;
  avanzadas: number;
  requerimientos: number;
}

export interface PorEstrategiaEstadistica {
  estrategia: string;
  avanzadas: number;
  requerimientos: number;
}

export interface PorMesEstadistica {
  mes: string; // "YYYY-MM"
  avanzadas: number;
  requerimientos: number;
}

/** Payload de GET /avanzadas/estadisticas: agregados pre-calculados por el backend. */
export interface EstadisticasAvanzadas {
  totales: TotalesEstadisticas;
  por_entidad: PorEntidadEstadistica[];
  por_categoria: PorCategoriaEstadistica[];
  por_comuna: PorComunaEstadistica[];
  por_estrategia: PorEstrategiaEstadistica[];
  por_mes: PorMesEstadistica[];
}

/* ============================================================
 *  GET /avanzadas/estadisticas
 * ============================================================ */
export async function getEstadisticasAvanzadas(): Promise<EstadisticasAvanzadas> {
  return apiClient.get<EstadisticasAvanzadas>('/avanzadas/estadisticas');
}
