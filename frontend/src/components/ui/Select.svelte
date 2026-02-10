<script lang="ts">
  export let label = '';
  export let id = '';
  export let value = '';
  export let required = false;
  export let disabled = false;
  export let error = '';
  export let options: { value: string; label: string }[] = [];
  export let placeholder = '-- Seleccione --';
</script>

<div class="select-group">
  {#if label}
    <label for={id} class="select-label">
      {label}
      {#if required}<span class="required">*</span>{/if}
    </label>
  {/if}
  <select
    {id}
    {required}
    {disabled}
    bind:value
    class="select"
    class:has-error={!!error}
    on:change
    on:blur
    {...$$restProps}
  >
    <option value="" disabled>{placeholder}</option>
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
  {#if error}
    <span class="error-text">{error}</span>
  {/if}
</div>

<style>
  .select-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .select-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }
  .required { color: var(--error); }
  .select {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 0.9375rem;
    font-family: inherit;
    color: var(--text);
    background: var(--surface);
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8.825L1.175 4 2.238 2.938 6 6.7 9.763 2.937 10.825 4z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    padding-right: 2rem;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }
  .select:disabled {
    background-color: var(--bg);
    cursor: not-allowed;
  }
  .has-error { border-color: var(--error); }
  .error-text {
    font-size: 0.8125rem;
    color: var(--error);
  }
</style>
