/**
 * Regression tests for the token-refresh-on-401 handler registered by
 * auth.ts (`refrescarTokenYSincronizar`, not exported — tested via the
 * handler captured through the mocked ApiClient.setUnauthorizedHandler).
 *
 * Bug: when Firebase's own session is truly gone (ITP purged its IndexedDB,
 * signOut in another tab, storage cleared) but authStore still shows
 * "logged in" via its own restoreSession()/restoreSessionFromIdb() cache,
 * the refresh handler could not mint a new token (no underlying Firebase
 * user) yet left the UI showing a broken "logged in" ghost session where
 * every fresh action 401s. It must now force a clean logout so the user
 * sees the login screen instead.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const apiClientMocks = vi.hoisted(() => ({
  apiClient: { setToken: vi.fn(), setUnauthorizedHandler: vi.fn() },
  projectApiClient: { setToken: vi.fn(), setUnauthorizedHandler: vi.fn() },
  uploadApiClient: { setToken: vi.fn(), setUnauthorizedHandler: vi.fn() },
}));

const authStoreMocks = vi.hoisted(() => ({
  logout: vi.fn(),
  login: vi.fn(),
}));

const firebaseAuthMocks = vi.hoisted(() => ({
  currentUser: null as null | { uid: string },
}));

vi.mock("../lib/api-client", () => ({
  apiClient: apiClientMocks.apiClient,
  projectApiClient: apiClientMocks.projectApiClient,
  uploadApiClient: apiClientMocks.uploadApiClient,
}));

vi.mock("../stores/authStore", () => ({
  authStore: authStoreMocks,
}));

vi.mock("../lib/firebase", () => ({
  get auth() {
    return firebaseAuthMocks;
  },
}));

const getIdTokenMock = vi.fn();

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => () => {}),
  getIdToken: (...args: unknown[]) => getIdTokenMock(...args),
}));

describe("auth.ts — refresh-on-401 handler", () => {
  let handler: () => Promise<string | null>;

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

  it("forces logout and returns null when there is no live Firebase session", async () => {
    firebaseAuthMocks.currentUser = null;

    const result = await handler();

    expect(result).toBeNull();
    expect(authStoreMocks.logout).toHaveBeenCalledTimes(1);
    expect(apiClientMocks.apiClient.setToken).not.toHaveBeenCalled();
  });

  it("refreshes and syncs the token into every client when a live session exists", async () => {
    firebaseAuthMocks.currentUser = { uid: "u1" };
    getIdTokenMock.mockResolvedValue("fresh-token");

    const result = await handler();

    expect(result).toBe("fresh-token");
    expect(apiClientMocks.apiClient.setToken).toHaveBeenCalledWith("fresh-token");
    expect(apiClientMocks.projectApiClient.setToken).toHaveBeenCalledWith("fresh-token");
    expect(apiClientMocks.uploadApiClient.setToken).toHaveBeenCalledWith("fresh-token");
    expect(authStoreMocks.logout).not.toHaveBeenCalled();
  });

  it("forces logout when a live session exists but the refresh call itself fails", async () => {
    firebaseAuthMocks.currentUser = { uid: "u1" };
    getIdTokenMock.mockRejectedValue(new Error("network"));

    const result = await handler();

    expect(result).toBeNull();
    expect(authStoreMocks.logout).toHaveBeenCalledTimes(1);
  });
});
