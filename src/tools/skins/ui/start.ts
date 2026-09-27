// Skins start screen: new skin cards (blank, template, starter characters), upload, username
// import, default skins from the game files, and the recent skin projects.

import { navigate, href as routeHref } from '../../../core/router';
import { decodeImage, encodePng } from '../../../core/image';
import { deleteProject, listProjects, saveProject } from '../../../core/storage';
import type { AssetIndex, Progress, SkinModel } from '../../../core/types';
import { uuidv4 } from '../../../core/uuid';
import { DEFAULT_JAVA_VERSION, loadAssets } from '../../../editions/index';
import { badge, button, openMenu, segmented, setButtonBusy } from '../../../ui/components';
import { h, timeAgo } from '../../../ui/dom';
import { dropzone } from '../../../ui/dropzone';
import { icon } from '../../../ui/icons';
import { confirmDialog, openModal, promptDialog } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import type { PopoverHandle } from '../../../ui/popover';
import { assetLoadingPanel } from '../../../ui/version-picker';
import type { SkinProjectData } from '../export';
import { createStarterSkin, STARTERS } from '../starters';
import { drawFigure } from './figure';
import { fetchSkinByUsername, listDefaultSkins, readDefaultSkin, readSkinFile, SkinSourceError, validateUsername, type DefaultSkin } from './sources';

const MODEL_KEY = 'to-skins-new-model';

function loadModelPref(): SkinModel {
  try {
    return localStorage.getItem(MODEL_KEY) === 'slim' ? 'slim' : 'classic';
  } catch {
    return 'classic';
  }
}

function saveModelPref(m: SkinModel): void {
  try {
    localStorage.setItem(MODEL_KEY, m);
  } catch {
    /* private mode */
  }
}

let creating = false;

/** Creates a skin project, saves it and opens the editor. Ignores a second request while one is saving. */
export async function createSkinProject(opts: { image: ImageData; model: SkinModel; name: string; source: string }): Promise<void> {
  if (creating) return;
  creating = true;
  try {
    await saveNewProject(opts);
  } finally {
    creating = false;
  }
}

async function saveNewProject(opts: { image: ImageData; model: SkinModel; name: string; source: string }): Promise<void> {
  const now = Date.now();
  const project: SkinProjectData = {
    id: uuidv4(),
    kind: 'skin',
    name: opts.name.trim().slice(0, 60) || 'My skin',
    model: opts.model,
    image: new Blob([encodePng(opts.image)], { type: 'image/png' }),
    createdAt: now,
    updatedAt: now,
    source: opts.source,
  };
  await saveProject(project);
  navigate(`/skins/${project.id}`);
}

function figureCanvas(img: ImageData, model: SkinModel, cls = 'sk-figure'): HTMLCanvasElement {
  const c = h('canvas', { class: cls, 'aria-hidden': 'true' });
  // Draw once it has a layout size.
  requestAnimationFrame(() => drawFigure(c, img, model));
  return c;
}

/** Shared game-files load; `signal` is the modal that started it (a closed modal aborts it). */
let assetsLoad: { promise: Promise<AssetIndex>; signal: AbortSignal | null } | null = null;

/** Modal that loads the Java game files and lets the user pick a default skin. */
function openDefaultSkinsModal(preferred: SkinModel): void {
  const ctrl = new AbortController();
  const body = h('div', { class: 'sk-defaults' });
  const modal = openModal({
    title: 'Default skins from Minecraft',
    body,
    width: 720,
    onClose: () => ctrl.abort(),
  });
  const useJar = (file: File) => {
    assetsLoad = { promise: loadAssets('java', DEFAULT_JAVA_VERSION, { jarFile: file, onProgress: (p) => panel.set(p) }), signal: null };
    start();
  };
  const panel = assetLoadingPanel({ edition: 'java', version: DEFAULT_JAVA_VERSION, onPickJar: useJar });
  const intro = h('p', { class: 'muted' }, `Start from one of the nine default characters in Minecraft Java ${DEFAULT_JAVA_VERSION}. They come straight from the official game files.`);

  const showGrid = (assets: AssetIndex) => {
    const skins = listDefaultSkins(assets);
    if (!skins.length) {
      panel.error("These game files don't contain the default skins.");
      return;
    }
    let model: SkinModel = skins.some((s) => s.model === preferred) ? preferred : skins[0].model;
    const grid = h('div', { class: 'sk-defaults-grid', role: 'list' });
    const hasBoth = new Set(skins.map((s) => s.model)).size > 1;
    const render = () => {
      grid.replaceChildren(
        ...skins
          .filter((s) => !hasBoth || s.model === model)
          .map((s) => {
            const b = h(
              'button',
              { type: 'button', class: 'sk-default', role: 'listitem', 'aria-label': `${s.name} (${s.model === 'slim' ? 'slim' : 'classic'} arms)` },
              h('span', { class: 'sk-default-thumb' }),
              h('span', { class: 'sk-default-name' }, s.name),
            );
            void readDefaultSkin(assets, s)
              .then((loaded) => b.querySelector('.sk-default-thumb')!.appendChild(figureCanvas(loaded.image, s.model, 'sk-figure sk-figure-sm')))
              .catch(() => undefined);
            b.addEventListener('click', () => void pick(s, b));
            return b;
          }),
      );
    };
    const pick = async (s: DefaultSkin, b: HTMLButtonElement) => {
      setButtonBusy(b, true);
      try {
        const loaded = await readDefaultSkin(assets, s);
        modal.close();
        await createSkinProject({ image: loaded.image, model: s.model, name: s.name, source: 'game' });
      } catch (err) {
        setButtonBusy(b, false);
        toast(err instanceof Error ? err.message : 'Could not open that skin.', { tone: 'error' });
      }
    };
    const head = h(
      'div',
      { class: 'sk-defaults-head' },
      intro,
      hasBoth
        ? segmented<SkinModel>({
            value: model,
            label: 'Arm style',
            size: 'sm',
            options: [
              { value: 'classic', label: 'Classic arms' },
              { value: 'slim', label: 'Slim arms' },
            ],
            onChange: (v) => {
              model = v;
              render();
            },
          })
        : null,
    );
    render();
    body.replaceChildren(head, grid);
  };

  const start = () => {
    body.replaceChildren(intro, panel);
    panel.set({ label: 'Checking game files…', fraction: null });
    if (!assetsLoad || assetsLoad.signal?.aborted) {
      assetsLoad = { promise: loadAssets('java', DEFAULT_JAVA_VERSION, { onProgress: (p: Progress) => panel.set(p), signal: ctrl.signal }), signal: ctrl.signal };
    }
    const load = assetsLoad;
    load.promise
      .then((assets) => {
        if (ctrl.signal.aborted) return;
        panel.set(null);
        showGrid(assets);
      })
      .catch((err: unknown) => {
        if (assetsLoad === load) assetsLoad = null;
        if (ctrl.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Could not download the game files.';
        panel.error(msg, start, useJar);
      });
  };
  start();
}

function sectionHead(title: string, text?: string, extra?: Node | null): HTMLElement {
  return h('div', { class: 'sk-section-head' }, h('div', { class: 'stack', style: { '--gap': '4px' } }, h('h2', null, title), text ? h('p', { class: 'muted' }, text) : null), extra ?? null);
}

async function renderRecent(list: HTMLElement, section: HTMLElement, urls: string[]): Promise<void> {
  const projects = (await listProjects('skin')) as SkinProjectData[];
  section.hidden = projects.length === 0;
  list.replaceChildren(
    ...projects.map((p) => {
      const thumb = h('span', { class: 'sk-recent-thumb' });
      void decodeImage(p.image, 'png')
        .then((img) => {
          if (img.width === 64 && img.height === 64) thumb.appendChild(figureCanvas(img, p.model, 'sk-figure sk-figure-sm'));
        })
        .catch(() => thumb.appendChild(icon('human')));
      const menuBtn = h('button', { type: 'button', class: 'icon-btn sm sk-recent-menu', 'aria-label': `More actions for ${p.name}`, 'aria-haspopup': 'menu' }, icon('more-vertical'));
      let menu: PopoverHandle | null = null;
      menuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (menu?.open) {
          menu.close();
          return;
        }
        menu = openMenu(menuBtn, [
          { label: 'Open', icon: 'pencil', onClick: () => navigate(`/skins/${p.id}`) },
          {
            label: 'Rename',
            icon: 'text-cursor',
            onClick: async () => {
              const name = await promptDialog('Rename skin', 'Name', p.name, { maxLength: 60, confirmLabel: 'Rename' });
              if (name === null || !name.trim()) return;
              p.name = name.trim();
              await saveProject(p);
              void renderRecent(list, section, urls);
            },
          },
          {
            label: 'Duplicate',
            icon: 'copy',
            onClick: async () => {
              const now = Date.now();
              const copy: SkinProjectData = { ...p, id: uuidv4(), name: `${p.name} copy`, createdAt: now, updatedAt: now, bedrockUuids: undefined, packVersion: undefined };
              await saveProject(copy);
              toast(`Made a copy of "${p.name}"`, { tone: 'success' });
              void renderRecent(list, section, urls);
            },
          },
          {
            label: 'Delete',
            icon: 'trash',
            danger: true,
            onClick: async () => {
              const ok = await confirmDialog('Delete this skin?', `"${p.name}" will be removed from this browser. Export it first if you want to keep a copy.`, 'Delete', true);
              if (!ok) return;
              await deleteProject(p.id);
              toast('Skin deleted', { tone: 'success' });
              void renderRecent(list, section, urls);
            },
          },
        ]);
      });
      return h(
        'div',
        { class: 'sk-recent' },
        h(
          'a',
          { class: 'sk-recent-link', href: routeHref(`/skins/${encodeURIComponent(p.id)}`) },
          thumb,
          h(
            'span',
            { class: 'sk-recent-info' },
            h('span', { class: 'sk-recent-name truncate' }, p.name || 'Untitled'),
            h('span', { class: 'sk-recent-meta truncate' }, `${p.model === 'slim' ? 'Slim' : 'Classic'} · ${timeAgo(p.updatedAt || p.createdAt)}`),
          ),
        ),
        menuBtn,
      );
    }),
  );
}

export function mountStart(root: HTMLElement): () => void {
  let model = loadModelPref();
  const urls: string[] = [];
  const ctrl = new AbortController();

  // ---- New skin cards ----
  const starterGrid = h('div', { class: 'sk-starters' });
  const renderStarters = () => {
    starterGrid.replaceChildren(
      ...STARTERS.map((s) => {
        const img = createStarterSkin(s.id, model);
        const card = h(
          'button',
          { type: 'button', class: ['sk-starter', `sk-starter-${s.id}`], dataset: { starter: s.id } },
          h('span', { class: 'sk-starter-stage' }, figureCanvas(img, model)),
          h(
            'span',
            { class: 'sk-starter-text' },
            h('span', { class: 'sk-starter-name' }, h('span', null, s.name), s.badge ? badge(s.badge, 'green') : null),
            h('span', { class: 'sk-starter-desc' }, s.description),
          ),
        );
        card.addEventListener('click', async () => {
          if (card.classList.contains('busy')) return;
          card.classList.add('busy');
          try {
            await createSkinProject({ image: createStarterSkin(s.id, model), model, name: s.id === 'blank' || s.id === 'template' ? 'My skin' : s.name, source: s.id });
          } catch (err) {
            card.classList.remove('busy');
            toast(err instanceof Error ? err.message : 'Could not create the skin.', { tone: 'error' });
          }
        });
        return card;
      }),
    );
  };
  renderStarters();

  const modelPick = h(
    'div',
    { class: 'sk-model-pick' },
    h('span', { class: 'sk-model-label' }, 'Arm style'),
    segmented<SkinModel>({
      value: model,
      label: 'Arm style for new skins',
      options: [
        { value: 'classic', label: 'Classic · 4px' },
        { value: 'slim', label: 'Slim · 3px' },
      ],
      onChange: (v) => {
        model = v;
        saveModelPref(v);
        renderStarters();
      },
    }),
  );

  // ---- Bring a skin ----
  const upload = dropzone({
    accept: '.png,image/png',
    label: 'Drop a skin PNG here or click to browse',
    hint: '64×64 skins, or old 64×32 ones (converted for you).',
    icon: 'upload',
    onFiles: async ([file]) => {
      upload.setError(null);
      upload.classList.add('busy');
      try {
        const loaded = await readSkinFile(file);
        const name = file.name.replace(/\.png$/i, '').replace(/[_-]+/g, ' ').trim() || 'Uploaded skin';
        for (const n of loaded.notes) toast(n, { tone: 'info', duration: 7000 });
        await createSkinProject({ image: loaded.image, model: loaded.model, name, source: 'upload' });
      } catch (err) {
        upload.setError(err instanceof SkinSourceError ? err.message : 'That file could not be opened as a skin.');
      } finally {
        upload.classList.remove('busy');
      }
    },
  });

  const userInput = h('input', {
    class: 'input',
    type: 'text',
    placeholder: 'e.g. Notch',
    autocomplete: 'off',
    spellcheck: false,
    maxLength: 36,
    'aria-label': 'Minecraft Java username',
    id: 'sk-username',
  });
  const userError = h('p', { class: 'sk-field-error', role: 'alert', hidden: true });
  const userBtn = button({ label: 'Import', icon: 'download', variant: 'primary' });
  const doImport = async () => {
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
      for (const n of loaded.notes) toast(n, { tone: 'info', duration: 7000 });
      await createSkinProject({ image: loaded.image, model: loaded.model, name: `${loaded.username}'s skin`, source: 'username' });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      userError.hidden = false;
      userError.textContent = err instanceof SkinSourceError ? err.message : "Couldn't load that skin. Check your connection and try again.";
    } finally {
      if (userBtn.isConnected) setButtonBusy(userBtn, false);
    }
  };
  userBtn.addEventListener('click', () => void doImport());
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void doImport();
  });
  userInput.addEventListener('input', () => {
    userError.hidden = true;
  });

  const importCard = (iconName: Parameters<typeof icon>[0], title: string, text: string, ...content: Node[]) =>
    h(
      'section',
      { class: 'sk-import' },
      h('div', { class: 'sk-import-head' }, h('span', { class: 'sk-import-icon' }, icon(iconName)), h('div', null, h('h3', null, title), h('p', { class: 'muted' }, text))),
      ...content,
    );

  const gameBtn = button({ label: 'Choose a default skin', icon: 'users', variant: 'secondary', onClick: () => openDefaultSkinsModal(model) });
  const examples = h(
    'div',
    { class: 'sk-examples' },
    h('span', { class: 'faint small' }, 'Try'),
    ['jeb_', 'Dinnerbone', 'Notch'].map((n) => {
      const b = h('button', { type: 'button', class: 'sk-chip sk-example' }, n);
      b.addEventListener('click', () => {
        userInput.value = n;
        userError.hidden = true;
        userInput.focus();
      });
      return b;
    }),
  );
  const note = (iconName: Parameters<typeof icon>[0], text: string) => h('p', { class: 'sk-import-note' }, icon(iconName), h('span', null, text));

  const imports = h(
    'div',
    { class: 'sk-imports' },
    importCard('upload', 'Upload a PNG', 'Keep editing a skin you already have.', upload),
    importCard(
      'user',
      'Import by username',
      "Grab any Java player's current skin.",
      h('div', { class: 'sk-user-row' }, h('div', { class: 'input-with-icon grow' }, icon('user'), userInput), userBtn),
      userError,
      examples,
      note('info', 'Java Edition names only. Bedrock gamertags can’t be looked up.'),
    ),
    importCard(
      'gamepad',
      'Steve, Alex & friends',
      `The nine default skins from the Minecraft ${DEFAULT_JAVA_VERSION} game files, in classic or slim.`,
      note('lock', 'Downloaded once from Mojang’s servers (about 6 MB), then kept on this device.'),
      h('div', { class: 'sk-game-actions' }, gameBtn),
    ),
  );

  // ---- Recent ----
  const recentList = h('div', { class: 'sk-recent-grid' });
  const recentSection = h('section', { class: 'sk-section', hidden: true, 'aria-labelledby': 'sk-recent-title' });
  recentSection.append(
    h('div', { class: 'sk-section-head' }, h('div', { class: 'stack', style: { '--gap': '4px' } }, h('h2', { id: 'sk-recent-title' }, 'Your skins'), h('p', { class: 'muted' }, 'Saved in this browser. Export them to keep a copy.'))),
    recentList,
  );
  void renderRecent(recentList, recentSection, urls);

  const page = h(
    'div',
    { class: 'sk-start container' },
    h(
      'header',
      { class: 'sk-hero' },
      h(
        'div',
        { class: 'sk-hero-text' },
        h('span', { class: 'eyebrow' }, icon('human'), 'Skin Maker'),
        h('h1', { class: 'pixel-shadow' }, 'Design your own skin'),
        h('p', { class: 'lead' }, 'Paint on the skin template or right onto the 3D model, and watch your character come to life. Export for Java or Bedrock when you are done.'),
      ),
      modelPick,
    ),
    recentSection,
    h('section', { class: 'sk-section', 'aria-label': 'Start a new skin' }, sectionHead('Start a new skin', 'Pick a starting point. You can change everything.'), starterGrid),
    h('section', { class: 'sk-section', 'aria-label': 'Bring a skin' }, sectionHead('Bring a skin', 'Open an existing skin and make it yours.'), imports),
  );
  root.append(page);

  return () => {
    ctrl.abort();
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
}
