// "Vanilla Java" shader maker: a resource pack that patches the selected version's own core shaders
// (no mods). Pure logic; safe to import in Node and workers.

export { OPTIONS, PRESETS, GROUPS, OPTION_KEYS, defaults, presetValues, normalizeOptions, readSettings } from './options';
export type { Preset, Settings } from './options';
export { generateVanillaShaderFiles, vanillaPackDescription, GRADE_DENY } from './generate';
export type { VanillaShaderResult, VanillaVersionInfo } from './generate';
export { toPreviewParams } from './preview';
export {
  shaderSourcePrefixes, supportedFor, supportFromSources, detectFamily, missingSourcesMessage, END_OF_FRAME_FORMAT, NO_CORE_SHADERS_MESSAGE,
} from './support';
export type { VanillaSupport, Feature, Family, FamilyId } from './support';
export { gradeColor, vignetteFactor, colorMultiplier } from './color';
