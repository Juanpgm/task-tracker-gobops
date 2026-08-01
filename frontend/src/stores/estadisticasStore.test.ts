/**
 * Tests for src/stores/estadisticasStore.ts.
 * Seam under test: the store's public interface (subscribe + load).
 * src/api/avanzadas-estadisticas is mocked so we can assert the SWR-ish
 * contract precisely:
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
import { SESSION_EXPIRED } from "../lib/auth-error-messages";

const apiMocks = vi.hoisted(() => ({
  getEstadisticasAvanzadas: vi.fn(),
}));

vi.mock("../api/avanzadas-estadisticas", () => apiMocks);

const sample = {
  totales: {
    avanzadas: 16,
    requerimientos: 326,
    comunas: 12,
    entidades: 13,
    asistentes: 48,
    promedio_requerimientos: 20.4,
  },
  por_entidad: [{ sigla: "DAGMA", entidad: "Depto. Gestión Ambiental", total: 90 }],
  por_categoria: [{ categoria: "Poda de árboles", sigla: "DAGMA", total: 30 }],
  por_comuna: [{ comuna: "Comuna 1", avanzadas: 3, requerimientos: 60 }],
  por_estrategia: [{ estrategia: "En Un 2x3", avanzadas: 10, requerimientos: 200 }],
  por_mes: [{ mes: "2026-06", avanzadas: 5, requerimientos: 100 }],
};

const sampleUpdated = {
  ...sample,
  totales: { ...sample.totales, avanzadas: 20 },
};

async function freshStore() {
  vi.resetModules();
  const mod = await import("./estadisticasStore");
  return mod.estadisticasStore;
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

describe("estadisticasStore", () => {
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
    apiMocks.getEstadisticasAvanzadas.mockReturnValue(d.promise);

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
    apiMocks.getEstadisticasAvanzadas.mockResolvedValue(sample);

    await store.load();
    await store.load();

    expect(apiMocks.getEstadisticasAvanzadas).toHaveBeenCalledTimes(1);
  });

  it("force:true refetches even when data is fresh", async () => {
    const store = await freshStore();
    apiMocks.getEstadisticasAvanzadas.mockResolvedValue(sample);

    await store.load();
    await store.load({ force: true });

    expect(apiMocks.getEstadisticasAvanzadas).toHaveBeenCalledTimes(2);
  });

  it("revalidation holds previous data (no skeleton flash) and flips revalidating", async () => {
    const store = await freshStore();
    apiMocks.getEstadisticasAvanzadas.mockResolvedValueOnce(sample);
    await store.load();
    expect(get(store).data).toEqual(sample);

    const d = deferred<typeof sampleUpdated>();
    apiMocks.getEstadisticasAvanzadas.mockReturnValueOnce(d.promise);

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
    apiMocks.getEstadisticasAvanzadas.mockResolvedValueOnce(sample);
    await store.load();

    apiMocks.getEstadisticasAvanzadas.mockRejectedValueOnce(new Error("network down"));
    await store.load({ force: true });

    const state = get(store);
    expect(state.data).toEqual(sample);
    expect(state.error).toBeNull();
    expect(state.revalidateError).toBe("network down");
    expect(state.revalidating).toBe(false);
  });

  it("a failed first load sets the blocking error and leaves data null", async () => {
    const store = await freshStore();
    apiMocks.getEstadisticasAvanzadas.mockRejectedValueOnce(new Error("boom"));

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
    apiMocks.getEstadisticasAvanzadas
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

  it("translates a raw 401 failure into SESSION_EXPIRED, never the raw string", async () => {
    const store = await freshStore();
    apiMocks.getEstadisticasAvanzadas.mockRejectedValueOnce(
      new Error("GET /avanzadas/estadisticas failed (401): Token inválido o expirado")
    );

    await store.load();

    expect(get(store).error).toBe(SESSION_EXPIRED);
  });
});
