<script lang="ts">
  // Generic empty stand-in for components with heavy/unrelated
  // dependencies, used by vi.mock() in tests that don't need the real
  // component's internals — only that it renders without crashing.
  // `show` mirrors the real components' bind:show prop so callers don't
  // need special-casing; rendered into a hidden node so it isn't flagged
  // as an unused export.
  export let show = false;
</script>

<span hidden>{show}</span>
