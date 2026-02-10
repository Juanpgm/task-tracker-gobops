<script lang="ts">
  import { onMount } from 'svelte';
  import { navigationStore } from '../../stores/navigationStore';
  import { getReportes, eliminarReporte } from '../../api/visitas';
  import type { Reporte } from '../../types';
  import Button from '../ui/Button.svelte';
  import Alert from '../ui/Alert.svelte';
  import Card from '../ui/Card.svelte';
  import Modal from '../ui/Modal.svelte';

  let loading = false;
  let reportes: Reporte[] = [];
  let errorMsg = '';
  let successMsg = '';
  let showDeleteModal = false;
  let deleteTarget: Reporte | null = null;
  let deleting = false;

  onMount(loadReportes);

  async function loadReportes() {
    loading = true;
    errorMsg = '';
    try {
      reportes = await getReportes();
    } catch (err) {
      errorMsg = 'Error al cargar los reportes.';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  function confirmDelete(reporte: Reporte) {
    deleteTarget = reporte;
    showDeleteModal = true;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    deleting = true;
    errorMsg = '';
    successMsg = '';
    try {
      await eliminarReporte(deleteTarget.reporte_id);
      successMsg = 'Reporte eliminado exitosamente.';
      reportes = reportes.filter((r) => r.reporte_id !== deleteTarget!.reporte_id);
      showDeleteModal = false;
      deleteTarget = null;
    } catch (err) {
      errorMsg = 'Error al eliminar el reporte.';
      console.error(err);
    } finally {
      deleting = false;
    }
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.goHome()}>← Volver</button>
    <h2 class="view-title">📊 Reportes</h2>
    <Button variant="ghost" size="sm" on:click={loadReportes} disabled={loading}>
      🔄 Actualizar
    </Button>
  </header>

  <main class="view-body container">
    {#if successMsg}
      <Alert type="success" message={successMsg} />
    {/if}
    {#if errorMsg}
      <Alert type="error" message={errorMsg} />
    {/if}

    {#if loading}
      <div class="spinner"></div>
    {:else if reportes.length === 0}
      <Card padding="lg">
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <p class="empty-text">No hay reportes disponibles</p>
          <Button variant="secondary" size="sm" on:click={loadReportes}>
            Reintentar
          </Button>
        </div>
      </Card>
    {:else}
      <div class="reportes-list">
        {#each reportes as reporte (reporte.reporte_id)}
          <Card padding="md">
            <div class="reporte-item">
              <div class="reporte-info">
                <span class="reporte-id">#{reporte.reporte_id}</span>
                <h3 class="reporte-title">{reporte.nombre_up || 'Sin título'}</h3>
                {#if reporte.nombre_up_detalle}
                  <p class="reporte-detail">{reporte.nombre_up_detalle}</p>
                {/if}
                <div class="reporte-meta">
                  {#if reporte.barrio_vereda}
                    <span class="meta-tag">📍 {reporte.barrio_vereda}</span>
                  {/if}
                  {#if reporte.comuna_corregimiento}
                    <span class="meta-tag">🏘️ {reporte.comuna_corregimiento}</span>
                  {/if}
                  {#if reporte.fecha_visita}
                    <span class="meta-tag">📅 {reporte.fecha_visita}</span>
                  {/if}
                </div>
              </div>
              <Button variant="danger" size="sm" on:click={() => confirmDelete(reporte)}>
                🗑️
              </Button>
            </div>
          </Card>
        {/each}
      </div>

      <p class="reportes-count">{reportes.length} reporte{reportes.length === 1 ? '' : 's'}</p>
    {/if}
  </main>

  <!-- Delete Confirmation Modal -->
  <Modal bind:show={showDeleteModal} title="Confirmar Eliminación">
    <p>¿Está seguro de que desea eliminar el reporte <strong>#{deleteTarget?.reporte_id}</strong>?</p>
    <p class="delete-warning">Esta acción no se puede deshacer.</p>
    <svelte:fragment slot="footer">
      <Button variant="secondary" on:click={() => (showDeleteModal = false)}>
        Cancelar
      </Button>
      <Button variant="danger" on:click={handleDelete} loading={deleting} disabled={deleting}>
        {deleting ? 'Eliminando...' : 'Eliminar'}
      </Button>
    </svelte:fragment>
  </Modal>
</div>

<style>
  .view {
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bg);
  }
  .view-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: var(--space-md);
    display: flex;
    align-items: center;
    gap: var(--space-md);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .view-header .view-title {
    flex: 1;
  }
  .back-btn {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .back-btn:hover { text-decoration: underline; }
  .view-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text);
  }
  .view-body {
    padding-top: var(--space-lg);
    padding-bottom: var(--space-2xl);
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: var(--space-xl) 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }
  .empty-icon { font-size: 2.5rem; }
  .empty-text { color: var(--text-secondary); font-size: 0.9375rem; }

  /* Reportes list */
  .reportes-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .reporte-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-sm);
  }
  .reporte-info { flex: 1; min-width: 0; }
  .reporte-id {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--primary);
    background: var(--primary-light);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
  }
  .reporte-title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--text);
    margin-top: 0.375rem;
  }
  .reporte-detail {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 0.125rem;
  }
  .reporte-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.5rem;
  }
  .meta-tag {
    font-size: 0.75rem;
    color: var(--text-secondary);
    background: var(--bg);
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
  }
  .reportes-count {
    text-align: center;
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin-top: var(--space-md);
  }
  .delete-warning {
    color: var(--error);
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
</style>
