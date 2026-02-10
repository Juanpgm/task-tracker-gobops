<script lang="ts">
  import { onMount } from 'svelte';
  import { navigationStore } from '../../stores/navigationStore';
  import { getUnidadesProyecto } from '../../api/visitas';
  import type { UnidadProyecto } from '../../types';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Alert from '../ui/Alert.svelte';

  let loading = true;
  let errorMsg = '';
  let allUnidades: UnidadProyecto[] = [];
  let filtered: UnidadProyecto[] = [];

  // Filters
  let searchText = '';
  let filterEstado = '';
  let filterTipoEquip = '';
  let filterAvanceMin = '';
  let filterAvanceMax = '';
  let showFilters = false;

  // Pagination
  let page = 1;
  const perPage = 15;

  // Sort
  let sortColumn: keyof UnidadProyecto | '' = '';
  let sortDir: 'asc' | 'desc' = 'asc';

  // Unique values for dropdowns
  let estados: string[] = [];
  let tiposEquipamiento: string[] = [];

  onMount(async () => {
    try {
      allUnidades = await getUnidadesProyecto();
      estados = [...new Set(allUnidades.map((u) => u.estado || 'Sin estado'))].sort();
      tiposEquipamiento = [...new Set(allUnidades.map((u) => u.tipo_equipamiento || 'Sin tipo'))].sort();
      applyFilters();
    } catch (err) {
      errorMsg = 'Error al cargar unidades de proyecto';
      console.error(err);
    } finally {
      loading = false;
    }
  });

  function applyFilters() {
    let result = [...allUnidades];

    // Text search
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (u) =>
          u.nombre_up?.toLowerCase().includes(q) ||
          u.nombre_up_detalle?.toLowerCase().includes(q) ||
          u.direccion?.toLowerCase().includes(q) ||
          u.upid?.toLowerCase().includes(q)
      );
    }

    // Estado
    if (filterEstado) {
      result = result.filter((u) => (u.estado || 'Sin estado') === filterEstado);
    }

    // Tipo equipamiento
    if (filterTipoEquip) {
      result = result.filter((u) => (u.tipo_equipamiento || 'Sin tipo') === filterTipoEquip);
    }

    // Avance rango
    if (filterAvanceMin) {
      result = result.filter((u) => parseFloat(u.avance_obra || '0') >= parseFloat(filterAvanceMin));
    }
    if (filterAvanceMax) {
      result = result.filter((u) => parseFloat(u.avance_obra || '0') <= parseFloat(filterAvanceMax));
    }

    // Sort
    if (sortColumn) {
      result.sort((a, b) => {
        let va = (a[sortColumn as keyof UnidadProyecto] as string) || '';
        let vb = (b[sortColumn as keyof UnidadProyecto] as string) || '';
        // numeric sort for avance and presupuesto
        if (sortColumn === 'avance_obra' || sortColumn === 'presupuesto_base') {
          return sortDir === 'asc'
            ? parseFloat(va || '0') - parseFloat(vb || '0')
            : parseFloat(vb || '0') - parseFloat(va || '0');
        }
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }

    filtered = result;
    page = 1;
  }

  function handleSort(col: keyof UnidadProyecto) {
    if (sortColumn === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortDir = 'asc';
    }
    applyFilters();
  }

  function clearFilters() {
    searchText = '';
    filterEstado = '';
    filterTipoEquip = '';
    filterAvanceMin = '';
    filterAvanceMax = '';
    sortColumn = '';
    sortDir = 'asc';
    applyFilters();
  }

  function seleccionarUP(up: UnidadProyecto) {
    navigationStore.navigate('programar-visita-detalle', { upid: up.upid });
  }

  function formatCurrency(val: string): string {
    const n = parseFloat(val || '0');
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  }

  function getAvanceColor(avance: string): string {
    const n = parseFloat(avance || '0');
    if (n >= 100) return '#22c55e';
    if (n >= 75) return '#84cc16';
    if (n >= 50) return '#f59e0b';
    if (n >= 25) return '#f97316';
    return '#ef4444';
  }

  $: paginatedData = filtered.slice((page - 1) * perPage, page * perPage);
  $: totalPages = Math.ceil(filtered.length / perPage);
  $: {
    // Re-apply when filters change
    searchText; filterEstado; filterTipoEquip; filterAvanceMin; filterAvanceMax;
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.goHome()}>← Volver</button>
    <h2 class="view-title">📋 Unidades de Proyecto</h2>
    <span class="badge-count">{filtered.length} de {allUnidades.length}</span>
  </header>

  <main class="view-body">
    {#if loading}
      <div class="loading-center">
        <div class="spinner"></div>
        <p>Cargando {allUnidades.length > 0 ? allUnidades.length : ''} unidades de proyecto...</p>
      </div>
    {:else if errorMsg}
      <div class="container">
        <Alert type="error" message={errorMsg} />
      </div>
    {:else}
      <!-- Search bar -->
      <div class="search-bar container">
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar por nombre, dirección, UPID..."
            bind:value={searchText}
            on:input={applyFilters}
            class="search-input"
          />
          {#if searchText}
            <button class="clear-search" on:click={() => { searchText = ''; applyFilters(); }}>✕</button>
          {/if}
        </div>
        <button class="filter-toggle" class:active={showFilters} on:click={() => (showFilters = !showFilters)}>
          🎛️ Filtros {showFilters ? '▲' : '▼'}
        </button>
      </div>

      <!-- Filter panel -->
      {#if showFilters}
        <div class="filters-panel container">
          <div class="filter-grid">
            <div class="filter-item">
              <label>Estado</label>
              <select bind:value={filterEstado} on:change={applyFilters}>
                <option value="">Todos</option>
                {#each estados as est}
                  <option value={est}>{est}</option>
                {/each}
              </select>
            </div>
            <div class="filter-item">
              <label>Tipo Equipamiento</label>
              <select bind:value={filterTipoEquip} on:change={applyFilters}>
                <option value="">Todos</option>
                {#each tiposEquipamiento as tipo}
                  <option value={tipo}>{tipo}</option>
                {/each}
              </select>
            </div>
            <div class="filter-item">
              <label>Avance mínimo %</label>
              <input type="number" min="0" max="100" bind:value={filterAvanceMin} on:input={applyFilters} placeholder="0" />
            </div>
            <div class="filter-item">
              <label>Avance máximo %</label>
              <input type="number" min="0" max="100" bind:value={filterAvanceMax} on:input={applyFilters} placeholder="100" />
            </div>
          </div>
          <button class="clear-filters-btn" on:click={clearFilters}>Limpiar filtros</button>
        </div>
      {/if}

      <!-- Table -->
      <div class="table-wrapper">
        <table class="up-table">
          <thead>
            <tr>
              <th class="sortable" on:click={() => handleSort('nombre_up')}>
                Nombre UP {sortColumn === 'nombre_up' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th class="sortable" on:click={() => handleSort('tipo_equipamiento')}>
                Tipo {sortColumn === 'tipo_equipamiento' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th class="sortable" on:click={() => handleSort('tipo_intervencion')}>
                Intervención {sortColumn === 'tipo_intervencion' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th class="sortable" on:click={() => handleSort('direccion')}>
                Dirección {sortColumn === 'direccion' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th class="sortable" on:click={() => handleSort('avance_obra')}>
                Avance {sortColumn === 'avance_obra' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th class="sortable" on:click={() => handleSort('presupuesto_base')}>
                Presupuesto {sortColumn === 'presupuesto_base' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {#each paginatedData as up (up.upid)}
              <tr on:click={() => seleccionarUP(up)}>
                <td class="cell-nombre">
                  <strong>{up.nombre_up}</strong>
                  <small>{up.nombre_up_detalle}</small>
                </td>
                <td><span class="tag tag-tipo">{up.tipo_equipamiento || '—'}</span></td>
                <td>{up.tipo_intervencion || '—'}</td>
                <td class="cell-dir">{up.direccion || '—'}</td>
                <td>
                  <div class="avance-cell">
                    <div class="avance-bar">
                      <div
                        class="avance-fill"
                        style="width: {up.avance_obra || 0}%; background: {getAvanceColor(up.avance_obra)}"
                      ></div>
                    </div>
                    <span class="avance-text">{parseFloat(up.avance_obra || '0').toFixed(0)}%</span>
                  </div>
                </td>
                <td class="cell-money">{formatCurrency(up.presupuesto_base)}</td>
                <td>
                  <span class="estado-badge" class:terminado={up.estado === 'Terminado'}>
                    {up.estado || 'Sin estado'}
                  </span>
                </td>
                <td>
                  <button class="btn-select" on:click|stopPropagation={() => seleccionarUP(up)}>
                    Seleccionar →
                  </button>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="8" class="empty-msg">No se encontraron unidades de proyecto</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="pagination container">
          <button disabled={page <= 1} on:click={() => { page--; }}>← Anterior</button>
          <span class="page-info">Página {page} de {totalPages}</span>
          <button disabled={page >= totalPages} on:click={() => { page++; }}>Siguiente →</button>
        </div>
      {/if}
    {/if}
  </main>
</div>

<style>
  .view { min-height: 100vh; min-height: 100dvh; background: #f8fafc; }
  .view-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: sticky; top: 0; z-index: 100;
  }
  .back-btn { background: none; border: none; color: #2563eb; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
  .view-title { font-size: 1.1rem; font-weight: 700; color: #1e293b; flex: 1; }
  .badge-count { background: #2563eb; color: white; font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 600; }
  .view-body { padding-bottom: 2rem; }
  .container { max-width: 1400px; margin: 0 auto; padding: 0 0.75rem; }

  /* Search */
  .search-bar { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.75rem; }
  .search-input-wrap { flex: 1; position: relative; display: flex; align-items: center; }
  .search-icon { position: absolute; left: 0.75rem; font-size: 1rem; }
  .search-input {
    width: 100%;
    padding: 0.65rem 2.5rem 0.65rem 2.25rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .search-input:focus { border-color: #2563eb; }
  .clear-search { position: absolute; right: 0.5rem; background: none; border: none; cursor: pointer; font-size: 1rem; color: #94a3b8; }
  .filter-toggle {
    background: white;
    border: 1px solid #e2e8f0;
    padding: 0.65rem 1rem;
    border-radius: 8px;
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }
  .filter-toggle.active { background: #2563eb; color: white; border-color: #2563eb; }

  /* Filters */
  .filters-panel {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    margin-top: 0.5rem;
  }
  .filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
  .filter-item label { display: block; font-size: 0.75rem; font-weight: 600; color: #64748b; margin-bottom: 0.25rem; }
  .filter-item select,
  .filter-item input {
    width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.8rem;
  }
  .clear-filters-btn {
    margin-top: 0.75rem;
    background: none; border: none; color: #ef4444; font-size: 0.8rem; font-weight: 600; cursor: pointer;
  }

  /* Table */
  .table-wrapper { overflow-x: auto; margin-top: 0.75rem; padding: 0 0.75rem; }
  .up-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    font-size: 0.8rem;
  }
  .up-table thead { background: #f8fafc; }
  .up-table th {
    padding: 0.65rem 0.75rem;
    text-align: left;
    font-weight: 700;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .sortable { cursor: pointer; user-select: none; }
  .sortable:hover { color: #2563eb; }
  .up-table td {
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }
  .up-table tbody tr { cursor: pointer; transition: background 0.15s; }
  .up-table tbody tr:hover { background: #f0f7ff; }
  .cell-nombre { min-width: 160px; }
  .cell-nombre strong { display: block; font-size: 0.82rem; }
  .cell-nombre small { color: #94a3b8; font-size: 0.72rem; }
  .cell-dir { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cell-money { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .tag { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; }
  .tag-tipo { background: #eff6ff; color: #2563eb; }
  .estado-badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; background: #fef3c7; color: #92400e; }
  .estado-badge.terminado { background: #dcfce7; color: #166534; }

  .avance-cell { display: flex; align-items: center; gap: 0.4rem; min-width: 100px; }
  .avance-bar { flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
  .avance-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
  .avance-text { font-size: 0.72rem; font-weight: 700; min-width: 32px; text-align: right; }

  .btn-select {
    background: #2563eb; color: white; border: none; padding: 0.35rem 0.75rem; border-radius: 6px;
    font-size: 0.75rem; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.2s;
  }
  .btn-select:hover { background: #1d4ed8; }

  .empty-msg { text-align: center; padding: 2rem; color: #94a3b8; }

  /* Pagination */
  .pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1rem; padding-bottom: 1rem; }
  .pagination button {
    background: white; border: 1px solid #e2e8f0; padding: 0.5rem 1rem; border-radius: 6px;
    font-size: 0.8rem; cursor: pointer; font-weight: 600;
  }
  .pagination button:disabled { opacity: 0.4; cursor: default; }
  .page-info { font-size: 0.8rem; color: #64748b; }

  .loading-center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 1rem; gap: 1rem; color: #64748b; }

  @media (max-width: 768px) {
    .up-table { font-size: 0.75rem; }
    .up-table th, .up-table td { padding: 0.5rem; }
    .filter-grid { grid-template-columns: 1fr 1fr; }
  }
</style>
