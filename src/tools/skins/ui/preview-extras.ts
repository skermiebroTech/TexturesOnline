// Extra 3D preview controls the SkinPreview API doesn't offer yet: hiding single body parts and a
// see-through outer layer. They reach the wrapped skinview3d viewer and degrade to no-ops when it
// isn't available (no WebGL, or the wrapper changes).

import type { SkinViewer } from 'skinview3d';
import type { SkinPreview } from '../skin-preview';
import type { SkinPart } from '../templates';

interface MaterialLike {
  transparent: boolean;
  opacity: number;
  needsUpdate: boolean;
}

interface MeshLike {
  isMesh?: boolean;
  material?: MaterialLike | MaterialLike[];
}

function viewerOf(preview: SkinPreview): SkinViewer | null {
  const v = (preview as unknown as { viewer?: unknown }).viewer;
  if (!v || typeof v !== 'object' || !('playerObject' in v)) return null;
  return v as SkinViewer;
}

/** Shows or hides one body part in the 3D preview. Returns false when unsupported. */
export function setPartVisible(preview: SkinPreview, part: SkinPart, visible: boolean): boolean {
  const v = viewerOf(preview);
  const bp = v?.playerObject?.skin?.[part];
  if (!bp) return false;
  bp.visible = visible;
  return true;
}

const originalOpacity = new WeakMap<MaterialLike, { transparent: boolean; opacity: number }>();

/** Makes every outer-layer piece semi-transparent so the base layer shows through. */
export function setOuterSeeThrough(preview: SkinPreview, on: boolean, opacity = 0.35): boolean {
  const v = viewerOf(preview);
  const skin = v?.playerObject?.skin;
  if (!skin) return false;
  const parts: SkinPart[] = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
  const seen = new Set<MaterialLike>();
  for (const p of parts) {
    skin[p]?.outerLayer?.traverse((o) => {
      const m = (o as unknown as MeshLike).material;
      // Pixel outlines drawn over the model (paint mode) keep their own look.
      if (!(o as unknown as MeshLike).isMesh || !m || o.userData?.skinOverlay) return;
      for (const mat of Array.isArray(m) ? m : [m]) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        if (!originalOpacity.has(mat)) originalOpacity.set(mat, { transparent: mat.transparent, opacity: mat.opacity });
        const orig = originalOpacity.get(mat)!;
        mat.transparent = on ? true : orig.transparent;
        mat.opacity = on ? opacity : orig.opacity;
        mat.needsUpdate = true;
      }
    });
  }
  return true;
}
