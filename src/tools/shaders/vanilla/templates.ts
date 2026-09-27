// GLSL and JSON templates for the vanilla shader pack. Numbers from the sliders are baked in as literals.

import type { Settings } from './options';
import { ENV_FOG_FULL_END, ENV_FOG_PROTECT_END, colorMultiplier, gradeSteps, waveParams } from './color';
import { PREFIX, glslFloat as f, glslVec3 } from './glsl';

const P = PREFIX;
const LUMA = 'vec3(0.2126, 0.7152, 0.0722)';

/** `vec3 txo_grade(vec3 c)`: only the steps that change anything are emitted. */
export function gradeFunction(s: Settings): string {
  const st = gradeSteps(s);
  const lines: string[] = [`vec3 ${P}_grade(vec3 c) {`];
  if (st.multiply) lines.push(`    c = max(c, vec3(0.0)) * ${glslVec3(colorMultiplier(s))};`);
  if (st.contrast) lines.push(`    c = (c - 0.5) * ${f(s.contrast)} + 0.5;`);
  if (st.saturation) {
    lines.push(`    float ${P}_l = dot(c, ${LUMA});`);
    if (st.vibrance) {
      lines.push(`    float ${P}_s = clamp(max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)), 0.0, 1.0);`);
      // max(): a negative factor (low saturation with negative vibrance) would invert colours.
      lines.push(`    c = mix(vec3(${P}_l), c, max(${f(s.saturation)} + ${f(s.vibrance)} * (1.0 - ${P}_s), 0.0));`);
    } else {
      lines.push(`    c = mix(vec3(${P}_l), c, ${f(s.saturation)});`);
    }
  }
  lines.push('    c = clamp(c, 0.0, 1.0);');
  if (st.gamma) lines.push(`    c = pow(c, vec3(${f(1 / s.gamma)}));`);
  if (st.grayscale) lines.push(`    c = mix(c, vec3(dot(c, ${LUMA})), ${f(s.grayscale)});`);
  if (st.sepia) {
    lines.push(`    vec3 ${P}_sep = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131)));`);
    lines.push(`    c = mix(c, min(${P}_sep, vec3(1.0)), ${f(s.sepia)});`);
  }
  if (st.posterize) {
    const lv = f(s.posterize - 1);
    lines.push(`    c = floor(c * ${lv} + 0.5) / ${lv};`);
  }
  lines.push('    return clamp(c, 0.0, 1.0);', '}');
  return lines.join('\n') + '\n';
}

/** `float txo_vignette(vec2 p)`: p is centred screen space, y in -0.5..0.5 and x scaled by the aspect ratio. */
export function vignetteFunction(s: Settings): string {
  return `float ${P}_vignette(vec2 p) {\n    return 1.0 - ${f(s.vignette)} * smoothstep(0.25, 1.05, length(p) * 1.25);\n}\n`;
}

/** Shared include for the per-object path (1.17 – 26.2): `assets/minecraft/shaders/include/txo_post.glsl`. */
export function postInclude(s: Settings, withGrade: boolean, withVignette: boolean): string {
  const parts = [
    '// Made with Texture Pack Maker: color grading and vignette shared by the patched shaders.',
    '#ifndef TXO_POST_GLSL',
    '#define TXO_POST_GLSL',
    '',
  ];
  if (withGrade) parts.push(gradeFunction(s));
  if (withVignette) parts.push(vignetteFunction(s));
  parts.push('#endif', '');
  return parts.join('\n');
}

/** Colour expression applied to a fragment output, e.g. `txo_grade(fragColor.rgb) * txo_vignette(p)`. */
export function gradeExpression(outVar: string, withGrade: boolean, withVignette: boolean, pointExpr: string): string {
  const base = withGrade ? `${P}_grade(${outVar}.rgb)` : `${outVar}.rgb`;
  return withVignette ? `${base} * ${P}_vignette(${pointExpr})` : base;
}

export function waveFunction(s: Settings): string {
  const w = waveParams(s);
  const twoPi = 2 * Math.PI;
  return [
    `vec3 ${P}_wave(vec3 p, float t) {`,
    `    float a = t * ${f(twoPi * w.cyclesA)} + dot(p, vec3(0.61, 0.0, 0.83));`,
    `    float b = t * ${f(twoPi * w.cyclesB)} + dot(p, vec3(0.37, 0.0, -0.91));`,
    `    return vec3(sin(a), 0.0, sin(b)) * ${f(w.amplitude)};`,
    '}',
    '',
  ].join('\n');
}

/**
 * Plant detection: biome-tinted green to olive (grass, ferns, sugar cane, vines, stems in every
 * biome; green clearly above blue and at least half of red, which rules out untinted grey blocks and
 * redstone wire, whose green is at most a fifth of its red), vertical faces only, top edge of the
 * quad (vertices 0 and 3 in Minecraft's face order). Ratios survive the per-vertex shade and AO.
 */
export const WAVE_CONDITION =
  'Color.g > Color.b * 1.12 + 0.004 && Color.g > Color.r * 0.5 && abs(Normal.y) < 0.5 && ((gl_VertexID & 3) == 0 || (gl_VertexID & 3) == 3)';

export function waveBody(layerGated: boolean): string[] {
  const inner = [
    `if (${WAVE_CONDITION}) {`,
    `    gl_Position += ProjMat * ModelViewMat * vec4(${P}_wave(Position, GameTime), 0.0);`,
    '}',
  ];
  if (!layerGated) return inner;
  // ALPHA_CUTOUT 0.1 = the plants layer; 0.5 = leaves / grass blocks; translucent has no define.
  return ['#ifdef ALPHA_CUTOUT', 'if (ALPHA_CUTOUT < 0.3) {', ...inner.map((l) => '    ' + l), '}', '#endif'];
}

/**
 * `float txo_fog_env(float envEnd)`: the environmental fog multiplier for a vanilla fog end
 * distance. Short fog (Blindness, Darkness, lava, powder snow) keeps its vanilla distance.
 */
export function fogEnvironmentFunction(multiplier: number): string {
  return [
    `float ${P}_fog_env(float envEnd) {`,
    `    return mix(1.0, ${f(multiplier)}, smoothstep(${f(ENV_FOG_PROTECT_END)}, ${f(ENV_FOG_FULL_END)}, envEnd));`,
    '}',
    '',
  ].join('\n');
}

/** Darkens dim light-map texels (night sky light, caves) and keeps bright light unchanged. */
export function darknessBody(outVar: string, strength: number): string[] {
  return [
    `float ${P}_m = max(${outVar}.r, max(${outVar}.g, ${outVar}.b));`,
    `${outVar}.rgb *= mix(1.0, ${P}_m, ${f(strength)});`,
  ];
}

// ---------------------------------------------------------------- 26.3+: always-on end_of_frame post effect

const POST_HEAD = '#version 330\n#extension GL_ARB_separate_shader_objects : require\n\n// Made with Texture Pack Maker.\n';

export function postFinalShader(s: Settings, withGrade: boolean, withVignette: boolean, bloom: boolean): string {
  const out = [POST_HEAD, 'uniform sampler2D InSampler;'];
  if (bloom) out.push('uniform sampler2D BloomSampler;');
  out.push('', 'layout(location = 0) in vec2 texCoord;', '', 'layout(location = 0) out vec4 fragColor;', '');
  if (withGrade) out.push(gradeFunction(s));
  if (withVignette) out.push(vignetteFunction(s));
  out.push('void main() {', '    vec4 c = texture(InSampler, texCoord);');
  if (bloom) out.push(`    c.rgb += texture(BloomSampler, texCoord).rgb * ${f(s.bloomStrength)};`);
  if (withVignette) {
    out.push('    vec2 size = vec2(textureSize(InSampler, 0));');
    out.push('    vec2 p = (texCoord - 0.5) * vec2(size.x / max(size.y, 1.0), 1.0);');
  }
  out.push(`    fragColor = vec4(${gradeExpression('c', withGrade, withVignette, 'p')}, c.a);`);
  if (!withGrade && !withVignette) out[out.length - 1] = '    fragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);';
  out.push('}', '');
  return out.join('\n');
}

export function postBrightShader(s: Settings): string {
  return [
    POST_HEAD,
    'uniform sampler2D InSampler;',
    '',
    'layout(location = 0) in vec2 texCoord;',
    '',
    'layout(location = 0) out vec4 fragColor;',
    '',
    'void main() {',
    '    vec3 c = texture(InSampler, texCoord).rgb;',
    `    float l = dot(c, ${LUMA});`,
    `    fragColor = vec4(c * smoothstep(${f(s.bloomThreshold)}, 1.0, l), 1.0);`,
    '}',
    '',
  ].join('\n');
}

/** 9-tap Gaussian done as 5 linear-filtered taps; TxoBlurDir is in texels of the input. */
export function postBlurShader(): string {
  return [
    POST_HEAD,
    'uniform sampler2D InSampler;',
    '',
    'layout(std140) uniform SamplerInfo {',
    '    vec2 OutSize;',
    '    vec2 InSize;',
    '};',
    '',
    'layout(std140) uniform TxoBlurConfig {',
    '    vec2 TxoBlurDir;',
    '};',
    '',
    'layout(location = 0) in vec2 texCoord;',
    '',
    'layout(location = 0) out vec4 fragColor;',
    '',
    'void main() {',
    '    vec2 stepUv = TxoBlurDir / InSize;',
    '    vec3 acc = texture(InSampler, texCoord).rgb * 0.227027;',
    '    acc += (texture(InSampler, texCoord + stepUv * 1.384615).rgb + texture(InSampler, texCoord - stepUv * 1.384615).rgb) * 0.316216;',
    '    acc += (texture(InSampler, texCoord + stepUv * 3.230769).rgb + texture(InSampler, texCoord - stepUv * 3.230769).rgb) * 0.070270;',
    '    fragColor = vec4(acc, 1.0);',
    '}',
    '',
  ].join('\n');
}

interface PostInput {
  sampler_name: string;
  target: string;
  bilinear?: boolean;
}
interface PostPass {
  vertex_shader: string;
  fragment_shader: string;
  inputs: PostInput[];
  output: string;
  uniforms?: Record<string, { name: string; type: string; value: number[] | number }[]>;
}

export const POST_NAMES = {
  final: `${P}_final`,
  bright: `${P}_bright`,
  blur: `${P}_blur`,
  swap: `${P}_swap`,
  bloomA: `${P}_bloom_a`,
  bloomB: `${P}_bloom_b`,
} as const;

/** `post_effect/end_of_frame.json`: [bright → 4 blur passes] → grade/vignette/bloom → blit back to main. */
export function endOfFrameJson(bloom: boolean): string {
  const vs = 'minecraft:core/screenquad';
  const passes: PostPass[] = [];
  const targets: Record<string, Record<string, never>> = { [POST_NAMES.swap]: {} };
  const finalInputs: PostInput[] = [{ sampler_name: 'In', target: 'minecraft:main' }];
  if (bloom) {
    targets[POST_NAMES.bloomA] = {};
    targets[POST_NAMES.bloomB] = {};
    passes.push({
      vertex_shader: vs,
      fragment_shader: `minecraft:post/${POST_NAMES.bright}`,
      inputs: [{ sampler_name: 'In', target: 'minecraft:main' }],
      output: POST_NAMES.bloomA,
    });
    const blurs: [[number, number], string, string][] = [
      [[2, 0], POST_NAMES.bloomA, POST_NAMES.bloomB],
      [[0, 2], POST_NAMES.bloomB, POST_NAMES.bloomA],
      [[4, 0], POST_NAMES.bloomA, POST_NAMES.bloomB],
      [[0, 4], POST_NAMES.bloomB, POST_NAMES.bloomA],
    ];
    for (const [dir, from, to] of blurs) {
      passes.push({
        vertex_shader: vs,
        fragment_shader: `minecraft:post/${POST_NAMES.blur}`,
        inputs: [{ sampler_name: 'In', target: from, bilinear: true }],
        output: to,
        uniforms: { TxoBlurConfig: [{ name: 'TxoBlurDir', type: 'vec2', value: [dir[0], dir[1]] }] },
      });
    }
    finalInputs.push({ sampler_name: 'Bloom', target: POST_NAMES.bloomA, bilinear: true });
  }
  passes.push({ vertex_shader: vs, fragment_shader: `minecraft:post/${POST_NAMES.final}`, inputs: finalInputs, output: POST_NAMES.swap });
  passes.push({
    vertex_shader: vs,
    fragment_shader: 'minecraft:post/blit',
    inputs: [{ sampler_name: 'In', target: POST_NAMES.swap }],
    output: 'minecraft:main',
    uniforms: { BlitConfig: [{ name: 'ColorModulate', type: 'vec4', value: [1, 1, 1, 1] }] },
  });
  return JSON.stringify({ targets, passes }, null, 2) + '\n';
}
