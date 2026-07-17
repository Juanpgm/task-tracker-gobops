/**
 * Regression tests for authStore ↔ HTTP client token sync.
 *
 * Bug: restoreSession()/restoreSessionFromIdb() used to update only the
 * store's state (what the UI reads to show "logged in"), never the
 * apiClient/projectApiClient/uploadApiClient singletons that actually attach
 * the Authorization header. Result: after a session restore, the UI showed
 * the user as logged in while every request went out with no token, failing
 * with 403 "Not authenticated" across unrelated views.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/idbStorage", () => ({
  idbGet: vi.fn(),
  idbSet: vi.fn().mockResolvedValue(undefined),
  idbDel: vi.fn().mockResolvedValue(undefined),
}));

import { authStore } from "./authStore";
import { apiClient, projectApiClient, uploadApiClient } from "../lib/api-client";
import { idbGet } from "../lib/idbStorage";

/** In-memory Storage stand-in — this sandbox's Node/jsdom combo ships a
 * broken `localStorage`/`sessionStorage` global (missing removeItem), so we
 * stub both rather than depend on the platform's implementation. */
class FakeStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

function user(token: string) {
  return {
    uid: "u1",
    email: "a@b.com",
    displayName: "A",
    full_name: "A",
    role: "user",
    roles: [],
    permissions: [],
    temporary_permissions: [],
    cellphone: "",
    nombre_centro_gestor: "",
    is_super_admin: false,
    is_admin: false,
    token,
  } as any;
}

describe("authStore token sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", new FakeStorage());
    vi.stubGlobal("sessionStorage", new FakeStorage());
  });

  afterEach(() => {
    authStore.logout();
    apiClient.setToken(null);
    projectApiClient.setToken(null);
    uploadApiClient.setToken(null);
    vi.unstubAllGlobals();
  });

  it("login() pushes the token into every HTTP client", () => {
    authStore.login(user("tok-login"));
    expect((apiClient as any).token).toBe("tok-login");
    expect((projectApiClient as any).token).toBe("tok-login");
    expect((uploadApiClient as any).token).toBe("tok-login");
  });

  it("logout() clears the token from every HTTP client", () => {
    authStore.login(user("tok-login"));
    authStore.logout();
    expect((apiClient as any).token).toBeNull();
    expect((projectApiClient as any).token).toBeNull();
    expect((uploadApiClient as any).token).toBeNull();
  });

  it("restoreSession() (localStorage) pushes the restored token into every HTTP client", () => {
    localStorage.setItem("auth_user", JSON.stringify(user("tok-restored")));
    sessionStorage.setItem("auth_token", "tok-restored");

    const ok = authStore.restoreSession();

    expect(ok).toBe(true);
    expect((apiClient as any).token).toBe("tok-restored");
    expect((projectApiClient as any).token).toBe("tok-restored");
    expect((uploadApiClient as any).token).toBe("tok-restored");
  });

  it("restoreSessionFromIdb() pushes the restored token into every HTTP client", async () => {
    (idbGet as any).mockImplementation((key: string) =>
      key === "auth_user" ? Promise.resolve(user("tok-idb")) : Promise.resolve("tok-idb")
    );

    const ok = await authStore.restoreSessionFromIdb();

    expect(ok).toBe(true);
    expect((apiClient as any).token).toBe("tok-idb");
    expect((projectApiClient as any).token).toBe("tok-idb");
    expect((uploadApiClient as any).token).toBe("tok-idb");
  });
});
