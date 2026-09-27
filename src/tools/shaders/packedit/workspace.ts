// In-memory model of an opened pack: the original bytes of every file, text edits from the Files
// tab, the Iris option model and building the files of an export. Pure: no DOM.

import type { FileMap } from '../../../core/types';
import type { PackKind } from '../import/detect';
import { decodeText, encodeText, isTextFile, type DecodedText } from '../import/text';
import { findLangPath, parseLang, buildLayout, type IrisLayout, type LangTable } from './iris-layout';
import { parseIrisOptions, SOURCE_EXT, type IrisOptionSet } from './iris-options';
import { applyOptionValues, settingsFileText, type ChosenValues } from './iris-rewrite';
import { bumpManifestVersion, type Semver } from './json-tools';

const IRIS_TEXT = /\.(vsh|fsh|gsh|csh|tcs|tes|glsl|inc|h|properties|lang)$/i;

export interface IrisModel {
  set: IrisOptionSet;
  layout: IrisLayout;
  lang: LangTable;
}

export interface ExportBuild {
  files: FileMap;
  /** Files whose option lines were rewritten */
  optionFiles: string[];
  /** Options whose declaration could not be rewritten (should not happen) */
  skipped: string[];
  /** Bedrock: the version written to manifest.json */
  version?: Semver;
  warnings: string[];
}

export class PackWorkspace {
  private readonly decoded = new Map<string, DecodedText>();
  private readonly textFlags = new Map<string, boolean>();
  readonly paths: string[];

  constructor(
    readonly kind: PackKind,
    readonly original: Record<string, Uint8Array>,
    readonly edits: Record<string, string> = {},
  ) {
    this.paths = Object.keys(original).sort((a, b) => a.localeCompare(b));
    for (const p of Object.keys(edits)) if (!(p in original)) delete edits[p];
  }

  has(path: string): boolean {
    return path in this.original;
  }

  isText(path: string): boolean {
    let v = this.textFlags.get(path);
    if (v === undefined) {
      const b = this.original[path];
      v = b ? isTextFile(path, b) : false;
      this.textFlags.set(path, v);
    }
    return v;
  }

  private decode(path: string): DecodedText {
    let d = this.decoded.get(path);
    if (!d) {
      d = decodeText(this.original[path] ?? new Uint8Array(0));
      this.decoded.set(path, d);
    }
    return d;
  }

  encodingOf(path: string): DecodedText['encoding'] {
    return this.decode(path).encoding;
  }

  originalText(path: string): string {
    return this.decode(path).text;
  }

  /** Current text (edited or original). */
  text(path: string): string {
    return this.edits[path] ?? this.decode(path).text;
  }

  isEdited(path: string): boolean {
    return path in this.edits;
  }

  editedPaths(): string[] {
    return Object.keys(this.edits).sort();
  }

  /** Sets the text of a file; returns true when that changed whether the file counts as edited. */
  setText(path: string, text: string): boolean {
    const was = path in this.edits;
    if (text === this.decode(path).text) delete this.edits[path];
    else this.edits[path] = text;
    return was !== path in this.edits;
  }

  revert(path: string): void {
    delete this.edits[path];
  }

  byteSize(path: string): number {
    return this.original[path]?.length ?? 0;
  }

  // ------------------------------------------------------------------- Iris

  /** Text of the files the Iris option parser reads (shader sources, .properties, .lang). */
  irisSources(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const p of this.paths) if (p.startsWith('shaders/') && IRIS_TEXT.test(p)) out[p] = this.text(p);
    return out;
  }

  irisModel(): IrisModel {
    const sources = this.irisSources();
    const set = parseIrisOptions(sources);
    const langPath = findLangPath(Object.keys(sources));
    const lang = parseLang(langPath ? sources[langPath] : undefined);
    const layout = buildLayout(set, sources['shaders/shaders.properties'], lang);
    return { set, layout, lang };
  }

  /** True when an edit to this file can change the options or menus. */
  static affectsOptions(path: string): boolean {
    return path.startsWith('shaders/') && (SOURCE_EXT.test(path) || /\.(properties|lang)$/i.test(path));
  }

  // ------------------------------------------------------------------- export

  /**
   * Every file of the pack for export: untouched files keep their original bytes; edited files and
   * files with rewritten option lines are encoded in their original encoding.
   */
  buildExport(opts: { iris?: { set: IrisOptionSet; values: ChosenValues }; bedrockAtLeast?: Semver } = {}): ExportBuild {
    const files: FileMap = {};
    const warnings: string[] = [];
    let optionFiles: string[] = [];
    let skipped: string[] = [];
    let rewritten: Record<string, string> = {};
    if (opts.iris && Object.keys(opts.iris.values).length) {
      const sources = this.irisSources();
      const res = applyOptionValues(sources, opts.iris.set, opts.iris.values);
      rewritten = res.files;
      optionFiles = Object.keys(res.files).sort();
      skipped = res.skipped;
      if (skipped.length) warnings.push(`${skipped.length} option${skipped.length === 1 ? '' : 's'} could not be written: ${skipped.slice(0, 6).join(', ')}`);
    }
    let version: Semver | undefined;
    for (const p of this.paths) {
      let text: string | undefined = rewritten[p] ?? this.edits[p];
      if (this.kind === 'bedrock' && p === 'manifest.json') {
        const bumped = bumpManifestVersion(text ?? this.text(p), opts.bedrockAtLeast);
        if (bumped) {
          text = bumped.text;
          version = bumped.version;
        } else warnings.push("manifest.json couldn't be read, so the pack version was not raised. Bedrock may keep the old copy installed.");
      }
      files[p] = text === undefined ? this.original[p] : encodeText(text, this.encodingOf(p));
    }
    return { files, optionFiles, skipped, version, warnings };
  }

  settingsFile(set: IrisOptionSet, values: ChosenValues, packFileName: string): string {
    return settingsFileText(set, values, packFileName);
  }
}
