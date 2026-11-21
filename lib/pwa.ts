// "Install as an app" support for the web version: registers the service worker and tracks
// the browser's install prompt. All of it is a no-op on iOS/Android builds and during
// development.

import { Platform } from 'react-native';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let started = false;

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';
const notify = () => listeners.forEach((fn) => fn());

// The site can live in a sub-folder (GitHub Pages project sites).
const base = () => process.env.EXPO_BASE_URL ?? '';

export function startPwa() {
  if (!isWeb() || started) return;
  started = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep the browser's own mini-bar away; we offer it in Settings
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });

  if ('serviceWorker' in navigator && !__DEV__) {
    navigator.serviceWorker.register(`${base()}/sw.js`, { scope: `${base()}/` }).catch(() => {});
  }
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

// Shows the browser's install dialog; true when the person accepted.
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  notify();
  try {
    await event.prompt();
    return (await event.userChoice).outcome === 'accepted';
  } catch {
    return false;
  }
}

// Already running as an installed app (home-screen icon / standalone window).
export function isInstalledApp(): boolean {
  if (!isWeb()) return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// iPhone/iPad browsers can't show an install prompt; installing is Share > Add to Home Screen.
export function isIosBrowser(): boolean {
  if (!isWeb()) return false;
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}
