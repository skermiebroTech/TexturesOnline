// Text files of the generated pack besides the GLSL programs: lib/settings.glsl,
// shaders.properties, block/item/entity.properties, lang/en_US.lang and README.txt.

import type { Settings } from './options';
import { BLOCK_GROUPS, ENTITY_GROUPS, ITEM_GROUPS } from './blocks';
import {
  GAME_OPTIONS, MAIN_SCREEN, PROFILES, PROFILE_COMMENT, SCREENS, optionList, type GameOption, type ScreenId,
} from './game-options';

export interface PackMeta {
  name: string;
  description: string;
}

export const CREDIT = 'Made with TexturesOnline';
export const DEFAULT_PACK_NAME = 'TexturesOnline Shaders';

/** One line of plain text: no control characters, collapsed whitespace, limited length. */
function oneLine(s: unknown, max: number): string {
  const text = typeof s === 'string' ? s : '';
  const clean = text.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
  return [...clean].slice(0, max).join('').trim();
}

/** Text safe for .lang values (read with java.util.Properties by Iris, split on '=' by OptiFine). */
export function langText(s: unknown, max: number): string {
  return oneLine(s, max).replace(/[\\%]/g, '').replace(/\s+/g, ' ').replace(/^[#!\s]+/, '').trim();
}

/** ASCII-only text for comments in GLSL and .properties files (read as ISO-8859-1). */
export function asciiText(s: unknown, max: number): string {
  const decomposed = oneLine(s, max).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return decomposed.replace(/[^\x20-\x7e]/g, '').replace(/[\\*]/g, '').replace(/\s+/g, ' ').trim();
}

export function cleanMeta(meta: Partial<PackMeta> | null | undefined): PackMeta {
  const name = langText(meta?.name, 64) || DEFAULT_PACK_NAME;
  const description = langText(meta?.description, 240);
  return { name, description };
}

// ------------------------------------------------------------------ settings.glsl

const SECTION_OF: Record<ScreenId, string> = {
  LIGHTING: 'Lighting',
  SHADOWS: 'Shadows',
  SKY: 'Sky & fog',
  SKY_COLORS: 'Sky colors (red, green and blue, 0 to 1)',
  WATER: 'Water',
  WAVING: 'Waving plants',
  POST: 'Post-processing',
  COLOR: 'Color grading',
  PERFORMANCE: 'Performance',
};

function optionLine(opt: GameOption, s: Settings): string {
  if (opt.kind === 'bool') {
    return `${opt.value(s) ? '' : '//'}#define ${opt.name} // ${opt.comment}`;
  }
  const { value, list } = optionList(opt, s);
  const tail = `// [${list.join(' ')}]${opt.comment ? ' ' + opt.comment : ''}`;
  if (opt.form === 'const-int') return `const int ${opt.name} = ${value}; ${tail}`;
  if (opt.form === 'const-float') return `const float ${opt.name} = ${value}; ${tail}`;
  return `#define ${opt.name} ${value} ${tail}`;
}

export function buildSettingsGlsl(s: Settings, meta: PackMeta): string {
  const title = asciiText(meta.name, 64) || 'Shader pack';
  const out: string[] = [
    '// ============================================================================',
    `// ${title} - settings`,
    `// ${CREDIT}.`,
    '//',
    '// Every option of the pack lives in this file (so no option can have different',
    '// defaults in different files). The values below are the defaults chosen when the',
    '// pack was made; change them in game under Shader Options.',
    '//   Boolean on:  #define NAME             Boolean off: //#define NAME',
    '//   Value:       #define NAME <default> // [allowed values] description',
    '// ============================================================================',
    '',
  ];
  let section: ScreenId | null | undefined;
  for (const opt of GAME_OPTIONS) {
    if (opt.screen !== section) {
      section = opt.screen;
      out.push('', `// ---- ${section ? SECTION_OF[section] : 'Pack information'} ----`);
    }
    out.push(optionLine(opt, s));
  }
  out.push(
    '',
    '// ---- Fixed shadow settings ----',
    'const float shadowDistanceRenderMul = 1.0; // skip shadow casters beyond the shadow distance',
    'const bool shadowHardwareFiltering = true; // shadowtex0 compares depth in hardware (shadow2D)',
    '',
    '// ---- Boolean option references ----',
    '// A boolean #define only shows up as an option when an #ifdef for it is in the same',
    '// (include-expanded) file. These empty blocks make that true for every program.',
  );
  for (const opt of GAME_OPTIONS) if (opt.kind === 'bool') out.push(`#ifdef ${opt.name}`, '#endif');
  out.push('');
  return out.join('\n');
}

// ------------------------------------------------------------------ shaders.properties

export function buildShadersProperties(meta: PackMeta): string {
  const title = asciiText(meta.name, 64) || 'Shader pack';
  const sliders = GAME_OPTIONS.filter((o) => o.kind === 'value' && o.slider).map((o) => o.name);
  const lines: string[] = [
    `# ${title} - ${CREDIT}.`,
    '# Shader pack for Iris (Minecraft 1.16.5 and newer) and OptiFine (Minecraft 1.8.9 and newer).',
    '# This file is preprocessed: #if / #ifdef can use MC_VERSION, IS_IRIS and the pack options.',
    '',
    '# ---- Rendering switches ----',
    'oldLighting=false',
    'oldHandLight=false',
    'separateAo=false',
    'underwaterOverlay=false',
    'vignette=false',
    'sun=true',
    'moon=true',
    'beacon.beam.depth=true',
    'shadowTranslucent=false',
    '#ifdef HAND_LIGHT',
    'dynamicHandLight=false',
    '#endif',
    '',
    '# ---- Skip passes that are switched off ----',
    'program.shadow.enabled=SHADOWS',
    'program.composite1.enabled=BLOOM',
    '',
    '# ---- Quality profiles ----',
    ...PROFILES.map((p) => `profile.${p.id}=${p.items.join(' ')}`),
    '',
    '# ---- Option screens ----',
    `screen=${MAIN_SCREEN.join(' ')}`,
    'screen.columns=2',
  ];
  for (const sc of SCREENS) {
    lines.push(`screen.${sc.id}=${sc.items.join(' ')}`, `screen.${sc.id}.columns=${sc.columns}`);
  }
  lines.push('', '# ---- Options shown as sliders ----', `sliders=${sliders.join(' ')}`, '');
  return lines.join('\n');
}

// ------------------------------------------------------------------ block / item / entity .properties

const ns = (names: readonly string[]): string => names.map((n) => `minecraft:${n}`).join(' ');

export function buildBlockProperties(meta: PackMeta): string {
  const title = asciiText(meta.name, 64) || 'Shader pack';
  const lines: string[] = [
    `# ${title} - block IDs (${CREDIT}).`,
    '# mc_Entity.x in gbuffers_terrain, gbuffers_water and shadow; blockEntityId in gbuffers_block.',
    '# One line per ID: a repeated key replaces the earlier line. A block gets only one ID (the',
    '# first mapping wins). Unknown names are ignored. Never use ID 0.',
    ...BLOCK_GROUPS.map((g) => `#   ${g.id} = ${g.what}`),
    '',
    '#if MC_VERSION >= 11300',
    '',
  ];
  for (const g of BLOCK_GROUPS) {
    const line = (names: string[]): string => `block.${g.id}=${ns(names)}`;
    const variants: Array<{ cond: string | null; names: string[] }> = g.before12003
      ? [{ cond: 'MC_VERSION >= 12003', names: g.modern }, { cond: null, names: g.before12003 }]
      : [{ cond: null, names: g.modern }];
    const emit = (names: string[]): void => {
      if (g.tags?.length) {
        lines.push('#ifdef IRIS_TAG_SUPPORT', `${line(names)} ${g.tags.map((t) => `%minecraft:${t}`).join(' ')}`, '#else', line(names), '#endif');
      } else {
        lines.push(line(names));
      }
    };
    if (variants.length === 2) {
      lines.push(`#if ${variants[0].cond}`);
      emit(variants[0].names);
      lines.push('#else');
      emit(variants[1].names);
      lines.push('#endif');
    } else {
      emit(variants[0].names);
    }
  }
  lines.push('', '#else', '', '# Minecraft 1.8 - 1.12 names (OptiFine)');
  for (const g of BLOCK_GROUPS) lines.push(`block.${g.id}=${g.legacy.map((n) => `minecraft:${n}`).join(' ')}`);
  lines.push('', '#endif', '');
  return lines.join('\n');
}

export function buildItemProperties(): string {
  return [
    '# Item IDs -> heldItemId / heldItemId2. Used by the handheld light for glowing items that are',
    '# not light-emitting blocks (those are handled through heldBlockLightValue).',
    ...ITEM_GROUPS.map((g) => `# ${g.id} = ${g.what}`),
    ...ITEM_GROUPS.map((g) => `item.${g.id}=${ns(g.items)}`),
    '',
  ].join('\n');
}

export function buildEntityProperties(): string {
  return [
    '# Entity IDs -> entityId in gbuffers_entities.',
    ...ENTITY_GROUPS.map((g) => `# ${g.id} = ${g.what}`),
    ...ENTITY_GROUPS.map((g) => `entity.${g.id}=${ns(g.entities)}`),
    '',
  ].join('\n');
}

// ------------------------------------------------------------------ lang/en_US.lang

export function buildLang(s: Settings, meta: PackMeta): string {
  const lines: string[] = [
    `# ${langText(meta.name, 64)} - English names for the Shader Options screen. ${CREDIT}.`,
    '',
    ...PROFILES.map((p) => `profile.${p.id}=${p.label}`),
    `profile.comment=${PROFILE_COMMENT}`,
    '',
  ];
  for (const sc of SCREENS) lines.push(`screen.${sc.id}=${sc.label}`, `screen.${sc.id}.comment=${sc.comment}`);
  lines.push('');
  for (const opt of GAME_OPTIONS) {
    if (opt.name === 'PACK_INFO') {
      lines.push(`option.PACK_INFO=${meta.name}`);
      lines.push(`option.PACK_INFO.comment=${meta.description ? `${meta.description} ` : ''}${CREDIT}.`);
      lines.push(`value.PACK_INFO.0=${CREDIT}`);
      continue;
    }
    lines.push(`option.${opt.name}=${opt.label}`, `option.${opt.name}.comment=${opt.comment}`);
    if (opt.kind === 'value') {
      const { list } = optionList(opt, s);
      if (opt.valueLabels) {
        for (const v of list) {
          const label = opt.valueLabels(v, Number(v));
          if (label) lines.push(`value.${opt.name}.${v}=${label}`);
        }
      }
    }
  }
  lines.push('');
  return lines.join('\n');
}

// ------------------------------------------------------------------ README.txt

export function buildReadme(meta: PackMeta): string {
  const lines = [
    meta.name,
    '='.repeat(Math.min(Math.max([...meta.name].length, 8), 64)),
    ...(meta.description ? ['', meta.description] : []),
    '',
    `${CREDIT}.`,
    '',
    'WHAT YOU NEED',
    '- Iris Shaders (with Sodium) for Minecraft 1.16.5 or newer, including 26.x, or',
    '- OptiFine for Minecraft 1.8.9 up to the newest version it supports.',
    '',
    'HOW TO INSTALL',
    '1. Start Minecraft with Iris or OptiFine installed.',
    '2. Open Options > Video Settings > Shader Packs (Iris: you can also press O).',
    '3. Click "Open Shader Pack Folder" and put this .zip file in that folder.',
    '   Do not unzip it.',
    '4. Select the pack in the list and click Apply or Done.',
    '',
    'SETTINGS',
    '- Click "Shader Options" (Iris: "Shader Pack Settings") to change every setting in game.',
    '- The Profile button switches between Low, Medium, High and Ultra quality.',
    '- Settings you change in game are remembered for this file name. If you replace the',
    '  file with a new version and want its new defaults, press Reset in Shader Options.',
    '',
    'TROUBLESHOOTING',
    '- Low frame rate: choose the Low profile, or turn off Shadows (Shadows screen).',
    '- Minecraft 26.2 and newer: set Options > Video Settings > Graphics API to "Default"',
    '  or "Prefer OpenGL". Shader packs do not run with the Vulkan renderer.',
    '- Iris needs the Sodium version made for your Minecraft version.',
    '- Very dark nights or caves: raise Night Brightness (Lighting screen).',
    '',
  ];
  return lines.join('\n');
}
