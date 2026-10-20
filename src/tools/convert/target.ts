// Conversion targets as the converter page shows them. Kept apart from the engine (convert.ts), which
// the page loads only when a conversion starts.

import type { Edition } from '../../core/types';
import type { ConvertTarget } from './convert';
import { compareJavaVersions } from './paths';
import { kit } from '../../ui/i18n/kit';
import { fmt } from '../../i18n/editor-text';

/** "Bedrock" / "Java 26.3" for pack names (always English, so an older suffix can be recognised). */
export function targetLabel(t: { edition: Edition; version: string }): string {
  return t.edition === 'bedrock' ? 'Bedrock' : `Java ${t.version}`;
}

/** "Bedrock" / "Java 26.3" in the interface's language, for messages. */
export function targetText(t: { edition: Edition; version: string }): string {
  return t.edition === 'bedrock' ? kit.edition.bedrock : fmt(kit.edition.javaVersion, { version: t.version });
}

/** Whether converting `source` to `target` does anything. */
export function isSameTarget(source: { edition: Edition; version: string }, target: ConvertTarget): boolean {
  if (source.edition !== target.edition) return false;
  return source.edition === 'bedrock' || compareJavaVersions(source.version, target.version) === 0;
}
