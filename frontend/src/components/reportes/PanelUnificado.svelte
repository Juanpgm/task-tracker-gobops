<script lang="ts">
  /**
   * Panel unificado de Reportes: fusiona Avanzadas + Mapa + Jornadas en UNA
   * sola vista scrolleable (no tabs). Este componente es el único dueño de:
   *  - orquestar la carga inicial y el refresco forzado de los tres stores,
   *  - el banner de revalidación y el bloque de error (antes duplicados 3
   *    veces, una por dashboard),
   *  - la franja de KPIs combinada (antes dos filas de 6 tiles cada una).
   *
   * Cada sección delega su cuerpo (gráficos/tablas/filtros) al componente que
   * ya existía para ese dominio (ReportesAvanzadas / MapaGeneral /
   * ReportesJornadas), ahora reducidos a "cuerpo de sección": ya no cargan
   * datos por sí mismos ni dibujan su propio header/refresh/error.
   *
   * Colores: cada sección envuelve su contenido en `.domain-X`, que sólo
   * redeclara `--series` (ver app.css). BarraHorizontal/ColumnasMensuales no
   * se tocan: heredan el hue por cascada de variables CSS. Los tokens de
   * estado (--success/--warning/--error/--info) son independientes de
   * `--series` y nunca se sobreescriben aquí, así que los status-pills de
   * Jornadas conservan su significado semántico sin importar el dominio.
   */
  import { onMount } from 'svelte';
  import { estadisticasStore } from '../../stores/estadisticasStore';
  import { geoStore } from '../../stores/geoStore';
  import { jornadasStore } from '../../stores/jornadasStore';
  import Icon from '../ui/Icon.svelte';
  import Alert from '../ui/Alert.svelte';
  import ReportesAvanzadas from './ReportesAvanzadas.svelte';
  import MapaGeneral from './MapaGeneral.svelte';
  import ReportesJornadas from './ReportesJornadas.svelte';

  onMount(() => {
    estadisticasStore.load();
    geoStore.load();
    jornadasStore.load();
  });

  $: avanzadasState = $estadisticasStore;
  $: geoState = $geoStore;
  $: jornadasState = $jornadasStore;

  $: avanzadasData = avanzadasState.data;
  $: jornadasData = jornadasState.data;

  function nf(n: number): string {
    return n.toLocaleString('es-CO');
  }

  function actualizarTodo() {
    estadisticasStore.load({ force: true });
    geoStore.load({ force: true });
    jornadasStore.load({ force: true });
  }

  $: revalidando = avanzadasState.revalidating || geoState.revalidating || jornadasState.revalidating;

  interface Fallo {
    label: string;
    message: string;
  }

  // Cada store expone su propio error/revalidateError de forma independiente
  // (stale-while-revalidate por dominio); el panel los consolida en una sola
  // lista en vez de mostrar 3 banners casi idénticos.
  $: revalidateWarnings = (
    [
      avanzadasState.revalidateError ? { label: 'Avanzadas', message: avanzadasState.revalidateError } : null,
      geoState.revalidateError ? { label: 'Mapa', message: geoState.revalidateError } : null,
      jornadasState.revalidateError ? { label: 'Jornadas', message: jornadasState.revalidateError } : null,
    ] as (Fallo | null)[]
  ).filter((f): f is Fallo => f !== null);

  $: blockingErrors = (
    [
      avanzadasState.error && !avanzadasState.data ? { label: 'Avanzadas', message: avanzadasState.error } : null,
      geoState.error && !geoState.data ? { label: 'Mapa', message: geoState.error } : null,
      jornadasState.error && !jornadasState.data ? { label: 'Jornadas', message: jornadasState.error } : null,
    ] as (Fallo | null)[]
  ).filter((f): f is Fallo => f !== null);

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<div class="panel-unificado">
  <div class="pu-toolbar">
    <nav class="pu-nav" aria-label="Secciones del panel">
      <button type="button" class="pu-nav-link domain-avanzadas" on:click={() => scrollToSection('seccion-avanzadas')}>
        <Icon name="bar-chart" size={14} /> Avanzadas
      </button>
      <button type="button" class="pu-nav-link domain-mapa" on:click={() => scrollToSection('seccion-mapa')}>
        <Icon name="map-pin" size={14} /> Mapa
      </button>
      <button type="button" class="pu-nav-link domain-jornadas" on:click={() => scrollToSection('seccion-jornadas')}>
        <Icon name="calendar" size={14} /> Jornadas
      </button>
    </nav>
    <button type="button" class="pu-refresh-btn" on:click={actualizarTodo} disabled={revalidando}>
      <Icon name="arrow-right" size={14} /> Actualizar
    </button>
  </div>

  {#each revalidateWarnings as w (w.label)}
    <div class="pu-revalidate-warning" data-testid="pu-revalidate-warning">
      No se pudo actualizar {w.label}: {w.message}
    </div>
  {/each}

  {#if blockingErrors.length > 0}
    <div class="pu-error-block" data-testid="pu-error-block">
      {#each blockingErrors as e (e.label)}
        <Alert type="error" message={`${e.label}: ${e.message}`} dismissible={false} />
      {/each}
      <button type="button" class="pu-retry-btn" on:click={actualizarTodo}>Reintentar</button>
    </div>
  {/if}

  <!-- Franja de KPIs combinada: reemplaza las dos filas de 6 tiles que
       Avanzadas y Jornadas dibujaban cada una por su cuenta. -->
  <div class="pu-kpi-strip" data-testid="pu-kpi-strip">
    {#if avanzadasData}
      <div class="pu-kpi-tile pu-kpi-hero domain-avanzadas" data-testid="pu-kpi-hero-avanzadas">
        <span class="pu-kpi-chip">Avanzadas</span>
        <span class="pu-kpi-value pu-kpi-value-hero">{nf(avanzadasData.totales.avanzadas)}</span>
        <span class="pu-kpi-label">Avanzadas</span>
      </div>
      <div class="pu-kpi-tile domain-avanzadas">
        <span class="pu-kpi-chip">Avanzadas</span>
        <span class="pu-kpi-value">{nf(avanzadasData.totales.requerimientos)}</span>
        <span class="pu-kpi-label">Requerimientos</span>
      </div>
      <div class="pu-kpi-tile domain-avanzadas">
        <span class="pu-kpi-chip">Avanzadas</span>
        <span class="pu-kpi-value">{nf(avanzadasData.totales.comunas)}</span>
        <span class="pu-kpi-label">Comunas</span>
      </div>
      <div class="pu-kpi-tile domain-avanzadas">
        <span class="pu-kpi-chip">Avanzadas</span>
        <span class="pu-kpi-value">{nf(avanzadasData.totales.entidades)}</span>
        <span class="pu-kpi-label">Entidades</span>
      </div>
      <div class="pu-kpi-tile domain-avanzadas">
        <span class="pu-kpi-chip">Avanzadas</span>
        <span class="pu-kpi-value">{nf(avanzadasData.totales.asistentes)}</span>
        <span class="pu-kpi-label">Asistentes</span>
      </div>
      <div class="pu-kpi-tile domain-avanzadas">
        <span class="pu-kpi-chip">Avanzadas</span>
        <span class="pu-kpi-value">{avanzadasData.totales.promedio_requerimientos.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</span>
        <span class="pu-kpi-label">Promedio req. / avanzada</span>
      </div>
    {/if}
    {#if jornadasData}
      <div class="pu-kpi-tile pu-kpi-hero domain-jornadas" data-testid="pu-kpi-hero-jornadas">
        <span class="pu-kpi-chip">Jornadas</span>
        <span class="pu-kpi-value pu-kpi-value-hero">{jornadasData.totales.cumplimiento_pct.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%</span>
        <span class="pu-kpi-label">Cumplimiento</span>
      </div>
      <div class="pu-kpi-tile domain-jornadas">
        <span class="pu-kpi-chip">Jornadas</span>
        <span class="pu-kpi-value">{nf(jornadasData.totales.jornadas)}</span>
        <span class="pu-kpi-label">Jornadas</span>
      </div>
      <div class="pu-kpi-tile domain-jornadas">
        <span class="pu-kpi-chip">Jornadas</span>
        <span class="pu-kpi-value">{nf(jornadasData.totales.compromisos)}</span>
        <span class="pu-kpi-label">Compromisos</span>
      </div>
      <div class="pu-kpi-tile domain-jornadas">
        <span class="pu-kpi-chip">Jornadas</span>
        <span class="pu-kpi-value">{nf(jornadasData.totales.seguimientos)}</span>
        <span class="pu-kpi-label">Seguimientos</span>
      </div>
      <div class="pu-kpi-tile domain-jornadas">
        <span class="pu-kpi-chip">Jornadas</span>
        <span class="pu-kpi-value">{nf(jornadasData.totales.encuestas)}</span>
        <span class="pu-kpi-label">Encuestas</span>
      </div>
      <div class="pu-kpi-tile domain-jornadas">
        <span class="pu-kpi-chip">Jornadas</span>
        <span class="pu-kpi-value">{nf(jornadasData.totales.asistencia_total)}</span>
        <span class="pu-kpi-label">Asistencia total</span>
      </div>
    {/if}
  </div>

  <section id="seccion-avanzadas" class="pu-section domain-avanzadas" data-testid="seccion-avanzadas">
    <header class="pu-section-header">
      <h2 class="pu-section-title"><Icon name="bar-chart" size={18} /> Avanzadas</h2>
    </header>
    <ReportesAvanzadas />
  </section>

  <section id="seccion-mapa" class="pu-section domain-mapa" data-testid="seccion-mapa">
    <header class="pu-section-header">
      <h2 class="pu-section-title"><Icon name="map-pin" size={18} /> Mapa</h2>
    </header>
    <MapaGeneral />
  </section>

  <section id="seccion-jornadas" class="pu-section domain-jornadas" data-testid="seccion-jornadas">
    <header class="pu-section-header">
      <h2 class="pu-section-title"><Icon name="calendar" size={18} /> Jornadas</h2>
    </header>
    <ReportesJornadas />
  </section>
</div>

<style>
  .panel-unificado {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding-bottom: var(--space-2xl);
  }

  /* Cada dominio sólo redeclara --series; BarraHorizontal/ColumnasMensuales
     heredan el hue por cascada sin que se los toque. */
  .domain-avanzadas { --series: var(--domain-avanzadas); }
  .domain-mapa { --series: var(--domain-mapa); }
  .domain-jornadas { --series: var(--domain-jornadas); }

  /* ---- Toolbar sticky ---- */
  .pu-toolbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: var(--space-sm) var(--space-md);
  }
  .pu-nav {
    display: flex;
    gap: var(--space-xs);
    overflow-x: auto;
  }
  .pu-nav-link {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: none;
    border: 1px solid var(--border);
    border-left: 3px solid var(--series);
    border-radius: var(--radius-md);
    padding: 0.35rem 0.75rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text);
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    min-height: var(--tap-min);
  }
  .pu-nav-link:hover { background: var(--surface-alt); }
  .pu-nav-link:focus-visible { outline: none; box-shadow: var(--focus-ring); }

  .pu-refresh-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.35rem 0.75rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--primary);
    cursor: pointer;
    font-family: inherit;
    min-height: var(--tap-min);
  }
  .pu-refresh-btn:hover:not(:disabled) { background: var(--surface-alt); }
  .pu-refresh-btn:disabled { opacity: 0.6; cursor: default; }
  .pu-refresh-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }

  .pu-revalidate-warning {
    font-size: var(--fs-sm);
    color: var(--warning-ink);
    background: var(--warning-light);
    border: 1px solid var(--warning);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.75rem;
    margin: 0 var(--space-md);
  }

  .pu-error-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    align-items: flex-start;
    margin: 0 var(--space-md);
  }
  .pu-retry-btn {
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    padding: 0.4rem 0.9rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    min-height: var(--tap-min);
  }

  /* ---- KPI strip ---- */
  .pu-kpi-strip {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: var(--space-sm);
    margin: 0 var(--space-md);
  }
  .pu-kpi-tile {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 3px solid var(--series);
    border-radius: var(--radius-md);
    padding: 0.6rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .pu-kpi-chip {
    font-size: var(--fs-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--series);
  }
  .pu-kpi-value {
    font-size: var(--fs-lg);
    font-weight: 700;
    color: var(--text-strong);
    font-variant-numeric: proportional-nums;
  }
  .pu-kpi-hero {
    grid-column: span 2;
  }
  .pu-kpi-value-hero {
    font-size: var(--fs-2xl);
    line-height: 1.1;
    color: var(--series);
  }
  .pu-kpi-label {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-secondary);
  }

  /* ---- Section headers ---- */
  .pu-section {
    margin: 0 var(--space-md);
    border-top: 3px solid var(--series);
    border-radius: var(--radius-md);
    background: var(--surface-alt);
    padding-top: var(--space-sm);
  }
  .pu-section-header {
    padding: 0 var(--space-md);
  }
  .pu-section-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--fs-xl);
    font-weight: 700;
    color: var(--series);
    margin: 0;
  }

  @media (max-width: 1024px) {
    .pu-kpi-strip { grid-template-columns: repeat(3, 1fr); }
  }

  @media (max-width: 640px) {
    .pu-toolbar { flex-direction: column; align-items: stretch; }
    .pu-nav { flex-wrap: nowrap; }
    .pu-kpi-strip { grid-template-columns: repeat(2, 1fr); }
    .pu-kpi-hero { grid-column: span 2; }
  }
</style>
