import { createBlockPreview, type BlockPreview, type CubeFaces } from '../../../src/shared/preview/block-preview';
import { proceduralBlockFaces, proceduralTexture, toImageData } from '../../../src/shared/preview/procedural-textures';
import { compositeOverlay, DEFAULT_FOLIAGE_TINT, DEFAULT_GRASS_TINT, tintImage } from '../../../src/shared/preview/preview-textures';
import { fixtureAssets } from './fixture-assets';

declare global {
  interface Window { __ready: Promise<void>; __previews: BlockPreview[] }
}

const q = new URLSearchParams(location.search);
const view = document.getElementById('view') as HTMLDivElement;
const rotate = q.get('rotate') === '1';
window.__previews = [];

function cell(label: string): BlockPreview {
  const div = document.createElement('div');
  div.className = 'cell';
  const box = document.createElement('div');
  box.className = 'box';
  const p = document.createElement('p');
  p.textContent = label;
  div.append(box, p);
  view.appendChild(div);
  const bp = createBlockPreview(box, { autoRotate: rotate });
  window.__previews.push(bp);
  return bp;
}

async function main(): Promise<void> {
  const faces = proceduralBlockFaces('grass_block');
  cell('procedural grass block').showCube(Object.fromEntries(Object.entries(faces).map(([k, v]) => [k, toImageData(v)])) as CubeFaces);
  cell('procedural oak log').showCube(proceduralBlockFaces('oak_log') as CubeFaces);
  cell('procedural water (animated)').showCube({ all: proceduralTexture('water') }, { frametime: 2 });
  cell('procedural poppy (flat)').showFlat(toImageData(proceduralTexture('poppy')));

  if ((q.get('assets') ?? 'java') !== 'java') return;
  const a = await fixtureAssets('java');
  const t = (id: string) => a.readImage(`assets/minecraft/textures/${id}.png`);
  const side = compositeOverlay(await t('block/grass_block_side'), await t('block/grass_block_side_overlay'), DEFAULT_GRASS_TINT);
  const top = tintImage(await t('block/grass_block_top'), DEFAULT_GRASS_TINT);
  cell('java grass block').showCube({ up: top, down: await t('block/dirt'), north: side, south: side, east: side, west: side });
  cell('java furnace (front = north)').showCube({ all: await t('block/furnace_side'), up: await t('block/furnace_top'), down: await t('block/furnace_top'), north: await t('block/furnace_front') });
  cell('java glass (cutout)').showCube({ all: await t('block/glass') });
  cell('java oak leaves (tinted)').showCube({ all: tintImage(await t('block/oak_leaves'), DEFAULT_FOLIAGE_TINT) });
  cell('java water_still strip').showCube({ all: tintImage(await t('block/water_still'), [63, 118, 228]) }, { frametime: 2 });
  cell('java diamond sword (flat)').showFlat(await t('item/diamond_sword'));
  cell('java water strip flat (animated)').showFlat(await t('block/water_still'), { frametime: 2 });
  cell('java steve skin (flat, 64x64)').showFlat(await t('entity/player/wide/steve'));
}
window.__ready = main();
