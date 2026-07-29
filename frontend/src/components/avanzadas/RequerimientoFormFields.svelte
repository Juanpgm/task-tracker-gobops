<script lang="ts">
  /**
   * Un requerimiento (entidad(es) + categoría + texto + ubicación +
   * coordenadas), extraído de RegistrarAvanzada.svelte para reutilizarse
   * también en AgregarRequerimientoModal.svelte. GPS/fotos siguen siendo
   * responsabilidad del padre (estado y llamadas al geolocation lib) — este
   * componente sólo expone un slot "gps" junto al campo de coordenadas.
   */
  import { createEventDispatcher, onDestroy } from "svelte";
  import { getCategoriasParaEntidad } from "../../data/avanzadas-catalogo";
  import { clasificarRequerimiento } from "../../api/avanzadas";
  import MultiSelectOrganismos from "../ui/MultiSelectOrganismos.svelte";
  import Select from "../ui/Select.svelte";
  import Input from "../ui/Input.svelte";
  import Textarea from "../ui/Textarea.svelte";

  const OPCION_CATEGORIA_PERSONALIZADA = "__personalizada__";
  const CLASIFICAR_DEBOUNCE_MS = 500;
  const CLASIFICAR_MIN_LARGO = 8;

  export let idPrefix: string | number = "";
  export let entidades: string[] = [];
  export let categoria = "";
  export let usandoCategoriaPersonalizada = false;
  export let categoriaPersonalizadaTexto = "";
  export let requerimiento = "";
  export let ubicacion = "";
  export let coordenadas = "";
  export let dependencias: string[] = [];
  export let categoriasCatalogo: Record<string, string[]> = {};
  export let errors: { entidad?: string; categoria?: string; requerimiento?: string; ubicacion?: string } = {};

  const dispatch = createEventDispatcher();

  /** Unión de categorías de TODOS los organismos elegidos (no solo el primero). */
  function categoriasParaTodas(entidadesElegidas: string[]): string[] {
    const union = new Set<string>();
    for (const e of entidadesElegidas) {
      for (const cat of getCategoriasParaEntidad(e, categoriasCatalogo)) {
        union.add(cat);
      }
    }
    return Array.from(union);
  }

  function categoriaOptions(entidadesElegidas: string[]): { value: string; label: string }[] {
    if (entidadesElegidas.length === 0) return [];
    return [
      ...categoriasParaTodas(entidadesElegidas).map((cat) => ({ value: cat, label: cat })),
      { value: OPCION_CATEGORIA_PERSONALIZADA, label: "+ Agregar nueva categoría..." },
    ];
  }

  function categoriaPlaceholder(entidadesElegidas: string[]): string {
    if (entidadesElegidas.length === 0) return "-- Primero selecciona un organismo --";
    return categoriasParaTodas(entidadesElegidas).length > 0
      ? "-- Selecciona categoría --"
      : "-- Sin categorías predefinidas --";
  }

  function handleEntidadesChange() {
    sugeridos = [];
    sugerenciaAplicada = false;
    // Una categoría personalizada (texto libre) sigue valiendo sin importar
    // qué organismos queden elegidos. Una categoría del catálogo solo se
    // limpia si ya no pertenece a la unión de categorías de los organismos
    // actuales (agregar un organismo nunca invalida la elección previa).
    if (usandoCategoriaPersonalizada) return;
    if (categoria && !categoriasParaTodas(entidades).includes(categoria)) {
      categoria = "";
    }
  }

  function onCategoriaSelectChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    handleCategoriaChange(select.value);
  }

  function handleCategoriaChange(value: string) {
    if (value === OPCION_CATEGORIA_PERSONALIZADA) {
      usandoCategoriaPersonalizada = true;
      categoria = "";
    } else {
      usandoCategoriaPersonalizada = false;
      categoria = value;
    }
  }

  /* ------------------------------------------------------------
   *  Sugerencia automática de organismo — POST /avanzadas/clasificar-requerimiento
   *  al dejar de escribir (debounce), sólo si no hay entidades ya elegidas
   *  a mano. Nunca bloquea ni muestra error: comodidad no crítica, mismo
   *  espíritu que el reverse-geocode del padre.
   * ------------------------------------------------------------ */
  let sugeridos: string[] = [];
  let sugerenciaAplicada = false;
  let sugerenciaConfianza: number | null = null;
  let clasificarTimer: ReturnType<typeof setTimeout> | null = null;

  function handleRequerimientoInput() {
    if (clasificarTimer) clearTimeout(clasificarTimer);
    clasificarTimer = setTimeout(intentarClasificar, CLASIFICAR_DEBOUNCE_MS);
  }

  onDestroy(() => {
    if (clasificarTimer) clearTimeout(clasificarTimer);
  });

  async function intentarClasificar() {
    const texto = requerimiento.trim();
    if (texto.length <= CLASIFICAR_MIN_LARGO) return;
    if (entidades.length > 0) return; // ya hay una elección manual: no vale la pena sugerir

    try {
      const res = await clasificarRequerimiento({ texto });
      if (!res.organismos_sugeridos || res.organismos_sugeridos.length === 0) return;
      sugeridos = res.organismos_sugeridos;
      // Re-chequea entidades.length: pudo haberse llenado mientras la llamada estaba en vuelo.
      if (entidades.length === 0) {
        entidades = [...res.organismos_sugeridos];
        sugerenciaAplicada = true;
        sugerenciaConfianza = res.confianza;
        dispatch("sugerencia", { organismos: sugeridos, confianza: res.confianza });
      }
    } catch {
      // Sugerencia automática: comodidad opcional, nunca bloquea el formulario.
    }
  }

  function handleCoordsBlur() {
    dispatch("coordsblur");
  }
</script>

<Textarea
  id="req-detalle-{idPrefix}"
  label="Requerimiento"
  required
  bind:value={requerimiento}
  on:input={handleRequerimientoInput}
  rows={3}
  placeholder="Describí el requerimiento o hallazgo — el organismo se sugiere automáticamente a partir de este texto"
  error={errors.requerimiento}
/>

<div class="field">
  <MultiSelectOrganismos
    id="req-entidad-{idPrefix}"
    label="Organismos"
    required
    bind:value={entidades}
    options={dependencias}
    suggested={sugeridos}
    placeholder="Escribe para buscar (ej: DAGMA, EMCALI, Movilidad...)"
    on:change={handleEntidadesChange}
    error={errors.entidad}
  />
  <p class="req-hint">
    Se sugieren solos al describir el requerimiento — abrí la lista para agregar o quitar alguno y confirmá con
    "Aceptar".
  </p>
  {#if sugerenciaAplicada}
    <p class="req-hint req-hint-sugerencia">
      Sugerido automáticamente según la descripción — podés ajustarlo.
      {#if sugerenciaConfianza !== null}({Math.round(sugerenciaConfianza * 100)}% de confianza){/if}
    </p>
  {/if}
</div>

<div class="field">
  <Select
    id="req-categoria-{idPrefix}"
    label="Categoría"
    required
    disabled={entidades.length === 0}
    value={usandoCategoriaPersonalizada ? OPCION_CATEGORIA_PERSONALIZADA : categoria}
    on:change={onCategoriaSelectChange}
    placeholder={categoriaPlaceholder(entidades)}
    options={categoriaOptions(entidades)}
    error={usandoCategoriaPersonalizada ? undefined : errors.categoria}
  />
  {#if usandoCategoriaPersonalizada}
    <Input
      type="text"
      bind:value={categoriaPersonalizadaTexto}
      placeholder="Escribe la nueva categoría..."
      error={errors.categoria}
    />
  {/if}
  <p class="req-hint">
    Tipo de intervención — se combinan las categorías de todos los organismos elegidos. Si eliges "Otro",
    escribe una nueva y quedará disponible para todos.
  </p>
</div>

<div class="row-2col">
  <Input
    id="req-ubicacion-{idPrefix}"
    label="Ubicación"
    required
    bind:value={ubicacion}
    placeholder="Ej: Cll 5 con Cra 23, Barrio San Fernando"
    error={errors.ubicacion}
  />

  <div class="field">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="field-label-subtle" for="req-coords-{idPrefix}">Coordenadas GPS (lat, lng)</label>
    <div class="gps-row">
      <Input id="req-coords-{idPrefix}" type="text" bind:value={coordenadas} placeholder="lat, lng" on:blur={handleCoordsBlur} />
      <slot name="gps" />
    </div>
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field-label-subtle {
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--text-body);
  }
  .req-hint {
    font-size: var(--fs-xs);
    color: var(--text-muted);
    margin: 0.1875rem 0 0;
    line-height: 1.4;
  }
  .req-hint-sugerencia {
    color: #92400e;
    font-weight: 600;
  }
  .row-2col {
    display: flex;
    gap: 0.875rem;
    flex-wrap: wrap;
  }
  .row-2col > :global(.input-group),
  .row-2col > .field {
    flex: 1;
    min-width: 200px;
  }
  .gps-row {
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
  }
  .gps-row :global(.input-group) {
    flex: 1;
  }
</style>
