// Structural validation of a generated Vibrant Visuals pack (research: bedrock-visuals §10.3).
// Returns human-readable problems; an empty list means the files look valid.

import type { FileMap } from '../../../core/types';
import { LIMITS } from './generate';
import { TONE_MAPPERS } from './options';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const FORMATS: Record<string, readonly string[]> = {
  lighting: ['1.21.80', '1.26.0'],
  atmospherics: ['1.21.40', '1.26.20'],
  color_grading: ['1.21.90'],
  water: ['1.21.120', '1.26.0', '1.26.20'],
  shadows: ['1.21.80'],
  local_lighting: ['1.21.120'],
  fogs: ['1.16.100', '1.21.0', '1.21.90', '1.26.20'],
};

const ROOTS: Record<string, string> = {
  lighting: 'minecraft:lighting_settings',
  atmospherics: 'minecraft:atmosphere_settings',
  color_grading: 'minecraft:color_grading_settings',
  water: 'minecraft:water_settings',
  shadows: 'minecraft:shadow_settings',
  local_lighting: 'minecraft:local_light_settings',
  fogs: 'minecraft:fog_settings',
};

/** Vanilla values that exceed the documented limits and are kept unchanged. */
const VANILLA_EXCEPTIONS: Record<string, { field: string; value: number }> = {
  'minecraft:end_atmospherics': { field: 'rayleigh_strength', value: 50 },
};

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

function versionAtLeast(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

class Checker {
  readonly problems: string[] = [];
  constructor(private readonly file: string) {}

  fail(path: string, msg: string): void {
    this.problems.push(`${this.file}: ${path ? path + ' ' : ''}${msg}`);
  }

  num(path: string, v: unknown, min: number, max: number, opts: { int?: boolean } = {}): void {
    if (typeof v !== 'number' || !Number.isFinite(v)) return this.fail(path, `must be a number (got ${JSON.stringify(v)})`);
    if (opts.int && !Number.isInteger(v)) this.fail(path, `must be a whole number (got ${v})`);
    if (v < min || v > max) this.fail(path, `is ${v}, outside ${min}..${max}`);
  }

  bool(path: string, v: unknown): void {
    if (typeof v !== 'boolean') this.fail(path, 'must be true or false');
  }

  color(path: string, v: unknown): void {
    if (typeof v === 'string') {
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) this.fail(path, `is not a #RRGGBB colour (${v})`);
      return;
    }
    if (!Array.isArray(v) || v.length !== 3) return this.fail(path, 'must be an RGB array of 3 values or #RRGGBB');
    v.forEach((c, i) => this.num(`${path}[${i}]`, c, 0, 255, { int: true }));
  }

  unitColor(path: string, v: unknown): void {
    if (typeof v === 'string') return this.color(path, v);
    if (!Array.isArray(v) || v.length !== 3) return this.fail(path, 'must be 3 values 0..1');
    v.forEach((c, i) => this.num(`${path}[${i}]`, c, 0, 1));
  }

  vec3(path: string, v: unknown, min: number, max: number): void {
    if (!Array.isArray(v) || v.length !== 3) return this.fail(path, 'must be an array of 3 numbers');
    v.forEach((c, i) => this.num(`${path}[${i}]`, c, min, max));
  }

  /** Plain value or keyframe object {"0.0": v, ..., "1.0": v}. */
  keyframed(path: string, v: unknown, each: (p: string, x: unknown) => void, allowKeyframes = true): void {
    if (!isObj(v)) return each(path, v);
    if (!allowKeyframes) return this.fail(path, 'cannot be keyframed with this format_version');
    const keys = Object.keys(v);
    if (keys.length < 2) this.fail(path, 'needs at least two keyframes');
    const times = keys.map(Number);
    keys.forEach((k, i) => {
      if (!/^\d(\.\d{1,6})?$/.test(k) || !(times[i] >= 0 && times[i] <= 1)) this.fail(path, `has invalid keyframe key "${k}"`);
      each(`${path}["${k}"]`, v[k]);
    });
    if (!times.includes(0)) this.fail(path, 'is missing the "0.0" keyframe');
    if (!times.includes(1)) this.fail(path, 'is missing the "1.0" keyframe');
    if (new Set(times).size !== times.length) this.fail(path, 'has duplicate keyframe times');
  }

  obj(path: string, v: unknown): Obj {
    if (!isObj(v)) {
      this.fail(path, 'must be an object');
      return {};
    }
    return v;
  }
}

interface Shared {
  toneMapping: Set<string>;
  orbitalOffset: Set<string>;
  identifiers: Map<string, string>;
}

function checkLighting(c: Checker, fmt: string, root: Obj, sh: Shared): void {
  const modern = versionAtLeast(fmt, '1.26.0');
  const dl = c.obj('directional_lights', root.directional_lights);
  const orbital = c.obj('directional_lights.orbital', dl.orbital);
  for (const body of ['sun', 'moon']) {
    const b = c.obj(`orbital.${body}`, orbital[body]);
    c.keyframed(`${body}.illuminance`, b.illuminance, (p, x) => c.num(p, x, 0, LIMITS.illuminance));
    c.keyframed(`${body}.color`, b.color, (p, x) => c.color(p, x));
  }
  c.keyframed('orbital_offset_degrees', orbital.orbital_offset_degrees, (p, x) => c.num(p, x, 0, LIMITS.orbitalOffset));
  sh.orbitalOffset.add(JSON.stringify(orbital.orbital_offset_degrees));
  const flash = c.obj('flash', dl.flash);
  c.num('flash.illuminance', flash.illuminance, 0, LIMITS.illuminance);
  c.color('flash.color', flash.color);
  c.num('emissive.desaturation', c.obj('emissive', root.emissive).desaturation, 0, 1);
  const amb = c.obj('ambient', root.ambient);
  c.keyframed('ambient.illuminance', amb.illuminance, (p, x) => c.num(p, x, 0, LIMITS.ambient), modern);
  c.keyframed('ambient.color', amb.color, (p, x) => c.color(p, x), modern);
  const sky = c.obj('sky', root.sky);
  c.keyframed('sky.intensity', sky.intensity, (p, x) => c.num(p, x, LIMITS.skyIntensity[0], LIMITS.skyIntensity[1]), modern);
}

function checkAtmospherics(c: Checker, root: Obj, id: string): void {
  const stops = c.obj('horizon_blend_stops', root.horizon_blend_stops);
  for (const [k, max] of [['min', 1], ['start', 1], ['mie_start', 1.2], ['max', 1]] as const) {
    c.keyframed(`horizon_blend_stops.${k}`, stops[k], (p, x) => c.num(p, x, 0, max));
  }
  const exception = VANILLA_EXCEPTIONS[id];
  const scalar = (field: string, max: number) =>
    c.keyframed(field, root[field], (p, x) => {
      if (exception && exception.field === field && x === exception.value) return;
      c.num(p, x, 0, max);
    });
  scalar('rayleigh_strength', LIMITS.rayleigh);
  scalar('sun_mie_strength', LIMITS.sunMie);
  scalar('moon_mie_strength', LIMITS.moonMie);
  scalar('sun_glare_shape', LIMITS.glare);
  c.keyframed('sky_zenith_color', root.sky_zenith_color, (p, x) => c.color(p, x));
  c.keyframed('sky_horizon_color', root.sky_horizon_color, (p, x) => c.color(p, x));
}

function checkGrade(c: Checker, path: string, g: Obj): void {
  c.vec3(`${path}.contrast`, g.contrast, 0, LIMITS.contrast);
  c.vec3(`${path}.gain`, g.gain, 0, LIMITS.gain);
  c.vec3(`${path}.gamma`, g.gamma, 0, LIMITS.gamma);
  c.vec3(`${path}.offset`, g.offset, -1, 1);
  c.vec3(`${path}.saturation`, g.saturation, 0, LIMITS.saturation);
}

function checkColorGrading(c: Checker, root: Obj, sh: Shared): void {
  const cg = c.obj('color_grading', root.color_grading);
  checkGrade(c, 'midtones', c.obj('midtones', cg.midtones));
  let shadowsMax: number | undefined;
  let highlightsMin: number | undefined;
  if (cg.highlights !== undefined) {
    const h = c.obj('highlights', cg.highlights);
    c.bool('highlights.enabled', h.enabled);
    checkGrade(c, 'highlights', h);
    c.num('highlights.highlightsMin', h.highlightsMin, 1, 4);
    highlightsMin = h.highlightsMin as number;
  }
  if (cg.shadows !== undefined) {
    const s = c.obj('shadows', cg.shadows);
    c.bool('shadows.enabled', s.enabled);
    checkGrade(c, 'shadows', s);
    c.num('shadows.shadowsMax', s.shadowsMax, 0.1, 1);
    shadowsMax = s.shadowsMax as number;
  }
  if (shadowsMax !== undefined && shadowsMax === highlightsMin) c.fail('shadows.shadowsMax', 'must differ from highlightsMin');
  const t = c.obj('temperature', cg.temperature);
  c.bool('temperature.enabled', t.enabled);
  c.num('temperature.temperature', t.temperature, LIMITS.temperature[0], LIMITS.temperature[1]);
  if (t.type !== 'color_temperature' && t.type !== 'white_balance') c.fail('temperature.type', 'must be color_temperature or white_balance');
  const op = c.obj('tone_mapping', root.tone_mapping).operator;
  if (typeof op !== 'string' || !(TONE_MAPPERS as readonly string[]).includes(op)) c.fail('tone_mapping.operator', `is not a known operator (${String(op)})`);
  sh.toneMapping.add(String(op));
}

function checkWater(c: Checker, fmt: string, root: Obj): void {
  const pc = c.obj('particle_concentrations', root.particle_concentrations);
  c.num('particle_concentrations.cdom', pc.cdom, 0, LIMITS.cdom);
  c.num('particle_concentrations.chlorophyll', pc.chlorophyll, 0, LIMITS.chlorophyll);
  c.num('particle_concentrations.suspended_sediment', pc.suspended_sediment, 0, LIMITS.sediment);
  const ca = c.obj('caustics', root.caustics);
  c.bool('caustics.enabled', ca.enabled);
  c.num('caustics.frame_length', ca.frame_length, 0.01, 5);
  c.num('caustics.power', ca.power, 1, 6, { int: true });
  c.num('caustics.scale', ca.scale, 0.1, 5);
  const w = c.obj('waves', root.waves);
  c.bool('waves.enabled', w.enabled);
  c.num('waves.depth', w.depth, 0, 3);
  c.num('waves.frequency', w.frequency, 0.01, 3);
  c.num('waves.frequency_scaling', w.frequency_scaling, 0, 2);
  c.num('waves.mix', w.mix, 0, 1);
  c.num('waves.octaves', w.octaves, 1, 30, { int: true });
  c.num('waves.pull', w.pull, -1, 1);
  c.num('waves.shape', w.shape, 1, 10);
  c.num('waves.speed', w.speed, 0.01, 10);
  c.num('waves.speed_scaling', w.speed_scaling, 0, 2);
  if (w.direction_increment !== undefined) c.num('waves.direction_increment', w.direction_increment, 0, 360);
  if (w.sampleWidth !== undefined) c.num('waves.sampleWidth', w.sampleWidth, 0.01, 1);
  if (root.biome_water_color_contribution !== undefined) {
    c.num('biome_water_color_contribution', root.biome_water_color_contribution, 0, 1);
    if (!versionAtLeast(fmt, '1.26.0')) c.fail('biome_water_color_contribution', 'needs format_version 1.26.0 or newer');
  }
}

function checkDistance(c: Checker, path: string, d: Obj): void {
  c.num(`${path}.fog_start`, d.fog_start, 0, Infinity);
  c.num(`${path}.fog_end`, d.fog_end, typeof d.fog_start === 'number' ? d.fog_start : 0, Infinity);
  c.color(`${path}.fog_color`, d.fog_color);
  if (d.render_distance_type !== 'fixed' && d.render_distance_type !== 'render') c.fail(`${path}.render_distance_type`, 'must be fixed or render');
  if (d.render_distance_type === 'render') {
    c.num(`${path}.fog_start`, d.fog_start, 0, 1);
    c.num(`${path}.fog_end`, d.fog_end, 0, 1);
  }
}

function checkFog(c: Checker, fmt: string, root: Obj): void {
  if (root.distance !== undefined) {
    const dist = c.obj('distance', root.distance);
    for (const [medium, value] of Object.entries(dist)) {
      if (!['air', 'weather', 'water', 'lava', 'lava_resistance', 'powder_snow'].includes(medium)) c.fail(`distance.${medium}`, 'is not a fog medium');
      const d = c.obj(`distance.${medium}`, value);
      checkDistance(c, `distance.${medium}`, d);
      if (d.transition_fog !== undefined) {
        if (medium !== 'water') c.fail(`distance.${medium}.transition_fog`, 'is only valid for water');
        const t = c.obj('transition_fog', d.transition_fog);
        checkDistance(c, `distance.${medium}.transition_fog.init_fog`, c.obj('init_fog', t.init_fog));
        c.num('transition_fog.min_percent', t.min_percent, 0, 1);
        c.num('transition_fog.mid_percent', t.mid_percent, 0, 1);
        c.num('transition_fog.mid_seconds', t.mid_seconds, 0, Infinity);
        c.num('transition_fog.max_seconds', t.max_seconds, 0, Infinity);
      }
    }
  }
  if (root.volumetric !== undefined) {
    const kfOk = versionAtLeast(fmt, '1.26.20');
    const vol = c.obj('volumetric', root.volumetric);
    if (vol.density !== undefined) {
      for (const [medium, value] of Object.entries(c.obj('volumetric.density', vol.density))) {
        const d = c.obj(`density.${medium}`, value);
        c.keyframed(`density.${medium}.max_density`, d.max_density, (p, x) => c.num(p, x, 0, 1), kfOk);
        for (const h of ['zero_density_height', 'max_density_height']) {
          if (d[h] !== undefined) c.keyframed(`density.${medium}.${h}`, d[h], (p, x) => c.num(p, x, -Infinity, Infinity), kfOk);
        }
      }
    }
    if (vol.media_coefficients !== undefined) {
      for (const [medium, value] of Object.entries(c.obj('volumetric.media_coefficients', vol.media_coefficients))) {
        const m = c.obj(`media_coefficients.${medium}`, value);
        for (const k of ['scattering', 'absorption']) {
          if (m[k] !== undefined) c.keyframed(`media_coefficients.${medium}.${k}`, m[k], (p, x) => c.unitColor(p, x), kfOk);
        }
      }
    }
    if (vol.henyey_greenstein_g !== undefined) {
      if (!versionAtLeast(fmt, '1.21.90')) c.fail('volumetric.henyey_greenstein_g', 'needs format_version 1.21.90 or newer');
      for (const [medium, value] of Object.entries(c.obj('volumetric.henyey_greenstein_g', vol.henyey_greenstein_g))) {
        const g = c.obj(`henyey_greenstein_g.${medium}`, value);
        c.keyframed(`henyey_greenstein_g.${medium}`, g.henyey_greenstein_g, (p, x) => c.num(p, x, -1, 1), kfOk);
      }
    }
  }
}

function checkLocalLighting(c: Checker, root: Obj): void {
  for (const [block, value] of Object.entries(root)) {
    if (!/^[a-z0-9_.-]+:[a-z0-9_.-]+$/.test(block)) c.fail(block, 'is not a namespaced block id');
    const l = c.obj(block, value);
    if (l.light_color !== undefined) c.color(`${block}.light_color`, l.light_color);
    if (l.light_type !== 'static_light' && l.light_type !== 'point_light') c.fail(`${block}.light_type`, 'must be static_light or point_light');
  }
}

const MIN_PBR_ENGINE = '1.21.120';

/** manifest.json of a Vibrant Visuals pack: `pbr` capability and a new enough engine (research §2.1, §10.3). */
function checkManifest(c: Checker, d: Obj, newestFormat: { version: string; path: string } | null): void {
  if (d.format_version !== 2 && d.format_version !== 3) c.fail('format_version', 'must be 2 (or 3)');
  const header = c.obj('header', d.header);
  const raw = header.min_engine_version;
  const engine = Array.isArray(raw) && raw.length === 3 && raw.every((x) => typeof x === 'number')
    ? raw.join('.')
    : typeof raw === 'string' && /^\d+\.\d+\.\d+$/.test(raw) ? raw : null;
  if (!engine) c.fail('header.min_engine_version', 'must be a version like [1, 21, 120]');
  else {
    if (!versionAtLeast(engine, MIN_PBR_ENGINE)) c.fail('header.min_engine_version', `is ${engine}; Vibrant Visuals packs need ${MIN_PBR_ENGINE} or newer`);
    if (newestFormat && !versionAtLeast(engine, newestFormat.version)) {
      c.fail('header.min_engine_version', `is ${engine}, older than format_version ${newestFormat.version} used by ${newestFormat.path}`);
    }
  }
  const caps = d.capabilities;
  if (!Array.isArray(caps) || !caps.includes('pbr')) c.fail('capabilities', 'must include "pbr", otherwise Vibrant Visuals stays off');
  const modules = d.modules;
  if (!Array.isArray(modules) || !modules.some((m) => isObj(m) && m.type === 'resources')) c.fail('modules', 'needs a "resources" module');
}

export function validateBedrockVisuals(files: FileMap): string[] {
  const problems: string[] = [];
  const shared: Shared = { toneMapping: new Set(), orbitalOffset: new Set(), identifiers: new Map() };
  const decoder = new TextDecoder();
  let manifest: { path: string; doc: unknown } | null = null;
  let newestFormat: { version: string; path: string } | null = null;

  const parse = (path: string, content: FileMap[string]): { ok: true; doc: unknown } | { ok: false } => {
    if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
      problems.push(`${path}: cannot validate binary Blob content`);
      return { ok: false };
    }
    try {
      return { ok: true, doc: JSON.parse(typeof content === 'string' ? content : decoder.decode(content)) };
    } catch (e) {
      problems.push(`${path}: invalid JSON (${(e as Error).message})`);
      return { ok: false };
    }
  };

  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith('.json')) continue;
    if (path === 'manifest.json') {
      const r = parse(path, content);
      if (r.ok) manifest = { path, doc: r.doc };
      continue;
    }
    const folder = path.split('/')[0];
    // Other pack content (textures, texture sets, ...) is not a Vibrant Visuals settings file.
    if (!(folder in ROOTS)) continue;
    const c = new Checker(path);
    const r = parse(path, content);
    if (!r.ok) continue;
    const d = c.obj('', r.doc);
    const fmt = d.format_version;
    if (typeof fmt !== 'string' || !FORMATS[folder].includes(fmt)) c.fail('format_version', `is ${JSON.stringify(fmt)}, expected one of ${FORMATS[folder].join(', ')}`);
    else if (!newestFormat || !versionAtLeast(newestFormat.version, fmt)) newestFormat = { version: fmt, path };
    const root = c.obj(ROOTS[folder], d[ROOTS[folder]]);
    const format = typeof fmt === 'string' ? fmt : '0';

    let id = '';
    if (folder !== 'shadows' && folder !== 'local_lighting') {
      const ident = c.obj('description', root.description).identifier;
      if (typeof ident !== 'string' || !/^[a-z0-9_.-]+:[a-z0-9_.-]+$/.test(ident)) c.fail('description.identifier', 'must be a namespaced identifier');
      else {
        id = ident;
        const key = `${folder}|${ident}`;
        const prev = shared.identifiers.get(key);
        if (prev) c.fail('description.identifier', `duplicates ${prev}`);
        shared.identifiers.set(key, path);
      }
    }

    switch (folder) {
      case 'lighting': checkLighting(c, format, root, shared); break;
      case 'atmospherics': checkAtmospherics(c, root, id); break;
      case 'color_grading': checkColorGrading(c, root, shared); break;
      case 'water': checkWater(c, format, root); break;
      case 'shadows': {
        if (root.shadow_style !== 'blocky_shadows' && root.shadow_style !== 'soft_shadows') c.fail('shadow_style', 'must be blocky_shadows or soft_shadows');
        c.num('texel_size', root.texel_size, 1, 1024, { int: true });
        break;
      }
      case 'local_lighting': checkLocalLighting(c, root); break;
      case 'fogs': checkFog(c, format, root); break;
    }
    problems.push(...c.problems);
  }

  if (manifest) {
    const c = new Checker(manifest.path);
    checkManifest(c, c.obj('', manifest.doc), newestFormat);
    problems.push(...c.problems);
  }
  if (shared.toneMapping.size > 1) problems.push(`color_grading: tone mapping differs between files (${[...shared.toneMapping].join(', ')})`);
  if (shared.orbitalOffset.size > 1) problems.push('lighting: orbital_offset_degrees differs between files');
  return problems;
}
