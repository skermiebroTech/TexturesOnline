// Texture mapping data for the pack converter: texture paths only, generated from the real game files
// by scripts/gen-convert-maps.ts (no game images are bundled). Loaded lazily, as separate chunks.

/**
 * Java (latest release) <-> Bedrock (latest release) textures that play the same part with the same
 * image layout, so an image can be copied as-is (scaled when the resolution differs). Paths are relative
 * to 'assets/minecraft/textures/' (Java) and 'textures/' (Bedrock), without extension (a Bedrock texture
 * may be .png or .tga). A texture can appear in several pairs.
 */
export interface JavaBedrockMap {
  format: 1;
  /** Java release the Java paths come from, e.g. '26.3' */
  java: string;
  /** Bedrock release (bedrock-samples tag without the 'v') the Bedrock paths come from */
  bedrock: string;
  pairs: [java: string, bedrock: string][];
  /** Same part, different image layout (aspect ratio or UV arrangement): reported, not copied */
  layoutDiffers?: [java: string, bedrock: string][];
}

/** One release's texture renames: old path (previous release) -> new path(s). */
export interface JavaRenameStep {
  /** First release where the new names apply */
  version: string;
  /** Old -> new; an array when one image became several */
  renames: Record<string, string | string[]>;
  /** Paths of the previous release with no successor */
  removed?: string[];
}

/** Texture renames between consecutive Java releases, oldest first. Paths as in JavaBedrockMap. */
export interface JavaRenames {
  format: 1;
  steps: JavaRenameStep[];
}

let bedrockMap: Promise<JavaBedrockMap> | null = null;
let renames: Promise<JavaRenames> | null = null;

/** The Java <-> Bedrock pairs (one shared request; retried after a failed load). */
export function loadJavaBedrockMap(): Promise<JavaBedrockMap> {
  return (bedrockMap ??= import('./java-bedrock.json').then(
    (m) => m.default as unknown as JavaBedrockMap,
    (err: unknown) => {
      bedrockMap = null;
      throw err;
    },
  ));
}

/** The Java version-to-version renames (one shared request; retried after a failed load). */
export function loadJavaRenames(): Promise<JavaRenames> {
  return (renames ??= import('./java-renames.json').then(
    (m) => m.default as unknown as JavaRenames,
    (err: unknown) => {
      renames = null;
      throw err;
    },
  ));
}
