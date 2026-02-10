<script lang="ts">
  import { navigationStore } from '../../stores/navigationStore';
  import { seguimientoStore } from '../../stores/seguimientoStore';
  import { CENTROS_GESTORES } from '../../data/mock-seguimiento';
  import type { Enlace, Requerimiento } from '../../types/seguimiento';
  import Button from '../ui/Button.svelte';

  $: enlaces = $seguimientoStore.enlaces;
  $: requerimientos = $seguimientoStore.requerimientos;

  let filtroActivo: 'todos' | 'con-req' | 'sin-req' = 'todos';
  let filtroCentroGestor = '';
  let searchText = '';
  let selectedEnlace: Enlace | null = null;

  // Build per-centro-gestor stats
  $: centroStats = (() => {
    const stats: Record<string, { total: number; activos: number; conReqs: number; totalReqs: number; enlaces: Enlace[] }> = {};
    for (const cg of CENTROS_GESTORES) {
      const cgEnlaces = enlaces.filter((e) => e.centro_gestor_id === cg.id);
      const cgEnlaceIds = new Set(cgEnlaces.map((e) => e.id));
      const reqsAsociados = requerimientos.filter((r) => r.enlace_id && cgEnlaceIds.has(r.enlace_id));
      const enlacesConReq = new Set(reqsAsociados.map((r) => r.enlace_id));
      stats[cg.id] = {
        total: cgEnlaces.length,
        activos: cgEnlaces.filter((e) => e.activo).length,
        conReqs: enlacesConReq.size,
        totalReqs: reqsAsociados.length,
        enlaces: cgEnlaces,
      };
    }
    return stats;
  })();

  // Filtered & searchable enlaces list
  $: filteredEnlaces = (() => {
    let list = [...enlaces];
    if (filtroCentroGestor) {
      list = list.filter((e) => e.centro_gestor_id === filtroCentroGestor);
    }
    if (filtroActivo === 'con-req') {
      const enlaceIdsConReq = new Set(requerimientos.filter((r) => r.enlace_id).map((r) => r.enlace_id));
      list = list.filter((e) => enlaceIdsConReq.has(e.id));
    } else if (filtroActivo === 'sin-req') {
      const enlaceIdsConReq = new Set(requerimientos.filter((r) => r.enlace_id).map((r) => r.enlace_id));
      list = list.filter((e) => !enlaceIdsConReq.has(e.id));
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (e) =>
          e.nombre.toLowerCase().includes(q) ||
          e.cargo.toLowerCase().includes(q) ||
          e.centro_gestor_nombre.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  function getReqsForEnlace(enlaceId: string): Requerimiento[] {
    return requerimientos.filter((r) => r.enlace_id === enlaceId);
  }

  function getCentroColor(centroId: string): string {
    return CENTROS_GESTORES.find((c) => c.id === centroId)?.color || '#64748b';
  }

  function getCentroSigla(centroId: string): string {
    return CENTROS_GESTORES.find((c) => c.id === centroId)?.sigla || '?';
  }

  function getEstadoColor(estado: string): string {
    const colors: Record<string, string> = {
      'nuevo': '#6b7280', 'radicado': '#3b82f6', 'en-gestion': '#f59e0b',
      'asignado': '#8b5cf6', 'en-proceso': '#f97316', 'resuelto': '#22c55e', 'cerrado': '#64748b',
    };
    return colors[estado] || '#94a3b8';
  }

  // Overall stats
  $: totalEnlaces = enlaces.length;
  $: enlacesActivos = enlaces.filter((e) => e.activo).length;
  $: enlacesConReqs = new Set(requerimientos.filter((r) => r.enlace_id).map((r) => r.enlace_id)).size;
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.goHome()}>← Volver</button>
    <h2 class="view-title">📇 Directorio de Enlaces</h2>
  </header>

  <main class="view-body">
    <!-- Summary Cards -->
    <div class="summary-row">
      <div class="summary-card">
        <span class="sc-num">{totalEnlaces}</span>
        <span class="sc-label">Total enlaces</span>
      </div>
      <div class="summary-card">
        <span class="sc-num" style="color: #22c55e">{enlacesActivos}</span>
        <span class="sc-label">Activos</span>
      </div>
      <div class="summary-card">
        <span class="sc-num" style="color: #2563eb">{enlacesConReqs}</span>
        <span class="sc-label">Con req. asignados</span>
      </div>
      <div class="summary-card">
        <span class="sc-num" style="color: #f59e0b">{CENTROS_GESTORES.length}</span>
        <span class="sc-label">Centros Gestores</span>
      </div>
    </div>

    <!-- Centro Gestor Panorama -->
    <section class="cg-panorama">
      <h3 class="section-title">🏢 Panorama por Centro Gestor</h3>
      <div class="cg-grid">
        {#each CENTROS_GESTORES as cg (cg.id)}
          {@const stats = centroStats[cg.id]}
          <button
            class="cg-card"
            class:active={filtroCentroGestor === cg.id}
            on:click={() => { filtroCentroGestor = filtroCentroGestor === cg.id ? '' : cg.id; }}
            style="border-left-color: {cg.color}"
          >
            <div class="cg-card-header">
              <span class="cg-sigla" style="background: {cg.color}">{cg.sigla}</span>
              <span class="cg-name">{cg.nombre}</span>
            </div>
            <div class="cg-card-stats">
              <div class="cg-stat">
                <span class="cg-stat-num">{stats.total}</span>
                <span class="cg-stat-lbl">enlaces</span>
              </div>
              <div class="cg-stat">
                <span class="cg-stat-num" style="color: #22c55e">{stats.activos}</span>
                <span class="cg-stat-lbl">activos</span>
              </div>
              <div class="cg-stat">
                <span class="cg-stat-num" style="color: #2563eb">{stats.conReqs}</span>
                <span class="cg-stat-lbl">c/req</span>
              </div>
              <div class="cg-stat">
                <span class="cg-stat-num" style="color: #f59e0b">{stats.totalReqs}</span>
                <span class="cg-stat-lbl">reqs</span>
              </div>
            </div>
          </button>
        {/each}
      </div>
    </section>

    <!-- Filters -->
    <section class="filters-section">
      <div class="filters-row">
        <input
          type="text"
          class="search-input"
          placeholder="🔍 Buscar enlace por nombre, cargo, email..."
          bind:value={searchText}
        />
        <div class="filter-chips">
          <button class="fchip" class:active={filtroActivo === 'todos'} on:click={() => (filtroActivo = 'todos')}>Todos</button>
          <button class="fchip" class:active={filtroActivo === 'con-req'} on:click={() => (filtroActivo = 'con-req')}>Con Reqs</button>
          <button class="fchip" class:active={filtroActivo === 'sin-req'} on:click={() => (filtroActivo = 'sin-req')}>Sin Reqs</button>
        </div>
        {#if filtroCentroGestor}
          <button class="clear-filter" on:click={() => (filtroCentroGestor = '')}>
            ✕ {getCentroSigla(filtroCentroGestor)}
          </button>
        {/if}
      </div>
    </section>

    <!-- Enlaces Table -->
    <section class="enlaces-section">
      <h3 class="section-title">👥 Enlaces ({filteredEnlaces.length})</h3>
      <div class="table-wrapper">
        <table class="enlaces-table">
          <thead>
            <tr>
              <th>Centro Gestor</th>
              <th>Nombre</th>
              <th>Cargo</th>
              <th>Dependencia</th>
              <th>Contacto</th>
              <th>Estado</th>
              <th>Reqs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each filteredEnlaces as enlace (enlace.id)}
              {@const enlaceReqs = getReqsForEnlace(enlace.id)}
              <tr class="enlace-row" class:selected-row={selectedEnlace?.id === enlace.id}>
                <td>
                  <span class="cg-badge" style="background: {getCentroColor(enlace.centro_gestor_id)}">{getCentroSigla(enlace.centro_gestor_id)}</span>
                </td>
                <td class="td-nombre">
                  <strong>{enlace.nombre}</strong>
                </td>
                <td class="td-cargo">{enlace.cargo}</td>
                <td class="td-dep">{enlace.dependencia || '—'}</td>
                <td class="td-contacto">
                  <span class="contact-line">📧 {enlace.email}</span>
                  <span class="contact-line">📱 {enlace.telefono}</span>
                </td>
                <td>
                  <span class="estado-badge" class:activo={enlace.activo} class:inactivo={!enlace.activo}>
                    {enlace.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td class="td-reqs">
                  {#if enlaceReqs.length > 0}
                    <span class="req-badge">{enlaceReqs.length}</span>
                  {:else}
                    <span class="no-reqs">0</span>
                  {/if}
                </td>
                <td>
                  <button class="detail-btn" on:click={() => { selectedEnlace = selectedEnlace?.id === enlace.id ? null : enlace; }}>
                    {selectedEnlace?.id === enlace.id ? '▾' : '▸'} Detalle
                  </button>
                </td>
              </tr>
              {#if selectedEnlace?.id === enlace.id}
                <tr class="detail-row">
                  <td colspan="8">
                    <div class="enlace-detail">
                      <div class="detail-info-grid">
                        <div class="dinfo">
                          <span class="dinfo-label">Nombre completo</span>
                          <span class="dinfo-value">{enlace.nombre}</span>
                        </div>
                        <div class="dinfo">
                          <span class="dinfo-label">Centro Gestor</span>
                          <span class="dinfo-value">{enlace.centro_gestor_nombre}</span>
                        </div>
                        <div class="dinfo">
                          <span class="dinfo-label">Dependencia</span>
                          <span class="dinfo-value">{enlace.dependencia || 'N/A'}</span>
                        </div>
                        <div class="dinfo">
                          <span class="dinfo-label">Cargo</span>
                          <span class="dinfo-value">{enlace.cargo}</span>
                        </div>
                        <div class="dinfo">
                          <span class="dinfo-label">Email</span>
                          <span class="dinfo-value">{enlace.email}</span>
                        </div>
                        <div class="dinfo">
                          <span class="dinfo-label">Teléfono</span>
                          <span class="dinfo-value">{enlace.telefono}</span>
                        </div>
                      </div>

                      {#if enlaceReqs.length > 0}
                        <h4 class="reqs-title">📝 Requerimientos Asignados ({enlaceReqs.length})</h4>
                        <div class="reqs-mini-list">
                          {#each enlaceReqs as req (req.id)}
                            <div class="req-mini">
                              <span class="rm-id">{req.id}</span>
                              <span class="rm-estado" style="background: {getEstadoColor(req.estado)}">{req.estado}</span>
                              <span class="rm-desc">{req.descripcion.slice(0, 70)}{req.descripcion.length > 70 ? '...' : ''}</span>
                              <span class="rm-avance">{req.porcentaje_avance}%</span>
                              <button class="rm-link" on:click={() => navigationStore.navigate('kanban')}>Ver →</button>
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <p class="no-reqs-msg">No tiene requerimientos asignados actualmente.</p>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/if}
            {:else}
              <tr><td colspan="8" class="empty-table">No se encontraron enlaces con los filtros seleccionados</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</div>

<style>
  .view { min-height: 100vh; background: #f8fafc; }
  .view-header {
    background: white; border-bottom: 1px solid #e2e8f0; padding: 0.75rem 1rem;
    display: flex; align-items: center; gap: 0.75rem; position: sticky; top: 0; z-index: 100;
  }
  .back-btn { background: none; border: none; color: #2563eb; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
  .view-title { font-size: 1.1rem; font-weight: 700; flex: 1; }
  .view-body { max-width: 1100px; margin: 0 auto; padding: 1rem; }

  /* Summary */
  .summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin-bottom: 1.25rem; }
  .summary-card {
    background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem;
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .sc-num { font-size: 1.6rem; font-weight: 800; color: #1e293b; }
  .sc-label { font-size: 0.7rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; }

  /* CG Panorama */
  .section-title { font-size: 1rem; font-weight: 700; color: #1e293b; margin-bottom: 0.6rem; }
  .cg-panorama { margin-bottom: 1rem; }
  .cg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.5rem; }
  .cg-card {
    background: white; border: 1px solid #e2e8f0; border-left: 4px solid; border-radius: 8px;
    padding: 0.6rem 0.75rem; cursor: pointer; text-align: left; transition: all 0.15s; width: 100%;
  }
  .cg-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .cg-card.active { background: #eff6ff; border-color: #2563eb; box-shadow: 0 0 0 2px #93c5fd; }
  .cg-card-header { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.4rem; }
  .cg-sigla { color: white; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.6rem; font-weight: 800; }
  .cg-name { font-size: 0.72rem; font-weight: 600; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .cg-card-stats { display: flex; gap: 0.5rem; }
  .cg-stat { display: flex; flex-direction: column; align-items: center; }
  .cg-stat-num { font-size: 1rem; font-weight: 800; color: #1e293b; }
  .cg-stat-lbl { font-size: 0.55rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; }

  /* Filters */
  .filters-section { margin-bottom: 0.75rem; }
  .filters-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .search-input {
    flex: 1; min-width: 200px; padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0;
    border-radius: 8px; font-size: 0.82rem; outline: none;
  }
  .search-input:focus { border-color: #2563eb; }
  .filter-chips { display: flex; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  .fchip {
    background: white; border: none; padding: 0.4rem 0.65rem; font-size: 0.72rem; font-weight: 600;
    color: #64748b; cursor: pointer; transition: all 0.15s;
  }
  .fchip.active { background: #2563eb; color: white; }
  .fchip:not(.active):hover { background: #f1f5f9; }
  .clear-filter {
    background: #fee2e2; color: #991b1b; border: none; padding: 0.35rem 0.6rem; border-radius: 6px;
    font-size: 0.72rem; font-weight: 700; cursor: pointer;
  }

  /* Table */
  .enlaces-section { margin-bottom: 2rem; }
  .table-wrapper { overflow-x: auto; }
  .enlaces-table {
    width: 100%; border-collapse: collapse; font-size: 0.78rem; background: white;
    border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;
  }
  .enlaces-table thead { background: #f8fafc; }
  .enlaces-table th {
    padding: 0.6rem 0.5rem; text-align: left; font-weight: 700; color: #475569;
    font-size: 0.72rem; border-bottom: 2px solid #e2e8f0; white-space: nowrap;
  }
  .enlaces-table td { padding: 0.55rem 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .enlace-row { transition: background 0.1s; }
  .enlace-row:hover { background: #f8fafc; }
  .selected-row { background: #eff6ff !important; }
  .cg-badge { color: white; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.65rem; font-weight: 800; white-space: nowrap; }
  .td-nombre strong { color: #1e293b; font-size: 0.82rem; }
  .td-cargo { color: #64748b; font-size: 0.75rem; }
  .td-dep { color: #94a3b8; font-size: 0.72rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .td-contacto { display: flex; flex-direction: column; gap: 0.1rem; }
  .contact-line { font-size: 0.68rem; color: #64748b; white-space: nowrap; }
  .estado-badge { padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: 700; }
  .estado-badge.activo { background: #dcfce7; color: #166534; }
  .estado-badge.inactivo { background: #fee2e2; color: #991b1b; }
  .td-reqs { text-align: center; }
  .req-badge { display: inline-block; background: #2563eb; color: white; padding: 0.15rem 0.45rem; border-radius: 99px; font-size: 0.7rem; font-weight: 800; }
  .no-reqs { color: #cbd5e1; font-weight: 600; }
  .detail-btn { background: none; border: none; color: #2563eb; font-weight: 600; cursor: pointer; font-size: 0.75rem; white-space: nowrap; }
  .detail-btn:hover { text-decoration: underline; }
  .empty-table { text-align: center; padding: 2rem; color: #94a3b8; }

  /* Detail expanded row */
  .detail-row td { background: #fafbfc; padding: 0; }
  .enlace-detail { padding: 1rem; }
  .detail-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-bottom: 1rem; }
  .dinfo { display: flex; flex-direction: column; }
  .dinfo-label { font-size: 0.65rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
  .dinfo-value { font-size: 0.82rem; color: #1e293b; font-weight: 600; }
  .reqs-title { font-size: 0.85rem; font-weight: 700; margin: 0 0 0.4rem; }
  .reqs-mini-list { display: flex; flex-direction: column; gap: 0.3rem; }
  .req-mini {
    display: flex; align-items: center; gap: 0.5rem; background: white; border: 1px solid #e2e8f0;
    border-radius: 6px; padding: 0.4rem 0.6rem;
  }
  .rm-id { font-family: monospace; font-size: 0.65rem; color: #94a3b8; }
  .rm-estado { color: white; padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.6rem; font-weight: 700; text-transform: capitalize; }
  .rm-desc { flex: 1; font-size: 0.75rem; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rm-avance { font-size: 0.7rem; font-weight: 700; color: #475569; }
  .rm-link { background: none; border: none; color: #2563eb; font-size: 0.72rem; font-weight: 600; cursor: pointer; }
  .rm-link:hover { text-decoration: underline; }
  .no-reqs-msg { font-size: 0.8rem; color: #94a3b8; font-style: italic; }

  @media (max-width: 768px) {
    .summary-row { grid-template-columns: repeat(2, 1fr); }
    .cg-grid { grid-template-columns: 1fr; }
    .detail-info-grid { grid-template-columns: 1fr; }
  }
</style>
