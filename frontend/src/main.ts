import App from './App.svelte';
import './app.css';
import 'leaflet/dist/leaflet.css';
import { pwaStore } from './stores/pwaStore';

const app = new App({
  target: document.getElementById('app')!,
});

// Register service worker (PWA install + offline)
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onRegisteredSW(swUrl) {
          // eslint-disable-next-line no-console
          console.info('[PWA] SW registered:', swUrl);
        },
        onOfflineReady() {
          // eslint-disable-next-line no-console
          console.info('[PWA] App ready to work offline');
          pwaStore.setOfflineReady(true);
        },
        onNeedRefresh() {
          pwaStore.setNeedRefresh(true);
        },
        onRegisterError(err) {
          // eslint-disable-next-line no-console
          console.warn('[PWA] SW registration failed', err);
        },
      });
      pwaStore.setUpdateSW(updateSW);
    })
    .catch(() => {
      /* PWA module unavailable in non-build envs */
    });
}

export default app;
