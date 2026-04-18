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
    border-radius: var(--radius-lg);
    font-size: 0.85rem;
    font-weight: 500;
    gap: 0.5rem;
  }
  .alert-success { background: var(--success-light); color: #15803d; border: 1px solid #bbf7d0; }
  .alert-error { background: var(--error-light); color: #b91c1c; border: 1px solid #fca5a5; }
  .alert-warning { background: var(--warning-light); color: #92400e; border: 1px solid #fde68a; }
  .alert-info { background: var(--info-light); color: #0e7490; border: 1px solid #a5f3fc; }
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
