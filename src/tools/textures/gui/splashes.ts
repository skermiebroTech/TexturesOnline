// Splash texts: the yellow line that bounces next to the title screen logo. Pure (no DOM, no storage).
//
// Java reads assets/minecraft/texts/splashes.txt, one text per line; a pack's file replaces the
// game's whole list (1.6.1 to 26.x). Bedrock reads splashes.json at the root of the pack:
// { "splashes": ["...", ...] }.

import type { Edition, TexturePackProject } from '../../../core/types';
import { BEDROCK_SPLASHES, JAVA_SPLASHES } from './catalog';

/** Longest splash the editor takes (the game draws long ones smaller and smaller). */
export const SPLASH_MAX = 120;
/** Splashes longer than this are drawn noticeably small on the title screen. */
export const SPLASH_LONG = 48;

export function splashPath(edition: Edition): string {
  return edition === 'java' ? JAVA_SPLASHES : BEDROCK_SPLASHES;
}

/** A splash as it can be stored: one line, no surrounding spaces, not too long. */
export function cleanSplash(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, SPLASH_MAX);
}

/** The texts of a splashes.txt (empty lines left out). */
export function parseJavaSplashes(text: string): string[] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);
}

export function javaSplashesText(list: readonly string[]): string {
  const lines = list.map(cleanSplash).filter(Boolean);
  return lines.length ? `${lines.join('\n')}\n` : '';
}

/** The texts of a Bedrock splashes.json (null: not readable). */
export function parseBedrockSplashes(text: string): string[] | null {
  try {
    const json = JSON.parse(text.replace(/^﻿/, '')) as unknown;
    const list = json && typeof json === 'object' && !Array.isArray(json) ? (json as { splashes?: unknown }).splashes : json;
    if (!Array.isArray(list)) return null;
    return list.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  } catch {
    return null;
  }
}

export function bedrockSplashesJson(list: readonly string[]): string {
  return `${JSON.stringify({ splashes: list.map(cleanSplash).filter(Boolean) }, null, 2)}\n`;
}

export function parseSplashes(edition: Edition, text: string): string[] {
  return edition === 'java' ? parseJavaSplashes(text) : (parseBedrockSplashes(text) ?? []);
}

export function splashesFile(edition: Edition, list: readonly string[]): string {
  return edition === 'java' ? javaSplashesText(list) : bedrockSplashesJson(list);
}

/** The pack's own splash texts, or null when the pack has none (the game's list shows). */
export async function packSplashes(project: Pick<TexturePackProject, 'edition' | 'extraFiles'>): Promise<string[] | null> {
  const blob = project.extraFiles[splashPath(project.edition)];
  if (!blob) return null;
  try {
    return parseSplashes(project.edition, await blob.text());
  } catch {
    return null;
  }
}

/** The file to store for a list (null: take the pack's file out, the game's own list shows again). */
export function splashesBlob(edition: Edition, list: readonly string[] | null): Blob | null {
  if (!list) return null;
  return new Blob([splashesFile(edition, list)], { type: edition === 'java' ? 'text/plain' : 'application/json' });
}

/** Adds texts to a list, skipping empty ones and ones already in it. Returns the new list and how many were added. */
export function addSplashes(list: readonly string[], texts: readonly string[]): { list: string[]; added: number } {
  const out = [...list];
  const seen = new Set(out.map((s) => s.toLowerCase()));
  let added = 0;
  for (const raw of texts) {
    const s = cleanSplash(raw);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    added++;
  }
  return { list: out, added };
}
