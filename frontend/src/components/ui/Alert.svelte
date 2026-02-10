<script lang="ts">
  export let type: 'success' | 'error' | 'warning' | 'info' = 'info';
  export let message = '';
  export let dismissible = true;

  let visible = true;

  function dismiss() {
    visible = false;
  }
</script>

{#if visible && message}
  <div class="alert alert-{type}" role="alert">
    <span class="alert-message">{message}</span>
    {#if dismissible}
      <button class="alert-dismiss" on:click={dismiss} aria-label="Cerrar">×</button>
    {/if}
  </div>
{/if}

<style>
  .alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    gap: 0.5rem;
  }
  .alert-success { background: var(--success-light); color: var(--success); border: 1px solid var(--success); }
  .alert-error { background: var(--error-light); color: var(--error); border: 1px solid var(--error); }
  .alert-warning { background: var(--warning-light); color: var(--warning); border: 1px solid var(--warning); }
  .alert-info { background: var(--info-light); color: var(--info); border: 1px solid var(--info); }
  .alert-message { flex: 1; }
  .alert-dismiss {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
    line-height: 1;
    padding: 0;
  }
</style>
