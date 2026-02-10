<script lang="ts">
  import { onMount } from 'svelte';
  import { navigationStore } from '../../stores/navigationStore';
  import { seguimientoStore } from '../../stores/seguimientoStore';
  import { getUnidadesProyecto } from '../../api/visitas';
  import { MOCK_COLABORADORES } from '../../data/mock-seguimiento';
  import type { UnidadProyecto } from '../../types';
  import type { Colaborador } from '../../types/seguimiento';
  import Button from '../ui/Button.svelte';
  import Alert from '../ui/Alert.svelte';
  import Card from '../ui/Card.svelte';

  let up: UnidadProyecto | null = null;
  let loading = true;
  let errorMsg = '';
  let successMsg = '';
  let submitting = false;

  // Form
  let fechaVisita = '';
  let horaInicio = '09:00';
  let horaFin = '12:00';
  let observaciones = '';
  let selectedColaboradores: string[] = [];
  let colaboradores: Colaborador[] = MOCK_COLABORADORES;

  onMount(async () => {
    try {
      const params = $navigationStore.params;
      const upid = params.upid;
      if (!upid) {
        errorMsg = 'No se especificó una unidad de proyecto';
        loading = false;
        return;
      }
      const allUPs = await getUnidadesProyecto();
      up = allUPs.find((u) => u.upid === upid) || null;
      if (!up) {
        errorMsg = `No se encontró la UP con ID: ${upid}`;
      }
      // Default date: tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      fechaVisita = tomorrow.toISOString().split('T')[0];
    } catch (err) {
      errorMsg = 'Error al cargar datos de la unidad de proyecto';
      console.error(err);
    } finally {
      loading = false;
    }
  });

  function toggleColaborador(id: string) {
    if (selectedColaboradores.includes(id)) {
      selectedColaboradores = selectedColaboradores.filter((c) => c !== id);
    } else {
      selectedColaboradores = [...selectedColaboradores, id];
    }
  }

  function formatCurrency(val: string): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(parseFloat(val || '0'));
  }

  function getAvanceColor(avance: string): string {
    const n = parseFloat(avance || '0');
    if (n >= 100) return '#22c55e';
    if (n >= 75) return '#84cc16';
    if (n >= 50) return '#f59e0b';
    return '#f97316';
  }

  async function handleProgramar() {
    if (!up || !fechaVisita) {
      errorMsg = 'Complete la fecha de visita';
      return;
    }
    if (selectedColaboradores.length === 0) {
      errorMsg = 'Seleccione al menos un colaborador';
      return;
    }

    submitting = true;
    errorMsg = '';

    try {
      // Simula delay de red
      await new Promise((r) => setTimeout(r, 800));

      seguimientoStore.programarVisita(
        up,
        fechaVisita,
        horaInicio,
        horaFin,
        selectedColaboradores,
        observaciones
      );

      successMsg = `✅ Visita programada exitosamente para ${fechaVisita}`;

      // Simulate Google Calendar integration notification
      setTimeout(() => {
        successMsg += '\n📅 Se envió invitación de calendario a los colaboradores asignados.';
      }, 1500);

    } catch (err) {
      errorMsg = 'Error al programar la visita';
      console.error(err);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.navigate('programar-visita')}>← Unidades</button>
    <h2 class="view-title">📅 Programar Visita</h2>
  </header>

  <main class="view-body container">
    {#if loading}
      <div class="loading-center"><div class="spinner"></div></div>
    {:else if errorMsg && !up}
      <Alert type="error" message={errorMsg} />
      <div style="margin-top: 1rem;">
        <Button on:click={() => navigationStore.navigate('programar-visita')}>Volver a Unidades</Button>
      </div>
    {:else if up}
      {#if successMsg}
        <Alert type="success" message={successMsg} />
        <div class="success-actions">
          <Button on:click={() => navigationStore.navigate('visitas-programadas')}>Ver Visitas Programadas</Button>
          <Button variant="secondary" on:click={() => navigationStore.navigate('programar-visita')}>Programar Otra</Button>
        </div>
      {:else}
        {#if errorMsg}
          <Alert type="error" message={errorMsg} />
        {/if}

        <!-- UP Info Card -->
        <Card padding="lg">
          <div class="up-info-header">
            <div class="up-badge">{up.tipo_equipamiento || 'Proyecto'}</div>
            <span class="upid-label">{up.upid}</span>
          </div>

          <h3 class="up-title">{up.nombre_up}</h3>
          <p class="up-subtitle">{up.nombre_up_detalle}</p>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">📍 Dirección</span>
              <span class="info-value">{up.direccion || 'No especificada'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">🔧 Intervención</span>
              <span class="info-value">{up.tipo_intervencion || '—'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">💰 Presupuesto</span>
              <span class="info-value">{formatCurrency(up.presupuesto_base)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">📊 Estado</span>
              <span class="info-value estado" class:terminado={up.estado === 'Terminado'}>{up.estado || 'Sin estado'}</span>
            </div>
          </div>

          <!-- Avance bar -->
          <div class="avance-section">
            <span class="avance-label">Avance de Obra</span>
            <div class="avance-bar-wrap">
              <div class="avance-bar-bg">
                <div
                  class="avance-bar-fill"
                  style="width: {up.avance_obra || 0}%; background: {getAvanceColor(up.avance_obra)}"
                ></div>
              </div>
              <span class="avance-pct">{parseFloat(up.avance_obra || '0').toFixed(0)}%</span>
            </div>
          </div>
        </Card>

        <!-- Schedule Form -->
        <Card padding="lg">
          <h3 class="section-title">📅 Datos de la Visita</h3>

          <div class="form-grid">
            <div class="form-field">
              <label for="fecha">Fecha de Visita *</label>
              <input type="date" id="fecha" bind:value={fechaVisita} required />
            </div>
            <div class="form-field">
              <label for="hora-inicio">Hora Inicio</label>
              <input type="time" id="hora-inicio" bind:value={horaInicio} />
            </div>
            <div class="form-field">
              <label for="hora-fin">Hora Fin</label>
              <input type="time" id="hora-fin" bind:value={horaFin} />
            </div>
          </div>

          <div class="form-field" style="margin-top: 0.75rem;">
            <label for="obs">Observaciones</label>
            <textarea id="obs" bind:value={observaciones} rows="3" placeholder="Notas adicionales sobre la visita..."></textarea>
          </div>
        </Card>

        <!-- Colaboradores -->
        <Card padding="lg">
          <h3 class="section-title">👥 Asignar Colaboradores *</h3>
          <p class="section-hint">Seleccione las personas que participarán en la visita. Se les enviará una invitación de calendario.</p>

          <div class="colaboradores-grid">
            {#each colaboradores as col (col.id)}
              <button
                class="col-card"
                class:selected={selectedColaboradores.includes(col.id)}
                on:click={() => toggleColaborador(col.id)}
              >
                <div class="col-avatar">{col.nombre.charAt(0)}</div>
                <div class="col-info">
                  <strong>{col.nombre}</strong>
                  <small>{col.cargo}</small>
                  <small class="col-cg">{col.centro_gestor}</small>
                </div>
                <div class="col-check">
                  {#if selectedColaboradores.includes(col.id)}✅{:else}◻️{/if}
                </div>
              </button>
            {/each}
          </div>

          {#if selectedColaboradores.length > 0}
            <p class="selected-count">{selectedColaboradores.length} colaborador{selectedColaboradores.length > 1 ? 'es' : ''} seleccionado{selectedColaboradores.length > 1 ? 's' : ''}</p>
          {/if}
        </Card>

        <!-- Submit -->
        <div class="submit-area">
          <Button variant="secondary" on:click={() => navigationStore.navigate('programar-visita')}>Cancelar</Button>
          <Button on:click={handleProgramar} loading={submitting} disabled={submitting}>
            {submitting ? 'Programando...' : '📅 Programar Visita'}
          </Button>
        </div>
      {/if}
    {/if}
  </main>
</div>

<style>
  .view { min-height: 100vh; background: #f8fafc; }
  .view-header {
    background: white; border-bottom: 1px solid #e2e8f0; padding: 0.75rem 1rem;
    display: flex; align-items: center; gap: 0.75rem; position: sticky; top: 0; z-index: 100;
  }
  .back-btn { background: none; border: none; color: #2563eb; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
  .view-title { font-size: 1.1rem; font-weight: 700; }
  .view-body { padding: 1rem 0.75rem 2rem; max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }
  .container { width: 100%; }
  .loading-center { display: flex; justify-content: center; padding: 4rem; }

  /* UP Info */
  .up-info-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
  .up-badge { background: #eff6ff; color: #2563eb; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
  .upid-label { font-size: 0.72rem; color: #94a3b8; font-family: monospace; }
  .up-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; }
  .up-subtitle { color: #64748b; font-size: 0.875rem; margin: 0.25rem 0 1rem; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .info-item { display: flex; flex-direction: column; gap: 0.15rem; }
  .info-label { font-size: 0.72rem; color: #94a3b8; font-weight: 600; }
  .info-value { font-size: 0.875rem; color: #334155; font-weight: 500; }
  .estado { padding: 0.15rem 0.5rem; border-radius: 4px; background: #fef3c7; color: #92400e; display: inline-block; font-size: 0.8rem; }
  .estado.terminado { background: #dcfce7; color: #166534; }

  .avance-section { margin-top: 1rem; }
  .avance-label { font-size: 0.72rem; color: #94a3b8; font-weight: 600; }
  .avance-bar-wrap { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; }
  .avance-bar-bg { flex: 1; height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
  .avance-bar-fill { height: 100%; border-radius: 5px; transition: width 0.3s; }
  .avance-pct { font-size: 0.875rem; font-weight: 700; min-width: 40px; text-align: right; }

  /* Form */
  .section-title { font-size: 1rem; font-weight: 700; margin: 0 0 0.75rem; color: #1e293b; }
  .section-hint { font-size: 0.8rem; color: #64748b; margin: -0.5rem 0 0.75rem; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
  .form-field label { display: block; font-size: 0.75rem; font-weight: 600; color: #475569; margin-bottom: 0.25rem; }
  .form-field input, .form-field textarea, .form-field select {
    width: 100%; padding: 0.6rem; border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: 0.875rem; font-family: inherit; outline: none;
  }
  .form-field input:focus, .form-field textarea:focus { border-color: #2563eb; }

  /* Colaboradores */
  .colaboradores-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.5rem; }
  .col-card {
    display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem;
    border: 2px solid #e2e8f0; border-radius: 8px; background: white;
    cursor: pointer; transition: all 0.2s; text-align: left; width: 100%;
  }
  .col-card:hover { border-color: #93c5fd; }
  .col-card.selected { border-color: #2563eb; background: #eff6ff; }
  .col-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: #2563eb; color: white; display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 0.875rem; flex-shrink: 0;
  }
  .col-info { flex: 1; min-width: 0; }
  .col-info strong { display: block; font-size: 0.8rem; color: #1e293b; }
  .col-info small { display: block; font-size: 0.7rem; color: #64748b; }
  .col-cg { color: #2563eb !important; font-weight: 600; }
  .col-check { font-size: 1.1rem; flex-shrink: 0; }
  .selected-count { font-size: 0.8rem; color: #2563eb; font-weight: 600; margin-top: 0.5rem; }

  /* Submit */
  .submit-area { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }
  .success-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }

  @media (max-width: 640px) {
    .form-grid { grid-template-columns: 1fr; }
    .info-grid { grid-template-columns: 1fr; }
    .colaboradores-grid { grid-template-columns: 1fr; }
  }
</style>
