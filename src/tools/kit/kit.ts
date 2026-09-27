// Component gallery for visual QA (route: #/kit).

import './kit.css';
import { href as routeHref, type RouteContext } from '../../core/router';
import type { OptionDef, OptionValues } from '../../core/types';
import { h, type Child } from '../../ui/dom';
import { ICON_NAMES, icon } from '../../ui/icons';
import {
  badge,
  button,
  card,
  colorSwatch,
  editorLayout,
  emptyState,
  iconButton,
  kbd,
  openMenu,
  optionControl,
  optionsForm,
  progressBar,
  segmented,
  select,
  setButtonBusy,
  slider,
  spinner,
  tabs,
  textInput,
  toggle,
  tooltip,
} from '../../ui/components';
import { colorPicker } from '../../ui/color-picker';
import { confirmDialog, openModal, openShortcutsSheet, promptDialog } from '../../ui/modal';
import { toast } from '../../ui/toast';
import { dropzone } from '../../ui/dropzone';
import { assetLoadingPanel, versionPicker } from '../../ui/version-picker';
import { logoMark } from '../../ui/logo';
import { grassSide, ore, planks } from '../home/art';

const demo = (title: string, ...content: Child[]): HTMLElement => h('div', { class: 'kit-demo' }, h('div', { class: 'kit-demo-title' }, title), h('div', { class: 'kit-demo-body' }, content));
const wide = (el: HTMLElement): HTMLElement => {
  el.classList.add('kit-wide');
  return el;
};

const section = (id: string, title: string, desc: string, ...demos: HTMLElement[]): HTMLElement =>
  h('section', { class: 'kit-section', id: `kit-${id}` }, h('div', { class: 'kit-section-head' }, h('h2', null, title), h('p', { class: 'muted' }, desc)), h('div', { class: 'kit-grid' }, demos));

const SAMPLE_OPTIONS: OptionDef[] = [
  { key: 'exposure', label: 'Exposure', group: 'Lighting', type: 'range', default: 1, min: 0.2, max: 2, step: 0.05, unit: '×', description: 'Overall brightness' },
  { key: 'shadows', label: 'Soft shadows', group: 'Lighting', type: 'toggle', default: true },
  { key: 'shadowRes', label: 'Shadow quality', group: 'Lighting', type: 'select', default: 'high', options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }, { value: 'ultra', label: 'Ultra' }], dependsOn: 'shadows' },
  { key: 'sunColor', label: 'Sun colour', group: 'Sky', type: 'color', default: '#ffe7b0' },
  { key: 'fog', label: 'Fog density', group: 'Sky', type: 'range', default: 30, min: 0, max: 100, step: 1, unit: '%' },
];

export default function kit(root: HTMLElement, _ctx: RouteContext): () => void {
  root.classList.add('kit');
  const timers: ReturnType<typeof setInterval>[] = [];

  // ---- Foundations
  const typeScale = h(
    'div',
    { class: 'stack' },
    [64, 48, 32, 24, 16].map((s) => h('div', { class: 'kit-type-row' }, h('span', { class: 'faint small' }, `${s}px`), h('span', { style: { fontSize: `${s}px`, lineHeight: `${s + 8}px` } }, s >= 32 ? 'Pixel perfect' : 'The quick brown fox jumps over the lazy dog'))),
    h('div', { class: 'kit-type-row' }, h('span', { class: 'faint small' }, 'bold'), h('strong', null, 'Double-struck bold, like in-game titles')),
    h('div', { class: 'kit-type-row' }, h('span', { class: 'faint small' }, 'small'), h('span', { class: 'small muted' }, 'Secondary text uses --fs-sm (smaller, still pixel-exact, on high-density screens)')),
    h('div', { class: 'kit-type-row' }, h('span', { class: 'faint small' }, 'shadow'), h('span', { class: 'pixel-shadow', style: { fontSize: '32px', lineHeight: '40px' } }, 'Drop shadow')),
  );
  const tokenNames = ['bg', 'bg-elev', 'surface', 'surface-2', 'surface-3', 'border', 'border-strong', 'text', 'text-2', 'text-3', 'green', 'blue', 'purple', 'gold', 'red'];
  const colors = h(
    'div',
    { class: 'kit-swatches' },
    tokenNames.map((n) => h('div', { class: 'kit-token' }, h('span', { class: 'kit-token-chip', style: { background: `var(--${n})` } }), h('code', null, `--${n}`))),
  );
  const iconFilter = h('input', { class: 'input', type: 'search', placeholder: `Filter ${ICON_NAMES.length} icons`, 'aria-label': 'Filter icons' });
  const iconGrid = h(
    'div',
    { class: 'kit-icons' },
    ICON_NAMES.map((n) => h('div', { class: 'kit-icon', title: n, dataset: { name: n } }, icon(n), h('span', null, n))),
  );
  iconFilter.addEventListener('input', () => {
    const q = iconFilter.value.trim().toLowerCase();
    iconGrid.querySelectorAll<HTMLElement>('.kit-icon').forEach((el) => (el.hidden = Boolean(q) && !el.dataset.name!.includes(q)));
  });

  // ---- Buttons
  const variants = ['primary', 'secondary', 'ghost', 'danger'] as const;
  const busyBtn = button({ label: 'Save', icon: 'save', variant: 'primary' });
  busyBtn.addEventListener('click', () => {
    setButtonBusy(busyBtn, true);
    setTimeout(() => setButtonBusy(busyBtn, false), 1500);
  });
  let pressed = true;
  const gridBtn = iconButton('grid', 'Toggle grid', () => {
    pressed = !pressed;
    gridBtn.setActive(pressed);
  }, { active: true });
  const menuAnchor = button({ label: 'Menu', iconEnd: 'chevron-down' });
  menuAnchor.addEventListener('click', () =>
    openMenu(menuAnchor, [
      { label: 'Duplicate', icon: 'copy', onClick: () => toast('Duplicated') },
      { label: 'Rename', icon: 'pen-square', onClick: () => toast('Rename') },
      { label: 'Delete', icon: 'trash', danger: true, onClick: () => toast('Deleted', { tone: 'warn' }) },
    ]),
  );

  // ---- Controls
  const sliderEl = slider({ label: 'Brightness', min: 0, max: 200, value: 120, unit: '%', description: 'Drag, use the arrow keys, or type a value.', onInput: () => undefined });
  const sliderDec = slider({ label: 'Gamma', min: 0.5, max: 2.5, step: 0.05, value: 1, onInput: () => undefined });
  const togg = toggle({ label: 'Show grid', value: true, onChange: () => undefined });
  const togg2 = toggle({ label: 'Tiled preview', description: 'Repeat the texture around the canvas', value: false, onChange: () => undefined });
  const sel = select({ label: 'Resolution', value: '16', options: ['16', '32', '64', '128'].map((v) => ({ value: v, label: `${v}×${v}` })), onChange: () => undefined });
  const seg = segmented({ value: 'classic', options: [{ value: 'classic', label: 'Classic' }, { value: 'slim', label: 'Slim' }], onChange: () => undefined });
  const segIcons = segmented({
    value: 'pencil',
    size: 'sm',
    options: [
      { value: 'pencil', label: '', icon: 'pencil' },
      { value: 'eraser', label: '', icon: 'eraser' },
      { value: 'fill', label: '', icon: 'fill' },
      { value: 'picker', label: '', icon: 'pipette' },
    ],
    onChange: () => undefined,
  });
  const txt = textInput({ label: 'Pack name', value: 'My Pack', placeholder: 'Name', onInput: () => undefined });
  const search = textInput({ value: '', placeholder: 'Search textures', icon: 'search', onInput: () => undefined });
  const area = textInput({ label: 'Description', value: 'Made with Texture Pack Maker', multiline: true, onInput: () => undefined });
  const swatch = colorSwatch({ label: 'Fog colour', value: '#9fc6ff', onChange: () => undefined });
  const picker = colorPicker({ value: [91, 211, 91, 255], inline: true, onChange: () => undefined });

  const optValues: OptionValues = {};
  const optionsDemo = optionsForm({ defs: SAMPLE_OPTIONS, values: optValues, onChange: () => undefined });
  const optFilter = textInput({ value: '', placeholder: 'Filter options', icon: 'search', onInput: (v) => optionsDemo.filter(v) });

  // ---- Feedback
  const prog = progressBar();
  let p = 0;
  prog.set({ label: 'Downloading Minecraft 26.3', fraction: 0, loaded: 0, total: 41_483_720 });
  timers.push(
    setInterval(() => {
      p = (p + 0.013) % 1.05;
      const f = Math.min(1, p);
      prog.set({ label: f >= 1 ? 'Extracting textures' : 'Downloading Minecraft 26.3', fraction: f, loaded: Math.round(f * 41_483_720), total: 41_483_720 });
    }, 120),
  );
  const indet = progressBar();
  indet.set({ label: 'Reading pack…', fraction: null });

  const tipBtn = button({ label: 'Hover or focus me', variant: 'secondary' });
  tooltip(tipBtn, 'Tooltips appear on hover and keyboard focus');

  // ---- Surfaces
  const tabsEl = tabs({
    value: 'preview',
    tabs: [
      { value: 'preview', label: 'Preview', icon: 'eye' },
      { value: 'effects', label: 'Effects', icon: 'magic-edit' },
      { value: 'pack', label: 'Pack', icon: 'package' },
    ],
    onChange: (v) => (tabPanel.textContent = `Selected: ${v}`),
  });
  const tabPanel = h('p', { class: 'muted' }, 'Selected: preview');

  const texCanvas = (t: ReturnType<typeof grassSide>) => {
    const c = t.toCanvas();
    c.className = 'pixelated kit-tex';
    return c;
  };

  // ---- Files & game data
  const dz = dropzone({ accept: '.zip,.mcpack', label: 'Drop a pack here or click to browse', hint: '.zip (Java) or .mcpack (Bedrock)', onFiles: (f) => toast(`Got ${f.map((x) => x.name).join(', ')}`, { tone: 'success' }) });
  const dzCompact = dropzone({ accept: 'image/png', label: 'Upload PNG', hint: 'Replaces the current texture', compact: true, icon: 'image', onFiles: (f) => toast(`Got ${f[0].name}`) });

  const vpJava = versionPicker({ edition: 'java', value: '26.3', allowEditionChange: true, label: 'Game version', onChange: (e, v) => toast(`Picked ${e} ${v}`) });
  const vpBedrock = versionPicker({ edition: 'bedrock', value: 'latest', onChange: (e, v) => toast(`Picked ${e} ${v}`) });

  const assetPanel = assetLoadingPanel({ edition: 'java', version: '26.3', onPickJar: (f) => toast(`Using ${f.name}`), onCancel: () => toast('Cancelled') });
  let ap = 0;
  timers.push(
    setInterval(() => {
      if (assetPanel.classList.contains('is-error')) return;
      ap = (ap + 0.02) % 1;
      assetPanel.set({ label: 'Downloading textures', fraction: ap, loaded: Math.round(ap * 3_100_000), total: 3_100_000 });
    }, 200),
  );
  const assetErr = assetLoadingPanel({ edition: 'java', version: '1.20.1' });
  assetErr.error("Mojang's servers didn't answer. Check your connection and try again.", () => toast('Retrying…'), (f) => toast(`Using ${f.name}`));

  // ---- Editor layout demo
  const pane = (title: string, ic: Parameters<typeof icon>[0]) =>
    h('div', { class: 'panel' }, h('div', { class: 'panel-header' }, icon(ic), h('span', { class: 'panel-title' }, title)), h('div', { class: 'panel-body muted' }, `${title} content`));
  const layout = editorLayout({
    left: pane('Textures', 'bulletlist'),
    center: h('div', { class: 'panel kit-canvas' }, h('div', { class: 'checker kit-canvas-bg' }), h('div', { class: 'toolbar kit-toolbar' }, ['pencil', 'eraser', 'fill', 'pipette', 'line', 'rect', 'select'].map((n) => iconButton(n as never, n, () => undefined, { active: n === 'pencil' })))),
    right: pane('Preview', 'eye'),
    labels: { left: 'Textures', center: 'Canvas', right: 'Preview' },
  });

  const nav = h(
    'nav',
    { class: 'kit-nav', 'aria-label': 'Kit sections' },
    ['foundations', 'buttons', 'controls', 'surfaces', 'feedback', 'files', 'layout'].map((id) =>
      h(
        'a',
        {
          class: 'chip',
          href: routeHref('/kit'),
          on: {
            click: (e: MouseEvent) => {
              e.preventDefault();
              document.getElementById(`kit-${id}`)?.scrollIntoView({ behavior: 'smooth' });
            },
          },
        },
        id[0].toUpperCase() + id.slice(1),
      ),
    ),
  );

  root.append(
    h(
      'div',
      { class: 'container kit-wrap' },
      h('header', { class: 'kit-hero' }, logoMark(48), h('div', null, h('h1', null, 'UI kit'), h('p', { class: 'muted' }, 'Every component in one place for visual QA — try it in both themes and at every width.')), nav),
      section(
        'foundations',
        'Foundations',
        'Type, colour tokens and icons.',
        wide(demo('Type scale (Texel, 8px em grid)', typeScale)),
        wide(demo('Colour tokens', colors)),
        h('div', { class: 'kit-demo kit-wide' }, h('div', { class: 'kit-demo-title' }, 'Icons'), h('div', { class: 'kit-demo-body' }, iconFilter, iconGrid)),
      ),
      section(
        'buttons',
        'Buttons & chips',
        'Pixel bevel, 1px press offset, visible focus rings.',
        demo('Variants', h('div', { class: 'row wrap' }, variants.map((v) => button({ label: v[0].toUpperCase() + v.slice(1), variant: v })))),
        demo('Sizes & icons', h('div', { class: 'row wrap' }, button({ label: 'Small', size: 'sm', icon: 'plus' }), button({ label: 'Medium', icon: 'download' }), button({ label: 'Large', size: 'lg', icon: 'magic-edit', variant: 'primary' }), button({ icon: 'trash', title: 'Delete', variant: 'danger' }))),
        demo('States', h('div', { class: 'row wrap' }, button({ label: 'Disabled', disabled: true }), button({ label: 'Disabled', variant: 'primary', disabled: true }), busyBtn, menuAnchor)),
        demo(
          'Icon buttons',
          h(
            'div',
            { class: 'row wrap' },
            gridBtn,
            iconButton('undo', 'Undo', () => undefined),
            iconButton('redo', 'Redo', () => undefined, { disabled: true }),
            iconButton('zoom-in', 'Zoom in', () => undefined, { size: 'sm' }),
            iconButton('zoom-out', 'Zoom out', () => undefined, { size: 'sm' }),
          ),
        ),
        demo(
          'Chips, badges & keys',
          h('div', { class: 'stack' },
            h('div', { class: 'row wrap' }, h('button', { type: 'button', class: 'chip', 'aria-pressed': 'true' }, icon('box'), 'Blocks'), h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false' }, 'Items'), h('span', { class: 'chip' }, 'Entity')),
            h('div', { class: 'row wrap' }, (['green', 'blue', 'purple', 'gold', 'red', 'gray'] as const).map((t) => badge(t, t))),
            h('div', { class: 'row wrap' }, kbd('Ctrl'), kbd('Z'), h('span', { class: 'muted' }, 'undo'), kbd('?'), h('span', { class: 'muted' }, 'shortcuts')),
          ),
        ),
      ),
      section(
        'controls',
        'Form controls',
        'Sliders, toggles, selects, text and colour.',
        demo('Sliders', h('div', { class: 'stack stack-lg' }, sliderEl, sliderDec)),
        demo('Toggles', h('div', { class: 'stack stack-lg' }, togg, togg2)),
        demo('Select & segmented', h('div', { class: 'stack stack-lg' }, sel, seg, segIcons)),
        demo('Text', h('div', { class: 'stack' }, txt, search, area)),
        demo('Colour', h('div', { class: 'stack stack-lg' }, swatch, picker)),
        demo(
          'optionControl (every OptionDef type)',
          h('div', { class: 'stack stack-lg' }, SAMPLE_OPTIONS.map((d) => optionControl(d, d.default, () => undefined))),
        ),
        demo('optionsForm (groups, reset, dependsOn, filter)', h('div', { class: 'stack' }, optFilter, optionsDemo)),
      ),
      section(
        'surfaces',
        'Surfaces',
        'Cards, panels, toolbars, tabs and empty states.',
        demo(
          'Card',
          card({
            title: 'Pack icon',
            icon: 'image',
            actions: [iconButton('upload', 'Upload', () => undefined, { size: 'sm' }), iconButton('trash', 'Remove', () => undefined, { size: 'sm' })],
            body: h('div', { class: 'row' }, texCanvas(grassSide()), texCanvas(ore()), texCanvas(planks())),
          }),
        ),
        demo('Tabs', h('div', { class: 'stack' }, tabsEl, tabPanel)),
        demo(
          'Toolbar',
          h(
            'div',
            { class: 'toolbar' },
            iconButton('pencil', 'Pencil (B)', () => undefined, { active: true }),
            iconButton('eraser', 'Eraser (E)', () => undefined, { active: false }),
            iconButton('fill', 'Fill (G)', () => undefined, { active: false }),
            h('span', { class: 'toolbar-sep' }),
            iconButton('flip-horizontal-2', 'Flip', () => undefined),
            iconButton('grid', 'Grid (#)', () => undefined, { active: true }),
          ),
        ),
        demo('Empty state', emptyState({ icon: 'folder', title: 'No projects yet', text: 'Start a texture pack, skin or shader and it will show up here.', action: button({ label: 'New project', icon: 'plus', variant: 'primary' }) })),
        demo('Checker & pixelated', h('div', { class: 'checker kit-checker' }, texCanvas(ore(5, [255, 90, 120])))),
      ),
      section(
        'feedback',
        'Feedback',
        'Progress, spinners, toasts, tooltips, dialogs.',
        demo('Progress', h('div', { class: 'stack stack-lg' }, prog, indet)),
        demo('Spinners', h('div', { class: 'row wrap', style: { '--gap': '24px' } }, spinner(16), spinner(24), spinner(32), spinner(48))),
        demo(
          'Toasts',
          h(
            'div',
            { class: 'row wrap' },
            button({ label: 'Info', onClick: () => toast('Autosaved a moment ago') }),
            button({ label: 'Success', onClick: () => toast('Pack exported — 412 textures', { tone: 'success' }) }),
            button({ label: 'Warning', onClick: () => toast('This version has no shaders to patch', { tone: 'warn' }) }),
            button({ label: 'Error', onClick: () => toast("Couldn't reach Mojang's servers", { tone: 'error' }) }),
            button({ label: 'With action', onClick: () => toast('Texture reset to vanilla', { action: { label: 'Undo', onClick: () => toast('Restored', { tone: 'success' }) } }) }),
          ),
        ),
        demo('Tooltip', tipBtn),
        demo(
          'Dialogs',
          h(
            'div',
            { class: 'row wrap' },
            button({
              label: 'Modal',
              onClick: () =>
                openModal({
                  title: 'Export texture pack',
                  body: h('div', { class: 'stack' }, h('p', null, 'Your pack will be saved as a .zip file for Java 26.3.'), progressBar()),
                  actions: [
                    { label: 'Cancel' },
                    { label: 'Export', variant: 'primary', onClick: () => new Promise((r) => setTimeout(r, 1200)) },
                  ],
                }),
            }),
            button({ label: 'Confirm', onClick: () => void confirmDialog('Reset texture?', 'Your edits to stone.png will be lost.', 'Reset', true).then((ok) => toast(ok ? 'Confirmed' : 'Cancelled')) }),
            button({ label: 'Prompt', onClick: () => void promptDialog('Rename project', 'Name', 'My Pack').then((v) => v && toast(`Renamed to ${v}`)) }),
            button({
              label: 'Blocking',
              onClick: () => {
                const bar = progressBar();
                const m = openModal({ title: 'Exporting…', body: h('div', { class: 'stack' }, h('p', null, "This dialog can't be dismissed and closes by itself."), bar), dismissible: false });
                let f = 0;
                const t = setInterval(() => {
                  f += 0.05;
                  bar.set({ label: 'Writing pack', fraction: Math.min(1, f) });
                  if (f >= 1) {
                    clearInterval(t);
                    m.close();
                  }
                }, 150);
              },
            }),
            button({
              label: 'Toast over dialog',
              onClick: () => {
                openModal({ title: 'Pack exported', body: h('p', null, 'Toasts stay clickable above dialogs.'), actions: [{ label: 'Done', variant: 'primary' }] });
                toast('Deleted "My Pack"', { action: { label: 'Undo delete', onClick: () => toast('Restored "My Pack"', { tone: 'success', duration: 20000 }) } });
              },
            }),
            button({
              label: 'Shortcuts',
              onClick: () =>
                openShortcutsSheet([
                  { title: 'Tools', items: [{ keys: ['B'], label: 'Pencil' }, { keys: ['E'], label: 'Eraser' }, { keys: ['G'], label: 'Fill' }, { keys: ['I'], label: 'Picker' }] },
                  { title: 'Edit', items: [{ keys: ['Mod', 'Z'], label: 'Undo' }, { keys: ['Mod', 'Shift', 'Z'], label: 'Redo' }, { keys: ['#'], label: 'Toggle grid' }] },
                ]),
            }),
          ),
        ),
      ),
      section(
        'files',
        'Files & game data',
        'Drop zones, version picker and the vanilla asset download panel.',
        demo('Dropzone', dz),
        demo('Dropzone (compact)', dzCompact),
        demo('Version picker (Java, edition switch)', vpJava),
        demo('Version picker (Bedrock)', vpBedrock),
        wide(demo('Asset loading', assetPanel)),
        wide(demo('Asset loading (error)', assetErr)),
      ),
      h(
        'section',
        { class: 'kit-section', id: 'kit-layout' },
        h('div', { class: 'kit-section-head' }, h('h2', null, 'Editor layout'), h('p', { class: 'muted' }, '3 columns on desktop, canvas + tabbed side panel on tablets, bottom tab bar on phones.')),
        h('div', { class: 'kit-layout-frame' }, layout),
      ),
    ),
  );

  return () => timers.forEach((t) => clearInterval(t));
}
