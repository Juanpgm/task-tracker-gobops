/**
 * Tests for the Avanzadas catalog fallback data and its pure helper functions.
 * Seams under test: exported catalog constants (offline fallback shape) and
 * the pure functions extractAcronimo / getCategoriasParaEntidad / mergeCatalogos.
 */
import { describe, it, expect } from "vitest";
import {
  ESTRATEGIAS_AVANZADAS,
  EQUIPO_AVANZADAS,
  DEPENDENCIAS_AVANZADAS,
  CATEGORIAS_AVANZADAS,
  CATALOGO_AVANZADAS_FALLBACK,
  extractAcronimo,
  getCategoriasParaEntidad,
  mergeCatalogos,
} from "./avanzadas-catalogo";

describe("Avanzadas catalog fallback data", () => {
  it("exports non-empty estrategias, equipo and dependencias arrays", () => {
    expect(ESTRATEGIAS_AVANZADAS.length).toBeGreaterThan(0);
    expect(EQUIPO_AVANZADAS.length).toBeGreaterThan(0);
    expect(DEPENDENCIAS_AVANZADAS.length).toBeGreaterThan(0);
  });

  it("includes known strategies from the seed data", () => {
    expect(ESTRATEGIAS_AVANZADAS).toContain("En Un 2x3");
    expect(ESTRATEGIAS_AVANZADAS).toContain("Cali En Obra verifica");
  });

  it("includes known dependencias with 'ACRONIMO - Nombre completo' shape", () => {
    expect(
      DEPENDENCIAS_AVANZADAS.some((d) => d.startsWith("DAGMA - "))
    ).toBe(true);
    expect(
      DEPENDENCIAS_AVANZADAS.some((d) => d.startsWith("EMCALI - "))
    ).toBe(true);
  });

  it("exports categorias keyed by entity acronym", () => {
    expect(CATEGORIAS_AVANZADAS["DAGMA"]).toBeDefined();
    expect(CATEGORIAS_AVANZADAS["DAGMA"].length).toBeGreaterThan(0);
    expect(CATEGORIAS_AVANZADAS["UAESP"]).toBeDefined();
    expect(CATEGORIAS_AVANZADAS["EMCALI"]).toBeDefined();
  });

  it("bundles all four catalogs into CATALOGO_AVANZADAS_FALLBACK", () => {
    expect(CATALOGO_AVANZADAS_FALLBACK.estrategias).toBe(ESTRATEGIAS_AVANZADAS);
    expect(CATALOGO_AVANZADAS_FALLBACK.equipo).toBe(EQUIPO_AVANZADAS);
    expect(CATALOGO_AVANZADAS_FALLBACK.dependencias).toBe(DEPENDENCIAS_AVANZADAS);
    expect(CATALOGO_AVANZADAS_FALLBACK.categorias).toBe(CATEGORIAS_AVANZADAS);
  });
});

describe("extractAcronimo", () => {
  it("extracts the prefix before ' - '", () => {
    expect(extractAcronimo("DAGMA - Departamento Administrativo de Gestión del Medio Ambiente")).toBe("DAGMA");
  });

  it("returns the trimmed string unchanged when there is no ' - ' separator", () => {
    expect(extractAcronimo("Otra entidad")).toBe("Otra entidad");
  });

  it("trims surrounding whitespace", () => {
    expect(extractAcronimo("  EMCALI - Empresas Municipales de Cali  ")).toBe("EMCALI");
  });
});

describe("getCategoriasParaEntidad", () => {
  it("returns categorias for an exact acronym match", () => {
    const result = getCategoriasParaEntidad("DAGMA", CATEGORIAS_AVANZADAS);
    expect(result).toEqual(CATEGORIAS_AVANZADAS["DAGMA"]);
  });

  it("resolves categorias when given the full 'ACRONIMO - Nombre' dependencia string", () => {
    const result = getCategoriasParaEntidad(
      "DAGMA - Departamento Administrativo de Gestión del Medio Ambiente",
      CATEGORIAS_AVANZADAS
    );
    expect(result).toEqual(CATEGORIAS_AVANZADAS["DAGMA"]);
  });

  it("is case-insensitive on the acronym", () => {
    const result = getCategoriasParaEntidad("dagma", CATEGORIAS_AVANZADAS);
    expect(result).toEqual(CATEGORIAS_AVANZADAS["DAGMA"]);
  });

  it("returns an empty array for an unknown entidad (free text)", () => {
    expect(getCategoriasParaEntidad("Entidad Inventada XYZ", CATEGORIAS_AVANZADAS)).toEqual([]);
  });

  it("returns an empty array for an empty entidad", () => {
    expect(getCategoriasParaEntidad("", CATEGORIAS_AVANZADAS)).toEqual([]);
  });
});

describe("mergeCatalogos", () => {
  it("unions estrategias, equipo and dependencias without duplicates", () => {
    const remote = {
      estrategias: ["Nueva Estrategia", "En Un 2x3"],
      equipo: ["Nuevo Miembro"],
      dependencias: ["Otra entidad"],
      categorias: {},
    };
    const merged = mergeCatalogos(remote, CATALOGO_AVANZADAS_FALLBACK);
    expect(merged.estrategias).toContain("Nueva Estrategia");
    expect(merged.estrategias).toContain("En Un 2x3");
    // No duplicates
    expect(merged.estrategias.filter((e) => e === "En Un 2x3")).toHaveLength(1);
    expect(merged.equipo).toContain("Nuevo Miembro");
    expect(merged.dependencias).toContain("Otra entidad");
  });

  it("merges categorias per-key, unioning arrays without duplicates", () => {
    const remote = {
      estrategias: [],
      equipo: [],
      dependencias: [],
      categorias: {
        DAGMA: ["Nueva categoría DAGMA", "Poda de árboles (autorización)"],
        "Entidad Nueva": ["Categoria X"],
      },
    };
    const merged = mergeCatalogos(remote, CATALOGO_AVANZADAS_FALLBACK);
    expect(merged.categorias.DAGMA).toContain("Nueva categoría DAGMA");
    expect(merged.categorias.DAGMA).toContain("Poda de árboles (autorización)");
    expect(
      merged.categorias.DAGMA.filter((c) => c === "Poda de árboles (autorización)")
    ).toHaveLength(1);
    expect(merged.categorias["Entidad Nueva"]).toEqual(["Categoria X"]);
    // Untouched keys from fallback survive
    expect(merged.categorias.UAESP).toEqual(CATEGORIAS_AVANZADAS.UAESP);
  });

  it("handles an empty remote catalog by falling back entirely to local data", () => {
    const remote = { estrategias: [], equipo: [], dependencias: [], categorias: {} };
    const merged = mergeCatalogos(remote, CATALOGO_AVANZADAS_FALLBACK);
    expect(merged.estrategias).toEqual(ESTRATEGIAS_AVANZADAS);
    expect(merged.categorias).toEqual(CATEGORIAS_AVANZADAS);
  });
});
