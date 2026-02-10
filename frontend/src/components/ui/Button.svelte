<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let loading = false;
  export let fullWidth = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
</script>

<button
  {type}
  {disabled}
  class="btn btn-{variant} btn-{size}"
  class:full-width={fullWidth}
  class:loading
  on:click
  {...$$restProps}
>
  {#if loading}
    <span class="btn-spinner"></span>
  {/if}
  <slot />
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    line-height: 1;
    white-space: nowrap;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Sizes */
  .btn-sm { padding: 0.5rem 0.75rem; font-size: 0.8125rem; }
  .btn-md { padding: 0.625rem 1.25rem; font-size: 0.9375rem; }
  .btn-lg { padding: 0.75rem 1.5rem; font-size: 1.0625rem; }

  /* Variants */
  .btn-primary { background: var(--primary); color: white; }
  .btn-primary:hover:not(:disabled) { background: var(--primary-dark); }

  .btn-secondary { background: var(--border); color: var(--text); }
  .btn-secondary:hover:not(:disabled) { background: #cbd5e1; }

  .btn-danger { background: var(--error); color: white; }
  .btn-danger:hover:not(:disabled) { background: #b91c1c; }

  .btn-success { background: var(--success); color: white; }
  .btn-success:hover:not(:disabled) { background: #15803d; }

  .btn-ghost { background: transparent; color: var(--primary); }
  .btn-ghost:hover:not(:disabled) { background: var(--primary-light); }

  .full-width { width: 100%; }

  /* Loading spinner */
  .btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  .btn-secondary .btn-spinner {
    border-color: rgba(0,0,0,0.2);
    border-top-color: var(--text);
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
