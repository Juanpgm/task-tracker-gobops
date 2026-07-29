<script lang="ts">
  /**
   * Mapa georeferenciado general (GET /avanzadas/geo): 3 capas —
   * requerimientos (325 pts, capa dominante), avanzadas (16 pts) y jornadas
   * (2 pts) — sobre Leaflet + CartoDB light tiles, siguiendo el patrón de
   * inicialización/limpieza de MapaRequerimientos.svelte (sin copiar su
   * esquema de color, que es por estado y no aplica aquí).
   *
   * Paleta de capas VALIDADA con el validador de paletas (peor ΔE CVD 17.6,
   * peor ΔE visión normal 31.6 — todo dentro de tolerancia). No sustituir
   * estos colores: una combinación azul+naranja+violeta probada falló el
   * piso de visión normal (violeta vs. azul de marca ΔE 14.1).
   *   - Requerimientos → #2563eb (azul de marca, capa dominante)
   *   - Avanzadas      → #008300 (verde)
   *   - Jornadas       → #e87ba4 (magenta) — sólo 2.35:1 sobre el tile, por
   *     debajo del piso 3:1. Nunca se codifica sólo con color: además de la
   *     leyenda, jornadas recibe un marcador visiblemente más grande y una
   *     etiqueta directa (tooltip permanente) — relevo obligatorio.
   *
   * La identidad de capa nunca depende sólo del color: leyenda + tamaños de
   * marcador distintos + twin de tabla accesible cubren daltonismo y casos
   * sin mouse. `entidad` es un FILTRO, nunca un canal de color (>7 clases de
   * entidad en un mapa es un antipatrón que falla CVD por construcción).
   */
  import { onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { geoStore } from '../../stores/geoStore';
  import { navigationStore } from '../../stores/navigationStore';
  import Icon from '../ui/Icon.svelte';
  import type { AvanzadaGeo, RequerimientoGeo, JornadaGeo } from '../../api/avanzadas-geo';

  const COLOR_REQUERIMIENTOS = '#2563eb';
  const COLOR_AVANZADAS = '#008300';
  const COLOR_JORNADAS = '#e87ba4';

  const CALI_CENTER: [number, number] = [3.4516, -76.532];
  const CALI_BOUNDS: L.LatLngBoundsExpression = [
    [3.28, -76.63],
    [3.59, -76.43],
  ];

  // La carga inicial y el refresco forzado de geoStore son responsabilidad
  // de PanelUnificado (un solo botón "Actualizar" para las tres secciones);
  // este componente sólo se suscribe para dibujar el mapa/tabla.
  $: state = $geoStore;
  $: data = state.data;
  $: isFirstLoad = state.loading && !data;

  // ── layer toggles + filters ────────────────────────────────────────────

  let showRequerimientos = true;
  let showAvanzadas = true;
  let showJornadas = true;

  let filtroEntidad = '';
  let filtroEstrategia = '';
  let filtroComuna = '';
  let busqueda = '';

  let showTable = false;

  function uniqueSorted(values: (string | undefined)[]): string[] {
    const set = new Set(values.filter((v): v is string => !!v));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }

  /** Todos los organismos de un requerimiento geo; fallback al legado `entidad` único. */
  function organismosDeGeo(r: RequerimientoGeo): string[] {
    return r.entidades?.length ? r.entidades : r.entidad ? [r.entidad] : [];
  }

  $: entidadOptions = uniqueSorted((data?.requerimientos ?? []).flatMap((r) => organismosDeGeo(r)));
  $: estrategiaOptions = uniqueSorted((data?.avanzadas ?? []).map((a) => a.estrategia));
  $: comunaOptions = uniqueSorted([
    ...(data?.avanzadas ?? []).map((a) => a.comuna),
    ...(data?.jornadas ?? []).map((j) => j.comuna),
  ]);

  // Requerimientos no traen comuna/estrategia propias: se resuelven por la
  // avanzada padre (avanzada_client_id) para que los filtros de comuna y
  // estrategia funcionen de forma consistente entre capas.
  $: avanzadaById = new Map((data?.avanzadas ?? []).map((a) => [a.client_id, a]));

  // Declared as a reactive assignment (not a plain `function`) so Svelte
  // tracks `busqueda` as a dependency: its static analysis only sees
  // identifiers referenced directly within a `$:` statement's own syntax,
  // not reads that happen inside a separately-declared function body. The
  // downstream filteredX reactive statements below reference `matchesSearch`
  // itself, which chains correctly since it is also `$:`-tracked.
  $: matchesSearch = (...campos: (string | undefined)[]): boolean => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return campos.some((c) => (c ?? '').toLowerCase().includes(q));
  };

  $: filteredRequerimientos = (data?.requerimientos ?? []).filter((r) => {
    if (filtroEntidad && !organismosDeGeo(r).includes(filtroEntidad)) return false;
    const padre = avanzadaById.get(r.avanzada_client_id);
    if (filtroEstrategia && padre?.estrategia !== filtroEstrategia) return false;
    if (filtroComuna && padre?.comuna !== filtroComuna) return false;
    if (!matchesSearch(r.requerimiento, r.ubicacion, r.categoria)) return false;
    return true;
  });

  $: filteredAvanzadas = (data?.avanzadas ?? []).filter((a) => {
    if (filtroEstrategia && a.estrategia !== filtroEstrategia) return false;
    if (filtroComuna && a.comuna !== filtroComuna) return false;
    if (!matchesSearch(a.nombre_avanzada)) return false;
    return true;
  });

  $: filteredJornadas = (data?.jornadas ?? []).filter((j) => {
    if (filtroComuna && j.comuna !== filtroComuna) return false;
    if (!matchesSearch(j.nombre_jornada)) return false;
    return true;
  });

  interface TableRow {
    key: string;
    layer: 'Avanzada' | 'Requerimiento' | 'Jornada';
    nombre: string;
    entidad: string;
    comuna: string;
    fecha: string;
    lat: number;
    lng: number;
  }

  // Los toggles de capa también gobiernan la tabla: es el twin del mapa, y
  // ocultar una capa en el mapa pero seguir listándola en la tabla sería
  // inconsistente con "lo que se está viendo ahora mismo".
  $: tableRows = ([] as TableRow[]).concat(
    showAvanzadas
      ? filteredAvanzadas.map((a) => ({
          key: `av-${a.client_id}`,
          layer: 'Avanzada' as const,
          nombre: a.nombre_avanzada,
          entidad: '—',
          comuna: a.comuna,
          fecha: a.fecha,
          lat: a.lat,
          lng: a.lng,
        }))
      : [],
    showRequerimientos
      ? filteredRequerimientos.map((r) => ({
          key: `rq-${r.id}`,
          layer: 'Requerimiento' as const,
          nombre: r.requerimiento,
          entidad: organismosDeGeo(r).join(', '),
          comuna: avanzadaById.get(r.avanzada_client_id)?.comuna ?? '—',
          fecha: r.fecha,
          lat: r.lat,
          lng: r.lng,
        }))
      : [],
    showJornadas
      ? filteredJornadas.map((j) => ({
          key: `jo-${j.client_id}`,
          layer: 'Jornada' as const,
          nombre: j.nombre_jornada,
          entidad: '—',
          comuna: j.comuna,
          fecha: j.fecha,
          lat: j.lat,
          lng: j.lng,
        }))
      : []
  );

  $: totalVisible = tableRows.length;

  // ── omitidos: nunca se descartan en silencio ────────────────────────────

  function omitidoMsg(count: number, singular: string, plural: string): string | null {
    if (!count) return null;
    return count === 1 ? `1 ${singular} sin ubicación registrada.` : `${count} ${plural} sin ubicación registrada.`;
  }

  $: omitidosMsgs = [
    omitidoMsg(data?.omitidos.avanzadas ?? 0, 'avanzada', 'avanzadas'),
    omitidoMsg(data?.omitidos.requerimientos ?? 0, 'requerimiento', 'requerimientos'),
    omitidoMsg(data?.omitidos.jornadas ?? 0, 'jornada', 'jornadas'),
  ].filter((m): m is string => m !== null);

  // ── Leaflet lifecycle ────────────────────────────────────────────────────

  let mapContainer: HTMLDivElement | undefined;
  let lastMountedContainer: HTMLDivElement | null = null;
  let map: L.Map | null = null;
  let requerimientosLayer: L.LayerGroup | null = null;
  let avanzadasLayer: L.LayerGroup | null = null;
  let jornadasLayer: L.LayerGroup | null = null;
  let initialized = false;
  let resizeObserver: ResizeObserver | null = null;

  function isValidCoord(lat: unknown, lng: unknown): lat is number {
    return typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng);
  }

  function domEl(tag: string, opts: { className?: string; text?: string } = {}): HTMLElement {
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.text !== undefined) node.textContent = opts.text;
    return node;
  }

  function popupLink(label: string, clientId: string): HTMLButtonElement {
    const btn = domEl('button', { className: 'mg-popup-link', text: label }) as HTMLButtonElement;
    btn.type = 'button';
    btn.addEventListener('click', () => navigationStore.navigate('detalle-avanzada', { client_id: clientId }));
    return btn;
  }

  function buildPopupRequerimiento(r: RequerimientoGeo): HTMLElement {
    const wrap = domEl('div', { className: 'mg-popup' });
    wrap.appendChild(
      domEl('p', { className: 'mg-popup-title', text: organismosDeGeo(r).join(', ') || 'Sin entidad' })
    );
    wrap.appendChild(domEl('p', { className: 'mg-popup-row', text: `Categoría: ${r.categoria || '—'}` }));
    wrap.appendChild(domEl('p', { className: 'mg-popup-desc', text: r.requerimiento || 'Sin descripción' }));
    wrap.appendChild(domEl('p', { className: 'mg-popup-row', text: `Ubicación: ${r.ubicacion || '—'}` }));
    wrap.appendChild(domEl('p', { className: 'mg-popup-row', text: `Fecha: ${r.fecha || '—'}` }));
    wrap.appendChild(popupLink('Ver avanzada', r.avanzada_client_id));
    return wrap;
  }

  function buildPopupAvanzada(a: AvanzadaGeo): HTMLElement {
    const wrap = domEl('div', { className: 'mg-popup' });
    wrap.appendChild(domEl('p', { className: 'mg-popup-title', text: a.nombre_avanzada }));
    wrap.appendChild(domEl('p', { className: 'mg-popup-row', text: `Fecha: ${a.fecha || '—'}` }));
    wrap.appendChild(domEl('p', { className: 'mg-popup-row', text: `Estrategia: ${a.estrategia || '—'}` }));
    wrap.appendChild(domEl('p', { className: 'mg-popup-row', text: `${a.comuna || '—'} · ${a.barrio || '—'}` }));
    wrap.appendChild(domEl('p', { className: 'mg-popup-row', text: `${a.requerimientos_count} requerimiento${a.requerimientos_count === 1 ? '' : 's'}` }));
    wrap.appendChild(popupLink('Ver detalle', a.client_id));
    return wrap;
  }

  function buildPopupJornada(j: JornadaGeo): HTMLElement {
    const wrap = domEl('div', { className: 'mg-popup' });
    wrap.appendChild(domEl('p', { className: 'mg-popup-title', text: j.nombre_jornada }));
    wrap.appendChild(domEl('p', { className: 'mg-popup-row', text: `Fecha: ${j.fecha || '—'}` }));
    wrap.appendChild(domEl('p', { className: 'mg-popup-row', text: `Estado: ${j.estado || '—'}` }));
    wrap.appendChild(domEl('p', { className: 'mg-popup-row', text: `${j.comuna || '—'} · ${j.barrio || '—'}` }));
    return wrap;
  }

  function initMap() {
    if (!mapContainer) return;
    map = L.map(mapContainer, {
      center: CALI_CENTER,
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });
    map.fitBounds(CALI_BOUNDS, { animate: false });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Orden de creación = orden de apilado (el último queda arriba):
    // jornadas al final para que sus marcadores más grandes no queden
    // tapados por los 325 puntos de requerimientos.
    requerimientosLayer = L.layerGroup().addTo(map);
    avanzadasLayer = L.layerGroup().addTo(map);
    jornadasLayer = L.layerGroup().addTo(map);

    resizeObserver = new ResizeObserver(() => map?.invalidateSize());
    resizeObserver.observe(mapContainer);

    initialized = true;
    updateMarkers();
  }

  function updateMarkers() {
    if (!map || !requerimientosLayer || !avanzadasLayer || !jornadasLayer) return;
    requerimientosLayer.clearLayers();
    avanzadasLayer.clearLayers();
    jornadasLayer.clearLayers();

    if (showRequerimientos) {
      for (const r of filteredRequerimientos) {
        if (!isValidCoord(r.lat, r.lng)) continue;
        L.circleMarker([r.lat, r.lng], {
          radius: 6,
          color: '#ffffff',
          weight: 2,
          fillColor: COLOR_REQUERIMIENTOS,
          fillOpacity: 0.9,
        })
          .bindPopup(buildPopupRequerimiento(r), { maxWidth: 280 })
          .addTo(requerimientosLayer);
      }
    }

    if (showAvanzadas) {
      for (const a of filteredAvanzadas) {
        if (!isValidCoord(a.lat, a.lng)) continue;
        L.circleMarker([a.lat, a.lng], {
          radius: 8,
          color: '#ffffff',
          weight: 2,
          fillColor: COLOR_AVANZADAS,
          fillOpacity: 0.9,
        })
          .bindPopup(buildPopupAvanzada(a), { maxWidth: 280 })
          .addTo(avanzadasLayer);
      }
    }

    if (showJornadas) {
      for (const j of filteredJornadas) {
        if (!isValidCoord(j.lat, j.lng)) continue;
        // Relevo obligatorio para el magenta de bajo contraste: marcador
        // más grande + etiqueta permanente (nunca sólo color).
        L.circleMarker([j.lat, j.lng], {
          radius: 12,
          color: '#ffffff',
          weight: 2,
          fillColor: COLOR_JORNADAS,
          fillOpacity: 0.95,
        })
          .bindPopup(buildPopupJornada(j), { maxWidth: 280 })
          .bindTooltip(j.nombre_jornada, { permanent: true, direction: 'right', offset: [10, 0], className: 'mg-jornada-label' })
          .addTo(jornadasLayer);
      }
    }

    fitToData();
  }

  function fitToData() {
    if (!map) return;
    const pts: [number, number][] = [];
    if (showRequerimientos) filteredRequerimientos.forEach((r) => isValidCoord(r.lat, r.lng) && pts.push([r.lat, r.lng]));
    if (showAvanzadas) filteredAvanzadas.forEach((a) => isValidCoord(a.lat, a.lng) && pts.push([a.lat, a.lng]));
    if (showJornadas) filteredJornadas.forEach((j) => isValidCoord(j.lat, j.lng) && pts.push([j.lat, j.lng]));

    if (pts.length === 0) {
      map.fitBounds(CALI_BOUNDS, { animate: false });
      return;
    }
    if (pts.length === 1) {
      map.setView(pts[0], 15, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15, animate: false });
  }

  // rafId is cancelled onDestroy so a stale callback never fires initMap()
  // against a torn-down component — relevant not just in tests but in the
  // real app too, since switching tabs in Reportes.svelte destroys this
  // component via {#if activeTab === 'mapa'} while the frame may still be
  // queued.
  let rafId: number | undefined;

  // El div de mapContainer sólo existe en el DOM cuando `data` ya llegó (ver
  // template: {#if isFirstLoad} spinner {:else if data} ... rama de mapa).
  // En una carga en frío eso pasa DESPUÉS del montaje inicial, así que un
  // único requestAnimationFrame disparado en onMount puede encontrar
  // mapContainer todavía `undefined` — y como no hay reintento, el mapa
  // queda en blanco para siempre aunque los datos lleguen después. Se
  // reacciona a CADA aparición de un contenedor nuevo en su lugar: cubre la
  // carga en frío y también el caso de volver de "Ver tabla" a "Ver mapa",
  // que desmonta y remonta el div (un nuevo nodo necesita su propia
  // instancia de Leaflet; la anterior queda huérfana sobre un nodo separado
  // del documento).
  $: if (mapContainer && mapContainer !== lastMountedContainer) {
    lastMountedContainer = mapContainer;
    resizeObserver?.disconnect();
    map?.remove();
    map = null;
    if (rafId !== undefined) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => initMap());
  }

  onDestroy(() => {
    if (rafId !== undefined) cancelAnimationFrame(rafId);
    resizeObserver?.disconnect();
    map?.remove();
    map = null;
  });

  // Dependencias declaradas explícitamente (en vez de dejar que Svelte las
  // infiera sólo de `map`/`initialized`): el análisis estático de Svelte no
  // sigue las lecturas que ocurren DENTRO de updateMarkers(), así que sin
  // referenciar aquí filtros/toggles el mapa quedaría desactualizado tras el
  // primer render.
  $: if (map && initialized) {
    filteredRequerimientos;
    filteredAvanzadas;
    filteredJornadas;
    showRequerimientos;
    showAvanzadas;
    showJornadas;
    updateMarkers();
  }

  function nf(n: number): string {
    return n.toLocaleString('es-CO');
  }
</script>

<div class="mapa-general">
  {#if isFirstLoad}
    <div class="spinner" data-testid="mg-loading"></div>
  {:else if data}
    {#each omitidosMsgs as msg}
      <p class="mg-omitidos" data-testid="mg-omitidos">
        <Icon name="info" size={13} /> {msg}
      </p>
    {/each}

    <!-- Toggles de capa + filtros: una sola fila (envuelve en mobile) -->
    <div class="mg-controls">
      <div class="mg-toggles" role="group" aria-label="Capas visibles">
        <label class="mg-toggle">
          <input type="checkbox" bind:checked={showRequerimientos} />
          <span class="mg-swatch" style="background:{COLOR_REQUERIMIENTOS}"></span>
          Requerimientos ({nf(filteredRequerimientos.length)})
        </label>
        <label class="mg-toggle">
          <input type="checkbox" bind:checked={showAvanzadas} />
          <span class="mg-swatch" style="background:{COLOR_AVANZADAS}"></span>
          Avanzadas ({nf(filteredAvanzadas.length)})
        </label>
        <label class="mg-toggle">
          <input type="checkbox" bind:checked={showJornadas} />
          <span class="mg-swatch mg-swatch-lg" style="background:{COLOR_JORNADAS}"></span>
          Jornadas ({nf(filteredJornadas.length)})
        </label>
      </div>

      <div class="mg-filters">
        <select class="mg-filter-select" bind:value={filtroEntidad} aria-label="Filtrar por entidad">
          <option value="">Todas las entidades</option>
          {#each entidadOptions as e}
            <option value={e}>{e}</option>
          {/each}
        </select>
        <select class="mg-filter-select" bind:value={filtroEstrategia} aria-label="Filtrar por estrategia">
          <option value="">Todas las estrategias</option>
          {#each estrategiaOptions as e}
            <option value={e}>{e}</option>
          {/each}
        </select>
        <select class="mg-filter-select" bind:value={filtroComuna} aria-label="Filtrar por comuna">
          <option value="">Todas las comunas</option>
          {#each comunaOptions as c}
            <option value={c}>{c}</option>
          {/each}
        </select>
        <input
          class="mg-filter-search"
          type="search"
          placeholder="Buscar requerimiento, ubicación o categoría…"
          bind:value={busqueda}
          aria-label="Buscar"
        />
      </div>

      <button type="button" class="mg-table-toggle" aria-pressed={showTable} on:click={() => (showTable = !showTable)}>
        {showTable ? 'Ver mapa' : 'Ver tabla'}
      </button>
    </div>

    {#if totalVisible === 0}
      <div class="mg-empty">
        <Icon name="map-pin" size={28} />
        <p>No hay puntos que coincidan con los filtros seleccionados.</p>
      </div>
    {:else if showTable}
      <div class="mg-table-scroll">
        <table>
          <caption class="sr-only">Puntos georeferenciados filtrados</caption>
          <thead>
            <tr>
              <th scope="col">Capa</th>
              <th scope="col">Nombre / Requerimiento</th>
              <th scope="col">Entidad</th>
              <th scope="col">Comuna</th>
              <th scope="col">Fecha</th>
              <th scope="col">Lat</th>
              <th scope="col">Lng</th>
            </tr>
          </thead>
          <tbody>
            {#each tableRows as row (row.key)}
              <tr>
                <td>{row.layer}</td>
                <td>{row.nombre}</td>
                <td>{row.entidad}</td>
                <td>{row.comuna}</td>
                <td>{row.fecha}</td>
                <td class="num">{row.lat.toFixed(5)}</td>
                <td class="num">{row.lng.toFixed(5)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="mg-map-wrapper">
        <div bind:this={mapContainer} class="mg-map-container"></div>
      </div>

      <ul class="mg-legend" data-testid="mg-legend">
        <li><span class="mg-swatch" style="background:{COLOR_REQUERIMIENTOS}"></span> Requerimientos</li>
        <li><span class="mg-swatch" style="background:{COLOR_AVANZADAS}"></span> Avanzadas</li>
        <li><span class="mg-swatch mg-swatch-lg" style="background:{COLOR_JORNADAS}"></span> Jornadas (marcador grande + etiqueta)</li>
      </ul>
    {/if}
  {/if}
</div>

<style>
  .mapa-general {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-md);
    max-width: 100%;
    box-sizing: border-box;
  }
  .mg-omitidos {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--fs-sm);
    color: var(--text-secondary);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.75rem;
    margin: 0;
  }

  /* Toggles + filtros: una fila lógica que envuelve en mobile */
  .mg-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm) var(--space-md);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
  }
  .mg-toggles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm) var(--space-md);
  }
  .mg-toggle {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text);
    cursor: pointer;
    min-height: var(--tap-min);
  }
  .mg-swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px var(--border);
    flex-shrink: 0;
  }
  .mg-swatch-lg { width: 16px; height: 16px; }

  .mg-filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    flex: 1 1 auto;
  }
  .mg-filter-select,
  .mg-filter-search {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.6rem;
    font-size: var(--fs-sm);
    font-family: inherit;
    color: var(--text);
    background: var(--surface);
    min-height: var(--tap-min);
  }
  .mg-filter-search { flex: 1 1 14rem; }

  .mg-table-toggle {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.35rem 0.75rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    min-height: var(--tap-min);
    margin-left: auto;
  }
  .mg-table-toggle:hover { background: var(--surface-alt); }

  .mg-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xl) 0;
    color: var(--text-secondary);
    text-align: center;
  }

  /* Mapa: alto real fijo (no 100vh) para no romper el scroll de la página.
     Desktop es la base (520px) y se reduce en los breakpoints estándar de
     la app, igual que el resto del panel unificado. */
  .mg-map-wrapper {
    width: 100%;
    height: 520px;
    min-height: 320px;
    position: relative;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .mg-map-container {
    width: 100%;
    height: 100%;
  }
  @media (max-width: 1024px) {
    .mg-map-wrapper { height: 420px; }
  }
  @media (max-width: 640px) {
    .mg-map-wrapper { height: 320px; }
  }

  .mg-legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm) var(--space-lg);
    font-size: var(--fs-sm);
    color: var(--text-secondary);
  }
  .mg-legend li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .mg-table-scroll { overflow-x: auto; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-md);
  }
  th, td {
    text-align: left;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }
  th {
    color: var(--text-secondary);
    font-weight: 600;
    font-size: var(--fs-sm);
  }
  td.num {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  /* Popups (contenido inyectado como elementos DOM reales, no HTML string) */
  :global(.mg-popup) {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  :global(.mg-popup-title) {
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }
  :global(.mg-popup-row) { margin: 0; color: #475569; }
  :global(.mg-popup-desc) { margin: 0; color: #1e293b; font-weight: 500; }
  :global(.mg-popup-link) {
    align-self: flex-start;
    margin-top: 4px;
    background: none;
    border: none;
    color: #2563eb;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  :global(.mg-popup-link:hover) { text-decoration: underline; }
  :global(.leaflet-popup-content) { margin: 8px 10px !important; }

  /* Etiqueta permanente de jornadas — relevo obligatorio del magenta */
  :global(.mg-jornada-label) {
    background: #e87ba4;
    color: #fff;
    border: none;
    font-weight: 700;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    box-shadow: none;
  }
  :global(.mg-jornada-label::before) { display: none; }
</style>
