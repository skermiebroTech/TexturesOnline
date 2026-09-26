import type { AssetIndex, Edition, GameVersion, ProgressFn } from '../core/types';
import { listJavaVersions, getDefaultJavaVersion } from './java/versions';
import { listBedrockVersions, getDefaultBedrockVersion } from './bedrock/versions';

export const DEFAULT_JAVA_VERSION = '26.3';

/** Versions newest first. Java: releases (plus snapshots on request) since 1.6.1. Bedrock: latest + tagged versions. */
export async function listVersions(edition: Edition, opts: { includeSnapshots?: boolean } = {}): Promise<GameVersion[]> {
  return edition === 'java' ? listJavaVersions(opts) : listBedrockVersions(opts);
}

/** Java: 26.3 when available, else the latest release. Bedrock: 'latest' (the current release). */
export async function getDefaultVersion(edition: Edition): Promise<string> {
  return edition === 'java' ? getDefaultJavaVersion(DEFAULT_JAVA_VERSION) : getDefaultBedrockVersion();
}

/** Vanilla assets of a game version (downloaded once, then served from the local cache). */
export async function loadAssets(
  edition: Edition,
  versionId: string,
  opts: { onProgress?: ProgressFn; jarFile?: File; signal?: AbortSignal } = {},
): Promise<AssetIndex> {
  if (edition === 'java') {
    const { loadJavaAssets } = await import('./java/assets');
    return loadJavaAssets(versionId, opts);
  }
  const { loadBedrockAssets } = await import('./bedrock/assets');
  return loadBedrockAssets(versionId, opts);
}

export async function isAssetsCached(edition: Edition, versionId: string): Promise<boolean> {
  try {
    if (edition === 'java') {
      const { isJavaAssetsCached } = await import('./java/assets');
      return await isJavaAssetsCached(versionId);
    }
    const { isBedrockAssetsCached } = await import('./bedrock/assets');
    return await isBedrockAssetsCached(versionId);
  } catch {
    return false;
  }
}

/** Deletes the locally stored vanilla files of one version. */
export async function deleteCachedAssets(edition: Edition, versionId: string): Promise<void> {
  if (edition === 'java') {
    const { deleteCachedJavaVersion } = await import('./java/assets');
    return deleteCachedJavaVersion(versionId);
  }
  const { deleteCachedBedrockVersion } = await import('./bedrock/assets');
  return deleteCachedBedrockVersion(versionId);
}

export function textureRootFor(edition: Edition): string {
  return edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
}

export { getJavaPackFormat, buildPackMcmeta, buildPackMcmetaForVersions, readPackMcmetaRange } from './java/packmeta';
export { buildResourceManifest, buildSkinPackFiles, buildSkinPackFilesAsync, bumpPackVersion } from './bedrock/manifest';
export { BEDROCK_LATEST_ID, BEDROCK_PREVIEW_ID, bedrockDisplayVersion, engineVersionOf, bedrockGameVersion } from './bedrock/versions';
export { TEXTURE_CATEGORY_ORDER } from './java/textures';
