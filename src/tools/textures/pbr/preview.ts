// Lit 3D preview of the Material tab: the open texture on a block (or a flat square for items and
// mobs) under a sun that moves around it, with metal, roughness, glow, light through and bumps shaded
// roughly the way PBR shaders do (GGX highlights, a sky to reflect, glow that shows at night). Each map
// can be shown on its own. Built on the shared preview pieces (stage, orbit camera, render loop).

import * as THREE from 'three';
import { makePixelTexture, alphaMode } from '../../../shared/preview/three-utils';
import { OrbitController, ViewportLoop, createStage, prefersReducedMotion } from '../../../shared/preview/viewport';
import { cropImageData } from '../../../core/pixels';
import { frameHeight } from './material';

/** What the block shows: the lit texture, or one of its maps in grey (the bumps in colour). */
export type MapView = 'look' | 'shine' | 'metal' | 'glow' | 'through' | 'bumps';
const VIEW_INDEX: Record<MapView, number> = { look: 0, shine: 1, metal: 2, glow: 3, through: 4, bumps: 5 };

export interface MaterialPreviewInput {
  colour: ImageData;
  /** RGBA = metal, glow, roughness, subsurface */
  mers: ImageData;
  /** labPBR-layout normal map, or null (flat) */
  normal: ImageData | null;
  shape: 'cube' | 'flat';
}

export interface MaterialPreview {
  readonly el: HTMLElement;
  /** false when WebGL isn't available (the panel shows a note instead) */
  readonly ok: boolean;
  set(input: MaterialPreviewInput): void;
  setView(v: MapView): void;
  /** Direction of the sun around the block, in degrees */
  setLight(deg: number): void;
  setMoving(on: boolean): void;
  setNight(on: boolean): void;
  destroy(): void;
}

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;
void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uColor;
uniform sampler2D uMers;
uniform sampler2D uNormal;
uniform float uHasNormal;
uniform vec3 uLight;
uniform vec3 uCam;
uniform float uNight;
uniform int uView;
uniform float uBlend;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;

const float PI = 3.14159265;

vec3 sky(vec3 d) {
  float t = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 day = mix(vec3(0.30, 0.26, 0.22), mix(vec3(0.75, 0.82, 0.92), vec3(0.38, 0.6, 1.0), smoothstep(0.5, 1.0, t)), smoothstep(0.35, 0.55, t));
  vec3 night = mix(vec3(0.015, 0.015, 0.02), vec3(0.03, 0.045, 0.1), t);
  return mix(day, night, uNight);
}

void main() {
  vec4 c = texture2D(uColor, vUv);
  if (c.a < 0.1) discard;
  vec4 m = texture2D(uMers, vUv);
  vec3 N = normalize(vNormal);
  // tangent frame from screen derivatives: T along u, B along v (up the image: rows are flipped on upload)
  vec3 dp1 = dFdx(vPos);
  vec3 dp2 = dFdy(vPos);
  vec2 du1 = dFdx(vUv);
  vec2 du2 = dFdy(vUv);
  vec3 dp2perp = cross(dp2, N);
  vec3 dp1perp = cross(N, dp1);
  vec3 T = dp2perp * du1.x + dp1perp * du2.x;
  vec3 B = dp2perp * du1.y + dp1perp * du2.y;
  float invmax = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
  vec3 tn = vec3(0.0, 0.0, 1.0);
  if (uHasNormal > 0.5) {
    vec2 xy = (texture2D(uNormal, vUv).rg * 255.0 - 128.0) / 127.0;
    // DirectX normal maps: green grows down the image
    tn = vec3(xy.x, -xy.y, sqrt(max(0.0, 1.0 - dot(xy, xy))));
  }
  vec3 n = normalize(mat3(T * invmax, B * invmax, N) * tn);
  if (!gl_FrontFacing) n = -n;

  float shade = 0.62 + 0.38 * max(dot(n, normalize(vec3(0.4, 1.0, 0.6))), 0.0);
  if (uView == 1) { gl_FragColor = vec4(vec3(1.0 - m.b) * shade, 1.0); return; }
  if (uView == 2) { gl_FragColor = vec4(vec3(m.r) * shade, 1.0); return; }
  if (uView == 3) { gl_FragColor = vec4(vec3(m.g) * shade, 1.0); return; }
  if (uView == 4) { gl_FragColor = vec4(vec3(m.a * (1.0 - step(0.5, m.r))) * shade, 1.0); return; }
  if (uView == 5) { gl_FragColor = vec4(tn * 0.5 + 0.5, 1.0); return; }

  vec3 albedo = pow(c.rgb, vec3(2.2));
  float metal = m.r;
  float glow = m.g;
  float rough = clamp(m.b, 0.045, 1.0);
  float sss = m.a * (1.0 - step(0.5, metal));
  vec3 L = normalize(uLight);
  vec3 V = normalize(uCam - vPos);
  vec3 H = normalize(L + V);
  float NdL = dot(n, L);
  float diff = max(NdL, 0.0);
  float NdV = max(dot(n, V), 1e-3);
  float NdH = max(dot(n, H), 0.0);
  float LdH = max(dot(L, H), 0.0);
  float a = rough * rough;
  float a2 = a * a;
  float dd = NdH * NdH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float k = (rough + 1.0) * (rough + 1.0) / 8.0;
  float G = (NdV / (NdV * (1.0 - k) + k)) * (diff / (diff * (1.0 - k) + k));
  vec3 F0 = mix(vec3(0.04), albedo, metal);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - LdH, 5.0);
  vec3 spec = D * G * F / max(4.0 * NdV, 1e-3);
  vec3 sun = mix(vec3(1.0, 0.95, 0.86) * 2.3, vec3(0.55, 0.65, 1.0) * 0.3, uNight);
  vec3 kd = (1.0 - F) * (1.0 - metal);
  // light through: the light wraps around and comes through from behind
  float wrapped = max((NdL + sss * 0.7) / (1.0 + sss * 0.7), 0.0);
  vec3 col = (kd * albedo / PI * mix(diff, wrapped, sss) + spec * diff) * sun;
  col += albedo * sss * max(-NdL, 0.0) * 0.45 * sun / PI;
  // the sky: soft light from everywhere and what shiny surfaces reflect
  vec3 R = reflect(-V, n);
  vec3 Fa = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - NdV, 5.0);
  vec3 env = mix(sky(R), sky(n), rough * rough);
  col += kd * albedo * sky(n) * 0.5 + env * Fa * (1.0 - 0.6 * rough);
  col += albedo * glow * 2.4;
  // filmic tone map, then back to sRGB
  col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);
  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), uBlend > 0.5 ? c.a : 1.0);
}
`;

const VIEW = { azimuth: (3 * Math.PI) / 4, elevation: 0.5, distance: 3.5 };
const FLAT_VIEW = { azimuth: 0.35, elevation: 0.32, distance: 3.1 };
/** Sun speed when it moves, in degrees per second */
const SUN_SPEED = 40;

/** First frame of an animation strip (the preview shows one picture). */
const firstFrame = (img: ImageData): ImageData => {
  const fh = frameHeight(img);
  return fh < img.height ? cropImageData(img, 0, 0, img.width, fh) : img;
};

export function createMaterialPreview(opts: { label: string; noGl: string; onLight?: (deg: number) => void }): MaterialPreview {
  const { label, onLight } = opts;
  const el = document.createElement('div');
  el.className = 'pbr-stage';
  const stage = createStage(el, label);
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: stage.canvas, alpha: true, antialias: true, premultipliedAlpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NoToneMapping;
  } catch {
    renderer = null;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const uniforms = {
    uColor: { value: null as THREE.Texture | null },
    uMers: { value: null as THREE.Texture | null },
    uNormal: { value: null as THREE.Texture | null },
    uHasNormal: { value: 0 },
    uLight: { value: new THREE.Vector3(1, 1, 1) },
    uCam: { value: new THREE.Vector3() },
    uNight: { value: 0 },
    uView: { value: 0 },
    uBlend: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, extensions: { derivatives: true } as THREE.ShaderMaterial['extensions'] });
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1.25, 1.25);
  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>(cube, material);
  scene.add(mesh);
  let shape: 'cube' | 'flat' = 'cube';
  let textures: THREE.Texture[] = [];
  let angle = 40;
  let moving = !prefersReducedMotion();
  let destroyed = false;

  const orbit = new OrbitController(stage.canvas, {
    ...VIEW,
    minDistance: 2.2,
    maxDistance: 6.5,
    minElevation: -1.2,
    maxElevation: 1.35,
    autoRotate: false,
    onChange: () => loop.invalidate(),
  });
  const loop = new ViewportLoop(stage.root, {
    frame: (dt) => frame(dt),
    resize: (w, h) => {
      if (!renderer) return;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
  });
  if (!renderer) stage.message(opts.noGl);

  function placeLight() {
    const r = (angle * Math.PI) / 180;
    // the sun circles the block, high enough to light the top
    uniforms.uLight.value.set(Math.sin(r) * 0.8, 0.75, Math.cos(r) * 0.8).normalize();
  }
  placeLight();

  let lastReport = 0;
  function frame(dt: number): boolean {
    if (!renderer || destroyed) return false;
    const turned = orbit.update(dt);
    if (moving) {
      angle = (angle + SUN_SPEED * dt) % 360;
      placeLight();
      const now = performance.now();
      if (onLight && now - lastReport > 120) {
        lastReport = now;
        onLight(angle);
      }
    }
    const [x, y, z] = orbit.offset();
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    uniforms.uCam.value.copy(camera.position);
    renderer.render(scene, camera);
    return moving || turned || orbit.animating;
  }

  function upload(img: ImageData): THREE.DataTexture {
    const t = makePixelTexture(img, { mipmaps: false });
    textures.push(t);
    return t;
  }

  return {
    el,
    ok: !!renderer,
    set(input) {
      if (destroyed || !renderer) return;
      textures.forEach((t) => t.dispose());
      textures = [];
      const colour = firstFrame(input.colour);
      uniforms.uColor.value = upload(colour);
      uniforms.uMers.value = upload(firstFrame(input.mers));
      uniforms.uNormal.value = input.normal ? upload(firstFrame(input.normal)) : uniforms.uColor.value;
      uniforms.uHasNormal.value = input.normal ? 1 : 0;
      const translucent = alphaMode(colour) === 'translucent';
      uniforms.uBlend.value = translucent ? 1 : 0;
      material.transparent = translucent;
      material.side = input.shape === 'flat' ? THREE.DoubleSide : THREE.FrontSide;
      material.needsUpdate = true;
      if (input.shape !== shape) {
        shape = input.shape;
        mesh.geometry = shape === 'flat' ? plane : cube;
        orbit.setHome(shape === 'flat' ? FLAT_VIEW : VIEW);
      }
      loop.invalidate();
    },
    setView(v) {
      uniforms.uView.value = VIEW_INDEX[v];
      loop.invalidate();
    },
    setLight(deg) {
      angle = ((deg % 360) + 360) % 360;
      placeLight();
      loop.invalidate();
    },
    setMoving(on) {
      moving = on;
      loop.invalidate();
    },
    setNight(on) {
      uniforms.uNight.value = on ? 1 : 0;
      loop.invalidate();
    },
    destroy() {
      destroyed = true;
      loop.dispose();
      orbit.dispose();
      textures.forEach((t) => t.dispose());
      cube.dispose();
      plane.dispose();
      material.dispose();
      renderer?.dispose();
      el.remove();
    },
  };
}
