/**
 * API para el módulo Avanzadas: catálogos, creación (multipart, idempotente
 * por client_id), listado y detalle. Usa la misma base URL y convenciones de
 * autenticación Bearer que src/api/visitas.ts.
 */
import { apiClient, uploadApiClient } from '../lib/api-client';
import type { Avanzada, AsistenteAvanzada, RequerimientoAvanzada, CatalogosAvanzadas } from '../types/avanzadas';

/* ============================================================
 *  GET /avanzadas/catalogos
 * ============================================================ */
export async function getCatalogosAvanzadas(): Promise<CatalogosAvanzadas> {
  return apiClient.get<CatalogosAvanzadas>('/avanzadas/catalogos');
}

/* ============================================================
 *  POST /avanzadas — multipart/form-data
 *  Campo 'datos' = JSON string con el payload de la avanzada.
 *  Archivos opcionales: foto_equipo, fotos_req_{i} (máx. 5 c/u).
 * ============================================================ */
export interface CrearAvanzadaDatos {
  client_id: string;
  nombre_avanzada: string;
  fecha: string; // YYYY-MM-DD
  estrategia: string;
  sector: string;
  comuna: string;
  barrio: string;
  direccion: string;
  coordenadas: string; // "lat, lng"
  encargados: string[];
  asistentes: AsistenteAvanzada[];
  requerimientos: RequerimientoAvanzadaDatos[];
}

export interface CrearAvanzadaFiles {
  fotoEquipo?: File | null;
  /** Index-aligned with datos.requerimientos; each entry capped at 5 files. */
  fotosPorRequerimiento?: File[][];
}

export const MAX_FOTOS_POR_REQUERIMIENTO = 5;

export interface CrearAvanzadaResponse {
  success?: boolean;
  client_id: string;
  [key: string]: unknown;
}

export async function crearAvanzada(
  datos: CrearAvanzadaDatos,
  files: CrearAvanzadaFiles = {}
): Promise<CrearAvanzadaResponse> {
  const formData = new FormData();
  formData.append('datos', JSON.stringify(datos));

  if (files.fotoEquipo) {
    formData.append('foto_equipo', files.fotoEquipo);
  }

  if (files.fotosPorRequerimiento) {
    files.fotosPorRequerimiento.forEach((fotos, idx) => {
      (fotos || []).slice(0, MAX_FOTOS_POR_REQUERIMIENTO).forEach((file) => {
        formData.append(`fotos_req_${idx}`, file);
      });
    });
  }

  return uploadApiClient.postForm<CrearAvanzadaResponse>('/avanzadas', formData);
}

/* ============================================================
 *  PATCH /avanzadas/{client_id} — multipart/form-data (igual forma que POST).
 *  Campo 'datos' = JSON string con el payload de la avanzada, SIN client_id
 *  ni requerimientos (excluidos a propósito: los requerimientos son un
 *  sub-recurso aparte, ver agregarRequerimientoAvanzada más abajo).
 *  Archivos opcionales: foto_asistente_{i}, index-aligned con datos.asistentes.
 *  Nota: a diferencia de POST, este endpoint NO acepta foto_equipo — el
 *  contrato del backend para PATCH/PUT sólo agrega foto_asistente_{i}.
 * ============================================================ */
export type ActualizarAvanzadaDatos = Omit<CrearAvanzadaDatos, 'client_id' | 'requerimientos'>;

export interface ActualizarAvanzadaFiles {
  /** Index-aligned with datos.asistentes; a null entry means "no new photo for this row". */
  fotosPorAsistente?: (File | null)[];
}

export async function actualizarAvanzada(
  clientId: string,
  datos: ActualizarAvanzadaDatos,
  files: ActualizarAvanzadaFiles = {}
): Promise<Avanzada> {
  const formData = new FormData();
  formData.append('datos', JSON.stringify(datos));

  if (files.fotosPorAsistente) {
    files.fotosPorAsistente.forEach((file, idx) => {
      if (file) formData.append(`foto_asistente_${idx}`, file);
    });
  }

  return uploadApiClient.patchForm<Avanzada>(`/avanzadas/${encodeURIComponent(clientId)}`, formData);
}

/* ============================================================
 *  POST /avanzadas/{client_id}/requerimientos — multipart/form-data.
 *  Campo 'datos' = JSON string con el requerimiento (sin fotos_urls).
 *  Archivos repetibles: 'fotos' (máx. MAX_FOTOS_POR_REQUERIMIENTO).
 * ============================================================ */
export type RequerimientoAvanzadaDatos = Omit<RequerimientoAvanzada, 'fotos_urls' | 'id'>;

export async function agregarRequerimientoAvanzada(
  clientId: string,
  datos: RequerimientoAvanzadaDatos,
  fotos: File[] = []
): Promise<RequerimientoAvanzada> {
  const formData = new FormData();
  formData.append('datos', JSON.stringify(datos));

  fotos.slice(0, MAX_FOTOS_POR_REQUERIMIENTO).forEach((file) => {
    formData.append('fotos', file);
  });

  return uploadApiClient.postForm<RequerimientoAvanzada>(
    `/avanzadas/${encodeURIComponent(clientId)}/requerimientos`,
    formData
  );
}

/* ============================================================
 *  PATCH /avanzadas/{client_id}/requerimientos/{req_id} — multipart/form-data.
 *  Campo 'datos' = JSON string con los campos a actualizar (parcial), más
 *  'fotos_eliminar' (URLs de fotos existentes a borrar). Archivos repetibles:
 *  'fotos' (fotos nuevas a agregar, máx. MAX_FOTOS_POR_REQUERIMIENTO en total).
 *  Retorna el requerimiento completo ya actualizado.
 * ============================================================ */
export async function actualizarRequerimientoAvanzada(
  clientId: string,
  reqId: string,
  datos: Partial<RequerimientoAvanzadaDatos> & { fotos_eliminar?: string[] },
  nuevasFotos: File[] = []
): Promise<RequerimientoAvanzada> {
  const formData = new FormData();
  formData.append('datos', JSON.stringify(datos));

  nuevasFotos.slice(0, MAX_FOTOS_POR_REQUERIMIENTO).forEach((file) => {
    formData.append('fotos', file);
  });

  return uploadApiClient.patchForm<RequerimientoAvanzada>(
    `/avanzadas/${encodeURIComponent(clientId)}/requerimientos/${encodeURIComponent(reqId)}`,
    formData
  );
}

/* ============================================================
 *  DELETE /avanzadas/{client_id}/requerimientos/{req_id} — 204 No Content,
 *  sin cuerpo. Mismo patrón que eliminarCompromiso en api/jornadas.ts.
 * ============================================================ */
export async function eliminarRequerimientoAvanzada(clientId: string, reqId: string): Promise<void> {
  await apiClient.delete(`/avanzadas/${encodeURIComponent(clientId)}/requerimientos/${encodeURIComponent(reqId)}`);
}

/* ============================================================
 *  GET /avanzadas?limit=100
 *  Tolerante: acepta un array plano o { avanzadas: [...] }
 * ============================================================ */
export interface ListarAvanzadasItem extends Avanzada {
  requerimientos_count?: number;
}

type ListarAvanzadasResponse = { avanzadas: ListarAvanzadasItem[] } | ListarAvanzadasItem[];

export async function listarAvanzadas(limit = 100): Promise<ListarAvanzadasItem[]> {
  const res = await apiClient.get<ListarAvanzadasResponse>('/avanzadas', { limit: String(limit) });
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.avanzadas)) return res.avanzadas;
  return [];
}

/* ============================================================
 *  GET /avanzadas/{client_id}
 * ============================================================ */
export async function getAvanzada(clientId: string): Promise<Avanzada> {
  return apiClient.get<Avanzada>(`/avanzadas/${encodeURIComponent(clientId)}`);
}

/* ============================================================
 *  POST /avanzadas/clasificar-requerimiento
 *  Sugiere organismos destino a partir del texto libre del requerimiento
 *  (clasificación automática). Usado por el formulario como autocompletado
 *  no bloqueante — ver RequerimientoFormFields.svelte.
 * ============================================================ */
export interface ClasificarRequerimientoDatos {
  texto: string;
  tipo_requerimiento?: string;
  observaciones?: string;
}

export interface ClasificarRequerimientoResponse {
  organismos_sugeridos: string[];
  confianza: number;
  metodo: string;
  tipo_requerimiento: string;
  acciones_por_organismo: Record<string, unknown>;
}

export async function clasificarRequerimiento(
  datos: ClasificarRequerimientoDatos
): Promise<ClasificarRequerimientoResponse> {
  return apiClient.post<ClasificarRequerimientoResponse>(
    '/avanzadas/clasificar-requerimiento',
    datos as unknown as Record<string, unknown>
  );
}

/* ============================================================
 *  GET /avanzadas/{client_id}/reporte-pdf
 *  Descarga el informe PDF de la avanzada (reportes tipo informe de campo,
 *  con requerimientos por entidad y mapa de recorrido) y dispara la
 *  descarga en el navegador.
 * ============================================================ */
export async function descargarReporteAvanzadaPdf(clientId: string): Promise<void> {
  const blob = await apiClient.getBlob(`/avanzadas/${encodeURIComponent(clientId)}/reporte-pdf`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `informe-avanzada-${clientId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
