import { apiClient, projectApiClient } from '../lib/api-client';
import type {
  UnidadProyecto,
  RegistrarVisitaPayload,
  VisitaResponse,
  Reporte,
  AsistenciaDelegadoPayload,
  AsistenciaComunidadPayload,
  RequerimientoPayload,
} from '../types';

type ApiListResponse<T> = { success?: boolean; data?: T[] } | T[];

function extractList<T>(response: ApiListResponse<T>): T[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

/* ============================================================
 *  GET /unidades-proyecto
 *  Obtiene las unidades de proyecto disponibles
 *  (fallback: /unidades-proyecto/init-360)
 * ============================================================ */
export async function getUnidadesProyecto(): Promise<UnidadProyecto[]> {
  try {
    const response = await projectApiClient.get<ApiListResponse<UnidadProyecto>>('/unidades-proyecto');
    const data = extractList(response);
    if (data.length > 0) return data;
  } catch {
    // fallback endpoint
  }

  const fallbackResponse = await projectApiClient.get<ApiListResponse<UnidadProyecto>>('/unidades-proyecto/init-360');
  return extractList(fallbackResponse);
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
 *  Registra una nueva visita (application/x-www-form-urlencoded)
 * ============================================================ */
export async function registrarVisita(payload: RegistrarVisitaPayload): Promise<VisitaResponse> {
  const data: Record<string, string> = {
    nombre_up: payload.nombre_up,
    nombre_up_detalle: payload.nombre_up_detalle,
    barrio_vereda: payload.barrio_vereda,
    comuna_corregimiento: payload.comuna_corregimiento,
    fecha_visita: payload.fecha_visita,
  };
  return apiClient.postUrlEncoded<VisitaResponse>('/registrar-visita/', data);
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
 * ============================================================ */
export async function registrarRequerimiento(
  payload: RequerimientoPayload
): Promise<unknown> {
  const formData = new FormData();
  formData.append('vid', payload.vid);
  formData.append('centro_gestor_solicitante', payload.centro_gestor_solicitante);
  formData.append('solicitante_contacto', payload.solicitante_contacto);
  formData.append('requerimiento', payload.requerimiento);
  formData.append('observaciones', payload.observaciones);
  formData.append('direccion', payload.direccion);
  formData.append('barrio_vereda', payload.barrio_vereda);
  formData.append('comuna_corregimiento', payload.comuna_corregimiento);
  formData.append('latitud', payload.latitud);
  formData.append('longitud', payload.longitud);
  formData.append('telefono', payload.telefono);
  formData.append('email_solicitante', payload.email_solicitante);
  formData.append('organismos_encargados', payload.organismos_encargados);

  if (payload.nota_voz) {
    formData.append('nota_voz', payload.nota_voz);
  }

  return apiClient.postForm('/registrar-requerimiento', formData);
}
