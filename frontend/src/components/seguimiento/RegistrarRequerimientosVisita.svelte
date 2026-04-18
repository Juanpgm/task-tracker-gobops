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
  let solDireccion = "";

  // Requerimientos array (one solicitante can have multiple)
  const MAX_EVIDENCIA_SIZE_MB = 50;
  const MAX_EVIDENCIAS_PER_REQ = 10;

  interface ReqDraft {
    centros_gestores: string[];
    tipo_requerimiento: string;
    descripcion: string;
    direccion: string;
    observaciones: string;
    nota_voz: File | null;
    evidencias: File[];
  }
  let requerimientosDraft: ReqDraft[] = [createEmptyReq()];

  function createEmptyReq(): ReqDraft {
    return {
      centros_gestores: [],
      tipo_requerimiento: "",
      descripcion: "",
      direccion: "",
      observaciones: "",
      nota_voz: null,
      evidencias: [],
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

  function handleEvidencias(reqIdx: number, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const current = requerimientosDraft[reqIdx].evidencias;
    const newFiles = Array.from(input.files);
    const combined = [...current, ...newFiles];

    // Validate max count
    if (combined.length > MAX_EVIDENCIAS_PER_REQ) {
      errorMsg = `Requerimiento #${reqIdx + 1}: Máximo ${MAX_EVIDENCIAS_PER_REQ} archivos permitidos`;
      input.value = "";
      return;
    }

    // Validate file sizes
    for (const file of newFiles) {
      if (file.size > MAX_EVIDENCIA_SIZE_MB * 1024 * 1024) {
        errorMsg = `"${file.name}" excede el límite de ${MAX_EVIDENCIA_SIZE_MB}MB`;
        input.value = "";
        return;
      }
    }

    requerimientosDraft[reqIdx].evidencias = combined;
    requerimientosDraft = [...requerimientosDraft];
    input.value = "";
  }

  function removeEvidencia(reqIdx: number, fileIdx: number) {
    requerimientosDraft[reqIdx].evidencias = requerimientosDraft[reqIdx].evidencias.filter((_, i) => i !== fileIdx);
    requerimientosDraft = [...requerimientosDraft];
  }

  function getFilePreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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

    // Close CG dropdowns on outside click
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      for (let i = 0; i < cgDropdownOpen.length; i++) {
        if (cgDropdownOpen[i] && !target.closest(`.cg-dropdown-container-${i}`)) {
          closeCgDropdown(i);
        }
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
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

  // Searchable CG dropdown state per requirement
  let cgSearches: string[] = [];
  let cgDropdownOpen: boolean[] = [];

  function getCgFiltered(idx: number) {
    const term = (cgSearches[idx] || "").toLowerCase();
    if (!term) return CENTROS_GESTORES;
    return CENTROS_GESTORES.filter(
      (cg) =>
        cg.nombre.toLowerCase().includes(term) ||
        cg.sigla.toLowerCase().includes(term),
    );
  }

  function openCgDropdown(idx: number) {
    cgDropdownOpen[idx] = true;
    cgDropdownOpen = [...cgDropdownOpen];
  }

  function closeCgDropdown(idx: number) {
    cgDropdownOpen[idx] = false;
    cgSearches[idx] = "";
    cgDropdownOpen = [...cgDropdownOpen];
    cgSearches = [...cgSearches];
  }

  function handleCgClickOutside(idx: number, e: MouseEvent) {
    const target = e.target as HTMLElement;
    const container = target.closest(`.cg-dropdown-container-${idx}`);
    if (!container) closeCgDropdown(idx);
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
      // Validate evidencias
      if (req.evidencias.length > MAX_EVIDENCIAS_PER_REQ) {
        errorMsg = `Requerimiento #${i + 1}: Máximo ${MAX_EVIDENCIAS_PER_REQ} archivos permitidos`;
        return;
      }
      for (const file of req.evidencias) {
        if (file.size > MAX_EVIDENCIA_SIZE_MB * 1024 * 1024) {
          errorMsg = `Requerimiento #${i + 1}: "${file.name}" excede ${MAX_EVIDENCIA_SIZE_MB}MB`;
          return;
        }
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
              direccion: solDireccion || undefined,
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
          direccion_requerimiento: req.direccion || undefined,
          observaciones: req.observaciones,
          coords,
          organismos_encargados: organismosEncargados,
          nota_voz: req.nota_voz,
          evidencias: req.evidencias.length > 0 ? req.evidencias : null,
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
      solDireccion = "";
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
              <div class="field" style="grid-column: 1 / -1;">
                <label for="sol-direccion">Dirección del Solicitante</label>
                <input
                  id="sol-direccion"
                  type="text"
                  bind:value={solDireccion}
                  placeholder="Calle 1 #2-3, Barrio..."
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

              <!-- Centro Gestor Multi-Select Dropdown -->
              <div class="field">
                <!-- svelte-ignore a11y-label-has-associated-control -->
                <label
                  >Centro(s) Gestor(es) * <small>(multi-selección)</small
                  ></label
                >
                <div class="cg-dropdown-container cg-dropdown-container-{idx}">
                  {#if req.centros_gestores.length > 0}
                    <div class="cg-selected-chips">
                      {#each req.centros_gestores as nombre}
                        {@const cg = CENTROS_GESTORES.find((c) => c.nombre === nombre)}
                        <span
                          class="cg-sel-chip"
                          style="background: {cg?.color || '#2563eb'}; color: white;"
                        >
                          {cg?.sigla || nombre}
                          <button
                            type="button"
                            class="cg-chip-remove"
                            on:click={() => toggleCentroGestor(idx, nombre)}
                          >&times;</button>
                        </span>
                      {/each}
                    </div>
                  {/if}
                  <input
                    type="text"
                    class="cg-search-input"
                    placeholder="Buscar organismo..."
                    bind:value={cgSearches[idx]}
                    on:focus={() => openCgDropdown(idx)}
                    on:input={() => openCgDropdown(idx)}
                    on:keydown={(e) => e.key === "Escape" && closeCgDropdown(idx)}
                    autocomplete="off"
                  />
                  {#if cgDropdownOpen[idx]}
                    <ul class="cg-dropdown-list">
                      {#each getCgFiltered(idx) as cg (cg.id)}
                        <li>
                          <button
                            type="button"
                            class="cg-dropdown-option"
                            class:active={req.centros_gestores.includes(cg.nombre)}
                            on:click={() => toggleCentroGestor(idx, cg.nombre)}
                          >
                            <span
                              class="cg-check"
                              class:checked={req.centros_gestores.includes(cg.nombre)}
                              style="border-color: {cg.color}; {req.centros_gestores.includes(cg.nombre) ? `background: ${cg.color};` : ''}"
                            >{#if req.centros_gestores.includes(cg.nombre)}✓{/if}</span>
                            <span class="cg-option-sigla" style="color: {cg.color}">{cg.sigla}</span>
                            <span class="cg-option-nombre">{cg.nombre}</span>
                          </button>
                        </li>
                      {:else}
                        <li class="cg-no-results">Sin resultados</li>
                      {/each}
                    </ul>
                  {/if}
                </div>
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
                <label for="req-dir-{idx}">Dirección</label>
                <input
                  id="req-dir-{idx}"
                  type="text"
                  bind:value={req.direccion}
                  placeholder="Dirección del requerimiento..."
                />
              </div>

              <div class="field">
                <label for="req-obs-{idx}">Observaciones</label>
                <textarea
                  id="req-obs-{idx}"
                  bind:value={req.observaciones}
                  rows="2"
                  placeholder="Observaciones adicionales (opcional)..."
                ></textarea>
              </div>

              <!-- Adjuntos: Fotos/Videos + Audio -->
              <div class="media-attachments">
                <!-- svelte-ignore a11y-label-has-associated-control -->
                <label class="field-label-subtle">Adjuntos <small>(opcional)</small></label>
                <div class="media-actions">
                  <label class="media-btn" title="Tomar foto o video">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span>Cámara</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      on:change={(e) => handleEvidencias(idx, e)}
                      hidden
                    />
                  </label>
                  <label class="media-btn" title="Elegir de galería">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span>Galería</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      on:change={(e) => handleEvidencias(idx, e)}
                      hidden
                    />
                  </label>
                  <label class="media-btn" title="Nota de audio">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    <span>Audio</span>
                    <input
                      type="file"
                      accept="audio/*"
                      on:change={(e) => handleNotaVoz(idx, e)}
                      hidden
                    />
                  </label>
                </div>
                <small class="media-hint">Máx. {MAX_EVIDENCIAS_PER_REQ} fotos/videos ({MAX_EVIDENCIA_SIZE_MB}MB c/u)</small>

                {#if req.evidencias.length > 0}
                  <div class="evidencias-grid">
                    {#each req.evidencias as file, fIdx (fIdx)}
                      <div class="evidencia-thumb">
                        {#if file.type.startsWith("image/")}
                          <img src={getFilePreviewUrl(file)} alt={file.name} class="evidencia-img" />
                        {:else}
                          <div class="evidencia-video-placeholder">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </div>
                        {/if}
                        <button
                          class="evidencia-remove"
                          on:click={() => removeEvidencia(idx, fIdx)}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        <span class="evidencia-size">{formatFileSize(file.size)}</span>
                      </div>
                    {/each}
                  </div>
                {/if}

                {#if req.nota_voz}
                  <div class="nota-voz-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                    <span class="nota-voz-name">{req.nota_voz.name}</span>
                    <button
                      class="nota-voz-remove"
                      on:click={() => removeNotaVoz(idx)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
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
    color: #1e293b;
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
    padding: 0.6rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
    background: #fff;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .field input:focus,
  .field textarea:focus,
  .field select:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
  }
  .field input::placeholder,
  .field textarea::placeholder {
    color: #cbd5e1;
  }

  /* Centro Gestor searchable dropdown */
  .cg-dropdown-container {
    position: relative;
  }
  .cg-selected-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.35rem;
  }
  .cg-sel-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1.4;
  }
  .cg-chip-remove {
    background: none;
    border: none;
    color: inherit;
    font-size: 0.85rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.8;
    padding: 0;
  }
  .cg-chip-remove:hover { opacity: 1; }
  .cg-search-input {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1.5px solid var(--border);
    border-radius: 0.5rem;
    font-size: 0.82rem;
    outline: none;
    background: white;
    color: var(--text);
  }
  .cg-search-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
  }
  .cg-search-input::placeholder { color: #cbd5e1; }
  .cg-dropdown-list {
    position: absolute;
    z-index: 50;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 220px;
    overflow-y: auto;
    background: white;
    border: 1.5px solid var(--border);
    border-top: none;
    border-radius: 0 0 0.5rem 0.5rem;
    box-shadow: var(--shadow-md);
    list-style: none;
    margin: 0;
    padding: 0.25rem 0;
  }
  .cg-dropdown-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.45rem 0.65rem;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.8rem;
    text-align: left;
    color: var(--text);
    transition: background 0.1s;
  }
  .cg-dropdown-option:hover { background: #f1f5f9; }
  .cg-dropdown-option.active { background: #eff6ff; }
  .cg-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: 1.5px solid #cbd5e1;
    border-radius: 3px;
    font-size: 0.65rem;
    color: white;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .cg-check.checked {
    border-color: currentColor;
  }
  .cg-option-sigla {
    font-weight: 700;
    font-size: 0.72rem;
    min-width: 42px;
  }
  .cg-option-nombre {
    color: #475569;
    font-size: 0.78rem;
  }
  .cg-no-results {
    padding: 0.6rem 0.65rem;
    color: #94a3b8;
    font-size: 0.8rem;
    text-align: center;
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
    background: #f8fafc;
    border: 1.5px dashed #cbd5e1;
    color: #64748b;
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    transition: all 0.2s;
  }
  .add-req-btn:hover {
    background: #f0f7ff;
    border-color: #93c5fd;
    color: #2563eb;
  }

  .submit-row {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  /* ── Media Attachments (unified) ── */
  .media-attachments {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .field-label-subtle {
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
  }
  .field-label-subtle small {
    font-weight: 400;
    color: #94a3b8;
  }
  .media-actions {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .media-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #475569;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }
  .media-btn:hover {
    background: #f8fafc;
    border-color: #94a3b8;
    color: #1e293b;
  }
  .media-btn:active {
    background: #f1f5f9;
  }
  .media-btn svg {
    flex-shrink: 0;
    opacity: 0.7;
  }
  .media-hint {
    font-size: 0.68rem;
    color: #94a3b8;
    margin-top: -0.1rem;
  }

  /* Evidencias grid */
  .evidencias-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.4rem;
    margin-top: 0.35rem;
  }
  .evidencia-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .evidencia-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .evidencia-video-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    color: #94a3b8;
  }
  .evidencia-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    backdrop-filter: blur(4px);
    transition: background 0.15s;
  }
  .evidencia-remove:hover {
    background: rgba(220, 38, 38, 0.8);
  }
  .evidencia-size {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.45);
    color: white;
    font-size: 0.6rem;
    text-align: center;
    padding: 1px 0;
    backdrop-filter: blur(2px);
  }

  /* Nota de Voz chip */
  .nota-voz-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.35rem;
    padding: 0.35rem 0.65rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 20px;
    font-size: 0.78rem;
    color: #166534;
    max-width: 100%;
  }
  .nota-voz-chip svg {
    flex-shrink: 0;
    opacity: 0.7;
  }
  .nota-voz-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .nota-voz-remove {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: none;
    border: none;
    cursor: pointer;
    color: #16a34a;
    border-radius: 50%;
    margin-left: auto;
    transition: background 0.15s;
  }
  .nota-voz-remove:hover {
    background: rgba(22, 163, 74, 0.12);
    color: #dc2626;
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
