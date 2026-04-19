/**
 * Datos mock para desarrollo local
 * Se reemplazará por endpoints reales cuando el backend los implemente
 */

import type {
  Colaborador,
  VisitaProgramada,
  Requerimiento,
  Solicitante,
  CentroGestor,
  Enlace,
} from '../types/seguimiento';

/* ============================================================
 *  CENTROS GESTORES (entidades de la alcaldía)
 * ============================================================ */
export const CENTROS_GESTORES: CentroGestor[] = [
  { id: 'contratacion',   nombre: 'Departamento Administrativo de Contratación Pública',                     sigla: 'DACP',    color: '#2563eb' },
  { id: 'disc-interno',   nombre: 'Departamento Administrativo de Control Disciplinario Interno',            sigla: 'DACDI',   color: '#475569' },
  { id: 'disc-instruc',   nombre: 'Departamento Administrativo de Control Disciplinario Interno de Instrucción', sigla: 'DACDII', color: '#64748b' },
  { id: 'ctrl-interno',   nombre: 'Departamento Administrativo de Control Interno',                          sigla: 'DACI',    color: '#6b7280' },
  { id: 'innovacion',     nombre: 'Departamento Administrativo de Desarrollo e Innovación Institucional',    sigla: 'DADII',   color: '#7c3aed' },
  { id: 'juridica',       nombre: 'Departamento Administrativo de Gestión Jurídica Pública',                 sigla: 'DAGJP',   color: '#4f46e5' },
  { id: 'medio-ambiente', nombre: 'Departamento Administrativo de Gestión del Medio Ambiente',               sigla: 'DAGMA',   color: '#16a34a' },
  { id: 'hacienda',       nombre: 'Departamento Administrativo de Hacienda',                                 sigla: 'DAH',     color: '#ca8a04' },
  { id: 'planeacion',     nombre: 'Departamento Administrativo de Planeación',                               sigla: 'DAP',     color: '#be185d' },
  { id: 'planeacion-mpal', nombre: 'Departamento Administrativo de Planeación Municipal',                    sigla: 'DAPM',    color: '#a21caf' },
  { id: 'tic',            nombre: 'Departamento Administrativo de Tecnologías de la Información y las Comunicaciones', sigla: 'DATIC', color: '#6366f1' },
  { id: 'bienestar',      nombre: 'Secretaría de Bienestar Social',                                         sigla: 'SBS',     color: '#d946ef' },
  { id: 'cultura',        nombre: 'Secretaría de Cultura',                                                   sigla: 'SCULT',   color: '#9333ea' },
  { id: 'desarrollo-eco', nombre: 'Secretaría de Desarrollo Económico',                                      sigla: 'SDE',     color: '#059669' },
  { id: 'desarrollo-ter', nombre: 'Secretaría de Desarrollo Territorial y Participación Ciudadana',          sigla: 'SDTPC',   color: '#0d9488' },
  { id: 'educacion',      nombre: 'Secretaría de Educación',                                                 sigla: 'SEDU',    color: '#7c3aed' },
  { id: 'riesgo',         nombre: 'Secretaría de Gestión del Riesgo de Emergencias y Desastres',             sigla: 'SGRED',   color: '#dc2626' },
  { id: 'gobierno',       nombre: 'Secretaría de Gobierno',                                                  sigla: 'SGOB',    color: '#475569' },
  { id: 'infraestructura', nombre: 'Secretaría de Infraestructura',                                          sigla: 'SINFRA',  color: '#b45309' },
  { id: 'movilidad',      nombre: 'Secretaría de Movilidad',                                                 sigla: 'SMOV',    color: '#0891b2' },
  { id: 'paz',            nombre: 'Secretaría de Paz y Cultura Ciudadana',                                   sigla: 'SPCC',    color: '#0d9488' },
  { id: 'salud',          nombre: 'Secretaría de Salud Pública',                                             sigla: 'SSP',     color: '#dc2626' },
  { id: 'seguridad',      nombre: 'Secretaría de Seguridad y Justicia',                                      sigla: 'SSJ',     color: '#1e40af' },
  { id: 'turismo',        nombre: 'Secretaría de Turismo',                                                   sigla: 'STUR',    color: '#ea580c' },
  { id: 'vivienda',       nombre: 'Secretaría de Vivienda Social y Hábitat',                                 sigla: 'SVSH',    color: '#65a30d' },
  { id: 'deporte',        nombre: 'Secretaría del Deporte y la Recreación',                                  sigla: 'SDR',     color: '#ea580c' },
  { id: 'bienes',         nombre: 'Unidad Administrativa Especial de Gestión de Bienes y Servicios',         sigla: 'UAEGBS',  color: '#78716c' },
  { id: 'protec-animal',  nombre: 'Unidad Administrativa Especial de Protección Animal',                     sigla: 'UAEPA',   color: '#84cc16' },
  { id: 'serv-publicos',  nombre: 'Unidad Administrativa Especial de Servicios Públicos',                    sigla: 'UAESP',   color: '#f59e0b' },
  { id: 'emcali',         nombre: 'EMCALI',                                                                  sigla: 'EMCALI',  color: '#2563eb' },
];

/* ============================================================
 *  COLABORADORES (equipo de trabajo)
 * ============================================================ */
export const MOCK_COLABORADORES: Colaborador[] = [
  { id: 'col-001', nombre: 'María Fernanda López', email: 'mlopez@cali.gov.co', telefono: '3101234567', cargo: 'Coordinadora de Visitas', centro_gestor: 'Infraestructura' },
  { id: 'col-002', nombre: 'Carlos Andrés Muñoz', email: 'cmunoz@cali.gov.co', telefono: '3209876543', cargo: 'Inspector de Obra', centro_gestor: 'Infraestructura' },
  { id: 'col-003', nombre: 'Ana Patricia Vargas', email: 'avargas@cali.gov.co', telefono: '3157894561', cargo: 'Ingeniera Civil', centro_gestor: 'Infraestructura' },
  { id: 'col-004', nombre: 'Jorge Enrique Silva', email: 'jsilva@cali.gov.co', telefono: '3183456789', cargo: 'Gestor Social', centro_gestor: 'Bienestar Social' },
  { id: 'col-005', nombre: 'Diana Marcela Rojas', email: 'drojas@cali.gov.co', telefono: '3124567890', cargo: 'Arquitecta', centro_gestor: 'Planeación' },
  { id: 'col-006', nombre: 'Andrés Felipe García', email: 'agarcia@cali.gov.co', telefono: '3176543210', cargo: 'Técnico Ambiental', centro_gestor: 'DAGMA' },
  { id: 'col-007', nombre: 'Laura Sofía Martínez', email: 'lmartinez@cali.gov.co', telefono: '3141234567', cargo: 'Supervisora', centro_gestor: 'Infraestructura' },
  { id: 'col-008', nombre: 'Roberto Carlos Peña', email: 'rpena@cali.gov.co', telefono: '3198765432', cargo: 'Interventor', centro_gestor: 'Infraestructura' },
];

/* ============================================================
 *  ENLACES (representantes de organismos en terreno)
 * ============================================================ */
export const MOCK_ENLACES: Enlace[] = [
  // EMCALI
  { id: 'enl-001', nombre: 'Héctor Fabio Ramírez', email: 'hramirez@emcali.com.co', telefono: '3161234567', cargo: 'Ingeniero de Redes', centro_gestor_id: 'emcali', centro_gestor_nombre: 'EMCALI', dependencia: 'Acueducto y Alcantarillado', activo: true },
  { id: 'enl-002', nombre: 'Patricia Elena Sánchez', email: 'psanchez@emcali.com.co', telefono: '3169876543', cargo: 'Coordinadora de Zona', centro_gestor_id: 'emcali', centro_gestor_nombre: 'EMCALI', dependencia: 'Energía', activo: true },
  { id: 'enl-003', nombre: 'Julio César Arango', email: 'jarango@emcali.com.co', telefono: '3165551234', cargo: 'Técnico de Campo', centro_gestor_id: 'emcali', centro_gestor_nombre: 'EMCALI', dependencia: 'Telecomunicaciones', activo: false },
  // DAGMA
  { id: 'enl-004', nombre: 'Claudia Patricia Henao', email: 'chenao@dagma.gov.co', telefono: '3171234567', cargo: 'Bióloga Ambiental', centro_gestor_id: 'dagma', centro_gestor_nombre: 'DAGMA', dependencia: 'Arborización', activo: true },
  { id: 'enl-005', nombre: 'Fernando José Castillo', email: 'fcastillo@dagma.gov.co', telefono: '3179876543', cargo: 'Inspector Ambiental', centro_gestor_id: 'dagma', centro_gestor_nombre: 'DAGMA', dependencia: 'Control Ambiental', activo: true },
  // Cultura
  { id: 'enl-006', nombre: 'Valentina Restrepo Gómez', email: 'vrestrepo@cultura.gov.co', telefono: '3181234567', cargo: 'Gestora Cultural', centro_gestor_id: 'cultura', centro_gestor_nombre: 'Secretaría de Cultura', dependencia: 'Patrimonio', activo: true },
  // Deporte
  { id: 'enl-007', nombre: 'Andrés Camilo Mejía', email: 'amejia@deporte.gov.co', telefono: '3189876543', cargo: 'Coordinador Deportivo', centro_gestor_id: 'deporte', centro_gestor_nombre: 'Secretaría del Deporte y la Recreación', dependencia: 'Infraestructura Deportiva', activo: true },
  { id: 'enl-008', nombre: 'Marcela Viviana Torres', email: 'mtorres@deporte.gov.co', telefono: '3185551234', cargo: 'Promotora Recreativa', centro_gestor_id: 'deporte', centro_gestor_nombre: 'Secretaría del Deporte y la Recreación', dependencia: 'Recreación Comunitaria', activo: true },
  // Salud
  { id: 'enl-009', nombre: 'Gloria Esperanza Díaz', email: 'gdiaz@salud.gov.co', telefono: '3191234567', cargo: 'Epidemióloga', centro_gestor_id: 'salud', centro_gestor_nombre: 'Secretaría de Salud Pública', dependencia: 'Salud Pública', activo: true },
  // Movilidad
  { id: 'enl-010', nombre: 'Oscar Iván Londoño', email: 'olondono@movilidad.gov.co', telefono: '3199876543', cargo: 'Ingeniero de Tránsito', centro_gestor_id: 'movilidad', centro_gestor_nombre: 'Secretaría de Movilidad', dependencia: 'Señalización', activo: true },
  { id: 'enl-011', nombre: 'Sandra Milena Ocampo', email: 'socampo@movilidad.gov.co', telefono: '3195551234', cargo: 'Inspectora Vial', centro_gestor_id: 'movilidad', centro_gestor_nombre: 'Secretaría de Movilidad', dependencia: 'Seguridad Vial', activo: true },
  // Infraestructura
  { id: 'enl-012', nombre: 'William Alberto Cortés', email: 'wcortes@infra.gov.co', telefono: '3201234567', cargo: 'Ingeniero de Obras', centro_gestor_id: 'infraestructura', centro_gestor_nombre: 'Secretaría de Infraestructura', dependencia: 'Obras Civiles', activo: true },
  { id: 'enl-013', nombre: 'Liliana María Duque', email: 'lduque@infra.gov.co', telefono: '3209876543', cargo: 'Arquitecta Urbanista', centro_gestor_id: 'infraestructura', centro_gestor_nombre: 'Secretaría de Infraestructura', dependencia: 'Planeación de Obras', activo: true },
  // Vivienda
  { id: 'enl-014', nombre: 'Jairo Hernán Patiño', email: 'jpatino@vivienda.gov.co', telefono: '3211234567', cargo: 'Asesor de Vivienda', centro_gestor_id: 'vivienda', centro_gestor_nombre: 'Secretaría de Vivienda Social', dependencia: 'Mejoramiento Integral', activo: true },
  // Educación
  { id: 'enl-015', nombre: 'Adriana Lucía Bermúdez', email: 'abermudez@edu.gov.co', telefono: '3219876543', cargo: 'Coordinadora Educativa', centro_gestor_id: 'edu', centro_gestor_nombre: 'Secretaría de Educación', dependencia: 'Infraestructura Educativa', activo: true },
  // Planeación
  { id: 'enl-016', nombre: 'Germán Eduardo Ríos', email: 'grios@planeacion.gov.co', telefono: '3221234567', cargo: 'Urbanista', centro_gestor_id: 'planeacion', centro_gestor_nombre: 'Departamento de Planeación', dependencia: 'Ordenamiento Territorial', activo: true },
  // Gobierno
  { id: 'enl-017', nombre: 'Martha Cecilia Vélez', email: 'mvelez@gobierno.gov.co', telefono: '3229876543', cargo: 'Comisaria de Familia', centro_gestor_id: 'gobierno', centro_gestor_nombre: 'Secretaría de Gobierno', dependencia: 'Convivencia', activo: true },
  // Paz
  { id: 'enl-018', nombre: 'Diego Alejandro Muñoz', email: 'dmunoz@paz.gov.co', telefono: '3231234567', cargo: 'Gestor de Paz', centro_gestor_id: 'paz', centro_gestor_nombre: 'Secretaría de Paz y Cultura Ciudadana', dependencia: 'Mediación Comunitaria', activo: true },
  // Bienestar
  { id: 'enl-019', nombre: 'Carolina Andrea López', email: 'calopez@bienestar.gov.co', telefono: '3239876543', cargo: 'Trabajadora Social', centro_gestor_id: 'bienestar', centro_gestor_nombre: 'Secretaría de Bienestar Social', dependencia: 'Atención a Población Vulnerable', activo: true },
  // TIC
  { id: 'enl-020', nombre: 'Sebastián Felipe Castro', email: 'scastro@tic.gov.co', telefono: '3241234567', cargo: 'Especialista TIC', centro_gestor_id: 'tic', centro_gestor_nombre: 'Secretaría de Desarrollo Económico y TIC', dependencia: 'Transformación Digital', activo: true },
];

/* ============================================================
 *  VISITAS PROGRAMADAS (mock)
 * ============================================================ */
export const MOCK_VISITAS: VisitaProgramada[] = [
  {
    id: 'vis-001',
    upid: 'INF-BPIN-2020760010690-0019',
    unidad_proyecto: {
      upid: 'INF-BPIN-2020760010690-0019',
      nombre_up: 'Vía Rural',
      nombre_up_detalle: 'Mezcla Caliente',
      tipo_equipamiento: 'Vias',
      tipo_intervencion: 'Recarpeteo',
      estado: 'Terminado',
      avance_obra: '100.0',
      presupuesto_base: '30159728.68',
      direccion: 'Avenida 43 Con Calle 5',
    },
    fecha_visita: '2026-02-15',
    hora_inicio: '09:00',
    hora_fin: '12:00',
    estado: 'programada',
    colaboradores: [MOCK_COLABORADORES[0], MOCK_COLABORADORES[1], MOCK_COLABORADORES[3]],
    observaciones: 'Verificar estado final de la vía después de recarpeteo',
    created_at: '2026-02-08T10:00:00Z',
    updated_at: '2026-02-08T10:00:00Z',
  },
  {
    id: 'vis-002',
    upid: 'INF-BPIN-2020760010690-0050',
    unidad_proyecto: {
      upid: 'INF-BPIN-2020760010690-0050',
      nombre_up: 'Vía Rural',
      nombre_up_detalle: 'Mezcla Caliente',
      tipo_equipamiento: 'Vias',
      tipo_intervencion: 'Fresado',
      estado: 'Terminado',
      avance_obra: '100.0',
      presupuesto_base: '89641415.68',
      direccion: 'Via Guacas-Golondrinas - La Paz',
    },
    fecha_visita: '2026-02-12',
    hora_inicio: '08:00',
    hora_fin: '11:00',
    estado: 'en-curso',
    colaboradores: [MOCK_COLABORADORES[2], MOCK_COLABORADORES[4], MOCK_COLABORADORES[5]],
    observaciones: 'Visita de verificación de fresado completado',
    created_at: '2026-02-05T14:00:00Z',
    updated_at: '2026-02-10T08:00:00Z',
  },
  {
    id: 'vis-003',
    upid: 'INF-BPIN-2020760010690-0065',
    unidad_proyecto: {
      upid: 'INF-BPIN-2020760010690-0065',
      nombre_up: 'Vía Rural',
      nombre_up_detalle: 'Mezcla Caliente',
      tipo_equipamiento: 'Vias',
      tipo_intervencion: 'Fresado',
      estado: 'Terminado',
      avance_obra: '100.0',
      presupuesto_base: '5654949.12',
      direccion: 'Cabecera Los Andes',
    },
    fecha_visita: '2026-02-01',
    hora_inicio: '10:00',
    hora_fin: '13:00',
    estado: 'finalizada',
    colaboradores: [MOCK_COLABORADORES[0], MOCK_COLABORADORES[6], MOCK_COLABORADORES[7]],
    observaciones: 'Visita completada - se generaron 4 requerimientos',
    created_at: '2026-01-28T09:00:00Z',
    updated_at: '2026-02-01T14:00:00Z',
  },
];

/* ============================================================
 *  REQUERIMIENTOS (mock con historial)
 * ============================================================ */
export const MOCK_REQUERIMIENTOS: Requerimiento[] = [];

/* ============================================================
 *  HELPERS
 * ============================================================ */

let _visitaCounter = MOCK_VISITAS.length;
let _reqCounter = MOCK_REQUERIMIENTOS.length;

export function generateVisitaId(): string {
  _visitaCounter++;
  return `vis-${String(_visitaCounter).padStart(3, '0')}`;
}

export function generateRequerimientoId(): string {
  _reqCounter++;
  return `req-${String(_reqCounter).padStart(3, '0')}`;
}
