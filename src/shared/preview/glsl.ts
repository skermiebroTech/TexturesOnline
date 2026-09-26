// GLSL for the shader preview (GLSL ES 1.0 style; three.js upgrades it for WebGL2).

/** Uniform declarations + helpers shared by every world shader. */
export const COMMON = /* glsl */ `
uniform float uTime;
uniform float uWaving;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyGround;
uniform vec3 uSunGlow;
uniform vec3 uTwilight;
uniform vec3 uAmbientSky;
uniform vec3 uAmbientGround;
uniform vec3 uFogColor;
uniform vec3 uScatterColor;
uniform float uFogDensity;
uniform float uFogBase;
uniform float uShadowStrength;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform vec2 uShadowTexel;
uniform vec4 uTorches[4];
uniform vec3 uTorchColor;
uniform vec3 uWaterColor;
uniform float uWaterClarity;
uniform float uWaterLevel;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

vec3 encodeHdr(vec3 c) {
#ifdef LDR_TARGET
  return c / (1.0 + c);
#else
  return c;
#endif
}

vec3 skyGradient(vec3 dir) {
  float up = clamp(dir.y, 0.0, 1.0);
  vec3 col = mix(uSkyHorizon, uSkyTop, pow(up, 0.55));
  float sd = max(dot(dir, uSunDir), 0.0);
  col += uTwilight * pow(sd, 4.0) * exp(-up * 6.0);
  col += uSunGlow * (pow(sd, 24.0) * 0.45 + pow(sd, 300.0) * 2.5);
  float below = clamp(-dir.y, 0.0, 1.0);
  vec3 under = mix(uSkyHorizon, uSkyGround, smoothstep(0.0, 0.6, below));
  col = mix(col, under, smoothstep(0.0, 0.03, below));
  return col;
}

vec3 fogColorFor(vec3 dir) {
  float s = max(dot(dir, uSunDir), 0.0);
  return uFogColor + uScatterColor * (pow(s, 6.0) * 0.8 + pow(s, 32.0) * 0.6);
}

/** Sky seen in a direction, including the horizon haze (no sun, moon or stars). */
vec3 skyBackground(vec3 dir) {
  float horizon = 1.0 - smoothstep(0.0, 0.45, abs(dir.y));
  return mix(skyGradient(dir), fogColorFor(dir), clamp(uFogDensity * 1.1, 0.0, 1.0) * horizon);
}

float fogAmount(vec3 wp) {
  vec3 d = wp - cameraPosition;
  float dist = length(d);
  float k = pow(uFogDensity, 1.5) * 0.02;
  float fd = 1.0 - exp(-dist * k);
  // exponential height fog integrated along the view ray
  float a = 0.28;
  float y0 = cameraPosition.y - uFogBase;
  float y1 = wp.y - uFogBase;
  float dy = y1 - y0;
  float e0 = exp(-a * y0);
  float e1 = exp(-a * y1);
  float integral = abs(dy) > 1e-3 ? dist * (e0 - e1) / (a * dy) : dist * e0;
  float fh = 1.0 - exp(-max(integral, 0.0) * uFogDensity * 0.035);
  return clamp(1.0 - (1.0 - fd) * (1.0 - fh), 0.0, 1.0);
}

vec3 applyFog(vec3 col, vec3 wp) {
  vec3 dir = normalize(wp - cameraPosition);
  return mix(col, fogColorFor(dir), fogAmount(wp));
}

float shadowTap(vec2 uv, float z) {
  return step(z, texture2D(uShadowMap, uv).r);
}

float getShadow(vec3 wp, vec3 n) {
  if (uShadowStrength <= 0.001) return 1.0;
  vec4 sc = uShadowMatrix * vec4(wp + n * 0.05, 1.0);
  vec3 p = sc.xyz / sc.w;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  float z = p.z - 0.0012;
  vec2 st = p.xy / uShadowTexel - 0.5;
  vec2 f = fract(st);
  vec2 base = (floor(st) + 0.5) * uShadowTexel;
  float sum = 0.0;
  for (int j = -1; j <= 2; j++) {
    float wy = j == -1 ? 1.0 - f.y : (j == 2 ? f.y : 1.0);
    for (int i = -1; i <= 2; i++) {
      float wx = i == -1 ? 1.0 - f.x : (i == 2 ? f.x : 1.0);
      sum += wx * wy * shadowTap(base + vec2(float(i), float(j)) * uShadowTexel, z);
    }
  }
  return mix(1.0, sum / 9.0, uShadowStrength);
}

vec3 torchLight(vec3 wp, vec3 n) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 t = uTorches[i];
    vec3 d = t.xyz - wp;
    float dist = length(d);
    float att = pow(clamp(1.0 - dist / 8.0, 0.0, 1.0), 2.0);
    float ndl = dot(n, d / max(dist, 1e-3)) * 0.5 + 0.5;
    sum += att * ndl * t.w;
  }
  return sum * uTorchColor;
}
`;

/** Foliage / plant sway, shared by the colour and the shadow pass. */
export const WAVE = /* glsl */ `
vec3 waveOffset(vec3 wp, float kind) {
  if (uWaving <= 0.001 || kind < 0.5 || kind > 2.5) return wp;
  float t = uTime;
  float gust = 0.65 + 0.35 * sin(t * 0.37 + wp.x * 0.05 + wp.z * 0.04);
  if (kind < 1.5) {
    float s = sin(t * 1.7 + wp.x * 0.8 + wp.z * 0.6 + wp.y * 0.4) + 0.5 * sin(t * 2.9 + wp.x * 1.9 - wp.z * 1.3);
    float c = cos(t * 1.3 + wp.z * 0.9 - wp.x * 0.3 + wp.y * 0.7);
    wp += vec3(s, c * 0.35, c) * 0.042 * uWaving * gust;
  } else {
    float s = sin(t * 2.1 + wp.x * 1.3 + wp.z * 0.7) + 0.4 * sin(t * 3.7 + wp.x * 0.5 - wp.z * 1.7);
    float c = cos(t * 1.8 + wp.z * 1.1 + wp.x * 0.4);
    wp.xz += vec2(s, c) * 0.1 * uWaving * gust;
  }
  return wp;
}
`;

export const VOXEL_VERT = /* glsl */ `
${COMMON}
${WAVE}
attribute float aAO;
attribute float aWave;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vAO;
varying float vWet;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.xyz = waveOffset(wp.xyz, aWave);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vAO = aAO;
  vWet = aWave > 3.5 ? 1.0 : 0.0;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const VOXEL_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uMap;
uniform float uAlphaTest;
uniform float uEmissive;
uniform float uTranslucent;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vAO;
varying float vWet;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < uAlphaTest) discard;
  vec3 albedo = toLinear(tex.rgb);
  vec3 n = normalize(vNormal);
  float ndl = max(dot(n, uLightDir), 0.0);
  float sh = getShadow(vWorld, n);
  vec3 direct = uLightColor * ndl * sh;
  if (uTranslucent > 0.0) {
    vec3 v = normalize(cameraPosition - vWorld);
    float back = pow(max(dot(-v, uLightDir), 0.0), 3.0);
    direct += uLightColor * (back * 0.9 + 0.15) * uTranslucent * sh;
  }
  vec3 amb = mix(uAmbientGround, uAmbientSky, n.y * 0.5 + 0.5);
  vec3 light = direct * (0.6 + 0.4 * vAO) + amb * vAO + torchLight(vWorld, n) * vAO;
  vec3 col = albedo * light;
  if (vWet > 0.5) {
    float d = max(uWaterLevel - vWorld.y, 0.0) + 0.25;
    float absorb = 1.0 - exp(-d * mix(1.6, 0.35, uWaterClarity));
    col *= mix(vec3(1.0), uWaterColor * 0.9, absorb);
    vec2 p = vWorld.xz * 2.2;
    float c1 = sin(p.x + uTime * 1.3 + sin(p.y * 1.3 + uTime));
    float c2 = sin(p.y * 1.1 - uTime * 1.1 + sin(p.x * 0.9 - uTime * 0.7));
    float caustic = pow(max(0.0, 1.0 - abs(c1 + c2) * 0.7), 6.0);
    col += albedo * uLightColor * caustic * 0.35 * sh * ndl * uWaterClarity;
  }
  if (uEmissive > 0.0) {
    float l = max(tex.r, max(tex.g, tex.b));
    col += albedo * uEmissive * smoothstep(0.55, 0.85, l);
  }
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(encodeHdr(col), 1.0);
}
`;

export const WATER_VERT = /* glsl */ `
${COMMON}
attribute float aWave;
attribute float aDepth;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vDepth;
varying float vTop;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vTop = aWave > 2.5 ? 1.0 : 0.0;
  if (vTop > 0.5) {
    wp.y += (sin(uTime * 1.3 + wp.x * 0.9 + wp.z * 0.4) + sin(uTime * 1.7 - wp.z * 1.1 + wp.x * 0.3)) * 0.016;
  }
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vDepth = aDepth;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const WATER_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uMap;
uniform float uFrames;
uniform float uFrame;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vDepth;
varying float vTop;
void main() {
  float fr = floor(mod(uFrame, uFrames));
  vec2 uv = vec2(vUv.x, (vUv.y + (uFrames - 1.0 - fr)) / uFrames);
  vec4 tex = texture2D(uMap, uv);
  vec3 base = toLinear(tex.rgb) * uWaterColor;
  vec3 n = normalize(vNormal);
  if (vTop > 0.5) {
    vec2 p = vWorld.xz;
    float t = uTime;
    vec2 g = vec2(0.0);
    g += vec2(0.9, 0.4) * cos(p.x * 0.9 + p.y * 0.4 + t * 1.3) * 0.05;
    g += vec2(0.3, -1.1) * cos(p.x * 0.3 - p.y * 1.1 + t * 1.7) * 0.05;
    g += vec2(2.3, 1.7) * cos(p.x * 2.3 + p.y * 1.7 - t * 2.3) * 0.018;
    g += vec2(-1.9, 2.9) * cos(-p.x * 1.9 + p.y * 2.9 + t * 2.9) * 0.012;
    n = normalize(vec3(-g.x, 1.0, -g.y));
  }
  vec3 v = normalize(cameraPosition - vWorld);
  float ndv = max(dot(n, v), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);
  vec3 refl = skyGradient(r);
  float sh = getShadow(vWorld, vec3(0.0, 1.0, 0.0));
  vec3 amb = mix(uAmbientGround, uAmbientSky, 0.8);
  vec3 diff = base * (uLightColor * max(dot(n, uLightDir), 0.0) * sh * 0.7 + amb + torchLight(vWorld, n));
  vec3 h = normalize(uLightDir + v);
  float spec = pow(max(dot(n, h), 0.0), 220.0) * 4.0 * sh;
  vec3 col = mix(diff, refl, clamp(fres * 0.9, 0.0, 1.0)) + uLightColor * spec;
  float depthA = 1.0 - exp(-vDepth * mix(3.2, 0.5, uWaterClarity));
  float alpha = mix(depthA, 1.0, fres);
  alpha = clamp(max(alpha, mix(0.6, 0.18, uWaterClarity)) * mix(0.75, 1.0, tex.a) + spec * 0.3, 0.0, 1.0);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(encodeHdr(col), alpha);
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w * 0.99999;
}
`;

export const SKY_FRAG = /* glsl */ `
${COMMON}
uniform float uNight;
uniform vec3 uSunDisk;
uniform vec3 uMoonDisk;
varying vec3 vDir;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float squareDisk(vec3 dir, vec3 c, float size) {
  float d = dot(dir, c);
  if (d <= 0.0) return 0.0;
  vec3 ref = abs(c.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(ref, c));
  vec3 t2 = cross(c, t1);
  vec2 q = vec2(dot(dir, t1), dot(dir, t2)) / d;
  float m = max(abs(q.x), abs(q.y));
  return 1.0 - smoothstep(size, size * 1.08, m);
}

void main() {
  vec3 dir = normalize(vDir);
  vec3 col = skyGradient(dir);
  if (uNight > 0.001 && dir.y > -0.05) {
    vec3 q = dir * 220.0;
    vec3 cell = floor(q);
    float h = hash3(cell);
    if (h > 0.9965) {
      vec3 f = fract(q) - 0.5;
      float star = smoothstep(0.2, 0.0, length(f));
      float tw = 0.6 + 0.4 * sin(uTime * (1.5 + h * 3.0) + h * 91.0);
      col += vec3(0.9, 0.95, 1.0) * star * tw * uNight * 2.2 * smoothstep(-0.05, 0.2, dir.y);
    }
  }
  float aboveHorizon = smoothstep(-0.03, 0.01, dir.y);
  col += uSunDisk * squareDisk(dir, uSunDir, 0.055) * aboveHorizon;
  col += uMoonDisk * squareDisk(dir, uMoonDir, 0.04) * aboveHorizon;
  float horizon = 1.0 - smoothstep(0.0, 0.45, abs(dir.y));
  col = mix(col, fogColorFor(dir), clamp(uFogDensity * 1.1, 0.0, 1.0) * horizon);
  gl_FragColor = vec4(encodeHdr(col), 0.0);
}
`;

export const DEPTH_VERT = /* glsl */ `
uniform float uTime;
uniform float uWaving;
${WAVE}
attribute float aWave;
varying vec2 vUv;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.xyz = waveOffset(wp.xyz, aWave);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const DEPTH_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uAlphaTest;
varying vec2 vUv;
void main() {
  if (uAlphaTest > 0.0 && texture2D(uMap, vUv).a < uAlphaTest) discard;
  gl_FragColor = vec4(1.0);
}
`;

export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const DECODE = /* glsl */ `
vec3 decodeHdr(vec3 c) {
#ifdef LDR_TARGET
  return c / max(1.0 - c, vec3(1e-3));
#else
  return c;
#endif
}
`;

/** Half-res bright pass for bloom; alpha carries the godray source (sky near the light). */
export const PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform float uThreshold;
uniform vec3 uCamF;
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform vec2 uTan;
uniform vec3 uRayDir;
varying vec2 vUv;
${DECODE}
void main() {
  vec4 a = texture2D(tScene, vUv + uTexel * vec2(-1.0, -1.0));
  vec4 b = texture2D(tScene, vUv + uTexel * vec2(1.0, -1.0));
  vec4 c = texture2D(tScene, vUv + uTexel * vec2(-1.0, 1.0));
  vec4 d = texture2D(tScene, vUv + uTexel * vec2(1.0, 1.0));
  vec3 col = (decodeHdr(a.rgb) + decodeHdr(b.rgb) + decodeHdr(c.rgb) + decodeHdr(d.rgb)) * 0.25;
  float sky = 1.0 - clamp((a.a + b.a + c.a + d.a) * 0.25, 0.0, 1.0);
  float br = max(col.r, max(col.g, col.b));
  float knee = uThreshold * 0.5;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  vec3 bloom = min(col * contrib, vec3(12.0));
  vec3 dir = normalize(uCamF + (vUv.x * 2.0 - 1.0) * uTan.x * uCamR + (vUv.y * 2.0 - 1.0) * uTan.y * uCamU);
  float s = max(dot(dir, uRayDir), 0.0);
  float g = sky * (pow(s, 18.0) * 0.4 + pow(s, 120.0) * 1.2);
  gl_FragColor = vec4(bloom, g);
}
`;

/** Dual-filter (Kawase) downsample. */
export const DOWN_FRAG = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * 0.5;
  vec3 sum = texture2D(tInput, vUv).rgb * 4.0;
  sum += texture2D(tInput, vUv - o).rgb;
  sum += texture2D(tInput, vUv + o).rgb;
  sum += texture2D(tInput, vUv + vec2(o.x, -o.y)).rgb;
  sum += texture2D(tInput, vUv - vec2(o.x, -o.y)).rgb;
  gl_FragColor = vec4(sum / 8.0, 1.0);
}
`;

/** Dual-filter (Kawase) upsample, added onto the next finer level. */
export const UP_FRAG = /* glsl */ `
uniform sampler2D tInput;
uniform sampler2D tBase;
uniform vec2 uTexel;
uniform float uBaseWeight;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * 0.5;
  vec3 sum = texture2D(tInput, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
  sum += texture2D(tInput, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  sum += texture2D(tInput, vUv + vec2(0.0, o.y * 2.0)).rgb;
  sum += texture2D(tInput, vUv + vec2(o.x, o.y)).rgb * 2.0;
  sum += texture2D(tInput, vUv + vec2(o.x * 2.0, 0.0)).rgb;
  sum += texture2D(tInput, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  sum += texture2D(tInput, vUv + vec2(0.0, -o.y * 2.0)).rgb;
  sum += texture2D(tInput, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  gl_FragColor = vec4(sum / 12.0 + texture2D(tBase, vUv).rgb * uBaseWeight, 1.0);
}
`;

/** Screen-space radial blur of the godray source toward the light's screen position. */
export const RAYS_FRAG = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uLightPos;
uniform float uStrength;
uniform float uJitter;
varying vec2 vUv;
const int SAMPLES = 40;
void main() {
  vec2 delta = (uLightPos - vUv) / float(SAMPLES) * 0.95;
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uJitter) * 43758.5453);
  vec2 uv = vUv + delta * n;
  float decay = 1.0;
  float sum = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    sum += texture2D(tInput, uv).a * decay;
    decay *= 0.955;
    uv += delta;
  }
  gl_FragColor = vec4(vec3(sum / float(SAMPLES) * uStrength), 1.0);
}
`;

/** Final grading / composite pass to the screen (display-referred sRGB output). */
export const FINAL_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tRays;
uniform float uBloom;
uniform float uGodrays;
uniform vec3 uRayColor;
uniform float uExposure;
uniform vec3 uWhiteBalance;
uniform float uContrast;
uniform float uSaturation;
uniform float uGamma;
uniform float uGrayscale;
uniform float uSepia;
uniform float uPosterize;
uniform float uVignette;
uniform float uAspect;
uniform float uTime;
varying vec2 vUv;
${DECODE}

vec3 aces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 hdr = decodeHdr(texture2D(tScene, vUv).rgb);
  hdr += texture2D(tBloom, vUv).rgb * uBloom;
  hdr += texture2D(tRays, vUv).r * uRayColor * uGodrays;
  hdr *= uExposure * uWhiteBalance;
  vec3 c = toSrgb(aces(hdr));
  c = (c - 0.5) * uContrast + 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, uSaturation), 0.0, 1.0);
  c = pow(c, vec3(1.0 / max(uGamma, 0.05)));
  l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(l), uGrayscale);
  vec3 sep = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131)));
  c = mix(c, min(sep, vec3(1.0)), uSepia);
  if (uPosterize >= 2.0) {
    float lv = uPosterize - 1.0;
    c = floor(c * lv + 0.5) / lv;
  }
  vec2 q = vUv - 0.5;
  q.x *= uAspect;
  float vig = smoothstep(1.05, 0.25, length(q) * 1.25);
  c *= mix(1.0, vig, uVignette);
  c += (fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}
`;

export const CLOUD_VERT = /* glsl */ `
uniform float uCloudDrift;
uniform float uCloudPeriod;
attribute float aCenterX;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  float hp = uCloudPeriod * 0.5;
  float shifted = mod(aCenterX + uCloudDrift + hp, uCloudPeriod) - hp;
  vec3 p = position;
  p.x += shifted - aCenterX;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vNormal = normal;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const CLOUD_FRAG = /* glsl */ `
${COMMON}
uniform float uCloudFadeStart;
uniform float uCloudFadeEnd;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec3 n = normalize(vNormal);
  float ndl = max(dot(n, uLightDir), 0.0);
  vec3 col = uAmbientSky * 1.5 + uLightColor * (ndl * 0.6 + 0.22);
  col *= n.y > 0.5 ? 0.95 : (n.y < -0.5 ? 0.6 : 0.78);
  col = applyFog(col, vWorld);
  float fade = smoothstep(uCloudFadeStart, uCloudFadeEnd, length(vWorld.xz));
  gl_FragColor = vec4(encodeHdr(col), 0.78 * (1.0 - fade));
}
`;
