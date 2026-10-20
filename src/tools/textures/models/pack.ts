// Custom models inside a texture pack project: the files the model editor writes go to extraFiles (so
// every tool that copies a pack's files keeps them and export writes them as they are), with
// project.customModels remembering which files those are and the pack's own copies they replaced, so
// a model can be put back. Also the checks run on export.

import type { CustomModel, TexturePackProject } from '../../../core/types';
import { modelPath } from '../../../shared/models/java-models';
import { modelFromJson } from './doc';
import { modelRules, validateModel, type ModelIssue } from './rules';
import { fmt } from '../../../i18n/editor-text';
import { tr } from '../ui/i18n/model-rules';

const jsonBlob = (text: string) => new Blob([text], { type: 'application/json' });

/** Key of a custom model in project.customModels: the pack path of the model it replaces. */
export function customModelKey(model: string): string {
  return modelPath(model);
}

/**
 * Writes a model's files into the project. Files written before but not any more (the shape moved to
 * item/<id>_3d, the blockstate isn't needed) get the pack's own copy back, or are removed.
 */
export function writeCustomModel(project: TexturePackProject, info: Omit<CustomModel, 'files' | 'originals' | 'updatedAt'>, files: Record<string, string>): CustomModel {
  const key = customModelKey(info.model);
  const models = (project.customModels ??= {});
  const prev = models[key];
  const originals: Record<string, Blob | null> = { ...(prev?.originals ?? {}) };
  for (const path of Object.keys(files)) if (!(path in originals)) originals[path] = project.extraFiles[path] ?? null;
  for (const path of prev?.files ?? []) {
    if (path in files) continue;
    restore(project, path, originals[path] ?? null);
    delete originals[path];
  }
  for (const [path, text] of Object.entries(files)) project.extraFiles[path] = jsonBlob(text);
  const next: CustomModel = { ...info, files: Object.keys(files), originals, updatedAt: Date.now() };
  models[key] = next;
  return next;
}

function restore(project: TexturePackProject, path: string, original: Blob | null): void {
  if (original) project.extraFiles[path] = original;
  else delete project.extraFiles[path];
}

/** Puts back what the pack had before the model was edited (the game's model when it had none). */
export function resetCustomModel(project: TexturePackProject, model: string): boolean {
  const key = customModelKey(model);
  const info = project.customModels?.[key];
  if (!info) return false;
  for (const path of info.files) restore(project, path, info.originals[path] ?? null);
  delete project.customModels![key];
  if (!Object.keys(project.customModels!).length) delete project.customModels;
  return true;
}

export function customModelOf(project: TexturePackProject, model: string): CustomModel | null {
  return project.customModels?.[customModelKey(model)] ?? null;
}

/**
 * Problems of the pack's custom models for its game version, as export warnings (one line per model).
 * `read` gives a file's text (null when missing).
 */
export async function customModelWarnings(
  project: TexturePackProject,
  read: (path: string) => Promise<string | null>,
  hasTexture: (path: string) => boolean,
  atlas: { block: string[] | null; item: string[] | null } = { block: null, item: null },
): Promise<string[]> {
  const out: string[] = [];
  if (project.edition !== 'java' || !project.customModels) return out;
  const rules = modelRules(project.version);
  for (const info of Object.values(project.customModels)) {
    const path = modelPath(info.saved);
    const text = await read(path);
    const name = info.saved.replace(/^minecraft:/, '');
    if (text === null) {
      out.push(fmt(tr.missingModel, { name }));
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      out.push(fmt(tr.badJson, { name }));
      continue;
    }
    if (!rules.models) {
      out.push(fmt(tr.noModels, { version: project.version, name }));
      continue;
    }
    const issues: ModelIssue[] = validateModel(modelFromJson(json, info.saved), { rules, hasTexture, atlasDirs: atlas[info.kind] });
    const errors = issues.filter((i) => i.level === 'error');
    const first = errors[0] ?? issues[0];
    if (!first) continue;
    out.push(`${fmt(tr.problem, { name, message: first.message })}${issues.length > 1 ? fmt(tr.moreProblems, { count: issues.length - 1 }) : ''}`);
  }
  return out;
}
