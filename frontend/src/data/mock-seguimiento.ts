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
  { id: 'emcali',         nombre: 'EMCALI',                                    sigla: 'EMCALI',  color: '#2563eb' },
  { id: 'dagma',          nombre: 'DAGMA',                                     sigla: 'DAGMA',   color: '#16a34a' },
  { id: 'cultura',        nombre: 'Secretaría de Cultura',                     sigla: 'CULT',    color: '#9333ea' },
  { id: 'deporte',        nombre: 'Secretaría del Deporte y la Recreación',    sigla: 'DEP',     color: '#ea580c' },
  { id: 'salud',          nombre: 'Secretaría de Salud Pública',               sigla: 'SALUD',   color: '#dc2626' },
  { id: 'movilidad',      nombre: 'Secretaría de Movilidad',                   sigla: 'MOV',     color: '#0891b2' },
  { id: 'infraestructura', nombre: 'Secretaría de Infraestructura',            sigla: 'INFRA',   color: '#ca8a04' },
  { id: 'vivienda',       nombre: 'Secretaría de Vivienda Social',             sigla: 'VIV',     color: '#65a30d' },
  { id: 'edu',            nombre: 'Secretaría de Educación',                   sigla: 'EDU',     color: '#7c3aed' },
  { id: 'planeacion',     nombre: 'Departamento de Planeación',                sigla: 'PLAN',    color: '#be185d' },
  { id: 'gobierno',       nombre: 'Secretaría de Gobierno',                    sigla: 'GOB',     color: '#475569' },
  { id: 'paz',            nombre: 'Secretaría de Paz y Cultura Ciudadana',     sigla: 'PAZ',     color: '#0d9488' },
  { id: 'bienestar',      nombre: 'Secretaría de Bienestar Social',            sigla: 'BIEN',    color: '#d946ef' },
  { id: 'tic',            nombre: 'Secretaría de Desarrollo Económico y TIC',  sigla: 'TIC',     color: '#6366f1' },
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
export const MOCK_REQUERIMIENTOS: Requerimiento[] = [
  {
    id: 'req-001',
    visita_id: 'vis-003',
    solicitante: {
      id: 'sol-001',
      nombre_completo: 'Juana Esperanza Torres',
      cedula: '31456789',
      telefono: '3201234567',
      email: 'juanatorres@gmail.com',
      direccion: 'Calle 15 #45-23',
      barrio_vereda: 'Los Andes',
      comuna_corregimiento: 'Comuna 19',
    },
    centros_gestores: ['EMCALI', 'DAGMA'],
    descripcion: 'Se requiere revisión del alcantarillado que quedó afectado por las obras de la vía. Adicionalmente hay árboles que fueron dañados y necesitan ser reemplazados.',
    observaciones: 'La señora indica que lleva 3 meses con el problema de alcantarillado',
    direccion: 'Calle 15 #45-23',
    latitud: '3.42564098',
    longitud: '-76.61724315',
    evidencia_fotos: ['https://placehold.co/400x300?text=Alcantarillado', 'https://placehold.co/400x300?text=Arbol+Dañado'],
    estado: 'en-gestion',
    encargado: 'Carlos Andrés Muñoz',
    enlace_id: 'enl-001',
    enlace_nombre: 'Héctor Fabio Ramírez',
    porcentaje_avance: 45,
    prioridad: 'alta',
    historial: [
      {
        id: 'hist-001',
        fecha: '2026-02-01T14:30:00Z',
        autor: 'María Fernanda López',
        descripcion: 'Requerimiento registrado durante visita de verificación',
        estado_anterior: 'nuevo',
        estado_nuevo: 'nuevo',
        evidencias: [],
        porcentaje_avance: 0,
      },
      {
        id: 'hist-002',
        fecha: '2026-02-03T09:15:00Z',
        autor: 'María Fernanda López',
        descripcion: 'Se radicó el caso ante EMCALI con número 2026-02-R001 y ante DAGMA con radicado AMD-456',
        estado_anterior: 'nuevo',
        estado_nuevo: 'radicado',
        evidencias: [
          { id: 'ev-001', tipo: 'documento', url: '#', descripcion: 'Radicado EMCALI 2026-02-R001', fecha: '2026-02-03' },
        ],
        porcentaje_avance: 15,
      },
      {
        id: 'hist-003',
        fecha: '2026-02-06T11:00:00Z',
        autor: 'Carlos Andrés Muñoz',
        descripcion: 'Se comunicó con el ingeniero de EMCALI responsable de la zona. Programan visita técnica para el 12 de febrero.',
        estado_anterior: 'radicado',
        estado_nuevo: 'en-gestion',
        evidencias: [],
        porcentaje_avance: 45,
      },
    ],
    created_at: '2026-02-01T14:30:00Z',
    updated_at: '2026-02-06T11:00:00Z',
  },
  {
    id: 'req-002',
    visita_id: 'vis-003',
    solicitante: {
      id: 'sol-001',
      nombre_completo: 'Juana Esperanza Torres',
      cedula: '31456789',
      telefono: '3201234567',
      email: 'juanatorres@gmail.com',
      direccion: 'Calle 15 #45-23',
      barrio_vereda: 'Los Andes',
      comuna_corregimiento: 'Comuna 19',
    },
    centros_gestores: ['Secretaría del Deporte y la Recreación'],
    descripcion: 'El parque infantil cercano a la obra quedó sin mantenimiento. Los juegos están oxidados y representan peligro para los niños.',
    observaciones: 'La comunidad solicita intervención integral del espacio deportivo',
    direccion: 'Calle 15 #45-23 (Parque aledaño)',
    latitud: '3.42570000',
    longitud: '-76.61730000',
    evidencia_fotos: ['https://placehold.co/400x300?text=Parque+Deteriorado'],
    estado: 'radicado',
    encargado: undefined,
    porcentaje_avance: 15,
    prioridad: 'media',
    historial: [
      {
        id: 'hist-004',
        fecha: '2026-02-01T15:00:00Z',
        autor: 'María Fernanda López',
        descripcion: 'Requerimiento registrado - misma solicitante, diferente necesidad',
        estado_anterior: 'nuevo',
        estado_nuevo: 'nuevo',
        evidencias: [],
        porcentaje_avance: 0,
      },
      {
        id: 'hist-005',
        fecha: '2026-02-04T10:00:00Z',
        autor: 'Jorge Enrique Silva',
        descripcion: 'Radicado ante Sec. de Deporte y Recreación. Número RAD-DEP-2026-089',
        estado_anterior: 'nuevo',
        estado_nuevo: 'radicado',
        evidencias: [],
        porcentaje_avance: 15,
      },
    ],
    created_at: '2026-02-01T15:00:00Z',
    updated_at: '2026-02-04T10:00:00Z',
  },
  {
    id: 'req-003',
    visita_id: 'vis-003',
    solicitante: {
      id: 'sol-002',
      nombre_completo: 'Pedro Antonio Méndez',
      cedula: '16789456',
      telefono: '3159876543',
      email: 'pedro.mendez@hotmail.com',
      direccion: 'Carrera 50 #13-10',
      barrio_vereda: 'Los Andes',
      comuna_corregimiento: 'Comuna 19',
    },
    centros_gestores: ['Secretaría de Movilidad'],
    descripcion: 'Falta señalización vial en el cruce de la Carrera 50 con Calle 13. Después de la obra no se reinstalaron las señales de tránsito.',
    observaciones: 'Ha habido 2 accidentes menores en la última semana por falta de señalización',
    direccion: 'Carrera 50 #13-10',
    latitud: '3.42600000',
    longitud: '-76.61750000',
    evidencia_fotos: ['https://placehold.co/400x300?text=Sin+Señalizacion'],
    estado: 'resuelto',
    encargado: 'Ana Patricia Vargas',
    enlace_id: 'enl-010',
    enlace_nombre: 'Oscar Iván Londoño',
    porcentaje_avance: 100,
    prioridad: 'urgente',
    historial: [
      {
        id: 'hist-006',
        fecha: '2026-02-01T15:30:00Z',
        autor: 'Laura Sofía Martínez',
        descripcion: 'Requerimiento urgente registrado en campo',
        estado_anterior: 'nuevo',
        estado_nuevo: 'nuevo',
        evidencias: [],
        porcentaje_avance: 0,
      },
      {
        id: 'hist-007',
        fecha: '2026-02-02T08:00:00Z',
        autor: 'Ana Patricia Vargas',
        descripcion: 'Se escaló como urgente a Sec. de Movilidad por riesgo de accidentalidad',
        estado_anterior: 'nuevo',
        estado_nuevo: 'radicado',
        evidencias: [],
        porcentaje_avance: 20,
      },
      {
        id: 'hist-008',
        fecha: '2026-02-03T14:00:00Z',
        autor: 'Ana Patricia Vargas',
        descripcion: 'Movilidad envió cuadrilla de señalización. Se instalaron 3 señales de pare y demarcación de paso peatonal.',
        estado_anterior: 'radicado',
        estado_nuevo: 'en-proceso',
        evidencias: [
          { id: 'ev-002', tipo: 'foto', url: 'https://placehold.co/400x300?text=Señales+Instaladas', descripcion: 'Señalización reinstalada', fecha: '2026-02-03' },
        ],
        porcentaje_avance: 80,
      },
      {
        id: 'hist-009',
        fecha: '2026-02-05T16:00:00Z',
        autor: 'Ana Patricia Vargas',
        descripcion: 'Señalización completa verificada en sitio. Caso resuelto satisfactoriamente.',
        estado_anterior: 'en-proceso',
        estado_nuevo: 'resuelto',
        evidencias: [
          { id: 'ev-003', tipo: 'foto', url: 'https://placehold.co/400x300?text=Verificacion+Final', descripcion: 'Verificación final en sitio', fecha: '2026-02-05' },
        ],
        porcentaje_avance: 100,
      },
    ],
    created_at: '2026-02-01T15:30:00Z',
    updated_at: '2026-02-05T16:00:00Z',
  },
  {
    id: 'req-004',
    visita_id: 'vis-002',
    solicitante: {
      id: 'sol-003',
      nombre_completo: 'Rosa Elena Caicedo',
      cedula: '66123456',
      telefono: '3187654321',
      email: 'rosa.caicedo@gmail.com',
      direccion: 'Vereda La Paz - Sector Central',
      barrio_vereda: 'La Paz',
      comuna_corregimiento: 'Corregimiento La Paz',
    },
    centros_gestores: ['EMCALI', 'Secretaría de Infraestructura'],
    descripcion: 'El muro de contención al lado de la vía nueva presenta grietas. Además no hay servicio de agua potable en la zona desde hace 1 semana.',
    observaciones: 'Situación de riesgo para 15 familias del sector',
    direccion: 'Vereda La Paz km 3',
    latitud: '3.47536991',
    longitud: '-76.53267439',
    evidencia_fotos: ['https://placehold.co/400x300?text=Muro+Agrietado', 'https://placehold.co/400x300?text=Sin+Agua'],
    estado: 'asignado',
    encargado: 'Roberto Carlos Peña',
    enlace_id: 'enl-012',
    enlace_nombre: 'William Alberto Cortés',
    porcentaje_avance: 30,
    prioridad: 'alta',
    historial: [
      {
        id: 'hist-010',
        fecha: '2026-02-10T09:00:00Z',
        autor: 'Ana Patricia Vargas',
        descripcion: 'Requerimiento registrado durante visita en curso',
        estado_anterior: 'nuevo',
        estado_nuevo: 'nuevo',
        evidencias: [],
        porcentaje_avance: 0,
      },
      {
        id: 'hist-011',
        fecha: '2026-02-10T11:30:00Z',
        autor: 'Diana Marcela Rojas',
        descripcion: 'Se asignó al interventor Roberto Peña para seguimiento integral del caso',
        estado_anterior: 'nuevo',
        estado_nuevo: 'asignado',
        evidencias: [],
        porcentaje_avance: 30,
      },
    ],
    created_at: '2026-02-10T09:00:00Z',
    updated_at: '2026-02-10T11:30:00Z',
  },
  {
    id: 'req-005',
    visita_id: 'vis-003',
    solicitante: {
      id: 'sol-004',
      nombre_completo: 'Miguel Ángel Ospina',
      cedula: '16234567',
      telefono: '3141112233',
      email: 'mospina@yahoo.com',
      direccion: 'Calle 14 #48-05',
      barrio_vereda: 'Los Andes',
      comuna_corregimiento: 'Comuna 19',
    },
    centros_gestores: ['Secretaría de Cultura', 'Secretaría del Deporte y la Recreación'],
    descripcion: 'Solicitar intervención conjunta para la recuperación del mural comunitario y la cancha del barrio que fueron afectados durante las obras.',
    observaciones: 'El mural fue pintado por jóvenes del programa "Cali Cultura" hace 2 años',
    direccion: 'Calle 14 #48-05',
    latitud: '3.42580000',
    longitud: '-76.61710000',
    evidencia_fotos: ['https://placehold.co/400x300?text=Mural+Dañado', 'https://placehold.co/400x300?text=Cancha+Afectada'],
    estado: 'nuevo',
    encargado: undefined,
    porcentaje_avance: 0,
    prioridad: 'media',
    historial: [
      {
        id: 'hist-012',
        fecha: '2026-02-01T16:00:00Z',
        autor: 'Jorge Enrique Silva',
        descripcion: 'Registrado en campo. El solicitante pide intervención cultural y deportiva.',
        estado_anterior: 'nuevo',
        estado_nuevo: 'nuevo',
        evidencias: [],
        porcentaje_avance: 0,
      },
    ],
    created_at: '2026-02-01T16:00:00Z',
    updated_at: '2026-02-01T16:00:00Z',
  },
];

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
