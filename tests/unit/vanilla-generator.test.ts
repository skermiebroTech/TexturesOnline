/**
 * Vanilla shader generator logic on small hand-written shader sets (no game files needed):
 * options, presets, preview mapping, text primitives, family detection, anchors failing closed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPTIONS, PRESETS, GROUPS, defaults, presetValues, normalizeOptions, readSettings, toPreviewParams,
  generateVanillaShaderFiles, supportedFor, supportFromSources, detectFamily, shaderSourcePrefixes,
  gradeColor, vignetteFactor, vanillaPackDescription, GRADE_DENY,
} from '../../src/tools/shaders/vanilla/index';
import { countMain, glslFloat, maskComments, renameMain, wrapFunction, expandForAnalysis, fragmentOutputs } from '../../src/tools/shaders/vanilla/glsl';
import { FOG_SIGNATURES, addProgramUniform } from '../../src/tools/shaders/vanilla/generate';
import { ENV_FOG_FULL_END, ENV_FOG_PROTECT_END, environmentFogScale, tintMultiplier, whiteBalance } from '../../src/tools/shaders/vanilla/color';
import { WAVE_CONDITION, gradeFunction } from '../../src/tools/shaders/vanilla/templates';
import type { OptionValues } from '../../src/core/types';
import { compileGL, findGlslang, injectDefines, mojPreprocess, missingVaryings } from '../tools/vanilla/glsl';

const S = 'assets/minecraft/shaders/';
const CORE = `${S}core/`;
const INC = `${S}include/`;
const pf = (major: number) => ({ major, minor: 0 });

// ---------------------------------------------------------------- synthetic shader sets (written for these tests)

const FOG_V1 = `#version 150

vec4 linear_fog(vec4 inColor, float vertexDistance, float fogStart, float fogEnd, vec4 fogColor) {
    if (vertexDistance <= fogStart) {
        return inColor;
    }
    float t = vertexDistance < fogEnd ? smoothstep(fogStart, fogEnd, vertexDistance) : 1.0;
    return vec4(mix(inColor.rgb, fogColor.rgb, t * fogColor.a), inColor.a);
}

float linear_fog_fade(float vertexDistance, float fogStart, float fogEnd) {
    if (vertexDistance <= fogStart) {
        return 1.0;
    }
    return vertexDistance >= fogEnd ? 0.0 : smoothstep(fogEnd, fogStart, vertexDistance);
}
`;

const WORLD_VSH = (imp: string) => `#version 150

${imp}

in vec3 Position;
in vec4 Color;
in vec3 Normal;

uniform mat4 ModelViewMat;
uniform mat4 ProjMat;

out float vertexDistance;
out vec4 vertexColor;

void main() {
    gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);
    vertexDistance = length((ModelViewMat * vec4(Position, 1.0)).xyz);
    vertexColor = Color;
}
`;

const WORLD_FSH = (imp: string) => `#version 150

${imp}

uniform vec4 FogColor;
uniform float FogStart;
uniform float FogEnd;

in float vertexDistance;
in vec4 vertexColor;

out vec4 fragColor;

void main() {
    vec4 color = vertexColor;
    if (color.a < 0.1) {
        discard;
    }
    fragColor = linear_fog(color, vertexDistance, FogStart, FogEnd, FogColor);
}
`;

const GUI_VSH = `#version 150
in vec3 Position;
uniform mat4 ModelViewMat;
uniform mat4 ProjMat;
void main() {
    gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);
}
`;
const GUI_FSH = `#version 150
uniform vec4 ColorModulator;
out vec4 fragColor;
void main() {
    fragColor = ColorModulator;
}
`;

const program = (name: string, uniforms: string[]) =>
  JSON.stringify({ vertex: name, fragment: name, samplers: [], uniforms: uniforms.map((n) => ({ name: n, type: 'float', count: 1, values: [0.0] })) }, null, 4);

/** 1.17-style set: program JSON, plain uniforms, #moj_import <x.glsl>. */
function f1Sources(): Record<string, string> {
  const imp = '#moj_import <fog.glsl>';
  return {
    [`${INC}fog.glsl`]: FOG_V1,
    [`${CORE}rendertype_solid.json`]: program('rendertype_solid', ['ModelViewMat', 'ProjMat', 'FogStart', 'FogEnd', 'FogColor']),
    [`${CORE}rendertype_solid.vsh`]: WORLD_VSH(imp),
    [`${CORE}rendertype_solid.fsh`]: WORLD_FSH(imp),
    [`${CORE}rendertype_cutout.json`]: program('rendertype_cutout', ['ModelViewMat', 'ProjMat', 'FogStart', 'FogEnd', 'FogColor']),
    [`${CORE}rendertype_cutout.vsh`]: WORLD_VSH(imp),
    [`${CORE}rendertype_cutout.fsh`]: WORLD_FSH(imp),
    [`${CORE}gui.json`]: program('gui', ['ModelViewMat', 'ProjMat', 'ColorModulator']),
    [`${CORE}gui.vsh`]: GUI_VSH,
    [`${CORE}gui.fsh`]: GUI_FSH,
    'assets/minecraft/shaders/post/blur.json': '{"targets":[],"passes":[]}',
  };
}

/** 26.3-style set: #include, explicit locations, UBO fog with the v2 API. */
function f6Sources(): Record<string, string> {
  const head = '#version 330\n#extension GL_ARB_separate_shader_objects : require\n';
  return {
    [`${INC}fog.glsl`]: `#ifndef MINECRAFT_FOG_GLSL
#define MINECRAFT_FOG_GLSL
layout(std140) uniform Fog {
    vec4 FogColor;
    float FogEnvironmentalStart;
    float FogEnvironmentalEnd;
    float FogRenderDistanceStart;
    float FogRenderDistanceEnd;
};
float total_fog_value(float sph, float cyl, float envStart, float envEnd, float rdStart, float rdEnd) {
    return max(clamp((sph - envStart) / (envEnd - envStart), 0.0, 1.0), clamp((cyl - rdStart) / (rdEnd - rdStart), 0.0, 1.0));
}
vec4 apply_fog(vec4 inColor, float sph, float cyl, float envStart, float envEnd, float rdStart, float rdEnd, vec4 fogColor) {
    return vec4(mix(inColor.rgb, fogColor.rgb, total_fog_value(sph, cyl, envStart, envEnd, rdStart, rdEnd) * fogColor.a), inColor.a);
}
#endif
`,
    [`${CORE}terrain.vsh`]: `${head}#include <minecraft:fog.glsl>
layout(location = 0) in vec3 Position;
layout(location = 0) out float sph;
void main() {
    gl_Position = vec4(Position, 1.0);
    sph = length(Position);
}
`,
    [`${CORE}terrain.fsh`]: `${head}#include <minecraft:fog.glsl>
layout(location = 0) in float sph;
layout(location = 0) out vec4 fragColor;
void main() {
    fragColor = apply_fog(vec4(1.0), sph, sph, FogEnvironmentalStart, FogEnvironmentalEnd, FogRenderDistanceStart, FogRenderDistanceEnd, FogColor);
}
`,
    [`${CORE}lightmap.fsh`]: `${head}layout(location = 0) in vec2 texCoord;
layout(location = 0) out vec4 fragColor;
void main() {
    fragColor = vec4(texCoord, 0.5, 1.0);
}
`,
    [`${CORE}screenquad.vsh`]: `${head}layout(location = 0) out vec2 texCoord;
void main() {
    vec2 uv = vec2((gl_VertexIndex << 1) & 2, gl_VertexIndex & 2);
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
    texCoord = uv;
}
`,
    [`${S}post/blit.fsh`]: `${head}uniform sampler2D InSampler;
layout(std140) uniform BlitConfig {
    vec4 ColorModulate;
};
layout(location = 0) in vec2 texCoord;
layout(location = 0) out vec4 fragColor;
void main() {
    fragColor = texture(InSampler, texCoord) * ColorModulate;
}
`,
  };
}

const ALL_ON: OptionValues = {
  ...defaults(), contrast: 1.2, saturation: 1.1, vibrance: 0.2, gamma: 1.1, temperature: 0.3, tintStrength: 0.2, tintColor: '#ffaa88',
  grayscale: 0.1, sepia: 0.1, posterize: 8, vignette: 0.5, bloom: true, waving: true, fogStart: 0.5, fogEnvironment: 0.8,
  fogTint: '#ccddff', fogTintStrength: 0.5, nightDarkness: 0.4,
};

const textOf = (files: Record<string, unknown>, k: string): string => {
  const v = files[k];
  assert.equal(typeof v, 'string', `${k} missing`);
  return v as string;
};

// ---------------------------------------------------------------- options & presets

test('options are well formed', () => {
  const keys = new Set<string>();
  const groups = new Set(Object.values(GROUPS));
  for (const o of OPTIONS) {
    assert.ok(!keys.has(o.key), `duplicate ${o.key}`);
    keys.add(o.key);
    assert.ok(groups.has(o.group as never), `${o.key} has unknown group`);
    assert.ok(o.label && o.description, `${o.key} needs a label and description`);
    if (o.type === 'range') {
      assert.ok(typeof o.min === 'number' && typeof o.max === 'number' && o.min < o.max, o.key);
      assert.ok((o.default as number) >= o.min! && (o.default as number) <= o.max!, `${o.key} default out of range`);
    }
    if (o.type === 'color') assert.match(o.default as string, /^#[0-9a-f]{6}$/);
    if (o.dependsOn) assert.equal(OPTIONS.find((x) => x.key === o.dependsOn)?.type, 'toggle', `${o.key} depends on a non-toggle`);
  }
  for (const k of ['brightness', 'contrast', 'saturation', 'vibrance', 'gamma', 'temperature', 'tintColor', 'tintStrength', 'grayscale',
    'sepia', 'posterize', 'vignette', 'bloom', 'waving', 'waveAmount', 'waveSpeed', 'fogStart', 'fogEnvironment', 'fogTint', 'fogTintStrength']) {
    assert.ok(keys.has(k), `missing option ${k}`);
  }
  assert.deepEqual(normalizeOptions(defaults()), defaults());
});

test('presets use known options with valid values', () => {
  const ids = PRESETS.map((p) => p.id);
  assert.deepEqual(ids, ['default', 'cinematic', 'vivid', 'soft', 'noir', 'retro', 'warm-sunset', 'cool-winter']);
  assert.deepEqual(PRESETS[0].values, {});
  for (const p of PRESETS) {
    for (const k of Object.keys(p.values)) assert.ok(OPTIONS.some((o) => o.key === k), `${p.id}: unknown option ${k}`);
    const v = presetValues(p.id);
    assert.deepEqual(normalizeOptions(v), v, `${p.id} has out-of-range values`);
    for (const c of p.swatch) assert.match(c, /^#[0-9a-f]{6}$/);
    assert.ok(p.label && p.description);
  }
});

test('option values are validated', () => {
  const s = readSettings({ contrast: 99, saturation: 'abc', tintColor: 'nope', posterize: 1.4, bloom: 'true' } as unknown as OptionValues);
  assert.equal(s.contrast, 1.8);
  assert.equal(s.saturation, 1);
  assert.deepEqual(s.tintColor, [255, 255, 255]);
  assert.equal(s.posterize, 0);
  assert.equal(s.bloom, true);
  assert.equal(readSettings({ posterize: 6.6 }).posterize, 7);
  assert.equal(normalizeOptions({ fogTint: '#ABC' }).fogTint, '#aabbcc');
});

// ---------------------------------------------------------------- preview mapping

test('default preview is neutral', () => {
  const p = toPreviewParams(defaults());
  assert.equal(p.exposure, 1);
  assert.equal(p.contrast, 1);
  assert.equal(p.saturation, 1);
  assert.equal(p.gamma, 1);
  assert.equal(p.temperature, 0);
  assert.deepEqual(p.tint, [1, 1, 1]);
  assert.equal(p.vignette, 0);
  assert.equal(p.bloom, 0);
  assert.equal(p.waving, 0);
  assert.equal(p.grayscale, 0);
  assert.equal(p.sepia, 0);
  assert.equal(p.posterize, 0);
  assert.equal(p.shadowStrength, 0);
  assert.equal(p.godrays, 0);
  for (const c of [[0, 0, 0], [0.2, 0.5, 0.9], [1, 1, 1]] as [number, number, number][]) {
    assert.deepEqual(gradeColor(c, readSettings(defaults())), c);
  }
});

// The preview's final pass (src/shared/preview/glsl.ts FINAL_FRAG at noon, without bloom and dither):
// exposure × white balance × tint multiply linear light, then ACES + sRGB, then the display-space grade.
const aces = (x: number) => Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
const toSrgb = (c: number) => {
  const x = Math.min(1, Math.max(0, c));
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
};
const previewDisplay = (lin: number) => toSrgb(aces(lin * 0.72));
/** Scene light that the preview shows as display value d (inverse of previewDisplay). */
function previewLinear(d: number): number {
  let lo = 0;
  let hi = 64;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (previewDisplay(mid) < d) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function previewGrade(c: [number, number, number], p: ReturnType<typeof toPreviewParams>): [number, number, number] {
  const luma = (x: number[]) => x[0] * 0.2126 + x[1] * 0.7152 + x[2] * 0.0722;
  const t = p.temperature;
  const wb = [1 + 0.16 * t, 1 + 0.02 * t, 1 - 0.2 * t];
  const l0 = luma(wb);
  let x = c.map((v, i) => previewDisplay(previewLinear(v) * p.exposure * (wb[i] / l0) * p.tint[i]));
  x = x.map((v) => (v - 0.5) * p.contrast + 0.5);
  let l = luma(x);
  x = x.map((v) => Math.min(1, Math.max(0, l + (v - l) * p.saturation)));
  x = x.map((v) => Math.pow(v, 1 / p.gamma));
  l = luma(x);
  x = x.map((v) => v + (l - v) * p.grayscale);
  const sep = [
    Math.min(1, x[0] * 0.393 + x[1] * 0.769 + x[2] * 0.189),
    Math.min(1, x[0] * 0.349 + x[1] * 0.686 + x[2] * 0.168),
    Math.min(1, x[0] * 0.272 + x[1] * 0.534 + x[2] * 0.131),
  ];
  x = x.map((v, i) => v + (sep[i] - v) * p.sepia);
  if (p.posterize >= 2) x = x.map((v) => Math.floor(v * (p.posterize - 1) + 0.5) / (p.posterize - 1));
  return x.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

test('preview parameters follow the generated GLSL math', () => {
  assert.deepEqual(whiteBalance(0), [1, 1, 1].map((x) => x / (0.2126 + 0.7152 + 0.0722)));
  // midtones, where the preview's filmic curve is matched by PREVIEW_LIGHT_GAMMA
  const samples: [number, number, number][] = [[0.35, 0.45, 0.55], [0.6, 0.5, 0.35], [0.4, 0.55, 0.45], [0.55, 0.55, 0.5]];
  let worst = 0;
  for (const preset of PRESETS) {
    const v = presetValues(preset.id);
    const s = readSettings(v);
    const p = toPreviewParams(v);
    for (const c of samples) {
      const a = gradeColor(c, s);
      const b = previewGrade(c, p);
      // vibrance is approximated by a saturation offset in the preview
      const tol = s.vibrance === 0 ? 0.03 : 0.08;
      // posterize can flip a level at a rounding boundary
      const levelTol = s.posterize ? 1 / (s.posterize - 1) + 1e-6 : 0;
      for (let i = 0; i < 3; i++) {
        const d = Math.abs(a[i] - b[i]);
        if (!s.posterize && !s.vibrance) worst = Math.max(worst, d);
        assert.ok(d <= Math.max(tol, levelTol), `${preset.id} ${c}: ${a} vs ${b}`);
      }
    }
    assert.equal(p.vignette, s.vignette);
  }
  assert.ok(worst > 0 && worst < 0.03, `worst midtone difference ${worst}`);
  // A warm tint must look about as warm in the preview as in the game (display-space ratio R/B).
  const warm = { ...defaults(), temperature: 0.6 };
  const g = gradeColor([0.5, 0.5, 0.5], readSettings(warm));
  const pv = previewGrade([0.5, 0.5, 0.5], toPreviewParams(warm));
  assert.ok(Math.abs(g[0] / g[2] - pv[0] / pv[2]) < 0.06, `game ${g} vs preview ${pv}`);
  // same lens vignette as the preview: smoothstep(1.05, 0.25, r * 1.25) mixed by strength
  assert.equal(vignetteFactor([0, 0], 1), 1);
  assert.ok(Math.abs(vignetteFactor([0, 0.5], 1) - 0.546814) < 1e-5); // smoothstep(1.05, 0.25, 0.625)
  assert.equal(vignetteFactor([0.89, 0.5], 0.5), 0.5);
});

// ---------------------------------------------------------------- review regressions

test('low saturation with negative vibrance never inverts colours', () => {
  const s = readSettings({ ...defaults(), saturation: 0, vibrance: -1 });
  for (const c of [[0.9, 0.2, 0.1], [0.1, 0.8, 0.3], [0.5, 0.45, 0.4]] as [number, number, number][]) {
    const g = gradeColor(c, s);
    const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    // factor clamped at 0: fully grey, never pushed past grey to the complementary colour
    for (const x of g) assert.ok(Math.abs(x - l) < 1e-9, `${c} -> ${g}`);
  }
  assert.match(gradeFunction(s), /c = mix\(vec3\(txo_l\), c, max\(0\.0 \+ -1\.0 \* \(1\.0 - txo_s\), 0\.0\)\);/);
});

test('tint colours only change the hue: black and grey are neutral, dark picks act like bright ones', () => {
  assert.deepEqual(tintMultiplier([0, 0, 0], 1), [1, 1, 1]);
  assert.deepEqual(tintMultiplier([128, 128, 128], 1), [1, 1, 1]);
  assert.deepEqual(tintMultiplier([0, 0, 128], 0.7), tintMultiplier([0, 0, 255], 0.7));
  assert.deepEqual(tintMultiplier([60, 40, 20], 0.5), tintMultiplier([255, 170, 85], 0.5));
  const black = generateVanillaShaderFiles(f6Sources(), { ...defaults(), tintColor: '#000000', tintStrength: 1, fogTint: '#000000', fogTintStrength: 1 },
    { versionId: '26.3', packFormat: pf(97) });
  assert.deepEqual(black.files, {}, 'a black tint must not turn the world black');
  // presets keep their look: their tint colours are already at full brightness
  const warm = readSettings(presetValues('warm-sunset'));
  const c = [0xff / 255, 0xb0 / 255, 0x70 / 255];
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const m = tintMultiplier(warm.tintColor, warm.tintStrength);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(m[i] - (1 + (c[i] / l - 1) * 0.2)) < 1e-12);
});

test('waving only picks biome-tinted plants, never redstone wire or grey blocks', () => {
  type Rgb = { r: number; g: number; b: number };
  const cond = new Function('Color', 'Normal', 'gl_VertexID', 'abs', `return ${WAVE_CONDITION};`) as
    (c: Rgb, n: { y: number }, id: number, abs: (x: number) => number) => boolean;
  const hex = (h: string, shade = 1): Rgb => ({ r: (parseInt(h.slice(1, 3), 16) / 255) * shade, g: (parseInt(h.slice(3, 5), 16) / 255) * shade, b: (parseInt(h.slice(5, 7), 16) / 255) * shade });
  const top = (c: Rgb) => cond(c, { y: 0 }, 4, Math.abs) && cond(c, { y: 0 }, 7, Math.abs);
  // grass / foliage colours of plains, savanna, badlands, swamp, jungle, snowy plains, dark forest, cherry grove, pale garden;
  // melon / pumpkin stems at age 0 and 7; with vertex shade and ambient occlusion down to 40 %
  for (const c of ['#91bd59', '#bfb755', '#90814d', '#6a7039', '#4c763c', '#59c93c', '#80b497', '#507a32', '#b6db61', '#48b518', '#9e814d', '#00ff00', '#e0c71c']) {
    for (const shade of [1, 0.8, 0.4]) assert.ok(top(hex(c, shade)), `${c} x${shade} should wave`);
  }
  // the pale garden's grey-green grass is close to grey; cross models have no ambient occlusion,
  // so their vertex shade stays at 0.8 or more
  for (const shade of [1, 0.8]) assert.ok(top(hex('#778272', shade)), `pale garden x${shade} should wave`);
  // redstone wire at every power level (RedStoneWireBlock colours), untinted grey blocks
  for (let power = 0; power <= 15; power++) {
    const f = power / 15;
    const rgb = { r: f * 0.6 + (f > 0 ? 0.4 : 0.3), g: Math.min(1, Math.max(0, f * f * 0.7 - 0.5)), b: Math.min(1, Math.max(0, f * f * 0.6 - 0.7)) };
    assert.ok(!top(rgb), `redstone at power ${power} must not wave`);
  }
  for (const grey of [1, 0.7, 0.3]) assert.ok(!top({ r: grey, g: grey, b: grey }));
  // bottom corners and horizontal faces stay put
  assert.ok(!cond(hex('#91bd59'), { y: 0 }, 5, Math.abs));
  assert.ok(!cond(hex('#91bd59'), { y: 1 }, 4, Math.abs));
});

test('water & weather fog distance leaves Blindness, Darkness, lava and powder snow alone', () => {
  assert.equal(ENV_FOG_PROTECT_END, 16);
  assert.equal(ENV_FOG_FULL_END, 32);
  // 26.3 FogEnvironment ends: lava 1, powder snow 2, blindness 5, lava + fire resistance 5, darkness 15
  for (const end of [1, 2, 5, 15]) for (const k of [0.25, 3]) assert.equal(environmentFogScale(end, k), 1);
  // water 96 (x water vision >= 0.25), rain >= 96, clear weather 1024
  for (const end of [32, 96, 768, 1024]) assert.equal(environmentFogScale(end, 3), 3);
  const mid = environmentFogScale(24, 3);
  assert.ok(mid > 1 && mid < 3);
  // continuous and monotonic through the fade, so effects fading in or out do not pop
  let prev = 0;
  for (let e = 0; e <= 40; e += 0.25) {
    const d = e * environmentFogScale(e, 3);
    assert.ok(d >= prev - 1e-9, `fog end must not jump back at ${e}`);
    prev = d;
  }
});

test('supportedFor places old releases and weekly snapshots', () => {
  assert.equal(supportedFor('1.5.2').supported, false);
  assert.equal(supportedFor('1.0').supported, false);
  assert.equal(supportedFor('20w51a').supported, false);
  assert.equal(supportedFor('21w08b').supported, false);
  assert.equal(supportedFor('15w14a').supported, false);
  const s17 = supportedFor('21w10a');
  assert.equal(s17.supported, true);
  assert.equal(s17.known, false);
  assert.equal(s17.family, 'F1');
  assert.equal(s17.features.bloom, false);
  assert.equal(supportedFor('24w45a').family, 'F2');
  assert.equal(supportedFor('25w03a').features.waving, false);
  assert.equal(supportedFor('24w14potato').supported, true);
  assert.equal(supportedFor('25w45a').features.bloom, false);
});

// ---------------------------------------------------------------- text primitives

test('glsl float literals always have a decimal point', () => {
  assert.equal(glslFloat(1), '1.0');
  assert.equal(glslFloat(0), '0.0');
  assert.equal(glslFloat(-0), '0.0');
  assert.equal(glslFloat(1e-9), '0.0');
  assert.equal(glslFloat(0.25), '0.25');
  assert.equal(glslFloat(-2.5), '-2.5');
  assert.equal(glslFloat(1 / 3), '0.333333');
  assert.throws(() => glslFloat(NaN));
});

test('main() is renamed only when there is exactly one', () => {
  const one = '#version 150\n// void main() in a comment\nvoid main() {\n}\n';
  assert.equal(countMain(one), 1);
  assert.equal(renameMain(one), '#version 150\n// void main() in a comment\nvoid txo_vanilla_main() {\n}\n');
  assert.equal(renameMain('void main(void) {}'), 'void txo_vanilla_main() {}');
  assert.equal(renameMain('void main() {}\nvoid main() {}'), null);
  assert.equal(renameMain('void notmain() {}'), null);
  assert.equal(maskComments('a /* b\nc */ d // e').length, 'a /* b\nc */ d // e'.length);
  assert.deepEqual(fragmentOutputs('out vec4 fragColor;\n// out vec4 other;\nlayout(location = 0) out vec4 x;'), ['fragColor', 'x']);
});

test('function wrapping keeps vanilla code and fails closed', () => {
  const r = wrapFunction(FOG_V1, 'linear_fog', FOG_SIGNATURES.linear_fog, (n) => [n[0], n[1], `${n[2]} * 0.5`, n[3], n[4]]);
  assert.equal(typeof r, 'object');
  if (typeof r === 'object') {
    assert.match(r.code, /vec4 linear_fog\(vec4 inColor, float vertexDistance, float fogStart, float fogEnd, vec4 fogColor\);\nvec4 txo_vanilla_linear_fog\(/);
    assert.match(r.wrapper, /return txo_vanilla_linear_fog\(inColor, vertexDistance, fogStart \* 0\.5, fogEnd, fogColor\);/);
  }
  const six = { ret: 'vec4', params: ['vec4', 'float', 'float', 'float', 'vec4', 'float'] } as const;
  assert.match(wrapFunction(FOG_V1, 'linear_fog', six, (n) => n) as string, /5 parameters instead of 6/);
  assert.match(wrapFunction(FOG_V1, 'apply_fog', FOG_SIGNATURES.apply_fog, (n) => n) as string, /not found/);
  // Same parameter count but a different order or return type must not be wrapped (the wrapper
  // would pass a float where a vec4 is expected and the whole pack would fail to load).
  const reordered = FOG_V1.replace('vec4 inColor, float vertexDistance, float fogStart, float fogEnd, vec4 fogColor',
    'vec4 inColor, vec4 fogColor, float vertexDistance, float fogStart, float fogEnd');
  assert.match(wrapFunction(reordered, 'linear_fog', FOG_SIGNATURES.linear_fog, (n) => n) as string, /parameter 2 is vec4 instead of float/);
  const retyped = FOG_V1.replace('float linear_fog_fade(', 'vec4 linear_fog_fade(');
  assert.match(wrapFunction(retyped, 'linear_fog_fade', FOG_SIGNATURES.linear_fog_fade, (n) => n) as string, /returns vec4 instead of float/);
  const r2 = generateVanillaShaderFiles({ ...f1Sources(), [`${INC}fog.glsl`]: reordered }, { ...defaults(), fogTintStrength: 0.5, fogTint: '#ff0000' },
    { versionId: '1.17.1', packFormat: pf(7) });
  assert.deepEqual(r2.files, {});
  assert.match(r2.warnings.join('\n'), /linear_fog\(\) parameter 2 is vec4 instead of float/);
});

test('include expansion for analysis handles both import syntaxes', () => {
  const src = { [`${INC}a.glsl`]: '#moj_import <minecraft:b.glsl>\nfloat A;', [`${INC}b.glsl`]: 'layout(std140) uniform Globals { vec2 ScreenSize; };' };
  const out = expandForAnalysis('#moj_import <a.glsl>\n#include <minecraft:b.glsl>\nvoid main() {}', src, `${CORE}x.fsh`);
  assert.match(out, /uniform Globals/);
  assert.equal(out.match(/uniform Globals/g)?.length, 1);
});

test('program JSON gets a uniform appended without rewriting the rest', () => {
  const text = '{\n    "vertex": "a",\n    "uniforms": [\n        { "name": "ProjMat", "type": "matrix4x4", "count": 16, "values": [ 1.0 ] }\n    ]\n}\n';
  const out = addProgramUniform(text, { name: 'GameTime', type: 'float', count: 1, values: [0] })!;
  assert.equal(out, '{\n    "vertex": "a",\n    "uniforms": [\n        { "name": "ProjMat", "type": "matrix4x4", "count": 16, "values": [ 1.0 ] },\n        { "name": "GameTime", "type": "float", "count": 1, "values": [ 0.0 ] }\n    ]\n}\n');
  assert.equal(addProgramUniform(out, { name: 'GameTime', type: 'float', count: 1, values: [0] }), out);
  assert.equal(addProgramUniform('{ nope', { name: 'GameTime', type: 'float', count: 1, values: [0] }), null);
  const none = addProgramUniform('{"vertex":"a"}', { name: 'GameTime', type: 'float', count: 1, values: [0] })!;
  assert.deepEqual(JSON.parse(none).uniforms, [{ name: 'GameTime', type: 'float', count: 1, values: [0] }]);
});

// ---------------------------------------------------------------- families & support

test('family detection reads the sources, not just the version', () => {
  assert.equal(detectFamily({ 'assets/minecraft/shaders/program/blur.fsh': 'void main(){}' }, pf(6)), null);
  assert.equal(detectFamily(f1Sources(), pf(7))?.id, 'F1');
  const f2 = Object.fromEntries(Object.entries(f1Sources()).map(([k, v]) => [k, v.replaceAll('#moj_import <fog.glsl>', '#moj_import <minecraft:fog.glsl>')]));
  assert.equal(detectFamily(f2, pf(42))?.id, 'F2');
  const f3 = Object.fromEntries(Object.entries(f2).filter(([k]) => !k.endsWith('.json')));
  assert.equal(detectFamily(f3, pf(55))?.id, 'F3');
  const f6 = detectFamily(f6Sources(), pf(97))!;
  assert.equal(f6.id, 'F6');
  assert.equal(f6.endOfFrame, true);
  assert.equal(f6.fogApi, 'v2');
  assert.equal(f6.explicitLocations, true);
  assert.equal(detectFamily(f6Sources(), pf(95))?.endOfFrame, false);
  assert.equal(detectFamily(f6Sources(), null)?.endOfFrame, true);
});

test('supportedFor explains what each version can do', () => {
  assert.deepEqual(shaderSourcePrefixes, ['assets/minecraft/shaders/', 'assets/minecraft/post_effect/']);
  const old = supportedFor('1.16.5');
  assert.equal(old.supported, false);
  assert.equal(old.options.brightness, false);
  assert.match(old.reasons.brightness, /1\.17/);
  const v117 = supportedFor(pf(7));
  assert.equal(v117.supported, true);
  assert.equal(v117.features.waving, true);
  assert.equal(v117.features.bloom, false);
  assert.equal(v117.features.fogEnvironment, false);
  assert.equal(v117.features.nightDarkness, false);
  assert.equal(supportedFor('1.21.2').features.nightDarkness, true);
  assert.equal(supportedFor('1.21.5').features.waving, false);
  assert.equal(supportedFor('1.21.6').features.fogEnvironment, true);
  assert.equal(supportedFor('1.21.10').features.waving, true);
  assert.equal(supportedFor(75).features.waving, false);
  const latest = supportedFor('26.3');
  assert.equal(latest.family, 'F6');
  assert.equal(latest.features.bloom, true);
  assert.equal(latest.options.bloomStrength, true);
  assert.equal(latest.options.waving, false);
  assert.ok(latest.reasons.waving);
  assert.equal(supportedFor('26.4-snapshot-1').features.bloom, true);
  assert.equal(supportedFor({ major: 97, minor: 1 }).packFormat, 97);
  assert.equal(supportedFor('25w14a').known, false);
  const fromSrc = supportFromSources(f6Sources(), pf(97));
  assert.equal(fromSrc.features.bloom, true);
  assert.equal(fromSrc.features.waving, false);
  assert.equal(supportFromSources(f1Sources(), pf(7)).features.waving, true);
});

// ---------------------------------------------------------------- generation on synthetic sets

test('versions without core shaders are unsupported', () => {
  const r = generateVanillaShaderFiles({ 'assets/minecraft/shaders/program/blur.fsh': 'void main(){}' }, ALL_ON, { versionId: '1.16.5', packFormat: pf(6) });
  assert.equal(r.supported, false);
  assert.deepEqual(r.files, {});
  assert.match(r.warnings[0], /1\.17/);
  // 1.6.x has no shaders folder at all: still "too old"
  assert.match(generateVanillaShaderFiles({}, ALL_ON, { versionId: '1.6.4', packFormat: pf(1) }).warnings[0], /1\.17/);
  // a modern version whose shader files never arrived must not be called too old
  const empty = generateVanillaShaderFiles({ 'assets/minecraft/post_effect/blur.json': '{}' }, ALL_ON, { versionId: '26.3', packFormat: pf(97) });
  assert.equal(empty.supported, false);
  assert.deepEqual(empty.files, {});
  assert.match(empty.warnings[0], /shader files of Java 26\.3 could not be read/);
});

test('default settings change nothing', () => {
  for (const [src, p] of [[f1Sources(), 7], [f6Sources(), 97]] as const) {
    const r = generateVanillaShaderFiles(src, defaults(), { versionId: 'x', packFormat: pf(p) });
    assert.equal(r.supported, true);
    assert.deepEqual(r.files, {});
    assert.match(r.warnings.join(' '), /matches vanilla/);
  }
});

test('1.17-style patch: world graded per object, GUI untouched, waving via GameTime', () => {
  const src = f1Sources();
  const r = generateVanillaShaderFiles(src, ALL_ON, { versionId: '1.17.1', packFormat: pf(7) });
  const files = r.files as Record<string, string>;
  assert.equal(r.supported, true);
  assert.ok(!Object.keys(files).some((k) => /\/gui\./.test(k)), 'GUI shaders must not change');
  const fsh = textOf(files, `${CORE}rendertype_solid.fsh`);
  assert.ok(fsh.startsWith(src[`${CORE}rendertype_solid.fsh`].replace('void main()', 'void txo_vanilla_main()')));
  assert.match(fsh, /#moj_import <txo_post\.glsl>/);
  assert.match(fsh, /if \(txo_aspect > 0\.0001\) \{\n\s+fragColor\.rgb = txo_grade\(fragColor\.rgb\) \* txo_vignette\(/);
  const vsh = textOf(files, `${CORE}rendertype_solid.vsh`);
  assert.match(vsh, /txo_aspect = abs\(ProjMat\[2\]\[3\]\) > 0\.0001 && ProjMat\[2\]\[2\] > -1\.005 \? abs\(ProjMat\[1\]\[1\] \/ ProjMat\[0\]\[0\]\) : 0\.0;\n\s+txo_clipPos = gl_Position;/);
  assert.ok(!/txo_wave/.test(vsh), 'solid blocks must not wave');
  const cutout = textOf(files, `${CORE}rendertype_cutout.vsh`);
  assert.match(cutout, /uniform float GameTime;/);
  assert.ok(cutout.indexOf('gl_Position += ProjMat') < cutout.indexOf('txo_clipPos = gl_Position'), 'waving must run before the clip position is captured');
  assert.ok(JSON.parse(textOf(files, `${CORE}rendertype_cutout.json`)).uniforms.some((u: { name: string }) => u.name === 'GameTime'));
  assert.ok(!(`${CORE}rendertype_solid.json` in files));
  const post = textOf(files, `${INC}txo_post.glsl`);
  assert.match(post, /#ifndef TXO_POST_GLSL/);
  assert.match(post, /c = floor\(c \* 7\.0 \+ 0\.5\) \/ 7\.0;/);
  const fog = textOf(files, `${INC}fog.glsl`);
  assert.match(fog, /\(fogStart <= fogEnd \? min\(fogStart, fogEnd \* 0\.5\) : fogStart\)/);
  assert.match(fog, /#ifndef TXO_FOG_WRAPPERS[\s\S]*#endif\n$/);
  assert.match(r.warnings.join('\n'), /Bloom needs Java 26\.3/);
  assert.match(r.warnings.join('\n'), /Water & weather fog/);
  assert.match(r.warnings.join('\n'), /Darker nights skipped/);
  for (const t of Object.values(files)) {
    for (const m of (t as string).matchAll(/Made with (\w+)/g)) assert.equal(m[1], 'TexturesOnline');
  }
});

test('additive and emissive overlays are never graded', () => {
  for (const name of ['rendertype_eyes', 'rendertype_energy_swirl', 'rendertype_lightning']) {
    assert.ok(GRADE_DENY.test(name), `${name} must be on the deny list`);
  }
  assert.ok(!GRADE_DENY.test('rendertype_entity_translucent_emissive'), 'translucent emissive entities stay graded');
  const r = generateVanillaShaderFiles(f1Sources(), ALL_ON, { versionId: '1.17.1', packFormat: pf(7) });
  const fsh = textOf(r.files as Record<string, string>, `${CORE}rendertype_solid.fsh`);
  assert.match(fsh, /#if !\(defined\(EMISSIVE\) && defined\(NO_OVERLAY\)\)\n\s*if \(txo_aspect > 0\.0001\) \{[\s\S]*?\}\n#endif/);
});

test('synthetic 1.17-style output compiles and links', { skip: findGlslang() ? false : 'glslangValidator not found' }, async () => {
  const src = f1Sources();
  const r = generateVanillaShaderFiles(src, ALL_ON, { versionId: '1.17.1', packFormat: pf(7) });
  const merged = { ...src, ...(r.files as Record<string, string>) };
  const jobs = [];
  for (const name of ['rendertype_solid', 'rendertype_cutout', 'gui']) {
    const v = mojPreprocess(merged[`${CORE}${name}.vsh`], merged, `${CORE}${name}.vsh`);
    const f = mojPreprocess(merged[`${CORE}${name}.fsh`], merged, `${CORE}${name}.fsh`);
    assert.deepEqual(missingVaryings(v, f), [], name);
    jobs.push({ label: `${name}.vsh`, stage: 'vert' as const, code: injectDefines(v, []) }, { label: `${name}.fsh`, stage: 'frag' as const, code: f });
  }
  assert.deepEqual(await compileGL(findGlslang()!, jobs), []);
});

test('anchors that are missing or unexpected are skipped with a warning', () => {
  const src = f1Sources();
  src[`${CORE}rendertype_solid.fsh`] += '\nvoid main() {}\n';
  src[`${INC}fog.glsl`] = src[`${INC}fog.glsl`].replace('vec4 fogColor) {', 'vec4 fogColor, float extra) {');
  const r = generateVanillaShaderFiles(src, { ...ALL_ON, waving: false, nightDarkness: 0 }, { versionId: '1.17.1', packFormat: pf(7) });
  const files = r.files as Record<string, string>;
  assert.ok(!(`${CORE}rendertype_solid.fsh` in files), 'a shader with two main() must be left alone');
  assert.ok(`${CORE}rendertype_cutout.fsh` in files);
  assert.match(r.warnings.join('\n'), /Skipped core\/rendertype_solid\.fsh/);
  assert.match(r.warnings.join('\n'), /linear_fog\(\) has 6 parameters instead of 5/);
  // linear_fog_fade was still recognised, so the fog file only wraps that one
  const fog = textOf(files, `${INC}fog.glsl`);
  assert.match(fog, /float linear_fog_fade\(float vertexDistance, float fogStart, float fogEnd\) \{\n\s+return txo_vanilla_linear_fog_fade/);
  assert.ok(!/txo_vanilla_linear_fog\(/.test(fog));

  const noFog = f1Sources();
  delete noFog[`${INC}fog.glsl`];
  const r2 = generateVanillaShaderFiles(noFog, { ...defaults(), fogStart: 0.5 }, { versionId: '1.17.1', packFormat: pf(7) });
  assert.deepEqual(r2.files, {});
  assert.match(r2.warnings.join('\n'), /Fog settings skipped/);
});

test('26.3-style patch: full-screen post effect, no core fragment patches', () => {
  const src = f6Sources();
  const r = generateVanillaShaderFiles(src, ALL_ON, { versionId: '26.3', packFormat: { major: 97, minor: 1 } });
  const files = r.files as Record<string, string>;
  assert.deepEqual(Object.keys(files).sort(), [
    'assets/minecraft/post_effect/end_of_frame.json',
    `${CORE}lightmap.fsh`,
    `${INC}fog.glsl`,
    `${S}post/txo_blur.fsh`,
    `${S}post/txo_bright.fsh`,
    `${S}post/txo_final.fsh`,
  ]);
  const eof = JSON.parse(files['assets/minecraft/post_effect/end_of_frame.json']);
  assert.deepEqual(Object.keys(eof.targets).sort(), ['txo_bloom_a', 'txo_bloom_b', 'txo_swap']);
  assert.equal(eof.passes.length, 7);
  assert.equal(eof.passes.at(-1).output, 'minecraft:main');
  assert.equal(eof.passes.at(-1).fragment_shader, 'minecraft:post/blit');
  for (const p of eof.passes) assert.equal(p.vertex_shader, 'minecraft:core/screenquad');
  const final = files[`${S}post/txo_final.fsh`];
  assert.ok(final.startsWith('#version 330\n#extension GL_ARB_separate_shader_objects : require\n'));
  assert.match(final, /uniform sampler2D BloomSampler;/);
  assert.match(final, /layout\(location = 0\) out vec4 fragColor;/);
  const fog = files[`${INC}fog.glsl`];
  assert.ok(fog.indexOf('#endif\n') < fog.indexOf('#ifndef TXO_FOG_WRAPPERS'), 'wrappers go after the vanilla include guard');
  assert.match(fog, /envStart \* txo_fog_env\(envEnd\), envEnd \* txo_fog_env\(envEnd\)/);
  assert.match(fog, /float txo_fog_env\(float envEnd\) \{\n\s+return mix\(1\.0, 0\.8, smoothstep\(16\.0, 32\.0, envEnd\)\);/);
  assert.ok(fog.indexOf('float txo_fog_env(') < fog.indexOf('float total_fog_value(float sph, float cyl, float envStart, float envEnd, float rdStart, float rdEnd) {\n    return'),
    'the helper is defined before the wrapper that calls it');
  assert.match(r.warnings.join('\n'), /Waving plants skipped/);
  const light = files[`${CORE}lightmap.fsh`];
  assert.match(light, /fragColor\.rgb \*= mix\(1\.0, txo_m, 0\.4\);/);

  const noBloom = generateVanillaShaderFiles(src, { ...ALL_ON, bloom: false }, { versionId: '26.3', packFormat: pf(97) });
  const eof2 = JSON.parse((noBloom.files as Record<string, string>)['assets/minecraft/post_effect/end_of_frame.json']);
  assert.equal(eof2.passes.length, 2);
  assert.ok(!(`${S}post/txo_blur.fsh` in noBloom.files));

  const early = generateVanillaShaderFiles(src, { ...defaults(), contrast: 1.3 }, { versionId: '26.3-snapshot-1', packFormat: pf(95) });
  assert.deepEqual(early.files, {});
  assert.match(early.warnings.join('\n'), /Colors and vignette skipped/);
});

test('pack description names the one version the pack works in', () => {
  assert.equal(vanillaPackDescription('26.3'), 'Shaders for Java 26.3 only. Made with TexturesOnline');
  assert.equal(vanillaPackDescription('1.21.4', 'Dusk'), 'Dusk · Shaders for Java 1.21.4 only. Made with TexturesOnline');
});
