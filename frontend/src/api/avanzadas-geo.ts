/**
 * API para la vista georeferenciada del módulo Avanzadas (GET /avanzadas/geo).
 * Usa la misma base URL y convenciones de autenticación Bearer que
 * src/api/avanzadas.ts / src/api/avanzadas-estadisticas.ts.
 */
import { apiClient } from '../lib/api-client';

export interface AvanzadaGeo {
  client_id: string;
  nombre_avanzada: string;
  fecha: string; // YYYY-MM-DD
  estrategia: string;
  comuna: string;
  barrio: string;
  lat: number;
  lng: number;
  requerimientos_count: number;
}

export interface RequerimientoGeo {
  id: string | number;
  avanzada_client_id: string;
  sigla: string;
  entidad: string;
  categoria: string;
  requerimiento: string;
  ubicacion: string;
  fecha: string; // YYYY-MM-DD
  lat: number;
  lng: number;
  fotos_count: number;
}

export interface JornadaGeo {
  client_id: string;
  nombre_jornada: string;
  fecha: string; // YYYY-MM-DD
  comuna: string;
  barrio: string;
  estado: string;
  lat: number;
  lng: number;
}

export interface OmitidosGeo {
  avanzadas: number;
  requerimientos: number;
  jornadas: number;
}

/** Payload de GET /avanzadas/geo: puntos georeferenciados listos para mapa. */
export interface AvanzadasGeo {
  avanzadas: AvanzadaGeo[];
  requerimientos: RequerimientoGeo[];
  jornadas: JornadaGeo[];
  omitidos: OmitidosGeo;
}

/* ============================================================
 *  GET /avanzadas/geo
 * ============================================================ */
export async function getAvanzadasGeo(): Promise<AvanzadasGeo> {
  return apiClient.get<AvanzadasGeo>('/avanzadas/geo');
}
