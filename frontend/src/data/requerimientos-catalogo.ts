/**
 * Catálogo de casos de requerimiento y organismos involucrados.
 * Fuente: "2x3 actividades por organismo.xlsx" – hoja Diagnostico_2x3
 *
 * Columnas de referencia:
 *   A → Responsable (organismo)
 *   B → Categoría
 *   C → Subcategoría
 *   D → Condición / Caso (label para la selección)
 *   E → Acción / Intervención
 */

export interface OrganismoAccion {
  organismo: string;
  accion: string;
}

export interface CasoRequerimiento {
  id: string;
  label: string;       // Columna D – Condición / Caso
  categoria: string;   // Columna B – Categoría
  subcategoria: string; // Columna C – Subcategoría
  organismos: OrganismoAccion[]; // Derivado de col A (organismo) + col E (acción)
}

export const CATALOGO_CASOS: CasoRequerimiento[] = [
  // ─── Árboles – Emergencia arbórea ──────────────────────────────────────────
  {
    id: "arbol-enfermo",
    label: "Árbol enfermo",
    categoria: "Árboles",
    subcategoria: "Emergencia arbórea",
    organismos: [{ organismo: "DAGMA", accion: "Atención prioritaria" }],
  },
  {
    id: "arbol-caido",
    label: "Árbol caído / volcado",
    categoria: "Árboles",
    subcategoria: "Emergencia arbórea",
    organismos: [{ organismo: "DAGMA", accion: "Atención prioritaria" }],
  },
  {
    id: "ramas-caidas",
    label: "Ramas grandes caídas",
    categoria: "Árboles",
    subcategoria: "Emergencia arbórea",
    organismos: [{ organismo: "DAGMA", accion: "Atención prioritaria" }],
  },
  {
    id: "arbol-notable",
    label: "Árbol notable",
    categoria: "Árboles",
    subcategoria: "Emergencia arbórea",
    organismos: [{ organismo: "DAGMA", accion: "Evaluación especializada" }],
  },
  {
    id: "raices-riesgo",
    label: "Raíces con riesgo",
    categoria: "Árboles",
    subcategoria: "Emergencia arbórea",
    organismos: [{ organismo: "DAGMA", accion: "Evaluación y mitigación" }],
  },
  {
    id: "arbol-seco",
    label: "Árbol seco",
    categoria: "Árboles",
    subcategoria: "Emergencia arbórea",
    organismos: [{ organismo: "DAGMA", accion: "Reposición" }],
  },
  // ─── Árboles – Poda ────────────────────────────────────────────────────────
  {
    id: "arbol-energizado",
    label: "Árbol energizado",
    categoria: "Árboles",
    subcategoria: "Poda de árboles",
    organismos: [{ organismo: "EMCALI", accion: "Poda especializada" }],
  },
  {
    id: "poda-normal",
    label: "Poda normal",
    categoria: "Árboles",
    subcategoria: "Poda de árboles",
    organismos: [{ organismo: "UAESP", accion: "Poda mediante operador de aseo" }],
  },
  {
    id: "autorizacion-poda",
    label: "Autorización de poda",
    categoria: "Árboles",
    subcategoria: "Poda de árboles",
    organismos: [{ organismo: "DAGMA", accion: "Autorizar intervención" }],
  },
  // ─── Arbustos ──────────────────────────────────────────────────────────────
  {
    id: "arbusto-altura-sup",
    label: "Arbusto con altura superior al límite",
    categoria: "Arbustos",
    subcategoria: "Poda arbustos",
    organismos: [{ organismo: "DAGMA", accion: "Intervención" }],
  },
  {
    id: "arbusto-altura-inf",
    label: "Arbusto con altura inferior al límite",
    categoria: "Arbustos",
    subcategoria: "Poda arbustos",
    organismos: [{ organismo: "UAESP", accion: "Intervención" }],
  },
  {
    id: "arbusto-concertacion",
    label: "Retiro de arbusto (requiere concertación)",
    categoria: "Arbustos",
    subcategoria: "Retiro",
    organismos: [
      { organismo: "DAGMA", accion: "Concertar con comunidad" },
      { organismo: "UAESP", accion: "Concertar con comunidad" },
    ],
  },
  // ─── Siembra indiscriminada ────────────────────────────────────────────────
  {
    id: "especie-invasora",
    label: "Especie invasora",
    categoria: "Siembra indiscriminada",
    subcategoria: "Control vegetación",
    organismos: [{ organismo: "DAGMA", accion: "Retiro obligatorio" }],
  },
  {
    id: "altura-afectacion",
    label: "Altura que genera afectación",
    categoria: "Siembra indiscriminada",
    subcategoria: "Control vegetación",
    organismos: [{ organismo: "DAGMA", accion: "Traslado o retiro" }],
  },
  // ─── Recolección de basuras ────────────────────────────────────────────────
  {
    id: "rsd",
    label: "Residuos sólidos domiciliarios",
    categoria: "Recolección de basuras",
    subcategoria: "RSD",
    organismos: [{ organismo: "UAESP", accion: "Recolección ordinaria" }],
  },
  {
    id: "rcd",
    label: "Residuos de construcción y demolición",
    categoria: "Recolección de basuras",
    subcategoria: "RCD",
    organismos: [{ organismo: "UAESP", accion: "Recolección con pago" }],
  },
  {
    id: "voluminosos",
    label: "Residuos voluminosos",
    categoria: "Recolección de basuras",
    subcategoria: "Voluminosos",
    organismos: [{ organismo: "UAESP", accion: "Recolección con pago" }],
  },
  {
    id: "residuos-vegetales",
    label: "Residuos vegetales",
    categoria: "Recolección de basuras",
    subcategoria: "Vegetales",
    organismos: [
      { organismo: "UAESP", accion: "Determinar origen" },
      { organismo: "DAGMA", accion: "Determinar origen" },
      { organismo: "EMCALI", accion: "Determinar origen" },
      { organismo: "CVC", accion: "Determinar origen" },
    ],
  },
  // ─── Limpieza pública ──────────────────────────────────────────────────────
  {
    id: "barrido-vias",
    label: "Barrido de vías y áreas públicas",
    categoria: "Limpieza pública",
    subcategoria: "Barrido",
    organismos: [{ organismo: "UAESP", accion: "Barrido y limpieza" }],
  },
  {
    id: "pasto-andenes",
    label: "Pasto en andenes (desmoñe)",
    categoria: "Limpieza pública",
    subcategoria: "Desmoñe",
    organismos: [{ organismo: "UAESP", accion: "Retiro maleza" }],
  },
  {
    id: "zona-verde-adoptada",
    label: "Zona verde adoptada (empresa adoptante)",
    categoria: "Limpieza pública",
    subcategoria: "Zona verde adoptada",
    organismos: [{ organismo: "DAGMA", accion: "Seguimiento mantenimiento" }],
  },
  {
    id: "corte-cesped",
    label: "Corte de césped (zona verde no adoptada)",
    categoria: "Limpieza pública",
    subcategoria: "Zona verde no adoptada",
    organismos: [{ organismo: "UAESP", accion: "Mantenimiento" }],
  },
  {
    id: "jardines",
    label: "Coordinación de jardines",
    categoria: "Limpieza pública",
    subcategoria: "Jardines",
    organismos: [
      { organismo: "DAGMA", accion: "Gestión conjunta" },
      { organismo: "UAESP", accion: "Gestión conjunta" },
    ],
  },
  // ─── Alumbrado público ─────────────────────────────────────────────────────
  {
    id: "luminaria-apagada",
    label: "Luminaria apagada",
    categoria: "Alumbrado público",
    subcategoria: "Luminaria",
    organismos: [
      { organismo: "UAESP", accion: "Reparación" },
      { organismo: "EMCALI", accion: "Reparación" },
    ],
  },
  {
    id: "poste-danado",
    label: "Poste dañado",
    categoria: "Alumbrado público",
    subcategoria: "Poste",
    organismos: [
      { organismo: "UAESP", accion: "Reposición e iluminación" },
      { organismo: "EMCALI", accion: "Reposición e iluminación" },
    ],
  },
  {
    id: "cambio-led",
    label: "Cambio a LED",
    categoria: "Alumbrado público",
    subcategoria: "Modernización",
    organismos: [
      { organismo: "UAESP", accion: "Actualización" },
      { organismo: "EMCALI", accion: "Actualización" },
    ],
  },
  {
    id: "dano-ornamental",
    label: "Daño en luces ornamentales",
    categoria: "Alumbrado público",
    subcategoria: "Luces ornamentales",
    organismos: [{ organismo: "UAESP", accion: "Mantenimiento" }],
  },
  // ─── Acueducto y alcantarillado ────────────────────────────────────────────
  {
    id: "sumideros",
    label: "Limpieza de sumideros",
    categoria: "Acueducto y alcantarillado",
    subcategoria: "Sumideros",
    organismos: [{ organismo: "EMCALI", accion: "Limpieza" }],
  },
  {
    id: "tapas",
    label: "Reposición de tapas",
    categoria: "Acueducto y alcantarillado",
    subcategoria: "Tapas",
    organismos: [{ organismo: "EMCALI", accion: "Reposición" }],
  },
  {
    id: "camaras",
    label: "Nivelación de cámaras",
    categoria: "Acueducto y alcantarillado",
    subcategoria: "Cámaras",
    organismos: [{ organismo: "EMCALI", accion: "Nivelación" }],
  },
  // ─── Habitante de calle ────────────────────────────────────────────────────
  {
    id: "cambuche",
    label: "Presencia de cambuche",
    categoria: "Habitante de calle",
    subcategoria: "Cambuches",
    organismos: [
      { organismo: "Bienestar Social", accion: "Abordaje + desmonte + recolección" },
      { organismo: "SSJ", accion: "Abordaje + desmonte + recolección" },
      { organismo: "UAESP", accion: "Abordaje + desmonte + recolección" },
    ],
  },
  {
    id: "abordaje-social",
    label: "Abordaje social (oferta institucional)",
    categoria: "Habitante de calle",
    subcategoria: "Oferta institucional",
    organismos: [{ organismo: "Bienestar Social", accion: "Oferta de servicios" }],
  },
  // ─── Invasión espacio público ──────────────────────────────────────────────
  {
    id: "ventas-informales",
    label: "Ventas informales (ocupación informal)",
    categoria: "Invasión espacio público",
    subcategoria: "Ventas informales",
    organismos: [
      { organismo: "SSJ", accion: "Control y formalización" },
      { organismo: "Desarrollo Económico", accion: "Control y formalización" },
      { organismo: "Salud", accion: "Control y formalización" },
    ],
  },
  {
    id: "ocupacion-comercial",
    label: "Ocupación comercial de espacio público",
    categoria: "Invasión espacio público",
    subcategoria: "Establecimientos",
    organismos: [
      { organismo: "SSJ", accion: "Control e inspección" },
      { organismo: "DAGMA", accion: "Control e inspección" },
      { organismo: "Salud", accion: "Control e inspección" },
    ],
  },
  // ─── Ruido ─────────────────────────────────────────────────────────────────
  {
    id: "ruido-comercial",
    label: "Ruido comercial (establecimientos)",
    categoria: "Ruido",
    subcategoria: "Establecimientos",
    organismos: [
      { organismo: "SSJ", accion: "Control" },
      { organismo: "Policía", accion: "Control" },
      { organismo: "DAGMA", accion: "Control" },
    ],
  },
  {
    id: "ruido-residencial",
    label: "Ruido residencial (viviendas)",
    categoria: "Ruido",
    subcategoria: "Viviendas",
    organismos: [
      { organismo: "SSJ", accion: "Control" },
      { organismo: "Policía", accion: "Control" },
    ],
  },
  {
    id: "ruido-informal",
    label: "Ruido de ventas informales",
    categoria: "Ruido",
    subcategoria: "Ventas informales",
    organismos: [
      { organismo: "SSJ", accion: "Control" },
      { organismo: "Policía", accion: "Control" },
    ],
  },
  // ─── Movilidad ─────────────────────────────────────────────────────────────
  {
    id: "senalizacion",
    label: "Ausencia o daño en señalización",
    categoria: "Movilidad",
    subcategoria: "Señalización",
    organismos: [{ organismo: "Secretaría de Movilidad", accion: "Instalación o reposición" }],
  },
  {
    id: "bolardos",
    label: "Bolardos dañados",
    categoria: "Movilidad",
    subcategoria: "Bolardos",
    organismos: [{ organismo: "Secretaría de Movilidad", accion: "Mantenimiento" }],
  },
  {
    id: "reductor",
    label: "Reductor de velocidad dañado",
    categoria: "Movilidad",
    subcategoria: "Reductores",
    organismos: [{ organismo: "Secretaría de Movilidad", accion: "Mantenimiento" }],
  },
  {
    id: "semaforo",
    label: "Semáforo apagado",
    categoria: "Movilidad",
    subcategoria: "Semáforos",
    organismos: [{ organismo: "Secretaría de Movilidad", accion: "Reparación" }],
  },
  // ─── Otros ─────────────────────────────────────────────────────────────────
  {
    id: "barandal",
    label: "Barandal en mal estado",
    categoria: "Otros",
    subcategoria: "Barandales",
    organismos: [{ organismo: "UAESP", accion: "Reparación o pintura" }],
  },
  {
    id: "bordillos",
    label: "Pintura de bordillos",
    categoria: "Otros",
    subcategoria: "Bordillos",
    organismos: [{ organismo: "Participación", accion: "Pintura" }],
  },
];

/** Lista de categorías únicas, en orden de aparición */
export const CATEGORIAS_CASOS: string[] = [
  ...new Set(CATALOGO_CASOS.map((c) => c.categoria)),
];

/** Casos filtrados por categoría */
export function getCasosByCategoria(categoria: string): CasoRequerimiento[] {
  return CATALOGO_CASOS.filter((c) => c.categoria === categoria);
}

/** Caso por ID */
export function getCasoById(id: string): CasoRequerimiento | undefined {
  return CATALOGO_CASOS.find((c) => c.id === id);
}
