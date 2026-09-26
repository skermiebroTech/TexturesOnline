import { createShaderPreview, type ShaderPreview } from '../../../src/shared/preview/shader-preview';
import { fixtureAssets } from './fixture-assets';
import { PRESETS } from './presets';

declare global {
  interface Window { __preview: ShaderPreview; __ready: Promise<void>; __setPreset(name: string): void; __setAssets(src: string): Promise<void> }
}

const q = new URLSearchParams(location.search);
const view = document.getElementById('view') as HTMLDivElement;
if (q.get('w')) view.style.width = q.get('w') + 'px';
if (q.get('h')) view.style.height = q.get('h') + 'px';
const status = document.getElementById('status') as HTMLDivElement;
const dpr = q.get('dpr') ? Number(q.get('dpr')) : undefined;
const initial = PRESETS[q.get('preset') ?? 'default']?.() ?? PRESETS.default();
if (q.get('tod')) initial.timeOfDay = Number(q.get('tod'));
const preview = createShaderPreview(view, { autoRotate: q.get('rotate') === '1', pixelRatio: dpr, params: initial });
window.__preview = preview;
// Harness-only camera overrides (internal fields)
const orbit = (preview as unknown as { orbit?: { distance: number; azimuth: number; elevation: number } }).orbit;
if (orbit) {
  if (q.get('dist')) orbit.distance = Number(q.get('dist'));
  if (q.get('az')) orbit.azimuth = Number(q.get('az'));
  if (q.get('el')) orbit.elevation = Number(q.get('el'));
}

async function setAssets(src: string): Promise<void> {
  status.textContent = `assets: ${src}…`;
  try {
    await preview.setAssets(src === 'java' || src === 'bedrock' ? await fixtureAssets(src) : null);
    status.textContent = `assets: ${src}`;
  } catch (e) {
    status.textContent = `assets failed: ${(e as Error).message}`;
  }
}
window.__setAssets = setAssets;
window.__setPreset = (name) => preview.setParams(PRESETS[name]());
window.__ready = setAssets(q.get('assets') ?? 'none');

const bar = document.getElementById('bar') as HTMLDivElement;
const btn = (label: string, fn: () => void) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = fn;
  bar.appendChild(b);
};
for (const name of Object.keys(PRESETS)) btn(name, () => window.__setPreset(name));
for (const src of ['none', 'java', 'bedrock']) btn(`assets:${src}`, () => void setAssets(src));
let anim = false;
btn('time anim', () => preview.setTimeAnimation((anim = !anim)));
let rot = q.get('rotate') === '1';
btn('rotate', () => preview.setAutoRotate((rot = !rot)));
btn('reset cam', () => preview.resetCamera());
btn('screenshot', async () => {
  const blob = await preview.screenshot();
  window.open(URL.createObjectURL(blob));
});
btn('destroy', () => preview.destroy());
