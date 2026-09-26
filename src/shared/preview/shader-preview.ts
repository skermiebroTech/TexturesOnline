// Live in-browser shader preview: a small voxel island rendered with three.js and a custom lighting +
// post-processing pipeline driven entirely by PreviewParams.

import * as THREE from 'three';
import type { AssetIndex, PreviewParams } from '../../core/types';
import { buildClouds } from './clouds';
import {
  CLOUD_FRAG, CLOUD_VERT, DEPTH_FRAG, DEPTH_VERT, DOWN_FRAG, FINAL_FRAG, PREFILTER_FRAG, QUAD_VERT, RAYS_FRAG, SKY_FRAG, SKY_VERT, UP_FRAG,
  VOXEL_FRAG, VOXEL_VERT, WATER_FRAG, WATER_VERT,
} from './glsl';
import { loadSlotTextures, proceduralSlotTextures, type SlotTexture, type SlotTextures } from './preview-textures';
import { makePixelTexture } from './three-utils';
import { createStage, OrbitController, ViewportLoop } from './viewport';
import { buildDiorama, type DioramaData, type MeshData, type TextureSlot } from './voxel-world';

export interface ShaderPreview {
  setParams(p: PreviewParams): void;
  setAssets(a: AssetIndex | null): Promise<void>;
  setAutoRotate(v: boolean): void;
  setTimeAnimation(v: boolean): void;
  screenshot(): Promise<Blob>;
  destroy(): void;
  /** Current (possibly animated) time of day in ticks, 0..24000 */
  getTimeOfDay(): number;
  /** Back to the default camera angle and zoom */
  resetCamera(): void;
}

export interface ShaderPreviewOptions {
  assets?: AssetIndex | null;
  /** Initial parameters (defaults to defaultPreviewParams()) */
  params?: PreviewParams;
  /** Default true unless the user prefers reduced motion */
  autoRotate?: boolean;
  /** Fixed device pixel ratio. When omitted: min(devicePixelRatio, 1.5), lowered automatically on slow GPUs */
  pixelRatio?: number;
  /** Seconds for a full day when time animation is on (default 48) */
  dayLength?: number;
}

/** Neutral grading, mid-morning sun, light haze. Colours are sRGB 0..1 (like hex / 255). */
export function defaultPreviewParams(): PreviewParams {
  return {
    exposure: 1,
    contrast: 1,
    saturation: 1,
    gamma: 1,
    temperature: 0,
    tint: [1, 1, 1],
    vignette: 0.25,
    bloom: 0.3,
    shadowStrength: 0.85,
    sunColor: [1, 0.95, 0.86],
    skyTop: [0.31, 0.54, 0.94],
    skyHorizon: [0.72, 0.84, 0.97],
    fogColor: [0.74, 0.83, 0.94],
    fogDensity: 0.18,
    waterColor: [0.25, 0.46, 0.89],
    waterClarity: 0.6,
    waving: 0.5,
    godrays: 0.3,
    timeOfDay: 4800,
    grayscale: 0,
    sepia: 0,
    posterize: 0,
  };
}

type NumKey = { [K in keyof PreviewParams]: PreviewParams[K] extends number ? K : never }[keyof PreviewParams];
type VecKey = { [K in keyof PreviewParams]: PreviewParams[K] extends [number, number, number] ? K : never }[keyof PreviewParams];

const RANGES: Record<NumKey, [number, number]> = {
  exposure: [0, 8], contrast: [0, 3], saturation: [0, 3], gamma: [0.2, 5], temperature: [-1, 1], vignette: [0, 1],
  bloom: [0, 1], shadowStrength: [0, 1], fogDensity: [0, 1], waterClarity: [0, 1], waving: [0, 1], godrays: [0, 1],
  timeOfDay: [-Infinity, Infinity], grayscale: [0, 1], sepia: [0, 1], posterize: [0, 32],
};
const VEC_KEYS: VecKey[] = ['tint', 'sunColor', 'skyTop', 'skyHorizon', 'fogColor', 'waterColor'];

/** Fills missing/invalid values from the defaults and clamps everything into range. */
export function sanitizePreviewParams(p: Partial<PreviewParams> | null | undefined): PreviewParams {
  const d = defaultPreviewParams();
  const out = { ...d };
  if (!p) return out;
  for (const key of Object.keys(RANGES) as NumKey[]) {
    const v = p[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      const [lo, hi] = RANGES[key];
      out[key] = Math.min(hi, Math.max(lo, v));
    }
  }
  out.timeOfDay = ((out.timeOfDay % 24000) + 24000) % 24000;
  out.posterize = out.posterize < 2 ? 0 : Math.round(out.posterize);
  for (const key of VEC_KEYS) {
    const v = p[key];
    if (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every((n) => typeof n === 'number' && Number.isFinite(n))) {
      out[key] = [0, 1, 2].map((i) => Math.min(4, Math.max(0, v[i]))) as [number, number, number];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

type V3 = [number, number, number];
const lin = (c: V3): V3 => [Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2)];
const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul3 = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const luma = (c: V3): number => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
const SUN_TILT = 0.42;

/** World direction towards the sun for a Minecraft time of day (0 = sunrise in the east, 6000 = noon). */
export function sunDirection(timeOfDay: number): V3 {
  const th = (timeOfDay / 24000) * Math.PI * 2;
  return [Math.cos(th), Math.sin(th) * Math.cos(SUN_TILT), Math.sin(th) * Math.sin(SUN_TILT)];
}

interface Lighting {
  sun: V3;
  moon: V3;
  lightDir: V3;
  lightColor: V3;
  skyTop: V3;
  skyHorizon: V3;
  skyGround: V3;
  sunGlow: V3;
  twilight: V3;
  ambSky: V3;
  ambGround: V3;
  fog: V3;
  scatter: V3;
  sunDisk: V3;
  moonDisk: V3;
  night: number;
  rayDir: V3;
  rayColor: V3;
  autoExposure: number;
}

function computeLighting(p: PreviewParams, tod: number): Lighting {
  const sun = sunDirection(tod);
  const moon: V3 = [-sun[0], -sun[1], -sun[2]];
  const elev = sun[1];
  const day = smoothstep(-0.1, 0.22, elev);
  const twilight = Math.exp(-(((elev - 0.03) / 0.15) ** 2));
  const night = 1 - smoothstep(-0.22, 0.02, elev);

  const sunLin = lin(p.sunColor);
  const warm: V3 = mix3([1.0, 0.34, 0.1], mul3(sunLin, 1 / Math.max(0.2, luma(sunLin))), 0.15);
  const skyTopDay = lin(p.skyTop);
  const skyHorDay = lin(p.skyHorizon);
  const nightTop: V3 = [0.0035, 0.006, 0.018];
  const nightHor: V3 = [0.012, 0.018, 0.042];

  let skyTop = mix3(nightTop, skyTopDay, day);
  skyTop = add3(mul3(skyTop, 1 - 0.25 * twilight), mul3([0.05, 0.03, 0.09], twilight));
  const dusk: V3 = add3(mul3(warm, 0.35), [0.2, 0.08, 0.16]);
  let skyHorizon = mix3(nightHor, skyHorDay, day);
  skyHorizon = mix3(skyHorizon, dusk, twilight * 0.65);

  const sunI = 2.7 * Math.sqrt(Math.min(1, Math.max(0, (elev + 0.04) / 0.14)));
  const warmLight = mix3([1, 0.5, 0.22], [1, 1, 1], smoothstep(0.0, 0.42, elev));
  const sunLight: V3 = [sunLin[0] * warmLight[0] * sunI, sunLin[1] * warmLight[1] * sunI, sunLin[2] * warmLight[2] * sunI];
  const moonI = 0.42 * smoothstep(0.0, 0.2, -elev);
  const moonLight: V3 = mul3([0.42, 0.52, 0.85], moonI);
  const useSun = elev > -0.03;
  const lightDir = useSun ? sun : moon;
  const ld: V3 = [lightDir[0], Math.max(lightDir[1], 0.07), lightDir[2]];
  const len = Math.hypot(ld[0], ld[1], ld[2]);

  const ambSky = add3(add3(mul3(skyTop, 0.36), mul3(skyHorizon, 0.26)), mul3([0.02, 0.026, 0.05], 0.4 + night));
  const ambGround = add3(mul3(skyHorizon, 0.28), mul3(sunLight, 0.035));
  const fogLin = lin(p.fogColor);
  const fog = add3(mix3(mul3(fogLin, 0.05 + 0.95 * day), skyHorizon, 0.4 + 0.3 * twilight), mul3(warm, twilight * 0.08));

  return {
    sun,
    moon,
    lightDir: [ld[0] / len, ld[1] / len, ld[2] / len],
    lightColor: useSun ? sunLight : moonLight,
    skyTop,
    skyHorizon,
    skyGround: mul3(mix3(skyHorizon, skyTop, 0.75), 0.8),
    sunGlow: mul3(sunLin, smoothstep(-0.12, 0.05, elev) * (0.35 + twilight * 0.9)),
    twilight: mul3(warm, twilight * 1.5),
    ambSky,
    ambGround,
    fog,
    scatter: mul3(sunLin, sunI * 0.04),
    sunDisk: mul3(sunLin, 28 * smoothstep(-0.1, 0.02, elev)),
    moonDisk: mul3([0.85, 0.9, 1.0], 3.2 * smoothstep(-0.05, 0.1, -elev)),
    night,
    rayDir: useSun ? sun : moon,
    rayColor: useSun ? mul3(sunLin, (0.6 + twilight * 0.8) * smoothstep(-0.05, 0.08, elev)) : mul3([0.45, 0.55, 0.9], 0.35 * smoothstep(0.0, 0.2, -elev)),
    autoExposure: (1 + night * 1.3) * (1 + twilight * 0.12),
  };
}

function whiteBalance(temperature: number, tint: V3): V3 {
  const t = temperature;
  const wb: V3 = [1 + 0.16 * t, 1 + 0.02 * t, 1 - 0.2 * t];
  const l = luma(wb);
  return [(wb[0] / l) * tint[0], (wb[1] / l) * tint[1], (wb[2] / l) * tint[2]];
}

function uniformsFrom(values: Record<string, unknown>): Record<string, THREE.IUniform> {
  const u: Record<string, THREE.IUniform> = {};
  for (const [k, v] of Object.entries(values)) u[k] = { value: v };
  return u;
}

interface WorldMesh {
  mesh: THREE.Mesh;
  data: MeshData;
  material: THREE.ShaderMaterial;
  depthMaterial: THREE.ShaderMaterial | null;
}

class ShaderPreviewImpl implements ShaderPreview {
  private readonly stage: ReturnType<typeof createStage>;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 2000);
  private readonly target = new THREE.Vector3(0, 1, 0);
  private readonly lightCam = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 100);
  private readonly quadScene = new THREE.Scene();
  private readonly quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly loop: ViewportLoop;
  private readonly orbit: OrbitController;
  private readonly shared: Record<string, THREE.IUniform>;
  private readonly diorama: DioramaData;
  private readonly meshes: WorldMesh[] = [];
  private readonly sky: THREE.Mesh;
  private readonly clouds: THREE.Mesh;
  private readonly textures = new Map<TextureSlot, THREE.DataTexture>();
  private slotInfo: SlotTextures;
  private readonly black: THREE.DataTexture;
  private readonly defines: Record<string, string> = {};
  private readonly rtType: THREE.TextureDataType;
  private readonly samples: number;
  private readonly shadowsSupported: boolean;
  private shadowRT: THREE.WebGLRenderTarget | null = null;
  private sceneRT!: THREE.WebGLRenderTarget;
  private bright!: THREE.WebGLRenderTarget;
  private levels: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private raysRT!: THREE.WebGLRenderTarget;
  private readonly mat: {
    prefilter: THREE.ShaderMaterial;
    down: THREE.ShaderMaterial;
    up: THREE.ShaderMaterial;
    rays: THREE.ShaderMaterial;
    final: THREE.ShaderMaterial;
  };

  private target_: PreviewParams;
  private cur: PreviewParams;
  private tod: number;
  private todTarget: number;
  private timeAnimation = false;
  private readonly dayLength: number;
  private time = 0;
  private waterFrame = 0;
  private lastShadowKey = '';
  private dpr: number;
  private readonly maxDpr: number;
  private readonly fixedDpr: boolean;
  private slowTime = 0;
  private cssW = 1;
  private cssH = 1;
  private destroyed = false;
  private assetToken = 0;
  private contextLost = false;
  private firstFrame = true;
  private readonly tmp = {
    f: new THREE.Vector3(),
    r: new THREE.Vector3(),
    u: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    world: new THREE.Vector3(),
    center: new THREE.Vector3(),
  };
  private pendingDt = 0;
  private lastChange = 0;

  constructor(renderer: THREE.WebGLRenderer, stage: ReturnType<typeof createStage>, opts: ShaderPreviewOptions) {
    this.stage = stage;
    this.renderer = renderer;
    this.dayLength = Math.max(4, opts.dayLength ?? 48);
    this.fixedDpr = typeof opts.pixelRatio === 'number' && opts.pixelRatio > 0;
    this.maxDpr = this.fixedDpr ? (opts.pixelRatio as number) : Math.min(window.devicePixelRatio || 1, 1.5);
    this.dpr = this.maxDpr;

    const params = sanitizePreviewParams(opts.params ?? defaultPreviewParams());
    this.target_ = params;
    this.cur = structuredClone(params);
    this.tod = params.timeOfDay;
    this.todTarget = params.timeOfDay;

    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(1);

    const caps = renderer.capabilities;
    const gl2 = caps.isWebGL2;
    const floatOk = gl2
      ? renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')
      : renderer.extensions.has('OES_texture_half_float') && renderer.extensions.has('EXT_color_buffer_half_float');
    this.rtType = floatOk ? THREE.HalfFloatType : THREE.UnsignedByteType;
    if (!floatOk) this.defines.LDR_TARGET = '1';
    this.samples = gl2 ? Math.min(4, caps.maxSamples || 0) : 0;
    this.shadowsSupported = gl2 || renderer.extensions.has('WEBGL_depth_texture');

    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    this.black.needsUpdate = true;

    this.shared = uniformsFrom({
      uTime: 0,
      uWaving: 0,
      uLightDir: new THREE.Vector3(0, 1, 0),
      uLightColor: new THREE.Vector3(1, 1, 1),
      uSunDir: new THREE.Vector3(0, 1, 0),
      uMoonDir: new THREE.Vector3(0, -1, 0),
      uSkyTop: new THREE.Vector3(),
      uSkyHorizon: new THREE.Vector3(),
      uSkyGround: new THREE.Vector3(),
      uSunGlow: new THREE.Vector3(),
      uTwilight: new THREE.Vector3(),
      uAmbientSky: new THREE.Vector3(),
      uAmbientGround: new THREE.Vector3(),
      uFogColor: new THREE.Vector3(),
      uScatterColor: new THREE.Vector3(),
      uFogDensity: 0,
      uFogBase: -7,
      uShadowStrength: 0,
      uShadowMap: this.black,
      uShadowMatrix: new THREE.Matrix4(),
      uShadowTexel: new THREE.Vector2(1 / 2048, 1 / 2048),
      uTorches: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -100, 0, 0)),
      uTorchColor: new THREE.Vector3(1.0, 0.55, 0.22),
      uWaterColor: new THREE.Vector3(),
      uWaterClarity: 0.6,
      uWaterLevel: 0,
    });

    this.diorama = buildDiorama();
    this.shared.uWaterLevel.value = this.diorama.waterLevel;
    this.slotInfo = proceduralSlotTextures();
    for (const [slot, info] of Object.entries(this.slotInfo) as [TextureSlot, SlotTexture][]) this.textures.set(slot, makePixelTexture(info.image));
    this.buildMeshes();

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: { ...this.shared, uNight: { value: 0 }, uSunDisk: { value: new THREE.Vector3() }, uMoonDisk: { value: new THREE.Vector3() } },
        defines: this.defines,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    const cloudData = buildClouds({ y: -30, coverage: 0.3, cell: 7, cells: 22, thickness: 2.2 });
    const cloudGeo = new THREE.BufferGeometry();
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudData.positions, 3));
    cloudGeo.setAttribute('normal', new THREE.BufferAttribute(cloudData.normals, 3));
    cloudGeo.setAttribute('aCenterX', new THREE.BufferAttribute(cloudData.centers, 1));
    cloudGeo.setIndex(new THREE.BufferAttribute(cloudData.indices, 1));
    this.clouds = new THREE.Mesh(
      cloudGeo,
      new THREE.ShaderMaterial({
        vertexShader: CLOUD_VERT,
        fragmentShader: CLOUD_FRAG,
        uniforms: {
          ...this.shared,
          uCloudDrift: { value: 0 },
          uCloudPeriod: { value: cloudData.period },
          uCloudFadeStart: { value: 30 },
          uCloudFadeEnd: { value: 68 },
        },
        defines: this.defines,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -5;
    this.scene.add(this.clouds);

    if (this.shadowsSupported) {
      const size = 2048;
      this.shadowRT = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true, stencilBuffer: false });
      this.shadowRT.depthTexture = new THREE.DepthTexture(size, size);
      this.shadowRT.depthTexture.type = gl2 ? THREE.UnsignedIntType : THREE.UnsignedShortType;
      this.shadowRT.texture.generateMipmaps = false;
      this.shared.uShadowMap.value = this.shadowRT.depthTexture;
      this.shared.uShadowTexel.value.set(1 / size, 1 / size);
    }

    const quadGeo = new THREE.BufferGeometry();
    quadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const pass = (frag: string, uniforms: Record<string, unknown>) =>
      new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: frag, uniforms: uniformsFrom(uniforms), defines: this.defines, depthTest: false, depthWrite: false });
    this.mat = {
      prefilter: pass(PREFILTER_FRAG, {
        tScene: null, uTexel: new THREE.Vector2(), uThreshold: 1, uCamF: new THREE.Vector3(), uCamR: new THREE.Vector3(),
        uCamU: new THREE.Vector3(), uTan: new THREE.Vector2(), uRayDir: new THREE.Vector3(),
      }),
      down: pass(DOWN_FRAG, { tInput: null, uTexel: new THREE.Vector2() }),
      up: pass(UP_FRAG, { tInput: null, tBase: null, uTexel: new THREE.Vector2(), uBaseWeight: 1 }),
      rays: pass(RAYS_FRAG, { tInput: null, uLightPos: new THREE.Vector2(), uStrength: 1, uJitter: 0 }),
      final: pass(FINAL_FRAG, {
        tScene: null, tBloom: this.black, tRays: this.black, uBloom: 0, uGodrays: 0, uRayColor: new THREE.Vector3(),
        uExposure: 1, uWhiteBalance: new THREE.Vector3(1, 1, 1), uContrast: 1, uSaturation: 1, uGamma: 1, uGrayscale: 0,
        uSepia: 0, uPosterize: 0, uVignette: 0, uAspect: 1, uTime: 0,
      }),
    };
    this.quad = new THREE.Mesh(quadGeo, this.mat.final);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.allocateTargets(1, 1);

    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.orbit = new OrbitController(stage.canvas, {
      azimuth: -0.62,
      elevation: 0.46,
      distance: 60,
      minDistance: 18,
      maxDistance: 120,
      minElevation: -0.3,
      maxElevation: 1.4,
      autoRotate: opts.autoRotate ?? !reduced,
      autoRotateSpeed: 0.08,
      onChange: () => {
        this.lastChange = performance.now();
        this.loop?.invalidate();
      },
    });

    stage.canvas.addEventListener('webglcontextlost', this.onContextLost);
    stage.canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    this.loop = new ViewportLoop(stage.root, {
      frame: (dt) => this.frame(dt),
      resize: (w, h) => this.resize(w, h),
    });

    if (opts.assets) void this.setAssets(opts.assets);
  }

  // ---- setup ----

  private buildMeshes(): void {
    for (const data of this.diorama.meshes) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
      geo.setAttribute('aAO', new THREE.BufferAttribute(data.ao, 1));
      geo.setAttribute('aWave', new THREE.BufferAttribute(data.wave, 1));
      if (data.depth) geo.setAttribute('aDepth', new THREE.BufferAttribute(data.depth, 1));
      geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
      geo.computeBoundingSphere();
      if (geo.boundingSphere) geo.boundingSphere.radius += 0.5;

      const map = this.textures.get(data.slot) ?? this.black;
      let material: THREE.ShaderMaterial;
      if (data.kind === 'water') {
        material = new THREE.ShaderMaterial({
          vertexShader: WATER_VERT,
          fragmentShader: WATER_FRAG,
          uniforms: { ...this.shared, uMap: { value: map }, uFrames: { value: 1 }, uFrame: { value: 0 } },
          defines: this.defines,
          transparent: true,
          depthWrite: false,
        });
      } else {
        const alphaTest = data.kind === 'solid' ? 0 : data.kind === 'torch' ? 0.1 : 0.35;
        material = new THREE.ShaderMaterial({
          vertexShader: VOXEL_VERT,
          fragmentShader: VOXEL_FRAG,
          uniforms: {
            ...this.shared,
            uMap: { value: map },
            uAlphaTest: { value: alphaTest },
            uEmissive: { value: data.kind === 'torch' ? 7 : 0 },
            uTranslucent: { value: data.kind === 'cutout' ? 0.3 : data.kind === 'plant' ? 0.25 : 0 },
          },
          defines: this.defines,
          side: data.kind === 'plant' ? THREE.DoubleSide : THREE.FrontSide,
        });
      }
      const mesh = new THREE.Mesh(geo, material);
      let depthMaterial: THREE.ShaderMaterial | null = null;
      if (data.kind !== 'water') {
        depthMaterial = new THREE.ShaderMaterial({
          vertexShader: DEPTH_VERT,
          fragmentShader: DEPTH_FRAG,
          uniforms: {
            uTime: this.shared.uTime,
            uWaving: this.shared.uWaving,
            uMap: { value: map },
            uAlphaTest: { value: data.kind === 'solid' ? 0 : 0.35 },
          },
          side: THREE.DoubleSide,
        });
      }
      this.scene.add(mesh);
      this.meshes.push({ mesh, data, material, depthMaterial });
    }
    this.applyWaterFrames();
  }

  private applyWaterFrames(): void {
    const info = this.slotInfo.water;
    for (const m of this.meshes) {
      if (m.data.kind === 'water') m.material.uniforms.uFrames.value = Math.max(1, info.frames);
    }
  }

  private makeRT(w: number, h: number, msaa = false): THREE.WebGLRenderTarget {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: this.rtType,
      depthBuffer: msaa,
      stencilBuffer: false,
      samples: msaa ? this.samples : 0,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    rt.texture.generateMipmaps = false;
    return rt;
  }

  private allocateTargets(w: number, h: number): void {
    const all = [this.sceneRT, this.bright, this.raysRT, ...this.levels, ...this.ups];
    for (const rt of all) rt?.dispose();
    this.sceneRT = this.makeRT(w, h, true);
    const hw = Math.max(1, Math.floor(w / 2));
    const hh = Math.max(1, Math.floor(h / 2));
    this.bright = this.makeRT(hw, hh);
    this.levels = [this.bright];
    this.ups = [];
    let lw = hw;
    let lh = hh;
    for (let i = 1; i <= 4; i++) {
      lw = Math.max(1, Math.floor(lw / 2));
      lh = Math.max(1, Math.floor(lh / 2));
      this.levels.push(this.makeRT(lw, lh));
    }
    for (let i = 1; i <= 3; i++) this.ups[i] = this.makeRT(this.levels[i].width, this.levels[i].height);
    this.raysRT = this.makeRT(Math.max(1, Math.floor(w / 4)), Math.max(1, Math.floor(h / 4)));
  }

  private resize(w: number, h: number): void {
    this.cssW = w;
    this.cssH = h;
    this.applySize();
  }

  private applySize(): void {
    if (this.destroyed) return;
    const bw = Math.max(1, Math.round(this.cssW * this.dpr));
    const bh = Math.max(1, Math.round(this.cssH * this.dpr));
    this.renderer.setSize(bw, bh, false);
    this.camera.aspect = this.cssW / this.cssH;
    // keep the island's width in view on tall / narrow containers
    const ref = 1.3;
    this.camera.fov = this.camera.aspect < ref
      ? Math.min(70, (2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) * (ref / this.camera.aspect)) * 180) / Math.PI)
      : 30;
    this.camera.updateProjectionMatrix();
    this.allocateTargets(bw, bh);
  }

  // ---- context loss ----

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.stage.message('Preview paused: the graphics device was reset. It will resume automatically.');
  };

  private onContextRestored = (): void => {
    this.contextLost = false;
    this.stage.message(null);
    this.lastShadowKey = '';
    this.loop.invalidate();
  };

  // ---- per frame ----

  private smoothParams(dt: number): void {
    const k = this.firstFrame ? 1 : 1 - Math.exp(-dt * 9);
    const t = this.target_;
    const c = this.cur;
    for (const key of Object.keys(RANGES) as NumKey[]) {
      if (key === 'timeOfDay' || key === 'posterize') continue;
      c[key] += (t[key] - c[key]) * k;
    }
    c.posterize = t.posterize;
    for (const key of VEC_KEYS) {
      const a = c[key];
      const b = t[key];
      c[key] = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
    if (this.timeAnimation) {
      this.tod = (this.tod + (24000 / this.dayLength) * dt) % 24000;
    } else {
      let d = this.todTarget - this.tod;
      if (d > 12000) d -= 24000;
      if (d < -12000) d += 24000;
      this.tod = (((this.tod + d * k) % 24000) + 24000) % 24000;
    }
    c.timeOfDay = this.tod;
  }

  private updateUniforms(): Lighting {
    const p = this.cur;
    const L = computeLighting(p, this.tod);
    const u = this.shared;
    const set = (name: string, v: V3) => (u[name].value as THREE.Vector3).set(v[0], v[1], v[2]);
    u.uTime.value = this.time;
    u.uWaving.value = p.waving;
    set('uLightDir', L.lightDir);
    set('uLightColor', L.lightColor);
    set('uSunDir', L.sun);
    set('uMoonDir', L.moon);
    set('uSkyTop', L.skyTop);
    set('uSkyHorizon', L.skyHorizon);
    set('uSkyGround', L.skyGround);
    set('uSunGlow', L.sunGlow);
    set('uTwilight', L.twilight);
    set('uAmbientSky', L.ambSky);
    set('uAmbientGround', L.ambGround);
    set('uFogColor', L.fog);
    set('uScatterColor', L.scatter);
    set('uWaterColor', lin(p.waterColor));
    u.uFogDensity.value = p.fogDensity;
    u.uWaterClarity.value = p.waterClarity;
    u.uShadowStrength.value = this.shadowRT ? p.shadowStrength : 0;
    const torches = u.uTorches.value as THREE.Vector4[];
    this.diorama.torches.forEach((t, i) => {
      if (i >= torches.length) return;
      const flicker = 0.86 + 0.09 * Math.sin(this.time * 9.1 + i * 3.1) + 0.05 * Math.sin(this.time * 23.7 + i * 7.3);
      torches[i].set(t[0], t[1], t[2], 1.7 * flicker);
    });
    const sky = this.sky.material as THREE.ShaderMaterial;
    sky.uniforms.uNight.value = L.night;
    (sky.uniforms.uSunDisk.value as THREE.Vector3).set(...L.sunDisk);
    (sky.uniforms.uMoonDisk.value as THREE.Vector3).set(...L.moonDisk);
    return L;
  }

  private renderShadows(L: Lighting): void {
    if (!this.shadowRT) return;
    const p = this.cur;
    const key = `${L.lightDir.map((v) => v.toFixed(4)).join(',')}`;
    const moving = p.waving > 0.001;
    if (!moving && key === this.lastShadowKey) return;
    this.lastShadowKey = key;
    const b = this.diorama.bounds;
    const center = this.tmp.center.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    const radius = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2 + 1;
    const cam = this.lightCam;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.1;
    cam.far = radius * 4;
    cam.position.set(center.x + L.lightDir[0] * radius * 2, center.y + L.lightDir[1] * radius * 2, center.z + L.lightDir[2] * radius * 2);
    cam.up.set(0, 1, 0);
    if (Math.abs(L.lightDir[1]) > 0.99) cam.up.set(0, 0, 1);
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    const m = this.shared.uShadowMatrix.value as THREE.Matrix4;
    m.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    m.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    this.sky.visible = false;
    this.clouds.visible = false;
    for (const wm of this.meshes) {
      if (wm.depthMaterial) wm.mesh.material = wm.depthMaterial;
      else wm.mesh.visible = false;
    }
    this.renderer.setRenderTarget(this.shadowRT);
    this.renderer.render(this.scene, cam);
    for (const wm of this.meshes) {
      wm.mesh.material = wm.material;
      wm.mesh.visible = true;
    }
    this.sky.visible = true;
    this.clouds.visible = true;
  }

  private blit(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = material;
    material.uniformsNeedUpdate = true;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  private adaptQuality(dt: number): void {
    if (this.fixedDpr || this.firstFrame) return;
    if (dt > 0.028) this.slowTime += dt;
    else this.slowTime = Math.max(0, this.slowTime - dt * 0.5);
    if (this.slowTime > 1.5 && this.dpr > 0.65) {
      this.dpr = Math.max(0.65, this.dpr * 0.8);
      this.slowTime = 0;
      this.applySize();
    }
  }

  private frame(dt: number): boolean {
    if (this.destroyed || this.contextLost) return false;
    // Only ambient motion (water, torches, foliage): 30 fps is plenty and saves battery.
    this.adaptQuality(dt);
    const active = this.firstFrame || this.timeAnimation || this.orbit.animating || performance.now() - this.lastChange < 1200;
    this.pendingDt += dt;
    if (!active && this.pendingDt < 1 / 31) return true;
    dt = Math.min(0.1, this.pendingDt);
    this.pendingDt = 0;
    this.time += dt;
    this.smoothParams(dt);
    this.orbit.update(dt);
    this.render();
    this.firstFrame = false;
    return true;
  }

  private render(): void {
    const p = this.cur;
    const L = this.updateUniforms();

    const off = this.orbit.offset();
    this.camera.position.set(this.target.x + off[0], this.target.y + off[1], this.target.z + off[2]);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld(true);
    this.sky.position.copy(this.camera.position);
    (this.clouds.material as THREE.ShaderMaterial).uniforms.uCloudDrift.value = this.time * 0.7;

    const water = this.slotInfo.water;
    this.waterFrame = (this.time * 20) / Math.max(1, water.frametime);
    for (const wm of this.meshes) if (wm.data.kind === 'water') wm.material.uniforms.uFrame.value = this.waterFrame;

    this.renderShadows(L);

    this.renderer.setRenderTarget(this.sceneRT);
    this.renderer.render(this.scene, this.camera);

    const needBright = p.bloom > 0.001 || p.godrays > 0.001;
    let bloomTex: THREE.Texture = this.black;
    let raysTex: THREE.Texture = this.black;
    let rayStrength = 0;

    if (needBright) {
      const camF = this.camera.getWorldDirection(this.tmp.f);
      const camR = this.tmp.r.crossVectors(camF, this.camera.up).normalize();
      const camU = this.tmp.u.crossVectors(camR, camF).normalize();
      const tanY = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const pf = this.mat.prefilter.uniforms;
      pf.tScene.value = this.sceneRT.texture;
      pf.uTexel.value.set(1 / this.sceneRT.width, 1 / this.sceneRT.height);
      pf.uThreshold.value = 1.6 - p.bloom * 0.7;
      pf.uCamF.value.copy(camF);
      pf.uCamR.value.copy(camR);
      pf.uCamU.value.copy(camU);
      pf.uTan.value.set(tanY * this.camera.aspect, tanY);
      pf.uRayDir.value.set(...L.rayDir);
      this.blit(this.mat.prefilter, this.bright);

      if (p.bloom > 0.001) {
        for (let i = 1; i < this.levels.length; i++) {
          const src = this.levels[i - 1];
          this.mat.down.uniforms.tInput.value = src.texture;
          this.mat.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
          this.blit(this.mat.down, this.levels[i]);
        }
        let prev = this.levels[this.levels.length - 1];
        for (let i = this.levels.length - 2; i >= 1; i--) {
          this.mat.up.uniforms.tInput.value = prev.texture;
          this.mat.up.uniforms.tBase.value = this.levels[i].texture;
          this.mat.up.uniforms.uTexel.value.set(1 / prev.width, 1 / prev.height);
          this.blit(this.mat.up, this.ups[i]);
          prev = this.ups[i];
        }
        bloomTex = prev.texture;
      }

      if (p.godrays > 0.001) {
        const dir = this.tmp.dir.set(...L.rayDir);
        const facing = dir.dot(camF);
        const ndc = this.tmp.world.copy(this.camera.position).addScaledVector(dir, 400).project(this.camera);
        const edge = Math.max(Math.abs(ndc.x), Math.abs(ndc.y));
        rayStrength = smoothstep(0.05, 0.45, facing) * (1 - smoothstep(1.2, 2.2, edge));
        if (rayStrength > 0.001) {
          const r = this.mat.rays.uniforms;
          r.tInput.value = this.bright.texture;
          r.uLightPos.value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
          r.uStrength.value = 1;
          r.uJitter.value = (this.time * 7.13) % 100;
          this.blit(this.mat.rays, this.raysRT);
          raysTex = this.raysRT.texture;
        }
      }
    }

    const f = this.mat.final.uniforms;
    f.tScene.value = this.sceneRT.texture;
    f.tBloom.value = bloomTex;
    f.tRays.value = raysTex;
    f.uBloom.value = p.bloom * 0.32;
    f.uGodrays.value = p.godrays * rayStrength * 0.75;
    f.uRayColor.value.set(...L.rayColor);
    f.uExposure.value = p.exposure * L.autoExposure * 0.72;
    f.uWhiteBalance.value.set(...whiteBalance(p.temperature, p.tint));
    f.uContrast.value = p.contrast;
    f.uSaturation.value = p.saturation;
    f.uGamma.value = p.gamma;
    f.uGrayscale.value = p.grayscale;
    f.uSepia.value = p.sepia;
    f.uPosterize.value = p.posterize;
    f.uVignette.value = p.vignette;
    f.uAspect.value = this.camera.aspect;
    f.uTime.value = this.time % 97;
    this.blit(this.mat.final, null);
  }

  // ---- public API ----

  setParams(p: PreviewParams): void {
    if (this.destroyed) return;
    const next = sanitizePreviewParams(p);
    const prevTod = this.target_.timeOfDay;
    this.target_ = next;
    if (next.timeOfDay !== prevTod) {
      this.todTarget = next.timeOfDay;
      if (this.timeAnimation) this.tod = next.timeOfDay;
    }
    this.lastChange = performance.now();
    this.loop.invalidate();
  }

  async setAssets(a: AssetIndex | null): Promise<void> {
    if (this.destroyed) return;
    const token = ++this.assetToken;
    let slots: SlotTextures;
    try {
      slots = await loadSlotTextures(a);
    } catch {
      slots = proceduralSlotTextures();
    }
    if (this.destroyed || token !== this.assetToken) return;
    const old = [...this.textures.values()];
    this.textures.clear();
    this.slotInfo = slots;
    for (const [slot, info] of Object.entries(slots) as [TextureSlot, SlotTexture][]) this.textures.set(slot, makePixelTexture(info.image));
    for (const wm of this.meshes) {
      const tex = this.textures.get(wm.data.slot) ?? this.black;
      wm.material.uniforms.uMap.value = tex;
      if (wm.depthMaterial) wm.depthMaterial.uniforms.uMap.value = tex;
    }
    this.applyWaterFrames();
    for (const t of old) t.dispose();
    this.lastShadowKey = '';
    this.loop.invalidate();
  }

  setAutoRotate(v: boolean): void {
    this.orbit.autoRotate = v;
    this.loop?.invalidate();
  }

  setTimeAnimation(v: boolean): void {
    if (this.timeAnimation === v) return;
    this.timeAnimation = v;
    if (v) this.tod = this.todTarget;
    else this.todTarget = this.tod;
    this.loop.invalidate();
  }

  getTimeOfDay(): number {
    return this.tod;
  }

  resetCamera(): void {
    this.orbit.reset();
    this.loop.invalidate();
  }

  screenshot(): Promise<Blob> {
    if (this.destroyed) return Promise.reject(new Error('The preview has been closed.'));
    if (this.contextLost) return Promise.reject(new Error('The preview is paused. Try again in a moment.'));
    this.cur = structuredClone(this.target_);
    if (!this.timeAnimation) this.tod = this.todTarget;
    this.cur.timeOfDay = this.tod;
    this.render();
    return new Promise((resolve, reject) => {
      this.stage.canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not capture the preview image.'))), 'image/png');
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.assetToken++;
    this.loop.dispose();
    this.orbit.dispose();
    this.stage.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.stage.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    for (const wm of this.meshes) {
      wm.mesh.geometry.dispose();
      wm.material.dispose();
      wm.depthMaterial?.dispose();
    }
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
    this.clouds.geometry.dispose();
    (this.clouds.material as THREE.Material).dispose();
    this.quad.geometry.dispose();
    for (const m of Object.values(this.mat)) m.dispose();
    for (const t of this.textures.values()) t.dispose();
    this.black.dispose();
    for (const rt of [this.sceneRT, this.shadowRT, this.raysRT, ...this.levels, ...this.ups]) rt?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.stage.root.remove();
  }
}

class UnavailablePreview implements ShaderPreview {
  constructor(private readonly stage: ReturnType<typeof createStage>) {}
  setParams(): void {}
  async setAssets(): Promise<void> {}
  setAutoRotate(): void {}
  setTimeAnimation(): void {}
  getTimeOfDay(): number {
    return 6000;
  }
  resetCamera(): void {}
  screenshot(): Promise<Blob> {
    return Promise.reject(new Error('The 3D preview is not available in this browser.'));
  }
  destroy(): void {
    this.stage.root.remove();
  }
}

/** Creates the live preview inside `container` (fills it; give the container a size). */
export function createShaderPreview(container: HTMLElement, opts: ShaderPreviewOptions = {}): ShaderPreview {
  const stage = createStage(container, 'Shader preview of a small voxel island. Drag to rotate, scroll or pinch to zoom, double-click to reset.');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: stage.canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    stage.message('The 3D preview needs WebGL, which is turned off or not supported in this browser. Your settings still export normally.');
    return new UnavailablePreview(stage);
  }
  try {
    return new ShaderPreviewImpl(renderer, stage, opts);
  } catch (err) {
    console.error(err);
    renderer.dispose();
    stage.message('The 3D preview could not start on this device. Your settings still export normally.');
    return new UnavailablePreview(stage);
  }
}
