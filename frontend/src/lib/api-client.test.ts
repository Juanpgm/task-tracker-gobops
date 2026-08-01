/**
 * Regression tests for ApiClient's 401 retry behavior.
 *
 * Bug: this PWA stays open for hours in the field, so the Firebase ID token
 * (valid ~1h) routinely expires mid-session. Before this fix, the first
 * fresh request after expiry (e.g. "Crear PDF") failed with 401 even though
 * the user was still logged in — other views kept working because they
 * showed already-cached data without re-fetching.
 *
 * Contract update (fix-token-401-network-errors): `onUnauthorized` used to
 * return `string | null`, conflating "refresh failed because the session is
 * genuinely gone" with "refresh failed because of a transient network
 * error" — both looked like `null` to `fetchWithRetry`, which propagated the
 * 401 either way. Now it returns a discriminated `RefreshResult` so
 * `fetchWithRetry` can retry on `refreshed`, propagate 401 on
 * `session-invalid`, and throw a retryable `REFRESH_TRANSIENT` sentinel
 * (never a logout) on `transient`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient, REFRESH_TRANSIENT, type RefreshResult } from "./api-client";

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

    const refreshHandler = vi.fn().mockImplementation(async (): Promise<RefreshResult> => {
      client.setToken("fresh-token");
      return { status: "refreshed", token: "fresh-token" };
    });
    client.setUnauthorizedHandler(refreshHandler);

    const result = await client.get<{ ok: boolean }>("/foo");

    expect(result).toEqual({ ok: true });
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["Bearer stale-token", "Bearer fresh-token"]);
  });

  it("propagates the original 401 with no retry when the refresh resolves session-invalid", async () => {
    (global.fetch as any) = vi.fn().mockResolvedValue(mockResponse(false, 401, { detail: "expired" }));
    const refreshHandler = vi.fn().mockResolvedValue({ status: "session-invalid" } satisfies RefreshResult);
    client.setUnauthorizedHandler(refreshHandler);

    await expect(client.get("/foo")).rejects.toThrow(/401/);
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect((global.fetch as any).mock.calls.length).toBe(1);
  });

  it("throws the REFRESH_TRANSIENT sentinel with no fetch retry and no 401-as-unauthorized treatment when the refresh resolves transient", async () => {
    (global.fetch as any) = vi.fn().mockResolvedValue(mockResponse(false, 401, { detail: "expired" }));
    const refreshHandler = vi.fn().mockResolvedValue({ status: "transient" } satisfies RefreshResult);
    client.setUnauthorizedHandler(refreshHandler);

    await expect(client.get("/foo")).rejects.toThrow(REFRESH_TRANSIENT);
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    // Bound: transient never retries the fetch — exactly the original 401 call.
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
    const refreshHandler = vi.fn().mockImplementation(async (): Promise<RefreshResult> => {
      client.setToken("fresh-token");
      return { status: "refreshed", token: "fresh-token" };
    });
    client.setUnauthorizedHandler(refreshHandler);

    const blob = await client.getBlob("/avanzadas/x/reporte-pdf");

    expect(blob).toBeInstanceOf(Blob);
    expect(refreshHandler).toHaveBeenCalledTimes(1);
  });

  it("never exceeds 1 refresh + 1 fetch retry even if the retried request 401s again", async () => {
    (global.fetch as any) = vi.fn().mockResolvedValue(mockResponse(false, 401, { detail: "expired" }));
    const refreshHandler = vi.fn().mockResolvedValue({ status: "refreshed", token: "fresh-token" } satisfies RefreshResult);
    client.setUnauthorizedHandler(refreshHandler);

    await expect(client.get("/foo")).rejects.toThrow(/401/);
    // 1 initial fetch + 1 retry fetch, never a loop.
    expect((global.fetch as any).mock.calls.length).toBe(2);
    expect(refreshHandler).toHaveBeenCalledTimes(1);
  });
});

describe("ApiClient network-failure retry (Failed to fetch)", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("https://api.test");
    client.setToken("t");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a GET that rejects with 'Failed to fetch' and succeeds on the next attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(mockResponse(true, 200, { ok: true }));
    (global.fetch as any) = fetchMock;

    const pending = client.get<{ ok: boolean }>("/avanzadas/estadisticas");
    await vi.advanceTimersByTimeAsync(500); // first backoff
    const result = await pending;

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the bounded number of GET retries and throws the network error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    (global.fetch as any) = fetchMock;

    const pending = client.get("/avanzadas/geo");
    const assertion = expect(pending).rejects.toThrow("Failed to fetch");
    await vi.advanceTimersByTimeAsync(500); // backoff after attempt 1
    await vi.advanceTimersByTimeAsync(1000); // backoff after attempt 2
    await assertion;

    // initial attempt + 2 retries = 3 total, then it stops.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry a POST (a write) on network failure — never replays a mutation", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    (global.fetch as any) = fetchMock;

    await expect(client.post("/foo", { a: 1 })).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a GET that hangs to the timeout — fails fast after one timeout, not three", async () => {
    (global.fetch as any) = vi.fn().mockImplementation(() => new Promise(() => {})); // never resolves

    const pending = client.get("/avanzadas/estadisticas");
    const assertion = expect(pending).rejects.toThrow(/tardó demasiado/);
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;

    // Timeout is a plain Error, not a retriable TypeError → exactly one attempt.
    expect((global.fetch as any).mock.calls.length).toBe(1);
  });
});

describe("ApiClient request timeout", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("https://api.test");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a stalled GET after 30s instead of hanging forever", async () => {
    (global.fetch as any) = vi.fn().mockImplementation(() => new Promise(() => {})); // never resolves

    const pending = client.get("/foo");
    const assertion = expect(pending).rejects.toThrow(/tardó demasiado/);

    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it("gives multipart uploads a longer 90s timeout before failing", async () => {
    (global.fetch as any) = vi.fn().mockImplementation(() => new Promise(() => {})); // never resolves

    const pending = client.patchForm("/foo", new FormData());
    const assertion = expect(pending).rejects.toThrow(/tardó demasiado/);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(vi.getTimerCount()).toBeGreaterThan(0); // 30s isn't enough for uploads, still pending
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });
});
