import { writable } from 'svelte/store';

export type AppView =
  | 'home'
  | 'programar-avanzada'
  | 'kanban'
  // Avanzadas — captura simple de una sola pantalla (offline-first)
  | 'avanzadas'
  | 'detalle-avanzada'
  // Edita una avanzada ya creada — mismo componente que 'programar-avanzada'
  // (RegistrarAvanzada.svelte detecta el modo por la presencia de
  // params.client_id), ver viewRegistry.ts.
  | 'editar-avanzada'
  | 'reportes';

/**
 * Single source of truth for every valid AppView at runtime. Whenever the
 * AppView union above is changed, this array must be updated too — it's
 * what makes view-registry completeness (see src/lib/viewRegistry.ts)
 * testable without hand-copying a literal that can silently rot.
 */
export const ALL_APP_VIEWS: readonly AppView[] = [
  'home',
  'programar-avanzada',
  'kanban',
  'avanzadas',
  'detalle-avanzada',
  'editar-avanzada',
  'reportes',
];

interface NavigationEntry {
  view: AppView;
  params: Record<string, string>;
}

interface NavigationState extends NavigationEntry {
  /** Views visited before the current one, oldest first. Popped by back(). */
  history: NavigationEntry[];
}

function createNavigationStore() {
  const { subscribe, set, update } = writable<NavigationState>({
    view: 'home',
    params: {},
    history: [],
  });

  let currentState: NavigationState = { view: 'home', params: {}, history: [] };
  subscribe((s) => (currentState = s));

  return {
    subscribe,
    /** Navigates to a view, pushing the current view onto the history stack. */
    navigate: (view: AppView, params: Record<string, string> = {}) =>
      update((s) => ({
        view,
        params,
        history: [...s.history, { view: s.view, params: s.params }],
      })),
    /**
     * Pops the previous view off the history stack and navigates to it.
     * Falls back to 'home' when the stack is empty (e.g. a view was opened
     * via a direct link/refresh rather than in-app navigation).
     */
    back: () =>
      update((s) => {
        if (s.history.length === 0) {
          return { view: 'home', params: {}, history: [] };
        }
        const history = s.history.slice(0, -1);
        const previous = s.history[s.history.length - 1];
        return { view: previous.view, params: previous.params, history };
      }),
    /** Returns home and clears the history stack. */
    goHome: () => set({ view: 'home', params: {}, history: [] }),
    getParams: () => currentState.params,
  };
}

export const navigationStore = createNavigationStore();
