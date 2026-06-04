<script lang="ts">
  import { navigationStore } from "../../stores/navigationStore";
  import { registrarVisita } from "../../api/visitas";
  import { reverseGeocode, type ReverseGeocodeResponse } from "../../api/geocoding";
  import { getCurrentPosition } from "../../lib/geolocation";
  import type {
    RegistrarVisitaPayload,
  } from "../../types";
  import Button from "../ui/Button.svelte";
  import Input from "../ui/Input.svelte";
  import Textarea from "../ui/Textarea.svelte";
  import Alert from "../ui/Alert.svelte";
  import Card from "../ui/Card.svelte";

  let submitting = false;
  let successMsg = "";
  let errorMsg = "";

  let direccion_visita = "";
  let descripcion_visita = "";
  let observaciones_visita = "";
  let fecha_visita = new Date().toISOString().split("T")[0];
  let hora_visita = "";

  // Geolocalización / reverse geocoding
  let locating = false;
  let geoInfo: ReverseGeocodeResponse | null = null;
  let geoError = "";
  let direccionEditada = false;

  async function usarMiUbicacion() {
    locating = true;
    geoError = "";
    try {
      const pos = await getCurrentPosition();
      const res = await reverseGeocode(pos.latitud, pos.longitud, true);
      geoInfo = res;
      // No sobrescribir si el usuario ya editó manualmente
      if (!direccionEditada || !direccion_visita.trim()) {
        direccion_visita = res.direccion_legible;
        direccionEditada = false;
      }
    } catch (err) {
      geoError = err instanceof Error ? err.message : "Error al obtener ubicación";
      console.error(err);
    } finally {
      locating = false;
    }
  }

  function onDireccionInput() {
    direccionEditada = true;
  }

  /** Convert YYYY-MM-DD to dd/mm/aaaa */
  function formatDateForAPI(isoDate: string): string {
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  }

  async function handleSubmit() {
    if (
      !direccion_visita ||
      !descripcion_visita ||
      !fecha_visita ||
      !hora_visita
    ) {
      errorMsg = "Por favor, complete todos los campos obligatorios.";
      return;
    }
    submitting = true;
    errorMsg = "";
    successMsg = "";
    try {
      const payload: RegistrarVisitaPayload = {
        direccion_visita,
        descripcion_visita,
        observaciones_visita: observaciones_visita.trim() || "Sin observaciones",
        fecha_visita: formatDateForAPI(fecha_visita),
        hora_visita,
      };
      const result = await registrarVisita(payload);
      successMsg = `Visita registrada exitosamente. ${result.vid ? `ID: ${result.vid}` : ""}`;
      // Reset
      direccion_visita = "";
      descripcion_visita = "";
      observaciones_visita = "";
      fecha_visita = new Date().toISOString().split("T")[0];
      hora_visita = "";
      geoInfo = null;
      direccionEditada = false;
      // Navegar a Visitas Programadas
      navigationStore.navigate("visitas-programadas");
    } catch (err) {
      errorMsg = "Error al registrar la visita. Intente de nuevo.";
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
    <h2 class="view-title">Programar Visita</h2>
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
        <div class="direccion-block">
          <Input
            id="direccion_visita"
            type="text"
            label="Dirección de la Visita"
            placeholder="Ej: Calle 5 # 38-20, Barrio Aguablanca"
            bind:value={direccion_visita}
            on:input={onDireccionInput}
            required
          />
          <button
            type="button"
            class="gps-btn"
            on:click={usarMiUbicacion}
            disabled={locating}
          >
            {locating ? "Localizando…" : "📍 Usar mi ubicación"}
          </button>
          {#if geoError}
            <p class="geo-error">{geoError}</p>
          {/if}
          {#if geoInfo}
            <div class="geo-context">
              {#if geoInfo.barrio_vereda}<span>Barrio: <strong>{geoInfo.barrio_vereda}</strong></span>{/if}
              {#if geoInfo.comuna_corregimiento}<span>Comuna: <strong>{geoInfo.comuna_corregimiento}</strong></span>{/if}
              {#if geoInfo.via?.nombre}<span>Vía: <strong>{geoInfo.via.nombre}</strong> ({geoInfo.via.distancia_m} m)</span>{/if}
              {#if geoInfo.cruce_mas_cercano?.nombre}<span>Cruce: <strong>{geoInfo.cruce_mas_cercano.nombre}</strong> ({geoInfo.cruce_mas_cercano.distancia_m} m)</span>{/if}
            </div>
          {/if}
        </div>

        <Textarea
          id="descripcion_visita"
          label="Descripción de la Visita"
          placeholder="Describa el propósito de la visita..."
          bind:value={descripcion_visita}
          required
          rows={3}
        />

        <Textarea
          id="observaciones_visita"
          label="Observaciones"
          placeholder="Observaciones adicionales..."
          bind:value={observaciones_visita}
          rows={2}
        />

        <div class="row-2">
          <Input
            id="fecha_visita"
            type="date"
            label="Fecha de la Visita"
            bind:value={fecha_visita}
            required
          />
          <Input
            id="hora_visita"
            type="time"
            label="Hora de la Visita"
            bind:value={hora_visita}
            required
          />
        </div>

        <div class="form-actions">
          <Button variant="secondary" on:click={() => navigationStore.goHome()}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting}>
            {submitting ? "Registrando..." : "Registrar Visita"}
          </Button>
        </div>
      </form>
    </Card>
  </main>
</div>

<style>
  .view {
    min-height: 100vh;
    min-height: -webkit-fill-available;
    min-height: 100dvh;
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
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }
  .row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
  }
  .direccion-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  .gps-btn {
    align-self: flex-start;
    background: var(--primary-soft, rgba(0, 102, 204, 0.1));
    color: var(--primary);
    border: 1px solid var(--primary);
    border-radius: var(--radius-sm, 6px);
    padding: 0.4rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .gps-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .geo-error {
    color: var(--danger, #c00);
    font-size: 0.8125rem;
    margin: 0;
  }
  .geo-context {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    font-size: 0.8125rem;
    color: var(--text-muted, #555);
    background: var(--surface-alt, rgba(0, 0, 0, 0.03));
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm, 6px);
  }
</style>
