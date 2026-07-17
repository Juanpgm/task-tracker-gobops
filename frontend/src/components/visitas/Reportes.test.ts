/**
 * Behavioral tests for Reportes.svelte's tab wiring: the unified Reportes
 * panel (PanelUnificado, merging Avanzadas + Mapa + Jornadas) must be the
 * DEFAULT tab, and "Lista de Reportes" must keep working. The legacy
 * "Histórico (legado)" tab and its DashboardRequerimientos body were
 * removed by this change — see PanelUnificado.test.ts,
 * ReportesAvanzadas.test.ts, MapaGeneral.test.ts and
 * ReportesJornadas.test.ts for the merged panel's own behavioral coverage.
 *
 * Dependencies outside this change (leaflet, the avanzadas-estadisticas /
 * avanzadas-geo / jornadas apis, api/visitas) are mocked here — this only
 * mocks within THIS test file's module graph, it does not modify any shared
 * source file.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/svelte";
import Reportes from "./Reportes.svelte";

vi.mock("../../stores/navigationStore", () => ({
  navigationStore: { goHome: vi.fn(), navigate: vi.fn() },
}));

const visitasApiMocks = vi.hoisted(() => ({
  getReportes: vi.fn().mockResolvedValue([]),
  eliminarReporte: vi.fn(),
}));
vi.mock("../../api/visitas", () => visitasApiMocks);

const estadisticasApiMocks = vi.hoisted(() => ({
  getEstadisticasAvanzadas: vi.fn().mockResolvedValue({
    totales: { avanzadas: 16, requerimientos: 326, comunas: 12, entidades: 13, asistentes: 48, promedio_requerimientos: 20.4 },
    por_entidad: [{ sigla: "DAGMA", entidad: "Depto. Ambiental", total: 90 }],
    por_categoria: [],
    por_comuna: [],
    por_estrategia: [],
    por_mes: [],
  }),
}));
vi.mock("../../api/avanzadas-estadisticas", () => estadisticasApiMocks);

const geoApiMocks = vi.hoisted(() => ({
  getAvanzadasGeo: vi.fn().mockResolvedValue({
    avanzadas: [],
    requerimientos: [],
    jornadas: [],
    omitidos: { avanzadas: 0, requerimientos: 0, jornadas: 0 },
  }),
}));
vi.mock("../../api/avanzadas-geo", () => geoApiMocks);

const jornadasApiMocks = vi.hoisted(() => ({
  getEstadisticasJornadas: vi.fn().mockResolvedValue({
    totales: { jornadas: 2, compromisos: 18, seguimientos: 18, encuestas: 6, asistencia_total: 120, cumplimiento_pct: 72.5 },
    compromisos_por_organismo: [],
    compromisos_por_verificacion: [],
    seguimientos_por_estado: [],
    encuestas_por_organismo: [],
    jornadas_por_comuna: [],
    jornadas_lista: [],
  }),
}));
vi.mock("../../api/jornadas", () => jornadasApiMocks);

// MapaGeneral (inside PanelUnificado's Mapa section) uses only the
// circleMarker surface of Leaflet — same minimal stub as MapaGeneral.test.ts
// and PanelUnificado.test.ts. The legacy marker/Control.extend/DomUtil/
// DomEvent surface (only used by the now-deleted MapaRequerimientos.svelte)
// is gone.
vi.mock("leaflet", () => ({
  default: {
    map: () => ({
      fitBounds() { return this; },
      setView() { return this; },
      invalidateSize() { return this; },
      remove() {},
    }),
    tileLayer: () => ({ addTo() { return this; } }),
    layerGroup: () => ({ addTo() { return this; }, clearLayers() {} }),
    circleMarker: () => ({
      bindPopup() { return this; },
      bindTooltip() { return this; },
      addTo() { return this; },
    }),
    latLngBounds: () => ({}),
  },
}));

// jsdom has no ResizeObserver; MapaGeneral observes its container.
(global as any).ResizeObserver = class {
  observe() {}
  disconnect() {}
};

describe("Reportes tab wiring", () => {
  // This file renders the full Reportes tree (including PanelUnificado's
  // three merged sections) repeatedly across tests without vi.resetModules()
  // — the stores are shared singletons on purpose (same pattern as the
  // original tab-wiring test). Without an explicit cleanup(), a previous
  // test's rendered DOM (e.g. its "Avanzadas" section heading) can still be
  // attached when the next test queries document.body, since @testing-
  // library/svelte's render() queries are baseElement-scoped, not
  // container-scoped.
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    visitasApiMocks.getReportes.mockResolvedValue([]);
    estadisticasApiMocks.getEstadisticasAvanzadas.mockResolvedValue({
      totales: { avanzadas: 16, requerimientos: 326, comunas: 12, entidades: 13, asistentes: 48, promedio_requerimientos: 20.4 },
      por_entidad: [{ sigla: "DAGMA", entidad: "Depto. Ambiental", total: 90 }],
      por_categoria: [],
      por_comuna: [],
      por_estrategia: [],
      por_mes: [],
    });
  });

  it("shows the unified Panel tab by default, with all three sections", async () => {
    const { getByRole } = render(Reportes);
    await waitFor(() => expect(getByRole("heading", { name: "Avanzadas", level: 2 })).toBeInTheDocument());
    expect(getByRole("heading", { name: "Mapa", level: 2 })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Jornadas", level: 2 })).toBeInTheDocument();
  });

  it("has no 'Histórico (legado)' tab anymore", async () => {
    const { getByRole, queryByRole } = render(Reportes);
    await waitFor(() => expect(getByRole("heading", { name: "Avanzadas", level: 2 })).toBeInTheDocument());
    expect(queryByRole("button", { name: /histórico \(legado\)/i })).not.toBeInTheDocument();
  });

  it("keeps the 'Lista de Reportes' tab working", async () => {
    visitasApiMocks.getReportes.mockResolvedValue([
      { reporte_id: 1, nombre_up: "UP Test", barrio_vereda: "Barrio X", comuna_corregimiento: "Comuna 1", fecha_visita: "2026-07-01" },
    ]);
    const { getByRole, getByText } = render(Reportes);
    await waitFor(() => expect(getByRole("heading", { name: "Avanzadas", level: 2 })).toBeInTheDocument());

    const listaTab = getByRole("button", { name: /lista de reportes/i });
    await fireEvent.click(listaTab);

    await waitFor(() => expect(getByText("UP Test")).toBeInTheDocument());
  });

  it("switching back to Panel from Lista shows the unified panel again", async () => {
    const { getByRole, queryByRole } = render(Reportes);
    await waitFor(() => expect(getByRole("heading", { name: "Avanzadas", level: 2 })).toBeInTheDocument());

    await fireEvent.click(getByRole("button", { name: /lista de reportes/i }));
    await waitFor(() => expect(queryByRole("heading", { name: "Avanzadas", level: 2 })).not.toBeInTheDocument());

    await fireEvent.click(getByRole("button", { name: /^panel$/i }));
    await waitFor(() => expect(getByRole("heading", { name: "Avanzadas", level: 2 })).toBeInTheDocument());
  });
});
