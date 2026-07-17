/**
 * Behavioral tests for MapaGeneral.svelte — the Mapa section body consumed
 * by PanelUnificado.svelte, covering Avanzadas/Requerimientos/Jornadas (GET
 * /avanzadas/geo). src/api/avanzadas-geo is mocked; the real geoStore
 * (owned by this change) drives state. Leaflet is mocked with a minimal
 * fake so markers/popups/tooltips can be asserted without a real
 * DOM-measurement environment, while everything about filtering, toggling,
 * omitidos, and the table twin is verified against real rendered DOM via
 * @testing-library/svelte.
 *
 * Since this change (PanelUnificado merge), this component no longer loads
 * data on mount, nor renders its own header/refresh button/error block —
 * those are now PanelUnificado's job (see PanelUnificado.test.ts). Tests
 * here drive geoStore directly instead of clicking a since-removed button.
 *
 * geoStore is a module-level singleton, so each test dynamically re-imports
 * the component AND the store together (after vi.resetModules()) to get a
 * fresh, matching pair.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, cleanup, within } from "@testing-library/svelte";

const apiMocks = vi.hoisted(() => ({
  getAvanzadasGeo: vi.fn(),
}));
vi.mock("../../api/avanzadas-geo", () => apiMocks);

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  goHome: vi.fn(),
}));
vi.mock("../../stores/navigationStore", () => ({ navigationStore: navigationMocks }));

// Minimal Leaflet stub. Layer groups are tracked in a registry so the
// CURRENT marker set can be read at any time (layer.clearLayers() truly
// empties that layer's bucket) — updateMarkers() legitimately reruns
// several times per render pass (once before geoStore resolves, again once
// it does), so reading directly off the live FakeLayer instances (instead of
// an ever-appending call log) reflects the latest state instead of
// double-counting across passes.
let layerRegistry: FakeLayer[] = [];

class FakeCircleMarker {
  latlng: [number, number];
  options: any;
  popupContent?: HTMLElement;
  tooltipContent?: string;
  tooltipOpts?: any;
  constructor(latlng: [number, number], options: any) {
    this.latlng = latlng;
    this.options = options;
  }
  bindPopup(content: HTMLElement) {
    this.popupContent = content;
    return this;
  }
  bindTooltip(content: string, opts: any) {
    this.tooltipContent = content;
    this.tooltipOpts = opts;
    return this;
  }
  addTo(layer: FakeLayer) {
    layer.markers.push(this);
    return this;
  }
}
class FakeLayer {
  markers: FakeCircleMarker[] = [];
  addTo() { return this; }
  clearLayers() { this.markers = []; }
}
class FakeMapObject {
  fitBounds() { return this; }
  setView() { return this; }
  invalidateSize() { return this; }
  remove() {}
}
vi.mock("leaflet", () => ({
  default: {
    map: () => new FakeMapObject(),
    tileLayer: () => new FakeLayer(),
    layerGroup: () => {
      const l = new FakeLayer();
      layerRegistry.push(l);
      return l;
    },
    circleMarker: (latlng: [number, number], options: any) => new FakeCircleMarker(latlng, options),
    latLngBounds: () => ({}),
  },
}));

(global as any).ResizeObserver = class {
  observe() {}
  disconnect() {}
};

interface MarkerSnapshot {
  latlng: [number, number];
  options: any;
  popup?: HTMLElement;
  tooltip?: { content: string; opts: any };
}

/** Current marker set across all layer groups (a real, materialized array). */
function currentMarkers(): MarkerSnapshot[] {
  return layerRegistry.flatMap((l) =>
    l.markers.map((m) => ({
      latlng: m.latlng,
      options: m.options,
      popup: m.popupContent,
      tooltip: m.tooltipContent ? { content: m.tooltipContent, opts: m.tooltipOpts } : undefined,
    }))
  );
}

async function freshComponent() {
  vi.resetModules();
  layerRegistry = [];
  const [mod, storeMod] = await Promise.all([
    import("./MapaGeneral.svelte"),
    import("../../stores/geoStore"),
  ]);
  return { MapaGeneral: mod.default, geoStore: storeMod.geoStore };
}

const sample = {
  avanzadas: [
    { client_id: "a1", nombre_avanzada: "Avanzada Centro", fecha: "2026-06-01", estrategia: "En Un 2x3", comuna: "Comuna 1", barrio: "Barrio X", lat: 3.45, lng: -76.53, requerimientos_count: 2 },
    { client_id: "a2", nombre_avanzada: "Avanzada Oriente", fecha: "2026-06-05", estrategia: "Territorio Seguro", comuna: "Comuna 2", barrio: "Barrio Y", lat: 3.46, lng: -76.5, requerimientos_count: 1 },
  ],
  requerimientos: [
    { id: 1, avanzada_client_id: "a1", sigla: "DAGMA", entidad: "Depto. Ambiental", categoria: "Poda de árboles", requerimiento: "Poda urgente en parque", ubicacion: "Cra 1 # 2-3", fecha: "2026-06-01", lat: 3.451, lng: -76.531, fotos_count: 2 },
    { id: 2, avanzada_client_id: "a2", sigla: "EMCALI", entidad: "Empresas Municipales", categoria: "Fuga de agua", requerimiento: "Fuga en la calle 10", ubicacion: "Calle 10 # 5-6", fecha: "2026-06-05", lat: 3.461, lng: -76.501, fotos_count: 0 },
  ],
  jornadas: [
    { client_id: "j1", nombre_jornada: "Jornada Norte", fecha: "2026-06-10", comuna: "Comuna 1", barrio: "Barrio X", estado: "completada", lat: 3.452, lng: -76.532 },
  ],
  omitidos: { avanzadas: 0, requerimientos: 1, jornadas: 0 },
};

const emptySample = {
  avanzadas: [],
  requerimientos: [],
  jornadas: [],
  omitidos: { avanzadas: 0, requerimientos: 0, jornadas: 0 },
};

describe("MapaGeneral", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // MapaGeneral queues a requestAnimationFrame on mount; without unmounting
  // between tests a still-pending frame from a PREVIOUS test's component can
  // fire mid-test and re-populate the (shared, module-scope) Leaflet mock's
  // layerRegistry, doubling marker counts non-deterministically. The
  // component itself now cancels that frame onDestroy (see MapaGeneral.svelte),
  // and this cleanup() ensures onDestroy actually runs between tests.
  afterEach(() => {
    cleanup();
  });

  it("renders three circleMarker layers with the validated palette colors", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    render(MapaGeneral);
    geoStore.load();

    // 2 avanzadas + 2 requerimientos + 1 jornada
    await waitFor(() => expect(currentMarkers().length).toBe(5));

    const colors = new Set(currentMarkers().map((c) => c.options.fillColor));
    expect(colors).toEqual(new Set(["#2563eb", "#008300", "#e87ba4"]));
  });

  it("gives jornadas markers a visibly larger radius than requerimientos/avanzadas plus a permanent tooltip label", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    render(MapaGeneral);
    geoStore.load();
    await waitFor(() => expect(currentMarkers().length).toBe(5));

    const markers = currentMarkers();
    const jornadaMarker = markers.find((c) => c.options.fillColor === "#e87ba4")!;
    const reqMarker = markers.find((c) => c.options.fillColor === "#2563eb")!;
    const avanzadaMarker = markers.find((c) => c.options.fillColor === "#008300")!;

    expect(jornadaMarker.options.radius).toBeGreaterThan(reqMarker.options.radius);
    expect(jornadaMarker.options.radius).toBeGreaterThan(avanzadaMarker.options.radius);
    expect(jornadaMarker.tooltip?.content).toBe("Jornada Norte");
    expect(jornadaMarker.tooltip?.opts.permanent).toBe(true);
  });

  it("uses a 2px white ring on every marker (surface-color ring, not heavy borders)", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    render(MapaGeneral);
    geoStore.load();
    await waitFor(() => expect(currentMarkers().length).toBe(5));

    for (const call of currentMarkers()) {
      expect(call.options.color).toBe("#ffffff");
      expect(call.options.weight).toBe(2);
    }
  });

  it("renders a legend with all three layers", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    const { getByTestId } = render(MapaGeneral);
    geoStore.load();
    await waitFor(() => expect(getByTestId("mg-legend")).toBeInTheDocument());

    const legend = getByTestId("mg-legend");
    expect(legend).toHaveTextContent("Requerimientos");
    expect(legend).toHaveTextContent("Avanzadas");
    expect(legend).toHaveTextContent("Jornadas");
  });

  it("surfaces omitidos honestly instead of silently dropping points", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    const { getByTestId } = render(MapaGeneral);
    geoStore.load();

    await waitFor(() => expect(getByTestId("mg-omitidos")).toHaveTextContent("1 requerimiento sin ubicación registrada."));
  });

  it("does not render an omitidos note when all omitidos counters are 0", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue({ ...sample, omitidos: { avanzadas: 0, requerimientos: 0, jornadas: 0 } });
    const { queryByTestId, getByTestId } = render(MapaGeneral);
    geoStore.load();

    await waitFor(() => expect(getByTestId("mg-legend")).toBeInTheDocument());
    expect(queryByTestId("mg-omitidos")).not.toBeInTheDocument();
  });

  it("filtering by entidad narrows the requerimientos layer without hiding avanzadas/jornadas", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    const { getByLabelText } = render(MapaGeneral);
    geoStore.load();
    await waitFor(() => expect(currentMarkers().length).toBe(5));

    const entidadSelect = getByLabelText(/filtrar por entidad/i) as HTMLSelectElement;
    await fireEvent.change(entidadSelect, { target: { value: "Depto. Ambiental" } });

    await waitFor(() => {
      const reqMarkers = currentMarkers().filter((c) => c.options.fillColor === "#2563eb");
      expect(reqMarkers.length).toBe(1);
    });
    const avanzadaMarkers = currentMarkers().filter((c) => c.options.fillColor === "#008300");
    expect(avanzadaMarkers.length).toBe(2); // unaffected by the entidad filter
  });

  it("toggling off a layer removes it from both the map and the table twin", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    const { getByRole, getByText, queryByText } = render(MapaGeneral);
    geoStore.load();
    await waitFor(() => expect(currentMarkers().length).toBe(5));

    const jornadasToggle = getByRole("checkbox", { name: /jornadas/i });
    await fireEvent.click(jornadasToggle);

    await waitFor(() => {
      const jornadaMarkers = currentMarkers().filter((c) => c.options.fillColor === "#e87ba4");
      expect(jornadaMarkers.length).toBe(0);
    });

    await fireEvent.click(getByRole("button", { name: /ver tabla/i }));
    expect(queryByText("Jornada Norte")).not.toBeInTheDocument();
    expect(getByText("Avanzada Centro")).toBeInTheDocument();
  });

  it("the table twin lists filtered points with layer, name, entidad, comuna, fecha, lat and lng", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    const { getByRole, getByText } = render(MapaGeneral);
    geoStore.load();
    await waitFor(() => expect(currentMarkers().length).toBe(5));

    await fireEvent.click(getByRole("button", { name: /ver tabla/i }));

    const table = within(getByRole("table"));
    expect(table.getByText("Poda urgente en parque")).toBeInTheDocument();
    expect(table.getByText("Depto. Ambiental")).toBeInTheDocument();
    expect(table.getByText("Avanzada Centro")).toBeInTheDocument();
    expect(table.getByText("Jornada Norte")).toBeInTheDocument();
  });

  it("shows a clean empty message instead of a blank map when filters match nothing", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    const { getByLabelText, getByText } = render(MapaGeneral);
    geoStore.load();
    await waitFor(() => expect(currentMarkers().length).toBe(5));

    const busqueda = getByLabelText(/^buscar$/i) as HTMLInputElement;
    await fireEvent.input(busqueda, { target: { value: "esto no existe en ningún punto" } });

    await waitFor(() => expect(getByText(/no hay puntos que coincidan/i)).toBeInTheDocument());
  });

  it("shows a clean empty state when the backend returns no geo data at all", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(emptySample);
    const { getByText } = render(MapaGeneral);
    geoStore.load();

    await waitFor(() => expect(getByText(/no hay puntos que coincidan/i)).toBeInTheDocument());
  });

  // Blocking error/retry UI moved to PanelUnificado (consolidated across the
  // three sections) — see PanelUnificado.test.ts. This component simply
  // shows nothing beyond the wrapper when the store has error-without-data.
  it("renders nothing beyond the wrapper when the first load fails (no local error UI), then recovers once the store gets data", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockRejectedValueOnce(new Error("network down"));
    const { queryByText, getByTestId } = render(MapaGeneral);
    await geoStore.load();

    expect(queryByText(/network down/i)).not.toBeInTheDocument();

    apiMocks.getAvanzadasGeo.mockResolvedValueOnce(sample);
    geoStore.load({ force: true });

    await waitFor(() => expect(getByTestId("mg-legend")).toBeInTheDocument());
  });

  it("clicking a requerimiento marker's popup 'Ver avanzada' link navigates to detalle-avanzada with its avanzada_client_id", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    render(MapaGeneral);
    geoStore.load();
    await waitFor(() => expect(currentMarkers().length).toBe(5));

    const reqMarker = currentMarkers().find((c) => c.options.fillColor === "#2563eb" && c.popup?.textContent?.includes("Poda urgente"));
    expect(reqMarker).toBeTruthy();
    const link = reqMarker!.popup!.querySelector(".mg-popup-link") as HTMLButtonElement;
    expect(link.textContent).toBe("Ver avanzada");
    link.click();

    expect(navigationMocks.navigate).toHaveBeenCalledWith("detalle-avanzada", { client_id: "a1" });
  });

  it("clicking an avanzada marker's popup 'Ver detalle' link navigates to detalle-avanzada with its client_id", async () => {
    const { MapaGeneral, geoStore } = await freshComponent();
    apiMocks.getAvanzadasGeo.mockResolvedValue(sample);
    render(MapaGeneral);
    geoStore.load();
    await waitFor(() => expect(currentMarkers().length).toBe(5));

    const avanzadaMarker = currentMarkers().find((c) => c.options.fillColor === "#008300" && c.popup?.textContent?.includes("Avanzada Centro"));
    const link = avanzadaMarker!.popup!.querySelector(".mg-popup-link") as HTMLButtonElement;
    expect(link.textContent).toBe("Ver detalle");
    link.click();

    expect(navigationMocks.navigate).toHaveBeenCalledWith("detalle-avanzada", { client_id: "a1" });
  });
});
