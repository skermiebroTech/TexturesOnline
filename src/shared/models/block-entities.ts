// Blocks the game draws with its own model code instead of a block model (chests, shulker boxes,
// banners, heads, decorated pots, conduits, bells, enchanting table and lectern books, copper golem
// statues, end portals, and before 26.2 signs, hanging signs and beds), rebuilt from the game's own
// model part definitions and renderer transforms so they show their real shape with their texture
// sheet mapped the way the game maps it. Works for Java (every version with models, using that
// version's texture paths) and Bedrock (its own texture files and the few shapes it draws
// differently). Pure, no DOM.

import { boxQuads, DIRS, type BakedQuad, type Dir, type RGB, type Tint, type Vec3 } from './geometry';
import {
  MAT4_IDENTITY,
  bakeEntityModel,
  cube,
  deg,
  facesExcept,
  mat4Chain,
  mat4RotateAround,
  mat4Rotation,
  mat4Scale,
  mat4Translation,
  offsetQuads,
  type EntityCube,
  type EntityModel,
  type EntityPart,
  type EntityPose,
  type Mat4,
} from './entity-models';
import type { BlockState } from './types';

// ---------------------------------------------------------------------------------------------
// Shared helpers

export const DYE_COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'] as const;
export type DyeColor = (typeof DYE_COLORS)[number];

/** The colour the game multiplies dyed textures with (DyeColor texture diffuse colour). */
export const DYE_RGB: Record<DyeColor, RGB> = {
  white: [0xf9, 0xff, 0xfe],
  orange: [0xf9, 0x80, 0x1d],
  magenta: [0xc7, 0x4e, 0xbd],
  light_blue: [0x3a, 0xb3, 0xda],
  yellow: [0xfe, 0xd8, 0x3d],
  lime: [0x80, 0xc7, 0x1f],
  pink: [0xf3, 0x8b, 0xaa],
  gray: [0x47, 0x4f, 0x52],
  light_gray: [0x9d, 0x9d, 0x97],
  cyan: [0x16, 0x9c, 0x9c],
  purple: [0x89, 0x32, 0xb8],
  blue: [0x3c, 0x44, 0xaa],
  brown: [0x83, 0x54, 0x32],
  green: [0x5e, 0x7c, 0x16],
  red: [0xb0, 0x2e, 0x26],
  black: [0x1d, 0x1d, 0x21],
};

const isDye = (s: string): s is DyeColor => (DYE_COLORS as readonly string[]).includes(s);

type Horizontal = 'north' | 'south' | 'west' | 'east';
const HORIZONTAL: Horizontal[] = ['north', 'south', 'west', 'east'];

/** Direction.toYRot: south 0, west 90, north 180, east 270. */
export function yRotOf(d: string): number {
  return d === 'south' ? 0 : d === 'west' ? 90 : d === 'north' ? 180 : d === 'east' ? 270 : 0;
}

function clockwise(d: Horizontal): Horizontal {
  return d === 'north' ? 'east' : d === 'east' ? 'south' : d === 'south' ? 'west' : 'north';
}
function counterClockwise(d: Horizontal): Horizontal {
  return d === 'north' ? 'west' : d === 'west' ? 'south' : d === 'south' ? 'east' : 'north';
}
function opposite(d: Horizontal): Horizontal {
  return d === 'north' ? 'south' : d === 'south' ? 'north' : d === 'west' ? 'east' : 'west';
}
const STEP: Record<Horizontal, Vec3> = { north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0] };

const horizontal = (v: string | undefined, fb: Horizontal = 'north'): Horizontal => (HORIZONTAL.includes(v as Horizontal) ? (v as Horizontal) : fb);
const ROTATIONS = Array.from({ length: 16 }, (_, i) => String(i));

// ---------------------------------------------------------------------------------------------
// Model tables (numbers from the game's model definitions: texture offset, box origin and size,
// part offsets and rotations)

const PI = Math.PI;

function part(name: string, cubes: EntityCube[], pose?: EntityPose, children?: EntityPart[]): EntityPart {
  return { name, cubes, pose, children };
}

/** Chests since 1.15 (ChestModel): single and the two halves of a double chest, each 64x64. */
export const CHEST_SINGLE: EntityModel = {
  texSize: [64, 64],
  parts: [
    part('bottom', [cube(0, 19, 1, 0, 1, 14, 10, 14)]),
    part('lid', [cube(0, 0, 1, 0, 0, 14, 5, 14)], { offset: [0, 9, 1] }),
    part('lock', [cube(0, 0, 7, -2, 14, 2, 4, 1)], { offset: [0, 9, 1] }),
  ],
};
export const CHEST_RIGHT: EntityModel = {
  texSize: [64, 64],
  parts: [
    part('bottom', [cube(0, 19, 1, 0, 1, 15, 10, 14, { faces: facesExcept('east') })]),
    part('lid', [cube(0, 0, 1, 0, 0, 15, 5, 14, { faces: facesExcept('east') })], { offset: [0, 9, 1] }),
    part('lock', [cube(0, 0, 15, -2, 14, 1, 4, 1, { faces: facesExcept('east') })], { offset: [0, 9, 1] }),
  ],
};
export const CHEST_LEFT: EntityModel = {
  texSize: [64, 64],
  parts: [
    part('bottom', [cube(0, 19, 0, 0, 1, 15, 10, 14, { faces: facesExcept('west') })]),
    part('lid', [cube(0, 0, 0, 0, 0, 15, 5, 14, { faces: facesExcept('west') })], { offset: [0, 9, 1] }),
    part('lock', [cube(0, 0, 0, -2, 14, 1, 4, 1, { faces: facesExcept('west') })], { offset: [0, 9, 1] }),
  ],
};
/** Chests up to 1.14 and on Bedrock (ModelChest, drawn upside down): single 64x64, double 128x64. */
export const CHEST_LEGACY: EntityModel = {
  texSize: [64, 64],
  parts: [
    part('lid', [cube(0, 0, 0, -5, -14, 14, 5, 14)], { offset: [1, 7, 15] }),
    part('knob', [cube(0, 0, -1, -2, -15, 2, 4, 1)], { offset: [8, 7, 15] }),
    part('bottom', [cube(0, 19, 0, 0, 0, 14, 10, 14)], { offset: [1, 6, 1] }),
  ],
};
export const CHEST_LEGACY_DOUBLE: EntityModel = {
  texSize: [128, 64],
  parts: [
    part('lid', [cube(0, 0, 0, -5, -14, 30, 5, 14)], { offset: [1, 7, 15] }),
    part('knob', [cube(0, 0, -1, -2, -15, 2, 4, 1)], { offset: [16, 7, 15] }),
    part('bottom', [cube(0, 19, 0, 0, 0, 30, 10, 14)], { offset: [1, 6, 1] }),
  ],
};

/** Shulker box shell (lid and base), 64x64. */
export const SHULKER_BOX: EntityModel = {
  texSize: [64, 64],
  parts: [part('lid', [cube(0, 0, -8, -16, -8, 16, 12, 16)], { offset: [0, 24, 0] }), part('base', [cube(0, 28, -8, -8, -8, 16, 8, 16)], { offset: [0, 24, 0] })],
};

/** Banner pole and bar (standing) or bar (wall), and its flag; 64x64. The flag leans back a little. */
const FLAG_TILT = (-0.0125 + 0.01) * PI;
export const BANNER_STANDING: EntityModel = {
  texSize: [64, 64],
  parts: [part('pole', [cube(44, 0, -1, -42, -1, 2, 42, 2)]), part('bar', [cube(0, 42, -10, -44, -1, 20, 2, 2)])],
};
export const BANNER_WALL: EntityModel = { texSize: [64, 64], parts: [part('bar', [cube(0, 42, -10, -20.5, 9.5, 20, 2, 2)])] };
export const BANNER_FLAG_STANDING: EntityModel = { texSize: [64, 64], parts: [part('flag', [cube(0, 0, -10, 0, -2, 20, 40, 1)], { offset: [0, -44, 0], rotation: [FLAG_TILT, 0, 0] })] };
export const BANNER_FLAG_WALL: EntityModel = { texSize: [64, 64], parts: [part('flag', [cube(0, 0, -10, 0, -2, 20, 40, 1)], { offset: [0, -20.5, 10.5], rotation: [FLAG_TILT, 0, 0] })] };

/** Mob heads (skeleton, wither skeleton, creeper), 64x32. */
export const HEAD_MOB: EntityModel = { texSize: [64, 32], parts: [part('head', [cube(0, 0, -4, -8, -4, 8, 8, 8)])] };
/** Humanoid heads (player, zombie) with the hat layer, 64x64. */
export const HEAD_HUMANOID: EntityModel = {
  texSize: [64, 64],
  parts: [part('head', [cube(0, 0, -4, -8, -4, 8, 8, 8)], undefined, [part('hat', [cube(32, 0, -4, -8, -4, 8, 8, 8, { inflate: 0.25 })])])],
};
/** Player head without the hat (Bedrock), 64x64. */
export const HEAD_PLAYER_PLAIN: EntityModel = { texSize: [64, 64], parts: [part('head', [cube(0, 0, -4, -8, -4, 8, 8, 8)])] };
/** Piglin head with its snout, tusks and ears (ears as the head renderer turns them), 64x64. */
export const HEAD_PIGLIN: EntityModel = {
  texSize: [64, 64],
  parts: [
    part('head', [cube(0, 0, -5, -8, -4, 10, 8, 8), cube(31, 1, -2, -4, -5, 4, 4, 1), cube(2, 4, 2, -2, -5, 1, 2, 1), cube(2, 0, -3, -2, -5, 1, 2, 1)], undefined, [
      part('left_ear', [cube(51, 6, 0, 0, -2, 1, 5, 4)], { offset: [4.5, -6, 0], rotation: [0, 0, -0.7] }),
      part('right_ear', [cube(39, 6, -1, 0, -2, 1, 5, 4)], { offset: [-4.5, -6, 0], rotation: [0, 0, 0.7] }),
    ]),
  ],
};
/** Ender dragon head (scaled 3/4) with its jaw, 256x256. */
export const HEAD_DRAGON: EntityModel = {
  texSize: [256, 256],
  parts: [
    part(
      'head',
      [
        cube(176, 44, -6, -1, -24, 12, 5, 16),
        cube(112, 30, -8, -8, -10, 16, 16, 16),
        cube(0, 0, -5, -12, -4, 2, 4, 6, { mirror: true }),
        cube(112, 0, -5, -3, -22, 2, 2, 4, { mirror: true }),
        cube(0, 0, 3, -12, -4, 2, 4, 6),
        cube(112, 0, 3, -3, -22, 2, 2, 4),
      ],
      { offset: [0, -7.986666 * 0.75, 0], scale: [0.75, 0.75, 0.75] },
      [part('jaw', [cube(176, 65, -6, 0, -16, 12, 4, 16)], { offset: [0, 4, -8], rotation: [0.2, 0, 0] })],
    ),
  ],
};

/** Decorated pot: neck, top and bottom (32x32) and the four sherd sides (16x16). */
export const POT_BASE: EntityModel = {
  texSize: [32, 32],
  parts: [
    part('neck', [cube(0, 0, 4, 17, 4, 8, 3, 8, { inflate: -0.1 }), cube(0, 5, 5, 20, 5, 6, 1, 6, { inflate: 0.2 })], { offset: [0, 37, 16], rotation: [PI, 0, 0] }),
    part('top', [cube(-14, 13, 0, 0, 0, 14, 0, 14)], { offset: [1, 16, 1] }),
    part('bottom', [cube(-14, 13, 0, 0, 0, 14, 0, 14)], { offset: [1, 0, 1] }),
  ],
};
const potSide = (name: string, offset: Vec3, rotation: Vec3) => part(name, [cube(1, 0, 0, 0, 0, 14, 16, 0, { faces: ['north'] })], { offset, rotation });
export const POT_SIDES: EntityModel = {
  texSize: [16, 16],
  parts: [potSide('back', [15, 16, 1], [0, 0, PI]), potSide('left', [1, 16, 1], [0, -PI / 2, PI]), potSide('right', [15, 16, 15], [0, PI / 2, PI]), potSide('front', [1, 16, 15], [PI, 0, 0])],
};

/** Conduit shell (the inactive conduit), 32x16. */
export const CONDUIT_SHELL: EntityModel = { texSize: [32, 16], parts: [part('shell', [cube(0, 0, -3, -3, -3, 6, 6, 6)])] };

/** Bell body with its rim, 32x32 (the frame is a block model). */
export const BELL_BODY: EntityModel = {
  texSize: [32, 32],
  parts: [part('bell_body', [cube(0, 0, -3, -6, -3, 6, 7, 6)], { offset: [8, 12, 8] }, [part('bell_base', [cube(0, 13, 4, 4, 4, 8, 2, 8)], { offset: [-8, -12, -8] })])],
};

/** Enchanting table / lectern book, 64x32. Its pose comes from how open it is. */
export const BOOK: EntityModel = {
  texSize: [64, 32],
  parts: [
    part('left_lid', [cube(0, 0, -6, -5, -0.005, 6, 10, 0.005)], { offset: [0, 0, -1] }),
    part('right_lid', [cube(16, 0, 0, -5, -0.005, 6, 10, 0.005)], { offset: [0, 0, 1] }),
    part('seam', [cube(12, 0, -1, -5, 0, 2, 10, 0.005)], { rotation: [0, PI / 2, 0] }),
    part('left_pages', [cube(0, 10, 0, -4, -0.99, 5, 8, 1)]),
    part('right_pages', [cube(12, 10, 0, -4, -0.01, 5, 8, 1)]),
    part('flip_page1', [cube(24, 10, 0, -4, 0, 5, 8, 0.005)]),
    part('flip_page2', [cube(24, 10, 0, -4, 0, 5, 8, 0.005)]),
  ],
};

/** BookModel.setupAnim for an openness and two page flips. */
function bookPose(open: number, flip1: number, flip2: number) {
  const s = Math.sin(open);
  return (path: string, pose: EntityPose | undefined): EntityPose | undefined => {
    switch (path) {
      case 'left_lid':
        return { offset: [0, 0, -1], rotation: [0, PI + open, 0] };
      case 'right_lid':
        return { offset: [0, 0, 1], rotation: [0, -open, 0] };
      case 'left_pages':
        return { offset: [s, 0, 0], rotation: [0, open, 0] };
      case 'right_pages':
        return { offset: [s, 0, 0], rotation: [0, -open, 0] };
      case 'flip_page1':
        return { offset: [s, 0, 0], rotation: [0, open - open * 2 * flip1, 0] };
      case 'flip_page2':
        return { offset: [s, 0, 0], rotation: [0, open - open * 2 * flip2, 0] };
      default:
        return pose;
    }
  };
}

/** Copper golem statue in its four poses (the statue turns the model upside up), 64x64. */
const GOLEM_HEAD_CUBES = (y: number, inflate: number) => [
  cube(0, 0, -4, -5 + y, -5, 8, 5, 10, inflate ? { inflate } : {}),
  cube(56, 0, -1, -2 + y, -6, 2, 3, 2),
  cube(37, 8, -1, -9 + y, -1, 2, 4, 2, { inflate: -0.015 }),
  cube(37, 0, -2, -13 + y, -2, 4, 4, 4, { inflate: -0.015 }),
];
const golemRoot = (children: EntityPart[]): EntityModel => ({ texSize: [64, 64], parts: [part('root', [], { rotation: [0, 0, PI] }, children)] });
export const GOLEM_STATUE: Record<'standing' | 'sitting' | 'running' | 'star', EntityModel> = {
  standing: golemRoot([
    part('body', [cube(0, 15, -4, -6, -3, 8, 6, 6)], { offset: [0, -5, 0] }, [
      part('head', GOLEM_HEAD_CUBES(0, 0.015), { offset: [0, -6, 0] }),
      part('right_arm', [cube(36, 16, -3, -1, -2, 3, 10, 4)], { offset: [-4, -6, 0] }),
      part('left_arm', [cube(50, 16, 0, -1, -2, 3, 10, 4)], { offset: [4, -6, 0] }),
    ]),
    part('right_leg', [cube(0, 27, -4, 0, -2, 4, 5, 4)], { offset: [0, -5, 0] }),
    part('left_leg', [cube(16, 27, 0, 0, -2, 4, 5, 4)], { offset: [0, -5, 0] }),
  ]),
  running: golemRoot([
    part('body', [], { offset: [-1.064, -5, 0] }, [
      part('body_r1', [cube(0, 15, -4.02, -6.116, -3.5, 8, 6, 6)], { offset: [1.1, 0.1, 0.7], rotation: [0.1204, -0.0064, -0.0779] }),
      part(
        'head',
        [cube(0, 0, -4, -5.1, -5, 8, 5, 10), cube(56, 0, -1.02, -2.1, -6, 2, 3, 2), cube(37, 8, -1.02, -9.1, -1, 2, 4, 2, { inflate: -0.015 }), cube(37, 0, -2, -13.1, -2, 4, 4, 4, { inflate: -0.015 })],
        { offset: [0.7, -5.6, -1.8] },
      ),
      part('right_arm', [], { offset: [-4, -6, 0] }, [part('right_arm_r1', [cube(36, 16, -3.052, -1.11, -2.036, 3, 10, 4)], { offset: [0.7, -0.248, -1.62], rotation: [1.0036, 0, 0] })]),
      part('left_arm', [], { offset: [4, -6, 0] }, [part('left_arm_r1', [cube(50, 16, 0.032, -1.1, -2, 3, 10, 4)], { offset: [0.732, 0, 0], rotation: [-0.8715, -0.0535, -0.0449] })]),
    ]),
    part('right_leg', [], { offset: [-3.064, -5, 0] }, [part('right_leg_r1', [cube(0, 27, -1.856, -0.1, -1.09, 4, 5, 4)], { offset: [1.048, 0, -0.9], rotation: [-0.8727, 0, 0] })]),
    part('left_leg', [], { offset: [0.936, -5, 0] }, [part('left_leg_r1', [cube(16, 27, -2.088, -0.1, -2, 4, 5, 4)], { offset: [1, 0, 0], rotation: [0.7854, 0, 0] })]),
  ]),
  sitting: golemRoot([
    part('body', [cube(3, 19, -3, -4, -4.525, 6, 1, 6), cube(0, 15, -4, -3, -3.525, 8, 6, 6)], { offset: [0, -3, 2.325] }, [
      part('body_r1', [cube(3, 18, -4, -3, -2.2, 8, 6, 3)], { offset: [0, -1, -4.325], rotation: [0, 0, -3.1416] }),
      part(
        'head',
        [cube(37, 8, -1, -7, -3.3, 2, 4, 2, { inflate: -0.015 }), cube(37, 0, -2, -11, -4.3, 4, 4, 4, { inflate: -0.015 }), cube(0, 0, -4, -3, -7.325, 8, 5, 10), cube(56, 0, -1, 0, -8.325, 2, 3, 2)],
        { offset: [0, -6, -0.2] },
      ),
      part('right_arm', [], { offset: [-4, -5.6, -1.8], rotation: [0.4363, 0, 0] }, [
        part('right_arm_r1', [cube(36, 16, -3.075, -0.9733, -1.9966, 3, 10, 4)], { offset: [0, 0.0893, 0.1198], rotation: [-1.0472, 0, 0] }),
      ]),
      part('left_arm', [], { offset: [4, -5.6, -1.7], rotation: [0.4363, 0, 0] }, [
        part('left_arm_r1', [cube(50, 16, 0.075, -1.0443, -1.8997, 3, 10, 4)], { offset: [0, -0.0015, -0.0808], rotation: [-1.0472, 0, 0] }),
      ]),
    ]),
    part('right_leg', [], { offset: [-2.1, -2.1, -2.075] }, [part('right_leg_r1', [cube(0, 27, -2, 0.975, 0, 4, 5, 4)], { offset: [0.05, -1.9, 1.075], rotation: [-1.5708, 0, 0] })]),
    part('left_leg', [], { offset: [2, -2, -2.075] }, [part('left_leg_r1', [cube(16, 27, -2, 0.975, 0, 4, 5, 4)], { offset: [0.05, -2, 1.075], rotation: [-1.5708, 0, 0] })]),
  ]),
  star: golemRoot([
    part('body', [cube(0, 15, -4, -6, -3, 8, 6, 6)], { offset: [0, -5, 0] }, [
      part('head', GOLEM_HEAD_CUBES(0, 0), { offset: [0, -6, 0] }),
      part('right_arm', [], { offset: [-4, -6, 0] }, [part('right_arm_r1', [cube(36, 16, -1.5, -5, -2, 3, 10, 4)], { offset: [1, 1, 0], rotation: [0, 0, 1.9199] })]),
      part('left_arm', [], { offset: [4, -6, 0] }, [part('left_arm_r1', [cube(50, 16, -1.5, -5, -2, 3, 10, 4)], { offset: [-1, 1, 0], rotation: [0, 0, -1.9199] })]),
    ]),
    part('right_leg', [], { offset: [-3, -5, 0] }, [part('right_leg_r1', [cube(0, 27, -2, -2.5, -2, 4, 5, 4)], { offset: [0.35, 2, 0.01], rotation: [0, 0, 0.2618] })]),
    part('left_leg', [], { offset: [1, -5, 0] }, [part('left_leg_r1', [cube(16, 27, -2, -2.5, -2, 4, 5, 4)], { offset: [1.65, 2, 0], rotation: [0, 0, -0.2618] })]),
  ]),
};

/** Signs before 26.2: board and stick (standing) or board (wall), 64x32. */
export const SIGN_STANDING: EntityModel = { texSize: [64, 32], parts: [part('sign', [cube(0, 0, -12, -14, -1, 24, 12, 2)]), part('stick', [cube(0, 14, -1, -2, -1, 2, 14, 2)])] };
export const SIGN_WALL: EntityModel = { texSize: [64, 32], parts: [part('sign', [cube(0, 0, -12, -14, -1, 24, 12, 2)])] };

/** Hanging signs before 26.2 (64x32): wall (plank and chains), ceiling (chains) or ceiling attached (V chains). */
const CHAINS = part('normalChains', [], undefined, [
  part('chainL1', [cube(0, 6, -1.5, 0, 0, 3, 6, 0)], { offset: [-5, -6, 0], rotation: [0, -PI / 4, 0] }),
  part('chainL2', [cube(6, 6, -1.5, 0, 0, 3, 6, 0)], { offset: [-5, -6, 0], rotation: [0, PI / 4, 0] }),
  part('chainR1', [cube(0, 6, -1.5, 0, 0, 3, 6, 0)], { offset: [5, -6, 0], rotation: [0, -PI / 4, 0] }),
  part('chainR2', [cube(6, 6, -1.5, 0, 0, 3, 6, 0)], { offset: [5, -6, 0], rotation: [0, PI / 4, 0] }),
]);
const BOARD = part('board', [cube(0, 12, -7, 0, -1, 14, 10, 2)]);
export const HANGING_SIGN: Record<'wall' | 'ceiling' | 'ceiling_middle', EntityModel> = {
  wall: { texSize: [64, 32], parts: [BOARD, part('plank', [cube(0, 0, -8, -6, -2, 16, 2, 4)]), CHAINS] },
  ceiling: { texSize: [64, 32], parts: [BOARD, CHAINS] },
  ceiling_middle: { texSize: [64, 32], parts: [BOARD, part('vChains', [cube(14, 6, -6, -6, 0, 12, 6, 0)])] },
};

/** Beds from 1.12 to 26.1: head and foot halves, 64x64. */
export const BED_HEAD: EntityModel = {
  texSize: [64, 64],
  parts: [
    part('main', [cube(0, 0, 0, 0, 0, 16, 16, 6, { faces: facesExcept('up') })]),
    part('left_leg', [cube(50, 6, 0, 6, 0, 3, 3, 3, { faces: facesExcept('down') })], { rotation: [PI / 2, 0, PI / 2] }),
    part('right_leg', [cube(50, 18, -16, 6, 0, 3, 3, 3, { faces: facesExcept('down') })], { rotation: [PI / 2, 0, PI] }),
  ],
};
export const BED_FOOT: EntityModel = {
  texSize: [64, 64],
  parts: [
    part('main', [cube(0, 22, 0, 0, 0, 16, 16, 6, { faces: facesExcept('down') })]),
    part('left_leg', [cube(50, 0, 0, 6, -16, 3, 3, 3, { faces: facesExcept('down') })], { rotation: [PI / 2, 0, 0] }),
    part('right_leg', [cube(50, 12, -16, 6, -16, 3, 3, 3, { faces: facesExcept('down') })], { rotation: [PI / 2, 0, (PI * 3) / 2] }),
  ],
};

/**
 * Bedrock's bed: one two-block-long box plus frame and legs (geometry.bed), 64x64. Written in the
 * Java model space (x and y negated, like the game's entity renderers expect).
 */
function bedrockCube(u: number, v: number, x: number, y: number, z: number, w: number, h: number, d: number): EntityCube {
  return cube(u, v, -(x + w), -(y + h), z, w, h, d);
}
export const BED_BEDROCK: EntityModel = {
  texSize: [64, 64],
  parts: [
    part('bed', [
      bedrockCube(0, 0, 0, 0, 0, 16, 32, 6),
      bedrockCube(38, 2, 3, 31, 6, 10, 1, 3),
      bedrockCube(38, 38, 3, 0, 6, 10, 1, 3),
      bedrockCube(52, 6, 15, 3, 6, 1, 26, 3),
      bedrockCube(44, 6, 0, 3, 6, 1, 26, 3),
    ]),
    part('leg1', [bedrockCube(12, 38, 13, 29, 6, 3, 3, 3)]),
    part('leg0', [bedrockCube(0, 38, 0, 29, 6, 3, 3, 3)]),
    part('leg3', [bedrockCube(12, 44, 13, 0, 6, 3, 3, 3)]),
    part('leg2', [bedrockCube(0, 44, 0, 0, 6, 3, 3, 3)]),
  ],
};

/** Shield (plate and handle), 64x64, and trident, 32x32 (items). */
export const SHIELD: EntityModel = { texSize: [64, 64], parts: [part('plate', [cube(0, 0, -6, -11, -2, 12, 22, 1)]), part('handle', [cube(26, 0, -1, -3, -1, 2, 6, 6)])] };
export const TRIDENT: EntityModel = {
  texSize: [32, 32],
  parts: [
    part('pole', [cube(0, 6, -0.5, 2, -0.5, 1, 25, 1)], undefined, [
      part('base', [cube(4, 0, -1.5, 0, -0.5, 3, 2, 1)]),
      part('left_spike', [cube(4, 3, -2.5, -3, -0.5, 1, 4, 1)]),
      part('middle_spike', [cube(0, 0, -0.5, -4, -0.5, 1, 4, 1)]),
      part('right_spike', [cube(4, 3, 1.5, -3, -0.5, 1, 4, 1, { mirror: true })]),
    ]),
  ],
};

// ---------------------------------------------------------------------------------------------
// Renderer transforms (each block entity renderer's pose for a block state)

/** ChestRenderer since 1.15: turns about the block's vertical centre line. */
function chestTransform(facing: Horizontal): Mat4 {
  return mat4RotateAround('y', deg(-yRotOf(facing)), 0.5, 0, 0.5);
}

/** Chest renderer up to 1.14: the model is drawn upside down, then turned. */
function legacyChestTransform(facing: Horizontal): Mat4 {
  return mat4Chain(mat4Translation(0, 1, 1), mat4Scale(1, -1, -1), mat4RotateAround('y', deg(yRotOf(facing)), 0.5, 0.5, 0.5));
}

/** Direction.getRotation: the rotation that takes up to the given direction. */
function directionRotation(d: Dir): Mat4 {
  switch (d) {
    case 'down':
      return mat4Rotation('x', PI);
    case 'up':
      return MAT4_IDENTITY;
    case 'north':
      return mat4Chain(mat4Rotation('x', PI / 2), mat4Rotation('z', PI));
    case 'south':
      return mat4Rotation('x', PI / 2);
    case 'west':
      return mat4Chain(mat4Rotation('x', PI / 2), mat4Rotation('z', PI / 2));
    case 'east':
      return mat4Chain(mat4Rotation('x', PI / 2), mat4Rotation('z', -PI / 2));
  }
}

function shulkerTransform(d: Dir): Mat4 {
  return mat4Chain(mat4Translation(0.5, 0.5, 0.5), mat4Scale(0.9995, 0.9995, 0.9995), directionRotation(d), mat4Scale(1, -1, -1), mat4Translation(0, -1, 0));
}

function bannerTransform(angle: number): Mat4 {
  return mat4Chain(mat4Translation(0.5, 0, 0.5), mat4Rotation('y', deg(-angle)), mat4Scale(2 / 3, -2 / 3, -2 / 3));
}

function skullGroundTransform(rotation: number): Mat4 {
  return mat4Chain(mat4Translation(0.5, 0, 0.5), mat4Rotation('y', deg(-rotation * 22.5)), mat4Scale(-1, -1, 1));
}

function skullWallTransform(facing: Horizontal): Mat4 {
  const s = STEP[facing];
  return mat4Chain(mat4Translation(0.5 - s[0] * 0.25, 0.25, 0.5 - s[2] * 0.25), mat4Rotation('y', deg(-yRotOf(opposite(facing)))), mat4Scale(-1, -1, 1));
}

function potTransform(facing: Horizontal): Mat4 {
  return mat4RotateAround('y', deg(180 - yRotOf(facing)), 0.5, 0.5, 0.5);
}

function golemTransform(facing: Horizontal): Mat4 {
  return mat4Chain(mat4Translation(0.5, 0, 0.5), mat4Rotation('y', deg(-yRotOf(opposite(facing)))));
}

function signTransform(angle: number, wall: boolean): Mat4 {
  const base = mat4Chain(mat4Translation(0.5, 0.5, 0.5), mat4Rotation('y', deg(-angle)));
  return mat4Chain(base, wall ? mat4Translation(0, -0.3125, -0.4375) : MAT4_IDENTITY, mat4Scale(2 / 3, -2 / 3, -2 / 3));
}

function hangingSignTransform(angle: number): Mat4 {
  return mat4Chain(mat4Translation(0.5, 0.9375, 0.5), mat4Rotation('y', deg(-angle)), mat4Translation(0, -0.3125, 0), mat4Scale(1, -1, -1));
}

function bedTransform(facing: Horizontal): Mat4 {
  return mat4Chain(mat4Translation(0, 0.5625, 0), mat4Rotation('x', PI / 2), mat4RotateAround('z', deg(180 + yRotOf(facing)), 0.5, 0.5, 0.5));
}

/** Bedrock's bed lies along its facing: mattress on top, legs below, head one block ahead of the foot. */
function bedrockBedTransform(facing: Horizontal): Mat4 {
  const north: Mat4 = [-1, 0, 0, 1, 0, 0, -1, 9 / 16, 0, -1, 0, 1];
  return mat4Chain(mat4RotateAround('y', deg(180 - yRotOf(facing)), 0.5, 0, 0.5), north, mat4Scale(-1, -1, 1));
}

// ---------------------------------------------------------------------------------------------
// Families

export interface EntityTextureSource {
  edition: 'java' | 'bedrock';
  /** Pack path of the first texture that exists (paths relative to the textures folder, no extension) */
  find(...rels: string[]): string | null;
  /** Pack path a texture would have (for listing a missing one) */
  path(rel: string): string;
}

export interface EntityProperty {
  name: string;
  values: string[];
}

export interface EntityBlock {
  /** 'replace': drawn instead of the block model (the game never draws it); 'add': drawn with it */
  mode: 'replace' | 'add';
  /** Later versions draw it with a block model instead (signs and beds from 26.2) */
  becameBlockModel?: boolean;
  properties: EntityProperty[];
  defaults: BlockState;
  quads(state: BlockState): BakedQuad[];
  note: string;
}

const NOTE = 'The game draws this block with its own model code. Shown with the same shapes and the texture sheet mapped the way the game maps it.';

function prop(name: string, values: string[]): EntityProperty {
  return { name, values };
}

interface Tex {
  path: string;
  role: string;
  tint?: Tint | null;
}

function bake(model: EntityModel, m: Mat4, t: Tex, extra: { texSize?: [number, number]; pose?: (p: string, pose: EntityPose | undefined) => EntityPose | undefined; part?: number } = {}): BakedQuad[] {
  return bakeEntityModel(model, m, { texture: t.path, role: t.role, tint: t.tint ?? null, texSize: extra.texSize, pose: extra.pose, part: extra.part });
}

function texOr(src: EntityTextureSource, ...rels: string[]): string {
  return src.find(...rels) ?? src.path(rels[0]);
}

// ---- chests

const CHEST_ID = /^(?:(trapped_)?chest|ender_chest|(?:waxed_)?(exposed_|weathered_|oxidized_)?copper_chest)$/;

function chestTextureBase(id: string, src: EntityTextureSource): string {
  const m = /^(?:waxed_)?(exposed_|weathered_|oxidized_)?copper_chest$/.exec(id);
  if (src.edition === 'bedrock') {
    if (id === 'ender_chest') return 'ender';
    if (id === 'trapped_chest') return 'trapped';
    if (m) return `copper_${m[1] ? m[1].slice(0, -1) : 'default'}`;
    return 'normal';
  }
  if (id === 'ender_chest') return 'ender';
  if (id === 'trapped_chest') return 'trapped';
  if (m) return `copper${m[1] ? `_${m[1].slice(0, -1)}` : ''}`;
  return 'normal';
}

function chestBlock(id: string, src: EntityTextureSource, hasTypeProperty: boolean): EntityBlock {
  const base = chestTextureBase(id, src);
  const ender = id === 'ender_chest';
  const legacy = src.edition === 'bedrock' || !!src.find('entity/chest/normal_double') || !src.find('entity/chest/normal_left');
  const properties: EntityProperty[] = [prop('facing', HORIZONTAL)];
  // Up to 1.12 and on Bedrock the double chest is two neighbouring blocks: offer it as a type.
  if (!ender) properties.push(prop('type', hasTypeProperty ? ['single', 'left', 'right'] : ['single', 'double']));
  const defaults: BlockState = { facing: 'north', ...(ender ? {} : { type: 'single' }) };
  const doubleName = src.edition === 'bedrock' ? (base === 'normal' ? 'double_normal' : `${base}_double`) : `${base}_double`;
  return {
    mode: 'replace',
    properties,
    defaults,
    note: NOTE,
    quads(state) {
      const facing = horizontal(state.facing);
      const type = ender ? 'single' : (state.type ?? 'single');
      if (legacy) {
        if (type === 'single') return bake(CHEST_LEGACY, legacyChestTransform(facing), { path: texOr(src, `entity/chest/${base}`), role: 'chest' });
        // The double chest is drawn once, from its right half, reaching over the left one.
        const at: Vec3 = type === 'left' ? STEP[clockwise(facing)] : [0, 0, 0];
        return offsetQuads(bake(CHEST_LEGACY_DOUBLE, legacyChestTransform(facing), { path: texOr(src, `entity/chest/${doubleName}`), role: 'chest_double' }), at);
      }
      if (type === 'single') return bake(CHEST_SINGLE, chestTransform(facing), { path: texOr(src, `entity/chest/${base}`), role: 'chest' });
      const tex = (half: 'left' | 'right') => ({ path: texOr(src, `entity/chest/${base}_${half}`), role: `chest_${half}` });
      const left = type === 'left' ? [0, 0, 0] : STEP[counterClockwise(facing)];
      const right = type === 'right' ? [0, 0, 0] : STEP[clockwise(facing)];
      return [
        ...offsetQuads(bake(CHEST_LEFT, chestTransform(facing), tex('left'), { part: 0 }), left as Vec3),
        ...offsetQuads(bake(CHEST_RIGHT, chestTransform(facing), tex('right'), { part: 1 }), right as Vec3),
      ];
    },
  };
}

// ---- shulker boxes

function shulkerBlock(color: string | null, src: EntityTextureSource, withColor: boolean): EntityBlock {
  const texFor = (c: string | null) => {
    if (src.edition === 'bedrock') {
      if (!c) return texOr(src, 'entity/shulker/shulker_undyed');
      return texOr(src, `entity/shulker/shulker_${c === 'light_gray' ? 'silver' : c}`);
    }
    if (!c) return texOr(src, 'entity/shulker/shulker', 'entity/shulker/shulker_purple');
    return texOr(src, `entity/shulker/shulker_${c}`, `entity/shulker/shulker_${c === 'light_gray' ? 'silver' : c}`);
  };
  const properties = [prop('facing', ['up', 'down', 'north', 'south', 'west', 'east'])];
  if (withColor) properties.push(prop('color', [...DYE_COLORS]));
  return {
    mode: 'replace',
    properties,
    defaults: { facing: 'up', ...(withColor ? { color: color ?? 'white' } : {}) },
    note: NOTE,
    quads(state) {
      const d = (DIRS as readonly string[]).includes(state.facing ?? '') ? (state.facing as Dir) : 'up';
      const c = withColor ? (state.color ?? color) : color;
      return bake(SHULKER_BOX, shulkerTransform(d), { path: texFor(c), role: 'shulker_box' });
    },
  };
}

// ---- banners

function bannerBlock(color: DyeColor | null, wall: boolean, src: EntityTextureSource): EntityBlock {
  const properties = [wall ? prop('facing', HORIZONTAL) : prop('rotation', ROTATIONS)];
  if (!color) properties.push(prop('color', [...DYE_COLORS]));
  const baseTex = src.edition === 'bedrock' ? texOr(src, 'entity/banner/banner_base') : texOr(src, 'entity/banner/banner_base', 'entity/banner_base');
  const maskTex = src.edition === 'bedrock' ? null : texOr(src, 'entity/banner/base');
  return {
    mode: 'replace',
    properties,
    defaults: { ...(wall ? { facing: 'north' } : { rotation: '8' }), ...(color ? {} : { color: 'white' }) },
    note: `${NOTE} The flag takes the colour of its dye${src.edition === 'java' ? ' through the colour mask' : ''}.`,
    quads(state) {
      const c: DyeColor = color ?? (isDye(state.color ?? '') ? (state.color as DyeColor) : 'white');
      const angle = wall ? yRotOf(horizontal(state.facing)) : Number(state.rotation ?? 0) * 22.5;
      const m = bannerTransform(angle);
      const tint: Tint = { kind: 'fixed', rgb: DYE_RGB[c] };
      const pole = bake(wall ? BANNER_WALL : BANNER_STANDING, m, { path: baseTex, role: 'banner' });
      const flagModel = wall ? BANNER_FLAG_WALL : BANNER_FLAG_STANDING;
      if (!maskTex) return [...pole, ...bake(flagModel, m, { path: baseTex, role: 'banner', tint }, { part: 1 })];
      return [...pole, ...bake(flagModel, m, { path: baseTex, role: 'banner' }, { part: 1 }), ...bake(flagModel, m, { path: maskTex, role: 'banner_color', tint }, { part: 2 })];
    },
  };
}

// ---- heads

export type SkullType = 'skeleton' | 'wither_skeleton' | 'zombie' | 'creeper' | 'player' | 'dragon' | 'piglin';
export const SKULL_TYPES: SkullType[] = ['skeleton', 'wither_skeleton', 'zombie', 'player', 'creeper', 'dragon', 'piglin'];

function skullModel(type: SkullType, src: EntityTextureSource): { model: EntityModel; tex: string; pose?: (p: string, pose: EntityPose | undefined) => EntityPose | undefined } {
  const bedrock = src.edition === 'bedrock';
  switch (type) {
    case 'skeleton':
      return { model: HEAD_MOB, tex: bedrock ? texOr(src, 'entity/skulls/skeleton') : texOr(src, 'entity/skeleton/skeleton') };
    case 'wither_skeleton':
      return { model: HEAD_MOB, tex: bedrock ? texOr(src, 'entity/skulls/wither_skeleton') : texOr(src, 'entity/skeleton/wither_skeleton') };
    case 'creeper':
      return { model: HEAD_MOB, tex: bedrock ? texOr(src, 'entity/skulls/creeper') : texOr(src, 'entity/creeper/creeper') };
    case 'zombie':
      return bedrock ? { model: HEAD_MOB, tex: texOr(src, 'entity/skulls/zombie') } : { model: HEAD_HUMANOID, tex: texOr(src, 'entity/zombie/zombie') };
    case 'player':
      return bedrock ? { model: HEAD_PLAYER_PLAIN, tex: texOr(src, 'entity/steve') } : { model: HEAD_HUMANOID, tex: texOr(src, 'entity/player/wide/steve', 'entity/steve') };
    case 'dragon':
      return {
        model: HEAD_DRAGON,
        tex: bedrock ? texOr(src, 'entity/dragon/dragon') : texOr(src, 'entity/enderdragon/dragon'),
        // Bedrock keeps the jaw shut.
        pose: bedrock ? (p, pose) => (p === 'head/jaw' ? { ...pose, rotation: [0, 0, 0] } : pose) : undefined,
      };
    case 'piglin':
      return { model: HEAD_PIGLIN, tex: texOr(src, 'entity/piglin/piglin') };
  }
}

function skullBlock(fixed: SkullType | null, attach: 'floor' | 'wall' | 'any', src: EntityTextureSource): EntityBlock {
  const properties: EntityProperty[] = [];
  if (!fixed) properties.push(prop('type', SKULL_TYPES.filter((t) => (t === 'piglin' ? !!src.find('entity/piglin/piglin') : t === 'dragon' ? !!src.find('entity/enderdragon/dragon', 'entity/dragon/dragon') : true))));
  if (attach === 'any') properties.push(prop('facing', ['up', ...HORIZONTAL]));
  if (attach !== 'wall') properties.push(prop('rotation', ROTATIONS));
  if (attach === 'wall') properties.push(prop('facing', HORIZONTAL));
  const defaults: BlockState = {};
  if (!fixed) defaults.type = 'skeleton';
  if (attach === 'any') defaults.facing = 'up';
  if (attach !== 'wall') defaults.rotation = '0';
  if (attach === 'wall') defaults.facing = 'north';
  return {
    mode: 'replace',
    properties,
    defaults,
    note: NOTE,
    quads(state) {
      const type = fixed ?? ((SKULL_TYPES as string[]).includes(state.type ?? '') ? (state.type as SkullType) : 'skeleton');
      const { model, tex, pose } = skullModel(type, src);
      const onWall = attach === 'wall' || (attach === 'any' && state.facing && state.facing !== 'up');
      const m = onWall ? skullWallTransform(horizontal(state.facing)) : skullGroundTransform(Number(state.rotation ?? 0));
      return bake(model, m, { path: tex, role: 'head' }, { pose });
    },
  };
}

// ---- small single-model blocks

function potBlock(src: EntityTextureSource): EntityBlock {
  const base = src.edition === 'bedrock' ? texOr(src, 'blocks/decorated_pot_base') : texOr(src, 'entity/decorated_pot/decorated_pot_base');
  const side = src.edition === 'bedrock' ? texOr(src, 'blocks/decorated_pot_side') : texOr(src, 'entity/decorated_pot/decorated_pot_side');
  return {
    mode: 'replace',
    properties: [prop('facing', HORIZONTAL)],
    defaults: { facing: 'north' },
    note: NOTE,
    quads(state) {
      const m = potTransform(horizontal(state.facing));
      return [...bake(POT_BASE, m, { path: base, role: 'pot_base' }), ...bake(POT_SIDES, m, { path: side, role: 'pot_side' }, { part: 1 })];
    },
  };
}

function conduitBlock(src: EntityTextureSource): EntityBlock {
  const tex = src.edition === 'bedrock' ? texOr(src, 'blocks/conduit_base') : texOr(src, 'entity/conduit/base');
  // Bedrock's shell texture is cut to the box (24x12) instead of 32x16.
  const texSize: [number, number] | undefined = src.edition === 'bedrock' ? [24, 12] : undefined;
  return {
    mode: 'replace',
    properties: [],
    defaults: {},
    note: `${NOTE} Shown as an inactive conduit (the shell).`,
    quads: () => bake(CONDUIT_SHELL, mat4Translation(0.5, 0.5, 0.5), { path: tex, role: 'conduit_shell' }, { texSize }),
  };
}

function bellBlock(src: EntityTextureSource): EntityBlock {
  const tex = src.edition === 'bedrock' ? texOr(src, 'entity/bell/bell') : texOr(src, 'entity/bell/bell_body');
  return {
    mode: 'add',
    properties: [],
    defaults: {},
    note: 'The frame is a block model; the game draws the bell itself with its own model code.',
    quads: () => bake(BELL_BODY, MAT4_IDENTITY, { path: tex, role: 'bell_body' }, { part: 90 }),
  };
}

function bookTexture(src: EntityTextureSource): string {
  return texOr(src, 'entity/enchantment/enchanting_table_book', 'entity/enchanting_table_book');
}

function enchantingTableBlock(src: EntityTextureSource): EntityBlock {
  const tex = bookTexture(src);
  // The book turns to the nearest player and opens: shown open, facing the default camera (north-east).
  const yRot = Math.atan2(-1, 1);
  const open = 1.25;
  return {
    mode: 'add',
    properties: [],
    defaults: {},
    note: 'The table is a block model; the game draws the floating book with its own model code (shown open, as when a player is near).',
    quads: () =>
      bake(BOOK, mat4Chain(mat4Translation(0.5, 0.85, 0.5), mat4Rotation('y', -yRot), mat4Rotation('z', deg(80))), { path: tex, role: 'book' }, { pose: bookPose(open, 0.1, 0.9), part: 90 }),
  };
}

function lecternBlock(src: EntityTextureSource): EntityBlock {
  const tex = bookTexture(src);
  return {
    mode: 'add',
    properties: [prop('has_book', ['false', 'true'])],
    defaults: { has_book: 'true' },
    note: 'The lectern is a block model; the game draws the book on it with its own model code.',
    quads(state) {
      if (state.has_book === 'false') return [];
      const facing = horizontal(state.facing);
      const m = mat4Chain(mat4Translation(0.5, 1.0625, 0.5), mat4Rotation('y', deg(-yRotOf(clockwise(facing)))), mat4Rotation('z', deg(67.5)), mat4Translation(0, -0.125, 0));
      return bake(BOOK, m, { path: tex, role: 'book' }, { pose: bookPose(1.5, 0.1, 0.9), part: 90 });
    },
  };
}

const GOLEM_ID = /^(?:waxed_)?(exposed_|weathered_|oxidized_)?copper_golem_statue$/;

function golemStatueBlock(id: string, src: EntityTextureSource): EntityBlock {
  const m = GOLEM_ID.exec(id);
  const stage = m?.[1] ? `_${m[1].slice(0, -1)}` : '';
  const tex = texOr(src, `entity/copper_golem/copper_golem${stage}`);
  return {
    mode: 'replace',
    properties: [prop('copper_golem_pose', ['standing', 'sitting', 'running', 'star']), prop('facing', HORIZONTAL)],
    defaults: { copper_golem_pose: 'standing', facing: 'north' },
    note: NOTE,
    quads(state) {
      const pose = (['standing', 'sitting', 'running', 'star'] as const).find((p) => p === state.copper_golem_pose) ?? 'standing';
      return bake(GOLEM_STATUE[pose], golemTransform(horizontal(state.facing)), { path: tex, role: 'statue' });
    },
  };
}

function portalBlock(gateway: boolean, src: EntityTextureSource): EntityBlock {
  const tex = texOr(src, 'entity/end_portal/end_portal', 'entity/end_portal');
  const face = { texture: tex, ref: tex, role: 'end_portal', uv: [0, 0, 16, 16] as [number, number, number, number] };
  return {
    mode: 'replace',
    properties: [],
    defaults: {},
    note: `The game draws ${gateway ? 'the gateway' : 'the portal'} with a moving starfield effect made from this texture; shown here with the texture on its ${gateway ? 'faces' : 'top and bottom faces'}.`,
    quads: () =>
      gateway
        ? boxQuads([0, 0, 0], [16, 16, 16], { up: face, down: face, north: face, south: face, east: face, west: face })
        : boxQuads([0, 6, 0], [16, 12, 16], { up: face, down: face }),
  };
}

// ---- signs, hanging signs, beds (entity-drawn before 26.2; Bedrock always)

const BEDROCK_SIGN_WOOD: Record<string, string> = { oak: 'sign', dark_oak: 'sign_darkoak', spruce: 'sign_spruce', birch: 'sign_birch', jungle: 'sign_jungle', acacia: 'sign_acacia', crimson: 'sign_crimson', warped: 'sign_warped' };

function signTexture(wood: string, src: EntityTextureSource): string {
  if (src.edition === 'bedrock') {
    const legacy = BEDROCK_SIGN_WOOD[wood];
    return legacy ? texOr(src, `entity/${legacy}`, `entity/${wood}_sign`) : texOr(src, `entity/${wood}_sign`, 'entity/sign');
  }
  return texOr(src, `entity/signs/${wood}`, 'entity/sign');
}

function signBlock(wood: string, wall: boolean, src: EntityTextureSource): EntityBlock {
  const tex = signTexture(wood, src);
  return {
    mode: 'replace',
    becameBlockModel: true,
    properties: [wall ? prop('facing', HORIZONTAL) : prop('rotation', ROTATIONS)],
    defaults: wall ? { facing: 'north' } : { rotation: '8' },
    note: NOTE,
    quads(state) {
      const angle = wall ? yRotOf(horizontal(state.facing)) : Number(state.rotation ?? 0) * 22.5;
      return bake(wall ? SIGN_WALL : SIGN_STANDING, signTransform(angle, wall), { path: tex, role: 'sign' });
    },
  };
}

function hangingSignBlock(wood: string, wall: boolean | 'either', src: EntityTextureSource): EntityBlock {
  const tex = src.edition === 'bedrock' ? texOr(src, `entity/${wood}_hanging_sign`) : texOr(src, `entity/signs/hanging/${wood}`);
  const properties: EntityProperty[] = [];
  if (wall === 'either') properties.push(prop('hanging', ['true', 'false']));
  if (wall !== true) properties.push(prop('rotation', ROTATIONS), prop('attached', ['false', 'true']));
  if (wall !== false) properties.push(prop('facing', HORIZONTAL));
  const defaults: BlockState = {};
  if (wall === 'either') defaults.hanging = 'true';
  if (wall !== true) Object.assign(defaults, { rotation: '8', attached: 'false' });
  if (wall !== false) defaults.facing = 'north';
  return {
    mode: 'replace',
    becameBlockModel: true,
    properties,
    defaults,
    note: NOTE,
    quads(state) {
      const onWall = wall === true || (wall === 'either' && state.hanging === 'false');
      const angle = onWall ? yRotOf(horizontal(state.facing)) : Number(state.rotation ?? 0) * 22.5;
      const model = onWall ? HANGING_SIGN.wall : state.attached === 'true' ? HANGING_SIGN.ceiling_middle : HANGING_SIGN.ceiling;
      return bake(model, hangingSignTransform(angle), { path: tex, role: 'hanging_sign' });
    },
  };
}

function bedTexture(color: string, src: EntityTextureSource): string {
  const legacy = color === 'light_gray' ? 'silver' : color;
  return src.edition === 'bedrock' ? texOr(src, `entity/bed/${legacy}`) : texOr(src, `entity/bed/${color}`, `entity/bed/${legacy}`);
}

function bedBlock(color: string | null, src: EntityTextureSource): EntityBlock {
  const properties = [prop('facing', HORIZONTAL)];
  if (!color) properties.push(prop('color', [...DYE_COLORS]));
  return {
    mode: 'replace',
    becameBlockModel: true,
    properties,
    defaults: { facing: 'north', ...(color ? {} : { color: 'red' }) },
    note: `${NOTE} Both halves are shown together.`,
    quads(state) {
      const facing = horizontal(state.facing);
      const tex = { path: bedTexture(color ?? state.color ?? 'red', src), role: 'bed' };
      if (src.edition === 'bedrock') return bake(BED_BEDROCK, bedrockBedTransform(facing), tex);
      const m = bedTransform(facing);
      return [...bake(BED_FOOT, m, tex), ...offsetQuads(bake(BED_HEAD, m, tex, { part: 1 }), STEP[facing])];
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Java

export interface JavaEntityContext {
  src: EntityTextureSource;
  /** The block's blockstate file distinguishes the chest type (1.13+) */
  hasProperty(name: string): boolean;
  /** Before 1.13 (ids like standing_banner, skull, bed without colours) */
  legacy: boolean;
}

/**
 * The entity-drawn part of a Java block, or null. Chests, banners, heads... replace their empty block
 * model; bells, enchanting tables and lecterns add to their block model.
 */
export function javaEntityBlock(id: string, ctx: JavaEntityContext): EntityBlock | null {
  const { src } = ctx;
  let m: RegExpExecArray | null;
  if (CHEST_ID.test(id)) return chestBlock(id, src, ctx.hasProperty('type') || !ctx.legacy);
  if (id === 'shulker_box') return shulkerBlock(null, src, false);
  if ((m = /^(\w+)_shulker_box$/.exec(id))) {
    const c = m[1] === 'silver' ? 'light_gray' : m[1];
    if (isDye(c)) return shulkerBlock(c, src, false);
  }
  if ((m = /^(\w+?)_(wall_)?banner$/.exec(id)) && isDye(m[1])) return bannerBlock(m[1], !!m[2], src);
  if (id === 'standing_banner' || id === 'wall_banner') return bannerBlock(null, id === 'wall_banner', src);
  if ((m = /^(skeleton|wither_skeleton)_(wall_)?skull$/.exec(id))) return skullBlock(m[1] as SkullType, m[2] ? 'wall' : 'floor', src);
  if ((m = /^(zombie|creeper|player|dragon|piglin)_(wall_)?head$/.exec(id))) return skullBlock(m[1] as SkullType, m[2] ? 'wall' : 'floor', src);
  if (id === 'skull') return skullBlock(null, 'any', src);
  if (id === 'decorated_pot') return potBlock(src);
  if (id === 'conduit') return conduitBlock(src);
  if (id === 'bell') return bellBlock(src);
  if (id === 'enchanting_table') return enchantingTableBlock(src);
  if (id === 'lectern') return lecternBlock(src);
  if (GOLEM_ID.test(id)) return golemStatueBlock(id, src);
  if (id === 'end_portal' || id === 'end_gateway') return portalBlock(id === 'end_gateway', src);
  if (id === 'sign' || id === 'standing_sign' || id === 'wall_sign') return signBlock('oak', id === 'wall_sign', src);
  if ((m = /^(\w+?)_(wall_)?hanging_sign$/.exec(id))) return hangingSignBlock(m[1], !!m[2], src);
  if ((m = /^(\w+?)_(wall_)?sign$/.exec(id))) return signBlock(m[1], !!m[2], src);
  if ((m = /^(\w+?)_bed$/.exec(id)) && isDye(m[1])) return bedBlock(m[1], src);
  if (id === 'bed') return bedBlock(null, src);
  return null;
}

/** Entity model of a Java special item (item definition 'special' models and pre-1.21.4 builtin/entity items). */
export function javaEntityItem(type: string, props: Record<string, unknown>, itemId: string, src: EntityTextureSource): BakedQuad[] | null {
  const name = (v: unknown) => (typeof v === 'string' ? v.replace(/^minecraft:/, '') : '');
  switch (type) {
    case 'chest': {
      const t = name(props.texture) || 'normal';
      return bake(CHEST_SINGLE, chestTransform('south'), { path: texOr(src, `entity/chest/${t}`), role: 'chest' });
    }
    case 'shulker_box': {
      const t = name(props.texture) || 'shulker';
      const orientation = (DIRS as readonly string[]).includes(name(props.orientation)) ? (name(props.orientation) as Dir) : 'up';
      return bake(SHULKER_BOX, shulkerTransform(orientation), { path: texOr(src, `entity/shulker/${t}`), role: 'shulker_box' });
    }
    case 'shield':
      return bake(SHIELD, mat4Scale(1, -1, -1), { path: texOr(src, 'entity/shield/shield_base_nopattern', 'entity/shield_base_nopattern'), role: 'shield' });
    case 'trident':
      return bake(TRIDENT, mat4Scale(1, -1, -1), { path: texOr(src, 'entity/trident/trident', 'entity/trident'), role: 'trident' });
    case 'bed': {
      const t = name(props.texture) || 'red';
      const m = bedTransform('south');
      const tex = { path: texOr(src, `entity/bed/${t}`), role: 'bed' };
      return /head/.test(name(props.part)) || itemId.endsWith('_head') ? bake(BED_HEAD, m, tex) : [...bake(BED_FOOT, m, tex), ...offsetQuads(bake(BED_HEAD, m, tex, { part: 1 }), [0, 0, 1])];
    }
    case 'standing_sign':
    case 'hanging_sign': {
      const wood = name(props.wood_type) || 'oak';
      return type === 'standing_sign' ? signBlock(wood, false, src).quads({ rotation: '0' }) : hangingSignBlock(wood, false, src).quads({ rotation: '0', attached: 'false' });
    }
    case 'head':
    case 'player_head': {
      const kind = type === 'player_head' ? 'player' : name(props.kind) || 'skeleton';
      if (!(SKULL_TYPES as string[]).includes(kind)) return null;
      const { model, tex } = skullModel(kind as SkullType, src);
      return bake(model, skullGroundTransform(8), { path: tex, role: 'head' });
    }
    case 'banner': {
      const c = name(props.color);
      return bannerBlock(isDye(c) ? c : 'white', false, src).quads({ rotation: '0' });
    }
    case 'decorated_pot':
      return potBlock(src).quads({ facing: 'south' });
    case 'conduit':
      return conduitBlock(src).quads({});
    case 'copper_golem_statue': {
      const pose = name(props.pose) || 'standing';
      const t = name(props.texture);
      const q = golemStatueBlock('copper_golem_statue', src).quads({ copper_golem_pose: pose, facing: 'south' });
      if (!t) return q;
      const path = texOr(src, t.replace(/^textures\//, '').replace(/\.png$/, ''));
      return q.map((x) => ({ ...x, texture: path, ref: path }));
    }
    case 'bell':
      return bellBlock(src).quads({});
  }
  return null;
}

/** The block a pre-1.21.4 item drawn by the game stands for (chest item -> chest block...), with its item state. */
export function legacyEntityItemBlock(itemId: string): { block: string; state: BlockState } | null {
  if (CHEST_ID.test(itemId)) return { block: itemId, state: { facing: 'south', type: 'single' } };
  if (/_shulker_box$|^shulker_box$/.test(itemId)) return { block: itemId, state: { facing: 'up' } };
  if (/^\w+_banner$/.test(itemId) && !/_wall_/.test(itemId)) return { block: itemId, state: { rotation: '0' } };
  if (itemId === 'banner') return { block: 'standing_banner', state: { rotation: '0', color: 'white' } };
  if (/^(skeleton|wither_skeleton)_skull$|^(zombie|creeper|player|dragon|piglin)_head$/.test(itemId)) return { block: itemId, state: { rotation: '8' } };
  if (itemId === 'skull') return { block: 'skull', state: { type: 'skeleton', facing: 'up', rotation: '8' } };
  if (/^\w+_bed$/.test(itemId)) return { block: itemId, state: { facing: 'south' } };
  if (itemId === 'bed') return { block: 'bed', state: { facing: 'south', color: 'red' } };
  if (itemId === 'decorated_pot' || itemId === 'conduit') return { block: itemId, state: { facing: 'south' } };
  if (/^\w+_sign$/.test(itemId) && !/_wall_/.test(itemId)) return { block: itemId, state: /hanging/.test(itemId) ? { rotation: '0', attached: 'false' } : { rotation: '0' } };
  if (itemId === 'sign') return { block: 'standing_sign', state: { rotation: '0' } };
  return null;
}

// ---------------------------------------------------------------------------------------------
// Bedrock

/**
 * The entity-drawn part of a Bedrock block, or null. Bedrock keeps these as block entities with
 * textures under textures/entity (and a few under textures/blocks).
 */
export function bedrockEntityBlock(id: string, src: EntityTextureSource): EntityBlock | null {
  let m: RegExpExecArray | null;
  if (CHEST_ID.test(id)) return chestBlock(id, src, false);
  if (id === 'undyed_shulker_box') return shulkerBlock(null, src, false);
  if (id === 'shulker_box') return shulkerBlock('white', src, true);
  if ((m = /^(\w+)_shulker_box$/.exec(id)) && isDye(m[1])) return shulkerBlock(m[1], src, false);
  if (id === 'standing_banner' || id === 'wall_banner') return bannerBlock(null, id === 'wall_banner', src);
  if (id === 'skull') return skullBlock(null, 'any', src);
  if ((m = /^(skeleton|wither_skeleton)_skull$/.exec(id))) return skullBlock(m[1] as SkullType, 'any', src);
  if ((m = /^(zombie|creeper|player|dragon|piglin)_head$/.exec(id))) return skullBlock(m[1] as SkullType, 'any', src);
  if (id === 'decorated_pot') return potBlock(src);
  if (id === 'conduit') return conduitBlock(src);
  if (id === 'bell') return bellBlock(src);
  if (id === 'enchanting_table') return enchantingTableBlock(src);
  if (id === 'lectern') return lecternBlock(src);
  if (GOLEM_ID.test(id)) return golemStatueBlock(id, src);
  if (id === 'end_portal' || id === 'end_gateway') return portalBlock(id === 'end_gateway', src);
  if (id === 'bed') return bedBlock(null, src);
  if ((m = /^(\w+?)_hanging_sign$/.exec(id))) return hangingSignBlock(m[1], 'either', src);
  if (id === 'standing_sign' || id === 'wall_sign') return signBlock('oak', id === 'wall_sign', src);
  if ((m = /^(\w+?)_(standing|wall)_sign$/.exec(id))) return signBlock(m[1] === 'darkoak' ? 'dark_oak' : m[1], m[2] === 'wall', src);
  return null;
}
