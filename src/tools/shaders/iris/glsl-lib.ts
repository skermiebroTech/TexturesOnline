// Shared GLSL include files (shaders/lib/*.glsl) of the generated pack, except settings.glsl
// which is generated from the chosen options. All code is GLSL 1.20 (#version 120) so it runs
// on OptiFine back to Minecraft 1.8.9 and through the compatibility transformers of Iris and
// OptiFine on 1.17+. Rules followed everywhere (see the loader pitfalls):
//  - ASCII only, no include guards, each lib included at most once per program;
//  - no integer overloads of min/max/abs, no reversed smoothstep edges, no pow() of negatives;
//  - no identifiers the loaders reserve or rename (texture, common, smooth, sample, outColorN, iris_*).

/** Block / entity / item IDs shared by block.properties, item.properties, entity.properties and the GLSL. */
export const IDS = {
  leaves: 10001,
  plant: 10002,
  tallLower: 10003,
  tallUpper: 10004,
  crop: 10005,
  vine: 10006,
  lilyPad: 10007,
  water: 10010,
  endPortal: 10015,
  lava: 10018,
  lightSource: 10019,
  glowing: 10020,
  lightning: 20001,
  itemBrightLight: 30001,
  itemGlow: 30002,
} as const;

export const UNIFORMS_GLSL = `// Non-sampler uniforms shared by every program. Unused ones are optimised away, and a
// uniform that a loader or game version does not provide simply reads 0.
uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;
uniform mat4 gbufferProjection;
uniform mat4 gbufferProjectionInverse;
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;
uniform vec3 cameraPosition;
uniform vec3 sunPosition;
uniform vec3 shadowLightPosition;
uniform vec3 upPosition;
uniform vec3 skyColor;
uniform vec3 fogColor;
uniform float frameTimeCounter;
uniform float rainStrength;
uniform float blindness;
uniform float darknessFactor;
uniform float viewWidth;
uniform float viewHeight;
uniform float aspectRatio;
uniform float far;
uniform int isEyeInWater;
uniform ivec2 eyeBrightnessSmooth;
uniform int heldBlockLightValue;
uniform int heldBlockLightValue2;
uniform int heldItemId;
uniform int heldItemId2;
`;

export const COMMON_GLSL = `// Shared helpers. Needs settings.glsl and uniforms.glsl first.

// IDs from block.properties / item.properties / entity.properties. Never 0: geometry that is
// not terrain reads 0, and unmapped blocks read -1.
const float ID_LEAVES     = ${IDS.leaves}.0;
const float ID_PLANT      = ${IDS.plant}.0;
const float ID_TALL_LOWER = ${IDS.tallLower}.0;
const float ID_TALL_UPPER = ${IDS.tallUpper}.0;
const float ID_CROP       = ${IDS.crop}.0;
const float ID_VINE       = ${IDS.vine}.0;
const float ID_LILY_PAD   = ${IDS.lilyPad}.0;
const float ID_WATER      = ${IDS.water}.0;
const float ID_LAVA       = ${IDS.lava}.0;
const float ID_LIGHT      = ${IDS.lightSource}.0;
const float ID_GLOWING    = ${IDS.glowing}.0;
const int BE_END_PORTAL     = ${IDS.endPortal};
const int ENTITY_LIGHTNING  = ${IDS.lightning};
const int ITEM_BRIGHT_LIGHT = ${IDS.itemBrightLight};
const int ITEM_GLOW         = ${IDS.itemGlow};

#if MC_VERSION >= 11800
const float CLOUD_ALTITUDE = 192.0;
#else
const float CLOUD_ALTITUDE = 128.0;
#endif

bool isId(float id, float target) { return abs(id - target) < 0.5; }

vec3 toLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
vec3 toSRGB(vec3 c)   { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }
float luma(vec3 c)    { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float maxOf(vec3 c)   { return max(c.r, max(c.g, c.b)); }
float minOf(vec3 c)   { return min(c.r, min(c.g, c.b)); }
vec3 optColor(float r, float g, float b) { return toLinear(vec3(r, g, b)); }

vec3 safeNormalize(vec3 v) {
	float l = length(v);
	return l > 1.0e-6 ? v / l : vec3(0.0, 1.0, 0.0);
}

// Interleaved gradient noise: stable per pixel, used to rotate sample patterns.
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

// Hash without sin() so it stays stable at large coordinates.
float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash12(i);
	float b = hash12(i + vec2(1.0, 0.0));
	float c = hash12(i + vec2(0.0, 1.0));
	float d = hash12(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float skyLightFrom(vec2 lm) { return clamp((lm.y - 0.03125) * 1.06667, 0.0, 1.0); }

// ---- Time of day (view-space vectors, provided every frame)
vec3 sunDirView() { return safeNormalize(sunPosition); }
vec3 upDirView()  { return safeNormalize(upPosition); }
float sunElevation() { return dot(sunDirView(), upDirView()); }
// 0 at night, 1 during the day
float dayAmount() { return smoothstep(-0.06, 0.20, sunElevation()); }
// 1 while the sun is near the horizon (sunrise / sunset), 0 otherwise
float twilightAmount() {
	float h = sunElevation();
	return exp(-h * h * 28.0);
}
// 1 under the open sky, 0 in caves and in dimensions without sky light (Nether, End)
float outdoorAmount() { return smoothstep(0.05, 0.60, float(eyeBrightnessSmooth.y) / 240.0); }
// How much of the custom sky palette replaces the vanilla biome colours right now
float skyBlend() { return SKY_CUSTOM * outdoorAmount(); }

// Colour of the direct light: the sun by day (warming towards the sunset colour while it is
// low), the moon by night. Linear HDR.
vec3 getLightColor() {
	float h = sunElevation();
	float low = 1.0 - smoothstep(0.02, 0.40, h);
	vec3 sunLight = mix(optColor(SUN_R, SUN_G, SUN_B), optColor(SUNSET_R, SUNSET_G, SUNSET_B) * 1.15, low * 0.75) * SUN_STRENGTH;
	vec3 moonLight = vec3(0.55, 0.65, 1.00) * (0.025 + 0.10 * NIGHT_BRIGHTNESS);
	vec3 c = h > 0.0 ? sunLight : moonLight;
	c *= smoothstep(0.0, 0.06, abs(h));
	return c * (1.0 - 0.85 * rainStrength);
}
`;

export const SKY_GLSL = `// Sky colours: the chosen palette for each time of day, blended with the vanilla biome
// colours by SKY_CUSTOM. Needs settings, uniforms and common.

vec3 paletteZenith() {
	float d = dayAmount();
	float tw = twilightAmount();
	vec3 c = mix(optColor(NIGHT_R, NIGHT_G, NIGHT_B), optColor(SKY_R, SKY_G, SKY_B), d);
	return mix(c, c * 0.55 + optColor(SUNSET_R, SUNSET_G, SUNSET_B) * 0.10, tw * 0.7);
}

vec3 paletteHorizon(vec3 viewDir) {
	float d = dayAmount();
	float tw = twilightAmount();
	vec3 night = optColor(NIGHT_R, NIGHT_G, NIGHT_B) * 1.6 + vec3(0.002, 0.003, 0.006);
	vec3 c = mix(night, optColor(HORIZON_R, HORIZON_G, HORIZON_B), d);
	float toSun = dot(viewDir, sunDirView()) * 0.5 + 0.5;
	vec3 glow = optColor(SUNSET_R, SUNSET_G, SUNSET_B) * (0.45 + 0.9 * toSun * toSun);
	return mix(c, glow, tw * (0.25 + 0.75 * toSun));
}

// Rain and thunder turn the palette grey (the vanilla colours already do this themselves).
vec3 rainTone(vec3 c) { return mix(c, vec3(luma(c) * 0.7), rainStrength * 0.8); }

vec3 skyZenith() { return mix(toLinear(skyColor), rainTone(paletteZenith()), skyBlend()); }
vec3 skyHorizon(vec3 viewDir) { return mix(toLinear(fogColor), rainTone(paletteHorizon(viewDir)), skyBlend()); }

vec3 sunGlowColor() {
	vec3 c = mix(optColor(SUN_R, SUN_G, SUN_B), optColor(SUNSET_R, SUNSET_G, SUNSET_B), twilightAmount());
	return c * (1.0 - 0.9 * rainStrength);
}

// Sky radiance (linear HDR) for a normalized view-space direction.
vec3 skyGradient(vec3 viewDir) {
	float y = dot(viewDir, upDirView());
	vec3 c = mix(skyZenith(), skyHorizon(viewDir), exp(-max(y, 0.0) * 5.0));
	c *= 1.0 - 0.6 * smoothstep(0.0, 0.5, -y);
	vec3 sunDir = sunDirView();
	float sd = max(dot(viewDir, sunDir), 0.0);
	float sunVisible = smoothstep(-0.12, 0.04, sunElevation());
	c += sunGlowColor() * ((0.05 * pow(sd, 3.0) + 0.30 * pow(sd, 40.0)) * sunVisible);
	float md = max(-dot(viewDir, sunDir), 0.0);
	c += vec3(0.30, 0.38, 0.60) * (0.015 * pow(md, 12.0) * (1.0 - dayAmount()));
	return c;
}

// A hint of the current sky colour for the ambient light.
vec3 ambientSkyTint() {
	vec3 z = skyZenith();
	float l = luma(z);
	vec3 n = l > 1.0e-3 ? min(z / l, vec3(2.5)) : vec3(1.0);
	return mix(vec3(1.0), n, 0.22);
}
`;

export const FOG_GLSL = `// Fog: distance haze (denser near sea level and at sunrise), rain, the render-distance border,
// underwater, lava, powder snow, blindness and darkness. Needs settings, uniforms, common, sky.

vec3 waterFogColor() {
	float outside = float(eyeBrightnessSmooth.y) / 240.0;
	float light = 0.02 + (0.03 + 0.30 * dayAmount() * (1.0 - 0.6 * rainStrength)) * outside * outside;
	return optColor(WATER_R, WATER_G, WATER_B) * light;
}

vec3 fogColorFor(vec3 viewDir) {
	vec3 c = skyHorizon(viewDir);
	float sd = max(dot(viewDir, sunDirView()), 0.0);
	c += sunGlowColor() * (0.12 * pow(sd, 4.0) * smoothstep(-0.1, 0.05, sunElevation()) * skyBlend());
	return c;
}

// Fog colour and amount (0..1) for a view-space position.
void fogParams(vec3 viewPos, out vec3 fogCol, out float amount) {
	float dist = length(viewPos);
	vec3 viewDir = viewPos / max(dist, 1.0e-4);
	float f = 0.0;
	if (isEyeInWater == 1) {
		fogCol = waterFogColor();
		f = 1.0 - exp(-dist * mix(0.22, 0.03, WATER_CLARITY));
	} else if (isEyeInWater == 2) {
		fogCol = vec3(1.0, 0.28, 0.03);
		f = 1.0 - exp(-dist * 1.2);
	} else if (isEyeInWater == 3) {
		fogCol = vec3(0.55, 0.65, 0.78);
		f = 1.0 - exp(-dist * 0.9);
	} else {
		fogCol = fogColorFor(viewDir);
		float y0 = cameraPosition.y;
		float y1 = (mat3(gbufferModelViewInverse) * viewPos).y + y0;
		float heightMul = 0.5 * (exp(-max(y0 - 62.0, 0.0) * 0.015) + exp(-max(y1 - 62.0, 0.0) * 0.015));
		float density = 0.0014 * FOG_DENSITY * heightMul * (1.0 + 0.8 * twilightAmount()) + 0.006 * RAIN_FOG * rainStrength;
		float atmo = 1.0 - exp(-dist * density);
		float border = smoothstep(far * 0.70, far, dist);
		f = max(atmo, border);
	}
	float blind = max(blindness, darknessFactor);
	f = mix(f, smoothstep(0.0, 6.0, dist), blind);
	fogCol *= 1.0 - blind;
	amount = clamp(f, 0.0, 1.0);
}

vec3 applyFog(vec3 color, vec3 viewPos) {
	vec3 fogCol = vec3(0.0);
	float amount = 0.0;
	fogParams(viewPos, fogCol, amount);
	return mix(color, fogCol, amount);
}
`;

export const WAVING_GLSL = `// Vertex animation shared by gbuffers_terrain, gbuffers_water and shadow. The shadow pass
// must use exactly the same offsets, or shadows would detach from the plants.

vec2 windAt(vec3 worldPos) {
	float t = frameTimeCounter * WAVING_SPEED;
	vec2 w = vec2(sin(t * 1.7 + worldPos.x * 0.9 + worldPos.z * 0.3 + worldPos.y * 0.5),
	              sin(t * 1.3 + worldPos.z * 1.1 + worldPos.x * 0.2 + worldPos.y * 0.3));
	w += 0.5 * vec2(sin(t * 3.1 + worldPos.z * 2.0), sin(t * 2.7 + worldPos.x * 2.3));
	float gust = 0.65 + 0.35 * sin(t * 0.35 + worldPos.x * 0.05 + worldPos.z * 0.04);
	return w * gust;
}

// Water height field (-1..1), its analytic gradient and small fast ripples.
float waterHeight(vec2 p) {
	float t = frameTimeCounter * WAVE_SPEED;
	return 0.50 * sin(dot(p, vec2( 0.80,  0.60)) * 0.9 + t * 1.3)
	     + 0.30 * sin(dot(p, vec2(-0.40,  0.92)) * 1.7 + t * 1.9)
	     + 0.20 * sin(dot(p, vec2( 0.95, -0.30)) * 3.1 + t * 2.7);
}

vec2 waterGradient(vec2 p) {
	float t = frameTimeCounter * WAVE_SPEED;
	return 0.50 * 0.9 * vec2( 0.80,  0.60) * cos(dot(p, vec2( 0.80,  0.60)) * 0.9 + t * 1.3)
	     + 0.30 * 1.7 * vec2(-0.40,  0.92) * cos(dot(p, vec2(-0.40,  0.92)) * 1.7 + t * 1.9)
	     + 0.20 * 3.1 * vec2( 0.95, -0.30) * cos(dot(p, vec2( 0.95, -0.30)) * 3.1 + t * 2.7);
}

vec2 waterRippleGradient(vec2 p) {
	float t = frameTimeCounter * WAVE_SPEED;
	return 0.5 * 7.3 * vec2( 0.31,  0.95) * cos(dot(p, vec2( 0.31,  0.95)) * 7.3 + t * 4.1)
	     + 0.5 * 9.1 * vec2(-0.87,  0.49) * cos(dot(p, vec2(-0.87,  0.49)) * 9.1 + t * 5.3);
}

// Vertical offset of the water surface. It only ever lowers the surface, so it never pokes
// through the block above.
float waterSurfaceOffset(vec2 p) { return (0.5 * waterHeight(p) - 0.5) * (0.08 * WAVE_HEIGHT); }

// worldPos = feet-space position + cameraPosition. isTop = vertex on the top edge of its sprite.
// skyLight = 0..1 sky light (no wind in caves).
vec3 waveOffset(vec3 worldPos, float id, bool isTop, float skyLight) {
	vec3 o = vec3(0.0);
	if (id < 10000.5 || id > 10007.5) return o;
	float amp = WAVING_STRENGTH * (0.75 + 0.75 * rainStrength) * smoothstep(0.2, 0.8, skyLight);
	vec2 w = windAt(worldPos);
	#ifdef WAVING_LEAVES
	if (isId(id, ID_LEAVES)) o = vec3(w.x, 0.35 * w.y, w.y) * (0.035 * amp);
	#endif
	#ifdef WAVING_PLANTS
	if ((isId(id, ID_PLANT) || isId(id, ID_TALL_LOWER)) && isTop) o.xz = w * (0.09 * amp);
	if (isId(id, ID_TALL_UPPER)) o.xz = w * ((isTop ? 0.16 : 0.09) * amp);
	#endif
	#ifdef WAVING_CROPS
	if (isId(id, ID_CROP) && isTop) o.xz = w * (0.06 * amp);
	#endif
	#ifdef WAVING_VINES
	if (isId(id, ID_VINE)) o.xz = w * (0.03 * amp);
	#endif
	#ifdef WATER_WAVES
	if (isId(id, ID_LILY_PAD)) o.y = waterSurfaceOffset(worldPos.xz);
	#endif
	return o;
}
`;

export const DISTORT_GLSL = `// Shadow-map distortion: more resolution close to the player. Shared by shadow.vsh and the
// lookup in shadows.glsl (both must match exactly). Input/output: shadow clip space.
const float SHADOW_DISTORT = 0.85;

vec3 distortShadowClip(vec3 p) {
	float f = mix(1.0, length(p.xy), SHADOW_DISTORT);
	return vec3(p.xy / f, p.z * 0.25);
}
`;

export const SHADOWS_GLSL = `// Fragment-stage shadow lookups. Needs settings, uniforms, common and distort.glsl.
#ifdef SHADOWS
uniform sampler2DShadow shadowtex0; // hardware depth compare (shadowHardwareFiltering)

// Soft shadows: percentage-closer filtering over a rotated Vogel disk. The blur radius is
// roughly constant in blocks, so it looks the same at every shadow resolution.
// Returns 1 = fully lit, 0 = fully shadowed.
float getShadow(vec3 feetPos, vec3 offsetDir) {
	vec4 clip = shadowProjection * (shadowModelView * vec4(feetPos, 1.0));
	float r = length(clip.xy);
	if (r > 1.0) return 1.0;
	float f = mix(1.0, r, SHADOW_DISTORT);
	float texelWorld = 2.0 * shadowDistance / float(shadowMapResolution) * (f * f) / (1.0 - SHADOW_DISTORT);
	vec3 biased = feetPos + offsetDir * (1.5 * texelWorld);
	clip = shadowProjection * (shadowModelView * vec4(biased, 1.0));
	vec3 sp = distortShadowClip(clip.xyz) * 0.5 + 0.5;
	sp.z -= 0.00004;

	float radius = (clamp(SHADOW_SOFTNESS * 0.045 / texelWorld, 0.0, 5.0) + 0.35) / float(shadowMapResolution);
	float angle = ign(gl_FragCoord.xy) * 6.2831853;
	float sum = 0.0;
	for (int i = 0; i < SHADOW_SAMPLES; i++) {
		float fi = float(i) + 0.5;
		float th = fi * 2.39996323 + angle;
		vec2 off = vec2(cos(th), sin(th)) * (sqrt(fi / float(SHADOW_SAMPLES)) * radius);
		sum += shadow2D(shadowtex0, vec3(sp.xy + off, sp.z)).x;
	}
	float s = sum / float(SHADOW_SAMPLES);
	return mix(s, 1.0, smoothstep(0.85, 1.0, r));
}
#endif

// Soft, drifting cloud shadows from procedural cloud cover (1 = no cloud).
float cloudShadow(vec3 feetPos, vec3 lightDir) {
	float s = 1.0;
	#ifdef CLOUD_SHADOWS
	vec3 wp = feetPos + cameraPosition;
	float ly = max(lightDir.y, 0.15);
	vec2 p = wp.xz + lightDir.xz / ly * (CLOUD_ALTITUDE - wp.y);
	p = p * 0.0045 + vec2(frameTimeCounter * 0.0025, frameTimeCounter * 0.0008);
	float n = valueNoise(p) * 0.55 + valueNoise(p * 2.3 + 7.1) * 0.30 + valueNoise(p * 5.1 + 3.7) * 0.15;
	float cover = smoothstep(0.42 - 0.25 * rainStrength, 0.72, n);
	s = 1.0 - 0.7 * cover;
	#endif
	return s;
}
`;

export const LIGHTING_GLSL = `// Forward lighting for the gbuffers programs (fragment stage).
// Needs settings, uniforms, common, sky, distort and shadows.glsl.
uniform sampler2D lightmap;

vec3 torchLightColor() { return optColor(TORCH_R, TORCH_G, TORCH_B); }

// Light level (0..1) of what the player holds in either hand.
float heldLightLevel() {
	float level = max(float(heldBlockLightValue), float(heldBlockLightValue2));
	if (heldItemId == ITEM_BRIGHT_LIGHT || heldItemId2 == ITEM_BRIGHT_LIGHT) level = max(level, 15.0);
	if (heldItemId == ITEM_GLOW || heldItemId2 == ITEM_GLOW) level = max(level, 10.0);
	return level / 15.0;
}

// Block light 0..1 from the lightmap, raised by the handheld light (1 level per block).
float blockLightFrom(vec2 lm, vec3 feetPos) {
	float b = clamp((lm.x - 0.03125) * 1.06667, 0.0, 1.0);
	#ifdef HAND_LIGHT
	b = max(b, clamp(heldLightLevel() - length(feetPos) / 15.0, 0.0, 1.0));
	#endif
	return b;
}

// Light falls off quickly away from the source, like a real lamp.
float blockLightCurve(float b) { return b * b * (0.12 + 1.10 * b); }

vec3 lightDirFeet() { return safeNormalize(mat3(gbufferModelViewInverse) * shadowLightPosition); }

// Sky ambient + night floor. The vanilla lightmap (sampled with block light 0) carries the day
// cycle, dimension ambient, the brightness slider, night vision and the darkness effect.
vec3 ambientLight(vec2 lm) {
	float skyL = skyLightFrom(lm);
	vec3 lmSky = toLinear(texture2D(lightmap, vec2(0.03125, lm.y)).rgb);
	float night = 1.0 - dayAmount();
	vec3 a = lmSky * ambientSkyTint() * (0.45 * AMBIENT_STRENGTH);
	a += vec3(0.50, 0.62, 1.00) * (skyL * night * (0.006 + 0.04 * NIGHT_BRIGHTNESS));
	a += vec3(0.60, 0.66, 0.78) * (0.003 + 0.012 * NIGHT_BRIGHTNESS);
	return a;
}

vec3 blockLight(vec2 lm, vec3 feetPos) {
	return torchLightColor() * (blockLightCurve(blockLightFrom(lm, feetPos)) * TORCH_STRENGTH);
}

// Lit colour of an opaque or translucent surface. albedo: linear. lm: lightmap coordinates.
// feetPos: player-space position. N: player-space normal. foliage: two-sided soft diffuse.
// sunLit receives how much direct light reaches the surface (0..1, after shadows).
vec3 shadeSurface(vec3 albedo, vec2 lm, vec3 feetPos, vec3 N, bool foliage, out float sunLit) {
	float skyL = skyLightFrom(lm);
	vec3 L = lightDirFeet();
	float NdotL = dot(N, L);
	float diffuse = foliage ? 0.35 + 0.65 * abs(NdotL) : max(NdotL, 0.0);
	float direct = diffuse * smoothstep(0.30, 0.85, skyL);
	float lit = 1.0;
	if (direct > 0.001) {
		#ifdef SHADOWS
		lit = getShadow(feetPos, foliage ? L : N);
		#endif
		lit *= cloudShadow(feetPos, L);
	}
	sunLit = direct * lit;
	lit = mix(SHADOW_BRIGHTNESS, 1.0, lit);
	vec3 light = ambientLight(lm) + blockLight(lm, feetPos) + getLightColor() * (direct * lit);
	return albedo * light;
}

// Cheaper lighting without shadows (particles, rain, lines).
vec3 shadeSimple(vec3 albedo, vec2 lm, vec3 feetPos) {
	float skyL = skyLightFrom(lm);
	vec3 light = ambientLight(lm) + blockLight(lm, feetPos) + getLightColor() * (0.5 * smoothstep(0.30, 0.85, skyL));
	return albedo * light;
}

// Extra glow of emissive blocks (added on top of the lit colour). srgb: texture colour.
float glowAmount(float id, vec3 srgb) {
	float gain = 0.6 + 0.8 * TORCH_STRENGTH;
	float m = maxOf(srgb);
	if (isId(id, ID_GLOWING)) return (0.35 + 0.65 * smoothstep(0.35, 0.85, m)) * gain;
	if (isId(id, ID_LIGHT)) return smoothstep(0.60, 0.92, m) * gain;
	if (isId(id, ID_LAVA)) return 1.2 * gain;
	return 0.0;
}
`;

/** lib path -> contents (settings.glsl is added by the generator). */
export const LIB_FILES: Record<string, string> = {
  'lib/uniforms.glsl': UNIFORMS_GLSL,
  'lib/common.glsl': COMMON_GLSL,
  'lib/sky.glsl': SKY_GLSL,
  'lib/fog.glsl': FOG_GLSL,
  'lib/waving.glsl': WAVING_GLSL,
  'lib/distort.glsl': DISTORT_GLSL,
  'lib/shadows.glsl': SHADOWS_GLSL,
  'lib/lighting.glsl': LIGHTING_GLSL,
};
