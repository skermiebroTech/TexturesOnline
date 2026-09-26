// Right-hand "Pack" panel: name and description, target-specific version / compatibility info,
// the Export button and a short install guide.

import type { OptionValues } from '../../../core/types';
import { badge, button, textInput, tooltip } from '../../../ui/components';
import { h, timeAgo } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { versionPicker } from '../../../ui/version-picker';
import type { ShaderTargetInfo } from '../targets';
import type { AnyGenerator, VanillaSupportInfo } from './generator';
import { helpLink, installSteps } from './install';
import type { ShaderProjectData } from './project';

export interface PackPanel {
  el: HTMLElement;
  setName(name: string): void;
  /** Re-reads settings-dependent notes (Bedrock) and the export line */
  refresh(settings: OptionValues): void;
  setSupport(s: VanillaSupportInfo | null): void;
  setVersion(v: string): void;
}

const FEATURE_LABELS: { id: string; label: string; icon: IconName }[] = [
  { id: 'grading', label: 'Colors & tone', icon: 'colors-swatch' },
  { id: 'vignette', label: 'Vignette', icon: 'aspect-ratio' },
  { id: 'bloom', label: 'Bloom glow', icon: 'sparkle' },
  { id: 'fog', label: 'Distance fog', icon: 'cloud' },
  { id: 'fogEnvironment', label: 'Water & weather fog', icon: 'waves' },
  { id: 'nightDarkness', label: 'Darker nights', icon: 'moon' },
  { id: 'waving', label: 'Waving plants', icon: 'leaf' },
];

/** Compares two Java release ids (e.g. '1.21.4' vs '26.3'); null when either isn't a plain release. */
export function compareJavaReleases(a: string, b: string): number | null {
  const re = /^\d+(\.\d+){1,2}$/;
  if (!re.test(a) || !re.test(b)) return null;
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function row(ok: boolean | null, label: string, detail: string, ic: IconName): HTMLElement {
  return h(
    'li',
    { class: ['sh-compat-row', ok === true && 'is-ok', ok === false && 'is-no'] },
    h('span', { class: 'sh-compat-icon' }, icon(ic)),
    h('span', { class: 'sh-compat-text' }, h('span', { class: 'sh-compat-label' }, label), h('span', { class: 'sh-compat-detail' }, detail)),
    h('span', { class: 'sh-compat-state' }, icon(ok === false ? 'close' : ok ? 'check' : 'circle-question')),
  );
}

export function packPanel(opts: {
  project: ShaderProjectData;
  target: ShaderTargetInfo;
  gen: AnyGenerator;
  settings: OptionValues;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
  onVersion: (v: string) => void;
  onExport: () => void;
}): PackPanel {
  const { project, target, gen } = opts;

  // ---- pack info
  const nameField = textInput({ label: 'Pack name', value: project.name, maxLength: 80, onInput: (v) => opts.onName(v) });
  nameField.classList.add('sh-name-field');
  const descField = textInput({
    label: 'Description',
    value: project.description,
    multiline: true,
    maxLength: 200,
    placeholder: 'Shown under the pack name in Minecraft',
    onInput: (v) => opts.onDescription(v),
  });
  const targetLine = h(
    'div',
    { class: 'sh-target-line' },
    h('span', { class: 'sh-target-icon' }, icon(target.icon)),
    h('span', { class: 'sh-target-text' }, h('strong', null, target.name), h('span', { class: 'muted small' }, target.bestFor)),
  );
  const badges = h(
    'div',
    { class: 'row wrap', style: { '--gap': '6px' } },
    badge(target.edition === 'java' ? 'Java Edition' : 'Bedrock Edition', target.edition === 'java' ? 'green' : 'blue'),
    target.needsMods ? badge('Needs Iris or OptiFine', 'gold') : badge('No mods needed', 'purple'),
  );
  const infoSection = h('section', { class: 'sh-pack-section' }, targetLine, badges, nameField, descField);

  // ---- target specific
  const targetSection = h('section', { class: 'sh-pack-section' });
  const compatList = h('ul', { class: 'sh-compat' });
  const notesEl = h('div', { class: 'sh-notes' });
  let version = project.version;

  const renderIrisCompat = () => {
    const v = version;
    const irisOk = compareJavaReleases(v, '1.16.5');
    const irisMax = compareJavaReleases(v, '26.3');
    const ofMin = compareJavaReleases(v, '1.8.9');
    const ofMax = compareJavaReleases(v, '26.2');
    const iris = irisOk === null ? null : irisOk >= 0 && (irisMax ?? 0) <= 0;
    const of = ofMin === null ? null : ofMin >= 0 && (ofMax ?? 0) <= 0;
    compatList.replaceChildren(
      row(iris, 'Iris (recommended)', 'Java 1.16.5 to 26.3, with Fabric. Fast, works with Sodium.', 'sparkles'),
      row(of, 'OptiFine', 'Java 1.8.9 to 26.2 (no 26.3 build yet).', 'gear'),
    );
    const tips: HTMLElement[] = [];
    const vulkan = compareJavaReleases(v, '26.2');
    if (vulkan === null || vulkan >= 0) {
      tips.push(
        h(
          'p',
          { class: 'sh-note' },
          icon('warning'),
          h('span', null, 'Minecraft 26.2 and newer can run on Vulkan. Iris needs OpenGL: set ', h('strong', null, 'Graphics API'), ' to ', h('strong', null, 'Default'), ' or ', h('strong', null, 'Prefer OpenGL'), ' in Video Settings.'),
        ),
      );
    }
    tips.push(
      h(
        'p',
        { class: 'sh-note' },
        icon('info'),
        h('span', null, 'Re-exported with the same file name? In game, press ', h('strong', null, 'Reset'), ' in Shader Pack Settings to use your new defaults.'),
      ),
    );
    notesEl.replaceChildren(...tips);
  };

  let support: VanillaSupportInfo | null = null;
  const renderVanillaCompat = () => {
    if (!support) {
      compatList.replaceChildren();
      notesEl.replaceChildren();
      return;
    }
    if (!support.supported) {
      compatList.replaceChildren();
      notesEl.replaceChildren(h('p', { class: 'sh-note is-warn' }, icon('warning'), h('span', null, support.notes[0] ?? 'This version is not supported.')));
      return;
    }
    const features = support.features ?? {};
    compatList.replaceChildren(
      ...FEATURE_LABELS.filter((f) => f.id in features).map((f) => {
        const ok = features[f.id] !== false;
        const why = support?.reasons[f.id] ?? '';
        const r = row(ok, f.label, ok ? 'Works in this version' : why || 'Not available in this version', f.icon);
        return r;
      }),
    );
    notesEl.replaceChildren(...support.notes.slice(0, 2).map((n) => h('p', { class: 'sh-note' }, icon('info'), h('span', null, n))));
  };

  const bedrockEngine = h('p', { class: 'sh-engine' });
  const renderBedrock = (settings: OptionValues) => {
    if (gen.kind !== 'bedrock-vibrant') return;
    const m = gen.bedrockManifestOptions?.(settings);
    const eng = m?.minEngine ?? [1, 21, 120];
    const pretty = eng[0] === 1 && eng[1] >= 26 ? `${eng[1]}.${eng[2]}` : eng.join('.');
    bedrockEngine.replaceChildren(icon('gamepad'), h('span', null, 'Needs Minecraft Bedrock ', h('strong', null, `${pretty} or newer`), ' with Vibrant Visuals.'));
    const notes = gen.bedrockCompatibilityNotes?.(settings) ?? [];
    notesEl.replaceChildren(...notes.map((n) => h('p', { class: 'sh-note' }, icon('info'), h('span', null, n))));
  };

  if (gen.kind === 'java-vanilla' || gen.kind === 'iris') {
    const picker = versionPicker({
      edition: 'java',
      value: project.version,
      label: gen.kind === 'iris' ? 'Minecraft version you play' : 'Minecraft version',
      onChange: (_e, v) => {
        version = v;
        opts.onVersion(v);
        if (gen.kind === 'iris') renderIrisCompat();
      },
    });
    targetSection.append(
      h('h3', { class: 'section-title' }, icon(gen.kind === 'iris' ? 'gear' : 'box'), gen.kind === 'iris' ? 'Works with' : 'Game version'),
      picker,
    );
    if (gen.kind === 'java-vanilla') {
      targetSection.append(h('p', { class: 'muted small' }, 'Vanilla shaders change with every Minecraft update, so this pack only works in the exact version you pick.'));
    }
    targetSection.append(compatList, notesEl);
    if (gen.kind === 'iris') renderIrisCompat();
  } else {
    const notes = gen.BEDROCK_VV_NOTES ?? [];
    const noteList = h(
      'div',
      { class: 'sh-vv-notes' },
      notes
        .filter((n) => n.id !== 'activate')
        .map((n) => h('details', { class: 'sh-vv-note' }, h('summary', null, h('span', { class: 'grow' }, n.title), icon('chevron-down', { class: 'chev' })), h('p', null, n.text))),
    );
    targetSection.append(h('h3', { class: 'section-title' }, icon('cloud-sun'), 'Vibrant Visuals'), bedrockEngine, notesEl, noteList);
    renderBedrock(opts.settings);
  }

  // ---- export
  const exportBtn = button({ label: `Export ${target.fileExt}`, icon: 'download', variant: 'primary', size: 'lg', class: 'sh-export-main', onClick: () => opts.onExport() });
  tooltip(exportBtn, 'Build and download your pack (Ctrl+E)');
  const fileLine = h('p', { class: 'sh-file-line' });
  const lastLine = h('p', { class: 'faint small sh-last-export' });
  const paintFile = () => {
    const name = (project.name.trim() || 'My shaders') + target.fileExt;
    fileLine.replaceChildren(icon(target.fileExt === '.mcpack' ? 'package' : 'archive'), h('span', { class: 'truncate', title: name }, name), icon('arrow-right', { class: 'sh-file-arrow' }), h('span', { class: 'sh-file-dest' }, target.installPlace));
    lastLine.hidden = !project.lastExportAt;
    if (project.lastExportAt) lastLine.textContent = `Last exported ${timeAgo(project.lastExportAt)}`;
  };
  const exportSection = h(
    'section',
    { class: 'sh-pack-section sh-export-section' },
    exportBtn,
    fileLine,
    lastLine,
    h('h3', { class: 'section-title' }, icon('book-open'), 'How to install'),
    installSteps(target, { compact: true }),
    helpLink(target),
  );
  paintFile();

  const el = h(
    'section',
    { class: 'panel sh-pack', 'aria-label': 'Pack settings and export' },
    h('div', { class: 'panel-header' }, icon('package'), h('h2', null, 'Pack')),
    h('div', { class: 'panel-body scroll sh-pack-body' }, infoSection, h('hr', { class: 'divider' }), targetSection, h('hr', { class: 'divider' }), exportSection),
  );

  return {
    el,
    setName(n) {
      const input = nameField.input;
      if (document.activeElement !== input) input.value = n;
      paintFile();
    },
    refresh(settings) {
      paintFile();
      renderBedrock(settings);
    },
    setSupport(s) {
      support = s;
      renderVanillaCompat();
    },
    setVersion(v) {
      version = v;
      if (gen.kind === 'iris') renderIrisCompat();
    },
  };
}
