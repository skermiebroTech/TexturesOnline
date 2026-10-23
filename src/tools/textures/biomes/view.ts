// Biome colours view: shown in the Preview tab while a colour map (textures/colormap/*.png) is open.
// The map with its two axes in plain words (warm to cold, dry to rainy), the biomes marked where the
// game reads them, the picked biome's colour with a grass block and leaves coloured like it (live
// while the map is painted), the list of biomes, and where the game uses other colours. Picking a
// biome colours the 3D previews like it too (ModelService.setPreviewBiome).

import './biomes.css';
import type { ModelService } from '../ui/models';
import type { TexStore } from '../ui/store';
import type { OpenTexture } from '../ui/canvas-panel';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { toggle, tooltip } from '../../../ui/components';
import { createImageData } from '../../../core/pixels';
import { compositeOverlay, tintByAlphaMask, tintImage } from '../../../shared/preview/preview-textures';
import type { RGBAImage } from '../../../shared/preview/procedural-textures';
import { renderIsoCube } from '../iso-cube';
import { firstSquare } from '../ui/meta';
import { paintCanvas } from '../ui/thumbs';
import { byPointer } from '../ui/media';
import { fmt, joinList } from '../../../i18n/editor-text';
import {
  biomeCell,
  biomeLooks,
  biomesOf,
  biomeTints,
  colorMapOf,
  javaAtLeast,
  lookColor,
  mapIsGameSize,
  rgbHex,
  type BiomeId,
  type BiomeLooks,
  type Look,
  type ColorMap,
  type MapImage,
  type RGB,
} from './biomes';
import { drawMarkers, mapMarkers, markerAt, markersOnCanvas, setMarkersOnCanvas, type Marker } from './markers';
import { tb } from './i18n/text';

export interface BiomeView {
  el: HTMLElement;
  /** Shows the view for the open texture; false (and hidden) when it isn't a colour map */
  show(t: OpenTexture | null): boolean;
  /** The open map was painted: its new pixels */
  update(full: ImageData): void;
  destroy(): void;
}

/** Which look of a biome a map colours */
const LOOK_OF: Record<ColorMap, keyof Pick<BiomeLooks, 'grass' | 'foliage' | 'dry' | 'birch' | 'evergreen'>> = {
  grass: 'grass',
  swamp_grass: 'grass',
  foliage: 'foliage',
  swamp_foliage: 'foliage',
  mangrove_swamp_foliage: 'foliage',
  dry_foliage: 'dry',
  birch: 'birch',
  evergreen: 'evergreen',
};

/** The game's textures of the blocks shown coloured (newest names first) */
const JAVA_TEX = {
  grassTop: ['block/grass_block_top', 'blocks/grass_top'],
  grassSide: ['block/grass_block_side', 'blocks/grass_side'],
  grassOverlay: ['block/grass_block_side_overlay', 'blocks/grass_side_overlay'],
  oak: ['block/oak_leaves', 'blocks/leaves_oak'],
  birch: ['block/birch_leaves', 'blocks/leaves_birch'],
  spruce: ['block/spruce_leaves', 'blocks/leaves_spruce'],
  mangrove: ['block/mangrove_leaves'],
  litter: ['block/leaf_litter'],
};
const BEDROCK_TEX = {
  grassTop: ['blocks/grass_top'],
  grassSide: ['blocks/grass_side'],
  grassOverlay: [] as string[],
  oak: ['blocks/leaves_oak', 'blocks/leaves_oak_opaque'],
  birch: ['blocks/leaves_birch', 'blocks/leaves_birch_opaque'],
  spruce: ['blocks/leaves_spruce', 'blocks/leaves_spruce_opaque'],
  mangrove: ['blocks/mangrove_leaves', 'blocks/mangrove_leaves_opaque'],
  litter: ['blocks/leaf_litter'],
};

const css = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const MAP_PX = 256;

export function createBiomeView(store: TexStore, models: ModelService): BiomeView {
  const { edition, version } = store.project;
  let map: ColorMap | null = null;
  let path = '';
  let img: MapImage | null = null;
  let markers: Marker[] = [];
  let hover: Marker | null = null;
  let size = 0;
  let destroyed = false;
  /** The other colour maps (the pack's, else the game's), read once per open map */
  let others: Partial<Record<ColorMap, MapImage>> = {};
  /** Textures of the blocks shown, read once per open map */
  let blockTex: Map<string, ImageData | null> = new Map();

  const names = () => tb.names as Record<BiomeId, string>;
  const selected = (): BiomeId => {
    const list = biomesOf(edition, version);
    return list.includes(models.previewBiome) ? models.previewBiome : list.includes('plains') ? 'plains' : list[0];
  };

  // ---------------------------------------------------------------- DOM
  const uses = h('p', { class: 'tx-bm-text' });
  const canvas = h('canvas', { class: 'tx-bm-map', role: 'img', 'aria-label': tb.mapLabel });
  const unused = h('span', { class: 'tx-bm-unused' }, tb.unused);
  tooltip(unused, tb.unusedHint);
  const mapBox = h(
    'div',
    { class: 'tx-bm-mapbox' },
    h('span', { class: 'tx-bm-axis tx-bm-axis-y', 'aria-hidden': 'true' }, h('span', null, icon('arrow-up', { size: 16 }), tb.rainy), h('span', null, tb.dry)),
    h('div', { class: 'tx-bm-mapcell' }, h('div', { class: 'tx-bm-mapframe checker' }, canvas, unused)),
    h('span', { class: 'tx-bm-axis tx-bm-axis-x', 'aria-hidden': 'true' }, h('span', null, icon('arrow-left', { size: 16 }), tb.warm), h('span', null, tb.cold, icon('arrow-right', { size: 16 }))),
  );
  const pickedSwatch = h('span', { class: 'tx-bm-swatch', 'aria-hidden': 'true' });
  const pickedName = h('strong', { class: 'tx-bm-pickedname' });
  const pickedHex = h('span', { class: 'tx-bm-hex' });
  const pickedCell = h('span', { class: 'faint small' });
  const pickedNote = h('p', { class: 'tx-inline-note tx-bm-own', hidden: true });
  const blocksRow = h('div', { class: 'tx-bm-blocks' });
  const blocksLabel = h('span', { class: 'tx-bm-blockslabel faint small' });
  const picked = h(
    'div',
    { class: 'tx-bm-picked', 'aria-live': 'polite' },
    h('div', { class: 'tx-bm-pickedhead' }, pickedSwatch, h('span', { class: 'tx-bm-pickedtext' }, pickedName, h('span', { class: 'tx-bm-pickedsub' }, pickedHex, pickedCell))),
    pickedNote,
    blocksLabel,
    blocksRow,
  );
  const list = h('div', { class: 'tx-bm-list', role: 'group', 'aria-label': tb.biomes });
  const listHint = h('p', { class: 'faint small' });
  const canvasToggle = toggle({ label: tb.onCanvas, value: markersOnCanvas(), onChange: (v) => setMarkersOnCanvas(v) });
  const sizeNote = h('p', { class: 'tx-inline-note warn', hidden: true });
  const notesList = h('ul', { class: 'tx-bm-notes' });
  const notes = h('section', { class: 'tx-pv-section tx-bm-notesection' }, h('h3', { class: 'section-title' }, icon('info'), tb.notesTitle), notesList);
  const el = h(
    'section',
    { class: 'tx-bm', hidden: true, 'aria-label': tb.title },
    h('h3', { class: 'section-title' }, icon('tree'), tb.title),
    uses,
    sizeNote,
    mapBox,
    picked,
    h('section', { class: 'tx-pv-section' }, h('h3', { class: 'section-title' }, icon('map'), tb.biomes), listHint, list, canvasToggle),
    notes,
  );

  // ---------------------------------------------------------------- the map
  const src = document.createElement('canvas');
  function paintSource() {
    if (!img) return;
    paintCanvas(src, createImageData(img.width, img.height, new Uint8ClampedArray(img.data)));
  }

  function draw() {
    if (!img || !size) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, size, size);
    const s = size / MAP_PX;
    drawMarkers(ctx, (x, y) => [x * s, y * s], s, markers, selected(), { size: size >= 240 ? 7 : 6 });
  }

  const ro = new ResizeObserver(() => {
    const box = mapBox.querySelector<HTMLElement>('.tx-bm-mapcell');
    const w = box?.clientWidth ?? 0;
    const next = Math.max(160, Math.min(320, Math.floor(w)));
    if (w && next !== size) {
      size = next;
      draw();
    }
  });
  ro.observe(mapBox);

  const mapPoint = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * MAP_PX, ((e.clientY - r.top) / r.height) * MAP_PX];
  };
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = mapPoint(e);
    const m = markerAt(markers, x, y, (12 / Math.max(1, size)) * MAP_PX);
    if (m === hover) return;
    hover = m;
    canvas.style.cursor = m ? 'pointer' : '';
    canvas.title = m ? m.biomes.map((b) => (b.reads ? names()[b.id] : `${names()[b.id]} (${tb.ignores})`)).join(', ') : '';
  });
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    canvas.title = '';
  });
  canvas.addEventListener('click', (e) => {
    const [x, y] = mapPoint(e as PointerEvent);
    const m = markerAt(markers, x, y, ((e as PointerEvent).pointerType === 'touch' ? 20 : 12) / Math.max(1, size) * MAP_PX);
    if (!m) return;
    // a marker of several biomes: each click picks the next
    const i = m.biomes.findIndex((b) => b.id === selected());
    pick(m.biomes[(i + 1) % m.biomes.length].id);
  });

  function pick(id: BiomeId) {
    models.setPreviewBiome(id);
    paintAll();
  }

  // ---------------------------------------------------------------- the picked biome
  const mapsNow = (): Partial<Record<ColorMap, MapImage>> => (map && img ? { ...others, [map]: img } : others);

  /** How the picked biome's colour for this map comes about, and the colour */
  function colourOf(id: BiomeId): { rgb: RGB; look: Look; looks: BiomeLooks } | null {
    if (!map) return null;
    const looks = biomeLooks(id, edition, version);
    // (the colour of the plants this map colours: Bedrock's swamp maps are only read in swamps)
    const look = looks?.[LOOK_OF[map]];
    if (!looks || !look) return null;
    return { rgb: lookColor(look, looks.climate, mapsNow()), look, looks };
  }

  function paintPicked() {
    const id = selected();
    const c = colourOf(id);
    if (!c || !img || !map) return;
    const name = names()[id];
    pickedSwatch.style.background = css(c.rgb);
    pickedName.textContent = name;
    pickedHex.textContent = rgbHex(c.rgb);
    const cell = biomeCell(c.looks);
    const reads = (c.look.kind === 'map' || c.look.kind === 'mix') && c.look.map === map;
    pickedCell.textContent = reads ? ` · ${fmt(tb.pixel, { x: cell.x, y: cell.y })}` : '';
    pickedNote.hidden = reads && c.look.kind !== 'mix';
    if (c.look.kind === 'fixed') pickedNote.replaceChildren(icon('info'), h('span', null, fmt(tb.ownColour, { biome: name, hex: rgbHex(c.rgb) })));
    else if (c.look.kind === 'noise') pickedNote.replaceChildren(icon('info'), h('span', null, fmt(tb.noiseColour, { biome: name, a: rgbHex(c.look.rgb[0]), b: rgbHex(c.look.rgb[1]) })));
    else if (c.look.kind === 'mix') pickedNote.replaceChildren(icon('info'), h('span', null, fmt(tb.mixColour, { biome: name, other: rgbHex(c.look.with), hex: rgbHex(c.rgb) })));
    else if (!reads) pickedNote.replaceChildren(icon('info'), h('span', null, fmt(tb.ownColour, { biome: name, hex: rgbHex(c.rgb) })));
    blocksLabel.textContent = fmt(tb.inBiome, { biome: name });
    paintBlocks(c.looks);
  }

  // ---------------------------------------------------------------- blocks coloured like the biome
  const texIds = edition === 'java' ? JAVA_TEX : BEDROCK_TEX;
  const root = edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
  const pathOf = (ids: readonly string[]): string | null => {
    for (const id of ids) for (const ext of ['.png', '.tga']) if (store.byPath.has(root + id + ext)) return root + id + ext;
    return null;
  };

  type Tinted = 'grass' | 'foliage' | 'dry_foliage' | 'birch' | 'evergreen';
  /** The blocks shown for a map (`name`: its label): the one it colours first, then a grass block or oak leaves */
  function blocksFor(m: ColorMap): { name: ColorMap; tint: Tinted; kind: 'grass' | 'leaves' | 'litter'; ids: readonly string[] }[] {
    const grass = { name: 'grass' as ColorMap, tint: 'grass' as const, kind: 'grass' as const, ids: texIds.grassTop };
    const oak = { name: 'foliage' as ColorMap, tint: 'foliage' as const, kind: 'leaves' as const, ids: texIds.oak };
    switch (m) {
      case 'grass':
      case 'swamp_grass':
        return [grass, oak];
      case 'foliage':
      case 'swamp_foliage':
        return [oak, grass];
      case 'mangrove_swamp_foliage':
        return [{ ...oak, name: m, ids: texIds.mangrove }, grass];
      case 'birch':
        return [{ name: m, tint: 'birch', kind: 'leaves', ids: texIds.birch }, grass];
      case 'evergreen':
        return [{ name: m, tint: 'evergreen', kind: 'leaves', ids: texIds.spruce }, grass];
      case 'dry_foliage':
        return [{ name: m, tint: 'dry_foliage', kind: 'litter', ids: texIds.litter }, oak];
    }
  }

  async function loadBlockTextures(m: ColorMap) {
    const want = new Set<string>();
    for (const b of blocksFor(m)) {
      for (const ids of b.kind === 'grass' ? [texIds.grassTop, texIds.grassSide, texIds.grassOverlay] : [b.ids]) {
        const p = pathOf(ids);
        if (p) want.add(p);
      }
    }
    const out = new Map<string, ImageData | null>();
    await Promise.all(
      [...want].map(async (p) => {
        try {
          out.set(p, firstSquare(await store.getFull(p)));
        } catch {
          out.set(p, null);
        }
      }),
    );
    return out;
  }

  const tex = (ids: readonly string[]): ImageData | null => {
    const p = pathOf(ids);
    return p ? (blockTex.get(p) ?? null) : null;
  };
  const toImage = (r: RGBAImage): ImageData => createImageData(r.width, r.height, new Uint8ClampedArray(r.data));

  function paintBlocks(looks: BiomeLooks) {
    if (!map) return;
    const t = biomeTints(looks, mapsNow());
    const tiles: HTMLElement[] = [];
    for (const b of blocksFor(map)) {
      const c = t[b.tint];
      let pic: ImageData | null = null;
      if (b.kind === 'grass') {
        const top = tex(texIds.grassTop);
        const side = tex(texIds.grassSide);
        if (top && side) {
          const topT = toImage(tintImage(top, c));
          const overlay = tex(texIds.grassOverlay);
          const sideT = edition === 'bedrock' ? toImage(tintByAlphaMask(side, c)) : overlay ? toImage(compositeOverlay(side, overlay, c)) : side;
          pic = renderIsoCube(topT, sideT, 96);
        }
      } else {
        const leaf = tex(b.ids);
        if (leaf) {
          const tinted = toImage(tintImage(leaf, c));
          pic = b.kind === 'litter' ? tinted : renderIsoCube(tinted, tinted, 96);
        }
      }
      if (!pic) continue;
      const cv = h('canvas', { class: ['tx-bm-block', b.kind === 'litter' && 'pixelated'], 'aria-hidden': 'true' });
      paintCanvas(cv, pic);
      tiles.push(h('figure', { class: 'tx-bm-tile' }, h('span', { class: 'tx-bm-tilebox' }, cv), h('figcaption', null, (tb.blocks as Record<ColorMap, string>)[b.name])));
    }
    blocksRow.replaceChildren(...tiles);
    blocksRow.hidden = !tiles.length;
    blocksLabel.hidden = !tiles.length;
  }

  // ---------------------------------------------------------------- the list
  function paintList() {
    if (!map) return;
    const sel = selected();
    const chips = biomesOf(edition, version).map((id) => {
      const c = colourOf(id);
      const reads = !!c && (c.look.kind === 'map' || c.look.kind === 'mix') && c.look.map === map;
      const sw = h('span', { class: ['tx-bm-chipswatch', !reads && 'is-own'], style: c ? { background: css(c.rgb) } : undefined, 'aria-hidden': 'true' });
      const b = h('button', { type: 'button', class: 'chip tx-bm-chip', 'aria-pressed': String(id === sel), dataset: { biome: id } }, sw, h('span', null, names()[id]));
      if (c) tooltip(b, `${fmt(tb.colourHere, { biome: names()[id], hex: rgbHex(c.rgb) })}${reads ? '' : ` (${tb.ignores})`}`);
      b.addEventListener('click', () => pick(id));
      return b;
    });
    list.replaceChildren(...chips);
    listHint.textContent = byPointer(tb.pickHint, tb.pickHintTouch);
  }

  // ---------------------------------------------------------------- notes
  function paintNotes() {
    if (!map) return;
    const items: string[] = [];
    const fixedIn = (key: 'grass' | 'foliage' | 'dry'): string[] =>
      biomesOf(edition, version)
        .filter((id) => biomeLooks(id, edition, version)?.[key]?.kind === 'fixed')
        .map((id) => names()[id]);
    const java = edition === 'java';
    const kind = LOOK_OF[map];
    if (java) {
      if (kind === 'grass') {
        if (javaAtLeast(version, '1.7')) items.push(tb.notes.swampNoise, tb.notes.darkMix);
        else items.push(tb.notes.swampMix);
      } else if (kind === 'foliage' && !javaAtLeast(version, '1.7')) items.push(tb.notes.swampMix);
      const fixed = kind === 'grass' || kind === 'foliage' || kind === 'dry' ? fixedIn(kind) : [];
      if (fixed.length) items.push(fmt(tb.notes.fixed, { biomes: joinList(fixed) }));
      if (kind === 'foliage') items.push(tb.notes.spruceBirch, tb.notes.inventoryLeaves);
      if (kind === 'grass') items.push(tb.notes.inventoryGrass);
    } else {
      if (map === 'grass') items.push(tb.notes.bedrockSwampGrass, tb.notes.darkShaded);
      if (map === 'foliage') items.push(tb.notes.bedrockSwampFoliage, tb.notes.bedrockLeaves);
      const fixed = map === 'grass' || map === 'foliage' || map === 'dry_foliage' ? fixedIn(kind === 'dry' ? 'dry' : (kind as 'grass' | 'foliage')) : [];
      if (fixed.length) items.push(fmt(tb.notes.fixed, { biomes: joinList(fixed) }));
    }
    items.push(java && !javaAtLeast(version, '1.13') ? tb.notes.waterOld : tb.notes.water);
    notesList.replaceChildren(...items.map((t) => h('li', null, t)));
  }

  function paintAll() {
    if (!map || !img) return;
    draw();
    paintPicked();
    paintList();
  }

  const offBiome = models.events.on('biome', () => {
    if (!el.hidden) paintAll();
  });

  return {
    el,
    show(t) {
      const m = t ? colorMapOf(t.key, edition, version) : null;
      el.hidden = !m;
      if (!m || !t) {
        map = null;
        path = '';
        return false;
      }
      const fresh = t.key !== path;
      map = m;
      path = t.key;
      img = t.full;
      markers = mapMarkers(edition, version, m);
      uses.textContent = `${(tb.uses as Record<ColorMap, string>)[m]} ${tb.how}`;
      sizeNote.hidden = mapIsGameSize(t.full);
      if (!sizeNote.hidden) sizeNote.replaceChildren(icon('warning'), h('span', null, fmt(tb.size, { width: t.full.width, height: t.full.height })));
      canvasToggle.setValue(markersOnCanvas());
      paintNotes();
      paintSource();
      paintAll();
      if (fresh) {
        others = {};
        blockTex = new Map();
        const my = path;
        void Promise.all([models.colorMaps(false), loadBlockTextures(m)]).then(([maps, texs]) => {
          if (destroyed || path !== my) return;
          delete maps[m];
          others = maps;
          blockTex = texs;
          paintAll();
        });
      }
      return true;
    },
    update(full) {
      if (!map) return;
      img = full;
      sizeNote.hidden = mapIsGameSize(full);
      paintSource();
      paintAll();
    },
    destroy() {
      destroyed = true;
      ro.disconnect();
      offBiome();
    },
  };
}
