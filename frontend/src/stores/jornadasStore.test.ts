/**
 * Tests for src/stores/jornadasStore.ts.
 * Seam under test: the store's public interface (subscribe + load).
 * src/api/jornadas is mocked so we can assert the SWR-ish contract precisely
 * — same contract as estadisticasStore.test.ts:
 *   1. First load() blocks with loading=true and no previous data.
 *   2. A resolved fetch within the TTL window is served from memory (no refetch).
 *   3. force:true always refetches regardless of freshness.
 *   4. Revalidation (stale data, background refetch) HOLDS the previous data
 *      and flips revalidating=true — no loading flash, no data wipe.
 *   5. A failed revalidation keeps the old data and sets revalidateError,
 *      without touching the blocking `error` field.
 *   6. A failed first load sets the blocking `error` field (data stays null).
 *   7. A stale (superseded) request does not clobber a fresher one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";

const apiMocks = vi.hoisted(() => ({
  getEstadisticasJornadas: vi.fn(),
}));

vi.mock("../api/jornadas", () => apiMocks);

const sample = {
  totales: { jornadas: 2, compromisos: 18, seguimientos: 18, encuestas: 6, asistencia_total: 120, cumplimiento_pct: 72.5 },
  compromisos_por_organismo: [{ organismo: "DAGMA", total: 10, cumple: 6, no_cumple: 2, novedad: 2 }],
  compromisos_por_verificacion: [{ estado: "cumple", total: 12 }],
  seguimientos_por_estado: [{ estado: "ok", total: 15 }],
  encuestas_por_organismo: [{ org: "DAGMA", bueno: 2, regular: 1, malo: 0, na: 0, total: 3 }],
  jornadas_por_comuna: [{ comuna: "Comuna 1", jornadas: 1, compromisos: 9 }],
  jornadas_lista: [
    { client_id: "j1", nombre_jornada: "Jornada 1", fecha: "2026-06-02", comuna: "Comuna 2", barrio: "Barrio Y", estado: "completada", asistencia_aproximada: 60, compromisos_count: 9 },
  ],
};

const sampleUpdated = {
  ...sample,
  totales: { ...sample.totales, jornadas: 3 },
};

async function freshStore() {
  vi.resetModules();
  const mod = await import("./jornadasStore");
  return mod.jornadasStore;
}

/** Manually-resolvable/rejectable promise, for controlling resolution order. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("jornadasStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with no data and not loading", async () => {
    const store = await freshStore();
    const state = get(store);
    expect(state.data).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.revalidating).toBe(false);
  });

  it("first load() sets loading=true, then resolves with data and loading=false", async () => {
    const store = await freshStore();
    const d = deferred<typeof sample>();
    apiMocks.getEstadisticasJornadas.mockReturnValue(d.promise);

    const pending = store.load();
    expect(get(store).loading).toBe(true);
    expect(get(store).data).toBeNull();

    d.resolve(sample);
    await pending;

    const state = get(store);
    expect(state.loading).toBe(false);
    expect(state.data).toEqual(sample);
    expect(state.error).toBeNull();
    expect(state.lastFetchedAt).not.toBeNull();
  });

  it("does not refetch within the TTL window", async () => {
    const store = await freshStore();
    apiMocks.getEstadisticasJornadas.mockResolvedValue(sample);

    await store.load();
    await store.load();

    expect(apiMocks.getEstadisticasJornadas).toHaveBeenCalledTimes(1);
  });

  it("force:true refetches even when data is fresh", async () => {
    const store = await freshStore();
    apiMocks.getEstadisticasJornadas.mockResolvedValue(sample);

    await store.load();
    await store.load({ force: true });

    expect(apiMocks.getEstadisticasJornadas).toHaveBeenCalledTimes(2);
  });

  it("revalidation holds previous data (no skeleton flash) and flips revalidating", async () => {
    const store = await freshStore();
    apiMocks.getEstadisticasJornadas.mockResolvedValueOnce(sample);
    await store.load();
    expect(get(store).data).toEqual(sample);

    const d = deferred<typeof sampleUpdated>();
    apiMocks.getEstadisticasJornadas.mockReturnValueOnce(d.promise);

    const pending = store.load({ force: true });
    const midState = get(store);
    expect(midState.revalidating).toBe(true);
    expect(midState.loading).toBe(false);
    expect(midState.data).toEqual(sample); // old data held, no wipe

    d.resolve(sampleUpdated);
    await pending;

    const finalState = get(store);
    expect(finalState.revalidating).toBe(false);
    expect(finalState.data).toEqual(sampleUpdated);
  });

  it("a failed revalidation keeps old data and sets revalidateError, not the blocking error", async () => {
    const store = await freshStore();
    apiMocks.getEstadisticasJornadas.mockResolvedValueOnce(sample);
    await store.load();

    apiMocks.getEstadisticasJornadas.mockRejectedValueOnce(new Error("network down"));
    await store.load({ force: true });

    const state = get(store);
    expect(state.data).toEqual(sample);
    expect(state.error).toBeNull();
    expect(state.revalidateError).toBe("network down");
    expect(state.revalidating).toBe(false);
  });

  it("a failed first load sets the blocking error and leaves data null", async () => {
    const store = await freshStore();
    apiMocks.getEstadisticasJornadas.mockRejectedValueOnce(new Error("boom"));

    await store.load();

    const state = get(store);
    expect(state.data).toBeNull();
    expect(state.error).toBe("boom");
    expect(state.loading).toBe(false);
  });

  it("a stale request does not clobber a fresher one (concurrency fence)", async () => {
    const store = await freshStore();
    const first = deferred<typeof sample>();
    const second = deferred<typeof sampleUpdated>();
    apiMocks.getEstadisticasJornadas
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const p1 = store.load();
    const p2 = store.load({ force: true });

    // Second (fresher) request resolves first; first (stale) resolves after.
    second.resolve(sampleUpdated);
    await p2;
    first.resolve(sample);
    await p1;

    expect(get(store).data).toEqual(sampleUpdated);
  });
});
