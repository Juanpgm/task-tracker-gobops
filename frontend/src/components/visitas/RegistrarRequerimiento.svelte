<script lang="ts">
  import { navigationStore } from "../../stores/navigationStore";
  import { registrarRequerimiento } from "../../api/visitas";
  import { getCurrentPosition } from "../../lib/geolocation";
  import {
    getComunasCorregimientos,
    getBarriosVeredas,
  } from "../../data/cali-geopolitica";
  import type { RequerimientoPayload, Coordenadas } from "../../types";
  import Button from "../ui/Button.svelte";
  import Input from "../ui/Input.svelte";
  import Textarea from "../ui/Textarea.svelte";
  import Select from "../ui/Select.svelte";
  import Alert from "../ui/Alert.svelte";
  import Card from "../ui/Card.svelte";
  import Icon from "../ui/Icon.svelte";

  let submitting = false;
  let gettingLocation = false;
  let successMsg = "";
  let errorMsg = "";
  let coords: Coordenadas | null = null;
  let notaVozFile: File | null = null;
  let comunasOptions = getComunasCorregimientos();
  let barriosOptions: { value: string; label: string }[] = [];

  // Form fields matching API schema
  let vid = "";
  let tipo_requerimiento = "";
  let requerimiento = "";
  let observaciones = "";
  let latitud = "";
  let longitud = "";

  // Solicitante fields (will be serialized as JSON)
  let sol_nombre = "";
  let sol_email = "";
  let sol_telefono = "";
  let sol_centro_gestor = "";

  // Organismos (comma-separated, will be serialized as JSON array)
  let organismos_text = "";

  // Quick location reference
  let selectedComuna = "";
  let selectedBarrio = "";

  // Update barrios when comuna changes
  $: {
    if (selectedComuna) {
      barriosOptions = getBarriosVeredas(selectedComuna);
      if (
        selectedBarrio &&
        !barriosOptions.find((b) => b.value === selectedBarrio)
      ) {
        selectedBarrio = "";
      }
    } else {
      barriosOptions = [];
      selectedBarrio = "";
    }
  }

  async function captureLocation() {
    gettingLocation = true;
    errorMsg = "";
    try {
      coords = await getCurrentPosition();
      latitud = coords.latitud.toString();
      longitud = coords.longitud.toString();
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Error al obtener ubicación";
    } finally {
      gettingLocation = false;
    }
  }

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      notaVozFile = target.files[0];
    }
  }

  async function handleSubmit() {
    if (!vid || !requerimiento || !tipo_requerimiento) {
      errorMsg =
        "Complete los campos obligatorios: VID, Tipo de Requerimiento y Requerimiento.";
      return;
    }
    if (!sol_nombre) {
      errorMsg = "Ingrese al menos el nombre del solicitante.";
      return;
    }

    submitting = true;
    errorMsg = "";
    successMsg = "";
    try {
      // Build datos_solicitante as JSON string
      const datosSolicitante = JSON.stringify({
        personas: [
          {
            nombre: sol_nombre,
            email: sol_email || undefined,
            telefono: sol_telefono || undefined,
            centro_gestor: sol_centro_gestor || undefined,
          },
        ],
      });

      // Build coords as GeoJSON Point string
      const coordsJson =
        latitud && longitud
          ? JSON.stringify({
              type: "Point",
              coordinates: [parseFloat(longitud), parseFloat(latitud)],
            })
          : JSON.stringify({ type: "Point", coordinates: [0, 0] });

      // Build organismos_encargados as JSON array string
      const organismos = organismos_text
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      const organismosJson = JSON.stringify(organismos);

      const payload: RequerimientoPayload = {
        vid,
        datos_solicitante: datosSolicitante,
        tipo_requerimiento,
        requerimiento,
        observaciones: observaciones || "Sin observaciones",
        coords: coordsJson,
        organismos_encargados: organismosJson,
        nota_voz: notaVozFile,
      };

      const result = await registrarRequerimiento(payload);
      successMsg = `Requerimiento registrado exitosamente. ${result.rid ? `ID: ${result.rid}` : ""}`;

      // Reset (keep vid and coords)
      tipo_requerimiento = "";
      requerimiento = "";
      observaciones = "";
      sol_nombre = "";
      sol_email = "";
      sol_telefono = "";
      sol_centro_gestor = "";
      organismos_text = "";
      notaVozFile = null;
    } catch (err) {
      errorMsg = "Error al registrar el requerimiento. Intente de nuevo.";
      console.error(err);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.goHome()}
      >← Volver</button
    >
    <h2 class="view-title"><Icon name="edit" size={20} /> Registrar Requerimiento</h2>
  </header>

  <main class="view-body container">
    {#if successMsg}
      <Alert type="success" message={successMsg} />
    {/if}
    {#if errorMsg}
      <Alert type="error" message={errorMsg} />
    {/if}

    <Card padding="lg">
      <form on:submit|preventDefault={handleSubmit} class="form">
        <Input
          id="vid"
          label="ID de Visita (VID)"
          placeholder="ID de la visita asociada"
          bind:value={vid}
          required
        />

        <Input
          id="tipo_requerimiento"
          label="Tipo de Requerimiento"
          placeholder="Ej: Mejoramiento vial, Arbolado, Alcantarillado"
          bind:value={tipo_requerimiento}
          required
        />

        <Textarea
          id="requerimiento"
          label="Descripción del Requerimiento"
          placeholder="Describa el requerimiento..."
          bind:value={requerimiento}
          required
          rows={4}
        />

        <Textarea
          id="observaciones"
          label="Observaciones"
          placeholder="Observaciones adicionales..."
          bind:value={observaciones}
          rows={3}
        />

        <fieldset class="fieldset">
          <legend><Icon name="user" size={16} /> Datos del Solicitante</legend>
          <Input
            id="sol_nombre"
            label="Nombre Completo"
            placeholder="Nombre del solicitante"
            bind:value={sol_nombre}
            required
          />
          <Input
            id="sol_telefono"
            type="tel"
            label="Teléfono"
            placeholder="Ej: +57 300 1234567"
            bind:value={sol_telefono}
          />
          <Input
            id="sol_email"
            type="email"
            label="Email"
            placeholder="solicitante@ejemplo.com"
            bind:value={sol_email}
          />
          <Input
            id="sol_centro_gestor"
            label="Centro Gestor"
            placeholder="Ej: DAGMA"
            bind:value={sol_centro_gestor}
          />
        </fieldset>

        <Textarea
          id="organismos_encargados"
          label="Organismos Encargados (separados por coma)"
          placeholder="Ej: DAGMA, Secretaría de Obras, EMCALI"
          bind:value={organismos_text}
          rows={2}
        />

        <!-- Location reference (optional, for context) -->
        <Select
          id="comuna_corregimiento"
          label="Comuna/Corregimiento (referencia)"
          bind:value={selectedComuna}
          options={comunasOptions}
          placeholder="-- Seleccione --"
        />

        {#if selectedComuna}
          <Select
            id="barrio_vereda"
            label="Barrio/Vereda (referencia)"
            bind:value={selectedBarrio}
            options={barriosOptions}
            placeholder="Seleccione un barrio/vereda"
          />
        {/if}

        <!-- Nota de Voz -->
        <div class="file-section">
          <label for="nota_voz" class="file-label">Nota de Voz (opcional)</label
          >
          <input
            id="nota_voz"
            type="file"
            accept="audio/*"
            on:change={handleFileChange}
            class="file-input"
          />
          {#if notaVozFile}
            <span class="file-name"><Icon name="paperclip" size={14} /> {notaVozFile.name}</span>
          {/if}
        </div>

        <!-- GPS -->
        <div class="gps-section">
          <label class="gps-label" for="latitud"
            >Ubicación GPS (coordenadas del dispositivo)</label
          >
          <div class="gps-row">
            <Input
              id="latitud"
              label="Latitud"
              bind:value={latitud}
              placeholder="0.000000"
              disabled
            />
            <Input
              id="longitud"
              label="Longitud"
              bind:value={longitud}
              placeholder="0.000000"
              disabled
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            on:click={captureLocation}
            loading={gettingLocation}
            disabled={gettingLocation}
          >
            <Icon name="crosshair" size={16} /> {gettingLocation ? "Obteniendo..." : "Capturar Ubicación"}
          </Button>
        </div>

        <div class="form-actions">
          <Button variant="secondary" on:click={() => navigationStore.goHome()}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting}>
            {submitting ? "Registrando..." : "Registrar Requerimiento"}
          </Button>
        </div>
      </form>
    </Card>
  </main>
</div>

<style>
  .view {
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bg);
  }
  .view-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: var(--space-md);
    display: flex;
    align-items: center;
    gap: var(--space-md);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .back-btn {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .back-btn:hover {
    text-decoration: underline;
  }
  .view-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text);
  }
  .view-body {
    padding-top: var(--space-lg);
    padding-bottom: var(--space-2xl);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .file-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .file-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }
  .file-input {
    font-size: 0.875rem;
    font-family: inherit;
  }
  .file-name {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }
  .gps-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .gps-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }
  .gps-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }
  .fieldset {
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 8px;
    padding: var(--space-md, 1rem);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm, 0.5rem);
  }
  .fieldset legend {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--text);
    padding: 0 0.4rem;
  }
</style>
