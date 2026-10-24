import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './app/app.css';

import { onNavigation, onViewRendered, startRouter } from './core/router';
import { createShell } from './app/shell';
import { initHead } from './app/head';
import { whenIdle } from './ui/dom';
import { initTheme } from './ui/theme';
import { initToasts, toast } from './ui/toast';
import { initPwa } from './pwa';
import { kit } from './ui/i18n/kit';
import { fmt } from './i18n/editor-text';

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
const INTRO_ROUTES: Record<string, 'textures' | 'converter' | 'merge' | 'doctor' | 'totem' | 'fonts' | 'skins' | 'skinpack' | 'cape' | 'shaders'> = {
  '/textures': 'textures',
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
onNavigation((state) => {
  if (introTool(state.pattern)) loadIntro().catch(() => undefined);
});
onViewRendered((state, view) => {
  const tool = introTool(state.pattern);
  if (!tool) return;
  if (introModule) introModule.mountToolIntro(view, tool, state.locale);
  else
    loadIntro()
      .then((m) => m.mountToolIntro(view, tool, state.locale))
      .catch((err) => console.warn('Tool introduction unavailable', err));
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

// A prerendered page that the app renders the same way ("keep" pages: home, help, guides) is shown
// first and the app takes over right after, so the first paint never waits for the boot work.
// Tool pages show their tool as soon as it is ready (their prerendered text is hidden until then).
const prerendered = document.querySelector('main#main');
if (prerendered?.hasChildNodes() && !prerendered.hasAttribute('data-boot')) afterFirstPaint(boot);
else boot();

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
