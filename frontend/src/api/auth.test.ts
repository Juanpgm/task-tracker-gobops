/**
 * Regression tests for the token-refresh-on-401 handler registered by
 * auth.ts (`refrescarTokenYSincronizar`, not exported — tested via the
 * handler captured through the mocked ApiClient.setUnauthorizedHandler).
 *
 * Contract update (fix-token-401-network-errors): the handler used to
 * collapse every refresh failure (network blip, revoked session, unknown
 * SDK error) into the same outcome — force logout. That conflated a
 * transient network hiccup (should retry, must NOT log the user out) with a
 * genuinely dead session (should log out). It now classifies the SDK error
 * per the Error Classification Table in design.md and returns a
 * discriminated `RefreshResult`. It also single-flights concurrent callers
 * (the 3 HTTP clients share the same handler reference) so a burst of
 * concurrent 401s triggers exactly one `getIdToken(user, true)` call.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RefreshResult } from "../lib/api-client";

const apiClientMocks = vi.hoisted(() => ({
  apiClient: { setToken: vi.fn(), setUnauthorizedHandler: vi.fn() },
  projectApiClient: { setToken: vi.fn(), setUnauthorizedHandler: vi.fn() },
  uploadApiClient: { setToken: vi.fn(), setUnauthorizedHandler: vi.fn() },
}));

const authStoreMocks = vi.hoisted(() => ({
  logout: vi.fn(),
  login: vi.fn(),
  updateToken: vi.fn(),
}));

const firebaseAuthMocks = vi.hoisted(() => ({
  currentUser: null as null | { uid: string },
}));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: apiClientMocks.apiClient,
    projectApiClient: apiClientMocks.projectApiClient,
    uploadApiClient: apiClientMocks.uploadApiClient,
  };
});

vi.mock("../stores/authStore", () => ({
  authStore: authStoreMocks,
}));

vi.mock("../lib/firebase", () => ({
  get auth() {
    return firebaseAuthMocks;
  },
}));

const getIdTokenMock = vi.fn();
const onAuthStateChangedMock = vi.fn((..._args: unknown[]) => () => {});
const onIdTokenChangedMock = vi.fn(
  (_auth: unknown, _callback: (user: unknown) => unknown) => () => {}
);

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
  onIdTokenChanged: (auth: unknown, callback: (user: unknown) => unknown) =>
    onIdTokenChangedMock(auth, callback),
  getIdToken: (...args: unknown[]) => getIdTokenMock(...args),
}));

describe("auth.ts — refresh-on-401 handler", () => {
  let handler: () => Promise<RefreshResult>;

  beforeEach(async () => {
    vi.clearAllMocks();
    firebaseAuthMocks.currentUser = null;
    vi.resetModules();
    await import("./auth");
    handler = apiClientMocks.apiClient.setUnauthorizedHandler.mock.calls[0][0];
  });

  it("registers the same handler on all three HTTP clients", () => {
    expect(apiClientMocks.projectApiClient.setUnauthorizedHandler).toHaveBeenCalledWith(handler);
    expect(apiClientMocks.uploadApiClient.setUnauthorizedHandler).toHaveBeenCalledWith(handler);
  });

  it("returns session-invalid and forces logout when there is no live Firebase session", async () => {
    firebaseAuthMocks.currentUser = null;

    const result = await handler();

    expect(result).toEqual({ status: "session-invalid" });
    expect(authStoreMocks.logout).toHaveBeenCalledTimes(1);
    expect(apiClientMocks.apiClient.setToken).not.toHaveBeenCalled();
  });

  it("returns refreshed and syncs the token into every client when a live session exists", async () => {
    firebaseAuthMocks.currentUser = { uid: "u1" };
    getIdTokenMock.mockResolvedValue("fresh-token");

    const result = await handler();

    expect(result).toEqual({ status: "refreshed", token: "fresh-token" });
    expect(apiClientMocks.apiClient.setToken).toHaveBeenCalledWith("fresh-token");
    expect(apiClientMocks.projectApiClient.setToken).toHaveBeenCalledWith("fresh-token");
    expect(apiClientMocks.uploadApiClient.setToken).toHaveBeenCalledWith("fresh-token");
    expect(authStoreMocks.logout).not.toHaveBeenCalled();
  });

  it.each([
    "auth/network-request-failed",
    "auth/timeout",
    "auth/internal-error",
    "auth/too-many-requests",
  ])("returns transient and does NOT log out on network code %s", async (code) => {
    firebaseAuthMocks.currentUser = { uid: "u1" };
    const err = Object.assign(new Error(code), { code });
    getIdTokenMock.mockRejectedValue(err);

    const result = await handler();

    expect(result).toEqual({ status: "transient" });
    expect(authStoreMocks.logout).not.toHaveBeenCalled();
  });

  it.each([
    "auth/user-token-expired",
    "auth/token-expired",
    "auth/invalid-user-token",
    "auth/user-disabled",
    "auth/user-not-found",
    "auth/requires-recent-login",
  ])("returns session-invalid and logs out on session code %s", async (code) => {
    firebaseAuthMocks.currentUser = { uid: "u1" };
    const err = Object.assign(new Error(code), { code });
    getIdTokenMock.mockRejectedValue(err);

    const result = await handler();

    expect(result).toEqual({ status: "session-invalid" });
    expect(authStoreMocks.logout).toHaveBeenCalledTimes(1);
  });

  it("fail-safe: returns transient (no logout) on an unrecognized error code", async () => {
    firebaseAuthMocks.currentUser = { uid: "u1" };
    const err = Object.assign(new Error("boom"), { code: "auth/some-new-unmapped-code" });
    getIdTokenMock.mockRejectedValue(err);

    const result = await handler();

    expect(result).toEqual({ status: "transient" });
    expect(authStoreMocks.logout).not.toHaveBeenCalled();
  });

  it("fail-safe: returns transient (no logout) when the error carries no code at all", async () => {
    firebaseAuthMocks.currentUser = { uid: "u1" };
    getIdTokenMock.mockRejectedValue(new Error("plain failure, no .code"));

    const result = await handler();

    expect(result).toEqual({ status: "transient" });
    expect(authStoreMocks.logout).not.toHaveBeenCalled();
  });

  it("single-flight: N concurrent calls share one getIdToken call and the same result", async () => {
    firebaseAuthMocks.currentUser = { uid: "u1" };
    let resolveToken!: (v: string) => void;
    getIdTokenMock.mockReturnValue(new Promise<string>((res) => { resolveToken = res; }));

    const p1 = handler();
    const p2 = handler();
    const p3 = handler();

    resolveToken("shared-fresh-token");
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(getIdTokenMock).toHaveBeenCalledTimes(1);
    expect(r1).toEqual({ status: "refreshed", token: "shared-fresh-token" });
    expect(r2).toEqual(r1);
    expect(r3).toEqual(r1);
  });

  it("does not cache a transient failure: a later call after the in-flight refresh settles tries again", async () => {
    firebaseAuthMocks.currentUser = { uid: "u1" };
    const networkErr = Object.assign(new Error("auth/network-request-failed"), {
      code: "auth/network-request-failed",
    });
    getIdTokenMock.mockRejectedValueOnce(networkErr);

    const first = await handler();
    expect(first).toEqual({ status: "transient" });

    getIdTokenMock.mockResolvedValueOnce("fresh-after-retry");
    const second = await handler();

    expect(second).toEqual({ status: "refreshed", token: "fresh-after-retry" });
    expect(getIdTokenMock).toHaveBeenCalledTimes(2);
  });
});

describe("auth.ts — initAuthListener proactive refresh (onIdTokenChanged)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    firebaseAuthMocks.currentUser = null;
    vi.resetModules();
  });

  it("registers a lightweight onIdTokenChanged listener that only syncs the token, without rebuilding the profile", async () => {
    const mod = await import("./auth");
    mod.initAuthListener();

    expect(onIdTokenChangedMock).toHaveBeenCalledTimes(1);
    const idTokenCallback = onIdTokenChangedMock.mock.calls[0][1];

    const firebaseUser = { uid: "u1" };
    getIdTokenMock.mockResolvedValue("proactive-token");
    await idTokenCallback(firebaseUser);

    expect(apiClientMocks.apiClient.setToken).toHaveBeenCalledWith("proactive-token");
    expect(apiClientMocks.projectApiClient.setToken).toHaveBeenCalledWith("proactive-token");
    expect(apiClientMocks.uploadApiClient.setToken).toHaveBeenCalledWith("proactive-token");
    expect(authStoreMocks.updateToken).toHaveBeenCalledWith("proactive-token");
    // Does NOT call /auth/validate-session or authStore.login (that's onAuthStateChanged's job).
    expect(authStoreMocks.login).not.toHaveBeenCalled();
  });

  it("onIdTokenChanged is a no-op when the user signs out (null)", async () => {
    const mod = await import("./auth");
    mod.initAuthListener();

    const idTokenCallback = onIdTokenChangedMock.mock.calls[0][1];
    await idTokenCallback(null);

    expect(authStoreMocks.updateToken).not.toHaveBeenCalled();
  });
});
