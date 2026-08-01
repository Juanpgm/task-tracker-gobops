const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || '/api/auth';
const PROJECT_API_URL = import.meta.env.VITE_API_URL || '/api/project';
// Direct URL for multipart/file uploads — bypasses Vercel proxy which can corrupt binary bodies
const UPLOAD_API_URL = import.meta.env.VITE_UPLOAD_API_URL || import.meta.env.VITE_AUTH_API_URL || '/api/auth';

/** Sentinel error message thrown by fetchWithRetry when a 401 refresh fails
 * for a transient/network reason (see RefreshResult below). Never a logout —
 * callers should surface a retryable "problema de conexión" state instead
 * of treating this like a permanent authorization failure. */
export const REFRESH_TRANSIENT = 'auth/refresh-transient';

/**
 * Result of a shared, single-flight token refresh (see `api/auth.ts`'s
 * `refrescarTokenYSincronizar`). Discriminates WHY the refresh didn't
 * produce a usable token, because `fetchWithRetry` needs 3 different
 * behaviors — see the switch inside `fetchWithRetry` below:
 *   - 'refreshed': got a fresh token, safe to retry the original request.
 *   - 'session-invalid': the Firebase session is genuinely gone (revoked,
 *     expired beyond refresh, or signed out elsewhere) — propagate the 401.
 *   - 'transient': refresh itself failed for a network/infra reason — do
 *     NOT log out and do NOT retry the fetch (that would risk a loop).
 */
export type RefreshResult =
  | { status: 'refreshed'; token: string }
  | { status: 'session-invalid' }
  | { status: 'transient' };

/** Refreshes the Firebase ID token and pushes it into the client via setToken(). */
type UnauthorizedHandler = () => Promise<RefreshResult>;

export class ApiClient {
  private static readonly DEFAULT_TIMEOUT_MS = 30_000;
  private static readonly UPLOAD_TIMEOUT_MS = 90_000;
  // Bounded auto-retry for idempotent GET reads whose fetch fails at the
  // NETWORK layer (no HTTP response: "Failed to fetch"/NetworkError, or our
  // own timeout). The heavy report endpoints stream full Firestore
  // collections and routinely fail the first hit on a cold Railway instance
  // (or a flaky field connection) with no response at all, blocking the user
  // from ever seeing their data; a warmed retry almost always succeeds.
  // Reads only — writes (POST/PUT/PATCH/DELETE) are never auto-retried.
  private static readonly GET_NETWORK_RETRIES = 2;
  private static readonly RETRY_BACKOFF_MS = 500;

  private baseUrl: string;
  private token: string | null = null;
  private onUnauthorized: UnauthorizedHandler | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
    this.onUnauthorized = handler;
  }

  private getHeaders(isJson = true): HeadersInit {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  /**
   * Races `promise` against a timeout so a stalled connection (common on
   * field mobile data) fails loudly instead of leaving an awaiting UI
   * (e.g. a modal's "Guardar" button) stuck forever with no error and no
   * feedback — plain `fetch()` has no built-in timeout.
   *
   * ponytail: doesn't abort the underlying fetch, it just stops waiting on
   * it — the request keeps running in the background until it resolves or
   * the browser gives up. Upgrade to AbortController + signal-threading
   * through every method if wasted in-flight requests become a real cost.
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `La solicitud tardó demasiado (más de ${Math.round(timeoutMs / 1000)}s). Verificá tu conexión e intentá de nuevo.`
            )
          ),
        timeoutMs
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Runs `doFetch` and, on a 401, refreshes the token once via
   * `setUnauthorizedHandler` and retries — this PWA stays open for hours in
   * the field, so the Firebase ID token (valid ~1h) routinely expires
   * mid-session; without this, the first fresh request after expiry (often
   * an explicit action like "Crear PDF" rather than a cached list view)
   * fails with 401 even though the user is still logged in. `doFetch` must
   * read `this.token` at call time (via a closure over `getHeaders()`) so
   * the retry picks up the refreshed value.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * A retriable network-layer failure is a rejected `fetch()` — the browser
   * throws `TypeError` for "Failed to fetch" / "NetworkError when attempting
   * to fetch resource" / "Load failed" (connection refused/reset, DNS,
   * CORS-preflight, a cold backend that isn't accepting connections yet).
   * Our own `withTimeout` throws a plain `Error` ("tardó demasiado"), which
   * is deliberately NOT retried — a request that already hung the full
   * timeout shouldn't hang it two more times; it fails fast so the user can
   * decide to retry.
   */
  private static isRetriableNetworkError(err: unknown): boolean {
    return err instanceof TypeError;
  }

  /**
   * Runs the (timeout-wrapped) fetch and retries ONLY a retriable network
   * rejection (see `isRetriableNetworkError`). An HTTP error *response*
   * (4xx/5xx) resolves, so it is never retried here; that's fetchWithRetry's
   * job. Retries are opt-in per call (0 for writes) so this can never replay
   * a mutation.
   */
  private async fetchWithNetworkRetry(
    doFetch: () => Promise<Response>,
    timeoutMs: number,
    networkRetries: number
  ): Promise<Response> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= networkRetries; attempt++) {
      try {
        return await this.withTimeout(doFetch(), timeoutMs);
      } catch (err) {
        lastErr = err;
        if (attempt === networkRetries || !ApiClient.isRetriableNetworkError(err)) {
          break;
        }
        // Linear backoff — give a cold backend a moment to warm up.
        await this.delay(ApiClient.RETRY_BACKOFF_MS * (attempt + 1));
      }
    }
    throw lastErr;
  }

  private async fetchWithRetry(
    doFetch: () => Promise<Response>,
    timeoutMs: number = ApiClient.DEFAULT_TIMEOUT_MS,
    networkRetries = 0
  ): Promise<Response> {
    const response = await this.fetchWithNetworkRetry(doFetch, timeoutMs, networkRetries);
    if (response.status !== 401 || !this.onUnauthorized) {
      return response;
    }
    // Bound: at most 1 forced refresh + 1 fetch retry per request, no
    // matter which branch below is taken — 'transient' never re-enters
    // this function, so a loop is structurally impossible.
    const result = await this.onUnauthorized();
    switch (result.status) {
      case 'refreshed':
        return this.fetchWithNetworkRetry(doFetch, timeoutMs, networkRetries);
      case 'session-invalid':
        // Session is genuinely gone (logout already ran inside the
        // handler) — propagate the original 401 so the caller routes to login.
        return response;
      case 'transient':
        // Network/infra hiccup during refresh, not an auth failure — never
        // logout, never retry the fetch (that's how loops happen).
        throw new Error(REFRESH_TRANSIENT);
    }
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    const response = await this.fetchWithRetry(
      () => fetch(url, { method: 'GET', headers: this.getHeaders() }),
      ApiClient.DEFAULT_TIMEOUT_MS,
      ApiClient.GET_NETWORK_RETRIES
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GET ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.fetchWithRetry(() =>
      fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      })
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`POST ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  async postForm<T>(path: string, formData: FormData): Promise<T> {
    const response = await this.fetchWithRetry(
      () =>
        fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: this.getHeaders(false),
          body: formData,
        }),
      ApiClient.UPLOAD_TIMEOUT_MS
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`POST ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  async patchForm<T>(path: string, formData: FormData): Promise<T> {
    const response = await this.fetchWithRetry(
      () =>
        fetch(`${this.baseUrl}${path}`, {
          method: 'PATCH',
          headers: this.getHeaders(false),
          body: formData,
        }),
      ApiClient.UPLOAD_TIMEOUT_MS
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`PATCH ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  async postUrlEncoded<T>(path: string, data: Record<string, string>): Promise<T> {
    const response = await this.fetchWithRetry(() =>
      fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(false) as Record<string, string>,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(data).toString(),
      })
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`POST ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  /**
   * GET that returns the raw response body as a Blob (file downloads, e.g. PDF
   * reports). Uses the long (upload-grade) timeout because server-side PDF
   * generation streams photos + OpenStreetMap tiles and legitimately takes
   * 30–40s for a large avanzada — the 30s default was cutting it off and
   * surfacing "No se pudo generar el PDF". One network-retry for a cold/flaky
   * first hit (idempotent read; never replays a mutation).
   */
  async getBlob(path: string): Promise<Blob> {
    const response = await this.fetchWithRetry(
      () => fetch(`${this.baseUrl}${path}`, { method: 'GET', headers: this.getHeaders() }),
      ApiClient.UPLOAD_TIMEOUT_MS,
      1
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GET ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.blob();
  }

  async delete<T>(path: string, params?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    const response = await this.fetchWithRetry(() =>
      fetch(url, { method: 'DELETE', headers: this.getHeaders() })
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`DELETE ${path} failed (${response.status}): ${errorBody}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json();
  }

  async put<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.fetchWithRetry(() =>
      fetch(`${this.baseUrl}${path}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      })
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`PUT ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  async patch<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.fetchWithRetry(() =>
      fetch(`${this.baseUrl}${path}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      })
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`PATCH ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }
}

/** Auth & visitas — original API (web-production-79739) */
export const apiClient = new ApiClient(AUTH_API_URL);

/** Gestor de proyectos — project API (gestorproyectoapi-production) */
export const projectApiClient = new ApiClient(PROJECT_API_URL);

/** Direct upload client — bypasses Vercel proxy for multipart/form-data file uploads */
export const uploadApiClient = new ApiClient(UPLOAD_API_URL);

export default apiClient;
