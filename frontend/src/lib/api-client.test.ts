/**
 * Regression tests for ApiClient's 401 retry behavior.
 *
 * Bug: this PWA stays open for hours in the field, so the Firebase ID token
 * (valid ~1h) routinely expires mid-session. Before this fix, the first
 * fresh request after expiry (e.g. "Crear PDF") failed with 401 even though
 * the user was still logged in — other views kept working because they
 * showed already-cached data without re-fetching.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient } from "./api-client";

function mockResponse(ok: boolean, status: number, body: unknown = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    blob: async () => new Blob([JSON.stringify(body)]),
  } as Response;
}

describe("ApiClient 401 retry", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("https://api.test");
    client.setToken("stale-token");
  });

  it("does not retry when there is no unauthorized handler registered", async () => {
    (global.fetch as any) = vi.fn().mockResolvedValue(mockResponse(false, 401, { detail: "expired" }));

    await expect(client.get("/foo")).rejects.toThrow(/401/);
    expect((global.fetch as any).mock.calls.length).toBe(1);
  });

  it("refreshes the token and retries once on 401, succeeding with the fresh token", async () => {
    const calls: string[] = [];
    (global.fetch as any) = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>)["Authorization"];
      calls.push(auth);
      if (auth === "Bearer stale-token") return Promise.resolve(mockResponse(false, 401, { detail: "expired" }));
      return Promise.resolve(mockResponse(true, 200, { ok: true }));
    });

    const refreshHandler = vi.fn().mockImplementation(async () => {
      client.setToken("fresh-token");
      return "fresh-token";
    });
    client.setUnauthorizedHandler(refreshHandler);

    const result = await client.get<{ ok: boolean }>("/foo");

    expect(result).toEqual({ ok: true });
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["Bearer stale-token", "Bearer fresh-token"]);
  });

  it("propagates the original 401 when the refresh handler cannot refresh (signed out)", async () => {
    (global.fetch as any) = vi.fn().mockResolvedValue(mockResponse(false, 401, { detail: "expired" }));
    const refreshHandler = vi.fn().mockResolvedValue(null);
    client.setUnauthorizedHandler(refreshHandler);

    await expect(client.get("/foo")).rejects.toThrow(/401/);
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect((global.fetch as any).mock.calls.length).toBe(1);
  });

  it("does not retry on non-401 errors", async () => {
    (global.fetch as any) = vi.fn().mockResolvedValue(mockResponse(false, 500, { detail: "boom" }));
    const refreshHandler = vi.fn();
    client.setUnauthorizedHandler(refreshHandler);

    await expect(client.get("/foo")).rejects.toThrow(/500/);
    expect(refreshHandler).not.toHaveBeenCalled();
  });

  it("retries getBlob() on 401 too", async () => {
    (global.fetch as any) = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(false, 401, { detail: "expired" }))
      .mockResolvedValueOnce(mockResponse(true, 200));
    const refreshHandler = vi.fn().mockImplementation(async () => {
      client.setToken("fresh-token");
      return "fresh-token";
    });
    client.setUnauthorizedHandler(refreshHandler);

    const blob = await client.getBlob("/avanzadas/x/reporte-pdf");

    expect(blob).toBeInstanceOf(Blob);
    expect(refreshHandler).toHaveBeenCalledTimes(1);
  });
});
