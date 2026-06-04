<script lang="ts">
  import { onDestroy, createEventDispatcher } from "svelte";
  import { requestPasswordReset } from "../api/passwordReset";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import Alert from "./ui/Alert.svelte";

  const dispatch = createEventDispatcher();

  let email = "";
  let loading = false;
  let sent = false;
  let errorMsg = "";
  let cooldown = 0;
  let cooldownInterval: ReturnType<typeof setInterval> | null = null;

  const COOLDOWN_SECONDS = 60;
  const SUCCESS_MSG =
    "Si este correo está registrado, recibirás un enlace de recuperación en los próximos minutos. Revisa también tu carpeta de spam.";

  async function handleSubmit() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      errorMsg = "Por favor, ingrese su correo electrónico.";
      return;
    }
    if (!normalizedEmail.includes("@")) {
      errorMsg = "Formato de correo electrónico inválido.";
      return;
    }

    loading = true;
    errorMsg = "";

    try {
      await requestPasswordReset(normalizedEmail);
      sent = true;
      startCooldown();
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("auth/invalid-email")
      ) {
        errorMsg = "Formato de correo electrónico inválido.";
      } else {
        // Treat all other errors as success to prevent user enumeration
        sent = true;
        startCooldown();
      }
    } finally {
      loading = false;
    }
  }

  function startCooldown() {
    cooldown = COOLDOWN_SECONDS;
    cooldownInterval = setInterval(() => {
      cooldown -= 1;
      if (cooldown <= 0) {
        cooldown = 0;
        if (cooldownInterval) clearInterval(cooldownInterval);
      }
    }, 1000);
  }

  function handleResend() {
    sent = false;
    email = "";
    errorMsg = "";
  }

  onDestroy(() => {
    if (cooldownInterval) clearInterval(cooldownInterval);
  });
</script>

<div class="forgot-wrapper">
  <div class="forgot-card">
    <div class="forgot-header">
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
      <h1 class="forgot-title">Recuperar Contraseña</h1>
      <p class="forgot-subtitle">
        {#if sent}
          Revisa tu correo electrónico
        {:else}
          Ingresa tu correo para recibir un enlace de acceso
        {/if}
      </p>
    </div>

    {#if errorMsg}
      <Alert type="error" message={errorMsg} />
    {/if}

    {#if sent}
      <Alert type="success" message={SUCCESS_MSG} />
      <div class="resend-section">
        {#if cooldown > 0}
          <p class="cooldown-text">
            Podrás solicitar otro enlace en <strong>{cooldown}s</strong>
          </p>
        {:else}
          <p class="resend-hint">¿No llegó el correo?</p>
          <button type="button" class="resend-btn" on:click={handleResend}>
            Intentar con otro correo
          </button>
        {/if}
      </div>
    {:else}
      <form on:submit|preventDefault={handleSubmit} class="forgot-form">
        <Input
          id="reset_email"
          type="email"
          label="Correo electrónico"
          placeholder="usuario@ejemplo.com"
          bind:value={email}
          required
          disabled={loading}
        />
        <Button
          type="submit"
          fullWidth
          {loading}
          disabled={loading || cooldown > 0}
        >
          {loading ? "Enviando..." : "Enviar enlace de recuperación"}
        </Button>
      </form>
    {/if}

    <button
      type="button"
      class="back-link"
      on:click={() => dispatch("back")}
      disabled={loading}
    >
      ← Volver al inicio de sesión
    </button>
  </div>
</div>

<style>
  .forgot-wrapper {
    min-height: 100vh;
    min-height: -webkit-fill-available;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 50%, #1d4ed8 100%);
    padding: var(--space-md);
  }
  .forgot-card {
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
  .forgot-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }
  .forgot-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text);
  }
  .forgot-subtitle {
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }
  .forgot-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .back-link {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    text-align: center;
  }
  .back-link:hover {
    color: var(--primary);
    text-decoration: underline;
  }
  .back-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .resend-section {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }
  .cooldown-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  .resend-hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  .resend-btn {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .resend-btn:hover {
    text-decoration: underline;
  }
</style>
