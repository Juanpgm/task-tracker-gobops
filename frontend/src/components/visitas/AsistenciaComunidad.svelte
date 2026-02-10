<script lang="ts">
  import { navigationStore } from '../../stores/navigationStore';
  import { registrarAsistenciaComunidad } from '../../api/visitas';
  import { getCurrentPosition } from '../../lib/geolocation';
  import { getComunasCorregimientos, getBarriosVeredas } from '../../data/cali-geopolitica';
  import type { AsistenciaComunidadPayload, Coordenadas } from '../../types';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Select from '../ui/Select.svelte';
  import Alert from '../ui/Alert.svelte';
  import Card from '../ui/Card.svelte';

  let submitting = false;
  let gettingLocation = false;
  let successMsg = '';
  let errorMsg = '';
  let coords: Coordenadas | null = null;
  let comunasOptions = getComunasCorregimientos();
  let barriosOptions: { value: string; label: string }[] = [];

  let form: AsistenciaComunidadPayload = {
    vid: '',
    id_asistente_comunidad: '',
    nombre_completo: '',
    rol_comunidad: '',
    direccion: '',
    barrio_vereda: '',
    comuna_corregimiento: '',
    telefono: '',
    email: '',
    latitud: '',
    longitud: '',
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

  async function handleSubmit() {
    if (!form.vid || !form.id_asistente_comunidad || !form.nombre_completo || !form.rol_comunidad) {
      errorMsg = 'Por favor, complete todos los campos obligatorios.';
      return;
    }
    submitting = true;
    errorMsg = '';
    successMsg = '';
    try {
      await registrarAsistenciaComunidad(form);
      successMsg = 'Asistencia de comunidad registrada exitosamente.';
      form = {
        vid: form.vid,
        id_asistente_comunidad: '',
        nombre_completo: '',
        rol_comunidad: '',
        direccion: '',
        barrio_vereda: '',
        comuna_corregimiento: '',
        telefono: '',
        email: '',
        latitud: form.latitud,
        longitud: form.longitud,
      };
    } catch (err) {
      errorMsg = 'Error al registrar asistencia. Intente de nuevo.';
      console.error(err);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.goHome()}>← Volver</button>
    <h2 class="view-title">👥 Asistencia Comunidad</h2>
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
          id="id_asistente_comunidad"
          label="Identificación del Asistente"
          placeholder="Número de identificación"
          bind:value={form.id_asistente_comunidad}
          required
        />

        <Input
          id="nombre_completo"
          label="Nombre Completo"
          placeholder="Nombre completo del asistente"
          bind:value={form.nombre_completo}
          required
        />

        <Input
          id="rol_comunidad"
          label="Rol en la Comunidad"
          placeholder="Ej: Líder comunitario, Presidente JAC"
          bind:value={form.rol_comunidad}
          required
        />

        <Input
          id="direccion"
          label="Dirección"
          placeholder="Dirección de residencia"
          bind:value={form.direccion}
        />

        <Select
          id="comuna_corregimiento"
          label="Comuna / Corregimiento"
          bind:value={form.comuna_corregimiento}
          options={comunasOptions}
          placeholder="-- Seleccione primero la comuna o corregimiento --"
        />

        <Select
          id="barrio_vereda"
          label="Barrio / Vereda"
          bind:value={form.barrio_vereda}
          options={barriosOptions}
          disabled={!form.comuna_corregimiento}
          placeholder={form.comuna_corregimiento ? '-- Seleccione un barrio o vereda --' : '-- Primero seleccione comuna/corregimiento --'}
        />

        <Input
          id="telefono"
          type="tel"
          label="Teléfono"
          placeholder="3001234567"
          bind:value={form.telefono}
        />

        <Input
          id="email"
          type="email"
          label="Correo Electrónico"
          placeholder="asistente@ejemplo.com"
          bind:value={form.email}
        />

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
            {submitting ? 'Registrando...' : 'Registrar Asistencia'}
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
