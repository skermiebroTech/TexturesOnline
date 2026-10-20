// Sounds mode of the texture pack editor, loaded the first time it's opened: the sound list on the
// left, the selected sound in the centre. The Ogg Vorbis encoder loads later still, on the first save.

import './sounds.css';
import type { TexStore } from './store';
import { SoundState } from './sound-store';
import { createSoundBrowser } from './sound-browser';
import { createSoundPanel } from './sound-panel';
import type { SoundEvent } from '../sounds/catalog';

export interface SoundsMode {
  state: SoundState;
  /** Left column content */
  browserEl: HTMLElement;
  /** Centre column content */
  panelEl: HTMLElement;
  activate(): void;
  deactivate(): void;
  focusSearch(): void;
  /** Selects an event by id (tests, links) */
  select(id: string): boolean;
  destroy(): void;
}

export function createSoundsMode(opts: {
  store: TexStore;
  /** The Blocks / Items / Mobs / All / Sounds switch */
  top: HTMLElement;
  /** An event was picked: phones switch to the editor unless it was a keyboard move */
  onSelect(how: 'pointer' | 'keyboard' | 'enter'): void;
  /** Phones and tablets: show the list */
  onBrowse(): void;
}): SoundsMode {
  const state = new SoundState(opts.store);
  const pick = (e: SoundEvent, how: 'pointer' | 'keyboard' | 'enter') => {
    panel.show(e);
    browser.setSelected(e.id, how !== 'pointer');
    opts.onSelect(how);
  };
  const browser = createSoundBrowser({ sounds: state, top: opts.top, onSelect: pick });
  const panel = createSoundPanel({ sounds: state, onPick: (e) => pick(e, 'enter'), onBrowse: opts.onBrowse });
  return {
    state,
    browserEl: browser.el,
    panelEl: panel.el,
    activate() {
      browser.el.hidden = false;
      panel.el.hidden = false;
      browser.activate();
    },
    deactivate() {
      state.player.stop();
      browser.el.hidden = true;
      panel.el.hidden = true;
    },
    focusSearch: () => browser.focusSearch(),
    select(id) {
      const e = state.catalog?.byId.get(id);
      if (e) pick(e, 'enter');
      return !!e;
    },
    destroy() {
      browser.destroy();
      panel.destroy();
      state.dispose();
    },
  };
}
