/**
 * Tests for src/stores/jornadaWizardStore.ts.
 * Seam under test: the store's public interface (subscribe + iniciarJornada /
 * cargarJornada / loadLista). src/api/jornadas is mocked.
 *
 * Focus: this store had NO prior test file (flagged in design.md as a gap
 * during the fix-token-401-network-errors audit) — it shares the exact
 * `err.message` raw-string-to-UI pattern as avanzadasStore/seguimientoStore/
 * etc., so its error states must go through toUserMessage() too, never
 * surface e.g. "POST /jornadas failed (401): ...".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { get } from "svelte/store";
import { SESSION_EXPIRED } from "../lib/auth-error-messages";

const apiMocks = vi.hoisted(() => ({
  crearJornada: vi.fn(),
  actualizarJornada: vi.fn(),
  subirCroquisJornada: vi.fn(),
  crearCompromiso: vi.fn(),
  actualizarCompromiso: vi.fn(),
  eliminarCompromiso: vi.fn(),
  crearSeguimiento: vi.fn(),
  guardarVerificacion: vi.fn(),
  crearEncuesta: vi.fn(),
  eliminarEncuesta: vi.fn(),
  crearRequerimientosJornada: vi.fn(),
  listarJornadas: vi.fn(),
  getJornada: vi.fn(),
  isConflictError: vi.fn().mockReturnValue(false),
}));

vi.mock("../api/jornadas", () => apiMocks);

async function freshStore() {
  vi.resetModules();
  const mod = await import("./jornadaWizardStore");
  return mod.jornadaWizardStore;
}

const baseDatos = {
  nombre_jornada: "Jornada Comuna 1",
  fecha: "2026-07-20",
  comuna: "Comuna 1",
  barrio: "Salomia",
  coordenadas_encuentro: "3.45, -76.53",
};

describe("jornadaWizardStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with no active jornada and an empty lista", async () => {
    const store = await freshStore();
    const state = get(store);
    expect(state.current).toBeNull();
    expect(state.lista).toEqual([]);
    expect(state.errorCurrent).toBeNull();
  });

  describe("iniciarJornada", () => {
    it("creates the jornada, sets it as current, and upserts it into lista", async () => {
      apiMocks.crearJornada.mockResolvedValue({
        client_id: "jor_1",
        ...baseDatos,
        estado: "planificacion",
        compromisos: [],
        encuestas: [],
        requerimientos: [],
      });
      const store = await freshStore();

      const result = await store.iniciarJornada(baseDatos as any);

      expect(result.client_id).toBe("jor_1");
      const state = get(store);
      expect(state.current?.client_id).toBe("jor_1");
      expect(state.loadingCurrent).toBe(false);
      expect(state.lista.find((j) => j.client_id === "jor_1")).toBeDefined();
    });

    it("translates a raw 401 failure into SESSION_EXPIRED and rethrows", async () => {
      apiMocks.crearJornada.mockRejectedValue(new Error("POST /jornadas failed (401): Token inválido o expirado"));
      const store = await freshStore();

      await expect(store.iniciarJornada(baseDatos as any)).rejects.toThrow();

      const state = get(store);
      expect(state.errorCurrent).toBe(SESSION_EXPIRED);
      expect(state.loadingCurrent).toBe(false);
    });
  });

  describe("cargarJornada", () => {
    it("loads the jornada detail and normalizes missing array fields", async () => {
      apiMocks.getJornada.mockResolvedValue({
        client_id: "jor_2",
        ...baseDatos,
        estado: "planificacion",
      });
      const store = await freshStore();

      await store.cargarJornada("jor_2");

      const state = get(store);
      expect(state.current?.client_id).toBe("jor_2");
      expect(state.current?.compromisos).toEqual([]);
      expect(state.loadingCurrent).toBe(false);
    });

    it("translates a raw 401 failure into SESSION_EXPIRED, never the raw string", async () => {
      apiMocks.getJornada.mockRejectedValue(new Error("GET /jornadas/jor_3 failed (401): Token inválido o expirado"));
      const store = await freshStore();

      await store.cargarJornada("jor_3");

      const state = get(store);
      expect(state.errorCurrent).toBe(SESSION_EXPIRED);
    });
  });

  describe("loadLista", () => {
    it("populates lista on success", async () => {
      apiMocks.listarJornadas.mockResolvedValue([
        { client_id: "j1", nombre_jornada: "J1", fecha: "2026-07-01", comuna: "C1", barrio: "B1", estado: "completada", asistencia_aproximada: 10, compromisos_count: 2 },
      ]);
      const store = await freshStore();

      await store.loadLista();

      expect(get(store).lista).toHaveLength(1);
    });

    it("translates a raw 401 failure into SESSION_EXPIRED on the blocking listaError", async () => {
      apiMocks.listarJornadas.mockRejectedValue(new Error("GET /jornadas failed (401): Token inválido o expirado"));
      const store = await freshStore();

      await store.loadLista();

      expect(get(store).listaError).toBe(SESSION_EXPIRED);
    });
  });
});
