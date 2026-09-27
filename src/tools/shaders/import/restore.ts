// Turns a pack exported by the Shader Maker (it carries texturepackmaker.json) back into a normal,
// fully editable project: same target, game version, settings and preset; name and description
// come from the pack's own files. Bedrock packs keep their uuids so a new export replaces the
// installed copy. Pure: no DOM.

import type { OptionValues } from '../../../core/types';
import { isUuid } from '../../../core/uuid';
import { newShaderProject, type ShaderProjectData } from '../ui/project';
import { parseLang } from '../packedit/iris-layout';
import { javaPackDescription, readBedrockManifest } from '../packedit/json-tools';
import { stripFormatting } from '../packedit/properties';
import { baseName, type PackCandidate } from './detect';
import { decodeText } from './text';

const text = (b: Uint8Array | undefined) => (b ? decodeText(b).text : '');

function oneLine(s: string, max: number): string {
  return stripFormatting(s).replace(/[\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Name and description the pack itself carries (lang file, README, pack.mcmeta or manifest). */
export function packTexts(c: PackCandidate): { name: string; description: string } {
  if (c.kind === 'iris') {
    const langPath = Object.keys(c.files).find((p) => /^shaders\/lang\/en_us\.lang$/i.test(p));
    const lang = parseLang(text(langPath ? c.files[langPath] : undefined));
    const readme = text(c.files['README.txt']).split(/\r?\n/)[0] ?? '';
    const name = oneLine(lang.get('option.PACK_INFO') ?? '', 80) || oneLine(readme, 80) || c.name;
    const description = oneLine((lang.get('option.PACK_INFO.comment') ?? '').replace(/\s*Made with Texture Pack Maker\.?\s*$/, ''), 400);
    return { name, description };
  }
  if (c.kind === 'java-vanilla') {
    const version = c.metadata?.version ?? '';
    let description = oneLine(javaPackDescription(text(c.files['pack.mcmeta'])), 400);
    const suffix = ` (Java ${version} only)`;
    if (version && description.endsWith(suffix)) description = description.slice(0, -suffix.length);
    return { name: baseName(c.fileName) || c.name, description };
  }
  const info = readBedrockManifest(text(c.files['manifest.json']));
  return { name: oneLine(info?.name ?? '', 80) || c.name, description: oneLine(info?.description ?? '', 400) };
}

export interface RestoreOptions {
  /** The target generator's settings normalisation (fills gaps, clamps ranges) */
  normalize: (v: OptionValues) => OptionValues;
  /** Preset ids the target knows (an unknown preset id is dropped) */
  presetIds: readonly string[];
  /** Version used when the pack does not name one */
  defaultVersion: string;
}

/** A new project from a pack made with Texture Pack Maker (candidate.metadata must be set). */
export function projectFromCandidate(c: PackCandidate, opts: RestoreOptions): ShaderProjectData {
  const m = c.metadata;
  if (!m) throw new Error('This pack was not made with Texture Pack Maker.');
  const { name, description } = packTexts(c);
  const preset = m.preset && opts.presetIds.includes(m.preset) ? m.preset : undefined;
  const project = newShaderProject({
    target: m.target,
    version: m.version || opts.defaultVersion,
    name,
    description,
    settings: opts.normalize(m.settings),
    preset,
  });
  if (m.target === 'bedrock-vibrant') {
    const man = readBedrockManifest(text(c.files['manifest.json']));
    if (man?.headerUuid && man.moduleUuid && isUuid(man.headerUuid) && isUuid(man.moduleUuid)) project.bedrockUuids = { header: man.headerUuid, module: man.moduleUuid };
    if (man?.version) project.packVersion = man.version;
  }
  return project;
}
