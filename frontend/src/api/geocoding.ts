import { apiClient } from '../lib/api-client';

export interface ViaInfo {
  tipo: string | null;
  numero: string | null;
  nombre: string | null;
  nombre_catastral: string | null;
  clase: string | null;
  distancia_m: number | null;
  soporte_cruces: number | null;
  inferida: boolean | null;
}

export interface CruceInfo {
  nombre: string | null;
  distancia_m: number | null;
}

export interface VerificacionInfo {
  score: number;
  nivel: 'alta' | 'media' | 'baja' | 'fuera_cali';
  advertencias: string[];
}

export interface ReverseGeocodeResponse {
  success: boolean;
  coordenada: { lat: number; lon: number };
  dentro_de_cali: boolean;
  barrio_vereda: string | null;
  comuna_corregimiento: string | null;
  via: ViaInfo | null;
  cruce_mas_cercano: CruceInfo | null;
  direccion_legible: string;
  direccion_osm: string | null;
  osm: Record<string, unknown> | null;
  fuentes: string[];
  verificacion: VerificacionInfo | null;
}

/**
 * Convierte una coordenada (lat, lon) en una dirección estructurada
 * combinando basemaps catastrales de Cali + Nominatim (opcional).
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  usar_nominatim = true,
): Promise<ReverseGeocodeResponse> {
  return apiClient.post<ReverseGeocodeResponse>('/api/reverse-geocode', {
    lat,
    lon,
    usar_nominatim,
  });
}
