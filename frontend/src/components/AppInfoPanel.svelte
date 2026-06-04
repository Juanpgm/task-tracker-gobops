<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Icon from './ui/Icon.svelte';
  import { pwaStore } from '../stores/pwaStore';
  import { isStandalone, isIOS, isAndroid, isSafari } from '../lib/pwa';
  import type { BeforeInstallPromptEvent } from '../lib/pwa';

  export let show = false;

  /* ── version / build info ─────────────────────────────────────── */
  const appVersion: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const buildDate: string  = typeof __BUILD_DATE__  !== 'undefined' ? __BUILD_DATE__  : '—';
  const isProd = import.meta.env.PROD;

  /* ── install prompt ───────────────────────────────────────────── */
  let installPrompt: BeforeInstallPromptEvent | null = null;
  let installed = false;
  let showIOSGuide = false;

  function onBeforeInstall(e: Event) {
    e.preventDefault();
    installPrompt = e as BeforeInstallPromptEvent;
  }
  function onAppInstalled() {
    installed = true;
    installPrompt = null;
  }

  onMount(() => {
    installed = isStandalone();
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
  });
  onDestroy(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    window.removeEventListener('appinstalled', onAppInstalled);
  });

  /* ── update ───────────────────────────────────────────────────── */
  let updating = false;

  async function forceUpdate() {
    updating = true;
    try {
      if ($pwaStore.updateSW) {
        await $pwaStore.updateSW(true);
      } else {
        // Fallback: ask SW to skip waiting directly
        const reg = await navigator.serviceWorker?.getRegistration?.();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          await new Promise(r => setTimeout(r, 800));
        }
        window.location.reload();
      }
    } finally {
      updating = false;
    }
  }

  async function triggerInstall() {
    if (isIOS()) {
      showIOSGuide = true;
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        installed = true;
        installPrompt = null;
      }
    }
  }

  function close() {
    show = false;
    showIOSGuide = false;
  }

  /* ── body scroll lock ─────────────────────────────────────────── */
  $: if (show) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }

  $: canInstall = !installed && (!!installPrompt || isIOS());
  $: hasUpdate = $pwaStore.needRefresh;
</script>

<!-- Backdrop -->
{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="backdrop" on:click={close} aria-hidden="true" />

  <!-- Panel -->
  <div class="panel" role="dialog" aria-modal="true" aria-label="Información de la aplicación">
    <!-- Handle -->
    <div class="handle-bar" />

    <!-- Header -->
    <div class="panel-header">
      <div class="app-identity">
        <span class="app-name">GobOps</span>
        <span class="version-badge">v{appVersion}</span>
        {#if hasUpdate}
          <span class="update-dot" title="Actualización disponible" />
        {/if}
      </div>
      <button class="close-btn" on:click={close} aria-label="Cerrar">
        <Icon name="x" size={18} />
      </button>
    </div>

    <!-- Body -->
    <div class="panel-body">

      <!-- Version info section -->
      <section class="info-section">
        <h3 class="section-title">
          <Icon name="info" size={14} />
          Información
        </h3>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Versión</span>
            <span class="info-value mono">{appVersion}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Compilación</span>
            <span class="info-value mono">{buildDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Entorno</span>
            <span class="info-value">
              <span class="env-badge" class:prod={isProd} class:dev={!isProd}>
                {isProd ? 'Producción' : 'Desarrollo'}
              </span>
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">SW / Caché</span>
            <span class="info-value">
              {#if hasUpdate}
                <span class="status-badge warning">Actualización disponible</span>
              {:else if $pwaStore.offlineReady}
                <span class="status-badge success">Listo sin conexión</span>
              {:else}
                <span class="status-badge neutral">Activo</span>
              {/if}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Modo</span>
            <span class="info-value">
              {installed ? 'Aplicación instalada' : 'Navegador web'}
            </span>
          </div>
        </div>
      </section>

      <!-- Actions section -->
      <section class="info-section">
        <h3 class="section-title">
          <Icon name="zap" size={14} />
          Acciones
        </h3>
        <div class="action-list">

          <!-- Force update -->
          <button
            class="action-row"
            class:action-highlighted={hasUpdate}
            on:click={forceUpdate}
            disabled={updating}
          >
            <span class="action-icon-wrap" class:spinning={updating}>
              <Icon name="refresh-cw" size={18} />
            </span>
            <div class="action-text">
              <span class="action-label">Forzar actualización</span>
              <span class="action-sub">
                {hasUpdate ? 'Nueva versión disponible — haz clic para instalar' : 'Verifica e instala actualizaciones del Service Worker'}
              </span>
            </div>
            {#if hasUpdate}
              <span class="dot-indicator" />
            {/if}
          </button>

        </div>
      </section>

      <!-- Install section: platform cards -->
      <section class="info-section">
        <h3 class="section-title">
          <Icon name="download" size={14} />
          Instalar aplicación
        </h3>

        {#if installed}
          <!-- Already installed -->
          <div class="install-card install-card--done">
            <span class="install-card__icon install-card__icon--green">
              <Icon name="check-circle" size={20} />
            </span>
            <div class="install-card__body">
              <span class="install-card__title">Aplicación instalada</span>
              <span class="install-card__sub">Ya estás usando GobOps como app nativa</span>
            </div>
          </div>
        {:else}
          <!-- Android card -->
          <div class="install-card" class:install-card--active={isAndroid()}>
            <div class="install-card__header">
              <span class="install-card__icon install-card__icon--android">
                <!-- Android robot icon -->
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zm-2.5-1C2.67 17 2 17.67 2 18.5v5c0 .83.67 1.5 1.5 1.5S5 24.33 5 23.5v-5C5 17.67 4.33 17 3.5 17zm17 0c-.83 0-1.5.67-1.5 1.5v5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5zM15.53 2.16l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
                </svg>
              </span>
              <div class="install-card__body">
                <span class="install-card__title">Android
                  {#if isAndroid()}<span class="platform-badge">Este dispositivo</span>{/if}
                </span>
                <span class="install-card__sub">Chrome · Samsung Internet · Edge</span>
              </div>
            </div>

            {#if installPrompt}
              <!-- Native prompt available (Chrome Android) -->
              <button class="install-btn install-btn--primary" on:click={triggerInstall}>
                <Icon name="download" size={15} />
                Instalar ahora
              </button>
              <p class="install-note">Se agregará el ícono a tu pantalla de inicio</p>
            {:else}
              <!-- Manual guide -->
              <ol class="guide-steps">
                <li>Abre esta página en <strong>Chrome</strong> o <strong>Edge</strong> para Android</li>
                <li>Toca el menú <strong>⋮</strong> (tres puntos) en la esquina superior derecha</li>
                <li>Selecciona <strong>«Agregar a pantalla de inicio»</strong> o <strong>«Instalar app»</strong></li>
                <li>Confirma tocando <strong>«Instalar»</strong></li>
              </ol>
            {/if}
          </div>

          <!-- iOS card -->
          <div class="install-card" class:install-card--active={isIOS()}>
            <div class="install-card__header">
              <span class="install-card__icon install-card__icon--ios">
                <!-- Apple icon -->
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </span>
              <div class="install-card__body">
                <span class="install-card__title">iPhone / iPad
                  {#if isIOS()}<span class="platform-badge">Este dispositivo</span>{/if}
                </span>
                <span class="install-card__sub">Safari · requiere iOS 16.4+ para notificaciones</span>
              </div>
            </div>
            <!-- iOS always needs the manual Safari guide -->
            <ol class="guide-steps">
              <li>
                Abre esta página en <strong>Safari</strong> y toca
                <svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                en la barra inferior
              </li>
              <li>Desplázate y elige <strong>«Agregar a pantalla de inicio»</strong></li>
              <li>Toca <strong>«Agregar»</strong> en la esquina superior derecha</li>
            </ol>
            {#if isIOS()}
              <button class="install-btn install-btn--secondary" on:click={() => (showIOSGuide = true)}>
                Ver guía ampliada
              </button>
            {/if}
          </div>
        {/if}
      </section>

      <!-- iOS extended guide modal -->
      {#if showIOSGuide}
        <section class="ios-guide">
          <button class="ios-guide__close" on:click={() => (showIOSGuide = false)} aria-label="Cerrar guía">
            <Icon name="x" size={14} />
          </button>
          <h3 class="section-title" style="color:#1d4ed8">Instalar en iPhone / iPad</h3>
          <ol class="guide-steps">
            <li>
              Abre esta página en <strong>Safari</strong> (no Chrome ni Firefox)
            </li>
            <li>
              Toca el botón
              <svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              <strong>Compartir</strong> en la barra inferior de Safari
            </li>
            <li>Desplázate hacia abajo y selecciona <strong>«Agregar a pantalla de inicio»</strong></li>
            <li>Confirma con <strong>«Agregar»</strong> en la esquina superior derecha</li>
          </ol>
          <p class="ios-hint">El ícono de GobOps aparecerá en tu pantalla principal. Para recibir notificaciones necesitas iOS 16.4 o superior.</p>
        </section>
      {/if}

      <!-- Footer -->
      <div class="panel-footer">
        Alcaldía de Santiago de Cali · GobOps
      </div>

    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1040;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  .panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1050;
    background: var(--surface);
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    max-height: 88dvh;
    max-height: 88vh;
    animation: slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  @keyframes slide-up {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .handle-bar {
    width: 36px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin: 10px auto 0;
    flex-shrink: 0;
  }

  /* Header */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .app-identity {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .app-name {
    font-size: 1rem;
    font-weight: 800;
    color: var(--primary);
    letter-spacing: -0.01em;
  }

  .version-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    background: var(--primary);
    color: #fff;
    border-radius: 999px;
    padding: 0 7px;
    line-height: 1.6;
    font-variant-numeric: tabular-nums;
  }

  .update-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f59e0b;
    flex-shrink: 0;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(0.85); }
  }

  .close-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s;
  }
  .close-btn:hover { background: var(--border); }

  /* Body */
  .panel-body {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    flex: 1;
    padding: var(--space-md) var(--space-lg) var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  /* Sections */
  .info-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .section-title {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 5px;
    margin: 0;
  }

  /* Info grid */
  .info-grid {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px var(--space-md);
    gap: var(--space-md);
    border-bottom: 1px solid var(--border);
  }
  .info-row:last-child { border-bottom: none; }

  .info-label {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .info-value {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text);
    text-align: right;
  }
  .info-value.mono {
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, monospace;
  }

  /* Badges */
  .env-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 999px;
    padding: 1px 8px;
  }
  .env-badge.prod { background: #dcfce7; color: #166534; }
  .env-badge.dev  { background: #fef3c7; color: #92400e; }

  .status-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 999px;
    padding: 1px 8px;
  }
  .status-badge.warning { background: #fef3c7; color: #92400e; }
  .status-badge.success { background: #dcfce7; color: #166534; }
  .status-badge.neutral { background: var(--bg); color: var(--text-muted); border: 1px solid var(--border); }

  /* Action list */
  .action-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .action-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
    width: 100%;
  }
  .action-row:hover:not([disabled]) { background: var(--surface); border-color: var(--primary); }
  .action-row[disabled]             { opacity: 0.65; cursor: not-allowed; }

  .action-highlighted {
    border-color: #f59e0b;
    background: #fffbeb;
  }
  .action-highlighted:hover { background: #fef3c7 !important; }

  .action-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary);
    flex-shrink: 0;
    transition: transform 0.3s ease;
  }

  .action-icon-wrap.spinning {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .action-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .action-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }

  .action-sub {
    font-size: 0.75rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .dot-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f59e0b;
    flex-shrink: 0;
  }

  /* iOS Guide (inline section) */
  .ios-guide {
    position: relative;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: var(--radius-md);
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .ios-guide .section-title {
    color: #1d4ed8;
  }

  .ios-guide__close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(30, 64, 175, 0.1);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1d4ed8;
    padding: 0;
  }
  .ios-guide__close:hover { background: rgba(30, 64, 175, 0.2); }

  .ios-hint {
    font-size: 0.75rem;
    color: #1e40af;
    line-height: 1.5;
    margin: 0;
    padding-top: var(--space-xs);
    border-top: 1px solid #bfdbfe;
  }

  /* Install cards */
  .install-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    background: var(--bg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-bottom: var(--space-xs);
    transition: border-color 0.15s;
  }

  .install-card--active {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 5%, var(--bg));
  }

  .install-card--done {
    border-color: #16a34a;
    background: #f0fdf4;
  }

  .install-card__header {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .install-card__icon {
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid transparent;
  }

  .install-card__icon--android {
    background: #e8f5e9;
    color: #2e7d32;
    border-color: #c8e6c9;
  }

  .install-card__icon--ios {
    background: #f0f0f0;
    color: #1c1c1e;
    border-color: #d1d5db;
  }

  .install-card__icon--green {
    background: #f0fdf4;
    color: #16a34a;
    border-color: #bbf7d0;
  }

  .install-card__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .install-card__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .install-card__sub {
    font-size: 0.725rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .platform-badge {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    border-radius: 999px;
    padding: 1px 7px;
  }

  .install-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0.45rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    border: none;
  }

  .install-btn--primary {
    background: var(--primary);
    color: #fff;
  }
  .install-btn--primary:hover { opacity: 0.88; }

  .install-btn--secondary {
    background: transparent;
    color: var(--primary);
    border: 1.5px solid var(--primary);
  }
  .install-btn--secondary:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); }

  .install-note {
    font-size: 0.725rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.4;
  }

  /* Guide steps (shared: install cards + iOS guide) */
  .guide-steps {
    padding-left: 1.25rem;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .guide-steps li {
    font-size: 0.875rem;
    color: var(--text);
    line-height: 1.5;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  .share-icon {
    width: 18px;
    height: 18px;
    vertical-align: middle;
    color: #2563eb;
    flex-shrink: 0;
  }

  /* Footer */
  .panel-footer {
    font-size: 0.6875rem;
    color: var(--text-muted);
    text-align: center;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--border);
  }
</style>
