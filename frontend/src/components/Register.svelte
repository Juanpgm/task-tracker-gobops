<script lang="ts">
  import { registerUser } from '../api/auth';
  import type { RegisterUserPayload } from '../types';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import Alert from './ui/Alert.svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let loading = false;
  let errorMsg = '';
  let successMsg = '';

  let form: RegisterUserPayload = {
    email: '',
    password: '',
    full_name: '',
    cellphone: '',
    nombre_centro_gestor: '',
  };

  async function handleSubmit() {
    if (!form.email || !form.password || !form.full_name || !form.cellphone || !form.nombre_centro_gestor) {
      errorMsg = 'Por favor, complete todos los campos.';
      return;
    }
    loading = true;
    errorMsg = '';
    successMsg = '';
    try {
      await registerUser(form);
      successMsg = 'Usuario registrado exitosamente. Ya puede iniciar sesión.';
      setTimeout(() => {
        dispatch('success');
      }, 2000);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Error al registrar usuario.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="register-wrapper">
  <div class="register-card">
    <div class="register-header">
      <div class="logo">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="12" fill="#2563eb"/>
          <path d="M14 24l6 6 14-14" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1 class="register-title">Crear Cuenta</h1>
      <p class="register-subtitle">Task Tracker GobOps</p>
    </div>

    {#if errorMsg}
      <Alert type="error" message={errorMsg} />
    {/if}
    {#if successMsg}
      <Alert type="success" message={successMsg} />
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="register-form">
      <Input
        id="full_name"
        type="text"
        label="Nombre Completo"
        placeholder="Juan Pérez"
        bind:value={form.full_name}
        required
        disabled={loading}
      />
      
      <Input
        id="email"
        type="email"
        label="Correo Electrónico"
        placeholder="usuario@ejemplo.com"
        bind:value={form.email}
        required
        disabled={loading}
      />

      <Input
        id="password"
        type="password"
        label="Contraseña"
        placeholder="Mínimo 6 caracteres"
        bind:value={form.password}
        required
        disabled={loading}
      />

      <Input
        id="cellphone"
        type="tel"
        label="Teléfono"
        placeholder="3001234567"
        bind:value={form.cellphone}
        required
        disabled={loading}
      />

      <Input
        id="nombre_centro_gestor"
        type="text"
        label="Centro Gestor"
        placeholder="Nombre del centro gestor"
        bind:value={form.nombre_centro_gestor}
        required
        disabled={loading}
      />

      <Button type="submit" fullWidth {loading} disabled={loading}>
        {loading ? 'Registrando...' : 'Crear Cuenta'}
      </Button>

      <button type="button" class="back-link" on:click={() => dispatch('back')} disabled={loading}>
        ← Volver al inicio de sesión
      </button>
    </form>
  </div>
</div>

<style>
  .register-wrapper {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 50%, #1d4ed8 100%);
    padding: var(--space-md);
  }
  .register-card {
    background: var(--surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    padding: var(--space-2xl) var(--space-xl);
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    max-height: 90vh;
    overflow-y: auto;
  }
  .register-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }
  .register-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text);
  }
  .register-subtitle {
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }
  .register-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .back-link {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.875rem;
    cursor: pointer;
    padding: var(--space-sm);
    text-align: center;
    font-family: inherit;
  }
  .back-link:hover:not(:disabled) {
    text-decoration: underline;
  }
  .back-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
