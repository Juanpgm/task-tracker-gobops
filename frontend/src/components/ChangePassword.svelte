<script lang="ts">
  import { changePassword } from '../api/auth';
  import { authStore } from '../stores/authStore';
  import type { ChangePasswordPayload } from '../types';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import Alert from './ui/Alert.svelte';
  import Modal from './ui/Modal.svelte';

  export let show = false;

  let loading = false;
  let errorMsg = '';
  let successMsg = '';
  let newPassword = '';
  let confirmPassword = '';

  async function handleSubmit() {
    if (!newPassword || !confirmPassword) {
      errorMsg = 'Por favor, complete todos los campos.';
      return;
    }
    if (newPassword !== confirmPassword) {
      errorMsg = 'Las contraseñas no coinciden.';
      return;
    }
    if (newPassword.length < 6) {
      errorMsg = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
    if (!$authStore.user?.uid) {
      errorMsg = 'No se pudo identificar al usuario.';
      return;
    }

    loading = true;
    errorMsg = '';
    successMsg = '';
    try {
      const payload: ChangePasswordPayload = {
        uid: $authStore.user.uid,
        new_password: newPassword,
      };
      await changePassword(payload);
      successMsg = 'Contraseña actualizada exitosamente.';
      newPassword = '';
      confirmPassword = '';
      setTimeout(() => {
        show = false;
        successMsg = '';
      }, 2000);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Error al cambiar contraseña.';
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    show = false;
    newPassword = '';
    confirmPassword = '';
    errorMsg = '';
    successMsg = '';
  }
</script>

<Modal bind:show title="Cambiar Contraseña" on:close={handleClose}>
  {#if errorMsg}
    <Alert type="error" message={errorMsg} />
  {/if}
  {#if successMsg}
    <Alert type="success" message={successMsg} />
  {/if}

  <form on:submit|preventDefault={handleSubmit} class="form">
    <Input
      id="new_password"
      type="password"
      label="Nueva Contraseña"
      placeholder="Mínimo 6 caracteres"
      bind:value={newPassword}
      required
      disabled={loading}
    />

    <Input
      id="confirm_password"
      type="password"
      label="Confirmar Contraseña"
      placeholder="Repita la contraseña"
      bind:value={confirmPassword}
      required
      disabled={loading}
    />

    <div class="form-actions">
      <Button variant="secondary" on:click={handleClose} disabled={loading}>
        Cancelar
      </Button>
      <Button type="submit" {loading} disabled={loading}>
        {loading ? 'Guardando...' : 'Cambiar Contraseña'}
      </Button>
    </div>
  </form>
</Modal>

<style>
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
