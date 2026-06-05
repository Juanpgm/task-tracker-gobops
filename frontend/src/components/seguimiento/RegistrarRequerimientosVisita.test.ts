/**

 * Tests for RegistrarRequerimientosVisita.svelte

 *

 * Validates:

 * 1. CasoRequerimientoSelector replaces the old <select>+textarea for tipo/descripcion

 * 2. LocationPicker is used per-req draft (lat/lng captured via map)

 * 3. Form structure and API payload are correct

 * 4. organismos_encargados is sent from the selector (not omitted)

 */

import { describe, it, expect } from "vitest";

import { readFileSync } from "fs";

import { resolve } from "path";



const componentSource = readFileSync(

  resolve(__dirname, "RegistrarRequerimientosVisita.svelte"),

  "utf-8",

);



const selectorSource = readFileSync(

  resolve(__dirname, "../visitas/CasoRequerimientoSelector.svelte"),

  "utf-8",

);



const catalogSource = readFileSync(

  resolve(__dirname, "../../data/requerimientos-catalogo.ts"),

  "utf-8",

);



/* ============================================================

 *  1. CASO REQUERIMIENTO SELECTOR �?? integración

 * ============================================================ */

describe("CasoRequerimientoSelector integration", () => {

  it("imports CasoRequerimientoSelector", () => {

    expect(componentSource).toMatch(

      /import CasoRequerimientoSelector from ["']\.\.\/visitas\/CasoRequerimientoSelector\.svelte["']/,

    );

  });



  it("renders CasoRequerimientoSelector in the template", () => {

    expect(componentSource).toMatch(/<CasoRequerimientoSelector/);

  });



  it("binds requerimiento to req.descripcion", () => {

    expect(componentSource).toMatch(/bind:requerimiento=\{req\.descripcion\}/);

  });



  it("binds organismosJson to req.organismos_json", () => {

    expect(componentSource).toMatch(/bind:organismosJson=\{req\.organismos_json\}/);

  });



  it("does NOT have a legacy <select> for tipo_requerimiento in the template", () => {

    expect(componentSource).not.toMatch(

      /<select[\s\S]*?bind:value=\{req\.tipo_requerimiento\}/,

    );

  });



  it("does NOT have a raw <textarea> bound to req.descripcion", () => {

    // The description is now managed by CasoRequerimientoSelector, not a bare textarea

    const lines = componentSource.split("\n").filter(

      (l) => l.includes("<textarea") && l.includes("req.descripcion"),

    );

    expect(lines).toHaveLength(0);

  });

});



/* ============================================================

 *  2. LOCATION PICKER (per-req, map-based)

 * ============================================================ */

describe("LocationPicker per-req", () => {

  it("imports LocationPicker", () => {

    expect(componentSource).toMatch(

      /import LocationPicker from ["']\.\.\/shared\/LocationPicker\.svelte["']/,

    );

  });



  it("binds latitud/longitud/direccion from req draft to LocationPicker", () => {

    expect(componentSource).toMatch(/bind:latitud=\{req\.latitud\}/);

    expect(componentSource).toMatch(/bind:longitud=\{req\.longitud\}/);

    expect(componentSource).toMatch(/bind:direccion=\{req\.direccion\}/);

  });



  it("builds GeoJSON Point coords from req.latitud / req.longitud", () => {

    expect(componentSource).toMatch(/type:\s*["']Point["']/);

    expect(componentSource).toContain("coordinates");

    expect(componentSource).toMatch(/parseFloat\(req\.latitud\)/);

    expect(componentSource).toMatch(/parseFloat\(req\.longitud\)/);

  });



  it("does NOT have a standalone capturarGPS function", () => {

    expect(componentSource).not.toMatch(/async function capturarGPS/);

  });

});



/* ============================================================

 *  3. FORM VALIDATION

 * ============================================================ */

describe("Form validation", () => {

  it("validates that req.descripcion is non-empty before submitting", () => {

    expect(componentSource).toMatch(/req\.descripcion.*trim\(\)/);

  });



  it("validates that lat/lng are present before submitting", () => {

    expect(componentSource).toMatch(/req\.latitud/);

    expect(componentSource).toMatch(/req\.longitud/);

  });



  it("does NOT validate solicitante name as required", () => {

    expect(componentSource).not.toContain("El nombre del solicitante es obligatorio");

    expect(componentSource).not.toContain("Si registra solicitante, el nombre completo es obligatorio");

  });



  it("does NOT validate centros_gestores (asignación via selector)", () => {

    expect(componentSource).not.toContain("Seleccione al menos un centro gestor");

  });

});



/* ============================================================

 *  4. REQDRAFT INTERFACE

 * ============================================================ */

describe("ReqDraft interface", () => {

  it("includes descripcion, organismos_json, observaciones, nota_voz, evidencias", () => {

    const ifaceMatch = componentSource.match(

      /interface ReqDraft\s*\{[\s\S]*?\}/,

    );

    expect(ifaceMatch).not.toBeNull();

    const ifaceBody = ifaceMatch![0];



    expect(ifaceBody).toContain("descripcion");

    expect(ifaceBody).toContain("organismos_json");

    expect(ifaceBody).toContain("observaciones");

    expect(ifaceBody).toContain("nota_voz");

    expect(ifaceBody).toContain("evidencias");

    expect(ifaceBody).toContain("latitud");

    expect(ifaceBody).toContain("longitud");

  });



  it("does NOT include centros_gestores or tipo_requerimiento in ReqDraft", () => {

    const ifaceMatch = componentSource.match(

      /interface ReqDraft\s*\{[\s\S]*?\}/,

    );

    const ifaceBody = ifaceMatch![0];

    expect(ifaceBody).not.toContain("centros_gestores");

    expect(ifaceBody).not.toContain("tipo_requerimiento");

  });

});



/* ============================================================

 *  5. API PAYLOAD STRUCTURE

 * ============================================================ */

describe("API payload structure", () => {

  it("sends vid from the current visita", () => {

    expect(componentSource).toMatch(/vid:\s*visita.*\.id/);

  });



  it("includes registrado_por in datos_solicitante from authStore session", () => {

    expect(componentSource).toContain("registrado_por");

    expect(componentSource).toContain("registradoPor");

    expect(componentSource).toContain("authStore");

  });



  it("sends datos_solicitante as JSON string with personas array", () => {

    expect(componentSource).toContain("JSON.stringify");

    expect(componentSource).toContain("personas");

  });



  it("sends organismos_encargados from req.organismos_json (selector output)", () => {

    expect(componentSource).toMatch(

      /organismos_encargados:\s*req\.organismos_json/,

    );

  });



  it("sends nota_voz from the draft", () => {

    expect(componentSource).toMatch(/nota_voz:\s*req\.nota_voz/);

  });



  it("sends evidencias from the draft", () => {

    expect(componentSource).toMatch(/evidencias:\s*req\.evidencias/);

  });

});



/* ============================================================

 *  6. CATÁLOGO DE CASOS �?? integridad del data file

 * ============================================================ */

describe("Catálogo de casos �?? data integrity", () => {

  it("exports CATALOGO_CASOS array", () => {

    expect(catalogSource).toContain("export const CATALOGO_CASOS");

  });



  it("exports CATEGORIAS_CASOS array", () => {

    expect(catalogSource).toContain("export const CATEGORIAS_CASOS");

  });



  it("contains all expected top-level categories", () => {

    const expectedCats = [

      "Árboles",

      "Arbustos",

      "Siembra indiscriminada",

      "Recolección de basuras",

      "Limpieza pública",

      "Alumbrado público",

      "Acueducto y alcantarillado",

      "Habitante de calle",

      "Invasión espacio público",

      "Ruido",

      "Movilidad",

      "Otros",

    ];

    for (const cat of expectedCats) {

      expect(catalogSource, `Missing category: ${cat}`).toContain(cat);

    }

  });



  it("contains key organismos: DAGMA, UAESP, EMCALI, SSJ, Secretaría de Movilidad", () => {

    for (const org of ["DAGMA", "UAESP", "EMCALI", "SSJ", "Secretaría de Movilidad"]) {

      expect(catalogSource, `Missing organismo: ${org}`).toContain(org);

    }

  });



  it("each caso has id, label, categoria, subcategoria, organismos", () => {

    expect(catalogSource).toMatch(/id:\s*["']/);

    expect(catalogSource).toMatch(/label:\s*["']/);

    expect(catalogSource).toMatch(/categoria:\s*["']/);

    expect(catalogSource).toMatch(/subcategoria:\s*["']/);

    expect(catalogSource).toContain("organismos:");

  });



  it("each organismo entry has organismo + accion fields", () => {

    expect(catalogSource).toMatch(/organismo:\s*["']/);

    expect(catalogSource).toMatch(/accion:\s*["']/);

  });

});



/* ============================================================

 *  7. CASO REQUERIMIENTO SELECTOR �?? estructura del componente

 * ============================================================ */

describe("CasoRequerimientoSelector �?? component structure", () => {

  it("exports requerimiento and organismosJson as bindeable props", () => {

    expect(selectorSource).toMatch(/export let requerimiento/);

    expect(selectorSource).toMatch(/export let organismosJson/);

  });



  it("has a search input inside the dropdown panel", () => {

    expect(selectorSource).toMatch(/bind:value=\{query\}/);

    expect(selectorSource).toContain("search-input");

  });



  it("renders items as multi-select (role=listbox + aria-multiselectable)", () => {

    expect(selectorSource).toMatch(/role="listbox"/);

    expect(selectorSource).toMatch(/aria-multiselectable="true"/);

  });



  it("has 'Otro' option with a free-text input", () => {

    expect(selectorSource).toContain("otroSelected");

    expect(selectorSource).toContain("otroTexto");

    expect(selectorSource).toMatch(/bind:value=\{otroTexto\}/);

  });



  it("computes requerimiento as ';'-joined labels of selected casos", () => {

    expect(selectorSource).toContain('join("; ")');

  });



  it("builds organismosJson as JSON array of {organismo, caso, accion}", () => {

    expect(selectorSource).toMatch(/organismo:.*org\.organismo/);

    expect(selectorSource).toMatch(/caso:.*caso\.label/);

    expect(selectorSource).toMatch(/accion:.*org\.accion/);

    expect(selectorSource).toMatch(/JSON\.stringify\(orgs\)/);

  });



  it("closes dropdown on click outside via onDestroy listener cleanup", () => {

    expect(selectorSource).toContain("onDestroy");

    expect(selectorSource).toContain("removeEventListener");

  });



  it("closes dropdown on Escape key", () => {

    expect(selectorSource).toContain("Escape");

    expect(selectorSource).toContain("closeDropdown");

  });



  it("filters cases reactively based on query", () => {

    expect(selectorSource).toMatch(/\$:\s*filtered/);

    expect(selectorSource).toMatch(/\.toLowerCase\(\)\.includes\(/);

  });



  it("pre-selects all organismos of a caso on selection", () => {

    // When toggleCaso adds a case, all its organismos are set to true

    expect(selectorSource).toMatch(/organismoSelections\[.*\]\s*=\s*true/);

  });



  it("has a 'Listo' done button in the panel footer", () => {

    expect(selectorSource).toContain("done-btn");

    expect(selectorSource).toContain("Listo");

  });



  it("shows organismos section only when at least one caso is selected", () => {

    expect(selectorSource).toMatch(/selectedCasos\.length\s*>\s*0/);

    expect(selectorSource).toContain("organismos-section");

  });

});







/* ============================================================

 *  8. EVIDENCIAS (FOTOS / VIDEOS) UPLOAD

 * ============================================================ */

describe("Evidencias (fotos/videos) upload", () => {

  it("includes evidencias field in ReqDraft interface", () => {

    const ifaceMatch = componentSource.match(

      /interface ReqDraft\s*\{[\s\S]*?\}/,

    );

    expect(ifaceMatch).not.toBeNull();

    const ifaceBody = ifaceMatch![0];

    expect(ifaceBody).toContain("evidencias");

  });



  it("initializes evidencias as empty array in createEmptyReq", () => {

    const fnMatch = componentSource.match(

      /function createEmptyReq\(\)[\s\S]*?\n  \}/,

    );

    expect(fnMatch).not.toBeNull();

    expect(fnMatch![0]).toContain("evidencias: []");

  });



  it("has file inputs that accept image and video types", () => {

    expect(componentSource).toMatch(

      /accept="image\/\*"/,

    );

  });



  it("has a camera capture input with capture attribute", () => {

    expect(componentSource).toMatch(

      /capture="environment"/,

    );

  });



  it("has a gallery input with multiple attribute (no capture)", () => {

    // Find an input with accept="image/*,video/*" and multiple but without capture

    const galleryInputs = componentSource.match(

      /<input[^>]*accept="image\/\*,video\/\*"[^>]*multiple[^>]*>/g,

    );

    expect(galleryInputs).not.toBeNull();

    expect(galleryInputs!.length).toBeGreaterThanOrEqual(1);

  });



  it("has a handleEvidencias function", () => {

    expect(componentSource).toMatch(

      /function handleEvidencias\(reqIdx:\s*number/,

    );

  });



  it("has a removeEvidencia function", () => {

    expect(componentSource).toMatch(

      /function removeEvidencia\(reqIdx:\s*number/,

    );

  });



  it("defines MAX_EVIDENCIA_SIZE_MB constant", () => {

    expect(componentSource).toMatch(/MAX_EVIDENCIA_SIZE_MB\s*=\s*50/);

  });



  it("defines MAX_EVIDENCIAS_PER_REQ constant", () => {

    expect(componentSource).toMatch(/MAX_EVIDENCIAS_PER_REQ\s*=\s*10/);

  });



  it("validates file count does not exceed maximum", () => {

    expect(componentSource).toContain("Máximo");

    expect(componentSource).toContain("archivos permitidos");

  });



  it("validates individual file size does not exceed maximum", () => {

    expect(componentSource).toContain("excede");

    expect(componentSource).toMatch(/MAX_EVIDENCIA_SIZE_MB\s*\*\s*1024\s*\*\s*1024/);

  });



  it("shows preview grid when evidencias are present", () => {

    expect(componentSource).toContain("evidencias-grid");

    expect(componentSource).toContain("evidencia-thumb");

  });



  it("shows image preview for image files", () => {

    expect(componentSource).toMatch(/file\.type\.startsWith\("image\/"\)/);

  });



  it("shows video placeholder for non-image files", () => {

    expect(componentSource).toContain("evidencia-video-placeholder");

  });



  it("displays file size for each evidencia", () => {

    expect(componentSource).toContain("formatFileSize");

    expect(componentSource).toContain("evidencia-size");

  });

});

