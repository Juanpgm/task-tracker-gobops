/**
 * Behavioral tests for PanelUnificado.svelte — the unified, scrollable
 * Reportes view that merges Avanzadas + Mapa + Jornadas into one panel.
 * src/api/avanzadas-estadisticas, src/api/avanzadas-geo and src/api/jornadas
 * are mocked; the real estadisticasStore/geoStore/jornadasStore (module-level
 * singletons) drive state, same pattern as ReportesAvanzadas.test.ts /
 * MapaGeneral.test.ts / ReportesJornadas.test.ts.
 *
 * Each test dynamically re-imports the component AND the three stores
 * together (after vi.resetModules()) so spies/assertions attach to the same
 * fresh singleton instances the rendered component actually uses.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, within } from "@testing-library/svelte";

const estadisticasApiMocks = vi.hoisted(() => ({
  getEstadisticasAvanzadas: vi.fn(),
}));
vi.mock("../../api/avanzadas-estadisticas", () => estadisticasApiMocks);

const geoApiMocks = vi.hoisted(() => ({
  getAvanzadasGeo: vi.fn(),
}));
vi.mock("../../api/avanzadas-geo", () => geoApiMocks);

const jornadasApiMocks = vi.hoisted(() => ({
  getEstadisticasJornadas: vi.fn(),
}));
vi.mock("../../api/jornadas", () => jornadasApiMocks);

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  goHome: vi.fn(),
}));
vi.mock("../../stores/navigationStore", () => ({ navigationStore: navigationMocks }));

// MapaGeneral (nested inside PanelUnificado's Mapa section) touches only the
// circleMarker surface of Leaflet — same minimal stub as MapaGeneral.test.ts.
class FakeCircleMarker {
  bindPopup() { return this; }
  bindTooltip() { return this; }
  addTo() { return this; }
}
class FakeLayer {
  addTo() { return this; }
  clearLayers() {}
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
    layerGroup: () => new FakeLayer(),
    circleMarker: () => new FakeCircleMarker(),
    latLngBounds: () => ({}),
  },
}));

(global as any).ResizeObserver = class {
  observe() {}
  disconnect() {}
};

const avanzadasSample = {
  totales: {
    avanzadas: 16,
    requerimientos: 326,
    comunas: 12,
    entidades: 13,
    asistentes: 48,
    promedio_requerimientos: 20.4,
  },
  por_entidad: [{ sigla: "DAGMA", entidad: "Depto. Ambiental", total: 90 }],
  por_categoria: [],
  por_comuna: [],
  por_estrategia: [],
  por_mes: [],
};

const geoSample = {
  avanzadas: [],
  requerimientos: [],
  jornadas: [],
  omitidos: { avanzadas: 0, requerimientos: 0, jornadas: 0 },
};

const jornadasSample = {
  totales: { jornadas: 2, compromisos: 18, seguimientos: 18, encuestas: 6, asistencia_total: 120, cumplimiento_pct: 72.5 },
  compromisos_por_organismo: [],
  compromisos_por_verificacion: [
    { estado: "cumple", total: 11 },
    { estado: "no_cumple", total: 3 },
  ],
  seguimientos_por_estado: [],
  encuestas_por_organismo: [],
  jornadas_por_comuna: [],
  jornadas_lista: [],
};

async function freshComponent() {
  vi.resetModules();
  const [panelMod, estMod, geoMod, jorMod] = await Promise.all([
    import("./PanelUnificado.svelte"),
    import("../../stores/estadisticasStore"),
    import("../../stores/geoStore"),
    import("../../stores/jornadasStore"),
  ]);
  return {
    PanelUnificado: panelMod.default,
    estadisticasStore: estMod.estadisticasStore,
    geoStore: geoMod.geoStore,
    jornadasStore: jorMod.jornadasStore,
  };
}

function mockAllHappy() {
  estadisticasApiMocks.getEstadisticasAvanzadas.mockResolvedValue(avanzadasSample);
  geoApiMocks.getAvanzadasGeo.mockResolvedValue(geoSample);
  jornadasApiMocks.getEstadisticasJornadas.mockResolvedValue(jornadasSample);
}

describe("PanelUnificado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all three section headers", async () => {
    const { PanelUnificado } = await freshComponent();
    mockAllHappy();
    const { getByRole } = render(PanelUnificado);

    await waitFor(() => expect(getByRole("heading", { name: "Avanzadas", level: 2 })).toBeInTheDocument());
    expect(getByRole("heading", { name: "Mapa", level: 2 })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Jornadas", level: 2 })).toBeInTheDocument();
  });

  it("has one refresh button that force-refreshes all three stores together", async () => {
    const { PanelUnificado, estadisticasStore, geoStore, jornadasStore } = await freshComponent();
    mockAllHappy();
    const estSpy = vi.spyOn(estadisticasStore, "load");
    const geoSpy = vi.spyOn(geoStore, "load");
    const jorSpy = vi.spyOn(jornadasStore, "load");

    const { getAllByRole, getByRole } = render(PanelUnificado);
    await waitFor(() => expect(getByRole("heading", { name: "Avanzadas", level: 2 })).toBeInTheDocument());

    // Exactly one "Actualizar" control for the whole panel (the three
    // section components no longer render their own).
    const refreshButtons = getAllByRole("button", { name: /actualizar/i });
    expect(refreshButtons).toHaveLength(1);

    await fireEvent.click(refreshButtons[0]);

    expect(estSpy).toHaveBeenCalledWith({ force: true });
    expect(geoSpy).toHaveBeenCalledWith({ force: true });
    expect(jorSpy).toHaveBeenCalledWith({ force: true });
  });

  it("shows a consolidated blocking error with retry when a store's first load fails", async () => {
    const { PanelUnificado } = await freshComponent();
    estadisticasApiMocks.getEstadisticasAvanzadas.mockRejectedValueOnce(new Error("network down"));
    geoApiMocks.getAvanzadasGeo.mockResolvedValue(geoSample);
    jornadasApiMocks.getEstadisticasJornadas.mockResolvedValue(jornadasSample);

    const { getByText, getByTestId, getAllByRole } = render(PanelUnificado);

    await waitFor(() => expect(getByTestId("pu-error-block")).toBeInTheDocument());
    expect(getByText(/network down/i)).toBeInTheDocument();

    // Only ONE consolidated error block, not one per section.
    expect(getAllByRole("button", { name: /reintentar/i })).toHaveLength(1);
  });

  it("shows a consolidated revalidate warning when a background refresh fails without wiping visible data", async () => {
    const { PanelUnificado } = await freshComponent();
    mockAllHappy();

    const { getByRole, getByTestId } = render(PanelUnificado);
    await waitFor(() => expect(getByRole("heading", { name: "Avanzadas", level: 2 })).toBeInTheDocument());

    geoApiMocks.getAvanzadasGeo.mockRejectedValueOnce(new Error("timeout"));
    await fireEvent.click(getByRole("button", { name: /actualizar/i }));

    await waitFor(() => expect(getByTestId("pu-revalidate-warning")).toHaveTextContent(/timeout/i));
  });

  it("shows both hero figures (avanzadas total and jornadas cumplimiento) in the combined KPI strip", async () => {
    const { PanelUnificado } = await freshComponent();
    mockAllHappy();
    const { getByTestId } = render(PanelUnificado);

    await waitFor(() => expect(getByTestId("pu-kpi-hero-avanzadas")).toHaveTextContent("16"));
    expect(getByTestId("pu-kpi-hero-jornadas")).toHaveTextContent("72,5%");
  });

  it("gives each section wrapper its own domain hue class", async () => {
    const { PanelUnificado } = await freshComponent();
    mockAllHappy();
    const { getByTestId } = render(PanelUnificado);

    await waitFor(() => expect(getByTestId("seccion-avanzadas")).toBeInTheDocument());
    expect(getByTestId("seccion-avanzadas")).toHaveClass("domain-avanzadas");
    expect(getByTestId("seccion-mapa")).toHaveClass("domain-mapa");
    expect(getByTestId("seccion-jornadas")).toHaveClass("domain-jornadas");
  });

  it("keeps Jornadas status pills on semantic tone classes, never domain-tinted", async () => {
    const { PanelUnificado } = await freshComponent();
    mockAllHappy();
    const { getByTestId } = render(PanelUnificado);

    const jornadasSection = within(getByTestId("seccion-jornadas"));
    await waitFor(() => expect(jornadasSection.getAllByTestId("status-pill").length).toBeGreaterThan(0));
    const pills = jornadasSection.getAllByTestId("status-pill");
    for (const pill of pills) {
      const hasToneClass = /(^|\s)tone-(success|warning|error|info)(\s|$)/.test(pill.className);
      expect(hasToneClass).toBe(true);
      expect(pill.className).not.toMatch(/domain-/);
      // Status pills use --success/--warning/--error/--info tokens, not the
      // domain --series hue, so no pill should carry an inline --series ref.
      expect(pill.getAttribute("style") ?? "").not.toMatch(/--series/);
    }
  });
});
