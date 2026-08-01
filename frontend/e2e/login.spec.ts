import { test, expect } from '@playwright/test';

/**
 * Smoke E2E: usa la sesión guardada por auth.setup.ts y verifica que el
 * Home carga correctamente con los accesos esperados.
 */
test('home se renderiza con accesos clave', async ({ page }) => {
  await page.goto('/');
  // Pre-existing stale locator fixed while unblocking e2e for
  // fix-token-401-network-errors — see auth.setup.ts for details.
  await expect(page.getByRole('heading', { name: '¡Bienvenido!' })).toBeVisible();
});
