<script lang="ts">
  /**
   * Test-only stand-in for shared/LocationPicker.svelte, used by
   * RegistrarAvanzada.test.ts via vi.mock so behavioral tests don't have to
   * drive a real Leaflet map / navigator.geolocation in jsdom. LocationPicker
   * itself is out of scope here — RegistrarAvanzada only cares that it can
   * read back whatever latitud/longitud/direccion the picker produces, and
   * that it can react to the "change" event's comunaGeo/barrioGeo payload.
   */
  import { createEventDispatcher } from "svelte";

  export let latitud = "";
  export let longitud = "";
  export let direccion = "";
  export let error = "";

  const dispatch = createEventDispatcher<{
    change: { latitud: string; longitud: string; direccion: string; comunaGeo?: string; barrioGeo?: string };
  }>();
</script>

<div data-testid="location-picker-stub">
  <button
    type="button"
    on:click={() => {
      latitud = "3.45160000";
      longitud = "-76.53200000";
      direccion = "Calle Falsa 123";
    }}
  >
    Set fake location
  </button>
  <button
    type="button"
    on:click={() => {
      latitud = "3.45160000";
      longitud = "-76.53200000";
      direccion = "";
    }}
  >
    Set fake coordinates without direccion
  </button>
  <button
    type="button"
    on:click={() => {
      latitud = "3.45160000";
      longitud = "-76.53200000";
      direccion = "Calle Falsa 123";
      dispatch("change", { latitud, longitud, direccion, comunaGeo: "comuna 3", barrioGeo: "peñón" });
    }}
  >
    Set fake location with geo match
  </button>
  {#if error}
    <span class="stub-error">{error}</span>
  {/if}
</div>
