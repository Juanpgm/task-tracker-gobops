<script lang="ts">
  import { navigationStore } from '../../stores/navigationStore';
  import { registrarAsistenciaDelegado } from '../../api/visitas';
  import { getCurrentPosition } from '../../lib/geolocation';
  import type { AsistenciaDelegadoPayload, Coordenadas } from '../../types';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Alert from '../ui/Alert.svelte';
  import Card from '../ui/Card.svelte';

  let submitting = false;
  let gettingLocation = false;
  let successMsg = '';
  let errorMsg = '';
  let coords: Coordenadas | null = null;

  let form: AsistenciaDelegadoPayload = {
    vid: '',
    id_acompanante: '',
    nombre_completo: '',
    rol: '',
    nombre_centro_gestor: '',
    telefono: '',
    email: '',
    latitud: '',
    longitud: '',
  };

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
    if (!form.vid || !form.id_acompanante || !form.nombre_completo || !form.rol || !form.nombre_centro_gestor) {
      errorMsg = 'Por favor, complete todos los campos obligatorios.';
      return;
    }
    submitting = true;
    errorMsg = '';
    successMsg = '';
    try {
      await registrarAsistenciaDelegado(form);
      successMsg = 'Asistencia de delegado registrada exitosamente.';
      form = {
        vid: form.vid,
        id_acompanante: '',
        nombre_completo: '',
        rol: '',
        nombre_centro_gestor: '',
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
    <h2 class="view-title">👤 Asistencia Delegado</h2>
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
          id="id_acompanante"
          label="Identificación del Acompañante"
          placeholder="Número de identificación"
          bind:value={form.id_acompanante}
          required
        />

        <Input
          id="nombre_completo"
          label="Nombre Completo"
          placeholder="Nombre completo del delegado"
          bind:value={form.nombre_completo}
          required
        />

        <Input
          id="rol"
          label="Rol"
          placeholder="Ej: Coordinador, Líder de equipo"
          bind:value={form.rol}
          required
        />

        <Input
          id="nombre_centro_gestor"
          label="Centro Gestor"
          placeholder="Nombre del centro gestor"
          bind:value={form.nombre_centro_gestor}
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
          id="email"
          type="email"
          label="Correo Electrónico"
          placeholder="delegado@ejemplo.com"
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
