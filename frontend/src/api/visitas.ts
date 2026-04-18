import { apiClient, projectApiClient } from '../lib/api-client';
import type {
  RegistrarVisitaPayload,
  VisitaResponse,
  Reporte,
  AsistenciaDelegadoPayload,
  AsistenciaComunidadPayload,
  RequerimientoPayload,
  RequerimientoResponse,
  ProgramarVisitaBody,
  VisitaProgramadaOut,
  CrearRequerimientoBody,
  RequerimientoOut,
  DirectorioContactosResponse,
} from '../types';

type ApiListResponse<T> = { success?: boolean; data?: T[] } | T[];

function extractList<T>(response: ApiListResponse<T>): T[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

/* ============================================================
 *  GET /obtener_directorio_contactos
 *  Obtiene el directorio de contactos (delegados por centro gestor)
 * ============================================================ */
export async function getDirectorioContactos(): Promise<DirectorioContactosResponse> {
  return apiClient.get<DirectorioContactosResponse>('/obtener_directorio_contactos');
}

/* ============================================================
 *  GET /intervenciones
 *  Lista intervenciones para filtros y seguimiento
 * ============================================================ */
export async function getIntervenciones<T = Record<string, unknown>>(): Promise<T[]> {
  const response = await projectApiClient.get<ApiListResponse<T>>('/intervenciones');
  return extractList(response);
}

/* ============================================================
 *  POST /registrar-visita/
 *  Registra una nueva visita (application/json)
 *  Campos: barrio_vereda, comuna_corregimiento, descripcion_visita,
 *          observaciones_visita, acompanantes, fecha_visita (dd/mm/aaaa),
 *          hora_visita (HH:mm)
 * ============================================================ */
export async function registrarVisita(payload: RegistrarVisitaPayload): Promise<VisitaResponse> {
  return apiClient.post<VisitaResponse>('/registrar-visita/', payload as unknown as Record<string, unknown>);
}

/* ============================================================
 *  GET /obtener-visitas-programadas/
 *  Obtiene las visitas programadas registradas (Artefacto de Captura)
 * ============================================================ */
export interface ObtenerVisitasProgramadasItem {
  vid: string;
  vid_number: number;
  barrio_vereda: string;
  comuna_corregimiento: string;
  acompanantes: Record<string, string> | Record<string, string>[];
  descripcion_visita: string;
  observaciones_visita: string;
  hora_visita: string;
  fecha_visita: string; // dd/mm/yyyy
  created_at: string;
  timestamp: string;
}

interface ObtenerVisitasProgramadasResponse {
  success: boolean;
  total: number;
  visitas: ObtenerVisitasProgramadasItem[];
}

export async function obtenerVisitasProgramadas(): Promise<ObtenerVisitasProgramadasItem[]> {
  const res = await apiClient.get<ObtenerVisitasProgramadasResponse>('/obtener-visitas-programadas/');
  return res.visitas || [];
}

/* ============================================================
 *  GET /grupo-operativo/reportes
 *  Lista todos los reportes del grupo operativo
 * ============================================================ */
export async function getReportes(): Promise<Reporte[]> {
  return apiClient.get<Reporte[]>('/grupo-operativo/reportes');
}

/* ============================================================
 *  DELETE /grupo-operativo/eliminar-reporte
 *  Elimina un reporte específico por ID
 * ============================================================ */
export async function eliminarReporte(reporteId: number): Promise<unknown> {
  return apiClient.delete('/grupo-operativo/eliminar-reporte', {
    reporte_id: reporteId.toString(),
  });
}

/* ============================================================
 *  POST /registrar-asistencia-delegado
 *  Registra asistencia de un delegado (application/x-www-form-urlencoded)
 * ============================================================ */
export async function registrarAsistenciaDelegado(
  payload: AsistenciaDelegadoPayload
): Promise<unknown> {
  const data: Record<string, string> = {
    vid: payload.vid,
    id_acompanante: payload.id_acompanante,
    nombre_completo: payload.nombre_completo,
    rol: payload.rol,
    nombre_centro_gestor: payload.nombre_centro_gestor,
    telefono: payload.telefono,
    email: payload.email,
    latitud: payload.latitud,
    longitud: payload.longitud,
  };
  return apiClient.postUrlEncoded('/registrar-asistencia-delegado', data);
}

/* ============================================================
 *  POST /registrar-asistencia-comunidad
 *  Registra asistencia de la comunidad (application/x-www-form-urlencoded)
 * ============================================================ */
export async function registrarAsistenciaComunidad(
  payload: AsistenciaComunidadPayload
): Promise<unknown> {
  const data: Record<string, string> = {
    vid: payload.vid,
    id_asistente_comunidad: payload.id_asistente_comunidad,
    nombre_completo: payload.nombre_completo,
    rol_comunidad: payload.rol_comunidad,
    direccion: payload.direccion,
    barrio_vereda: payload.barrio_vereda,
    comuna_corregimiento: payload.comuna_corregimiento,
    telefono: payload.telefono,
    email: payload.email,
    latitud: payload.latitud,
    longitud: payload.longitud,
  };
  return apiClient.postUrlEncoded('/registrar-asistencia-comunidad', data);
}

/* ============================================================
 *  POST /registrar-requerimiento
 *  Registra un requerimiento con posible nota de voz (multipart/form-data)
 *  Campos: vid, datos_solicitante (JSON), tipo_requerimiento, requerimiento,
 *          observaciones, coords (GeoJSON), organismos_encargados (JSON array),
 *          nota_voz (file, optional)
 * ============================================================ */
export async function registrarRequerimiento(
  payload: RequerimientoPayload
): Promise<RequerimientoResponse> {
  const formData = new FormData();
  formData.append('vid', payload.vid);
  formData.append('datos_solicitante', payload.datos_solicitante);
  formData.append('tipo_requerimiento', payload.tipo_requerimiento);
  formData.append('requerimiento', payload.requerimiento);
  if (payload.direccion_requerimiento) {
    formData.append('direccion_requerimiento', payload.direccion_requerimiento);
  }
  formData.append('observaciones', payload.observaciones);
  formData.append('coords', payload.coords);
  formData.append('organismos_encargados', payload.organismos_encargados);

  if (payload.nota_voz) {
    formData.append('nota_voz', payload.nota_voz);
  }

  if (payload.evidencias && payload.evidencias.length > 0) {
    for (const file of payload.evidencias) {
      formData.append('evidencias', file);
    }
  }

  return apiClient.postForm<RequerimientoResponse>('/registrar-requerimiento', formData);
}

/* ============================================================
 *  SEGUIMIENTO DE REQUERIMIENTOS — Endpoints nuevos
 *  Requieren Bearer token (apiClient ya lo maneja)
 * ============================================================ */

/** GET /seguimiento/visitas — Listar visitas programadas */
export async function getVisitasProgramadas(
  params?: { estado?: string; upid?: string }
): Promise<VisitaProgramadaOut[]> {
  return apiClient.get<VisitaProgramadaOut[]>('/seguimiento/visitas', params as Record<string, string>);
}

/** POST /seguimiento/visitas — Programar nueva visita en Firestore */
export async function programarVisitaAPI(
  body: ProgramarVisitaBody
): Promise<VisitaProgramadaOut> {
  return apiClient.post<VisitaProgramadaOut>('/seguimiento/visitas', body as unknown as Record<string, unknown>);
}

/** PATCH /seguimiento/visitas/:id/estado — Actualizar estado de visita */
export async function actualizarEstadoVisitaAPI(
  visitaId: string,
  estado: string
): Promise<VisitaProgramadaOut> {
  return apiClient.patch<VisitaProgramadaOut>(`/seguimiento/visitas/${encodeURIComponent(visitaId)}/estado`, { estado });
}

/** GET /seguimiento/requerimientos — Listar requerimientos */
export async function getRequerimientosSeguimiento(
  params?: { visita_id?: string; estado?: string }
): Promise<RequerimientoOut[]> {
  return apiClient.get<RequerimientoOut[]>('/seguimiento/requerimientos', params as Record<string, string>);
}

/** POST /seguimiento/requerimientos — Crear requerimiento de seguimiento */
export async function crearRequerimientoSeguimiento(
  body: CrearRequerimientoBody
): Promise<RequerimientoOut> {
  return apiClient.post<RequerimientoOut>('/seguimiento/requerimientos', body as unknown as Record<string, unknown>);
}

/** PATCH /seguimiento/requerimientos/:id/estado — Cambiar estado de requerimiento */
export async function cambiarEstadoRequerimientoAPI(
  reqId: string,
  body: { estado: string; descripcion: string; autor: string; porcentaje_avance?: number; evidencias?: unknown[] }
): Promise<RequerimientoOut> {
  return apiClient.patch<RequerimientoOut>(`/seguimiento/requerimientos/${encodeURIComponent(reqId)}/estado`, body as Record<string, unknown>);
}

/** PATCH /seguimiento/requerimientos/:id/encargado — Asignar encargado */
export async function asignarEncargadoAPI(
  reqId: string,
  encargado: string
): Promise<RequerimientoOut> {
  return apiClient.patch<RequerimientoOut>(`/seguimiento/requerimientos/${encodeURIComponent(reqId)}/encargado`, { encargado });
}

/** PATCH /seguimiento/requerimientos/:id/enlace — Asignar enlace */
export async function asignarEnlaceAPI(
  reqId: string,
  enlace_id: string,
  enlace_nombre: string
): Promise<RequerimientoOut> {
  return apiClient.patch<RequerimientoOut>(`/seguimiento/requerimientos/${encodeURIComponent(reqId)}/enlace`, { enlace_id, enlace_nombre });
}

/** GET /seguimiento/colaboradores — Obtener colaboradores */
export async function getColaboradores(): Promise<unknown[]> {
  return apiClient.get<unknown[]>('/seguimiento/colaboradores');
}

/** GET /seguimiento/centros-gestores — Obtener catálogo de centros gestores */
export async function getCentrosGestores(): Promise<unknown[]> {
  return apiClient.get<unknown[]>('/seguimiento/centros-gestores');
}

/** GET /seguimiento/enlaces — Obtener directorio de enlaces */
export async function getEnlaces(
  params?: { centro_gestor_id?: string; activo?: string }
): Promise<unknown[]> {
  return apiClient.get<unknown[]>('/seguimiento/enlaces', params as Record<string, string>);
}

/* ============================================================
 *  GET /obtener-requerimientos
 *  Obtiene todos los requerimientos registrados (Artefacto de Captura)
 * ============================================================ */
export interface ObtenerRequerimientosItem {
  id: string;
  vid: string;
  rid: string;
  rid_number: number;
  tipo_requerimiento: string;
  requerimiento: string;
  observaciones: string;
  estado: string;
  barrio_vereda: string;
  comuna_corregimiento: string;
  coords: { type: string; coordinates: [number, number] };
  datos_solicitante: {
    personas: Array<{
      nombre: string;
      email?: string;
      telefono?: string;
      centro_gestor?: string;
    }>;
  };
  organismos_encargados: string[];
  nota_voz_url: string | null;
  fecha_registro: string;
  created_at: string;
  timestamp: string;
}

interface ObtenerRequerimientosResponse {
  success: boolean;
  total: number;
  requerimientos: ObtenerRequerimientosItem[];
}

export async function obtenerRequerimientos(): Promise<ObtenerRequerimientosItem[]> {
  const res = await apiClient.get<ObtenerRequerimientosResponse>('/obtener-requerimientos');
  return res.requerimientos || [];
}
