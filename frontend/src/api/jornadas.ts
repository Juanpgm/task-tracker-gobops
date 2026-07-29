/**
 * API del módulo Jornadas Integrales: estadísticas agregadas (lectura) y el
 * CRUD incremental del wizard de captura (planificación, compromisos,
 * seguimientos, verificación, encuestas y requerimientos). Usa la misma base
 * URL y convenciones de autenticación Bearer que src/api/avanzadas.ts.
 */
import { apiClient, uploadApiClient } from '../lib/api-client';

export interface TotalesJornadas {
  jornadas: number;
  compromisos: number;
  seguimientos: number;
  encuestas: number;
  asistencia_total: number;
  cumplimiento_pct: number;
}

export interface CompromisosPorOrganismo {
  organismo: string;
  total: number;
  cumple: number;
  no_cumple: number;
  novedad: number;
}

export interface CompromisosPorVerificacion {
  estado: string;
  total: number;
}

export interface SeguimientosPorEstado {
  estado: string;
  total: number;
}

export interface EncuestasPorOrganismo {
  org: string;
  bueno: number;
  regular: number;
  malo: number;
  na: number;
  total: number;
}

export interface JornadasPorComuna {
  comuna: string;
  jornadas: number;
  compromisos: number;
}

export interface JornadaListaItem {
  client_id: string;
  nombre_jornada: string;
  fecha: string; // YYYY-MM-DD
  comuna: string;
  barrio: string;
  estado: string;
  asistencia_aproximada: number;
  compromisos_count: number;
}

/** Payload de GET /jornadas/estadisticas: agregados pre-calculados por el backend. */
export interface EstadisticasJornadas {
  totales: TotalesJornadas;
  compromisos_por_organismo: CompromisosPorOrganismo[];
  compromisos_por_verificacion: CompromisosPorVerificacion[];
  seguimientos_por_estado: SeguimientosPorEstado[];
  encuestas_por_organismo: EncuestasPorOrganismo[];
  jornadas_por_comuna: JornadasPorComuna[];
  jornadas_lista: JornadaListaItem[];
}

/* ============================================================
 *  GET /jornadas/estadisticas
 * ============================================================ */
export async function getEstadisticasJornadas(): Promise<EstadisticasJornadas> {
  return apiClient.get<EstadisticasJornadas>('/jornadas/estadisticas');
}

/* ============================================================
 *  MÓDULO JORNADAS INTEGRALES — CRUD incremental del wizard
 * ============================================================ */

export type EstadoJornada = 'planificacion' | 'seguimiento' | 'ejecucion' | 'completada';
export type EstadoSeguimientoCompromiso = 'ok' | 'novedad' | 'cancelado';
export type EstadoVerificacionCompromiso = 'cumple' | 'no-cumple' | 'novedad';
export type CalificacionEncuesta = 'Bueno' | 'Regular' | 'Malo' | 'N/A';

export interface SeguimientoCompromiso {
  client_id: string;
  fecha_seguimiento: string;
  estado: EstadoSeguimientoCompromiso;
  responsable_seguimiento: string;
  comentario_seguimiento?: string;
}

export interface VerificacionCompromiso {
  estado_verificacion_campo: EstadoVerificacionCompromiso;
  fecha_verificacion: string;
  responsable_verificacion: string;
  representante_organismo?: string;
  resultado_obtenido?: number | null;
  comentario_verificacion?: string;
  fotos_urls?: string[];
}

export interface Compromiso {
  client_id: string;
  organismo: string;
  oferta_servicio: string;
  responsable_organismo: string;
  celular_responsable: string;
  tipo: 'cualitativo' | 'cuantitativo';
  compromiso: string;
  unidad_medida: string;
  meta_cuantitativa?: number | null;
  estado_seguimiento?: EstadoSeguimientoCompromiso | null;
  seguimientos?: SeguimientoCompromiso[];
  verificacion?: VerificacionCompromiso | null;
}

export interface EvaluacionEncuesta {
  org: string;
  calif: CalificacionEncuesta;
}

export interface Encuesta {
  client_id: string;
  nombre_participante: string;
  comuna?: string;
  barrio?: string;
  evaluaciones: EvaluacionEncuesta[];
  comentario_final?: string;
}

export interface RequerimientoJornada {
  entidad: string;
  categoria: string;
  categoria_personalizada: string | null;
  requerimiento: string;
  ubicacion: string;
  coordenadas: string | null;
  fotos_urls?: string[];
}

/** Detalle completo de una jornada: GET /jornadas/{client_id}. */
export interface JornadaDetalle {
  client_id: string;
  nombre_jornada: string;
  fecha: string; // YYYY-MM-DD
  punto_encuentro: string;
  direccion_punto_encuentro: string;
  coordenadas_encuentro: string;
  comuna: string;
  barrio: string;
  direcciones_recuperadas: string[];
  sector_punto_reconocimiento: string;
  estado: EstadoJornada;
  url_croquis?: string | null;
  asistencia_aproximada?: number | null;
  observaciones_generales?: string;
  peticiones_comunidad?: string[];
  compromisos: Compromiso[];
  encuestas: Encuesta[];
  requerimientos: RequerimientoJornada[];
  compromisos_count?: number;
  created_at?: string;
  updated_at?: string;
}

/* ------------------------------------------------------------
 *  POST /jornadas — idempotente por client_id (200 existente / 201 creada)
 * ------------------------------------------------------------ */
export interface CrearJornadaDatos {
  client_id: string;
  nombre_jornada: string;
  fecha: string;
  punto_encuentro: string;
  direccion_punto_encuentro: string;
  coordenadas_encuentro: string;
  comuna: string;
  barrio: string;
  direcciones_recuperadas: string[];
  sector_punto_reconocimiento: string;
}

export async function crearJornada(datos: CrearJornadaDatos): Promise<JornadaDetalle> {
  return apiClient.post<JornadaDetalle>('/jornadas', datos as unknown as Record<string, unknown>);
}

/* ------------------------------------------------------------
 *  PATCH /jornadas/{client_id} — campos generales y/o estado y/o cierre
 * ------------------------------------------------------------ */
export interface ActualizarJornadaDatos {
  nombre_jornada?: string;
  fecha?: string;
  punto_encuentro?: string;
  direccion_punto_encuentro?: string;
  coordenadas_encuentro?: string;
  comuna?: string;
  barrio?: string;
  direcciones_recuperadas?: string[];
  sector_punto_reconocimiento?: string;
  estado?: EstadoJornada;
  asistencia_aproximada?: number;
  observaciones_generales?: string;
  peticiones_comunidad?: string[];
}

export async function actualizarJornada(
  clientId: string,
  datos: ActualizarJornadaDatos
): Promise<JornadaDetalle> {
  return apiClient.patch<JornadaDetalle>(
    `/jornadas/${encodeURIComponent(clientId)}`,
    datos as unknown as Record<string, unknown>
  );
}

/* ------------------------------------------------------------
 *  POST /jornadas/{client_id}/croquis — multipart, foto -> S3 -> url_croquis
 * ------------------------------------------------------------ */
export async function subirCroquisJornada(
  clientId: string,
  foto: File
): Promise<{ url_croquis: string }> {
  const formData = new FormData();
  formData.append('foto', foto);
  return uploadApiClient.postForm<{ url_croquis: string }>(
    `/jornadas/${encodeURIComponent(clientId)}/croquis`,
    formData
  );
}

/* ------------------------------------------------------------
 *  Compromisos por organismo
 * ------------------------------------------------------------ */
export interface CrearCompromisoDatos {
  client_id: string;
  organismo: string;
  oferta_servicio: string;
  responsable_organismo: string;
  celular_responsable: string;
  tipo: 'cualitativo' | 'cuantitativo';
  compromiso: string;
  unidad_medida: string;
  /** Sólo debe enviarse cuando tipo = 'cuantitativo' — el backend rechaza (422)
   *  un meta_cuantitativa distinto de cero para compromisos cualitativos. */
  meta_cuantitativa?: number;
}

export async function crearCompromiso(
  jornadaClientId: string,
  datos: CrearCompromisoDatos
): Promise<Compromiso> {
  return apiClient.post<Compromiso>(
    `/jornadas/${encodeURIComponent(jornadaClientId)}/compromisos`,
    datos as unknown as Record<string, unknown>
  );
}

export type ActualizarCompromisoDatos = Partial<Omit<CrearCompromisoDatos, 'client_id'>>;

export async function actualizarCompromiso(
  clientId: string,
  datos: ActualizarCompromisoDatos
): Promise<Compromiso> {
  return apiClient.patch<Compromiso>(
    `/jornadas/compromisos/${encodeURIComponent(clientId)}`,
    datos as unknown as Record<string, unknown>
  );
}

/**
 * DELETE /jornadas/compromisos/{client_id}. El backend responde 409 (y se
 * niega a borrar) cuando el compromiso ya tiene seguimientos registrados —
 * ver isConflictError() para detectar ese caso desde el store/UI.
 */
export async function eliminarCompromiso(clientId: string): Promise<void> {
  await apiClient.delete(`/jornadas/compromisos/${encodeURIComponent(clientId)}`);
}

/* ------------------------------------------------------------
 *  Seguimiento (una llamada -> un registro por compromiso)
 * ------------------------------------------------------------ */
export interface CrearSeguimientoDatos {
  client_id: string;
  fecha_seguimiento: string;
  estado: EstadoSeguimientoCompromiso;
  responsable_seguimiento: string;
  comentario_seguimiento?: string;
}

export async function crearSeguimiento(
  compromisoClientId: string,
  datos: CrearSeguimientoDatos
): Promise<SeguimientoCompromiso> {
  return apiClient.post<SeguimientoCompromiso>(
    `/jornadas/compromisos/${encodeURIComponent(compromisoClientId)}/seguimientos`,
    datos as unknown as Record<string, unknown>
  );
}

/* ------------------------------------------------------------
 *  Verificación en campo — multipart (datos JSON + fotos, máx. 4)
 * ------------------------------------------------------------ */
export interface GuardarVerificacionDatos {
  estado_verificacion_campo: EstadoVerificacionCompromiso;
  fecha_verificacion: string;
  responsable_verificacion: string;
  representante_organismo?: string;
  /** Sólo aplica cuando el compromiso es tipo = 'cuantitativo'. */
  resultado_obtenido?: number | null;
  comentario_verificacion?: string;
  fotos_existentes: string[];
}

const MAX_FOTOS_VERIFICACION = 4;

export async function guardarVerificacion(
  compromisoClientId: string,
  datos: GuardarVerificacionDatos,
  fotos: File[] = []
): Promise<Compromiso> {
  const formData = new FormData();
  formData.append('datos', JSON.stringify(datos));
  fotos.slice(0, MAX_FOTOS_VERIFICACION).forEach((file) => formData.append('fotos', file));
  return uploadApiClient.patchForm<Compromiso>(
    `/jornadas/compromisos/${encodeURIComponent(compromisoClientId)}/verificacion`,
    formData
  );
}

/* ------------------------------------------------------------
 *  Encuestas de experiencia ciudadana
 * ------------------------------------------------------------ */
export interface CrearEncuestaDatos {
  client_id: string;
  nombre_participante: string;
  comuna?: string;
  barrio?: string;
  evaluaciones: EvaluacionEncuesta[];
  comentario_final?: string;
}

export async function crearEncuesta(
  jornadaClientId: string,
  datos: CrearEncuestaDatos
): Promise<Encuesta> {
  return apiClient.post<Encuesta>(
    `/jornadas/${encodeURIComponent(jornadaClientId)}/encuestas`,
    datos as unknown as Record<string, unknown>
  );
}

export async function eliminarEncuesta(clientId: string): Promise<void> {
  await apiClient.delete(`/jornadas/encuestas/${encodeURIComponent(clientId)}`);
}

/* ------------------------------------------------------------
 *  Requerimientos levantados durante la jornada — multipart, mismo
 *  contrato que crearAvanzada(): datos JSON + fotos_req_{i} (máx. 5 c/u).
 *  Caen en la colección compartida de requerimientos (mapa/reportes).
 * ------------------------------------------------------------ */
export interface RequerimientoJornadaInput {
  entidad: string;
  /** Organismos destino (multi-selección), mismo contrato que RequerimientoAvanzada.entidades. */
  entidades?: string[];
  categoria: string;
  categoria_personalizada: string | null;
  requerimiento: string;
  ubicacion: string;
  coordenadas: string | null;
}

const MAX_FOTOS_POR_REQUERIMIENTO_JORNADA = 5;

export async function crearRequerimientosJornada(
  jornadaClientId: string,
  requerimientos: RequerimientoJornadaInput[],
  fotosPorRequerimiento: File[][] = []
): Promise<RequerimientoJornada[]> {
  const formData = new FormData();
  formData.append('datos', JSON.stringify({ requerimientos }));
  fotosPorRequerimiento.forEach((fotos, idx) => {
    (fotos || []).slice(0, MAX_FOTOS_POR_REQUERIMIENTO_JORNADA).forEach((file) => {
      formData.append(`fotos_req_${idx}`, file);
    });
  });
  return uploadApiClient.postForm<RequerimientoJornada[]>(
    `/jornadas/${encodeURIComponent(jornadaClientId)}/requerimientos`,
    formData
  );
}

/* ------------------------------------------------------------
 *  GET /jornadas?limit=100 — listado (tolerante a array plano o { jornadas })
 * ------------------------------------------------------------ */
type ListarJornadasResponse = { jornadas: JornadaListaItem[] } | JornadaListaItem[];

export async function listarJornadas(limit = 100): Promise<JornadaListaItem[]> {
  const res = await apiClient.get<ListarJornadasResponse>('/jornadas', { limit: String(limit) });
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.jornadas)) return res.jornadas;
  return [];
}

/* ------------------------------------------------------------
 *  GET /jornadas/{client_id} — detalle completo
 * ------------------------------------------------------------ */
export async function getJornada(clientId: string): Promise<JornadaDetalle> {
  return apiClient.get<JornadaDetalle>(`/jornadas/${encodeURIComponent(clientId)}`);
}

/**
 * True cuando el mensaje de un error de la API indica un HTTP 409 Conflict
 * (p.ej. borrar un compromiso que ya tiene seguimientos registrados — el
 * backend se niega en vez de hacer cascada). api-client.ts no expone el
 * status code de forma estructurada, así que se detecta por el mensaje que
 * arma ApiClient: `DELETE ${path} failed (409): ...`.
 */
export function isConflictError(err: unknown): boolean {
  return err instanceof Error && /\(409\)/.test(err.message);
}
