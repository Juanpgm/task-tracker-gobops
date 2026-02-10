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

/** Payload para POST /registrar-visita/ */
export interface RegistrarVisitaPayload {
  nombre_up: string;
  nombre_up_detalle: string;
  barrio_vereda: string;
  comuna_corregimiento: string;
  fecha_visita: string; // YYYY-MM-DD
}

/** Respuesta genérica de registro de visita */
export interface VisitaResponse {
  id?: number;
  vid?: string;
  message?: string;
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

/** Payload para POST /registrar-requerimiento */
export interface RequerimientoPayload {
  vid: string;
  centro_gestor_solicitante: string;
  solicitante_contacto: string;
  requerimiento: string;
  observaciones: string;
  direccion: string;
  barrio_vereda: string;
  comuna_corregimiento: string;
  latitud: string;
  longitud: string;
  telefono: string;
  email_solicitante: string;
  organismos_encargados: string;
  nota_voz?: File | null;
}

/** Coordenadas GPS */
export interface Coordenadas {
  latitud: number;
  longitud: number;
  accuracy?: number;
}

/** Usuario autenticado */
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
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

/** Respuesta de validación de sesión */
export interface ValidateSessionResponse {
  uid: string;
  email: string;
  role?: string;
  displayName?: string;
  [key: string]: unknown;
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
