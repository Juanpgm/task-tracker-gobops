<script lang="ts">
  import { onMount } from "svelte";
  import { navigationStore } from "../../stores/navigationStore";
  import { seguimientoStore } from "../../stores/seguimientoStore";
  import { registrarRequerimiento } from "../../api/visitas";
  import { CENTROS_GESTORES } from "../../data/mock-seguimiento";
  import { getCurrentPosition } from "../../lib/geolocation";
  import type {
    VisitaProgramada,
    Requerimiento,
  } from "../../types/seguimiento";
  import type { RequerimientoPayload } from "../../types";
  import Button from "../ui/Button.svelte";
  import Alert from "../ui/Alert.svelte";
  import Card from "../ui/Card.svelte";

  let visita: VisitaProgramada | null = null;
  let visitaReqs: Requerimiento[] = [];
  let errorMsg = "";
  let successMsg = "";
  let showForm = false;
  let submitting = false;

  // Solicitante form (matches datos_solicitante.personas[])
  let solNombre = "";
  let solTelefono = "";
  let solEmail = "";

  // Requerimientos array (one solicitante can have multiple)
  interface ReqDraft {
    centros_gestores: string[];
    tipo_requerimiento: string;
    descripcion: string;
    observaciones: string;
    nota_voz: File | null;
  }
  let requerimientosDraft: ReqDraft[] = [createEmptyReq()];

  function createEmptyReq(): ReqDraft {
    return {
      centros_gestores: [],
      tipo_requerimiento: "",
      descripcion: "",
      observaciones: "",
      nota_voz: null,
    };
  }

  function handleNotaVoz(reqIdx: number, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    requerimientosDraft[reqIdx].nota_voz = input.files[0];
    requerimientosDraft = [...requerimientosDraft];
  }

  function removeNotaVoz(reqIdx: number) {
    requerimientosDraft[reqIdx].nota_voz = null;
    requerimientosDraft = [...requerimientosDraft];
  }

  onMount(() => {
    const params = $navigationStore.params;
    const visitaId = params.visitaId;
    if (!visitaId) {
      errorMsg = "No se especificó una visita";
      return;
    }
    const found = $seguimientoStore.visitas.find((v) => v.id === visitaId);
    if (!found) {
      errorMsg = `Visita ${visitaId} no encontrada`;
      return;
    }
    visita = found;

    updateReqList();
  });

  function updateReqList() {
    if (visita) {
      visitaReqs = $seguimientoStore.requerimientos.filter(
        (r) => r.visita_id === visita!.id,
      );
    }
  }

  // Make it reactive
  $: if ($seguimientoStore.requerimientos && visita) {
    visitaReqs = $seguimientoStore.requerimientos.filter(
      (r) => r.visita_id === visita!.id,
    );
  }

  function toggleCentroGestor(reqIdx: number, centroNombre: string) {
    const req = requerimientosDraft[reqIdx];
    if (req.centros_gestores.includes(centroNombre)) {
      req.centros_gestores = req.centros_gestores.filter(
        (c) => c !== centroNombre,
      );
    } else {
      req.centros_gestores = [...req.centros_gestores, centroNombre];
    }
    requerimientosDraft = [...requerimientosDraft];
  }

  function agregarRequerimiento() {
    requerimientosDraft = [...requerimientosDraft, createEmptyReq()];
  }

  function eliminarRequerimiento(idx: number) {
    if (requerimientosDraft.length <= 1) return;
    requerimientosDraft = requerimientosDraft.filter((_, i) => i !== idx);
  }

  async function guardarRequerimientos() {
    if (!visita) return;

    // Validate solicitante
    if (!solNombre.trim()) {
      errorMsg = "El nombre del solicitante es obligatorio";
      return;
    }

    // Validate each req
    for (let i = 0; i < requerimientosDraft.length; i++) {
      const req = requerimientosDraft[i];
      if (req.centros_gestores.length === 0) {
        errorMsg = `Requerimiento #${i + 1}: Seleccione al menos un centro gestor`;
        return;
      }
      if (!req.tipo_requerimiento.trim()) {
        errorMsg = `Requerimiento #${i + 1}: El tipo de requerimiento es obligatorio`;
        return;
      }
      if (!req.descripcion.trim()) {
        errorMsg = `Requerimiento #${i + 1}: La descripción es obligatoria`;
        return;
      }
      if (!req.observaciones.trim()) {
        errorMsg = `Requerimiento #${i + 1}: Las observaciones son obligatorias`;
        return;
      }
    }

    errorMsg = "";
    submitting = true;

    // Auto-capture GPS
    let latitud: string;
    let longitud: string;
    try {
      const pos = await getCurrentPosition();
      latitud = pos.latitud.toFixed(8);
      longitud = pos.longitud.toFixed(8);
    } catch (err) {
      errorMsg =
        "No se pudo obtener la ubicación GPS. Verifique que el GPS esté habilitado.";
      submitting = false;
      return;
    }

    try {
      let registrados = 0;
      for (const req of requerimientosDraft) {
        const datosSolicitante = JSON.stringify({
          personas: [
            {
              nombre: solNombre,
              email: solEmail || undefined,
              telefono: solTelefono || undefined,
              centro_gestor: req.centros_gestores[0] || undefined,
            },
          ],
        });

        const coords = JSON.stringify({
          type: "Point",
          coordinates: [parseFloat(longitud), parseFloat(latitud)],
        });

        const organismosEncargados = JSON.stringify(req.centros_gestores);

        const payload: RequerimientoPayload = {
          vid: visita!.id,
          datos_solicitante: datosSolicitante,
          tipo_requerimiento: req.tipo_requerimiento,
          requerimiento: req.descripcion,
          observaciones: req.observaciones,
          coords,
          organismos_encargados: organismosEncargados,
          nota_voz: req.nota_voz,
        };

        const result = await registrarRequerimiento(payload);
        console.log("Requerimiento registrado:", result.rid);
        registrados++;
      }

      successMsg = `✅ ${registrados} requerimiento(s) registrado(s) para ${solNombre}`;

      // Reload requerimientos from API to refresh list
      seguimientoStore.loadRequerimientos();

      // Reset form
      solNombre = "";
      solTelefono = "";
      solEmail = "";
      requerimientosDraft = [createEmptyReq()];
      showForm = false;

      setTimeout(() => {
        successMsg = "";
      }, 4000);
    } catch (err) {
      errorMsg =
        err instanceof Error
          ? err.message
          : "Error al registrar requerimiento(s)";
      console.error("guardarRequerimientos error:", err);
    } finally {
      submitting = false;
    }
  }

  function getPrioridadStyle(p: string): string {
    switch (p) {
      case "urgente":
        return "background: #fee2e2; color: #991b1b;";
      case "alta":
        return "background: #fef3c7; color: #92400e;";
      case "media":
        return "background: #dbeafe; color: #1e40af;";
      case "baja":
        return "background: #f1f5f9; color: #475569;";
      default:
        return "";
    }
  }

  function getEstadoBg(estado: string): string {
    switch (estado) {
      case "nuevo":
        return "#f0f1f3";
      case "en-proceso":
        return "#fff3e0";
      case "resuelto":
        return "#e8f5e9";
      case "cerrado":
        return "#eceff1";
      case "cancelado":
        return "#fce4ec";
      default:
        return "white";
    }
  }

  function getEstadoBorder(estado: string): string {
    switch (estado) {
      case "nuevo":
        return "#d5d7db";
      case "en-proceso":
        return "#ffe0b2";
      case "resuelto":
        return "#c8e6c9";
      case "cerrado":
        return "#cfd8dc";
      case "cancelado":
        return "#f8bbd0";
      default:
        return "#e2e8f0";
    }
  }

  function getEstadoChipStyle(estado: string): string {
    switch (estado) {
      case "nuevo":
        return "background: #e0e2e6; color: #4b5563;";
      case "en-proceso":
        return "background: #ffe0b2; color: #e65100;";
      case "resuelto":
        return "background: #c8e6c9; color: #2e7d32;";
      case "cerrado":
        return "background: #cfd8dc; color: #37474f;";
      case "cancelado":
        return "background: #f8bbd0; color: #c62828;";
      default:
        return "background: #f1f5f9; color: #475569;";
    }
  }
</script>

<div class="view">
  <header class="view-header">
    <button
      class="back-btn"
      on:click={() => navigationStore.navigate("visitas-programadas")}
      >← Visitas</button
    >
    <h2 class="view-title">📝 Requerimientos</h2>
  </header>

  <main class="view-body">
    {#if errorMsg && !visita}
      <div class="container"><Alert type="error" message={errorMsg} /></div>
    {:else if visita}
      <!-- UP Info Banner -->
      <div class="up-banner">
        {#if visita.unidad_proyecto}
          <div class="up-banner-left">
            <span class="up-tipo-badge"
              >{visita.unidad_proyecto.tipo_equipamiento}</span
            >
            <strong>{visita.unidad_proyecto.nombre_up}</strong> — {visita
              .unidad_proyecto.nombre_up_detalle}
          </div>
          <div class="up-banner-right">
            <span>📍 {visita.unidad_proyecto.direccion}</span>
            <span>📅 {visita.fecha_visita}</span>
          </div>
        {:else}
          <div class="up-banner-left">
            <span class="up-tipo-badge">📍 Sin UP</span>
            <strong>{visita.direccion_manual || "Sin dirección"}</strong>
            {#if visita.barrio_vereda}
              — {visita.barrio_vereda}{/if}
          </div>
          <div class="up-banner-right">
            <span>📅 {visita.fecha_visita}</span>
          </div>
        {/if}
      </div>

      <div class="content container">
        {#if successMsg}
          <Alert type="success" message={successMsg} />
        {/if}
        {#if errorMsg}
          <Alert type="error" message={errorMsg} />
        {/if}

        <!-- Existing requirements for this visit -->
        {#if visitaReqs.length > 0}
          <div class="existing-section">
            <h3>📋 Requerimientos de esta visita ({visitaReqs.length})</h3>
            <div class="req-list">
              {#each visitaReqs as req (req.id)}
                <div
                  class="req-mini-card"
                  style="background: {getEstadoBg(
                    req.estado,
                  )}; border-color: {getEstadoBorder(req.estado)};"
                >
                  <div class="req-mini-header">
                    <span
                      class="req-prioridad"
                      style={getPrioridadStyle(req.prioridad)}
                      >{req.prioridad}</span
                    >
                    <span
                      class="req-estado"
                      style={getEstadoChipStyle(req.estado)}>{req.estado}</span
                    >
                    <span class="req-id">{req.id}</span>
                  </div>
                  <p class="req-mini-desc">
                    {req.descripcion.slice(0, 120)}{req.descripcion.length > 120
                      ? "..."
                      : ""}
                  </p>
                  <div class="req-mini-footer">
                    <span>👤 {req.solicitante.nombre_completo}</span>
                    <span>🏢 {req.centros_gestores.join(", ")}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- New Requirement Form -->
        {#if !showForm}
          <div class="start-form">
            <Button
              on:click={() => {
                showForm = true;
                errorMsg = "";
              }}
            >
              ➕ Registrar Nuevo Requerimiento
            </Button>
          </div>
        {:else}
          <Card padding="lg">
            <h3 class="form-section-title">👤 Datos del Solicitante</h3>
            <p class="form-hint">
              Persona de la comunidad que realiza la petición
            </p>

            <div class="form-grid-2">
              <div class="field">
                <label for="sol-nombre">Nombre Completo *</label>
                <input
                  id="sol-nombre"
                  type="text"
                  bind:value={solNombre}
                  placeholder="Nombre del solicitante"
                />
              </div>
              <div class="field">
                <label for="sol-telefono">Teléfono</label>
                <input
                  id="sol-telefono"
                  type="tel"
                  bind:value={solTelefono}
                  placeholder="+57 300 1234567"
                />
              </div>
              <div class="field">
                <label for="sol-email">Email</label>
                <input
                  id="sol-email"
                  type="email"
                  bind:value={solEmail}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>
            <p
              class="form-hint"
              style="margin-top: 0.5rem; font-size: 0.75rem;"
            >
              📍 El barrio y comuna se determinan automáticamente a partir de
              las coordenadas GPS.
            </p>
          </Card>

          <!-- Requerimientos del solicitante -->
          {#each requerimientosDraft as req, idx (idx)}
            <Card padding="lg">
              <div class="req-header-row">
                <h3 class="form-section-title">📝 Requerimiento #{idx + 1}</h3>
                {#if requerimientosDraft.length > 1}
                  <button
                    class="remove-req-btn"
                    on:click={() => eliminarRequerimiento(idx)}
                    >🗑️ Eliminar</button
                  >
                {/if}
              </div>

              <!-- Centro Gestor Multi-Select -->
              <div class="field">
                <!-- svelte-ignore a11y-label-has-associated-control -->
                <label
                  >Centro(s) Gestor(es) * <small>(multi-selección)</small
                  ></label
                >
                <div class="centros-grid">
                  {#each CENTROS_GESTORES as cg (cg.id)}
                    <button
                      class="cg-chip"
                      class:selected={req.centros_gestores.includes(cg.nombre)}
                      style={req.centros_gestores.includes(cg.nombre)
                        ? `background: ${cg.color}; color: white; border-color: ${cg.color};`
                        : ""}
                      on:click={() => toggleCentroGestor(idx, cg.nombre)}
                    >
                      {cg.sigla}
                    </button>
                  {/each}
                </div>
                {#if req.centros_gestores.length > 0}
                  <p class="selected-cgs">{req.centros_gestores.join(" • ")}</p>
                {/if}
              </div>

              <div class="field">
                <label for="req-tipo-{idx}">Tipo de Requerimiento *</label>
                <select id="req-tipo-{idx}" bind:value={req.tipo_requerimiento}>
                  <option value="">-- Seleccione --</option>
                  <option value="Poda de árboles">Poda de árboles</option>
                  <option value="Arbustos">Arbustos</option>
                  <option value="Emergencias arbóreas"
                    >Emergencias arbóreas</option
                  >
                  <option value="Siembra indiscriminada"
                    >Siembra indiscriminada</option
                  >
                  <option value="Recolección de residuos sólidos"
                    >Recolección de residuos sólidos</option
                  >
                  <option value="Barrido y limpieza de vías y espacio público"
                    >Barrido y limpieza de vías y espacio público</option
                  >
                  <option value="Alumbrado público">Alumbrado público</option>
                  <option value="Acueducto y alcantarillado"
                    >Acueducto y alcantarillado</option
                  >
                  <option value="Habitantes de calle"
                    >Habitantes de calle</option
                  >
                  <option value="Invasión de espacio público"
                    >Invasión de espacio público</option
                  >
                  <option value="Ruido">Ruido</option>
                  <option value="Movilidad">Movilidad</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              <div class="field">
                <label for="req-desc-{idx}"
                  >Descripción del Requerimiento *</label
                >
                <textarea
                  id="req-desc-{idx}"
                  bind:value={req.descripcion}
                  rows="3"
                  placeholder="Describa la necesidad o petición del solicitante..."
                ></textarea>
              </div>

              <div class="field">
                <label for="req-obs-{idx}">Observaciones *</label>
                <textarea
                  id="req-obs-{idx}"
                  bind:value={req.observaciones}
                  rows="2"
                  placeholder="Observaciones adicionales..."
                ></textarea>
              </div>

              <!-- Nota de Voz (opcional) -->
              <div class="field" style="margin-top: 0.75rem;">
                <!-- svelte-ignore a11y-label-has-associated-control -->
                <label>🎤 Nota de Voz (opcional)</label>
                <div class="foto-upload-area">
                  <label class="foto-upload-btn">
                    🎙️ Grabar / Seleccionar Audio
                    <input
                      type="file"
                      accept="audio/*"
                      on:change={(e) => handleNotaVoz(idx, e)}
                      hidden
                    />
                  </label>
                </div>
                {#if req.nota_voz}
                  <div class="nota-voz-info">
                    <span>🎵 {req.nota_voz.name}</span>
                    <button
                      class="foto-remove"
                      on:click={() => removeNotaVoz(idx)}>✕</button
                    >
                  </div>
                {/if}
              </div>
            </Card>
          {/each}

          <div class="add-req-row">
            <button class="add-req-btn" on:click={agregarRequerimiento}>
              ➕ Agregar otro requerimiento (mismo solicitante)
            </button>
          </div>

          <div class="submit-row">
            <Button
              variant="secondary"
              on:click={() => {
                showForm = false;
                errorMsg = "";
              }}>Cancelar</Button
            >
            <Button on:click={guardarRequerimientos} loading={submitting}>
              💾 Guardar {requerimientosDraft.length} Requerimiento{requerimientosDraft.length >
              1
                ? "s"
                : ""}
            </Button>
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  .view {
    min-height: 100vh;
    background: #f8fafc;
  }
  .view-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .back-btn {
    background: none;
    border: none;
    color: #2563eb;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .view-title {
    font-size: 1.1rem;
    font-weight: 700;
    flex: 1;
  }
  .view-body {
    padding-bottom: 2rem;
  }
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 0.75rem;
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  /* UP Banner */
  .up-banner {
    background: linear-gradient(135deg, #1e40af, #2563eb);
    color: white;
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  .up-banner-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .up-tipo-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
  }
  .up-banner-right {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    opacity: 0.9;
  }

  /* Existing reqs */
  .existing-section h3 {
    font-size: 0.95rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  .req-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .req-mini-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.75rem;
  }
  .req-mini-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.35rem;
  }
  .req-prioridad {
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
  }
  .req-estado {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: capitalize;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
  }
  .req-id {
    font-size: 0.65rem;
    color: #94a3b8;
    margin-left: auto;
    font-family: monospace;
  }
  .req-mini-desc {
    font-size: 0.8rem;
    color: #334155;
    margin: 0;
  }
  .req-mini-footer {
    display: flex;
    gap: 1rem;
    font-size: 0.7rem;
    color: #64748b;
    margin-top: 0.35rem;
  }

  /* Form */
  .start-form {
    display: flex;
    justify-content: center;
    padding: 2rem;
  }
  .form-section-title {
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
  }
  .form-hint {
    font-size: 0.78rem;
    color: #64748b;
    margin: 0 0 0.75rem;
  }
  .form-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .field label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
  }
  .field label small {
    font-weight: 400;
    color: #94a3b8;
  }
  .field input,
  .field textarea,
  .field select {
    padding: 0.55rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
  }
  .field input:focus,
  .field textarea:focus,
  .field select:focus {
    border-color: #2563eb;
  }

  /* Centro Gestor chips */
  .centros-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.25rem;
  }
  .cg-chip {
    padding: 0.3rem 0.6rem;
    border: 2px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    background: white;
    transition: all 0.2s;
  }
  .cg-chip:hover {
    border-color: #93c5fd;
  }
  .cg-chip.selected {
    border-color: currentColor;
  }
  .selected-cgs {
    font-size: 0.72rem;
    color: #2563eb;
    margin-top: 0.25rem;
  }

  /* Req header */
  .req-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .remove-req-btn {
    background: none;
    border: none;
    color: #ef4444;
    font-size: 0.8rem;
    cursor: pointer;
    font-weight: 600;
  }

  /* Add req */
  .add-req-row {
    display: flex;
    justify-content: center;
  }
  .add-req-btn {
    background: #f0f7ff;
    border: 2px dashed #93c5fd;
    color: #2563eb;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    transition: all 0.2s;
  }
  .add-req-btn:hover {
    background: #dbeafe;
  }

  .submit-row {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  /* Foto Evidence */
  .foto-upload-area {
    margin-top: 0.25rem;
  }
  .foto-upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #f0f7ff;
    border: 2px dashed #93c5fd;
    color: #2563eb;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .foto-upload-btn:hover {
    background: #dbeafe;
  }
  .foto-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 20px;
    height: 20px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    border-radius: 50%;
    font-size: 0.65rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nota-voz-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #166534;
  }
  .nota-voz-info .foto-remove {
    position: static;
    width: 22px;
    height: 22px;
    margin-left: auto;
  }

  @media (max-width: 640px) {
    .form-grid-2 {
      grid-template-columns: 1fr;
    }
    .up-banner {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
