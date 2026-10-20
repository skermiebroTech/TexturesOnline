// Registers the service worker (sw.js at the site root) once the page has loaded, and offers a
// new version when one has been downloaded: a quiet "New version — Reload" toast, never a forced
// reload. A page that already runs the new build (it was loaded from the network after the
// deploy) switches to the new worker silently.

import { appBaseUrl } from '../core/base';
import { currentLocale } from '../core/router';
import { toast, type ToastHandle } from '../ui/toast';
import { appText } from './text';
import { sameBuild, type WorkerInfo } from './detect';

/** How often an open tab (or an installed app left running) looks for a new version. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/** This tab asked the new worker to take over: 'reload' after Reload was pressed, 'quiet' when it already runs the new build. */
let takeover: 'reload' | 'quiet' | null = null;
let notice: ToastHandle | null = null;
let lastCheck = 0;

/** Asks a worker which build it serves. */
function infoOf(worker: ServiceWorker): Promise<WorkerInfo | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 3000);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve((e.data as WorkerInfo | null) ?? null);
    };
    worker.postMessage({ type: 'GET_INFO' }, [channel.port2]);
  });
}

function activate(worker: ServiceWorker): void {
  takeover = 'reload';
  worker.postMessage({ type: 'SKIP_WAITING' });
}

function offerReload(onReload: () => void): void {
  if (notice) return;
  const t = appText(currentLocale());
  notice = toast(t.updateReady, { tone: 'info', duration: 0, action: { label: t.reload, onClick: onReload } });
}

/** A worker is installed and waiting: switch silently, or offer the reload. */
async function onWaiting(worker: ServiceWorker, entryUrl: string): Promise<void> {
  const info = await infoOf(worker);
  if (sameBuild(info, entryUrl, appBaseUrl())) {
    // This page is already the new build: no reload needed.
    takeover = 'quiet';
    worker.postMessage({ type: 'SKIP_WAITING' });
    return;
  }
  offerReload(() => activate(worker));
}

function watch(reg: ServiceWorkerRegistration, entryUrl: string): void {
  if (reg.waiting && navigator.serviceWorker.controller) void onWaiting(reg.waiting, entryUrl);
  reg.addEventListener('updatefound', () => {
    const next = reg.installing;
    if (!next) return;
    next.addEventListener('statechange', () => {
      // The first install (no controller yet) is just "ready for offline": nothing to say.
      if (next.state === 'installed' && navigator.serviceWorker.controller) void onWaiting(next, entryUrl);
    });
  });
}

/**
 * Registers the worker after the page has loaded, off the critical path. `entryUrl` is the app's
 * entry script (import.meta.url in main.ts), which tells the build apart.
 */
export function registerServiceWorker(entryUrl: string): void {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (takeover === 'reload') return location.reload();
    if (takeover === 'quiet' || !hadController) return;
    // Another tab switched to the new version: this one keeps working on its cached build until
    // the visitor reloads.
    offerReload(() => location.reload());
  });
  const start = () => {
    navigator.serviceWorker
      .register(new URL('sw.js', appBaseUrl()).href, { scope: appBaseUrl(), updateViaCache: 'none' })
      .then((reg) => {
        watch(reg, entryUrl);
        const check = () => {
          if (Date.now() - lastCheck < 10 * 60 * 1000) return;
          lastCheck = Date.now();
          void reg.update().catch(() => undefined);
        };
        lastCheck = Date.now();
        setInterval(check, CHECK_EVERY_MS);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      })
      .catch((err: unknown) => console.warn('Offline support is unavailable:', err));
  };
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 4000 }) : setTimeout(start, 1000));
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
