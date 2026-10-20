// three.js meshes for baked model quads: one draw per texture with crisp nearest filtering, the first
// animation frame (or the playing frame of a strip), biome / fixed tints per face, Bedrock tint masks,
// cutout and translucent textures, the game's directional face shading, hover highlighting, face
// picking (a transparent texel doesn't catch the pointer) and, for painting, an outline of the texels
// a brush would paint plus animation frames held still.

import * as THREE from 'three';
import { alphaMode, makePixelTexture, type PixelImage } from '../preview/three-utils';
import { DIR_VEC as DIR_NORMAL, type BakedQuad, type RGB, type Tint } from './geometry';
import { coplanarLifts } from './model-paint';
import { recolorTrim } from './trims';

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
uniform sampler2D uCursor;
uniform vec2 uCursorSize;
uniform float uCursorOn;
uniform vec4 uCursorFill;
uniform vec3 uCursorLine;
varying vec2 vUv;
varying vec3 vTint;
varying float vShade;
varying float vMask;
varying float vFace;
varying vec2 vCorner;

// Paint cursor: texels marked in uCursor (1 = brush, 0.5 = mirrored copy) get the brush colour and an
// outline (dark halo, light line) along the edge of the marked set, a constant width on screen.
float cursorAt(vec2 cell) {
  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= uCursorSize.x || cell.y >= uCursorSize.y) return 0.0;
  return texture2D(uCursor, (cell + 0.5) / uCursorSize).r;
}

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
  if (vMask > 1.5) {
    // armour mask: no alpha is see-through, a little is drawn as it is, full alpha takes the dye
    if (t.a < 0.002) discard;
    rgb *= mix(vec3(1.0), vTint, t.a);
    a = 1.0;
  } else if (vMask > 0.5) {
    rgb *= mix(vec3(1.0), vTint, t.a);
    a = 1.0;
  } else {
    rgb *= vTint;
  }
  float cm = 0.0;
  vec2 tc = vec2(0.0);
  vec2 cell = vec2(0.0);
  if (uCursorOn > 0.5) {
    tc = clamp(vUv, 0.0, 0.99999) * uCursorSize;
    cell = floor(tc);
    cm = cursorAt(cell);
  }
  if (a < uAlphaTest && cm < 0.25) discard;
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
  if (cm > 0.25) {
    float k = cm > 0.75 ? 1.0 : 0.55;
    // a see-through texel under the brush shows as a neutral grey, so the outline reads
    if (a < max(uAlphaTest, 0.004)) rgb = vec3(0.5) * vShade;
    vec2 f = tc - cell;
    // screen pixels per texel along each texture axis
    vec2 ppt = 1.0 / max(fwidth(tc), vec2(1e-5));
    float d = 1e5;
    if (abs(cursorAt(cell + vec2(-1.0, 0.0)) - cm) > 0.25) d = min(d, f.x * ppt.x);
    if (abs(cursorAt(cell + vec2(1.0, 0.0)) - cm) > 0.25) d = min(d, (1.0 - f.x) * ppt.x);
    if (abs(cursorAt(cell + vec2(0.0, -1.0)) - cm) > 0.25) d = min(d, f.y * ppt.y);
    if (abs(cursorAt(cell + vec2(0.0, 1.0)) - cm) > 0.25) d = min(d, (1.0 - f.y) * ppt.y);
    float w = clamp(min(ppt.x, ppt.y) * 0.2, 0.75, 1.5);
    rgb = mix(rgb, uCursorFill.rgb, uCursorFill.a * k);
    if (d < w) rgb = mix(rgb, vec3(0.0), 0.7 * k);
    else if (d < 2.0 * w) rgb = mix(rgb, uCursorLine, 0.95 * k);
    a = max(a, d < 2.0 * w ? k : max(uCursorFill.a, 0.5) * k);
  }
  gl_FragColor = vec4(rgb, uBlend > 0.5 ? a : 1.0);
}
`;

/** Texels a brush would paint, shown on one texture of the model (see ModelMesh.setCursor). */
export interface PaintCursor {
  /** Pack path of the texture */
  texture: string;
  /** Size of one frame of the texture, in texels */
  width: number;
  height: number;
  /** Texels (y * width + x) the brush covers */
  pixels: readonly number[];
  /** Texels a mirrored copy covers (drawn fainter) */
  echo?: readonly number[];
  /** Straight RGBA preview colour (alpha = strength), null for none */
  fill: [number, number, number, number] | null;
  /** 'locked': this texture can't be painted now (red outline) */
  tone?: 'normal' | 'locked';
}

/** The game's flat directional shading: top 1.0, north/south 0.8, east/west 0.6, bottom 0.5. */
export function faceShade(n: readonly number[]): number {
  const [x, y, z] = n;
  return x * x * 0.6 + z * z * 0.8 + y * y * (y > 0 ? 1 : 0.5);
}

interface Group {
  key: string;
  /** Pack path of the texture (MISSING for the checker) */
  path: string;
  /** Armour trims: the texture is recoloured from this palette pair */
  palette: { key: string; values: string } | null;
  /** The texture as given (before a palette recolours it) */
  source: ModelTextureImage | null;
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
  private cursorTex: THREE.DataTexture | null = null;
  private cursorKey: string | null = null;
  private readonly cursorFill = new THREE.Vector4(0, 0, 0, 0);
  private readonly cursorLine = new THREE.Color(1, 1, 1);
  private readonly cursorSize = new THREE.Vector2(1, 1);
  /** Painting holds animations still: textures show these frames (others frame 0) */
  private pinned: Map<string, number> | null = null;
  /** Palette images of trims (by pack path) */
  private palettes = new Map<string, ModelTextureImage>();

  /**
   * Builds meshes for quads; `textures` must hold every texture path the quads use (missing ones draw
   * the game's magenta checker) and the palettes of trims (a trim without its palettes draws its grey
   * pattern, as the game does).
   */
  build(quads: BakedQuad[], textures: Map<string, ModelTextureImage>, tint: (t: Tint) => RGB): void {
    this.clear();
    this.quads = quads;
    const byKey = new Map<string, { path: string; palette: Group['palette']; list: number[] }>();
    quads.forEach((q, i) => {
      const path = q.texture && textures.has(q.texture) ? q.texture : MISSING;
      const palette = path !== MISSING && q.palette && textures.has(q.palette.key) && textures.has(q.palette.values) ? q.palette : null;
      const key = palette ? `${path}\u0001${palette.key}\u0001${palette.values}` : path;
      let g = byKey.get(key);
      if (!g) byKey.set(key, (g = { path, palette, list: [] }));
      g.list.push(i);
      if (palette) for (const p of [palette.key, palette.values]) this.palettes.set(p, textures.get(p)!);
    });
    const lifts = coplanarLifts(quads);
    for (const [key, { path, palette, list }] of byKey) {
      const tex = path === MISSING ? null : textures.get(path)!;
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
          mask[v] = q.tintMask && q.tint ? (q.tintMask === 'armor' ? 2 : 1) : 0;
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
          uMissing: { value: path === MISSING ? 1 : 0 },
          uGlow: { value: 0 },
          uHoverFace: { value: -1 },
          uAccent: { value: this.accent },
          uCursor: { value: null },
          uCursorSize: { value: this.cursorSize },
          uCursorOn: { value: 0 },
          uCursorFill: { value: this.cursorFill },
          uCursorLine: { value: this.cursorLine },
        },
        side: THREE.FrontSide,
        extensions: { derivatives: true },
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.userData.modelKey = key;
      const g: Group = { key, path, palette, source: tex, mesh, material, texture: null, quads: list, image: null, frames: 1, frametime: 0, firstFace: list[0] };
      this.groups.set(key, g);
      if (tex) this.applyTexture(g, this.drawn(g, tex));
      this.group.add(mesh);
    }
    this.cursorKey = null;
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

  /** A group's texture as drawn: recoloured by its trim palettes (the game's palette swap), else as given. */
  private drawn(g: Group, tex: ModelTextureImage): ModelTextureImage {
    if (!g.palette) return tex;
    const key = this.palettes.get(g.palette.key);
    const values = this.palettes.get(g.palette.values);
    if (!key || !values) return tex;
    return { ...tex, image: recolorTrim(tex.image, firstFrameOf(key.image, key.frames), firstFrameOf(values.image, values.frames)) };
  }

  /** The groups drawing a texture (one per palette pair for trims). */
  private groupsOf(path: string): Group[] {
    const out: Group[] = [];
    for (const g of this.groups.values()) if (g.path === path) out.push(g);
    return out;
  }

  /**
   * Swaps a texture's pixels (live painting), or a trim palette's (recolouring the trims using it).
   * Returns false when the path isn't part of the model.
   */
  updateTexture(path: string, tex: ModelTextureImage): boolean {
    let hit = false;
    if (this.palettes.has(path)) {
      this.palettes.set(path, tex);
      for (const g of this.groups.values()) {
        if (!g.palette || (g.palette.key !== path && g.palette.values !== path) || !g.source) continue;
        this.applyTexture(g, this.drawn(g, g.source));
        hit = true;
      }
    }
    for (const g of this.groupsOf(path)) {
      g.source = tex;
      this.applyTexture(g, this.drawn(g, tex));
      hit = true;
    }
    return hit;
  }

  /** Advances animated strips to the frame for `seconds` of play time. Returns true when any texture animates. */
  animate(seconds: number): boolean {
    let any = false;
    for (const g of this.groups.values()) {
      if (g.frames <= 1) continue;
      if (this.pinned) {
        g.material.uniforms.uFrame.value = Math.min(g.frames - 1, Math.max(0, this.pinned.get(g.path) ?? 0));
        continue;
      }
      if (g.frametime <= 0) continue;
      any = true;
      g.material.uniforms.uFrame.value = Math.floor((seconds * 20) / g.frametime) % g.frames;
    }
    return any;
  }

  /**
   * Holds every animation still (painting): each texture shows the frame given for it, the rest their
   * first frame. null plays them again.
   */
  pinFrames(frames: Map<string, number> | null): void {
    this.pinned = frames ? new Map(frames) : null;
    if (this.pinned) this.animate(0);
  }

  /** Size of one frame of a texture as drawn (texels), or null when the model doesn't use it. */
  frameSize(path: string): [number, number] | null {
    const g = this.groupsOf(path)[0];
    if (!g?.image) return null;
    return [g.image.width, Math.max(1, Math.floor(g.image.height / g.frames))];
  }

  /**
   * Alpha (0..255) of the drawn texel at a texture point (0..1 of a frame, v down) of a texture, in the
   * frame on show. 255 for faces whose alpha is a tint mask or that draw opaque.
   */
  alphaAt(path: string, uv: readonly [number, number], quadIndex?: number): number {
    const all = this.groupsOf(path);
    const g = (quadIndex !== undefined && all.find((x) => x.quads.includes(quadIndex))) || all[0];
    if (!g?.image) return 255;
    const q = quadIndex !== undefined ? this.quads[quadIndex] : undefined;
    const armorMask = q?.tintMask === 'armor' && !!q.tint;
    if (q?.tintMask && q.tint && !armorMask) return 255;
    if (!armorMask && (g.material.uniforms.uAlphaTest.value as number) <= 0) return 255;
    const img = g.image;
    const fh = Math.max(1, Math.floor(img.height / g.frames));
    const frame = Math.min(g.frames - 1, Math.max(0, g.material.uniforms.uFrame.value as number));
    const x = Math.min(img.width - 1, Math.max(0, Math.floor(uv[0] * img.width)));
    const y = Math.min(fh - 1, Math.max(0, Math.floor(uv[1] * fh)));
    const a = img.data[((frame * fh + y) * img.width + x) * 4 + 3];
    return armorMask ? (a ? 255 : 0) : a;
  }

  /** Outlines the texels a brush would paint on one texture (null clears). */
  setCursor(c: PaintCursor | null): void {
    const target = c && this.groupsOf(c.texture).length && (c.pixels.length || c.echo?.length) ? c : null;
    if (!target) {
      if (this.cursorKey !== null) for (const g of this.groups.values()) g.material.uniforms.uCursorOn.value = 0;
      this.cursorKey = null;
      return;
    }
    const w = Math.max(1, target.width | 0);
    const h = Math.max(1, target.height | 0);
    let tex = this.cursorTex;
    if (!tex || tex.image.width !== w || tex.image.height !== h) {
      tex?.dispose();
      tex = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.flipY = false;
      this.cursorTex = tex;
    }
    const data = tex.image.data as unknown as Uint8Array;
    data.fill(0);
    const mark = (list: readonly number[] | undefined, v: number) => {
      if (!list) return;
      for (const p of list) if (p >= 0 && p < w * h && data[p * 4] < v) data[p * 4] = v;
    };
    mark(target.echo, 128);
    mark(target.pixels, 255);
    tex.needsUpdate = true;
    this.cursorSize.set(w, h);
    const f = target.fill;
    this.cursorFill.set(f ? f[0] / 255 : 1, f ? f[1] / 255 : 1, f ? f[2] / 255 : 1, f ? f[3] / 255 : 0);
    if (target.tone === 'locked') this.cursorLine.setRGB(1, 0.36, 0.36);
    else this.cursorLine.setRGB(1, 1, 1);
    for (const g of this.groups.values()) {
      const on = g.path === target.texture;
      g.material.uniforms.uCursorOn.value = on ? 1 : 0;
      if (on) g.material.uniforms.uCursor.value = tex;
    }
    this.cursorKey = target.texture;
  }

  get animated(): boolean {
    if (this.pinned) return false;
    for (const g of this.groups.values()) if (g.frames > 1 && g.frametime > 0) return true;
    return false;
  }

  /** Highlights every face using a texture (or a trim palette), and outlines one face (index into the quads). */
  highlight(texture: string | null, face = -1): void {
    this.hoverKey = texture;
    this.hoverFace = face;
    for (const g of this.groups.values()) {
      const uses = texture !== null && (g.path === texture || g.palette?.key === texture || g.palette?.values === texture);
      g.material.uniforms.uGlow.value = uses ? 1 : 0;
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
      const armorMask = q.tintMask === 'armor' && !!q.tint;
      if (g.image && h.uv && (armorMask || (g.material.uniforms.uAlphaTest.value > 0 && !(q.tintMask && q.tint)))) {
        const img = g.image;
        const fh = img.height / g.frames;
        const x = Math.min(img.width - 1, Math.max(0, Math.floor(h.uv.x * img.width)));
        const y = Math.min(fh - 1, Math.max(0, Math.floor(h.uv.y * fh)));
        if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
      }
      return { index: qi, quad: q, texture: g.path !== MISSING ? g.path : null, point: h.point.clone() };
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
    this.palettes.clear();
    this.quads = [];
    this.hoverFace = -1;
    this.hoverKey = null;
    this.cursorKey = null;
  }

  dispose(): void {
    this.clear();
    this.cursorTex?.dispose();
    this.cursorTex = null;
  }
}

function firstFrameOf(img: PixelImage, frames: number): PixelImage {
  const h = Math.floor(img.height / frames);
  return { width: img.width, height: h, data: img.data.subarray(0, img.width * h * 4) };
}
