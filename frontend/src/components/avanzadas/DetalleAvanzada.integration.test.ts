/**
 * INTEGRATION test for the requerimiento edit flow.
 *
 * Unlike DetalleAvanzada.test.ts (which mocks the ENTIRE avanzadasStore and
 * therefore only proves the store method gets *called*), this suite uses the
 * REAL avanzadasStore and mocks only what the store itself depends on
 * (api/avanzadas, lib/offlineQueue, stores/offlineStore) plus the component's
 * own leaf deps (lib/geolocation, stores/navigationStore).
 *
 * It exercises the full chain the bug report is about:
 *   real store.loadAvanzadaDetalle (seeds detalle)
 *     -> render DetalleAvanzada
 *     -> click Editar -> change text -> Guardar cambios
 *     -> real store.actualizarRequerimiento update()
 *     -> Svelte reactivity ($: requerimientos -> gruposPorEntidad -> DOM)
 *     -> the edited text is visible in the .req-card WITHOUT a manual refresh.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/svelte";

// --- Mock the store's own dependencies (NOT the store itself) ---
const apiMocks = vi.hoisted(() => ({
  getCatalogosAvanzadas: vi.fn(),
  crearAvanzada: vi.fn(),
  actualizarAvanzada: vi.fn(),
  agregarRequerimientoAvanzada: vi.fn(),
  actualizarRequerimientoAvanzada: vi.fn(),
  eliminarRequerimientoAvanzada: vi.fn(),
  listarAvanzadas: vi.fn(),
  getAvanzada: vi.fn(),
  // consumed by the component / RequerimientoFormFields, not the store
  descargarReporteAvanzadaPdf: vi.fn(),
  clasificarRequerimiento: vi.fn(),
  MAX_FOTOS_POR_REQUERIMIENTO: 5,
}));
vi.mock("../../api/avanzadas", () => apiMocks);

const queueMocks = vi.hoisted(() => ({
  enqueueOperation: vi.fn(),
  getQueue: vi.fn(),
  dequeueOperation: vi.fn(),
  updateOperationError: vi.fn(),
}));
vi.mock("../../lib/offlineQueue", () => queueMocks);

vi.mock("../../stores/offlineStore", () => ({
  offlineStore: { refreshPendingCount: vi.fn() },
}));

const geolocationMocks = vi.hoisted(() => ({
  getCurrentPosition: vi.fn(),
  formatCoordinates: vi.fn(),
  reverseGeocodeWithFallback: vi.fn(),
}));
vi.mock("../../lib/geolocation", () => geolocationMocks);

const navigationStoreState = vi.hoisted(() => {
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
    };
  }
  return {
    store: createMockStore({ view: "detalle-avanzada", params: { client_id: "client-1" } }),
    navigate: vi.fn(),
  };
});
vi.mock("../../stores/navigationStore", () => ({
  navigationStore: {
    subscribe: navigationStoreState.store.subscribe,
    navigate: navigationStoreState.navigate,
  },
}));

// Real store + real component (imported AFTER the mocks are registered).
import { avanzadasStore } from "../../stores/avanzadasStore";
import DetalleAvanzada from "./DetalleAvanzada.svelte";

const DAGMA = "DAGMA - Departamento Administrativo de Gestión del Medio Ambiente";
const UAESP = "UAESP - Unidad Administrativa Especial de Servicios Públicos Municipales";

function reqExistente(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-42",
    entidad: DAGMA,
    entidades: [DAGMA],
    categoria: "Poda de árboles (autorización)",
    categoria_personalizada: null,
    requerimiento: "Poste caído",
    ubicacion: "Calle 10",
    coordenadas: "3.4, -76.5",
    fotos_urls: [],
    ...overrides,
  };
}

function detalle(overrides: Record<string, unknown> = {}) {
  return {
    client_id: "client-1",
    nombre_avanzada: "Avanzada Comuna 1",
    fecha: "2026-07-16",
    estrategia: "En Un 2x3",
    sector: "Sector norte",
    comuna: "Comuna 1",
    barrio: "Salomia",
    direccion: "Calle 1 #2-3",
    coordenadas: "3.45, -76.53",
    encargados: ["Ana Maria Carabali"],
    asistentes: [],
    requerimientos: [reqExistente()],
    requerimientos_count: 1,
    isOffline: false,
    ...overrides,
  };
}

describe("DetalleAvanzada — edit requerimiento (REAL store integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

    queueMocks.getQueue.mockResolvedValue([]);
    apiMocks.getCatalogosAvanzadas.mockResolvedValue({
      estrategias: [],
      equipo: [],
      dependencias: [DAGMA, UAESP],
      categorias: { [DAGMA]: ["Poda de árboles (autorización)"] },
    });
    apiMocks.clasificarRequerimiento.mockResolvedValue({
      organismos_sugeridos: [],
      confianza: 0,
      metodo: "test",
      tipo_requerimiento: "",
      acciones_por_organismo: {},
    });
    geolocationMocks.getCurrentPosition.mockResolvedValue({ latitud: 3.45, longitud: -76.53, accuracy: 5 });
    geolocationMocks.formatCoordinates.mockReturnValue("3.450000, -76.530000");
    geolocationMocks.reverseGeocodeWithFallback.mockResolvedValue(null);

    navigationStoreState.store.set({ view: "detalle-avanzada", params: { client_id: "client-1" } });
  });

  afterEach(() => {
    cleanup();
  });

  it("edited text shows in the .req-card immediately after 'Guardar cambios' (no manual refresh)", async () => {
    // Seed the REAL store's detalle via loadAvanzadaDetalle (mocking the GET).
    apiMocks.getAvanzada.mockResolvedValue(detalle());

    render(DetalleAvanzada);

    // onMount -> real loadAvanzadaDetalle resolves -> original text rendered.
    const original = await screen.findByText("Poste caído");
    expect(original.closest(".req-card")).not.toBeNull();

    // Backend PATCH returns the fresh requerimiento with the new text.
    apiMocks.actualizarRequerimientoAvanzada.mockResolvedValue(
      reqExistente({ requerimiento: "Poste reparado" })
    );

    // Drive the UI exactly like a user.
    await fireEvent.click(screen.getByRole("button", { name: /editar requerimiento/i }));
    expect(screen.getByText("Editar requerimiento")).toBeInTheDocument();

    await fireEvent.input(screen.getByLabelText(/^Requerimiento/), {
      target: { value: "Poste reparado" },
    });
    await fireEvent.click(screen.getByText("Guardar cambios"));

    // The real store method was invoked against the real API layer.
    await waitFor(() => {
      expect(apiMocks.actualizarRequerimientoAvanzada).toHaveBeenCalledTimes(1);
    });

    // THE ASSERTION THAT MATTERS: the new text is on screen, inside a .req-card,
    // and the modal closed — all driven purely by store update + reactivity.
    const updated = await screen.findByText("Poste reparado");
    expect(updated.closest(".req-card")).not.toBeNull();
    expect(screen.queryByText("Poste caído")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Editar requerimiento")).not.toBeInTheDocument();
    });
  });

  it("a successful edit whose backend response re-homes the req into a NEW entidad group keeps the card visible (new group defaults open)", async () => {
    // The backend is the source of truth: the store replaces the req by id with
    // whatever the PATCH returns. Here the response carries a different entidad,
    // so the card must re-sort into a brand-new group. New groups default OPEN
    // (`{#if !entidadesColapsadas[entidad]}` with no key => visible), so the
    // card must NOT vanish — the "changes don't apply" failure mode to guard.
    apiMocks.getAvanzada.mockResolvedValue(detalle());

    render(DetalleAvanzada);
    await screen.findByText("Poste caído");
    expect(screen.getByText(DAGMA, { selector: ".entidad-name" })).toBeInTheDocument();

    apiMocks.actualizarRequerimientoAvanzada.mockResolvedValue(
      reqExistente({ entidad: "UAESP", entidades: ["UAESP"], requerimiento: "Poste reparado" })
    );

    await fireEvent.click(screen.getByRole("button", { name: /editar requerimiento/i }));
    await fireEvent.input(screen.getByLabelText(/^Requerimiento/), {
      target: { value: "Poste reparado" },
    });
    await fireEvent.click(screen.getByText("Guardar cambios"));

    await waitFor(() => {
      expect(apiMocks.actualizarRequerimientoAvanzada).toHaveBeenCalledTimes(1);
    });

    // The card is re-homed under the new UAESP group and remains visible.
    expect(await screen.findByText("UAESP", { selector: ".entidad-name" })).toBeInTheDocument();
    expect(screen.queryByText(DAGMA, { selector: ".entidad-name" })).not.toBeInTheDocument();
    const card = (await screen.findByText("Poste reparado")).closest(".req-card");
    expect(card).not.toBeNull();
  });

  it("adding a second organismo in the edit modal and saving shows BOTH chips in the card (bug report: multi-organismo not persisting on edit)", async () => {
    apiMocks.getAvanzada.mockResolvedValue(detalle());

    render(DetalleAvanzada);
    await screen.findByText("Poste caído");
    // Only the primary organismo is visible before editing.
    expect(screen.getByText("DAGMA", { selector: ".entidad-chip" })).toBeInTheDocument();
    expect(screen.queryByText("UAESP", { selector: ".entidad-chip" })).not.toBeInTheDocument();

    // The backend is the source of truth for the assertion below: it must echo
    // back BOTH organismos for the round-trip to be meaningful (already proven
    // server-side by the pytest round-trip test; here we prove the frontend
    // actually SENDS both and correctly RENDERS whatever it gets back).
    apiMocks.actualizarRequerimientoAvanzada.mockImplementation(async (_clientId, _reqId, datos) => {
      expect(datos.entidades).toEqual([DAGMA, UAESP]);
      return reqExistente({ entidad: DAGMA, entidades: datos.entidades });
    });

    await fireEvent.click(screen.getByRole("button", { name: /editar requerimiento/i }));
    expect(screen.getByText("Editar requerimiento")).toBeInTheDocument();

    const modal = screen.getByText("Editar requerimiento").closest(".modal") as HTMLElement;
    const organismosContainer = within(modal)
      .getByText("Organismos", { selector: ".ms-label" })
      .closest(".multiselect") as HTMLElement;
    const searchInput = organismosContainer.querySelector(".ms-input") as HTMLInputElement;
    await fireEvent.focus(searchInput);
    await fireEvent.input(searchInput, { target: { value: "UAESP" } });
    await fireEvent.click(within(organismosContainer).getByText(UAESP, { selector: ".option" }));
    await fireEvent.click(within(organismosContainer).getByText("Aceptar"));

    await fireEvent.click(within(modal).getByText("Guardar cambios"));

    await waitFor(() => {
      expect(apiMocks.actualizarRequerimientoAvanzada).toHaveBeenCalledTimes(1);
    });

    // Both organismos now show as chips on the card, no manual refresh needed.
    expect(await screen.findByText("DAGMA", { selector: ".entidad-chip" })).toBeInTheDocument();
    expect(await screen.findByText("UAESP", { selector: ".entidad-chip" })).toBeInTheDocument();
  });
});
