/**
 * Behavioral tests for RegistrarAvanzada.svelte.
 *
 * Replaces the previous structural (readFileSync + source-matching) test
 * file. These tests render the real component with @testing-library/svelte
 * and drive it like a user would — mocking the store layer (avanzadasStore,
 * navigationStore) and the LocationPicker child (a Leaflet map + GPS
 * component that is out of scope here; see __test-stubs__/LocationPickerStub
 * for why it's stubbed instead of rendered for real). data/avanzadas-catalogo
 * and data/cali-geopolitica are real static data — no need to mock those.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/svelte";

/**
 * This machine's Node runtime defines a global `localStorage` backed by
 * `--localstorage-file` (invalid/unset here), which shadows jsdom's real
 * implementation with a near-empty stub (no setItem/getItem/etc). That's an
 * environment quirk, not something this suite should depend on — so tests
 * that exercise the draft-autosave feature install a real in-memory
 * Storage-compatible stand-in instead.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

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
      catalogos: {
        estrategias: ["En Un 2x3", "Plan de Choque"],
        equipo: ["Ana Maria Carabali", "Jorge Leonardo Campaz"],
        dependencias: ["DAGMA - Departamento Administrativo de Gestión del Medio Ambiente", "UAESP - Unidad Administrativa Especial de Servicios Públicos Municipales"],
        categorias: {
          DAGMA: ["Poda de árboles (autorización)", "Otro — DAGMA"],
          UAESP: ["Otro — UAESP"],
        },
      },
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
    }),
    loadCatalogos: vi.fn(),
    crearAvanzada: vi.fn(),
    loadAvanzadaDetalle: vi.fn(),
    actualizarAvanzada: vi.fn(),
  };
});

/**
 * navigationStore mock as a real reactive store (subscribe/set), same
 * pattern as DetalleAvanzada.test.ts: RegistrarAvanzada.svelte reads
 * $navigationStore.params to detect edit mode (client_id present), so a
 * no-op `subscribe: vi.fn()` (which never calls back) would leave
 * $navigationStore permanently undefined and crash on `.params`. Defaults to
 * {} (create mode) in beforeEach; edit-mode tests override it.
 */
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
    store: createMockStore({ view: "programar-avanzada", params: {} as Record<string, string> }),
    navigate: vi.fn(),
  };
});

vi.mock("../../stores/avanzadasStore", () => ({
  avanzadasStore: {
    subscribe: avanzadasStoreState.store.subscribe,
    loadCatalogos: avanzadasStoreState.loadCatalogos,
    crearAvanzada: avanzadasStoreState.crearAvanzada,
    loadAvanzadaDetalle: avanzadasStoreState.loadAvanzadaDetalle,
    actualizarAvanzada: avanzadasStoreState.actualizarAvanzada,
  },
}));

vi.mock("../../stores/navigationStore", () => ({
  navigationStore: {
    subscribe: navigationStoreState.store.subscribe,
    navigate: navigationStoreState.navigate,
  },
}));

vi.mock("../shared/LocationPicker.svelte", async () => {
  return await import("./__test-stubs__/LocationPickerStub.svelte");
});

const geoLookupMocks = vi.hoisted(() => ({
  lookupComunaBarrio: vi.fn(),
}));
vi.mock("../../lib/geoLookup", () => ({
  lookupComunaBarrio: geoLookupMocks.lookupComunaBarrio,
}));

// RequerimientoFormFields (rendered inside each requerimiento row) calls
// clasificarRequerimiento on a debounce to auto-suggest organismos. It's a
// non-blocking convenience with its own try/catch; here it's mocked to a
// no-suggestion result so it never hits the network from a test.
const avanzadasApiMocks = vi.hoisted(() => ({
  clasificarRequerimiento: vi.fn(),
}));
vi.mock("../../api/avanzadas", () => ({
  clasificarRequerimiento: avanzadasApiMocks.clasificarRequerimiento,
}));

import RegistrarAvanzada from "./RegistrarAvanzada.svelte";

const DAGMA = "DAGMA - Departamento Administrativo de Gestión del Medio Ambiente";
const UAESP = "UAESP - Unidad Administrativa Especial de Servicios Públicos Municipales";
const MOVILIDAD = "Movilidad - Secretaría de Movilidad";

/** The `.multiselect` container for the Organismos field at the given row index. */
function organismoContainer(index = 0): HTMLElement {
  const labels = screen.getAllByText("Organismos", { selector: ".ms-label" });
  return labels[index].closest(".multiselect") as HTMLElement;
}

/** Type into the search box, click the matching option, then close via "Aceptar". */
async function selectOrganismo(fullName: string, index = 0) {
  const container = organismoContainer(index);
  const input = container.querySelector(".ms-input") as HTMLInputElement;
  await fireEvent.focus(input);
  await fireEvent.input(input, { target: { value: fullName.slice(0, 5) } });
  await fireEvent.click(within(container).getByText(fullName, { selector: ".option" }));
  await fireEvent.click(within(container).getByText("Aceptar"));
}

async function openSection(name: string | RegExp) {
  const header = screen.getByText(name, { selector: ".section-title" }).closest("button")!;
  await fireEvent.click(header);
}

async function fillMinimumValidForm() {
  await fireEvent.input(screen.getByLabelText(/Nombre de la avanzada/), { target: { value: "Avanzada de prueba" } });
  await fireEvent.change(screen.getByLabelText(/^Estrategia/), { target: { value: "En Un 2x3" } });
  await fireEvent.click(screen.getByText("Set fake location"));
  await waitFor(() => expect((screen.getByLabelText(/^Comuna/) as HTMLInputElement).value).toBe("Comuna 1"));

  await openSection("Encargados");
  await fireEvent.click(screen.getByText("Ana Maria Carabali"));

  await openSection("Requerimientos");
  // Select the organismo BEFORE typing the requerimiento so the debounced
  // auto-classify short-circuits (it only runs when no organismo is chosen).
  await selectOrganismo(DAGMA);
  await fireEvent.input(screen.getByLabelText(/^Requerimiento/), { target: { value: "Poda urgente" } });
  await fireEvent.input(screen.getByLabelText(/^Ubicación/), { target: { value: "Frente al parque" } });
}

describe("RegistrarAvanzada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    avanzadasStoreState.store.set({
      catalogos: {
        estrategias: ["En Un 2x3", "Plan de Choque"],
        equipo: ["Ana Maria Carabali", "Jorge Leonardo Campaz"],
        dependencias: [
          "DAGMA - Departamento Administrativo de Gestión del Medio Ambiente",
          "UAESP - Unidad Administrativa Especial de Servicios Públicos Municipales",
          "Movilidad - Secretaría de Movilidad",
        ],
        categorias: {
          DAGMA: ["Poda de árboles (autorización)", "Otro — DAGMA"],
          UAESP: ["Otro — UAESP"],
        },
      },
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
    avanzadasApiMocks.clasificarRequerimiento.mockResolvedValue({
      organismos_sugeridos: [],
      confianza: 0,
      metodo: "test",
      tipo_requerimiento: "",
      acciones_por_organismo: {},
    });
    avanzadasStoreState.crearAvanzada.mockResolvedValue({ isOffline: false, client_id: "new-id" });
    navigationStoreState.store.set({ view: "programar-avanzada", params: {} });
    geoLookupMocks.lookupComunaBarrio.mockResolvedValue({ comuna: "Comuna 1", barrio: "Salomia" });
    if (!("createObjectURL" in URL)) {
      // @ts-expect-error jsdom doesn't implement this
      URL.createObjectURL = () => "";
    }
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-preview-url");
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads catalogos on mount", () => {
    render(RegistrarAvanzada);
    expect(avanzadasStoreState.loadCatalogos).toHaveBeenCalledTimes(1);
  });

  describe("validation", () => {
    it("blocks submit and shows a message when the nombre is empty", async () => {
      render(RegistrarAvanzada);
      await fireEvent.click(screen.getByText("Guardar Avanzada"));

      expect(screen.getByText("Ingrese el nombre de la avanzada.")).toBeInTheDocument();
      expect(avanzadasStoreState.crearAvanzada).not.toHaveBeenCalled();
    });

    it("blocks submit and shows the direccion-specific message when lat/lng are set but direccion is empty", async () => {
      render(RegistrarAvanzada);
      await fireEvent.input(screen.getByLabelText(/Nombre de la avanzada/), { target: { value: "Avanzada X" } });
      await fireEvent.change(screen.getByLabelText(/^Estrategia/), { target: { value: "En Un 2x3" } });
      await fireEvent.click(screen.getByText("Set fake coordinates without direccion"));

      await openSection("Encargados");
      await fireEvent.click(screen.getByText("Ana Maria Carabali"));

      await fireEvent.click(screen.getByText("Guardar Avanzada"));

      expect(screen.getByText("La dirección es obligatoria")).toBeInTheDocument();
      expect(avanzadasStoreState.crearAvanzada).not.toHaveBeenCalled();
    });

    it("blocks submit when no encargado is selected", async () => {
      render(RegistrarAvanzada);
      await fireEvent.input(screen.getByLabelText(/Nombre de la avanzada/), { target: { value: "Avanzada X" } });
      await fireEvent.change(screen.getByLabelText(/^Estrategia/), { target: { value: "En Un 2x3" } });
      await fireEvent.click(screen.getByText("Set fake location"));
      await waitFor(() => expect((screen.getByLabelText(/^Comuna/) as HTMLInputElement).value).toBe("Comuna 1"));

      await fireEvent.click(screen.getByText("Guardar Avanzada"));

      expect(screen.getByText("Seleccione al menos un encargado de la avanzada.")).toBeInTheDocument();
      expect(avanzadasStoreState.crearAvanzada).not.toHaveBeenCalled();
    });

    it("blocks submit when a requerimiento is missing its required fields", async () => {
      render(RegistrarAvanzada);
      await fireEvent.input(screen.getByLabelText(/Nombre de la avanzada/), { target: { value: "Avanzada X" } });
      await fireEvent.change(screen.getByLabelText(/^Estrategia/), { target: { value: "En Un 2x3" } });
      await fireEvent.click(screen.getByText("Set fake location"));
      await waitFor(() => expect((screen.getByLabelText(/^Comuna/) as HTMLInputElement).value).toBe("Comuna 1"));
      await openSection("Encargados");
      await fireEvent.click(screen.getByText("Ana Maria Carabali"));

      // Requerimientos section left untouched: entidad/requerimiento/ubicacion all empty.
      await fireEvent.click(screen.getByText("Guardar Avanzada"));

      expect(screen.getByText("Requerimiento #1: la entidad es obligatoria.")).toBeInTheDocument();
      expect(avanzadasStoreState.crearAvanzada).not.toHaveBeenCalled();
    });

    it("passes validation with a fully filled minimal form and opens the confirmation modal", async () => {
      render(RegistrarAvanzada);
      await fillMinimumValidForm();
      await fireEvent.click(screen.getByText("Guardar Avanzada"));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Confirmar registro")).toBeInTheDocument();
      expect(avanzadasStoreState.crearAvanzada).not.toHaveBeenCalled(); // not yet — confirmation pending
    });
  });

  describe("submission", () => {
    it("calls avanzadasStore.crearAvanzada after confirming, and shows the online success message", async () => {
      avanzadasStoreState.crearAvanzada.mockResolvedValue({ isOffline: false, client_id: "new-id" });
      render(RegistrarAvanzada);
      await fillMinimumValidForm();
      await fireEvent.click(screen.getByText("Guardar Avanzada"));
      await fireEvent.click(screen.getByText("Confirmar y guardar"));

      expect(avanzadasStoreState.crearAvanzada).toHaveBeenCalledTimes(1);
      const [datos] = avanzadasStoreState.crearAvanzada.mock.calls[0];
      expect(datos.nombre_avanzada).toBe("Avanzada de prueba");
      expect(datos.encargados).toEqual(["Ana Maria Carabali"]);
      expect(datos.requerimientos).toHaveLength(1);
      expect(datos.requerimientos[0]).toMatchObject({ entidades: [DAGMA], requerimiento: "Poda urgente", ubicacion: "Frente al parque" });

      expect(screen.getByText("Avanzada registrada correctamente.")).toBeInTheDocument();
    });

    it("shows offline feedback (distinct from the online success message) when crearAvanzada resolves isOffline: true", async () => {
      avanzadasStoreState.crearAvanzada.mockResolvedValue({ isOffline: true, client_id: "queued-id" });
      render(RegistrarAvanzada);
      await fillMinimumValidForm();
      await fireEvent.click(screen.getByText("Guardar Avanzada"));
      await fireEvent.click(screen.getByText("Confirmar y guardar"));

      expect(screen.getByText(/guardada localmente/)).toBeInTheDocument();
      expect(screen.queryByText("Avanzada registrada correctamente.")).not.toBeInTheDocument();
    });

    it("'Cancelar' in the confirmation modal closes it without submitting", async () => {
      render(RegistrarAvanzada);
      await fillMinimumValidForm();
      await fireEvent.click(screen.getByText("Guardar Avanzada"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await fireEvent.click(screen.getByText("Cancelar"));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(avanzadasStoreState.crearAvanzada).not.toHaveBeenCalled();
    });
  });

  describe("organismo -> categoria", () => {
    it("populates the categoria select options from the catalog when an organismo is selected", async () => {
      render(RegistrarAvanzada);
      await openSection("Requerimientos");

      const categoriaSelect = screen.getByLabelText(/^Categoría/) as HTMLSelectElement;
      expect(categoriaSelect).toBeDisabled(); // no organismo yet

      await selectOrganismo(DAGMA);

      expect(categoriaSelect).not.toBeDisabled();
      const optionTexts = Array.from(categoriaSelect.options).map((o) => o.textContent);
      expect(optionTexts).toContain("Poda de árboles (autorización)");
      expect(optionTexts).toContain("Otro — DAGMA");
    });

    it("resets the previously chosen categoria when the organismos change again", async () => {
      render(RegistrarAvanzada);
      await openSection("Requerimientos");

      await selectOrganismo(DAGMA);

      const categoriaSelect = screen.getByLabelText(/^Categoría/) as HTMLSelectElement;
      await fireEvent.change(categoriaSelect, { target: { value: "Otro — DAGMA" } });
      expect(categoriaSelect.value).toBe("Otro — DAGMA");

      // Adding another organismo fires the change handler, which clears the
      // now-possibly-stale categoria.
      await selectOrganismo(UAESP);

      expect(categoriaSelect.value).toBe("");
    });

    it("shows '-- Sin categorías predefinidas --' plus the 'agregar nueva' option for an organismo with no known categories", async () => {
      render(RegistrarAvanzada);
      await openSection("Requerimientos");

      await selectOrganismo(MOVILIDAD); // present in dependencias, absent from categorias

      const categoriaSelect = screen.getByLabelText(/^Categoría/) as HTMLSelectElement;
      expect(categoriaSelect).not.toBeDisabled();
      const optionTexts = Array.from(categoriaSelect.options).map((o) => o.textContent);
      expect(optionTexts).toContain("-- Sin categorías predefinidas --");
      expect(optionTexts).toContain("+ Agregar nueva categoría...");
    });

    it("choosing '+ Agregar nueva categoría...' reveals the free-text input, which is absent beforehand", async () => {
      render(RegistrarAvanzada);
      await openSection("Requerimientos");

      await selectOrganismo(DAGMA);

      expect(screen.queryByPlaceholderText("Escribe la nueva categoría...")).not.toBeInTheDocument();

      const categoriaSelect = screen.getByLabelText(/^Categoría/) as HTMLSelectElement;
      await fireEvent.change(categoriaSelect, { target: { value: "__personalizada__" } });

      expect(screen.getByPlaceholderText("Escribe la nueva categoría...")).toBeInTheDocument();
    });
  });

  describe("repeatable rows", () => {
    it("adding an asistente increases the rendered row count; removing it decreases it back", async () => {
      render(RegistrarAvanzada);
      await openSection("Asistencia");

      expect(screen.queryAllByText(/^Asistente #/)).toHaveLength(0);

      await fireEvent.click(screen.getByText("Agregar asistente"));
      expect(screen.getAllByText(/^Asistente #/)).toHaveLength(1);

      await fireEvent.click(screen.getByText("Agregar asistente"));
      expect(screen.getAllByText(/^Asistente #/)).toHaveLength(2);

      await fireEvent.click(screen.getAllByText("Quitar")[0]);
      expect(screen.getAllByText(/^Asistente #/)).toHaveLength(1);
    });

    it("starts with exactly 1 requerimiento row; its Eliminar button is always present but refuses to remove the last card", async () => {
      render(RegistrarAvanzada);
      await openSection("Requerimientos");
      expect(screen.getByText("Requerimiento #1")).toBeInTheDocument();
      expect(screen.queryByText("Requerimiento #2")).not.toBeInTheDocument();
      expect(screen.getByText("Eliminar")).toBeInTheDocument();

      await fireEvent.click(screen.getByText("Eliminar"));

      expect(screen.getByText("Debe haber al menos un requerimiento.")).toBeInTheDocument();
      expect(screen.getByText("Requerimiento #1")).toBeInTheDocument();
    });

    it("adding a requerimiento increases the rendered row count and section badge; removing it decreases it back to 1 (Eliminar stays visible on the sole remaining card)", async () => {
      render(RegistrarAvanzada);
      await openSection("Requerimientos");

      await fireEvent.click(screen.getByText("Agregar otro requerimiento"));
      expect(screen.getByText("Requerimiento #2")).toBeInTheDocument();
      expect(screen.getAllByText("Eliminar")).toHaveLength(2);

      await fireEvent.click(screen.getAllByText("Eliminar")[0]);
      expect(screen.queryByText("Requerimiento #2")).not.toBeInTheDocument();
      expect(screen.getAllByText("Eliminar")).toHaveLength(1);
    });

    it("removing a middle requerimiento renumbers the remaining cards contiguously and preserves their data", async () => {
      render(RegistrarAvanzada);
      await openSection("Requerimientos");

      await fireEvent.click(screen.getByText("Agregar otro requerimiento"));
      await fireEvent.click(screen.getByText("Agregar otro requerimiento"));

      // Use the Requerimiento textarea (short values, no auto-classify) to
      // prove per-row data survives a middle removal + renumber.
      const reqInputs = screen.getAllByLabelText(/^Requerimiento/) as HTMLTextAreaElement[];
      await fireEvent.input(reqInputs[0], { target: { value: "Req A" } });
      await fireEvent.input(reqInputs[1], { target: { value: "Req B" } });
      await fireEvent.input(reqInputs[2], { target: { value: "Req C" } });

      await fireEvent.click(screen.getAllByText("Eliminar")[1]); // remove the middle card ("Req B")

      expect(screen.getByText("Requerimiento #1")).toBeInTheDocument();
      expect(screen.getByText("Requerimiento #2")).toBeInTheDocument();
      expect(screen.queryByText("Requerimiento #3")).not.toBeInTheDocument();

      const remaining = screen.getAllByLabelText(/^Requerimiento/) as HTMLTextAreaElement[];
      expect(remaining.map((i) => i.value)).toEqual(["Req A", "Req C"]);
    });
  });

  describe("datos section extras", () => {
    it("Comuna and Barrio start empty and read-only until a location is set", async () => {
      render(RegistrarAvanzada);
      const comunaInput = screen.getByLabelText(/^Comuna/) as HTMLInputElement;
      const barrioInput = screen.getByLabelText(/^Barrio/) as HTMLInputElement;
      expect(comunaInput).toBeDisabled();
      expect(barrioInput).toBeDisabled();
      expect(comunaInput.value).toBe("");
      expect(barrioInput.value).toBe("");
    });

    it("derives comuna and barrio automatically once a location is set", async () => {
      render(RegistrarAvanzada);
      await fireEvent.click(screen.getByText("Set fake location"));

      await waitFor(() => {
        expect((screen.getByLabelText(/^Comuna/) as HTMLInputElement).value).toBe("Comuna 1");
        expect((screen.getByLabelText(/^Barrio/) as HTMLInputElement).value).toBe("Salomia");
      });
      expect(geoLookupMocks.lookupComunaBarrio).toHaveBeenCalledWith(3.4516, -76.532);
    });

    it("'Otra estrategia...' reveals a free-text field and disables the catalog select", async () => {
      render(RegistrarAvanzada);
      const estrategiaSelect = screen.getByLabelText(/^Estrategia/) as HTMLSelectElement;
      expect(screen.queryByPlaceholderText("Nombre de la estrategia")).not.toBeInTheDocument();

      await fireEvent.click(screen.getByLabelText("Otra estrategia..."));

      expect(estrategiaSelect).toBeDisabled();
      expect(screen.getByPlaceholderText("Nombre de la estrategia")).toBeInTheDocument();
    });
  });

  describe("encargados section extras", () => {
    it("supports adding a free-text encargado not present in the equipo catalog", async () => {
      render(RegistrarAvanzada);
      await openSection("Encargados");

      const freeInput = screen.getByPlaceholderText("Agregar otro encargado...");
      await fireEvent.input(freeInput, { target: { value: "Invitado Externo" } });
      await fireEvent.click(screen.getByText("Agregar"));

      expect(screen.getByText("Invitado Externo")).toBeInTheDocument();
    });
  });

  describe("categoria personalizada", () => {
    it("'+ Agregar nueva categoría...' reveals a free-text field saved as categoria_personalizada", async () => {
      avanzadasStoreState.crearAvanzada.mockResolvedValue({ isOffline: false, client_id: "new-id" });
      render(RegistrarAvanzada);
      await fillMinimumValidForm();

      const categoriaSelect = screen.getByLabelText(/^Categoría/) as HTMLSelectElement;
      await fireEvent.change(categoriaSelect, { target: { value: "__personalizada__" } });

      const customInput = screen.getByPlaceholderText("Escribe la nueva categoría...");
      await fireEvent.input(customInput, { target: { value: "Categoría inventada" } });

      await fireEvent.click(screen.getByText("Guardar Avanzada"));
      await fireEvent.click(screen.getByText("Confirmar y guardar"));

      const [datos] = avanzadasStoreState.crearAvanzada.mock.calls[0];
      expect(datos.requerimientos[0].categoria).toBe("Categoría inventada");
      expect(datos.requerimientos[0].categoria_personalizada).toBe("Categoría inventada");
    });
  });

  describe("photo cap per requerimiento", () => {
    function makeFiles(count: number): File[] {
      return Array.from({ length: count }, (_, i) => new File(["x"], `foto-${i}.jpg`, { type: "image/jpeg" }));
    }

    it("accepts up to MAX_FOTOS_POR_REQUERIMIENTO (5) photos and renders a thumbnail per photo", async () => {
      render(RegistrarAvanzada);
      await openSection("Requerimientos");

      const galeriaInput = screen.getByText("Galería").closest("label")!.querySelector('input[type="file"]')!;
      await fireEvent.change(galeriaInput, { target: { files: makeFiles(5) } });

      expect(document.querySelectorAll(".foto-thumb")).toHaveLength(5);
      expect(screen.queryByText(/máximo 5 fotos permitidas/)).not.toBeInTheDocument();
    });

    it("rejects a batch that would exceed the 5-photo cap and shows the error, without adding any of them", async () => {
      render(RegistrarAvanzada);
      await openSection("Requerimientos");

      const galeriaInput = screen.getByText("Galería").closest("label")!.querySelector('input[type="file"]')!;
      await fireEvent.change(galeriaInput, { target: { files: makeFiles(6) } });

      expect(screen.getByText("Requerimiento #1: máximo 5 fotos permitidas")).toBeInTheDocument();
      expect(document.querySelectorAll(".foto-thumb")).toHaveLength(0);
    });

    it("deleting a thumbnail removes just that photo", async () => {
      render(RegistrarAvanzada);
      await openSection("Requerimientos");

      const galeriaInput = screen.getByText("Galería").closest("label")!.querySelector('input[type="file"]')!;
      await fireEvent.change(galeriaInput, { target: { files: makeFiles(3) } });
      expect(document.querySelectorAll(".foto-thumb")).toHaveLength(3);

      const deleteButtons = document.querySelectorAll(".foto-del");
      await fireEvent.click(deleteButtons[0]);

      expect(document.querySelectorAll(".foto-thumb")).toHaveLength(2);
    });
  });

  describe("inline collect-all validation", () => {
    it("surfaces multiple field errors from a single submit attempt instead of one at a time", async () => {
      render(RegistrarAvanzada);
      await fireEvent.click(screen.getByText("Guardar Avanzada"));

      // Both errors are visible from the FIRST submit — no need to resubmit
      // per fixed field.
      expect(screen.getByText("Ingrese el nombre de la avanzada.")).toBeInTheDocument();
      expect(screen.getByText("Seleccione o ingrese la estrategia.")).toBeInTheDocument();
      expect(screen.getByText("Defina la ubicación (espere al GPS o ajústela en el mapa).")).toBeInTheDocument();
      expect(avanzadasStoreState.crearAvanzada).not.toHaveBeenCalled();
    });

    it("auto-opens a collapsed section that has a validation error", async () => {
      render(RegistrarAvanzada);
      await fillMinimumValidForm();
      // Requerimientos section is left open by fillMinimumValidForm; remove the
      // selected organismo (leaving entidades empty), then collapse the section.
      await fireEvent.click(within(organismoContainer(0)).getByLabelText(/^Quitar/));
      await openSection("Requerimientos"); // collapses it (was open)

      await fireEvent.click(screen.getByText("Guardar Avanzada"));

      expect(screen.getByText("Requerimiento #1: la entidad es obligatoria.")).toBeInTheDocument();
    });
  });

  describe("asistente nombre — honest required asterisk", () => {
    it("blocks submit when an asistente row is left without a nombre, instead of silently dropping it", async () => {
      render(RegistrarAvanzada);
      await fillMinimumValidForm();

      await openSection("Asistencia");
      await fireEvent.click(screen.getByText("Agregar asistente"));
      // Nombre left empty; fill a different field to prove partial rows still
      // block. Target by id: the requerimiento "Organismos" multi-select also
      // matches /^Organismo/, so a label regex would be ambiguous here.
      await fireEvent.input(document.getElementById("asist-organismo-0") as HTMLInputElement, { target: { value: "Alcaldía" } });

      await fireEvent.click(screen.getByText("Guardar Avanzada"));

      expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();
      expect(avanzadasStoreState.crearAvanzada).not.toHaveBeenCalled();
    });

    it("allows submit once every asistente row has a nombre", async () => {
      render(RegistrarAvanzada);
      await fillMinimumValidForm();

      await openSection("Asistencia");
      await fireEvent.click(screen.getByText("Agregar asistente"));
      await fireEvent.input(document.getElementById("asist-nombre-0") as HTMLInputElement, { target: { value: "Carlos Pérez" } });

      await fireEvent.click(screen.getByText("Guardar Avanzada"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.queryByText("El nombre es obligatorio.")).not.toBeInTheDocument();
    });
  });

  describe("comuna/barrio derived from coordinates", () => {
    it("shows an error and blocks submit when the coordinates don't resolve to a known comuna/barrio", async () => {
      geoLookupMocks.lookupComunaBarrio.mockResolvedValue({ comuna: null, barrio: null });
      render(RegistrarAvanzada);
      await fireEvent.input(screen.getByLabelText(/Nombre de la avanzada/), { target: { value: "Avanzada X" } });
      await fireEvent.change(screen.getByLabelText(/^Estrategia/), { target: { value: "En Un 2x3" } });
      await fireEvent.click(screen.getByText("Set fake location"));
      await waitFor(() => expect(geoLookupMocks.lookupComunaBarrio).toHaveBeenCalled());

      await openSection("Encargados");
      await fireEvent.click(screen.getByText("Ana Maria Carabali"));

      await fireEvent.click(screen.getByText("Guardar Avanzada"));

      expect(screen.getByText(/No se pudo determinar la comuna/)).toBeInTheDocument();
      expect(screen.getByText(/No se pudo determinar el barrio/)).toBeInTheDocument();
      expect(avanzadasStoreState.crearAvanzada).not.toHaveBeenCalled();
    });
  });

  describe("draft autosave", () => {
    it("autosaves typed data to localStorage after a debounce, and restores it on next mount", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const { unmount } = render(RegistrarAvanzada);
        await fireEvent.input(screen.getByLabelText(/Nombre de la avanzada/), { target: { value: "Borrador de prueba" } });

        await vi.advanceTimersByTimeAsync(700);
        expect(localStorage.getItem("catatrack:draft:registrar-avanzada")).toContain("Borrador de prueba");

        unmount();
        cleanup();

        render(RegistrarAvanzada);
        expect(screen.getByText("Se restauró un borrador guardado automáticamente.")).toBeInTheDocument();
        expect((screen.getByLabelText(/Nombre de la avanzada/) as HTMLInputElement).value).toBe("Borrador de prueba");
      } finally {
        vi.useRealTimers();
      }
    });

    it("restores a saved requerimiento's fields into the new card UI", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const { unmount } = render(RegistrarAvanzada);
        await openSection("Requerimientos");
        await selectOrganismo(DAGMA);
        await fireEvent.input(screen.getByLabelText(/^Requerimiento/), { target: { value: "Poda urgente" } });
        await fireEvent.input(screen.getByLabelText(/^Ubicación/), { target: { value: "Frente al parque" } });

        await vi.advanceTimersByTimeAsync(700);
        expect(localStorage.getItem("catatrack:draft:registrar-avanzada")).toContain("Poda urgente");

        unmount();
        cleanup();

        render(RegistrarAvanzada);
        await openSection("Requerimientos");

        // The organismo comes back as a selected chip in the multi-select.
        expect(organismoContainer(0)).toHaveTextContent(/DAGMA/);
        expect((screen.getByLabelText(/^Requerimiento/) as HTMLTextAreaElement).value).toBe("Poda urgente");
        expect((screen.getByLabelText(/^Ubicación/) as HTMLInputElement).value).toBe("Frente al parque");
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not persist an all-empty form (no draft noise from opening the view)", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        render(RegistrarAvanzada);
        await vi.advanceTimersByTimeAsync(700);
        expect(localStorage.getItem("catatrack:draft:registrar-avanzada")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("clears the draft after a successful save", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        render(RegistrarAvanzada);
        await fillMinimumValidForm();
        await vi.advanceTimersByTimeAsync(700);
        expect(localStorage.getItem("catatrack:draft:registrar-avanzada")).not.toBeNull();

        await fireEvent.click(screen.getByText("Guardar Avanzada"));
        await fireEvent.click(screen.getByText("Confirmar y guardar"));

        expect(localStorage.getItem("catatrack:draft:registrar-avanzada")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("edit mode (client_id present in navigation params)", () => {
    function detalleMock(overrides: Record<string, unknown> = {}) {
      return {
        client_id: "client-1",
        nombre_avanzada: "Avanzada Comuna 1",
        fecha: "2026-07-16",
        estrategia: "En Un 2x3",
        sector: "Sector norte",
        comuna: "Comuna 1",
        barrio: "Salomia",
        direccion: "Calle 1 #2-3",
        coordenadas: "3.4516, -76.532",
        encargados: ["Ana Maria Carabali"],
        asistentes: [
          {
            nombre: "Juan Pérez",
            organismo: "DAGMA",
            celular: "3001234567",
            correo: "juan@x.com",
            foto_url: "https://example.com/foto.jpg",
          },
        ],
        requerimientos: [],
        requerimientos_count: 0,
        isOffline: false,
        ...overrides,
      };
    }

    function setEditMode(detalle: ReturnType<typeof detalleMock> | null, opts: { loading?: boolean } = {}) {
      navigationStoreState.store.set({ view: "editar-avanzada", params: { client_id: "client-1" } });
      avanzadasStoreState.store.set({
        ...avanzadasStoreState.store.get(),
        detalle: detalle ? { "client-1": detalle } : {},
        detalleLoading: { "client-1": !!opts.loading },
        detalleError: {},
      });
    }

    it("calls loadAvanzadaDetalle with the client_id on mount and shows the 'Editar Avanzada' title", () => {
      setEditMode(null);
      render(RegistrarAvanzada);
      expect(avanzadasStoreState.loadAvanzadaDetalle).toHaveBeenCalledWith("client-1");
      expect(screen.getByText("Editar Avanzada")).toBeInTheDocument();
    });

    it("shows a loading hint instead of the form while the detalle is being fetched", () => {
      setEditMode(null, { loading: true });
      render(RegistrarAvanzada);
      expect(screen.getByText("Cargando avanzada…")).toBeInTheDocument();
      expect(screen.queryByLabelText(/Nombre de la avanzada/)).not.toBeInTheDocument();
    });

    it("prefills the form fields (incl. asistentes) from the loaded detalle", async () => {
      setEditMode(detalleMock());
      render(RegistrarAvanzada);

      await waitFor(() => {
        expect((screen.getByLabelText(/Nombre de la avanzada/) as HTMLInputElement).value).toBe("Avanzada Comuna 1");
      });
      expect((screen.getByLabelText(/^Fecha/) as HTMLInputElement).value).toBe("2026-07-16");
      expect((screen.getByLabelText(/^Estrategia/) as HTMLSelectElement).value).toBe("En Un 2x3");
      expect((screen.getByLabelText(/^Sector/) as HTMLInputElement).value).toBe("Sector norte");

      const asistenciaHeader = screen.getByText(/^Asistencia/, { selector: ".section-title" }).closest("button")!;
      await fireEvent.click(asistenciaHeader);
      expect((document.getElementById("asist-nombre-0") as HTMLInputElement).value).toBe("Juan Pérez");
      expect((document.getElementById("asist-organismo-0") as HTMLInputElement).value).toBe("DAGMA");
    });

    it("hides the Requerimientos section entirely (it's a separate sub-resource, edited from DetalleAvanzada)", () => {
      setEditMode(detalleMock());
      render(RegistrarAvanzada);
      expect(screen.queryByText("Requerimientos", { selector: ".section-title" })).not.toBeInTheDocument();
    });

    it("hides the 'Foto del equipo' picker (PATCH/PUT doesn't accept foto_equipo)", async () => {
      setEditMode(detalleMock());
      render(RegistrarAvanzada);
      await openSection("Encargados");
      expect(screen.queryByText("Foto del equipo")).not.toBeInTheDocument();
    });

    it("submits via actualizarAvanzada (not crearAvanzada), omits requerimientos, and navigates to the detail view on success", async () => {
      setEditMode(detalleMock());
      avanzadasStoreState.actualizarAvanzada.mockResolvedValue(detalleMock());
      render(RegistrarAvanzada);

      await waitFor(() => {
        expect((screen.getByLabelText(/Nombre de la avanzada/) as HTMLInputElement).value).toBe("Avanzada Comuna 1");
      });

      await fireEvent.click(screen.getByText("Guardar cambios"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await fireEvent.click(screen.getByText("Confirmar y guardar"));

      expect(avanzadasStoreState.actualizarAvanzada).toHaveBeenCalledTimes(1);
      expect(avanzadasStoreState.crearAvanzada).not.toHaveBeenCalled();

      const [calledClientId, datos] = avanzadasStoreState.actualizarAvanzada.mock.calls[0];
      expect(calledClientId).toBe("client-1");
      expect(datos.nombre_avanzada).toBe("Avanzada Comuna 1");
      expect(datos).not.toHaveProperty("requerimientos");
      expect(datos).not.toHaveProperty("client_id");

      expect(navigationStoreState.navigate).toHaveBeenCalledWith("detalle-avanzada", { client_id: "client-1" });
    });

    it("shows an error message (without navigating away) when actualizarAvanzada fails", async () => {
      setEditMode(detalleMock());
      avanzadasStoreState.actualizarAvanzada.mockRejectedValue(new Error("network down"));
      render(RegistrarAvanzada);

      await waitFor(() => {
        expect((screen.getByLabelText(/Nombre de la avanzada/) as HTMLInputElement).value).toBe("Avanzada Comuna 1");
      });

      await fireEvent.click(screen.getByText("Guardar cambios"));
      await fireEvent.click(screen.getByText("Confirmar y guardar"));

      expect(await screen.findByText("network down")).toBeInTheDocument();
      expect(navigationStoreState.navigate).not.toHaveBeenCalledWith("detalle-avanzada", { client_id: "client-1" });
    });
  });
});
