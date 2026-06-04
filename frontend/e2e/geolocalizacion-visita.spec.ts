import { test, expect, Route } from '@playwright/test';

/**
 * E2E: botón "📍 Usar mi ubicación" en RegistrarVisita.
 *
 * Estrategia:
 * 1. Navega al Home (sesión guardada) → abre "Registrar Visita" (Programar Visita).
 * 2. Mockea `navigator.geolocation.getCurrentPosition` con coordenadas fijas
 *    del centro histórico de Cali (Plaza de Caycedo).
 * 3. Intercepta `POST /api/reverse-geocode` y devuelve respuesta fixture.
 * 4. Hace clic en "📍 Usar mi ubicación".
 * 5. Verifica que el campo dirección queda auto-completado y el geo-panel aparece.
 */

const LAT_CALI = 3.4516;
const LON_CALI = -76.532;

const GEOCODE_FIXTURE = {
  success: true,
  coordenada: { lat: LAT_CALI, lon: LON_CALI },
  dentro_de_cali: true,
  barrio_vereda: 'CENTRO',
  comuna_corregimiento: 'COMUNA 03',
  via: {
    tipo: 'Carrera',
    numero: '4',
    nombre: 'Carrera 4',
    nombre_catastral: 'KR 4',
    clase: null,
    distancia_m: 23.5,
  },
  cruce_mas_cercano: {
    nombre: 'KR 4 con CL 13',
    distancia_m: 18.2,
  },
  direccion_legible: 'Carrera 4 #13-45, barrio CENTRO, COMUNA 03, Cali, Valle del Cauca, Colombia',
  direccion_osm: null,
  osm: null,
  fuentes: ['catastro_cali'],
};

test.describe('Botón GPS en RegistrarVisita', () => {
  test.beforeEach(async ({ page }) => {
    // Interceptar /api/reverse-geocode antes de navegar
    await page.route('**/api/reverse-geocode', async (route: Route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(GEOCODE_FIXTURE),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('autorrellena dirección al hacer clic en Usar mi ubicación', async ({ page }) => {
    // Mockear geolocation ANTES de cargar la página
    await page.addInitScript(() => {
      const mockPos: GeolocationPosition = {
        coords: {
          latitude: 3.4516,
          longitude: -76.532,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON() { return {}; },
        },
        timestamp: Date.now(),
        toJSON() { return {}; },
      };

      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (
            success: PositionCallback,
            _error?: PositionErrorCallback,
            _options?: PositionOptions
          ) => {
            setTimeout(() => success(mockPos), 50);
          },
          watchPosition: () => 0,
          clearWatch: () => {},
        },
        configurable: true,
      });
    });

    await page.goto('/');

    // Navegar a Registrar Visita — busca el card en Home
    const cardVisita = page
      .locator('button.action-card', { hasText: /Registrar Visita|Programar Visita/i })
      .first();

    // Si el card no existe en el home, puede estar en "Visitas Programadas"
    const cardVisible = await cardVisita.isVisible().catch(() => false);
    if (!cardVisible) {
      // Intento alternativo: acceder a visitas programadas y crear nueva visita
      const btnVisitas = page
        .locator('button.action-card', { hasText: /Visitas Programadas/i })
        .first();
      await expect(btnVisitas).toBeVisible({ timeout: 15_000 });
      await btnVisitas.click();
      const btnNuevaVisita = page.getByRole('button', { name: /Nueva visita/i });
      await expect(btnNuevaVisita).toBeVisible({ timeout: 15_000 });
      await btnNuevaVisita.click();
    } else {
      await cardVisita.click();
    }

    // Esperar a que el formulario de registro se renderice
    const gpsBtn = page.getByRole('button', { name: /Usar mi ubicación/i });
    await expect(gpsBtn).toBeVisible({ timeout: 20_000 });

    // El botón no debe estar deshabilitado (requiere geolocation, que está mockeada)
    await expect(gpsBtn).not.toBeDisabled();

    // Clic en el botón GPS
    await gpsBtn.click();

    // Esperar que el estado "Localizando…" pase (timeout 10s)
    await expect(gpsBtn).not.toHaveText('Localizando…', { timeout: 10_000 });

    // El campo dirección debe rellenarse con la dirección del fixture
    const inputDireccion = page.locator('#direccion_visita, input[id="direccion_visita"]');
    await expect(inputDireccion).toHaveValue(GEOCODE_FIXTURE.direccion_legible, {
      timeout: 10_000,
    });

    // El geo-panel (barrio + comuna) debe ser visible
    await expect(page.getByText(/Barrio:/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('CENTRO')).toBeVisible();
    await expect(page.getByText('COMUNA 03')).toBeVisible();
  });

  test('muestra error si geolocation lanza error de permiso denegado', async ({ page }) => {
    // Mockear geolocation que falla con PERMISSION_DENIED
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (
            _success: PositionCallback,
            error?: PositionErrorCallback,
          ) => {
            setTimeout(() => {
              if (error) {
                error({
                  code: 1, // PERMISSION_DENIED
                  message: 'User denied Geolocation',
                  PERMISSION_DENIED: 1,
                  POSITION_UNAVAILABLE: 2,
                  TIMEOUT: 3,
                } as GeolocationPositionError);
              }
            }, 50);
          },
          watchPosition: () => 0,
          clearWatch: () => {},
        },
        configurable: true,
      });
    });

    await page.goto('/');

    const cardVisita = page
      .locator('button.action-card', { hasText: /Registrar Visita|Programar Visita/i })
      .first();

    const cardVisible = await cardVisita.isVisible().catch(() => false);
    if (!cardVisible) {
      const btnVisitas = page
        .locator('button.action-card', { hasText: /Visitas Programadas/i })
        .first();
      await expect(btnVisitas).toBeVisible({ timeout: 15_000 });
      await btnVisitas.click();
      const btnNuevaVisita = page.getByRole('button', { name: /Nueva visita/i });
      await expect(btnNuevaVisita).toBeVisible({ timeout: 15_000 });
      await btnNuevaVisita.click();
    } else {
      await cardVisita.click();
    }

    const gpsBtn = page.getByRole('button', { name: /Usar mi ubicación/i });
    await expect(gpsBtn).toBeVisible({ timeout: 20_000 });
    await gpsBtn.click();

    // Debe aparecer un mensaje de error de permisos
    await expect(
      page.getByText(/Permiso de ubicación denegado|denegado|permission/i),
    ).toBeVisible({ timeout: 10_000 });

    // El campo dirección NO debe haberse rellenado
    const inputDireccion = page.locator('#direccion_visita, input[id="direccion_visita"]');
    await expect(inputDireccion).toHaveValue('');
  });
});
