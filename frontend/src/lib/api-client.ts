const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'https://web-production-79739.up.railway.app';
const PROJECT_API_URL = import.meta.env.VITE_API_URL || 'https://gestorproyectoapi-production.up.railway.app';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
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

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GET ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`POST ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  async postForm<T>(path: string, formData: FormData): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: formData,
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`POST ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  async postUrlEncoded<T>(path: string, data: Record<string, string>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(false) as Record<string, string>,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(data).toString(),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`POST ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  async delete<T>(path: string, params?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`DELETE ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }

  async put<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`PUT ${path} failed (${response.status}): ${errorBody}`);
    }
    return response.json();
  }
}

/** Auth & visitas — original API (web-production-79739) */
export const apiClient = new ApiClient(AUTH_API_URL);

/** Gestor de proyectos — project API (gestorproyectoapi-production) */
export const projectApiClient = new ApiClient(PROJECT_API_URL);

export default apiClient;
