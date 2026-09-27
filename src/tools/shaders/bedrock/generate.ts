import type { FileMap, OptionDef, OptionValue, OptionValues } from '../../../core/types';
import type { Curve, KeyframeObject, RGB } from './keyframes';
import {
  clamp, cleanRGB, isDay, isDusk, isNight, isZeroDelta, kfColor, kfNumber, mapCurve, rgbDelta,
  round6, shiftRGB, stringifyJson, tintMultiplier,
} from './keyframes';
import type { Settings } from './options';
import { DEFAULT_SETTINGS, OPTIONS, WATER_STYLES, normalizeOptions, readSettings } from './options';
import { METADATA_FILE, packMetadataJson } from '../import/metadata';
import type { BlendStops, DistanceFog, FogMedium, VanillaAtmospherics, VanillaColorGrading, VanillaFog, VanillaLighting } from './vanilla';
import {
  VANILLA_ATMOSPHERICS, VANILLA_COLOR_GRADING, VANILLA_FOGS, VANILLA_LIGHTING, VANILLA_WATER,
  VOLUMETRIC_HEIGHT, WATER_TRANSITION,
} from './vanilla';

/** format_version per file family (research: bedrock-visuals §0.5). */
export const FORMAT = {
  lighting: '1.21.80',
  lightingKeyframedAmbient: '1.26.0',
  atmospherics: '1.21.40',
  colorGrading: '1.21.90',
  water: '1.21.120',
  waterBiomeColor: '1.26.0',
  shadows: '1.21.80',
  localLighting: '1.21.120',
} as const;

/** Documented value limits (Microsoft Learn deferred-rendering reference). */
export const LIMITS = {
  illuminance: 110000,
  orbitalOffset: 359.99,
  ambient: 5,
  skyIntensity: [0.1, 1],
  rayleigh: 11,
  sunMie: 60,
  moonMie: 20,
  glare: 50,
  contrast: 4,
  gain: 10,
  gamma: 4,
  saturation: 10,
  temperature: [1000, 15000],
  cdom: 15,
  chlorophyll: 10,
  sediment: 300,
  fogDensity: 1,
  hg: 0.95,
} as const;

const NIGHT_AMBIENT_BOOST = 0.3;
const SHADOWS_MAX = 0.6;
const HIGHLIGHTS_MIN = 1.6;
const SPLIT_TONE_STRENGTH = 0.5;
const TINT_STRENGTH = 0.6;

export interface GenerateOptions {
  /** Write every fog definition, even ones that match vanilla (default: only changed fogs). */
  includeUnchangedFogs?: boolean;
  /** Add README.txt with install notes and the chosen settings (default true). */
  readme?: boolean;
  /** Add texturepackmaker.json so the Shader Maker can open the pack again (default true). */
  metadata?: boolean;
  /** Game version and starting preset recorded in texturepackmaker.json */
  version?: string;
  preset?: string;
}

/** True when the pack needs Minecraft 26.0+ features (keyframed ambient light, biome water colours). */
export function needsModernEngine(s: Settings): boolean {
  return s.nightBrightness > 0 || s.biomeWaterColor > 0;
}

/** True when the classic (every graphics mode) fog differs from vanilla. */
export function changesClassicFog(s: Settings): boolean {
  return s.classicFog && (s.fogDistance !== DEFAULT_SETTINGS.fogDistance || s.underwaterVisibility !== DEFAULT_SETTINGS.underwaterVisibility);
}

/**
 * Builds the Vibrant Visuals settings files (resource pack relative paths). One file per vanilla
 * identifier, keeping the `minecraft:` identifiers so every biome picks up the changes. The
 * manifest is added by the caller (see bedrockManifestOptions).
 */
export function generateBedrockVisuals(v: OptionValues, opts: GenerateOptions = {}): FileMap {
  const s = readSettings(v);
  const files: FileMap = {};
  const lightingFormat = s.nightBrightness > 0 ? FORMAT.lightingKeyframedAmbient : FORMAT.lighting;

  for (const base of VANILLA_LIGHTING) files[`lighting/${base.file}`] = stringifyJson(buildLighting(base, s, lightingFormat));
  for (const base of VANILLA_ATMOSPHERICS) files[`atmospherics/${base.file}`] = stringifyJson(buildAtmospherics(base, s));
  for (const base of VANILLA_COLOR_GRADING) files[`color_grading/${base.file}`] = stringifyJson(buildColorGrading(base, s));
  files[`water/${VANILLA_WATER.file}`] = stringifyJson(buildWater(s));
  files['shadows/global.json'] = stringifyJson(buildShadows(s));
  if (s.coloredLights) files['local_lighting/local_lighting.json'] = stringifyJson(buildLocalLighting(s));

  for (const base of VANILLA_FOGS) {
    const obj = buildFog(base, s);
    if (opts.includeUnchangedFogs || stringifyJson(obj) !== stringifyJson(buildFog(base, DEFAULT_SETTINGS))) {
      files[`fogs/${base.file}`] = stringifyJson(obj);
    }
  }

  if (opts.readme !== false) files['README.txt'] = buildReadme(v, s);
  if (opts.metadata !== false) {
    files[METADATA_FILE] = packMetadataJson({ target: 'bedrock-vibrant', version: opts.version, settings: normalizeOptions(v), preset: opts.preset });
  }
  return files;
}

// ---------------------------------------------------------------- lighting

function buildLighting(base: VanillaLighting, s: Settings, format: string): object {
  const overworld = base.dimension === 'overworld';
  const d = DEFAULT_SETTINGS;
  const dayShift = rgbDelta(s.daylightColor, d.daylightColor);
  const duskShift = rgbDelta(s.sunsetColor, d.sunsetColor);
  const moonShift = rgbDelta(s.moonColor, d.moonColor);

  let sunIll: Curve<number> = base.sunIlluminance;
  let sunCol: Curve<RGB> = base.sunColor;
  let moonIll: Curve<number> = base.moonIlluminance;
  let moonCol: Curve<RGB> = base.moonColor;
  if (overworld) {
    sunIll = mapCurve(sunIll, (x) => clamp(x * s.sunBrightness, 0, LIMITS.illuminance));
    sunCol = mapCurve(sunCol, (c, t) => (isDay(t) ? shiftRGB(c, dayShift) : isDusk(t) ? shiftRGB(c, duskShift) : c));
    moonIll = mapCurve(moonIll, (x) => clamp(x * s.moonBrightness, 0, LIMITS.illuminance));
    moonCol = mapCurve(moonCol, (c) => shiftRGB(c, moonShift));
  }

  const ambient = clamp(base.ambient.illuminance * s.caveLight, 0, LIMITS.ambient);
  let ambientValue: number | KeyframeObject<number> = round6(ambient);
  if (format === FORMAT.lightingKeyframedAmbient && overworld && s.nightBrightness > 0) {
    const night = clamp(ambient + s.nightBrightness * NIGHT_AMBIENT_BOOST, 0, LIMITS.ambient);
    ambientValue = kfNumber([[0, ambient], [0.25, ambient], [0.3, night], [0.7, night], [0.75, ambient], [1, ambient]]);
  }

  return {
    format_version: format,
    'minecraft:lighting_settings': {
      description: { identifier: base.id },
      directional_lights: {
        orbital: {
          sun: { illuminance: kfNumber(sunIll), color: kfColor(sunCol) },
          moon: { illuminance: kfNumber(moonIll), color: kfColor(moonCol) },
          orbital_offset_degrees: round6(clamp(s.sunTilt, 0, LIMITS.orbitalOffset)),
        },
        flash: { illuminance: round6(base.flash.illuminance), color: cleanRGB(base.flash.color) },
      },
      emissive: { desaturation: round6(clamp(1 - s.glowColor + base.emissiveDesaturation, 0, 1)) },
      ambient: { illuminance: ambientValue, color: cleanRGB(base.ambient.color) },
      sky: { intensity: round6(clamp(base.skyIntensity * s.shadowFill, LIMITS.skyIntensity[0], LIMITS.skyIntensity[1])) },
    },
  };
}

// ---------------------------------------------------------------- atmospherics

function blendValue(v: number | Curve<number>, max: number): number | KeyframeObject<number> {
  return typeof v === 'number' ? round6(clamp(v, 0, max)) : kfNumber(mapCurve(v, (x) => clamp(x, 0, max)));
}

function buildAtmospherics(base: VanillaAtmospherics, s: Settings): object {
  const overworld = base.dimension === 'overworld';
  const d = DEFAULT_SETTINGS;
  let zenith = base.zenith;
  let horizon = base.horizon;
  let rayleigh = base.rayleigh;
  let sunMie = base.sunMie;

  if (overworld) {
    const sky = rgbDelta(s.skyColor, d.skyColor);
    const hor = rgbDelta(s.horizonColor, d.horizonColor);
    const night = rgbDelta(s.nightSkyColor, d.nightSkyColor);
    const dusk = rgbDelta(s.sunsetColor, d.sunsetColor);
    zenith = mapCurve(zenith, (c, t) => (isDay(t) ? shiftRGB(c, sky) : isNight(t) ? shiftRGB(c, night) : c));
    horizon = mapCurve(horizon, (c, t) =>
      isDay(t) ? shiftRGB(c, hor) : isDusk(t) ? shiftRGB(c, dusk, 0.5) : isNight(t) ? shiftRGB(c, night, 0.5) : c,
    );
    rayleigh = mapCurve(rayleigh, (x) => clamp(x * s.skyDensity, 0, LIMITS.rayleigh));
    sunMie = mapCurve(sunMie, (x) => clamp(x * s.sunsetGlow, 0, LIMITS.sunMie));
  }

  const b: BlendStops = base.blend;
  return {
    format_version: FORMAT.atmospherics,
    'minecraft:atmosphere_settings': {
      description: { identifier: base.id },
      horizon_blend_stops: {
        min: blendValue(b.min, 1),
        start: blendValue(b.start, 1),
        mie_start: blendValue(b.mie_start, 1.2),
        max: blendValue(b.max, 1),
      },
      // The End's vanilla rayleigh (50) is above the documented limit and is kept as shipped.
      rayleigh_strength: kfNumber(rayleigh),
      sun_mie_strength: kfNumber(mapCurve(sunMie, (x) => clamp(x, 0, LIMITS.sunMie))),
      moon_mie_strength: kfNumber(mapCurve(base.moonMie, (x) => clamp(x, 0, LIMITS.moonMie))),
      sun_glare_shape: kfNumber(mapCurve(base.glare, (x) => clamp(x, 0, LIMITS.glare))),
      sky_zenith_color: kfColor(zenith),
      sky_horizon_color: kfColor(horizon),
    },
  };
}

// ---------------------------------------------------------------- colour grading

/** Kelvin after a warmth shift in mired space (+ = warmer = lower Kelvin with "color_temperature"). */
export function shiftTemperature(kelvin: number, warmth: number): number {
  const mired = 1e6 / kelvin + warmth;
  const k = mired <= 1e6 / LIMITS.temperature[1] ? LIMITS.temperature[1] : 1e6 / mired;
  return Math.round(clamp(k, LIMITS.temperature[0], LIMITS.temperature[1]));
}

const vec3 = (x: number, max: number, min = 0): [number, number, number] => {
  const r = round6(clamp(x, min, max));
  return [r, r, r];
};

function buildColorGrading(base: VanillaColorGrading, s: Settings): object {
  const d = DEFAULT_SETTINGS;
  const contrast = base.contrast * (s.contrast / d.contrast);
  const saturation = base.saturation * (s.saturation / d.saturation);
  const tint = tintMultiplier(s.tint, TINT_STRENGTH);
  const gain = tint.map((m) => round6(clamp(base.gain * s.brightness * m, 0, LIMITS.gain))) as [number, number, number];

  const grade = (mul: RGB | null) => ({
    contrast: vec3(contrast, LIMITS.contrast),
    gain: mul ? (gain.map((g, i) => round6(clamp(g * mul[i], 0, LIMITS.gain))) as [number, number, number]) : gain,
    gamma: vec3(base.gamma, LIMITS.gamma),
    offset: vec3(base.offset, 1, -1),
    saturation: vec3(saturation, LIMITS.saturation),
  });

  const colorGrading: Record<string, unknown> = { midtones: grade(null) };
  if (s.splitTone) {
    colorGrading.highlights = { enabled: true, highlightsMin: HIGHLIGHTS_MIN, ...grade(tintMultiplier(s.highlightTint, SPLIT_TONE_STRENGTH)) };
    colorGrading.shadows = { enabled: true, shadowsMax: SHADOWS_MAX, ...grade(tintMultiplier(s.shadowTint, SPLIT_TONE_STRENGTH)) };
  }
  colorGrading.temperature = {
    enabled: true,
    temperature: shiftTemperature(base.temperature, s.warmth),
    type: 'color_temperature',
  };

  return {
    format_version: FORMAT.colorGrading,
    'minecraft:color_grading_settings': {
      description: { identifier: base.id },
      color_grading: colorGrading,
      // Operators cannot blend between biomes, so every file carries the same one.
      tone_mapping: { operator: s.toneMapper },
    },
  };
}

// ---------------------------------------------------------------- water, shadows, local lights

function buildWater(s: Settings): object {
  const style = WATER_STYLES[s.waterStyle];
  const w = VANILLA_WATER.waves;
  const c = VANILLA_WATER.caustics;
  const modern = s.biomeWaterColor > 0;
  const settings: Record<string, unknown> = {
    description: { identifier: VANILLA_WATER.id },
    particle_concentrations: {
      chlorophyll: round6(clamp(VANILLA_WATER.particles.chlorophyll + style.chlorophyll, 0, LIMITS.chlorophyll)),
      suspended_sediment: round6(clamp(VANILLA_WATER.particles.suspended_sediment + style.suspended_sediment, 0, LIMITS.sediment)),
      cdom: round6(clamp(VANILLA_WATER.particles.cdom + style.cdom, 0, LIMITS.cdom)),
    },
    caustics: {
      enabled: s.caustics,
      frame_length: c.frame_length,
      scale: c.scale,
      power: Math.round(clamp(s.causticsStrength, 1, 6)),
    },
    // direction_increment and sampleWidth are left to the engine, as in vanilla.
    waves: {
      enabled: s.waves,
      frequency: w.frequency,
      octaves: w.octaves,
      depth: round6(clamp(s.waveHeight, 0, 3)),
      speed: round6(clamp(s.waveSpeed, 0.01, 10)),
      shape: w.shape,
      pull: w.pull,
      mix: w.mix,
      frequency_scaling: w.frequency_scaling,
      speed_scaling: w.speed_scaling,
    },
  };
  if (modern) settings.biome_water_color_contribution = round6(clamp(s.biomeWaterColor, 0, 1));
  return {
    format_version: modern ? FORMAT.waterBiomeColor : FORMAT.water,
    'minecraft:water_settings': settings,
  };
}

function buildShadows(s: Settings): object {
  return {
    format_version: FORMAT.shadows,
    'minecraft:shadow_settings': {
      shadow_style: s.blockyShadows ? 'blocky_shadows' : 'soft_shadows',
      texel_size: Math.round(clamp(s.shadowTexel, 1, 1024)),
    },
  };
}

type LightType = 'static_light' | 'point_light';
interface BlockLight { block: string; color: RGB; type: LightType; torch?: boolean }

const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Blocks the game treats as point lights keep that type (Microsoft's default colours);
// everything else gets a static coloured light.
export const BLOCK_LIGHTS: readonly BlockLight[] = [
  { block: 'minecraft:torch', color: hex('#EFE39D'), type: 'point_light', torch: true },
  { block: 'minecraft:candle', color: hex('#EFE39D'), type: 'point_light', torch: true },
  { block: 'minecraft:lantern', color: hex('#CE8133'), type: 'point_light', torch: true },
  { block: 'minecraft:campfire', color: hex('#F0A050'), type: 'static_light', torch: true },
  { block: 'minecraft:fire', color: hex('#F0A050'), type: 'static_light', torch: true },
  { block: 'minecraft:soul_torch', color: hex('#00FFFF'), type: 'point_light' },
  { block: 'minecraft:soul_lantern', color: hex('#00FFFF'), type: 'point_light' },
  { block: 'minecraft:soul_campfire', color: hex('#2FD6DC'), type: 'static_light' },
  { block: 'minecraft:soul_fire', color: hex('#2FD6DC'), type: 'static_light' },
  { block: 'minecraft:redstone_torch', color: hex('#FF0000'), type: 'point_light' },
  { block: 'minecraft:end_rod', color: hex('#FFFFFF'), type: 'point_light' },
  { block: 'minecraft:sea_pickle', color: hex('#FFFFFF'), type: 'point_light' },
  { block: 'minecraft:copper_torch', color: hex('#B8EF8D'), type: 'point_light' },
  { block: 'minecraft:copper_lantern', color: hex('#B8EF8D'), type: 'point_light' },
  { block: 'minecraft:glowstone', color: hex('#FFD27A'), type: 'static_light' },
  { block: 'minecraft:sea_lantern', color: hex('#CFEAF0'), type: 'static_light' },
  { block: 'minecraft:shroomlight', color: hex('#FF9A4D'), type: 'static_light' },
  { block: 'minecraft:lit_pumpkin', color: hex('#F5B041'), type: 'static_light' },
  { block: 'minecraft:lit_redstone_lamp', color: hex('#FFC070'), type: 'static_light' },
  { block: 'minecraft:ochre_froglight', color: hex('#F7E3A0'), type: 'static_light' },
  { block: 'minecraft:verdant_froglight', color: hex('#C9F0C0'), type: 'static_light' },
  { block: 'minecraft:pearlescent_froglight', color: hex('#F0D2E6'), type: 'static_light' },
  { block: 'minecraft:beacon', color: hex('#9FF5EC'), type: 'static_light' },
  { block: 'minecraft:conduit', color: hex('#A8EFFF'), type: 'static_light' },
  { block: 'minecraft:glow_lichen', color: hex('#A8C8A0'), type: 'static_light' },
  { block: 'minecraft:crying_obsidian', color: hex('#8A3CE0'), type: 'static_light' },
  { block: 'minecraft:respawn_anchor', color: hex('#FF9F4A'), type: 'static_light' },
  { block: 'minecraft:amethyst_cluster', color: hex('#B07CFF'), type: 'static_light' },
  { block: 'minecraft:portal', color: hex('#9A4DFF'), type: 'static_light' },
  { block: 'minecraft:lit_furnace', color: hex('#FFB347'), type: 'static_light' },
  { block: 'minecraft:lit_smoker', color: hex('#FFB347'), type: 'static_light' },
  { block: 'minecraft:lit_blast_furnace', color: hex('#FFB347'), type: 'static_light' },
  // Colours are reused where possible: fewer distinct light colours render faster.
  { block: 'minecraft:lava', color: hex('#FF7A2E'), type: 'static_light' },
  { block: 'minecraft:flowing_lava', color: hex('#FF7A2E'), type: 'static_light' },
  { block: 'minecraft:lava_cauldron', color: hex('#FF7A2E'), type: 'static_light' },
  { block: 'minecraft:magma', color: hex('#FF7A2E'), type: 'static_light' },
  { block: 'minecraft:lit_redstone_ore', color: hex('#FF0000'), type: 'static_light' },
  { block: 'minecraft:lit_deepslate_redstone_ore', color: hex('#FF0000'), type: 'static_light' },
  ...['', 'exposed_', 'weathered_', 'oxidized_'].flatMap((age) => ['', 'waxed_'].map((wax): BlockLight =>
    ({ block: `minecraft:${wax}${age}copper_bulb`, color: hex('#FFB347'), type: 'static_light' }))),
  { block: 'minecraft:cave_vines_body_with_berries', color: hex('#F5B041'), type: 'static_light' },
  { block: 'minecraft:cave_vines_head_with_berries', color: hex('#F5B041'), type: 'static_light' },
  { block: 'minecraft:large_amethyst_bud', color: hex('#B07CFF'), type: 'static_light' },
  { block: 'minecraft:medium_amethyst_bud', color: hex('#B07CFF'), type: 'static_light' },
  { block: 'minecraft:small_amethyst_bud', color: hex('#B07CFF'), type: 'static_light' },
  { block: 'minecraft:end_portal', color: hex('#9FF5EC'), type: 'static_light' },
  { block: 'minecraft:end_gateway', color: hex('#9FF5EC'), type: 'static_light' },
  { block: 'minecraft:enchanting_table', color: hex('#9FF5EC'), type: 'static_light' },
  { block: 'minecraft:sculk_catalyst', color: hex('#2FD6DC'), type: 'static_light' },
  { block: 'minecraft:ender_chest', color: hex('#2FD6DC'), type: 'static_light' },
  { block: 'minecraft:firefly_bush', color: hex('#C9F0C0'), type: 'static_light' },
];

function buildLocalLighting(s: Settings): object {
  const shift = rgbDelta(s.torchColor, DEFAULT_SETTINGS.torchColor);
  const settings: Record<string, { light_color: RGB; light_type: LightType }> = {};
  for (const l of BLOCK_LIGHTS) {
    settings[l.block] = { light_color: l.torch && !isZeroDelta(shift) ? shiftRGB(l.color, shift) : cleanRGB(l.color), light_type: l.type };
  }
  return { format_version: FORMAT.localLighting, 'minecraft:local_light_settings': settings };
}

// ---------------------------------------------------------------- fogs

function distanceObject(f: DistanceFog): Record<string, unknown> {
  const o: Record<string, unknown> = {
    fog_start: round6(f.fog_start),
    fog_end: round6(f.fog_end),
    fog_color: f.fog_color,
    render_distance_type: f.render_distance_type,
  };
  if (f.transition) {
    o.transition_fog = {
      init_fog: {
        fog_start: WATER_TRANSITION.init_start,
        fog_end: WATER_TRANSITION.init_end,
        fog_color: f.fog_color,
        render_distance_type: 'fixed',
      },
      min_percent: WATER_TRANSITION.min_percent,
      mid_seconds: WATER_TRANSITION.mid_seconds,
      mid_percent: WATER_TRANSITION.mid_percent,
      max_seconds: WATER_TRANSITION.max_seconds,
    };
  }
  return o;
}

function adjustDistance(medium: FogMedium, f: DistanceFog, s: Settings): DistanceFog {
  if (!s.classicFog) return f;
  if (medium === 'air' || medium === 'weather') {
    const k = s.fogDistance;
    const render = f.render_distance_type === 'render';
    // Render-type distances are fractions of the render distance; keep a small ramp so the
    // fog never has zero width.
    const gap = render ? 0.01 : 0.5;
    const end = clamp(f.fog_end * k, 0, render ? 1 : Infinity);
    const start = Math.max(0, Math.min(f.fog_start * k, end - gap));
    return { ...f, fog_start: start, fog_end: end };
  }
  if (medium === 'water') {
    const end = Math.max(f.fog_start, f.fog_end * s.underwaterVisibility);
    return { ...f, fog_end: end };
  }
  return f;
}

function buildFog(base: VanillaFog, s: Settings): object {
  const distance: Record<string, unknown> = {};
  for (const [medium, f] of Object.entries(base.distance) as [FogMedium, DistanceFog][]) {
    distance[medium] = distanceObject(adjustDistance(medium, f, s));
  }
  const settings: Record<string, unknown> = { description: { identifier: base.id }, distance };
  if (base.volumetric) {
    const v = base.volumetric;
    const scattering = round6(clamp(v.scattering, 0, 1));
    settings.volumetric = {
      density: {
        air: {
          max_density: round6(clamp(v.density * s.fogAmount, 0, LIMITS.fogDensity)),
          zero_density_height: VOLUMETRIC_HEIGHT,
          max_density_height: VOLUMETRIC_HEIGHT,
        },
      },
      media_coefficients: {
        air: {
          scattering: [scattering, scattering, scattering],
          absorption: v.absorption.map((x) => round6(clamp(x, 0, 1))),
        },
      },
      henyey_greenstein_g: {
        air: { henyey_greenstein_g: round6(s.lightShafts === 0 ? v.g : clamp(v.g + s.lightShafts, -LIMITS.hg, LIMITS.hg)) },
      },
    };
  }
  return { format_version: base.format, 'minecraft:fog_settings': settings };
}

// ---------------------------------------------------------------- readme

function describeValue(value: OptionValue, def: OptionDef): string {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (def.type === 'select') return def.options?.find((o) => o.value === value)?.label ?? String(value);
  if (typeof value === 'number') return `${round6(value)}${def.unit ?? ''}`;
  return String(value);
}

function buildReadme(v: OptionValues, s: Settings): string {
  const clean = normalizeOptions(v);
  const changed = OPTIONS.filter((o) => (!o.dependsOn || clean[o.dependsOn] === true) && clean[o.key] !== o.default);
  const lines = [
    'Vibrant Visuals settings pack',
    '=============================',
    '',
    'How to use',
    '1. Open the .mcpack file to import it into Minecraft Bedrock Edition.',
    '2. Settings > Global Resources: activate this pack. Any other active pack must also support',
    '   Vibrant Visuals, otherwise the game falls back to Fancy graphics.',
    '3. Settings > Video > Graphics Mode: choose Vibrant Visuals.',
    '',
    'Vibrant Visuals needs a supported device: Windows PCs, Xbox and PlayStation consoles, and',
    'newer phones and tablets.',
    needsModernEngine(s) ? 'This pack uses features that need Minecraft 26.0 or newer.' : 'Works with Minecraft 1.21.120 or newer.',
    changesClassicFog(s) ? 'Distance and underwater fog changes also apply in the Simple and Fancy graphics modes.' : '',
    '',
    changed.length ? 'Settings changed from vanilla:' : 'All settings are at their vanilla values.',
    ...changed.map((o) => `- ${o.group} / ${o.label}: ${describeValue(clean[o.key], o)}`),
    '',
  ];
  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}
