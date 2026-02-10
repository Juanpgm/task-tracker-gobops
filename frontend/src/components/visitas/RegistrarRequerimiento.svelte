<script lang="ts">
  import { navigationStore } from '../../stores/navigationStore';
  import { registrarRequerimiento } from '../../api/visitas';
  import { getCurrentPosition } from '../../lib/geolocation';
  import { getComunasCorregimientos, getBarriosVeredas } from '../../data/cali-geopolitica';
  import type { RequerimientoPayload, Coordenadas } from '../../types';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import Select from '../ui/Select.svelte';
  import Alert from '../ui/Alert.svelte';
  import Card from '../ui/Card.svelte';

  let submitting = false;
  let gettingLocation = false;
  let successMsg = '';
  let errorMsg = '';
  let coords: Coordenadas | null = null;
  let notaVozFile: File | null = null;
  let comunasOptions = getComunasCorregimientos();
  let barriosOptions: { value: string; label: string }[] = [];

  let form: Omit<RequerimientoPayload, 'nota_voz'> = {
    vid: '',
    centro_gestor_solicitante: '',
    solicitante_contacto: '',
    requerimiento: '',
    observaciones: '',
    direccion: '',
    barrio_vereda: '',
    comuna_corregimiento: '',
    latitud: '',
    longitud: '',
    telefono: '',
    email_solicitante: '',
    organismos_encargados: '',
  };

  // Cuando cambia la comuna, actualizar los barrios disponibles
  $: {
    if (form.comuna_corregimiento) {
      barriosOptions = getBarriosVeredas(form.comuna_corregimiento);
      if (form.barrio_vereda && !barriosOptions.find(b => b.value === form.barrio_vereda)) {
        form.barrio_vereda = '';
      }
    } else {
      barriosOptions = [];
      form.barrio_vereda = '';
    }
  }

  async function captureLocation() {
    gettingLocation = true;
    errorMsg = '';
    try {
      coords = await getCurrentPosition();
      form.latitud = coords.latitud.toString();
      form.longitud = coords.longitud.toString();
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Error al obtener ubicación';
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
    if (!form.vid || !form.requerimiento || !form.centro_gestor_solicitante) {
      errorMsg = 'Por favor, complete los campos obligatorios (VID, Centro Gestor, Requerimiento).';
      return;
    }
    submitting = true;
    errorMsg = '';
    successMsg = '';
    try {
      await registrarRequerimiento({
        ...form,
        nota_voz: notaVozFile,
      });
      successMsg = 'Requerimiento registrado exitosamente.';
      form = {
        vid: form.vid,
        centro_gestor_solicitante: '',
        solicitante_contacto: '',
        requerimiento: '',
        observaciones: '',
        direccion: '',
        barrio_vereda: '',
        comuna_corregimiento: '',
        latitud: form.latitud,
        longitud: form.longitud,
        telefono: '',
        email_solicitante: '',
        organismos_encargados: '',
      };
      notaVozFile = null;
    } catch (err) {
      errorMsg = 'Error al registrar el requerimiento. Intente de nuevo.';
      console.error(err);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.goHome()}>← Volver</button>
    <h2 class="view-title">📝 Registrar Requerimiento</h2>
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
          bind:value={form.vid}
          required
        />

        <Input
          id="centro_gestor_solicitante"
          label="Centro Gestor Solicitante"
          placeholder="Nombre del centro gestor"
          bind:value={form.centro_gestor_solicitante}
          required
        />

        <Input
          id="solicitante_contacto"
          label="Contacto del Solicitante"
          placeholder="Persona de contacto"
          bind:value={form.solicitante_contacto}
        />

        <Textarea
          id="requerimiento"
          label="Requerimiento"
          placeholder="Describa el requerimiento..."
          bind:value={form.requerimiento}
          required
          rows={4}
        />

        <Textarea
          id="observaciones"
          label="Observaciones"
          placeholder="Observaciones adicionales..."
          bind:value={form.observaciones}
          rows={3}
        />

        <Input
          id="direccion"
          label="Dirección"
          placeholder="Dirección del lugar"
          bind:value={form.direccion}
        />

        <Select
          id="comuna_corregimiento"
          label="Comuna/Corregimiento"
          bind:value={form.comuna_corregimiento}
          options={comunasOptions}
          required
        />
        
        <Select
          id="barrio_vereda"
          label="Barrio/Vereda"
          bind:value={form.barrio_vereda}
          options={barriosOptions}
          disabled={!form.comuna_corregimiento}
          placeholder={form.comuna_corregimiento ? 'Seleccione un barrio/vereda' : 'Primero seleccione comuna/corregimiento'}
          required
        />

        <Input
          id="telefono"
          type="tel"
          label="Teléfono"
          placeholder="3001234567"
          bind:value={form.telefono}
        />

        <Input
          id="email_solicitante"
          type="email"
          label="Email del Solicitante"
          placeholder="solicitante@ejemplo.com"
          bind:value={form.email_solicitante}
        />

        <Textarea
          id="organismos_encargados"
          label="Organismos Encargados"
          placeholder="Organismos encargados de atender el requerimiento"
          bind:value={form.organismos_encargados}
          rows={2}
        />

        <!-- Nota de Voz -->
        <div class="file-section">
          <label for="nota_voz" class="file-label">Nota de Voz (opcional)</label>
          <input
            id="nota_voz"
            type="file"
            accept="audio/*"
            on:change={handleFileChange}
            class="file-input"
          />
          {#if notaVozFile}
            <span class="file-name">📎 {notaVozFile.name}</span>
          {/if}
        </div>

        <!-- GPS -->
        <div class="gps-section">
          <label class="gps-label">Ubicación GPS</label>
          <div class="gps-row">
            <Input
              id="latitud"
              label="Latitud"
              bind:value={form.latitud}
              placeholder="0.000000"
              disabled
            />
            <Input
              id="longitud"
              label="Longitud"
              bind:value={form.longitud}
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
            📍 {gettingLocation ? 'Obteniendo...' : 'Capturar Ubicación'}
          </Button>
        </div>

        <div class="form-actions">
          <Button variant="secondary" on:click={() => navigationStore.goHome()}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrar Requerimiento'}
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
  .back-btn:hover { text-decoration: underline; }
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
</style>
