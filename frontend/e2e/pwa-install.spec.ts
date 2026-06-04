import { test, expect } from '@playwright/test';

/**
 * PWA install readiness suite.
 * - Validates manifest, icons and Apple meta tags are served and well-formed.
 * - Validates the install banner is present on iOS Safari (which lacks
 *   `beforeinstallprompt`) and triggers the "Add to Home Screen" guide.
 *
 * NOTE: vite-plugin-pwa only emits the manifest + sw in `vite build`. Run
 * `npm run build && npm run preview -- --port 4173` and set
 * E2E_BASE_URL=http://localhost:4173 to exercise the full PWA surface.
 */

test.describe('PWA — manifest and icons', () => {
  test('apple-touch-icon links are present in document head', async ({ page }) => {
    await page.goto('/');
    const sizes = await page.locator('link[rel="apple-touch-icon"]').evaluateAll(
      (els) => els.map((e) => (e as HTMLLinkElement).sizes?.value || '')
    );
    expect(sizes).toEqual(expect.arrayContaining(['180x180', '167x167', '152x152']));
  });

  test('apple-mobile-web-app meta tags configured', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute(
      'content',
      'black-translucent'
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'GobOps');
  });

  test('viewport meta supports viewport-fit=cover (iOS notch)', async ({ page }) => {
    await page.goto('/');
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).toContain('viewport-fit=cover');
  });

  test.skip(({ baseURL }) => !baseURL?.includes(':4173'), 'manifest.webmanifest only on preview build');
  test('manifest is reachable, parseable and includes 192/512 icons', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/manifest.webmanifest`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.name).toBeTruthy();
    expect(json.start_url).toBeTruthy();
    expect(json.display).toBe('standalone');
    const sizes = (json.icons as Array<{ sizes: string }>).map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });
});

test.describe('PWA — install UI (iOS path)', () => {
  test('install chip is rendered on iOS Safari when not standalone', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'iOS path only runs on WebKit');
    await page.goto('/');
    // Banner may be hidden if dismissal cookie exists; clear first.
    await page.evaluate(() => localStorage.removeItem('pwa_install_dismissed_at'));
    await page.reload();
    await expect(page.getByRole('button', { name: /instalar aplicación|instalar app/i })).toBeVisible({ timeout: 5000 });
  });

  test('clicking install on iOS opens the Add-to-Home guide', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'iOS guide only on WebKit');
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('pwa_install_dismissed_at'));
    await page.reload();
    const btn = page.getByRole('button', { name: /instalar app/i });
    await btn.click();
    await expect(page.getByRole('dialog', { name: /instalar gobops/i })).toBeVisible();
    await expect(page.getByText(/añadir a pantalla de inicio/i)).toBeVisible();
  });
});
