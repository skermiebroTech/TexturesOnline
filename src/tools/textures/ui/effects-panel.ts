// Right panel "Effects" tab: one-click style presets with before/after sample strips, and the
// non-destructive effect stack (add, remove, reorder by drag or buttons, toggle, tweak, per-category).

import type { EffectLayer, TextureCategory } from '../../../core/types';
import { h } from '../../../ui/dom';
import { ICON_NAMES, icon, type IconName } from '../../../ui/icons';
import { button, iconButton, openMenu, openPopover, optionControl, tooltip, type PopoverHandle } from '../../../ui/components';
import { toast } from '../../../ui/toast';
import { TEXTURE_CATEGORY_ORDER } from '../../../editions/index';
import { EFFECTS, EFFECT_PRESETS, applyEffects, createLayer, getEffect, resolveParams, type EffectDef, type EffectPreset } from '../effects';
import { newLayerId } from '../project';
import { DEFAULT_GRASS_TINT, compositeOverlay } from '../../../shared/preview/preview-textures';
import { CATEGORY_INFO, firstSquare } from './meta';
import { paintCanvas } from './thumbs';
import type { TexStore } from './store';

export interface EffectsPanel {
  el: HTMLElement;
  setVisible(v: boolean): void;
  destroy(): void;
}

interface Sample {
  path: string;
  category: TextureCategory;
  img: ImageData;
  overlay?: ImageData;
  overlayPath?: string;
}

const SAMPLE_IDS: { ids: string[]; category: TextureCategory; overlay?: string[] }[] = [
  { ids: ['block/grass_block_side', 'blocks/grass_side', 'blocks/grass_side_carried'], category: 'block', overlay: ['block/grass_block_side_overlay', 'blocks/grass_side_overlay'] },
  { ids: ['block/stone', 'blocks/stone'], category: 'block' },
  { ids: ['block/diamond_ore', 'blocks/diamond_ore'], category: 'block' },
  { ids: ['item/apple', 'items/apple'], category: 'item' },
  { ids: ['block/oak_planks', 'blocks/planks_oak'], category: 'block' },
];

const KIND_LABEL: Record<string, string> = { color: 'Colour', spatial: 'Detail', alpha: 'Shape', resize: 'Size' };
const KIND_ICON: Record<string, IconName> = { color: 'palette', spatial: 'sliders', alpha: 'frame', resize: 'expand' };

function effectIcon(def: EffectDef | undefined): IconName {
  if (!def) return 'sparkles';
  if (def.icon && (ICON_NAMES as string[]).includes(def.icon)) return def.icon as IconName;
  return KIND_ICON[def.kind ?? 'color'] ?? 'sparkles';
}

const sameStack = (layers: EffectLayer[], preset: EffectPreset): boolean =>
  layers.length === preset.layers.length &&
  layers.every((l, i) => {
    const p = preset.layers[i];
    return l.type === p.type && l.enabled && JSON.stringify(l.params) === JSON.stringify(p.params) && JSON.stringify(l.categories ?? null) === JSON.stringify(p.categories ?? null);
  });

/** The preset the stack currently equals, if any. */
export function matchingPreset(layers: EffectLayer[]): EffectPreset | undefined {
  return layers.length ? EFFECT_PRESETS.find((p) => sameStack(layers, p)) : undefined;
}

export function createEffectsPanel(store: TexStore): EffectsPanel {
  const project = store.project;
  let samples: Sample[] | null = null;
  let samplesLoading: Promise<void> | null = null;
  let visible = false;
  const expanded = new Set<string>();
  let addPop: PopoverHandle | null = null;

  const intro = h(
    'div',
    { class: 'tx-note' },
    icon('info'),
    h(
      'p',
      null,
      h('strong', null, 'Restyle every texture at once.'),
      ' Your own pixels stay untouched, so you can tweak or remove effects any time.',
    ),
  );

  // ---- stack ----
  const stackCount = h('span', { class: 'tx-count-pill' }, '0');
  const addBtn = button({ label: 'Add', icon: 'plus', size: 'sm', variant: 'secondary', title: 'Add an effect', onClick: () => openAdd() });
  const layersList = h('ol', { class: 'tx-layers', 'aria-label': 'Effect stack (applied top to bottom)' });
  const stackEmpty = h('div', { class: 'tx-stack-empty' }, icon('layers', { size: 24 }), h('span', null, 'No effects yet. Tap a style below for a one-click look, or add effects one by one.'));
  const clearBtn = button({ label: 'Remove all', icon: 'trash', size: 'sm', variant: 'ghost', onClick: () => clearAll() });
  const toggleAllBtn = button({ label: 'Turn all off', icon: 'eye-off', size: 'sm', variant: 'ghost', onClick: () => toggleAll() });
  const stackFoot = h('div', { class: 'tx-stack-foot' }, toggleAllBtn, clearBtn);
  const stack = h(
    'section',
    { class: 'tx-fx-section' },
    h('div', { class: 'tx-fx-head' }, h('h3', { class: 'tx-h' }, 'Your effects'), stackCount, h('span', { class: 'grow' }), addBtn),
    stackEmpty,
    layersList,
    stackFoot,
  );

  // ---- presets ----
  const legend = h('div', { class: 'tx-preset-legend' }, h('span', { class: 'tx-legend-label' }, 'Original'), h('div', { class: 'tx-strip' }));
  const presetList = h('div', { class: 'tx-presets' });
  const presets = h(
    'section',
    { class: 'tx-fx-section' },
    h('div', { class: 'tx-fx-head' }, h('h3', { class: 'tx-h' }, 'One-click styles')),
    legend,
    presetList,
  );

  const el = h('div', { class: 'tx-fx' }, intro, stack, presets);

  // ---------------------------------------------------------------- changes
  let emitTimer: ReturnType<typeof setTimeout> | null = null;
  const changed = (rerenderStack = true) => {
    store.touch(null);
    if (emitTimer) clearTimeout(emitTimer);
    emitTimer = setTimeout(() => {
      emitTimer = null;
      store.events.emit('effects');
    }, 140);
    if (rerenderStack) renderStack();
    markActivePreset();
  };

  const setLayers = (layers: EffectLayer[]) => {
    project.effects = layers;
    changed();
  };

  function applyPresetCard(p: EffectPreset, mode: 'replace' | 'append') {
    const before = project.effects.map((l) => ({ ...l, params: { ...l.params }, categories: l.categories ? [...l.categories] : undefined }));
    const added = p.layers.map((l) => ({ ...l, params: { ...l.params }, ...(l.categories ? { categories: [...l.categories] } : {}), id: newLayerId() }));
    setLayers(mode === 'replace' ? added : [...project.effects, ...added]);
    toast(mode === 'replace' ? `Applied “${p.label}” to the whole pack` : `Added “${p.label}” on top`, {
      tone: 'success',
      action: { label: 'Undo', onClick: () => setLayers(before) },
    });
    el.closest('.scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearAll() {
    if (!project.effects.length) return;
    const before = project.effects;
    setLayers([]);
    toast('Removed all effects', { action: { label: 'Undo', onClick: () => setLayers(before) } });
  }

  function toggleAll() {
    const anyOn = project.effects.some((l) => l.enabled);
    project.effects.forEach((l) => (l.enabled = !anyOn));
    changed();
  }

  // ---------------------------------------------------------------- add menu
  function openAdd() {
    if (addPop?.open) {
      addPop.close();
      return;
    }
    const groups = new Map<string, EffectDef[]>();
    for (const e of EFFECTS) {
      const k = e.kind ?? 'color';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    }
    const list = h('div', { class: 'tx-add-list', role: 'menu', 'aria-label': 'Add an effect' });
    const buttons: HTMLButtonElement[] = [];
    for (const [k, defs] of groups) {
      list.appendChild(h('div', { class: 'tx-add-group', role: 'presentation' }, KIND_LABEL[k] ?? k));
      for (const d of defs) {
        const b = h(
          'button',
          { type: 'button', class: 'tx-add-item', role: 'menuitem', tabIndex: -1 },
          h('span', { class: 'tx-add-icon' }, icon(effectIcon(d))),
          h('span', { class: 'tx-add-text' }, h('span', { class: 'tx-add-name' }, d.label), d.description ? h('span', { class: 'tx-add-desc' }, d.description) : null),
        );
        b.addEventListener('click', () => {
          addPop?.close();
          const layer: EffectLayer = { ...createLayer(d.type), id: newLayerId() };
          expanded.add(layer.id);
          setLayers([...project.effects, layer]);
          requestAnimationFrame(() => layersList.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
        });
        buttons.push(b);
        list.appendChild(b);
      }
    }
    list.addEventListener('keydown', (e) => {
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      let n = -1;
      if (e.key === 'ArrowDown') n = (i + 1) % buttons.length;
      else if (e.key === 'ArrowUp') n = (i - 1 + buttons.length) % buttons.length;
      if (n >= 0) {
        e.preventDefault();
        buttons[n].focus();
      }
    });
    addPop = openPopover(addBtn, list, { placement: 'bottom-end', focus: buttons[0], role: 'presentation', class: 'tx-add-pop' });
  }

  // ---------------------------------------------------------------- stack rendering
  const summary = (l: EffectLayer): string => {
    const def = getEffect(l.type);
    if (!def) return 'Unknown effect';
    const p = resolveParams(def, l.params);
    const parts: string[] = [];
    for (const o of def.params.slice(0, 2)) {
      const v = p[o.key];
      if (o.type === 'range') parts.push(`${Number(v) > 0 && (o.min ?? 0) < 0 ? '+' : ''}${v}${o.unit ?? ''}`);
      else if (o.type === 'select') parts.push(o.options?.find((x) => x.value === v)?.label ?? String(v));
      else if (o.type === 'color') parts.push(String(v));
    }
    const cats = l.categories?.length ? ` · ${l.categories.map((c) => CATEGORY_INFO[c].label).join(', ')}` : '';
    return parts.join(' · ') + cats;
  };

  let dragId: string | null = null;

  function renderStack() {
    const layers = project.effects;
    stackCount.textContent = String(layers.length);
    stackEmpty.hidden = layers.length > 0;
    stackFoot.hidden = layers.length === 0;
    toggleAllBtn.querySelector('.btn-label')!.textContent = layers.some((l) => l.enabled) ? 'Turn all off' : 'Turn all on';
    const rows = layers.map((l, i) => layerRow(l, i, layers.length));
    layersList.replaceChildren(...rows);
  }

  function layerRow(l: EffectLayer, i: number, n: number): HTMLElement {
    const def = getEffect(l.type);
    const open = expanded.has(l.id);
    const move = (d: number) => {
      const arr = [...project.effects];
      const j = i + d;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      setLayers(arr);
      requestAnimationFrame(() => (layersList.children[j]?.querySelector('.tx-l-menu') as HTMLElement | null)?.focus());
    };
    const enable = h('button', { type: 'button', class: 'tx-l-enable', role: 'switch', 'aria-checked': String(l.enabled), 'aria-label': `${def?.label ?? l.type} on` }, icon(l.enabled ? 'eye' : 'eye-off'));
    tooltip(enable, l.enabled ? 'Turn off' : 'Turn on');
    enable.addEventListener('click', () => {
      l.enabled = !l.enabled;
      changed();
    });
    const handle = h('span', { class: 'tx-l-handle', 'aria-hidden': 'true', title: 'Drag to reorder' }, h('span', { class: 'tx-grip' }));
    const title = h(
      'button',
      { type: 'button', class: 'tx-l-title', 'aria-expanded': String(open) },
      h('span', { class: 'tx-l-icon' }, icon(effectIcon(def))),
      h('span', { class: 'tx-l-text' }, h('span', { class: 'tx-l-name' }, def?.label ?? l.type), h('span', { class: 'tx-l-sum' }, summary(l))),
      icon('chevron-down', { class: 'tx-l-chev' }),
    );
    title.addEventListener('click', () => {
      if (expanded.has(l.id)) expanded.delete(l.id);
      else expanded.add(l.id);
      renderStack();
      (layersList.children[i]?.querySelector('.tx-l-title') as HTMLElement | null)?.focus();
    });
    const remove = () => {
      const before = project.effects;
      setLayers(project.effects.filter((x) => x.id !== l.id));
      toast(`Removed ${def?.label ?? 'effect'}`, { action: { label: 'Undo', onClick: () => setLayers(before) } });
    };
    const menuBtn = iconButton('more-vertical', 'More actions', () =>
      openMenu(menuBtn, [
        { label: 'Move up', icon: 'arrow-up', disabled: i === 0, onClick: () => move(-1) },
        { label: 'Move down', icon: 'arrow-down', disabled: i === n - 1, onClick: () => move(1) },
        {
          label: 'Duplicate',
          icon: 'copy',
          onClick: () => {
            const arr = [...project.effects];
            arr.splice(i + 1, 0, { ...l, id: newLayerId(), params: { ...l.params }, ...(l.categories ? { categories: [...l.categories] } : {}) });
            setLayers(arr);
          },
        },
        { label: 'Remove', icon: 'trash', danger: true, onClick: remove },
      ], { label: `${def?.label ?? 'Effect'} actions` }),
    { size: 'sm', class: 'tx-l-menu' });

    const head = h('div', { class: 'tx-l-head' }, handle, enable, title, menuBtn);
    const row = h('li', { class: ['tx-layer', !l.enabled && 'is-off', open && 'is-open'], dataset: { id: l.id } }, head);

    if (open && def) {
      const params = resolveParams(def, l.params);
      const controls = def.params.map((o) =>
        optionControl(o, params[o.key], (v) => {
          l.params = { ...l.params, [o.key]: v };
          (row.querySelector('.tx-l-sum') as HTMLElement).textContent = summary(l);
          changed(false);
        }),
      );
      const catChips = h('div', { class: 'tx-l-cats', role: 'group', 'aria-label': 'Applies to' });
      const renderCats = () => {
        const set = new Set(l.categories ?? []);
        const mk = (c: TextureCategory | 'all', label: string) => {
          const on = c === 'all' ? set.size === 0 : set.has(c);
          const b = h('button', { type: 'button', class: 'chip tx-mini-chip', 'aria-pressed': String(on) }, label);
          b.addEventListener('click', () => {
            if (c === 'all') l.categories = undefined;
            else {
              if (set.has(c)) set.delete(c);
              else set.add(c);
              l.categories = set.size ? TEXTURE_CATEGORY_ORDER.filter((x) => set.has(x)) : undefined;
            }
            (row.querySelector('.tx-l-sum') as HTMLElement).textContent = summary(l);
            renderCats();
            changed(false);
          });
          return b;
        };
        catChips.replaceChildren(mk('all', 'Everything'), ...TEXTURE_CATEGORY_ORDER.map((c) => mk(c, CATEGORY_INFO[c].label)));
      };
      renderCats();
      row.appendChild(
        h(
          'div',
          { class: 'tx-l-body' },
          def.description ? h('p', { class: 'faint small' }, def.description) : null,
          controls,
          h('div', { class: 'tx-l-catwrap' }, h('span', { class: 'field-label' }, 'Applies to'), catChips),
          h(
            'div',
            { class: 'tx-l-foot' },
            button({ label: 'Up', icon: 'arrow-up', size: 'sm', variant: 'ghost', disabled: i === 0, onClick: () => move(-1) }),
            button({ label: 'Down', icon: 'arrow-down', size: 'sm', variant: 'ghost', disabled: i === n - 1, onClick: () => move(1) }),
            h('span', { class: 'grow' }),
            button({ label: 'Remove', icon: 'trash', size: 'sm', variant: 'ghost', class: 'tx-l-remove', onClick: remove }),
          ),
        ),
      );
    }

    // drag to reorder (by the handle / row header)
    head.draggable = true;
    head.addEventListener('dragstart', (e) => {
      dragId = l.id;
      row.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', l.id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    head.addEventListener('dragend', () => {
      dragId = null;
      row.classList.remove('dragging');
      layersList.querySelectorAll('.drop-before,.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    });
    row.addEventListener('dragover', (e) => {
      if (!dragId || dragId === l.id) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      row.classList.toggle('drop-after', after);
      row.classList.toggle('drop-before', !after);
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after'));
    row.addEventListener('drop', (e) => {
      if (!dragId) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      const arr = project.effects.filter((x) => x.id !== dragId);
      const moving = project.effects.find((x) => x.id === dragId);
      if (!moving) return;
      let at = arr.findIndex((x) => x.id === l.id);
      if (after) at++;
      arr.splice(at, 0, moving);
      dragId = null;
      setLayers(arr);
    });
    return row;
  }

  // ---------------------------------------------------------------- presets rendering
  const cards = new Map<string, HTMLElement>();

  function renderPresets() {
    presetList.replaceChildren(
      ...EFFECT_PRESETS.map((p) => {
        const strip = h('div', { class: 'tx-strip', 'aria-hidden': 'true' });
        const card = h(
          'button',
          { type: 'button', class: 'tx-preset', dataset: { preset: p.id }, style: p.swatch ? { '--sw-a': p.swatch[0], '--sw-b': p.swatch[1] } : undefined },
          h('span', { class: 'tx-preset-top' }, h('span', { class: 'tx-preset-dot', 'aria-hidden': 'true' }), h('span', { class: 'tx-preset-name' }, p.label), h('span', { class: 'tx-preset-applied' }, icon('check', { size: 16 }), 'Applied')),
          h('span', { class: 'tx-preset-desc' }, p.description),
          strip,
        );
        card.setAttribute('aria-label', `${p.label}: ${p.description}. Apply to the whole pack`);
        card.addEventListener('click', () => applyPresetCard(p, 'replace'));
        const add = h('button', { type: 'button', class: 'icon-btn sm tx-preset-add', 'aria-label': `Add ${p.label} on top of your effects` }, icon('plus'));
        tooltip(add, 'Add on top of your current effects');
        add.addEventListener('click', (e) => {
          e.stopPropagation();
          applyPresetCard(p, 'append');
        });
        const wrap = h('div', { class: 'tx-preset-wrap' }, card, add);
        cards.set(p.id, wrap);
        return wrap;
      }),
    );
    markActivePreset();
    void fillStrips();
  }

  function markActivePreset() {
    for (const p of EFFECT_PRESETS) cards.get(p.id)?.classList.toggle('is-active', sameStack(project.effects, p));
  }

  const drawSample = (s: Sample, layers: readonly EffectLayer[] | EffectPreset['layers'] | null): ImageData => {
    const ctx = { path: s.path, category: s.category, animated: false };
    let img = layers ? applyEffects(s.img, layers, ctx) : s.img;
    if (s.overlay) {
      const ov = layers ? applyEffects(s.overlay, layers, { ...ctx, path: s.overlayPath ?? s.path }) : s.overlay;
      if (ov.width === img.width) {
        const c = compositeOverlay(img, ov, DEFAULT_GRASS_TINT);
        img = new ImageData(new Uint8ClampedArray(c.data), c.width, c.height);
      }
    }
    return img;
  };

  const stripCanvases = (strip: HTMLElement, imgs: ImageData[]) => {
    strip.replaceChildren(
      ...imgs.map((img) => {
        const c = h('canvas', { class: 'pixelated' });
        paintCanvas(c, img);
        const scale = img.width <= 16 ? 2 : 32 / img.width;
        c.style.width = `${Math.round(img.width * scale)}px`;
        c.style.height = `${Math.round(img.height * scale)}px`;
        return h('span', { class: 'tx-strip-cell checker' }, c);
      }),
    );
  };

  async function loadSamples() {
    if (samples) return;
    if (!samplesLoading) {
      samplesLoading = (async () => {
        const root = project.edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
        const find = (ids: string[]) => {
          for (const id of ids) for (const ext of ['.png', '.tga']) if (store.byPath.has(root + id + ext)) return root + id + ext;
          return null;
        };
        const out: Sample[] = [];
        for (const s of SAMPLE_IDS) {
          const path = find(s.ids);
          if (!path) continue;
          try {
            const img = firstSquare(await store.getFull(path));
            const sample: Sample = { path, category: s.category, img };
            const ovPath = s.overlay ? find(s.overlay) : null;
            if (ovPath && !/carried/.test(path)) {
              sample.overlay = firstSquare(await store.getFull(ovPath));
              sample.overlayPath = ovPath;
            }
            out.push(sample);
          } catch {
            /* skip */
          }
        }
        samples = out;
      })();
    }
    await samplesLoading;
  }

  async function fillStrips() {
    if (!visible) return;
    await loadSamples();
    if (!samples) return;
    stripCanvases(legend.querySelector('.tx-strip') as HTMLElement, samples.map((s) => drawSample(s, null)));
    legend.hidden = samples.length === 0;
    for (const p of EFFECT_PRESETS) {
      const strip = cards.get(p.id)?.querySelector('.tx-strip') as HTMLElement | null;
      if (!strip) continue;
      stripCanvases(strip, samples.map((s) => drawSample(s, p.layers)));
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const offs = [
    store.events.on('overrides', ({ path }) => {
      if (samples?.some((s) => s.path === path || s.overlayPath === path)) {
        samples = null;
        samplesLoading = null;
        if (visible) void fillStrips();
      }
    }),
  ];

  renderStack();
  renderPresets();

  return {
    el,
    setVisible(v) {
      const was = visible;
      visible = v;
      if (v && !was) void fillStrips();
    },
    destroy() {
      offs.forEach((f) => f());
      addPop?.close();
      if (emitTimer) {
        clearTimeout(emitTimer);
        store.events.emit('effects');
      }
    },
  };
}
