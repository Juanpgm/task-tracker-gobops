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
  import { viewComponents } from "./lib/viewRegistry";
  import PWAInstall from "./components/PWAInstall.svelte";
  import SyncStatusBar from "./components/seguimiento/SyncStatusBar.svelte";

  let unsubscribeAuth: (() => void) | undefined;
  let showRegister = false;
  let showForgotPassword = false;
  let isResetFlow = false;

  $: currentView = $navigationStore.view;
  $: currentComponent = viewComponents[currentView];

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
  {#if currentComponent}
    <svelte:component this={currentComponent} />
  {:else}
    <Home />
  {/if}
{/if}

<!-- Global PWA install banner (auto-hidden when already installed or recently dismissed) -->
<PWAInstall />
