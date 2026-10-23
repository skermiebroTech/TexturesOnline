// English text of the animation maker of the texture pack editor: the frames strip's buttons and
// menu, the timing, import and GIF windows (../strip.ts, ../dialogs.ts) and the texture menu's
// entries. Loaded with the editor. Translations: ./<lang>.ts, loaded by ./load.ts.

import { defineText } from '../../../../i18n/editor-text';

export const ta = defineText('textures.anim', {
  /** Entries of the texture's ⋮ menu */
  menu: {
    make: 'Make animated',
    import: 'Import GIF or frames…',
  },
  /** {count}: frames of the new animation */
  made: '{count, plural, one {Animated with # frame.} other {Animated with # frames.}} Paint each one, and add more with +.',
  /** Why a texture can't be animated */
  cant: {
    title: 'This texture can’t be animated',
    icon: 'The pack icon can’t be animated.',
    javaNoAtlas: 'Java Edition only animates blocks, items and the other textures it gathers on a texture atlas (particles, paintings, chests, banners, GUI sprites in 1.20.2 and newer…). The game draws this one on its own, so it would stay still.',
    javaSquare: 'Minecraft before 1.13 only animates square frames. Choose 1.13 or newer in the Pack tab to animate this texture.',
    bedrockItem: 'Bedrock Edition can’t animate items: only block textures have flipbook animations. Java Edition packs can animate items.',
    bedrockUnused: 'Bedrock only animates textures that blocks use (terrain_texture.json), and no block uses this one.',
    bedrockOther: 'Bedrock Edition only animates block textures (flipbook textures).',
    bedrockSquare: 'Bedrock animations are made of square frames, and this texture isn’t square.',
  },
  /** The frames strip under the canvas */
  strip: {
    add: 'Add frame',
    addHint: 'Add a frame: a copy of this one',
    onion: 'Onion skin',
    onionHint: 'Show the frame before this one faintly while you paint',
    timing: 'Timing',
    timingHint: 'Speed, frame times and blending',
    more: 'Frame actions',
    /** Tooltip of a frame (mouse) */
    frameDrag: 'Frame {n} · drag to move it',
    /** Badge on a frame with a time of its own */
    ownTime: '{ticks, plural, one {# tick} other {# ticks}}',
  },
  /** The strip's menu */
  actions: {
    empty: 'Add an empty frame',
    duplicate: 'Duplicate frame',
    copy: 'Copy frame',
    copyKey: 'Copy frame (Ctrl+C)',
    paste: 'Paste as a new frame',
    pasteKey: 'Paste as a new frame (Ctrl+V)',
    left: 'Move earlier',
    right: 'Move later',
    delete: 'Delete frame',
    deleteKey: 'Delete frame (Delete)',
    /** Onion skin entries (shown with the onion skin's icon): the next frame faintly too, or only the previous one */
    next: 'Onion skin: next frame too',
    nextOff: 'Onion skin: previous only',
    timing: 'Timing…',
    import: 'Import GIF or frames…',
    gif: 'Save as GIF…',
    still: 'Stop animating',
  },
  toasts: {
    copied: 'Frame {n} copied',
    nothingToPaste: 'Copy a frame first.',
    deleted: 'Frame {n} deleted',
    /** The last but one frame was deleted */
    stillNow: 'Frame {n} deleted. One frame is left, so the texture isn’t animated any more.',
    still: 'Not animated any more: frame {n} was kept.',
    imported: '{count, plural, one {# frame imported} other {# frames imported}}',
    /** {max}: the most frames an animation can have here */
    tooMany: 'Only the first {max} frames were kept.',
    timing: 'Timing changed',
  },
  timing: {
    title: 'Animation timing',
    ticksIntro: 'Minecraft counts time in ticks: 20 ticks make 1 second.',
    speed: 'Each frame shows for',
    /** Unit after the number field */
    ticks: '{count, plural, one {tick} other {ticks}}',
    /** {seconds}: e.g. "0.2"; {fps}: frames a second, e.g. "5" */
    perSecond: '= {seconds} s ({fps} frames a second)',
    /** A frame's time in seconds, e.g. "0.25 s" */
    secs: '{seconds} s',
    frames: 'Frame times',
    framesHint: 'Leave a frame empty to use the time above.',
    frame: 'Frame {n}',
    blend: 'Blend frames',
    blendHint: 'Fades each frame into the next, tick by tick, like flowing water. Best with slow frames.',
    blendOld: 'Minecraft before 1.8 can’t blend frames.',
    order: 'Play order',
    orderHint: 'Frame numbers in the order they play, e.g. 1, 2, 3, 2. A range plays several (1-8); add :ticks for a time of its own (3:40). Leave it empty to play every frame once, in order.',
    orderSyntax: '“{token}” isn’t a frame number.',
    orderRange: 'There is no frame {token}: the frames are 1 to {count}.',
    /** {seconds}: e.g. "1.6" */
    loop: 'One loop takes {seconds} s ({ticks, plural, one {# tick} other {# ticks}}).',
    bedrock: 'Bedrock plays every frame at one speed: a frame with a longer time is written as the same frame repeated.',
    preview: 'Preview at game speed',
    apply: 'Apply',
    cancel: 'Cancel',
  },
  import: {
    title: 'Import frames',
    drop: 'Drop a GIF, a sprite sheet or several pictures here, or click to choose',
    dropTouch: 'Tap to choose a GIF, a sprite sheet or several pictures',
    /** {size}: the frame size, e.g. "16 × 16" */
    dropHint: 'GIF, PNG, JPG or WebP. Frames are resized to {size} px, sharp.',
    reading: 'Reading…',
    /** {seconds}: e.g. "1.2" */
    found: '{count, plural, one {# frame} other {# frames}} · {seconds} s',
    count: '{count, plural, one {# frame} other {# frames}}',
    more: '+{count}',
    where: 'Frames',
    replace: 'Replace all frames',
    after: 'Add after frame {n}',
    timing: 'Timing',
    gifTiming: 'The GIF’s timing',
    keepTiming: 'The current speed',
    unreadable: 'That file couldn’t be read as a picture.',
    tooBig: 'That picture is too big ({size}).',
    choose: 'Choose other files',
    chooseFirst: 'Choose a file first.',
    apply: 'Import',
    cancel: 'Cancel',
  },
  gif: {
    title: 'Save as GIF',
    size: 'Size',
    /** {size}: e.g. "128 × 128" */
    sizePx: '{size} px',
    alphaNote: 'GIFs have no half-transparent pixels: those become solid or see-through.',
    blendNote: 'Blended frames are saved tick by tick, as the game shows them.',
    save: 'Save GIF',
    cancel: 'Cancel',
    failed: 'The GIF couldn’t be made.',
  },
});

export type AnimText = typeof ta;
