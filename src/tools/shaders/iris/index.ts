// Iris / OptiFine shader pack maker: options, presets, preview mapping and the pack generator.
// Pure logic; safe to import in Node and workers.

export { OPTIONS, PRESETS, GROUPS, defaults, presetValues, normalizeOptions, readSettings, parseHexColor, toHexColor } from './options';
export type { Preset, Settings, Tonemap, EffectQuality, ShadowResolution } from './options';
export { generateIrisPack, irisPackFileName, zipIrisPack, SHADERS_DIR } from './generate';
export { toPreviewParams } from './preview';
export { IRIS_NOTES, IRIS_SUPPORT } from './notes';
export type { IrisNote } from './notes';
export { GAME_OPTIONS, SCREENS, PROFILES } from './game-options';
export type { GameOption } from './game-options';
export { IDS as IRIS_IDS } from './glsl-lib';
export { PROGRAMS as IRIS_PROGRAMS } from './glsl-programs';
