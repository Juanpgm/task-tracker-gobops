<script lang="ts">
  /**
   * Banner global de "hay una versión nueva" — antes esto solo se indicaba
   * con un puntito discreto en el ícono de configuración de Home.svelte, que
   * además desaparecía en cualquier otra vista (Avanzadas, DetalleAvanzada,
   * etc.). Un usuario que entra directo a trabajar y nunca vuelve a Home
   * podía quedarse horas ejecutando JS viejo sin ninguna señal, viendo
   * comportamiento ya corregido en producción como si el bug siguiera vivo.
   */
  import { slide } from 'svelte/transition';
  import { pwaStore } from '../stores/pwaStore';

  let actualizando = false;

  async function actualizar() {
    if (!$pwaStore.updateSW || actualizando) return;
    actualizando = true;
    await $pwaStore.updateSW(true);
  }
</script>

{#if $pwaStore.needRefresh}
  <div class="update-banner-container" transition:slide={{ duration: 300 }}>
    <div class="update-banner">
      <span class="update-icon">⬆️</span>
      <span class="update-text">Hay una versión nueva de la app disponible.</span>
      <button class="update-btn" on:click={actualizar} disabled={actualizando}>
        {actualizando ? 'Actualizando…' : 'Actualizar ahora'}
      </button>
    </div>
  </div>
{/if}

<style>
  .update-banner-container {
    width: 100%;
    position: sticky;
    top: 0;
    z-index: 200;
    padding: 0.35rem 1rem;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    background: transparent;
  }
  .update-banner {
    max-width: 600px;
    width: 100%;
    background: rgba(37, 99, 235, 0.92);
    color: #fff;
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 0.5rem 0.75rem;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    font-size: 0.825rem;
  }
  .update-text {
    font-weight: 600;
  }
  .update-btn {
    background: #fff;
    color: #1e3a8a;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
  }
  .update-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .update-btn:hover:not(:disabled) {
    background: #f1f5f9;
  }
</style>
