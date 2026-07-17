<script lang="ts">
  /**
   * Gráfico de barras horizontales reutilizable, ordenado según el orden de
   * `items` (el llamador decide el orden — el backend ya entrega desc).
   * Una sola escala, un solo hue (var(--series)) en todas las barras: esto
   * es SIEMPRE una comparación de magnitud entre categorías nominales, nunca
   * una serie con orden natural, así que ninguna barra lleva un tono distinto.
   *
   * Cada barra es un hit-target enfocable con tooltip on hover/focus
   * (paridad teclado/mouse) y hay un twin de tabla accesible detrás de un
   * toggle: los valores son alcanzables sin color ni hover.
   */
  import Icon from '../ui/Icon.svelte';

  interface BarraHorizontalItem {
    id: string;
    label: string;
    sublabel?: string;
    value: number;
  }

  export let title: string;
  export let iconName: string | undefined = undefined;
  export let items: BarraHorizontalItem[] = [];
  export let emptyMessage = 'Sin datos disponibles.';
  export let valueFormatter: (n: number) => string = (n) => n.toLocaleString('es-CO');

  let showTable = false;
  let activeId: string | null = null;

  $: maxValue = items.reduce((m, it) => Math.max(m, it.value), 0) || 1;

  function widthPct(value: number): number {
    return Math.max(0, Math.min(100, (value / maxValue) * 100));
  }
</script>

<section class="barra-horizontal">
  <header class="chart-header">
    <h3 class="chart-title">
      {#if iconName}<Icon name={iconName} size={16} />{/if}
      {title}
    </h3>
    {#if items.length > 0}
      <button
        type="button"
        class="table-toggle"
        aria-pressed={showTable}
        on:click={() => (showTable = !showTable)}
      >
        {showTable ? 'Ver gráfico' : 'Ver tabla'}
      </button>
    {/if}
  </header>

  {#if items.length === 0}
    <p class="chart-empty">{emptyMessage}</p>
  {:else if showTable}
    <div class="table-scroll">
      <table>
        <caption class="sr-only">{title}</caption>
        <thead>
          <tr>
            <th scope="col">Elemento</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {#each items as item (item.id)}
            <tr>
              <td>{item.label}{#if item.sublabel} <span class="table-sublabel">— {item.sublabel}</span>{/if}</td>
              <td class="num">{valueFormatter(item.value)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <ul class="bars">
      {#each items as item (item.id)}
        <li class="bar-row" data-testid="bar-row">
          <div
            class="bar-hit"
            data-testid="bar-hit"
            tabindex="0"
            role="button"
            aria-label="{item.label}: {valueFormatter(item.value)}"
            on:mouseenter={() => (activeId = item.id)}
            on:mouseleave={() => (activeId = null)}
            on:focus={() => (activeId = item.id)}
            on:blur={() => (activeId = null)}
          >
            <span class="bar-label" title={item.sublabel ? `${item.label} — ${item.sublabel}` : item.label}>
              {item.label}
            </span>
            <div class="bar-track">
              <div
                class="bar-fill"
                data-testid="bar-fill"
                style="width: {widthPct(item.value)}%; background-color: var(--series);"
              ></div>
            </div>
            <span class="bar-value">{valueFormatter(item.value)}</span>
            {#if activeId === item.id}
              <span class="bar-tooltip" role="tooltip">
                {item.label}{#if item.sublabel} — {item.sublabel}{/if}: {valueFormatter(item.value)}
              </span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .barra-horizontal {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .chart-title {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--ink-primary, #0f172a);
    margin: 0;
  }
  .table-toggle {
    background: none;
    border: 1px solid var(--gridline, #e2e8f0);
    border-radius: 6px;
    padding: 0.25rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ink-secondary, #64748b);
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
  }
  .table-toggle:hover {
    background: var(--gridline, #e2e8f0);
  }
  .chart-empty {
    font-size: 0.8125rem;
    color: var(--ink-muted, #94a3b8);
    text-align: center;
    padding: 1rem 0;
    margin: 0;
  }

  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bar-row {
    display: block;
  }
  .bar-hit {
    position: relative;
    display: grid;
    grid-template-columns: minmax(4.5rem, 32%) 1fr auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.125rem;
    min-height: 24px;
    border-radius: 6px;
    cursor: default;
  }
  .bar-hit:hover,
  .bar-hit:focus-visible {
    background: var(--gridline, #e2e8f0);
    outline: none;
  }
  .bar-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink-primary, #0f172a);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar-track {
    height: 24px;
    background: transparent;
    display: flex;
    align-items: center;
  }
  .bar-fill {
    height: 20px;
    max-height: 24px;
    border-radius: 0 4px 4px 0;
    min-width: 2px;
    transition: width 0.2s ease;
  }
  .bar-value {
    font-size: 0.78rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ink-secondary, #64748b);
    min-width: 2.5ch;
    text-align: right;
  }
  .bar-tooltip {
    position: absolute;
    left: 0.5rem;
    top: -1.6rem;
    background: var(--ink-primary, #0f172a);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    white-space: nowrap;
    z-index: 10;
    pointer-events: none;
  }

  .table-scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  th, td {
    text-align: left;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var(--gridline, #e2e8f0);
    color: var(--ink-primary, #0f172a);
  }
  th {
    color: var(--ink-secondary, #64748b);
    font-weight: 600;
    font-size: 0.75rem;
  }
  td.num {
    font-variant-numeric: tabular-nums;
    text-align: right;
    font-weight: 600;
  }
  .table-sublabel {
    color: var(--ink-muted, #94a3b8);
    font-weight: 400;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
</style>
