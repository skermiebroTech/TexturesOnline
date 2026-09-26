// "New shader pack" dialog: name, version (vanilla) and an optional starting preset.

import { navigate } from '../../../core/router';
import { saveProject } from '../../../core/storage';
import { friendlyError } from '../../../core/net';
import type { ShaderTarget } from '../../../core/types';
import { spinner, textInput } from '../../../ui/components';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { versionPicker } from '../../../ui/version-picker';
import { targetInfo } from '../targets';
import { presetSettings, type AnyGenerator } from './generator';
import { presetGallery } from './presets';
import { newShaderProject } from './project';

const DEFAULT_NAMES: Record<ShaderTarget, string> = {
  iris: 'My Shader Pack',
  'java-vanilla': 'My Vanilla Shaders',
  'bedrock-vibrant': 'My Vibrant Visuals',
};

export function openNewProjectDialog(targetId: ShaderTarget, opts: { preset?: string } = {}): void {
  const target = targetInfo(targetId);
  let gen: AnyGenerator | null = null;
  let preset = opts.preset ?? 'default';
  let version = target.defaultVersion;
  let name = DEFAULT_NAMES[targetId];

  const nameField = textInput({ label: 'Pack name', value: name, maxLength: 80, onInput: (v) => (name = v) });
  const presetsHost = h('div', { class: 'sh-new-presets' }, h('div', { class: 'sh-loading-inline' }, spinner(24), h('span', { class: 'muted' }, 'Loading presets…')));
  const versionHost =
    targetId === 'java-vanilla'
      ? h(
          'div',
          { class: 'sh-new-version' },
          versionPicker({ edition: 'java', value: version, label: 'Minecraft version', onChange: (_e, v) => (version = v) }),
          h('p', { class: 'field-desc' }, icon('info'), ' Vanilla shaders only work in the exact version they were made for. You can change it later.'),
        )
      : null;

  const body = h(
    'div',
    { class: 'sh-new' },
    h('div', { class: 'sh-new-intro' }, h('span', { class: 'sh-new-icon' }, icon(target.icon)), h('p', { class: 'muted' }, target.tagline)),
    h('div', { class: 'sh-new-fields' }, nameField, versionHost),
    h('div', { class: 'sh-new-head' }, h('h3', { class: 'section-title' }, icon('sparkles'), 'Start from a preset'), h('span', { class: 'faint small' }, 'You can change everything later')),
    presetsHost,
  );

  const create = async (): Promise<boolean> => {
    if (!gen) return false;
    const p = gen.PRESETS.find((x) => x.id === preset) ?? gen.PRESETS[0];
    const project = newShaderProject({
      target: targetId,
      version,
      name: name.trim() || DEFAULT_NAMES[targetId],
      description: p && p.id !== 'default' ? `${p.label} shaders made with TexturesOnline` : 'Custom shaders made with TexturesOnline',
      settings: presetSettings(gen, p?.id ?? 'default'),
      preset: p?.id,
    });
    try {
      await saveProject(project);
    } catch (err) {
      toast(friendlyError(err, "Couldn't create the project"), { tone: 'error' });
      return false;
    }
    modal.close();
    navigate(`/shaders/${project.id}`);
    return true;
  };

  const modal = openModal({
    title: `New ${target.shortName} pack`,
    body,
    width: 760,
    class: 'sh-new-modal',
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      { label: 'Create pack', variant: 'primary', onClick: () => create() },
    ],
    initialFocus: nameField.input as HTMLElement,
  });
  nameField.input.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      e.preventDefault();
      void create();
    }
  });

  target
    .load()
    .then((g) => {
      gen = g;
      if (!g.PRESETS.some((p) => p.id === preset)) preset = g.PRESETS[0]?.id ?? 'default';
      const gallery = presetGallery({
        presets: g.PRESETS,
        active: preset,
        mode: 'choose',
        label: 'Starting preset',
        onPick: (pid) => {
          preset = pid;
          gallery.setActive(pid);
        },
      });
      presetsHost.replaceChildren(gallery.el);
    })
    .catch((err) => {
      presetsHost.replaceChildren(h('p', { class: 'sh-note is-warn' }, icon('warning'), h('span', null, friendlyError(err))));
    });
}
