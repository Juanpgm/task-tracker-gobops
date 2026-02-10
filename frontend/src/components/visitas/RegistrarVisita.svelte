<script lang="ts">
  import { onMount } from 'svelte';
  import { navigationStore } from '../../stores/navigationStore';
  import { getUnidadesProyecto, registrarVisita } from '../../api/visitas';
  import type { UnidadProyecto, RegistrarVisitaPayload } from '../../types';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Select from '../ui/Select.svelte';
  import Alert from '../ui/Alert.svelte';
  import Card from '../ui/Card.svelte';

  let loading = false;
  let submitting = false;
  let successMsg = '';
  let errorMsg = '';
  let unidades: UnidadProyecto[] = [];
  let unidadOptions: { value: string; label: string }[] = [];

  let form: RegistrarVisitaPayload = {
    nombre_up: '',
    nombre_up_detalle: '',
    barrio_vereda: '',
    comuna_corregimiento: '',
    fecha_visita: new Date().toISOString().split('T')[0],
  };

  onMount(async () => {
    loading = true;
    try {
      unidades = await getUnidadesProyecto();
      unidadOptions = unidades.map((u) => ({
        value: u.upid,
        label: `${u.nombre_up} - ${u.nombre_up_detalle} (${u.direccion})`,
      }));
    } catch (err) {
      errorMsg = 'Error al cargar unidades de proyecto.';
      console.error(err);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit() {
    if (!form.nombre_up || !form.fecha_visita) {
      errorMsg = 'Por favor, complete todos los campos obligatorios.';
      return;
    }
    submitting = true;
    errorMsg = '';
    successMsg = '';
    try {
      const result = await registrarVisita(form);
      successMsg = `Visita registrada exitosamente. ${result.vid ? `ID: ${result.vid}` : ''}`;
      // Reset form
      form = {
        nombre_up: '',
        nombre_up_detalle: '',
        barrio_vereda: '',
        comuna_corregimiento: '',
        fecha_visita: new Date().toISOString().split('T')[0],
      };
    } catch (err) {
      errorMsg = 'Error al registrar la visita. Intente de nuevo.';
      console.error(err);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.goHome()}>← Volver</button>
    <h2 class="view-title">� Programar Visita</h2>
  </header>

  <main class="view-body container">
    {#if loading}
      <div class="spinner"></div>
    {:else}
      {#if successMsg}
        <Alert type="success" message={successMsg} />
      {/if}
      {#if errorMsg}
        <Alert type="error" message={errorMsg} />
      {/if}

      <Card padding="lg">
        <form on:submit|preventDefault={handleSubmit} class="form">
          <Select
            id="nombre_up"
            label="Unidad de Proyecto"
            bind:value={form.nombre_up}
            options={unidadOptions}
            required
            placeholder="-- Seleccione una unidad --"
          />

          <Input
            id="nombre_up_detalle"
            label="Detalle de Unidad de Proyecto"
            placeholder="Ej: Sector norte, zona residencial"
            bind:value={form.nombre_up_detalle}
          />

          <Input
            id="barrio_vereda"
            label="Barrio / Vereda"
            placeholder="Se obtiene de la unidad de proyecto"
            bind:value={form.barrio_vereda}
          />

          <Input
            id="comuna_corregimiento"
            label="Comuna / Corregimiento"
            placeholder="Se obtiene de la unidad de proyecto"
            bind:value={form.comuna_corregimiento}
          />

          <Input
            id="fecha_visita"
            type="date"
            label="Fecha de la Visita"
            bind:value={form.fecha_visita}
            required
          />

          <div class="form-actions">
            <Button variant="secondary" on:click={() => navigationStore.goHome()}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting}>
              {submitting ? 'Registrando...' : 'Registrar Visita'}
            </Button>
          </div>
        </form>
      </Card>
    {/if}
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
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }
</style>
