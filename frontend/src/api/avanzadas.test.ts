/**
 * Tests for src/api/avanzadas.ts.
 * Seam under test: the public functions (getCatalogosAvanzadas, crearAvanzada,
 * listarAvanzadas, getAvanzada) against a mocked global fetch, mirroring the
 * auth/error conventions established in src/api/visitas.ts.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getCatalogosAvanzadas,
  crearAvanzada,
  listarAvanzadas,
  getAvanzada,
} from "./avanzadas";
import { apiClient, uploadApiClient } from "../lib/api-client";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global.fetch as any) = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe("api/avanzadas", () => {
  beforeEach(() => {
    apiClient.setToken("test-token");
    uploadApiClient.setToken("test-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    apiClient.setToken(null);
    uploadApiClient.setToken(null);
  });

  describe("getCatalogosAvanzadas", () => {
    it("GETs /avanzadas/catalogos with Bearer auth and returns the parsed catalog", async () => {
      const catalogos = {
        estrategias: ["En Un 2x3"],
        equipo: ["Ana Maria Carabali"],
        dependencias: ["DAGMA - Departamento Administrativo de Gestión del Medio Ambiente"],
        categorias: { DAGMA: ["Poda de árboles (autorización)"] },
      };
      mockFetchOnce(catalogos);

      const result = await getCatalogosAvanzadas();

      expect(result).toEqual(catalogos);
      const [url, options] = (global.fetch as any).mock.calls[0];
      expect(url).toContain("/avanzadas/catalogos");
      expect(options.headers.Authorization).toBe("Bearer test-token");
    });

    it("throws when the backend responds with a non-ok status", async () => {
      mockFetchOnce({ error: "boom" }, false, 500);
      await expect(getCatalogosAvanzadas()).rejects.toThrow();
    });
  });

  describe("crearAvanzada", () => {
    const baseDatos = {
      client_id: "11111111-1111-4111-8111-111111111111",
      nombre_avanzada: "Avanzada Comuna 1",
      fecha: "2026-07-16",
      estrategia: "En Un 2x3",
      sector: "Sector norte",
      comuna: "Comuna 1",
      barrio: "Salomia",
      direccion: "Calle 1 #2-3",
      coordenadas: "3.45, -76.53",
      encargados: ["Ana Maria Carabali"],
      asistentes: [{ nombre: "Juan Pérez", organismo: "DAGMA", celular: "3001234567", correo: "" }],
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

    it("POSTs multipart/form-data to /avanzadas with a JSON 'datos' field", async () => {
      mockFetchOnce({ success: true, client_id: baseDatos.client_id });

      await crearAvanzada(baseDatos as any);

      const [url, options] = (global.fetch as any).mock.calls[0];
      expect(url).toContain("/avanzadas");
      expect(options.method).toBe("POST");
      expect(options.body).toBeInstanceOf(FormData);
      const datosField = (options.body as FormData).get("datos");
      expect(typeof datosField).toBe("string");
      expect(JSON.parse(datosField as string)).toEqual(baseDatos);
      // multipart bodies must not force a JSON Content-Type header
      expect(options.headers["Content-Type"]).toBeUndefined();
      expect(options.headers.Authorization).toBe("Bearer test-token");
    });

    it("attaches foto_equipo when provided", async () => {
      mockFetchOnce({ success: true, client_id: baseDatos.client_id });
      const fotoEquipo = new File(["x"], "equipo.jpg", { type: "image/jpeg" });

      await crearAvanzada(baseDatos as any, { fotoEquipo });

      const [, options] = (global.fetch as any).mock.calls[0];
      const form = options.body as FormData;
      expect(form.get("foto_equipo")).toBe(fotoEquipo);
    });

    it("attaches fotos_req_{i} per requerimiento index, capped at 5 per index", async () => {
      mockFetchOnce({ success: true, client_id: baseDatos.client_id });
      const files = Array.from({ length: 7 }, (_, i) => new File(["x"], `f${i}.jpg`, { type: "image/jpeg" }));

      await crearAvanzada(baseDatos as any, { fotosPorRequerimiento: [files] });

      const [, options] = (global.fetch as any).mock.calls[0];
      const form = options.body as FormData;
      expect(form.getAll("fotos_req_0")).toHaveLength(5);
      expect(form.getAll("fotos_req_1")).toHaveLength(0);
    });
  });

  describe("listarAvanzadas", () => {
    it("tolerates a bare array response", async () => {
      mockFetchOnce([{ client_id: "a", nombre_avanzada: "X" }]);
      const result = await listarAvanzadas();
      expect(result).toEqual([{ client_id: "a", nombre_avanzada: "X" }]);
    });

    it("tolerates a { avanzadas: [] } wrapped response", async () => {
      mockFetchOnce({ avanzadas: [{ client_id: "b", nombre_avanzada: "Y" }] });
      const result = await listarAvanzadas();
      expect(result).toEqual([{ client_id: "b", nombre_avanzada: "Y" }]);
    });

    it("passes limit=100 by default as a query param", async () => {
      mockFetchOnce({ avanzadas: [] });
      await listarAvanzadas();
      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain("limit=100");
    });

    it("returns an empty array when the response shape is unexpected", async () => {
      mockFetchOnce({ unexpected: true });
      const result = await listarAvanzadas();
      expect(result).toEqual([]);
    });
  });

  describe("getAvanzada", () => {
    it("GETs /avanzadas/{client_id}", async () => {
      const detail = { client_id: "abc-123", nombre_avanzada: "Z", requerimientos: [] };
      mockFetchOnce(detail);
      const result = await getAvanzada("abc-123");
      expect(result).toEqual(detail);
      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain("/avanzadas/abc-123");
    });
  });
});
