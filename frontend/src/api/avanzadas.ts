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
  requerimientos: RequerimientoAvanzada[];
}

export interface CrearAvanzadaFiles {
  fotoEquipo?: File | null;
  /** Index-aligned with datos.requerimientos; each entry capped at 5 files. */
  fotosPorRequerimiento?: File[][];
}

const MAX_FOTOS_POR_REQUERIMIENTO = 5;

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
