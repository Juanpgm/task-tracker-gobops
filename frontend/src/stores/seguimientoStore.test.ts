/**
 * Tests for src/stores/seguimientoStore.ts.
 * Seam under test: syncOfflineQueue()'s offline 'create' branch — the Kanban
 * photo/evidence upload for a queued requerimiento.
 *
 * Per design.md ("Interfaces / Contracts" + File Changes, seguimientoStore.ts
 * ~L910), this flow must stop calling the legacy registrarRequerimiento()
 * (POST /registrar-requerimiento) and instead call the new
 * subirEvidenciasSeguimiento() client (POST /seguimiento/evidencias), which
 * returns the unified S3 shape { s3_url, s3_key, filename, content_type, size }.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const apiMocks = vi.hoisted(() => ({
  actualizarEstadoVisitaAPI: vi.fn(),
  crearRequerimientoSeguimiento: vi.fn(),
  cambiarEstadoRequerimientoAPI: vi.fn(),
  obtenerVisitasProgramadas: vi.fn(),
  getRequerimientosSeguimiento: vi.fn(),
  getColaboradores: vi.fn(),
  registrarVisita: vi.fn(),
  subirEvidenciasSeguimiento: vi.fn(),
  obtenerRequerimientos: vi.fn(),
  editarRequerimiento: vi.fn(),
}));

const queueMocks = vi.hoisted(() => ({
  enqueueOperation: vi.fn(),
  getQueue: vi.fn(),
  dequeueOperation: vi.fn(),
  updateQueueReqId: vi.fn(),
  updateOperationError: vi.fn(),
}));

const offlineStoreMocks = vi.hoisted(() => ({
  setSyncing: vi.fn(),
  refreshPendingCount: vi.fn(),
}));

vi.mock("../api/visitas", () => apiMocks);
vi.mock("../lib/offlineQueue", () => queueMocks);
vi.mock("./offlineStore", () => ({ offlineStore: offlineStoreMocks }));

async function freshStore() {
  vi.resetModules();
  const mod = await import("./seguimientoStore");
  return mod.seguimientoStore;
}

const foto = new File(["x"], "foto.jpg", { type: "image/jpeg" });

const queuedCreatePayload = {
  visitaId: "vid-1",
  solicitante: {
    nombre_completo: "Juan Pérez",
    cedula: "123",
    telefono: "3001234567",
    email: "",
    direccion: "",
    barrio_vereda: "",
    comuna_corregimiento: "",
  },
  centrosGestores: ["DAGMA"],
  descripcion: "Poda de árbol",
  observaciones: "Sin observaciones",
  direccion: "Calle 1",
  latitud: "3.45",
  longitud: "-76.53",
  prioridad: "media",
  notaVozFile: null,
  fotosFiles: [foto],
};

describe("seguimientoStore.syncOfflineQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads Kanban evidence via subirEvidenciasSeguimiento (not the legacy registrarRequerimiento) and feeds evidencia_fotos from its s3_url shape", async () => {
    queueMocks.getQueue.mockResolvedValue([
      {
        id: "queue-1",
        type: "create",
        reqId: "temp-1",
        payload: queuedCreatePayload,
        timestamp: Date.now(),
        errorCount: 0,
      },
    ]);
    apiMocks.subirEvidenciasSeguimiento.mockResolvedValue([
      {
        s3_url: "https://bucket.s3.amazonaws.com/seguimiento/vid-1/evidencias/uuid_foto.jpg",
        s3_key: "seguimiento/vid-1/evidencias/uuid_foto.jpg",
        filename: "foto.jpg",
        content_type: "image/jpeg",
        size: 12345,
      },
    ]);
    apiMocks.crearRequerimientoSeguimiento.mockResolvedValue({
      id: "real-1",
      visita_id: "vid-1",
      solicitante: queuedCreatePayload.solicitante,
      centros_gestores: ["DAGMA"],
      descripcion: "Poda de árbol",
      observaciones: "Sin observaciones",
      direccion: "Calle 1",
      latitud: "3.45",
      longitud: "-76.53",
      evidencia_fotos: ["https://bucket.s3.amazonaws.com/seguimiento/vid-1/evidencias/uuid_foto.jpg"],
      estado: "nuevo",
      encargado: null,
      porcentaje_avance: 0,
      prioridad: "media",
      historial: [],
      numero_orfeo: null,
      fecha_radicado_orfeo: null,
      documento_peticion_url: null,
      documento_peticion_nombre: null,
      motivo_cancelacion: null,
    });

    const store = await freshStore();
    await store.syncOfflineQueue();

    expect(apiMocks.subirEvidenciasSeguimiento).toHaveBeenCalledWith(
      expect.objectContaining({ visita_id: "vid-1", fotos: [foto] })
    );

    const [apiBody] = apiMocks.crearRequerimientoSeguimiento.mock.calls[0];
    expect(apiBody.evidencia_fotos).toEqual([
      "https://bucket.s3.amazonaws.com/seguimiento/vid-1/evidencias/uuid_foto.jpg",
    ]);

    expect(queueMocks.updateQueueReqId).toHaveBeenCalledWith("temp-1", "real-1");
    expect(queueMocks.dequeueOperation).toHaveBeenCalledWith("queue-1");
  });
});
