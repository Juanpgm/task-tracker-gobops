<script lang="ts">
  /**
   * Shared sticky header for every view: back affordance + title (+ optional
   * icon/subtitle) + an optional right-side action slot. Replaces ~15
   * hand-copied `.view-header` blocks that had drifted in back labels,
   * destinations, padding, z-index and color (see design-system pass).
   *
   * Back behavior defaults to navigationStore.back() — real history-stack
   * navigation. Pass `onBack` to override for views whose "up" destination
   * is a fixed parent regardless of how the user arrived (e.g. a detail view
   * that should always return to its list).
   */
  import { navigationStore } from "../../stores/navigationStore";
  import Icon from "./Icon.svelte";

  export let title: string;
  export let icon: string | undefined = undefined;
  export let subtitle: string | undefined = undefined;
  export let backLabel: string = "Volver";
  export let onBack: (() => void) | undefined = undefined;

  function handleBack() {
    if (onBack) onBack();
    else navigationStore.back();
  }
</script>

<header class="view-header">
  <button type="button" class="view-header__back" on:click={handleBack}>
    ← {backLabel}
  </button>

  <div class="view-header__titlewrap">
    <h2 class="view-header__title">
      {#if icon}<Icon name={icon} size={20} />{/if}
      <span>{title}</span>
    </h2>
    {#if subtitle}
      <p class="view-header__subtitle">{subtitle}</p>
    {/if}
  </div>

  <div class="view-header__action">
    <slot name="action" />
  </div>
</header>

<style>
  .view-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 0 var(--space-md);
    min-height: var(--header-h);
    display: flex;
    align-items: center;
    gap: var(--space-md);
    position: sticky;
    top: 0;
    z-index: 100;
    flex-wrap: wrap;
  }
  .view-header__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    background: none;
    border: none;
    color: var(--primary);
    font-size: var(--fs-base);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    padding: 0.5rem 0.25rem;
    min-height: var(--tap-min);
    border-radius: var(--radius-sm);
  }
  .view-header__back:hover {
    background: var(--surface-alt);
  }
  .view-header__back:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .view-header__titlewrap {
    flex: 1;
    min-width: 0;
  }
  .view-header__title {
    font-size: var(--fs-xl);
    font-weight: 700;
    color: var(--text-strong);
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }
  .view-header__title span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .view-header__subtitle {
    font-size: var(--fs-sm);
    color: var(--text-secondary);
    margin-top: 0.1rem;
  }
  .view-header__action {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .view-header__action:empty {
    display: none;
  }
</style>
