<script lang="ts">
  import { onMount } from "svelte";
  import { navigationStore } from "../../stores/navigationStore";
  import { seguimientoStore, getRequerimientosByVisita } from "../../stores/seguimientoStore";
  import type { Requerimiento, DocumentoAdjunto } from "../../types/seguimiento";
  import type { VisitaProgramada } from "../../types/seguimiento";
  import Button from "../ui/Button.svelte";
  import Icon from "../ui/Icon.svelte";

  let visita: VisitaProgramada | null = null;
  let loading = true;
  let lightboxUrl = "";
  let lightboxName = "";
  let expandedReqId: string | null = null;
  let carouselIndices: Record<string, number> = {};
  let brokenImages: Record<string, boolean> = {};

  function handleImgError(url: string) {
    brokenImages = { ...brokenImages, [url]: true };
  }

  function audioSrc(url: string): string {
    const s3Host = 'https://catatrack-photos.s3.amazonaws.com';
    if (url.startsWith(s3Host)) {
      return '/s3-audio' + url.slice(s3Host.length);
    }
    return url;
  }

  function getTranscripcion(req: Requerimiento): string | null {
    if (!req.transcripciones || req.transcripciones.length === 0) return null;
    // Return the first non-empty transcription
    const t = req.transcripciones.find(t => t.transcripcion && t.transcripcion.trim().length > 0);
    return t ? t.transcripcion : null;
  }

  $: params = $navigationStore.params;
  $: visitaId = params.visitaId || "";
  $: reqStore = getRequerimientosByVisita(visitaId);
  $: requerimientos = $reqStore;

  onMount(() => {
    seguimientoStore.loadRequerimientos();
    const found = $seguimientoStore.visitas.find((v) => v.id === visitaId);
    visita = found || null;
    loading = false;
  });

  function toggleExpand(reqId: string) {
    expandedReqId = expandedReqId === reqId ? null : reqId;
  }

  function getEstadoColor(estado: string): { bg: string; color: string } {
    switch (estado) {
      case "nuevo": return { bg: "#dbeafe", color: "#1e40af" };
      case "radicado": return { bg: "#e0e7ff", color: "#3730a3" };
      case "asignado": return { bg: "#fef3c7", color: "#92400e" };
      case "en-gestion": case "en-proceso": return { bg: "#fef9c3", color: "#854d0e" };
      case "resuelto": return { bg: "#dcfce7", color: "#166534" };
      case "cerrado": return { bg: "#f1f5f9", color: "#475569" };
      case "cancelado": return { bg: "#fee2e2", color: "#991b1b" };
      default: return { bg: "#f1f5f9", color: "#475569" };
    }
  }

  function formatDate(d: string): string {
    try {
      return new Date(d).toLocaleDateString("es-CO", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { return d; }
  }

  function isImage(doc: DocumentoAdjunto): boolean {
    return doc.tipo.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)/i.test(doc.nombre);
  }

  function isVideo(doc: DocumentoAdjunto): boolean {
    return doc.tipo.startsWith("video/") || /\.(mp4|webm|mov)/i.test(doc.nombre);
  }

  function isAudio(doc: DocumentoAdjunto): boolean {
    return doc.tipo.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|webm)/i.test(doc.nombre) || doc.nombre.startsWith("nota_voz_");
  }

  function getImages(req: Requerimiento): DocumentoAdjunto[] {
    return req.documentos_adjuntos.filter(isImage);
  }

  function getVideos(req: Requerimiento): DocumentoAdjunto[] {
    return req.documentos_adjuntos.filter(isVideo);
  }

  function getAudios(req: Requerimiento): DocumentoAdjunto[] {
    return req.documentos_adjuntos.filter(isAudio);
  }

  function getFiles(req: Requerimiento): DocumentoAdjunto[] {
    return req.documentos_adjuntos.filter(d => !isImage(d) && !isVideo(d) && !isAudio(d));
  }

  function carouselPrev(reqId: string, total: number) {
    const cur = carouselIndices[reqId] || 0;
    carouselIndices = { ...carouselIndices, [reqId]: (cur - 1 + total) % total };
  }

  function carouselNext(reqId: string, total: number) {
    const cur = carouselIndices[reqId] || 0;
    carouselIndices = { ...carouselIndices, [reqId]: (cur + 1) % total };
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.navigate("visitas-programadas")}>← Volver</button>
    <h2 class="view-title">
      Requerimientos
      {#if visita}
        <span class="title-visit-id">{visita.id}</span>
      {/if}
    </h2>
    {#if requerimientos.length > 0}
      <Button size="sm" on:click={() => navigationStore.navigate("kanban", { visitaId })}>
        <span class="action-content"><Icon name="eye" size={14} /> Kanban</span>
      </Button>
    {/if}
  </header>

  <main class="view-body">
    {#if loading || $seguimientoStore.loading}
      <div class="status-state">
        <div class="spinner"></div>
        <p>Cargando requerimientos…</p>
      </div>
    {:else if requerimientos.length === 0}
      <div class="status-state">
        <h3>Sin requerimientos</h3>
        <p>Esta visita aún no tiene requerimientos registrados.</p>
        <Button on:click={() => navigationStore.navigate("registrar-requerimiento-visita", { visitaId })}>
          Registrar Requerimiento
        </Button>
      </div>
    {:else}
      <div class="summary-bar">
        <span class="summary-count">{requerimientos.length} requerimiento{requerimientos.length !== 1 ? "s" : ""}</span>
        <Button size="sm" on:click={() => navigationStore.navigate("registrar-requerimiento-visita", { visitaId })}>
          <span class="action-content"><Icon name="clipboard-list" size={14} /> + Registrar</span>
        </Button>
      </div>

      {#each requerimientos as req (req.id)}
        {@const estadoStyle = getEstadoColor(req.estado)}
        {@const isExpanded = expandedReqId === req.id}
        {@const images = getImages(req)}
        {@const videos = getVideos(req)}
        {@const audios = getAudios(req)}
        {@const files = getFiles(req)}
        {@const idx = carouselIndices[req.id] || 0}
        <div class="req-card" class:expanded={isExpanded}>
          <!-- Card header (always visible) -->
          <button class="req-card-header" on:click={() => toggleExpand(req.id)} type="button">
            <div class="req-header-left">
              {#if req.rid}
                <span class="req-rid">{req.rid}</span>
              {/if}
              <span class="req-estado" style="background: {estadoStyle.bg}; color: {estadoStyle.color};">
                {req.estado}
              </span>
            </div>
            <span class="req-date">{formatDate(req.created_at)}</span>
            <svg class="expand-chevron" class:rotated={isExpanded} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          <!-- Summary line -->
          <div class="req-summary">
            {#if req.tipo_requerimiento}
              <span class="req-tipo">{req.tipo_requerimiento}</span>
            {/if}
            <p class="req-desc-preview">{req.descripcion}</p>
          </div>

          <!-- Image Carousel (always visible if images exist) -->
          {#if images.length > 0}
            <div class="carousel-section">
              <div class="carousel-container">
                {#if brokenImages[images[idx].url]}
                  <div class="carousel-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span class="placeholder-text">Imagen no disponible</span>
                    <span class="placeholder-hint">Error en URL del servidor (región S3 incorrecta)</span>
                  </div>
                {:else}
                  <button
                    class="carousel-main-img"
                    on:click={() => { lightboxUrl = images[idx].url; lightboxName = images[idx].nombre; }}
                    type="button"
                    title="Ver imagen completa"
                  >
                    <img
                      src={images[idx].url}
                      alt={images[idx].nombre}
                      loading="lazy"
                      on:error={() => handleImgError(images[idx].url)}
                    />
                  </button>
                {/if}
                {#if images.length > 1}
                  <button class="carousel-btn carousel-btn--prev" on:click|stopPropagation={() => carouselPrev(req.id, images.length)} type="button" title="Anterior">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button class="carousel-btn carousel-btn--next" on:click|stopPropagation={() => carouselNext(req.id, images.length)} type="button" title="Siguiente">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                  <div class="carousel-dots">
                    {#each images as _, i}
                      <button
                        class="carousel-dot"
                        class:active={i === idx}
                        on:click|stopPropagation={() => { carouselIndices = { ...carouselIndices, [req.id]: i }; }}
                        type="button"
                        aria-label="Imagen {i + 1}"
                      ></button>
                    {/each}
                  </div>
                  <span class="carousel-counter">{idx + 1}/{images.length}</span>
                {/if}
              </div>
              <!-- Thumbnails strip -->
              {#if images.length > 1}
                <div class="carousel-thumbs">
                  {#each images as img, i}
                    <button
                      class="carousel-thumb"
                      class:active={i === idx}
                      on:click|stopPropagation={() => { carouselIndices = { ...carouselIndices, [req.id]: i }; }}
                      type="button"
                    >
                      {#if brokenImages[img.url]}
                        <div class="thumb-broken">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
                        </div>
                      {:else}
                        <img src={img.url} alt={img.nombre} loading="lazy" on:error={() => handleImgError(img.url)} />
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          <!-- Videos (always visible) -->
          {#if videos.length > 0}
            <div class="media-inline-section">
              {#each videos as vid}
                <div class="inline-video-wrap">
                  <video src={vid.url} controls preload="metadata" class="inline-video">
                    <track kind="captions" />
                  </video>
                  <span class="media-inline-name">{vid.nombre}</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Audio players (always visible) -->
          {#if audios.length > 0 || req.nota_voz_url}
            <div class="audio-section">
              {#if req.nota_voz_url}
                <div class="audio-item">
                  <span class="audio-label"><Icon name="mic" size={14} /> Nota de voz</span>
                  <audio src={audioSrc(req.nota_voz_url)} controls preload="metadata" class="audio-player">
                    <track kind="captions" />
                  </audio>
                  {#if getTranscripcion(req)}
                    <div class="transcripcion-box">
                      <span class="transcripcion-label"><Icon name="file-text" size={12} /> Transcripción</span>
                      <p class="transcripcion-text">{getTranscripcion(req)}</p>
                    </div>
                  {/if}
                </div>
              {/if}
              {#each audios as aud}
                <div class="audio-item">
                  <span class="audio-label"><Icon name="mic" size={14} /> {aud.nombre}</span>
                  <audio src={audioSrc(aud.url)} controls preload="metadata" class="audio-player">
                    <track kind="captions" />
                  </audio>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Expanded detail -->
          {#if isExpanded}
            <div class="req-detail">
              <hr />

              <!-- Solicitante -->
              <div class="detail-section">
                <h4>Solicitante</h4>
                <div class="sol-info">
                  <span class="sol-name">{req.solicitante.nombre_completo}</span>
                  {#if req.solicitante.telefono}
                    <span class="sol-meta"><Icon name="user" size={12} /> {req.solicitante.telefono}</span>
                  {/if}
                  {#if req.solicitante.email}
                    <span class="sol-meta"><Icon name="edit" size={12} /> {req.solicitante.email}</span>
                  {/if}
                </div>
              </div>

              <!-- Descripción -->
              <div class="detail-section">
                <h4>Descripción</h4>
                <p class="detail-text">{req.descripcion}</p>
                {#if req.observaciones && req.observaciones !== "N/A"}
                  <p class="detail-obs">{req.observaciones}</p>
                {/if}
              </div>

              <!-- Centros Gestores -->
              {#if req.centros_gestores.length > 0}
                <div class="detail-section">
                  <h4>Centros Gestores</h4>
                  <div class="cg-tags">
                    {#each req.centros_gestores as cg}
                      <span class="cg-tag">{cg}</span>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Dirección + Coords -->
              {#if req.direccion}
                <div class="detail-section">
                  <h4>Ubicación</h4>
                  <p class="detail-text">{req.direccion}</p>
                  {#if req.latitud && req.longitud}
                    <span class="detail-coords">{req.latitud}, {req.longitud}</span>
                  {/if}
                </div>
              {/if}

              <!-- File downloads -->
              {#if files.length > 0}
                <div class="detail-section">
                  <h4>Archivos ({files.length})</h4>
                  <div class="files-list">
                    {#each files as f}
                      <a href={f.url} target="_blank" rel="noopener" class="media-file">
                        <Icon name="file-text" size={16} />
                        <span>{f.nombre}</span>
                      </a>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Quick actions -->
              <div class="detail-actions">
                <Button size="sm" variant="secondary" on:click={() => navigationStore.navigate("kanban", { visitaId })}>
                  <span class="action-content"><Icon name="eye" size={14} /> Ver en Kanban</span>
                </Button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </main>
</div>

<!-- Lightbox -->
{#if lightboxUrl}
  <div class="lightbox-overlay" on:click={() => { lightboxUrl = ""; }} on:keydown={(e) => { if (e.key === "Escape") lightboxUrl = ""; }} role="dialog" aria-modal="true" tabindex="-1">
    <div class="lightbox-content" on:click|stopPropagation={() => {}}>
      <button class="lightbox-close" on:click={() => { lightboxUrl = ""; }} type="button">&times;</button>
      {#if brokenImages[lightboxUrl]}
        <div class="lightbox-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span style="color: #e2e8f0; font-size: 0.9rem;">Imagen no disponible</span>
        </div>
      {:else}
        <img src={lightboxUrl} alt={lightboxName} class="lightbox-img" on:error={() => handleImgError(lightboxUrl)} />
      {/if}
      {#if lightboxName}
        <span class="lightbox-caption">{lightboxName}</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .view {
    min-height: 100vh;
    background: #f8fafc;
  }

  /* Header */
  .view-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .back-btn {
    background: none;
    border: none;
    color: #2563eb;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .view-title {
    font-size: 1.1rem;
    font-weight: 700;
    flex: 1;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .title-visit-id {
    font-size: 0.78rem;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
  }

  /* Body */
  .view-body {
    padding: 1rem;
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Status states */
  .status-state {
    text-align: center;
    padding: 4rem 1rem;
    color: #64748b;
  }
  .status-state h3 {
    color: #1e293b;
    margin-bottom: 0.5rem;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin: 0 auto 1rem;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Summary bar */
  .summary-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
  }
  .summary-count {
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
  }

  /* Req card */
  .req-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .req-card.expanded {
    border-color: #cbd5e1;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }

  /* Card header */
  .req-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.65rem 0.85rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }
  .req-header-left {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
    min-width: 0;
  }
  .req-rid {
    font-family: monospace;
    font-size: 0.72rem;
    font-weight: 700;
    color: #475569;
    background: #f1f5f9;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .req-estado {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.12rem 0.45rem;
    border-radius: 4px;
    text-transform: capitalize;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .req-media-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    font-size: 0.62rem;
    color: #64748b;
    background: #f1f5f9;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .req-date {
    font-size: 0.68rem;
    color: #94a3b8;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .expand-chevron {
    flex-shrink: 0;
    color: #94a3b8;
    transition: transform 0.15s;
  }
  .expand-chevron.rotated {
    transform: rotate(180deg);
  }

  /* Summary line */
  .req-summary {
    padding: 0 0.85rem 0.6rem;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }
  .req-tipo {
    font-size: 0.68rem;
    font-weight: 600;
    color: #0d9488;
    background: #f0fdfa;
    padding: 0.08rem 0.35rem;
    border-radius: 3px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .req-desc-preview {
    font-size: 0.8rem;
    color: #334155;
    line-height: 1.4;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  /* Expanded detail */
  .req-detail {
    padding: 0 0.85rem 0.85rem;
  }
  .req-detail hr {
    border: none;
    border-top: 1px solid #f1f5f9;
    margin: 0 0 0.6rem;
  }
  .detail-section {
    margin-bottom: 0.65rem;
  }
  .detail-section h4 {
    font-size: 0.72rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 0.3rem;
  }
  .detail-text {
    font-size: 0.82rem;
    color: #334155;
    line-height: 1.5;
    margin: 0;
  }
  .detail-obs {
    font-size: 0.78rem;
    color: #64748b;
    font-style: italic;
    margin: 0.2rem 0 0;
  }
  .detail-coords {
    font-size: 0.72rem;
    font-family: monospace;
    color: #94a3b8;
  }

  /* Solicitante */
  .sol-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .sol-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: #1e293b;
  }
  .sol-meta {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #64748b;
  }

  /* CG tags */
  .cg-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .cg-tag {
    background: #f1f5f9;
    color: #374151;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  /* Media gallery */
  .media-file {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.45rem;
    text-decoration: none;
    color: #475569;
    font-size: 0.75rem;
  }
  .media-file:hover {
    background: #f1f5f9;
  }
  .files-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  /* ---- Carousel ---- */
  .carousel-section {
    padding: 0 0.85rem 0.5rem;
  }
  .carousel-container {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    min-height: 180px;
  }
  .carousel-main-img {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    cursor: pointer;
    background: #000;
  }
  .carousel-main-img img {
    display: block;
    width: 100%;
    min-height: 180px;
    max-height: 320px;
    object-fit: contain;
    background: #000;
  }
  .carousel-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 180px;
    background: #1e293b;
    padding: 1.5rem;
  }
  .placeholder-text {
    font-size: 0.85rem;
    font-weight: 600;
    color: #94a3b8;
  }
  .placeholder-hint {
    font-size: 0.7rem;
    color: #64748b;
    text-align: center;
    line-height: 1.4;
  }
  .thumb-broken {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e2e8f0;
  }
  .lightbox-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 200px;
    min-width: 300px;
  }
  .carousel-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255,255,255,0.85);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    color: #1e293b;
    z-index: 2;
  }
  .carousel-btn:hover {
    background: white;
  }
  .carousel-btn--prev { left: 6px; }
  .carousel-btn--next { right: 6px; }
  .carousel-dots {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 5px;
    z-index: 2;
  }
  .carousel-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.5);
    cursor: pointer;
    padding: 0;
  }
  .carousel-dot.active {
    background: white;
    box-shadow: 0 0 3px rgba(0,0,0,0.3);
  }
  .carousel-counter {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0,0,0,0.55);
    color: white;
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    z-index: 2;
  }
  .carousel-thumbs {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    overflow-x: auto;
    padding-bottom: 2px;
  }
  .carousel-thumb {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 4px;
    overflow: hidden;
    border: 2px solid transparent;
    padding: 0;
    cursor: pointer;
    background: #f1f5f9;
  }
  .carousel-thumb.active {
    border-color: #2563eb;
  }
  .carousel-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* ---- Inline video ---- */
  .media-inline-section {
    padding: 0 0.85rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .inline-video-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .inline-video {
    width: 100%;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #000;
    max-height: 220px;
  }
  .media-inline-name {
    font-size: 0.65rem;
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---- Audio section ---- */
  .audio-section {
    padding: 0 0.85rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .audio-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.45rem 0.6rem;
  }
  .audio-label {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #475569;
  }

  /* Audio player */
  .audio-player {
    width: 100%;
    height: 36px;
    border-radius: 6px;
  }

  /* Transcripción */
  .transcripcion-box {
    margin-top: 0.25rem;
    padding: 0.4rem 0.55rem;
    background: #f1f5f9;
    border-radius: 6px;
    border-left: 3px solid #2563eb;
  }
  .transcripcion-label {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.65rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 0.15rem;
  }
  .transcripcion-text {
    font-size: 0.78rem;
    color: #334155;
    line-height: 1.45;
    margin: 0;
    font-style: italic;
    word-break: break-word;
  }
  .audio-play-btn {
    display: none;
  }
  .audio-loading-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 36px;
    font-size: 0.75rem;
    color: #64748b;
  }
  .audio-loading-pulse {
    width: 100%;
    max-width: 200px;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(90deg, #e2e8f0 25%, #cbd5e1 50%, #e2e8f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .audio-loading {
    font-size: 0.75rem;
    color: #64748b;
    font-style: italic;
    padding: 0.3rem 0;
  }
  .audio-error {
    font-size: 0.75rem;
    color: #dc2626;
    padding: 0.3rem 0;
  }

  /* Actions in detail */
  .detail-actions {
    padding-top: 0.5rem;
    border-top: 1px solid #f1f5f9;
    display: flex;
    gap: 0.4rem;
  }

  .action-content {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
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
  .lightbox-close {
    position: absolute;
    top: -12px;
    right: -12px;
    background: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    color: #1e293b;
    z-index: 1;
  }
  .lightbox-img {
    max-width: 90vw;
    max-height: 82vh;
    object-fit: contain;
    border-radius: 6px;
  }
  .lightbox-caption {
    font-size: 0.8rem;
    color: #e2e8f0;
    text-align: center;
  }

  @media (max-width: 640px) {
    .carousel-main-img img {
      max-height: 240px;
    }
    .inline-video {
      max-height: 180px;
    }
  }
</style>
