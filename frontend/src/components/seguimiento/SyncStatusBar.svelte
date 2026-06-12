<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { offlineStore } from '../../stores/offlineStore';
  import Icon from '../ui/Icon.svelte';

  let showSuccess = false;
  let prevPending = 0;

  // React to changes in pending count to show a success toast when sync completes
  $: {
    if ($offlineStore.pendingCount === 0 && prevPending > 0 && !$offlineStore.isSyncing && $offlineStore.isOnline) {
      showSuccess = true;
      setTimeout(() => {
        showSuccess = false;
      }, 4000);
    }
    prevPending = $offlineStore.pendingCount;
  }

  async function handleSync() {
    if ($offlineStore.isSyncing) return;
    await offlineStore.syncNow();
  }
</script>

{#if !$offlineStore.isOnline || $offlineStore.pendingCount > 0 || $offlineStore.isSyncing || showSuccess}
  <div class="sync-status-container" transition:slide={{ duration: 300 }}>
    <div class="sync-status-bar" class:offline={!$offlineStore.isOnline} class:syncing={$offlineStore.isSyncing} class:success={showSuccess && $offlineStore.pendingCount === 0}>
      <div class="sync-status-content">
        {#if $offlineStore.isSyncing}
          <span class="spinner-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
              <line x1="2" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="22" y2="12"></line>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
          </span>
          <span class="status-text">Sincronizando requerimientos con el servidor...</span>
        {:else if showSuccess && $offlineStore.pendingCount === 0}
          <span class="status-icon success-pulse">✓</span>
          <span class="status-text">¡Todo sincronizado correctamente!</span>
        {:else if !$offlineStore.isOnline}
          <span class="status-icon warning-pulse">⚠️</span>
          <span class="status-text">
            Modo offline activo. 
            {#if $offlineStore.pendingCount > 0}
              <strong>{$offlineStore.pendingCount}</strong> cambios guardados localmente.
            {:else}
              Los requerimientos nuevos se guardarán temporalmente en tu dispositivo.
            {/if}
          </span>
        {:else if $offlineStore.pendingCount > 0}
          <span class="status-icon warning-pulse">🔄</span>
          <span class="status-text">
            Tenés <strong>{$offlineStore.pendingCount}</strong> requerimientos pendientes por subir.
          </span>
          <button class="sync-btn" on:click={handleSync} disabled={$offlineStore.isSyncing}>
            Sincronizar ahora
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .sync-status-container {
    width: 100%;
    position: sticky;
    top: 57px; /* Matches header height to stick right under it */
    z-index: 99;
    padding: 0.35rem 1rem;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    background: transparent;
  }

  .sync-status-bar {
    max-width: 600px;
    width: 100%;
    background: rgba(59, 130, 246, 0.15); /* Sleek blue glassmorphism */
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #1e3a8a;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0.5rem 0.75rem;
    box-sizing: border-box;
  }

  .sync-status-bar.offline {
    background: rgba(245, 158, 11, 0.15); /* Vibrant orange/amber glassmorphism */
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #78350f;
  }

  .sync-status-bar.syncing {
    background: rgba(124, 58, 237, 0.12); /* Royal purple glassmorphism */
    border: 1px solid rgba(124, 58, 237, 0.3);
    color: #4c1d95;
  }

  .sync-status-bar.success {
    background: rgba(16, 185, 129, 0.15); /* harmonic green glassmorphism */
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #064e3b;
  }

  .sync-status-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.825rem;
    line-height: 1.4;
    text-align: center;
    flex-wrap: wrap;
  }

  .status-text {
    font-weight: 500;
  }

  .status-text strong {
    font-weight: 700;
  }

  .sync-btn {
    background: var(--primary, #2563eb);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    margin-left: 0.5rem;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
  }

  .sync-btn:hover {
    background: var(--primary-hover, #1d4ed8);
    transform: translateY(-1px);
  }

  .sync-btn:active {
    transform: translateY(0);
  }

  /* Animations */
  .spinner-icon {
    display: inline-flex;
    animation: rotate 1.5s linear infinite;
  }

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .warning-pulse {
    animation: pulse 2s infinite;
  }

  .success-pulse {
    font-weight: 800;
    animation: scale-up 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(0.95); }
  }

  @keyframes scale-up {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>
