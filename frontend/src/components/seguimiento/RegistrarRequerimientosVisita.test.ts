/**
 * Tests for RegistrarRequerimientosVisita.svelte
 *
 * Validates:
 * 1. "Tipo de Requerimiento" is a <select> dropdown with the 13 categories
 * 2. GPS is NOT a manual button — it auto-captures on save
 * 3. Form structure and API payload are correct
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const componentSource = readFileSync(
  resolve(__dirname, "RegistrarRequerimientosVisita.svelte"),
  "utf-8",
);

/* ============================================================
 *  EXPECTED CATEGORIES
 * ============================================================ */
const EXPECTED_CATEGORIES = [
  "Poda de árboles",
  "Arbustos",
  "Emergencias arbóreas",
  "Siembra indiscriminada",
  "Recolección de residuos sólidos",
  "Barrido y limpieza de vías y espacio público",
  "Alumbrado público",
  "Acueducto y alcantarillado",
  "Habitantes de calle",
  "Invasión de espacio público",
  "Ruido",
  "Movilidad",
  "Otros",
];

/* ============================================================
 *  1. TIPO DE REQUERIMIENTO — DROPDOWN SELECT
 * ============================================================ */
describe("Tipo de Requerimiento dropdown", () => {
  it("uses a <select> element (not <input>) for tipo_requerimiento", () => {
    // Should have a <select> bound to tipo_requerimiento
    expect(componentSource).toMatch(
      /<select[\s\S]*?bind:value=\{req\.tipo_requerimiento\}/,
    );
    // Should NOT have an <input> with tipo_requerimiento on the same line
    const inputLines = componentSource.split("\n").filter(
      (line) => line.includes("<input") && line.includes("tipo_requerimiento"),
    );
    expect(inputLines).toHaveLength(0);
  });

  it("contains all 13 expected categories as <option> values", () => {
    for (const category of EXPECTED_CATEGORIES) {
      expect(
        componentSource,
        `Missing <option> for: ${category}`,
      ).toContain(`value="${category}"`);
    }
  });

  it("has a placeholder option with empty value", () => {
    expect(componentSource).toMatch(/<option value="">.*Seleccione/s);
  });

  it("has exactly 14 options (13 categories + 1 placeholder)", () => {
    // Extract the select block for tipo_requerimiento
    const selectMatch = componentSource.match(
      /<select[^>]*bind:value=\{req\.tipo_requerimiento\}[\s\S]*?<\/select>/,
    );
    expect(selectMatch).not.toBeNull();

    const selectBlock = selectMatch![0];
    const optionCount = (selectBlock.match(/<option\b/g) || []).length;
    expect(optionCount).toBe(14);
  });
});

/* ============================================================
 *  2. GPS AUTO-CAPTURE (no manual button)
 * ============================================================ */
describe("GPS auto-capture (no manual button)", () => {
  it("does NOT have a 'Capturar GPS' button in the template", () => {
    expect(componentSource).not.toMatch(/Capturar GPS/);
  });

  it("does NOT have latitude/longitude input fields in the form", () => {
    // Should not have readonly lat/lng inputs bound to req.latitud/req.longitud
    expect(componentSource).not.toMatch(
      /<input[\s\S]*?bind:value=\{req\.latitud\}/,
    );
    expect(componentSource).not.toMatch(
      /<input[\s\S]*?bind:value=\{req\.longitud\}/,
    );
  });

  it("does NOT have a capturingGPS state variable", () => {
    expect(componentSource).not.toMatch(/let capturingGPS/);
  });

  it("does NOT have a standalone capturarGPS function", () => {
    expect(componentSource).not.toMatch(
      /async function capturarGPS/,
    );
  });

  it("calls getCurrentPosition inside guardarRequerimientos", () => {
    // Extract the guardarRequerimientos function body
    const fnMatch = componentSource.match(
      /async function guardarRequerimientos\(\)[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];

    // Should call getCurrentPosition() within guardarRequerimientos
    expect(fnBody).toContain("getCurrentPosition()");
  });

  it("shows GPS error message when getCurrentPosition fails", () => {
    const fnMatch = componentSource.match(
      /async function guardarRequerimientos\(\)[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    const fnBody = fnMatch![0];

    // Should have a catch block that sets errorMsg about GPS
    expect(fnBody).toMatch(/No se pudo obtener la ubicación GPS/);
  });

  it("builds GeoJSON Point coords from auto-captured GPS", () => {
    // Look at the full source for GeoJSON Point construction
    // The code builds: { type: "Point", coordinates: [...] }
    expect(componentSource).toMatch(/type:\s*"Point"/);
    expect(componentSource).toContain("coordinates");
    // Should use the captured latitud/longitud (not from req object)
    expect(componentSource).toMatch(/parseFloat\(longitud\)/);
    expect(componentSource).toMatch(/parseFloat\(latitud\)/);
  });
});

/* ============================================================
 *  3. FORM VALIDATION
 * ============================================================ */
describe("Form validation", () => {
  it("validates solicitante name is required", () => {
    expect(componentSource).toContain(
      'El nombre del solicitante es obligatorio',
    );
  });

  it("validates tipo_requerimiento is required", () => {
    expect(componentSource).toContain(
      "El tipo de requerimiento es obligatorio",
    );
  });

  it("validates descripcion is required", () => {
    expect(componentSource).toContain("La descripción es obligatoria");
  });

  it("validates observaciones is required", () => {
    expect(componentSource).toContain(
      "Las observaciones son obligatorias",
    );
  });

  it("validates centros_gestores selection is required", () => {
    expect(componentSource).toContain(
      "Seleccione al menos un centro gestor",
    );
  });
});

/* ============================================================
 *  4. REQDRAFT INTERFACE
 * ============================================================ */
describe("ReqDraft interface", () => {
  it("does NOT include latitud/longitud fields", () => {
    // Extract interface block
    const ifaceMatch = componentSource.match(
      /interface ReqDraft\s*\{[\s\S]*?\}/,
    );
    expect(ifaceMatch).not.toBeNull();
    const ifaceBody = ifaceMatch![0];

    expect(ifaceBody).not.toContain("latitud");
    expect(ifaceBody).not.toContain("longitud");
  });

  it("includes expected fields: centros_gestores, tipo_requerimiento, descripcion, observaciones, nota_voz", () => {
    const ifaceMatch = componentSource.match(
      /interface ReqDraft\s*\{[\s\S]*?\}/,
    );
    const ifaceBody = ifaceMatch![0];

    expect(ifaceBody).toContain("centros_gestores");
    expect(ifaceBody).toContain("tipo_requerimiento");
    expect(ifaceBody).toContain("descripcion");
    expect(ifaceBody).toContain("observaciones");
    expect(ifaceBody).toContain("nota_voz");
  });
});

/* ============================================================
 *  5. API PAYLOAD STRUCTURE
 * ============================================================ */
describe("API payload structure", () => {
  it("sends vid from the current visita", () => {
    expect(componentSource).toMatch(/vid:\s*visita.*\.id/);
  });

  it("sends datos_solicitante as JSON string with personas array", () => {
    expect(componentSource).toContain("JSON.stringify");
    expect(componentSource).toContain("personas");
  });

  it("sends organismos_encargados from centros_gestores", () => {
    expect(componentSource).toMatch(
      /JSON\.stringify\(req\.centros_gestores\)/,
    );
  });

  it("sends nota_voz from the draft", () => {
    expect(componentSource).toMatch(/nota_voz:\s*req\.nota_voz/);
  });
});
