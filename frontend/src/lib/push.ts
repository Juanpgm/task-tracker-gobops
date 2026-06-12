/**
 * Web Push subscription helpers for the Catatrack PWA.
 *
 * iOS 16.4+ caveat: Notification permission can only be granted when the site
 * is launched as an installed PWA (Add to Home Screen). On all other browsers
 * permission can be requested at any time after a user gesture.
 */
import { authStore } from '../stores/authStore';
import { get } from 'svelte/store';
import { isStandalone, isIOS, iosVersion } from './pwa';

const AUTH_API = import.meta.env.VITE_AUTH_API_URL || '/api/auth';

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: 'no-sw' | 'no-push' | 'no-notification' | 'ios-needs-install' };

/** Detect whether the current environment can subscribe to web push. */
export function detectPushSupport(): PushSupport {
  if (typeof navigator === 'undefined') return { ok: false, reason: 'no-sw' };
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-sw' };
  if (!('PushManager' in window)) return { ok: false, reason: 'no-push' };
  if (typeof Notification === 'undefined') return { ok: false, reason: 'no-notification' };
  // iOS Safari 16.4+ requires standalone (installed) PWA
  const version = iosVersion();
  if (isIOS() && version !== null && version >= 16.4 && !isStandalone()) {
    return { ok: false, reason: 'ios-needs-install' };
  }
  return { ok: true };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function authHeader(): Record<string, string> {
  const state = get(authStore);
  const token = state.user?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch(`${AUTH_API}/push/vapid-public-key`);
  if (!res.ok) throw new Error(`No se pudo obtener VAPID key (${res.status})`);
  const json = (await res.json()) as { public_key: string };
  if (!json.public_key) throw new Error('VAPID key vacía');
  return json.public_key;
}

/** Returns existing PushSubscription if any, else null. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Request permission then subscribe + send to backend. */
export async function subscribePush(): Promise<PushSubscription> {
  const support = detectPushSupport();
  if (!support.ok) throw new Error(`Push no soportado: ${support.reason}`);

  if (Notification.permission === 'denied') {
    throw new Error('Permiso de notificaciones bloqueado en la configuración del navegador');
  }
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Permiso de notificaciones no concedido');
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const vapid = await fetchVapidPublicKey();
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as any,
    });
  }

  const subJson = sub.toJSON();
  const res = await fetch(`${AUTH_API}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      expiration_time: subJson.expirationTime ?? null,
    }),
  });
  if (!res.ok) throw new Error(`No se pudo registrar la suscripción (${res.status})`);
  return sub;
}

/** Unsubscribe both locally and on the backend. */
export async function unsubscribePush(): Promise<void> {
  const sub = await getExistingSubscription();
  if (sub) await sub.unsubscribe();
  try {
    await fetch(`${AUTH_API}/push/unsubscribe`, {
      method: 'DELETE',
      headers: { ...authHeader() },
    });
  } catch {
    /* best effort */
  }
}
