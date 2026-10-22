// Pack Doctor: shared types of the checker (checks.ts), the fixer (fixes.ts) and the page. No DOM.

import type { Edition } from '../../core/types';

/** How bad a problem is: the pack doesn't load at all, loads with parts missing, may cause trouble, or just good to know. */
export type Severity = 'error' | 'broken' | 'warning' | 'info';

export const SEVERITIES: readonly Severity[] = ['error', 'broken', 'warning', 'info'];

export type IssueCode =
  // archive and layout
  | 'zip-damaged'
  | 'zip-method'
  | 'zip-backslash'
  | 'zip64'
  | 'junk'
  | 'nested-folder'
  | 'nested-archive'
  | 'several-packs'
  | 'no-pack'
  | 'shader-pack'
  | 'data-pack'
  | 'other-bedrock-pack'
  | 'bedrock-zip'
  | 'java-mcpack'
  | 'wrong-edition'
  // Java
  | 'mcmeta-missing'
  | 'mcmeta-name'
  | 'mcmeta-json'
  | 'mcmeta-strict'
  | 'mcmeta-invalid'
  | 'format-mismatch'
  | 'old-folders'
  | 'new-folders'
  | 'renamed-textures'
  | 'bad-names'
  | 'misplaced-textures'
  | 'atlas-missing'
  | 'missing-texture-ref'
  | 'missing-model-ref'
  | 'anim-strip'
  | 'anim-frames'
  | 'anim-size'
  | 'sound-format'
  | 'overlay-missing'
  | 'core-shaders'
  | 'optifine'
  | 'json-strict'
  // Bedrock
  | 'manifest-missing'
  | 'manifest-name'
  | 'manifest-json'
  | 'manifest-format'
  | 'manifest-header'
  | 'manifest-uuid'
  | 'manifest-modules'
  | 'manifest-engine'
  | 'duplicate-uuid'
  | 'known-uuid'
  | 'texture-list'
  | 'bedrock-missing-ref'
  | 'bedrock-case'
  | 'java-in-bedrock'
  | 'tga-png-pair'
  | 'subpack-missing'
  | 'pack-name-key'
  | 'long-paths'
  | 'material-bin'
  // both
  | 'json-syntax'
  | 'not-png'
  | 'wrong-image-type'
  | 'broken-image'
  | 'png-format'
  | 'not-power-of-two'
  | 'pack-icon';

/** Which game versions or devices a problem affects. */
export interface Affects {
  edition: Edition;
  /**
   * all: every version · from: `from` and newer · upTo: `to` and older · target: the version that
   * was checked · mobile: Bedrock on phones, tablets and consoles · some: some devices
   */
  kind: 'all' | 'from' | 'upTo' | 'target' | 'mobile' | 'some';
  from?: string;
  to?: string;
}

/** What a fix does to the pack's files. Plans are worked out by the checks and run by fixes.ts. */
export type FixPlan =
  /** Nothing to change in the files: the fixed pack is written as a clean archive with the pack at the top */
  | { kind: 'rebuild' }
  /** Write these files (new contents) */
  | { kind: 'write'; files: Record<string, string> }
  /**
   * Move files; references in models, block states, item definitions, fonts and atlases follow.
   * `refs` also renames references to the game's own textures and models (canonical old -> new).
   */
  | { kind: 'move'; moves: [from: string, to: string][]; refs?: { textures: Record<string, string>; models: Record<string, string> } }
  /** Re-encode these images as standard 8-bit RGBA PNG (paths: [source, destination]) */
  | { kind: 'images'; images: [from: string, to: string][] }
  /** Give the Bedrock pack new UUIDs */
  | { kind: 'uuids' }
  /** Replace texture paths in Bedrock texture lists (file -> old path -> new path) */
  | { kind: 'refs'; files: Record<string, Record<string, string>> };

export interface Fix {
  /** Safe fixes are applied by "Fix all"; the others need a click on their own button */
  safe: boolean;
  plan: FixPlan;
}

/** Pages of the site an issue can point to. */
export type IssueLink = 'converter' | 'install' | 'shaders-help' | 'formats' | 'textures' | 'sounds' | 'skins' | 'not-working' | 'bedrock-packs';

export interface Issue {
  code: IssueCode;
  severity: Severity;
  /** Message parameters (texts live in i18n/report.ts) */
  params: Record<string, string | number>;
  /** Files it is about (at most MAX_FILES), as paths inside the pack */
  files: string[];
  /** How many files in total */
  count: number;
  affects: Affects;
  fix?: Fix;
  /** A message from the game or the JSON reader, shown as code (English, as the game writes it) */
  detail?: string;
  link?: IssueLink;
}

export const MAX_FILES = 60;

/** What was checked, for the "Looks good" list. */
export interface Checked {
  code: 'zip' | 'layout' | 'mcmeta' | 'format' | 'folders' | 'names' | 'images' | 'json' | 'refs' | 'animations' | 'sounds' | 'manifest' | 'uuids' | 'texture-lists';
  count?: number;
}

/** One entry of a ZIP's central directory. */
export interface RawEntry {
  /** Name exactly as stored */
  name: string;
  /** Normalised path ('' for directories and skipped entries) */
  path: string;
  method: number;
  flags: number;
  size: number;
}

/** An opened pack file: its entries and the bytes of every readable file. */
export interface PackArchive {
  fileName: string;
  kind: 'zip' | 'folder';
  /** Normalised path -> bytes */
  files: Map<string, Uint8Array>;
  /** Central directory entries (zip only) */
  entries: RawEntry[];
  zip64: boolean;
  /** Entries that can't be read: other compression methods, passwords, damage */
  unreadable: { path: string; reason: 'method' | 'encrypted' | 'damaged'; method?: number }[];
  /** Mac and Windows clutter (__MACOSX, .DS_Store, Thumbs.db, desktop.ini) */
  junk: string[];
  /** The whole archive could not be opened */
  damaged?: boolean;
  /** Zips found inside the archive, opened one level deep (path of the inner file -> its archive) */
  inner: Map<string, PackArchive>;
}

/** The checked game: edition and version. */
export interface DoctorTarget {
  edition: Edition;
  /** Java release id, or 'latest' for Bedrock */
  version: string;
}

export type ChangeCode = 'rebuilt' | 'extracted' | 'junk' | 'created' | 'rewritten' | 'renamed' | 'moved' | 'converted' | 'uuids' | 'refs' | 'extension';

/** One line of the "what changed" summary. */
export interface Change {
  code: ChangeCode;
  count: number;
  /** A file name the line mentions (created / rewritten files) */
  file?: string;
  /** Renamed or moved files (from, to), so a file moved in two rounds counts once */
  moves?: [from: string, to: string][];
  /** Files whose paths were updated, so a file updated in two rounds counts once */
  paths?: string[];
}
