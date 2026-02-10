<script lang="ts">
  import { navigationStore } from '../../stores/navigationStore';
  import { seguimientoStore } from '../../stores/seguimientoStore';
  import { KANBAN_COLUMNS } from '../../types/seguimiento';
  import type { Requerimiento, EstadoRequerimiento } from '../../types/seguimiento';
  import Button from '../ui/Button.svelte';

  let filterVisitaId = '';
  let selectedReq: Requerimiento | null = null;
  let showDetailPanel = false;
  let viewMode: 'kanban' | 'tabla' = 'kanban';
  let enlaceSeleccionado = '';

  // Avance form
  let showAvanceForm = false;
  let avanceNuevoEstado: EstadoRequerimiento = 'radicado';
  let avanceDescripcion = '';
  let avancePorcentaje = 0;
  let avanceEncargado = '';

  $: params = $navigationStore.params;
  $: filterVisitaId = params.visitaId || '';

  $: allReqs = $seguimientoStore.requerimientos;
  $: displayReqs = filterVisitaId
    ? allReqs.filter((r) => r.visita_id === filterVisitaId)
    : allReqs;

  $: groupedByEstado = (() => {
    const grouped: Record<EstadoRequerimiento, Requerimiento[]> = {
      'nuevo': [], 'radicado': [], 'en-gestion': [], 'asignado': [], 'en-proceso': [], 'resuelto': [], 'cerrado': [],
    };
    for (const req of displayReqs) {
      grouped[req.estado].push(req);
    }
    return grouped;
  })();

  function selectReq(req: Requerimiento) {
    selectedReq = req;
    showDetailPanel = true;
    showAvanceForm = false;
  }

  function closeDetail() {
    showDetailPanel = false;
    selectedReq = null;
  }

  function openAvanceForm() {
    if (!selectedReq) return;
    avanceNuevoEstado = getNextEstado(selectedReq.estado);
    avanceDescripcion = '';
    avancePorcentaje = selectedReq.porcentaje_avance;
    avanceEncargado = selectedReq.encargado || '';
    showAvanceForm = true;
  }

  function getNextEstado(current: EstadoRequerimiento): EstadoRequerimiento {
    const order: EstadoRequerimiento[] = ['nuevo', 'radicado', 'en-gestion', 'asignado', 'en-proceso', 'resuelto', 'cerrado'];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : current;
  }

  function guardarAvance() {
    if (!selectedReq || !avanceDescripcion.trim()) return;

    seguimientoStore.cambiarEstadoRequerimiento(
      selectedReq.id,
      avanceNuevoEstado,
      avanceDescripcion,
      'Usuario actual',
      avancePorcentaje
    );

    if (avanceEncargado && avanceEncargado !== selectedReq.encargado) {
      seguimientoStore.asignarEncargado(selectedReq.id, avanceEncargado);
    }

    // Refresh selected
    const updated = $seguimientoStore.requerimientos.find((r) => r.id === selectedReq!.id);
    if (updated) selectedReq = updated;
    showAvanceForm = false;
  }

  // Keep selectedReq in sync
  $: if (selectedReq && $seguimientoStore.requerimientos) {
    const found = $seguimientoStore.requerimientos.find((r) => r.id === selectedReq!.id);
    if (found) selectedReq = found;
  }

  function getPrioridadStyle(p: string): string {
    switch (p) {
      case 'urgente': return 'background: #fee2e2; color: #991b1b;';
      case 'alta': return 'background: #fef3c7; color: #92400e;';
      case 'media': return 'background: #dbeafe; color: #1e40af;';
      case 'baja': return 'background: #f1f5f9; color: #475569;';
      default: return '';
    }
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getVisitaLabel(visitaId: string): string {
    const v = $seguimientoStore.visitas.find((v) => v.id === visitaId);
    return v ? `${v.unidad_proyecto.nombre_up} — ${v.fecha_visita}` : visitaId;
  }

  // Enlaces
  $: allEnlaces = $seguimientoStore.enlaces.filter((e) => e.activo);
  $: enlacesForSelectedReq = selectedReq
    ? allEnlaces.filter((e) => selectedReq!.centros_gestores.includes(e.centro_gestor_nombre))
    : [];

  function getEnlaceNombre(enlaceId: string | undefined): string {
    if (!enlaceId) return '';
    const e = $seguimientoStore.enlaces.find((en) => en.id === enlaceId);
    return e ? e.nombre : '';
  }

  function handleAsignarEnlace() {
    if (!selectedReq || !enlaceSeleccionado) return;
    const enlace = allEnlaces.find((e) => e.id === enlaceSeleccionado);
    if (enlace) {
      seguimientoStore.asignarEnlace(selectedReq.id, enlace.id, enlace.nombre);
    }
    enlaceSeleccionado = '';
  }

  // Stats
  $: totalReqs = displayReqs.length;
  $: avgAvance = totalReqs > 0 ? Math.round(displayReqs.reduce((sum, r) => sum + r.porcentaje_avance, 0) / totalReqs) : 0;
</script>

<div class="view" class:has-panel={showDetailPanel}>
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.navigate(filterVisitaId ? 'visitas-programadas' : 'home')}>← Volver</button>
    <h2 class="view-title">📊 Tablero de Requerimientos</h2>
    <div class="header-controls">
      <div class="view-toggle">
        <button class="toggle-btn" class:active={viewMode === 'kanban'} on:click={() => (viewMode = 'kanban')}>▦ Kanban</button>
        <button class="toggle-btn" class:active={viewMode === 'tabla'} on:click={() => (viewMode = 'tabla')}>☰ Tabla</button>
      </div>
      <span class="stat">{totalReqs} req.</span>
      <span class="stat">⌀ {avgAvance}%</span>
    </div>
  </header>

  {#if filterVisitaId}
    <div class="filter-banner">
      Mostrando requerimientos de: <strong>{getVisitaLabel(filterVisitaId)}</strong>
      <button class="clear-filter" on:click={() => { filterVisitaId = ''; navigationStore.navigate('kanban'); }}>✕ Ver todos</button>
    </div>
  {/if}

  {#if viewMode === 'kanban'}
  <div class="kanban-container">
    <div class="kanban-board">
      {#each KANBAN_COLUMNS as col (col.id)}
        {@const colReqs = groupedByEstado[col.id] || []}
        <div class="kanban-column">
          <div class="column-header" style="border-color: {col.color}">
            <span class="column-icon">{col.icon}</span>
            <span class="column-title">{col.title}</span>
            <span class="column-count" style="background: {col.color}">{colReqs.length}</span>
          </div>
          <div class="column-body">
            {#each colReqs as req (req.id)}
              <button class="kanban-card" class:selected={selectedReq?.id === req.id} on:click={() => selectReq(req)}>
                <div class="kcard-top">
                  <span class="kcard-prioridad" style={getPrioridadStyle(req.prioridad)}>{req.prioridad}</span>
                  <span class="kcard-id">{req.id}</span>
                </div>
                <p class="kcard-desc">{req.descripcion.slice(0, 80)}{req.descripcion.length > 80 ? '...' : ''}</p>
                <div class="kcard-footer">
                  <span class="kcard-solicitante">👤 {req.solicitante.nombre_completo.split(' ')[0]}</span>
                  <div class="kcard-avance">
                    <div class="mini-bar"><div class="mini-fill" style="width: {req.porcentaje_avance}%"></div></div>
                    <span>{req.porcentaje_avance}%</span>
                  </div>
                </div>
                <div class="kcard-tags">
                  {#each req.centros_gestores.slice(0, 2) as cg}
                    <span class="kcard-tag">{cg.length > 15 ? cg.slice(0, 12) + '...' : cg}</span>
                  {/each}
                  {#if req.centros_gestores.length > 2}
                    <span class="kcard-tag">+{req.centros_gestores.length - 2}</span>
                  {/if}
                </div>
                {#if req.enlace_nombre}
                  <div class="kcard-enlace">🤝 {req.enlace_nombre}</div>
                {/if}
              </button>
            {:else}
              <div class="empty-column">Sin requerimientos</div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
  {:else}
  <!-- TABLA VIEW -->
  <div class="tabla-container">
    <div class="tabla-wrapper">
      <table class="req-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Solicitante</th>
            <th>Centro(s) Gestor(es)</th>
            <th>Descripción</th>
            <th>Avance</th>
            <th>Enlace</th>
            <th>Encargado</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each displayReqs as req (req.id)}
            <tr class="tabla-row" class:selected-row={selectedReq?.id === req.id}>
              <td class="td-id">{req.id}</td>
              <td>
                <span class="tabla-estado" style="background: {KANBAN_COLUMNS.find(c => c.id === req.estado)?.color || '#94a3b8'}">
                  {req.estado}
                </span>
              </td>
              <td><span class="tabla-prioridad" style={getPrioridadStyle(req.prioridad)}>{req.prioridad}</span></td>
              <td class="td-solicitante">{req.solicitante.nombre_completo}</td>
              <td class="td-centros">
                {#each req.centros_gestores as cg}
                  <span class="tabla-cg-chip">{cg.length > 12 ? cg.slice(0, 10) + '..' : cg}</span>
                {/each}
              </td>
              <td class="td-desc">{req.descripcion.slice(0, 60)}{req.descripcion.length > 60 ? '...' : ''}</td>
              <td>
                <div class="tabla-avance">
                  <div class="mini-bar" style="width: 50px;"><div class="mini-fill" style="width: {req.porcentaje_avance}%"></div></div>
                  <span class="tabla-pct">{req.porcentaje_avance}%</span>
                </div>
              </td>
              <td class="td-enlace">{req.enlace_nombre || '—'}</td>
              <td class="td-encargado">{req.encargado || '—'}</td>
              <td class="td-fecha">{new Date(req.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</td>
              <td><button class="tabla-detail-btn" on:click={() => selectReq(req)}>Ver →</button></td>
            </tr>
          {:else}
            <tr><td colspan="11" class="empty-table">No hay requerimientos</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  {/if}

  <!-- Detail Panel (slide-in) -->
  {#if showDetailPanel && selectedReq}
    <div class="detail-overlay" on:click={closeDetail} on:keydown={(e) => e.key === 'Escape' && closeDetail()} role="button" tabindex="0"></div>
    <aside class="detail-panel">
      <div class="panel-header">
        <h3>Detalle del Requerimiento</h3>
        <button class="close-panel" on:click={closeDetail}>✕</button>
      </div>

      <div class="panel-body">
        <!-- Status & Priority -->
        <div class="panel-row">
          <span class="panel-label">Estado</span>
          <span class="panel-estado">{selectedReq.estado}</span>
        </div>
        <div class="panel-row">
          <span class="panel-label">Prioridad</span>
          <span class="panel-prioridad" style={getPrioridadStyle(selectedReq.prioridad)}>{selectedReq.prioridad}</span>
        </div>
        <div class="panel-row">
          <span class="panel-label">Avance</span>
          <div class="panel-avance">
            <div class="panel-avance-bar"><div class="panel-avance-fill" style="width: {selectedReq.porcentaje_avance}%"></div></div>
            <strong>{selectedReq.porcentaje_avance}%</strong>
          </div>
        </div>
        {#if selectedReq.encargado}
          <div class="panel-row">
            <span class="panel-label">Encargado</span>
            <span>{selectedReq.encargado}</span>
          </div>
        {/if}

        <hr />

        <!-- Enlace del Organismo -->
        <h4>🤝 Enlace del Organismo</h4>
        {#if selectedReq.enlace_nombre}
          {@const enlaceObj = $seguimientoStore.enlaces.find(e => e.id === selectedReq?.enlace_id)}
          <div class="enlace-assigned">
            <div class="enlace-info">
              <span class="enlace-name">{selectedReq.enlace_nombre}</span>
              {#if enlaceObj}
                <span class="enlace-meta">{enlaceObj.cargo} — {enlaceObj.centro_gestor_nombre}</span>
                {#if enlaceObj.email}<span class="enlace-contact">📧 {enlaceObj.email}</span>{/if}
                {#if enlaceObj.telefono}<span class="enlace-contact">📱 {enlaceObj.telefono}</span>{/if}
              {/if}
            </div>
          </div>
        {:else}
          <p class="panel-info-sm" style="margin-bottom: 0.4rem;">Sin enlace asignado</p>
        {/if}
        {#if enlacesForSelectedReq.length > 0}
          <div class="enlace-assign-form">
            <select class="enlace-select" bind:value={enlaceSeleccionado}>
              <option value="">— Asignar enlace —</option>
              {#each enlacesForSelectedReq as enl}
                <option value={enl.id}>{enl.nombre} ({enl.cargo} - {enl.centro_gestor_nombre})</option>
              {/each}
            </select>
            <button class="enlace-assign-btn" on:click={handleAsignarEnlace} disabled={!enlaceSeleccionado}>Asignar</button>
          </div>
        {:else}
          <p class="panel-info-sm" style="color: #94a3b8;">No hay enlaces registrados para los centros gestores de este requerimiento</p>
        {/if}

        <hr />

        <!-- Solicitante -->
        <h4>👤 Solicitante</h4>
        <div class="panel-info">{selectedReq.solicitante.nombre_completo}</div>
        <div class="panel-info-sm">CC: {selectedReq.solicitante.cedula} | ☎ {selectedReq.solicitante.telefono}</div>
        <div class="panel-info-sm">📍 {selectedReq.solicitante.direccion}, {selectedReq.solicitante.barrio_vereda}</div>

        <hr />

        <!-- Centros Gestores -->
        <h4>🏢 Centros Gestores</h4>
        <div class="panel-tags">
          {#each selectedReq.centros_gestores as cg}
            <span class="panel-tag">{cg}</span>
          {/each}
        </div>

        <hr />

        <!-- Description -->
        <h4>📝 Descripción</h4>
        <p class="panel-desc">{selectedReq.descripcion}</p>
        {#if selectedReq.observaciones}
          <p class="panel-obs">💬 {selectedReq.observaciones}</p>
        {/if}

        <hr />

        <!-- GPS -->
        {#if selectedReq.latitud && selectedReq.longitud}
          <div class="panel-row">
            <span class="panel-label">Coordenadas</span>
            <span class="panel-coords">{selectedReq.latitud}, {selectedReq.longitud}</span>
          </div>
        {/if}

        <hr />

        <!-- Historial -->
        <h4>📋 Historial de Gestión ({selectedReq.historial.length})</h4>
        <div class="timeline">
          {#each [...selectedReq.historial].reverse() as entry (entry.id)}
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-head">
                  <strong>{entry.autor}</strong>
                  <span class="timeline-date">{formatDate(entry.fecha)}</span>
                </div>
                <p class="timeline-desc">{entry.descripcion}</p>
                {#if entry.estado_anterior !== entry.estado_nuevo}
                  <span class="timeline-transition">
                    {entry.estado_anterior} → {entry.estado_nuevo}
                  </span>
                {/if}
                {#if entry.evidencias.length > 0}
                  <div class="timeline-evidencias">
                    {#each entry.evidencias as ev}
                      <span class="evidence-chip">{ev.tipo === 'foto' ? '📷' : '📄'} {ev.descripcion}</span>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <hr />

        <!-- Avance Form -->
        {#if !showAvanceForm}
          <Button on:click={openAvanceForm}>➕ Registrar Avance / Cambiar Estado</Button>
        {:else}
          <div class="avance-form">
            <h4>📝 Nuevo Registro de Avance</h4>
            <div class="field">
              <label>Nuevo Estado</label>
              <select bind:value={avanceNuevoEstado}>
                <option value="nuevo">Nuevo</option>
                <option value="radicado">Radicado</option>
                <option value="en-gestion">En Gestión</option>
                <option value="asignado">Asignado</option>
                <option value="en-proceso">En Proceso</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>
            <div class="field">
              <label>Descripción de la Gestión *</label>
              <textarea bind:value={avanceDescripcion} rows="3" placeholder="¿Qué se hizo? ¿Con quién se comunicó?"></textarea>
            </div>
            <div class="field">
              <label>Encargado del Centro Gestor</label>
              <input type="text" bind:value={avanceEncargado} placeholder="Nombre del funcionario responsable" />
            </div>
            <div class="field">
              <label>% Avance: {avancePorcentaje}%</label>
              <input type="range" min="0" max="100" step="5" bind:value={avancePorcentaje} />
            </div>
            <div class="avance-actions">
              <Button variant="secondary" size="sm" on:click={() => (showAvanceForm = false)}>Cancelar</Button>
              <Button size="sm" on:click={guardarAvance} disabled={!avanceDescripcion.trim()}>💾 Guardar</Button>
            </div>
          </div>
        {/if}
      </div>
    </aside>
  {/if}
</div>

<style>
  .view { min-height: 100vh; background: #f1f5f9; display: flex; flex-direction: column; }
  .view-header {
    background: white; border-bottom: 1px solid #e2e8f0; padding: 0.75rem 1rem;
    display: flex; align-items: center; gap: 0.75rem; position: sticky; top: 0; z-index: 200;
  }
  .back-btn { background: none; border: none; color: #2563eb; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
  .view-title { font-size: 1.1rem; font-weight: 700; flex: 1; }
  .header-stats { display: flex; gap: 0.5rem; }
  .stat { background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; color: #475569; }
  .header-controls { display: flex; align-items: center; gap: 0.5rem; }
  .view-toggle { display: flex; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  .toggle-btn {
    background: white; border: none; padding: 0.3rem 0.6rem; font-size: 0.72rem; font-weight: 600;
    color: #64748b; cursor: pointer; transition: all 0.15s;
  }
  .toggle-btn.active { background: #2563eb; color: white; }
  .toggle-btn:not(.active):hover { background: #f1f5f9; }

  .filter-banner {
    background: #eff6ff; padding: 0.5rem 1rem; font-size: 0.8rem; color: #1e40af;
    display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  }
  .clear-filter { background: none; border: none; color: #ef4444; cursor: pointer; font-weight: 600; font-size: 0.8rem; }

  /* Kanban */
  .kanban-container { flex: 1; overflow-x: auto; padding: 0.75rem; }
  .kanban-board { display: flex; gap: 0.6rem; min-width: max-content; height: calc(100vh - 120px); }
  .kanban-column { width: 260px; min-width: 260px; display: flex; flex-direction: column; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; }
  .column-header {
    display: flex; align-items: center; gap: 0.4rem; padding: 0.6rem 0.75rem;
    border-bottom: 3px solid; font-size: 0.8rem; font-weight: 700; color: #1e293b;
  }
  .column-icon { font-size: 1rem; }
  .column-title { flex: 1; }
  .column-count { color: white; font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: 99px; font-weight: 700; }
  .column-body { flex: 1; overflow-y: auto; padding: 0.4rem; display: flex; flex-direction: column; gap: 0.4rem; }

  /* Kanban Card */
  .kanban-card {
    background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.6rem;
    text-align: left; cursor: pointer; transition: all 0.15s; width: 100%;
    border-left: 3px solid transparent;
  }
  .kanban-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); transform: translateY(-1px); }
  .kanban-card.selected { border-left-color: #2563eb; box-shadow: 0 0 0 2px #93c5fd; }
  .kcard-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
  .kcard-prioridad { padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; }
  .kcard-id { font-size: 0.6rem; color: #94a3b8; font-family: monospace; }
  .kcard-desc { font-size: 0.75rem; color: #334155; margin: 0 0 0.35rem; line-height: 1.3; }
  .kcard-footer { display: flex; justify-content: space-between; align-items: center; }
  .kcard-solicitante { font-size: 0.65rem; color: #64748b; }
  .kcard-avance { display: flex; align-items: center; gap: 0.3rem; }
  .mini-bar { width: 40px; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; }
  .mini-fill { height: 100%; background: #2563eb; border-radius: 2px; }
  .kcard-avance span { font-size: 0.6rem; font-weight: 700; color: #475569; }
  .kcard-tags { display: flex; flex-wrap: wrap; gap: 0.2rem; margin-top: 0.3rem; }
  .kcard-tag { font-size: 0.6rem; background: #f1f5f9; color: #475569; padding: 0.1rem 0.3rem; border-radius: 3px; }
  .empty-column { text-align: center; padding: 2rem 0.5rem; color: #94a3b8; font-size: 0.75rem; }
  .kcard-enlace { font-size: 0.62rem; color: #0d9488; font-weight: 600; margin-top: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Detail Panel */
  .detail-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 300;
  }
  .detail-panel {
    position: fixed; right: 0; top: 0; bottom: 0; width: 420px; max-width: 90vw;
    background: white; z-index: 301; box-shadow: -4px 0 20px rgba(0,0,0,0.15);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .panel-header {
    display: flex; justify-content: space-between; align-items: center; padding: 1rem;
    border-bottom: 1px solid #e2e8f0; background: #f8fafc;
  }
  .panel-header h3 { margin: 0; font-size: 1rem; }
  .close-panel { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b; }
  .panel-body { flex: 1; overflow-y: auto; padding: 1rem; }
  .panel-body hr { border: none; border-top: 1px solid #f1f5f9; margin: 0.75rem 0; }
  .panel-body h4 { font-size: 0.85rem; font-weight: 700; margin: 0 0 0.35rem; color: #1e293b; }
  .panel-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
  .panel-label { font-size: 0.75rem; color: #94a3b8; font-weight: 600; }
  .panel-estado { font-size: 0.8rem; font-weight: 700; color: #2563eb; text-transform: capitalize; }
  .panel-prioridad { padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }
  .panel-avance { display: flex; align-items: center; gap: 0.5rem; }
  .panel-avance-bar { width: 100px; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
  .panel-avance-fill { height: 100%; background: #2563eb; border-radius: 4px; }
  .panel-info { font-size: 0.85rem; font-weight: 600; color: #1e293b; }
  .panel-info-sm { font-size: 0.75rem; color: #64748b; }
  .panel-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .panel-tag { background: #eff6ff; color: #1e40af; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; }
  .panel-desc { font-size: 0.85rem; color: #334155; line-height: 1.5; margin: 0; }
  .panel-obs { font-size: 0.8rem; color: #64748b; font-style: italic; margin: 0.25rem 0 0; }
  .panel-coords { font-size: 0.75rem; font-family: monospace; color: #475569; }

  /* Enlace section */
  .enlace-assigned { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 0.6rem; margin-bottom: 0.5rem; }
  .enlace-info { display: flex; flex-direction: column; gap: 0.15rem; }
  .enlace-name { font-size: 0.85rem; font-weight: 700; color: #0d9488; }
  .enlace-meta { font-size: 0.72rem; color: #475569; }
  .enlace-contact { font-size: 0.7rem; color: #64748b; }
  .enlace-assign-form { display: flex; gap: 0.4rem; align-items: center; margin-top: 0.4rem; }
  .enlace-select {
    flex: 1; padding: 0.4rem; border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: 0.78rem; font-family: inherit; outline: none; background: white;
  }
  .enlace-select:focus { border-color: #0d9488; box-shadow: 0 0 0 2px rgba(13,148,136,0.15); }
  .enlace-assign-btn {
    background: #0d9488; color: white; border: none; padding: 0.4rem 0.75rem;
    border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;
    white-space: nowrap; transition: background 0.15s;
  }
  .enlace-assign-btn:hover:not(:disabled) { background: #0f766e; }
  .enlace-assign-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Timeline */
  .timeline { display: flex; flex-direction: column; gap: 0; margin-top: 0.5rem; }
  .timeline-item { display: flex; gap: 0.6rem; position: relative; padding-bottom: 0.75rem; }
  .timeline-item:not(:last-child)::before {
    content: ''; position: absolute; left: 5px; top: 14px; bottom: 0;
    width: 2px; background: #e2e8f0;
  }
  .timeline-dot {
    width: 12px; height: 12px; border-radius: 50%; background: #2563eb;
    flex-shrink: 0; margin-top: 3px;
  }
  .timeline-content { flex: 1; min-width: 0; }
  .timeline-head { display: flex; justify-content: space-between; align-items: center; }
  .timeline-head strong { font-size: 0.75rem; color: #1e293b; }
  .timeline-date { font-size: 0.65rem; color: #94a3b8; }
  .timeline-desc { font-size: 0.78rem; color: #475569; margin: 0.15rem 0; line-height: 1.4; }
  .timeline-transition {
    display: inline-block; font-size: 0.65rem; background: #f0f7ff; color: #2563eb;
    padding: 0.1rem 0.4rem; border-radius: 3px; font-weight: 600; margin-top: 0.15rem;
  }
  .timeline-evidencias { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.25rem; }
  .evidence-chip { font-size: 0.65rem; background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 3px; }

  /* Avance form */
  .avance-form { background: #f8fafc; border-radius: 8px; padding: 0.75rem; margin-top: 0.5rem; }
  .avance-form h4 { margin-top: 0; }
  .field { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.5rem; }
  .field label { font-size: 0.75rem; font-weight: 600; color: #475569; }
  .field input, .field textarea, .field select {
    padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.82rem;
    font-family: inherit; outline: none;
  }
  .field input[type="range"] { padding: 0; }
  .avance-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

  /* Table view */
  .tabla-container { flex: 1; overflow: auto; padding: 0.75rem; }
  .tabla-wrapper { overflow-x: auto; }
  .req-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
  .req-table thead { background: #f8fafc; }
  .req-table th { padding: 0.6rem 0.5rem; text-align: left; font-weight: 700; color: #475569; font-size: 0.72rem; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
  .req-table td { padding: 0.55rem 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .tabla-row { transition: background 0.1s; cursor: default; }
  .tabla-row:hover { background: #f8fafc; }
  .selected-row { background: #eff6ff !important; }
  .td-id { font-family: monospace; font-size: 0.65rem; color: #94a3b8; }
  .tabla-estado { color: white; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.65rem; font-weight: 700; text-transform: capitalize; white-space: nowrap; }
  .tabla-prioridad { padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; }
  .td-solicitante { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #1e293b; }
  .td-centros { max-width: 160px; }
  .tabla-cg-chip { display: inline-block; font-size: 0.6rem; background: #f1f5f9; color: #475569; padding: 0.1rem 0.3rem; border-radius: 3px; margin: 0.1rem; }
  .td-desc { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #334155; }
  .tabla-avance { display: flex; align-items: center; gap: 0.3rem; }
  .tabla-pct { font-size: 0.65rem; font-weight: 700; color: #475569; }
  .td-enlace { font-size: 0.75rem; color: #0d9488; font-weight: 600; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .td-encargado { font-size: 0.75rem; color: #64748b; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .td-fecha { font-size: 0.7rem; color: #94a3b8; white-space: nowrap; }
  .tabla-detail-btn { background: none; border: none; color: #2563eb; font-weight: 600; cursor: pointer; font-size: 0.75rem; white-space: nowrap; }
  .tabla-detail-btn:hover { text-decoration: underline; }
  .empty-table { text-align: center; padding: 2rem; color: #94a3b8; }

  @media (max-width: 768px) {
    .kanban-column { width: 220px; min-width: 220px; }
    .detail-panel { width: 100vw; max-width: 100vw; }
  }
</style>
