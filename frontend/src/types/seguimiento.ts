/**
 * Tipos para el módulo de Seguimiento de Requerimientos
 * Flujo: Programar Visita → Registrar Requerimientos → Gestión Kanban
 */

import type { UnidadProyecto } from './index';

/* ============================================================
 *  COLABORADORES
 * ============================================================ */
export interface Colaborador {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  cargo: string;
  centro_gestor: string;
}

/* ============================================================
 *  VISITAS PROGRAMADAS
 * ============================================================ */
export type EstadoVisita = 'programada' | 'en-curso' | 'finalizada' | 'cancelada';

export interface VisitaProgramada {
  id: string;
  upid: string;
  unidad_proyecto?: UnidadProyecto | null;
  // Ubicación manual (cuando no hay UP asociada)
  direccion_manual?: string;
  barrio_vereda?: string;
  comuna_corregimiento?: string;
  referencia_ubicacion?: string;     // establecimientos cercanos, puntos de referencia
  latitud?: string;
  longitud?: string;
  geocoding_source?: 'gps' | 'manual' | 'geocoded';
  fecha_visita: string;           // YYYY-MM-DD
  hora_inicio?: string;           // HH:mm
  hora_fin?: string;              // HH:mm
  estado: EstadoVisita;
  colaboradores: Colaborador[];
  observaciones?: string;
  descripcion_visita?: string;
  created_at: string;
  updated_at: string;
}

/* ============================================================
 *  SOLICITANTES (personas de la comunidad que piden algo)
 * ============================================================ */
export interface Solicitante {
  id: string;
  nombre_completo: string;
  cedula: string;
  telefono: string;
  email: string;
  direccion: string;
  barrio_vereda: string;
  comuna_corregimiento: string;
}

/* ============================================================
 *  REQUERIMIENTOS (asociados a una visita programada)
 * ============================================================ */
export type EstadoRequerimiento =
  | 'nuevo'
  | 'radicado'
  | 'en-gestion'
  | 'asignado'
  | 'en-proceso'
  | 'resuelto'
  | 'cerrado'
  | 'cancelado';

export interface EvidenciaRequerimiento {
  id: string;
  tipo: 'foto' | 'documento' | 'nota';
  url: string;
  descripcion: string;
  fecha: string;
}

export interface RegistroAvance {
  id: string;
  fecha: string;
  autor: string;
  descripcion: string;
  estado_anterior: EstadoRequerimiento;
  estado_nuevo: EstadoRequerimiento;
  evidencias: EvidenciaRequerimiento[];
  porcentaje_avance: number;
}

export interface DocumentoAdjunto {
  nombre: string;
  url: string;
  tipo: string;
}

export interface Transcripcion {
  archivo: string;
  transcripcion: string;
  duracion_segundos?: number;
  idioma?: string;
}

export interface Requerimiento {
  id: string;
  rid?: string;
  visita_id: string;
  tipo_requerimiento?: string;
  solicitante: Solicitante;
  centros_gestores: string[];       // multiselect: EMCALI, DAGMA, etc.
  descripcion: string;
  observaciones: string;
  direccion: string;
  latitud: string;
  longitud: string;
  evidencia_fotos: string[];        // URLs de fotos
  nota_voz_url?: string | null;     // URL del audio grabado
  transcripciones?: Transcripcion[]; // Transcripciones de notas de voz
  documentos_adjuntos: DocumentoAdjunto[]; // Fotos/docs subidos a S3
  estado: EstadoRequerimiento;
  encargado?: string;                // persona asignada del centro gestor
  enlace_id?: string;                // ID del enlace del organismo asignado
  enlace_nombre?: string;            // nombre del enlace (desnormalizado)
  fecha_propuesta_solucion?: string; // habilitada al asignar enlace
  porcentaje_avance: number;         // 0-100
  historial: RegistroAvance[];
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  // Orfeo / petición oficial
  numero_orfeo?: string;             // código único del documento oficial
  fecha_radicado_orfeo?: string;     // fecha de radicado en orfeo
  documento_peticion_url?: string;   // URL del documento de petición subido
  documento_peticion_nombre?: string;// nombre del archivo subido
  // Cancelación
  motivo_cancelacion?: string;       // argumentación de la cancelación
  documento_cancelacion_url?: string;// URL del documento oficial de cancelación
  documento_cancelacion_nombre?: string;
  created_at: string;
  updated_at: string;
}

/* ============================================================
 *  ENLACES (representantes de cada organismo/centro gestor)
 * ============================================================ */
export interface Enlace {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  cargo: string;
  centro_gestor_id: string;       // id del CentroGestor
  centro_gestor_nombre: string;   // nombre display
  dependencia?: string;           // subdependencia dentro del centro gestor
  activo: boolean;
}

/* ============================================================
 *  CENTRO GESTOR (entidades disponibles)
 * ============================================================ */
export interface CentroGestor {
  id: string;
  nombre: string;
  sigla: string;
  color: string;
}

/* ============================================================
 *  COLUMNAS KANBAN
 * ============================================================ */
export interface KanbanColumn {
  id: EstadoRequerimiento;
  title: string;
  color: string;
  icon: string;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'nuevo',      title: 'Nuevos',       color: '#6b7280', icon: '' },
  { id: 'en-proceso', title: 'En Proceso',   color: '#f97316', icon: '' },
  { id: 'resuelto',   title: 'Resueltos',    color: '#22c55e', icon: '' },
  { id: 'cerrado',    title: 'Cerrados',     color: '#64748b', icon: '' },
  { id: 'cancelado',  title: 'Cancelados',   color: '#ef4444', icon: '' },
];
