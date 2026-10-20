// Example files of the "make 3D items" guide, shown in every language. Each one is exactly what the
// model editor writes (src/tools/textures/models/: doc.ts, presets.ts, targets.ts) for the case the
// guide describes; tests/unit/seo-guide-files.test.ts rebuilds them with that code to keep them in step.

/**
 * A one-cube model shaped like a slab: oak planks picked as the texture of a new cube from 0,0,0 to
 * 16,8,16, cull faces on the five sides that touch the block's edges, and an inventory pose.
 */
export const MODEL_BLOCK_EXAMPLE = `{
  "textures": {
    "oak_planks": "minecraft:block/oak_planks",
    "particle": "#oak_planks"
  },
  "elements": [
    {
      "from": [0, 0, 0],
      "to": [16, 8, 16],
      "faces": {
        "down": {
          "texture": "#oak_planks",
          "cullface": "down"
        },
        "up": {
          "texture": "#oak_planks"
        },
        "north": {
          "texture": "#oak_planks",
          "cullface": "north"
        },
        "south": {
          "texture": "#oak_planks",
          "cullface": "south"
        },
        "west": {
          "texture": "#oak_planks",
          "cullface": "west"
        },
        "east": {
          "texture": "#oak_planks",
          "cullface": "east"
        }
      }
    }
  ],
  "display": {
    "gui": {
      "rotation": [30, 225, 0],
      "translation": [0, 0, 0],
      "scale": [0.625, 0.625, 0.625]
    }
  }
}
`;

/**
 * The cube "3D item from sprite" makes for three opaque pixels in a row (columns 5 to 7 of row 3 of a
 * 16×16 sprite, with nothing above or below them).
 */
export const MODEL_SPRITE_CUBE = `{
  "from": [5, 12, 7.5],
  "to": [8, 13, 8.5],
  "faces": {
    "down": {
      "uv": [5, 3, 8, 4],
      "texture": "#layer0",
      "tintindex": 0
    },
    "up": {
      "uv": [5, 3, 8, 4],
      "texture": "#layer0",
      "tintindex": 0
    },
    "north": {
      "uv": [8, 3, 5, 4],
      "texture": "#layer0",
      "tintindex": 0
    },
    "south": {
      "uv": [5, 3, 8, 4],
      "texture": "#layer0",
      "tintindex": 0
    },
    "west": {
      "uv": [5, 3, 6, 4],
      "texture": "#layer0",
      "tintindex": 0
    },
    "east": {
      "uv": [7, 3, 8, 4],
      "texture": "#layer0",
      "tintindex": 0
    }
  }
}
`;

/** assets/minecraft/items/diamond_sword.json with "Flat in the inventory" on (Java 1.21.4+). */
export const MODEL_FLAT_DEFINITION = `{
  "model": {
    "type": "minecraft:select",
    "property": "minecraft:display_context",
    "cases": [
      {
        "when": ["gui", "ground", "fixed"],
        "model": {
          "type": "minecraft:model",
          "model": "minecraft:item/diamond_sword"
        }
      }
    ],
    "fallback": {
      "type": "minecraft:model",
      "model": "minecraft:item/diamond_sword_3d"
    }
  }
}
`;

/** assets/minecraft/blockstates/stone.json after "Use for every random variant" on the stone model (26.3). */
export const MODEL_STONE_BLOCKSTATE = `{
  "variants": {
    "": [
      {
        "model": "minecraft:block/stone",
        "weight": 2
      },
      {
        "model": "minecraft:block/stone",
        "y": 180,
        "weight": 2
      }
    ]
  }
}
`;

/** The files the model editor puts in the pack for each case in the guide's table (Java 1.21.4 and newer, then 1.8 to 1.21.3). */
export const MODEL_FILES = {
  sword: { latest: ['models/item/diamond_sword.json'], older: ['models/item/diamond_sword.json'] },
  swordFlat: { latest: ['models/item/diamond_sword_3d.json', 'items/diamond_sword.json'], older: null },
  slab: { latest: ['models/block/oak_slab.json'], older: ['models/block/oak_slab.json'] },
  stoneEvery: { latest: ['models/block/stone.json', 'blockstates/stone.json'], older: ['models/block/stone.json', 'blockstates/stone.json'] },
} as const;
