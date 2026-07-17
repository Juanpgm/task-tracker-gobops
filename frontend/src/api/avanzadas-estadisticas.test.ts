/**
 * Tests for src/api/avanzadas-estadisticas.ts.
 * Seam under test: getEstadisticasAvanzadas() against a mocked global fetch,
 * mirroring the auth/error conventions established in src/api/avanzadas.ts.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getEstadisticasAvanzadas } from "./avanzadas-estadisticas";
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
  totales: {
    avanzadas: 16,
    requerimientos: 326,
    comunas: 12,
    entidades: 13,
    asistentes: 48,
    promedio_requerimientos: 20.4,
  },
  por_entidad: [
    { sigla: "DAGMA", entidad: "Departamento Administrativo de Gestión del Medio Ambiente", total: 90 },
    { sigla: "EMCALI", entidad: "Empresas Municipales de Cali", total: 40 },
  ],
  por_categoria: [{ categoria: "Poda de árboles", sigla: "DAGMA", total: 30 }],
  por_comuna: [{ comuna: "Comuna 1", avanzadas: 3, requerimientos: 60 }],
  por_estrategia: [{ estrategia: "En Un 2x3", avanzadas: 10, requerimientos: 200 }],
  por_mes: [{ mes: "2026-06", avanzadas: 5, requerimientos: 100 }],
};

describe("api/avanzadas-estadisticas", () => {
  beforeEach(() => {
    apiClient.setToken("test-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    apiClient.setToken(null);
  });

  describe("getEstadisticasAvanzadas", () => {
    it("GETs /avanzadas/estadisticas with Bearer auth and returns the parsed payload", async () => {
      mockFetchOnce(sampleResponse);

      const result = await getEstadisticasAvanzadas();

      expect(result).toEqual(sampleResponse);
      const [url, options] = (global.fetch as any).mock.calls[0];
      expect(url).toContain("/avanzadas/estadisticas");
      expect(options.headers.Authorization).toBe("Bearer test-token");
      expect(options.method).toBe("GET");
    });

    it("throws when the backend responds with a non-ok status", async () => {
      mockFetchOnce({ error: "boom" }, false, 500);
      await expect(getEstadisticasAvanzadas()).rejects.toThrow();
    });
  });
});
