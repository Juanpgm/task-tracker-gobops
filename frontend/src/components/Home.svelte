<script lang="ts">
  import { authStore } from '../stores/authStore';
  import { navigationStore } from '../stores/navigationStore';
  import type { AppView } from '../stores/navigationStore';
  import { logout } from '../api/auth';
  import { pwaStore } from '../stores/pwaStore';
  import Button from './ui/Button.svelte';
  import Card from './ui/Card.svelte';
  import Icon from './ui/Icon.svelte';
  import ChangePassword from './ChangePassword.svelte';
  import AppInfoPanel from './AppInfoPanel.svelte';

  let loggingOut = false;
  let showChangePassword = false;
  let showInfoPanel = false;

  async function handleLogout() {
    loggingOut = true;
    await logout();
    loggingOut = false;
  }

  interface ActionCard {
    id: AppView;
    title: string;
    description: string;
    icon: string;
  }

  interface ActionGroup {
    heading: string;
    actions: ActionCard[];
  }

  // Grouped by what the user is doing, not by an arbitrary card color — the
  // icon carries each action's identity, not a random hue per card.
  const actionGroups: ActionGroup[] = [
    {
      heading: 'Captura',
      actions: [
        {
          id: 'programar-visita',
          title: 'Programar Visita',
          description: 'Buscar UP y programar una visita con colaboradores',
          icon: 'calendar',
        },
        {
          id: 'avanzadas',
          title: 'Avanzadas',
          description: 'Registrar avanzada de estrategia y requerimientos',
          icon: 'flag',
        },
      ],
    },
    {
      heading: 'Gestión y análisis',
      actions: [
        {
          id: 'kanban',
          title: 'Gestión Requerimientos',
          description: 'Tablero Kanban de estados y seguimiento',
          icon: 'bar-chart',
        },
        {
          id: 'reportes',
          title: 'Reportes',
          description: 'Consultar y gestionar reportes del grupo operativo',
          icon: 'trending-up',
        },
      ],
    },
  ];
</script>

<div class="home">
  <!-- Header -->
  <header class="header">
    <div class="header-content">
      <div class="header-left">
        <h1 class="header-title">GobOps</h1>
        <span class="header-subtitle">Seguimiento de Requerimientos</span>
      </div>
      <div class="header-right">
        <div class="user-info">
          <span class="user-name">{$authStore.user?.displayName || $authStore.user?.email || 'Usuario'}</span>
          <span class="user-role">{$authStore.user?.role || 'Operador'}</span>
        </div>
        <div class="header-actions">
          <button
            class="info-btn"
            class:info-btn--update={$pwaStore.needRefresh}
            on:click={() => (showInfoPanel = true)}
            aria-label="Información de la aplicación"
            title="v{__APP_VERSION__}"
          >
            <Icon name="settings" size={17} />
            {#if $pwaStore.needRefresh}
              <span class="info-update-dot" />
            {/if}
          </button>
          <Button variant="ghost" size="sm" on:click={() => showChangePassword = true}>
            <Icon name="lock" size={18} />
          </Button>
          <Button variant="ghost" size="sm" on:click={handleLogout} loading={loggingOut}>
            Salir
          </Button>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="main container">
    <section class="welcome-section">
      <h2 class="welcome-title">¡Bienvenido!</h2>
      <p class="welcome-text">Seleccione una acción para comenzar</p>
    </section>

    {#each actionGroups as group}
      <section class="action-group">
        <h2 class="group-heading">{group.heading}</h2>
        <div class="actions-grid">
          {#each group.actions as action}
            <button
              class="action-card"
              on:click={() => navigationStore.navigate(action.id)}
            >
              <Card padding="md">
                <div class="action-inner">
                  <span class="action-icon">
                    <Icon name={action.icon} size={22} />
                  </span>
                  <div class="action-text">
                    <h3 class="action-title">{action.title}</h3>
                    <p class="action-desc">{action.description}</p>
                  </div>
                  <span class="action-arrow"><Icon name="chevron-right" size={18} /></span>
                </div>
              </Card>
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </main>

  <ChangePassword bind:show={showChangePassword} />
  <AppInfoPanel bind:show={showInfoPanel} />
</div>

<style>
  .home {
    min-height: 100vh;
    min-height: -webkit-fill-available;
    min-height: 100dvh;
    background: var(--bg);
  }
  .header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .header-content {
    max-width: 640px;
    margin: 0 auto;
    padding: var(--space-md);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-left {
    display: flex;
    flex-direction: column;
  }
  .header-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--primary);
    line-height: 1.2;
  }
  .header-subtitle {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .user-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text);
  }
  .user-role {
    font-size: 0.6875rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Main */
  .main {
    padding-top: var(--space-xl);
    padding-bottom: var(--space-2xl);
  }
  .welcome-section {
    text-align: center;
    margin-bottom: var(--space-xl);
  }
  .welcome-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
  }
  .welcome-text {
    color: var(--text-secondary);
    font-size: 0.9375rem;
    margin-top: 0.25rem;
  }

  /* Action groups */
  .action-group {
    margin-bottom: var(--space-lg);
  }
  .action-group:last-child {
    margin-bottom: 0;
  }
  .group-heading {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: var(--space-sm);
  }

  /* Action Cards */
  .actions-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .action-card {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  .action-inner {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }
  /* Restrained treatment: brand blue + neutral. The icon carries each
     action's identity — not a random per-card hue. */
  .action-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    background: var(--primary-light);
    color: var(--primary);
  }
  .action-text {
    flex: 1;
    min-width: 0;
  }
  .action-title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--text);
  }
  .action-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 0.125rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .action-arrow {
    color: var(--text-muted);
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  @media (max-width: 400px) {
    .user-info { display: none; }
  }

  /* Info / settings button. The visible box stays a compact 32px square;
     the tappable hit area is expanded to --tap-min via a pseudo-element so
     the glyph doesn't visually inflate on a dense header row. */
  .info-btn {
    position: relative;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }
  .info-btn::before {
    content: '';
    position: absolute;
    inset: calc((32px - var(--tap-min)) / 2);
  }
  .info-btn:hover {
    background: var(--bg);
    color: var(--primary);
    border-color: var(--primary);
  }
  .info-btn--update {
    border-color: var(--warning);
    color: var(--warning);
  }
  .info-update-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--warning);
    border: 1.5px solid var(--surface);
    animation: info-pulse 2s infinite;
  }
  @keyframes info-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(0.8); }
  }
</style>
