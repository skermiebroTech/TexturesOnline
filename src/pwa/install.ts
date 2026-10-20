// "Install app": the browser's install prompt where there is one (Chrome, Edge, Samsung Internet,
// Chrome on Android), short instructions where there isn't (Safari on iPhone/iPad: Share › Add to
// Home Screen; Safari on Mac: File › Add to Dock), nothing in browsers that can't install sites.
// Entries: a footer link and a phone-menu item, both hidden once the app is installed or when
// installing isn't possible. One suggestion, once ever, after the first export; never again after
// the visitor dismissed the browser's prompt.

import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { toast } from '../ui/toast';
import { currentLocale } from '../core/router';
import { appText } from './text';
import { platformOf } from './detect';
import type { Locale } from '../i18n/locales';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

/** localStorage: the one-time export suggestion has been shown */
const HINT_KEY = 'tpm-install-hint';
/** localStorage: the visitor said no to the browser's install prompt */
const DISMISSED_KEY = 'tpm-install-dismissed';

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
let started = false;
const listeners = new Set<() => void>();

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return true; // no storage: treat as already shown, so nothing repeats
  }
}

function setFlag(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Running as an installed app (any app display mode, or an iOS home-screen app). */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  const modes = ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen'];
  if (typeof matchMedia === 'function' && modes.some((m) => matchMedia(`(display-mode: ${m})`).matches)) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type InstallPlatform = 'prompt' | 'ios' | 'mac-safari' | null;

/** How installing works here right now, or null when the app is installed or can't be. */
export function installPlatform(): InstallPlatform {
  if (installedNow || isInstalledApp()) return null;
  if (deferred) return 'prompt';
  return platformOf(navigator.userAgent, navigator.maxTouchPoints || 0);
}

/** Calls `cb` whenever installing becomes possible or stops being possible. */
export function onInstallChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const emit = () => listeners.forEach((cb) => cb());

/** Instructions for browsers without an install prompt. */
function showSteps(kind: 'ios' | 'mac-safari', locale: Locale): void {
  const t = appText(locale);
  const steps = kind === 'ios' ? t.installIos : t.installMacSafari;
  void import('../ui/modal').then(({ openModal }) =>
    openModal({
      title: t.installTitle,
      width: 440,
      class: 'pwa-install-modal',
      body: h('div', { class: 'stack' }, h('p', { class: 'muted' }, t.installWhy), h('ol', { class: 'pwa-install-steps' }, steps.map((s) => h('li', null, s)))),
      actions: [{ label: t.gotIt, variant: 'primary' }],
    }),
  );
}

/** Starts installing: the browser's prompt, or the steps for Safari. */
export async function promptInstall(locale: Locale = currentLocale()): Promise<void> {
  const kind = installPlatform();
  if (kind === 'ios' || kind === 'mac-safari') return showSteps(kind, locale);
  if (kind !== 'prompt' || !deferred) return;
  const ev = deferred;
  // The event can be used once.
  deferred = null;
  emit();
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    if (choice.outcome === 'dismissed') setFlag(DISMISSED_KEY);
  } catch (err) {
    console.warn('Install prompt failed', err);
  }
}

/** Shows `el` only while installing is possible (it stays in sync). */
function bindVisibility(el: HTMLElement): HTMLElement {
  const sync = () => {
    if (!el.isConnected && el.dataset.bound === '1') {
      off();
      return;
    }
    el.hidden = installPlatform() === null;
  };
  const off = onInstallChange(sync);
  el.dataset.bound = '1';
  el.hidden = installPlatform() === null;
  return el;
}

/** "Install app" link for the site footer (a button styled like the footer's links). */
export function footerInstallLink(locale: Locale): HTMLElement {
  const t = appText(locale);
  return bindVisibility(h('button', { type: 'button', class: 'footer-install', on: { click: () => void promptInstall(locale) } }, icon('download'), h('span', null, t.installApp)));
}

/** "Install app" item for the phone menu. */
export function drawerInstallItem(locale: Locale, onPick?: () => void): HTMLElement {
  const t = appText(locale);
  return bindVisibility(
    h(
      'button',
      {
        type: 'button',
        class: 'drawer-link drawer-install accent-green',
        on: {
          click: () => {
            onPick?.();
            void promptInstall(locale);
          },
        },
      },
      icon('download'),
      h('span', null, t.installApp),
    ),
  );
}

const EXPORT_FILE = /\.(zip|mcpack|mcaddon|mcworld|png)$/i;

/** One suggestion, once, a moment after the first download of a pack or skin. */
function suggestAfterExport(): void {
  if (readFlag(HINT_KEY) || readFlag(DISMISSED_KEY)) return;
  const kind = installPlatform();
  if (!kind) return;
  setFlag(HINT_KEY);
  const t = appText(currentLocale());
  setTimeout(() => {
    if (!installPlatform()) return;
    toast(t.exportHint, { tone: 'info', duration: 12000, action: { label: t.install, onClick: () => void promptInstall() } });
  }, 1500);
}

/** Listens for the browser's install events and for exports. Call once at startup. */
export function initInstall(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    // No mini-infobar: the footer, the menu and the one-time hint offer it instead.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installedNow = true;
    deferred = null;
    emit();
    toast(appText(currentLocale()).installed, { tone: 'success' });
  });
  if (typeof matchMedia === 'function') matchMedia('(display-mode: standalone)').addEventListener?.('change', emit);
  // Exports are downloads through a temporary <a download> (src/core/download.ts).
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[download]');
      if (a instanceof HTMLAnchorElement && EXPORT_FILE.test(a.download)) suggestAfterExport();
    },
    true,
  );
}
