/**
 * Shared CARTO basemap config for all Leaflet maps.
 * The API key removes the watermark; without it the URL falls back to the
 * keyless endpoint.
 */
const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();

export const CARTO_TILE_URL =
  "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" +
  (CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : "");
