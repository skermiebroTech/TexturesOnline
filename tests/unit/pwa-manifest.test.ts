// Web app manifest (public/site.webmanifest): Chrome's install criteria, PWABuilder's manifest rules
// (the Microsoft Store packager), the files it names (icons, screenshots, shortcut icons) and that
// its shortcuts, file handlers and share target lead to real routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveRoute } from '../../src/core/router';
import { SITE_NAME, SITE_SHORT_NAME, THEME_COLOR } from '../../src/app/site';
import { SHARE_TARGET_PATH } from '../../src/pwa/sw-logic';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const pub = (p: string) => `${ROOT}public/${p}`;

interface Icon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}
interface Manifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  lang: string;
  dir: string;
  start_url: string;
  scope: string;
  display: string;
  display_override: string[];
  orientation: string;
  background_color: string;
  theme_color: string;
  categories: string[];
  prefer_related_applications: boolean;
  launch_handler: { client_mode: string | string[] };
  icons: Icon[];
  screenshots: (Icon & { form_factor: 'wide' | 'narrow'; label: string })[];
  shortcuts: { name: string; short_name: string; description: string; url: string; icons: Icon[] }[];
  file_handlers: { action: string; name: string; accept: Record<string, string[]>; icons?: Icon[]; launch_type?: string }[];
  share_target: { action: string; method: string; enctype: string; params: { files: { name: string; accept: string[] }[] } };
}

const manifest = JSON.parse(readFileSync(pub('site.webmanifest'), 'utf8')) as Manifest;
// Resolved the way a browser does: relative to the manifest's own URL.
const SITE = 'https://texturepackmaker.com/';
const at = (u: string) => new URL(u, SITE);

/** Width and height from a PNG's IHDR, or from the RIFF/VP8 header of a WebP. */
function imageSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  throw new Error(`Unknown image format: ${file}`);
}

const sizeOf = (sizes: string) => sizes.split('x').map(Number) as [number, number];
const HEX = /^#[0-9a-f]{6}$/i;

test('the identity fields install prompts and stores show', () => {
  assert.equal(manifest.name, SITE_NAME);
  assert.equal(manifest.short_name, SITE_SHORT_NAME);
  assert.ok(manifest.short_name.length >= 3 && manifest.short_name.length <= 12, 'short_name: 3-12 characters (home screen label)');
  for (const k of ['name', 'short_name', 'description'] as const) assert.equal(manifest[k], manifest[k].trim(), `${k} has no outer whitespace`);
  assert.ok(manifest.description.length >= 40 && manifest.description.length <= 300, 'description length');
  assert.equal(manifest.lang, 'en');
  assert.equal(manifest.dir, 'ltr');
  assert.deepEqual(manifest.categories.slice(0, 3), ['games', 'utilities', 'design']);
  assert.equal(manifest.prefer_related_applications, false);
});

test('id, start_url and scope are relative, so the app works at the domain root and under a project path', () => {
  for (const k of ['id', 'start_url', 'scope'] as const) assert.ok(!manifest[k].startsWith('/') && !/^https?:/.test(manifest[k]), `${k} is relative to the manifest`);
  assert.equal(at(manifest.start_url).href, SITE);
  assert.equal(at(manifest.scope).href, SITE);
  assert.equal(at(manifest.id).href, SITE, 'the app id never changes (changing it would make a second app)');
  // Under a GitHub Pages project path the same values stay inside the project.
  const project = 'https://skermiebrotech.github.io/TexturesOnline/';
  assert.equal(new URL(manifest.start_url, project).href, project);
});

test('display: standalone app window, window controls overlay on desktop', () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.display_override[0], 'window-controls-overlay');
  assert.ok(manifest.display_override.includes('standalone'));
  assert.equal(manifest.orientation, 'any');
  const modes = Array.isArray(manifest.launch_handler.client_mode) ? manifest.launch_handler.client_mode : [manifest.launch_handler.client_mode];
  assert.equal(modes[0], 'focus-existing', 'opening a file or shortcut reuses the open window');
  for (const m of modes) assert.ok(['auto', 'focus-existing', 'navigate-existing', 'navigate-new'].includes(m), m);
});

test('theme and background colours match the dark theme (the default)', () => {
  assert.match(manifest.theme_color, HEX);
  assert.match(manifest.background_color, HEX);
  assert.equal(manifest.theme_color, THEME_COLOR.dark);
  assert.equal(manifest.background_color, THEME_COLOR.dark);
  const index = readFileSync(`${ROOT}index.html`, 'utf8');
  assert.ok(index.includes(`<meta name="theme-color" content="${THEME_COLOR.dark}" />`), 'index.html theme-color');
  assert.ok(index.includes(`'${THEME_COLOR.light}'`), 'light theme colour is set before first paint');
  assert.ok(index.includes('<link rel="manifest" href="/site.webmanifest" />'), 'index.html links the manifest');
});

test('icons exist with the declared sizes: any 192/512/1024, maskable 192/512, monochrome', () => {
  const need = ['any:192', 'any:512', 'maskable:192', 'maskable:512', 'monochrome:512'];
  const have = new Set<string>();
  for (const icon of manifest.icons) {
    assert.ok(existsSync(pub(icon.src)), icon.src);
    assert.ok(!/\s/.test(icon.purpose ?? 'any'), `${icon.src}: one purpose per icon (PWABuilder rejects "any maskable")`);
    if (icon.type === 'image/svg+xml') continue;
    assert.equal(icon.type, 'image/png');
    const [w, h] = sizeOf(icon.sizes);
    assert.deepEqual(imageSize(pub(icon.src)), { width: w, height: h }, `${icon.src} is ${icon.sizes}`);
    have.add(`${icon.purpose ?? 'any'}:${w}`);
  }
  for (const n of need) assert.ok(have.has(n), `icon ${n}`);
  assert.ok(manifest.icons.some((i) => i.type === 'image/png' && sizeOf(i.sizes)[0] >= 1024), 'a 1024px icon for the Store tiles');
});

test('screenshots: wide and narrow sets for the richer install dialog and the stores', () => {
  const byForm = { wide: [] as number[], narrow: [] as number[] };
  for (const s of manifest.screenshots) {
    assert.ok(existsSync(pub(s.src)), s.src);
    const [w, h] = sizeOf(s.sizes);
    assert.deepEqual(imageSize(pub(s.src)), { width: w, height: h }, `${s.src} is ${s.sizes}`);
    assert.ok(Math.min(w, h) >= 320 && Math.max(w, h) <= 3840, `${s.src}: 320-3840px`);
    assert.ok(Math.max(w, h) / Math.min(w, h) <= 2.3, `${s.src}: aspect ratio at most 2.3`);
    assert.ok(s.label.length > 10, `${s.src} has a label`);
    assert.equal(s.form_factor === 'wide', w > h, `${s.src} form factor`);
    byForm[s.form_factor].push(w / h);
  }
  assert.ok(byForm.wide.length >= 1 && byForm.narrow.length >= 1, 'both form factors');
  for (const ratios of Object.values(byForm)) assert.equal(new Set(ratios.map((r) => r.toFixed(3))).size, 1, 'one aspect ratio per form factor');
});

test('shortcuts: texture pack, converter, skins and shaders, each a real route with a 96px PNG icon', () => {
  assert.deepEqual(
    manifest.shortcuts.map((s) => s.short_name),
    ['Texture pack', 'Converter', 'Skins', 'Shaders'],
  );
  for (const s of manifest.shortcuts) {
    const url = at(s.url);
    assert.ok(url.href.startsWith(SITE), `${s.url} is inside the scope`);
    assert.ok(url.pathname.endsWith('/'), `${s.url} is a folder URL (no redirect)`);
    assert.ok(resolveRoute(url.pathname), `${s.url} is an app route`);
    assert.ok(s.description.length > 10);
    for (const icon of s.icons) {
      assert.equal(icon.type, 'image/png', 'PWABuilder: no SVG or WebP shortcut icons');
      assert.deepEqual(imageSize(pub(icon.src)), { width: 96, height: 96 }, icon.src);
    }
  }
});

test('file handlers open packs and skins in the app', () => {
  const exts = manifest.file_handlers.flatMap((f) => Object.values(f.accept).flat());
  for (const e of ['.zip', '.mcpack', '.mcaddon', '.png', '.tpmproject', '.tpmbackup']) assert.ok(exts.includes(e), e);
  for (const f of manifest.file_handlers) {
    assert.ok(at(f.action).href.startsWith(SITE) && resolveRoute(at(f.action).pathname), `${f.action} is an app route`);
    assert.ok(f.name.length > 0);
    for (const [mime, list] of Object.entries(f.accept)) {
      assert.match(mime, /^[a-z]+\/[a-z0-9.+-]+$/, mime);
      for (const e of list) assert.match(e, /^\.[a-z0-9]+$/, e);
    }
    for (const icon of f.icons ?? []) assert.ok(existsSync(pub(icon.src)), icon.src);
  }
});

test('share target posts files to the route the service worker answers', () => {
  const s = manifest.share_target;
  assert.equal(s.method, 'POST');
  assert.equal(s.enctype, 'multipart/form-data');
  assert.equal(at(s.action).href, SITE + SHARE_TARGET_PATH);
  assert.equal(s.params.files[0].name, 'files');
  for (const e of ['.zip', '.mcpack', '.png', '.tpmproject', '.tpmbackup']) assert.ok(s.params.files[0].accept.includes(e), e);
});

test("PWABuilder's required and recommended manifest members are all present", () => {
  // From @pwabuilder/manifest-validation (the checks behind pwabuilder.com's report card).
  const required = ['name', 'short_name', 'start_url', 'icons'];
  const recommended = ['id', 'description', 'display', 'display_override', 'background_color', 'theme_color', 'orientation', 'screenshots', 'launch_handler', 'categories', 'shortcuts', 'file_handlers', 'share_target', 'lang', 'dir', 'scope', 'handle_links', 'edge_side_panel'];
  for (const k of [...required, ...recommended]) assert.ok(k in manifest, k);
  assert.ok(manifest.icons.some((i) => i.purpose === 'any'), 'an icon with purpose any');
  assert.ok(manifest.icons.some((i) => i.type === 'image/png' && sizeOf(i.sizes)[0] >= 512), 'a PNG icon of 512px or more');
});
