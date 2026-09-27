// Right panel "Pack" tab: name, description (with § formatting preview), icon, game version and
// Java compatibility range (pack format numbers + warnings), resolution, Bedrock ids, danger zone.

import type { PackFormat } from '../../../core/types';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { button, card, textInput, toggle, tooltip } from '../../../ui/components';
import { confirmDialog } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { versionPicker, editionName } from '../../../ui/version-picker';
import { formatPackFormat } from '../../../ui/format';
import { timeAgo } from '../../../ui/dom';
import { decodeImage, fitToSize, encodePng, createImageData } from '../../../core/image';
import { deleteProject } from '../../../core/storage';
import { navigate } from '../../../core/router';
import { bedrockDisplayVersion, bumpPackVersion, getJavaPackFormat } from '../../../editions/index';
import { buildPackMcmetaForVersions, describePackForGame } from '../../../editions/java/packmeta';
import { effectiveCompat, renderIsoCube } from '../export';
import { RESOLUTIONS, newBedrockUuids } from '../project';
import { firstSquare, getFrame, planCube, transparentShare } from './meta';
import { formattedText, plainText, FORMAT_CODES } from './mc-text';
import { paintCanvas } from './thumbs';
import { packIconImage } from './icon';
import { ICON_KEY, type TexStore } from './store';
import type { OpenTexture } from './canvas-panel';

export interface PackPanel {
  el: HTMLElement;
  setVisible(v: boolean): void;
  destroy(): void;
}

export interface PackPanelOptions {
  store: TexStore;
  current(): OpenTexture | null;
  paintIcon(): void;
  /** The game version changed: the editor must load that version's textures */
  reload(): void;
}

export function resolutionSentence(r: number): string {
  if (r <= 16) return '16× is the classic Minecraft look: every block face is 16×16 pixels, just like the original game.';
  const detail = r === 32 ? 'twice' : r === 64 ? '4 times' : r === 128 ? '8 times' : r === 256 ? '16 times' : '32 times';
  return `${r}× gives each block face ${r}×${r} pixels — ${detail} the detail. Textures are scaled up when you start editing them, so you can add finer details.`;
}

export function createPackPanel(opts: PackPanelOptions): PackPanel {
  const { store } = opts;
  const project = store.project;
  const java = project.edition === 'java';
  const offs: (() => void)[] = [];

  // ---- in-game preview ----
  const pvIcon = h('canvas', { class: 'tx-mc-icon pixelated', width: 64, height: 64 });
  const pvName = h('div', { class: 'tx-mc-name' });
  const pvDesc = h('div', { class: 'tx-mc-desc' });
  const mcPreview = h(
    'div',
    { class: 'tx-mc-entry', role: 'img', 'aria-label': 'How the pack looks in the game menu' },
    h('div', { class: 'tx-mc-iconbox' }, pvIcon),
    h('div', { class: 'tx-mc-text' }, pvName, pvDesc),
  );
  const paintPreview = () => {
    pvName.replaceChildren(formattedText(project.name || 'Untitled pack', '#ffffff'));
    pvDesc.replaceChildren(formattedText(project.description || '', '#a8a8a8'));
  };

  // ---- name / description ----
  const nameField = textInput({
    label: 'Pack name',
    value: project.name,
    maxLength: 80,
    placeholder: 'My Texture Pack',
    onInput: (v) => {
      project.name = v.trim() || 'Untitled pack';
      paintPreview();
      store.touch('meta');
    },
  });
  const descField = textInput({
    label: 'Description',
    value: project.description,
    multiline: true,
    maxLength: 200,
    placeholder: 'Made with Texture Pack Maker',
    description: java ? 'Shown under the name in the Resource Packs menu. Two short lines fit best.' : 'Shown under the name in Global Resources.',
    onInput: (v) => {
      project.description = v;
      paintPreview();
      store.touch('meta');
    },
  });
  const desc = descField.input as HTMLTextAreaElement;
  const insertCode = (code: string) => {
    const s = desc.selectionStart ?? desc.value.length;
    const e = desc.selectionEnd ?? s;
    desc.value = desc.value.slice(0, s) + '§' + code + desc.value.slice(e);
    desc.setSelectionRange(s + 2, s + 2);
    desc.focus();
    desc.dispatchEvent(new Event('input'));
  };
  const codeRow = h(
    'div',
    { class: 'tx-codes', role: 'group', 'aria-label': 'Insert a formatting code' },
    FORMAT_CODES.map((c) => {
      const b = h(
        'button',
        { type: 'button', class: ['tx-code', c.color ? 'is-color' : 'is-style'], style: c.color ? { '--c': c.color } : undefined, 'aria-label': `${c.label} (§${c.code})` },
        c.color ? null : h('span', { class: `tx-code-${c.code}` }, c.glyph ?? c.code.toUpperCase()),
      );
      tooltip(b, `${c.label} — §${c.code}`);
      b.addEventListener('click', () => insertCode(c.code));
      return b;
    }),
  );
  const codesWrap = h('details', { class: 'tx-codes-wrap' }, h('summary', null, icon('palette', { size: 16 }), 'Colours & styles (§ codes)'), h('p', { class: 'faint small' }, 'Click a colour or style to add it at the cursor. §r goes back to normal.'), codeRow);

  // ---- icon ----
  const iconCanvas = h('canvas', { class: 'tx-icon-pv pixelated', width: 64, height: 64 });
  const iconNote = h('span', { class: 'faint small' });
  const iconInput = h('input', { type: 'file', accept: 'image/*,.png,.tga', hidden: true });
  const fromTexBtn = button({ label: 'From texture', icon: 'image', size: 'sm', onClick: () => void iconFromCurrent() });
  const uploadIconBtn = button({ label: 'Upload', icon: 'upload', size: 'sm', onClick: () => iconInput.click() });
  const paintIconBtn = button({ label: 'Paint', icon: 'brush', size: 'sm', onClick: () => opts.paintIcon() });
  const resetIconBtn = button({ label: 'Automatic', icon: 'reset', size: 'sm', variant: 'ghost', onClick: () => store.setIconBlob(undefined) });
  tooltip(fromTexBtn, 'Make an icon from the texture that is open in the editor');
  const iconBlock = h(
    'div',
    { class: 'tx-icon-row' },
    h('div', { class: 'tx-icon-box checker' }, iconCanvas),
    h('div', { class: 'stack', style: { '--gap': '8px' } }, iconNote, h('div', { class: 'row wrap', style: { '--gap': '6px' } }, fromTexBtn, uploadIconBtn, paintIconBtn, resetIconBtn)),
    iconInput,
  );

  let iconToken = 0;
  const paintIcon = async () => {
    const my = ++iconToken;
    const { img, auto } = await packIconImage(store);
    if (my !== iconToken) return;
    for (const c of [iconCanvas, pvIcon]) {
      paintCanvas(c, img);
      const s = img.width <= 64 ? Math.floor(64 / img.width) : 64 / img.width;
      c.style.width = `${Math.round(img.width * s)}px`;
      c.style.height = `${Math.round(img.height * s)}px`;
      c.classList.toggle('pixelated', s >= 1);
    }
    iconNote.textContent = auto ? 'Automatic: a grass block drawn from your pack.' : `Your icon · ${img.width}×${img.height}`;
    resetIconBtn.hidden = auto;
  };

  iconInput.addEventListener('change', async () => {
    const f = iconInput.files?.[0];
    iconInput.value = '';
    if (!f) return;
    try {
      const img = await decodeImage(f, f.name.split('.').pop());
      const size = java ? 128 : 256;
      const small = img.width <= size && img.height <= size && size % img.width === 0;
      const fitted = fitToSize(img, size, size, small ? 'nearest' : 'smooth', 'contain');
      store.setIconBlob(new Blob([encodePng(fitted)], { type: 'image/png' }));
      toast('Pack icon updated', { tone: 'success' });
    } catch {
      toast("That file couldn't be read as an image.", { tone: 'error' });
    }
  });

  async function iconFromCurrent() {
    const t = opts.current();
    if (!t || t.key === ICON_KEY) {
      toast('Open a texture in the editor first — then press this again.', { tone: 'info' });
      return;
    }
    const frame = t.anim ? getFrame(t.full, t.anim, 0) : firstSquare(t.full);
    let out: ImageData;
    if (t.entry?.category === 'block' && transparentShare(frame) < 0.3) {
      let top = frame;
      let side = frame;
      const root = java ? 'assets/minecraft/textures/' : 'textures/';
      const plan = planCube(t.entry.id, (id) => store.byPath.has(root + id + '.png') || store.byPath.has(root + id + '.tga'), project.edition);
      const read = async (id: string) => {
        if (id === t.entry!.id) return frame;
        const p = store.byPath.has(root + id + '.png') ? root + id + '.png' : root + id + '.tga';
        return firstSquare(await store.getFull(p));
      };
      if (plan) {
        try {
          [top, side] = await Promise.all([read(plan.up), read(plan.front ?? plan.side)]);
        } catch {
          /* single texture */
        }
      }
      out = renderIsoCube(top, side, 128);
    } else {
      const s = Math.max(1, Math.floor(112 / Math.max(frame.width, frame.height)));
      const scaled = fitToSize(frame, frame.width * s, frame.height * s, 'nearest', 'stretch');
      out = createImageData(128, 128);
      const ox = Math.floor((128 - scaled.width) / 2);
      const oy = Math.floor((128 - scaled.height) / 2);
      for (let y = 0; y < scaled.height && y + oy < 128; y++) {
        out.data.set(scaled.data.subarray(y * scaled.width * 4, (y * scaled.width + Math.min(scaled.width, 128)) * 4), ((y + oy) * 128 + ox) * 4);
      }
    }
    store.setIconBlob(new Blob([encodePng(out)], { type: 'image/png' }));
    toast(`Icon made from ${t.name}`, { tone: 'success' });
  }

  // ---- version ----
  const picker = versionPicker({
    edition: project.edition,
    value: project.version,
    allowEditionChange: false,
    includeSnapshots: java && !/^\d+\.\d+(\.\d+)?$/.test(project.version),
    onChange: (_e, v) => void changeVersion(v),
  });
  async function changeVersion(v: string) {
    if (v === project.version) return;
    const ok = await confirmDialog(
      'Switch game version?',
      `The editor will load the textures of ${editionName(project.edition)} ${v === 'latest' ? 'latest' : v}. Everything you painted and all effects are kept.`,
      'Switch version',
    );
    if (!ok) {
      picker.setValue(project.edition, project.version);
      return;
    }
    project.version = v;
    store.touch('meta');
    await store.flush();
    opts.reload();
  }
  const versionHint = h('p', { class: 'field-desc' });

  // ---- compat (Java) ----
  const compatBody = h('div', { class: 'tx-compat-body stack', hidden: !project.compat });
  const compatResult = h('div', { class: 'tx-compat-result', 'aria-live': 'polite' });
  const minPicker = versionPicker({
    edition: 'java',
    value: project.compat?.minVersion ?? '1.21',
    label: 'Oldest version',
    onChange: (_e, v) => {
      project.compat = { minVersion: v, maxVersion: project.compat?.maxVersion ?? project.version };
      store.touch('meta');
      void renderCompat();
    },
  });
  const maxPicker = versionPicker({
    edition: 'java',
    value: project.compat?.maxVersion ?? project.version,
    label: 'Newest version',
    onChange: (_e, v) => {
      project.compat = { minVersion: project.compat?.minVersion ?? project.version, maxVersion: v };
      store.touch('meta');
      void renderCompat();
    },
  });
  compatBody.append(h('div', { class: 'tx-compat-pickers' }, minPicker, maxPicker), compatResult);
  const compatToggle = toggle({
    label: 'Also works in other versions',
    value: !!project.compat,
    description: 'Declare a range of Minecraft versions so the game doesn’t call the pack “incompatible”.',
    onChange: (v) => {
      if (v) {
        project.compat = { minVersion: minPicker.getValue().version || '1.21', maxVersion: maxPicker.getValue().version || project.version };
      } else delete project.compat;
      compatBody.hidden = !v;
      store.touch('meta');
      void renderCompat();
    },
  });

  let compatToken = 0;
  async function renderCompat() {
    const my = ++compatToken;
    if (!java) return;
    const warnings: string[] = [];
    compatResult.replaceChildren(h('span', { class: 'faint small' }, 'Working out pack formats…'));
    try {
      const eff = await effectiveCompat(project.version, project.compat, warnings);
      const text = await buildPackMcmetaForVersions(project.description || ' ', project.version, eff);
      const pack = (JSON.parse(text) as { pack: Record<string, unknown> }).pack;
      const versions = [...new Set([project.version, ...(eff ? [eff.minVersion, eff.maxVersion] : [])])];
      const formats = await Promise.all(versions.map(async (v) => [v, await getJavaPackFormat(v).catch(() => null)] as const));
      const off: string[] = [];
      for (const [v, f] of formats) if (f && describePackForGame(text, f) !== 'compatible') off.push(v);
      if (my !== compatToken) return;
      const fields = h(
        'pre',
        { class: 'tx-mcmeta-lines' },
        Object.entries(pack)
          .filter(([k]) => k !== 'description')
          .map(([k, v]) => [h('span', { class: 'tx-k' }, `"${k}": `), JSON.stringify(v), '\n']),
      );
      compatResult.replaceChildren(
        h('div', { class: 'tx-formats' }, formats.map(([v, f]: readonly [string, PackFormat | null]) => h('span', { class: 'tx-format-chip' }, h('strong', null, v), ` pack ${f ? formatPackFormat(f) : '?'}`))),
        h('div', { class: 'tx-mcmeta' }, h('span', { class: 'tx-mcmeta-title' }, 'pack.mcmeta will say'), fields),
        ...[...warnings, ...(off.length ? [`Minecraft ${off.join(' and ')} will show this pack as made for another version (it can still be turned on). Very old and very new versions can't share one pack.`] : [])].map((w) =>
          h('p', { class: 'tx-inline-note warn' }, icon('warning-diamond'), w),
        ),
      );
    } catch (err) {
      if (my !== compatToken) return;
      compatResult.replaceChildren(h('p', { class: 'tx-inline-note warn' }, icon('warning-diamond'), err instanceof Error ? err.message : 'Pack formats could not be looked up right now.'));
    }
  }

  const versionCard = card({
    title: 'Game version',
    icon: 'box',
    body: java ? [picker, versionHint, compatToggle, compatBody] : [picker, versionHint],
  });

  // ---- resolution ----
  const resSentence = h('p', { class: 'field-desc' });
  const resChips = h('div', { class: 'tx-res-chips', role: 'radiogroup', 'aria-label': 'Resolution' });
  const paintRes = () => {
    resChips.replaceChildren(
      ...RESOLUTIONS.map((r) => {
        const on = project.resolution === r;
        const b = h('button', { type: 'button', class: 'chip tx-res-chip', role: 'radio', 'aria-checked': String(on), 'aria-pressed': String(on) }, `${r}×`);
        b.addEventListener('click', () => {
          project.resolution = r;
          store.touch('meta');
          paintRes();
        });
        return b;
      }),
    );
    resSentence.textContent = `${resolutionSentence(project.resolution)} Textures you already edited keep their size.`;
  };
  paintRes();

  // ---- bedrock ----
  const bedrockInfo = (() => {
    if (java) return null;
    const ver = h('span', null);
    const ids = h('div', { class: 'stack', style: { '--gap': '8px' } });
    const paint = () => {
      const cur = project.packVersion ?? [1, 0, 0];
      const next = bumpPackVersion(project.packVersion);
      ver.replaceChildren(project.packVersion ? `${cur.join('.')} · next export: ${next.join('.')}` : `First export will be ${next.join('.')}`);
      const u = project.bedrockUuids;
      ids.replaceChildren(
        ...(u
          ? [
              ['Pack ID', u.header],
              ['Module ID', u.module],
            ].map(([k, v]) => {
              const copy = button({ icon: 'copy', size: 'sm', variant: 'ghost', title: `Copy ${k}`, onClick: () => void navigator.clipboard?.writeText(v).then(() => toast('Copied', { tone: 'success', duration: 1500 })) });
              return h('div', { class: 'tx-kv' }, h('span', { class: 'tx-k' }, k), h('code', { class: 'tx-v tx-uuid' }, v), copy);
            })
          : []),
      );
    };
    paint();
    offs.push(store.events.on('meta', paint));
    const regen = button({
      label: 'Make it a separate pack',
      size: 'sm',
      variant: 'ghost',
      onClick: async () => {
        const ok = await confirmDialog('Give this pack new IDs?', 'Minecraft will treat the next export as a different pack, installed next to the old one instead of updating it.', 'New IDs');
        if (!ok) return;
        project.bedrockUuids = newBedrockUuids();
        project.packVersion = undefined;
        store.touch('meta');
        toast('New pack IDs made', { tone: 'success' });
      },
    });
    return card({
      title: 'Bedrock pack',
      icon: 'gamepad',
      body: [
        h('div', { class: 'tx-kv' }, h('span', { class: 'tx-k' }, 'Version'), h('span', { class: 'tx-v' }, ver)),
        ids,
        h('p', { class: 'field-desc' }, 'These IDs stay the same on every export, so installing a newer export updates the pack in Minecraft instead of adding a copy.'),
        regen,
      ],
    });
  })();

  // ---- stats + danger ----
  const stats = h('div', { class: 'tx-stats' });
  const paintStats = () => {
    const fx = project.effects.filter((l) => l.enabled).length;
    const extra = Object.keys(project.extraFiles).length;
    stats.replaceChildren(
      h('div', { class: 'tx-stat' }, h('strong', null, String(store.editedCount())), h('span', null, 'edited textures')),
      h('div', { class: 'tx-stat' }, h('strong', null, String(fx)), h('span', null, fx === 1 ? 'effect on' : 'effects on')),
      ...(extra ? [h('div', { class: 'tx-stat' }, h('strong', null, String(extra)), h('span', null, 'extra files kept'))] : []),
      h('div', { class: 'tx-stat' }, h('strong', null, timeAgo(project.createdAt)), h('span', null, 'created')),
    );
  };
  const deleteBtn = button({
    label: 'Delete this pack',
    icon: 'trash',
    variant: 'danger',
    size: 'sm',
    onClick: async () => {
      const ok = await confirmDialog('Delete this pack?', `“${plainText(project.name)}” and everything you painted in it will be removed from this browser. Export it first if you want to keep a copy.`, 'Delete pack', true);
      if (!ok) return;
      try {
        await store.discard();
        await deleteProject(project.id);
        toast(`Deleted “${plainText(project.name)}”`, { tone: 'info' });
        navigate('/textures');
      } catch {
        store.revive();
        toast("Couldn't delete the pack.", { tone: 'error' });
      }
    },
  });

  const el = h(
    'div',
    { class: 'tx-pack stack' },
    h('section', { class: 'tx-pack-hero' }, h('h3', { class: 'section-title' }, icon('eye'), 'In the game menu'), mcPreview),
    card({ title: 'Name & description', icon: 'pen-square', body: [nameField, descField, codesWrap] }),
    card({ title: 'Pack icon', icon: 'image', body: iconBlock }),
    versionCard,
    card({ title: 'Resolution', icon: 'grid', body: [resChips, resSentence] }),
    bedrockInfo,
    card({ title: 'About this pack', icon: 'info', body: stats }),
    h(
      'section',
      { class: 'tx-danger' },
      h('div', { class: 'stack', style: { '--gap': '4px' } }, h('h3', { class: 'tx-danger-title' }, 'Danger zone'), h('p', { class: 'faint small' }, 'Deleting removes the pack from this browser for good.')),
      deleteBtn,
    ),
  );

  const paintVersionHint = () => {
    versionHint.replaceChildren(
      java
        ? `Textures, names and the pack format come from this version.`
        : `Textures come from Bedrock ${project.version === 'latest' ? 'latest release' : bedrockDisplayVersion(project.version)}.`,
    );
  };
  paintVersionHint();
  paintPreview();
  void paintIcon();
  paintStats();
  if (java) void renderCompat();

  let descTimer: ReturnType<typeof setTimeout> | null = null;
  offs.push(
    store.events.on('meta', () => {
      void paintIcon();
      paintStats();
      // renamed from the top bar
      const nameEl = (nameField as HTMLElement & { input?: HTMLInputElement }).input;
      if (nameEl && document.activeElement !== nameEl && nameEl.value.trim() !== project.name) {
        nameField.setValue(project.name);
        paintPreview();
      }
      if (java) {
        if (descTimer) clearTimeout(descTimer);
        descTimer = setTimeout(() => void renderCompat(), 400);
      }
    }),
    store.events.on('overrides', ({ path }) => {
      paintStats();
      if (/grass|stone/.test(path)) void paintIcon();
    }),
    store.events.on('effects', () => {
      paintStats();
      void paintIcon();
    }),
  );

  return {
    el,
    setVisible(v) {
      if (v) {
        paintStats();
        nameField.setValue(project.name);
      }
    },
    destroy() {
      offs.forEach((f) => f());
      if (descTimer) clearTimeout(descTimer);
    },
  };
}

