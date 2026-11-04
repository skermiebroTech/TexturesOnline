// The totem pack files the "Make a custom totem" guide shows, in every language. They are what the
// Totem Maker writes (buildTotemPack in src/tools/totem/pack.ts); tests/unit/seo-guide-files.test.ts
// keeps them in step. Written out here so the guide pages don't load the maker's code.

import { MIN_ENGINE } from '../../app/content/facts';

/** The Totem Maker's default pack name and the UUIDs of the example manifest. */
export const TOTEM_EXAMPLE = {
  name: 'Custom Totem',
  uuids: { header: '6d2f9b41-8c3e-4a57-b1d0-7e4c2a9f5b63', module: 'e18a3c75-2b9d-4f06-a4e1-9c5b7d3f0a28' },
};

/** Folder layout of a Java totem pack (1.13 and newer). */
export const TOTEM_JAVA_TREE = `Custom Totem.zip
├── pack.mcmeta
├── pack.png
└── assets/minecraft/textures/item/
    └── totem_of_undying.png`;

/** Folder layout of a Bedrock totem pack. */
export const TOTEM_BEDROCK_TREE = `Custom Totem.mcpack
├── manifest.json
├── pack_icon.png
└── textures/items/
    └── totem.png`;

/** manifest.json of a Bedrock totem pack (the maker adds a "metadata" entry naming itself). */
export const totemManifest = (description: string, name = TOTEM_EXAMPLE.name): string => `{
  "format_version": 2,
  "header": {
    "name": ${JSON.stringify(name)},
    "description": ${JSON.stringify(description)},
    "uuid": "${TOTEM_EXAMPLE.uuids.header}",
    "version": [1, 0, 0],
    "min_engine_version": ${MIN_ENGINE}
  },
  "modules": [
    {
      "type": "resources",
      "uuid": "${TOTEM_EXAMPLE.uuids.module}",
      "version": [1, 0, 0]
    }
  ]
}`;
