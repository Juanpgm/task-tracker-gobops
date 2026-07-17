/**
 * Tests for src/api/avanzadas-geo.ts.
 * Seam under test: getAvanzadasGeo() against a mocked global fetch,
 * mirroring the auth/error conventions established in src/api/avanzadas-estadisticas.ts.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getAvanzadasGeo } from "./avanzadas-geo";
import { apiClient } from "../lib/api-client";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global.fetch as any) = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

const sampleResponse = {
  avanzadas: [
    { client_id: "a1", nombre_avanzada: "Avanzada 1", fecha: "2026-06-01", estrategia: "En Un 2x3", comuna: "Comuna 1", barrio: "Barrio X", lat: 3.45, lng: -76.53, requerimientos_count: 20 },
  ],
  requerimientos: [
    { id: 1, avanzada_client_id: "a1", sigla: "DAGMA", entidad: "Depto. Ambiental", categoria: "Poda de árboles", requerimiento: "Poda urgente", ubicacion: "Cra 1 # 2-3", fecha: "2026-06-01", lat: 3.451, lng: -76.531, fotos_count: 2 },
  ],
  jornadas: [
    { client_id: "j1", nombre_jornada: "Jornada 1", fecha: "2026-06-02", comuna: "Comuna 2", barrio: "Barrio Y", estado: "completada", lat: 3.46, lng: -76.54 },
  ],
  omitidos: { avanzadas: 0, requerimientos: 1, jornadas: 0 },
};

describe("api/avanzadas-geo", () => {
  beforeEach(() => {
    apiClient.setToken("test-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    apiClient.setToken(null);
  });

  describe("getAvanzadasGeo", () => {
    it("GETs /avanzadas/geo with Bearer auth and returns the parsed payload", async () => {
      mockFetchOnce(sampleResponse);

      const result = await getAvanzadasGeo();

      expect(result).toEqual(sampleResponse);
      const [url, options] = (global.fetch as any).mock.calls[0];
      expect(url).toContain("/avanzadas/geo");
      expect(options.headers.Authorization).toBe("Bearer test-token");
      expect(options.method).toBe("GET");
    });

    it("throws when the backend responds with a non-ok status", async () => {
      mockFetchOnce({ error: "boom" }, false, 500);
      await expect(getAvanzadasGeo()).rejects.toThrow();
    });
  });
});
