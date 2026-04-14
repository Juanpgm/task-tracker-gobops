<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let label = "";
  export let id = "";
  export let value = "";
  export let required = false;
  export let disabled = false;
  export let options: { value: string; label: string }[] = [];
  export let placeholder = "Buscar...";

  const dispatch = createEventDispatcher();

  let search = "";
  let open = false;
  let containerEl: HTMLDivElement;

  $: filtered = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()),
      )
    : options;

  $: selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  function select(opt: { value: string; label: string }) {
    value = opt.value;
    search = "";
    open = false;
    dispatch("change", opt.value);
  }

  function handleInput() {
    open = true;
  }

  function handleFocus() {
    search = "";
    open = true;
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      open = false;
      search = "";
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      open = false;
      search = "";
    }
  }

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  });
</script>

<div class="searchable-select" bind:this={containerEl}>
  {#if label}
    <label for={id} class="select-label">
      {label}
      {#if required}<span class="req">*</span>{/if}
    </label>
  {/if}
  <input
    {id}
    type="text"
    class="search-input"
    class:has-value={!!value}
    {disabled}
    placeholder={value ? selectedLabel : placeholder}
    bind:value={search}
    on:input={handleInput}
    on:focus={handleFocus}
    on:keydown={handleKeydown}
    autocomplete="off"
  />
  {#if value && !open}
    <button
      type="button"
      class="clear-btn"
      on:click={() => {
        value = "";
        search = "";
        dispatch("change", "");
      }}
      aria-label="Limpiar selección">&times;</button
    >
  {/if}
  {#if open}
    <ul class="dropdown" role="listbox">
      {#if filtered.length === 0}
        <li class="no-results">Sin resultados</li>
      {:else}
        {#each filtered as opt (opt.value)}
          <li role="option" aria-selected={opt.value === value}>
            <button
              type="button"
              class="option"
              class:selected={opt.value === value}
              on:click={() => select(opt)}
            >
              {opt.label}
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</div>

<style>
  .searchable-select {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .select-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }
  .req {
    color: var(--error, #e53e3e);
  }
  .search-input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: var(--radius-md, 8px);
    font-size: 0.9375rem;
    font-family: inherit;
    color: var(--text);
    background: var(--surface, #fff);
    box-sizing: border-box;
  }
  .search-input.has-value::placeholder {
    color: var(--text);
    opacity: 1;
  }
  .search-input:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }
  .clear-btn {
    position: absolute;
    right: 0.5rem;
    bottom: 0.55rem;
    background: none;
    border: none;
    font-size: 1.15rem;
    color: var(--text-muted, #94a3b8);
    cursor: pointer;
    padding: 0 0.25rem;
    line-height: 1;
  }
  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #e2e8f0);
    border-radius: var(--radius-md, 8px);
    max-height: 220px;
    overflow-y: auto;
    z-index: 200;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .option {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    background: none;
    border: none;
    font-family: inherit;
    font-size: 0.9375rem;
    color: var(--text);
    cursor: pointer;
  }
  .option:hover {
    background: var(--bg-hover, #f1f5f9);
  }
  .option.selected {
    background: var(--primary, #3b82f6);
    color: #fff;
  }
  .no-results {
    padding: 0.75rem;
    text-align: center;
    color: var(--text-muted, #94a3b8);
    font-size: 0.875rem;
  }
</style>
