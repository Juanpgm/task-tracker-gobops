<script lang="ts">
  import { onMount } from "svelte";
  import { navigationStore } from "../../stores/navigationStore";
  import { avanzadasStore } from "../../stores/avanzadasStore";
  import { descargarReporteAvanzadaPdf } from "../../api/avanzadas";
  import { formatDate } from "../../lib/format-date";
  import Button from "../ui/Button.svelte";
  import Icon from "../ui/Icon.svelte";
  import Input from "../ui/Input.svelte";
  import Select from "../ui/Select.svelte";
  import ViewHeader from "../ui/ViewHeader.svelte";

  $: avanzadas = $avanzadasStore.avanzadas;
  $: loading = $avanzadasStore.loading;
  $: error = $avanzadasStore.error;
  $: revalidateError = $avanzadasStore.revalidateError;

  onMount(() => {
    avanzadasStore.loadAvanzadas();
  });

  function irANuevaAvanzada() {
    navigationStore.navigate("programar-avanzada");
  }

  function verDetalle(clientId: string) {
    navigationStore.navigate("detalle-avanzada", { client_id: clientId });
  }

  function editarAvanzada(clientId: string) {
    navigationStore.navigate("editar-avanzada", { client_id: clientId });
  }

  /* ---- Crear PDF (por tarjeta) ---- */
  let generandoPdfId: string | null = null;
  let errorPdfId: string | null = null;

  async function crearPdf(clientId: string) {
    if (generandoPdfId) return;
    generandoPdfId = clientId;
    errorPdfId = null;
    try {
      await descargarReporteAvanzadaPdf(clientId);
    } catch (e) {
      errorPdfId = clientId;
    } finally {
      generandoPdfId = null;
    }
  }

  /* ---- Filter bar (client-side, instant — data is already loaded) ---- */
  let filtrosAbiertos = false;
  let filtroTexto = "";
  let filtroComuna = "";
  let filtroEstrategia = "";
  let filtroFechaDesde = "";
  let filtroFechaHasta = "";

  $: comunasDisponibles = Array.from(new Set(avanzadas.map((a) => a.comuna).filter(Boolean))).sort();
  $: estrategiasDisponibles = Array.from(new Set(avanzadas.map((a) => a.estrategia).filter(Boolean))).sort();
  $: comunaOptions = comunasDisponibles.map((c) => ({ value: c, label: c }));
  $: estrategiaOptions = estrategiasDisponibles.map((e) => ({ value: e, label: e }));

  $: filtrosActivos = !!(
    filtroTexto ||
    filtroComuna ||
    filtroEstrategia ||
    filtroFechaDesde ||
    filtroFechaHasta
  );

  $: avanzadasFiltradas = avanzadas.filter((a) => {
    if (filtroComuna && a.comuna !== filtroComuna) return false;
    if (filtroEstrategia && a.estrategia !== filtroEstrategia) return false;
    if (filtroFechaDesde && a.fecha < filtroFechaDesde) return false;
    if (filtroFechaHasta && a.fecha > filtroFechaHasta) return false;
    if (filtroTexto) {
      const q = filtroTexto.toLowerCase();
      const match =
        (a.nombre_avanzada || "").toLowerCase().includes(q) ||
        (a.sector || "").toLowerCase().includes(q) ||
        (a.barrio || "").toLowerCase().includes(q) ||
        (a.comuna || "").toLowerCase().includes(q) ||
        (a.direccion || "").toLowerCase().includes(q) ||
        (a.estrategia || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  function limpiarFiltros() {
    filtroTexto = "";
    filtroComuna = "";
    filtroEstrategia = "";
    filtroFechaDesde = "";
    filtroFechaHasta = "";
  }
</script>

<div class="view">
  <ViewHeader title="Avanzadas" icon="flag">
    <svelte:fragment slot="action">
      <button class="add-btn" on:click={irANuevaAvanzada}>+ Nueva avanzada</button>
    </svelte:fragment>
  </ViewHeader>

  <main class="view-body container">
    {#if loading}
      <div class="skeleton-wrap" aria-busy="true" aria-label="Cargando avanzadas">
        {#each Array(4) as _}
          <div class="skeleton-card">
            <div class="skeleton skeleton-chip"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-pills"></div>
          </div>
        {/each}
      </div>
    {:else if error}
      <div class="status-state error-state">
        <p class="error-msg">{error}</p>
        <Button on:click={() => avanzadasStore.loadAvanzadas({ force: true })}>Reintentar</Button>
      </div>
    {:else if avanzadas.length === 0}
      <div class="status-state">
        <h3>Sin avanzadas registradas</h3>
        <p>Aún no hay avanzadas registradas. Crea una nueva para comenzar.</p>
        <Button on:click={irANuevaAvanzada}>Registrar Avanzada</Button>
      </div>
    {:else}
      {#if revalidateError}
        <div class="revalidate-banner">
          <Icon name="alert-triangle" size={14} />
          No se pudo actualizar el listado ({revalidateError}). Mostrando los datos guardados.
        </div>
      {/if}

      <section class="filter-bar">
        <button
          type="button"
          class="filter-toggle"
          on:click={() => (filtrosAbiertos = !filtrosAbiertos)}
          aria-expanded={filtrosAbiertos}
        >
          <Icon name="filter" size={14} />
          Filtros
          {#if filtrosActivos}<span class="filter-badge">activos</span>{/if}
          <svg class="chevron" class:rotated={filtrosAbiertos} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {#if filtrosAbiertos}
          <div class="filter-body">
            <Input
              id="filtro-texto"
              placeholder="Buscar por nombre, sector, barrio, comuna, dirección o estrategia…"
              bind:value={filtroTexto}
            />
            <div class="filter-grid">
              <Select id="filtro-comuna" placeholder="Todas las comunas" bind:value={filtroComuna} options={comunaOptions} />
              <Select id="filtro-estrategia" placeholder="Todas las estrategias" bind:value={filtroEstrategia} options={estrategiaOptions} />
            </div>
            <div class="filter-grid">
              <Input id="filtro-fecha-desde" type="date" label="Desde" bind:value={filtroFechaDesde} />
              <Input id="filtro-fecha-hasta" type="date" label="Hasta" bind:value={filtroFechaHasta} />
            </div>
          </div>
        {/if}

        <div class="filter-summary">
          <span class="result-count">
            {avanzadasFiltradas.length} de {avanzadas.length} avanzadas
          </span>
          {#if filtrosActivos}
            <button type="button" class="clear-filters-btn" on:click={limpiarFiltros}>
              <Icon name="x" size={12} /> Limpiar filtros
            </button>
          {/if}
        </div>
      </section>

      {#if avanzadasFiltradas.length === 0}
        <div class="status-state">
          <h3>Ningún resultado con esos filtros</h3>
          <p>Prueba ajustar o limpiar los filtros aplicados.</p>
          <Button variant="secondary" on:click={limpiarFiltros}>Limpiar filtros</Button>
        </div>
      {:else}
        <div class="list">
          {#each avanzadasFiltradas as avanzada (avanzada.client_id)}
            <div class="avanzada-card" class:offline={avanzada.isOffline}>
              <button
                type="button"
                class="avanzada-card-btn"
                on:click={() => verDetalle(avanzada.client_id)}
              >
                <div class="card-top-row">
                  <span class="date-chip">
                    <Icon name="calendar" size={13} />
                    {formatDate(avanzada.fecha)}
                  </span>
                  {#if avanzada.isOffline}
                    <span class="offline-badge">Pendiente de sincronizar</span>
                  {/if}
                </div>
                <h3 class="card-title">{avanzada.nombre_avanzada}</h3>
                <p class="card-location">
                  <Icon name="map-pin" size={14} />
                  {avanzada.barrio}, {avanzada.comuna}
                </p>
                <div class="card-stats">
                  <span class="stat-pill">
                    <Icon name="flag" size={13} /> {avanzada.estrategia}
                  </span>
                  <span class="stat-pill stat-pill--warning">
                    <Icon name="clipboard-list" size={13} />
                    {avanzada.requerimientos_count ?? avanzada.requerimientos?.length ?? 0} requerimiento{(avanzada.requerimientos_count ?? avanzada.requerimientos?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>
              <div class="card-actions">
                <button
                  type="button"
                  class="crear-pdf-btn"
                  disabled={generandoPdfId !== null}
                  on:click={() => crearPdf(avanzada.client_id)}
                >
                  <Icon name={generandoPdfId === avanzada.client_id ? "clock" : "file-text"} size={13} />
                  {generandoPdfId === avanzada.client_id ? "Generando…" : "Crear PDF"}
                </button>
                <button type="button" class="editar-btn" on:click={() => editarAvanzada(avanzada.client_id)}>
                  <Icon name="edit" size={13} />
                  Editar
                </button>
              </div>
              {#if errorPdfId === avanzada.client_id}
                <p class="pdf-error">No se pudo generar el PDF. Intenta de nuevo.</p>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </main>
</div>

<style>
  .view {
    min-height: 100vh;
    min-height: -webkit-fill-available;
    min-height: 100dvh;
    background: var(--bg);
  }
  .add-btn {
    background: var(--primary);
    color: var(--surface);
    border: none;
    padding: 0.45rem 1rem;
    border-radius: var(--radius-md);
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .add-btn:hover {
    background: var(--primary-dark);
  }
  .view-body {
    padding: 1rem;
    max-width: 900px;
    margin: 0 auto;
  }
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

  /* Skeleton (first-load only, matches DetalleAvanzada's visual language) */
  .skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.25rem;
  }
  .skeleton-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    padding: 1rem 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .skeleton {
    background: linear-gradient(90deg, var(--border) 25%, var(--border) 50%, var(--border) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: var(--radius-sm);
  }
  .skeleton-chip { height: 18px; width: 90px; border-radius: var(--radius-pill); }
  .skeleton-title { height: 20px; width: 65%; }
  .skeleton-line.short { height: 13px; width: 40%; }
  .skeleton-pills { height: 22px; width: 70%; margin-top: 0.15rem; }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Non-destructive background revalidation notice */
  .revalidate-banner {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #fffbeb;
    border: 1px solid #fcd34d;
    color: var(--warning-ink);
    font-size: var(--fs-sm);
    font-weight: 600;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    margin-bottom: 0.75rem;
  }

  /* Filter bar */
  .filter-bar {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 0.6rem 0.85rem;
    margin-bottom: 0.85rem;
  }
  .filter-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    padding: 0;
    font-size: var(--fs-md);
    font-weight: 700;
    color: #334155;
    cursor: pointer;
    font-family: inherit;
  }
  .filter-badge {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--primary-darker);
    background: var(--primary-light);
    padding: 0.1rem 0.45rem;
    border-radius: var(--radius-pill);
  }
  .chevron {
    color: var(--text-muted);
    margin-left: auto;
    transition: transform 0.15s;
  }
  .chevron.rotated {
    transform: rotate(180deg);
  }
  .filter-body {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-top: 0.75rem;
  }
  .filter-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
  .filter-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.65rem;
    padding-top: 0.55rem;
    border-top: 1px solid var(--surface-alt);
  }
  .result-count {
    font-size: var(--fs-sm);
    color: var(--text-secondary);
    font-weight: 600;
  }
  .clear-filters-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    color: var(--primary);
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .clear-filters-btn:hover {
    text-decoration: underline;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .avanzada-card {
    width: 100%;
    background: var(--surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    padding: 1rem 1.15rem;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .avanzada-card:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
  }
  .avanzada-card.offline {
    border-color: #fcd34d;
    background: #fffbeb;
  }
  .avanzada-card-btn {
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    text-align: left;
    font-family: inherit;
    cursor: pointer;
  }
  .avanzada-card-btn:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .card-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
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
  .offline-badge {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--warning-ink);
    background: var(--warning-light);
    padding: 0.15rem 0.5rem;
    border-radius: var(--radius-pill);
  }
  .card-title {
    font-size: 1.02rem;
    font-weight: 700;
    color: var(--text-strong);
    margin: 0;
  }
  .card-location {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--fs-base);
    color: var(--text-secondary);
    margin: 0;
  }
  .card-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.2rem;
  }
  .stat-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--fs-md);
    font-weight: 500;
    color: var(--text-body);
    background: var(--surface-alt);
    padding: 0.22rem 0.6rem;
    border-radius: 20px;
  }
  .card-actions {
    margin-top: 0.4rem;
    display: flex;
    gap: 0.5rem;
  }
  .crear-pdf-btn,
  .editar-btn {
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
  .crear-pdf-btn:hover:not(:disabled),
  .editar-btn:hover:not(:disabled) {
    border-color: var(--border-strong);
    background: var(--surface);
  }
  .crear-pdf-btn:disabled,
  .editar-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
  .pdf-error {
    color: var(--error);
    font-size: var(--fs-sm);
    margin: 0.4rem 0 0;
  }
  .stat-pill--warning {
    background: var(--warning-light);
    color: var(--warning-ink);
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .filter-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
