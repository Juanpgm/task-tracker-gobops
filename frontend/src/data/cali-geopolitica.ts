/**
 * Estructura geopolítica de Santiago de Cali, Colombia
 * Fuente: División político-administrativa oficial
 */

export interface BarrioVereda {
  nombre: string;
}

export interface ComunaCorregimiento {
  nombre: string;
  tipo: 'comuna' | 'corregimiento' | 'aeu';
  barrios_veredas: BarrioVereda[];
}

export const CALI_GEOPOLITICA: ComunaCorregimiento[] = [
  // ========== COMUNAS (ÁREA URBANA) ==========
  {
    nombre: 'Comuna 1',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Salomia' },
      { nombre: 'El Calvario' },
      { nombre: 'Fátima' },
      { nombre: 'Bella Vista' },
      { nombre: 'San Nicolás' },
      { nombre: 'Las Delicias' },
      { nombre: 'Altos de Normandía' },
      { nombre: 'Santa Elena' },
      { nombre: 'El Piloto' }
    ]
  },
  {
    nombre: 'Comuna 2',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Obrero' },
      { nombre: 'La Base' },
      { nombre: 'San Cayetano' },
      { nombre: 'Santa Rosa' },
      { nombre: 'Mariano Ramos' },
      { nombre: 'Belisario Caicedo' },
      { nombre: 'Sucre' },
      { nombre: 'Caldas' },
      { nombre: 'Miraflores' },
      { nombre: 'Pueblo Joven' },
      { nombre: 'San Pascual' }
    ]
  },
  {
    nombre: 'Comuna 3',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'San Nicolás' },
      { nombre: 'La Merced' },
      { nombre: 'El Peñón' },
      { nombre: 'Santa Rosa (C3)' },
      { nombre: 'La Capilla' },
      { nombre: 'Alameda' },
      { nombre: 'San Antonio' },
      { nombre: 'Av. Colombia' },
      { nombre: 'Granada' },
      { nombre: 'Tequendama' },
      { nombre: 'Santa Elena (C3)' }
    ]
  },
  {
    nombre: 'Comuna 4',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'San Fernando Viejo' },
      { nombre: 'San Fernando Nuevo' },
      { nombre: 'Popular' },
      { nombre: 'Bretaña' },
      { nombre: 'Manzanares' },
      { nombre: 'Alfonso López' },
      { nombre: 'Jorge Isaacs' },
      { nombre: 'Los Andes' },
      { nombre: 'Colseguros' },
      { nombre: 'San Pedro' }
    ]
  },
  {
    nombre: 'Comuna 5',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Santa Rita Alta' },
      { nombre: 'Santa Rita Baja' },
      { nombre: 'San Carlos' },
      { nombre: 'San Judás Tadeo Norte' },
      { nombre: 'San Judás Tadeo Sur' },
      { nombre: 'Champagnat' },
      { nombre: 'Tejares' },
      { nombre: 'Las Américas' },
      { nombre: 'El Hoyo' },
      { nombre: 'Guayaquil' },
      { nombre: 'Sultana' }
    ]
  },
  {
    nombre: 'Comuna 6',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'San Joaquín' },
      { nombre: 'Antonio Nariño' },
      { nombre: 'Salomia (C6)' },
      { nombre: 'El Ingenio' },
      { nombre: 'Acopi' },
      { nombre: 'Los Libertadores' },
      { nombre: 'Villa del Sur' },
      { nombre: 'Ulpiano Lloreda' },
      { nombre: 'Aguablanca' },
      { nombre: 'Manuela Beltrán' }
    ]
  },
  {
    nombre: 'Comuna 7',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'El Poblado I' },
      { nombre: 'El Poblado II' },
      { nombre: 'La Paz' },
      { nombre: 'Comuneros I' },
      { nombre: 'Comuneros II' },
      { nombre: 'Marroquín I' },
      { nombre: 'Marroquín II' },
      { nombre: 'Los Robles' },
      { nombre: 'Caldas (C7)' },
      { nombre: 'Alfonso Bonilla Aragón' }
    ]
  },
  {
    nombre: 'Comuna 8',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Mojica' },
      { nombre: 'Bolivariano' },
      { nombre: 'Ricardo Balcázar' },
      { nombre: 'Terrón Colorado' },
      { nombre: 'Vallado' },
      { nombre: 'Potrero Grande' },
      { nombre: 'Villa del Lago' },
      { nombre: 'Los Conquistadores' },
      { nombre: 'Urbanización Tejares' }
    ]
  },
  {
    nombre: 'Comuna 9',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'El Vergel' },
      { nombre: 'Bartolome de las Casas' },
      { nombre: 'Ulpiano Lloreda (C9)' },
      { nombre: 'Los Samanes' },
      { nombre: 'Camino Real' },
      { nombre: 'Vistahermosa' },
      { nombre: 'Villa Colombia' },
      { nombre: 'Calipso' },
      { nombre: 'El Remanso' }
    ]
  },
  {
    nombre: 'Comuna 10',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'La Base (C10)' },
      { nombre: 'Siete de Agosto' },
      { nombre: 'El Rodeo' },
      { nombre: 'Primero de Mayo' },
      { nombre: 'Santa Fe' },
      { nombre: 'Villa del Prado' },
      { nombre: 'Valle Grande' },
      { nombre: 'Charco Azul' },
      { nombre: 'El Vallado (C10)' }
    ]
  },
  {
    nombre: 'Comuna 11',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Primitivo Crespo' },
      { nombre: 'Alfonso Barberena' },
      { nombre: 'Julio Rincón' },
      { nombre: 'El Diamante' },
      { nombre: 'Nueva Floresta' },
      { nombre: 'El Retiro' },
      { nombre: 'El Progreso' },
      { nombre: 'Metropolitano del Sur' }
    ]
  },
  {
    nombre: 'Comuna 12',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'El Dorado' },
      { nombre: 'San Luis' },
      { nombre: 'Nuevo Latir' },
      { nombre: 'Industrial' },
      { nombre: 'Ricardo Balcázar (C12)' },
      { nombre: 'República de Israel' },
      { nombre: 'Los Guaduales' }
    ]
  },
  {
    nombre: 'Comuna 13',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Floralia' },
      { nombre: 'Pampalinda' },
      { nombre: 'El Pondaje' },
      { nombre: 'Los Lagos' },
      { nombre: 'Brisas de los Lagos' },
      { nombre: 'Cuatro Esquinas' },
      { nombre: 'Llano Verde' },
      { nombre: 'El Diamante (C13)' },
      { nombre: 'Compartir' },
      { nombre: 'Mojica (C13)' }
    ]
  },
  {
    nombre: 'Comuna 14',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Caldas (C14)' },
      { nombre: 'Ciudad Córdoba' },
      { nombre: 'El Poblado (C14)' },
      { nombre: 'Manuela Beltrán (C14)' },
      { nombre: 'Los Andes (C14)' },
      { nombre: 'Los Robles (C14)' },
      { nombre: 'Mariano Ramos (C14)' },
      { nombre: 'Comuneros (C14)' }
    ]
  },
  {
    nombre: 'Comuna 15',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Ciudad Jardín' },
      { nombre: 'El Ingenio (C15)' },
      { nombre: 'Santa Anita' },
      { nombre: 'Arboleda' },
      { nombre: 'Meléndez' },
      { nombre: 'San Joaquín (C15)' },
      { nombre: 'Nápoles' },
      { nombre: 'Los Cañaverales' },
      { nombre: 'Urbanización Tequendama' }
    ]
  },
  {
    nombre: 'Comuna 16',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Valle del Lili' },
      { nombre: 'Cañaveralejo' },
      { nombre: 'Lili' },
      { nombre: 'Valle Grande (C16)' },
      { nombre: 'Limonar' },
      { nombre: 'La Hacienda' },
      { nombre: 'Caney' },
      { nombre: 'Los Farallones' }
    ]
  },
  {
    nombre: 'Comuna 17',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Ciudad Capri' },
      { nombre: 'Nueva Tequendama' },
      { nombre: 'Los Andes (C17)' },
      { nombre: 'Los Chorros' },
      { nombre: 'El Limonar (C17)' },
      { nombre: 'Capri' },
      { nombre: 'El Refugio' },
      { nombre: 'La Selva' }
    ]
  },
  {
    nombre: 'Comuna 18',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'La Paz (C18)' },
      { nombre: 'Los Chorros (C18)' },
      { nombre: 'Caney (C18)' },
      { nombre: 'La Casona' },
      { nombre: 'Prados del Norte' },
      { nombre: 'Normandía' },
      { nombre: 'Menga' },
      { nombre: 'El Ingenio (C18)' }
    ]
  },
  {
    nombre: 'Comuna 19',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'El Ingenio (C19)' },
      { nombre: 'El Lido' },
      { nombre: 'La Flora' },
      { nombre: 'Versalles' },
      { nombre: 'La Selva (C19)' },
      { nombre: 'Arboleda (C19)' },
      { nombre: 'Santa Rita (C19)' },
      { nombre: 'Santa Mónica' }
    ]
  },
  {
    nombre: 'Comuna 20',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'El Ingenio (C20)' },
      { nombre: 'Siloé' },
      { nombre: 'Lleras Camargo' },
      { nombre: 'Belisario Caicedo (C20)' },
      { nombre: 'El Jordán' },
      { nombre: 'Pueblo Joven (C20)' },
      { nombre: 'Montebello' },
      { nombre: 'Tierrablanca' }
    ]
  },
  {
    nombre: 'Comuna 21',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'El Ingenio (C21)' },
      { nombre: 'Ciudad 2000' },
      { nombre: 'Los Andes (C21)' },
      { nombre: 'Pance' },
      { nombre: 'Nápoles (C21)' },
      { nombre: 'Urbanización Pance' },
      { nombre: 'El Saladito' }
    ]
  },
  {
    nombre: 'Comuna 22',
    tipo: 'comuna',
    barrios_veredas: [
      { nombre: 'Montebello (C22)' },
      { nombre: 'La Merced (C22)' },
      { nombre: 'Los Andes (C22)' },
      { nombre: 'El Lido (C22)' },
      { nombre: 'Antonio Nariño (C22)' },
      { nombre: 'Colseguros (C22)' },
      { nombre: 'Urbanización Caney' }
    ]
  },

  // ========== CORREGIMIENTOS (ÁREA RURAL) ==========
  {
    nombre: 'Corregimiento Pance',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'Pance' },
      { nombre: 'La Vorágine' },
      { nombre: 'El Topacio' },
      { nombre: 'El Pato' },
      { nombre: 'Pico de Oro' }
    ]
  },
  {
    nombre: 'Corregimiento La Buitrera',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'La Buitrera' },
      { nombre: 'El Saladito (Rural)' },
      { nombre: 'La Castellana' }
    ]
  },
  {
    nombre: 'Corregimiento La Elvira',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'La Elvira' },
      { nombre: 'El Chocho' },
      { nombre: 'La Paz (Rural)' },
      { nombre: 'San Pablo' },
      { nombre: 'La Sirena' }
    ]
  },
  {
    nombre: 'Corregimiento Navarro',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'Navarro' },
      { nombre: 'El Cabuyal' },
      { nombre: 'La Castilla' },
      { nombre: 'Villa Carmelo' }
    ]
  },
  {
    nombre: 'Corregimiento El Hormiguero',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'El Hormiguero' },
      { nombre: 'La Reforma' },
      { nombre: 'La María' },
      { nombre: 'San Antonio Rural' }
    ]
  },
  {
    nombre: 'Corregimiento Montebello',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'Montebello Rural' },
      { nombre: 'La Estrella' },
      { nombre: 'El Pílamo' }
    ]
  },
  {
    nombre: 'Corregimiento Villacarmelo',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'Villacarmelo' },
      { nombre: 'La Leonera' },
      { nombre: 'La Luisa' }
    ]
  },
  {
    nombre: 'Corregimiento Los Andes',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'Los Andes Rural' },
      { nombre: 'El Retiro Rural' },
      { nombre: 'La Cima' }
    ]
  },
  {
    nombre: 'Corregimiento Golondrinas',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'Golondrinas' },
      { nombre: 'El Diamante Rural' },
      { nombre: 'La Esperanza' }
    ]
  },
  {
    nombre: 'Corregimiento La Castilla',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'La Castilla Rural' },
      { nombre: 'El Otoño' },
      { nombre: 'El Pital' }
    ]
  },
  {
    nombre: 'Corregimiento Felidia',
    tipo: 'corregimiento',
    barrios_veredas: [
      { nombre: 'Felidia' },
      { nombre: 'Pico del Águila' },
      { nombre: 'El Bosque' }
    ]
  }
];

/**
 * Retorna las comunas/corregimientos disponibles
 */
export function getComunasCorregimientos(): Array<{ value: string; label: string }> {
  return CALI_GEOPOLITICA.map(cc => ({
    value: cc.nombre,
    label: `${cc.nombre} ${cc.tipo === 'comuna' ? '(Urbano)' : '(Rural)'}`
  }));
}

/**
 * Retorna los barrios/veredas para una comuna/corregimiento específico
 */
export function getBarriosVeredas(comunaCorregimiento: string): Array<{ value: string; label: string }> {
  const cc = CALI_GEOPOLITICA.find(item => item.nombre === comunaCorregimiento);
  if (!cc) return [];
  
  return cc.barrios_veredas.map(bv => ({
    value: bv.nombre,
    label: bv.nombre
  }));
}
