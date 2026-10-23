// The PBR files the PBR guide shows. Written out here so the guide pages don't load the editor's
// code; tests/unit/pbr.test.ts checks them against what the Material tab's export writes
// (src/tools/textures/pbr/formats.ts, PBR_MIN_ENGINE), so the guide and the editor can't disagree.

/** diamond_ore.texture_set.json with glowing spots (an image) and bumps (a normal map). */
export const PBR_TEXTURE_SET = `{
  "format_version": "1.16.100",
  "minecraft:texture_set": {
    "color": "diamond_ore",
    "metalness_emissive_roughness": "diamond_ore_mer",
    "normal": "diamond_ore_normal"
  }
}
`;

/** iron_block.texture_set.json: one metal value for the whole texture. */
export const PBR_UNIFORM_SET = `{
  "format_version": "1.16.100",
  "minecraft:texture_set": {
    "color": "iron_block",
    "metalness_emissive_roughness": [255, 0, 70]
  }
}
`;

/** Lowest min_engine_version of a pack with the "pbr" capability. */
export const PBR_ENGINE: [number, number, number] = [1, 21, 120];

/** The part of manifest.json that turns Vibrant Visuals on for the pack. */
export const PBR_MANIFEST = `{
  "format_version": 2,
  "header": {
    "min_engine_version": [${PBR_ENGINE.join(', ')}],
    …
  },
  "modules": [ … ],
  "capabilities": ["pbr"]
}
`;
