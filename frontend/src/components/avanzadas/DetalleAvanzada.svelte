<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { navigationStore } from "../../stores/navigationStore";
  import { avanzadasStore } from "../../stores/avanzadasStore";
  import { descargarReporteAvanzadaPdf, MAX_FOTOS_POR_REQUERIMIENTO } from "../../api/avanzadas";
  import { getCurrentPosition, formatCoordinates, reverseGeocodeWithFallback } from "../../lib/geolocation";
  import { formatDate } from "../../lib/format-date";
  import { toDisplayableImageUrl, toOriginalUrl } from "../../lib/media-urls";
  import { extractAcronimo } from "../../data/avanzadas-catalogo";
  import type { RequerimientoAvanzada } from "../../types/avanzadas";
  import Alert from "../ui/Alert.svelte";
  import Button from "../ui/Button.svelte";
  import Icon from "../ui/Icon.svelte";
  import Modal from "../ui/Modal.svelte";
  import RequerimientoFormFields from "./RequerimientoFormFields.svelte";
  import EditarRequerimientoModal from "./EditarRequerimientoModal.svelte";
  import ViewHeader from "../ui/ViewHeader.svelte";

  /** Background refresh cadence while this view is mounted (see onMount): lets a
   * user see requerimientos added by other users/devices without a manual refresh. */
  const POLL_INTERVAL_MS = 40_000;

  $: params = $navigationStore.params;
  $: clientId = params.client_id || "";

  $: detalle = $avanzadasStore.detalle[clientId] || null;
  $: loading = $avanzadasStore.detalleLoading[clientId] ?? false;
  $: error = $avanzadasStore.detalleError[clientId] || null;

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    if (clientId) avanzadasStore.loadAvanzadaDetalle(clientId);
    // Catalogos (dependencias/categorias) feed the "+ Agregar Requerimiento" form below.
    avanzadasStore.loadCatalogos();
    // Background polling: lets a user viewing this avanzada see
    // requerimientos added by OTHER users/devices without needing to know
    // to hit "Actualizar" manually. Silent so it never flips the full
    // skeleton mid-view.
    pollTimer = setInterval(() => {
      if (clientId) avanzadasStore.loadAvanzadaDetalle(clientId, { silent: true });
    }, POLL_INTERVAL_MS);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    // Revoke any preview blob URLs left over if the user navigates away
    // while the "+ Agregar Requerimiento" form is still open.
    nuevoFotos.forEach((f) => URL.revokeObjectURL(f.previewUrl));
  });

  function volver() {
    navigationStore.navigate("avanzadas");
  }

  function reintentar() {
    avanzadasStore.loadAvanzadaDetalle(clientId);
  }

  /* ---- Actualizar (refresh manual, en segundo plano) ---- */
  let actualizando = false;

  async function actualizarManual() {
    if (actualizando) return;
    actualizando = true;
    try {
      await avanzadasStore.loadAvanzadaDetalle(clientId, { silent: true });
    } finally {
      actualizando = false;
    }
  }

  /* ---- Crear PDF ---- */
  let generandoPdf = false;
  let errorPdf = "";

  async function crearPdf() {
    if (generandoPdf) return;
    generandoPdf = true;
    errorPdf = "";
    try {
      await descargarReporteAvanzadaPdf(clientId);
    } catch (e) {
      errorPdf = "No se pudo generar el PDF. Intenta de nuevo.";
    } finally {
      generandoPdf = false;
    }
  }

  /** Parses a "lat, lng" string into a Google Maps link, or null if unusable. */
  function mapsUrl(coordenadas: string | null | undefined): string | null {
    if (!coordenadas) return null;
    const parts = coordenadas.split(",").map((p) => p.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    return `https://www.google.com/maps?q=${parts[0]},${parts[1]}`;
  }

  /* ---- Asistentes (collapsible) ---- */
  let asistentesAbierto = true;

  /* ---- Requerimientos: filter + group by entidad ---- */
  let filtroTexto = "";
  let filtroEntidad = "";
  let entidadesColapsadas: Record<string, boolean> = {};

  $: requerimientos = detalle?.requerimientos || [];
  // Todos los organismos de cada requerimiento (no solo el primario) cuentan
  // para el filtro y el agrupado -- un requerimiento con varios organismos
  // debe poder encontrarse/filtrarse por cualquiera de ellos, no solo el
  // primero (ver organismosDe más abajo).
  $: entidadesDisponibles = Array.from(new Set(requerimientos.flatMap((r) => organismosDe(r)))).sort();

  $: requerimientosFiltrados = requerimientos.filter((r) => {
    if (filtroEntidad && !organismosDe(r).includes(filtroEntidad)) return false;
    if (filtroTexto) {
      const q = filtroTexto.toLowerCase();
      const match =
        r.requerimiento.toLowerCase().includes(q) ||
        r.categoria.toLowerCase().includes(q) ||
        (r.categoria_personalizada || "").toLowerCase().includes(q) ||
        r.ubicacion.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Un requerimiento con varios organismos aparece en el grupo de CADA UNO
  // (mismo criterio que el filtro): la lista de una entidad tiene que
  // mostrar todo lo que le compete, incluidos los compartidos con otras.
  $: gruposPorEntidad = (() => {
    const grouped: Record<string, RequerimientoAvanzada[]> = {};
    for (const req of requerimientosFiltrados) {
      for (const organismo of organismosDe(req)) {
        if (!grouped[organismo]) grouped[organismo] = [];
        grouped[organismo].push(req);
      }
    }
    return grouped;
  })();

  $: entidadesOrdenadas = Object.keys(gruposPorEntidad).sort();

  function isEntidadAbierta(entidad: string): boolean {
    return !entidadesColapsadas[entidad];
  }

  function toggleEntidad(entidad: string) {
    entidadesColapsadas = { ...entidadesColapsadas, [entidad]: isEntidadAbierta(entidad) };
  }

  /* ---- "+ Agregar Requerimiento" — formulario inline ---- */
  let mostrarFormRequerimiento = false;
  let guardandoRequerimiento = false;
  let errorNuevoRequerimiento = "";
  let capturandoGps = false;

  /** Requerimiento actualmente en edición (abre el modal); null cuando ninguno. */
  let reqEditando: RequerimientoAvanzada | null = null;

  let nuevoEntidades: string[] = [];
  let nuevoCategoria = "";
  let nuevoUsandoCategoriaPersonalizada = false;
  let nuevoCategoriaPersonalizadaTexto = "";
  let nuevoRequerimientoTexto = "";
  let nuevoUbicacion = "";
  let nuevoCoordenadas = "";

  /** Each entry owns ONE object URL, created once when the file is added and
   * revoked when removed/cleared/unmounted — never re-created on every
   * reactive re-render (that would leak a blob URL per render, see
   * getFilePreviewUrl's removal below). Mirrors RegistrarAvanzada.svelte's
   * asistente `fotoPreview` handling. */
  interface NuevaFotoDraft {
    file: File;
    previewUrl: string;
  }
  let nuevoFotos: NuevaFotoDraft[] = [];

  function handleNuevasFotos(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const nuevos = Array.from(input.files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    const combined = [...nuevoFotos, ...nuevos];
    if (combined.length > MAX_FOTOS_POR_REQUERIMIENTO) {
      errorNuevoRequerimiento = `Máximo ${MAX_FOTOS_POR_REQUERIMIENTO} fotos permitidas`;
      nuevos.forEach((n) => URL.revokeObjectURL(n.previewUrl));
      input.value = "";
      return;
    }
    nuevoFotos = combined;
    input.value = "";
  }

  function quitarNuevaFoto(idx: number) {
    URL.revokeObjectURL(nuevoFotos[idx].previewUrl);
    nuevoFotos = nuevoFotos.filter((_, i) => i !== idx);
  }

  /** Clears every nuevo* form field (blob URLs revoked); does not toggle visibility. */
  function resetFormRequerimiento() {
    nuevoEntidades = [];
    nuevoCategoria = "";
    nuevoUsandoCategoriaPersonalizada = false;
    nuevoCategoriaPersonalizadaTexto = "";
    nuevoRequerimientoTexto = "";
    nuevoUbicacion = "";
    nuevoCoordenadas = "";
    nuevoFotos.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    nuevoFotos = [];
    errorNuevoRequerimiento = "";
  }

  function abrirFormRequerimiento() {
    resetFormRequerimiento();
    mostrarFormRequerimiento = true;
  }

  function abrirEdicionRequerimiento(req: RequerimientoAvanzada) {
    reqEditando = req;
  }

  function cerrarFormRequerimiento() {
    resetFormRequerimiento();
    mostrarFormRequerimiento = false;
  }

  /** Organismos solicitados de un requerimiento; fallback para docs viejos sin `entidades` (ver abrirEdicionRequerimiento). */
  function organismosDe(req: RequerimientoAvanzada): string[] {
    return req.entidades?.length ? req.entidades : req.entidad ? [req.entidad] : [];
  }

  /* ---- Eliminar requerimiento ---- */
  let errorEliminarReq = "";
  let reqAEliminar: RequerimientoAvanzada | null = null;
  let eliminandoReq = false;

  function pedirEliminarRequerimiento(req: RequerimientoAvanzada) {
    if (!req.id) return;
    errorEliminarReq = "";
    reqAEliminar = req;
  }

  function cancelarEliminarRequerimiento() {
    reqAEliminar = null;
  }

  async function confirmarEliminarRequerimiento() {
    if (!reqAEliminar?.id) return;
    const req = reqAEliminar;
    eliminandoReq = true;
    try {
      await avanzadasStore.eliminarRequerimiento(clientId, req.id);
      if (reqEditando?.id === req.id) reqEditando = null;
      reqAEliminar = null;
    } catch (err) {
      errorEliminarReq = err instanceof Error ? err.message : "No se pudo eliminar el requerimiento.";
    } finally {
      eliminandoReq = false;
    }
  }

  /* ---- GPS: mismo patrón que RegistrarAvanzada, adaptado al estado plano ---- */
  async function capturarGps() {
    capturandoGps = true;
    try {
      const pos = await getCurrentPosition();
      nuevoCoordenadas = formatCoordinates(pos);
      await intentarRellenarUbicacion();
    } catch (err) {
      errorNuevoRequerimiento = err instanceof Error ? err.message : "No se pudo obtener el GPS del dispositivo.";
    } finally {
      capturandoGps = false;
    }
  }

  async function intentarRellenarUbicacion() {
    if (nuevoUbicacion.trim()) return;
    const partes = nuevoCoordenadas.split(",").map((p) => p.trim());
    if (partes.length !== 2) return;
    const lat = parseFloat(partes[0]);
    const lng = parseFloat(partes[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    try {
      const r = await reverseGeocodeWithFallback(lat, lng);
      if (r && r.direccion_formateada && !nuevoUbicacion.trim()) {
        nuevoUbicacion = r.direccion_formateada;
      }
    } catch {
      /* comodidad opcional, nunca bloquea */
    }
  }

  async function guardarNuevoRequerimiento() {
    errorNuevoRequerimiento = "";
    if (nuevoEntidades.length === 0) {
      errorNuevoRequerimiento = "Seleccione al menos un organismo.";
      return;
    }
    if (!nuevoRequerimientoTexto.trim()) {
      errorNuevoRequerimiento = "Describa el requerimiento.";
      return;
    }
    const categoriaElegida = nuevoUsandoCategoriaPersonalizada
      ? nuevoCategoriaPersonalizadaTexto.trim()
      : nuevoCategoria;
    if (!categoriaElegida) {
      errorNuevoRequerimiento = "Selecciona una categoría.";
      return;
    }
    if (!nuevoUbicacion.trim()) {
      errorNuevoRequerimiento = "Indique la ubicación.";
      return;
    }

    guardandoRequerimiento = true;
    try {
      const datos = {
        // El backend deriva entidad = entidades[0]; enviamos ambos para
        // satisfacer el contrato legacy (entidad) sin dejar de mandar la
        // multi-selección nueva (entidades).
        entidad: nuevoEntidades[0],
        entidades: nuevoEntidades,
        categoria: nuevoUsandoCategoriaPersonalizada ? nuevoCategoriaPersonalizadaTexto.trim() : nuevoCategoria,
        categoria_personalizada: nuevoUsandoCategoriaPersonalizada
          ? nuevoCategoriaPersonalizadaTexto.trim() || null
          : null,
        requerimiento: nuevoRequerimientoTexto.trim(),
        ubicacion: nuevoUbicacion.trim(),
        coordenadas: nuevoCoordenadas.trim() || null,
      };
      await avanzadasStore.agregarRequerimiento(clientId, datos, nuevoFotos.map((f) => f.file));
      cerrarFormRequerimiento();
    } catch (err) {
      errorNuevoRequerimiento =
        err instanceof Error ? err.message : "No se pudo agregar el requerimiento.";
    } finally {
      guardandoRequerimiento = false;
    }
  }

  /* ---- Photos: displayable URL + broken-image fallback + lightbox ---- */
  let brokenImages: Record<string, boolean> = {};

  function handleImgError(url: string) {
    brokenImages = { ...brokenImages, [url]: true };
  }

  let lightboxRawUrl = "";

  function openLightbox(rawUrl: string) {
    lightboxRawUrl = rawUrl;
  }

  function closeLightbox() {
    lightboxRawUrl = "";
  }

  function handleLightboxKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeLightbox();
  }
</script>

<div class="view">
  <ViewHeader
    title={detalle ? detalle.nombre_avanzada : "Detalle de avanzada"}
    icon="flag"
    onBack={volver}
  />

  <main class="view-body container">
    {#if loading}
      <div class="skeleton-wrap" aria-busy="true" aria-label="Cargando detalle de la avanzada">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    {:else if error}
      <div class="status-state error-state">
        <p class="error-msg">{error}</p>
        <Button on:click={reintentar}>Reintentar</Button>
      </div>
    {:else if !detalle}
      <div class="status-state">
        <h3>Avanzada no encontrada</h3>
        <p>No se pudo ubicar esta avanzada.</p>
        <Button on:click={volver}>Volver al listado</Button>
      </div>
    {:else}
      {#if detalle.isOffline}
        <div class="offline-banner">
          <Icon name="clock" size={14} />
          Pendiente de sincronizar — mostrando datos guardados localmente.
        </div>
      {/if}

      <!-- Header summary -->
      <section class="summary-card">
        <div class="summary-top">
          <span class="date-chip">
            <Icon name="calendar" size={13} />
            {formatDate(detalle.fecha)}
          </span>
          <div class="summary-top-actions">
            {#if detalle.informe_url}
              <a class="informe-link" href={toOriginalUrl(detalle.informe_url)} target="_blank" rel="noopener">
                Ver informe ↗
              </a>
            {/if}
            <button
              type="button"
              class="crear-pdf-btn"
              on:click={actualizarManual}
              disabled={actualizando}
            >
              <Icon name={actualizando ? "clock" : "refresh-cw"} size={14} />
              {actualizando ? "Actualizando…" : "Actualizar"}
            </button>
            <button
              type="button"
              class="crear-pdf-btn"
              on:click={crearPdf}
              disabled={generandoPdf}
            >
              <Icon name={generandoPdf ? "clock" : "file-text"} size={14} />
              {generandoPdf ? "Generando…" : "Crear PDF"}
            </button>
          </div>
        </div>
        {#if errorPdf}
          <p class="pdf-error">{errorPdf}</p>
        {/if}

        <dl class="summary-grid">
          <div class="summary-item">
            <dt>Estrategia</dt>
            <dd>{detalle.estrategia}</dd>
          </div>
          <div class="summary-item">
            <dt>Sector</dt>
            <dd>{detalle.sector || "—"}</dd>
          </div>
          <div class="summary-item">
            <dt>Comuna / Barrio</dt>
            <dd>{detalle.comuna}, {detalle.barrio}</dd>
          </div>
          <div class="summary-item summary-item--wide">
            <dt>Dirección</dt>
            <dd>
              {detalle.direccion}
              {#if mapsUrl(detalle.coordenadas)}
                <a class="maps-link" href={mapsUrl(detalle.coordenadas)} target="_blank" rel="noopener">
                  <Icon name="map-pin" size={12} /> Ver en mapa
                </a>
              {/if}
            </dd>
          </div>
        </dl>

        {#if detalle.encargados && detalle.encargados.length > 0}
          <div class="chips-row">
            {#each detalle.encargados as encargado}
              <span class="chip">{encargado}</span>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Asistentes -->
      <section class="section-card">
        <button class="section-header" type="button" on:click={() => (asistentesAbierto = !asistentesAbierto)}>
          <span class="section-title">
            <Icon name="users" size={16} /> Asistentes
            <span class="count-badge">{detalle.asistentes?.length ?? 0}</span>
          </span>
          <svg class="chevron" class:rotated={asistentesAbierto} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {#if asistentesAbierto}
          {#if !detalle.asistentes || detalle.asistentes.length === 0}
            <p class="empty-hint">Sin asistentes registrados.</p>
          {:else}
            <div class="asistentes-table">
              {#each detalle.asistentes as asistente}
                <div class="asistente-row">
                  <span class="asistente-nombre">{asistente.nombre}</span>
                  {#if asistente.organismo}<span class="asistente-meta">{asistente.organismo}</span>{/if}
                  {#if asistente.celular}<span class="asistente-meta">{asistente.celular}</span>{/if}
                  {#if asistente.correo}<span class="asistente-meta">{asistente.correo}</span>{/if}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </section>

      <!-- Requerimientos -->
      <section class="section-card">
        <div class="req-section-header">
          <span class="section-title">
            <Icon name="clipboard-list" size={16} /> Requerimientos
            <span class="count-badge">{requerimientos.length}</span>
          </span>
          {#if !mostrarFormRequerimiento}
            <button type="button" class="agregar-req-btn" on:click={abrirFormRequerimiento}>
              <Icon name="plus" size={14} /> Agregar Requerimiento
            </button>
          {/if}
        </div>

        {#if mostrarFormRequerimiento}
          <div class="nuevo-req-form">
            {#if errorNuevoRequerimiento}
              <Alert type="error" message={errorNuevoRequerimiento} />
            {/if}

            <RequerimientoFormFields
              idPrefix="nuevo"
              bind:entidades={nuevoEntidades}
              bind:categoria={nuevoCategoria}
              bind:usandoCategoriaPersonalizada={nuevoUsandoCategoriaPersonalizada}
              bind:categoriaPersonalizadaTexto={nuevoCategoriaPersonalizadaTexto}
              bind:requerimiento={nuevoRequerimientoTexto}
              bind:ubicacion={nuevoUbicacion}
              bind:coordenadas={nuevoCoordenadas}
              dependencias={$avanzadasStore.catalogos.dependencias}
              categoriasCatalogo={$avanzadasStore.catalogos.categorias}
              on:coordsblur={intentarRellenarUbicacion}
            >
              <Button
                slot="gps"
                type="button"
                variant="primary"
                size="sm"
                loading={capturandoGps}
                on:click={capturarGps}
              >
                GPS
              </Button>
            </RequerimientoFormFields>

            <div class="media-attachments">
              <!-- svelte-ignore a11y-label-has-associated-control -->
              <label class="field-label-subtle">
                Evidencia fotográfica <small>(máx. {MAX_FOTOS_POR_REQUERIMIENTO})</small>
              </label>
              <div class="fotos-container">
                {#each nuevoFotos as foto, fIdx (foto.previewUrl)}
                  <div class="foto-thumb-edit">
                    <img src={foto.previewUrl} alt={foto.file.name} />
                    <button type="button" class="foto-del" aria-label="Eliminar foto" on:click={() => quitarNuevaFoto(fIdx)}>
                      <Icon name="x" size={11} />
                    </button>
                  </div>
                {/each}
              </div>
              <div class="media-actions">
                <label class="media-btn">
                  <Icon name="camera" size={16} />
                  <span>Cámara</span>
                  <input type="file" accept="image/*" capture="environment" on:change={handleNuevasFotos} hidden />
                </label>
                <label class="media-btn">
                  <Icon name="image" size={16} />
                  <span>Galería</span>
                  <input type="file" accept="image/*" multiple on:change={handleNuevasFotos} hidden />
                </label>
              </div>
            </div>

            <div class="nuevo-req-actions">
              <Button type="button" variant="secondary" on:click={cerrarFormRequerimiento} disabled={guardandoRequerimiento}>
                Cancelar
              </Button>
              <Button type="button" on:click={guardarNuevoRequerimiento} loading={guardandoRequerimiento}>
                Guardar requerimiento
              </Button>
            </div>
          </div>
        {/if}

        {#if errorEliminarReq}
          <Alert type="error" message={errorEliminarReq} />
        {/if}

        <div class="filters-row">
          <div class="filter-search">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="Buscar por requerimiento, categoría o ubicación…"
              bind:value={filtroTexto}
            />
          </div>
          <select class="filter-entidad" bind:value={filtroEntidad}>
            <option value="">Todas las entidades</option>
            {#each entidadesDisponibles as entidad}
              <option value={entidad}>{entidad}</option>
            {/each}
          </select>
        </div>

        {#if requerimientos.length === 0}
          <p class="empty-hint">Esta avanzada no tiene requerimientos registrados.</p>
        {:else if requerimientosFiltrados.length === 0}
          <p class="empty-hint">Ningún requerimiento coincide con el filtro.</p>
        {:else}
          {#each entidadesOrdenadas as entidad}
            <div class="entidad-group">
              <button class="entidad-header" type="button" on:click={() => toggleEntidad(entidad)}>
                <span class="entidad-name">{entidad}</span>
                <span class="count-badge">{gruposPorEntidad[entidad].length}</span>
                <svg class="chevron" class:rotated={!entidadesColapsadas[entidad]} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              {#if !entidadesColapsadas[entidad]}
                <div class="req-list">
                  {#each gruposPorEntidad[entidad] as req}
                    <div class="req-card">
                      <div class="req-card-top">
                        <span class="categoria-badge">
                          {req.categoria_personalizada || req.categoria}
                        </span>
                        {#if req.id}
                          <div class="req-card-actions">
                            <button
                              type="button"
                              class="editar-req-btn"
                              aria-label="Editar requerimiento"
                              on:click={() => abrirEdicionRequerimiento(req)}
                            >
                              <Icon name="edit" size={13} /> Editar
                            </button>
                            <button
                              type="button"
                              class="eliminar-req-btn"
                              aria-label="Eliminar requerimiento"
                              on:click={() => pedirEliminarRequerimiento(req)}
                            >
                              <Icon name="trash" size={13} /> Eliminar
                            </button>
                          </div>
                        {/if}
                      </div>
                      {#if organismosDe(req).length > 0}
                        <div class="req-organismos">
                          {#each organismosDe(req) as organismo, i}
                            <span class="entidad-chip" class:entidad-chip-primary={i === 0}>
                              {extractAcronimo(organismo)}
                            </span>
                          {/each}
                        </div>
                      {/if}
                      <p class="req-text">{req.requerimiento}</p>
                      <p class="req-ubicacion">
                        <Icon name="map-pin" size={13} />
                        {req.ubicacion}
                        {#if mapsUrl(req.coordenadas)}
                          <a class="maps-link" href={mapsUrl(req.coordenadas)} target="_blank" rel="noopener">
                            Ver en mapa
                          </a>
                        {/if}
                      </p>

                      {#if req.fotos_urls && req.fotos_urls.length > 0}
                        <div class="fotos-grid">
                          {#each req.fotos_urls as rawUrl}
                            {#if brokenImages[rawUrl]}
                              <a class="foto-fallback" href={toOriginalUrl(rawUrl)} target="_blank" rel="noopener">
                                <Icon name="image" size={18} />
                                <span>Abrir en Drive ↗</span>
                              </a>
                            {:else}
                              <button
                                type="button"
                                class="foto-thumb"
                                on:click={() => openLightbox(rawUrl)}
                                title="Ver imagen completa"
                              >
                                <img
                                  src={toDisplayableImageUrl(rawUrl, "w400")}
                                  alt={req.requerimiento}
                                  loading="lazy"
                                  decoding="async"
                                  on:error={() => handleImgError(rawUrl)}
                                />
                              </button>
                            {/if}
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </section>
    {/if}
  </main>
</div>

<EditarRequerimientoModal
  show={reqEditando !== null}
  {clientId}
  req={reqEditando}
  on:close={() => (reqEditando = null)}
  on:saved={() => (reqEditando = null)}
/>

<Modal show={reqAEliminar !== null} title="Eliminar requerimiento" on:close={cancelarEliminarRequerimiento}>
  <p>¿Eliminar este requerimiento? Esta acción no se puede deshacer.</p>
  <svelte:fragment slot="footer">
    <Button type="button" variant="secondary" on:click={cancelarEliminarRequerimiento} disabled={eliminandoReq}>
      Cancelar
    </Button>
    <Button type="button" variant="danger" on:click={confirmarEliminarRequerimiento} loading={eliminandoReq}>
      Eliminar
    </Button>
  </svelte:fragment>
</Modal>

<!-- Lightbox -->
{#if lightboxRawUrl}
  <div
    class="lightbox-overlay"
    on:click={closeLightbox}
    on:keydown={handleLightboxKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="lightbox-content" on:click|stopPropagation={() => {}}>
      <button class="lightbox-close" type="button" on:click={closeLightbox}>&times;</button>
      {#if brokenImages[lightboxRawUrl]}
        <div class="lightbox-fallback">
          <Icon name="image" size={40} />
          <span>Imagen no disponible</span>
          <a href={toOriginalUrl(lightboxRawUrl)} target="_blank" rel="noopener">Abrir en Drive ↗</a>
        </div>
      {:else}
        <img
          src={toDisplayableImageUrl(lightboxRawUrl, "w1200")}
          alt="Foto del requerimiento"
          class="lightbox-img"
          on:error={() => handleImgError(lightboxRawUrl)}
        />
        <a class="lightbox-original" href={toOriginalUrl(lightboxRawUrl)} target="_blank" rel="noopener">
          Abrir original ↗
        </a>
      {/if}
    </div>
  </div>
{/if}

<style>
  .view {
    min-height: 100vh;
    min-height: -webkit-fill-available;
    min-height: 100dvh;
    background: var(--bg);
  }
  .view-body {
    padding: 1rem;
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Skeleton */
  .skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding-top: 0.5rem;
  }
  .skeleton {
    background: linear-gradient(90deg, #e2e8f0 25%, #edf2f7 50%, #e2e8f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 8px;
  }
  .skeleton-title { height: 28px; width: 60%; }
  .skeleton-line { height: 14px; width: 90%; }
  .skeleton-line.short { width: 50%; }
  .skeleton-card { height: 120px; width: 100%; margin-top: 0.5rem; }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Status states */
  .status-state {
    text-align: center;
    padding: 4rem 1rem;
    color: var(--text-secondary);
  }
  .status-state h3 {
    color: var(--text);
    margin-bottom: 0.5rem;
  }
  .error-state .error-msg {
    color: var(--error);
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: var(--radius-md);
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    font-size: var(--fs-md);
  }

  .offline-banner {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #fffbeb;
    border: 1px solid #fcd34d;
    color: var(--warning-ink);
    font-size: var(--fs-base);
    font-weight: 600;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
  }

  /* Summary */
  .summary-card, .section-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1rem 1.15rem;
    box-shadow: var(--shadow-sm);
  }
  .summary-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  .date-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--fs-sm);
    font-weight: 500;
    color: var(--text-body);
    background: var(--surface-alt);
    padding: 0.2rem 0.55rem;
    border-radius: var(--radius-sm);
  }
  .informe-link {
    font-size: var(--fs-base);
    font-weight: 600;
    color: var(--primary);
    text-decoration: none;
  }
  .informe-link:hover { text-decoration: underline; }

  .summary-top-actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .crear-pdf-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: var(--surface-alt);
    color: var(--text-body);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.3rem 0.65rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .crear-pdf-btn:hover:not(:disabled) {
    border-color: var(--border-strong);
    background: var(--surface);
  }
  .crear-pdf-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
  .pdf-error {
    color: var(--error);
    font-size: var(--fs-sm);
    margin: 0.4rem 0 0;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 1rem;
    margin: 0;
  }
  .summary-item--wide { grid-column: 1 / -1; }
  .summary-item dt {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.15rem;
  }
  .summary-item dd {
    font-size: 0.86rem;
    color: var(--text);
    margin: 0;
  }
  .maps-link {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    margin-left: 0.5rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--primary);
    text-decoration: none;
  }
  .maps-link:hover { text-decoration: underline; }

  .chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.75rem;
  }
  .chip {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--primary-darker);
    background: var(--primary-light);
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-pill);
  }

  /* Collapsible sections */
  .section-header, .req-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
  }
  .section-title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-strong);
  }
  .count-badge {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--text-body);
    background: var(--surface-alt);
    padding: 0.1rem 0.45rem;
    border-radius: var(--radius-pill);
  }
  .chevron {
    color: var(--text-muted);
    transition: transform 0.15s;
  }
  .chevron.rotated { transform: rotate(180deg); }

  .empty-hint {
    color: var(--text-secondary);
    font-size: var(--fs-md);
    padding: 0.75rem 0 0.25rem;
  }

  .asistentes-table {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .asistente-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.5rem 0.6rem;
    background: var(--bg);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }
  .asistente-nombre {
    font-weight: 700;
    font-size: var(--fs-md);
    color: var(--text);
  }
  .asistente-meta {
    font-size: var(--fs-sm);
    color: var(--text-secondary);
  }

  /* "+ Agregar Requerimiento" inline form */
  .agregar-req-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: var(--surface-alt);
    color: var(--text-body);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.3rem 0.65rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .agregar-req-btn:hover {
    border-color: var(--border-strong);
    background: var(--surface);
  }
  .nuevo-req-form {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 0.85rem;
    margin: 0.75rem 0;
  }
  .nuevo-req-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .field-label-subtle {
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--text-body);
  }
  .field-label-subtle small {
    font-weight: 400;
    color: var(--text-muted);
  }
  .media-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .media-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text-body);
    font-size: var(--fs-base);
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .media-btn:hover {
    background: var(--bg);
    border-color: var(--text-muted);
  }
  .fotos-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.375rem;
  }
  .foto-thumb-edit {
    position: relative;
    width: 90px;
    height: 90px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1.5px solid var(--border-strong);
    flex-shrink: 0;
  }
  .foto-thumb-edit img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .foto-del {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 22px;
    height: 22px;
    background: var(--error);
    color: #fff;
    border: none;
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Filters */
  .filters-row {
    display: flex;
    gap: 0.5rem;
    margin: 0.75rem 0;
  }
  .filter-search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--surface-alt);
    border-radius: var(--radius-md);
    padding: 0.45rem 0.65rem;
    color: var(--text-secondary);
  }
  .filter-search input {
    flex: 1;
    border: none;
    background: none;
    outline: none;
    font-size: var(--fs-md);
    font-family: inherit;
    color: var(--text);
  }
  .filter-entidad {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.45rem 0.5rem;
    font-size: var(--fs-base);
    font-family: inherit;
    color: #334155;
    background: var(--surface);
  }

  /* Entidad groups */
  .entidad-group {
    border-top: 1px solid var(--surface-alt);
    padding-top: 0.6rem;
    margin-top: 0.6rem;
  }
  .entidad-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    background: none;
    border: none;
    padding: 0.3rem 0;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }
  .entidad-name {
    flex: 1;
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-strong);
  }
  .req-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .req-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 0.65rem 0.8rem;
  }
  .req-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }
  .req-card-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }
  .editar-req-btn, .eliminar-req-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    padding: 0.15rem 0.3rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    flex-shrink: 0;
  }
  .editar-req-btn {
    color: var(--primary);
  }
  .editar-req-btn:hover {
    text-decoration: underline;
  }
  .eliminar-req-btn {
    color: var(--error);
  }
  .eliminar-req-btn:hover {
    text-decoration: underline;
  }
  .req-organismos {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.3rem;
  }
  .entidad-chip {
    display: inline-block;
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--primary-darker);
    background: var(--primary-light);
    padding: 0.1rem 0.45rem;
    border-radius: var(--radius-pill);
  }
  .entidad-chip-primary {
    font-weight: 700;
  }
  .categoria-badge {
    display: inline-block;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: #0d9488;
    background: #f0fdfa;
    padding: 0.1rem 0.45rem;
    border-radius: 4px;
  }
  .req-text {
    font-size: var(--fs-md);
    color: #334155;
    line-height: 1.45;
    margin: 0.3rem 0;
  }
  .req-ubicacion {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.3rem;
    font-size: var(--fs-sm);
    color: var(--text-secondary);
    margin: 0;
  }

  /* Photos grid */
  .fotos-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.6rem;
  }
  .foto-thumb {
    width: 72px;
    height: 72px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--border);
    padding: 0;
    cursor: pointer;
    background: var(--surface-alt);
  }
  .foto-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .foto-fallback {
    width: 72px;
    height: 72px;
    border-radius: var(--radius-md);
    border: 1px dashed var(--border-strong);
    background: var(--surface-alt);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    color: var(--text-secondary);
    text-decoration: none;
    text-align: center;
    padding: 0.2rem;
  }
  .foto-fallback span {
    font-size: 0.58rem;
    font-weight: 600;
    line-height: 1.1;
  }

  /* Lightbox */
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .lightbox-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  /* Hit area raised to --tap-min via padding + negative margin so the visual
     glyph stays a compact 32px circle while the tappable area meets the
     44px field-use guideline. */
  .lightbox-close {
    position: absolute;
    top: calc(-12px - (var(--tap-min) - 32px) / 2);
    right: calc(-12px - (var(--tap-min) - 32px) / 2);
    background: var(--surface);
    border: none;
    width: var(--tap-min);
    height: var(--tap-min);
    border-radius: 50%;
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    color: var(--text);
    z-index: 1;
  }
  .lightbox-img {
    max-width: 90vw;
    max-height: 80vh;
    object-fit: contain;
    border-radius: var(--radius-sm);
  }
  .lightbox-original {
    font-size: var(--fs-base);
    color: var(--border);
    text-decoration: underline;
  }
  .lightbox-fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 200px;
    min-width: 260px;
    color: var(--text-muted);
  }
  .lightbox-fallback a {
    color: #60a5fa;
    font-size: var(--fs-md);
  }

  @media (max-width: 640px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
