<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let label = "";
  export let id = "";
  export let value: string[] = [];
  export let required = false;
  export let disabled = false;
  export let error = "";
  export let options: string[] = [];
  /** Entries that came from auto-classification — rendered with a "sugerido" badge when selected/listed. */
  export let suggested: string[] = [];
  export let placeholder = "Escribe para buscar...";

  const dispatch = createEventDispatcher();

  let search = "";
  let open = false;
  let containerEl: HTMLDivElement;

  $: filtered = (
    search ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase())) : options
  ).filter((o) => !value.includes(o));

  function toggle(opt: string) {
    value = value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt];
    search = "";
    dispatch("change", value);
  }

  function remove(opt: string) {
    value = value.filter((v) => v !== opt);
    dispatch("change", value);
  }

  function handleFocus() {
    if (!disabled) open = true;
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

<div class="multiselect" bind:this={containerEl}>
  {#if label}
    <label for={id} class="ms-label">
      {label}
      {#if required}<span class="req">*</span>{/if}
    </label>
  {/if}

  {#if value.length > 0}
    <div class="chips-row">
      {#each value as opt (opt)}
        <span class="chip" class:chip-suggested={suggested.includes(opt)}>
          {opt}
          {#if suggested.includes(opt)}<span class="chip-badge">sugerido</span>{/if}
          <button
            type="button"
            class="chip-remove"
            on:click={() => remove(opt)}
            aria-label="Quitar {opt}"
          >&times;</button>
        </span>
      {/each}
    </div>
  {/if}

  <input
    {id}
    {disabled}
    type="text"
    class="ms-input"
    class:has-error={!!error}
    {placeholder}
    bind:value={search}
    on:focus={handleFocus}
    on:input={() => (open = true)}
    on:keydown={handleKeydown}
    autocomplete="off"
  />

  {#if open}
    <div class="dropdown">
      <ul class="options-list" role="listbox">
        {#if filtered.length === 0}
          <li class="no-results">Sin resultados</li>
        {:else}
          {#each filtered as opt (opt)}
            <li role="option" aria-selected="false">
              <button type="button" class="option" on:click={() => toggle(opt)}>
                {opt}
                {#if suggested.includes(opt)}<span class="option-badge">sugerido</span>{/if}
              </button>
            </li>
          {/each}
        {/if}
      </ul>
      <div class="dropdown-footer">
        <button type="button" class="accept-btn" on:click={() => { open = false; search = ''; }}>
          Aceptar
        </button>
      </div>
    </div>
  {/if}

  {#if error}
    <span class="error-text">{error}</span>
  {/if}
</div>

<style>
  .multiselect {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  .ms-label {
    font-size: var(--fs-base);
    font-weight: 600;
    color: var(--text);
  }
  .req {
    color: var(--error);
  }
  .ms-input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: var(--fs-lg);
    font-family: inherit;
    color: var(--text);
    background: var(--surface);
    box-sizing: border-box;
  }
  .ms-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }
  .ms-input:disabled {
    background: var(--bg);
    cursor: not-allowed;
  }
  .has-error {
    border-color: var(--error);
  }
  .error-text {
    font-size: var(--fs-sm);
    color: var(--error);
  }

  .chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.6rem;
    border-radius: var(--radius-pill);
    background: var(--primary-light);
    color: var(--primary-darker);
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .chip-suggested {
    background: #fef3c7;
    color: #92400e;
  }
  .chip-badge {
    font-size: var(--fs-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.8;
  }
  .chip-remove {
    background: none;
    border: none;
    color: inherit;
    font-size: 0.9rem;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin: 0.25rem 0 0;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    z-index: 200;
    box-shadow: var(--shadow-lg, 0 4px 12px rgba(0, 0, 0, 0.15));
    overflow: hidden;
  }
  .options-list {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 240px;
    overflow-y: auto;
  }
  .dropdown-footer {
    display: flex;
    justify-content: flex-end;
    padding: 0.4rem;
    border-top: 1px solid var(--border);
    background: var(--bg);
  }
  .accept-btn {
    padding: 0.35rem 0.9rem;
    border: none;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: #fff;
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .accept-btn:hover {
    filter: brightness(0.95);
  }
  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    background: none;
    border: none;
    font-family: inherit;
    font-size: var(--fs-base);
    color: var(--text);
    cursor: pointer;
  }
  .option:hover {
    background: var(--bg);
  }
  .option-badge {
    flex-shrink: 0;
    font-size: var(--fs-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #92400e;
    background: #fef3c7;
    padding: 0.05rem 0.4rem;
    border-radius: var(--radius-sm);
  }
  .no-results {
    padding: 0.75rem;
    text-align: center;
    color: var(--text-muted);
    font-size: var(--fs-base);
  }
</style>
