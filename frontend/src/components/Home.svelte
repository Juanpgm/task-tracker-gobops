<script lang="ts">
  import { authStore } from '../stores/authStore';
  import { navigationStore } from '../stores/navigationStore';
  import type { AppView } from '../stores/navigationStore';
  import { logout } from '../api/auth';
  import Button from './ui/Button.svelte';
  import Card from './ui/Card.svelte';
  import Icon from './ui/Icon.svelte';
  import ChangePassword from './ChangePassword.svelte';

  let loggingOut = false;
  let showChangePassword = false;

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
    color: string;
  }

  const actions: ActionCard[] = [
    {
      id: 'programar-visita',
      title: 'Programar Visita',
      description: 'Buscar UP y programar una visita con colaboradores',
      icon: 'calendar',
      color: '#2563eb',
    },
    {
      id: 'visitas-programadas',
      title: 'Visitas Programadas',
      description: 'Ver visitas activas e iniciar registros',
      icon: 'clipboard-list',
      color: '#7c3aed',
    },
    {
      id: 'kanban',
      title: 'Gestión Requerimientos',
      description: 'Tablero Kanban de estados y seguimiento',
      icon: 'bar-chart',
      color: '#0891b2',
    },
    {
      id: 'directorio-enlaces',
      title: 'Directorio de Enlaces',
      description: 'Consultar enlaces de organismos y sus requerimientos',
      icon: 'address-book',
      color: '#0d9488',
    },
    {
      id: 'asistencia-delegado',
      title: 'Asistencia Delegado',
      description: 'Registrar asistencia de delegados al evento',
      icon: 'user',
      color: '#d97706',
    },
    {
      id: 'asistencia-comunidad',
      title: 'Asistencia Comunidad',
      description: 'Registrar asistencia de la comunidad',
      icon: 'users',
      color: '#16a34a',
    },
    {
      id: 'reportes',
      title: 'Reportes',
      description: 'Consultar y gestionar reportes del grupo operativo',
      icon: 'trending-up',
      color: '#64748b',
    },
  ];
</script>

<div class="home">
  <!-- Header -->
  <header class="header">
    <div class="header-content">
      <div class="header-left">
        <h1 class="header-title">Seguimiento de Requerimientos</h1>
        <span class="header-subtitle">Alcaldía de Santiago de Cali</span>
      </div>
      <div class="header-right">
        <div class="user-info">
          <span class="user-name">{$authStore.user?.displayName || $authStore.user?.email || 'Usuario'}</span>
          <span class="user-role">{$authStore.user?.role || 'Operador'}</span>
        </div>
        <div class="header-actions">
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

    <section class="actions-grid">
      {#each actions as action}
        <button
          class="action-card"
          on:click={() => navigationStore.navigate(action.id)}
        >
          <Card padding="md">
            <div class="action-inner">
              <span class="action-icon" style="background:{action.color}12; color:{action.color}">
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
    </section>
  </main>

  <ChangePassword bind:show={showChangePassword} />
</div>

<style>
  .home {
    min-height: 100vh;
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
  .action-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
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
</style>
