/* ========== Types & Interfaces ========== */

/** Unidades de proyecto retornadas por GET /unidades-proyecto/init-360 */
export interface UnidadProyecto {
  upid: string;
  nombre_up: string;
  nombre_up_detalle: string;
  tipo_equipamiento: string;
  tipo_intervencion: string;
  estado: string;
  avance_obra: string;
  presupuesto_base: string;
  geometry?: {
    coordinates: string;
    type: string;
  };
  direccion: string;
}

/** Modelo de acompañante para POST /registrar-visita/ */
export interface AcompananteModel {
  nombre_completo: string;
  telefono: string;
  email: string;
  centro_gestor: string;
}

/** Contacto del directorio (GET /obtener_directorio_contactos) */
export interface ContactoDirectorio {
  id: string;
  funcion: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
  telefono: string;
  centro_gestor: string;
}

/** Respuesta de GET /obtener_directorio_contactos */
export interface DirectorioContactosResponse {
  success: boolean;
  total: number;
  contactos: ContactoDirectorio[];
  timestamp: string;
}

/** Payload para POST /registrar-visita/ (JSON body) */
export interface RegistrarVisitaPayload {
  barrio_vereda: string;
  comuna_corregimiento: string;
  descripcion_visita: string;
  observaciones_visita: string;
  acompanantes?: AcompananteModel[];
  fecha_visita: string;  // dd/mm/aaaa
  hora_visita: string;   // HH:mm
}

/** Respuesta genérica de registro de visita */
export interface VisitaResponse {
  success: boolean;
  vid: string;
  message: string;
  barrio_vereda: string;
  comuna_corregimiento: string;
  descripcion_visita: string;
  observaciones_visita: string;
  acompanantes: AcompananteModel;
  fecha_visita: string;
  hora_visita: string;
  timestamp: string;
  [key: string]: unknown;
}

/** Reporte del grupo operativo (GET /grupo-operativo/reportes) */
export interface Reporte {
  reporte_id: number;
  nombre_up: string;
  nombre_up_detalle: string;
  barrio_vereda: string;
  comuna_corregimiento: string;
  fecha_visita: string;
  created_at?: string;
  [key: string]: unknown;
}

/** Payload para POST /registrar-asistencia-delegado */
export interface AsistenciaDelegadoPayload {
  vid: string;
  id_acompanante: string;
  nombre_completo: string;
  rol: string;
  nombre_centro_gestor: string;
  telefono: string;
  email: string;
  latitud: string;
  longitud: string;
}

/** Payload para POST /registrar-asistencia-comunidad */
export interface AsistenciaComunidadPayload {
  vid: string;
  id_asistente_comunidad: string;
  nombre_completo: string;
  rol_comunidad: string;
  direccion: string;
  barrio_vereda: string;
  comuna_corregimiento: string;
  telefono: string;
  email: string;
  latitud: string;
  longitud: string;
}

/** Payload para POST /registrar-requerimiento (multipart/form-data) */
export interface RequerimientoPayload {
  vid: string;
  datos_solicitante: string;       // JSON string: { personas: [...] }
  tipo_requerimiento: string;
  requerimiento: string;
  direccion_requerimiento?: string;
  observaciones: string;
  coords: string;                  // GeoJSON Point: {"type":"Point","coordinates":[lng,lat]}
  organismos_encargados: string;   // JSON array: ["DAGMA", "Secretaría de Obras"]
  nota_voz?: File | null;
  evidencias?: File[] | null;      // Fotos/videos para subir a S3
}

/** Respuesta de POST /registrar-requerimiento */
export interface RequerimientoResponse {
  success: boolean;
  vid: string;
  rid: string;
  message: string;
  datos_solicitante: Record<string, unknown>;
  tipo_requerimiento: string;
  requerimiento: string;
  observaciones: string;
  barrio_vereda: string | null;
  comuna_corregimiento: string | null;
  coords: { type: string; coordinates: number[] };
  estado: string;
  nota_voz_url: string | null;
  fecha_registro: string;
  organismos_encargados: string[];
  timestamp: string;
}

/** Payload para POST /seguimiento/visitas (JSON body, Bearer token) */
export interface ProgramarVisitaBody {
  upid: string;
  unidad_proyecto: Record<string, unknown>;
  fecha_visita: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  colaboradores?: string[];
  observaciones?: string | null;
}

/** Respuesta de POST/GET /seguimiento/visitas */
export interface VisitaProgramadaOut {
  id: string;
  upid: string;
  unidad_proyecto: Record<string, unknown>;
  fecha_visita: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  estado: string;
  colaboradores: Record<string, unknown>[];
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

/** Modelo de solicitante para POST /seguimiento/requerimientos */
export interface SolicitanteModel {
  id?: string | null;
  nombre_completo: string;
  cedula: string;
  telefono: string;
  email: string;
  direccion: string;
  barrio_vereda: string;
  comuna_corregimiento: string;
}

/** Payload para POST /seguimiento/requerimientos (JSON body, Bearer token) */
export interface CrearRequerimientoBody {
  visita_id: string;
  solicitante: SolicitanteModel;
  centros_gestores: string[];
  descripcion: string;
  observaciones: string;
  direccion: string;
  latitud: string;
  longitud: string;
  evidencia_fotos?: string[];
  prioridad?: string;
}

/** Respuesta de POST/GET /seguimiento/requerimientos */
export interface RequerimientoOut {
  id: string;
  visita_id: string;
  solicitante: SolicitanteModel;
  centros_gestores: string[];
  descripcion: string;
  observaciones: string;
  direccion: string;
  latitud: string;
  longitud: string;
  evidencia_fotos: string[];
  estado: string;
  encargado: string | null;
  enlace_id: string | null;
  enlace_nombre: string | null;
  fecha_propuesta_solucion: string | null;
  porcentaje_avance: number;
  prioridad: string;
  historial: Record<string, unknown>[];
  numero_orfeo: string | null;
  fecha_radicado_orfeo: string | null;
  documento_peticion_url: string | null;
  documento_peticion_nombre: string | null;
  motivo_cancelacion: string | null;
  documento_cancelacion_url: string | null;
  documento_cancelacion_nombre: string | null;
  created_at: string;
  updated_at: string;
}

/** Coordenadas GPS */
export interface Coordenadas {
  latitud: number;
  longitud: number;
  accuracy?: number;
}

/** Rol disponible en el sistema */
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

/** Permiso temporal del usuario */
export interface TemporaryPermission {
  permission: string;
  expires_at: string; // ISO timestamp
  granted_at: string;
  granted_by?: string;
}

/** Usuario autenticado con información de control de accesos */
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  full_name?: string;
  role?: string;
  roles?: string[]; // Roles asignados al usuario
  permissions?: string[]; // Permisos heredados de roles
  temporary_permissions?: TemporaryPermission[]; // Permisos temporales
  cellphone?: string;
  nombre_centro_gestor?: string;
  is_super_admin?: boolean;
  is_admin?: boolean;
  token: string;
  [key: string]: unknown;
}

/** Estado de autenticación del store */
export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

/** Respuesta de validación de sesión desde backend */
export interface ValidateSessionResponse {
  uid: string;
  email: string;
  full_name?: string;
  displayName?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  temporary_permissions?: TemporaryPermission[];
  cellphone?: string;
  nombre_centro_gestor?: string;
  is_super_admin?: boolean;
  is_admin?: boolean;
  [key: string]: unknown;
}

/** Respuesta de login desde backend */
export interface LoginResponse extends ValidateSessionResponse {
  token?: string;
  id_token?: string;
}

/** Payload para POST /auth/login */
export interface UserLoginRequest {
  id_token: string;
}

/** Payload para POST /auth/register */
export interface RegisterUserPayload {
  email: string;
  password: string;
  full_name: string;
  cellphone: string;
  nombre_centro_gestor: string;
}

/** Payload para POST /auth/change-password */
export interface ChangePasswordPayload {
  uid: string;
  new_password: string;
}

/** Payload para POST /auth/google */
export interface GoogleAuthPayload {
  google_token: string;
}

/** Payload para asignar roles a un usuario */
export interface AssignRolesRequest {
  roles: string[];
}

/** Payload para otorgar permisos temporales */
export interface GrantTemporaryPermissionRequest {
  permission: string;
  expires_at: string; // ISO timestamp
}
