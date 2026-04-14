import type { Coordenadas } from '../types';

/**
 * Obtiene la posición GPS actual del dispositivo.
 */
export function getCurrentPosition(): Promise<Coordenadas> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no soportada por este navegador'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let message = 'Error al obtener ubicación';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Permiso de ubicación denegado. Por favor, habilite la ubicación en su navegador.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Información de ubicación no disponible.';
            break;
          case error.TIMEOUT:
            message = 'La solicitud de ubicación expiró.';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Formatea coordenadas para mostrar al usuario.
 */
export function formatCoordinates(coords: Coordenadas): string {
  return `${coords.latitud.toFixed(6)}, ${coords.longitud.toFixed(6)}`;
}

export interface GeocodingResult {
  latitud: number;
  longitud: number;
  direccion_formateada: string;
  barrio?: string;
  comuna?: string;
}

/**
 * Geocodifica una dirección textual usando Nominatim (OSM).
 * Acotado a Santiago de Cali, Colombia.
 */
export async function geocodeAddress(query: string): Promise<GeocodingResult | null> {
  const searchQuery = `${query}, Cali, Valle del Cauca, Colombia`;
  const url = `https://nominatim.openstreetmap.org/search?` +
    new URLSearchParams({
      q: searchQuery,
      format: 'json',
      addressdetails: '1',
      limit: '1',
      countrycodes: 'co',
    }).toString();

  const response = await fetch(url, {
    headers: { 'User-Agent': 'TaskTrackerGobOps/1.0' },
  });

  if (!response.ok) return null;

  const results = await response.json();
  if (!results || results.length === 0) return null;

  const r = results[0];
  return {
    latitud: parseFloat(r.lat),
    longitud: parseFloat(r.lon),
    direccion_formateada: r.display_name || query,
    barrio: r.address?.suburb || r.address?.neighbourhood || '',
    comuna: r.address?.city_district || '',
  };
}

/**
 * Geocodificación inversa: coordenadas → dirección.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodingResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?` +
    new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      format: 'json',
      addressdetails: '1',
    }).toString();

  const response = await fetch(url, {
    headers: { 'User-Agent': 'TaskTrackerGobOps/1.0' },
  });

  if (!response.ok) return null;

  const r = await response.json();
  if (!r || r.error) return null;

  return {
    latitud: parseFloat(r.lat),
    longitud: parseFloat(r.lon),
    direccion_formateada: r.display_name || '',
    barrio: r.address?.suburb || r.address?.neighbourhood || '',
    comuna: r.address?.city_district || '',
  };
}
