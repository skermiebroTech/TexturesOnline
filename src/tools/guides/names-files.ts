// The name-based texture files the "Rename items" guide shows. Written out here so the guide pages
// don't load the editor's code; tests/unit/names.test.ts checks them against what the export writes
// (src/tools/textures/names), so the guide and the editor can't disagree.

/** 1.21.5+: assets/minecraft/items/diamond_sword.json picking a model by the sword's name. */
export const NAMES_DEFINITION = `{
  "model": {
    "type": "minecraft:select",
    "property": "minecraft:component",
    "component": "minecraft:custom_name",
    "cases": [
      {
        "when": ["Excalibur", "Sword of Light"],
        "model": {
          "type": "minecraft:model",
          "model": "minecraft:item/names/diamond_sword/excalibur"
        }
      }
    ],
    "fallback": {
      "type": "minecraft:model",
      "model": "minecraft:item/diamond_sword"
    }
  }
}
`;

/** assets/minecraft/models/item/names/diamond_sword/excalibur.json: the sword's model with the new picture. */
export const NAMES_MODEL = `{
  "parent": "minecraft:item/diamond_sword",
  "textures": {
    "layer0": "minecraft:item/names/diamond_sword/excalibur"
  }
}
`;

/** Before 1.21.5: assets/minecraft/optifine/cit/names/diamond_sword/excalibur.properties (OptiFine, CIT Resewn). */
export const NAMES_CIT = `# Excalibur, Sword of Light: needs OptiFine or the CIT Resewn mod
type=item
items=diamond_sword
texture=textures/item/names/diamond_sword/excalibur.png
nbt.display.Name=regex:(Excalibur|Sword of Light)
`;
