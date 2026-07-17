/**
 * Behavioral tests for ListaAvanzadas.svelte.
 *
 * Replaces the previous structural (readFileSync + source-matching) test
 * file: those tests only asserted that certain strings appeared in the
 * .svelte source, so they passed even if the component threw on render, an
 * on:click handler was disconnected, or a feature was entirely broken. These
 * tests render the real component with @testing-library/svelte and drive it
 * like a user would — mocking only the store layer (avanzadasStore) and
 * navigationStore.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";

/** Hand-rolled Svelte store contract (subscribe/set) built inside vi.hoisted — avoids importing 'svelte/store' before the hoisted mocks run. */
const avanzadasStoreState = vi.hoisted(() => {
  function createMockStore(initial: any) {
    let value = initial;
    const subscribers = new Set<(v: any) => void>();
    return {
      subscribe(fn: (v: any) => void) {
        subscribers.add(fn);
        fn(value);
        return () => subscribers.delete(fn);
      },
      set(v: any) {
        value = v;
        subscribers.forEach((fn) => fn(value));
      },
      get: () => value,
    };
  }
  return {
    store: createMockStore({
      catalogos: { estrategias: [], equipo: [], dependencias: [], categorias: {} },
      catalogosLoaded: false,
      catalogosError: null,
      catalogosFetchedAt: null,
      avanzadas: [] as any[],
      loading: false,
      error: null as string | null,
      revalidating: false,
      revalidateError: null as string | null,
      lastFetchedAt: null as number | null,
      detalle: {},
      detalleLoading: {},
      detalleError: {},
    }),
    loadAvanzadas: vi.fn(),
  };
});

const navigationStoreMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  goHome: vi.fn(),
}));

vi.mock("../../stores/avanzadasStore", () => ({
  avanzadasStore: {
    subscribe: avanzadasStoreState.store.subscribe,
    loadAvanzadas: avanzadasStoreState.loadAvanzadas,
  },
}));

vi.mock("../../stores/navigationStore", () => ({
  navigationStore: {
    subscribe: vi.fn(),
    navigate: navigationStoreMocks.navigate,
    goHome: navigationStoreMocks.goHome,
  },
}));

import ListaAvanzadas from "./ListaAvanzadas.svelte";

function setStoreState(patch: Partial<ReturnType<typeof avanzadasStoreState.store.get>>) {
  avanzadasStoreState.store.set({ ...avanzadasStoreState.store.get(), ...patch });
}

function avanzada(overrides: Record<string, unknown> = {}) {
  return {
    client_id: "a1",
    nombre_avanzada: "Avanzada Comuna 1",
    fecha: "2026-07-16",
    estrategia: "En Un 2x3",
    sector: "Sector norte",
    comuna: "Comuna 1",
    barrio: "Salomia",
    direccion: "Calle 1 #2-3",
    requerimientos_count: 2,
    isOffline: false,
    ...overrides,
  };
}

describe("ListaAvanzadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    avanzadasStoreState.store.set({
      catalogos: { estrategias: [], equipo: [], dependencias: [], categorias: {} },
      catalogosLoaded: false,
      catalogosError: null,
      catalogosFetchedAt: null,
      avanzadas: [],
      loading: false,
      error: null,
      revalidating: false,
      revalidateError: null,
      lastFetchedAt: null,
      detalle: {},
      detalleLoading: {},
      detalleError: {},
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("calls avanzadasStore.loadAvanzadas() on mount", async () => {
    render(ListaAvanzadas);
    await tick();
    expect(avanzadasStoreState.loadAvanzadas).toHaveBeenCalledTimes(1);
  });

  it("shows skeleton placeholders while loading (first load) instead of the list", () => {
    setStoreState({ loading: true });
    render(ListaAvanzadas);
    expect(screen.getByLabelText("Cargando avanzadas")).toBeInTheDocument();
    expect(screen.queryByText("Avanzada Comuna 1")).not.toBeInTheDocument();
  });

  it("shows the blocking error state with a Reintentar button that forces a refetch", async () => {
    setStoreState({ error: "boom" });
    render(ListaAvanzadas);
    expect(screen.getByText("boom")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /reintentar/i });
    await fireEvent.click(retryBtn);

    expect(avanzadasStoreState.loadAvanzadas).toHaveBeenCalledWith({ force: true });
  });

  it("shows the 'no avanzadas registered' empty state when the list is empty (not loading, no error)", () => {
    render(ListaAvanzadas);
    expect(screen.getByText("Sin avanzadas registradas")).toBeInTheDocument();
  });

  it("renders a card per avanzada with nombre, comuna/barrio, estrategia and requerimientos count", () => {
    setStoreState({
      avanzadas: [
        avanzada({ client_id: "a1", nombre_avanzada: "Avanzada Comuna 1", requerimientos_count: 2 }),
        avanzada({ client_id: "a2", nombre_avanzada: "Avanzada Comuna 3", comuna: "Comuna 3", requerimientos_count: 1 }),
      ],
    });
    render(ListaAvanzadas);

    expect(screen.getByText("Avanzada Comuna 1")).toBeInTheDocument();
    expect(screen.getByText("Avanzada Comuna 3")).toBeInTheDocument();
    expect(screen.getByText(/Salomia, Comuna 1/)).toBeInTheDocument();
    expect(screen.getByText(/2 requerimientos/)).toBeInTheDocument();
    expect(screen.getByText(/1 requerimiento\b/)).toBeInTheDocument();
  });

  it("clicking a card navigates to detalle-avanzada with that card's client_id", async () => {
    setStoreState({ avanzadas: [avanzada({ client_id: "target-id", nombre_avanzada: "Target" })] });
    render(ListaAvanzadas);

    await fireEvent.click(screen.getByText("Target").closest("button")!);

    expect(navigationStoreMocks.navigate).toHaveBeenCalledWith("detalle-avanzada", { client_id: "target-id" });
  });

  it("cards are real, focusable <button> elements (native Enter/Space keyboard activation applies without extra wiring)", async () => {
    setStoreState({ avanzadas: [avanzada({ client_id: "target-id", nombre_avanzada: "Target" })] });
    render(ListaAvanzadas);

    const card = screen.getByText("Target").closest("button")!;
    // A real <button type="button"> (not a div/span with a click handler) is
    // what guarantees Enter/Space activation and tab-reachability per the
    // HTML spec — jsdom doesn't simulate that native behavior itself, so we
    // assert the semantic element instead of faking a keydown-to-click bridge.
    expect(card.tagName).toBe("BUTTON");
    expect(card).toHaveAttribute("type", "button");
    card.focus();
    expect(card).toHaveFocus();
  });

  it("shows a pending-sync badge for offline items", () => {
    setStoreState({ avanzadas: [avanzada({ isOffline: true })] });
    render(ListaAvanzadas);
    expect(screen.getByText("Pendiente de sincronizar")).toBeInTheDocument();
  });

  it("'+ Nueva avanzada' navigates to programar-avanzada", async () => {
    render(ListaAvanzadas);
    await fireEvent.click(screen.getByText("+ Nueva avanzada"));
    expect(navigationStoreMocks.navigate).toHaveBeenCalledWith("programar-avanzada");
  });

  it("'Registrar Avanzada' button in the empty state also navigates to programar-avanzada", async () => {
    render(ListaAvanzadas);
    await fireEvent.click(screen.getByRole("button", { name: "Registrar Avanzada" }));
    expect(navigationStoreMocks.navigate).toHaveBeenCalledWith("programar-avanzada");
  });

  describe("stale-while-revalidate", () => {
    it("keeps showing stale data (no skeleton) while a background revalidate is in flight", () => {
      setStoreState({
        avanzadas: [avanzada({ nombre_avanzada: "Old data" })],
        loading: false,
        revalidating: true,
      });
      render(ListaAvanzadas);
      expect(screen.getByText("Old data")).toBeInTheDocument();
      expect(screen.queryByLabelText("Cargando avanzadas")).not.toBeInTheDocument();
    });

    it("surfaces a non-destructive revalidation error banner alongside the still-visible list", () => {
      setStoreState({
        avanzadas: [avanzada({ nombre_avanzada: "Old data" })],
        revalidateError: "network blip",
      });
      render(ListaAvanzadas);
      expect(screen.getByText("Old data")).toBeInTheDocument();
      expect(screen.getByText(/network blip/)).toBeInTheDocument();
    });
  });

  describe("filter bar", () => {
    function twoAvanzadas() {
      return [
        avanzada({
          client_id: "a1",
          nombre_avanzada: "Avanzada Norte",
          comuna: "Comuna 1",
          sector: "Zona A",
          barrio: "Salomia",
          direccion: "Calle 1 #2-3",
          estrategia: "En Un 2x3",
          fecha: "2026-07-01",
        }),
        avanzada({
          client_id: "a2",
          nombre_avanzada: "Avanzada Sur",
          comuna: "Comuna 3",
          sector: "Zona B",
          barrio: "El Peñón",
          direccion: "Carrera 9 #10-20",
          estrategia: "Plan de Choque",
          fecha: "2026-07-10",
        }),
      ];
    }

    it("filters rendered cards by free text and updates the 'N de M' count", async () => {
      setStoreState({ avanzadas: twoAvanzadas() });
      render(ListaAvanzadas);

      expect(screen.getByText("2 de 2 avanzadas")).toBeInTheDocument();

      await fireEvent.click(screen.getByText("Filtros"));
      const searchInput = screen.getByPlaceholderText(/Buscar por nombre/);
      await fireEvent.input(searchInput, { target: { value: "Norte" } });

      expect(screen.getByText("Avanzada Norte")).toBeInTheDocument();
      expect(screen.queryByText("Avanzada Sur")).not.toBeInTheDocument();
      expect(screen.getByText("1 de 2 avanzadas")).toBeInTheDocument();
    });

    it("'Limpiar filtros' restores the full unfiltered list", async () => {
      setStoreState({ avanzadas: twoAvanzadas() });
      render(ListaAvanzadas);

      await fireEvent.click(screen.getByText("Filtros"));
      const searchInput = screen.getByPlaceholderText(/Buscar por nombre/);
      await fireEvent.input(searchInput, { target: { value: "Norte" } });
      expect(screen.getByText("1 de 2 avanzadas")).toBeInTheDocument();

      await fireEvent.click(screen.getByText(/Limpiar filtros/));

      expect(screen.getByText("Avanzada Norte")).toBeInTheDocument();
      expect(screen.getByText("Avanzada Sur")).toBeInTheDocument();
      expect(screen.getByText("2 de 2 avanzadas")).toBeInTheDocument();
    });

    it("shows the no-results-from-filters empty state (distinct from the no-avanzadas-at-all state) when a filter matches nothing", async () => {
      setStoreState({ avanzadas: twoAvanzadas() });
      render(ListaAvanzadas);

      await fireEvent.click(screen.getByText("Filtros"));
      const searchInput = screen.getByPlaceholderText(/Buscar por nombre/);
      await fireEvent.input(searchInput, { target: { value: "nombre-que-no-existe" } });

      expect(screen.getByText("Ningún resultado con esos filtros")).toBeInTheDocument();
      expect(screen.queryByText("Sin avanzadas registradas")).not.toBeInTheDocument();
    });
  });
});
