// Right panel "PvP" tab of the texture pack editor (loaded when the tab first opens, or when a new PvP
// pack applies its preset): a switch per PvP / FPS tweak with its choices, the files it changes and
// the versions it works in; tweaks the pack's version can't have are shown switched off with the
// reason. Changes go through ./apply.ts and can be undone from the toast.

import { h } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { button, segmented, setButtonBusy, spinner, toggle, tooltip } from '../../../ui/components';
import { toast } from '../../../ui/toast';
import { href as routeHref } from '../../../core/router';
import { friendlyError } from '../../../core/net';
import { fmt } from '../../../i18n/editor-text';
import { paintCanvas } from '../ui/thumbs';
import { versionLabel } from '../ui/start-screen';
import type { TexStore } from '../ui/store';
import { createPvpEngine, type PvpEngine, type TweakChange } from './apply';
import {
  CROSSHAIRS,
  FIRE_HEIGHTS,
  GLASS_MODES,
  LOW_RES_SCOPES,
  PRESET_TWEAKS,
  PVP_GROUPS,
  SHIELD_HEIGHTS,
  SWORD_SIZES,
  WEAPON_SCOPES,
  canKeepFireBlocks,
  crosshairImage,
  crosshairTarget,
  fireOverlayPath,
  glassTextures,
  pumpkinPath,
  tweakSupport,
  worldFirePath,
  type CrosshairTarget,
  type PvpTweakId,
} from './tweaks';
import { tv } from './i18n/text';
import './pvp.css';

export interface PvpPanel {
  el: HTMLElement;
  engine: PvpEngine;
  setVisible(v: boolean): void;
  /** Switches on the PvP preset (a new PvP pack); resolves when done */
  applyPreset(fps: boolean): Promise<void>;
  destroy(): void;
}

export interface PvpPanelOptions {
  store: TexStore;
  /** Textures a tweak changed or put back (the open one is shown again) */
  onTextures(paths: string[]): void;
  /** "Draw your own" crosshair: open the texture in the pixel editor (the sheet's crosshair square selected) */
  drawCrosshair(target: CrosshairTarget): void;
}

const ICONS: Record<PvpTweakId, IconName> = {
  lowFire: 'fire',
  clearGlass: 'square',
  noPumpkin: 'eye',
  crosshair: 'target',
  swords: 'sword',
  shield: 'shapes',
  lowRes: 'grid-2x2-2',
  still: 'pause',
};

/** Pack paths shown without the namespace folder. */
const short = (p: string) => p.replace(/^assets\/minecraft\/(textures\/)?/, '');

export function createPvpPanel(opts: PvpPanelOptions): PvpPanel {
  const { store } = opts;
  const project = store.project;
  const engine = createPvpEngine(store);
  const offs: (() => void)[] = [];
  let visible = false;
  let busy = false;

  const has = (path: string) => !!project.overrides[path] || store.assets.hasFile(path);

  /** Files a tweak writes, for the "Changes" line (models and effects are described in words). */
  function changes(id: PvpTweakId): string[] {
    const { edition, version } = project;
    switch (id) {
      case 'lowFire': {
        const out = [fireOverlayPath(version)];
        if (engine.options('lowFire').keepBlocks && canKeepFireBlocks(edition, version)) out.push(worldFirePath(version), 'assets/minecraft/models/block/fire_*.json');
        return out;
      }
      case 'clearGlass':
        return glassTextures(edition, version)
          .map((g) => g.path)
          .filter(has);
      case 'noPumpkin':
        return [pumpkinPath(edition)];
      case 'crosshair':
        return [crosshairTarget(edition, version).path];
      case 'swords':
        return engine.options('swords').scope === 'swords' ? ['assets/minecraft/models/item/*_sword.json'] : ['assets/minecraft/models/item/*_sword.json', '*_axe.json', 'mace.json', '*_spear_in_hand.json'];
      case 'shield':
        return ['assets/minecraft/models/item/shield.json', 'shield_blocking.json'];
      case 'lowRes':
        return [engine.options('lowRes').scope === 'all' ? 'textures/block/*, textures/item/*' : 'textures/block/*'];
      case 'still':
        return ['textures/block/* (.png.mcmeta)'];
    }
  }

  function supportText(id: PvpTweakId): string {
    switch (id) {
      case 'lowFire':
      case 'still':
        return tv.support.java;
      case 'swords':
        return tv.support.models;
      case 'shield':
        return tv.support.shield;
      default:
        return tv.support.javaBedrock;
    }
  }

  // ---------------------------------------------------------------- changing
  function report(name: string, verb: 'on' | 'off' | 'updated', change: TweakChange, undo: () => void) {
    const kept = change.kept ? ` · ${fmt(tv.toasts.kept, { count: change.kept })}` : '';
    toast(`${fmt(tv.toasts[verb], { name })}${kept}`, {
      tone: 'success',
      action: {
        label: tv.toasts.undo,
        onClick: () => {
          undo();
          opts.onTextures(change.textures);
          render();
          toast(tv.toasts.undone, { duration: 1800 });
        },
      },
    });
  }

  async function change(id: PvpTweakId, on: boolean, patch?: Record<string, string | boolean>) {
    if (busy) return;
    busy = true;
    const card = list.querySelector<HTMLElement>(`[data-tweak="${id}"]`);
    card?.classList.add('is-busy');
    card?.setAttribute('aria-busy', 'true');
    const name = tv.tweaks[id].title;
    const was = engine.isOn(id);
    try {
      const res = await engine.set(id, on, patch as never);
      opts.onTextures(res.change.textures);
      report(name, !on ? 'off' : was ? 'updated' : 'on', res.change, res.undo);
    } catch (err) {
      console.error(err);
      toast(fmt(tv.toasts.failed, { name, error: friendlyError(err) }), { tone: 'error' });
    } finally {
      busy = false;
      render();
    }
  }

  // ---------------------------------------------------------------- cards
  const choice = <T extends string>(id: PvpTweakId, key: string, label: string, values: readonly T[], names: Record<T, string>, value: T) =>
    h(
      'div',
      { class: 'pvp-opt' },
      h('span', { class: 'field-label' }, label),
      segmented<T>({ value, size: 'sm', label, options: values.map((v) => ({ value: v, label: names[v] })), onChange: (v) => void change(id, true, { [key]: v }) }),
    );

  function optionsOf(id: PvpTweakId): HTMLElement[] {
    const o = tv.options;
    switch (id) {
      case 'lowFire': {
        const cur = engine.options('lowFire');
        const out: HTMLElement[] = [choice(id, 'height', o.height, FIRE_HEIGHTS, { low: o.low, lower: o.lower, lowest: o.lowest }, cur.height)];
        if (canKeepFireBlocks(project.edition, project.version)) {
          const t = toggle({ label: o.keepBlocks, description: o.keepBlocksHint, value: cur.keepBlocks, onChange: (v) => void change(id, true, { keepBlocks: v }) });
          t.classList.add('pvp-keep');
          out.push(t);
        }
        return out;
      }
      case 'clearGlass':
        return [choice(id, 'mode', o.glass, GLASS_MODES, { clear: o.clear, tint: o.tint }, engine.options('clearGlass').mode)];
      case 'crosshair': {
        const cur = engine.options('crosshair').design;
        const grid = h('div', { class: 'pvp-designs', role: 'radiogroup', 'aria-label': o.design });
        for (const d of CROSSHAIRS) {
          const c = h('canvas', { class: 'pixelated' });
          paintCanvas(c, crosshairImage(d, 2));
          const b = h('button', { type: 'button', class: 'pvp-design', role: 'radio', 'aria-checked': String(d === cur), 'aria-label': o.designs[d], dataset: { design: d } }, c);
          tooltip(b, o.designs[d]);
          b.addEventListener('click', () => d !== cur && void change(id, true, { design: d }));
          grid.appendChild(b);
        }
        const draw = button({ label: o.drawOwn, icon: 'pencil', size: 'sm', variant: 'secondary', onClick: () => opts.drawCrosshair(crosshairTarget(project.edition, project.version)) });
        return [h('div', { class: 'pvp-opt' }, h('span', { class: 'field-label' }, o.design), grid), h('div', { class: 'pvp-draw' }, draw)];
      }
      case 'swords': {
        const cur = engine.options('swords');
        return [
          choice(id, 'size', o.size, SWORD_SIZES, { small: o.small, smaller: o.smaller, tiny: o.tiny }, cur.size),
          choice(id, 'scope', o.weapons, WEAPON_SCOPES, { swords: o.swords, weapons: o.allWeapons }, cur.scope),
          ...(cur.scope === 'weapons' ? [h('p', { class: 'field-desc' }, o.allWeaponsHint)] : []),
        ];
      }
      case 'shield':
        return [choice(id, 'height', o.height, SHIELD_HEIGHTS, { low: o.low, lower: o.lower }, engine.options('shield').height)];
      case 'lowRes':
        return [choice(id, 'scope', o.textures, LOW_RES_SCOPES, { blocks: o.blocks, all: o.blocksItems }, engine.options('lowRes').scope)];
      default:
        return [];
    }
  }

  function card(id: PvpTweakId): HTMLElement {
    const t = tv.tweaks[id];
    const reason = tweakSupport(id, project.edition, project.version);
    const on = !reason && engine.isOn(id);
    const sw = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(on), 'aria-label': fmt(tv.switchLabel, { name: t.title }), disabled: !!reason || busy });
    sw.addEventListener('click', () => void change(id, !engine.isOn(id)));
    const files = reason ? [] : changes(id);
    const shown = files.slice(0, 2).map(short);
    const meta = reason
      ? h('p', { class: 'pvp-reason' }, icon('circle-info', { size: 16 }), h('span', null, tv.unsupported[reason]))
      : h(
          'dl',
          { class: 'pvp-meta' },
          h('div', null, h('dt', null, tv.changes), h('dd', null, ...shown.map((f) => h('code', null, f)), files.length > 2 ? h('span', { class: 'faint' }, fmt(tv.more, { count: files.length - 2 })) : null)),
          h('div', null, h('dt', null, tv.worksIn), h('dd', null, supportText(id))),
        );
    return h(
      'li',
      { class: ['pvp-tweak', on && 'is-on', !!reason && 'is-unavailable'], dataset: { tweak: id } },
      h(
        'div',
        { class: 'pvp-head' },
        h('span', { class: 'pvp-icon', 'aria-hidden': 'true' }, icon(ICONS[id])),
        h('h4', { class: 'pvp-name' }, t.title),
        sw,
      ),
      h('p', { class: 'pvp-desc' }, t.text),
      on && optionsOf(id).length ? h('div', { class: 'pvp-body' }, optionsOf(id)) : null,
      meta,
    );
  }

  // ---------------------------------------------------------------- layout
  const presetBtn = button({
    label: tv.preset.button,
    icon: 'sparkles',
    variant: 'primary',
    class: 'pvp-preset-btn',
    onClick: async () => {
      if (busy) return;
      busy = true;
      setButtonBusy(presetBtn, true);
      try {
        const res = await engine.applyPreset(false);
        opts.onTextures(res.change.textures);
        if (!res.tweaks.length) toast(tv.preset.none, { tone: 'info' });
        else
          toast(fmt(tv.preset.applied, { count: res.tweaks.length }), {
            tone: 'success',
            action: {
              label: tv.toasts.undo,
              onClick: () => {
                res.undo();
                opts.onTextures(res.change.textures);
                render();
              },
            },
          });
      } catch (err) {
        console.error(err);
        toast(friendlyError(err), { tone: 'error' });
      } finally {
        busy = false;
        setButtonBusy(presetBtn, false);
        render();
      }
    },
  });
  const intro = h('div', { class: 'tx-note' }, icon('target'), h('p', null, fmt(tv.intro, { version: versionLabel(project) })));
  const list = h('div', { class: 'pvp-groups' });
  const mods = h(
    'div',
    { class: 'tx-inline-note pvp-mods' },
    icon('circle-info', { size: 16 }),
    h('p', null, h('strong', null, tv.mods.title), ' ', tv.mods.text),
  );
  const guide = h('a', { class: 'btn btn-ghost btn-sm pvp-guide', href: routeHref('/guides/make-a-pvp-texture-pack') }, icon('book-open'), h('span', { class: 'btn-label' }, tv.guide));
  const presetBox = h('div', { class: 'pvp-preset' }, presetBtn, h('p', { class: 'field-desc' }, tv.preset.hint));
  const el = h('div', { class: 'pvp' }, intro, presetBox, list, mods, guide);

  function render() {
    // the preset button goes once everything it switches on is on
    const presetLeft = PRESET_TWEAKS.some((id) => !tweakSupport(id, project.edition, project.version) && !engine.isOn(id));
    presetBox.hidden = !presetLeft;
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-tweak]')?.dataset.tweak;
    list.replaceChildren(
      ...PVP_GROUPS.map((g) => {
        const supported = g.tweaks.filter((id) => !tweakSupport(id, project.edition, project.version));
        const count = supported.filter((id) => engine.isOn(id)).length;
        return h(
          'section',
          { class: 'tx-fx-section', 'aria-labelledby': `pvp-g-${g.id}` },
          h('div', { class: 'tx-fx-head' }, h('h3', { class: 'tx-h', id: `pvp-g-${g.id}` }, tv.groups[g.id]), h('span', { class: 'tx-count-pill' }, `${count}/${supported.length}`)),
          h('ul', { class: 'pvp-list' }, g.tweaks.map(card)),
        );
      }),
    );
    if (focused) list.querySelector<HTMLElement>(`[data-tweak="${focused}"] .switch`)?.focus();
  }

  offs.push(
    // the FPS tweaks are effect layers: the Effects tab can change them too
    store.events.on('effects', () => {
      if (visible && !busy) render();
    }),
  );
  render();

  return {
    el,
    engine,
    setVisible(v) {
      const was = visible;
      visible = v;
      if (v && !was && !busy) render();
    },
    async applyPreset(fps) {
      busy = true;
      list.replaceChildren(h('div', { class: 'pvp-loading' }, spinner(24)));
      try {
        const res = await engine.applyPreset(fps);
        opts.onTextures(res.change.textures);
        toast(fmt(tv.preset.applied, { count: res.tweaks.length }), { tone: 'success' });
      } catch (err) {
        console.error(err);
        toast(friendlyError(err), { tone: 'error' });
      } finally {
        busy = false;
        render();
      }
    },
    destroy() {
      offs.forEach((f) => f());
    },
  };
}

