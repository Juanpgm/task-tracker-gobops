export interface GeoLookupResult {
  comuna: string | null;
  barrio: string | null;
}

type Position = [number, number];
type Ring = Position[];

interface GeoJsonFeature {
  type: "Feature";
  properties: Record<string, unknown> | null;
  geometry: {
    type: "Polygon" | "MultiPolygon" | string;
    coordinates: Ring[] | Ring[][];
  };
}

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

const COMUNAS_URL = "/cartografia_base/comunas_corregimientos.geojson";
const BARRIOS_URL = "/cartografia_base/barrios_veredas.geojson";
const COMUNA_PROP = "comuna_corregimiento";
const BARRIO_PROP = "barrio_vereda";

let comunasPromise: Promise<GeoJsonFeatureCollection | null> | null = null;
let barriosPromise: Promise<GeoJsonFeatureCollection | null> | null = null;

async function fetchCollection(url: string): Promise<GeoJsonFeatureCollection | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as GeoJsonFeatureCollection;
  } catch {
    return null;
  }
}

function loadComunas(): Promise<GeoJsonFeatureCollection | null> {
  if (!comunasPromise) comunasPromise = fetchCollection(COMUNAS_URL);
  return comunasPromise;
}

function loadBarrios(): Promise<GeoJsonFeatureCollection | null> {
  if (!barriosPromise) barriosPromise = fetchCollection(BARRIOS_URL);
  return barriosPromise;
}

// Ray-casting on a single ring. Coordinates are [lng, lat] pairs, so we test
// against x=lng, y=lat.
function pointInRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Ring 0 is the outer boundary; any further rings are holes that carve the
// point back out.
function pointInPolygonRings(lat: number, lng: number, rings: Ring[]): boolean {
  if (rings.length === 0) return false;
  if (!pointInRing(lat, lng, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lat, lng, rings[i])) return false;
  }
  return true;
}

function pointInGeometry(lat: number, lng: number, geometry: GeoJsonFeature["geometry"]): boolean {
  if (geometry.type === "Polygon") {
    return pointInPolygonRings(lat, lng, geometry.coordinates as Ring[]);
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates as Ring[][];
    return polygons.some((rings) => pointInPolygonRings(lat, lng, rings));
  }
  return false;
}

function findMatch(collection: GeoJsonFeatureCollection | null, lat: number, lng: number, propKey: string): string | null {
  if (!collection) return null;
  for (const feature of collection.features) {
    if (pointInGeometry(lat, lng, feature.geometry)) {
      const value = feature.properties?.[propKey];
      return typeof value === "string" ? value : null;
    }
  }
  return null;
}

export async function lookupComunaBarrio(lat: number, lng: number): Promise<GeoLookupResult> {
  try {
    const [comunas, barrios] = await Promise.all([loadComunas(), loadBarrios()]);
    return {
      comuna: findMatch(comunas, lat, lng, COMUNA_PROP),
      barrio: findMatch(barrios, lat, lng, BARRIO_PROP),
    };
  } catch {
    return { comuna: null, barrio: null };
  }
}
