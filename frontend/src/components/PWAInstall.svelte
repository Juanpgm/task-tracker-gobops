<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    isStandalone,
    isIOS,
    isSafari,
    wasRecentlyDismissed,
    markDismissed,
    type BeforeInstallPromptEvent,
  } from '../lib/pwa';

  let deferred: BeforeInstallPromptEvent | null = null;
  let canInstall = false;       // Chromium-style installable
  let showIosGuide = false;     // iOS Safari install guide modal
  let visible = false;          // Floating chip visibility
  let installing = false;

  function refreshVisibility() {
    if (isStandalone()) { visible = false; return; }
    if (wasRecentlyDismissed()) { visible = false; return; }
    if (canInstall) { visible = true; return; }
    if (isIOS() && isSafari()) { visible = true; return; }
    visible = false;
  }

  function onBeforeInstallPrompt(e: Event) {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    canInstall = true;
    refreshVisibility();
  }

  function onAppInstalled() {
    canInstall = false;
    deferred = null;
    visible = false;
  }

  async function handleInstall() {
    if (deferred) {
      try {
        installing = true;
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === 'dismissed') markDismissed();
        deferred = null;
        canInstall = false;
      } finally {
        installing = false;
        refreshVisibility();
      }
    } else if (isIOS() && isSafari()) {
      showIosGuide = true;
    }
  }

  function dismiss() {
    markDismissed();
    visible = false;
    showIosGuide = false;
  }

  onMount(() => {
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    refreshVisibility();
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  });
</script>

{#if visible}
  <button
    type="button"
    class="pwa-chip"
    on:click={handleInstall}
    disabled={installing}
    aria-label="Instalar app"
    title="Instalar GobOps en este dispositivo"
  >
    <!-- Download icon -->
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>Instalar app</span>
    <span
      class="pwa-chip__close"
      role="button"
      tabindex="0"
      aria-label="Descartar"
      on:click|stopPropagation={dismiss}
      on:keydown|stopPropagation={(e) => { if (e.key === 'Enter' || e.key === ' ') dismiss(); }}
    >×</span>
  </button>
{/if}

{#if showIosGuide}
  <div class="ios-guide-backdrop" on:click={() => (showIosGuide = false)} role="presentation">
    <div class="ios-guide" on:click|stopPropagation role="dialog" aria-modal="true" aria-labelledby="ios-guide-title">
      <h3 id="ios-guide-title">Instalar GobOps en tu iPhone/iPad</h3>
      <ol>
        <li>Toca el botón <strong>Compartir</strong>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          en la barra inferior de Safari.
        </li>
        <li>Desplázate y selecciona <strong>Añadir a pantalla de inicio</strong>.</li>
        <li>Pulsa <strong>Añadir</strong>. El ícono de la app aparecerá en tu pantalla principal.</li>
      </ol>
      <p class="ios-guide__hint">
        Esto te permitirá usar la app a pantalla completa, recibir notificaciones (iOS 16.4+)
        y acceder más rápido al hardware del dispositivo.
      </p>
      <div class="ios-guide__actions">
        <button type="button" on:click={dismiss}>Entendido</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .pwa-chip {
    position: fixed;
    right: max(1rem, env(safe-area-inset-right));
    bottom: calc(1rem + env(safe-area-inset-bottom));
    z-index: 950;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: var(--primary, #2563eb);
    color: #fff;
    font: 600 0.875rem/1 var(--font-sans, system-ui);
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35);
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .pwa-chip:hover { transform: translateY(-1px); }
  .pwa-chip:active { transform: translateY(0); }
  .pwa-chip[disabled] { opacity: 0.7; cursor: progress; }
  .pwa-chip__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-left: 0.25rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);
    font-size: 14px;
    line-height: 1;
    user-select: none;
  }
  .pwa-chip__close:hover { background: rgba(255, 255, 255, 0.32); }

  .ios-guide-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    z-index: 1100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 1rem;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }
  .ios-guide {
    width: 100%;
    max-width: 460px;
    background: #fff;
    border-radius: 1rem;
    padding: 1.25rem 1.25rem 1rem;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
  }
  .ios-guide h3 {
    margin: 0 0 0.75rem;
    font-size: 1.05rem;
    color: #1e293b;
  }
  .ios-guide ol {
    margin: 0 0 0.75rem 1.1rem;
    padding: 0;
    color: #334155;
    font-size: 0.95rem;
    line-height: 1.55;
  }
  .ios-guide ol li { margin-bottom: 0.4rem; }
  .ios-guide ol svg {
    vertical-align: -3px;
    color: #2563eb;
  }
  .ios-guide__hint {
    margin: 0 0 0.75rem;
    color: #64748b;
    font-size: 0.82rem;
    line-height: 1.5;
  }
  .ios-guide__actions {
    display: flex;
    justify-content: flex-end;
  }
  .ios-guide__actions button {
    padding: 0.55rem 1.1rem;
    border-radius: 0.5rem;
    border: 0;
    background: #2563eb;
    color: #fff;
    font: 600 0.9rem/1 var(--font-sans, system-ui);
    cursor: pointer;
  }
  .ios-guide__actions button:hover { background: #1d4ed8; }
</style>
