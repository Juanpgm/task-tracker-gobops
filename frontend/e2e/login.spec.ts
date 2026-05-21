import { test, expect } from '@playwright/test';

/**
 * Smoke E2E: usa la sesión guardada por auth.setup.ts y verifica que el
 * Home carga correctamente con los accesos esperados.
 */
test('home se renderiza con accesos clave', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Visitas Programadas', { exact: false })).toBeVisible();
});
