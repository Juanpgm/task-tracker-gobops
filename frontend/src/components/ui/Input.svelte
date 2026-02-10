<script lang="ts">
  import { onMount } from 'svelte';

  export let label = '';
  export let id = '';
  export let type: 'text' | 'email' | 'password' | 'tel' | 'number' | 'date' = 'text';
  export let placeholder = '';
  export let value = '';
  export let required = false;
  export let disabled = false;
  export let error = '';

  let inputEl: HTMLInputElement;

  onMount(() => {
    if (inputEl) inputEl.type = type;
  });

  function handleInput(e: Event) {
    value = (e.target as HTMLInputElement).value;
  }
</script>

<div class="input-group">
  {#if label}
    <label for={id} class="input-label">
      {label}
      {#if required}<span class="required">*</span>{/if}
    </label>
  {/if}
  <input
    bind:this={inputEl}
    {id}
    {placeholder}
    {required}
    {disabled}
    {value}
    class="input"
    class:has-error={!!error}
    on:input={handleInput}
    on:change
    on:blur
    {...$$restProps}
  />
  {#if error}
    <span class="error-text">{error}</span>
  {/if}
</div>

<style>
  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .input-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }
  .required { color: var(--error); }
  .input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 0.9375rem;
    font-family: inherit;
    color: var(--text);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }
  .input:disabled {
    background: var(--bg);
    cursor: not-allowed;
  }
  .has-error {
    border-color: var(--error);
  }
  .has-error:focus {
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
  }
  .error-text {
    font-size: 0.8125rem;
    color: var(--error);
  }
</style>
