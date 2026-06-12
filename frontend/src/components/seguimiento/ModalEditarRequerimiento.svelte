<script lang="ts">
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  import { seguimientoStore } from "../../stores/seguimientoStore";
  import type { Requerimiento, DocumentoAdjunto } from "../../types/seguimiento";
  import { getCentrosGestores } from "../../api/visitas";
  import Modal from "../ui/Modal.svelte";
  import Button from "../ui/Button.svelte";
  import Icon from "../ui/Icon.svelte";
  import Alert from "../ui/Alert.svelte";

  export let show = false;
  export let req: Requerimiento;

  const dispatch = createEventDispatcher();

  let submitting = false;
  let errorMsg = "";
  let successMsg = "";

  // Form fields
  let solNombre = "";
  let solTelefono = "";
  let solEmail = "";

  let descripcion = "";
  let observaciones = "";
  let direccion = "";
  let latitud = "";
  let longitud = "";

  let organismosSeleccionados: string[] = [];
  let availableCentros: Array<{ id: string; nombre: string; sigla: string }> = [];

  // Collapse / Expand
  let expandSolicitante = false;

  // Media
  let newPhotos: File[] = [];
  let existingPhotos: DocumentoAdjunto[] = [];
  let s3KeysToDelete: string[] = [];

  $: if (show && req) {
    initForm();
  }

  onMount(async () => {
    try {
      const data = await getCentrosGestores();
      availableCentros = (data as any[]) || [];
    } catch (err) {
      console.error("Error loading centros gestores:", err);
    }
  });

  function initForm() {
    errorMsg = "";
    successMsg = "";
    solNombre = req.solicitante?.nombre_completo || "";
    solTelefono = req.solicitante?.telefono || "";
    solEmail = req.solicitante?.email || "";

    descripcion = req.descripcion || "";
    observaciones = req.observaciones || "";
    direccion = req.direccion || "";
    latitud = req.latitud || "";
    longitud = req.longitud || "";

    organismosSeleccionados = [...(req.centros_gestores || [])];
    existingPhotos = [...(req.documentos_adjuntos || [])];
    newPhotos = [];
    s3KeysToDelete = [];
    expandSolicitante = false;
  }

  function toggleOrganismo(org: string) {
    if (organismosSeleccionados.includes(org)) {
      organismosSeleccionados = organismosSeleccionados.filter((o) => o !== org);
    } else {
      organismosSeleccionados = [...organismosSeleccionados, org];
    }
  }

  function handleFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    newPhotos = [...newPhotos, ...Array.from(input.files)];
    input.value = "";
  }

  function removeNewPhoto(idx: number) {
    newPhotos = newPhotos.filter((_, i) => i !== idx);
  }

  function removeExistingPhoto(doc: DocumentoAdjunto) {
    if (doc.s3_key) {
      s3KeysToDelete = [...s3KeysToDelete, doc.s3_key];
    } else {
      let s3Key = "";
      const s3Host = "https://catatrack-photos.s3.amazonaws.com/";
      if (doc.url.startsWith(s3Host)) {
        s3Key = doc.url.slice(s3Host.length);
      } else if (doc.url.includes(".amazonaws.com/")) {
        const parts = doc.url.split(".amazonaws.com/");
        if (parts.length === 2) {
          s3Key = parts[1].split("?")[0];
        }
      }
      
      if (s3Key) {
        s3Key = decodeURIComponent(s3Key.split("?")[0]);
        s3KeysToDelete = [...s3KeysToDelete, s3Key];
      }
    }
    existingPhotos = existingPhotos.filter((p) => p.url !== doc.url);
  }

  async function handleSave() {
    if (!descripcion.trim()) {
      errorMsg = "La descripción no puede estar vacía.";
      return;
    }

    submitting = true;
    errorMsg = "";

    try {
      const payload: any = {
        requerimiento: descripcion,
        observaciones: observaciones,
        direccion: direccion,
      };

      // Solicitante
      const datosSolicitante = {
        personas: [
          {
            nombre: solNombre,
            telefono: solTelefono,
            email: solEmail,
          },
        ],
      };
      payload.datos_solicitante = JSON.stringify(datosSolicitante);

      // Coordenadas
      if (latitud && longitud) {
        payload.coords = JSON.stringify({
          type: "Point",
          coordinates: [parseFloat(longitud), parseFloat(latitud)],
        });
      }

      // Organismos
      payload.organismos_encargados = JSON.stringify(organismosSeleccionados);

      // S3 Keys to delete
      if (s3KeysToDelete.length > 0) {
        payload.eliminar_s3_keys = JSON.stringify(s3KeysToDelete);
      }

      // Fotos
      if (newPhotos.length > 0) {
        payload.fotos = newPhotos;
      }

      await seguimientoStore.editarRequerimiento(req.id, payload);
      
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        successMsg = "Cambios guardados localmente (Trabajando offline). Se sincronizarán automáticamente al detectar conexión.";
      } else {
        successMsg = "Requerimiento editado exitosamente.";
      }

      setTimeout(() => {
        dispatch("save");
        show = false;
      }, 1500);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "Error al editar el requerimiento.";
    } finally {
      submitting = false;
    }
  }
</script>

<Modal {show} title="Editar Requerimiento" on:close={() => dispatch("close")}>
  {#if errorMsg}
    <Alert type="error" message={errorMsg} />
  {/if}
  {#if successMsg}
    <Alert type="success" message={successMsg} />
  {/if}

  <div class="form-container">
    <button
      type="button"
      class="section-title section-title-toggle"
      on:click={() => expandSolicitante = !expandSolicitante}
    >
      <span>Datos del Solicitante</span>
      <span class="chevron" class:rotated={expandSolicitante}>▼</span>
    </button>
    {#if expandSolicitante}
      <div class="field-group">
        <div class="field">
          <label for="edit-sol-nombre">Nombre Completo</label>
          <input id="edit-sol-nombre" type="text" bind:value={solNombre} placeholder="Nombre del solicitante" />
        </div>
        <div class="field">
          <label for="edit-sol-tel">Teléfono</label>
          <input id="edit-sol-tel" type="text" bind:value={solTelefono} placeholder="Número de contacto" />
        </div>
        <div class="field">
          <label for="edit-sol-email">Email</label>
          <input id="edit-sol-email" type="email" bind:value={solEmail} placeholder="Correo electrónico" />
        </div>
      </div>
    {/if}

    <div class="section-title">Detalles del Reporte</div>
    <div class="field">
      <label for="edit-desc">Descripción del Problema</label>
      <textarea id="edit-desc" bind:value={descripcion} rows="3" placeholder="Detalles de la solicitud..."></textarea>
    </div>
    <div class="field">
      <label for="edit-obs">Observaciones</label>
      <textarea id="edit-obs" bind:value={observaciones} rows="2" placeholder="Observaciones adicionales..."></textarea>
    </div>

    <div class="section-title">Ubicación</div>
    <div class="field">
      <label for="edit-dir">Dirección</label>
      <input id="edit-dir" type="text" bind:value={direccion} placeholder="Ej: Calle 5 # 10-20" />
    </div>
    <div class="field-grid-2">
      <div class="field">
        <label for="edit-lat">Latitud</label>
        <input id="edit-lat" type="text" bind:value={latitud} placeholder="GPS Lat" />
      </div>
      <div class="field">
        <label for="edit-lng">Longitud</label>
        <input id="edit-lng" type="text" bind:value={longitud} placeholder="GPS Lng" />
      </div>
    </div>

    <div class="section-title">Organismos Encargados</div>
    <div class="organismos-list">
      {#each availableCentros as org}
        <button
          type="button"
          class="org-btn"
          class:active={organismosSeleccionados.includes(org.nombre)}
          on:click={() => toggleOrganismo(org.nombre)}
        >
          {org.sigla || org.nombre}
        </button>
      {/each}
    </div>

    <div class="section-title">Multimedia del Reporte</div>
    <div class="media-section">
      <!-- Existing photos -->
      {#if existingPhotos.length > 0}
        <label class="section-subtitle">Fotos existentes</label>
        <div class="thumbs-grid">
          {#each existingPhotos as photo}
            <div class="thumb-wrap">
              <img src={photo.url} alt={photo.nombre} />
              <button type="button" class="btn-remove-media" on:click={() => removeExistingPhoto(photo)}>×</button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- New photos to upload -->
      <div class="upload-btn-wrap">
        <label class="btn-upload">
          <Icon name="camera" size={16} />
          <span>Adjuntar Fotos / Archivos</span>
          <input type="file" accept="image/*,video/*" multiple on:change={handleFiles} hidden />
        </label>
      </div>

      {#if newPhotos.length > 0}
        <label class="section-subtitle">Nuevas fotos por subir ({newPhotos.length})</label>
        <div class="thumbs-grid">
          {#each newPhotos as file, idx}
            <div class="thumb-wrap">
              <div class="new-file-placeholder">
                <Icon name="file-text" size={20} />
                <span class="file-name">{file.name}</span>
              </div>
              <button type="button" class="btn-remove-media" on:click={() => removeNewPhoto(idx)}>×</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div slot="footer" class="footer-actions">
    <Button variant="secondary" on:click={() => { show = false; dispatch("close"); }} disabled={submitting}>
      Cancelar
    </Button>
    <Button on:click={handleSave} disabled={submitting}>
      {#if submitting}Guardando...{:else}Guardar Cambios{/if}
    </Button>
  </div>
</Modal>

<style>
  .form-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 60vh;
    overflow-y: auto;
    padding-right: 4px;
  }
  .section-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.75rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.25rem;
  }
  .section-title-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    padding: 0;
    margin-top: 0.75rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.25rem;
  }
  .chevron {
    font-size: 0.65rem;
    transition: transform 0.2s;
    color: var(--text-muted);
  }
  .chevron.rotated {
    transform: rotate(180deg);
  }
  .section-subtitle {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
    display: block;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text);
  }
  .field input, .field textarea {
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--background);
    color: var(--text);
    font-size: 0.85rem;
  }
  .field input:focus, .field textarea:focus {
    outline: none;
    border-color: var(--primary);
  }
  .field-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .organismos-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .org-btn {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text);
    cursor: pointer;
    transition: all 0.2s;
  }
  .org-btn:hover {
    background: var(--border);
  }
  .org-btn.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }
  .media-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .upload-btn-wrap {
    margin: 0.5rem 0;
  }
  .btn-upload {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--background);
    border: 1px dashed var(--border);
    border-radius: var(--radius-md);
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
    color: var(--text-muted);
    cursor: pointer;
    width: 100%;
    justify-content: center;
    box-sizing: border-box;
  }
  .btn-upload:hover {
    background: var(--border);
    color: var(--text);
  }
  .thumbs-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }
  .thumb-wrap {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--border);
    background: #000;
  }
  .thumb-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .new-file-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--background);
    padding: 0.25rem;
    box-sizing: border-box;
    text-align: center;
  }
  .file-name {
    font-size: 0.6rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }
  .btn-remove-media {
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    cursor: pointer;
    font-weight: bold;
    z-index: 2;
  }
  .btn-remove-media:hover {
    background: rgba(220, 38, 38, 0.8);
  }
  .footer-actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
