/**
 * Tests for src/api/jornadas.ts.
 * Seam under test: getEstadisticasJornadas() against a mocked global fetch,
 * mirroring the auth/error conventions established in src/api/avanzadas-estadisticas.ts.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getEstadisticasJornadas } from "./jornadas";
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

describe("api/jornadas", () => {
  beforeEach(() => {
    apiClient.setToken("test-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    apiClient.setToken(null);
  });

  describe("getEstadisticasJornadas", () => {
    it("GETs /jornadas/estadisticas with Bearer auth and returns the parsed payload", async () => {
      mockFetchOnce(sampleResponse);

      const result = await getEstadisticasJornadas();

      expect(result).toEqual(sampleResponse);
      const [url, options] = (global.fetch as any).mock.calls[0];
      expect(url).toContain("/jornadas/estadisticas");
      expect(options.headers.Authorization).toBe("Bearer test-token");
      expect(options.method).toBe("GET");
    });

    it("throws when the backend responds with a non-ok status", async () => {
      mockFetchOnce({ error: "boom" }, false, 500);
      await expect(getEstadisticasJornadas()).rejects.toThrow();
    });
  });
});
