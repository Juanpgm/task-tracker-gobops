<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import L from "leaflet";
  import {
    getCurrentPosition,
    reverseGeocodeWithFallback,
  } from "../../lib/geolocation";
  import Button from "../ui/Button.svelte";
  import Icon from "../ui/Icon.svelte";

  // Coordenadas/dirección bindables hacia el padre.
  export let latitud: string = "";
  export let longitud: string = "";
  export let direccion: string = "";
  // Centro de Cali como fallback de visualización (NO se envía como coordenada).
  export let defaultLat: number = 3.4516;
  export let defaultLng: number = -76.532;
  // Alto del mapa.
  export let height: string = "280px";

  const dispatch = createEventDispatcher<{
    change: { latitud: string; longitud: string; direccion: string };
  }>();

  let mapEl: HTMLDivElement;
  let map: L.Map | null = null;
  let marker: L.Marker | null = null;
  let gpsStatus: "pending" | "ok" | "denied" | "unsupported" = "pending";
  let gpsError: string = "";
  let geocoding = false;
  let geocodeError = "";
  let showManualModal = false;
  let manualLat = "";
  let manualLng = "";
  let manualErr = "";
  let geocodeTimer: ReturnType<typeof setTimeout> | null = null;

  function emitChange() {
    dispatch("change", { latitud, longitud, direccion });
  }

  function scheduleReverseGeocode(lat: number, lng: number) {
    if (geocodeTimer) clearTimeout(geocodeTimer);
    geocodeTimer = setTimeout(() => runReverseGeocode(lat, lng), 500);
  }

  async function runReverseGeocode(lat: number, lng: number) {
    geocoding = true;
    geocodeError = "";
    try {
      const r = await reverseGeocodeWithFallback(lat, lng);
      if (r && r.direccion_formateada) {
        direccion = r.direccion_formateada;
      } else {
        direccion = "";
        geocodeError = "No se pudo detectar dirección automáticamente.";
      }
    } catch (err) {
      direccion = "";
      geocodeError =
        err instanceof Error ? err.message : "Error obteniendo dirección.";
    } finally {
      geocoding = false;
      emitChange();
    }
  }

  function setCoords(lat: number, lng: number, opts: { recenter?: boolean } = {}) {
    latitud = lat.toFixed(8);
    longitud = lng.toFixed(8);
    if (marker) marker.setLatLng([lat, lng]);
    if (opts.recenter && map) map.setView([lat, lng], Math.max(map.getZoom(), 16));
    scheduleReverseGeocode(lat, lng);
  }

  function initMap() {
    const initialLat = latitud ? parseFloat(latitud) : defaultLat;
    const initialLng = longitud ? parseFloat(longitud) : defaultLng;
    const hasInitial = !!(latitud && longitud);

    map = L.map(mapEl, {
      center: [initialLat, initialLng],
      zoom: hasInitial ? 17 : 13,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }
    ).addTo(map);

    // Fix default icon URLs (Vite no resuelve los assets por defecto de Leaflet).
    const defaultIcon = L.icon({
      iconUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: defaultIcon,
    }).addTo(map);

    marker.on("dragend", () => {
      const ll = marker!.getLatLng();
      setCoords(ll.lat, ll.lng);
    });

    map.on("click", (ev: L.LeafletMouseEvent) => {
      setCoords(ev.latlng.lat, ev.latlng.lng);
    });

    // Si ya hay coordenadas iniciales, dispara geocoding para llenar dirección.
    if (hasInitial) scheduleReverseGeocode(initialLat, initialLng);
  }

  async function tryGps(initial = false) {
    gpsStatus = "pending";
    gpsError = "";
    if (!navigator.geolocation) {
      gpsStatus = "unsupported";
      gpsError = "Geolocalización no soportada por este dispositivo.";
      if (initial) openManualModal();
      return;
    }
    try {
      const pos = await getCurrentPosition();
      gpsStatus = "ok";
      setCoords(pos.latitud, pos.longitud, { recenter: true });
    } catch (err) {
      gpsStatus = "denied";
      gpsError =
        err instanceof Error ? err.message : "No se pudo obtener GPS.";
      if (initial) openManualModal();
    }
  }

  function openManualModal() {
    manualLat = latitud || "";
    manualLng = longitud || "";
    manualErr = "";
    showManualModal = true;
  }

  function closeManualModal() {
    showManualModal = false;
  }

  function applyManual() {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) {
      manualErr = "Ingrese números válidos para latitud y longitud.";
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      manualErr = "Rango fuera de límites (lat: -90..90, lng: -180..180).";
      return;
    }
    setCoords(lat, lng, { recenter: true });
    showManualModal = false;
  }

  async function manualUseGps() {
    manualErr = "";
    try {
      const pos = await getCurrentPosition();
      manualLat = pos.latitud.toFixed(8);
      manualLng = pos.longitud.toFixed(8);
    } catch (err) {
      manualErr =
        err instanceof Error ? err.message : "No se pudo obtener GPS.";
    }
  }

  onMount(() => {
    initMap();
    // Captura GPS automáticamente al montar.
    tryGps(true);
  });

  onDestroy(() => {
    if (geocodeTimer) clearTimeout(geocodeTimer);
    if (map) {
      map.remove();
      map = null;
    }
  });
</script>

<div class="location-picker">
  <div class="lp-header">
    <div class="lp-title">
      <Icon name="map-pin" size={16} />
      <span>Ubicación del requerimiento</span>
    </div>
    <button
      type="button"
      class="lp-edit-btn"
      on:click={openManualModal}
      aria-label="Editar coordenadas manualmente"
    >
      <Icon name="edit" size={14} />
      <span>Editar coordenadas</span>
    </button>
  </div>

  {#if gpsStatus === "pending"}
    <div class="lp-status lp-status--info">
      <Icon name="crosshair" size={14} /> Obteniendo ubicación GPS…
    </div>
  {:else if gpsStatus === "denied" || gpsStatus === "unsupported"}
    <div class="lp-status lp-status--warn">
      <Icon name="alert-triangle" size={14} />
      {gpsError || "GPS no disponible."} Ajusta la ubicación arrastrando el marcador o usa "Editar coordenadas".
    </div>
  {/if}

  <div
    bind:this={mapEl}
    class="lp-map"
    style="height: {height};"
    aria-label="Mapa interactivo para seleccionar ubicación"
  ></div>

  <div class="lp-coords">
    <span class="lp-coords-label">Coordenadas:</span>
    <span class="lp-coords-value">
      {#if latitud && longitud}
        {parseFloat(latitud).toFixed(6)}, {parseFloat(longitud).toFixed(6)}
      {:else}
        — sin definir —
      {/if}
    </span>
  </div>

  <div class="lp-address">
    <label class="lp-address-label" for="lp-direccion-input">
      Dirección (detectada automáticamente)
    </label>
    <div class="lp-address-row">
      <input
        id="lp-direccion-input"
        type="text"
        class="lp-address-input"
        readonly
        value={direccion}
        placeholder={geocoding
          ? "Detectando dirección…"
          : "Mueva el marcador en el mapa para detectar la dirección"}
      />
      {#if geocoding}
        <span class="lp-spinner" aria-label="Cargando dirección"></span>
      {/if}
    </div>
    {#if geocodeError}
      <small class="lp-address-error">{geocodeError}</small>
    {/if}
  </div>
</div>

{#if showManualModal}
  <div
    class="lp-modal-backdrop"
    on:click={closeManualModal}
    on:keydown={(e) => e.key === "Escape" && closeManualModal()}
    role="presentation"
  >
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
    <div
      class="lp-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lp-modal-title"
      on:click|stopPropagation
    >
      <h3 id="lp-modal-title" class="lp-modal-title">
        <Icon name="edit" size={16} /> Editar coordenadas
      </h3>
      <p class="lp-modal-help">
        Ingrese latitud y longitud manualmente, o use el GPS del dispositivo.
      </p>

      <div class="lp-modal-fields">
        <label class="lp-modal-field">
          <span>Latitud</span>
          <input
            type="number"
            step="0.00000001"
            bind:value={manualLat}
            placeholder="3.45160000"
          />
        </label>
        <label class="lp-modal-field">
          <span>Longitud</span>
          <input
            type="number"
            step="0.00000001"
            bind:value={manualLng}
            placeholder="-76.53200000"
          />
        </label>
      </div>

      {#if manualErr}
        <div class="lp-modal-error">{manualErr}</div>
      {/if}

      <div class="lp-modal-actions">
        <Button variant="secondary" size="sm" on:click={manualUseGps}>
          <Icon name="crosshair" size={14} /> Usar mi GPS
        </Button>
        <div class="lp-modal-actions-right">
          <Button variant="secondary" size="sm" on:click={closeManualModal}>
            Cancelar
          </Button>
          <Button size="sm" on:click={applyManual}>Aplicar</Button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .location-picker {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm, 0.5rem);
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 8px;
    padding: var(--space-md, 1rem);
    background: var(--surface, #fff);
  }
  .lp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm, 0.5rem);
  }
  .lp-title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text, #1e293b);
  }
  .lp-edit-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: none;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    color: var(--primary, #1d4ed8);
    cursor: pointer;
    font-size: 0.8125rem;
    font-family: inherit;
  }
  .lp-edit-btn:hover {
    background: var(--bg-hover, #f1f5f9);
  }
  .lp-status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8125rem;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    line-height: 1.3;
  }
  .lp-status--info {
    background: #eff6ff;
    color: #1e40af;
  }
  .lp-status--warn {
    background: #fef3c7;
    color: #92400e;
  }
  .lp-map {
    width: 100%;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border, #e2e8f0);
    z-index: 0;
  }
  :global(.lp-map .leaflet-control-attribution) {
    font-size: 10px;
  }
  .lp-coords {
    font-size: 0.8125rem;
    color: var(--text-secondary, #475569);
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
  }
  .lp-coords-label {
    font-weight: 600;
    margin-right: 0.3rem;
  }
  .lp-address {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .lp-address-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text, #1e293b);
  }
  .lp-address-row {
    position: relative;
    display: flex;
    align-items: center;
  }
  .lp-address-input {
    flex: 1;
    padding: 0.55rem 2rem 0.55rem 0.7rem;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 6px;
    background: var(--bg, #f8fafc);
    color: var(--text, #1e293b);
    font-size: 0.875rem;
    font-family: inherit;
    cursor: not-allowed;
  }
  .lp-address-input::placeholder {
    color: var(--text-secondary, #94a3b8);
    font-style: italic;
  }
  .lp-spinner {
    position: absolute;
    right: 0.55rem;
    width: 14px;
    height: 14px;
    border: 2px solid var(--border, #e2e8f0);
    border-top-color: var(--primary, #1d4ed8);
    border-radius: 50%;
    animation: lp-spin 0.8s linear infinite;
  }
  .lp-address-error {
    color: #b45309;
    font-size: 0.75rem;
  }
  @keyframes lp-spin {
    to {
      transform: rotate(360deg);
    }
  }
  /* Modal */
  .lp-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }
  .lp-modal {
    background: var(--surface, #fff);
    border-radius: 10px;
    padding: 1.25rem;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .lp-modal-title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text, #1e293b);
    margin: 0;
  }
  .lp-modal-help {
    font-size: 0.8125rem;
    color: var(--text-secondary, #64748b);
    margin: 0;
  }
  .lp-modal-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
  .lp-modal-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text, #1e293b);
  }
  .lp-modal-field input {
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
  }
  .lp-modal-error {
    background: #fee2e2;
    color: #991b1b;
    padding: 0.45rem 0.6rem;
    border-radius: 6px;
    font-size: 0.8125rem;
  }
  .lp-modal-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .lp-modal-actions-right {
    display: inline-flex;
    gap: 0.4rem;
  }
  @media (max-width: 480px) {
    .lp-modal-fields {
      grid-template-columns: 1fr;
    }
  }
</style>
