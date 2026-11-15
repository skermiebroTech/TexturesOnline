// "Says Who?" — the picture. Every frame is a pure function of time, so the film renders offline at any quality.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const W = 1920, H = 1080, DUR = 45, BEAT = 60 / 128, BAR = BEAT * 4;
export const T = {
  look: 12.6, drop: 15, tex: 15 + 2 * BAR, smile: 15 + 4 * BAR, styles: 15 + 5 * BAR, skinP: 15 + 7 * BAR, skinW: 15 + 8 * BAR,
  skyP: 15 + 9 * BAR, skyW: 15 + 10 * BAR, words: 15 + 11 * BAR, end: 15 + 12 * BAR,
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const outCubic = t => 1 - Math.pow(1 - clamp(t), 3);
const outExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
const outBack = t => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const DEG = Math.PI / 180;
const FONT = "'Texel', ui-monospace, Menlo, Consolas, monospace";

/* ------------------------------------------------------------------ looks */
const FL = ['#ff4b4b', '#ffd23f', '#6fa8ff'];
const THEMES = {
  plain:  { grass: '#5f9a3c', dirt: '#7a553a', stone: '#8a8d92', sand: '#d9cc98', water: '#3f76e4', log: '#6b4f2d', leaves: '#3d7f2e', planks: '#b08a55', roof: '#7a3b2e', wool: '#ececec', fl: FL, sky: ['#6f7a88', '#b4bbc4'], sun: ['#ffffff', 1.5], amb: 1.0, sat: 0.5, el: 52 },
  pink:   { grass: '#ff4fa3', dirt: '#8b45b5', stone: '#b79cff', sand: '#ffe0f0', water: '#3fe0e0', log: '#fff4fa', leaves: '#ffd23f', planks: '#ff9ecf', roof: '#7b3fd0', wool: '#ffd23f', fl: ['#ffffff', '#3fe0e0', '#ffd23f'], sky: ['#ff6fb5', '#ffe2a8'], sun: ['#fff0d8', 2.7], amb: 1.0, sat: 1.15, el: 42 },
  autumn: { grass: '#d9772b', dirt: '#6a3f24', stone: '#8a7f76', sand: '#e7c98f', water: '#2f8f9f', log: '#4b2f1c', leaves: '#c7301f', planks: '#a8683a', roof: '#5a2a1c', wool: '#f3e3c8', fl: ['#ffd23f', '#c7301f', '#fff0c0'], sky: ['#d9702a', '#ffe1b0'], sun: ['#ffc27a', 3.0], amb: 0.8, sat: 1.1, el: 22 },
  frost:  { grass: '#f2f9ff', dirt: '#7f90a6', stone: '#a9bdd0', sand: '#dff0f8', water: '#8fd6ff', log: '#56657a', leaves: '#8fe0d2', planks: '#9fb4c8', roof: '#3f6fb0', wool: '#ffffff', fl: ['#8fd6ff', '#ffffff', '#b7a0ff'], sky: ['#4f9cec', '#eaf6ff'], sun: ['#ffffff', 2.4], amb: 1.1, sat: 1.05, el: 48 },
  neon:   { grass: '#161a34', dirt: '#0d1024', stone: '#1a1f3c', sand: '#1f183a', water: '#00d5ff', log: '#ff2bd6', leaves: '#2bff7c', planks: '#241a48', roof: '#ff2bd6', wool: '#2bff7c', fl: ['#ff2bd6', '#00e5ff', '#fff94a'], sky: ['#03040b', '#2a0f55'], sun: ['#8f7bff', 0.7], amb: 0.5, sat: 1.2, el: 55, neon: 1 },
  pastel: { grass: '#b9f0c8', dirt: '#e8c8a8', stone: '#d8d0f0', sand: '#fff3d0', water: '#a8dcff', log: '#d8b8a0', leaves: '#ffc8dc', planks: '#ffe0b8', roof: '#ffa8b8', wool: '#fff8f0', fl: ['#ffa8b8', '#fff3a0', '#b8c8ff'], sky: ['#b8d8ff', '#ffe8f0'], sun: ['#fff8f0', 2.3], amb: 1.25, sat: 1.0, el: 55 },
  retro:  { grass: '#8bac0f', dirt: '#306230', stone: '#306230', sand: '#9bbc0f', water: '#0f380f', log: '#0f380f', leaves: '#306230', planks: '#8bac0f', roof: '#0f380f', wool: '#9bbc0f', fl: ['#0f380f', '#9bbc0f', '#306230'], sky: ['#8bac0f', '#cadc6f'], sun: ['#f0ffb0', 2.2], amb: 1.0, sat: 1.0, el: 50 },
  noir:   { grass: '#c8c8c8', dirt: '#3a3a3a', stone: '#707070', sand: '#e8e8e8', water: '#151515', log: '#1c1c1c', leaves: '#8a8a8a', planks: '#b0b0b0', roof: '#1a1a1a', wool: '#ffffff', fl: ['#ffffff', '#111111', '#ff2222'], sky: ['#0c0c0c', '#8a8a8a'], sun: ['#ffffff', 3.2], amb: 0.45, sat: 1.0, el: 18 },
  vivid:  { grass: '#5bd35b', dirt: '#8a5a38', stone: '#98a0b0', sand: '#f2e2a4', water: '#3aa7ff', log: '#7a5530', leaves: '#2fa84a', planks: '#d8a860', roof: '#d8483a', wool: '#ffffff', fl: FL, sky: ['#2a84e4', '#c9ecff'], sun: ['#fff2d6', 2.9], amb: 1.0, sat: 1.12, el: 44 },
};
const TYPE_LIST = ['grass', 'dirt', 'stone', 'sand', 'water', 'log', 'leaves', 'planks', 'roof', 'wool', 'f0', 'f1', 'f2', 'door', 'glow', 'cloud'];
const PAL = {};
for (const k in THEMES) {
  const th = THEMES[k]; PAL[k] = {};
  for (const ty of TYPE_LIST) PAL[k][ty] = new THREE.Color(th[ty] || (ty[0] === 'f' ? th.fl[+ty[1]] : ty === 'door' ? '#2a1c12' : '#ffffff'));
}
// colour waves: a look spreads from a point at a speed (blocks per second)
const ORDER8 = ['autumn', 'frost', 'neon', 'pastel', 'retro', 'noir', 'pink', 'vivid'];
const WAVES = [
  { t0: T.drop, th: 'pink', ox: 1, oz: 1, sp: 15 }, { t0: T.drop + BAR, th: 'autumn', ox: 1, oz: 1, sp: 24 },
  { t0: T.smile - 0.02, th: 'vivid', ox: 0, oz: 0, sp: 1e4 },
  ...ORDER8.map((th, n) => ({ t0: T.styles + n * BEAT, th, ox: 0, oz: 0, sp: 70 })),
  ...['frost', 'neon', 'pink', 'vivid'].map((th, n) => ({ t0: T.words + n * BEAT, th, ox: 0, oz: 0, sp: 70 })),
];
const SMILE = { t0: T.smile + 0.25, ox: -6, oz: -7, sp: 16 };
function stateAt(t, x, z) { // which look a point wears now, which it wore before, and for how long
  let cur = 'plain', prev = 'plain', s = 99;
  for (const w of WAVES) { const q = t - w.t0 - Math.hypot(x - w.ox, z - w.oz) / w.sp; if (q >= 0) { prev = cur; cur = w.th; s = q; } else if (t < w.t0) break; }
  return [cur, prev, s];
}
function globalTheme(t) { let cur = 'plain', prev = 'plain', k = 1; for (const w of WAVES) if (t >= w.t0) { prev = cur; cur = w.th; k = clamp((t - w.t0) / (w.sp > 1e3 ? 0.001 : w.sp > 50 ? 0.12 : 0.3)); } return [cur, prev, k]; }

/* ------------------------------------------------------------------ renderer */
let renderer, composer, renderPass, bokeh, bloom, finalPass, out2d, glCanvas;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, W / H, 0.02, 1200);
const studio = new THREE.Scene(), studioCam = new THREE.PerspectiveCamera(28, W / H, 0.1, 400);
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1 }, vig: { value: 0.3 }, grain: { value: 0.035 }, time: { value: 0 }, fade: { value: 1 }, contrast: { value: 1.04 }, ca: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, vig, grain, time, fade, contrast, ca; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 37.0) * 43758.5453); }
    void main(){ vec2 d = vUv - 0.5; float r2 = dot(d, d); vec2 o = d * r2 * 0.012 * ca;
      vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
      float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, sat); c = (c - 0.5) * contrast + 0.5;
      c *= 1.0 - vig * smoothstep(0.25, 0.85, r2 * 2.2); c += (h(vUv * vec2(1920.0, 1080.0)) - 0.5) * grain;
      gl_FragColor = vec4(c * fade, 1.0); }`,
};
function pxTex(size, fn, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { g.fillStyle = fn(x, y); g.fillRect(x, y, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const grey = v => { const n = Math.round(clamp(v) * 255); return `rgb(${n},${n},${n})`; };

/* ------------------------------------------------------------------ the island */
const N = 30, CC = 15, V = []; // V: every drawn box
const hmap = [], kind = [];
const inside = (i, j) => i >= 0 && j >= 0 && i < N && j < N && Math.hypot(i - CC, j - CC) < 13.2 + 1.6 * Math.sin(Math.atan2(j - CC, i - CC) * 5);
const depthAt = (i, j) => Math.round(1 + (14 - Math.hypot(i - CC, j - CC)) * 0.6 + hash(i, j, 5) * 1.8);
function buildHeights() {
  for (let i = 0; i < N; i++) { hmap[i] = []; kind[i] = []; for (let j = 0; j < N; j++) {
    const x = i - CC, z = j - CC;
    let v = 2.7 + 1.2 * Math.sin(i * 0.38 + 1.3) + 1.0 * Math.cos(j * 0.33 + 0.4) + 0.7 * Math.sin((i + j) * 0.21);
    v -= Math.max(0, 3.4 - Math.hypot(x - 6, z + 4) * 0.6) * 1.4; // pond
    let h = Math.max(1, Math.min(5, Math.round(v))), k = 'grass';
    if (x >= -2 && z >= -2 && x + z <= 14 && Math.abs(x - z) <= 7) h = 3; // the open lawn where the hero stands, clear toward the camera
    if (x >= -9 && x <= -3 && z >= 1 && z <= 7) h = 3; // house pad
    const r = Math.hypot(x + 6, z + 7); if (r < 3.6) { h = Math.max(h, 3 + Math.round((3.6 - r) * 1.25)); k = 'stone'; } // crag
    hmap[i][j] = h; kind[i][j] = k;
  } }
}
const hAt = (x, z) => (inside(x + CC, z + CC) ? hmap[x + CC][z + CC] : -99);
const solid = (i, j, k) => inside(i, j) && k <= hmap[i][j] && k >= -depthAt(i, j);
function add(mesh, type, x, y, z, sx = 1, sy = sx, sz = sx, o = {}) { V.push({ mesh, type, x, y, z, sx, sy, sz, lift: o.lift !== false, ...o }); }
function buildWorld() {
  buildHeights();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (!inside(i, j)) continue;
    const x = i - CC, z = j - CC, h = hmap[i][j], wet = h <= 1;
    const nearWet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inside(i + a, j + b) && hmap[i + a][j + b] <= 1);
    for (let k = -depthAt(i, j); k <= h; k++) {
      if (solid(i + 1, j, k) && solid(i - 1, j, k) && solid(i, j + 1, k) && solid(i, j - 1, k) && solid(i, j, k + 1) && solid(i, j, k - 1)) continue;
      if (wet && k === h) { add('water', 'water', x, k - 0.1, z, 1, 0.8, 1, { lift: false }); continue; }
      const top = k === h, stone = kind[i][j] === 'stone' ? k >= 2 : k < h - 2 || k < 0;
      const type = stone ? 'stone' : top && (nearWet || wet) ? 'sand' : 'dirt';
      add(type === 'stone' ? 'stone' : 'blocks', type, x, k, z);
      if (top && type === 'dirt') add('blocks', 'grass', x, k + 0.41, z, 1.04, 0.22, 1.04);
    }
    if (kind[i][j] === 'grass' && !wet && !nearWet && hash(i, j, 9) > 0.86 && !(Math.abs(x) <= 1 && Math.abs(z) <= 1) && !(x >= -9 && x <= -3 && z >= 1 && z <= 7)) {
      const f = Math.floor(hash(i, j, 11) * 3);
      add('blocks', 'leaves', x, h + 0.68, z, 0.08, 0.3, 0.08); add('blocks', 'f' + f, x, h + 0.9, z, 0.24);
    }
  }
  for (const [tx, tz, th] of [[10, 2, 4], [-11, -2, 3], [3, -9, 4], [-4, 10, 3], [-2, -11, 3], [8, -9, 3], [-10, -6, 4]]) {
    const b = hAt(tx, tz); if (b < 2) continue;
    for (let k = 1; k <= th; k++) add('blocks', 'log', tx, b + k, tz, 0.8, 1, 0.8);
    for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) { if (a || c) add('blocks', 'leaves', tx + a, b + th, tz + c); add('blocks', 'leaves', tx + a, b + th + 1, tz + c); }
    add('blocks', 'leaves', tx, b + th + 2, tz);
  }
  // the cottage
  const b = 3;
  for (let x = -8; x <= -4; x++) for (let z = 2; z <= 5; z++) for (let k = 1; k <= 3; k++) {
    if (x > -8 && x < -4 && z > 2 && z < 5) continue;
    if (x === -6 && z === 5 && k <= 2) { add('blocks', 'door', x, b + k, z - 0.2, 1, 1, 0.6); continue; }
    if (k === 2 && ((z === 5 && (x === -7 || x === -5)) || (x === -4 && (z === 3 || z === 4)))) { add('glow', 'glow', x, b + k, z, 0.98); continue; }
    add('blocks', 'planks', x, b + k, z);
  }
  for (let l = 0; l < 3; l++) for (let x = -9 + l; x <= -3 - l; x++) for (let z = 1 + l; z <= 6 - l; z++) add('blocks', 'roof', x, b + 4 + l * 0.6 - 0.2, z, 1, 0.6, 1);
  add('stone', 'stone', -5, b + 6, 3, 0.7, 1.6, 0.7);
  for (const [lx, lz] of [[-2, 6], [3, -3], [-10, 4]]) { const hh = hAt(lx, lz); add('blocks', 'log', lx, hh + 1, lz, 0.18, 1, 0.18); add('glow', 'glow', lx, hh + 1.65, lz, 0.34); }
  // little islands far off, for depth
  for (const [cx, cy, cz, r] of [[-34, 3, -30, 3.2], [30, -4, -38, 2.6], [-44, 8, 6, 2.2], [14, 10, -52, 2.8]]) {
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { const d = Math.hypot(x, z); if (d > r) continue; const dep = Math.round((r - d) * 1.4);
      for (let k = -dep; k <= 0; k++) add('blocks', k < -1 ? 'stone' : 'dirt', cx + x, cy + k, cz + z);
      add('blocks', 'grass', cx + x, cy + 0.41, cz + z, 1.04, 0.22, 1.04); }
    add('blocks', 'log', cx, cy + 1, cz, 0.8, 1, 0.8); add('blocks', 'log', cx, cy + 2, cz, 0.8, 1, 0.8);
    for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) add('blocks', 'leaves', cx + a, cy + 3, cz + c); add('blocks', 'leaves', cx, cy + 4, cz);
  }
  for (let n = 0; n < 9; n++) { // clouds
    const cx = (hash(n, 1) - 0.5) * 150, cy = 15 + hash(n, 2) * 14, cz = -20 - hash(n, 3) * 80 + (n % 3 === 0 ? 70 : 0);
    for (let m = 0; m < 7; m++) add('cloud', 'cloud', cx + (hash(n, m, 4) - 0.5) * 12, cy + (hash(n, m, 5) - 0.5) * 1.6, cz + (hash(n, m, 6) - 0.5) * 6, 4 + hash(n, m, 7) * 5, 1.4 + hash(n, m, 8), 3 + hash(n, m, 9) * 3, { lift: false, cloud: n });
  }
}
const MESH = {}; let smileMesh, grainTex, borderTex;
const SM = ['................', '................', '................', '................', '....##....##....', '....##....##....', '....##....##....', '................', '................', '...#........#...', '...#........#...', '....########....', '................', '................', '................', '................'];
function buildMeshes() {
  grainTex = pxTex(8, (x, y) => grey(0.8 + hash(x, y, 3) * 0.2 - (x === 0 || y === 0 || x === 7 || y === 7 ? 0.07 : 0)));
  borderTex = pxTex(16, (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? '#fff' : '#000'));
  const faceTex = pxTex(16, (x, y) => (SM[y][x] === '#' ? '#ffd23f' : grey(0.82 + hash(x >> 1, y >> 1, 3) * 0.18)));
  const faceGlow = pxTex(16, (x, y) => (SM[y][x] === '#' ? '#ffcf4a' : '#000'));
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mats = {
    blocks: new THREE.MeshStandardMaterial({ map: grainTex, roughness: 0.92, emissive: new THREE.Color('#35f0ff'), emissiveMap: borderTex, emissiveIntensity: 0 }),
    stone: null,
    water: new THREE.MeshStandardMaterial({ map: grainTex, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.86 }),
    glow: new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: new THREE.Color('#ffb648'), emissiveIntensity: 0.2, roughness: 0.6 }),
    cloud: new THREE.MeshStandardMaterial({ roughness: 1, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.25, fog: false }),
    smile: new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.9, emissive: new THREE.Color('#ffffff'), emissiveMap: faceGlow, emissiveIntensity: 0.9 }),
  };
  mats.stone = mats.blocks;
  for (const name of ['blocks', 'stone', 'water', 'glow', 'cloud']) {
    const list = V.filter(v => v.mesh === name), m = new THREE.InstancedMesh(box, mats[name], list.length);
    m.castShadow = name !== 'cloud' && name !== 'water'; m.receiveShadow = name !== 'cloud'; m.frustumCulled = false;
    list.forEach((v, i) => { v.idx = i; m.setColorAt(i, new THREE.Color(1, 1, 1)); }); m.userData.list = list; MESH[name] = m; scene.add(m);
  }
  const sl = MESH.stone.userData.list; smileMesh = new THREE.InstancedMesh(box, mats.smile, sl.length);
  smileMesh.castShadow = smileMesh.receiveShadow = true; smileMesh.frustumCulled = false; sl.forEach((v, i) => smileMesh.setColorAt(i, new THREE.Color(1, 1, 1))); scene.add(smileMesh);
  MESH.mats = mats;
}
const tmpC = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1);
function writeInst(mesh, i, x, y, z, sx, sy, sz) { const a = mesh.instanceMatrix.array, o = i * 16; a[o] = sx; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0; a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = sz; a[o + 11] = 0; a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1; }
function updateWorld(t) {
  for (const name of ['blocks', 'stone', 'water', 'glow', 'cloud']) {
    const m = MESH[name], list = m.userData.list, col = m.instanceColor.array;
    for (const v of list) {
      const [cur, prev, s] = stateAt(t, v.x, v.z);
      let lift = 0, pop = 1;
      if (s < 0.7 && v.lift) { lift = 1.1 * Math.exp(-5 * s) * Math.abs(Math.cos(s * 9)); pop = 1 + 0.12 * Math.exp(-9 * s); }
      tmpC.copy(PAL[prev][v.type]).lerp(PAL[cur][v.type], smooth(s / 0.2)); if (s < 0.09) tmpC.lerp(WHITE, 0.85 * (1 - s / 0.09));
      let x = v.x, y = v.y + lift, sx = v.sx * pop, sy = v.sy * pop, sz = v.sz * pop;
      if (name === 'water') y += 0.03 * Math.sin(t * 2 + v.x * 0.9 + v.z * 0.7);
      if (name === 'cloud') x += t * (0.35 + (v.cloud % 3) * 0.12);
      if (name === 'stone') {
        const q = t - SMILE.t0 - Math.hypot(v.x - SMILE.ox, v.z - SMILE.oz) / SMILE.sp, on = q >= 0;
        const p2 = on && q < 0.5 ? 1 + 0.22 * Math.exp(-8 * q) * Math.cos(q * 20) : 1, l2 = on && q < 0.5 ? 0.5 * Math.exp(-7 * q) : 0;
        if (on) { writeInst(smileMesh, v.idx, x, y + l2, v.z, sx * p2, sy * p2, sz * p2); writeInst(m, v.idx, 0, -999, 0, 0, 0, 0); }
        else { writeInst(m, v.idx, x, y, v.z, sx, sy, sz); writeInst(smileMesh, v.idx, 0, -999, 0, 0, 0, 0); }
        tmpC.toArray(smileMesh.instanceColor.array, v.idx * 3);
      } else writeInst(m, v.idx, x, y, v.z, sx, sy, sz);
      tmpC.toArray(col, v.idx * 3);
    }
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }
  smileMesh.instanceMatrix.needsUpdate = true; smileMesh.instanceColor.needsUpdate = true;
}

/* ------------------------------------------------------------------ cast */
const hero = { g: new THREE.Group(), parts: {}, mats: {}, acc: {} };
const OUTFITS = [
  { skin: '#e2ac84', hair: '#4a3524', shirt: '#9098a8', pants: '#59606e', shoes: '#33363d' },
  { skin: '#e2ac84', hair: '#4a3524', shirt: '#cfd6e2', pants: '#8d96a8', shoes: '#5a6272', acc: ['helm', 'plume', 'tabard'] },
  { skin: '#9fb4c8', hair: '#7fd0ff', shirt: '#3a4a6a', pants: '#2a3550', shoes: '#7fd0ff', acc: ['antenna', 'bulb', 'chest'] },
  { skin: '#e2ac84', hair: '#f2f2f2', shirt: '#7b3fd0', pants: '#5a2aa8', shoes: '#3a1a70', acc: ['brim', 'cone', 'tip', 'band'] },
  { skin: '#e2ac84', hair: '#4a3524', shirt: '#5bd35b', pants: '#1f5a2a', shoes: '#f2f2f2' },
];
function buildHero() {
  const M = c => new THREE.MeshStandardMaterial({ color: c, map: grainTex, roughness: 0.85 });
  const m = hero.mats; for (const k of ['skin', 'hair', 'shirt', 'pants', 'shoes']) m[k] = M('#fff');
  const part = (w, h, d, mat, px, py, pz, parent = hero.g, oy = 0) => { // a box hanging from a pivot
    const piv = new THREE.Group(); piv.position.set(px, py, pz); const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mesh.position.y = oy; mesh.castShadow = mesh.receiveShadow = true; piv.add(mesh); parent.add(piv); return piv;
  };
  const P = hero.parts;
  P.body = new THREE.Group(); hero.g.add(P.body);
  P.torso = part(0.6, 0.7, 0.32, m.shirt, 0, 1.05, 0, P.body);
  P.legL = part(0.27, 0.7, 0.27, m.pants, -0.16, 0.7, 0, P.body, -0.35); P.legR = part(0.27, 0.7, 0.27, m.pants, 0.16, 0.7, 0, P.body, -0.35);
  part(0.29, 0.14, 0.31, m.shoes, 0, -0.63, 0.01, P.legL); part(0.29, 0.14, 0.31, m.shoes, 0, -0.63, 0.01, P.legR);
  P.armL = part(0.22, 0.68, 0.22, m.shirt, -0.42, 1.36, 0, P.body, -0.3); P.armR = part(0.22, 0.68, 0.22, m.shirt, 0.42, 1.36, 0, P.body, -0.3);
  part(0.22, 0.16, 0.22, m.skin, 0, -0.66, 0, P.armL); part(0.22, 0.16, 0.22, m.skin, 0, -0.66, 0, P.armR);
  const faceC = document.createElement('canvas'); faceC.width = faceC.height = 8; const g = faceC.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 8); g.fillStyle = '#fff'; g.fillRect(1, 3, 2, 2); g.fillRect(5, 3, 2, 2);
  g.fillStyle = '#20242c'; g.fillRect(2, 3, 1, 2); g.fillRect(5, 3, 1, 2); g.fillStyle = '#8a4a3a'; g.fillRect(3, 6, 2, 1);
  hero.faceCtx = g; hero.faceTex = new THREE.CanvasTexture(faceC); hero.faceTex.magFilter = THREE.NearestFilter; hero.faceTex.colorSpace = THREE.SRGBColorSpace;
  m.face = new THREE.MeshStandardMaterial({ map: hero.faceTex, roughness: 0.85 });
  P.head = new THREE.Group(); P.head.position.set(0, 1.42, 0); P.body.add(P.head);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56), [m.skin, m.skin, m.skin, m.skin, m.face, m.skin]); head.position.y = 0.3; head.castShadow = true; P.head.add(head);
  const hp = (w, h, d, mat, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; P.head.add(o); return o; };
  P.hair = hp(0.6, 0.16, 0.6, m.hair, 0, 0.6, 0); P.hairB = hp(0.6, 0.34, 0.1, m.hair, 0, 0.42, -0.27);
  const A = hero.acc, steel = M('#d5dbe6'), red = M('#e03e3e'), blue = M('#2f62c8'), purple = M('#7b3fd0'), gold = M('#ffcf4a');
  const bulbM = new THREE.MeshStandardMaterial({ color: '#7fd0ff', emissive: new THREE.Color('#4fd0ff'), emissiveIntensity: 3 });
  A.helm = hp(0.64, 0.3, 0.64, steel, 0, 0.5, 0); A.plume = hp(0.1, 0.3, 0.4, red, 0, 0.78, -0.05);
  A.tabard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.36), blue); A.tabard.position.set(0, 1.05, 0); P.body.add(A.tabard);
  A.antenna = hp(0.05, 0.3, 0.05, steel, 0, 0.72, 0); A.bulb = hp(0.14, 0.14, 0.14, bulbM, 0, 0.92, 0);
  A.chest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.34), bulbM); A.chest.position.set(0, 1.12, 0); P.body.add(A.chest);
  A.brim = hp(0.95, 0.07, 0.95, purple, 0, 0.6, 0); A.cone = hp(0.52, 0.34, 0.52, purple, 0, 0.8, 0); A.tip = hp(0.28, 0.3, 0.28, purple, 0.04, 1.1, 0); A.band = hp(0.54, 0.09, 0.54, gold, 0, 0.68, 0);
  scene.add(hero.g);
}
let outfitNow = -1, faceNow = '';
function setOutfit(i) {
  if (i === outfitNow) return; outfitNow = i; const o = OUTFITS[i];
  for (const k of ['skin', 'hair', 'shirt', 'pants', 'shoes']) hero.mats[k].color.set(o[k]);
  for (const k in hero.acc) hero.acc[k].visible = !!(o.acc && o.acc.includes(k));
  hero.parts.hair.visible = hero.parts.hairB.visible = !(o.acc && (o.acc.includes('helm') || o.acc.includes('brim')));
}
function setFace(mood) { // 'flat' | 'wow' | 'grin'
  if (mood === faceNow) return; faceNow = mood; const g = hero.faceCtx, o = OUTFITS[Math.max(0, outfitNow)];
  g.fillStyle = o.skin; g.fillRect(0, 0, 8, 8); g.fillStyle = '#fff'; g.fillRect(1, 3, 2, 2); g.fillRect(5, 3, 2, 2);
  g.fillStyle = '#20242c'; g.fillRect(2, 3, 1, 2); g.fillRect(5, 3, 1, 2);
  if (mood === 'flat') { g.fillStyle = '#8a4a3a'; g.fillRect(3, 6, 2, 1); g.fillStyle = o.skin; g.fillRect(1, 3, 6, 1); }
  if (mood === 'wow') { g.fillStyle = '#5a2a22'; g.fillRect(3, 5, 2, 2); }
  if (mood === 'grin') { g.fillStyle = '#5a2a22'; g.fillRect(2, 5, 4, 2); g.fillStyle = '#fff'; g.fillRect(2, 5, 4, 1); }
  hero.faceTex.needsUpdate = true;
}
const HERO_Y = 3.52;
function poseHero(t) {
  const P = hero.parts, g = hero.g; let y = 0, yaw = 45 * DEG, headP = 0, headY = 0, aL = 0, aR = 0, aLz = 0, aRz = 0, lL = 0, lR = 0, lean = 0, squash = 1, face = 'flat', outfit = 0;
  const beat = (t - T.drop) / BEAT, bp = beat - Math.floor(beat), bounce = Math.abs(Math.sin(beat * Math.PI));
  const dance = (amt = 1) => { y = 0.28 * bounce * amt; aL = (-2.6 + 0.5 * Math.sin(beat * Math.PI)) * amt; aR = (-2.6 - 0.5 * Math.sin(beat * Math.PI)) * amt; aLz = -0.35 * amt; aRz = 0.35 * amt; lL = 0.5 * Math.sin(beat * Math.PI) * amt; lR = -lL; squash = 1 - 0.07 * (1 - bounce) * amt; face = 'grin'; };
  if (t < T.look) { lean = 0.12; headP = 0.42 + 0.03 * Math.sin(t * 1.3); headY = 0.5 * Math.sin(t * 0.45) * smooth((t - 6) / 3); aL = aR = 0.06 * Math.sin(t * 1.3); y = -0.02 + 0.01 * Math.sin(t * 1.3); }
  else if (t < T.drop) { const k = smooth((t - 13.85) / 0.35); lean = lerp(0.12, -0.06, k); headP = lerp(0.42, -0.55, k); headY = lerp(0, 0.25, k); face = t > 14.3 ? 'wow' : 'flat'; if (t > 14.7) { lean = -0.14; aL = aR = -0.5; aLz = -0.5; aRz = 0.5; } }
  else if (t < T.tex) { const s = t - T.drop; if (s < 1.25) { const p = s / 1.25; y = 5.2 * 4 * p * (1 - p); aL = aR = -2.9; aLz = -0.6; aRz = 0.6; lL = 0.7; lR = -0.5; yaw += p * Math.PI * 4; face = 'wow'; squash = s < 0.1 ? 0.8 : 1.05; } else { dance(); yaw += (s - 1.25) * 3.2; } outfit = 0; }
  else if (t < T.skinW) { dance(); yaw += (t - T.tex) * 2.4; outfit = t >= T.smile ? 4 : 0; }
  else if (t < T.skyP) { const s = (t - T.skinW) / BEAT, n = Math.floor(s), p = s - n; y = 0.8 * 4 * p * (1 - p); yaw = 45 * DEG + smooth(p) * Math.PI * 2; aL = aR = -2.8 * Math.sin(p * Math.PI); aLz = -0.5; aRz = 0.5; lL = 0.4 * Math.sin(p * Math.PI); lR = -lL; squash = p < 0.12 ? 0.86 : 1; outfit = p > 0.5 ? [1, 2, 3, 4][Math.min(3, n)] : [4, 1, 2, 3][Math.min(3, n)]; face = 'grin'; }
  else if (t < T.words) { outfit = 4; yaw = 225 * DEG; aLz = -0.25; aRz = 0.25; headP = -0.25; face = 'grin'; y = 0.01 * Math.sin(t * 2); }
  else if (t < T.end) { dance(); yaw += (t - T.words) * 5; outfit = 4; }
  else { const s = t - T.end; outfit = 4; face = 'grin'; yaw = 50 * DEG; y = 0.06 * Math.abs(Math.sin(s * 5)); aR = -2.75; aRz = 0.45 + 0.35 * Math.sin(s * 9); aL = 0.1; headP = -0.12; }
  setOutfit(outfit); setFace(face);
  g.position.set(0, HERO_Y + y, 0); g.rotation.y = yaw; g.scale.set(2 - squash, squash, 2 - squash);
  P.body.rotation.x = lean; P.head.rotation.set(headP, headY, 0);
  P.armL.rotation.set(aL, 0, aLz); P.armR.rotation.set(aR, 0, aRz); P.legL.rotation.x = lL; P.legR.rotation.x = lR;
}
const sheep = [];
function buildSheep() {
  [[4.5, -1.8, 0], [-2.6, 3.6, 1.9], [1.6, -4.4, 4.1], [-3.4, -2.6, 2.7]].forEach(([x, z, ph], n) => {
    const g = new THREE.Group(), wool = new THREE.MeshStandardMaterial({ map: grainTex, roughness: 1 }), dark = new THREE.MeshStandardMaterial({ color: '#3a3038', map: grainTex });
    const mk = (w, h, d, mat, px, py, pz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    mk(0.72, 0.56, 1.0, wool, 0, 0.62, 0); mk(0.4, 0.4, 0.36, dark, 0, 0.78, 0.6); mk(0.5, 0.2, 0.3, wool, 0, 1.0, 0.52);
    for (const [a, b] of [[-0.22, -0.32], [0.22, -0.32], [-0.22, 0.32], [0.22, 0.32]]) mk(0.15, 0.36, 0.15, dark, a, 0.18, b);
    scene.add(g); sheep.push({ g, wool, x, z, ph });
  });
}
function poseSheep(t) {
  for (const s of sheep) {
    const hop = t > T.drop + 0.4 ? Math.abs(Math.sin(((t - T.drop) / BEAT) * Math.PI + s.ph)) : 0, a = s.ph + (t > T.drop ? (t - T.drop) * 0.9 : Math.sin(t * 0.2 + s.ph) * 0.15);
    const x = s.x + Math.cos(a) * 0.9, z = s.z + Math.sin(a) * 0.9;
    s.g.position.set(x, HERO_Y + 0.55 * hop, z); s.g.rotation.y = -a + (t > T.drop ? 0 : 0.4); s.g.rotation.x = -0.25 * hop;
    const [cur, prev, q] = stateAt(t, x, z); s.wool.color.copy(PAL[prev].wool).lerp(PAL[cur].wool, smooth(q / 0.2));
  }
}

/* ------------------------------------------------------------------ light and sky */
let hemi, sun, moon, sunMesh, stars, housePt, skyTex, skyCtx;
function buildLights() {
  hemi = new THREE.HemisphereLight('#ffffff', '#8a7a6a', 1); scene.add(hemi);
  sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 160 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
  moon = new THREE.DirectionalLight('#7f9cff', 0); moon.position.set(-20, 40, 30); scene.add(moon);
  housePt = new THREE.PointLight('#ffb648', 0, 14, 1.6); housePt.position.set(-5.5, 5.4, 6.4); scene.add(housePt);
  sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ fog: false, toneMapped: false })); scene.add(sunMesh);
  const sp = new Float32Array(900 * 3); for (let i = 0; i < 900; i++) { const a = hash(i, 1) * Math.PI * 2, e = Math.asin(hash(i, 2) * 0.95 + 0.02), r = 900; sp.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(stars);
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; skyCtx = c.getContext('2d'); skyTex = new THREE.CanvasTexture(c); skyTex.colorSpace = THREE.SRGBColorSpace; scene.background = skyTex;
  scene.fog = new THREE.Fog('#ffffff', 70, 260);
}
const cA = new THREE.Color(), cB = new THREE.Color(), cS = new THREE.Color(), cT = new THREE.Color(), cH = new THREE.Color();
function lookAt(t) { // the grade for this instant: sky, sun, mood
  const [cur, prev, k] = globalTheme(t), a = THEMES[prev], b = THEMES[cur];
  cT.set(a.sky[0]).lerp(cA.set(b.sky[0]), k); cH.set(a.sky[1]).lerp(cA.set(b.sky[1]), k); cS.set(a.sun[0]).lerp(cA.set(b.sun[0]), k);
  const L = { top: cT, hor: cH, sunCol: cS, sunI: lerp(a.sun[1], b.sun[1], k), el: lerp(a.el, b.el, k), az: 118, amb: lerp(a.amb, b.amb, k), sat: lerp(a.sat, b.sat, k), neon: lerp(a.neon || 0, b.neon || 0, k), night: 0, bloom: 0.22, expo: 1 };
  if (t < T.drop) { L.sat = 0.5; L.expo = 1.05; }
  if (t >= T.skyW && t < T.words) { // a day in a bar and a half
    const p = clamp((t - T.skyW) / (BAR * 0.9)); L.el = lerp(58, -14, p * p * 0.4 + p * 0.6); L.az = lerp(232, 214, p);
    const dusk = smooth((30 - L.el) / 26), night = smooth((6 - L.el) / 14); L.night = night;
    cT.lerp(cA.set('#2c2f86'), dusk).lerp(cA.set('#02030a'), night); cH.lerp(cA.set('#ff8a3c'), dusk).lerp(cA.set('#162050'), night);
    cS.lerp(cA.set('#ff8a3a'), dusk); L.sunI = lerp(L.sunI, 3.4, dusk) * (1 - smooth((2 - L.el) / 8)); L.amb = lerp(L.amb, 0.5, dusk) * lerp(1, 0.5, night); L.bloom = 0.3 + 0.35 * night;
  }
  if (t >= T.end) { const p = smooth((t - T.end) / 1.2); cT.lerp(cA.set('#2463c8'), p); cH.lerp(cA.set('#ffd2a0'), p); cS.lerp(cA.set('#ffd29a'), p); L.el = lerp(L.el, 20, p); L.sunI = 3.1; L.az = 150; }
  if (L.neon > 0.01) L.bloom = lerp(L.bloom, 0.9, L.neon);
  return L;
}
function applyLook(L, cam) {
  const g = skyCtx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#' + L.top.getHexString()); g.addColorStop(0.72, '#' + L.hor.getHexString()); g.addColorStop(1, '#' + L.hor.getHexString());
  skyCtx.fillStyle = g; skyCtx.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true;
  scene.fog.color.copy(L.hor);
  const el = L.el * DEG, az = L.az * DEG, dx = Math.cos(el) * Math.cos(az), dy = Math.sin(el), dz = Math.cos(el) * Math.sin(az);
  sun.position.set(dx * 70, Math.max(0.05, dy) * 70, dz * 70); sun.target.position.set(0, 2, 0); sun.color.copy(L.sunCol); sun.intensity = L.sunI;
  hemi.color.copy(L.top).lerp(WHITE, 0.55); hemi.groundColor.copy(L.hor).multiplyScalar(0.5); hemi.intensity = L.amb;
  moon.intensity = 0.55 * L.night; stars.material.opacity = L.night; stars.position.copy(cam.position);
  sunMesh.position.set(cam.position.x + dx * 800, cam.position.y + dy * 800, cam.position.z + dz * 800); sunMesh.lookAt(cam.position); sunMesh.scale.setScalar(64);
  sunMesh.material.color.copy(L.sunCol).multiplyScalar(4 * clamp(L.sunI / 2)); sunMesh.visible = L.neon < 0.5;
  MESH.mats.blocks.emissiveIntensity = 2.6 * L.neon; MESH.mats.glow.emissiveIntensity = 0.25 + 4 * L.night + 2.5 * L.neon; housePt.intensity = 60 * L.night;
  MESH.mats.cloud.emissiveIntensity = 0.25 * (1 - L.night) * (1 - L.neon); MESH.mats.cloud.color.copy(L.hor).lerp(WHITE, 0.7).multiplyScalar(1 - 0.8 * L.night);
}

/* ------------------------------------------------------------------ camera */
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const orbit = (tg, dist, el, az) => v3(tg.x + dist * Math.cos(el * DEG) * Math.cos(az * DEG), tg.y + dist * Math.sin(el * DEG), tg.z + dist * Math.cos(el * DEG) * Math.sin(az * DEG));
const BTOP = v3(1, 3.521, 1), MID = v3(0, 3, 0), HEAD = v3(0, HERO_Y + 1.45, 0);
const WORDSHOTS = [ // [target, dist, elevation, azimuth, fov]
  [v3(3, 4.2, 2.2), 6, 14, 20, 34], [v3(0, 3, 0), 34, 34, 120, 30], [v3(-6, 5, 4), 13, 16, 70, 34], [v3(0, 4.6, 0), 6.5, 6, 45, 32],
  [v3(-6, 6, -7), 12, 20, 30, 34], [v3(0, 3, 0), 40, 55, -30, 30], [v3(6, 3, -4), 14, 22, 100, 32], [v3(0, 3.5, 0), 28, 18, 45, 30],
];
function shot(t) { // -> { pos, tg, fov, focus, ap }
  if (t < T.look) {
    const e = 0.5 * smooth(t / 11.6) + 0.5 * outCubic(t / 11.6) * clamp(t / 1.5), dist = Math.exp(lerp(Math.log(0.17), Math.log(40), e)), el = lerp(89.5, 27, smooth(e * 1.7)), az = lerp(45, 63, e) + (t - 11.6 > 0 ? (t - 11.6) * 1.2 : 0);
    const tg = BTOP.clone().lerp(MID, smooth((e - 0.45) / 0.55));
    return { pos: orbit(tg, dist, el, az), tg, fov: 30, focus: dist, ap: 0.00012 * smooth((dist - 6) / 20) + 0.0025 * (1 - smooth(dist / 6)) * smooth(dist / 0.6) };
  }
  if (t < T.drop + 0.0001) { const k = (t - T.look) / (T.drop - T.look), tg = v3(0.35, HERO_Y + 1.25, 0.35); return { pos: orbit(tg, 6.4 - 0.9 * k, 2 - 3 * k, 56 + 5 * k), tg, fov: 34, focus: 6, ap: 0.0035 }; }
  if (t < T.tex) {
    const s = t - T.drop, k = outExpo(s / 1.1), since = s < BAR ? s : s - BAR, punch = 0.1 * Math.exp(-since * 4);
    const tg = v3(0.35, HERO_Y + 1.25, 0.35).lerp(v3(0, 3.5, 0), k), dist = lerp(5.5, 38, k) * (1 - punch);
    return { pos: orbit(tg, dist, lerp(-1, 26, k), lerp(61, 96, smooth(s / 3.75))), tg, fov: 32, focus: dist, ap: 0.00012, shake: Math.exp(-since * 6) };
  }
  if (t < T.styles && t >= T.smile) { const k = (t - T.smile) / (T.styles - T.smile), tg = v3(-6 + 0.6 * k, 5.6, -7); return { pos: orbit(tg, 13.5 - 2.5 * k, 9 + 4 * k, 38 + 22 * k), tg, fov: 36, focus: 11, ap: 0.0009 }; }
  if (t < T.skinP && t >= T.styles) { const s = t - T.styles, k = s / (2 * BAR), bp = (s / BEAT) % 1, dist = (30 - 3 * k) * (1 - 0.05 * Math.exp(-bp * 5)); return { pos: orbit(MID, dist, 22 + 6 * Math.sin(k * 3), 30 + 150 * k), tg: MID, fov: 32, focus: dist, ap: 0.00014 }; }
  if (t < T.skyP && t >= T.skinW) { const k = (t - T.skinW) / BAR; const tg = v3(0, HERO_Y + 1.55, 0); return { pos: orbit(tg, 7.6 - 0.8 * k, 3, 40 + 14 * k), tg, fov: 32, focus: 7.2, ap: 0.003 }; }
  if (t < T.words && t >= T.skyW) { const k = (t - T.skyW) / BAR, tg = v3(0, 0.5, 0); return { pos: orbit(tg, 36 - 3 * k, 12 + 2 * k, 40 + 6 * k), tg, fov: 34, focus: 34, ap: 0.00012 }; }
  if (t < T.end && t >= T.words) { const i = Math.min(7, Math.floor((t - T.words) / (BEAT / 2))), p = (t - T.words) / (BEAT / 2) - i, [tg, d, el, az, fov] = WORDSHOTS[i]; return { pos: orbit(tg, d * (1 - 0.06 * p), el, az + 6 * p), tg, fov, focus: d, ap: d < 15 ? 0.002 : 0.00014 }; }
  const s = t - T.end, k = outCubic(s / 3.2), tg = v3(0, lerp(HERO_Y + 1.2, 4, k), 0), dist = lerp(7, 40, k);
  return { pos: orbit(tg, dist, lerp(6, 22, k), 52 + s * 3), tg, fov: 32, focus: lerp(dist, 4, smooth((s - 1.0) / 1.2)), ap: lerp(0.0015, 0.0022, smooth((s - 1.0) / 1.2)) };
}

/* ------------------------------------------------------------------ product panels */
const PANEL = { c: null, g: null, tex: null }, FR = { paint: [], skin: [], sky: [] }; let paintPts = [];
let studioParts, studioGlow, bezelMat;
function buildStudio() {
  PANEL.c = document.createElement('canvas'); PANEL.c.width = 1600; PANEL.c.height = 900; PANEL.g = PANEL.c.getContext('2d');
  PANEL.tex = new THREE.CanvasTexture(PANEL.c); PANEL.tex.colorSpace = THREE.SRGBColorSpace; PANEL.tex.anisotropy = 16;
  studio.background = new THREE.Color('#06070a');
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: PANEL.tex, color: new THREE.Color(1.12, 1.12, 1.12) })); screen.position.set(0, 5.4, 0); studio.add(screen);
  bezelMat = new THREE.MeshStandardMaterial({ color: '#1a1e28', roughness: 0.35, metalness: 0.6 });
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(16.5, 9.5, 0.4), bezelMat); bezel.position.set(0, 5.4, -0.45); studio.add(bezel);
  const fade = document.createElement('canvas'); fade.width = 4; fade.height = 128; const fg = fade.getContext('2d'), gr = fg.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#000'); gr.addColorStop(0.55, '#000'); gr.addColorStop(1, '#3a3a3a'); fg.fillStyle = gr; fg.fillRect(0, 0, 4, 128);
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: PANEL.tex, alphaMap: new THREE.CanvasTexture(fade), transparent: true, toneMapped: false })); refl.scale.y = -1; refl.position.set(0, -4.25, 0); studio.add(refl);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#0a0c12', roughness: 0.5, metalness: 0.3, transparent: true, opacity: 0.55 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.56; studio.add(floor);
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gg = gc.getContext('2d'), rg = gg.createRadialGradient(128, 128, 0, 128, 128, 128); rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); gg.fillStyle = rg; gg.fillRect(0, 0, 256, 256);
  studioGlow = new THREE.Mesh(new THREE.PlaneGeometry(70, 46), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false })); studioGlow.position.set(0, 7, -14); studio.add(studioGlow);
  studioParts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), 160); studioParts.frustumCulled = false; studio.add(studioParts);
  studio.add(new THREE.HemisphereLight('#aab4ff', '#101018', 1.2)); const d = new THREE.DirectionalLight('#ffffff', 2.5); d.position.set(-6, 10, 12); studio.add(d);
}
function drawPanel(seq, f, cur) { // f: fractional frame; cur: [x, y, pressed] in 1920x1080 space
  const g = PANEL.g, a = seq[Math.min(seq.length - 1, Math.floor(f))], b = seq[Math.min(seq.length - 1, Math.floor(f) + 1)];
  if (a) g.drawImage(a, 0, 0, 1600, 900);
  if (b && b !== a && seq !== FR.paint) { g.globalAlpha = f - Math.floor(f); g.drawImage(b, 0, 0, 1600, 900); g.globalAlpha = 1; }
  if (cur) { const k = 1600 / 1920; g.save(); g.translate(cur[0] * k, cur[1] * k); g.scale(cur[2] ? 1.9 : 2.2, cur[2] ? 1.9 : 2.2);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 16); g.lineTo(4, 12); g.lineTo(7, 18); g.lineTo(10, 17); g.lineTo(7, 11); g.lineTo(12, 11); g.closePath(); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.3; g.fill(); g.stroke(); g.restore(); }
  PANEL.tex.needsUpdate = true;
}
const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), e0 = new THREE.Euler();
function panelShot(t, t0, len, accent, from, to) { // from/to: [look-at x, look-at y, distance, yaw, pitch]
  const s = t - t0, k = smooth(s / len), ke = outCubic(s / (len * 0.9));
  const lx = lerp(from[0], to[0], k), ly = lerp(from[1], to[1], k), dist = lerp(from[2], to[2], ke), yaw = lerp(from[3], to[3], ke) * DEG, pit = lerp(from[4], to[4], ke) * DEG;
  studioCam.position.set(lx + dist * Math.sin(yaw) * Math.cos(pit), ly + dist * Math.sin(pit), dist * Math.cos(yaw) * Math.cos(pit)); studioCam.lookAt(lx, ly, 0); studioCam.rotation.z += lerp(-0.035, 0, ke);
  studioGlow.material.color.set(accent); studioGlow.material.opacity = 0.5; bezelMat.emissive = new THREE.Color(accent); bezelMat.emissiveIntensity = 0.12;
  cA.set(accent).multiplyScalar(2.4);
  for (let i = 0; i < 160; i++) { const z = (hash(i, 3) - 0.35) * 26, x = (hash(i, 1) - 0.5) * 44, y = ((hash(i, 2) * 22 + t * (0.5 + hash(i, 4))) % 22) - 2, sc = 0.06 + hash(i, 5) * 0.16;
    e0.set(t * hash(i, 6), t * hash(i, 7), 0); m4.compose(v3(x, y, Math.abs(x) < 9.5 && z < 1 && z > -1 ? z + 3 : z), q0.setFromEuler(e0), v3(sc, sc, sc)); studioParts.setMatrixAt(i, m4); studioParts.setColorAt(i, cA); }
  studioParts.instanceMatrix.needsUpdate = true; studioParts.instanceColor.needsUpdate = true;
  return { focus: dist, ap: 0.0016 };
}

/* ------------------------------------------------------------------ type */
let ctx;
function caption(text, t, t0, t1, y = 915) {
  if (t < t0 || t > t1) return; const a = Math.min(clamp((t - t0) / 0.35), clamp((t1 - t) / 0.35));
  ctx.save(); ctx.globalAlpha = a; ctx.font = `400 64px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(text, W / 2 + 4, y + 4); ctx.fillStyle = '#fff'; ctx.fillText(text, W / 2, y); ctx.restore();
}
function slam(text, t, t0, t1, o = {}) {
  if (t < t0 || t >= t1) return; let size = o.size || 128; const x = o.x ?? W / 2, y = o.y ?? 900, k = (t - t0) / 0.18, s = lerp(size > 200 ? 1.25 : 1.7, 1, outBack(k));
  ctx.save(); ctx.translate(x, y); ctx.rotate((o.rot ?? -1.5) * DEG * (1 + (size > 200 ? 0.6 : 2) * (1 - clamp(k)))); ctx.scale(s, s); ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.font = `700 ${size}px ${FONT}`;
  while (ctx.measureText(text).width > W - 380 && size > 48) { size -= 8; ctx.font = `700 ${size}px ${FONT}`; }
  const w = ctx.measureText(text).width, padX = size * 0.32, hh = size * 1.25, d = size * 0.11;
  ctx.fillStyle = o.sh || '#0d0f14'; ctx.fillRect(-w / 2 - padX + d, -hh / 2 + d, w + padX * 2, hh);
  ctx.fillStyle = o.bg || '#5bd35b'; ctx.fillRect(-w / 2 - padX, -hh / 2, w + padX * 2, hh);
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(-w / 2 - padX, -hh / 2, w + padX * 2, size * 0.08);
  ctx.fillStyle = o.fg || '#08120a'; ctx.fillText(text, 0, size * 0.04); ctx.restore();
}
function tag(text, accent) { // small product label, top left
  ctx.save(); ctx.font = `700 32px ${FONT}`; ctx.textBaseline = 'middle'; const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(6,7,10,.78)'; ctx.fillRect(64, 56, w + 76, 64); ctx.fillStyle = accent; ctx.fillRect(64, 56, 12, 64); ctx.fillStyle = '#eef1f7'; ctx.fillText(text, 100, 90); ctx.restore();
}
function cursor2d(x, y, pressed, sc = 7) {
  ctx.save(); ctx.translate(x, y); ctx.scale(pressed ? sc * 0.86 : sc, pressed ? sc * 0.86 : sc);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 16); ctx.lineTo(4, 12); ctx.lineTo(7, 18); ctx.lineTo(10, 17); ctx.lineTo(7, 11); ctx.lineTo(12, 11); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.3; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke(); ctx.restore();
}
function flash(t, t0, len = 0.12, a = 0.85) { if (t >= t0 && t < t0 + len) { ctx.fillStyle = `rgba(255,255,255,${a * (1 - (t - t0) / len)})`; ctx.fillRect(0, 0, W, H); } }
const WORDS = ['MOBS', 'SOUNDS', 'FONTS', 'CAPES', '3D MODELS', 'PVP', 'JAVA', 'BEDROCK'], ACC = ['#5bd35b', '#ffcf4a', '#4fb3ff', '#b07cff', '#ff5b5b', '#5bd35b', '#ffcf4a', '#4fb3ff'];
let LOGO;
function overlays(t, cam) {
  if (t < T.drop) {
    caption('Grass is green.', t, 0.8, 3.4, 540); caption('Stone is\u2026 stone.', t, 5.6, 8.0); caption('Dirt is brown.', t, 8.8, 11.2); caption('It has always looked like this.', t, T.look + 0.1, 13.85);
    if (t > 14.0) { ctx.save(); ctx.font = `700 160px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = clamp((t - 14.0) / 0.1); ctx.translate(1330, 300); ctx.scale(lerp(1.4, 1, outBack((t - 14.0) / 0.2)), lerp(1.4, 1, outBack((t - 14.0) / 0.2)));
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText('Says who?', 8, 8); ctx.fillStyle = '#fff'; ctx.fillText('Says who?', 0, 0); ctx.restore(); }
  }
  if (t > 14.05 && t < T.drop + 0.45) { const p = BTOP.clone().project(cam), bx = (p.x + 1) / 2 * W, by = (1 - p.y) / 2 * H, k = outCubic((t - 14.05) / 0.75); cursor2d(lerp(W + 80, bx, k), lerp(-120, by, k), t > 14.88 && t < T.drop + 0.14); }
  if (t >= T.drop && t < T.tex) {
    flash(t, T.drop, 0.22, 1); flash(t, T.drop + BAR, 0.1);
    slam('MAKE IT PINK.', t, T.drop + 0.2, T.drop + BAR, { bg: '#ff4fa3', fg: '#2a0618', size: 160 });
    slam('MAKE IT AUTUMN.', t, T.drop + BAR, T.drop + BAR + 2 * BEAT, { bg: '#ffcf4a', fg: '#2a1a04', size: 160 });
    slam('MAKE IT YOURS.', t, T.drop + BAR + 2 * BEAT, T.tex, { bg: '#ffffff', fg: '#0d0f14', size: 160 });
  }
  if (t >= T.tex && t < T.smile) { flash(t, T.tex); tag('TEXTURE EDITOR', '#5bd35b'); slam('REPAINT EVERY BLOCK.', t, T.tex + 0.05, T.smile, { bg: '#5bd35b', y: 985, size: 96 }); }
  if (t >= T.smile && t < T.styles) { flash(t, T.smile); slam('SEE IT EVERYWHERE.', t, T.smile + 0.3, T.styles, { bg: '#ffcf4a', fg: '#2a1a04', y: 930 }); }
  if (t >= T.styles && t < T.skinP) { flash(t, T.styles + Math.floor((t - T.styles) / BEAT) * BEAT, 0.07, 0.5); slam('RESTYLE IT IN ONE CLICK.', t, T.styles + 0.05, T.skinP, { bg: '#ffffff', fg: '#0d0f14', y: 930 }); }
  if (t >= T.skinP && t < T.skyP) { flash(t, T.skinP); flash(t, T.skinW); if (t < T.skinW) tag('SKIN EDITOR', '#4fb3ff'); slam('RESKIN YOURSELF.', t, T.skinP + 0.05, T.skyP, { bg: '#4fb3ff', fg: '#04121f', y: 985, size: 96 }); }
  if (t >= T.skyP && t < T.words) { flash(t, T.skyP); flash(t, T.skyW); if (t < T.skyW) tag('SHADER MAKER', '#b07cff'); slam('RELIGHT THE SKY.', t, T.skyP + 0.05, T.words, { bg: '#b07cff', fg: '#12062a', y: 985, size: 96 }); }
  if (t >= T.words && t < T.end) { const i = Math.min(7, Math.floor((t - T.words) / (BEAT / 2))); flash(t, T.words + i * BEAT / 2, 0.06, 0.6); slam(WORDS[i], t, T.words + i * BEAT / 2, T.words + (i + 1) * BEAT / 2 + 0.001, { bg: ACC[i], y: 540, size: 256, rot: i % 2 ? 2 : -2 }); }
  if (t >= T.end) {
    const s = t - T.end; flash(t, T.end, 0.3, 1);
    const dk = smooth((s - 1.0) / 1.0); ctx.fillStyle = `rgba(8,10,14,${0.72 * dk})`; ctx.fillRect(0, 0, W, H);
    const c0 = 1.6; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (s > c0 && LOGO) { const p = outBack((s - c0) / 0.35), sz = 230 * p; ctx.drawImage(LOGO, W / 2 - sz / 2, 235 - sz / 2, sz, sz); }
    if (s > c0 + 0.2) { ctx.save(); ctx.globalAlpha = clamp((s - c0 - 0.2) / 0.25); ctx.font = `700 96px ${FONT}`; const a = 'TexturePack', b = 'Maker', wa = ctx.measureText(a).width, wb = ctx.measureText(b).width, x0 = W / 2 - (wa + wb) / 2;
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(a + b, x0 + 6, 436); ctx.fillStyle = '#eef1f7'; ctx.fillText(a, x0, 430); ctx.fillStyle = '#5bd35b'; ctx.fillText(b, x0 + wa, 430); ctx.restore(); }
    slam('MAKE IT LOOK YOUR WAY.', t, T.end + c0 + 2 * BEAT, 99, { y: 615, size: 128, rot: 0 });
    if (s > c0 + 4 * BEAT) { ctx.save(); ctx.globalAlpha = clamp((s - c0 - 4 * BEAT) / 0.3); ctx.font = `400 48px ${FONT}`; ctx.fillStyle = '#eef1f7'; ctx.fillText('Free.  No sign-up.  Right in your browser.', W / 2, 790); ctx.restore(); }
    if (s > c0 + 6 * BEAT) { ctx.save(); ctx.globalAlpha = clamp((s - c0 - 6 * BEAT) / 0.3); ctx.font = `700 64px ${FONT}`; ctx.fillStyle = '#5bd35b'; ctx.fillText('texturepackmaker.com', W / 2, 890); ctx.restore(); }
    if (s > 1.2) { ctx.globalAlpha = clamp((s - 1.2) / 0.5); ctx.font = `400 24px ${FONT}`; ctx.fillStyle = 'rgba(200,206,218,.85)'; ctx.fillText('Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.', W / 2, 1036); ctx.globalAlpha = 1; }
    if (s > 6.9) { ctx.fillStyle = `rgba(0,0,0,${clamp((s - 6.9) / 0.6)})`; ctx.fillRect(0, 0, W, H); }
  }
  if (t < 0.6) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.6})`; ctx.fillRect(0, 0, W, H); }
}

/* ------------------------------------------------------------------ frame */
function renderAt(t) {
  let post;
  const panel = (t >= T.tex && t < T.smile) || (t >= T.skinP && t < T.skinW) || (t >= T.skyP && t < T.skyW);
  if (panel) {
    if (t < T.smile) { // one pixel per sixteenth note, with a cursor that travels between them
      const s = t - T.tex - 0.28, step = BEAT / 4, n = clamp(Math.floor(s / step) + 1, 0, 24), fr = s / step - Math.floor(s / step);
      const a = paintPts[Math.max(0, n - 1)] || [1300, 700], b = paintPts[Math.min(23, n)] || a, k = smooth((fr - 0.35) / 0.65);
      drawPanel(FR.paint, n, n >= 24 ? [lerp(a[0], 1560, smooth((s - 24 * step) / 0.5)), lerp(a[1], 420, smooth((s - 24 * step) / 0.5)), false] : [lerp(a[0], b[0], k), lerp(a[1], b[1], k), fr < 0.3 && n > 0]);
      post = panelShot(t, T.tex, T.smile - T.tex, '#5bd35b', [-1.4, 4.9, 21, 26, 7], [1.2, 5.0, 13.5, 6, 2]);
    } else if (t < T.skinW) { drawPanel(FR.skin, clamp((t - T.skinP) / BAR) * 19); post = panelShot(t, T.skinP, BAR, '#4fb3ff', [0, 5.0, 22, -24, 6], [4.2, 5.5, 12.5, -7, 2]); }
    else { drawPanel(FR.sky, clamp((t - T.skyP) / BAR) * 19); post = panelShot(t, T.skyP, BAR, '#b07cff', [0, 5.0, 22, 24, 6], [-0.2, 5.0, 14.5, 6, 2]); }
    renderPass.scene = bokeh.scene = studio; renderPass.camera = bokeh.camera = studioCam;
    bloom.strength = 0.16; finalPass.uniforms.sat.value = 1.05; finalPass.uniforms.vig.value = 0.45; renderer.toneMappingExposure = 1;
  } else {
    updateWorld(t); poseHero(t); poseSheep(t);
    const sh = shot(t); camera.position.copy(sh.pos); if (sh.shake) { camera.position.x += 0.35 * sh.shake * Math.sin(t * 71); camera.position.y += 0.3 * sh.shake * Math.cos(t * 63); }
    camera.fov = sh.fov; camera.near = sh.focus < 2 ? 0.01 : 0.1; camera.updateProjectionMatrix(); camera.lookAt(sh.tg);
    const L = lookAt(t); applyLook(L, camera); post = sh;
    renderPass.scene = bokeh.scene = scene; renderPass.camera = bokeh.camera = camera;
    bloom.strength = L.bloom; finalPass.uniforms.sat.value = L.sat; finalPass.uniforms.vig.value = t < T.drop ? 0.38 : 0.28; renderer.toneMappingExposure = L.expo;
  }
  bokeh.uniforms.focus.value = post.focus; bokeh.uniforms.aperture.value = post.ap; bokeh.uniforms.maxblur.value = 0.012;
  finalPass.uniforms.time.value = t; composer.render();
  return panel ? studioCam : camera;
}
export function draw(t) {
  t = clamp(t, 0, DUR);
  const cam = renderAt(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(glCanvas, 0, 0, W, H);
  overlays(t, cam);
}
const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
export async function init(canvas, base = '../assets/') {
  out2d = canvas; out2d.width = W; out2d.height = H; ctx = out2d.getContext('2d');
  glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const pad = n => String(n).padStart(2, '0'), jobs = [];
  for (let i = 0; i <= 24; i++) jobs.push(loadImg(`${base}seq/paint${pad(i)}.jpg`).then(im => (FR.paint[i] = im)));
  for (let i = 0; i < 20; i++) { jobs.push(loadImg(`${base}seq/skin${pad(i)}.jpg`).then(im => (FR.skin[i] = im))); jobs.push(loadImg(`${base}seq/sky${pad(i)}.jpg`).then(im => (FR.sky[i] = im))); }
  jobs.push(loadImg(`${base}logo.svg`).then(im => (LOGO = im)), fetch(`${base}seq/paint.json`).then(r => r.json()).then(j => (paintPts = j)).catch(() => {}));
  jobs.push(document.fonts.load('700 64px Texel').catch(() => {}), document.fonts.load('400 64px Texel').catch(() => {}));
  await Promise.all(jobs);
  buildWorld(); buildMeshes(); buildHero(); buildSheep(); buildLights(); buildStudio();
  const Q = new URLSearchParams(location.search), qn = (k, d) => (Q.has(k) ? +Q.get(k) : d);
  sun.shadow.mapSize.set(qn('shadow', 4096), qn('shadow', 4096));
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: qn('msaa', 2) });
  composer = new EffectComposer(renderer, rt); composer.setSize(W, H);
  renderPass = new RenderPass(scene, camera); bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.0002, maxblur: 0.012 });
  bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.25, 0.6, 0.82); finalPass = new ShaderPass(GradeShader);
  composer.addPass(renderPass); if (qn('bokeh', 1)) composer.addPass(bokeh); if (qn('bloom', 1)) composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(finalPass);
}
