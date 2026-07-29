/**
 * Tests for src/stores/avanzadasStore.ts.
 * Seam under test: the store's public interface (subscribe + methods).
 * Dependencies (api/avanzadas, lib/offlineQueue, stores/offlineStore) are
 * mocked so we can assert the offline-first contract precisely:
 *   1. crearAvanzada ALWAYS enqueues locally before attempting the network call.
 *   2. A successful POST dequeues the item and clears the offline flag.
 *   3. A failed POST (or being offline) leaves the item queued.
 *   4. Catalogos fall back to the local seed data when the API fails,
 *      and merge with it when the API succeeds.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";

const apiMocks = vi.hoisted(() => ({
  getCatalogosAvanzadas: vi.fn(),
  crearAvanzada: vi.fn(),
  listarAvanzadas: vi.fn(),
  getAvanzada: vi.fn(),
  agregarRequerimientoAvanzada: vi.fn(),
  actualizarRequerimientoAvanzada: vi.fn(),
  eliminarRequerimientoAvanzada: vi.fn(),
}));

const queueMocks = vi.hoisted(() => ({
  enqueueOperation: vi.fn(),
  getQueue: vi.fn(),
  dequeueOperation: vi.fn(),
  updateOperationError: vi.fn(),
  updateQueueReqId: vi.fn(),
}));

const offlineStoreMocks = vi.hoisted(() => ({
  refreshPendingCount: vi.fn(),
}));

vi.mock("../api/avanzadas", () => apiMocks);
vi.mock("../lib/offlineQueue", () => queueMocks);
vi.mock("./offlineStore", () => ({ offlineStore: offlineStoreMocks }));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const baseDatosSinClientId = {
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
  requerimientos: [
    {
      entidad: "DAGMA",
      categoria: "Poda de árboles (autorización)",
      categoria_personalizada: null,
      requerimiento: "Árbol con riesgo de caída",
      ubicacion: "Frente al parque",
      coordenadas: null,
    },
  ],
};

async function freshStore() {
  vi.resetModules();
  const mod = await import("./avanzadasStore");
  return mod.avanzadasStore;
}

/** Manually-resolvable/rejectable promise, for controlling resolution order in race tests. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("avanzadasStore", () => {
  let originalOnLine: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    queueMocks.enqueueOperation.mockImplementation(async (type: string, reqId: string, payload: unknown) => ({
      id: `queue-${reqId}`,
      type,
      reqId,
      payload,
      timestamp: Date.now(),
      errorCount: 0,
    }));
    queueMocks.getQueue.mockResolvedValue([]);
    queueMocks.dequeueOperation.mockResolvedValue(true);
    queueMocks.updateOperationError.mockResolvedValue(true);
    originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  afterEach(() => {
    if (originalOnLine) Object.defineProperty(navigator, "onLine", originalOnLine);
  });

  describe("catalogos", () => {
    it("exposes the local fallback catalogos before loadCatalogos() is called", async () => {
      const store = await freshStore();
      const state = get(store);
      expect(state.catalogos.estrategias).toContain("En Un 2x3");
      expect(state.catalogosLoaded).toBe(false);
    });

    it("loadCatalogos() merges the remote catalog with the local fallback on success", async () => {
      apiMocks.getCatalogosAvanzadas.mockResolvedValue({
        estrategias: ["Estrategia Remota"],
        equipo: [],
        dependencias: [],
        categorias: {},
      });
      const store = await freshStore();
      await store.loadCatalogos();
      const state = get(store);
      expect(state.catalogos.estrategias).toContain("Estrategia Remota");
      expect(state.catalogos.estrategias).toContain("En Un 2x3"); // fallback preserved
      expect(state.catalogosLoaded).toBe(true);
      expect(state.catalogosError).toBeNull();
    });

    it("loadCatalogos() falls back to local data and records the error when the API fails", async () => {
      apiMocks.getCatalogosAvanzadas.mockRejectedValue(new Error("Network down"));
      const store = await freshStore();
      await store.loadCatalogos();
      const state = get(store);
      expect(state.catalogos.estrategias).toContain("En Un 2x3");
      expect(state.catalogosLoaded).toBe(true);
      expect(state.catalogosError).toBe("Network down");
    });

    it("skips the network call when catalogos are already loaded and fresh (TTL guard)", async () => {
      apiMocks.getCatalogosAvanzadas.mockResolvedValue({
        estrategias: ["Estrategia Remota"],
        equipo: [],
        dependencias: [],
        categorias: {},
      });
      const store = await freshStore();
      await store.loadCatalogos();
      await store.loadCatalogos();
      expect(apiMocks.getCatalogosAvanzadas).toHaveBeenCalledTimes(1);
    });

    it("refetches catalogos once the TTL has expired", async () => {
      vi.useFakeTimers();
      apiMocks.getCatalogosAvanzadas.mockResolvedValue({
        estrategias: ["Estrategia Remota"],
        equipo: [],
        dependencias: [],
        categorias: {},
      });
      const store = await freshStore();
      await store.loadCatalogos();

      vi.advanceTimersByTime(6 * 60 * 1000); // past the catalogos TTL

      await store.loadCatalogos();
      expect(apiMocks.getCatalogosAvanzadas).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it("force:true bypasses the catalogos freshness check", async () => {
      apiMocks.getCatalogosAvanzadas.mockResolvedValue({
        estrategias: ["Estrategia Remota"],
        equipo: [],
        dependencias: [],
        categorias: {},
      });
      const store = await freshStore();
      await store.loadCatalogos();
      await store.loadCatalogos({ force: true });
      expect(apiMocks.getCatalogosAvanzadas).toHaveBeenCalledTimes(2);
    });
  });

  describe("loadAvanzadas", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("populates avanzadas on success", async () => {
      apiMocks.listarAvanzadas.mockResolvedValue([
        { client_id: "a1", nombre_avanzada: "X", requerimientos_count: 2 },
      ]);
      const store = await freshStore();
      await store.loadAvanzadas();
      const state = get(store);
      expect(state.avanzadas).toHaveLength(1);
      expect(state.loading).toBe(false);
    });

    it("sets loading=true only on the very first load (no data yet)", async () => {
      let resolveFirst!: (v: unknown) => void;
      apiMocks.listarAvanzadas.mockReturnValue(new Promise((res) => { resolveFirst = res; }));
      const store = await freshStore();

      const pending = store.loadAvanzadas();
      expect(get(store).loading).toBe(true);

      resolveFirst([{ client_id: "a1", nombre_avanzada: "X", requerimientos_count: 0 }]);
      await pending;
      expect(get(store).loading).toBe(false);
      expect(get(store).lastFetchedAt).not.toBeNull();
    });

    it("stale-while-revalidate: skips the network call entirely when data is fresh (within TTL)", async () => {
      apiMocks.listarAvanzadas.mockResolvedValue([
        { client_id: "a1", nombre_avanzada: "X", requerimientos_count: 0 },
      ]);
      const store = await freshStore();
      await store.loadAvanzadas();
      await store.loadAvanzadas();
      expect(apiMocks.listarAvanzadas).toHaveBeenCalledTimes(1);
    });

    it("stale-while-revalidate: once data is past the TTL, revalidates in the background WITHOUT setting loading=true, and keeps showing the stale data while it does", async () => {
      vi.useFakeTimers();
      apiMocks.listarAvanzadas.mockResolvedValueOnce([
        { client_id: "a1", nombre_avanzada: "Old", requerimientos_count: 0 },
      ]);
      const store = await freshStore();
      await store.loadAvanzadas();

      vi.advanceTimersByTime(31_000); // past the ~30s TTL

      let resolveSecond!: (v: unknown) => void;
      apiMocks.listarAvanzadas.mockReturnValueOnce(new Promise((res) => { resolveSecond = res; }));

      const pending = store.loadAvanzadas();
      const midState = get(store);
      expect(midState.loading).toBe(false); // no spinner / layout shift
      expect(midState.avanzadas[0].nombre_avanzada).toBe("Old"); // stale data still visible
      expect(midState.revalidating).toBe(true);

      resolveSecond([{ client_id: "a2", nombre_avanzada: "Fresh", requerimientos_count: 0 }]);
      await pending;

      const finalState = get(store);
      expect(finalState.loading).toBe(false);
      expect(finalState.revalidating).toBe(false);
      expect(finalState.avanzadas[0].nombre_avanzada).toBe("Fresh");
    });

    it("stale-while-revalidate: on background revalidate failure, keeps the existing stale data and surfaces a non-destructive revalidateError instead of the blocking error", async () => {
      vi.useFakeTimers();
      apiMocks.listarAvanzadas.mockResolvedValueOnce([
        { client_id: "a1", nombre_avanzada: "Old", requerimientos_count: 0 },
      ]);
      const store = await freshStore();
      await store.loadAvanzadas();

      vi.advanceTimersByTime(31_000);
      apiMocks.listarAvanzadas.mockRejectedValueOnce(new Error("network blip"));

      await store.loadAvanzadas();

      const state = get(store);
      expect(state.avanzadas).toHaveLength(1);
      expect(state.avanzadas[0].nombre_avanzada).toBe("Old"); // stale data NOT wiped
      expect(state.error).toBeNull(); // does not trigger the blocking error state
      expect(state.revalidateError).toBe("network blip");
      expect(state.revalidating).toBe(false);
    });

    it("force:true bypasses the freshness check and refetches even when data is fresh", async () => {
      apiMocks.listarAvanzadas.mockResolvedValue([
        { client_id: "a1", nombre_avanzada: "X", requerimientos_count: 0 },
      ]);
      const store = await freshStore();
      await store.loadAvanzadas();
      await store.loadAvanzadas({ force: true });
      expect(apiMocks.listarAvanzadas).toHaveBeenCalledTimes(2);
    });

    it("sets an error message on failure", async () => {
      apiMocks.listarAvanzadas.mockRejectedValue(new Error("boom"));
      const store = await freshStore();
      await store.loadAvanzadas();
      const state = get(store);
      expect(state.error).toBe("boom");
      expect(state.loading).toBe(false);
    });

    it("preserves an offline-created item that has not synced yet (present in the queue, absent from the server response)", async () => {
      apiMocks.listarAvanzadas.mockResolvedValue([
        { client_id: "server-1", nombre_avanzada: "Server item", requerimientos_count: 1 },
      ]);
      queueMocks.getQueue.mockResolvedValue([
        {
          id: "q-pending",
          type: "avanzada",
          reqId: "pending-1",
          payload: {
            datos: { ...baseDatosSinClientId, client_id: "pending-1" },
            files: {},
          },
          timestamp: 1,
          errorCount: 0,
        },
      ]);

      const store = await freshStore();
      await store.loadAvanzadas();
      const state = get(store);

      expect(state.avanzadas).toHaveLength(2);
      const pending = state.avanzadas.find((a) => a.client_id === "pending-1");
      expect(pending).toBeDefined();
      expect(pending!.isOffline).toBe(true);
      const server = state.avanzadas.find((a) => a.client_id === "server-1");
      expect(server).toBeDefined();
    });

    it("does not duplicate an item whose client_id is already present in the server response (already synced)", async () => {
      apiMocks.listarAvanzadas.mockResolvedValue([
        { client_id: "synced-1", nombre_avanzada: "Synced item", requerimientos_count: 1 },
      ]);
      queueMocks.getQueue.mockResolvedValue([
        {
          id: "q-synced",
          type: "avanzada",
          reqId: "synced-1",
          payload: {
            datos: { ...baseDatosSinClientId, client_id: "synced-1" },
            files: {},
          },
          timestamp: 1,
          errorCount: 0,
        },
      ]);

      const store = await freshStore();
      await store.loadAvanzadas();
      const state = get(store);

      expect(state.avanzadas).toHaveLength(1);
      expect(state.avanzadas[0].client_id).toBe("synced-1");
    });
  });

  describe("loadAvanzadas — concurrency fence (SWR race)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("discards a stale in-flight response that resolves AFTER a later force:true request already committed fresher data", async () => {
      let mockNow = 1_000_000;
      vi.spyOn(Date, "now").mockImplementation(() => mockNow);

      apiMocks.listarAvanzadas.mockResolvedValueOnce([
        { client_id: "initial", nombre_avanzada: "Initial", requerimientos_count: 0 },
      ]);
      const store = await freshStore();
      await store.loadAvanzadas(); // establishes lastFetchedAt = 1_000_000

      mockNow = 1_041_000; // past the 30s TTL: next call is a background revalidate

      const reqA = deferred<unknown>(); // the in-flight background revalidate
      const reqB = deferred<unknown>(); // the user's Reintentar (force:true), started after A
      apiMocks.listarAvanzadas.mockReturnValueOnce(reqA.promise);
      apiMocks.listarAvanzadas.mockReturnValueOnce(reqB.promise);

      const pendingA = store.loadAvanzadas(); // background revalidate, in flight
      const pendingB = store.loadAvanzadas({ force: true }); // Reintentar, started while A is still pending

      // B (the later request) resolves FIRST with fresh data.
      mockNow = 1_041_500;
      reqB.resolve([{ client_id: "b", nombre_avanzada: "Fresh", requerimientos_count: 0 }]);
      await pendingB;

      let state = get(store);
      expect(state.avanzadas[0].nombre_avanzada).toBe("Fresh");
      expect(state.lastFetchedAt).toBe(1_041_500);

      // A (the earlier, now-stale request) resolves LAST with an outdated payload.
      mockNow = 1_042_000;
      reqA.resolve([{ client_id: "a", nombre_avanzada: "Stale", requerimientos_count: 0 }]);
      await pendingA;

      state = get(store);
      // The stale response must NOT win the race: data stays what B committed...
      expect(state.avanzadas[0].nombre_avanzada).toBe("Fresh");
      // ...and freshness must not be re-stamped from the stale response either
      // (that would wrongly grant the stale generation another 30s of TTL).
      expect(state.lastFetchedAt).toBe(1_041_500);
      expect(state.revalidating).toBe(false);
    });

    it("does not let a stale rejection clobber the error/revalidateError state after a newer request already succeeded", async () => {
      let mockNow = 1_000_000;
      vi.spyOn(Date, "now").mockImplementation(() => mockNow);

      apiMocks.listarAvanzadas.mockResolvedValueOnce([
        { client_id: "initial", nombre_avanzada: "Initial", requerimientos_count: 0 },
      ]);
      const store = await freshStore();
      await store.loadAvanzadas();

      mockNow = 1_041_000;

      const reqA = deferred<unknown>();
      const reqB = deferred<unknown>();
      apiMocks.listarAvanzadas.mockReturnValueOnce(reqA.promise);
      apiMocks.listarAvanzadas.mockReturnValueOnce(reqB.promise);

      const pendingA = store.loadAvanzadas(); // will fail, but resolves last
      const pendingB = store.loadAvanzadas({ force: true }); // resolves first, succeeds

      reqB.resolve([{ client_id: "b", nombre_avanzada: "Fresh", requerimientos_count: 0 }]);
      await pendingB;
      expect(get(store).revalidateError).toBeNull();

      reqA.reject(new Error("stale network error"));
      await pendingA;

      const state = get(store);
      expect(state.avanzadas[0].nombre_avanzada).toBe("Fresh");
      expect(state.revalidateError).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe("crearAvanzada — offline-first contract", () => {
    it("enqueues locally BEFORE attempting the network call, and generates a UUID client_id", async () => {
      apiMocks.crearAvanzada.mockResolvedValue({ success: true, client_id: "placeholder" });
      const store = await freshStore();

      const result = await store.crearAvanzada(baseDatosSinClientId as any);

      expect(result.client_id).toMatch(UUID_RE);
      expect(queueMocks.enqueueOperation).toHaveBeenCalledTimes(1);
      const enqueueCallOrder = queueMocks.enqueueOperation.mock.invocationCallOrder[0];
      const apiCallOrder = apiMocks.crearAvanzada.mock.invocationCallOrder[0];
      expect(enqueueCallOrder).toBeLessThan(apiCallOrder);

      const [type, reqId] = queueMocks.enqueueOperation.mock.calls[0];
      expect(type).toBe("avanzada");
      expect(reqId).toBe(result.client_id);
    });

    it("dequeues the item and clears the offline flag when the POST succeeds", async () => {
      apiMocks.crearAvanzada.mockResolvedValue({ success: true, client_id: "server-id" });
      const store = await freshStore();

      const result = await store.crearAvanzada(baseDatosSinClientId as any);

      expect(result.isOffline).toBe(false);
      expect(queueMocks.dequeueOperation).toHaveBeenCalledWith(`queue-${result.client_id}`);

      const state = get(store);
      const created = state.avanzadas.find((a) => a.client_id === result.client_id);
      expect(created).toBeDefined();
      expect(created!.isOffline).toBe(false);
    });

    it("leaves the item queued and marks it offline when the POST fails", async () => {
      apiMocks.crearAvanzada.mockRejectedValue(new Error("500 server error"));
      const store = await freshStore();

      const result = await store.crearAvanzada(baseDatosSinClientId as any);

      expect(result.isOffline).toBe(true);
      expect(queueMocks.dequeueOperation).not.toHaveBeenCalled();

      const state = get(store);
      const created = state.avanzadas.find((a) => a.client_id === result.client_id);
      expect(created!.isOffline).toBe(true);
    });

    it("does not attempt the network call at all when navigator.onLine is false", async () => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      const store = await freshStore();

      const result = await store.crearAvanzada(baseDatosSinClientId as any);

      expect(result.isOffline).toBe(true);
      expect(apiMocks.crearAvanzada).not.toHaveBeenCalled();
      expect(queueMocks.enqueueOperation).toHaveBeenCalledTimes(1);
    });

    it("sends encargados, asistentes (dropping empty-nombre rows) and requerimientos in the queued payload", async () => {
      apiMocks.crearAvanzada.mockResolvedValue({ success: true, client_id: "x" });
      const store = await freshStore();

      await store.crearAvanzada({
        ...baseDatosSinClientId,
        asistentes: [
          { nombre: "Juan Pérez", organismo: "DAGMA", celular: "300", correo: "" },
          { nombre: "  ", organismo: "Debe descartarse", celular: "", correo: "" },
        ],
      } as any);

      const [, , payload] = queueMocks.enqueueOperation.mock.calls[0];
      expect(payload.datos.asistentes).toHaveLength(1);
      expect(payload.datos.asistentes[0].nombre).toBe("Juan Pérez");
    });
  });

  describe("loadAvanzadaDetalle", () => {
    it("sets detalleLoading while in flight and populates detalle on success", async () => {
      let resolveGet!: (v: unknown) => void;
      apiMocks.getAvanzada.mockReturnValue(new Promise((res) => { resolveGet = res; }));
      const store = await freshStore();

      const pending = store.loadAvanzadaDetalle("client-1");
      let state = get(store);
      expect(state.detalleLoading["client-1"]).toBe(true);
      expect(state.detalleError["client-1"]).toBeNull();

      resolveGet({ client_id: "client-1", nombre_avanzada: "X", requerimientos: [], asistentes: [] });
      await pending;

      state = get(store);
      expect(state.detalleLoading["client-1"]).toBe(false);
      expect(state.detalle["client-1"]).toEqual({
        client_id: "client-1",
        nombre_avanzada: "X",
        requerimientos: [],
        asistentes: [],
      });
    });

    it("sets detalleError when the fetch fails and there is no matching offline queue item", async () => {
      apiMocks.getAvanzada.mockRejectedValue(new Error("not found"));
      queueMocks.getQueue.mockResolvedValue([]);
      const store = await freshStore();

      await store.loadAvanzadaDetalle("client-404");

      const state = get(store);
      expect(state.detalleLoading["client-404"]).toBe(false);
      expect(state.detalleError["client-404"]).toBe("not found");
      expect(state.detalle["client-404"]).toBeUndefined();
    });

    it("falls back to the offline queue payload when the server has no such doc (offline-created, not yet synced)", async () => {
      apiMocks.getAvanzada.mockRejectedValue(new Error("404"));
      queueMocks.getQueue.mockResolvedValue([
        {
          id: "q-pending",
          type: "avanzada",
          reqId: "pending-1",
          payload: {
            datos: { ...baseDatosSinClientId, client_id: "pending-1" },
            files: {},
          },
          timestamp: 1,
          errorCount: 0,
        },
      ]);
      const store = await freshStore();

      await store.loadAvanzadaDetalle("pending-1");

      const state = get(store);
      expect(state.detalleLoading["pending-1"]).toBe(false);
      expect(state.detalleError["pending-1"]).toBeNull();
      expect(state.detalle["pending-1"]).toBeDefined();
      expect(state.detalle["pending-1"].isOffline).toBe(true);
      expect(state.detalle["pending-1"].nombre_avanzada).toBe(baseDatosSinClientId.nombre_avanzada);
      // Offline-created requerimientos are reincorporated with an empty id sentinel
      // (no server doc id assigned until sync).
      expect(state.detalle["pending-1"].requerimientos).toEqual(
        baseDatosSinClientId.requerimientos.map((r) => ({ ...r, id: "" }))
      );
    });

    it("keeps per-clientId state independent (loading one detail does not clobber another)", async () => {
      apiMocks.getAvanzada.mockResolvedValueOnce({ client_id: "a", nombre_avanzada: "A", requerimientos: [], asistentes: [] });
      const store = await freshStore();
      await store.loadAvanzadaDetalle("a");

      let resolveB!: (v: unknown) => void;
      apiMocks.getAvanzada.mockReturnValueOnce(new Promise((res) => { resolveB = res; }));
      const pendingB = store.loadAvanzadaDetalle("b");

      const state = get(store);
      expect(state.detalle["a"].nombre_avanzada).toBe("A");
      expect(state.detalleLoading["b"]).toBe(true);

      resolveB({ client_id: "b", nombre_avanzada: "B", requerimientos: [], asistentes: [] });
      await pendingB;
    });
  });

  describe("loadAvanzadaDetalle — concurrency fence (SWR race, per clientId)", () => {
    it("discards a stale in-flight response for the SAME clientId that resolves after a newer request already committed", async () => {
      const reqA = deferred<unknown>(); // first loadAvanzadaDetalle("client-1") call
      const reqB = deferred<unknown>(); // second call for the SAME clientId, started while A is in flight
      apiMocks.getAvanzada.mockReturnValueOnce(reqA.promise);
      apiMocks.getAvanzada.mockReturnValueOnce(reqB.promise);

      const store = await freshStore();

      const pendingA = store.loadAvanzadaDetalle("client-1");
      const pendingB = store.loadAvanzadaDetalle("client-1");

      // B (the later call) resolves first.
      reqB.resolve({ client_id: "client-1", nombre_avanzada: "Fresh", requerimientos: [], asistentes: [] });
      await pendingB;

      let state = get(store);
      expect(state.detalle["client-1"].nombre_avanzada).toBe("Fresh");
      expect(state.detalleLoading["client-1"]).toBe(false);

      // A (the earlier, now-stale call) resolves last.
      reqA.resolve({ client_id: "client-1", nombre_avanzada: "Stale", requerimientos: [], asistentes: [] });
      await pendingA;

      state = get(store);
      expect(state.detalle["client-1"].nombre_avanzada).toBe("Fresh"); // stale payload did NOT win
      expect(state.detalleLoading["client-1"]).toBe(false); // A's discard did not re-flip loading back on
    });

    it("does not let a stale rejection for a clientId clobber detalle/detalleError after a newer request for the same id already succeeded", async () => {
      const reqA = deferred<unknown>();
      const reqB = deferred<unknown>();
      apiMocks.getAvanzada.mockReturnValueOnce(reqA.promise);
      apiMocks.getAvanzada.mockReturnValueOnce(reqB.promise);
      queueMocks.getQueue.mockResolvedValue([]); // no offline fallback available for the stale rejection

      const store = await freshStore();

      const pendingA = store.loadAvanzadaDetalle("client-1"); // will reject, but resolves last
      const pendingB = store.loadAvanzadaDetalle("client-1"); // succeeds first

      reqB.resolve({ client_id: "client-1", nombre_avanzada: "Fresh", requerimientos: [], asistentes: [] });
      await pendingB;

      reqA.reject(new Error("stale 404"));
      await pendingA;

      const state = get(store);
      expect(state.detalle["client-1"].nombre_avanzada).toBe("Fresh");
      expect(state.detalleError["client-1"]).toBeNull();
    });
  });

  describe("actualizarRequerimiento", () => {
    async function seedDetalle(store: Awaited<ReturnType<typeof freshStore>>) {
      apiMocks.getAvanzada.mockResolvedValueOnce({
        client_id: "client-1",
        nombre_avanzada: "X",
        asistentes: [],
        requerimientos: [
          { id: "req-1", entidad: "DAGMA", requerimiento: "Original", ubicacion: "A", fotos_urls: [] },
          { id: "req-2", entidad: "UAESP", requerimiento: "Otro", ubicacion: "B", fotos_urls: [] },
        ],
      });
      await store.loadAvanzadaDetalle("client-1");
    }

    it("replaces the matching requerimiento by id in detalle with the backend response", async () => {
      const store = await freshStore();
      await seedDetalle(store);

      const actualizado = {
        id: "req-1",
        entidad: "DAGMA",
        requerimiento: "Editado",
        ubicacion: "A2",
        fotos_urls: ["https://s3/foo.jpg"],
      };
      apiMocks.actualizarRequerimientoAvanzada.mockResolvedValue(actualizado);

      const result = await store.actualizarRequerimiento("client-1", "req-1", { requerimiento: "Editado" }, []);

      expect(apiMocks.actualizarRequerimientoAvanzada).toHaveBeenCalledWith(
        "client-1",
        "req-1",
        { requerimiento: "Editado" },
        []
      );
      expect(result).toEqual(actualizado);

      const reqs = get(store).detalle["client-1"].requerimientos;
      expect(reqs.find((r) => r.id === "req-1")).toEqual(actualizado);
      expect(reqs.find((r) => r.id === "req-2")!.requerimiento).toBe("Otro"); // others untouched
    });
  });

  describe("eliminarRequerimiento", () => {
    async function seedDetalle(store: Awaited<ReturnType<typeof freshStore>>) {
      apiMocks.getAvanzada.mockResolvedValueOnce({
        client_id: "client-1",
        nombre_avanzada: "X",
        asistentes: [],
        requerimientos_count: 2,
        requerimientos: [
          { id: "req-1", entidad: "DAGMA", requerimiento: "Original", ubicacion: "A", fotos_urls: [] },
          { id: "req-2", entidad: "UAESP", requerimiento: "Otro", ubicacion: "B", fotos_urls: [] },
        ],
      });
      await store.loadAvanzadaDetalle("client-1");
    }

    it("filters the matching-id requerimiento out, decrements the count, and leaves other entries untouched", async () => {
      const store = await freshStore();
      await seedDetalle(store);
      apiMocks.eliminarRequerimientoAvanzada.mockResolvedValue(undefined);

      await store.eliminarRequerimiento("client-1", "req-1");

      expect(apiMocks.eliminarRequerimientoAvanzada).toHaveBeenCalledWith("client-1", "req-1");
      const detalle = get(store).detalle["client-1"];
      expect(detalle.requerimientos.map((r: any) => r.id)).toEqual(["req-2"]);
      expect(detalle.requerimientos_count).toBe(1);
    });
  });

  describe("syncOfflineQueue", () => {
    it("does nothing when offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      const store = await freshStore();
      await store.syncOfflineQueue();
      expect(queueMocks.getQueue).not.toHaveBeenCalled();
    });

    it("replays queued 'avanzada' items and dequeues them on success", async () => {
      queueMocks.getQueue.mockResolvedValue([
        {
          id: "q1",
          type: "avanzada",
          reqId: "client-1",
          payload: { datos: { ...baseDatosSinClientId, client_id: "client-1" }, files: {} },
          timestamp: 1,
          errorCount: 0,
        },
      ]);
      apiMocks.crearAvanzada.mockResolvedValue({ success: true, client_id: "client-1" });

      const store = await freshStore();
      await store.syncOfflineQueue();

      expect(apiMocks.crearAvanzada).toHaveBeenCalledTimes(1);
      expect(queueMocks.dequeueOperation).toHaveBeenCalledWith("q1");
    });

    it("skips items of other types (e.g. legacy 'create') without touching them", async () => {
      queueMocks.getQueue.mockResolvedValue([
        { id: "q-legacy", type: "create", reqId: "legacy-1", payload: {}, timestamp: 1, errorCount: 0 },
      ]);
      const store = await freshStore();
      await store.syncOfflineQueue();
      expect(apiMocks.crearAvanzada).not.toHaveBeenCalled();
      expect(queueMocks.dequeueOperation).not.toHaveBeenCalled();
    });

    it("records the error and stops on the first failing item (does not dequeue it)", async () => {
      queueMocks.getQueue.mockResolvedValue([
        {
          id: "q1",
          type: "avanzada",
          reqId: "client-1",
          payload: { datos: { ...baseDatosSinClientId, client_id: "client-1" }, files: {} },
          timestamp: 1,
          errorCount: 0,
        },
      ]);
      apiMocks.crearAvanzada.mockRejectedValue(new Error("still down"));

      const store = await freshStore();
      await store.syncOfflineQueue();

      expect(queueMocks.updateOperationError).toHaveBeenCalledWith("q1", "still down");
      expect(queueMocks.dequeueOperation).not.toHaveBeenCalled();
    });
  });
});
