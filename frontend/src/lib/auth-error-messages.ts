/**
 * Translates a raw error (401/session-invalid, the REFRESH_TRANSIENT
 * sentinel, or a generic network/timeout failure) into exactly one of two
 * user-facing Spanish messages. Stores must call this instead of surfacing
 * `err.message` directly — a raw string like
 * "GET /avanzadas failed (401): Token inválido o expirado" is not
 * actionable for a field user; either they need to log back in, or the
 * connection is flaky and the app is already retrying.
 */
import { REFRESH_TRANSIENT } from './api-client';

export const SESSION_EXPIRED = 'Tu sesión expiró. Volvé a iniciar sesión.';
export const CONNECTION_RETRY = 'Problema de conexión. Reintentá en un momento.';

const NETWORK_PATTERNS = [REFRESH_TRANSIENT, 'Failed to fetch', 'NetworkError', 'tardó demasiado'];

export function toUserMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return 'Ocurrió un error inesperado.';
  }
  if (err.message.includes('(401)')) {
    return SESSION_EXPIRED;
  }
  if (NETWORK_PATTERNS.some((pattern) => err.message.includes(pattern))) {
    return CONNECTION_RETRY;
  }
  return err.message;
}
