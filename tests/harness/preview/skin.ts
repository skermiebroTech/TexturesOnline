import { ColorManagement } from 'three';
import { fixtureAssets } from './fixture-assets';
import { createSkinPreview, SKIN_PARTS, type SkinAnimation, type SkinPreview } from '../../../src/tools/skins/skin-preview';

declare global {
  interface Window { __ready: Promise<void>; __a: SkinPreview; __b: SkinPreview; __paint(n: number): Promise<{ recreated: boolean }>; __colorManagement(): boolean }
}

const q = new URLSearchParams(location.search);
window.__colorManagement = () => ColorManagement.enabled;

/** Simple original test skin: coloured body parts with a patterned overlay on the head. */
function testSkin(): ImageData {
  const img = new ImageData(64, 64);
  const fill = (x: number, y: number, w: number, h: number, c: [number, number, number, number]) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) img.data.set(c, (j * 64 + i) * 4);
  };
  fill(0, 0, 32, 16, [236, 188, 150, 255]);   // head
  fill(8, 0, 8, 8, [90, 60, 40, 255]);         // hair top
  fill(8, 8, 8, 2, [90, 60, 40, 255]);         // fringe
  fill(9, 12, 2, 1, [40, 60, 160, 255]);       // eyes
  fill(13, 12, 2, 1, [40, 60, 160, 255]);
  fill(16, 16, 24, 16, [60, 150, 220, 255]);   // body
  fill(40, 16, 16, 16, [236, 188, 150, 255]);  // right arm
  fill(32, 48, 16, 16, [236, 188, 150, 255]);  // left arm
  fill(0, 16, 16, 16, [70, 70, 160, 255]);     // right leg
  fill(16, 48, 16, 16, [70, 70, 160, 255]);    // left leg
  fill(40, 0, 8, 8, [250, 210, 60, 200]);      // hat top
  fill(32, 8, 32, 2, [250, 210, 60, 220]);     // hat band
  return img;
}

async function main(): Promise<void> {
  const assets = q.get('assets') === 'none' ? null : await fixtureAssets('java').catch(() => null);
  const steve = assets ? await assets.readImage('assets/minecraft/textures/entity/player/wide/steve.png').catch(() => null) : null;
  const alex = assets ? await assets.readImage('assets/minecraft/textures/entity/player/slim/alex.png').catch(() => null) : null;
  const a = createSkinPreview(document.getElementById('a') as HTMLElement, { model: 'classic', skin: steve ?? testSkin(), animation: (q.get('anim') as SkinAnimation) ?? 'idle', background: null });
  const b = createSkinPreview(document.getElementById('b') as HTMLElement, { model: 'slim', skin: alex ?? testSkin(), animation: 'walk', background: '#1f2430' });
  window.__a = a;
  window.__b = b;
  if (q.get('highlight')) a.setHighlight(q.get('highlight'));
  if (q.get('layers') === 'inner') a.setLayers({ inner: true, outer: false });

  const paint = document.getElementById('paint') as HTMLCanvasElement;
  const pctx = paint.getContext('2d') as CanvasRenderingContext2D;
  pctx.putImageData(testSkin(), 0, 0);
  window.__paint = async (n: number) => {
    const viewer = (b as unknown as { viewer: { playerObject: { skin: { map: unknown } } } }).viewer;
    b.setSkin(paint);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const before = viewer.playerObject.skin.map;
    for (let i = 0; i < n; i++) {
      pctx.fillStyle = `hsl(${(i * 37) % 360} 80% 55%)`;
      pctx.fillRect(20 + (i % 8), 20 + ((i >> 3) % 12), 1, 1);
      b.setSkin(paint);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    return { recreated: viewer.playerObject.skin.map !== before };
  };

  const bar = document.getElementById('bar') as HTMLDivElement;
  const btn = (label: string, fn: () => void) => {
    const el = document.createElement('button');
    el.textContent = label;
    el.onclick = fn;
    bar.appendChild(el);
  };
  for (const anim of ['idle', 'walk', 'run', 'fly', 'none'] as SkinAnimation[]) btn(anim, () => a.setAnimation(anim));
  btn('classic', () => a.setModel('classic'));
  btn('slim', () => a.setModel('slim'));
  btn('inner only', () => a.setLayers({ inner: true, outer: false }));
  btn('outer only', () => a.setLayers({ inner: false, outer: true }));
  btn('both layers', () => a.setLayers({ inner: true, outer: true }));
  for (const p of SKIN_PARTS) btn(`hl ${p.id}`, () => a.setHighlight(p.id));
  btn('hl none', () => a.setHighlight(null));
  btn('bg dark', () => a.setBackground('#282e3c'));
  btn('bg none', () => a.setBackground(null));
  btn('rotate', () => a.setAutoRotate(true));
  btn('reset cam', () => a.resetCamera());
  btn('paint x40 (b)', () => void window.__paint(40));
  btn('screenshot', async () => window.open(URL.createObjectURL(await a.screenshot())));
}
window.__ready = main();
