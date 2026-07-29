<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { avanzadasStore } from "../../stores/avanzadasStore";
  import { MAX_FOTOS_POR_REQUERIMIENTO } from "../../api/avanzadas";
  import { getCurrentPosition, formatCoordinates, reverseGeocodeWithFallback } from "../../lib/geolocation";
  import { toDisplayableImageUrl } from "../../lib/media-urls";
  import type { RequerimientoAvanzada } from "../../types/avanzadas";
  import Alert from "../ui/Alert.svelte";
  import Button from "../ui/Button.svelte";
  import Icon from "../ui/Icon.svelte";
  import Modal from "../ui/Modal.svelte";
  import RequerimientoFormFields from "./RequerimientoFormFields.svelte";

  export let show = false;
  export let clientId: string;
  export let req: RequerimientoAvanzada | null = null;

  const dispatch = createEventDispatcher();

  let guardando = false;
  let errorMsg = "";
  let capturandoGps = false;

  let entidades: string[] = [];
  let categoria = "";
  let usandoCategoriaPersonalizada = false;
  let categoriaPersonalizadaTexto = "";
  let requerimientoTexto = "";
  let ubicacion = "";
  let coordenadas = "";

  /** URLs de fotos ya guardadas todavía adjuntas (removibles). */
  let fotosExistentes: string[] = [];
  /** Subconjunto de fotosExistentes que el usuario quitó, enviado como fotos_eliminar. */
  let fotosAEliminar: string[] = [];

  interface NuevaFotoDraft {
    file: File;
    previewUrl: string;
  }
  let nuevoFotos: NuevaFotoDraft[] = [];

  /** Guardia para (re)inicializar el estado sólo cuando cambia el req o se abre el modal. */
  let initializedFor: RequerimientoAvanzada | null = null;

  function initFrom(r: RequerimientoAvanzada) {
    // Fallback para docs viejos guardados antes de la multi-selección de organismos.
    entidades = r.entidades?.length ? [...r.entidades] : r.entidad ? [r.entidad] : [];
    if (r.categoria_personalizada) {
      usandoCategoriaPersonalizada = true;
      categoriaPersonalizadaTexto = r.categoria_personalizada;
      categoria = "";
    } else {
      usandoCategoriaPersonalizada = false;
      categoria = r.categoria || "";
      categoriaPersonalizadaTexto = "";
    }
    requerimientoTexto = r.requerimiento;
    ubicacion = r.ubicacion;
    coordenadas = r.coordenadas || "";
    nuevoFotos.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    nuevoFotos = [];
    fotosExistentes = [...(r.fotos_urls || [])];
    fotosAEliminar = [];
    errorMsg = "";
  }

  $: if (show && req && req !== initializedFor) {
    initFrom(req);
    initializedFor = req;
  }
  $: if (!show) initializedFor = null;

  onDestroy(() => {
    nuevoFotos.forEach((f) => URL.revokeObjectURL(f.previewUrl));
  });

  function handleNuevasFotos(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const nuevos = Array.from(input.files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    const combined = [...nuevoFotos, ...nuevos];
    // Las fotos ya guardadas cuentan contra el tope: existentes + nuevas.
    if (fotosExistentes.length + combined.length > MAX_FOTOS_POR_REQUERIMIENTO) {
      errorMsg = `Máximo ${MAX_FOTOS_POR_REQUERIMIENTO} fotos permitidas`;
      nuevos.forEach((n) => URL.revokeObjectURL(n.previewUrl));
      input.value = "";
      return;
    }
    nuevoFotos = combined;
    input.value = "";
  }

  function quitarNuevaFoto(idx: number) {
    URL.revokeObjectURL(nuevoFotos[idx].previewUrl);
    nuevoFotos = nuevoFotos.filter((_, i) => i !== idx);
  }

  function quitarFotoExistente(url: string) {
    fotosAEliminar = [...fotosAEliminar, url];
    fotosExistentes = fotosExistentes.filter((u) => u !== url);
  }

  async function capturarGps() {
    capturandoGps = true;
    try {
      const pos = await getCurrentPosition();
      coordenadas = formatCoordinates(pos);
      await intentarRellenarUbicacion();
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "No se pudo obtener el GPS del dispositivo.";
    } finally {
      capturandoGps = false;
    }
  }

  async function intentarRellenarUbicacion() {
    if (ubicacion.trim()) return;
    const partes = coordenadas.split(",").map((p) => p.trim());
    if (partes.length !== 2) return;
    const lat = parseFloat(partes[0]);
    const lng = parseFloat(partes[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    try {
      const r = await reverseGeocodeWithFallback(lat, lng);
      if (r && r.direccion_formateada && !ubicacion.trim()) {
        ubicacion = r.direccion_formateada;
      }
    } catch {
      /* comodidad opcional, nunca bloquea */
    }
  }

  function cerrar() {
    dispatch("close");
  }

  async function guardar() {
    if (!req) return;
    errorMsg = "";
    if (entidades.length === 0) {
      errorMsg = "Seleccione al menos un organismo.";
      return;
    }
    if (!requerimientoTexto.trim()) {
      errorMsg = "Describa el requerimiento.";
      return;
    }
    const categoriaElegida = usandoCategoriaPersonalizada ? categoriaPersonalizadaTexto.trim() : categoria;
    if (!categoriaElegida) {
      errorMsg = "Selecciona una categoría.";
      return;
    }
    if (!ubicacion.trim()) {
      errorMsg = "Indique la ubicación.";
      return;
    }

    guardando = true;
    try {
      const datos = {
        // El backend deriva entidad = entidades[0]; enviamos ambos para
        // satisfacer el contrato legacy (entidad) sin dejar de mandar la
        // multi-selección nueva (entidades).
        entidad: entidades[0],
        entidades,
        categoria: usandoCategoriaPersonalizada ? categoriaPersonalizadaTexto.trim() : categoria,
        categoria_personalizada: usandoCategoriaPersonalizada ? categoriaPersonalizadaTexto.trim() || null : null,
        requerimiento: requerimientoTexto.trim(),
        ubicacion: ubicacion.trim(),
        coordenadas: coordenadas.trim() || null,
      };
      const datosEdit = fotosAEliminar.length > 0 ? { ...datos, fotos_eliminar: fotosAEliminar } : datos;
      await avanzadasStore.actualizarRequerimiento(clientId, req.id, datosEdit, nuevoFotos.map((f) => f.file));
      dispatch("saved");
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "No se pudo actualizar el requerimiento.";
    } finally {
      guardando = false;
    }
  }
</script>

<Modal {show} title="Editar requerimiento" on:close={cerrar}>
  {#if errorMsg}
    <Alert type="error" message={errorMsg} />
  {/if}

  <RequerimientoFormFields
    idPrefix="editar"
    bind:entidades
    bind:categoria
    bind:usandoCategoriaPersonalizada
    bind:categoriaPersonalizadaTexto
    bind:requerimiento={requerimientoTexto}
    bind:ubicacion
    bind:coordenadas
    dependencias={$avanzadasStore.catalogos.dependencias}
    categoriasCatalogo={$avanzadasStore.catalogos.categorias}
    on:coordsblur={intentarRellenarUbicacion}
  >
    <Button slot="gps" type="button" variant="primary" size="sm" loading={capturandoGps} on:click={capturarGps}>
      GPS
    </Button>
  </RequerimientoFormFields>

  <div class="media-attachments">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="field-label-subtle">
      Evidencia fotográfica <small>(máx. {MAX_FOTOS_POR_REQUERIMIENTO})</small>
    </label>
    <div class="fotos-container">
      {#each fotosExistentes as url (url)}
        <div class="foto-thumb-edit">
          <img src={toDisplayableImageUrl(url, "w400")} alt="Foto del requerimiento" />
          <button type="button" class="foto-del" aria-label="Eliminar foto" on:click={() => quitarFotoExistente(url)}>
            <Icon name="x" size={11} />
          </button>
        </div>
      {/each}
      {#each nuevoFotos as foto, fIdx (foto.previewUrl)}
        <div class="foto-thumb-edit">
          <img src={foto.previewUrl} alt={foto.file.name} />
          <button type="button" class="foto-del" aria-label="Eliminar foto" on:click={() => quitarNuevaFoto(fIdx)}>
            <Icon name="x" size={11} />
          </button>
        </div>
      {/each}
    </div>
    <div class="media-actions">
      <label class="media-btn">
        <Icon name="camera" size={16} />
        <span>Cámara</span>
        <input type="file" accept="image/*" capture="environment" on:change={handleNuevasFotos} hidden />
      </label>
      <label class="media-btn">
        <Icon name="image" size={16} />
        <span>Galería</span>
        <input type="file" accept="image/*" multiple on:change={handleNuevasFotos} hidden />
      </label>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <Button type="button" variant="secondary" on:click={cerrar} disabled={guardando}>Cancelar</Button>
    <Button type="button" on:click={guardar} loading={guardando}>Guardar cambios</Button>
  </svelte:fragment>
</Modal>

<style>
  .field-label-subtle {
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--text-body);
  }
  .field-label-subtle small {
    font-weight: 400;
    color: var(--text-muted);
  }
  .media-attachments {
    margin-top: 0.65rem;
  }
  .media-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .media-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text-body);
    font-size: var(--fs-base);
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .media-btn:hover {
    background: var(--bg);
    border-color: var(--text-muted);
  }
  .fotos-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.375rem 0;
  }
  .foto-thumb-edit {
    position: relative;
    width: 90px;
    height: 90px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1.5px solid var(--border-strong);
    flex-shrink: 0;
  }
  .foto-thumb-edit img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .foto-del {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 22px;
    height: 22px;
    background: var(--error);
    color: #fff;
    border: none;
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
