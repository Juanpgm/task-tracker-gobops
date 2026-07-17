/**
 * Catálogo de datos para el módulo Avanzadas: estrategias, equipo, dependencias
 * y categorías por entidad. Sirve como respaldo offline (fallback) cuando
 * GET /avanzadas/catalogos falla o no hay conexión.
 */
import type { CatalogosAvanzadas } from '../types/avanzadas';

export const ESTRATEGIAS_AVANZADAS: string[] = [
  'En Un 2x3',
  'Cali En Obra verifica',
  'Plan de Choque',
];

export const EQUIPO_AVANZADAS: string[] = [
  'Ana Maria Carabali',
  'Cristian Andres Toledo',
  'Catalina Rincon Montes',
  'Erika Bibiana Ramirez',
  'Jorge Leonardo Campaz',
  'Luz Stella Lopez Molano',
  'Rodolfo Ramos Bonilla',
  'Victor Hugo Ruales Lopez',
];

export const DEPENDENCIAS_AVANZADAS: string[] = [
  'Bienestar Social - Secretaría de Bienestar Social',
  'Cultura - Secretaría de Cultura',
  'Deporte - Secretaría del Deporte y la Recreación',
  'Desarrollo Económico - Secretaría de Desarrollo Económico',
  'Participación - Secretaría de Desarrollo Territorial y Participación Ciudadana',
  'Educación - Secretaría de Educación',
  'Gestión del Riesgo - Secretaría de Gestión del Riesgo de Emergencias y Desastres',
  'Gobierno - Secretaría de Gobierno',
  'Infraestructura - Secretaría de Infraestructura',
  'Movilidad - Secretaría de Movilidad',
  'Paz y Cultura Ciudadana - Secretaría de Paz y Cultura Ciudadana',
  'Salud - Secretaría de Salud Pública',
  'Seguridad y Justicia - Secretaría de Seguridad y Justicia',
  'Turismo - Secretaría de Turismo',
  'Vivienda - Secretaría de Vivienda Social y Hábitat',
  'DAPM - Departamento Administrativo de Planeación Municipal',
  'DAGMA - Departamento Administrativo de Gestión del Medio Ambiente',
  'Hacienda - Departamento Administrativo de Hacienda',
  'TIC - Departamento Administrativo de Tecnologías de la Información y las Comunicaciones',
  'Jurídica - Departamento Administrativo de Gestión Jurídica Pública',
  'Contratación - Departamento Administrativo de Contratación Pública',
  'DADII - Departamento Administrativo de Desarrollo e Innovación Institucional',
  'Control Interno - Departamento Administrativo de Control Interno',
  'Disciplinario Instrucción - Depto. Adm. de Control Disciplinario Interno de Instrucción',
  'Disciplinario Juzgamiento - Depto. Adm. de Control Disciplinario Interno de Juzgamiento',
  'UAESP - Unidad Administrativa Especial de Servicios Públicos Municipales',
  'UAEPA - Unidad Administrativa Especial de Protección Animal',
  'UAEGBS - Unidad Administrativa Especial de Gestión de Bienes y Servicios',
  'Estudios Takeshima - Unidad Administrativa Especial Estudios Takeshima',
  'Teatro Municipal - Unidad Administrativa Especial Teatro Municipal Enrique Buenaventura',
  'EMCALI - Empresas Municipales de Cali',
  'Metro Cali - Metro Cali S.A.',
  'EnRuta - Empresa de Transporte Masivo EnRuta',
  'EDRU - Empresa de Desarrollo y Renovación Urbana',
  'Corfecali - Corporación de Eventos, Ferias y Espectáculos de Cali',
  'FEV - Fondo Especial de Vivienda',
  'Escuela Nacional del Deporte - Institución Universitaria',
  'UNIAJC - Institución Universitaria Antonio José Camacho',
  'IUIPC - Institución Universitaria de las Culturas y las Artes Populares',
  'ESE - Empresas Sociales del Estado (Red Pública de Salud)',
  'Otra entidad',
];

export const CATEGORIAS_AVANZADAS: Record<string, string[]> = {
  DAGMA: [
    'Poda de árboles (autorización)',
    'Emergencia arbórea — árbol enfermo',
    'Emergencia arbórea — árbol caído/volcado',
    'Emergencia arbórea — ramas caídas de gran tamaño',
    'Emergencia arbórea — árboles notables (Samán, Gavilán, etc.)',
    'Emergencia arbórea — raíces que obstaculizan o riesgo de volcamiento',
    'Emergencia arbórea — reposición de árboles secos',
    'Siembra indiscriminada — traslado de árboles',
    'Siembra indiscriminada — retiro de especie invasora (Leucaena, etc.)',
    'Siembra indiscriminada — árboles frutales/plátanos/café en vía pública',
    'Arbustos — poda (mayor a altura límite DAGMA)',
    'Arbustos — retiro por seguridad',
    'Residuos vegetales — control a establecimientos/construcciones',
    'Visita de control RCD/RSD a establecimientos comerciales',
    'Zonas verdes adoptadas — seguimiento de mantenimiento',
    'Siembra de jardines',
    'Zonas verdes no adoptadas — jardines (conciliar con UAESP/vivero DAGMA)',
    'Ruido — establecimientos comerciales',
    'Invasión espacio público — establecimientos comerciales',
    'Tratamiento Fitosanitario (árbol)',
    'Extracción de Raices',
    'Invasión de hormiga arrierra',
    'Censo arboles',
    'FAUNA Y FLORA',
    'Poda de Realce',
    'Control de vectores',
    'Presencia colmena de Abejas o Avispas',
    'Otro — DAGMA',
  ],
  UAESP: [
    'Poda de árboles (a través de empresa de aseo)',
    'Arbustos — poda (menor a altura límite)',
    'Recolección RCD — Residuos de construcción y demolición',
    'Recolección RSD — Residuos sólidos domiciliarios',
    'Recolección de voluminosos',
    'Residuos vegetales — recolección',
    'Barrido y limpieza de vías y áreas públicas',
    'Desmoñe — retiro de pasto en baldosas/andenes',
    'Zonas verdes no adoptadas — corte de césped',
    'Alumbrado público — luminaria apagada',
    'Alumbrado público — poste en mal estado',
    'Alumbrado público — instalación de luminaria',
    'Alumbrado público — cambio a LED / modernización',
    'Alumbrado público — reposición de tapas',
    'Luces ornamentales',
    'Habitante de calle — recogida de escombros de cambuches',
    'Luminaria encendida (Día)',
    'Poda formación',
    'Otro — UAESP',
  ],
  EMCALI: [
    'Poda de árbol energizado (media/alta tensión)',
    'Residuos vegetales — recolección (cuando EMCALI hizo la poda)',
    'Alumbrado público — luminaria apagada',
    'Alumbrado público — poste en mal estado',
    'Alumbrado público — instalación de luminaria',
    'Alumbrado público — cambio a LED / modernización',
    'Alumbrado público — reposición de tapas',
    'Acueducto — limpieza de sumideros',
    'Acueducto — reposición de tapas',
    'Acueducto — nivelación de cámaras',
    'Alcantarillado — limpieza de sumideros',
    'Alcantarillado — reposición de tapas',
    'Alcantarillado — nivelación de cámaras',
    'Luminaria encendida (Día)',
    'Tapa ausente',
    'Tapa en mal estado',
    'Comunicaciones',
    'Poda de Árbol Despeje de Redes',
    'Tensión y Orden de Redes Secundarias',
    'Otro — EMCALI',
  ],
  'Bienestar Social': [
    'Habitante de calle — abordaje institucional',
    'Habitante de calle — oferta de servicios',
    'Cambuches — abordaje social',
    'Otro — Bienestar Social',
  ],
  'Seguridad y Justicia': [
    'Invasión espacio público — ventas informales (IVC)',
    'Invasión espacio público — establecimientos comerciales (IVC)',
    'Habitante de calle — desmonte de cambuches (IVC)',
    'Ruido — establecimientos comerciales',
    'Ruido — viviendas',
    'Ruido — ventas informales',
    'Invasión de espacio público - Vehículo abandonado en la vía',
    'Otro — Seguridad y Justicia',
  ],
  Movilidad: [
    'Ausencia de señalización/demarcación',
    'Señalización/demarcación borrosa o en mal estado',
    'Señalética en mal estado',
    'Reposición de señalética',
    'Segregadores (bolardos) en mal estado',
    'Reductor de velocidad en mal estado',
    'Señalización deteriorada de reductor de velocidad',
    'Solicitud de reductor de velocidad',
    'Semáforo apagado',
    'Otro — Movilidad',
  ],
  Salud: ['Invasión espacio público — manejo de alimentos', 'Otro — Salud'],
  'Desarrollo Económico': ['Ventas informales — formalización', 'Otro — Desarrollo Económico'],
  Participación: [
    'Barandales en mal estado (pintura, deterioro)',
    'Pintura de bordillos de andenes',
    'Otro — Participación',
  ],
  Infraestructura: [
    'Andenes en mal estado',
    'Vías en mal estado',
    'Escaleras / rampas en mal estado',
    'Muro de contención deteriorado',
    'Via sin Andenes',
    'Retiro de residuos de asfalto',
    'Otro — Infraestructura',
  ],
  'Gestión del Riesgo': ['Zona de riesgo por deslizamiento', 'Zona de riesgo por inundación', 'Otro — Gestión del Riesgo'],
  Deporte: ['Daño en andenes parque', 'Daño en Ciclorruta'],
  Gobierno: ['Embellecimiento zona verde'],
  'Metro Cali': ['Señalización parada del mío'],
};

export const CATALOGO_AVANZADAS_FALLBACK: CatalogosAvanzadas = {
  estrategias: ESTRATEGIAS_AVANZADAS,
  equipo: EQUIPO_AVANZADAS,
  dependencias: DEPENDENCIAS_AVANZADAS,
  categorias: CATEGORIAS_AVANZADAS,
};

/**
 * Extrae el acrónimo/prefijo de una dependencia con forma "ACRONIMO - Nombre completo".
 * Si no hay separador ' - ', retorna el texto recortado tal cual.
 */
export function extractAcronimo(dependencia: string): string {
  const trimmed = dependencia.trim();
  const idx = trimmed.indexOf(' - ');
  return idx === -1 ? trimmed : trimmed.slice(0, idx).trim();
}

/**
 * Resuelve la lista de categorías disponibles para una entidad (texto libre o
 * seleccionado de un datalist). Intenta match exacto, luego por acrónimo
 * extraído, luego case-insensitive. Retorna [] si no hay categorías conocidas.
 */
export function getCategoriasParaEntidad(
  entidad: string,
  categorias: Record<string, string[]>
): string[] {
  if (!entidad || !entidad.trim()) return [];
  const trimmed = entidad.trim();

  if (categorias[trimmed]) return categorias[trimmed];

  const acronimo = extractAcronimo(trimmed);
  if (categorias[acronimo]) return categorias[acronimo];

  const key = Object.keys(categorias).find(
    (k) => k.toLowerCase() === acronimo.toLowerCase()
  );
  return key ? categorias[key] : [];
}

/**
 * Combina el catálogo remoto (API) con el catálogo local de respaldo,
 * uniendo arrays sin duplicados. Las categorías se combinan por clave (entidad).
 */
export function mergeCatalogos(
  remote: CatalogosAvanzadas,
  fallback: CatalogosAvanzadas
): CatalogosAvanzadas {
  const mergeUnique = (a: string[] = [], b: string[] = []): string[] =>
    Array.from(new Set([...a, ...b]));

  const categorias: Record<string, string[]> = { ...fallback.categorias };
  for (const [key, values] of Object.entries(remote.categorias || {})) {
    categorias[key] = mergeUnique(categorias[key], values);
  }

  return {
    estrategias: mergeUnique(remote.estrategias, fallback.estrategias),
    equipo: mergeUnique(remote.equipo, fallback.equipo),
    dependencias: mergeUnique(remote.dependencias, fallback.dependencias),
    categorias,
  };
}
