<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import type { Requerimiento } from "../../types/seguimiento";

  export let filteredReqs: Requerimiento[] = [];

  const CALI_CENTER: [number, number] = [3.4516, -76.532];
  const CALI_BOUNDS: L.LatLngBoundsExpression = [
    [3.28, -76.63],
    [3.59, -76.43],
  ];

  const ESTADO_COLORS: Record<string, string> = {
    nuevo:       "#6b7280",
    radicado:    "#3b82f6",
    "en-gestion":"#f59e0b",
    asignado:    "#8b5cf6",
    "en-proceso":"#f97316",
    resuelto:    "#22c55e",
    cerrado:     "#64748b",
    cancelado:   "#ef4444",
  };

  const ESTADO_LABELS: Record<string, string> = {
    nuevo:       "Nuevo",
    radicado:    "Radicado",
    "en-gestion":"En Gestión",
    asignado:    "Asignado",
    "en-proceso":"En Proceso",
    resuelto:    "Resuelto",
    cerrado:     "Cerrado",
    cancelado:   "Cancelado",
  };

  function getEstadoColor(estado: string): string {
    return ESTADO_COLORS[estado] ?? "#6b7280";
  }

  let mapContainer: HTMLDivElement;
  let map: L.Map | null = null;
  let markersLayer: L.LayerGroup | null = null;
  let initialized = false;
  let resizeObserver: ResizeObserver | null = null;

  // ── helpers ──────────────────────────────────────────────────────────────

  function parseCoords(req: Requerimiento): [number, number] | null {
    const lat = parseFloat(req.latitud ?? "");
    const lng = parseFloat(req.longitud ?? "");
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;
    return [lat, lng];
  }

  function buildPopupHtml(req: Requerimiento, color: string): string {
    const estado = ESTADO_LABELS[req.estado] ?? req.estado;
    const desc = req.descripcion
      ? req.descripcion.length > 90
        ? req.descripcion.slice(0, 87) + "…"
        : req.descripcion
      : "Sin descripción";
    const ubicacion = [req.solicitante?.barrio_vereda, req.solicitante?.comuna_corregimiento]
      .filter(Boolean)
      .join(" · ") || req.direccion || "";
    const fecha = req.created_at
      ? new Date(req.created_at).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "";
    const cgs = req.centros_gestores?.length
      ? req.centros_gestores.slice(0, 2).join(", ") +
        (req.centros_gestores.length > 2 ? ` +${req.centros_gestores.length - 2}` : "")
      : "";

    return `
      <div class="rq-pp-wrap">
        <div class="rq-pp-header" style="border-left:3px solid ${color}">
          <div class="rq-pp-top">
            <span class="rq-pp-pill" style="color:${color};background:${color}18;border:1px solid ${color}30">${estado}</span>
            ${fecha ? `<span class="rq-pp-date">${fecha}</span>` : ""}
          </div>
          <p class="rq-pp-desc">${desc}</p>
        </div>
        ${ubicacion || cgs ? `
        <div class="rq-pp-body">
          ${ubicacion ? `<div class="rq-pp-row">📍 ${ubicacion}</div>` : ""}
          ${cgs ? `<div class="rq-pp-row">🏛 ${cgs}</div>` : ""}
        </div>` : ""}
      </div>`;
  }

  // ── map init ─────────────────────────────────────────────────────────────

  function initMap() {
    if (!mapContainer) return;
    map = L.map(mapContainer, {
      center: CALI_CENTER,
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });
    map.fitBounds(CALI_BOUNDS, { animate: false });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { attribution: "", maxZoom: 19, subdomains: "abcd" }
    ).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    // Reset-view button
    const ResetControl = L.Control.extend({
      onAdd() {
        const btn = L.DomUtil.create("button", "rq-reset-btn");
        btn.title = "Restablecer vista";
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
        L.DomEvent.on(btn, "click", (e: Event) => {
          L.DomEvent.stopPropagation(e as L.LeafletMouseEvent);
          fitToData(true);
        });
        return btn;
      },
    });
    new ResetControl({ position: "topleft" }).addTo(map);

    resizeObserver = new ResizeObserver(() => map?.invalidateSize());
    resizeObserver.observe(mapContainer);

    initialized = true;
    updateMarkers(false);
  }

  // ── markers ──────────────────────────────────────────────────────────────

  function updateMarkers(_animate: boolean) {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();

    for (const req of filteredReqs) {
      const coords = parseCoords(req);
      if (!coords) continue;
      const [lat, lng] = coords;
      const color = getEstadoColor(req.estado);

      const now = Date.now();
      const ageMs = req.created_at ? now - new Date(req.created_at).getTime() : Infinity;
      const isNew    = ageMs < 1 * 86_400_000;
      const isRecent = ageMs < 7 * 86_400_000;

      const icon = L.divIcon({
        className: "rq-custom-marker",
        html: `<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${isNew    ? `<circle cx="15" cy="15" r="14" fill="${color}" opacity="0.14" class="rq-pulse-ring"/>` : ""}
          ${isRecent ? `<circle cx="15" cy="15" r="12" fill="${color}" opacity="0.11"/>` : ""}
          <circle cx="15" cy="15" r="9" fill="${color}" opacity="0.9"/>
          <circle cx="15" cy="15" r="4" fill="white"/>
        </svg>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -18],
      });

      L.marker([lat, lng], { icon })
        .bindPopup(buildPopupHtml(req, color), { maxWidth: 280 })
        .addTo(markersLayer!);
    }

    fitToData(false);
  }

  function fitToData(animate: boolean) {
    if (!map) return;
    const pts = filteredReqs
      .map(parseCoords)
      .filter((c): c is [number, number] => c !== null);

    if (pts.length === 0) {
      map.fitBounds(CALI_BOUNDS, { animate: false });
      return;
    }
    if (pts.length === 1) {
      map.setView(pts[0], 15, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(pts);
    if (animate) {
      map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    } else {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: false });
    }
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  onMount(() => {
    // Ensure DOM is painted before Leaflet measures container
    requestAnimationFrame(() => initMap());
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    map?.remove();
    map = null;
  });

  // ── reactivity ───────────────────────────────────────────────────────────

  $: if (map && initialized) updateMarkers(true);
</script>

<div class="rq-map-wrapper">
  <div bind:this={mapContainer} class="rq-map-container"></div>
</div>

<style>
  .rq-map-wrapper {
    width: 100%;
    height: 100%;
    min-height: 360px;
    position: relative;
  }

  .rq-map-container {
    width: 100%;
    height: 100%;
    min-height: 360px;
    border-radius: 0 0 8px 8px;
  }

  /* Reset button */
  :global(.rq-reset-btn) {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    width: 30px;
    height: 30px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #475569;
    margin-top: 4px;
    transition: background 0.15s;
    padding: 0;
  }
  :global(.rq-reset-btn:hover) {
    background: #f1f5f9;
  }

  /* Pulse animation for new markers */
  @keyframes rq-pulse-map {
    0%, 100% { opacity: 0.1; }
    50%       { opacity: 0.3; }
  }
  :global(.rq-custom-marker .rq-pulse-ring) {
    animation: rq-pulse-map 2s ease-in-out infinite;
  }

  /* Popup styles */
  :global(.rq-pp-wrap) {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    min-width: 200px;
  }
  :global(.rq-pp-header) {
    padding: 8px 10px;
    background: #f8fafc;
    border-radius: 4px 4px 0 0;
  }
  :global(.rq-pp-top) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }
  :global(.rq-pp-pill) {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  :global(.rq-pp-date) {
    font-size: 10px;
    color: #94a3b8;
  }
  :global(.rq-pp-desc) {
    margin: 0;
    color: #1e293b;
    font-weight: 500;
    line-height: 1.4;
    font-size: 12px;
  }
  :global(.rq-pp-body) {
    padding: 6px 10px;
    border-top: 1px solid #f1f5f9;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  :global(.rq-pp-row) {
    color: #475569;
    font-size: 11px;
    line-height: 1.4;
  }

  /* Remove default leaflet popup padding to let our wrapper control it */
  :global(.leaflet-popup-content) {
    margin: 0 !important;
    padding: 0 !important;
  }
  :global(.leaflet-popup-content-wrapper) {
    padding: 0 !important;
    border-radius: 8px !important;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
  }
</style>
