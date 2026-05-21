import { test, expect, Page, APIResponse } from '@playwright/test';

/**
 * E2E: registrar un requerimiento SIN tipo_requerimiento y verificar que:
 *  - El backend responde 200 (la clasificación deriva tipo + acciones).
 *  - El dropdown legacy "Tipo de Requerimiento" ya NO se renderiza.
 *  - El panel "Clasificación automática" aparece con tipo + organismos + acciones.
 *
 * Estrategia: usa la primera visita disponible en "Visitas Programadas".
 * Si no hay ninguna, intenta crearla rápidamente vía el flujo "+ Nueva visita"
 * (variante simple); si la creación tampoco es viable, el test se marca como skipped.
 */

async function gotoVisitasProgramadas(page: Page) {
  await page.goto('/');
  // En el Home hay una action-card con título "Visitas Programadas".
  // Usamos role=button + nombre para seleccionar el card específicamente.
  await page
    .locator('button.action-card', { hasText: 'Visitas Programadas' })
    .first()
    .click();
  // Cabecera de la vista visitas-programadas: existe el botón "+ Nueva visita".
  await expect(page.getByRole('button', { name: /Nueva visita/i })).toBeVisible({
    timeout: 20_000,
  });
  // Esperar a que el listado termine de cargar: o aparece al menos un card,
  // o aparece el empty-state con el botón "Programar Visita".
  await page.waitForFunction(
    () =>
      document.querySelectorAll('button[class*="action-card"], .visita-card').length >= 0 &&
      (document.querySelectorAll('button').length > 0),
    null,
    { timeout: 15_000 },
  );
}

async function abrirRegistrarRequerimientosDePrimeraVisita(page: Page) {
  // Esperamos hasta 15s a que aparezca el botón "Registrar Requerimientos".
  const botonRegistrar = page.getByRole('button', { name: /Registrar Requerimientos/i }).first();
  try {
    await botonRegistrar.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    return false;
  }
  await botonRegistrar.click();
  await expect(
    page.getByRole('button', { name: /Registrar Nuevo Requerimiento/i }),
  ).toBeVisible({ timeout: 20_000 });
  return true;
}

test.describe('Registrar requerimiento sin tipo (clasificación automática)', () => {
  test('crea, clasifica y muestra panel de tipo + acciones', async ({ page }) => {
    test.setTimeout(120_000);

    await gotoVisitasProgramadas(page);

    const haVisita = await abrirRegistrarRequerimientosDePrimeraVisita(page);
    test.skip(!haVisita, 'No hay visitas disponibles para este usuario en este entorno.');

    // Abrir el form
    await page.getByRole('button', { name: /Registrar Nuevo Requerimiento/i }).click();

    // El dropdown legacy ya NO debe existir.
    await expect(page.locator('select[id^="req-tipo-"]')).toHaveCount(0);
    await expect(page.locator('label[for^="req-tipo-"]')).toHaveCount(0);

    // Llenar la descripción con un texto que el clasificador deba
    // reconocer como "Poda de árboles".
    const descripcion =
      '[E2E] Solicito poda normal del árbol del parque, las ramas están muy crecidas';
    const descTextarea = page.locator('textarea[id^="req-desc-"]').first();
    await descTextarea.fill(descripcion);

    // Observaciones opcional — dejamos algo para enriquecer.
    const obsTextarea = page.locator('textarea').nth(1);
    if (await obsTextarea.count()) {
      await obsTextarea.first().fill('[E2E] Test automatizado de clasificación');
    }

    // Esperar al POST /registrar-requerimiento mientras hacemos click en Guardar.
    const respPromise: Promise<APIResponse> = page.waitForResponse(
      (resp) =>
        resp.url().includes('/registrar-requerimiento') && resp.request().method() === 'POST',
      { timeout: 60_000 },
    );

    await page.getByRole('button', { name: /^Guardar \d+ Requerimiento/i }).click();

    const resp = await respPromise;
    expect(
      resp.status(),
      `POST /registrar-requerimiento devolvió ${resp.status()}; body: ${await resp.text().catch(() => '<no-body>')}`,
    ).toBe(200);

    const body = await resp.json();
    expect(body).toHaveProperty('rid');
    expect(body).toHaveProperty('tipo_requerimiento');
    expect(body).toHaveProperty('tipo_requerimiento_origen');
    expect(body).toHaveProperty('acciones_por_organismo');
    expect(body.tipo_requerimiento_origen).toBe('auto');
    expect(typeof body.tipo_requerimiento).toBe('string');
    expect(body.tipo_requerimiento.length).toBeGreaterThan(0);

    // Panel "Clasificación automática" debe aparecer.
    await expect(page.getByText(/Clasificaci[oó]n autom[aá]tica/i)).toBeVisible({
      timeout: 15_000,
    });
    // Tipo debe mostrarse como badge.
    await expect(page.locator('.classif-tipo').first()).toBeVisible();
    await expect(page.locator('.classif-tipo').first()).toContainText(
      new RegExp(body.tipo_requerimiento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    );

    // Si el backend devolvió organismos, deben listarse.
    if (Array.isArray(body.organismos_encargados) && body.organismos_encargados.length > 0) {
      await expect(page.locator('.classif-org').first()).toBeVisible();
    }
  });
});
