<script lang="ts">
  export let padding: 'sm' | 'md' | 'lg' = 'md';
  export let shadow = true;
</script>

<div class="card card-{padding}" class:shadow>
  <slot />
</div>

<style>
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }
  .shadow { box-shadow: var(--shadow-sm); }
  .card-sm { padding: var(--space-sm); }
  .card-md { padding: var(--space-md); }
  .card-lg { padding: var(--space-lg); }
</style>
