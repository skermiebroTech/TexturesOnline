// The animation files the "Make animated textures" guide shows. Written out here so the guide pages
// don't load the editor's code; tests/unit/anim.test.ts checks them against what the export writes
// (src/tools/textures/anim), so the guide and the editor can't disagree.

/** Java: stone.png.mcmeta for a strip of three 16 × 16 frames, the third shown longer, blended. */
export const ANIM_MCMETA = `{
  "animation": {
    "interpolate": true,
    "frametime": 4,
    "frames": [
      0,
      1,
      {
        "index": 2,
        "time": 10
      },
      1
    ]
  }
}
`;

/** Java 1.13+: frames that aren't squares (32 × 16 frames in a 32 × 64 image). */
export const ANIM_MCMETA_WIDE = `{
  "animation": {
    "width": 32,
    "height": 16,
    "frametime": 2
  }
}
`;

/** Bedrock: the entry for glowstone in textures/flipbook_textures.json (frame 2 shown for 8 ticks). */
export const ANIM_FLIPBOOK = `[
  {
    "flipbook_texture": "textures/blocks/glowstone",
    "atlas_tile": "glowstone",
    "ticks_per_frame": 4,
    "frames": [0, 1, 1],
    "blend_frames": false
  }
]
`;
