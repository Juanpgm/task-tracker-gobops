<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { authStore } from "./stores/authStore";
  import { navigationStore } from "./stores/navigationStore";
  import { initAuthListener } from "./api/auth";
  import Login from "./components/Login.svelte";
  import Register from "./components/Register.svelte";
  import ForgotPassword from "./components/ForgotPassword.svelte";
  import ResetPasswordHandler from "./components/ResetPasswordHandler.svelte";
  import Home from "./components/Home.svelte";
  // Legacy views
  import RegistrarVisita from "./components/visitas/RegistrarVisita.svelte";
  import AsistenciaDelegado from "./components/visitas/AsistenciaDelegado.svelte";
  import AsistenciaComunidad from "./components/visitas/AsistenciaComunidad.svelte";
  import RegistrarRequerimiento from "./components/visitas/RegistrarRequerimiento.svelte";
  import Reportes from "./components/visitas/Reportes.svelte";
  // Seguimiento views
  import VisitasProgramadas from "./components/seguimiento/VisitasProgramadas.svelte";
  import RegistrarRequerimientosVisita from "./components/seguimiento/RegistrarRequerimientosVisita.svelte";
  import KanbanRequerimientos from "./components/seguimiento/KanbanRequerimientos.svelte";
  import ProgramarVisitaLibre from "./components/seguimiento/ProgramarVisitaLibre.svelte";
  import ListaRequerimientosVisita from "./components/seguimiento/ListaRequerimientosVisita.svelte";
  import DetalleUPVisita from "./components/seguimiento/DetalleUPVisita.svelte";
  import PWAInstall from "./components/PWAInstall.svelte";
  import SyncStatusBar from "./components/seguimiento/SyncStatusBar.svelte";

  let unsubscribeAuth: (() => void) | undefined;
  let showRegister = false;
  let showForgotPassword = false;
  let isResetFlow = false;

  $: currentView = $navigationStore.view;

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "resetPassword" && params.get("oobCode")) {
      isResetFlow = true;
    }
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
    showForgotPassword = false;
  }

  function handleRegisterSuccess() {
    showRegister = false;
  }

  function handleForgotPassword() {
    showForgotPassword = true;
  }

  function handleBackFromForgot() {
    showForgotPassword = false;
  }

  function handleResetDone() {
    isResetFlow = false;
  }

  function handleResetInvalid() {
    isResetFlow = false;
  }
</script>

{#if isResetFlow}
  <ResetPasswordHandler on:done={handleResetDone} on:invalid={handleResetInvalid} />
{:else if !$authStore.isAuthenticated && !$authStore.loading}
  {#if showRegister}
    <Register on:back={handleBackToLogin} on:success={handleRegisterSuccess} />
  {:else if showForgotPassword}
    <ForgotPassword on:back={handleBackFromForgot} />
  {:else}
    <Login on:register={handleRegister} on:forgot={handleForgotPassword} />
  {/if}
{:else if $authStore.isAuthenticated}
  <SyncStatusBar />
  {#if currentView === "home"}
    <Home />
    <!-- Seguimiento workflow -->
  {:else if currentView === "programar-visita"}
    <RegistrarVisita />
  {:else if currentView === "programar-visita-detalle"}
    <DetalleUPVisita />
  {:else if currentView === "programar-visita-libre"}
    <ProgramarVisitaLibre />
  {:else if currentView === "visitas-programadas"}
    <VisitasProgramadas />
  {:else if currentView === "registrar-requerimiento-visita"}
    <RegistrarRequerimientosVisita />
  {:else if currentView === "kanban"}
    <KanbanRequerimientos />
  {:else if currentView === "lista-requerimientos-visita"}
    <ListaRequerimientosVisita />
    <!-- Legacy views -->
  {:else if currentView === "asistencia-delegado"}
    <AsistenciaDelegado />
  {:else if currentView === "asistencia-comunidad"}
    <AsistenciaComunidad />
  {:else if currentView === "registrar-requerimiento"}
    <RegistrarRequerimiento />
  {:else if currentView === "reportes"}
    <Reportes />
  {:else}
    <Home />
  {/if}
{/if}

<!-- Global PWA install banner (auto-hidden when already installed or recently dismissed) -->
<PWAInstall />
