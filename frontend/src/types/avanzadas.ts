/**
 * Tipos para el módulo Avanzadas: captura simple de avanzadas de estrategias
 * (una sola pantalla, offline-first). Reemplaza el flujo pesado de
 * Visitas Programadas → Registrar Requerimientos.
 */

/** Persona que asistió a la avanzada (comunidad, organismos, etc.) */
export interface AsistenteAvanzada {
  nombre: string;
  organismo: string;
  celular: string;
  correo: string;
  /** URL de la foto del asistente (existente a conservar), u omitida/null si no tiene. */
  foto_url?: string | null;
}

/** Requerimiento levantado durante la avanzada, asignado a una entidad/categoría */
export interface RequerimientoAvanzada {
  entidad: string;
  categoria: string;
  categoria_personalizada: string | null;
  requerimiento: string;
  ubicacion: string;
  coordenadas: string | null;
  /**
   * URLs de fotos del requerimiento. Mezcla dos formatos sin campo
   * discriminador: enlaces de Google Drive (datos migrados) y URLs de S3
   * (datos nuevos). Ver src/lib/media-urls.ts antes de renderizar.
   */
  fotos_urls?: string[];
}

/** Modelo completo de una Avanzada (payload + metadatos de servidor) */
export interface Avanzada {
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
  requerimientos_count?: number;
  foto_equipo_url?: string | null;
  /** Enlace (típicamente de Google Drive) al acta/informe de la avanzada. */
  informe_url?: string | null;
  created_at?: string;
  updated_at?: string;
  isOffline?: boolean;
}

/** Catálogos usados por el formulario de Avanzadas (GET /avanzadas/catalogos) */
export interface CatalogosAvanzadas {
  estrategias: string[];
  equipo: string[];
  dependencias: string[];
  categorias: Record<string, string[]>;
}
