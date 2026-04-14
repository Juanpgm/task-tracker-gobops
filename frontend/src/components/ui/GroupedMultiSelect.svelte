<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let label = "";
  export let id = "";
  export let placeholder = "Buscar...";
  export let disabled = false;
  export let required = false;

  /** All options grouped by category */
  export let groups: { category: string; items: GroupItem[] }[] = [];

  /** Currently selected item IDs */
  export let selected: string[] = [];

  interface GroupItem {
    id: string;
    label: string;
    sublabel?: string;
  }

  const dispatch = createEventDispatcher();

  const PALETTE = [
    "#2563eb",
    "#d97706",
    "#059669",
    "#dc2626",
    "#7c3aed",
    "#db2777",
    "#0891b2",
    "#65a30d",
    "#ea580c",
    "#4f46e5",
    "#0d9488",
    "#b91c1c",
    "#9333ea",
    "#c026d3",
    "#0284c7",
    "#ca8a04",
    "#16a34a",
    "#e11d48",
    "#6d28d9",
    "#0e7490",
  ];

  $: categoryColors = (() => {
    const map = new Map<string, string>();
    groups.forEach((g, i) => map.set(g.category, PALETTE[i % PALETTE.length]));
    return map;
  })();

  $: itemCategoryMap = (() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      for (const item of g.items) map.set(item.id, g.category);
    }
    return map;
  })();

  $: selectedCategorySummary = (() => {
    const counts = new Map<string, number>();
    for (const id of selected) {
      const cat = itemCategoryMap.get(id);
      if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, count]) => ({
        category,
        count,
        color: categoryColors.get(category) ?? PALETTE[0],
      }));
  })();

  let search = "";
  let open = false;
  let containerEl: HTMLDivElement;

  $: filteredGroups = groups
    .map((g) => ({
      category: g.category,
      items: search
        ? g.items.filter(
            (i) =>
              i.label.toLowerCase().includes(search.toLowerCase()) ||
              (i.sublabel &&
                i.sublabel.toLowerCase().includes(search.toLowerCase())) ||
              g.category.toLowerCase().includes(search.toLowerCase()),
          )
        : g.items,
    }))
    .filter((g) => g.items.length > 0);

  $: allItems = groups.flatMap((g) => g.items);
  $: selectedItems = allItems.filter((i) => selected.includes(i.id));

  function toggle(itemId: string) {
    if (selected.includes(itemId)) {
      selected = selected.filter((s) => s !== itemId);
    } else {
      selected = [...selected, itemId];
    }
    dispatch("change", selected);
  }

  function remove(itemId: string) {
    selected = selected.filter((s) => s !== itemId);
    dispatch("change", selected);
  }

  function handleFocus() {
    open = true;
  }

  function handleInput() {
    open = true;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      open = false;
      search = "";
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      open = false;
      search = "";
    }
  }

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  });
</script>

<div class="grouped-multi-select" bind:this={containerEl}>
  {#if label}
    <label for={id} class="select-label">
      {label}
      {#if required}<span class="req">*</span>{/if}
    </label>
  {/if}

  {#if selectedItems.length > 0}
    <div class="chips">
      {#each selectedItems as item (item.id)}
        {@const cat = itemCategoryMap.get(item.id) ?? ""}
        {@const color = categoryColors.get(cat) ?? PALETTE[0]}
        <span class="chip" style="background:{color}">
          <span class="chip-cat">{cat}</span>
          <span class="chip-name">{item.label}</span>
          <button
            type="button"
            class="chip-remove"
            on:click={() => remove(item.id)}
            aria-label="Quitar {item.label}">&times;</button
          >
        </span>
      {/each}
    </div>
  {/if}

  <input
    {id}
    type="text"
    class="search-input"
    {disabled}
    {placeholder}
    bind:value={search}
    on:input={handleInput}
    on:focus={handleFocus}
    on:keydown={handleKeydown}
    autocomplete="off"
  />

  {#if open}
    <ul class="dropdown" role="listbox">
      {#if filteredGroups.length === 0}
        <li class="no-results">Sin resultados</li>
      {:else}
        {#each filteredGroups as group (group.category)}
          {@const hdrColor = categoryColors.get(group.category) ?? PALETTE[0]}
          <li class="group-header" style="border-left:4px solid {hdrColor}">
            <span class="group-dot" style="background:{hdrColor}"></span>
            {group.category}
          </li>
          {#each group.items as item (item.id)}
            <li role="option" aria-selected={selected.includes(item.id)}>
              <button
                type="button"
                class="option"
                class:selected={selected.includes(item.id)}
                on:click={() => toggle(item.id)}
              >
                <span
                  class="checkbox"
                  class:checked={selected.includes(item.id)}
                >
                  {#if selected.includes(item.id)}✓{/if}
                </span>
                <span class="option-text">
                  <span class="option-label">{item.label}</span>
                  {#if item.sublabel}
                    <span class="option-sublabel">{item.sublabel}</span>
                  {/if}
                </span>
              </button>
            </li>
          {/each}
        {/each}
      {/if}
    </ul>
  {/if}

  {#if selectedCategorySummary.length > 0}
    <div class="summary">
      <span class="summary-title"
        >Centros gestores en la visita ({selectedCategorySummary.length}):</span
      >
      <div class="summary-tags">
        {#each selectedCategorySummary as s (s.category)}
          <span class="summary-tag" style="background:{s.color}">
            {s.category}
            <span class="summary-count">{s.count}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .grouped-multi-select {
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
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.25rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #fff;
    font-size: 0.8125rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    white-space: nowrap;
    max-width: 100%;
  }
  .chip-cat {
    font-size: 0.7rem;
    opacity: 0.85;
    font-weight: 600;
    border-right: 1px solid rgba(255, 255, 255, 0.35);
    padding-right: 0.35rem;
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chip-name {
    font-weight: 500;
  }
  .chip-remove {
    background: none;
    border: none;
    color: #fff;
    font-size: 0.95rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    opacity: 0.8;
  }
  .chip-remove:hover {
    opacity: 1;
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
  .search-input:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
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
    max-height: 280px;
    overflow-y: auto;
    z-index: 200;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .group-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted, #64748b);
    background: var(--bg, #f8fafc);
    border-bottom: 1px solid var(--border, #e2e8f0);
    position: sticky;
    top: 0;
  }
  .group-dot {
    display: inline-block;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.45rem 0.75rem;
    text-align: left;
    background: none;
    border: none;
    font-family: inherit;
    font-size: 0.9rem;
    color: var(--text);
    cursor: pointer;
  }
  .option:hover {
    background: var(--bg-hover, #f1f5f9);
  }
  .option.selected {
    background: rgba(59, 130, 246, 0.08);
  }
  .checkbox {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    border: 2px solid var(--border, #cbd5e1);
    border-radius: 3px;
    font-size: 0.7rem;
    flex-shrink: 0;
    color: #fff;
  }
  .checkbox.checked {
    background: var(--primary, #3b82f6);
    border-color: var(--primary, #3b82f6);
  }
  .option-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .option-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .option-sublabel {
    font-size: 0.75rem;
    color: var(--text-muted, #94a3b8);
  }
  .no-results {
    padding: 0.75rem;
    text-align: center;
    color: var(--text-muted, #94a3b8);
    font-style: italic;
  }
  /* Summary */
  .summary {
    margin-top: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: var(--bg, #f8fafc);
    border: 1px solid var(--border, #e2e8f0);
    border-radius: var(--radius-md, 8px);
  }
  .summary-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted, #64748b);
    display: block;
    margin-bottom: 0.35rem;
  }
  .summary-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .summary-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #fff;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
  }
  .summary-count {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 999px;
    padding: 0 0.35rem;
    font-size: 0.7rem;
    font-weight: 700;
    min-width: 1rem;
    text-align: center;
  }
</style>
