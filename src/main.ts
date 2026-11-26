import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './app/app.css';

import { currentLocale, onNavigation, onViewRendered, startRouter } from './core/router';
import { createShell } from './app/shell';
import { initHead } from './app/head';
import { whenIdle } from './ui/dom';
import { initTheme } from './ui/theme';
import { initToasts, toast } from './ui/toast';
import { initPwa } from './pwa';
import { kit } from './ui/i18n/kit';
import { fmt, warmNumberFormats } from './i18n/editor-text';
import { hasLocaleText, loadLocaleText } from './i18n/locale-text';

initTheme();

function boot(): void {
  const root = document.getElementById('app') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
  const { outlet } = createShell(root);
  initToasts();
  initHead();
  startRouter(outlet);
  // Offline support, updates, "Install app" and files opened with the installed app. This module
  // is the app's entry script, so its URL tells the service worker which build is running.
  initPwa(import.meta.url);
}

/** Calls `fn` once the current content has been painted (right away in a tab that is not painting). */
function afterFirstPaint(fn: () => void): void {
  if (document.visibilityState !== 'visible') return fn();
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };
  // A timeout queued from an animation frame runs after that frame is painted.
  requestAnimationFrame(() => setTimeout(run, 0));
  setTimeout(run, 1000);
}

// The texture, skin and shader start screens get the same introduction as their prerendered pages.
const INTRO_ROUTES: Record<string, 'textures' | 'painting' | 'gui' | 'disc' | 'glint' | 'converter' | 'merge' | 'doctor' | 'totem' | 'fonts' | 'skins' | 'skinpack' | 'cape' | 'shaders'> = {
  '/textures': 'textures',
  '/painting-maker': 'painting',
  '/gui-maker': 'gui',
  '/music-disc-maker': 'disc',
  '/enchantment-glint-maker': 'glint',
  '/texture-pack-converter': 'converter',
  '/merge-texture-packs': 'merge',
  '/pack-doctor': 'doctor',
  '/totem-maker': 'totem',
  '/font-maker': 'fonts',
  '/skins': 'skins',
  '/skin-pack-maker': 'skinpack',
  '/cape-maker': 'cape',
  '/shaders': 'shaders',
};
// The introduction module is fetched as soon as such a route is visited (prerendered tool pages
// preload it), so it is usually ready when the tool renders and goes in with the same frame:
// adding it a moment later would push the footer down (a layout shift).
type IntroModule = typeof import('./app/tool-intro');
let introModule: IntroModule | null = null;
let introLoading: Promise<IntroModule> | null = null;
const loadIntro = (): Promise<IntroModule> =>
  (introLoading ??= import('./app/tool-intro').then((m) => (introModule = m)).catch((err: unknown) => {
    introLoading = null;
    throw err;
  }));
const introTool = (pattern: string | null) => (pattern ? INTRO_ROUTES[pattern] : undefined);
// (each tool's own text is a small chunk of its own, fetched as soon as the route is known too)
onNavigation((state) => {
  const tool = introTool(state.pattern);
  if (tool) loadIntro().then((m) => m.preloadToolIntro(tool), () => undefined);
});
onViewRendered((state, view) => {
  const tool = introTool(state.pattern);
  if (!tool) return;
  const unavailable = (err: unknown) => console.warn('Tool introduction unavailable', err);
  if (introModule) introModule.mountToolIntro(view, tool, state.locale).catch(unavailable);
  else
    loadIntro()
      .then((m) => m.mountToolIntro(view, tool, state.locale))
      .catch(unavailable);
});

// Long pages: once a view (with its introduction) has been drawn in full, every section's size is
// known, and the ones out of sight can be left out of rendering until they come near the screen
// (data-cv, see .site-footer in layout.css). Not before: a section never drawn would only have an
// estimated height.
onViewRendered((state, view) => {
  const ready = introTool(state.pattern) ? loadIntro().catch(() => undefined) : Promise.resolve();
  void ready.then(() =>
    whenIdle(() => {
      if (view.isConnected) view.dataset.cv = '';
    }),
  );
});

// The page's number format is ready before a tap first needs one (its first use is slow).
onViewRendered((state) => {
  // (in two idle turns: each loads locale data, together a long task on a phone)
  whenIdle(() => {
    warmNumberFormats(state.locale, 'number');
    whenIdle(() => warmNumberFormats(state.locale, 'plural'), 4000);
  }, 4000);
});

// A prerendered page that the app renders the same way ("keep" pages: home, help, guides) is shown
// first and the app takes over right after, so the first paint never waits for the boot work.
// Tool pages show their tool as soon as it is ready (their prerendered text is hidden until then).
// A translated page boots once its language's short texts are in (a small chunk of their own, which
// the page preloads with this script): the shell and the head show them from the start.
const prerendered = document.querySelector('main#main');
const start = () => {
  if (prerendered?.hasChildNodes() && !prerendered.hasAttribute('data-boot')) afterFirstPaint(boot);
  else boot();
};
const locale = currentLocale();
if (hasLocaleText(locale)) start();
else
  loadLocaleText(locale).then(start, (err: unknown) => {
    console.warn('Language text unavailable', err);
    start();
  });

// Last-resort error reporting: keep the app usable and tell the user something failed.
let lastErrorAt = 0;
function reportError(err: unknown): void {
  console.error(err);
  const now = Date.now();
  if (now - lastErrorAt < 3000) return;
  lastErrorAt = now;
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (/ResizeObserver loop/i.test(msg)) return;
  toast(msg && msg.length < 160 ? fmt(kit.errorWithMessage, { message: msg }) : kit.errorGeneric, { tone: 'error' });
}
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason as unknown;
  if (reason instanceof DOMException && reason.name === 'AbortError') return;
  reportError(reason);
});
window.addEventListener('error', (e) => {
  if (e.error) reportError(e.error);
});

// Stop the browser from opening files dropped outside a drop zone.
window.addEventListener('dragover', (e) => {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
});
window.addEventListener('drop', (e) => {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
});
