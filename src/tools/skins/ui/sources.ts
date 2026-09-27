// Where skins come from: uploaded PNGs, Java usernames and the default skins in the game files.

import { convertLegacySkin, decodeImage, resizeNearest } from '../../../core/image';
import type { AssetIndex, SkinModel } from '../../../core/types';
import { detectSlim } from '../templates';

export interface LoadedSkin {
  image: ImageData;
  model: SkinModel;
  /** Friendly notes about conversions */
  notes: string[];
}

/** Error whose message is written for the user. */
export class SkinSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkinSourceError';
  }
}

function sniff(bytes: Uint8Array): 'png' | 'jpeg' | 'gif' | 'webp' | 'bmp' | 'unknown' {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'webp';
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  return 'unknown';
}

/** Validates and normalises a decoded skin image to 64x64. */
export function normalizeSkinImage(img: ImageData): LoadedSkin {
  const { width: w, height: h } = img;
  const notes: string[] = [];
  let image = img;
  if (w === 64 && h === 32) {
    image = convertLegacySkin(img, { forceOpaqueBase: false });
    notes.push('This is an old 64×32 skin, so it was converted to the modern 64×64 layout. The left arm and leg start as mirror copies of the right ones.');
  } else if (w === 128 && h === 128) {
    image = resizeNearest(img, 64, 64);
    notes.push('This HD 128×128 skin was reduced to 64×64, the size Java Edition uses. Fine details may be simplified.');
  } else if (!(w === 64 && h === 64)) {
    const hint =
      w === h && w > 0 && w % 64 === 0
        ? ` It looks like a ${w / 64}× enlarged skin; use the original 64×64 file instead.`
        : ' Make sure you picked the skin file itself, not a screenshot or a render of it.';
    throw new SkinSourceError(`This image is ${w}×${h} pixels. Minecraft skins are exactly 64×64 pixels (or the old 64×32 size).${hint}`);
  }
  let visible = false;
  for (let i = 3; i < image.data.length && !visible; i += 4) visible = image.data[i] > 0;
  if (!visible) notes.push('This skin is completely see-through, so there is nothing to see yet. Paint away!');
  return { image, model: detectSlim(image) ? 'slim' : 'classic', notes };
}

/** Reads a user-picked PNG into a 64x64 skin. */
export async function readSkinFile(file: Blob & { name?: string }): Promise<LoadedSkin> {
  if (file.size > 2 * 1024 * 1024) throw new SkinSourceError('That file is too big to be a skin. Skins are small 64×64 PNG images (usually under 10 KB).');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (kind === 'jpeg') throw new SkinSourceError('This is a JPEG photo. Skins must be PNG files, because they need see-through pixels. Save your skin as .png and try again.');
  if (kind !== 'png') throw new SkinSourceError(`"${file.name ?? 'This file'}" is not a PNG image. Skins are 64×64 .png files.`);
  let img: ImageData;
  try {
    img = await decodeImage(bytes, 'png');
  } catch {
    throw new SkinSourceError('This PNG file seems to be damaged and could not be opened.');
  }
  return normalizeSkinImage(img);
}

// ---- Usernames ----

const USERNAME = /^[A-Za-z0-9_]{1,16}$/;
const UUID = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;

export function validateUsername(input: string): string | null {
  const s = input.trim();
  if (!s) return 'Type a Minecraft Java username.';
  if (UUID.test(s)) return null;
  if (!USERNAME.test(s)) return 'Java usernames are 3 to 16 letters, numbers or underscores (no spaces).';
  return null;
}

interface PlayerDbResponse {
  success?: boolean;
  code?: string;
  message?: string;
  data?: { player?: { username?: string; skin_texture?: string; properties?: { name: string; value: string }[] } };
}

async function fetchWithTimeout(url: string, signal: AbortSignal | undefined, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function modelFromProperties(props: { name: string; value: string }[] | undefined): SkinModel | null {
  const tex = props?.find((p) => p.name === 'textures');
  if (!tex) return null;
  try {
    const json = JSON.parse(atob(tex.value)) as { textures?: { SKIN?: { metadata?: { model?: string } } } };
    return json.textures?.SKIN?.metadata?.model === 'slim' ? 'slim' : 'classic';
  } catch {
    return null;
  }
}

/** A skin server answered, but not with a usable skin. */
class BadAnswerError extends Error {}

async function imageFromUrl(url: string, signal?: AbortSignal): Promise<ImageData> {
  const res = await fetchWithTimeout(url, signal, 15000);
  if (!res.ok) throw new BadAnswerError(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (sniff(bytes) !== 'png') throw new BadAnswerError('not a PNG');
  try {
    return await decodeImage(bytes, 'png');
  } catch {
    throw new BadAnswerError('damaged PNG');
  }
}

/**
 * Looks up a Java player's skin: playerdb.co gives the texture URL and the arm model; the PNG comes
 * from textures.minecraft.net. mc-heads.net is the fallback when playerdb can't be reached.
 */
export async function fetchSkinByUsername(input: string, signal?: AbortSignal): Promise<LoadedSkin & { username: string }> {
  const name = input.trim();
  const invalid = validateUsername(name);
  if (invalid) throw new SkinSourceError(invalid);

  let skinUrl: string | null = null;
  let model: SkinModel | null = null;
  let username = name;
  let lookupFailed = false;
  try {
    const res = await fetchWithTimeout(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(name)}`, signal, 10000);
    let body: PlayerDbResponse | null = null;
    try {
      body = (await res.json()) as PlayerDbResponse;
    } catch {
      body = null;
    }
    if (body && body.success === false && /invalid_username|not_found|player\.not/i.test(body.code ?? '')) {
      throw new SkinSourceError(`No Java Edition player is called "${name}". Check the spelling. (Bedrock gamertags can't be looked up.)`);
    }
    if (!res.ok || !body?.data?.player) throw new Error(`playerdb HTTP ${res.status}`);
    const player = body.data.player;
    username = player.username ?? name;
    skinUrl = player.skin_texture ? player.skin_texture.replace(/^http:/, 'https:') : null;
    model = modelFromProperties(player.properties);
  } catch (err) {
    if (err instanceof SkinSourceError) throw err;
    if (signal?.aborted) throw err;
    lookupFailed = true;
  }

  const notes: string[] = [];
  let img: ImageData | null = null;
  if (skinUrl) {
    try {
      img = await imageFromUrl(skinUrl, signal);
    } catch (err) {
      if (signal?.aborted) throw err;
      img = null;
    }
  } else if (!lookupFailed) {
    notes.push(`${username} uses one of the default skins.`);
  }
  if (!img) {
    try {
      img = await imageFromUrl(`https://mc-heads.net/skin/${encodeURIComponent(username)}`, signal);
      if (lookupFailed) notes.push('The player lookup service did not answer, so the skin came from mc-heads.net. The arm model was guessed from the pixels.');
    } catch (err) {
      if (signal?.aborted) throw err;
      if (err instanceof BadAnswerError) throw new SkinSourceError("The skin servers answered, but didn't send a usable skin. Try again in a minute.");
      throw new SkinSourceError("Couldn't reach the skin servers. Check your internet connection and try again.");
    }
  }
  const loaded = normalizeSkinImage(img);
  return { ...loaded, model: model ?? loaded.model, notes: [...notes, ...loaded.notes], username };
}

// ---- Default skins from the game files ----

export interface DefaultSkin {
  id: string;
  name: string;
  model: SkinModel;
  path: string;
}

const DEFAULT_NAMES = ['steve', 'alex', 'ari', 'efe', 'kai', 'makena', 'noor', 'sunny', 'zuri'];

const title = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * Default player skins available in a Java version's assets. 1.19.3+ keeps nine characters in
 * entity/player/{wide,slim}/; 1.8–1.19.2 have entity/steve.png and entity/alex.png; 1.6–1.7 only
 * the 64x32 entity/steve.png.
 */
export function listDefaultSkins(assets: AssetIndex): DefaultSkin[] {
  const root = 'assets/minecraft/textures/entity/';
  const out: DefaultSkin[] = [];
  for (const n of DEFAULT_NAMES) {
    for (const [folder, model] of [['wide', 'classic'], ['slim', 'slim']] as const) {
      const path = `${root}player/${folder}/${n}.png`;
      if (assets.hasFile(path)) out.push({ id: `${n}-${folder}`, name: title(n), model, path });
    }
  }
  if (out.length) return out;
  if (assets.hasFile(`${root}steve.png`)) out.push({ id: 'steve', name: 'Steve', model: 'classic', path: `${root}steve.png` });
  if (assets.hasFile(`${root}alex.png`)) out.push({ id: 'alex', name: 'Alex', model: 'slim', path: `${root}alex.png` });
  return out;
}

export async function readDefaultSkin(assets: AssetIndex, skin: DefaultSkin): Promise<LoadedSkin> {
  const img = await assets.readImage(skin.path);
  const loaded = normalizeSkinImage(img);
  return { ...loaded, model: skin.model };
}
