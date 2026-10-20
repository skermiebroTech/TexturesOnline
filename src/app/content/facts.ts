// Facts the public pages quote, worked out from the app's own data so every language says the same
// thing and they update with the data (pack formats, the default Bedrock manifest).

import { KNOWN_RELEASES, KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../editions/java/packformats';

/** The Java release the makers default to. */
export const LATEST = '26.3';

/** Resource pack format of a Java release as written in the guides ('26.3' -> '97.1'). */
export const F = (id: string): string => formatPackFormat(KNOWN_RELEASE_FORMATS[id]);

/** pack.mcmeta "min_format" value for a release ('26.3' -> '[97, 1]'). */
export function minFormat(id: string): string {
  const f = KNOWN_RELEASE_FORMATS[id];
  return f.minor ? `[${f.major}, ${f.minor}]` : String(f.major);
}

/** pack.mcmeta "max_format" value for a pack that ends at a release (the major number: any minor). */
export const maxFormat = (id: string): string => String(KNOWN_RELEASE_FORMATS[id].major);

/** pack.mcmeta of a pack made only for one release (1.21.9 and newer). */
export function mcmetaFor(id: string, description: string): string {
  return `{\n  "pack": {\n    "description": ${JSON.stringify(description)},\n    "min_format": ${minFormat(id)},\n    "max_format": ${maxFormat(id)}\n  }\n}`;
}

/** pack.mcmeta of a pack for a range of releases that starts before 1.21.9 (every field each version reads). */
export function mcmetaRange(fromId: string, toId: string, description: string): string {
  const from = KNOWN_RELEASE_FORMATS[fromId].major;
  return `{\n  "pack": {\n    "description": ${JSON.stringify(description)},\n    "pack_format": ${from},\n    "supported_formats": [${from}, ${maxFormat(toId)}],\n    "min_format": ${from},\n    "max_format": ${maxFormat(toId)}\n  }\n}`;
}

/** pack.mcmeta of a pack for one release before 1.20.2 (a single pack_format). */
export function mcmetaLegacy(id: string, description: string): string {
  return `{\n  "pack": {\n    "pack_format": ${KNOWN_RELEASE_FORMATS[id].major},\n    "description": ${JSON.stringify(description)}\n  }\n}`;
}

/** Major and minor number of a release's pack format. */
export const formatParts = (id: string): { major: number; minor: number } => ({ ...KNOWN_RELEASE_FORMATS[id] });

/** The newest snapshot at the time of writing (not in the release table). */
export const NEXT_SNAPSHOT = { version: '26.4', format: '98.0' };

/** Default Bedrock min_engine_version of exported packs (editions/bedrock/manifest.ts, checked by a unit test). */
export const BEDROCK_MIN_ENGINE: [number, number, number] = [1, 21, 0];
export const MIN_ENGINE = `[${BEDROCK_MIN_ENGINE.join(', ')}]`;

/** Releases grouped by resource pack format, oldest first: [format, [first, ..., last]] */
export function formatGroups(): { format: string; versions: string[] }[] {
  const groups: { format: string; versions: string[] }[] = [];
  for (const id of KNOWN_RELEASES) {
    const f = formatPackFormat(KNOWN_RELEASE_FORMATS[id]);
    const last = groups[groups.length - 1];
    if (last && last.format === f) last.versions.push(id);
    else groups.push({ format: f, versions: [id] });
  }
  return groups;
}
