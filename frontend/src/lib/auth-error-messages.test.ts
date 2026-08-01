/**
 * Tests for toUserMessage(): translates a raw error (401/session-invalid,
 * REFRESH_TRANSIENT sentinel, or a generic "Failed to fetch"/"NetworkError"
 * network error) into exactly one of two user-facing Spanish messages, so
 * stores never surface a raw string like "GET /avanzadas failed (401): ...".
 */
import { describe, it, expect } from "vitest";
import { toUserMessage, SESSION_EXPIRED, CONNECTION_RETRY } from "./auth-error-messages";
import { REFRESH_TRANSIENT } from "./api-client";

describe("toUserMessage", () => {
  it("maps a raw 401 error to SESSION_EXPIRED", () => {
    expect(toUserMessage(new Error("GET /avanzadas failed (401): Token inválido o expirado"))).toBe(
      SESSION_EXPIRED
    );
  });

  it("maps the REFRESH_TRANSIENT sentinel to CONNECTION_RETRY", () => {
    expect(toUserMessage(new Error(REFRESH_TRANSIENT))).toBe(CONNECTION_RETRY);
  });

  it("maps 'Failed to fetch' to CONNECTION_RETRY", () => {
    expect(toUserMessage(new TypeError("Failed to fetch"))).toBe(CONNECTION_RETRY);
  });

  it("maps 'NetworkError' to CONNECTION_RETRY", () => {
    expect(toUserMessage(new Error("NetworkError when attempting to fetch resource"))).toBe(CONNECTION_RETRY);
  });

  it("maps the request-timeout message to CONNECTION_RETRY", () => {
    expect(
      toUserMessage(new Error("La solicitud tardó demasiado (más de 30s). Verificá tu conexión e intentá de nuevo."))
    ).toBe(CONNECTION_RETRY);
  });

  it("falls back to the error's own message for anything else", () => {
    expect(toUserMessage(new Error("POST /avanzadas failed (422): campo requerido"))).toBe(
      "POST /avanzadas failed (422): campo requerido"
    );
  });

  it("falls back to a generic message for a non-Error value", () => {
    expect(toUserMessage("just a string")).toBe("Ocurrió un error inesperado.");
  });
});
