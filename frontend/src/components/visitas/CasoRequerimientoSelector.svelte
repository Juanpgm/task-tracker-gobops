<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { CATALOGO_CASOS, CATEGORIAS_CASOS } from "../../data/requerimientos-catalogo";

  export let requerimiento = "";
  export let organismosJson = "[]";

  // ── Estado ────────────────────────────────────────────────────────────────
  let open = false;
  let query = "";
  let searchEl: HTMLInputElement;
  let containerEl: HTMLDivElement;

  let selectedIds: Set<string> = new Set();
  let otroSelected = false;
  let otroTexto = "";
  let organismoSelections: Record<string, boolean> = {};

  // ── Filtrado ──────────────────────────────────────────────────────────────
  $: q = query.toLowerCase().trim();

  // Lista plana filtrada, agrupada por categoría para renderizar cabeceras
  $: filtered = q
    ? CATALOGO_CASOS.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.categoria.toLowerCase().includes(q) ||
          c.subcategoria.toLowerCase().includes(q)
      )
    : CATALOGO_CASOS;

  // Agrupar filtered por categoría (manteniendo orden original)
  $: groups = (() => {
    const map = new Map<string, typeof CATALOGO_CASOS>();
    for (const cat of CATEGORIAS_CASOS) map.set(cat, []);
    for (const caso of filtered) {
      map.get(caso.categoria)?.push(caso);
    }
    // Solo categorías con resultados
    return [...map.entries()].filter(([, items]) => items.length > 0);
  })();

  $: showOtro = !q || "otro".includes(q);

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function openDropdown() {
    open = true;
    await tick();
    searchEl?.focus();
  }

  function closeDropdown() {
    open = false;
    query = "";
  }

  function toggleCaso(id: string) {
    const caso = CATALOGO_CASOS.find((c) => c.id === id);
    if (!caso) return;
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
      for (const org of caso.organismos) delete organismoSelections[`${id}||${org.organismo}`];
    } else {
      selectedIds.add(id);
      for (const org of caso.organismos) organismoSelections[`${id}||${org.organismo}`] = true;
    }
    selectedIds = new Set(selectedIds);
    organismoSelections = { ...organismoSelections };
  }

  function removeTag(id: string) {
    toggleCaso(id);
  }

  function removeOtro() {
    otroSelected = false;
    otroTexto = "";
  }

  function toggleOrganismo(key: string) {
    organismoSelections[key] = !organismoSelections[key];
    organismoSelections = { ...organismoSelections };
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeDropdown();
  }

  function handleClickOutside(e: MouseEvent) {
    if (open && containerEl && !containerEl.contains(e.target as Node)) closeDropdown();
  }

  onMount(() => document.addEventListener("mousedown", handleClickOutside));
  onDestroy(() => document.removeEventListener("mousedown", handleClickOutside));

  // ── Computed outputs ──────────────────────────────────────────────────────
  $: selectedCasos = CATALOGO_CASOS.filter((c) => selectedIds.has(c.id));
  $: totalSelected = selectedIds.size + (otroSelected ? 1 : 0);

  $: {
    const labels = selectedCasos.map((c) => c.label);
    if (otroSelected && otroTexto.trim()) labels.push(`Otro: ${otroTexto.trim()}`);
    else if (otroSelected) labels.push("Otro");
    requerimiento = labels.join("; ");

    const orgs: Array<{ organismo: string; caso: string; accion: string }> = [];
    for (const caso of selectedCasos)
      for (const org of caso.organismos)
        if (organismoSelections[`${caso.id}||${org.organismo}`])
          orgs.push({ organismo: org.organismo, caso: caso.label, accion: org.accion });
    organismosJson = JSON.stringify(orgs);
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="caso-selector" bind:this={containerEl} on:keydown={handleKeydown}>
  <div class="field-label">
    Descripción del Requerimiento <span class="required">*</span>
  </div>

  <!-- ── Control (trigger + tags) ──────────────────────────────────────── -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="control"
    class:open
    on:click={() => (open ? null : openDropdown())}
    role="combobox"
    aria-expanded={open}
    aria-haspopup="listbox"
    tabindex="0"
    on:keydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDropdown(); } }}
  >
    <!-- Tags de seleccionados -->
    {#if totalSelected > 0}
      <div class="tags">
        {#each selectedCasos as caso}
          <span class="tag">
            {caso.label}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <span class="tag-remove" on:click|stopPropagation={() => removeTag(caso.id)} role="button" tabindex="-1" aria-label="Quitar {caso.label}">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </span>
          </span>
        {/each}
        {#if otroSelected}
          <span class="tag tag-otro">
            {otroTexto.trim() ? `Otro: ${otroTexto.trim()}` : "Otro"}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <span class="tag-remove" on:click|stopPropagation={removeOtro} role="button" tabindex="-1" aria-label="Quitar Otro">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </span>
          </span>
        {/if}
      </div>
    {:else}
      <span class="placeholder">Buscar y seleccionar casos...</span>
    {/if}

    <span class="control-right">
      {#if totalSelected > 0}
        <span class="badge-count">{totalSelected}</span>
      {/if}
      <svg class="chevron" class:rotated={open} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </span>
  </div>

  <!-- ── Panel ──────────────────────────────────────────────────────────── -->
  {#if open}
    <div class="dropdown-panel" role="listbox" aria-multiselectable="true">
      <!-- Searchbar sticky -->
      <div class="search-wrap">
        <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          bind:this={searchEl}
          bind:value={query}
          type="text"
          class="search-input"
          placeholder="Buscar caso..."
          autocomplete="off"
          spellcheck="false"
        />
        {#if query}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <span class="search-clear" on:click={() => (query = "")} role="button" tabindex="-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </span>
        {/if}
      </div>

      <!-- Lista filtrada agrupada por categoría -->
      <div class="list">
        {#if groups.length === 0 && !showOtro}
          <div class="empty">Sin resultados para "{query}"</div>
        {/if}

        {#each groups as [cat, casos]}
          <div class="group-header">{cat}</div>
          {#each casos as caso}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
              class="list-item"
              class:selected={selectedIds.has(caso.id)}
              role="option"
              aria-selected={selectedIds.has(caso.id)}
              on:click={() => toggleCaso(caso.id)}
            >
              <span class="item-check" class:checked={selectedIds.has(caso.id)}>
                {#if selectedIds.has(caso.id)}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {/if}
              </span>
              <span class="item-label">{caso.label}</span>
            </div>
          {/each}
        {/each}

        <!-- Opción "Otro" -->
        {#if showOtro}
          <div class="group-header otro-sep">Otros</div>
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div
            class="list-item"
            class:selected={otroSelected}
            role="option"
            aria-selected={otroSelected}
            on:click={() => (otroSelected = !otroSelected)}
          >
            <span class="item-check" class:checked={otroSelected}>
              {#if otroSelected}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {/if}
            </span>
            <span class="item-label" style="font-style:italic">Otro</span>
          </div>
          {#if otroSelected}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div class="otro-input-wrap" on:click|stopPropagation>
              <input
                type="text"
                class="otro-input"
                bind:value={otroTexto}
                placeholder="Describa el caso u organismo..."
                maxlength="200"
              />
            </div>
          {/if}
        {/if}
      </div>

      <!-- Footer con acción de cierre -->
      <div class="panel-footer">
        <button type="button" class="done-btn" on:click={closeDropdown}>
          Listo {#if totalSelected > 0}· {totalSelected} seleccionado{totalSelected > 1 ? "s" : ""}{/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- ── Organismos (debajo del dropdown) ──────────────────────────────── -->
  {#if selectedCasos.length > 0}
    <div class="organismos-section">
      <div class="organismos-title">Organismos que pueden intervenir</div>
      {#each selectedCasos as caso}
        <div class="caso-org-group">
          <div class="caso-org-header">
            <span class="caso-badge">{caso.categoria}</span>
            {caso.label}
          </div>
          <div class="org-list">
            {#each caso.organismos as org}
              {@const key = `${caso.id}||${org.organismo}`}
              <label class="org-row" class:org-selected={organismoSelections[key]}>
                <input
                  type="checkbox"
                  checked={organismoSelections[key]}
                  class="org-checkbox"
                  on:change={() => toggleOrganismo(key)}
                />
                <div class="org-info">
                  <span class="org-nombre">{org.organismo}</span>
                  <span class="org-accion">{org.accion}</span>
                </div>
              </label>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .caso-selector {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    position: relative;
  }

  .field-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }

  .required { color: var(--error); }

  /* ── Control ─────────────────────────────────────────────────────────────── */
  .control {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    min-height: 2.5rem;
    padding: 0.4rem 0.625rem 0.4rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    outline: none;
  }

  .control:hover { border-color: var(--primary); }

  .control.open,
  .control:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-light);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    flex: 1;
    padding: 0.1rem 0;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.5rem;
    background: var(--primary-light);
    color: var(--primary-dark);
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tag-otro { background: #f1f5f9; color: var(--text-secondary); }

  .tag-remove {
    display: flex;
    align-items: center;
    cursor: pointer;
    opacity: 0.6;
    flex-shrink: 0;
  }

  .tag-remove:hover { opacity: 1; }

  .placeholder {
    flex: 1;
    align-self: center;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .control-right {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
    margin-left: auto;
    align-self: center;
  }

  .badge-count {
    background: var(--primary);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    line-height: 1.4;
  }

  .chevron {
    color: var(--text-secondary);
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .chevron.rotated { transform: rotate(180deg); }

  /* ── Panel ───────────────────────────────────────────────────────────────── */
  .dropdown-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 300;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    max-height: 380px;
  }

  /* ── Searchbar ───────────────────────────────────────────────────────────── */
  .search-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    flex-shrink: 0;
  }

  .search-icon { color: var(--text-muted); flex-shrink: 0; }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--text);
    outline: none;
  }

  .search-input::placeholder { color: var(--text-muted); }

  .search-clear {
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .search-clear:hover { color: var(--text); }

  /* ── Lista ───────────────────────────────────────────────────────────────── */
  .list {
    overflow-y: auto;
    overscroll-behavior: contain;
    flex: 1;
  }

  .empty {
    padding: 1rem 0.75rem;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: center;
  }

  .group-header {
    padding: 0.375rem 0.75rem 0.25rem;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    background: var(--bg);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .otro-sep { border-top: 1px dashed var(--border); margin-top: 0.25rem; }

  .list-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.45rem 0.75rem;
    cursor: pointer;
    transition: background 0.1s;
    user-select: none;
  }

  .list-item:hover { background: var(--bg); }
  .list-item.selected { background: var(--primary-light); }

  .item-check {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    border: 1.5px solid var(--border);
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    color: var(--primary);
    transition: border-color 0.1s, background 0.1s;
  }

  .item-check.checked {
    border-color: var(--primary);
    background: var(--primary);
    color: #fff;
  }

  .item-label {
    font-size: 0.875rem;
    color: var(--text);
    line-height: 1.4;
  }

  .list-item.selected .item-label {
    font-weight: 600;
    color: var(--primary-dark);
  }

  /* ── Input "Otro" ────────────────────────────────────────────────────────── */
  .otro-input-wrap {
    padding: 0.25rem 0.75rem 0.5rem 2.375rem;
  }

  .otro-input {
    width: 100%;
    padding: 0.375rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--text);
    background: var(--surface);
    outline: none;
    transition: border-color 0.15s;
  }

  .otro-input:focus { border-color: var(--primary); }

  /* ── Footer ──────────────────────────────────────────────────────────────── */
  .panel-footer {
    border-top: 1px solid var(--border);
    padding: 0.5rem 0.75rem;
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
    background: var(--surface);
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  .done-btn {
    padding: 0.35rem 0.875rem;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }

  .done-btn:hover { background: var(--primary-dark); }

  /* ── Organismos ──────────────────────────────────────────────────────────── */
  .organismos-section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.875rem;
    background: var(--surface);
  }

  .organismos-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text);
  }

  .caso-org-group { display: flex; flex-direction: column; gap: 0.375rem; }

  .caso-org-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text);
  }

  .caso-badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.125rem 0.4rem;
    border-radius: var(--radius-sm);
    background: var(--primary-light);
    color: var(--primary-dark);
    white-space: nowrap;
  }

  .org-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-left: 0.25rem;
  }

  .org-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
  }

  .org-row:hover { border-color: var(--primary); background: var(--primary-light); }
  .org-row.org-selected { border-color: var(--primary); background: var(--primary-light); }

  .org-checkbox {
    width: 1rem;
    height: 1rem;
    accent-color: var(--primary);
    flex-shrink: 0;
    cursor: pointer;
  }

  .org-info {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
    min-width: 0;
  }

  .org-nombre { font-size: 0.875rem; font-weight: 600; color: var(--text); }

  .org-accion { font-size: 0.8rem; color: var(--text-secondary); }
  .org-accion::before { content: "— "; }
</style>
