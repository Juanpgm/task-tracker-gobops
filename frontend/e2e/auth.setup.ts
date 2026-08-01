import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.resolve(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error('Falta E2E_EMAIL o E2E_PASSWORD en .env.test');
  }

  await page.goto('/');

  // El formulario de login monta los Input con id="email" y id="password".
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /iniciar sesi[oó]n/i }).click();

  // Tras login se redirige al Home, que muestra el heading de bienvenida.
  // (Pre-existing bug found while unblocking e2e evidence for
  // fix-token-401-network-errors: Home.svelte's action cards were renamed
  // away from "Visitas Programadas" at some point but this locator was
  // never updated, silently failing setup for every e2e spec.)
  await expect(page.getByRole('heading', { name: '¡Bienvenido!' })).toBeVisible({
    timeout: 30_000,
  });

  await page.context().storageState({ path: AUTH_FILE });
});
