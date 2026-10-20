// Example files of a two-skin Bedrock skin pack, shown in the "make a Bedrock skin pack" guide in
// every language. They are exactly what the Skin Pack Maker writes for this pack
// (buildSkinPackFiles in src/editions/bedrock/manifest.ts); a unit test keeps them in step.

export const SKIN_PACK_EXAMPLE = {
  name: 'Adventure Crew',
  uuids: { header: '3f1c8a52-6b0e-4d7a-9c21-5e8f0b4d2a17', module: 'a94e27d0-1c3b-4f6e-8d55-2b7c9e0f6a83' },
  version: [1, 0, 0] as [number, number, number],
  skins: [
    { name: 'Wizard', model: 'classic' as const },
    { name: 'Robot', model: 'slim' as const },
  ],
};

/** Folder layout of the example pack (the top of the .mcpack). */
export const SKIN_PACK_TREE = `Adventure Crew.mcpack
├── manifest.json
├── skins.json
├── wizard.png
├── robot.png
└── texts/
    ├── en_US.lang
    └── languages.json`;

export const SKIN_PACK_MANIFEST = `{
  "format_version": 2,
  "header": {
    "name": "Adventure Crew",
    "uuid": "3f1c8a52-6b0e-4d7a-9c21-5e8f0b4d2a17",
    "version": [1, 0, 0]
  },
  "modules": [
    {
      "type": "skin_pack",
      "uuid": "a94e27d0-1c3b-4f6e-8d55-2b7c9e0f6a83",
      "version": [1, 0, 0]
    }
  ]
}
`;

export const SKIN_PACK_SKINS_JSON = `{
  "serialize_name": "AdventureCrew_3f1c8a52",
  "localization_name": "AdventureCrew_3f1c8a52",
  "skins": [
    {
      "localization_name": "Wizard",
      "geometry": "geometry.humanoid.custom",
      "texture": "wizard.png",
      "type": "free"
    },
    {
      "localization_name": "Robot",
      "geometry": "geometry.humanoid.customSlim",
      "texture": "robot.png",
      "type": "free"
    }
  ]
}
`;

export const SKIN_PACK_LANG = `skinpack.AdventureCrew_3f1c8a52=Adventure Crew
skin.AdventureCrew_3f1c8a52.Wizard=Wizard
skin.AdventureCrew_3f1c8a52.Robot=Robot
`;

export const SKIN_PACK_LANGUAGES = `[
  "en_US"
]
`;
