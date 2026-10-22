// GUI mode of the texture pack editor, loaded the first time it's opened: the GUI library on the
// left, the pixel editor (or the splash text editor) in the centre and the live GUI preview in the
// Preview tab. Pieces open in the editor's own pixel editor; this module tells the editor which.

import './gui.css';
import type { TexStore } from '../ui/store';
import { guiCatalog, partOfPath, type GuiCatalog, type GuiPiece } from './catalog';
import { GuiSources } from './sources';
import { createGuiLibrary } from './library';
import { createGuiPreview, type GuiPreview } from './preview';
import { createSplashEditor } from './splash-editor';

export interface GuiMode {
  cat: GuiCatalog;
  /** Left column content */
  libraryEl: HTMLElement;
  /** Centre column content while the splash texts are open */
  splashEl: HTMLElement;
  /** Preview tab content */
  previewEl: HTMLElement;
  preview: GuiPreview;
  activate(): void;
  deactivate(): void;
  /** The Preview tab is on screen */
  setPreviewVisible(v: boolean): void;
  /** A texture was opened in the pixel editor (null: none) */
  textureOpened(path: string | null): void;
  /** Opens the splash text editor in the centre */
  showSplashes(): void;
  /** The splash text editor is in the centre */
  splashesShown(): boolean;
  /** Back to the pixel editor in the centre */
  hideSplashes(): void;
  focusSearch(): void;
  destroy(): void;
}

export interface GuiModeOptions {
  store: TexStore;
  /** The Blocks / Items / Mobs / All / GUI / Sounds switch */
  top: HTMLElement;
  /** Open a piece in the pixel editor (its atlas area selected) */
  openPiece(piece: GuiPiece, how: 'pointer' | 'keyboard' | 'preview'): void;
  /** Open any texture (an item clicked in the preview) */
  openTexture(path: string): void;
  /** The centre switched between the pixel editor and the splash texts */
  onCentre(splashes: boolean, how: 'pointer' | 'keyboard'): void;
  /** Phones and tablets: show the list */
  onBrowse(): void;
}

export function createGuiMode(opts: GuiModeOptions): GuiMode {
  const { store } = opts;
  const has = (p: string) => !!store.project.overrides[p] || store.assets.hasFile(p);
  const cat = guiCatalog(store.project.edition, store.project.version, has);
  const sources = new GuiSources(store, cat);
  let splashes = false;
  /** The piece picked in the library (an atlas has many: the preview shows that one) */
  let picked: GuiPiece | null = null;

  const library = createGuiLibrary({
    sources,
    cat,
    top: opts.top,
    onOpen: (piece, how) => {
      picked = piece;
      library.setSelected(piece.id);
      opts.openPiece(piece, how);
    },
    onSplashes: () => mode.showSplashes(),
  });
  const preview = createGuiPreview({
    sources,
    cat,
    open: (path, piece) => {
      if (piece) {
        picked = piece;
        library.setSelected(piece.id, true);
        opts.openPiece(piece, 'preview');
      } else opts.openTexture(path);
    },
  });
  const splash = createSplashEditor({
    store,
    preview: (text) => preview.showSplash(text),
    onCount: (n) => library.setSplashCount(n),
    onBrowse: opts.onBrowse,
  });
  library.setSplashCount(null);
  // a splash for the title screen from the start
  void splash.current().then((list) => {
    if (list?.length) preview.showSplash(list[Math.floor(Math.random() * list.length)], false);
  });

  const mode: GuiMode = {
    cat,
    libraryEl: library.el,
    splashEl: splash.el,
    previewEl: preview.el,
    preview,
    activate() {
      library.el.hidden = false;
      library.activate();
    },
    deactivate() {
      library.el.hidden = true;
    },
    setPreviewVisible: (v) => preview.setVisible(v),
    textureOpened(path) {
      const part = path ? partOfPath(cat, path) : null;
      const piece = part && picked && picked.path === path ? picked : (cat.piecesOf(path ?? '')[0] ?? null);
      if (!splashes) library.setSelected(piece?.id ?? null, true);
      preview.follow(path, piece);
    },
    showSplashes() {
      splashes = true;
      library.setSplashSelected(true);
      splash.show();
      preview.setScreen('title');
      opts.onCentre(true, 'pointer');
    },
    splashesShown: () => splashes,
    hideSplashes() {
      if (!splashes) return;
      splashes = false;
      library.setSplashSelected(false);
      opts.onCentre(false, 'pointer');
    },
    focusSearch: () => library.focusSearch(),
    destroy() {
      library.destroy();
      preview.destroy();
      splash.destroy();
      sources.destroy();
    },
  };
  return mode;
}
