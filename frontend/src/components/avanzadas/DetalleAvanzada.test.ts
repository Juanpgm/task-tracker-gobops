/**
 * Behavioral tests for DetalleAvanzada.svelte.
 *
 * Replaces the previous structural (readFileSync + source-matching) test
 * file. These tests render the real component with @testing-library/svelte
 * and drive it like a user would — mocking only the store layer
 * (avanzadasStore, navigationStore).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/svelte";

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
      error: null,
      revalidating: false,
      revalidateError: null,
      lastFetchedAt: null,
      detalle: {} as Record<string, any>,
      detalleLoading: {} as Record<string, boolean>,
      detalleError: {} as Record<string, string | null>,
    }),
    loadAvanzadaDetalle: vi.fn(),
    loadCatalogos: vi.fn(),
    agregarRequerimiento: vi.fn(),
    actualizarRequerimiento: vi.fn(),
    eliminarRequerimiento: vi.fn(),
  };
});

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

vi.mock("../../stores/avanzadasStore", () => ({
  avanzadasStore: {
    subscribe: avanzadasStoreState.store.subscribe,
    loadAvanzadaDetalle: avanzadasStoreState.loadAvanzadaDetalle,
    loadCatalogos: avanzadasStoreState.loadCatalogos,
    agregarRequerimiento: avanzadasStoreState.agregarRequerimiento,
    actualizarRequerimiento: avanzadasStoreState.actualizarRequerimiento,
    eliminarRequerimiento: avanzadasStoreState.eliminarRequerimiento,
  },
}));

const geolocationMocks = vi.hoisted(() => ({
  getCurrentPosition: vi.fn(),
  formatCoordinates: vi.fn(),
  reverseGeocodeWithFallback: vi.fn(),
}));

vi.mock("../../lib/geolocation", () => geolocationMocks);

vi.mock("../../stores/navigationStore", () => ({
  navigationStore: {
    subscribe: navigationStoreState.store.subscribe,
    navigate: navigationStoreState.navigate,
  },
}));

const avanzadasApiMocks = vi.hoisted(() => ({
  descargarReporteAvanzadaPdf: vi.fn(),
  // RequerimientoFormFields (inside the inline add form) calls this on a
  // debounce to auto-suggest organismos; mocked so it never hits the network.
  clasificarRequerimiento: vi.fn(),
}));

vi.mock("../../api/avanzadas", () => ({
  descargarReporteAvanzadaPdf: avanzadasApiMocks.descargarReporteAvanzadaPdf,
  clasificarRequerimiento: avanzadasApiMocks.clasificarRequerimiento,
  MAX_FOTOS_POR_REQUERIMIENTO: 5,
}));

import DetalleAvanzada from "./DetalleAvanzada.svelte";

const DAGMA = "DAGMA - Departamento Administrativo de Gestión del Medio Ambiente";

/** Type into the Organismos search box, click the option, close via "Aceptar". */
async function selectOrganismo(fullName: string) {
  const container = screen.getByText("Organismos", { selector: ".ms-label" }).closest(".multiselect") as HTMLElement;
  const input = container.querySelector(".ms-input") as HTMLInputElement;
  await fireEvent.focus(input);
  await fireEvent.input(input, { target: { value: fullName.slice(0, 5) } });
  await fireEvent.click(within(container).getByText(fullName, { selector: ".option" }));
  await fireEvent.click(within(container).getByText("Aceptar"));
}

function setStoreState(patch: Partial<ReturnType<typeof avanzadasStoreState.store.get>>) {
  avanzadasStoreState.store.set({ ...avanzadasStoreState.store.get(), ...patch });
}

function requerimiento(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    entidad: "DAGMA",
    categoria: "Poda de árboles (autorización)",
    categoria_personalizada: null,
    requerimiento: "Árbol con riesgo de caída",
    ubicacion: "Frente al parque",
    coordenadas: "3.45, -76.53",
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
    requerimientos: [],
    isOffline: false,
    ...overrides,
  };
}

describe("DetalleAvanzada", () => {
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
    navigationStoreState.store.set({ view: "detalle-avanzada", params: { client_id: "client-1" } });
    avanzadasApiMocks.clasificarRequerimiento.mockResolvedValue({
      organismos_sugeridos: [],
      confianza: 0,
      metodo: "test",
      tipo_requerimiento: "",
      acciones_por_organismo: {},
    });
    geolocationMocks.getCurrentPosition.mockResolvedValue({ latitud: 3.45, longitud: -76.53, accuracy: 5 });
    geolocationMocks.formatCoordinates.mockReturnValue("3.450000, -76.530000");
    geolocationMocks.reverseGeocodeWithFallback.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("reads client_id from navigation params and loads the detail on mount", () => {
    render(DetalleAvanzada);
    expect(avanzadasStoreState.loadAvanzadaDetalle).toHaveBeenCalledWith("client-1");
  });

  it("does not call loadAvanzadaDetalle when there is no client_id in the route params", () => {
    navigationStoreState.store.set({ view: "detalle-avanzada", params: {} });
    render(DetalleAvanzada);
    expect(avanzadasStoreState.loadAvanzadaDetalle).not.toHaveBeenCalled();
  });

  it("shows skeleton placeholders while loading", () => {
    setStoreState({ detalleLoading: { "client-1": true } });
    render(DetalleAvanzada);
    expect(screen.getByLabelText("Cargando detalle de la avanzada")).toBeInTheDocument();
  });

  it("shows an error state with a Reintentar button that reloads the detail", async () => {
    setStoreState({ detalleError: { "client-1": "not found" } });
    render(DetalleAvanzada);
    expect(screen.getByText("not found")).toBeInTheDocument();

    avanzadasStoreState.loadAvanzadaDetalle.mockClear();
    await fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(avanzadasStoreState.loadAvanzadaDetalle).toHaveBeenCalledWith("client-1");
  });

  it("'Volver' navigates back to the avanzadas list", async () => {
    setStoreState({ detalle: { "client-1": detalle() } });
    render(DetalleAvanzada);
    await fireEvent.click(screen.getByText("← Volver"));
    expect(navigationStoreState.navigate).toHaveBeenCalledWith("avanzadas");
  });

  it("shows 'Avanzada no encontrada' when there's no error, not loading, but no detalle either", () => {
    render(DetalleAvanzada);
    expect(screen.getByText("Avanzada no encontrada")).toBeInTheDocument();
  });

  describe("summary section", () => {
    it("renders estrategia, sector, comuna/barrio and dirección", () => {
      setStoreState({ detalle: { "client-1": detalle() } });
      render(DetalleAvanzada);
      expect(screen.getByText("En Un 2x3")).toBeInTheDocument();
      expect(screen.getByText("Sector norte")).toBeInTheDocument();
      expect(screen.getByText("Comuna 1, Salomia")).toBeInTheDocument();
      expect(screen.getByText(/Calle 1 #2-3/)).toBeInTheDocument();
    });

    it("renders a Google Maps link built from coordenadas", () => {
      setStoreState({ detalle: { "client-1": detalle({ coordenadas: "3.45, -76.53" }) } });
      render(DetalleAvanzada);
      const link = screen.getByText("Ver en mapa").closest("a")!;
      expect(link).toHaveAttribute("href", "https://www.google.com/maps?q=3.45,-76.53");
    });

    it("does not render a maps link when coordenadas is missing", () => {
      setStoreState({ detalle: { "client-1": detalle({ coordenadas: null }) } });
      render(DetalleAvanzada);
      expect(screen.queryByText("Ver en mapa")).not.toBeInTheDocument();
    });

    it("renders encargados as chips", () => {
      setStoreState({ detalle: { "client-1": detalle({ encargados: ["Ana Maria Carabali", "Jorge Campaz"] }) } });
      render(DetalleAvanzada);
      expect(screen.getByText("Ana Maria Carabali")).toBeInTheDocument();
      expect(screen.getByText("Jorge Campaz")).toBeInTheDocument();
    });

    it("renders an informe_url link when present", () => {
      setStoreState({
        detalle: { "client-1": detalle({ informe_url: "https://drive.google.com/file/d/abc123/view" }) },
      });
      render(DetalleAvanzada);
      expect(screen.getByText(/Ver informe/)).toBeInTheDocument();
    });

    it("shows an offline pending-sync banner when detalle.isOffline is true", () => {
      setStoreState({ detalle: { "client-1": detalle({ isOffline: true }) } });
      render(DetalleAvanzada);
      expect(screen.getByText(/Pendiente de sincronizar/)).toBeInTheDocument();
    });

    it("clicking 'Crear PDF' downloads the avanzada report", async () => {
      setStoreState({ detalle: { "client-1": detalle() } });
      avanzadasApiMocks.descargarReporteAvanzadaPdf.mockResolvedValue(undefined);
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /crear pdf/i }));

      expect(avanzadasApiMocks.descargarReporteAvanzadaPdf).toHaveBeenCalledWith("client-1");
    });

    it("shows an inline error if the PDF download fails", async () => {
      setStoreState({ detalle: { "client-1": detalle() } });
      avanzadasApiMocks.descargarReporteAvanzadaPdf.mockRejectedValue(new Error("network"));
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /crear pdf/i }));

      expect(await screen.findByText(/no se pudo generar el pdf/i)).toBeInTheDocument();
    });
  });

  describe("actualizar (manual refresh) + background polling", () => {
    it("'Actualizar' triggers a silent background refresh (no full skeleton)", async () => {
      setStoreState({ detalle: { "client-1": detalle() } });
      render(DetalleAvanzada);
      avanzadasStoreState.loadAvanzadaDetalle.mockClear();

      await fireEvent.click(screen.getByRole("button", { name: /^actualizar$/i }));

      expect(avanzadasStoreState.loadAvanzadaDetalle).toHaveBeenCalledWith("client-1", { silent: true });
    });

    it("polls loadAvanzadaDetalle silently every ~40s while mounted", () => {
      vi.useFakeTimers();
      try {
        setStoreState({ detalle: { "client-1": detalle() } });
        render(DetalleAvanzada);
        avanzadasStoreState.loadAvanzadaDetalle.mockClear();

        vi.advanceTimersByTime(40_000);

        expect(avanzadasStoreState.loadAvanzadaDetalle).toHaveBeenCalledWith("client-1", { silent: true });
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops polling once the component unmounts", () => {
      vi.useFakeTimers();
      try {
        setStoreState({ detalle: { "client-1": detalle() } });
        const { unmount } = render(DetalleAvanzada);
        unmount();
        avanzadasStoreState.loadAvanzadaDetalle.mockClear();

        vi.advanceTimersByTime(120_000);

        expect(avanzadasStoreState.loadAvanzadaDetalle).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("'+ Agregar Requerimiento' inline form", () => {
    beforeEach(() => {
      avanzadasStoreState.store.set({
        ...avanzadasStoreState.store.get(),
        catalogos: {
          estrategias: [],
          equipo: [],
          dependencias: ["DAGMA - Departamento Administrativo de Gestión del Medio Ambiente"],
          categorias: { DAGMA: ["Poda de árboles (autorización)", "Otro — DAGMA"] },
        },
      });
    });

    it("reveals the inline form and hides the trigger button", async () => {
      setStoreState({ detalle: { "client-1": detalle() } });
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /agregar requerimiento/i }));

      expect(screen.getByLabelText(/^Organismos/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /agregar requerimiento/i })).not.toBeInTheDocument();
    });

    it("'Cancelar' closes the form without calling agregarRequerimiento", async () => {
      setStoreState({ detalle: { "client-1": detalle() } });
      render(DetalleAvanzada);
      await fireEvent.click(screen.getByRole("button", { name: /agregar requerimiento/i }));

      await fireEvent.click(screen.getByText("Cancelar"));

      expect(screen.queryByLabelText(/^Organismos/)).not.toBeInTheDocument();
      expect(avanzadasStoreState.agregarRequerimiento).not.toHaveBeenCalled();
    });

    it("shows a validation error and doesn't call agregarRequerimiento when required fields are missing", async () => {
      setStoreState({ detalle: { "client-1": detalle() } });
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /agregar requerimiento/i }));
      await fireEvent.click(screen.getByText("Guardar requerimiento"));

      expect(screen.getByText("Seleccione al menos un organismo.")).toBeInTheDocument();
      expect(avanzadasStoreState.agregarRequerimiento).not.toHaveBeenCalled();
    });

    it("submits via avanzadasStore.agregarRequerimiento and closes the form on success", async () => {
      setStoreState({ detalle: { "client-1": detalle() } });
      avanzadasStoreState.agregarRequerimiento.mockResolvedValue(
        requerimiento({ entidad: DAGMA, requerimiento: "Árbol caído" })
      );
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /agregar requerimiento/i }));
      await selectOrganismo(DAGMA);
      await fireEvent.input(screen.getByLabelText(/^Requerimiento/), { target: { value: "Árbol caído" } });
      await fireEvent.change(screen.getByLabelText(/^Categoría/), { target: { value: "__personalizada__" } });
      await fireEvent.input(screen.getByPlaceholderText("Escribe la nueva categoría..."), {
        target: { value: "Poda" },
      });
      await fireEvent.input(screen.getByLabelText(/^Ubicación/), { target: { value: "Frente al parque" } });

      await fireEvent.click(screen.getByText("Guardar requerimiento"));

      expect(avanzadasStoreState.agregarRequerimiento).toHaveBeenCalledTimes(1);
      const [calledClientId, datos] = avanzadasStoreState.agregarRequerimiento.mock.calls[0];
      expect(calledClientId).toBe("client-1");
      expect(datos.entidades).toEqual([DAGMA]);
      expect(datos.entidad).toBe(DAGMA); // legacy field still sent (= entidades[0])
      expect(datos.requerimiento).toBe("Árbol caído");
      expect(datos.ubicacion).toBe("Frente al parque");

      await waitFor(() => {
        expect(screen.queryByLabelText(/^Organismos/)).not.toBeInTheDocument();
      });
    });

    it("GPS button captures the device position and fills the coordinates field", async () => {
      setStoreState({ detalle: { "client-1": detalle() } });
      render(DetalleAvanzada);
      await fireEvent.click(screen.getByRole("button", { name: /agregar requerimiento/i }));

      await fireEvent.click(screen.getByRole("button", { name: /^gps$/i }));

      expect(geolocationMocks.getCurrentPosition).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByPlaceholderText("lat, lng")).toHaveValue("3.450000, -76.530000");
      });
    });
  });

  describe("edit requerimiento", () => {
    beforeEach(() => {
      avanzadasStoreState.store.set({
        ...avanzadasStoreState.store.get(),
        catalogos: {
          estrategias: [],
          equipo: [],
          dependencias: [DAGMA],
          categorias: { [DAGMA]: ["Poda de árboles (autorización)"] },
        },
      });
    });

    const reqExistente = (overrides: Record<string, unknown> = {}) =>
      requerimiento({
        id: "req-42",
        entidad: DAGMA,
        entidades: [DAGMA],
        requerimiento: "Poste caído",
        ubicacion: "Calle 10",
        coordenadas: "3.4, -76.5",
        ...overrides,
      });

    it("'Editar' on a req-card opens the modal prefilled with existing values", async () => {
      setStoreState({ detalle: { "client-1": detalle({ requerimientos: [reqExistente()] }) } });
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /editar requerimiento/i }));

      expect(screen.getByText("Editar requerimiento")).toBeInTheDocument();
      expect(screen.getByLabelText(/^Requerimiento/)).toHaveValue("Poste caído");
      expect(screen.getByLabelText(/^Ubicación/)).toHaveValue("Calle 10");
      expect(screen.getByText("Guardar cambios")).toBeInTheDocument();
    });

    it("prefills a categoría personalizada into the custom-category field", async () => {
      setStoreState({
        detalle: {
          "client-1": detalle({
            requerimientos: [reqExistente({ categoria: "", categoria_personalizada: "Categoría a medida" })],
          }),
        },
      });
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /editar requerimiento/i }));

      expect(screen.getByDisplayValue("Categoría a medida")).toBeInTheDocument();
    });

    it("submits an edit via avanzadasStore.actualizarRequerimiento with clientId, reqId, datos and files", async () => {
      setStoreState({ detalle: { "client-1": detalle({ requerimientos: [reqExistente()] }) } });
      avanzadasStoreState.actualizarRequerimiento.mockResolvedValue(reqExistente());
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /editar requerimiento/i }));
      await fireEvent.input(screen.getByLabelText(/^Requerimiento/), { target: { value: "Poste reparado" } });
      await fireEvent.click(screen.getByText("Guardar cambios"));

      expect(avanzadasStoreState.actualizarRequerimiento).toHaveBeenCalledTimes(1);
      const [calledClientId, calledReqId, datos, files] =
        avanzadasStoreState.actualizarRequerimiento.mock.calls[0];
      expect(calledClientId).toBe("client-1");
      expect(calledReqId).toBe("req-42");
      expect(datos.entidades).toEqual([DAGMA]);
      expect(datos.entidad).toBe(DAGMA); // legacy field still sent (= entidades[0])
      expect(datos.requerimiento).toBe("Poste reparado");
      expect(Array.isArray(files)).toBe(true);
      expect(avanzadasStoreState.agregarRequerimiento).not.toHaveBeenCalled();
    });

    it("closes the modal on success without touching the create path", async () => {
      setStoreState({ detalle: { "client-1": detalle({ requerimientos: [reqExistente()] }) } });
      avanzadasStoreState.actualizarRequerimiento.mockResolvedValue(reqExistente());
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /editar requerimiento/i }));
      await fireEvent.click(screen.getByText("Guardar cambios"));

      await waitFor(() => {
        expect(screen.queryByText("Editar requerimiento")).not.toBeInTheDocument();
      });
    });

    it("Cancelar closes the modal without calling actualizarRequerimiento", async () => {
      setStoreState({ detalle: { "client-1": detalle({ requerimientos: [reqExistente()] }) } });
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /editar requerimiento/i }));
      await fireEvent.click(screen.getByText("Cancelar"));

      await waitFor(() => {
        expect(screen.queryByText("Editar requerimiento")).not.toBeInTheDocument();
      });
      expect(avanzadasStoreState.actualizarRequerimiento).not.toHaveBeenCalled();
    });

    it("deleting the requerimiento being edited closes the modal", async () => {
      setStoreState({ detalle: { "client-1": detalle({ requerimientos: [reqExistente()] }) } });
      avanzadasStoreState.eliminarRequerimiento.mockResolvedValue(undefined);
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /editar requerimiento/i }));
      expect(screen.getByText("Editar requerimiento")).toBeInTheDocument();

      await fireEvent.click(screen.getByRole("button", { name: /^eliminar requerimiento$/i }));
      await fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

      await waitFor(() => {
        expect(screen.queryByText("Editar requerimiento")).not.toBeInTheDocument();
      });
    });
  });

  describe("eliminar requerimiento", () => {
    const reqExistente = () => requerimiento({ id: "req-42", entidad: DAGMA });

    it("shows a confirmation dialog and calls avanzadasStore.eliminarRequerimiento when confirmed", async () => {
      setStoreState({ detalle: { "client-1": detalle({ requerimientos: [reqExistente()] }) } });
      avanzadasStoreState.eliminarRequerimiento.mockResolvedValue(undefined);
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /^eliminar requerimiento$/i }));

      expect(screen.getByText("¿Eliminar este requerimiento? Esta acción no se puede deshacer.")).toBeInTheDocument();
      expect(avanzadasStoreState.eliminarRequerimiento).not.toHaveBeenCalled();

      await fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

      expect(avanzadasStoreState.eliminarRequerimiento).toHaveBeenCalledWith("client-1", "req-42");
      await waitFor(() => {
        expect(
          screen.queryByText("¿Eliminar este requerimiento? Esta acción no se puede deshacer.")
        ).not.toBeInTheDocument();
      });
    });

    it("does not call avanzadasStore.eliminarRequerimiento when the confirmation dialog is cancelled", async () => {
      setStoreState({ detalle: { "client-1": detalle({ requerimientos: [reqExistente()] }) } });
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /^eliminar requerimiento$/i }));
      await fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(avanzadasStoreState.eliminarRequerimiento).not.toHaveBeenCalled();
      expect(
        screen.queryByText("¿Eliminar este requerimiento? Esta acción no se puede deshacer.")
      ).not.toBeInTheDocument();
    });

    it("shows an inline error when the delete fails", async () => {
      setStoreState({ detalle: { "client-1": detalle({ requerimientos: [reqExistente()] }) } });
      avanzadasStoreState.eliminarRequerimiento.mockRejectedValue(new Error("network"));
      render(DetalleAvanzada);

      await fireEvent.click(screen.getByRole("button", { name: /^eliminar requerimiento$/i }));
      await fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

      expect(await screen.findByText("network")).toBeInTheDocument();
    });
  });

  describe("asistentes", () => {
    it("renders nombre/organismo/celular/correo per asistente", () => {
      setStoreState({
        detalle: {
          "client-1": detalle({
            asistentes: [{ nombre: "Juan Pérez", organismo: "DAGMA", celular: "3001234567", correo: "juan@x.com" }],
          }),
        },
      });
      render(DetalleAvanzada);
      expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
      expect(screen.getByText("DAGMA")).toBeInTheDocument();
      expect(screen.getByText("3001234567")).toBeInTheDocument();
      expect(screen.getByText("juan@x.com")).toBeInTheDocument();
    });

    it("shows an empty hint when there are zero asistentes", () => {
      setStoreState({ detalle: { "client-1": detalle({ asistentes: [] }) } });
      render(DetalleAvanzada);
      expect(screen.getByText("Sin asistentes registrados.")).toBeInTheDocument();
    });

    it("is collapsible: clicking the section header hides the asistentes list", async () => {
      setStoreState({
        detalle: { "client-1": detalle({ asistentes: [{ nombre: "Juan Pérez", organismo: "", celular: "", correo: "" }] }) },
      });
      render(DetalleAvanzada);
      expect(screen.getByText("Juan Pérez")).toBeInTheDocument();

      await fireEvent.click(screen.getByText("Asistentes"));
      expect(screen.queryByText("Juan Pérez")).not.toBeInTheDocument();
    });
  });

  describe("requerimientos", () => {
    it("groups requerimientos by entidad with a per-group count badge", () => {
      setStoreState({
        detalle: {
          "client-1": detalle({
            requerimientos: [
              requerimiento({ entidad: "DAGMA" }),
              requerimiento({ entidad: "DAGMA", requerimiento: "Segundo req DAGMA" }),
              requerimiento({ entidad: "UAESP", requerimiento: "Req UAESP" }),
            ],
          }),
        },
      });
      render(DetalleAvanzada);
      expect(screen.getByText("DAGMA", { selector: ".entidad-name" })).toBeInTheDocument();
      expect(screen.getByText("UAESP", { selector: ".entidad-name" })).toBeInTheDocument();
      expect(screen.getByText("Árbol con riesgo de caída")).toBeInTheDocument();
      expect(screen.getByText("Segundo req DAGMA")).toBeInTheDocument();
      expect(screen.getByText("Req UAESP")).toBeInTheDocument();
    });

    it("shows the empty hint when the avanzada has zero requerimientos", () => {
      setStoreState({ detalle: { "client-1": detalle({ requerimientos: [] }) } });
      render(DetalleAvanzada);
      expect(screen.getByText("Esta avanzada no tiene requerimientos registrados.")).toBeInTheDocument();
    });

    it("filters requerimientos by free text across requerimiento/categoria/ubicacion", async () => {
      setStoreState({
        detalle: {
          "client-1": detalle({
            requerimientos: [
              requerimiento({ requerimiento: "Poda urgente de samán" }),
              requerimiento({ requerimiento: "Bache en la vía", ubicacion: "Carrera 5" }),
            ],
          }),
        },
      });
      render(DetalleAvanzada);
      expect(screen.getByText("Poda urgente de samán")).toBeInTheDocument();
      expect(screen.getByText("Bache en la vía")).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Buscar por requerimiento/);
      await fireEvent.input(searchInput, { target: { value: "samán" } });

      expect(screen.getByText("Poda urgente de samán")).toBeInTheDocument();
      expect(screen.queryByText("Bache en la vía")).not.toBeInTheDocument();
    });

    it("filters requerimientos by entidad via the select dropdown", async () => {
      setStoreState({
        detalle: {
          "client-1": detalle({
            requerimientos: [
              requerimiento({ entidad: "DAGMA", requerimiento: "Req DAGMA" }),
              requerimiento({ entidad: "UAESP", requerimiento: "Req UAESP" }),
            ],
          }),
        },
      });
      render(DetalleAvanzada);

      const entidadSelect = screen.getByDisplayValue("Todas las entidades");
      await fireEvent.change(entidadSelect, { target: { value: "UAESP" } });

      expect(screen.queryByText("Req DAGMA")).not.toBeInTheDocument();
      expect(screen.getByText("Req UAESP")).toBeInTheDocument();
    });

    it("shows a 'no match' hint distinct from the zero-requerimientos hint when a filter matches nothing", async () => {
      setStoreState({
        detalle: { "client-1": detalle({ requerimientos: [requerimiento({ requerimiento: "Poda de árbol" })] }) },
      });
      render(DetalleAvanzada);

      const searchInput = screen.getByPlaceholderText(/Buscar por requerimiento/);
      await fireEvent.input(searchInput, { target: { value: "texto-inexistente" } });

      expect(screen.getByText("Ningún requerimiento coincide con el filtro.")).toBeInTheDocument();
      expect(screen.queryByText("Esta avanzada no tiene requerimientos registrados.")).not.toBeInTheDocument();
    });

    it("shows the primary organismo and a '+N más' toggle that reveals the rest", async () => {
      setStoreState({
        detalle: {
          "client-1": detalle({
            requerimientos: [requerimiento({ entidades: ["DAGMA", "UAESP"] })],
          }),
        },
      });
      render(DetalleAvanzada);
      expect(screen.getByText("DAGMA", { selector: ".entidad-chip" })).toBeInTheDocument();
      expect(screen.queryByText("UAESP", { selector: ".entidad-chip" })).not.toBeInTheDocument();

      await fireEvent.click(screen.getByText("+1 más"));

      expect(screen.getByText("UAESP", { selector: ".entidad-chip" })).toBeInTheDocument();
    });

    it("falls back to entidad for a fixture without entidades", () => {
      setStoreState({
        detalle: {
          "client-1": detalle({
            requerimientos: [requerimiento({ entidad: "DAGMA" })],
          }),
        },
      });
      render(DetalleAvanzada);
      expect(screen.getByText("DAGMA", { selector: ".entidad-chip" })).toBeInTheDocument();
    });

    it("an entidad group is collapsible", async () => {
      setStoreState({
        detalle: { "client-1": detalle({ requerimientos: [requerimiento({ entidad: "DAGMA" })] }) },
      });
      render(DetalleAvanzada);
      expect(screen.getByText("Árbol con riesgo de caída")).toBeInTheDocument();

      const entidadHeader = screen.getByText("DAGMA", { selector: ".entidad-name" }).closest("button")!;
      await fireEvent.click(entidadHeader);
      expect(screen.queryByText("Árbol con riesgo de caída")).not.toBeInTheDocument();
    });

    describe("photos", () => {
      it("renders a Drive photo as an <img> whose src is the w400 thumbnail form", () => {
        setStoreState({
          detalle: {
            "client-1": detalle({
              requerimientos: [
                requerimiento({ fotos_urls: ["https://drive.google.com/file/d/abc123/view?usp=drivesdk"] }),
              ],
            }),
          },
        });
        render(DetalleAvanzada);
        const img = screen.getByRole("img") as HTMLImageElement;
        expect(img.src).toBe("https://drive.google.com/thumbnail?id=abc123&sz=w400");
      });

      it("renders a plain (non-Drive) photo URL unchanged", () => {
        setStoreState({
          detalle: {
            "client-1": detalle({
              requerimientos: [requerimiento({ fotos_urls: ["https://catatrack-photos.s3.amazonaws.com/foo.jpg"] })],
            }),
          },
        });
        render(DetalleAvanzada);
        const img = screen.getByRole("img") as HTMLImageElement;
        expect(img.src).toBe("https://catatrack-photos.s3.amazonaws.com/foo.jpg");
      });

      it("swaps to the 'Abrir en Drive' fallback when the <img> fails to load", async () => {
        setStoreState({
          detalle: {
            "client-1": detalle({
              requerimientos: [
                requerimiento({ fotos_urls: ["https://drive.google.com/file/d/abc123/view?usp=drivesdk"] }),
              ],
            }),
          },
        });
        render(DetalleAvanzada);
        const img = screen.getByRole("img");
        await fireEvent.error(img);

        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        const fallbackLink = screen.getByText(/Abrir en Drive/).closest("a")!;
        expect(fallbackLink).toHaveAttribute("href", "https://drive.google.com/file/d/abc123/view");
      });
    });
  });
});
