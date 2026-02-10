<script lang="ts">
  import { navigationStore } from '../../stores/navigationStore';
  import { seguimientoStore } from '../../stores/seguimientoStore';
  import type { VisitaProgramada } from '../../types/seguimiento';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';

  $: visitas = $seguimientoStore.visitas;
  $: requerimientos = $seguimientoStore.requerimientos;

  function getReqCount(visitaId: string): number {
    return requerimientos.filter((r) => r.visita_id === visitaId).length;
  }

  function getEstadoStyle(estado: VisitaProgramada['estado']): { bg: string; color: string; icon: string } {
    switch (estado) {
      case 'programada': return { bg: '#dbeafe', color: '#1e40af', icon: '📅' };
      case 'en-curso':   return { bg: '#fef3c7', color: '#92400e', icon: '🔄' };
      case 'finalizada': return { bg: '#dcfce7', color: '#166534', icon: '✅' };
      case 'cancelada':  return { bg: '#fee2e2', color: '#991b1b', icon: '❌' };
      default: return { bg: '#f1f5f9', color: '#475569', icon: '❓' };
    }
  }

  function irARequerimientos(visita: VisitaProgramada) {
    navigationStore.navigate('registrar-requerimiento-visita', { visitaId: visita.id });
  }

  function iniciarVisita(visitaId: string) {
    seguimientoStore.actualizarEstadoVisita(visitaId, 'en-curso');
  }

  function finalizarVisita(visitaId: string) {
    seguimientoStore.actualizarEstadoVisita(visitaId, 'finalizada');
  }

  function formatDate(d: string): string {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.goHome()}>← Volver</button>
    <h2 class="view-title">📋 Visitas Programadas</h2>
    <button class="add-btn" on:click={() => navigationStore.navigate('programar-visita')}>+ Nueva</button>
  </header>

  <main class="view-body container">
    {#if visitas.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📅</span>
        <h3>No hay visitas programadas</h3>
        <p>Programa tu primera visita seleccionando una unidad de proyecto.</p>
        <Button on:click={() => navigationStore.navigate('programar-visita')}>Programar Visita</Button>
      </div>
    {:else}
      {#each visitas as visita (visita.id)}
        {@const estilo = getEstadoStyle(visita.estado)}
        {@const reqCount = getReqCount(visita.id)}
        <div class="visita-card">
          <div class="visita-header">
            <div class="visita-estado" style="background: {estilo.bg}; color: {estilo.color};">
              {estilo.icon} {visita.estado.charAt(0).toUpperCase() + visita.estado.slice(1).replace('-', ' ')}
            </div>
            <span class="visita-fecha">{formatDate(visita.fecha_visita)}</span>
            {#if visita.hora_inicio}
              <span class="visita-hora">{visita.hora_inicio} - {visita.hora_fin}</span>
            {/if}
          </div>

          <div class="visita-body">
            <h3 class="visita-up-name">{visita.unidad_proyecto.nombre_up}</h3>
            <p class="visita-up-detail">{visita.unidad_proyecto.nombre_up_detalle} — {visita.unidad_proyecto.direccion}</p>

            <div class="visita-meta">
              <span class="meta-item">
                <strong>🏗️</strong> {visita.unidad_proyecto.tipo_equipamiento}
              </span>
              <span class="meta-item">
                <strong>📊</strong> Avance: {parseFloat(visita.unidad_proyecto.avance_obra || '0').toFixed(0)}%
              </span>
              <span class="meta-item">
                <strong>👥</strong> {visita.colaboradores.length} colaborador{visita.colaboradores.length !== 1 ? 'es' : ''}
              </span>
              <span class="meta-item req-count" class:has-reqs={reqCount > 0}>
                <strong>📝</strong> {reqCount} requerimiento{reqCount !== 1 ? 's' : ''}
              </span>
            </div>

            {#if visita.colaboradores.length > 0}
              <div class="col-avatars">
                {#each visita.colaboradores.slice(0, 5) as col}
                  <div class="avatar-sm" title={col.nombre}>{col.nombre.charAt(0)}</div>
                {/each}
                {#if visita.colaboradores.length > 5}
                  <div class="avatar-sm avatar-more">+{visita.colaboradores.length - 5}</div>
                {/if}
              </div>
            {/if}

            {#if visita.observaciones}
              <p class="visita-obs">💬 {visita.observaciones}</p>
            {/if}
          </div>

          <div class="visita-actions">
            {#if visita.estado === 'programada'}
              <Button variant="secondary" size="sm" on:click={() => iniciarVisita(visita.id)}>
                ▶️ Iniciar Visita
              </Button>
            {/if}
            {#if visita.estado === 'en-curso'}
              <Button variant="secondary" size="sm" on:click={() => finalizarVisita(visita.id)}>
                ✅ Finalizar
              </Button>
            {/if}
            <Button size="sm" on:click={() => irARequerimientos(visita)}>
              📝 Registrar Requerimientos
            </Button>
            {#if reqCount > 0}
              <Button variant="secondary" size="sm" on:click={() => navigationStore.navigate('kanban', { visitaId: visita.id })}>
                📊 Ver Kanban
              </Button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
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
  .add-btn {
    background: #2563eb; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px;
    font-size: 0.8rem; font-weight: 600; cursor: pointer;
  }
  .view-body { padding: 1rem; max-width: 900px; margin: 0 auto; }
  .container { display: flex; flex-direction: column; gap: 0.75rem; }

  .visita-card {
    background: white; border-radius: 10px; border: 1px solid #e2e8f0;
    overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: box-shadow 0.2s;
  }
  .visita-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

  .visita-header {
    display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 1rem;
    background: #f8fafc; border-bottom: 1px solid #f1f5f9;
  }
  .visita-estado { padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
  .visita-fecha { font-size: 0.8rem; font-weight: 600; color: #475569; }
  .visita-hora { font-size: 0.75rem; color: #94a3b8; }

  .visita-body { padding: 1rem; }
  .visita-up-name { font-size: 1.05rem; font-weight: 700; color: #1e293b; margin: 0; }
  .visita-up-detail { font-size: 0.8rem; color: #64748b; margin: 0.2rem 0 0.75rem; }

  .visita-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
  .meta-item { font-size: 0.75rem; color: #475569; background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px; }
  .req-count.has-reqs { background: #fef3c7; color: #92400e; }

  .col-avatars { display: flex; gap: -4px; margin-bottom: 0.5rem; }
  .avatar-sm {
    width: 28px; height: 28px; border-radius: 50%; background: #2563eb; color: white;
    display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700;
    border: 2px solid white; margin-left: -4px;
  }
  .avatar-sm:first-child { margin-left: 0; }
  .avatar-more { background: #94a3b8; }

  .visita-obs { font-size: 0.8rem; color: #64748b; font-style: italic; margin: 0.5rem 0 0; }

  .visita-actions { display: flex; gap: 0.5rem; padding: 0.75rem 1rem; border-top: 1px solid #f1f5f9; flex-wrap: wrap; }

  .empty-state { text-align: center; padding: 4rem 1rem; color: #64748b; }
  .empty-icon { font-size: 3rem; display: block; margin-bottom: 1rem; }
  .empty-state h3 { color: #1e293b; }
</style>
