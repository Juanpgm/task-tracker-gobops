/**
 * Behavioral tests for ReportesJornadas.svelte — the Jornadas section body
 * consumed by PanelUnificado.svelte. src/api/jornadas is mocked; the real
 * jornadasStore (owned by this change) drives state. Renders the real
 * component via @testing-library/svelte and asserts DOM output and
 * interactions.
 *
 * Since this change (PanelUnificado merge), this component no longer loads
 * data on mount, nor renders its own header/refresh button/KPI row/error
 * block — those are now PanelUnificado's job (see PanelUnificado.test.ts).
 * Tests here drive jornadasStore directly instead of clicking a
 * since-removed button.
 *
 * jornadasStore is a module-level singleton, so each test dynamically
 * re-imports the component AND the store together (after vi.resetModules())
 * to get a fresh, matching pair — same pattern as ReportesAvanzadas.test.ts.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";

const apiMocks = vi.hoisted(() => ({
  getEstadisticasJornadas: vi.fn(),
}));
vi.mock("../../api/jornadas", () => apiMocks);

async function freshComponent() {
  vi.resetModules();
  const [mod, storeMod] = await Promise.all([
    import("./ReportesJornadas.svelte"),
    import("../../stores/jornadasStore"),
  ]);
  return { ReportesJornadas: mod.default, jornadasStore: storeMod.jornadasStore };
}

const sample = {
  totales: { jornadas: 2, compromisos: 18, seguimientos: 18, encuestas: 6, asistencia_total: 120, cumplimiento_pct: 72.5 },
  compromisos_por_organismo: [
    { organismo: "DAGMA", total: 10, cumple: 6, no_cumple: 2, novedad: 2 },
    { organismo: "EMCALI", total: 8, cumple: 5, no_cumple: 1, novedad: 2 },
  ],
  compromisos_por_verificacion: [
    { estado: "cumple", total: 11 },
    { estado: "no_cumple", total: 3 },
    { estado: "novedad", total: 4 },
  ],
  seguimientos_por_estado: [
    { estado: "ok", total: 14 },
    { estado: "novedad", total: 3 },
    { estado: "cancelado", total: 1 },
  ],
  encuestas_por_organismo: [
    { org: "DAGMA", bueno: 2, regular: 1, malo: 0, na: 0, total: 3 },
    { org: "EMCALI", bueno: 1, regular: 1, malo: 1, na: 0, total: 3 },
  ],
  jornadas_por_comuna: [{ comuna: "Comuna 1", jornadas: 1, compromisos: 9 }],
  jornadas_lista: [
    { client_id: "j1", nombre_jornada: "Jornada Norte", fecha: "2026-06-10", comuna: "Comuna 1", barrio: "Barrio X", estado: "completada", asistencia_aproximada: 60, compromisos_count: 9 },
    { client_id: "j2", nombre_jornada: "Jornada Sur", fecha: "2026-06-15", comuna: "Comuna 2", barrio: "Barrio Y", estado: "completada", asistencia_aproximada: 60, compromisos_count: 9 },
  ],
};

const emptySample = {
  totales: { jornadas: 0, compromisos: 0, seguimientos: 0, encuestas: 0, asistencia_total: 0, cumplimiento_pct: 0 },
  compromisos_por_organismo: [],
  compromisos_por_verificacion: [],
  seguimientos_por_estado: [],
  encuestas_por_organismo: [],
  jornadas_por_comuna: [],
  jornadas_lista: [],
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("ReportesJornadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading spinner while the store has no data yet, then the charts once data resolves", async () => {
    const { ReportesJornadas, jornadasStore } = await freshComponent();
    const d = deferred<typeof sample>();
    apiMocks.getEstadisticasJornadas.mockReturnValue(d.promise);

    const { getByTestId, getByText, queryByTestId } = render(ReportesJornadas);
    jornadasStore.load();
    await waitFor(() => expect(getByTestId("rj-loading")).toBeInTheDocument());

    d.resolve(sample);
    await waitFor(() => expect(getByText("Cumple")).toBeInTheDocument());
    expect(queryByTestId("rj-loading")).not.toBeInTheDocument();
  });

  it("renders compromisos_por_organismo as a single-hue horizontal bar chart, sorted as given (desc)", async () => {
    const { ReportesJornadas, jornadasStore } = await freshComponent();
    apiMocks.getEstadisticasJornadas.mockResolvedValue(sample);
    const { getAllByText, container } = render(ReportesJornadas);
    jornadasStore.load();

    // "DAGMA"/"EMCALI" appear both as bar labels and in the encuestas table.
    await waitFor(() => expect(getAllByText("DAGMA").length).toBeGreaterThan(0));
    expect(getAllByText("EMCALI").length).toBeGreaterThan(0);

    const marks = container.querySelectorAll<HTMLElement>('[data-testid="bar-fill"]');
    expect(marks.length).toBeGreaterThan(0);
    const colors = new Set(Array.from(marks).map((el) => el.style.backgroundColor));
    expect(colors.size).toBe(1);
  });

  it("renders compromisos_por_verificacion and seguimientos_por_estado as status pills with icon + text label (never color alone)", async () => {
    const { ReportesJornadas, jornadasStore } = await freshComponent();
    apiMocks.getEstadisticasJornadas.mockResolvedValue(sample);
    const { getAllByTestId, getByText, getAllByText } = render(ReportesJornadas);
    jornadasStore.load();

    await waitFor(() => expect(getByText("Cumple")).toBeInTheDocument());
    expect(getByText("No cumple")).toBeInTheDocument();
    expect(getAllByText("Novedad").length).toBe(2); // one in each status block
    expect(getByText("OK")).toBeInTheDocument();
    expect(getByText("Cancelado")).toBeInTheDocument();

    const pills = getAllByTestId("status-pill");
    // Every status pill must contain both an icon (svg) and a text label —
    // never a bare color swatch standing in for meaning.
    for (const pill of pills) {
      expect(pill.querySelector("svg")).toBeInTheDocument();
      expect(pill.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("each status block has its own table-view twin", async () => {
    const { ReportesJornadas, jornadasStore } = await freshComponent();
    apiMocks.getEstadisticasJornadas.mockResolvedValue(sample);
    const { getByText, getAllByRole } = render(ReportesJornadas);
    jornadasStore.load();
    await waitFor(() => expect(getByText("Cumple")).toBeInTheDocument());

    const toggles = getAllByRole("button", { name: /ver tabla/i });
    expect(toggles.length).toBeGreaterThanOrEqual(2);

    await fireEvent.click(toggles[0]);
    expect(getAllByRole("table").length).toBeGreaterThan(0);
  });

  it("renders encuestas_por_organismo as a plain table (never a donut/pie) and explains why given n=6", async () => {
    const { ReportesJornadas, jornadasStore } = await freshComponent();
    apiMocks.getEstadisticasJornadas.mockResolvedValue(sample);
    const { getAllByText, getByText, container } = render(ReportesJornadas);
    jornadasStore.load();

    await waitFor(() => expect(getAllByText(/encuestas por organismo/i).length).toBeGreaterThan(0));
    expect(getByText(/6 encuestas en total/i)).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/conic-gradient/);
    expect(container.querySelectorAll('[class*="donut"], [class*="pie"]').length).toBe(0);
  });

  it("renders jornadas_lista as a compact accessible table", async () => {
    const { ReportesJornadas, jornadasStore } = await freshComponent();
    apiMocks.getEstadisticasJornadas.mockResolvedValue(sample);
    const { getByText } = render(ReportesJornadas);
    jornadasStore.load();

    await waitFor(() => expect(getByText("Jornada Norte")).toBeInTheDocument());
    expect(getByText("Jornada Sur")).toBeInTheDocument();
  });

  it("shows a clean empty state when totales.jornadas is 0", async () => {
    const { ReportesJornadas, jornadasStore } = await freshComponent();
    apiMocks.getEstadisticasJornadas.mockResolvedValue(emptySample);
    const { getByText, queryByRole } = render(ReportesJornadas);
    jornadasStore.load();

    await waitFor(() => expect(getByText(/todavía no hay jornadas registradas/i)).toBeInTheDocument());
    expect(queryByRole("table")).not.toBeInTheDocument();
  });

  // Blocking error/retry UI moved to PanelUnificado (consolidated across the
  // three sections) — see PanelUnificado.test.ts.
  it("renders nothing beyond the wrapper when the store's first load fails (no data, no local error UI)", async () => {
    const { ReportesJornadas, jornadasStore } = await freshComponent();
    apiMocks.getEstadisticasJornadas.mockRejectedValueOnce(new Error("network down"));
    const { container, queryByText } = render(ReportesJornadas);
    await jornadasStore.load();

    expect(queryByText(/network down/i)).not.toBeInTheDocument();
    expect(container.querySelector(".rj-body")).not.toBeInTheDocument();
  });

  it("holds the previous render during a background revalidation triggered externally (no loading flash)", async () => {
    const { ReportesJornadas, jornadasStore } = await freshComponent();
    apiMocks.getEstadisticasJornadas.mockResolvedValueOnce(sample);
    const { getByText, queryByTestId } = render(ReportesJornadas);
    await jornadasStore.load();
    await waitFor(() => expect(getByText("Cumple")).toBeInTheDocument());

    const d = deferred<typeof sample>();
    apiMocks.getEstadisticasJornadas.mockReturnValueOnce(d.promise);

    jornadasStore.load({ force: true });

    await waitFor(() => expect(getByText("Cumple")).toBeInTheDocument());
    expect(queryByTestId("rj-loading")).not.toBeInTheDocument();

    d.resolve({ ...sample, jornadas_lista: [{ client_id: "j3", nombre_jornada: "Jornada Nueva", fecha: "2026-07-01", comuna: "Comuna 3", barrio: "Barrio Z", estado: "completada", asistencia_aproximada: 10, compromisos_count: 1 }] });
    await waitFor(() => expect(getByText("Jornada Nueva")).toBeInTheDocument());
  });
});
