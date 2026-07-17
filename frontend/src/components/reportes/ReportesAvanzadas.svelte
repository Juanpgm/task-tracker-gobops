<script lang="ts">
  /**
   * Cuerpo de la sección Avanzadas dentro de PanelUnificado.svelte (GET
   * /avanzadas/estadisticas). Composición: gráficos de barras horizontales
   * (por_entidad / por_categoria / por_comuna) + columnas mensuales en
   * small multiples (por_mes: avanzadas y requerimientos por separado,
   * nunca un solo gráfico de doble eje) + stat pills (por_estrategia).
   *
   * La carga inicial, el refresco forzado, el header, el banner de
   * revalidación, el bloque de error y la franja de KPIs (totales) son
   * responsabilidad de PanelUnificado — este componente sólo se suscribe al
   * store para dibujar sus propios gráficos.
   *
   * Reglas de color: un solo hue (var(--series)) para todas las barras —
   * son comparaciones de magnitud entre categorías nominales sin orden
   * natural, así que ningún color codifica valor ni identidad por entidad.
   * `--series` NO se declara aquí: la sección wrapper de PanelUnificado la
   * fija a `var(--domain-avanzadas)` y cascada hacia BarraHorizontal /
   * ColumnasMensuales sin que este componente tenga que saber de dominios.
   */
  import { estadisticasStore } from '../../stores/estadisticasStore';
  import Icon from '../ui/Icon.svelte';
  import BarraHorizontal from './BarraHorizontal.svelte';
  import ColumnasMensuales from './ColumnasMensuales.svelte';

  $: state = $estadisticasStore;
  $: data = state.data;
  $: isFirstLoad = state.loading && !data;
  $: isEmpty = !!data && data.totales.avanzadas === 0;

  function nf(n: number): string {
    return n.toLocaleString('es-CO');
  }
</script>

<div class="reportes-avanzadas">
  {#if isFirstLoad}
    <div class="skeleton-grid">
      <div class="skeleton skeleton-chart" data-testid="skeleton"></div>
      <div class="skeleton skeleton-chart" data-testid="skeleton"></div>
    </div>
  {:else if data}
    <div class="ra-body" class:is-revalidating={state.revalidating}>
      {#if isEmpty}
        <div class="empty-state">
          <Icon name="clipboard-list" size={32} />
          <p>Todavía no hay avanzadas registradas.</p>
        </div>
      {:else}
        <!-- Requerimientos por entidad: el gráfico operativo clave -->
        <div class="chart-card">
          <BarraHorizontal
            title="Requerimientos por entidad"
            iconName="grid"
            items={data.por_entidad.map((e) => ({ id: e.sigla, label: e.sigla, sublabel: e.entidad, value: e.total }))}
            emptyMessage="Sin requerimientos asignados a entidades."
          />
        </div>

        <!-- Categorías más frecuentes -->
        <div class="chart-card">
          <BarraHorizontal
            title="Categorías más frecuentes (top 12)"
            iconName="clipboard-list"
            items={data.por_categoria.map((c, i) => ({ id: `${c.categoria}-${i}`, label: c.categoria, sublabel: c.sigla, value: c.total }))}
            emptyMessage="Sin categorías registradas."
          />
        </div>

        <!-- Requerimientos por comuna -->
        <div class="chart-card">
          <BarraHorizontal
            title="Requerimientos por comuna"
            iconName="map-pin"
            items={data.por_comuna.map((c) => ({ id: c.comuna, label: c.comuna, sublabel: `${c.avanzadas} avanzada${c.avanzadas === 1 ? '' : 's'}`, value: c.requerimientos }))}
            emptyMessage="Sin datos por comuna."
          />
        </div>

        <!-- Evolución mensual: dos small multiples, cada uno con su propia escala -->
        <div class="chart-card chart-card-wide">
          <h3 class="section-title"><Icon name="calendar" size={16} /> Evolución mensual</h3>
          <div class="mes-grid">
            <ColumnasMensuales
              title="Avanzadas por mes"
              items={data.por_mes.map((m) => ({ mes: m.mes, value: m.avanzadas }))}
              emptyMessage="Sin avanzadas en el periodo."
            />
            <ColumnasMensuales
              title="Requerimientos por mes"
              items={data.por_mes.map((m) => ({ mes: m.mes, value: m.requerimientos }))}
              emptyMessage="Sin requerimientos en el periodo."
            />
          </div>
        </div>

        <!-- Por estrategia: pocos valores (3), pills en vez de dona -->
        <div class="chart-card">
          <h3 class="section-title"><Icon name="crosshair" size={16} /> Por estrategia</h3>
          {#if data.por_estrategia.length === 0}
            <p class="chart-empty">Sin estrategias registradas.</p>
          {:else}
            <ul class="estrategia-pills">
              {#each data.por_estrategia as e (e.estrategia)}
                <li class="estrategia-pill">
                  <span class="estrategia-nombre">{e.estrategia}</span>
                  <span class="estrategia-stat"><strong>{nf(e.avanzadas)}</strong> avanzadas</span>
                  <span class="estrategia-stat"><strong>{nf(e.requerimientos)}</strong> requerimientos</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .reportes-avanzadas {
    --chart-surface: var(--surface);
    --ink-primary: var(--text-strong);
    --ink-secondary: var(--text-secondary);
    --ink-muted: var(--text-muted);
    --gridline: var(--border);
    --baseline: var(--border-strong);

    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    max-width: 100%;
    box-sizing: border-box;
  }

  /* Loading skeletons — first load only */
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }
  .skeleton {
    background: linear-gradient(90deg, var(--gridline) 25%, #f1f5f9 37%, var(--gridline) 63%);
    background-size: 400% 100%;
    animation: skeleton-shimmer 1.4s ease infinite;
    border-radius: 12px;
  }
  .skeleton-chart { height: 180px; grid-column: 1 / -1; }
  @keyframes skeleton-shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }

  .ra-body {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    transition: opacity 0.15s ease;
  }
  .ra-body > .empty-state {
    grid-column: 1 / -1;
  }
  .ra-body.is-revalidating {
    opacity: 0.6;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem 0;
    color: var(--ink-secondary);
    text-align: center;
  }

  /* Chart cards */
  .chart-card {
    background: var(--chart-surface);
    border: 1px solid var(--gridline);
    border-radius: 12px;
    padding: 1rem;
    overflow-x: auto;
  }
  .chart-card-wide {
    grid-column: 1 / -1;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--ink-primary);
    margin: 0 0 0.75rem 0;
  }
  .chart-empty {
    font-size: 0.8125rem;
    color: var(--ink-muted);
    text-align: center;
    padding: 1rem 0;
    margin: 0;
  }

  .mes-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Estrategia pills */
  .estrategia-pills {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .estrategia-pill {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 1rem;
    background: var(--bg, #f8fafc);
    border: 1px solid var(--gridline);
    border-radius: 999px;
    padding: 0.5rem 1rem;
  }
  .estrategia-nombre {
    font-weight: 700;
    color: var(--ink-primary);
    font-size: 0.85rem;
    flex: 1 1 auto;
    min-width: 8rem;
  }
  .estrategia-stat {
    font-size: 0.78rem;
    color: var(--ink-secondary);
    font-variant-numeric: tabular-nums;
  }
  .estrategia-stat strong {
    color: var(--ink-primary);
  }

  @media (max-width: 1024px) {
    .ra-body { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 640px) {
    .ra-body { grid-template-columns: 1fr; }
    .mes-grid { gap: 1.25rem; }
  }
</style>
