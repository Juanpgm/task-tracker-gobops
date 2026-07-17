<script lang="ts">
  // Test-only wrapper so ViewHeader.test.ts can verify the named "action"
  // slot renders — @testing-library/svelte's render() doesn't accept named
  // slot content directly, so this composes it the way a real view would.
  import ViewHeader from "../ViewHeader.svelte";
</script>

<ViewHeader title="Avanzadas">
  <svelte:fragment slot="action">
    <button type="button">+ Nueva avanzada</button>
  </svelte:fragment>
</ViewHeader>
