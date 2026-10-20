// Right-hand "Pack" panel: name and description, target-specific version / compatibility info,
// the Export button and a short install guide.

import type { OptionValues } from '../../../core/types';
import { badge, button, textInput, tooltip } from '../../../ui/components';
import { h, timeAgo } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { versionPicker } from '../../../ui/version-picker';
import type { ShaderTargetInfo } from '../targets';
import type { AnyGenerator, NoteDef, VanillaSupportInfo } from './generator';
import { helpLink, installSteps } from './install';
import type { ShaderProjectData } from './project';
import { et } from './i18n/editor';
import { t } from '../i18n/text';
import { kit } from '../../../ui/i18n/kit';
import { fmt, fmtNodes } from '../../../i18n/editor-text';

export interface PackPanel {
  el: HTMLElement;
  setName(name: string): void;
  /** Re-reads settings-dependent notes (Bedrock) and the export line */
  refresh(settings: OptionValues): void;
  setSupport(s: VanillaSupportInfo | null): void;
  setVersion(v: string): void;
  setExportAvailable(ok: boolean, reason?: string): void;
}

const FEATURE_LABELS: { id: keyof typeof et.pack.features; icon: IconName }[] = [
  { id: 'grading', icon: 'colors-swatch' },
  { id: 'vignette', icon: 'aspect-ratio' },
  { id: 'bloom', icon: 'sparkle' },
  { id: 'fog', icon: 'cloud' },
  { id: 'fogEnvironment', icon: 'waves' },
  { id: 'nightDarkness', icon: 'moon' },
  { id: 'waving', icon: 'leaf' },
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

function accordion(notes: readonly NoteDef[]): HTMLElement {
  return h(
    'div',
    { class: 'sh-vv-notes' },
    notes.map((n) => h('details', { class: 'sh-vv-note' }, h('summary', null, h('span', { class: 'grow' }, n.title), icon('chevron-down', { class: 'chev' })), h('p', null, n.text))),
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
  const nameField = textInput({ label: et.pack.name, value: project.name, maxLength: 80, onInput: (v) => opts.onName(v) });
  nameField.classList.add('sh-name-field');
  const descField = textInput({
    label: et.pack.description,
    value: project.description,
    multiline: true,
    maxLength: 200,
    placeholder: et.pack.descriptionHint,
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
    badge(target.edition === 'java' ? kit.edition.java : kit.edition.bedrock, target.edition === 'java' ? 'green' : 'blue'),
    target.needsMods ? badge(et.pack.needsMod, 'gold') : badge(et.pack.noMods, 'purple'),
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
      row(iris, et.pack.irisRow, et.pack.irisDetail, 'sparkles'),
      row(of, 'OptiFine', et.pack.optifineDetail, 'gear'),
    );
    const tips: HTMLElement[] = [];
    const notes = gen.kind === 'iris' ? (gen.IRIS_NOTES ?? []) : [];
    const vulkan = compareJavaReleases(v, '26.2');
    if (vulkan === null || vulkan >= 0) {
      const n = notes.find((x) => x.id === 'vulkan');
      tips.push(
        h(
          'p',
          { class: 'sh-note is-warn' },
          icon('warning'),
          n
            ? h('span', null, n.text)
            : h(
                'span',
                null,
                fmtNodes(et.pack.vulkan, {
                  api: h('strong', null, et.pack.graphicsApi),
                  default: h('strong', null, et.pack.apiDefault),
                  opengl: h('strong', null, et.pack.preferOpenGl),
                }),
              ),
        ),
      );
    }
    const extra = notes.filter((x) => x.id === 'settings' || x.id === 'performance');
    if (extra.length) tips.push(accordion(extra));
    else {
      tips.push(
        h(
          'p',
          { class: 'sh-note' },
          icon('info'),
          h('span', null, fmtNodes(et.pack.reExported, { reset: h('strong', null, et.pack.resetButton) })),
        ),
      );
    }
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
      notesEl.replaceChildren(h('p', { class: 'sh-note is-warn' }, icon('warning'), h('span', null, support.notes[0] ?? et.pack.notSupported)));
      return;
    }
    const features = support.features ?? {};
    compatList.replaceChildren(
      ...FEATURE_LABELS.filter((f) => f.id in features).map((f) => {
        const ok = features[f.id] !== false;
        const why = support?.reasons[f.id] ?? '';
        const r = row(ok, et.pack.features[f.id], ok ? et.pack.works : why || et.pack.notAvailable, f.icon);
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
    bedrockEngine.replaceChildren(icon('gamepad'), h('span', null, fmtNodes(et.pack.bedrockEngine, { version: h('strong', null, fmt(et.pack.orNewer, { version: pretty })) })));
    const notes = gen.bedrockCompatibilityNotes?.(settings) ?? [];
    notesEl.replaceChildren(...notes.map((n) => h('p', { class: 'sh-note' }, icon('info'), h('span', null, n))));
  };

  if (gen.kind === 'java-vanilla' || gen.kind === 'iris') {
    const picker = versionPicker({
      edition: 'java',
      value: project.version,
      label: gen.kind === 'iris' ? et.pack.versionYouPlay : et.pack.version,
      onChange: (_e, v) => {
        version = v;
        opts.onVersion(v);
        if (gen.kind === 'iris') renderIrisCompat();
      },
    });
    targetSection.append(
      h('h3', { class: 'section-title' }, icon(gen.kind === 'iris' ? 'gear' : 'box'), gen.kind === 'iris' ? et.pack.worksWith : et.pack.gameVersion),
      picker,
    );
    if (gen.kind === 'java-vanilla') {
      targetSection.append(h('p', { class: 'muted small' }, et.pack.vanillaNote));
    }
    targetSection.append(compatList, notesEl);
    if (gen.kind === 'iris') renderIrisCompat();
  } else {
    const noteList = accordion((gen.BEDROCK_VV_NOTES ?? []).filter((n) => n.id !== 'activate'));
    targetSection.append(h('h3', { class: 'section-title' }, icon('cloud-sun'), t.targets.bedrock.shortName), bedrockEngine, notesEl, noteList);
    renderBedrock(opts.settings);
  }

  // ---- export
  const exportBtn = button({ label: fmt(et.pack.exportExt, { ext: target.fileExt }), icon: 'download', variant: 'primary', size: 'lg', class: 'sh-export-main', onClick: () => opts.onExport() });
  tooltip(exportBtn, et.pack.exportTip);
  const fileLine = h('p', { class: 'sh-file-line' });
  const destLine = h('p', { class: 'sh-file-dest' }, target.installPlace);
  const lastLine = h('p', { class: 'faint small sh-last-export' });
  const paintFile = () => {
    const name = (project.name.trim() || t.myShaders) + target.fileExt;
    fileLine.replaceChildren(icon(target.fileExt === '.mcpack' ? 'package' : 'archive'), h('span', { class: 'truncate', title: name }, name));
    lastLine.hidden = !project.lastExportAt;
    if (project.lastExportAt) lastLine.textContent = fmt(et.pack.lastExported, { when: timeAgo(project.lastExportAt) });
  };
  const exportSection = h(
    'section',
    { class: 'sh-pack-section sh-export-section' },
    exportBtn,
    fileLine,
    destLine,
    lastLine,
    h('h3', { class: 'section-title' }, icon('book-open'), et.pack.howToInstall),
    installSteps(target, { compact: true }),
    helpLink(target),
  );
  paintFile();

  const el = h(
    'section',
    { class: 'panel sh-pack', 'aria-label': et.pack.panel },
    h('div', { class: 'panel-header' }, icon('package'), h('h2', null, et.pack.title)),
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
    setExportAvailable(ok, reason) {
      exportBtn.disabled = !ok;
      tooltip(exportBtn, ok ? et.pack.exportTip : (reason ?? et.pack.exportUnavailable));
    },
  };
}
