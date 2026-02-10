import { writable } from 'svelte/store';

export type AppView =
  | 'home'
  | 'programar-visita'
  | 'programar-visita-detalle'
  | 'visitas-programadas'
  | 'registrar-requerimiento-visita'
  | 'kanban'
  | 'detalle-requerimiento'
  | 'directorio-enlaces'
  // legacy views
  | 'registrar-visita'
  | 'asistencia-delegado'
  | 'asistencia-comunidad'
  | 'registrar-requerimiento'
  | 'reportes';

interface NavigationState {
  view: AppView;
  params: Record<string, string>;
}

function createNavigationStore() {
  const { subscribe, set, update } = writable<NavigationState>({
    view: 'home',
    params: {},
  });

  return {
    subscribe,
    navigate: (view: AppView, params: Record<string, string> = {}) =>
      set({ view, params }),
    goHome: () => set({ view: 'home', params: {} }),
    getParams: () => {
      let current: NavigationState = { view: 'home', params: {} };
      subscribe((s) => (current = s))();
      return current.params;
    },
  };
}

export const navigationStore = createNavigationStore();
