/**
 * pwa.ts — Helpers para detección PWA / iOS y orquestación del banner de instalación.
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  // iOS Safari uses `navigator.standalone`
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return mq || iosStandalone;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = (navigator as unknown as { platform?: string }).platform || '';
  // iPad on iOS 13+ reports as Mac — disambiguate with touch points
  const isIPadOS = platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  return /iPad|iPhone|iPod/.test(ua) || isIPadOS;
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
}

export function iosVersion(): number | null {
  if (!isIOS()) return null;
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  if (!match) return null;
  return parseFloat(`${match[1]}.${match[2]}`);
}

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return !Number.isNaN(ts) && Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
