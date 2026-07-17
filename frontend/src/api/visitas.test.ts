/**
 * Tests for src/api/visitas.ts.
 * Seam under test: subirEvidenciasSeguimiento() against a mocked global fetch,
 * mirroring the auth/error/multipart conventions established in
 * src/api/avanzadas.ts and src/api/jornadas.ts.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { subirEvidenciasSeguimiento } from "./visitas";
import { uploadApiClient } from "../lib/api-client";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global.fetch as any) = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe("api/visitas", () => {
  beforeEach(() => {
    uploadApiClient.setToken("test-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    uploadApiClient.setToken(null);
  });

  describe("subirEvidenciasSeguimiento", () => {
    const evidenciaResponse = [
      {
        s3_url: "https://bucket.s3.amazonaws.com/seguimiento/vid-1/evidencias/uuid_foto.jpg",
        s3_key: "seguimiento/vid-1/evidencias/uuid_foto.jpg",
        filename: "foto.jpg",
        content_type: "image/jpeg",
        size: 12345,
      },
    ];

    it("POSTs multipart/form-data to /seguimiento/evidencias and returns the unified S3 shape", async () => {
      mockFetchOnce(evidenciaResponse);
      const foto = new File(["x"], "foto.jpg", { type: "image/jpeg" });

      const result = await subirEvidenciasSeguimiento({
        visita_id: "vid-1",
        fotos: [foto],
      });

      expect(result).toEqual(evidenciaResponse);
      const [url, options] = (global.fetch as any).mock.calls[0];
      expect(url).toContain("/seguimiento/evidencias");
      expect(options.method).toBe("POST");
      expect(options.body).toBeInstanceOf(FormData);
      const form = options.body as FormData;
      expect(form.get("requerimiento_id")).toBe("vid-1");
      expect(form.getAll("archivos")).toEqual([foto]);
      expect(options.headers["Content-Type"]).toBeUndefined();
      expect(options.headers.Authorization).toBe("Bearer test-token");
    });

    it("includes nota_voz as an additional archivo when provided", async () => {
      mockFetchOnce(evidenciaResponse);
      const notaVoz = new File(["x"], "nota.webm", { type: "audio/webm" });

      await subirEvidenciasSeguimiento({ visita_id: "vid-1", nota_voz: notaVoz });

      const [, options] = (global.fetch as any).mock.calls[0];
      const form = options.body as FormData;
      expect(form.getAll("archivos")).toEqual([notaVoz]);
    });

    it("throws when the backend responds with a non-ok status", async () => {
      mockFetchOnce({ error: "boom" }, false, 500);
      await expect(subirEvidenciasSeguimiento({ visita_id: "vid-1" })).rejects.toThrow();
    });
  });
});
