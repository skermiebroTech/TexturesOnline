// Program sources (shaders/<program>.vsh / .fsh) of the generated pack. GLSL 1.20 with
// DRAWBUFFERS and gl_FragData[<literal>] (one assignment per line) so OptiFine back to 1.8.9 and
// the core-profile rewrites of Iris / OptiFine on 1.17+ all accept them.
//
// Buffers: colortex0 = HDR scene (RGBA16F), colortex2 = bloom bright-pass (RGBA16F, mipmapped),
// colortex3 = water mask written by gbuffers_water (R: water, G: sky light, B: 1 - reflection).
// Passes: shadow -> gbuffers (forward lighting + fog) -> composite (water depth tint, god rays,
// bloom bright-pass) -> composite1 (bloom blur + add) -> final (exposure, tone mapping, grading).

const inc = (...libs: string[]): string => libs.map((l) => `#include "/lib/${l}.glsl"`).join('\n');

const LIT_FSH_LIBS = inc('settings', 'uniforms', 'common', 'sky', 'fog', 'distort', 'shadows', 'lighting');

// ------------------------------------------------------------------ shared vertex shaders

/** Entities, block entities and the hand: position, normal and lighting data. */
const litVsh = (comment: string): string => `#version 120
// ${comment}
${inc('settings', 'uniforms', 'common')}

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 glcolor;
varying vec3 viewPos;
varying vec3 feetPos;
varying vec3 feetNormal;

void main() {
	texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
	lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
	glcolor  = gl_Color;
	feetNormal = mat3(gbufferModelViewInverse) * safeNormalize(gl_NormalMatrix * gl_Normal);
	vec4 vpos = gl_ModelViewMatrix * gl_Vertex;
	viewPos = vpos.xyz;
	feetPos = (gbufferModelViewInverse * vpos).xyz;
	gl_Position = ftransform();
}
`;

/** Particles, rain, lines: texture + lightmap + position for fog. */
const simpleVsh = (comment: string): string => `#version 120
// ${comment}
${inc('settings', 'uniforms')}

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 glcolor;
varying vec3 viewPos;
varying vec3 feetPos;

void main() {
	texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
	lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
	glcolor  = gl_Color;
	vec4 vpos = gl_ModelViewMatrix * gl_Vertex;
	viewPos = vpos.xyz;
	feetPos = (gbufferModelViewInverse * vpos).xyz;
	gl_Position = ftransform();
}
`;

/** Unlit textured geometry (sun, moon, glint, beams, cracks, eyes). */
const texVsh = (comment: string): string => `#version 120
// ${comment}

varying vec2 texcoord;
varying vec4 glcolor;
varying vec3 viewPos;

void main() {
	texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
	glcolor  = gl_Color;
	viewPos  = (gl_ModelViewMatrix * gl_Vertex).xyz;
	gl_Position = ftransform();
}
`;

/** Full-screen passes. */
const screenVsh = (comment: string): string => `#version 120
// ${comment}

varying vec2 texcoord;

void main() {
	gl_Position = ftransform();
	texcoord = gl_MultiTexCoord0.xy;
}
`;

const LIT_VARYINGS = `varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 glcolor;
varying vec3 viewPos;
varying vec3 feetPos;
varying vec3 feetNormal;`;

// ------------------------------------------------------------------ terrain

const TERRAIN_VSH = `#version 120
// Opaque and cutout terrain: waving plants, bobbing lily pads and forward lighting data.
${inc('settings', 'uniforms', 'common', 'waving')}

attribute vec4 mc_Entity;       // x = block ID from block.properties (-1 when unmapped)
attribute vec4 mc_midTexCoord;  // centre of the block's sprite in the atlas

${LIT_VARYINGS}
varying float blockId;

void main() {
	texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
	lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
	glcolor  = gl_Color;
	blockId  = mc_Entity.x;
	feetNormal = mat3(gbufferModelViewInverse) * safeNormalize(gl_NormalMatrix * gl_Normal);

	vec4 vpos = gl_ModelViewMatrix * gl_Vertex;
	vec3 fpos = (gbufferModelViewInverse * vpos).xyz;
	bool isTop = gl_MultiTexCoord0.t < mc_midTexCoord.t;
	vec3 offset = waveOffset(fpos + cameraPosition, blockId, isTop, skyLightFrom(lmcoord));
	if (dot(offset, offset) > 0.0) {
		fpos += offset;
		vpos = gbufferModelView * vec4(fpos, 1.0);
		gl_Position = gl_ProjectionMatrix * vpos;
	} else {
		gl_Position = ftransform(); // same transform as every other program: no z-fighting
	}
	viewPos = vpos.xyz;
	feetPos = fpos;
}
`;

const TERRAIN_FSH = `#version 120
${LIT_FSH_LIBS}

uniform sampler2D gtexture;

${LIT_VARYINGS}
varying float blockId;

/* DRAWBUFFERS:0 */
void main() {
	vec4 albedo = texture2D(gtexture, texcoord) * glcolor;
	if (albedo.a < 0.1) discard;
	vec3 base = toLinear(albedo.rgb);
	bool foliage = blockId > 10000.5 && blockId < 10007.5;
	float sunLit = 0.0;
	vec3 color = shadeSurface(base, lmcoord, feetPos, safeNormalize(feetNormal), foliage, sunLit);
	color += base * glowAmount(blockId, albedo.rgb);
	gl_FragData[0] = vec4(applyFog(color, viewPos), albedo.a);
}
`;

// ------------------------------------------------------------------ water & translucent terrain

const WATER_VSH = `#version 120
// Translucent terrain: water, stained glass, ice, slime, honey, nether portals.
${inc('settings', 'uniforms', 'common', 'waving')}

attribute vec4 mc_Entity;

${LIT_VARYINGS}
varying float blockId;

void main() {
	texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
	lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
	glcolor  = gl_Color;
	blockId  = mc_Entity.x;
	feetNormal = mat3(gbufferModelViewInverse) * safeNormalize(gl_NormalMatrix * gl_Normal);

	vec4 vpos = gl_ModelViewMatrix * gl_Vertex;
	vec3 fpos = (gbufferModelViewInverse * vpos).xyz;
	gl_Position = ftransform();
	#ifdef WATER_WAVES
	float h = fract(fpos.y + cameraPosition.y);
	// Every vertex at the height of the water surface moves: the surface itself (both of its
	// sides) and the upper edge of side faces, so no gap opens where water meets air. Vertices on
	// block boundaries (the bottom of the water, full-height sides) stay put.
	if (isId(blockId, ID_WATER) && h > 0.05 && h < 0.95) {
		fpos.y += waterSurfaceOffset(fpos.xz + cameraPosition.xz);
		vpos = gbufferModelView * vec4(fpos, 1.0);
		gl_Position = gl_ProjectionMatrix * vpos;
	}
	#endif
	viewPos = vpos.xyz;
	feetPos = fpos;
}
`;

const WATER_FSH = `#version 120
${inc('settings', 'uniforms', 'common', 'sky', 'fog', 'waving', 'distort', 'shadows', 'lighting')}

uniform sampler2D gtexture;

${LIT_VARYINGS}
varying float blockId;

/* DRAWBUFFERS:03 */
void main() {
	vec4 tex = texture2D(gtexture, texcoord);
	vec4 albedo = tex * glcolor;
	bool water = isId(blockId, ID_WATER);
	vec3 N = safeNormalize(feetNormal);
	vec3 worldPos = feetPos + cameraPosition;
	vec3 base = toLinear(albedo.rgb);
	float alpha = albedo.a;
	float skyL = skyLightFrom(lmcoord);
	float fres = 0.0;

	if (water) {
		base = mix(base, optColor(WATER_R, WATER_G, WATER_B), 0.8) * (0.7 + 0.6 * luma(tex.rgb));
		alpha = mix(0.88, 0.14, WATER_CLARITY);
		#ifdef WATER_WAVES
		if (abs(N.y) > 0.5) {
			vec2 g = waterGradient(worldPos.xz) * (0.06 * WAVE_HEIGHT + 0.02) + waterRippleGradient(worldPos.xz) * (0.01 + 0.015 * WAVE_HEIGHT);
			N = normalize(vec3(-g.x, N.y > 0.0 ? 1.0 : -1.0, -g.y));
		}
		#endif
	}

	float sunLit = 0.0;
	vec3 color = shadeSurface(base, lmcoord, feetPos, N, false, sunLit);
	color += base * glowAmount(blockId, albedo.rgb);

	if (water && isEyeInWater == 0) {
		vec3 V = safeNormalize(feetPos);
		vec3 R = reflect(V, N);
		R.y = abs(R.y);
		float cosT = clamp(dot(-V, N), 0.0, 1.0);
		fres = clamp((0.02 + 0.98 * pow(1.0 - cosT, 5.0)) * WATER_REFLECTIONS, 0.0, 1.0);
		vec3 refl = skyGradient(safeNormalize(mat3(gbufferModelView) * R)) * smoothstep(0.2, 0.9, skyL);
		color = mix(color, refl, fres);
		alpha = mix(alpha, 1.0, fres);
		float spec = pow(max(dot(R, lightDirFeet()), 0.0), 600.0) * 14.0 * min(WATER_REFLECTIONS, 1.0);
		vec3 glint = getLightColor() * (spec * sunLit);
		color += glint;
		alpha = clamp(alpha + luma(glint), 0.0, 1.0);
	}

	gl_FragData[0] = vec4(applyFog(color, viewPos), alpha);
	gl_FragData[1] = vec4(water ? 1.0 : 0.0, skyL, 1.0 - fres, 1.0);
}
`;

// ------------------------------------------------------------------ entities, block entities, hand

const ENTITIES_FSH = `#version 120
${LIT_FSH_LIBS}

uniform sampler2D gtexture;
uniform vec4 entityColor; // hurt / creeper flash, alpha = strength
uniform int entityId;     // from entity.properties

${LIT_VARYINGS}

/* DRAWBUFFERS:0 */
void main() {
	if (entityId == ENTITY_LIGHTNING) {
		gl_FragData[0] = vec4(toLinear(glcolor.rgb) * 6.0, glcolor.a);
		return;
	}
	vec4 albedo = texture2D(gtexture, texcoord) * glcolor;
	if (albedo.a < 0.1) discard;
	albedo.rgb = mix(albedo.rgb, entityColor.rgb, entityColor.a);
	float sunLit = 0.0;
	vec3 color = shadeSurface(toLinear(albedo.rgb), lmcoord, feetPos, safeNormalize(feetNormal), false, sunLit);
	gl_FragData[0] = vec4(applyFog(color, viewPos), albedo.a);
}
`;

const BLOCK_FSH = `#version 120
${LIT_FSH_LIBS}

uniform sampler2D gtexture;
uniform int blockEntityId; // from block.properties

${LIT_VARYINGS}

// Drifting star field for end portals and end gateways.
vec3 endPortalColor() {
	vec2 uv = gl_FragCoord.xy / max(viewHeight, 1.0);
	vec3 col = vec3(0.004, 0.012, 0.016);
	for (int i = 0; i < 4; i++) {
		float fi = float(i);
		vec2 p = uv * (18.0 + fi * 14.0) + vec2(frameTimeCounter * (0.02 + 0.01 * fi), fi * 3.7);
		vec2 cell = floor(p);
		float star = step(0.9, hash12(cell + fi * 17.0)) * (1.0 - smoothstep(0.0, 0.14, length(fract(p) - 0.5)));
		col += star * mix(vec3(0.20, 0.80, 0.70), vec3(0.50, 0.40, 1.00), hash12(cell * 1.7 + 3.0)) * (1.2 - 0.2 * fi);
	}
	return col;
}

/* DRAWBUFFERS:0 */
void main() {
	if (blockEntityId == BE_END_PORTAL) {
		gl_FragData[0] = vec4(endPortalColor(), 1.0);
		return;
	}
	vec4 albedo = texture2D(gtexture, texcoord) * glcolor;
	if (albedo.a < 0.1) discard;
	float sunLit = 0.0;
	vec3 color = shadeSurface(toLinear(albedo.rgb), lmcoord, feetPos, safeNormalize(feetNormal), false, sunLit);
	gl_FragData[0] = vec4(applyFog(color, viewPos), albedo.a);
}
`;

const HAND_FSH = `#version 120
${LIT_FSH_LIBS}

uniform sampler2D gtexture;

${LIT_VARYINGS}

/* DRAWBUFFERS:0 */
void main() {
	vec4 albedo = texture2D(gtexture, texcoord) * glcolor;
	if (albedo.a < 0.1) discard;
	// The hand has its own projection; the shadow lookup at the camera is a close approximation.
	float sunLit = 0.0;
	vec3 color = shadeSurface(toLinear(albedo.rgb), lmcoord, feetPos, safeNormalize(feetNormal), false, sunLit);
	// No fog on the hand.
	gl_FragData[0] = vec4(color, albedo.a);
}
`;

// ------------------------------------------------------------------ particles, rain, lines

const TEXTURED_FSH = `#version 120
${LIT_FSH_LIBS}

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 glcolor;
varying vec3 viewPos;
varying vec3 feetPos;

/* DRAWBUFFERS:0 */
void main() {
	vec4 c = texture2D(gtexture, texcoord) * glcolor;
	if (c.a < 0.004) discard;
	vec3 color = shadeSimple(toLinear(c.rgb), lmcoord, feetPos);
	gl_FragData[0] = vec4(applyFog(color, viewPos), c.a);
}
`;

const WEATHER_FSH = `#version 120
${LIT_FSH_LIBS}

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 glcolor;
varying vec3 viewPos;
varying vec3 feetPos;

/* DRAWBUFFERS:0 */
void main() {
	vec4 c = texture2D(gtexture, texcoord) * glcolor;
	if (c.a < 0.004) discard;
	vec3 color = shadeSimple(toLinear(c.rgb), lmcoord, feetPos) * 1.4;
	gl_FragData[0] = vec4(applyFog(color, viewPos), c.a * 0.8);
}
`;

const BASIC_VSH = `#version 120
// Untextured geometry: leads, block outlines (gbuffers_line falls back here), debug lines.
${inc('settings', 'uniforms')}

varying vec2 lmcoord;
varying vec4 glcolor;
varying vec3 viewPos;
varying vec3 feetPos;

void main() {
	lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
	glcolor  = gl_Color;
	vec4 vpos = gl_ModelViewMatrix * gl_Vertex;
	viewPos = vpos.xyz;
	feetPos = (gbufferModelViewInverse * vpos).xyz;
	gl_Position = ftransform();
}
`;

const BASIC_FSH = `#version 120
${LIT_FSH_LIBS}

varying vec2 lmcoord;
varying vec4 glcolor;
varying vec3 viewPos;
varying vec3 feetPos;

/* DRAWBUFFERS:0 */
void main() {
	vec3 color = shadeSimple(toLinear(glcolor.rgb), lmcoord, feetPos);
	gl_FragData[0] = vec4(applyFog(color, viewPos), glcolor.a);
}
`;

// ------------------------------------------------------------------ unlit / emissive

const DAMAGED_FSH = `#version 120
// Block-breaking cracks use multiplicative blending: keep them unlit.

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec4 glcolor;
varying vec3 viewPos;

/* DRAWBUFFERS:0 */
void main() {
	vec4 c = texture2D(gtexture, texcoord) * glcolor;
	if (c.a < 0.004) discard;
	gl_FragData[0] = c;
}
`;

const BEACON_FSH = `#version 120
${inc('settings', 'uniforms', 'common')}

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec4 glcolor;
varying vec3 viewPos;

/* DRAWBUFFERS:0 */
void main() {
	vec4 c = texture2D(gtexture, texcoord) * glcolor;
	if (c.a < 0.004) discard;
	gl_FragData[0] = vec4(toLinear(c.rgb) * 2.5, c.a);
}
`;

const GLINT_FSH = `#version 120
// Enchantment glint is added on top of the item: fade it out with the fog instead of fogging it.
${inc('settings', 'uniforms', 'common', 'sky', 'fog')}

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec4 glcolor;
varying vec3 viewPos;

/* DRAWBUFFERS:0 */
void main() {
	vec4 c = texture2D(gtexture, texcoord) * glcolor;
	vec3 fogCol = vec3(0.0);
	float fogAmount = 0.0;
	fogParams(viewPos, fogCol, fogAmount);
	gl_FragData[0] = vec4(toLinear(c.rgb) * (1.2 * (1.0 - fogAmount)), c.a);
}
`;

const SPIDEREYES_FSH = `#version 120
// Glowing eyes of spiders, endermen and the ender dragon.
${inc('settings', 'uniforms', 'common')}

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec4 glcolor;
varying vec3 viewPos;

/* DRAWBUFFERS:0 */
void main() {
	vec4 c = texture2D(gtexture, texcoord) * glcolor;
	if (c.a < 0.004) discard;
	gl_FragData[0] = vec4(toLinear(c.rgb) * 2.0, c.a);
}
`;

// ------------------------------------------------------------------ sky & clouds

const SKYBASIC_VSH = `#version 120
// Sky dome, sunrise/sunset fan, stars and the dark lower half of the sky.

varying vec4 glcolor;
varying float starData;

void main() {
	glcolor = gl_Color;
	// Star detection for loaders without render stages: stars are the only grey sky vertices.
	starData = float(gl_Color.r == gl_Color.g && gl_Color.g == gl_Color.b && gl_Color.r > 0.0);
	gl_Position = ftransform();
}
`;

const SKYBASIC_FSH = `#version 120
${inc('settings', 'uniforms', 'common', 'sky', 'fog')}

#ifdef MC_RENDER_STAGE_STARS
uniform int renderStage;
#endif

varying vec4 glcolor;
varying float starData;

/* DRAWBUFFERS:0 */
void main() {
	bool star = starData > 0.5;
	bool sunset = false;
	#ifdef MC_RENDER_STAGE_STARS
	star = renderStage == MC_RENDER_STAGE_STARS;
	sunset = renderStage == MC_RENDER_STAGE_SUNSET;
	#endif

	vec4 ndc = vec4(gl_FragCoord.xy / vec2(viewWidth, viewHeight) * 2.0 - 1.0, 1.0, 1.0);
	vec4 v = gbufferProjectionInverse * ndc;
	vec3 viewDir = safeNormalize(v.xyz / v.w);

	vec4 result;
	if (star) {
		float visible = (1.0 - dayAmount()) * (1.0 - rainStrength);
		result = vec4(toLinear(glcolor.rgb) * (1.6 * visible), glcolor.a);
	} else if (sunset) {
		vec3 fan = mix(toLinear(glcolor.rgb), optColor(SUNSET_R, SUNSET_G, SUNSET_B), skyBlend());
		result = vec4(fan * 0.8, glcolor.a * (1.0 - 0.4 * skyBlend()));
	} else {
		result = vec4(skyGradient(viewDir), 1.0);
	}
	if (isEyeInWater != 0) {
		// From inside water (or lava / powder snow on old versions that still draw the sky) the
		// sky disappears in that fog.
		if (star || sunset) discard;
		result = vec4(mediumFogColor(), 1.0);
	}
	result.rgb *= 1.0 - max(blindness, darknessFactor);
	gl_FragData[0] = result;
}
`;

const SKYTEXTURED_FSH = `#version 120
${inc('settings', 'uniforms', 'common', 'sky')}

#ifdef MC_RENDER_STAGE_SUN
uniform int renderStage;
#endif

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec4 glcolor;
varying vec3 viewPos;

/* DRAWBUFFERS:0 */
void main() {
	// No sun, moon or custom sky from inside water, lava or powder snow.
	if (isEyeInWater != 0) discard;
	vec4 c = texture2D(gtexture, texcoord) * glcolor;
	vec3 col = toLinear(c.rgb);
	#ifdef MC_RENDER_STAGE_SUN
	if (renderStage == MC_RENDER_STAGE_SUN) col *= sunGlowColor() * 4.0;
	if (renderStage == MC_RENDER_STAGE_MOON) col *= 1.6;
	#else
	col *= 2.0;
	#endif
	col *= 1.0 - max(blindness, darknessFactor);
	gl_FragData[0] = vec4(col, c.a);
}
`;

const CLOUDS_FSH = `#version 120
${inc('settings', 'uniforms', 'common', 'sky', 'fog')}

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec4 glcolor;
varying vec3 viewPos;

/* DRAWBUFFERS:0 */
void main() {
	vec4 c = glcolor;
	#if MC_VERSION < 12102
	c *= texture2D(gtexture, texcoord); // clouds have no texture from 1.21.2 on
	#endif
	if (c.a < 0.004) discard;
	vec3 base = toLinear(c.rgb) * 0.9;
	base = mix(base, base * optColor(SUNSET_R, SUNSET_G, SUNSET_B) * 1.8, twilightAmount() * skyBlend() * 0.55);
	// Clouds are far away: fade them into the sky instead of the render-distance fog.
	vec3 color = mix(base, skyGradient(safeNormalize(viewPos)), clamp(length(viewPos) / (far * 4.0), 0.0, 0.85));
	// From inside water, lava or powder snow the clouds sink into that fog like everything else.
	if (isEyeInWater != 0) color = applyFog(color, viewPos);
	gl_FragData[0] = vec4(color * (1.0 - max(blindness, darknessFactor)), c.a);
}
`;

// ------------------------------------------------------------------ shadow pass

const SHADOW_VSH = `#version 120
// Shadow map pass: everything that casts shadows, with the same waving as the terrain.
${inc('settings', 'uniforms', 'common', 'waving', 'distort')}

uniform mat4 shadowModelViewInverse;

attribute vec4 mc_Entity;
attribute vec4 mc_midTexCoord;

varying vec2 texcoord;
varying vec4 glcolor;
varying float blockId;

void main() {
	texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
	glcolor  = gl_Color;
	blockId  = mc_Entity.x;
	vec2 lm  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;

	// In the shadow pass gl_ModelViewMatrix is the shadow model-view matrix.
	vec4 spos = gl_ModelViewMatrix * gl_Vertex;
	vec3 fpos = (shadowModelViewInverse * spos).xyz;
	bool isTop = gl_MultiTexCoord0.t < mc_midTexCoord.t;
	fpos += waveOffset(fpos + cameraPosition, blockId, isTop, skyLightFrom(lm));

	vec4 clip = gl_ProjectionMatrix * (shadowModelView * vec4(fpos, 1.0));
	clip.xyz = distortShadowClip(clip.xyz);
	gl_Position = clip;
}
`;

const SHADOW_FSH = `#version 120
${inc('settings', 'uniforms', 'common')}

uniform sampler2D gtexture;

varying vec2 texcoord;
varying vec4 glcolor;
varying float blockId;

/* DRAWBUFFERS:0 */
void main() {
	vec4 c = texture2D(gtexture, texcoord) * glcolor;
	if (c.a < 0.1) discard;
	if (isId(blockId, ID_WATER)) discard; // water never casts shadows
	gl_FragData[0] = c;
}
`;

// ------------------------------------------------------------------ post-processing

const COMPOSITE_FSH = `#version 120
${inc('settings', 'uniforms', 'common')}

/*
const int colortex0Format = RGBA16F;
const int colortex2Format = RGBA16F;
const int colortex3Format = RGBA8;
*/

uniform sampler2D colortex0;
uniform sampler2D colortex3;
uniform sampler2D depthtex0;
uniform sampler2D depthtex1;

varying vec2 texcoord;

vec3 screenToView(vec2 uv, float depth) {
	vec4 p = gbufferProjectionInverse * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
	return p.xyz / p.w;
}

/* DRAWBUFFERS:02 */
void main() {
	vec3 color = max(texture2D(colortex0, texcoord).rgb, vec3(0.0));
	vec4 waterMask = texture2D(colortex3, texcoord);
	float d0 = texture2D(depthtex0, texcoord).r;
	float d1 = texture2D(depthtex1, texcoord).r;

	// Deeper water gets closer to the water colour.
	if (waterMask.r > 0.5 && isEyeInWater == 0 && d1 > d0) {
		float depth = min(length(screenToView(texcoord, d1) - screenToView(texcoord, d0)), 64.0);
		float absorb = (1.0 - exp(-depth * mix(0.45, 0.04, WATER_CLARITY))) * waterMask.b;
		float sky = waterMask.g * waterMask.g;
		float light = 0.004 + sky * (0.03 + 0.35 * dayAmount() * (1.0 - 0.6 * rainStrength));
		color = mix(color, optColor(WATER_R, WATER_G, WATER_B) * light, absorb * 0.9);
	}

	#ifdef GODRAYS
	vec4 lightClip = gbufferProjection * vec4(shadowLightPosition, 1.0);
	float facing = smoothstep(0.0, 0.25, -safeNormalize(shadowLightPosition).z);
	float outside = float(eyeBrightnessSmooth.y) / 240.0;
	float vis = facing * outside * (1.0 - rainStrength) * float(isEyeInWater == 0) * (1.0 - max(blindness, darknessFactor));
	if (vis > 0.001 && lightClip.w > 0.0) {
		vec2 lightUV = lightClip.xy / lightClip.w * 0.5 + 0.5;
		vec2 delta = (lightUV - texcoord) / float(GODRAYS_SAMPLES);
		vec2 uv = texcoord + delta * ign(gl_FragCoord.xy);
		float acc = 0.0;
		for (int i = 0; i < GODRAYS_SAMPLES; i++) {
			float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
			acc += inside * step(1.0, texture2D(depthtex0, clamp(uv, 0.0, 1.0)).r); // depth 1 = sky
			uv += delta;
		}
		acc /= float(GODRAYS_SAMPLES);
		float falloff = exp(-2.5 * length((texcoord - lightUV) * vec2(aspectRatio, 1.0)));
		vec3 rayColor = getLightColor() * (0.6 + 0.8 * twilightAmount());
		color += rayColor * (acc * falloff * vis * 0.3 * GODRAYS_STRENGTH * (0.7 + 0.3 * FOG_DENSITY));
	}
	#endif

	vec3 bright = vec3(0.0);
	#ifdef BLOOM
	float l = luma(color);
	float knee = 0.5 * BLOOM_THRESHOLD + 1.0e-4;
	float soft = clamp(l - BLOOM_THRESHOLD + knee, 0.0, 2.0 * knee);
	soft = soft * soft / (4.0 * knee);
	bright = color * (max(soft, l - BLOOM_THRESHOLD) / max(l, 1.0e-4));
	#endif

	gl_FragData[0] = vec4(color, 1.0);
	gl_FragData[1] = vec4(min(bright, vec3(64.0)), 1.0);
}
`;

const COMPOSITE1_FSH = `#version 120
${inc('settings', 'uniforms')}

const bool colortex2MipmapEnabled = true; // build mip levels of the bright-pass before this pass

uniform sampler2D colortex0;
uniform sampler2D colortex2;

varying vec2 texcoord;

/* DRAWBUFFERS:0 */
void main() {
	vec3 color = texture2D(colortex0, texcoord).rgb;
	vec3 bloom = vec3(0.0);
	float total = 0.0;
	for (int i = 1; i <= 6; i++) {
		float lod = float(i);
		vec2 px = exp2(lod) / vec2(viewWidth, viewHeight) * 0.5;
		// Full-screen pass: the base level of detail is 0, so the bias selects the mip level.
		vec3 s = texture2D(colortex2, texcoord + vec2( px.x,  px.y), lod).rgb
		       + texture2D(colortex2, texcoord + vec2(-px.x,  px.y), lod).rgb
		       + texture2D(colortex2, texcoord + vec2( px.x, -px.y), lod).rgb
		       + texture2D(colortex2, texcoord + vec2(-px.x, -px.y), lod).rgb;
		float w = 1.0 / lod;
		bloom += s * (0.25 * w);
		total += w;
	}
	color += bloom / total * (BLOOM_STRENGTH * 2.0);
	gl_FragData[0] = vec4(color, 1.0);
}
`;

const FINAL_FSH = `#version 120
${inc('settings', 'uniforms', 'common')}

uniform sampler2D colortex0;

varying vec2 texcoord;

#if TONEMAP == 1
const float TONEMAP_GAIN = 1.9;
#elif TONEMAP == 2
const float TONEMAP_GAIN = 1.0;
#elif TONEMAP == 3
const float TONEMAP_GAIN = 2.0;
#else
const float TONEMAP_GAIN = 1.3;
#endif

vec3 tonemapReinhard(vec3 c) { return c / (1.0 + c); }

vec3 tonemapACES(vec3 x) { // Narkowicz 2015 fit
	return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 hable(vec3 x) {
	const float A = 0.15;
	const float B = 0.50;
	const float C = 0.10;
	const float D = 0.20;
	const float E = 0.02;
	const float F = 0.30;
	return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

vec3 tonemapFilmic(vec3 c) { return clamp(hable(c * 2.0) / hable(vec3(11.2)), 0.0, 1.0); }

// Brighter at night and in caves so the scene stays readable (follows eye brightness smoothly).
float autoExposure() {
	float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;
	float bright = eyeSky * smoothstep(-0.15, 0.10, sunElevation()) * (1.0 - 0.3 * rainStrength);
	return mix(1.25 + 1.25 * NIGHT_BRIGHTNESS, 1.0, bright);
}

vec3 whiteBalance() {
	vec3 wb = vec3(1.0 + 0.30 * TEMPERATURE, 1.0 + 0.05 * TEMPERATURE, 1.0 - 0.30 * TEMPERATURE);
	wb *= vec3(1.0 + 0.15 * TINT, 1.0 - 0.15 * TINT, 1.0 + 0.15 * TINT);
	return wb / max(luma(wb), 1.0e-3);
}

void main() {
	vec3 c = max(texture2D(colortex0, texcoord).rgb, vec3(0.0));
	c *= exp2(EXPOSURE) * autoExposure() * TONEMAP_GAIN;
	c *= whiteBalance();

	#if TONEMAP == 1
	c = tonemapReinhard(c);
	#elif TONEMAP == 2
	c = tonemapACES(c);
	#elif TONEMAP == 3
	c = tonemapFilmic(c);
	#else
	c = clamp(c, 0.0, 1.0);
	#endif

	c = toSRGB(c);
	float chroma = maxOf(c) - minOf(c);
	c = mix(vec3(luma(c)), c, 1.0 + VIBRANCE * (1.0 - chroma));
	c = mix(vec3(luma(c)), c, SATURATION);
	c = (c - 0.5) * CONTRAST + 0.5;
	c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / GAMMA));

	vec2 d = (texcoord - 0.5) * vec2(aspectRatio, 1.0);
	c *= 1.0 - VIGNETTE_STRENGTH * smoothstep(0.35, 1.2, length(d));

	c += (ign(gl_FragCoord.xy) - 0.5) / 255.0; // dither against banding
	gl_FragData[0] = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

/** Program sources, relative to shaders/. */
export const PROGRAM_FILES: Record<string, string> = {
  'gbuffers_basic.vsh': BASIC_VSH,
  'gbuffers_basic.fsh': BASIC_FSH,
  'gbuffers_textured.vsh': simpleVsh('Particles (gbuffers_textured_lit falls back here).'),
  'gbuffers_textured.fsh': TEXTURED_FSH,
  'gbuffers_weather.vsh': simpleVsh('Rain and snow.'),
  'gbuffers_weather.fsh': WEATHER_FSH,
  'gbuffers_skybasic.vsh': SKYBASIC_VSH,
  'gbuffers_skybasic.fsh': SKYBASIC_FSH,
  'gbuffers_skytextured.vsh': texVsh('Sun, moon and custom sky textures.'),
  'gbuffers_skytextured.fsh': SKYTEXTURED_FSH,
  'gbuffers_clouds.vsh': texVsh('Vanilla clouds (OptiFine has no fallback for this program, so it is always shipped).'),
  'gbuffers_clouds.fsh': CLOUDS_FSH,
  'gbuffers_terrain.vsh': TERRAIN_VSH,
  'gbuffers_terrain.fsh': TERRAIN_FSH,
  'gbuffers_water.vsh': WATER_VSH,
  'gbuffers_water.fsh': WATER_FSH,
  'gbuffers_damagedblock.vsh': texVsh('Block-breaking crack overlay.'),
  'gbuffers_damagedblock.fsh': DAMAGED_FSH,
  'gbuffers_block.vsh': litVsh('Block entities: chests, signs, beds, banners, end portals.'),
  'gbuffers_block.fsh': BLOCK_FSH,
  'gbuffers_beaconbeam.vsh': texVsh('Beacon beams.'),
  'gbuffers_beaconbeam.fsh': BEACON_FSH,
  'gbuffers_entities.vsh': litVsh('Mobs, players, dropped items, item frames and lightning.'),
  'gbuffers_entities.fsh': ENTITIES_FSH,
  'gbuffers_armor_glint.vsh': texVsh('Enchantment glint.'),
  'gbuffers_armor_glint.fsh': GLINT_FSH,
  'gbuffers_spidereyes.vsh': texVsh('Glowing eyes.'),
  'gbuffers_spidereyes.fsh': SPIDEREYES_FSH,
  'gbuffers_hand.vsh': litVsh('First-person hand and held items (gbuffers_hand_water falls back here).'),
  'gbuffers_hand.fsh': HAND_FSH,
  'shadow.vsh': SHADOW_VSH,
  'shadow.fsh': SHADOW_FSH,
  'composite.vsh': screenVsh('Full-screen pass: water depth tint, god rays and bloom bright-pass.'),
  'composite.fsh': COMPOSITE_FSH,
  'composite1.vsh': screenVsh('Full-screen pass: bloom blur and combine.'),
  'composite1.fsh': COMPOSITE1_FSH,
  'final.vsh': screenVsh('Final pass: exposure, tone mapping, color grading and vignette.'),
  'final.fsh': FINAL_FSH,
};

/** Program names (without extension) the pack ships. */
export const PROGRAMS: string[] = [...new Set(Object.keys(PROGRAM_FILES).map((p) => p.replace(/\.(vsh|fsh)$/, '')))];
