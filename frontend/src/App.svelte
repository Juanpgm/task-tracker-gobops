<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { authStore } from './stores/authStore';
  import { navigationStore } from './stores/navigationStore';
  import { initAuthListener } from './api/auth';
  import Login from './components/Login.svelte';
  import Register from './components/Register.svelte';
  import Home from './components/Home.svelte';
  // Legacy views
  import RegistrarVisita from './components/visitas/RegistrarVisita.svelte';
  import AsistenciaDelegado from './components/visitas/AsistenciaDelegado.svelte';
  import AsistenciaComunidad from './components/visitas/AsistenciaComunidad.svelte';
  import RegistrarRequerimiento from './components/visitas/RegistrarRequerimiento.svelte';
  import Reportes from './components/visitas/Reportes.svelte';
  // Seguimiento views
  import TablaUnidadesProyecto from './components/seguimiento/TablaUnidadesProyecto.svelte';
  import DetalleUPVisita from './components/seguimiento/DetalleUPVisita.svelte';
  import VisitasProgramadas from './components/seguimiento/VisitasProgramadas.svelte';
  import RegistrarRequerimientosVisita from './components/seguimiento/RegistrarRequerimientosVisita.svelte';
  import KanbanRequerimientos from './components/seguimiento/KanbanRequerimientos.svelte';
  import DirectorioEnlaces from './components/seguimiento/DirectorioEnlaces.svelte';

  let unsubscribeAuth: (() => void) | undefined;
  let showRegister = false;

  $: currentView = $navigationStore.view;

  onMount(() => {
    unsubscribeAuth = initAuthListener();
  });

  onDestroy(() => {
    if (unsubscribeAuth) unsubscribeAuth();
  });

  function handleRegister() {
    showRegister = true;
  }

  function handleBackToLogin() {
    showRegister = false;
  }

  function handleRegisterSuccess() {
    showRegister = false;
  }
</script>

{#if $authStore.loading}
  <div class="spinner"></div>
{:else if !$authStore.isAuthenticated}
  {#if showRegister}
    <Register on:back={handleBackToLogin} on:success={handleRegisterSuccess} />
  {:else}
    <Login on:register={handleRegister} />
  {/if}
{:else}
  {#if currentView === 'home'}
    <Home />
  <!-- Seguimiento workflow -->
  {:else if currentView === 'programar-visita'}
    <TablaUnidadesProyecto />
  {:else if currentView === 'programar-visita-detalle'}
    <DetalleUPVisita />
  {:else if currentView === 'visitas-programadas'}
    <VisitasProgramadas />
  {:else if currentView === 'registrar-requerimiento-visita'}
    <RegistrarRequerimientosVisita />
  {:else if currentView === 'kanban'}
    <KanbanRequerimientos />
  {:else if currentView === 'directorio-enlaces'}
    <DirectorioEnlaces />
  <!-- Legacy views -->
  {:else if currentView === 'registrar-visita'}
    <RegistrarVisita />
  {:else if currentView === 'asistencia-delegado'}
    <AsistenciaDelegado />
  {:else if currentView === 'asistencia-comunidad'}
    <AsistenciaComunidad />
  {:else if currentView === 'registrar-requerimiento'}
    <RegistrarRequerimiento />
  {:else if currentView === 'reportes'}
    <Reportes />
  {:else}
    <Home />
  {/if}
{/if}
