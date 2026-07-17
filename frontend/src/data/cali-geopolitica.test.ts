import { describe, it, expect } from "vitest";
import { matchComuna, matchBarrio } from "./cali-geopolitica";

describe("matchComuna", () => {
  it("matches an exact comuna name", () => {
    expect(matchComuna("Comuna 3")).toBe("Comuna 3");
  });

  it("matches case- and accent-insensitively, and tolerates surrounding text (Nominatim city_district style)", () => {
    expect(matchComuna("comuna 3")).toBe("Comuna 3");
    expect(matchComuna("COMUNA 3")).toBe("Comuna 3");
  });

  it("matches a corregimiento by its full name", () => {
    expect(matchComuna("Corregimiento Felidia")).toBe("Corregimiento Felidia");
  });

  it("returns null instead of guessing when there is no reasonable match", () => {
    expect(matchComuna("Barrio Inventado Que No Existe En Cali")).toBeNull();
  });

  it("returns null for empty/undefined/null input", () => {
    expect(matchComuna("")).toBeNull();
    expect(matchComuna(undefined)).toBeNull();
    expect(matchComuna(null)).toBeNull();
  });
});

describe("matchBarrio", () => {
  it("matches a barrio within the given comuna, accent-insensitively", () => {
    expect(matchBarrio("Peñón", "Comuna 3")).toBe("El Peñón");
  });

  it("does not match a barrio that belongs to a different comuna", () => {
    // 'Salomia' belongs to Comuna 1, not Comuna 3.
    expect(matchBarrio("Salomia", "Comuna 3")).toBeNull();
  });

  it("returns null when the comuna itself is unknown", () => {
    expect(matchBarrio("El Peñón", "Comuna Inexistente")).toBeNull();
  });

  it("returns null for empty/undefined/null barrio input", () => {
    expect(matchBarrio("", "Comuna 3")).toBeNull();
    expect(matchBarrio(undefined, "Comuna 3")).toBeNull();
    expect(matchBarrio(null, "Comuna 3")).toBeNull();
  });
});
