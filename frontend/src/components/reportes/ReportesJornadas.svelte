<script lang="ts">
  /**
   * Cuerpo de la sección Jornadas dentro de PanelUnificado.svelte (GET
   * /jornadas/estadisticas).
   *
   * La carga inicial, el refresco forzado, el header, el banner de
   * revalidación, el bloque de error y la franja de KPIs (totales, incluido
   * el hero cumplimiento_pct) son responsabilidad de PanelUnificado — este
   * componente sólo se suscribe al store para dibujar sus propios gráficos y
   * tablas.
   *
   * Decisiones de forma (ver reglas de la tarea):
   *  - compromisos_por_organismo: barras horizontales, un solo hue
   *    (var(--series)) — comparación de magnitud entre organismos, sin
   *    orden natural, reutilizando BarraHorizontal tal cual (sin tocarlo).
   *    `--series` NO se declara aquí: la sección wrapper de PanelUnificado
   *    la fija a `var(--domain-jornadas)` y cascada hacia BarraHorizontal.
   *  - compromisos_por_verificacion / seguimientos_por_estado: SON estado,
   *    nunca una serie de magnitud — se usan los tokens --success/
   *    --warning/--error del design system, siempre junto a un icono y una
   *    etiqueta de texto (nunca sólo color), con twin de tabla propio. Estos
   *    tokens son independientes de --series/dominio: nunca se tiñen con el
   *    hue de la sección, porque el color de estado significa algo distinto
   *    del color de "en qué sección estás".
   *  - encuestas_por_organismo: escala ordenada (Bueno/Regular/Malo/N-A)
   *    con apenas 6 encuestas en total — una dona/torta sería puro ruido a
   *    esta escala y una barra divergente añadiría complejidad sin aportar
   *    lectura real, así que se muestra como tabla simple (se explicita el
   *    porqué en el propio panel).
   *  - jornadas_lista: tabla compacta accesible.
   */
  import { jornadasStore } from '../../stores/jornadasStore';
  import Icon from '../ui/Icon.svelte';
  import BarraHorizontal from './BarraHorizontal.svelte';

  $: state = $jornadasStore;
  $: data = state.data;
  $: isFirstLoad = state.loading && !data;
  $: isEmpty = !!data && data.totales.jornadas === 0;

  function nf(n: number): string {
    return n.toLocaleString('es-CO');
  }

  interface EstadoVisual {
    label: string;
    icon: string;
    tone: 'success' | 'warning' | 'error' | 'info';
  }

  const ESTADO_MAP: Record<string, EstadoVisual> = {
    cumple: { label: 'Cumple', icon: 'check-circle', tone: 'success' },
    no_cumple: { label: 'No cumple', icon: 'x', tone: 'error' },
    novedad: { label: 'Novedad', icon: 'alert-triangle', tone: 'warning' },
    ok: { label: 'OK', icon: 'check-circle', tone: 'success' },
    cancelado: { label: 'Cancelado', icon: 'x', tone: 'error' },
  };

  function estadoVisual(estado: string): EstadoVisual {
    return (
      ESTADO_MAP[estado] ?? {
        label: estado.charAt(0).toUpperCase() + estado.slice(1),
        icon: 'info',
        tone: 'info',
      }
    );
  }

  let showVerificacionTable = false;
  let showSeguimientosTable = false;
</script>

<div class="reportes-jornadas">
  {#if isFirstLoad}
    <div class="spinner" data-testid="rj-loading"></div>
  {:else if data}
    <div class="rj-body" class:is-revalidating={state.revalidating}>
      {#if isEmpty}
        <div class="empty-state">
          <Icon name="calendar" size={32} />
          <p>Todavía no hay jornadas registradas.</p>
        </div>
      {:else}
        <!-- Compromisos por organismo: magnitud, un solo hue -->
        <div class="chart-card">
          <BarraHorizontal
            title="Compromisos por organismo"
            iconName="address-book"
            items={data.compromisos_por_organismo.map((o) => ({ id: o.organismo, label: o.organismo, sublabel: `${o.cumple} cumple · ${o.no_cumple} no cumple · ${o.novedad} novedad`, value: o.total }))}
            emptyMessage="Sin compromisos por organismo."
          />
        </div>

        <!-- Compromisos por verificación: ESTADO -> tokens + icono, nunca sólo color -->
        <div class="chart-card">
          <header class="section-header">
            <h3 class="section-title"><Icon name="check-circle" size={16} /> Compromisos por verificación</h3>
            {#if data.compromisos_por_verificacion.length > 0}
              <button type="button" class="table-toggle" aria-pressed={showVerificacionTable} on:click={() => (showVerificacionTable = !showVerificacionTable)}>
                {showVerificacionTable ? 'Ver resumen' : 'Ver tabla'}
              </button>
            {/if}
          </header>
          {#if data.compromisos_por_verificacion.length === 0}
            <p class="chart-empty">Sin datos de verificación.</p>
          {:else if showVerificacionTable}
            <div class="table-scroll">
              <table>
                <caption class="sr-only">Compromisos por verificación</caption>
                <thead><tr><th scope="col">Estado</th><th scope="col">Total</th></tr></thead>
                <tbody>
                  {#each data.compromisos_por_verificacion as item (item.estado)}
                    <tr><td>{estadoVisual(item.estado).label}</td><td class="num">{nf(item.total)}</td></tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <ul class="status-pills">
              {#each data.compromisos_por_verificacion as item (item.estado)}
                {@const v = estadoVisual(item.estado)}
                <li class="status-pill tone-{v.tone}" data-testid="status-pill">
                  <Icon name={v.icon} size={15} />
                  <span class="status-label">{v.label}</span>
                  <span class="status-count">{nf(item.total)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <!-- Seguimientos por estado: mismo tratamiento -->
        <div class="chart-card">
          <header class="section-header">
            <h3 class="section-title"><Icon name="eye" size={16} /> Seguimientos por estado</h3>
            {#if data.seguimientos_por_estado.length > 0}
              <button type="button" class="table-toggle" aria-pressed={showSeguimientosTable} on:click={() => (showSeguimientosTable = !showSeguimientosTable)}>
                {showSeguimientosTable ? 'Ver resumen' : 'Ver tabla'}
              </button>
            {/if}
          </header>
          {#if data.seguimientos_por_estado.length === 0}
            <p class="chart-empty">Sin seguimientos registrados.</p>
          {:else if showSeguimientosTable}
            <div class="table-scroll">
              <table>
                <caption class="sr-only">Seguimientos por estado</caption>
                <thead><tr><th scope="col">Estado</th><th scope="col">Total</th></tr></thead>
                <tbody>
                  {#each data.seguimientos_por_estado as item (item.estado)}
                    <tr><td>{estadoVisual(item.estado).label}</td><td class="num">{nf(item.total)}</td></tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <ul class="status-pills">
              {#each data.seguimientos_por_estado as item (item.estado)}
                {@const v = estadoVisual(item.estado)}
                <li class="status-pill tone-{v.tone}" data-testid="status-pill">
                  <Icon name={v.icon} size={15} />
                  <span class="status-label">{v.label}</span>
                  <span class="status-count">{nf(item.total)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <!-- Encuestas por organismo: escala ordenada con n=6 -> tabla honesta, sin dona -->
        <div class="chart-card chart-card-wide">
          <h3 class="section-title"><Icon name="clipboard-list" size={16} /> Encuestas por organismo</h3>
          {#if data.encuestas_por_organismo.length === 0}
            <p class="chart-empty">Sin encuestas registradas.</p>
          {:else}
            <p class="chart-note">
              Con {nf(data.totales.encuestas)} encuesta{data.totales.encuestas === 1 ? '' : 's'} en total, un gráfico de proporciones no
              aportaría lectura confiable — se muestra como tabla.
            </p>
            <div class="table-scroll">
              <table>
                <caption class="sr-only">Encuestas por organismo</caption>
                <thead>
                  <tr>
                    <th scope="col">Organismo</th>
                    <th scope="col">Bueno</th>
                    <th scope="col">Regular</th>
                    <th scope="col">Malo</th>
                    <th scope="col">N/A</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {#each data.encuestas_por_organismo as e (e.org)}
                    <tr>
                      <td>{e.org}</td>
                      <td class="num">{nf(e.bueno)}</td>
                      <td class="num">{nf(e.regular)}</td>
                      <td class="num">{nf(e.malo)}</td>
                      <td class="num">{nf(e.na)}</td>
                      <td class="num">{nf(e.total)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

        <!-- Jornadas por comuna: magnitud, un solo hue -->
        <div class="chart-card">
          <BarraHorizontal
            title="Jornadas por comuna"
            iconName="map-pin"
            items={data.jornadas_por_comuna.map((c) => ({ id: c.comuna, label: c.comuna, sublabel: `${c.compromisos} compromisos`, value: c.jornadas }))}
            emptyMessage="Sin datos por comuna."
          />
        </div>

        <!-- Listado de jornadas: tabla compacta -->
        <div class="chart-card chart-card-wide">
          <h3 class="section-title"><Icon name="list" size={16} /> Listado de jornadas</h3>
          {#if data.jornadas_lista.length === 0}
            <p class="chart-empty">Sin jornadas registradas.</p>
          {:else}
            <div class="table-scroll">
              <table>
                <caption class="sr-only">Listado de jornadas</caption>
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Comuna</th>
                    <th scope="col">Barrio</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Asistencia</th>
                    <th scope="col">Compromisos</th>
                  </tr>
                </thead>
                <tbody>
                  {#each data.jornadas_lista as j (j.client_id)}
                    {@const v = estadoVisual(j.estado)}
                    <tr>
                      <td>{j.nombre_jornada}</td>
                      <td>{j.fecha}</td>
                      <td>{j.comuna}</td>
                      <td>{j.barrio}</td>
                      <td>
                        <span class="status-pill-inline tone-{v.tone}">
                          <Icon name={v.icon} size={13} />
                          {v.label}
                        </span>
                      </td>
                      <td class="num">{nf(j.asistencia_aproximada)}</td>
                      <td class="num">{nf(j.compromisos_count)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .reportes-jornadas {
    --chart-surface: var(--surface);
    --ink-primary: var(--text-strong);
    --ink-secondary: var(--text-secondary);
    --ink-muted: var(--text-muted);
    --gridline: var(--border);
    --baseline: var(--border-strong);

    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-md);
    max-width: 100%;
    box-sizing: border-box;
  }

  .rj-body {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
    transition: opacity 0.15s ease;
  }
  .rj-body.is-revalidating { opacity: 0.6; }

  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xl) 0;
    color: var(--ink-secondary);
    text-align: center;
  }

  .chart-card {
    background: var(--chart-surface);
    border: 1px solid var(--gridline);
    border-radius: var(--radius-lg);
    padding: var(--space-md);
    overflow-x: auto;
  }
  .chart-card-wide {
    grid-column: 1 / -1;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    margin-bottom: 0.75rem;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--fs-lg);
    font-weight: 700;
    color: var(--ink-primary);
    margin: 0 0 0.75rem 0;
  }
  .section-header .section-title { margin: 0; }
  .table-toggle {
    background: none;
    border: 1px solid var(--gridline);
    border-radius: 6px;
    padding: 0.25rem 0.65rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--ink-secondary);
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
    min-height: var(--tap-min);
  }
  .table-toggle:hover { background: var(--gridline); }
  .chart-empty { font-size: var(--fs-md); color: var(--ink-muted); text-align: center; padding: 1rem 0; margin: 0; }
  .chart-note { font-size: var(--fs-sm); color: var(--ink-secondary); margin: 0 0 0.75rem 0; }

  /* Status pills — color siempre junto a icono + texto */
  .status-pills {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .status-pill {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border-radius: var(--radius-pill);
    padding: 0.4rem 0.85rem;
    font-size: var(--fs-md);
    font-weight: 600;
  }
  .status-count { font-variant-numeric: tabular-nums; }
  .status-pill-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    border-radius: var(--radius-pill);
    padding: 0.15rem 0.5rem;
    white-space: nowrap;
  }
  .tone-success { background: var(--success-light); color: var(--success-ink); }
  .tone-warning { background: var(--warning-light); color: var(--warning-ink); }
  .tone-error { background: var(--error-light); color: var(--error-ink); }
  .tone-info { background: var(--info-light); color: var(--info-ink); }

  .table-scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: var(--fs-md); }
  th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--gridline); color: var(--ink-primary); }
  th { color: var(--ink-secondary); font-weight: 600; font-size: var(--fs-sm); }
  td.num { font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  @media (max-width: 1024px) {
    .rj-body { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 640px) {
    .rj-body { grid-template-columns: 1fr; }
  }
</style>
