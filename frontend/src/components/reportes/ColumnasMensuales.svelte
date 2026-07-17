<script lang="ts">
  /**
   * Columnas mensuales para UNA sola métrica (small multiple). El dashboard
   * monta esta pieza dos veces — una para avanzadas/mes, otra para
   * requerimientos/mes — cada una con su propia escala, en vez de un único
   * gráfico de doble eje (avanzadas ~0-5 y requerimientos ~0-100 no
   * comparten escala razonable).
   */
  interface ColumnaMensualItem {
    mes: string; // "YYYY-MM"
    value: number;
  }

  export let title: string;
  export let items: ColumnaMensualItem[] = [];
  export let emptyMessage = 'Sin datos en el periodo.';
  export let valueFormatter: (n: number) => string = (n) => n.toLocaleString('es-CO');

  let showTable = false;
  let activeMes: string | null = null;

  $: maxValue = items.reduce((m, it) => Math.max(m, it.value), 0) || 1;

  function heightPct(value: number): number {
    return Math.max(0, Math.min(100, (value / maxValue) * 100));
  }

  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /** "2026-07" -> "jul 26". Falls back to the raw string if it isn't YYYY-MM. */
  function formatMesCorto(mes: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(mes);
    if (!match) return mes;
    const [, year, month] = match;
    const idx = parseInt(month, 10) - 1;
    if (idx < 0 || idx > 11) return mes;
    return `${MESES_CORTOS[idx]} ${year.slice(2)}`;
  }
</script>

<section class="columnas-mensuales">
  <header class="chart-header">
    <h3 class="chart-title">{title}</h3>
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
            <th scope="col">Mes</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {#each items as item (item.mes)}
            <tr>
              <td>{item.mes}</td>
              <td class="num">{valueFormatter(item.value)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="columns-scroll">
      <div class="columns-band" style="--col-count: {items.length}">
        {#each items as item (item.mes)}
          <div
            class="column-hit"
            data-testid="column-hit"
            tabindex="0"
            role="button"
            aria-label="{item.mes}: {valueFormatter(item.value)}"
            on:mouseenter={() => (activeMes = item.mes)}
            on:mouseleave={() => (activeMes = null)}
            on:focus={() => (activeMes = item.mes)}
            on:blur={() => (activeMes = null)}
          >
            {#if activeMes === item.mes}
              <span class="column-tooltip" role="tooltip">{item.mes}: {valueFormatter(item.value)}</span>
            {/if}
            <span class="column-value">{item.value > 0 ? valueFormatter(item.value) : ''}</span>
            <div class="column-track">
              <div
                class="column-bar"
                data-testid="column-bar"
                style="height: {heightPct(item.value)}%; background-color: var(--series);"
              ></div>
            </div>
            <span class="column-label">{formatMesCorto(item.mes)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .columnas-mensuales {
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

  .columns-scroll {
    overflow-x: auto;
  }
  .columns-band {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    min-width: calc(var(--col-count, 1) * 2.75rem);
    height: 140px;
    border-bottom: 1px solid var(--baseline, #cbd5e1);
    padding-bottom: 0;
  }
  .column-hit {
    position: relative;
    flex: 1 0 2.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    min-width: 24px;
    border-radius: 6px;
    padding: 0 2px;
  }
  .column-hit:hover,
  .column-hit:focus-visible {
    background: var(--gridline, #e2e8f0);
    outline: none;
  }
  .column-value {
    font-size: 0.7rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ink-secondary, #64748b);
    min-height: 1em;
  }
  .column-track {
    width: 100%;
    max-width: 24px;
    height: 90px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .column-bar {
    width: 100%;
    max-width: 24px;
    border-radius: 4px 4px 0 0;
    min-height: 2px;
    transition: height 0.2s ease;
  }
  .column-label {
    margin-top: 0.25rem;
    font-size: 0.68rem;
    color: var(--ink-muted, #94a3b8);
    white-space: nowrap;
  }
  .column-tooltip {
    position: absolute;
    top: -1.6rem;
    left: 50%;
    transform: translateX(-50%);
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
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
</style>
