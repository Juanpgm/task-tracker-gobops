const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || '/api/auth';
const PROJECT_API_URL = import.meta.env.VITE_API_URL || '/api/project';
// Direct URL for multipart/file uploads — bypasses Vercel proxy which can corrupt binary bodies
const UPLOAD_API_URL = import.meta.env.VITE_UPLOAD_API_URL || import.meta.env.VITE_AUTH_API_URL || '/api/auth';

/** Refreshes the Firebase ID token and pushes it into the client via setToken().
 * Returns the fresh token, or null if refresh isn't possible (signed out). */
type UnauthorizedHandler = () => Promise<string | null>;

export class ApiClient {
  private static readonly DEFAULT_TIMEOUT_MS = 30_000;
  private static readonly UPLOAD_TIMEOUT_MS = 90_000;

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
  private async fetchWithRetry(
    doFetch: () => Promise<Response>,
    timeoutMs: number = ApiClient.DEFAULT_TIMEOUT_MS
  ): Promise<Response> {
    const response = await this.withTimeout(doFetch(), timeoutMs);
    if (response.status !== 401 || !this.onUnauthorized) {
      return response;
    }
    const refreshed = await this.onUnauthorized();
    if (!refreshed) {
      return response;
    }
    return this.withTimeout(doFetch(), timeoutMs);
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    const response = await this.fetchWithRetry(() =>
      fetch(url, { method: 'GET', headers: this.getHeaders() })
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

  /** GET that returns the raw response body as a Blob (file downloads, e.g. PDF reports). */
  async getBlob(path: string): Promise<Blob> {
    const response = await this.fetchWithRetry(() =>
      fetch(`${this.baseUrl}${path}`, { method: 'GET', headers: this.getHeaders() })
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
