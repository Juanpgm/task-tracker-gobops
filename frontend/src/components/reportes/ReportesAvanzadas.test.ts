/**
 * Behavioral tests for ReportesAvanzadas.svelte — the Avanzadas section body
 * consumed by PanelUnificado.svelte. src/api/avanzadas-estadisticas is
 * mocked; the real estadisticasStore (owned by this change, not shared)
 * drives state. Renders the real component via @testing-library/svelte and
 * asserts DOM output and interactions.
 *
 * Since this change (PanelUnificado merge), this component no longer loads
 * data on mount, nor renders its own header/refresh button/error block —
 * that is now PanelUnificado's job. Tests here drive the store directly
 * (estadisticasStore.load()) instead of clicking a since-removed button.
 *
 * estadisticasStore is a module-level singleton, so each test dynamically
 * re-imports the component AND the store together (after vi.resetModules())
 * to get a fresh, matching pair — otherwise the TTL cache from one test
 * would leak into the next. Same pattern already used by
 * src/stores/avanzadasStore.test.ts.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/svelte";

const apiMocks = vi.hoisted(() => ({
  getEstadisticasAvanzadas: vi.fn(),
}));
vi.mock("../../api/avanzadas-estadisticas", () => apiMocks);

async function freshComponent() {
  vi.resetModules();
  const [mod, storeMod] = await Promise.all([
    import("./ReportesAvanzadas.svelte"),
    import("../../stores/estadisticasStore"),
  ]);
  return { ReportesAvanzadas: mod.default, estadisticasStore: storeMod.estadisticasStore };
}

const sample = {
  totales: {
    avanzadas: 16,
    requerimientos: 326,
    comunas: 12,
    entidades: 13,
    asistentes: 48,
    promedio_requerimientos: 20.4,
  },
  por_entidad: [
    { sigla: "DAGMA", entidad: "Depto. Administrativo de Gestión del Medio Ambiente", total: 90 },
    { sigla: "EMCALI", entidad: "Empresas Municipales de Cali", total: 40 },
  ],
  por_categoria: [
    { categoria: "Poda de árboles (autorización)", sigla: "DAGMA", total: 30 },
    { categoria: "Fugas de agua", sigla: "EMCALI", total: 18 },
  ],
  por_comuna: [
    { comuna: "Comuna 1", avanzadas: 3, requerimientos: 60 },
    { comuna: "Comuna 2", avanzadas: 2, requerimientos: 40 },
  ],
  por_estrategia: [
    { estrategia: "En Un 2x3", avanzadas: 10, requerimientos: 200 },
    { estrategia: "Territorio Seguro", avanzadas: 6, requerimientos: 126 },
  ],
  por_mes: [
    { mes: "2026-05", avanzadas: 4, requerimientos: 80 },
    { mes: "2026-06", avanzadas: 7, requerimientos: 140 },
    { mes: "2026-07", avanzadas: 5, requerimientos: 106 },
  ],
};

const emptySample = {
  totales: { avanzadas: 0, requerimientos: 0, comunas: 0, entidades: 0, asistentes: 0, promedio_requerimientos: 0 },
  por_entidad: [],
  por_categoria: [],
  por_comuna: [],
  por_estrategia: [],
  por_mes: [],
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ReportesAvanzadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading skeleton while the store has no data yet, then the charts once data resolves", async () => {
    const { ReportesAvanzadas, estadisticasStore } = await freshComponent();
    const d = deferred<typeof sample>();
    apiMocks.getEstadisticasAvanzadas.mockReturnValue(d.promise);

    const { getAllByTestId, getByText, queryAllByTestId } = render(ReportesAvanzadas);
    estadisticasStore.load();

    await waitFor(() => expect(getAllByTestId("skeleton").length).toBeGreaterThan(0));

    d.resolve(sample);
    await waitFor(() => expect(getByText("DAGMA")).toBeInTheDocument());

    expect(queryAllByTestId("skeleton")).toHaveLength(0);
  });

  it("renders horizontal bar charts for por_entidad, por_categoria and por_comuna, each with its own table toggle", async () => {
    const { ReportesAvanzadas, estadisticasStore } = await freshComponent();
    apiMocks.getEstadisticasAvanzadas.mockResolvedValue(sample);
    const { getByText, getAllByRole } = render(ReportesAvanzadas);
    estadisticasStore.load();

    await waitFor(() => expect(getByText("DAGMA")).toBeInTheDocument());
    expect(getByText("Poda de árboles (autorización)")).toBeInTheDocument();
    expect(getByText("Comuna 1")).toBeInTheDocument();

    const tableToggles = getAllByRole("button", { name: /ver tabla/i });
    // 3 horizontal bar charts + 2 month column charts = 5 independent table twins
    expect(tableToggles.length).toBe(5);
  });

  it("renders por_mes as two separate small-multiple column charts, not one dual-axis chart", async () => {
    const { ReportesAvanzadas, estadisticasStore } = await freshComponent();
    apiMocks.getEstadisticasAvanzadas.mockResolvedValue(sample);
    const { getByText } = render(ReportesAvanzadas);
    estadisticasStore.load();

    await waitFor(() => expect(getByText(/avanzadas por mes/i)).toBeInTheDocument());
    expect(getByText(/requerimientos por mes/i)).toBeInTheDocument();
  });

  it("renders por_estrategia as stat pills (not a donut/pie) with both avanzadas and requerimientos counts", async () => {
    const { ReportesAvanzadas, estadisticasStore } = await freshComponent();
    apiMocks.getEstadisticasAvanzadas.mockResolvedValue(sample);
    const { getByText, container } = render(ReportesAvanzadas);
    estadisticasStore.load();

    await waitFor(() => expect(getByText("En Un 2x3")).toBeInTheDocument());
    expect(getByText("Territorio Seguro")).toBeInTheDocument();
    expect(getByText("10")).toBeInTheDocument();
    expect(getByText("200")).toBeInTheDocument();
    // No pie/donut mark anywhere in the rendered output (icon glyphs may
    // legitimately contain <circle>, so assert on donut-specific styling
    // instead of a blanket absence of <circle>).
    expect(container.innerHTML).not.toMatch(/conic-gradient/);
    expect(container.querySelectorAll('[class*="donut"], [class*="pie"]').length).toBe(0);
  });

  it("uses a single hue for every bar/column mark across the whole dashboard", async () => {
    const { ReportesAvanzadas, estadisticasStore } = await freshComponent();
    apiMocks.getEstadisticasAvanzadas.mockResolvedValue(sample);
    const { getByText, container } = render(ReportesAvanzadas);
    estadisticasStore.load();
    await waitFor(() => expect(getByText("DAGMA")).toBeInTheDocument());

    const marks = container.querySelectorAll<HTMLElement>('[data-testid="bar-fill"], [data-testid="column-bar"]');
    expect(marks.length).toBeGreaterThan(0);
    const colors = new Set(Array.from(marks).map((el) => el.style.backgroundColor));
    expect(colors.size).toBe(1);
    expect([...colors][0]).toBe("var(--series)");
  });

  it("shows a clean empty state and no chart sections when totales.avanzadas is 0", async () => {
    const { ReportesAvanzadas, estadisticasStore } = await freshComponent();
    apiMocks.getEstadisticasAvanzadas.mockResolvedValue(emptySample);
    const { getByText, queryByRole, queryAllByRole } = render(ReportesAvanzadas);
    estadisticasStore.load();

    await waitFor(() => expect(getByText(/no hay avanzadas registradas/i)).toBeInTheDocument());
    expect(queryByRole("table")).not.toBeInTheDocument();
    expect(queryAllByRole("button", { name: /ver tabla/i })).toHaveLength(0);
  });

  // Blocking error/retry UI moved to PanelUnificado (consolidated across the
  // three sections) — see PanelUnificado.test.ts. This component simply
  // shows nothing extra when the store has error-without-data, since the
  // parent already surfaces a single error block for all three domains.
  it("renders nothing beyond the wrapper when the store's first load fails (no data, no local error UI)", async () => {
    const { ReportesAvanzadas, estadisticasStore } = await freshComponent();
    apiMocks.getEstadisticasAvanzadas.mockRejectedValueOnce(new Error("network down"));
    const { container, queryByText } = render(ReportesAvanzadas);
    await estadisticasStore.load();

    expect(queryByText(/network down/i)).not.toBeInTheDocument();
    expect(container.querySelector(".ra-body")).not.toBeInTheDocument();
  });

  it("holds the previous render during a background revalidation triggered externally (no skeleton flash)", async () => {
    const { ReportesAvanzadas, estadisticasStore } = await freshComponent();
    apiMocks.getEstadisticasAvanzadas.mockResolvedValueOnce(sample);
    const { getByText, queryAllByTestId } = render(ReportesAvanzadas);
    await estadisticasStore.load();
    await waitFor(() => expect(getByText("DAGMA")).toBeInTheDocument());

    const d = deferred<typeof sample>();
    apiMocks.getEstadisticasAvanzadas.mockReturnValueOnce(d.promise);

    estadisticasStore.load({ force: true });

    // Old data stays visible; no skeleton reappears while revalidating.
    await waitFor(() => expect(getByText("DAGMA")).toBeInTheDocument());
    expect(queryAllByTestId("skeleton")).toHaveLength(0);

    d.resolve({ ...sample, por_entidad: [{ sigla: "NUEVO", entidad: "Nueva Entidad", total: 5 }] });
    await waitFor(() => expect(getByText("NUEVO")).toBeInTheDocument());
  });
});
