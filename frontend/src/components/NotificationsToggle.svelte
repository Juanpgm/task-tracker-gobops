<script lang="ts">
  import { onMount } from 'svelte';
  import {
    detectPushSupport,
    getExistingSubscription,
    subscribePush,
    unsubscribePush,
  } from '../lib/push';

  let enabled = false;
  let busy = false;
  let support = detectPushSupport();
  let error = '';

  onMount(async () => {
    if (!support.ok) return;
    try {
      const sub = await getExistingSubscription();
      enabled = !!sub && Notification.permission === 'granted';
    } catch {
      enabled = false;
    }
  });

  async function toggle() {
    if (busy) return;
    busy = true;
    error = '';
    try {
      if (enabled) {
        await unsubscribePush();
        enabled = false;
      } else {
        await subscribePush();
        enabled = true;
      }
    } catch (e: any) {
      error = e?.message ?? 'Error desconocido';
    } finally {
      busy = false;
    }
  }

  $: hintText = (() => {
    if (support.ok) return '';
    if (support.reason === 'ios-needs-install')
      return 'Instala la app desde Safari (Compartir → Añadir a inicio) para activar las notificaciones.';
    if (support.reason === 'no-notification') return 'Tu navegador no soporta notificaciones.';
    if (support.reason === 'no-push') return 'Tu navegador no soporta Web Push.';
    return 'Service Worker no disponible.';
  })();
</script>

<div class="notif-toggle">
  <div class="row">
    <div class="info">
      <div class="title">Notificaciones push</div>
      <div class="subtitle">Recibir alertas de nuevos requerimientos y visitas</div>
    </div>
    <button
      type="button"
      class="switch"
      class:on={enabled}
      class:disabled={!support.ok || busy}
      aria-pressed={enabled}
      aria-label="Activar notificaciones push"
      disabled={!support.ok || busy}
      on:click={toggle}
    >
      <span class="knob" />
    </button>
  </div>
  {#if hintText}
    <div class="hint">{hintText}</div>
  {/if}
  {#if error}
    <div class="error">{error}</div>
  {/if}
</div>

<style>
  .notif-toggle {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .title {
    font-weight: 600;
    color: #0f172a;
  }
  .subtitle {
    font-size: 0.85rem;
    color: #64748b;
    margin-top: 2px;
  }
  .switch {
    width: 46px;
    height: 26px;
    border-radius: 999px;
    background: #cbd5e1;
    border: none;
    position: relative;
    cursor: pointer;
    transition: background 150ms ease;
    flex-shrink: 0;
  }
  .switch.on {
    background: #2563eb;
  }
  .switch.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: transform 150ms ease;
  }
  .switch.on .knob {
    transform: translateX(20px);
  }
  .hint,
  .error {
    margin-top: 8px;
    font-size: 0.8rem;
    line-height: 1.35;
  }
  .hint {
    color: #475569;
  }
  .error {
    color: #b91c1c;
  }
</style>
