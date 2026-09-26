// Bedrock "shader maker": a Vibrant Visuals settings pack (lighting, sky, colour grading, water,
// shadows, fog) plus optional classic fog. Pure logic; safe to import in Node and workers.

export { OPTIONS, PRESETS, GROUPS, defaults, presetValues, normalizeOptions, readSettings } from './options';
export type { Preset, Settings, ToneMapper, WaterStyle } from './options';
export { generateBedrockVisuals, needsModernEngine, changesClassicFog, FORMAT, LIMITS } from './generate';
export type { GenerateOptions } from './generate';
export { toPreviewParams } from './preview';
export { BEDROCK_VV_NOTES, bedrockManifestOptions, bedrockCompatibilityNotes } from './notes';
export type { BedrockNote } from './notes';
export { validateBedrockVisuals } from './validate';
export { VANILLA_BASE_VERSION } from './vanilla';
