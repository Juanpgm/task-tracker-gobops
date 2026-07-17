/**
 * Tests for src/lib/format-date.ts — the shared date formatter used by the
 * Avanzadas components (ListaAvanzadas, DetalleAvanzada). Mirrors the
 * es-CO / weekday-short behavior that ListaAvanzadas.svelte previously
 * implemented inline.
 */
import { describe, it, expect } from "vitest";
import { formatDate } from "./format-date";

describe("formatDate", () => {
  it('returns "Sin fecha" for an empty string', () => {
    expect(formatDate("")).toBe("Sin fecha");
  });

  it('returns "Sin fecha" for null', () => {
    expect(formatDate(null)).toBe("Sin fecha");
  });

  it('returns "Sin fecha" for undefined', () => {
    expect(formatDate(undefined)).toBe("Sin fecha");
  });

  it("formats a YYYY-MM-DD date in es-CO with a short weekday by default", () => {
    const result = formatDate("2026-07-16");
    expect(result).toContain("2026");
    expect(result).toMatch(/jul/i);
    expect(result).toMatch(/16/);
  });

  it("does not shift the date back a day due to UTC parsing (local-noon anchor)", () => {
    // A naive `new Date("2026-07-16")` parses as UTC midnight, which can
    // render as "15 de julio" in negative-UTC-offset locales/machines.
    const result = formatDate("2026-07-16");
    expect(result).not.toMatch(/\b15\b/);
  });

  it("supports a long weekday when requested", () => {
    const result = formatDate("2026-07-16", { weekday: "long" });
    // "jueves" (long) vs "jue" (short) for 2026-07-16
    expect(result.toLowerCase()).toContain("jueves");
  });

  it("appends time when includeTime is true and the source has a time component", () => {
    const result = formatDate("2026-07-16T14:30:00Z", { includeTime: true });
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("returns the original string unmodified when it cannot be parsed as a date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});
