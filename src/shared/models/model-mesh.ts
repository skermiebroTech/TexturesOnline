// three.js meshes for baked model quads: one draw per texture with crisp nearest filtering, the first
// animation frame (or the playing frame of a strip), biome / fixed tints per face, Bedrock tint masks,
// cutout and translucent textures, the game's directional face shading, hover highlighting and face
// picking (a transparent texel doesn't catch the pointer).

import * as THREE from 'three';
import { alphaMode, makePixelTexture, type PixelImage } from '../preview/three-utils';
import { DIR_VEC as DIR_NORMAL, type BakedQuad, type RGB, type Tint } from './geometry';

export interface ModelTextureImage {
  /** Straight RGBA; a vertical strip of square frames when `frames` > 1 */
  image: PixelImage;
  frames: number;
  /** Game ticks per frame (0 = still) */
  frametime: number;
  /** Force blending (26.x force_translucent sprites) */
  translucent?: boolean;
}

export interface ModelHit {
  /** Index into the quads the mesh was built from */
  index: number;
  quad: BakedQuad;
  /** Pack path (null = missing texture) */
  texture: string | null;
  point: THREE.Vector3;
}

const VERT = /* glsl */ `
attribute vec3 aTint;
attribute float aShade;
attribute float aMask;
attribute float aFace;
attribute vec2 aCorner;
varying vec2 vUv;
varying vec3 vTint;
varying float vShade;
varying float vMask;
varying float vFace;
varying vec2 vCorner;
void main() {
  vUv = uv;
  vTint = aTint;
  vShade = aShade;
  vMask = aMask;
  vFace = aFace;
  vCorner = aCorner;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uFrames;
uniform float uFrame;
uniform vec2 uHalf;
uniform float uAlphaTest;
uniform float uBlend;
uniform float uMissing;
uniform float uGlow;
uniform float uHoverFace;
uniform vec3 uAccent;
varying vec2 vUv;
varying vec3 vTint;
varying float vShade;
varying float vMask;
varying float vFace;
varying vec2 vCorner;
void main() {
  vec4 t;
  if (uMissing > 0.5) {
    vec2 c = floor(vUv * 2.0);
    t = mod(c.x + c.y, 2.0) < 0.5 ? vec4(0.97, 0.0, 0.97, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    vec2 uv = clamp(vUv, uHalf, vec2(1.0) - uHalf);
    t = texture2D(uMap, vec2(uv.x, 1.0 - (uFrame + uv.y) / uFrames));
  }
  vec3 rgb = t.rgb;
  float a = t.a;
  if (vMask > 0.5) {
    rgb *= mix(vec3(1.0), vTint, t.a);
    a = 1.0;
  } else {
    rgb *= vTint;
  }
  if (a < uAlphaTest) discard;
  rgb *= vShade;
  if (uGlow > 0.0) rgb = mix(rgb, vec3(1.0), 0.14 * uGlow);
  if (abs(vFace - uHoverFace) < 0.5) {
    float d = min(min(vCorner.x, 1.0 - vCorner.x), min(vCorner.y, 1.0 - vCorner.y));
    float w = fwidth(d) * 2.5;
    float edge = 1.0 - smoothstep(w * 0.5, w, d);
    rgb = mix(rgb, uAccent, 0.16);
    rgb = mix(rgb, uAccent, edge);
    a = max(a, edge);
  }
  gl_FragColor = vec4(rgb, uBlend > 0.5 ? a : 1.0);
}
`;

/** The game's flat directional shading: top 1.0, north/south 0.8, east/west 0.6, bottom 0.5. */
export function faceShade(n: readonly number[]): number {
  const [x, y, z] = n;
  return x * x * 0.6 + z * z * 0.8 + y * y * (y > 0 ? 1 : 0.5);
}

interface Group {
  key: string;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  texture: THREE.DataTexture | null;
  /** quad index per two triangles */
  quads: number[];
  image: PixelImage | null;
  frames: number;
  frametime: number;
  firstFace: number;
}

const MISSING = '\u0000missing';

export class ModelMesh {
  readonly group = new THREE.Group();
  private groups = new Map<string, Group>();
  private quads: BakedQuad[] = [];
  private hoverFace = -1;
  private hoverKey: string | null = null;
  private accent = new THREE.Color(0x5bd35b);

  /** Builds meshes for quads; `textures` must hold every texture path the quads use (missing ones draw the game's magenta checker). */
  build(quads: BakedQuad[], textures: Map<string, ModelTextureImage>, tint: (t: Tint) => RGB): void {
    this.clear();
    this.quads = quads;
    const byKey = new Map<string, number[]>();
    quads.forEach((q, i) => {
      const key = q.texture && textures.has(q.texture) ? q.texture : MISSING;
      let list = byKey.get(key);
      if (!list) byKey.set(key, (list = []));
      list.push(i);
    });
    const lifts = coplanarLifts(quads);
    for (const [key, list] of byKey) {
      const tex = key === MISSING ? null : textures.get(key)!;
      const pos = new Float32Array(list.length * 4 * 3);
      const nrm = new Float32Array(list.length * 4 * 3);
      const uv = new Float32Array(list.length * 4 * 2);
      const tintA = new Float32Array(list.length * 4 * 3);
      const shade = new Float32Array(list.length * 4);
      const mask = new Float32Array(list.length * 4);
      const face = new Float32Array(list.length * 4);
      const corner = new Float32Array(list.length * 4 * 2);
      const index: number[] = [];
      const CORNERS = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ];
      list.forEach((qi, k) => {
        const q = quads[qi];
        const lift = lifts[qi];
        const rgb = q.tint ? tint(q.tint) : ([255, 255, 255] as RGB);
        const sh = !q.shade ? 1 : q.shadeDir ? faceShade(DIR_NORMAL[q.shadeDir]) : faceShade(q.normal);
        for (let c = 0; c < 4; c++) {
          const v = k * 4 + c;
          const p = q.positions[c];
          pos.set([p[0] + q.normal[0] * lift, p[1] + q.normal[1] * lift, p[2] + q.normal[2] * lift], v * 3);
          nrm.set(q.normal, v * 3);
          uv.set([q.uvs[c][0] / 16, q.uvs[c][1] / 16], v * 2);
          tintA.set([rgb[0] / 255, rgb[1] / 255, rgb[2] / 255], v * 3);
          shade[v] = sh;
          mask[v] = q.tintMask && q.tint ? 1 : 0;
          face[v] = qi;
          corner.set(CORNERS[c], v * 2);
        }
        const b = k * 4;
        index.push(b, b + 1, b + 2, b, b + 2, b + 3);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setAttribute('aTint', new THREE.BufferAttribute(tintA, 3));
      geo.setAttribute('aShade', new THREE.BufferAttribute(shade, 1));
      geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 1));
      geo.setAttribute('aFace', new THREE.BufferAttribute(face, 1));
      geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
      geo.setIndex(index);
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uMap: { value: null },
          uFrames: { value: 1 },
          uFrame: { value: 0 },
          uHalf: { value: new THREE.Vector2(0, 0) },
          uAlphaTest: { value: 0 },
          uBlend: { value: 0 },
          uMissing: { value: key === MISSING ? 1 : 0 },
          uGlow: { value: 0 },
          uHoverFace: { value: -1 },
          uAccent: { value: this.accent },
        },
        side: THREE.FrontSide,
        extensions: { derivatives: true },
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.userData.modelKey = key;
      const g: Group = { key, mesh, material, texture: null, quads: list, image: null, frames: 1, frametime: 0, firstFace: list[0] };
      this.groups.set(key, g);
      if (tex) this.applyTexture(g, tex);
      this.group.add(mesh);
    }
  }

  private applyTexture(g: Group, tex: ModelTextureImage): void {
    const frames = Math.max(1, tex.frames | 0);
    const same = g.texture && g.image && g.image.width === tex.image.width && g.image.height === tex.image.height;
    if (same && g.texture) {
      const data = g.texture.image.data as unknown as Uint8Array;
      const { width: w, height: h } = tex.image;
      const row = w * 4;
      for (let y = 0; y < h; y++) data.set(tex.image.data.subarray(y * row, (y + 1) * row), (h - 1 - y) * row);
      g.texture.needsUpdate = true;
    } else {
      g.texture?.dispose();
      g.texture = makePixelTexture(tex.image, { mipmaps: false });
    }
    g.image = tex.image;
    g.frames = frames;
    g.frametime = tex.frametime;
    const mode = tex.translucent ? 'translucent' : alphaMode(frames > 1 ? firstFrameOf(tex.image, frames) : tex.image);
    const u = g.material.uniforms;
    u.uMap.value = g.texture;
    u.uFrames.value = frames;
    u.uFrame.value = Math.min(u.uFrame.value as number, frames - 1);
    u.uHalf.value.set(0.5 / Math.max(1, tex.image.width), 0.5 / Math.max(1, tex.image.height / frames));
    u.uAlphaTest.value = mode === 'translucent' ? 0.004 : mode === 'cutout' ? 0.1 : 0;
    u.uBlend.value = mode === 'translucent' ? 1 : 0;
    const blend = mode === 'translucent';
    if (g.material.transparent !== blend) {
      g.material.transparent = blend;
      g.material.depthWrite = !blend;
      g.material.needsUpdate = true;
    }
    g.mesh.renderOrder = blend ? 2 : 0;
  }

  /** Swaps a texture's pixels (live painting). Returns false when the path isn't part of the model. */
  updateTexture(path: string, tex: ModelTextureImage): boolean {
    const g = this.groups.get(path);
    if (!g) return false;
    this.applyTexture(g, tex);
    return true;
  }

  /** Advances animated strips to the frame for `seconds` of play time. Returns true when any texture animates. */
  animate(seconds: number): boolean {
    let any = false;
    for (const g of this.groups.values()) {
      if (g.frames <= 1 || g.frametime <= 0) continue;
      any = true;
      g.material.uniforms.uFrame.value = Math.floor((seconds * 20) / g.frametime) % g.frames;
    }
    return any;
  }

  get animated(): boolean {
    for (const g of this.groups.values()) if (g.frames > 1 && g.frametime > 0) return true;
    return false;
  }

  /** Highlights every face using a texture, and outlines one face (index into the quads). */
  highlight(texture: string | null, face = -1): void {
    this.hoverKey = texture;
    this.hoverFace = face;
    for (const g of this.groups.values()) {
      g.material.uniforms.uGlow.value = texture !== null && g.key === texture ? 1 : 0;
      g.material.uniforms.uHoverFace.value = face;
    }
  }

  get highlighted(): { texture: string | null; face: number } {
    return { texture: this.hoverKey, face: this.hoverFace };
  }

  setAccent(css: string): void {
    try {
      this.accent.set(css);
    } catch {
      /* keep the default */
    }
  }

  /** The front-most face under a ray, skipping fully transparent texels. */
  pick(raycaster: THREE.Raycaster): ModelHit | null {
    const hits = raycaster.intersectObjects([...this.groups.values()].map((g) => g.mesh), false);
    for (const h of hits) {
      const g = this.groups.get((h.object as THREE.Mesh).userData.modelKey as string);
      if (!g || h.faceIndex === undefined || h.faceIndex === null) continue;
      const qi = g.quads[h.faceIndex >> 1];
      const q = this.quads[qi];
      if (g.image && h.uv && g.material.uniforms.uAlphaTest.value > 0 && !(q.tintMask && q.tint)) {
        const img = g.image;
        const fh = img.height / g.frames;
        const x = Math.min(img.width - 1, Math.max(0, Math.floor(h.uv.x * img.width)));
        const y = Math.min(fh - 1, Math.max(0, Math.floor(h.uv.y * fh)));
        if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
      }
      return { index: qi, quad: q, texture: q.texture && this.groups.has(q.texture) ? q.texture : null, point: h.point.clone() };
    }
    return null;
  }

  /** Centre of the quad's corners (model space). */
  quadCenter(index: number): THREE.Vector3 | null {
    const q = this.quads[index];
    if (!q) return null;
    const c = new THREE.Vector3();
    for (const p of q.positions) c.add(new THREE.Vector3(p[0], p[1], p[2]));
    return c.multiplyScalar(0.25);
  }

  quadList(): readonly BakedQuad[] {
    return this.quads;
  }

  clear(): void {
    for (const g of this.groups.values()) {
      this.group.remove(g.mesh);
      g.mesh.geometry.dispose();
      g.material.dispose();
      g.texture?.dispose();
    }
    this.groups.clear();
    this.quads = [];
    this.hoverFace = -1;
    this.hoverKey = null;
  }

  dispose(): void {
    this.clear();
  }
}

function firstFrameOf(img: PixelImage, frames: number): PixelImage {
  const h = Math.floor(img.height / frames);
  return { width: img.width, height: h, data: img.data.subarray(0, img.width * h * 4) };
}

/**
 * Faces lying in the same plane as an earlier face (overlays such as the grass block's tinted side)
 * are lifted a hair along their normal so they draw on top instead of flickering.
 */
function coplanarLifts(quads: BakedQuad[]): number[] {
  const seen = new Map<string, number>();
  return quads.map((q) => {
    const n = q.normal;
    const p = q.positions[0];
    const d = n[0] * p[0] + n[1] * p[1] + n[2] * p[2];
    const key = `${n.map((c) => c.toFixed(3)).join(',')}|${d.toFixed(4)}`;
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    return k * 0.0012;
  });
}
