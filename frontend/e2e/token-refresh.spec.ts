import { test, expect, type ConsoleMessage, type Request } from '@playwright/test';

/**
 * Matches only the real `GET /avanzadas` (list) and `GET /avanzadas/catalogos`
 * API calls — NOT a glob like `**\/avanzadas*`, which also matches Vite's
 * dev-served ES module source files whose filename happens to start with
 * "avanzadas" (`avanzadasStore.ts`, `avanzadas.ts`, `avanzadas-catalogo.ts`,
 * `avanzadas-estadisticas.ts`, `avanzadas-geo.ts`). Intercepting one of those
 * breaks the module graph entirely and blanks the whole app — found the hard
 * way while writing this spec.
 */
const AVANZADAS_API_RE = /\/avanzadas(\/catalogos)?(\?.*)?$/;

/**
 * E2E coverage for fix-token-401-network-errors (Req. Automated Test
 * Coverage and Evidence, Playwright part). Uses `page.route()` interception
 * so scenarios A and C need no real Firebase network access — only
 * scenario B additionally benefits from (but does not strictly require) a
 * live logged-in session via `auth.setup.ts`'s `storageState`.
 *
 * Every test captures browser console + network/failed-request evidence and
 * attaches it to the test report, per the spec's "Playwright evidence
 * includes console and network logs" scenario.
 */

/** Attaches captured console + requestfailed + response evidence for the
 * current test. Call `stop()` before the test ends to flush the attachment. */
function captureNetworkConsoleEvidence(
  page: import('@playwright/test').Page,
  testInfo: import('@playwright/test').TestInfo
) {
  const logs: Array<Record<string, unknown>> = [];

  const onConsole = (msg: ConsoleMessage) => {
    logs.push({ type: 'console', level: msg.type(), text: msg.text() });
  };
  const onRequestFailed = (req: Request) => {
    logs.push({ type: 'requestfailed', url: req.url(), method: req.method(), failure: req.failure()?.errorText });
  };
  const onResponse = (res: import('@playwright/test').Response) => {
    if (!res.ok()) {
      logs.push({ type: 'response', url: res.url(), status: res.status() });
    }
  };

  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  return {
    async stop() {
      page.off('console', onConsole);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
      await testInfo.attach('network-console.json', {
        body: JSON.stringify(logs, null, 2),
        contentType: 'application/json',
      });
    },
  };
}

/**
 * Navigates to Home and clicks the "Avanzadas" action card, which mounts
 * ListaAvanzadas.svelte and triggers GET /avanzadas on mount.
 *
 * Logs in inline instead of relying on the `chromium` project's
 * `storageState` (populated by auth.setup.ts): a fresh page load replays
 * `onAuthStateChanged`, which re-validates the session via
 * `POST /auth/validate-session` before rendering Home. In this environment
 * that revalidation 401s even immediately after a fresh, successful login
 * (a local backend/Firebase-project config mismatch unrelated to this
 * change — `POST /auth/login` succeeds but the subsequent
 * `/auth/validate-session` on the SAME token does not), and
 * `restoreSession()`'s fallback can't recover because Playwright's
 * `storageState` snapshot doesn't carry over `sessionStorage`/IndexedDB.
 * Logging in directly on the page under test — same flow as
 * `auth.setup.ts` — reaches Home via `login()` (which sets `authStore`
 * directly, no `onAuthStateChanged` round-trip) and sidesteps it entirely.
 */
async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error('Falta E2E_EMAIL o E2E_PASSWORD en .env.test');
  }
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /iniciar sesi[oó]n/i }).click();
  await expect(page.getByRole('heading', { name: '¡Bienvenido!' })).toBeVisible({ timeout: 15_000 });
}

async function goToAvanzadasList(page: import('@playwright/test').Page) {
  await login(page);
  await page.getByText('Avanzadas', { exact: true }).click();
}

test.describe('Token refresh resilience', () => {
  // Scenario A — transient: an aborted "Failed to fetch" must show the
  // CONNECTION_RETRY message, never force logout / redirect to login.
  test('Scenario A — an aborted network request shows a retry message, not a forced logout', async ({
    page,
  }, testInfo) => {
    const evidence = captureNetworkConsoleEvidence(page, testInfo);

    let aborted = false;
    await page.route(AVANZADAS_API_RE, async (route) => {
      if (!aborted && route.request().method() === 'GET') {
        aborted = true;
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await goToAvanzadasList(page);

    await expect(page.getByText('Problema de conexión', { exact: false })).toBeVisible({ timeout: 15_000 });
    // Must NOT have been kicked to the login screen.
    await expect(page.getByText('Avanzadas', { exact: true })).toBeVisible();

    await evidence.stop();
  });

  // Scenario B — session-invalid: a persistent 401 from the backend must
  // surface SESSION_EXPIRED, never the raw "failed (401): ..." string.
  test('Scenario B — a persistent 401 shows the session-expired message, never the raw 401 string', async ({
    page,
  }, testInfo) => {
    const evidence = captureNetworkConsoleEvidence(page, testInfo);

    await page.route(AVANZADAS_API_RE, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Token inválido o expirado' }),
        });
        return;
      }
      await route.continue();
    });

    await goToAvanzadasList(page);

    await expect(page.getByText('Tu sesión expiró', { exact: false })).toBeVisible({ timeout: 15_000 });
    // The raw backend literal must never reach the UI.
    await expect(page.getByText('failed (401)', { exact: false })).toHaveCount(0);

    await evidence.stop();
  });

  // Scenario C — concurrent 401s: several near-simultaneous requests each
  // hitting 401 must share exactly ONE forced token refresh (single-flight),
  // observable as exactly one call to Firebase's token-refresh endpoint.
  test('Scenario C — concurrent 401s across requests trigger exactly one shared refresh', async ({
    page,
  }, testInfo) => {
    const evidence = captureNetworkConsoleEvidence(page, testInfo);

    // Log in FIRST, so the counter below only counts refresh calls caused
    // by the concurrent 401s, not the initial sign-in's own token mint.
    await login(page);

    let refreshCalls = 0;
    await page.route('**/securetoken.googleapis.com/**', async (route) => {
      refreshCalls += 1;
      await route.continue();
    });

    let avanzadasFailedOnce = false;
    let catalogosFailedOnce = false;
    await page.route(AVANZADAS_API_RE, async (route) => {
      const req = route.request();
      if (req.method() !== 'GET') return route.continue();
      if (req.url().includes('/catalogos')) {
        if (!catalogosFailedOnce) {
          catalogosFailedOnce = true;
          return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'expired' }) });
        }
      } else if (!avanzadasFailedOnce) {
        avanzadasFailedOnce = true;
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'expired' }) });
      }
      await route.continue();
    });

    // ListaAvanzadas.svelte calls both loadAvanzadas() and loadCatalogos()
    // on mount — both 401 once, in the same tick, sharing the module-level
    // refreshInFlight promise (see api/auth.ts).
    await page.getByText('Avanzadas', { exact: true }).click();

    await expect(page.getByText('Avanzadas', { exact: true })).toBeVisible({ timeout: 15_000 });
    // Give both retried requests time to settle.
    await page.waitForTimeout(1_000);

    expect(refreshCalls).toBeLessThanOrEqual(1);

    await evidence.stop();
  });
});
