<script lang="ts">
  import { login } from "../api/auth";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import Alert from "./ui/Alert.svelte";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  let email = "";
  let password = "";
  let loading = false;
  let errorMsg = "";

  async function handleSubmit() {
    if (!email || !password) {
      errorMsg = "Por favor, complete todos los campos.";
      return;
    }

    // Validaciones básicas antes de enviar
    if (!email.includes("@")) {
      errorMsg = "Formato de correo electrónico inválido.";
      return;
    }

    if (password.length < 6) {
      errorMsg = "La contraseña debe tener al menos 6 caracteres.";
      return;
    }

    loading = true;
    errorMsg = "";

    try {
      await login(email, password);
      // El login exitoso redirigirá automáticamente a través del authStore
    } catch (error: unknown) {
      // El error ya fue procesado en la función login y guardado en authStore
      // Usar el mensaje específico de error
      if (error instanceof Error) {
        errorMsg = error.message;
      } else {
        errorMsg = "Error al iniciar sesión. Por favor, intente de nuevo.";
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-wrapper">
  <div class="login-card">
    <div class="login-header">
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
      <h1 class="login-title">Task Tracker GobOps</h1>
      <p class="login-subtitle">Sistema de gestión de visitas</p>
    </div>

    {#if errorMsg}
      <Alert type="error" message={errorMsg} />
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="login-form">
      <Input
        id="email"
        type="email"
        label="Correo electrónico"
        placeholder="usuario@ejemplo.com"
        bind:value={email}
        required
        disabled={loading}
      />
      <Input
        id="password"
        type="password"
        label="Contraseña"
        placeholder="••••••••"
        bind:value={password}
        required
        disabled={loading}
      />
      <Button type="submit" fullWidth {loading} disabled={loading}>
        {loading ? "Ingresando..." : "Iniciar Sesión"}
      </Button>
    </form>

    <div class="register-link">
      <span class="register-text">¿No tiene cuenta?</span>
      <button
        type="button"
        class="register-btn"
        on:click={() => dispatch("register")}
      >
        Crear cuenta
      </button>
    </div>

    <p class="login-footer">
      © {new Date().getFullYear()} GobOps — Grupo Operativo
    </p>
  </div>
</div>

<style>
  .login-wrapper {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 50%, #1d4ed8 100%);
    padding: var(--space-md);
  }
  .login-card {
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
  .login-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }
  .login-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text);
  }
  .login-subtitle {
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }
  .login-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .login-footer {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .register-link {
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--border);
  }
  .register-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  .register-btn {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .register-btn:hover {
    text-decoration: underline;
  }
</style>
