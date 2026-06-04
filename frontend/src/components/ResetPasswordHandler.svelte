<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { verifyResetCode, confirmReset } from "../api/passwordReset";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import Alert from "./ui/Alert.svelte";

  const dispatch = createEventDispatcher();

  type ResetState = "verifying" | "ready" | "submitting" | "success" | "error";

  let state: ResetState = "verifying";
  let errorMsg = "";
  let verifiedEmail = "";
  let oobCode = "";
  let newPassword = "";
  let confirmPassword = "";

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    oobCode = params.get("oobCode") ?? "";

    if (mode !== "resetPassword" || !oobCode) {
      dispatch("invalid");
      return;
    }

    try {
      verifiedEmail = await verifyResetCode(oobCode);
      state = "ready";
    } catch (error: unknown) {
      state = "error";
      if (error instanceof Error) {
        if (error.message.includes("auth/expired-action-code")) {
          errorMsg =
            "El enlace ha expirado. Solicita uno nuevo desde la pantalla de inicio de sesión.";
        } else if (error.message.includes("auth/invalid-action-code")) {
          errorMsg = "Este enlace ya fue usado o es inválido. Solicita uno nuevo.";
        } else {
          errorMsg =
            "El enlace de recuperación no es válido. Solicita uno nuevo.";
        }
      }
      // Clear oobCode from URL even on verification failure
      history.replaceState({}, "", "/");
    }
  });

  async function handleSubmit() {
    errorMsg = "";

    if (!newPassword || !confirmPassword) {
      errorMsg = "Por favor, complete todos los campos.";
      return;
    }
    if (newPassword !== confirmPassword) {
      errorMsg = "Las contraseñas no coinciden.";
      return;
    }
    if (newPassword.length < 8) {
      errorMsg = "La contraseña debe tener al menos 8 caracteres.";
      return;
    }

    state = "submitting";

    try {
      await confirmReset(oobCode, newPassword);
      // Remove oobCode from URL history — prevents reuse exposure
      history.replaceState({}, "", "/");
      state = "success";
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes("auth/expired-action-code")) {
          errorMsg = "El enlace ha expirado. Solicita uno nuevo.";
          state = "error";
        } else if (error.message.includes("auth/invalid-action-code")) {
          errorMsg = "Este enlace ya fue usado. Solicita uno nuevo.";
          state = "error";
        } else if (error.message.includes("auth/weak-password")) {
          errorMsg =
            "La contraseña es demasiado débil. Usa al menos 8 caracteres.";
          state = "ready";
        } else {
          errorMsg = "No se pudo actualizar la contraseña. Intenta de nuevo.";
          state = "error";
        }
      }
    }
  }

  function goToLogin() {
    history.replaceState({}, "", "/");
    dispatch("done");
  }
</script>

<div class="reset-wrapper">
  <div class="reset-card">
    <div class="reset-header">
      <div class="logo">
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="48" height="48" rx="12" fill="#2563eb" />
          <path
            d="M14 24l6 6 14-14"
            stroke="white"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <h1 class="reset-title">Nueva Contraseña</h1>
      {#if (state === "ready" || state === "submitting") && verifiedEmail}
        <p class="reset-subtitle">
          Cuenta: <strong>{verifiedEmail}</strong>
        </p>
      {/if}
    </div>

    {#if state === "verifying"}
      <div class="verifying">
        <div class="spinner" role="status" aria-label="Verificando enlace..."></div>
        <p class="verifying-text">Verificando enlace...</p>
      </div>

    {:else if state === "ready" || state === "submitting"}
      {#if errorMsg}
        <Alert type="error" message={errorMsg} />
      {/if}
      <form on:submit|preventDefault={handleSubmit} class="reset-form">
        <Input
          id="new_password"
          type="password"
          label="Nueva contraseña"
          placeholder="Mínimo 8 caracteres"
          bind:value={newPassword}
          required
          disabled={state === "submitting"}
        />
        <Input
          id="confirm_password"
          type="password"
          label="Confirmar contraseña"
          placeholder="Repita la contraseña"
          bind:value={confirmPassword}
          required
          disabled={state === "submitting"}
        />
        <Button
          type="submit"
          fullWidth
          loading={state === "submitting"}
          disabled={state === "submitting"}
        >
          {state === "submitting"
            ? "Guardando..."
            : "Establecer nueva contraseña"}
        </Button>
      </form>

    {:else if state === "success"}
      <Alert
        type="success"
        message="Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña."
      />
      <Button fullWidth on:click={goToLogin}>Ir al inicio de sesión</Button>

    {:else if state === "error"}
      <Alert type="error" message={errorMsg} />
      <Button fullWidth on:click={goToLogin}>Volver al inicio de sesión</Button>
    {/if}
  </div>
</div>

<style>
  .reset-wrapper {
    min-height: 100vh;
    min-height: -webkit-fill-available;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 50%, #1d4ed8 100%);
    padding: var(--space-md);
  }
  .reset-card {
    background: var(--surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    padding: var(--space-2xl) var(--space-xl);
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }
  .reset-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }
  .reset-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text);
  }
  .reset-subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  .reset-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .verifying {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-lg) 0;
  }
  .verifying-text {
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
