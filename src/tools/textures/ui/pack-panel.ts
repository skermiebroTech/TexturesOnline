// Right panel "Pack" tab: name, description (with § formatting preview), icon, game version and
// Java compatibility range (pack format numbers + warnings), resolution, Bedrock ids, danger zone.

import type { PackFormat } from '../../../core/types';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { button, card, textInput, toggle, tooltip } from '../../../ui/components';
import { confirmDialog } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { versionPicker } from '../../../ui/version-picker';
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
import { resolutionSentence } from './resolution';
import { fmt, joinList, num } from '../../../i18n/editor-text';
import { kit } from '../../../ui/i18n/kit';
import { t as ts } from '../i18n/start';
import { te } from './i18n/editor';
import { byPointer } from './media';

export { resolutionSentence };

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
    { class: 'tx-mc-entry', role: 'img', 'aria-label': te.pack.inGameLabel },
    h('div', { class: 'tx-mc-iconbox' }, pvIcon),
    h('div', { class: 'tx-mc-text' }, pvName, pvDesc),
  );
  const paintPreview = () => {
    pvName.replaceChildren(formattedText(project.name || te.untitled, '#ffffff'));
    pvDesc.replaceChildren(formattedText(project.description || '', '#a8a8a8'));
  };

  // ---- name / description ----
  const nameField = textInput({
    label: te.pack.name,
    value: project.name,
    maxLength: 80,
    placeholder: te.pack.namePlaceholder,
    onInput: (v) => {
      project.name = v.trim() || te.untitled;
      paintPreview();
      store.touch('meta');
    },
  });
  const descField = textInput({
    label: te.pack.description,
    value: project.description,
    multiline: true,
    maxLength: 200,
    placeholder: te.pack.descriptionPlaceholder,
    description: java ? te.pack.descriptionJava : te.pack.descriptionBedrock,
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
    { class: 'tx-codes', role: 'group', 'aria-label': te.pack.insertCode },
    FORMAT_CODES.map((c) => {
      const label = te.pack.codes[c.code as keyof typeof te.pack.codes];
      const b = h(
        'button',
        { type: 'button', class: ['tx-code', c.color ? 'is-color' : 'is-style'], style: c.color ? { '--c': c.color } : undefined, 'aria-label': `${label} (§${c.code})` },
        c.color ? null : h('span', { class: `tx-code-${c.code}` }, c.glyph ?? c.code.toUpperCase()),
      );
      tooltip(b, `${label} — §${c.code}`);
      b.addEventListener('click', () => insertCode(c.code));
      return b;
    }),
  );
  const codesWrap = h('details', { class: 'tx-codes-wrap' }, h('summary', null, icon('palette', { size: 16 }), te.pack.codesTitle), h('p', { class: 'faint small' }, byPointer(te.pack.codesHint, te.pack.codesHintTouch)), codeRow);

  // ---- icon ----
  const iconCanvas = h('canvas', { class: 'tx-icon-pv pixelated', width: 64, height: 64 });
  const iconNote = h('span', { class: 'faint small' });
  const iconInput = h('input', { type: 'file', accept: 'image/*,.png,.tga', hidden: true });
  const fromTexBtn = button({ label: te.pack.fromTexture, icon: 'image', size: 'sm', onClick: () => void iconFromCurrent() });
  const uploadIconBtn = button({ label: te.pack.upload, icon: 'upload', size: 'sm', onClick: () => iconInput.click() });
  const paintIconBtn = button({ label: te.pack.paint, icon: 'brush', size: 'sm', onClick: () => opts.paintIcon() });
  const resetIconBtn = button({ label: te.pack.automatic, icon: 'reset', size: 'sm', variant: 'ghost', onClick: () => store.setIconBlob(undefined) });
  tooltip(fromTexBtn, te.pack.fromTextureHint);
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
    iconNote.textContent = auto ? te.pack.autoIcon : fmt(te.pack.yourIcon, { size: `${img.width}×${img.height}` });
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
      toast(te.pack.iconUpdated, { tone: 'success' });
    } catch {
      toast(te.pack.notImage, { tone: 'error' });
    }
  });

  async function iconFromCurrent() {
    const t = opts.current();
    if (!t || t.key === ICON_KEY) {
      toast(te.pack.openTextureFirst, { tone: 'info' });
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
    toast(fmt(te.pack.iconMade, { name: t.name }), { tone: 'success' });
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
      te.pack.switchTitle,
      fmt(te.pack.switchText, {
        version: project.edition === 'java' ? fmt(kit.edition.javaVersion, { version: v }) : v === 'latest' ? ts.version.bedrockLatest : fmt(ts.version.bedrock, { version: v }),
      }),
      te.pack.switchButton,
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
    label: te.pack.oldest,
    onChange: (_e, v) => {
      project.compat = { minVersion: v, maxVersion: project.compat?.maxVersion ?? project.version };
      store.touch('meta');
      void renderCompat();
    },
  });
  const maxPicker = versionPicker({
    edition: 'java',
    value: project.compat?.maxVersion ?? project.version,
    label: te.pack.newest,
    onChange: (_e, v) => {
      project.compat = { minVersion: project.compat?.minVersion ?? project.version, maxVersion: v };
      store.touch('meta');
      void renderCompat();
    },
  });
  compatBody.append(h('div', { class: 'tx-compat-pickers' }, minPicker, maxPicker), compatResult);
  const compatToggle = toggle({
    label: te.pack.otherVersions,
    value: !!project.compat,
    description: te.pack.otherVersionsHint,
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
    compatResult.replaceChildren(h('span', { class: 'faint small' }, te.pack.workingOut));
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
        h('div', { class: 'tx-formats' }, formats.map(([v, f]: readonly [string, PackFormat | null]) => h('span', { class: 'tx-format-chip' }, h('strong', null, v), fmt(te.pack.packFormat, { format: f ? formatPackFormat(f) : '?' })))),
        h('div', { class: 'tx-mcmeta' }, h('span', { class: 'tx-mcmeta-title' }, te.pack.mcmetaSays), fields),
        ...[...warnings, ...(off.length ? [fmt(te.pack.incompatible, { versions: joinList(off, 'and') })] : [])].map((w) =>
          h('p', { class: 'tx-inline-note warn' }, icon('warning-diamond'), w),
        ),
      );
    } catch (err) {
      if (my !== compatToken) return;
      compatResult.replaceChildren(h('p', { class: 'tx-inline-note warn' }, icon('warning-diamond'), err instanceof Error ? err.message : te.pack.formatsFailed));
    }
  }

  const versionCard = card({
    title: te.pack.gameVersion,
    icon: 'box',
    body: java ? [picker, versionHint, compatToggle, compatBody] : [picker, versionHint],
  });

  // ---- resolution ----
  const resSentence = h('p', { class: 'field-desc' });
  const resChips = h('div', { class: 'tx-res-chips', role: 'radiogroup', 'aria-label': te.pack.resolution });
  const paintRes = () => {
    resChips.replaceChildren(
      ...RESOLUTIONS.map((r) => {
        const on = project.resolution === r;
        const b = h('button', { type: 'button', class: 'chip tx-res-chip', role: 'radio', 'aria-checked': String(on) }, `${r}×`);
        b.addEventListener('click', () => {
          project.resolution = r;
          store.touch('meta');
          paintRes();
        });
        return b;
      }),
    );
    resSentence.textContent = `${resolutionSentence(project.resolution)}${te.pack.keepSize}`;
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
      ver.replaceChildren(project.packVersion ? fmt(te.pack.nextExport, { current: cur.join('.'), next: next.join('.') }) : fmt(te.pack.firstExport, { next: next.join('.') }));
      const u = project.bedrockUuids;
      ids.replaceChildren(
        ...(u
          ? [
              [te.pack.packId, u.header],
              [te.pack.moduleId, u.module],
            ].map(([k, v]) => {
              const copy = button({ icon: 'copy', size: 'sm', variant: 'ghost', title: fmt(te.pack.copyId, { name: k }), onClick: () => void navigator.clipboard?.writeText(v).then(() => toast(te.pack.copied, { tone: 'success', duration: 1500 })) });
              return h('div', { class: 'tx-kv' }, h('span', { class: 'tx-k' }, k), h('code', { class: 'tx-v tx-uuid' }, v), copy);
            })
          : []),
      );
    };
    paint();
    offs.push(store.events.on('meta', paint));
    const regen = button({
      label: te.pack.separate,
      size: 'sm',
      variant: 'ghost',
      onClick: async () => {
        const ok = await confirmDialog(te.pack.newIdsTitle, te.pack.newIdsText, te.pack.newIdsButton);
        if (!ok) return;
        project.bedrockUuids = newBedrockUuids();
        project.packVersion = undefined;
        store.touch('meta');
        toast(te.pack.newIdsDone, { tone: 'success' });
      },
    });
    return card({
      title: te.pack.bedrockPack,
      icon: 'gamepad',
      body: [
        h('div', { class: 'tx-kv' }, h('span', { class: 'tx-k' }, te.pack.version), h('span', { class: 'tx-v' }, ver)),
        ids,
        h('p', { class: 'field-desc' }, te.pack.idsHint),
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
      h('div', { class: 'tx-stat' }, h('strong', null, num(store.editedCount())), h('span', null, fmt(te.pack.editedTextures, { count: store.editedCount() }))),
      h('div', { class: 'tx-stat' }, h('strong', null, num(fx)), h('span', null, fmt(te.pack.effectsOn, { count: fx }))),
      ...(extra ? [h('div', { class: 'tx-stat' }, h('strong', null, num(extra)), h('span', null, fmt(te.pack.extraFiles, { count: extra })))] : []),
      h('div', { class: 'tx-stat' }, h('strong', null, timeAgo(project.createdAt)), h('span', null, te.pack.created)),
    );
  };
  const deleteBtn = button({
    label: te.pack.deletePack,
    icon: 'trash',
    variant: 'danger',
    size: 'sm',
    onClick: async () => {
      const ok = await confirmDialog(te.pack.deleteTitle, fmt(te.pack.deleteText, { name: plainText(project.name) }), te.pack.deleteButton, true);
      if (!ok) return;
      try {
        await store.discard();
        await deleteProject(project.id);
        toast(fmt(te.pack.deleted, { name: plainText(project.name) }), { tone: 'info' });
        navigate('/textures');
      } catch {
        store.revive();
        toast(te.pack.deleteFailed, { tone: 'error' });
      }
    },
  });

  const el = h(
    'div',
    { class: 'tx-pack stack' },
    h('section', { class: 'tx-pack-hero' }, h('h3', { class: 'section-title' }, icon('eye'), te.pack.inGame), mcPreview),
    card({ title: te.pack.nameDescription, icon: 'pen-square', body: [nameField, descField, codesWrap] }),
    card({ title: te.pack.packIcon, icon: 'image', body: iconBlock }),
    versionCard,
    card({ title: te.pack.resolution, icon: 'grid', body: [resChips, resSentence] }),
    bedrockInfo,
    card({ title: te.pack.about, icon: 'info', body: stats }),
    h(
      'section',
      { class: 'tx-danger' },
      h('div', { class: 'stack', style: { '--gap': '4px' } }, h('h3', { class: 'tx-danger-title' }, te.pack.danger), h('p', { class: 'faint small' }, te.pack.dangerText)),
      deleteBtn,
    ),
  );

  const paintVersionHint = () => {
    versionHint.replaceChildren(
      java ? te.pack.versionJava : project.version === 'latest' ? te.pack.versionBedrockLatest : fmt(te.pack.versionBedrock, { version: bedrockDisplayVersion(project.version) }),
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

