import { test, expect, Page, APIResponse } from '@playwright/test';

/**
 * E2E: registrar un requerimiento usando CasoRequerimientoSelector y verificar que:
 *  - El selector multi-select (dropdown con searchbar) funciona correctamente.
 *  - El dropdown legacy "Tipo de Requerimiento" ya NO se renderiza.
 *  - El backend responde 200 (con tipo + organismos_encargados).
 *  - El panel "Clasificación automática" aparece con tipo + organismos + acciones.
 *
 * Estrategia: usa la primera visita disponible en "Visitas Programadas".
 * Si no hay ninguna, el test se marca como skipped.
 */

async function gotoVisitasProgramadas(page: Page) {
  await page.goto('/');
  await page
    .locator('button.action-card', { hasText: 'Visitas Programadas' })
    .first()
    .click();
  await expect(page.getByRole('button', { name: /Nueva visita/i })).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForFunction(
    () =>
      document.querySelectorAll('button[class*="action-card"], .visita-card').length >= 0 &&
      (document.querySelectorAll('button').length > 0),
    null,
    { timeout: 15_000 },
  );
}

async function abrirRegistrarRequerimientosDePrimeraVisita(page: Page) {
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

/**
 * Interacts with CasoRequerimientoSelector to pick a case via the searchable dropdown.
 * @param searchTerm  Text to type in the searchbar (filters the list).
 * @param caseLabel   Partial text of the list-item label to click.
 */
async function seleccionarCasoRequerimiento(page: Page, searchTerm: string, caseLabel: string) {
  // Open the dropdown by clicking the .control combobox trigger.
  const control = page.locator('.caso-selector .control').first();
  await control.click();

  // Wait for the search input to appear inside the dropdown panel.
  const searchInput = page.locator('.caso-selector .search-input').first();
  await searchInput.waitFor({ state: 'visible', timeout: 5_000 });

  // Type in the search term to filter.
  await searchInput.fill(searchTerm);

  // Click the matching list-item.
  const listItem = page
    .locator('.caso-selector .list-item', { hasText: caseLabel })
    .first();
  await listItem.waitFor({ state: 'visible', timeout: 5_000 });
  await listItem.click();

  // Close the dropdown via "Listo" button.
  const doneBtn = page.locator('.caso-selector .done-btn').first();
  await doneBtn.click();

  // Confirm a tag appears in the control.
  await expect(page.locator('.caso-selector .tag').first()).toBeVisible({ timeout: 3_000 });
}

test.describe('Registrar requerimiento con CasoRequerimientoSelector', () => {
  test('selecciona caso, envía al backend y muestra panel de clasificación', async ({ page }) => {
    test.setTimeout(120_000);

    await gotoVisitasProgramadas(page);

    const haVisita = await abrirRegistrarRequerimientosDePrimeraVisita(page);
    test.skip(!haVisita, 'No hay visitas disponibles para este usuario en este entorno.');

    // Abrir el form
    await page.getByRole('button', { name: /Registrar Nuevo Requerimiento/i }).click();

    // El dropdown legacy ya NO debe existir.
    await expect(page.locator('select[id^="req-tipo-"]')).toHaveCount(0);
    await expect(page.locator('label[for^="req-tipo-"]')).toHaveCount(0);

    // El textarea libre de descripción ya NO debe existir.
    await expect(page.locator('textarea[id^="req-desc-"]')).toHaveCount(0);

    // CasoRequerimientoSelector debe estar presente.
    await expect(page.locator('.caso-selector')).toBeVisible({ timeout: 10_000 });

    // Seleccionar un caso del catálogo usando el dropdown con searchbar.
    await seleccionarCasoRequerimiento(page, 'poda', 'Poda normal');

    // Los organismos del caso seleccionado deben aparecer debajo del dropdown.
    await expect(page.locator('.organismos-section')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.org-row').first()).toBeVisible();

    // Observaciones opcional.
    const obsTextarea = page.locator('textarea').first();
    if (await obsTextarea.count()) {
      await obsTextarea.fill('[E2E] Test automatizado — CasoRequerimientoSelector');
    }

    // Descartar el chip flotante de instalación PWA si está visible.
    const pwaChip = page.locator('button[aria-label="Instalar app"]');
    if (await pwaChip.isVisible({ timeout: 1000 }).catch(() => false)) {
      const closeBtn = page.locator('.pwa-chip__close');
      if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeBtn.click();
      }
    }

    // Esperar al POST /registrar-requerimiento mientras hacemos click en Guardar.
    const respPromise: Promise<APIResponse> = page.waitForResponse(
      (resp) =>
        resp.url().includes('/registrar-requerimiento') && resp.request().method() === 'POST',
      { timeout: 60_000 },
    );

    await page.getByRole('button', { name: /^Guardar \d+ Requerimiento/i }).click({ force: true });

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
