// Start screen at #/textures: new pack form, open an existing pack, and the recent texture packs.

import type { Edition, TexturePackProject } from '../../../core/types';
import { h, timeAgo } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { badge, button, emptyState, openMenu, segmented, spinner, textInput } from '../../../ui/components';
import { dropzone } from '../../../ui/dropzone';
import { openModal, confirmDialog, promptDialog } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { versionPicker } from '../../../ui/version-picker';
import { DEFAULT_JAVA_VERSION, bedrockDisplayVersion, getDefaultVersion } from '../../../editions/index';
import { deleteProject, listProjects, saveProject } from '../../../core/storage';
import { currentRoute, navigate, href as routeHref, type RouteContext } from '../../../core/router';
import { friendlyError } from '../../../core/net';
import { uuidv4 } from '../../../core/uuid';
import { siteFooter } from '../../../app/footer';
import { importPack } from '../import';
import { newBedrockUuids, newTextureProject } from '../project';
import { resolutionSentence } from './pack-panel';
import { plainText } from './mc-text';
import { decodeImage, resizeNearest } from '../../../core/image';
import { proceduralTexture, toImageData, type ProceduralTextureName } from '../../../shared/preview/procedural-textures';
import { applyEffects, getPreset } from '../effects';
import { renderIsoCube } from '../export';
import { firstSquare } from './meta';
import { paintCanvas } from './thumbs';

const START_RES = [16, 32, 64, 128];

function versionLabel(p: TexturePackProject): string {
  if (p.edition === 'java') return `Java ${p.version}`;
  return `Bedrock ${p.version === 'latest' ? 'latest' : p.version === 'preview' ? 'preview' : bedrockDisplayVersion(p.version)}`;
}

function hashHue(s: string): number {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  return x % 360;
}

const proc = (n: ProceduralTextureName) => firstSquare(toImageData(proceduralTexture(n)));

/** An original iso block (procedural art), optionally restyled by a preset. */
function isoBlock(top: ProceduralTextureName, side: ProceduralTextureName, preset: string | null, size: number): HTMLCanvasElement {
  const layers = preset ? getPreset(preset)?.layers ?? [] : [];
  const fx = (n: ProceduralTextureName) => applyEffects(proc(n), layers, { path: `assets/minecraft/textures/block/${n}.png`, category: 'block', animated: false });
  const c = document.createElement('canvas');
  c.className = 'pixelated';
  paintCanvas(c, renderIsoCube(fx(top), fx(side), size));
  return c;
}

function heroArt(): HTMLElement {
  const items: [ProceduralTextureName, ProceduralTextureName, string | null, string][] = [
    ['grass_top', 'grass_side', null, 'Original'],
    ['grass_top', 'grass_side', 'autumn', 'Autumn'],
    ['grass_top', 'grass_side', 'winter-frost', 'Winter Frost'],
    ['oak_planks', 'oak_planks', 'neon-outline', 'Neon Outline'],
    ['cobblestone', 'cobblestone', 'cartoon', 'Cartoon'],
    ['oak_log_top', 'oak_log', 'game-boy', 'Game Boy'],
  ];
  return h(
    'div',
    { class: 'tx-hero-art', 'aria-hidden': 'true' },
    items.map(([t, sd, preset, label], i) => h('figure', { class: 'tx-hero-cube', style: { '--i': i } }, isoBlock(t, sd, preset, 64), h('figcaption', null, label))),
  );
}

/** Up to four of the pack's own edited textures, or an original block restyled with the pack's effects. */
async function drawProjectThumb(p: TexturePackProject, canvas: HTMLCanvasElement): Promise<void> {
  const paths = Object.keys(p.overrides ?? {})
    .filter((k) => /\/(block|blocks|item|items)\//.test(k))
    .slice(0, 4);
  if (paths.length) {
    const out = new ImageData(64, 64);
    const imgs = await Promise.all(paths.map((k) => decodeImage(p.overrides[k], k.split('.').pop()).then(firstSquare).catch(() => null)));
    const cells = imgs.filter((x): x is ImageData => !!x);
    if (cells.length) {
      const n = cells.length === 1 ? 1 : 2;
      const cell = 64 / n;
      cells.slice(0, n * n).forEach((img, i) => {
        const r = resizeNearest(img, cell, cell);
        const ox = (i % n) * cell;
        const oy = Math.floor(i / n) * cell;
        for (let y = 0; y < cell; y++) out.data.set(r.data.subarray(y * cell * 4, (y + 1) * cell * 4), ((oy + y) * 64 + ox) * 4);
      });
      paintCanvas(canvas, out);
      return;
    }
  }
  const fx = (n: ProceduralTextureName) => applyEffects(proc(n), p.effects ?? [], { path: `block/${n}.png`, category: 'block', animated: false });
  paintCanvas(canvas, renderIsoCube(fx('grass_top'), fx('grass_side'), 64));
}

/** Original fallback thumbnail: a small seeded pixel pattern in the pack's hue. */
function patternThumb(seed: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  c.className = 'pixelated';
  const ctx = c.getContext('2d')!;
  const hue = hashHue(seed);
  let x = hashHue(seed + 'x') + 7;
  const rnd = () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
  for (let yy = 0; yy < 8; yy++)
    for (let xx = 0; xx < 8; xx++) {
      const l = 28 + Math.floor(rnd() * 4) * 7;
      ctx.fillStyle = `hsl(${hue} 45% ${l}%)`;
      ctx.fillRect(xx, yy, 1, 1);
    }
  return c;
}

export function renderStartScreen(root: HTMLElement, ctx: RouteContext): () => void {
  const urls: string[] = [];
  let edition: Edition = ctx.query.get('edition') === 'bedrock' ? 'bedrock' : 'java';
  let version = edition === 'java' ? DEFAULT_JAVA_VERSION : 'latest';
  let resolution = 16;
  let name = '';
  let description = '';
  let alive = true;

  // ---------------------------------------------------------------- new pack form
  const nameField = textInput({ label: 'Pack name', value: '', placeholder: 'My Awesome Pack', maxLength: 80, onInput: (v) => (name = v), onEnter: () => void create() });
  nameField.classList.add('tx-name-field');
  const editionHint = h('p', { class: 'field-desc' });
  const paintEditionHint = () => {
    editionHint.textContent = edition === 'java' ? 'For Minecraft on Windows, Mac and Linux computers.' : 'For phones, tablets, consoles and Windows (the version with Marketplace).';
  };
  const picker = versionPicker({
    edition,
    value: version,
    label: 'Game version',
    onChange: (_e, v) => (version = v),
  });
  const editionSeg = segmented<Edition>({
    value: edition,
    label: 'Edition',
    options: [
      { value: 'java', label: 'Java', icon: 'laptop' },
      { value: 'bedrock', label: 'Bedrock', icon: 'gamepad' },
    ],
    onChange: (e) => {
      edition = e;
      version = e === 'java' ? DEFAULT_JAVA_VERSION : 'latest';
      picker.setValue(e, version);
      void getDefaultVersion(e)
        .then((v) => {
          if (edition === e && alive) {
            version = v;
            picker.setValue(e, v);
          }
        })
        .catch(() => undefined);
      paintEditionHint();
    },
  });
  paintEditionHint();

  const resChips = h('div', { class: 'tx-res-chips', role: 'radiogroup', 'aria-label': 'Resolution' });
  const resText = h('p', { class: 'field-desc tx-res-text' });
  const paintRes = () => {
    resChips.replaceChildren(
      ...START_RES.map((r) => {
        const on = r === resolution;
        const b = h('button', { type: 'button', class: 'chip tx-res-chip', role: 'radio', 'aria-checked': String(on), 'aria-pressed': String(on), tabIndex: on ? 0 : -1 }, `${r}×`);
        b.addEventListener('click', () => {
          resolution = r;
          paintRes();
          (resChips.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus();
        });
        b.addEventListener('keydown', (e) => {
          const i = START_RES.indexOf(resolution);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            resolution = START_RES[(i + (e.key === 'ArrowRight' ? 1 : -1) + START_RES.length) % START_RES.length];
            paintRes();
            (resChips.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus();
          }
        });
        return b;
      }),
    );
    resText.textContent = resolutionSentence(resolution);
  };
  paintRes();

  const descField = textInput({ label: 'Description (optional)', value: '', placeholder: 'Made with Texture Pack Maker', multiline: true, maxLength: 200, onInput: (v) => (description = v) });
  const createBtn = button({ label: 'Create pack', icon: 'arrow-right', variant: 'primary', size: 'lg', class: 'tx-create-btn', onClick: () => void create() });

  async function create() {
    if (createBtn.disabled) return;
    createBtn.disabled = true;
    try {
      const p = newTextureProject({ name: name.trim() || 'My Texture Pack', edition, version: version || (edition === 'java' ? DEFAULT_JAVA_VERSION : 'latest'), resolution, description });
      await saveProject(p);
      navigate(`/textures/${p.id}`);
    } catch (err) {
      console.error(err);
      toast(friendlyError(err, "Couldn't create the pack"), { tone: 'error' });
      createBtn.disabled = false;
    }
  }

  const field = (label: string, ...children: Node[]) => h('div', { class: 'field' }, h('span', { class: 'field-label' }, label), ...children);
  const newCard = h(
    'section',
    { class: 'card tx-new', 'aria-labelledby': 'tx-new-title' },
    h('div', { class: 'tx-card-head' }, h('span', { class: 'tx-card-icon' }, icon('plus')), h('div', null, h('h2', { id: 'tx-new-title' }, 'New texture pack'), h('p', { class: 'muted' }, 'Start from the vanilla textures and make them yours.'))),
    h(
      'div',
      { class: 'tx-new-body' },
      nameField,
      field('Edition', editionSeg, editionHint),
      picker,
      field('Resolution', resChips, resText),
      descField,
      createBtn,
    ),
  );

  // ---------------------------------------------------------------- open existing
  const busy = h('div', { class: 'tx-open-busy', hidden: true }, spinner(32), h('span', null, 'Opening pack…'));
  const dz = dropzone({
    accept: '.zip,.mcpack,.mcaddon',
    label: 'Drop a pack here or click to browse',
    hint: '.zip for Java · .mcpack or .mcaddon for Bedrock',
    icon: 'folder',
    onFiles: (files) => void openFile(files[0]),
  });
  dz.classList.add('tx-open-dz');
  const openCard = h(
    'section',
    { class: 'card tx-open', 'aria-labelledby': 'tx-open-title' },
    h('div', { class: 'tx-card-head' }, h('span', { class: 'tx-card-icon' }, icon('folder')), h('div', null, h('h2', { id: 'tx-open-title' }, 'Open a pack'), h('p', { class: 'muted' }, 'Keep editing a pack you made here or anywhere else.'))),
    h('div', { class: 'tx-open-body' }, dz, busy),
  );

  async function openFile(file: File | undefined) {
    if (!file) return;
    dz.setError(null);
    busy.hidden = false;
    dz.classList.add('is-busy');
    try {
      const { project, warnings } = await importPack(file);
      await saveProject(project);
      if (!alive) return;
      if (warnings.length) {
        openModal({
          title: 'Pack opened',
          width: 520,
          body: h(
            'div',
            { class: 'stack' },
            h('p', null, `“${plainText(project.name)}” is ready to edit (${versionLabel(project)}, ${Object.keys(project.overrides).length} textures). A few things to know:`),
            h('ul', { class: 'tx-warn-list' }, warnings.map((w) => h('li', null, w))),
          ),
          actions: [{ label: 'Open in editor', variant: 'primary', onClick: () => navigate(`/textures/${project.id}`) }],
          onClose: () => {
            {
              const here = currentRoute()?.path ?? '';
              if (here.startsWith('/textures') && !here.includes(project.id)) void renderRecent();
            }
          },
        });
      } else {
        toast(`Opened “${plainText(project.name)}”`, { tone: 'success' });
        navigate(`/textures/${project.id}`);
      }
    } catch (err) {
      console.error(err);
      dz.setError(friendlyError(err));
    } finally {
      busy.hidden = true;
      dz.classList.remove('is-busy');
    }
  }

  const steps = h(
    'ol',
    { class: 'tx-howto' },
    [
      ['image', 'Pick', 'Browse every vanilla texture — blocks, items, mobs, GUI and more.'],
      ['brush', 'Paint', 'Draw pixels, upload pictures or add one-click effects to everything.'],
      ['download', 'Export', 'Get a ready-to-install pack for Java or Bedrock.'],
    ].map(([ic, t, d], i) => h('li', null, h('span', { class: 'tx-howto-n' }, String(i + 1)), h('span', { class: 'tx-howto-icon' }, icon(ic as 'image')), h('span', { class: 'tx-howto-text' }, h('strong', null, t), h('span', { class: 'faint small' }, d)))),
  );

  // ---------------------------------------------------------------- recent
  const recentGrid = h('div', { class: 'tx-recent-grid' });
  const recentCount = h('span', { class: 'tx-count-pill' });
  const recent = h(
    'section',
    { class: 'container tx-recent', 'aria-labelledby': 'tx-recent-title' },
    h('div', { class: 'tx-recent-head' }, h('h2', { id: 'tx-recent-title' }, 'Your texture packs'), recentCount, h('span', { class: 'grow' }), h('span', { class: 'faint small tx-recent-note' }, icon('lock', { size: 16 }), 'Saved in this browser only')),
    recentGrid,
  );

  const thumbFor = (p: TexturePackProject): HTMLElement => {
    const box = h('div', { class: 'tx-rc-thumb checker' });
    if (p.icon instanceof Blob) {
      const url = URL.createObjectURL(p.icon);
      urls.push(url);
      const img = h('img', { src: url, alt: '', class: 'pixelated', loading: 'lazy' });
      img.addEventListener('error', () => box.replaceChildren(patternThumb(p.id)));
      box.appendChild(img);
    } else {
      const c = h('canvas', { class: 'pixelated' });
      box.appendChild(c);
      void drawProjectThumb(p, c).catch(() => box.replaceChildren(patternThumb(p.id)));
    }
    return box;
  };

  async function renderRecent() {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    let list: TexturePackProject[] = [];
    try {
      list = (await listProjects('texturepack')) as TexturePackProject[];
    } catch {
      list = [];
    }
    if (!alive) return;
    recentCount.textContent = String(list.length);
    recentCount.hidden = !list.length;
    if (!list.length) {
      recentGrid.replaceChildren(
        h('div', { class: 'tx-recent-empty' }, emptyState({ icon: 'folder-plus', title: 'No packs yet', text: 'Packs you create or open show up here, so you can pick up where you left off.' })),
      );
      return;
    }
    recentGrid.replaceChildren(
      ...list.map((p) => {
        const edited = Object.keys(p.overrides ?? {}).length;
        const fx = (p.effects ?? []).filter((l) => l.enabled).length;
        const menuBtn = h('button', { type: 'button', class: 'icon-btn sm tx-rc-menu', 'aria-label': `More actions for ${plainText(p.name)}`, 'aria-haspopup': 'menu' }, icon('more-vertical'));
        menuBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openMenu(menuBtn, [
            { label: 'Open', icon: 'pencil', onClick: () => navigate(`/textures/${p.id}`) },
            { label: 'Rename', icon: 'pen-square', onClick: () => void rename(p) },
            { label: 'Duplicate', icon: 'copy', onClick: () => void duplicate(p) },
            { label: 'Delete', icon: 'trash', danger: true, onClick: () => void remove(p) },
          ]);
        });
        return h(
          'article',
          { class: 'tx-rc' },
          h(
            'a',
            { class: 'tx-rc-link', href: routeHref(`/textures/${encodeURIComponent(p.id)}`) },
            thumbFor(p),
            h(
              'span',
              { class: 'tx-rc-info' },
              h('span', { class: 'tx-rc-name truncate' }, plainText(p.name) || 'Untitled'),
              h('span', { class: 'tx-rc-badges' }, badge(versionLabel(p), p.edition === 'java' ? 'green' : 'blue'), p.resolution > 16 ? badge(`${p.resolution}×`, 'gray') : null),
              h('span', { class: 'tx-rc-meta faint small truncate' }, `${edited} edited${fx ? ` · ${fx} effect${fx === 1 ? '' : 's'}` : ''}`),
              h('span', { class: 'tx-rc-time faint small' }, `Edited ${timeAgo(p.updatedAt || p.createdAt)}`),
            ),
          ),
          menuBtn,
        );
      }),
    );
  }

  async function rename(p: TexturePackProject) {
    const n = await promptDialog('Rename pack', 'Pack name', p.name, { confirmLabel: 'Rename', maxLength: 80 });
    if (!n || n === p.name) return;
    p.name = n;
    try {
      await saveProject(p);
      toast('Pack renamed', { tone: 'success' });
    } catch (err) {
      toast(friendlyError(err, "Couldn't rename the pack"), { tone: 'error' });
    }
    void renderRecent();
  }

  async function duplicate(p: TexturePackProject) {
    const now = Date.now();
    const copy: TexturePackProject = {
      ...p,
      id: uuidv4(),
      name: `${p.name} (copy)`,
      createdAt: now,
      updatedAt: now,
      overrides: { ...p.overrides },
      extraFiles: { ...p.extraFiles },
      effects: p.effects.map((l) => ({ ...l, id: uuidv4().slice(0, 8), params: { ...l.params }, ...(l.categories ? { categories: [...l.categories] } : {}) })),
      ...(p.compat ? { compat: { ...p.compat } } : {}),
    };
    if (p.edition === 'bedrock') {
      copy.bedrockUuids = newBedrockUuids();
      delete copy.packVersion;
    }
    try {
      await saveProject(copy);
      toast(`Made a copy of “${plainText(p.name)}”`, { tone: 'success' });
    } catch (err) {
      toast(friendlyError(err, "Couldn't copy the pack"), { tone: 'error' });
    }
    void renderRecent();
  }

  async function remove(p: TexturePackProject) {
    const ok = await confirmDialog('Delete this pack?', `“${plainText(p.name)}” will be removed from this browser.`, 'Delete', true);
    if (!ok) return;
    try {
      await deleteProject(p.id);
      void renderRecent();
      toast(`Deleted “${plainText(p.name)}”`, {
        action: {
          label: 'Undo',
          onClick: () =>
            void saveProject(p)
              .then(() => renderRecent())
              .catch(() => toast("Couldn't restore the pack.", { tone: 'error' })),
        },
      });
    } catch {
      toast("Couldn't delete the pack.", { tone: 'error' });
    }
  }

  // ---------------------------------------------------------------- page
  const page = h(
    'div',
    { class: 'tx-start accent-green' },
    h(
      'header',
      { class: 'container tx-start-hero' },
      h(
        'div',
        { class: 'tx-hero-text' },
        h('span', { class: 'eyebrow' }, icon('image'), 'Texture Pack Maker'),
        h('h1', { class: 'pixel-shadow' }, 'Make Minecraft look ', h('span', { class: 'accent' }, 'your'), ' way'),
        h('p', { class: 'lead' }, 'Repaint any block, item or mob, upload your own pictures, or restyle everything with one click. Works for Java and Bedrock.'),
      ),
      heroArt(),
    ),
    h('div', { class: 'container tx-start-grid' }, newCard, h('div', { class: 'tx-start-side' }, openCard, h('section', { class: 'card tx-howto-card' }, h('h3', { class: 'section-title' }, icon('info'), 'How it works'), steps))),
    recent,
    siteFooter(),
  );
  root.appendChild(page);
  void renderRecent();

  return () => {
    alive = false;
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
}
