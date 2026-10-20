// Custom Totem of Undying maker at /totem-maker: pick a skin (upload, Java username, a saved skin
// project or a default skin), choose a style, check the in-game previews, touch up the pixels, then
// download a Java .zip / Bedrock .mcpack, the PNG, or keep editing in the texture tool. Shares the
// converter's page layout and card styles (cv-*).

import '../convert/convert.css';
import './totem.css';
import type { AssetIndex, Edition, Progress, SkinModel } from '../../core/types';
import type { RouteContext } from '../../core/router';
import { href as routeHref, navigate } from '../../core/router';
import { h, formatBytes, uid } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { badge, button, progressBar, segmented, setButtonBusy, textInput, toggle } from '../../ui/components';
import { dropzone } from '../../ui/dropzone';
import { toast } from '../../ui/toast';
import { versionPicker } from '../../ui/version-picker';
import { getProject, listProjects, saveProject } from '../../core/storage';
import { saveBlob } from '../../core/download';
import { friendlyError, isAbortError } from '../../core/net';
import { imageDataToCanvas } from '../../core/pixels';
import { decodeImage, loadImageCodecs } from '../../core/image-lazy';
import { BEDROCK_LATEST_ID, DEFAULT_JAVA_VERSION, loadAssets } from '../../editions/versions';
import { siteFooter } from '../../app/footer';
import type { SkinProjectData } from '../skins/export';
import { drawFigure } from '../skins/ui/figure';
import { createStarterSkin } from '../skins/starters';
import { fetchSkinByUsername, isHdKeptNote, listDefaultSkins, readDefaultSkin, readSkinFile, SkinSourceError, validateUsername, type DefaultSkin } from '../skins/ui/sources';
import { t } from './i18n/text';
import { loadTotemText } from './i18n/load';
import { kit } from '../../ui/i18n/kit';
import { fmt, fmtNodes } from '../../i18n/editor-text';
import { targetText } from '../convert/target';

/** HD skins work too: the totem is read from them at 64x64. */
const totemNotes = (notes: readonly string[]): string[] => notes.map((n) => (isHdKeptNote(n) ? t.step1.hdNote : n));
import { hotbarPreview, popPreview } from './preview';
import {
  DEFAULT_OPTIONS,
  FIRST_TOTEM_VERSION,
  STYLES,
  defaultPackName,
  javaHasTotem,
  makeTotem,
  totemDescription,
  totemShape,
  totemTexturePath,
  type TotemOptions,
  type TotemShape,
  type TotemStyle,
} from './totem';

// The pixel editor and the pack builder (zip writer, PNG encoder) load when they are used.
const pixelEditor = () => import('./editor');
const packBuilder = () => import('./pack');

type Source = 'upload' | 'username' | 'saved' | 'default';

interface Skin {
  image: ImageData;
  model: SkinModel;
  name: string;
  source: Source;
  notes: string[];
}

interface ShapeEntry {
  shape: TotemShape;
  files: AssetIndex;
}

const SOURCES: { id: Source; label: () => string; icon: IconName }[] = [
  { id: 'username', label: () => t.step1.mySkin, icon: 'user' },
  { id: 'upload', label: () => t.step1.upload, icon: 'upload' },
  { id: 'saved', label: () => t.step1.saved, icon: 'human' },
  { id: 'default', label: () => t.step1.defaults, icon: 'users' },
];

/** The player's own Java name, remembered on this device so "use my skin" is one click next time. */
const MY_NAME_KEY = 'to-my-mc-name';
function readMyName(): string {
  try {
    return localStorage.getItem(MY_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function writeMyName(name: string | null): void {
  try {
    if (name) localStorage.setItem(MY_NAME_KEY, name);
    else localStorage.removeItem(MY_NAME_KEY);
  } catch {
    /* storage blocked: nothing to remember */
  }
}

function pixelCanvas(img: ImageData | null, cls: string): HTMLCanvasElement {
  const c = img ? imageDataToCanvas(img) : h('canvas', { width: 16, height: 16 });
  c.classList.add(cls, 'pixelated');
  c.setAttribute('aria-hidden', 'true');
  return c;
}

function figureCanvas(img: ImageData, model: SkinModel, cls: string): HTMLCanvasElement {
  const c = h('canvas', { class: cls, 'aria-hidden': 'true' });
  requestAnimationFrame(() => drawFigure(c, img, model));
  return c;
}

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  await loadTotemText(ctx.locale);
  root.classList.add('totem-view');
  let alive = true;
  const ctrl = new AbortController();
  let skin: Skin | null = null;
  const opts: TotemOptions = { ...DEFAULT_OPTIONS };
  let generated: ImageData | null = null;
  let edited: ImageData | null = null;
  let edition: Edition = 'java';
  let javaVersion = DEFAULT_JAVA_VERSION;
  let packName = defaultPackName(null);
  let nameTouched = false;
  const bedrock: { uuids?: { header: string; module: string }; packVersion?: [number, number, number] } = {};
  const shapes = new Map<string, ShapeEntry>();
  let shapeLoad: { key: string; progress: Progress | null; error: string | null } | null = null;
  let source: Source = 'username';
  let myName = readMyName();

  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const announce = (text: string) => {
    live.textContent = '';
    requestAnimationFrame(() => (live.textContent = text));
  };

  // ---------------------------------------------------------------- step 1: the skin
  const tabIds = Object.fromEntries(SOURCES.map((s) => [s.id, uid('tt-tab')])) as Record<Source, string>;
  const panelIds = Object.fromEntries(SOURCES.map((s) => [s.id, uid('tt-panel')])) as Record<Source, string>;
  const tabs = SOURCES.map((s) => {
    const b = h('button', { type: 'button', class: 'tt-tab', role: 'tab', id: tabIds[s.id], 'aria-controls': panelIds[s.id], dataset: { source: s.id } }, icon(s.icon), h('span', null, s.label()));
    b.addEventListener('click', () => showSource(s.id));
    b.addEventListener('keydown', (ev) => {
      const i = SOURCES.findIndex((x) => x.id === s.id);
      const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      ev.preventDefault();
      const next = SOURCES[(i + d + SOURCES.length) % SOURCES.length].id;
      showSource(next);
      tabs.find((tab) => tab.dataset.source === next)?.focus();
    });
    return b;
  });
  const tabList = h('div', { class: 'tt-tabs', role: 'tablist', 'aria-label': t.step1.sources }, tabs);

  // Upload
  const dz = dropzone({
    accept: '.png,image/png',
    label: t.step1.drop,
    hint: t.step1.dropHint,
    icon: 'upload',
    onFiles: ([file]) => void uploadSkin(file),
  });
  dz.classList.add('tt-dz');
  async function uploadSkin(file: File | undefined) {
    if (!file) return;
    dz.setError(null);
    dz.classList.add('is-busy');
    try {
      const loaded = await readSkinFile(file);
      if (!alive) return;
      const name = file.name.replace(/\.png$/i, '').replace(/[_-]+/g, ' ').trim() || t.step1.uploadedName;
      setSkin({ image: loaded.image, model: loaded.model, name, source: 'upload', notes: totemNotes(loaded.notes) });
    } catch (err) {
      dz.setError(err instanceof SkinSourceError ? err.message : t.step1.uploadFailed);
    } finally {
      dz.classList.remove('is-busy');
    }
  }

  // Username
  const userInput = h('input', { class: 'input', type: 'text', placeholder: t.step1.username, autocomplete: 'off', spellcheck: false, maxLength: 36, 'aria-label': t.step1.usernameLabel, id: uid('tt-user'), value: myName });
  const rememberBox = h('input', { type: 'checkbox', checked: true, id: uid('tt-remember') }) as HTMLInputElement;
  const rememberRow = h('label', { class: 'tt-remember', for: rememberBox.id }, rememberBox, h('span', null, t.step1.remember));
  const userError = h('p', { class: 'tt-field-error', role: 'alert', hidden: true });
  const userBtn = button({ label: t.step1.getSkin, icon: 'download', variant: 'primary', class: 'tt-user-go' });
  userBtn.setAttribute('aria-label', t.step1.getSkin);
  async function lookup(remember = true) {
    const invalid = validateUsername(userInput.value);
    userError.hidden = !invalid;
    userError.textContent = invalid ?? '';
    if (invalid) {
      userInput.focus();
      return;
    }
    setButtonBusy(userBtn, true);
    try {
      const loaded = await fetchSkinByUsername(userInput.value, ctrl.signal);
      if (!alive) return;
      setSkin({ image: loaded.image, model: loaded.model, name: loaded.username, source: 'username', notes: loaded.notes });
      if (remember && rememberBox.checked) {
        myName = loaded.username;
        writeMyName(myName);
        paintMine();
      }
    } catch (err) {
      if (ctrl.signal.aborted) return;
      userError.hidden = false;
      userError.textContent = err instanceof SkinSourceError ? err.message : t.step1.lookupFailed;
    } finally {
      if (userBtn.isConnected) setButtonBusy(userBtn, false);
    }
  }
  userBtn.addEventListener('click', () => void lookup());
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void lookup();
  });
  userInput.addEventListener('input', () => (userError.hidden = true));
  const examples = h(
    'div',
    { class: 'tt-examples' },
    h('span', { class: 'faint small' }, t.step1.try),
    ['jeb_', 'Dinnerbone', 'Notch'].map((n) => {
      const b = h('button', { type: 'button', class: 'tt-chip' }, n);
      b.addEventListener('click', () => {
        userInput.value = n;
        userError.hidden = true;
        void lookup(false);
      });
      return b;
    }),
  );
  // One-click "use my skin" once the player's name is remembered
  const mine = h('div', { class: 'tt-mine', hidden: true });
  function paintMine() {
    mine.hidden = !myName;
    if (!myName) return mine.replaceChildren();
    const use = button({ label: fmt(t.step1.useMine, { name: myName }), icon: 'user', variant: 'primary', class: 'tt-mine-use' });
    use.addEventListener('click', () => {
      userInput.value = myName;
      void lookup(false);
    });
    const forget = h('button', { type: 'button', class: 'tt-link' }, t.step1.notYou);
    forget.addEventListener('click', () => {
      myName = '';
      writeMyName(null);
      userInput.value = '';
      paintMine();
      userInput.focus();
    });
    mine.replaceChildren(use, forget);
  }
  paintMine();
  const userPanel = h(
    'div',
    { class: 'tt-user' },
    mine,
    h('div', { class: 'tt-user-row' }, h('div', { class: 'input-with-icon grow' }, icon('user'), userInput), userBtn),
    rememberRow,
    userError,
    examples,
    h('p', { class: 'tt-note' }, icon('circle-info', { size: 16 }), h('span', null, t.step1.usernameNote)),
  );

  // Saved skin projects
  const savedGrid = h('div', { class: 'tt-skin-grid', role: 'list', 'aria-label': t.step1.savedLabel });
  const savedEmpty = h(
    'p',
    { class: 'tt-empty muted', hidden: true },
    fmtNodes(t.step1.noSaved, { editor: h('a', { href: routeHref('/skins') }, t.step1.skinEditor) }),
  );
  const savedPanel = h('div', { class: 'tt-saved' }, savedGrid, savedEmpty);
  async function paintSaved() {
    let projects: SkinProjectData[] = [];
    try {
      projects = (await listProjects('skin')) as SkinProjectData[];
    } catch {
      projects = [];
    }
    if (!alive) return;
    savedEmpty.hidden = projects.length > 0;
    savedGrid.replaceChildren(
      ...projects.map((p) => {
        const thumb = h('span', { class: 'tt-skin-thumb' });
        const b = h('button', { type: 'button', class: 'tt-skin-opt', role: 'listitem', 'aria-label': fmt(t.step1.skinArms, { name: p.name || t.step1.untitled, model: p.model }) }, thumb, h('span', { class: 'tt-skin-name truncate' }, p.name || t.step1.untitled));
        let img: ImageData | null = null;
        void decodeImage(p.image, 'png')
          .then((d) => {
            if (!((d.width === 64 && d.height === 64) || (d.width === 128 && d.height === 128))) return;
            img = d;
            thumb.appendChild(figureCanvas(d, p.model, 'tt-figure'));
          })
          .catch(() => thumb.appendChild(icon('human')));
        b.addEventListener('click', async () => {
          try {
            const d = img ?? (await decodeImage(p.image, 'png'));
            setSkin({ image: d, model: p.model, name: p.name || t.step1.myName, source: 'saved', notes: [] });
          } catch {
            toast(t.step1.openFailed, { tone: 'error' });
          }
        });
        return b;
      }),
    );
  }

  // Default skins from the game files
  let defaultsLoad: Promise<AssetIndex> | null = null;
  let defaultModel: SkinModel = 'classic';
  const defaultBar = progressBar({ label: fmt(t.step1.gettingDefaults, { version: DEFAULT_JAVA_VERSION }) });
  const defaultStatus = h('div', { class: 'tt-default-status', hidden: true }, defaultBar);
  const defaultGrid = h('div', { class: 'tt-skin-grid', role: 'list', 'aria-label': t.step1.defaultsLabel });
  const defaultModelSeg = segmented<SkinModel>({
    value: 'classic',
    label: t.step1.armStyle,
    size: 'sm',
    options: [
      { value: 'classic', label: t.step1.classicArms },
      { value: 'slim', label: t.step1.slimArms },
    ],
    onChange: (m) => {
      defaultModel = m;
      void paintDefaults();
    },
  });
  defaultModelSeg.hidden = true;
  const defaultError = h('div', { class: 'tt-default-error', hidden: true });
  const defaultPanel = h(
    'div',
    { class: 'tt-defaults' },
    h('p', { class: 'tt-note' }, icon('lock', { size: 16 }), h('span', null, fmt(t.step1.defaultsNote, { version: DEFAULT_JAVA_VERSION }))),
    defaultModelSeg,
    defaultStatus,
    defaultError,
    defaultGrid,
  );
  async function paintDefaults() {
    defaultError.hidden = true;
    if (!defaultsLoad) {
      defaultsLoad = loadAssets('java', DEFAULT_JAVA_VERSION, { onProgress: (p) => defaultBar.set(p), signal: ctrl.signal });
    }
    const load = defaultsLoad;
    defaultStatus.hidden = false;
    defaultBar.set({ label: t.step1.checking, fraction: null });
    let assets: AssetIndex;
    try {
      assets = await load;
    } catch (err) {
      if (!alive || ctrl.signal.aborted) return;
      if (defaultsLoad === load) defaultsLoad = null;
      defaultStatus.hidden = true;
      defaultError.hidden = false;
      defaultError.replaceChildren(icon('warning-diamond', { size: 20 }), h('span', null, friendlyError(err)), button({ label: kit.tryAgain, icon: 'reload', size: 'sm', variant: 'secondary', onClick: () => void paintDefaults() }));
      return;
    }
    if (!alive) return;
    defaultStatus.hidden = true;
    const all = listDefaultSkins(assets);
    const both = new Set(all.map((s) => s.model)).size > 1;
    defaultModelSeg.hidden = !both;
    const list = both ? all.filter((s) => s.model === defaultModel) : all;
    defaultGrid.replaceChildren(
      ...list.map((s: DefaultSkin) => {
        const thumb = h('span', { class: 'tt-skin-thumb' });
        const b = h('button', { type: 'button', class: 'tt-skin-opt', role: 'listitem', 'aria-label': fmt(t.step1.skinArms, { name: s.name, model: s.model }), dataset: { skin: s.id } }, thumb, h('span', { class: 'tt-skin-name truncate' }, s.name));
        void readDefaultSkin(assets, s)
          .then((l) => thumb.appendChild(figureCanvas(l.image, s.model, 'tt-figure')))
          .catch(() => undefined);
        b.addEventListener('click', async () => {
          try {
            const l = await readDefaultSkin(assets, s);
            setSkin({ image: l.image, model: s.model, name: s.name, source: 'default', notes: [] });
          } catch (err) {
            toast(friendlyError(err, t.step1.openFailedShort), { tone: 'error' });
          }
        });
        return b;
      }),
    );
  }

  const panels: Record<Source, HTMLElement> = { upload: dz, username: userPanel, saved: savedPanel, default: defaultPanel };
  const panelEls = SOURCES.map((s) => h('div', { class: 'tt-panel', role: 'tabpanel', id: panelIds[s.id], 'aria-labelledby': tabIds[s.id], dataset: { source: s.id } }, panels[s.id]));
  function showSource(s: Source) {
    source = s;
    tabs.forEach((tab) => {
      const on = tab.dataset.source === s;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    panelEls.forEach((p) => (p.hidden = p.dataset.source !== s));
    if (s === 'saved') void paintSaved();
    if (s === 'default') void paintDefaults();
  }

  const picker1 = h('div', { class: 'tt-picker' }, tabList, ...panelEls);
  const chosen = h('div', { class: 'tt-chosen', hidden: true });
  const step1 = stepCard(1, t.step1.title, t.step1.text, 'human', h('div', { class: 'cv-step-body' }, chosen, picker1, live));

  function paintChosen() {
    if (!skin) {
      chosen.hidden = true;
      picker1.hidden = false;
      return;
    }
    const s = skin;
    const notes = s.notes.length
      ? h('details', { class: 'cv-notes' }, h('summary', null, icon('circle-info', { size: 16 }), fmt(t.step1.notes, { count: s.notes.length })), h('ul', null, s.notes.map((n) => h('li', null, n))))
      : null;
    const from = { upload: t.step1.fromUpload, username: t.step1.fromUsername, saved: t.step1.fromSaved, default: t.step1.fromDefault }[s.source];
    const change = button({ label: picker1.hidden ? t.step1.change : t.step1.keep, icon: picker1.hidden ? 'repeat' : 'check', variant: 'ghost', size: 'sm', class: 'tt-change' });
    change.setAttribute('aria-label', picker1.hidden ? t.step1.changeSkin : t.step1.keep);
    change.addEventListener('click', () => {
      picker1.hidden = !picker1.hidden;
      paintChosen();
      if (!picker1.hidden) tabs.find((tab) => tab.dataset.source === source)?.focus();
    });
    chosen.replaceChildren(
      h(
        'div',
        { class: 'cv-pack-row tt-chosen-row' },
        h('span', { class: 'tt-chosen-thumb checker' }, figureCanvas(s.image, s.model, 'tt-figure')),
        h(
          'div',
          { class: 'cv-pack-info' },
          h('strong', { class: 'cv-pack-name truncate tt-chosen-name' }, s.name),
          h('span', { class: 'cv-pack-badges' }, badge(from, 'gold'), badge(s.model === 'slim' ? t.step1.slimArms : t.step1.classicArms, 'gray')),
        ),
        change,
      ),
      ...(notes ? [notes] : []),
    );
    chosen.hidden = false;
  }

  function setSkin(next: Skin) {
    skin = next;
    edited = null;
    if (!nameTouched) {
      packName = defaultPackName(next.name);
      nameField.setValue(packName);
    }
    picker1.hidden = true;
    paintChosen();
    regenerate();
    paintExport();
    clearInstall();
    announce(fmt(t.step1.made, { name: next.name }));
    if (matchMedia('(max-width: 960px)').matches) previewCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------------------------------------------------------- step 2: style
  const styleCards = STYLES.map((s) => {
    const thumb = h('span', { class: 'tt-style-thumb checker' });
    const b = h(
      'button',
      { type: 'button', class: 'cv-ed tt-style', role: 'radio', dataset: { value: s.id } },
      thumb,
      h('span', { class: 'cv-ed-text' }, h('strong', null, s.name), h('span', { class: 'faint small' }, s.description)),
      h('span', { class: 'cv-ed-check' }, icon('check', { size: 16 })),
    );
    b.addEventListener('click', () => chooseStyle(s.id));
    b.addEventListener('keydown', (ev) => {
      const i = STYLES.findIndex((x) => x.id === s.id);
      const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      ev.preventDefault();
      const next = STYLES[(i + d + STYLES.length) % STYLES.length].id;
      chooseStyle(next);
      (styleGroup.querySelector(`[data-value="${next}"]`) as HTMLElement | null)?.focus();
    });
    return b;
  });
  const styleGroup = h('div', { class: 'cv-eds tt-styles', role: 'radiogroup', 'aria-label': t.step2.style }, styleCards);
  const outerToggle = toggle({ label: t.step2.outer, description: t.step2.outerHint, value: opts.outer, onChange: (v) => setOption('outer', v) });
  const outlineToggle = toggle({ label: t.step2.outline, description: t.step2.outlineHint, value: opts.outline, onChange: (v) => setOption('outline', v) });
  const wingsToggle = toggle({ label: t.step2.wings, description: t.step2.wingsHint, value: opts.wings, onChange: (v) => setOption('wings', v) });
  outerToggle.classList.add('tt-opt-outer');
  outlineToggle.classList.add('tt-opt-outline');
  wingsToggle.classList.add('tt-opt-wings');
  const shapeStatus = h('div', { class: 'tt-shape', role: 'status' });
  const step2 = stepCard(2, t.step2.title, t.step2.text, 'sliders', h('div', { class: 'cv-step-body' }, styleGroup, h('div', { class: 'tt-toggles' }, outerToggle, outlineToggle, wingsToggle), shapeStatus));

  function chooseStyle(s: TotemStyle) {
    if (opts.style === s) return;
    opts.style = s;
    changedOptions();
  }

  function setOption(k: 'outer' | 'outline' | 'wings', v: boolean) {
    opts[k] = v;
    changedOptions();
  }

  function changedOptions() {
    if (edited) {
      edited = null;
      toast(t.step2.editsReplaced, { tone: 'info' });
    }
    void ensureShape();
    regenerate();
    clearInstall();
  }

  function paintStyles() {
    for (const b of styleCards) {
      const on = b.dataset.value === opts.style;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      const thumb = b.querySelector('.tt-style-thumb') as HTMLElement;
      const img = skin ? makeTotem(skin.image, { ...opts, style: b.dataset.value as TotemStyle }, currentShape(), skin.model) : null;
      thumb.replaceChildren(img ? pixelCanvas(img, 'tt-style-canvas') : icon('human'));
    }
  }

  // ---------------------------------------------------------------- vanilla totem (outline, wings)
  const shapeKey = () => (edition === 'java' ? `java:${javaVersion}` : `bedrock:${BEDROCK_LATEST_ID}`);
  const targetLabel = () => targetText({ edition, version: javaVersion });
  const needsShape = () => opts.outline || opts.wings;
  const currentShape = (): TotemShape | null => (needsShape() ? (shapes.get(shapeKey())?.shape ?? null) : null);

  async function ensureShape(force = false) {
    const key = shapeKey();
    if (!needsShape() || shapes.has(key) || (edition === 'java' && !javaHasTotem(javaVersion))) {
      paintShape();
      return;
    }
    if (shapeLoad?.key === key && !shapeLoad.error && !force) return;
    const load = { key, progress: null as Progress | null, error: null as string | null };
    shapeLoad = load;
    paintShape();
    const ed = edition;
    const ver = ed === 'java' ? javaVersion : BEDROCK_LATEST_ID;
    try {
      const files = await loadAssets(ed, ver, {
        signal: ctrl.signal,
        onProgress: (p) => {
          load.progress = p;
          if (shapeLoad === load) paintShape();
        },
      });
      const img = await files.readImage(totemTexturePath(ed, ver, files));
      shapes.set(key, { shape: totemShape(img), files });
      if (!alive) return;
      if (shapeLoad === load) shapeLoad = null;
      if (shapeKey() === key) {
        regenerate();
        paintExport();
      }
    } catch (err) {
      if (!alive || ctrl.signal.aborted || isAbortError(err)) return;
      console.error(err);
      load.error = friendlyError(err);
    }
    paintShape();
  }

  const shapeBar = progressBar({ label: t.step2.gettingFiles });
  function paintShape() {
    const key = shapeKey();
    shapeStatus.className = 'tt-shape';
    if (edition === 'java' && !javaHasTotem(javaVersion)) {
      shapeStatus.replaceChildren();
      return;
    }
    if (!needsShape()) {
      shapeStatus.replaceChildren(h('p', { class: 'faint small' }, fmt(t.step2.shapeFrom, { target: targetLabel() })));
      return;
    }
    if (shapes.has(key)) {
      shapeStatus.classList.add('is-ready');
      shapeStatus.replaceChildren(icon('check', { size: 16 }), h('span', null, fmt(t.step2.fitted, { target: targetLabel() })));
      return;
    }
    if (shapeLoad?.key === key && shapeLoad.error) {
      shapeStatus.classList.add('is-error');
      shapeStatus.replaceChildren(
        icon('warning-diamond', { size: 20 }),
        h('span', null, fmt(t.step2.shapeFailed, { error: shapeLoad.error })),
        button({ label: kit.tryAgain, icon: 'reload', variant: 'secondary', size: 'sm', onClick: () => void ensureShape(true) }),
      );
      return;
    }
    shapeBar.set(shapeLoad?.progress ?? { label: fmt(t.step2.gettingTarget, { target: targetLabel() }), fraction: null });
    shapeStatus.classList.add('is-loading');
    shapeStatus.replaceChildren(shapeBar);
  }

  // ---------------------------------------------------------------- preview
  const bigHost = h('div', { class: 'tt-big checker' });
  const pop = popPreview();
  const hotbar = hotbarPreview();
  const editedBadge = h('span', { class: 'tt-edited', hidden: true }, badge(t.preview.edited, 'gold'));
  const editBtn = button({ label: t.preview.edit, icon: 'pencil', variant: 'secondary', class: 'tt-edit-btn', onClick: () => void openEditor() });
  const pngBtn = button({ label: t.preview.png, icon: 'image', variant: 'secondary', class: 'tt-png-btn', onClick: () => void downloadPng() });
  const discardBtn = button({
    label: t.preview.undoEdits,
    icon: 'undo',
    variant: 'ghost',
    class: 'tt-discard-btn',
    onClick: () => {
      edited = null;
      regenerate();
      clearInstall();
    },
  });
  const previewEmpty = h('div', { class: 'tt-preview-empty' }, h('span', { class: 'tt-preview-empty-icon' }, icon('totem', { size: 48 })), h('p', { class: 'muted' }, t.preview.empty));
  const previewBody = h(
    'div',
    { class: 'tt-preview-body', hidden: true },
    h(
      'div',
      { class: 'tt-stages' },
      h('figure', { class: 'tt-stage' }, bigHost, h('figcaption', null, h('span', null, t.preview.texture), editedBadge)),
      h('figure', { class: 'tt-stage' }, pop.el, h('figcaption', null, h('span', null, t.preview.pop), h('button', { type: 'button', class: 'tt-replay', on: { click: () => pop.play() } }, icon('play', { size: 16 }), t.preview.play))),
    ),
    h('div', { class: 'tt-hotbar-wrap' }, hotbar.el, h('span', { class: 'faint small' }, t.preview.hotbar)),
    h('div', { class: 'cv-actions tt-preview-actions' }, editBtn, pngBtn, discardBtn),
  );
  const previewTitleId = uid('tt-prev');
  const previewCard = h(
    'section',
    { class: 'card tt-preview', 'aria-labelledby': previewTitleId },
    h('div', { class: 'cv-step-head' }, h('span', { class: 'tt-prev-icon', 'aria-hidden': 'true' }, icon('totem')), h('div', null, h('h2', { id: previewTitleId }, t.preview.title), h('p', { class: 'muted' }, t.preview.text))),
    h('div', { class: 'cv-step-body' }, previewEmpty, previewBody),
  );

  const current = (): ImageData | null => edited ?? generated;

  function regenerate() {
    generated = skin ? makeTotem(skin.image, opts, currentShape(), skin.model) : null;
    paintPreview();
    paintStyles();
  }

  let lastShown: ImageData | null = null;
  function paintPreview() {
    const img = current();
    previewEmpty.hidden = !!img;
    previewBody.hidden = !img;
    editedBadge.hidden = !edited;
    discardBtn.hidden = !edited;
    bigHost.replaceChildren(...(img ? [pixelCanvas(img, 'tt-big-canvas')] : []));
    if (img) bigHost.setAttribute('aria-label', fmt(t.preview.imageLabel, { name: skin?.name ?? t.preview.theSkin }));
    bigHost.setAttribute('role', 'img');
    hotbar.setImage(img);
    const first = !lastShown && !!img;
    pop.setImage(img);
    lastShown = img;
    if (first) requestAnimationFrame(() => pop.play());
    paintExport();
  }

  async function openEditor() {
    const img = current();
    if (!img || !generated) return;
    const base = generated;
    const { openTotemEditor } = await pixelEditor();
    if (!alive) return;
    openTotemEditor({
      image: img,
      generated: base,
      onSave: (out) => {
        edited = out;
        paintPreview();
        clearInstall();
        announce(t.preview.applied);
      },
    });
  }

  async function downloadPng() {
    const img = current();
    if (!img) return;
    const name = edition === 'bedrock' ? 'totem.png' : 'totem_of_undying.png';
    const { encodePng } = await loadImageCodecs();
    saveBlob(new Blob([encodePng(img)], { type: 'image/png' }), name);
  }

  // ---------------------------------------------------------------- step 3: the pack
  const editionCards = (['java', 'bedrock'] as Edition[]).map((e) => {
    const b = h(
      'button',
      { type: 'button', class: 'cv-ed tt-ed-choice', role: 'radio', dataset: { value: e } },
      h('span', { class: 'cv-ed-icon' }, icon(e === 'java' ? 'laptop' : 'gamepad')),
      h('span', { class: 'cv-ed-text' }, h('strong', null, e === 'java' ? t.step3.java : t.step3.bedrock), h('span', { class: 'faint small' }, e === 'java' ? t.step3.javaText : t.step3.bedrockText)),
      h('span', { class: 'cv-ed-check' }, icon('check', { size: 16 })),
    );
    b.addEventListener('click', () => chooseEdition(e));
    b.addEventListener('keydown', (ev) => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
      ev.preventDefault();
      const other: Edition = e === 'java' ? 'bedrock' : 'java';
      chooseEdition(other);
      (editionGroup.querySelector(`[data-value="${other}"]`) as HTMLElement | null)?.focus();
    });
    return b;
  });
  const editionGroup = h('div', { class: 'cv-eds tt-eds', role: 'radiogroup', 'aria-label': t.step3.edition }, editionCards);
  const vPicker = versionPicker({
    edition: 'java',
    value: javaVersion,
    label: t.step3.javaVersion,
    onChange: (_e, v) => {
      javaVersion = v;
      targetChanged();
    },
  });
  const pickerWrap = h('div', { class: 'cv-version tt-version' }, vPicker);
  const nameField = textInput({
    label: t.step3.packName,
    value: packName,
    maxLength: 64,
    placeholder: defaultPackName(null),
    onInput: (v) => {
      packName = v;
      nameTouched = true;
      clearInstall();
    },
  });
  nameField.classList.add('tt-name-field');
  const hint = h('div', { class: 'cv-hint tt-hint', role: 'status' });
  const dlBtn = button({ label: t.step3.download, icon: 'download', variant: 'primary', size: 'lg', class: 'tt-dl-btn', onClick: () => void download() });
  const openBtn = button({ label: t.step3.open, icon: 'pencil', variant: 'secondary', size: 'lg', class: 'tt-open-btn', onClick: () => void openInEditor() });
  const installBox = h('div', { class: 'cv-install tt-install', hidden: true });
  const step3 = stepCard(
    3,
    t.step3.title,
    t.step3.text,
    'package',
    h('div', { class: 'cv-step-body' }, editionGroup, pickerWrap, nameField, hint, h('div', { class: 'cv-actions tt-dl-actions' }, dlBtn, openBtn), installBox),
  );

  function chooseEdition(e: Edition) {
    if (e === edition) return;
    edition = e;
    targetChanged();
  }

  function targetChanged() {
    paintEditions();
    void ensureShape();
    regenerate();
    clearInstall();
  }

  function paintEditions() {
    for (const b of editionCards) {
      const on = b.dataset.value === edition;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    pickerWrap.hidden = edition !== 'java';
  }

  const texturePath = () => totemTexturePath(edition, javaVersion, shapes.get(shapeKey())?.files ?? null);

  function paintExport() {
    const img = current();
    const noTotem = edition === 'java' && !javaHasTotem(javaVersion);
    hint.classList.toggle('is-alert', noTotem);
    if (noTotem) {
      hint.replaceChildren(icon('warning-diamond', { size: 20 }), h('span', null, h('strong', null, fmt(t.step3.noTotemTitle, { version: javaVersion })), fmt(t.step3.noTotem, { first: FIRST_TOTEM_VERSION })));
    } else if (!img) {
      hint.replaceChildren(t.step3.chooseSkin);
    } else {
      hint.replaceChildren(
        h('span', null, fmtNodes(edition === 'java' ? t.step3.javaResult : t.step3.bedrockResult, { version: javaVersion, path: h('code', { class: 'tt-path' }, texturePath()) })),
      );
    }
    const ok = !!img && !noTotem;
    dlBtn.disabled = !ok;
    openBtn.disabled = !ok;
    const label = dlBtn.querySelector('.btn-label');
    if (label) label.textContent = edition === 'java' ? t.step3.downloadZip : t.step3.downloadMcpack;
  }

  function clearInstall() {
    installBox.hidden = true;
    installBox.replaceChildren();
  }

  async function download() {
    const img = current();
    if (!img || dlBtn.disabled) return;
    setButtonBusy(dlBtn, true);
    try {
      const { buildTotemPack } = await packBuilder();
      const r = await buildTotemPack(img, {
        name: packName,
        description: totemDescription(skin?.name),
        edition,
        version: javaVersion,
        path: texturePath(),
        uuids: bedrock.uuids,
        packVersion: bedrock.packVersion,
      });
      if (!alive) return;
      if (edition === 'bedrock') {
        bedrock.uuids = r.uuids;
        bedrock.packVersion = r.packVersion;
      }
      saveBlob(r.blob, r.filename);
      installBox.hidden = false;
      installBox.replaceChildren(
        h('div', { class: 'cv-file' }, icon('check', { size: 20 }), h('strong', null, r.filename), h('span', { class: 'faint small' }, `${formatBytes(r.blob.size)} · ${fmt(t.step3.files, { count: r.files.length })}${r.packVersion ? ` · v${r.packVersion.join('.')}` : ''}`)),
        h(
          'p',
          { class: 'small muted' },
          edition === 'bedrock'
            ? t.step3.installBedrock
            : t.step3.installJava,
          h('a', { href: routeHref(`/help?s=${edition === 'bedrock' ? 'bedrock-packs' : 'java-packs'}`) }, t.step3.installHelp),
        ),
      );
      announce(fmt(t.step3.downloaded, { file: r.filename }));
    } catch (err) {
      console.error(err);
      toast(friendlyError(err, t.step3.buildFailed), { tone: 'error' });
    } finally {
      if (dlBtn.isConnected) setButtonBusy(dlBtn, false);
      paintExport();
    }
  }

  async function openInEditor() {
    const img = current();
    if (!img || openBtn.disabled) return;
    setButtonBusy(openBtn, true);
    try {
      const { totemProject } = await packBuilder();
      const project = totemProject(img, {
        name: packName,
        description: totemDescription(skin?.name),
        edition,
        version: edition === 'java' ? javaVersion : BEDROCK_LATEST_ID,
        path: texturePath(),
      });
      if (edition === 'bedrock' && bedrock.uuids) project.bedrockUuids = { ...bedrock.uuids };
      await saveProject(project);
      if (!alive) return;
      navigate(`/textures/${encodeURIComponent(project.id)}`);
    } catch (err) {
      console.error(err);
      toast(friendlyError(err, t.step3.saveFailed), { tone: 'error' });
      if (openBtn.isConnected) setButtonBusy(openBtn, false);
    }
  }

  // ---------------------------------------------------------------- page
  const demoSkin = createStarterSkin('explorer', 'classic');
  const demoTotem = makeTotem(demoSkin, DEFAULT_OPTIONS);
  const art = h(
    'div',
    { class: 'cv-hero-art tt-hero-art', 'aria-hidden': 'true' },
    h('figure', null, figureCanvas(demoSkin, 'classic', 'tt-hero-figure'), h('figcaption', null, icon('human', { size: 16 }), t.hero.yourSkin)),
    h('span', { class: 'cv-hero-arrows' }, icon('arrow-right', { size: 32 })),
    h('figure', null, pixelCanvas(demoTotem, 'tt-hero-totem'), h('figcaption', null, icon('totem', { size: 16 }), t.hero.yourTotem)),
  );
  const grid = h('div', { class: 'container tt-grid' }, step1, step2, previewCard, step3);
  grid.querySelectorAll('.cv-step').forEach((el, i) => el.classList.add(`tt-area-${i + 1}`));
  const page = h(
    'div',
    { class: 'cv-page tt-page accent-gold' },
    h(
      'header',
      { class: 'container cv-hero' },
      h(
        'div',
        { class: 'cv-hero-text' },
        h('span', { class: 'eyebrow' }, icon('totem'), t.hero.eyebrow),
        h('h1', { class: 'pixel-shadow' }, t.hero.title),
        h('p', { class: 'lead' }, t.hero.lead),
      ),
      art,
    ),
    grid,
    siteFooter(),
  );
  root.appendChild(page);
  showSource('username');
  paintEditions();
  paintChosen();
  regenerate();
  paintShape();

  // Links from other tools: ?skin=<saved skin id> (the skin editor's "Make a totem") or ?user=<name>
  const linkedSkin = ctx.query.get('skin');
  const linkedUser = ctx.query.get('user');
  if (linkedSkin) {
    void getProject<SkinProjectData>(linkedSkin)
      .then(async (p) => {
        if (!alive || !p || p.kind !== 'skin') return;
        const d = await decodeImage(p.image, 'png');
        if (alive) setSkin({ image: d, model: p.model, name: p.name || t.step1.myName, source: 'saved', notes: [] });
      })
      .catch(() => toast(t.step1.openFailed, { tone: 'error' }));
  } else if (linkedUser && !validateUsername(linkedUser)) {
    userInput.value = linkedUser;
    void lookup(false);
  }

  return () => {
    alive = false;
    ctrl.abort();
    pop.destroy();
  };
}

function stepCard(n: number, title: string, text: string, ic: IconName, body: HTMLElement): HTMLElement {
  const id = uid('tt-step');
  return h(
    'section',
    { class: 'card cv-step tt-step', 'aria-labelledby': id, dataset: { step: String(n) } },
    h('div', { class: 'cv-step-head' }, h('span', { class: 'cv-step-n', 'aria-hidden': 'true' }, String(n)), h('div', null, h('h2', { id }, title), h('p', { class: 'muted' }, text)), h('span', { class: 'cv-step-icon', 'aria-hidden': 'true' }, icon(ic))),
    body,
  );
}
