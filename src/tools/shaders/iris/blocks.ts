// Block / item / entity ID lists for block.properties, item.properties and entity.properties.
// Unknown names are ignored by both loaders, so blocks from newer versions can be listed for
// every version. Each block may appear under one ID only (the first mapping wins).

import { IDS } from './glsl-lib';

export interface BlockGroup {
  id: number;
  what: string;
  /** Minecraft 1.13+ (flattened) names */
  modern: string[];
  /** Replaces 'modern' before 1.20.3 (the short_grass rename), when given */
  before12003?: string[];
  /** Iris 1.7+ block tags, added only when IRIS_TAG_SUPPORT is defined */
  tags?: string[];
  /** Minecraft 1.8 - 1.12 names (OptiFine only) */
  legacy: string[];
}

const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const COPPER_AGES = ['', 'exposed_', 'weathered_', 'oxidized_'];
const copper = (suffix: string, state = ''): string[] =>
  COPPER_AGES.flatMap((age) => [`${age}copper_${suffix}${state}`, `waxed_${age}copper_${suffix}${state}`]);

const SMALL_PLANTS = [
  'fern', 'dead_bush', 'bush', 'firefly_bush', 'short_dry_grass', 'tall_dry_grass', 'dandelion', 'golden_dandelion', 'poppy',
  'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower',
  'lily_of_the_valley', 'wither_rose', 'torchflower', 'open_eyeblossom', 'closed_eyeblossom', 'oak_sapling', 'spruce_sapling',
  'birch_sapling', 'jungle_sapling', 'acacia_sapling', 'dark_oak_sapling', 'cherry_sapling', 'pale_oak_sapling', 'poplar_sapling',
  'sweet_berry_bush', 'crimson_roots', 'warped_roots', 'nether_sprouts', 'seagrass', 'red_shrub',
];

const TALL_PLANTS = ['tall_grass', 'large_fern', 'sunflower', 'lilac', 'rose_bush', 'peony', 'pitcher_plant', 'tall_seagrass'];

export const BLOCK_GROUPS: BlockGroup[] = [
  {
    id: IDS.leaves,
    what: 'leaves',
    modern: ['oak_leaves', 'spruce_leaves', 'birch_leaves', 'jungle_leaves', 'acacia_leaves', 'dark_oak_leaves', 'mangrove_leaves',
      'cherry_leaves', 'azalea_leaves', 'flowering_azalea_leaves', 'pale_oak_leaves', 'red_poplar_leaves', 'orange_poplar_leaves',
      'yellow_poplar_leaves'],
    tags: ['leaves'],
    legacy: ['leaves', 'leaves2'],
  },
  {
    id: IDS.plant,
    what: 'grass, flowers, saplings and other small plants',
    modern: ['short_grass', ...SMALL_PLANTS],
    before12003: ['grass', ...SMALL_PLANTS],
    tags: ['small_flowers'],
    legacy: ['tallgrass', 'deadbush', 'yellow_flower', 'red_flower', 'sapling'],
  },
  {
    id: IDS.tallLower,
    what: 'lower half of tall plants',
    modern: TALL_PLANTS.map((b) => `${b}:half=lower`),
    legacy: ['double_plant:half=lower'],
  },
  {
    id: IDS.tallUpper,
    what: 'upper half of tall plants',
    modern: TALL_PLANTS.map((b) => `${b}:half=upper`),
    legacy: ['double_plant:half=upper'],
  },
  {
    id: IDS.crop,
    what: 'crops',
    modern: ['wheat', 'carrots', 'potatoes', 'beetroots', 'torchflower_crop', 'melon_stem', 'pumpkin_stem', 'nether_wart'],
    legacy: ['wheat', 'carrots', 'potatoes', 'beetroots', 'melon_stem', 'pumpkin_stem', 'nether_wart'],
  },
  {
    id: IDS.vine,
    what: 'vines and hanging plants',
    modern: ['vine', 'weeping_vines', 'weeping_vines_plant', 'twisting_vines', 'twisting_vines_plant', 'cave_vines', 'cave_vines_plant',
      'hanging_roots', 'pale_hanging_moss'],
    legacy: ['vine'],
  },
  {
    id: IDS.lilyPad,
    what: 'lily pads',
    modern: ['lily_pad'],
    legacy: ['waterlily'],
  },
  {
    id: IDS.water,
    what: 'water',
    modern: ['water'],
    legacy: ['water', 'flowing_water'],
  },
  {
    id: IDS.endPortal,
    what: 'end portals (block entities)',
    modern: ['end_portal', 'end_gateway'],
    legacy: ['end_portal', 'end_gateway'],
  },
  {
    id: IDS.lava,
    what: 'lava',
    modern: ['lava'],
    legacy: ['lava', 'flowing_lava'],
  },
  {
    id: IDS.lightSource,
    what: 'light sources where only the bright parts glow',
    modern: [
      'torch', 'wall_torch', 'soul_torch', 'soul_wall_torch', 'redstone_torch:lit=true', 'redstone_wall_torch:lit=true',
      'copper_torch', 'copper_wall_torch', 'lantern', 'soul_lantern', ...copper('lantern'),
      'fire', 'soul_fire', 'campfire:lit=true', 'soul_campfire:lit=true',
      'candle:lit=true', ...COLORS.map((c) => `${c}_candle:lit=true`), 'candle_cake:lit=true', ...COLORS.map((c) => `${c}_candle_cake:lit=true`),
      'furnace:lit=true', 'smoker:lit=true', 'blast_furnace:lit=true', 'jack_o_lantern', 'redstone_ore:lit=true',
      'deepslate_redstone_ore:lit=true', 'respawn_anchor', 'crying_obsidian', 'magma_block', 'sea_pickle', 'amethyst_cluster', 'beacon',
    ],
    legacy: ['torch', 'redstone_torch', 'lit_furnace', 'lit_pumpkin', 'fire', 'magma', 'lit_redstone_ore', 'beacon'],
  },
  {
    id: IDS.glowing,
    what: 'glowing blocks',
    modern: ['glowstone', 'sea_lantern', 'shroomlight', 'ochre_froglight', 'verdant_froglight', 'pearlescent_froglight',
      'redstone_lamp:lit=true', ...copper('bulb', ':lit=true'), 'end_rod', 'nether_portal'],
    legacy: ['glowstone', 'sea_lantern', 'lit_redstone_lamp', 'end_rod', 'portal'],
  },
];

export const ITEM_GROUPS = [
  { id: IDS.itemBrightLight, what: 'items that light up like a torch when held', items: ['lava_bucket'] },
  {
    id: IDS.itemGlow,
    what: 'glowing items that give a little light when held',
    items: ['blaze_rod', 'blaze_powder', 'glowstone_dust', 'glow_berries', 'glow_ink_sac', 'nether_star', 'magma_cream', 'fire_charge',
      'end_crystal', 'experience_bottle'],
  },
] as const;

export const ENTITY_GROUPS = [{ id: IDS.lightning, what: 'lightning bolts', entities: ['lightning_bolt'] }] as const;
