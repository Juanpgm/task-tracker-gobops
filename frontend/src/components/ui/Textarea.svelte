<script lang="ts">
  export let label = '';
  export let id = '';
  export let placeholder = '';
  export let value = '';
  export let required = false;
  export let disabled = false;
  export let rows = 3;
  export let error = '';
</script>

<div class="textarea-group">
  {#if label}
    <label for={id} class="textarea-label">
      {label}
      {#if required}<span class="required">*</span>{/if}
    </label>
  {/if}
  <textarea
    {id}
    {placeholder}
    {required}
    {disabled}
    {rows}
    bind:value
    class="textarea"
    class:has-error={!!error}
    on:input
    on:change
    on:blur
    {...$$restProps}
  ></textarea>
  {#if error}
    <span class="error-text">{error}</span>
  {/if}
</div>

<style>
  .textarea-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .textarea-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }
  .required { color: var(--error); }
  .textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 0.9375rem;
    font-family: inherit;
    color: var(--text);
    background: var(--surface);
    resize: vertical;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }
  .textarea:disabled {
    background: var(--bg);
    cursor: not-allowed;
  }
  .has-error { border-color: var(--error); }
  .error-text {
    font-size: 0.8125rem;
    color: var(--error);
  }
</style>
