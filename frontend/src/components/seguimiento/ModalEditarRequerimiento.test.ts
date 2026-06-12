import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const componentSource = readFileSync(
  resolve(__dirname, "ModalEditarRequerimiento.svelte"),
  "utf-8"
);

describe("ModalEditarRequerimiento Svelte Component", () => {
  it("imports Modal Svelte component", () => {
    expect(componentSource).toMatch(
      /import Modal from ["']\.\.\/ui\/Modal\.svelte["']/
    );
  });

  it("exports show and req as props", () => {
    expect(componentSource).toContain("export let show");
    expect(componentSource).toContain("export let req");
  });

  it("defines reactive block that calls initForm when show or req changes", () => {
    expect(componentSource).toMatch(/\$:\s*if\s*\(show\s*&&\s*req\)/);
    expect(componentSource).toContain("initForm()");
  });

  it("defines initForm method to initialize input fields", () => {
    expect(componentSource).toContain("function initForm()");
    expect(componentSource).toContain("solNombre = req.solicitante?.nombre_completo");
    expect(componentSource).toContain("descripcion = req.descripcion");
  });

  it("defines handleSave method that calls store's editarRequerimiento", () => {
    expect(componentSource).toContain("async function handleSave()");
    expect(componentSource).toContain("seguimientoStore.editarRequerimiento(");
  });

  it("implements media delete functionality by marking S3 keys", () => {
    expect(componentSource).toContain("function removeExistingPhoto(");
    expect(componentSource).toContain("s3KeysToDelete =");
  });

  it("binds input fields to Svelte state variables", () => {
    expect(componentSource).toContain("bind:value={solNombre}");
    expect(componentSource).toContain("bind:value={solTelefono}");
    expect(componentSource).toContain("bind:value={solEmail}");
    expect(componentSource).toContain("bind:value={descripcion}");
    expect(componentSource).toContain("bind:value={observaciones}");
    expect(componentSource).toContain("bind:value={direccion}");
  });
});
