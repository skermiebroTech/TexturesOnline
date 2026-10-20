// English names and descriptions of the generators' settings, presets and notes as the editor
// shows them. The generators keep their own English tables (iris/options.ts, vanilla/options.ts,
// bedrock/options.ts and the notes), which also go into the exported packs; this section repeats
// them by key so the editor can show them translated (tests/unit/shaders-i18n.test.ts keeps both
// the same). Loaded with the generator (../generator.ts). Translations: ./<lang>.ts.

import { defineText } from '../../../../i18n/editor-text';

export const ot = defineText('shaders.options', {
  /** Units after a slider's value */
  units: { blocks: 'blocks', levels: 'levels' },
  iris: {
    groups: {
      lighting: 'Lighting',
      shadows: 'Shadows',
      sky: 'Sky & Fog',
      water: 'Water',
      waving: 'Waving',
      post: 'Post-processing',
      color: 'Color',
      performance: 'Performance',
    },
    options: {
      sunStrength: {
        label: 'Sunlight strength',
        description: 'How bright direct sunlight is. Shaded areas are not affected.',
      },
      sunColor: {
        label: 'Sunlight color',
        description: 'Color of sunlight during the day. Near sunrise and sunset it blends into the sunset color.',
      },
      ambientStrength: {
        label: 'Ambient light',
        description: 'Soft light from the sky that fills in shaded areas. Lower gives deeper, moodier shade.',
      },
      nightBrightness: {
        label: 'Night brightness',
        description: 'Moonlight and the lowest light level at night and in caves. 0 gives very dark nights.',
      },
      torchColor: {
        label: 'Torch light color',
        description: 'Color of the light from torches, lanterns, lava and other light sources.',
      },
      torchStrength: {
        label: 'Torch light strength',
        description: 'How bright light from torches and glowing blocks is, and how much the light sources themselves glow.',
      },
      handLight: {
        label: 'Handheld light',
        description: 'Holding a torch, lantern, glowstone or lava bucket lights up the area around you.',
      },
      shadows: {
        label: 'Shadows',
        description: 'Real shadows from the sun and moon. The biggest effect on frame rate: turn off on slow computers.',
      },
      shadowBrightness: {
        label: 'Shadow brightness',
        description: 'How much light still reaches shadowed spots. 0 gives deep, dark shadows.',
      },
      shadowSoftness: {
        label: 'Shadow softness',
        description: 'How blurry shadow edges are. 0 is sharp and crisp.',
      },
      sunAngle: {
        label: 'Sun path tilt',
        description: 'Tilts the path of the sun and moon so shadows fall at an angle, even at noon.',
      },
      cloudShadows: {
        label: 'Cloud shadows',
        description: 'Soft shadows of drifting clouds move across the landscape.',
      },
      skyColor: {
        label: 'Daytime sky',
        description: 'Color of the sky straight overhead during the day.',
      },
      horizonColor: {
        label: 'Horizon & haze',
        description: 'Color of the sky near the horizon and of distant fog during the day.',
      },
      sunsetColor: {
        label: 'Sunrise & sunset',
        description: 'Glow around the sun at dawn and dusk. Also tints sunlight while the sun is low.',
      },
      nightSkyColor: {
        label: 'Night sky',
        description: 'Color of the sky at night.',
      },
      customSky: {
        label: 'Custom sky amount',
        description: "Blend between Minecraft's own biome sky colors (0) and your colors above (1). Caves, the Nether and the End keep their own colors.",
      },
      fogDensity: {
        label: 'Fog density',
        description: 'Thickness of the haze in the distance. Fog is thicker near sea level and at sunrise.',
      },
      rainFog: {
        label: 'Rain fog',
        description: 'Extra fog while it rains or snows.',
      },
      waterColor: {
        label: 'Water color',
        description: 'Tint of water. Deeper water gets closer to this color.',
      },
      waterTransparency: {
        label: 'Water transparency',
        description: 'How far you can see into and under water. 1 is crystal clear.',
      },
      waterWaves: {
        label: 'Water waves',
        description: 'Animated waves and ripples on the water surface. Lily pads bob along.',
      },
      waveHeight: {
        label: 'Wave height',
        description: 'How tall the waves are.',
      },
      waveSpeed: {
        label: 'Wave speed',
        description: 'How fast the waves move.',
      },
      waterReflections: {
        label: 'Reflections',
        description: 'How much water reflects the sky and the sun, especially when you look across it.',
      },
      wavingLeaves: {
        label: 'Waving leaves',
        description: 'Tree leaves sway in the wind.',
      },
      wavingPlants: {
        label: 'Waving grass & flowers',
        description: 'Grass, ferns, flowers, saplings and seagrass sway in the wind.',
      },
      wavingCrops: {
        label: 'Waving crops',
        description: 'Wheat, carrots, potatoes and other crops sway in the wind.',
      },
      wavingVines: {
        label: 'Waving vines',
        description: 'Vines, cave vines, weeping vines and hanging roots move gently.',
      },
      wavingAmount: {
        label: 'Wind strength',
        description: 'How far plants sway. Wind is stronger while it rains.',
      },
      wavingSpeed: {
        label: 'Wind speed',
        description: 'How fast plants sway.',
      },
      tonemap: {
        label: 'Tone mapping',
        description: 'How bright light is squeezed onto your screen. Changes the overall film look of the pack.',
        choices: {
          aces: 'Cinematic (ACES)',
          filmic: 'Filmic (soft highlights)',
          reinhard: 'Soft (Reinhard)',
          none: 'None (plain)',
        },
      },
      exposure: {
        label: 'Exposure',
        description: 'Overall brightness, like a camera. +1 is twice as bright, -1 half as bright.',
      },
      bloomStrength: {
        label: 'Bloom',
        description: 'Soft glow around bright things like the sun, torches and lava. 0 turns bloom off.',
      },
      bloomThreshold: {
        label: 'Bloom threshold',
        description: 'How bright something must be before it glows. Lower makes more of the image glow.',
      },
      godrays: {
        label: 'God rays',
        description: 'Beams of light streaming from the sun through trees and around hills. 0 turns them off.',
      },
      vignette: {
        label: 'Vignette',
        description: 'Darkens the corners of the screen for a cinematic look.',
      },
      contrast: {
        label: 'Contrast',
        description: 'Difference between dark and bright parts of the image.',
      },
      saturation: {
        label: 'Saturation',
        description: 'How colorful everything is. 0 is black and white.',
      },
      vibrance: {
        label: 'Vibrance',
        description: 'Boosts dull colors while leaving already colorful ones alone. Gentler than saturation.',
      },
      temperature: {
        label: 'Temperature',
        description: 'Shifts the whole image cooler (blue, below 0) or warmer (orange, above 0).',
      },
      tint: {
        label: 'Tint',
        description: 'Shifts the whole image toward green (below 0) or magenta (above 0).',
      },
      gamma: {
        label: 'Gamma',
        description: 'Brightens (above 1) or darkens (below 1) the mid-tones while keeping black and white.',
      },
      shadowResolution: {
        label: 'Shadow resolution',
        description: 'Detail of the shadow map. Higher is sharper but slower.',
        choices: {
          '1024': '1024 (fast, blurry)',
          '2048': '2048 (balanced)',
          '3072': '3072 (sharp)',
          '4096': '4096 (very sharp)',
          '8192': '8192 (extreme, strong GPU only)',
        },
      },
      shadowDistance: {
        label: 'Shadow distance',
        description: 'How far away shadows are drawn. Shorter distances make nearby shadows sharper and run faster.',
      },
      effectQuality: {
        label: 'Effect quality',
        description: 'How many samples soft shadows and god rays use. Higher is smoother but slower.',
        choices: {
          low: 'Low',
          medium: 'Medium',
          high: 'High',
          ultra: 'Ultra',
        },
      },
    },
    presets: {
      default: { label: 'Default', description: 'Balanced soft shadows, clear blue skies, gentle bloom and waving plants. A great place to start.' },
      cinematic: { label: 'Cinematic', description: 'Filmic tone mapping, warm light, deep shadows, strong sun rays and a subtle vignette.' },
      vibrant: { label: 'Vibrant', description: 'Punchy colors, a deep blue sky, tropical water and bright sunshine.' },
      soft: { label: 'Soft & Dreamy', description: 'Gentle contrast, pastel skies, glowing haze and soft blurry shadows.' },
      noir: { label: 'Noir', description: 'Black and white film look with hard contrast, dark shadows, heavy mist and a strong vignette.' },
      fantasy: { label: 'Fantasy', description: 'Violet skies, pink sunsets, turquoise water, magical glowing lights and bright nights.' },
      golden: { label: 'Golden Hour', description: 'Warm, amber sunlight all day, glowing sunsets, long sun rays and honey-colored haze.' },
      performance: { label: 'Performance', description: 'For slower computers: no shadows, bloom or god rays. Keeps waving plants, water waves and color grading.' },
      ultra: { label: 'Ultra', description: 'For strong graphics cards: sharp long-distance shadows, cloud shadows, smooth god rays and rich bloom.' },
    },
    notes: {
      settings: { title: 'Changing settings later', text: 'Use Shader Options in game. Settings changed in game are kept for the same file name; press Reset there to use the defaults of a newly exported version.' },
      vulkan: { title: 'Minecraft 26.2 and newer', text: 'Shader packs need the OpenGL renderer: set Video Settings > Graphics API to "Default" or "Prefer OpenGL".' },
      performance: { title: 'Frame rate', text: 'Shadows cost the most. Use the Performance preset here, or the Low profile in game, on slower computers.' },
    },
  },
  vanilla: {
    groups: {
      color: 'Color & Tone',
      style: 'Style & Lens',
      foliage: 'Waving Plants',
      fog: 'Fog',
      lighting: 'Lighting',
    },
    options: {
      brightness: {
        label: 'Brightness',
        description: 'Makes the whole world brighter or darker. Menus and the hotbar are never changed.',
      },
      contrast: {
        label: 'Contrast',
        description: 'Difference between dark and bright areas. 1 is vanilla.',
      },
      saturation: {
        label: 'Saturation',
        description: 'How colorful everything is. 0 is black and white, 1 is vanilla.',
      },
      vibrance: {
        label: 'Vibrance',
        description: 'Boosts dull colors more than colors that are already strong, so skin tones and bright blocks stay natural.',
      },
      gamma: {
        label: 'Midtones (gamma)',
        description: 'Brightens (above 1) or darkens (below 1) the middle tones while keeping pure black and white.',
      },
      temperature: {
        label: 'Temperature',
        description: 'Shifts the colors warmer (orange, positive) or cooler (blue, negative).',
      },
      tintColor: {
        label: 'Tint color',
        description: 'A color the whole world is tinted with. Only its hue counts: a dark pick tints like its bright version, black and grey do nothing, and brightness stays about the same.',
      },
      tintStrength: {
        label: 'Tint strength',
        description: 'How strongly the tint color is applied. 0 turns the tint off.',
      },
      grayscale: {
        label: 'Black & white',
        description: 'Fades the colors out. 1 is fully black and white.',
      },
      sepia: {
        label: 'Sepia',
        description: 'Old photograph look with brown tones.',
      },
      posterize: {
        label: 'Posterize',
        description: 'Limits every color channel to this many shades for a retro, comic-like look. 0 or 1 turns it off.',
      },
      vignette: {
        label: 'Vignette',
        description: 'Darkens the corners of the screen to draw the eye to the center.',
      },
      bloom: {
        label: 'Bloom',
        description: 'Bright things like the sun, lava and glowstone softly glow. Needs Minecraft 26.3 or newer.',
      },
      bloomStrength: {
        label: 'Bloom strength',
        description: 'How bright the glow is.',
      },
      bloomThreshold: {
        label: 'Bloom threshold',
        description: 'How bright something must be before it glows. Lower values make more things glow.',
      },
      waving: {
        label: 'Waving plants',
        description: 'Grass, ferns, sugar cane and vines sway in the wind. Works in Java 1.17 to 1.21.4 and 1.21.6 to 1.21.10.',
      },
      waveAmount: {
        label: 'Sway amount',
        description: 'How far the tops of plants move.',
      },
      waveSpeed: {
        label: 'Sway speed',
        description: 'How fast plants sway. The motion follows game time, so it pauses with the game.',
      },
      fogStart: {
        label: 'Fog start',
        description: 'Where the distance haze begins, compared to vanilla. Lower values make the haze start closer for a misty look. Fog never ends further away than vanilla, so chunk edges stay hidden.',
      },
      fogEnvironment: {
        label: 'Water & weather fog distance',
        description: 'How far you can see under water, in rain, in foggy biomes and during boss fights. Higher values let you see further. Blindness, Darkness, lava and powder snow keep their normal fog. Needs Minecraft 1.21.6 or newer.',
      },
      fogTint: {
        label: 'Fog tint',
        description: 'Tints the fog color. The fog still follows the time of day and biome.',
      },
      fogTintStrength: {
        label: 'Fog tint strength',
        description: 'How strongly the fog tint is applied. 0 turns it off.',
      },
      nightDarkness: {
        label: 'Darker nights & caves',
        description: 'Dim light gets dimmer, so nights and caves feel darker while daylight and torches stay bright. Needs Minecraft 1.21.2 or newer.',
      },
    },
    presets: {
      default: { label: 'Default', description: 'Exactly how vanilla Minecraft looks. A clean starting point for your own settings.' },
      cinematic: { label: 'Cinematic', description: 'Film-like contrast, slightly muted warm colors, a soft vignette and a light distance haze.' },
      vivid: { label: 'Vivid', description: 'Punchy, saturated colors and crisp contrast with gently swaying grass.' },
      soft: { label: 'Soft', description: 'Low contrast, lifted midtones, pastel colors and a dreamy haze.' },
      noir: { label: 'Noir', description: 'Black and white with hard contrast, a heavy vignette, dark nights and thick mist.' },
      retro: { label: 'Retro', description: 'Posterized colors, warm faded film tones and a rounded vignette, like an old console.' },
      'warm-sunset': { label: 'Warm Sunset', description: 'Golden, warm light with orange-tinted fog and glowing highlights all day long.' },
      'cool-winter': { label: 'Cool Winter', description: 'Crisp blue tones, pale colors, icy fog and darker, colder nights.' },
    },
  },
  bedrock: {
    groups: {
      sun: 'Sun & Sky',
      lighting: 'Lighting',
      shadows: 'Shadows',
      fog: 'Fog & Atmosphere',
      water: 'Water',
      color: 'Color & Tone',
      nights: 'Nights',
    },
    options: {
      sunBrightness: {
        label: 'Sun brightness',
        description: 'How strong daylight is. Auto-exposure evens out big changes, so the effect is gentler than the number suggests.',
      },
      daylightColor: {
        label: 'Daylight color',
        description: 'Color of sunlight during the day. Biomes with their own sunlight keep their character.',
      },
      sunsetColor: {
        label: 'Sunrise & sunset color',
        description: 'Color of sunlight while the sun is low. Also warms the horizon at dusk.',
      },
      sunsetGlow: {
        label: 'Sunset glow',
        description: 'Size of the bright haze around the sun at dawn and dusk.',
      },
      skyColor: {
        label: 'Sky color',
        description: 'Daytime sky color straight overhead.',
      },
      horizonColor: {
        label: 'Horizon color',
        description: 'Daytime sky color near the horizon.',
      },
      skyDensity: {
        label: 'Sky scattering',
        description: 'How much the air scatters light. Lower gives a deeper, darker sky.',
      },
      sunTilt: {
        label: 'Sun path tilt',
        description: 'Tilts the path of the sun and moon so shadows fall at an angle all day.',
      },
      caveLight: {
        label: 'Cave & ambient light',
        description: 'Minimum light everywhere, most visible in caves and in the Nether. Higher is brighter.',
      },
      glowColor: {
        label: 'Glow color strength',
        description: 'How colorful the light from glowing surfaces is. 0 makes it white.',
      },
      coloredLights: {
        label: 'Colored block light',
        description: 'Torches, lanterns, fire, froglights and other light sources tint their surroundings (Minecraft 26.10 or newer).',
      },
      torchColor: {
        label: 'Torch & lantern color',
        description: 'Light color of torches, candles, lanterns, campfires and fire. Other lights keep their own colors.',
      },
      shadowFill: {
        label: 'Shadow fill light',
        description: 'How much light from the sky brightens shadows. Lower makes shadows darker and moodier.',
      },
      blockyShadows: {
        label: 'Pixel shadows',
        description: 'Shadows snap to the texture pixel grid for a crisp, blocky look instead of soft edges.',
      },
      shadowTexel: {
        label: 'Shadow pixel size',
        description: 'Match the resolution of your texture pack (16x for vanilla textures).',
        choices: {
          '8': '8x textures',
          '16': '16x textures',
          '32': '32x textures',
          '64': '64x textures',
          '128': '128x textures',
          '256': '256x textures',
        },
      },
      fogAmount: {
        label: 'Volumetric fog',
        description: 'Thickness of the misty air in biomes that have it: jungles, swamps, forests, the pale garden and the End.',
      },
      lightShafts: {
        label: 'Light shaft focus',
        description: 'Higher gathers fog glow and light shafts around the sun; lower spreads the glow across the sky.',
      },
      classicFog: {
        label: 'Customize classic fog',
        description: 'Also change distance fog and underwater fog. These work in every graphics mode, not only Vibrant Visuals.',
      },
      fogDistance: {
        label: 'Fog distance',
        description: 'Lower brings distance fog closer; higher pushes it out to the edge of your render distance.',
      },
      underwaterVisibility: {
        label: 'Underwater visibility',
        description: 'How far you can see under water.',
      },
      waterStyle: {
        label: 'Water look',
        description: 'Tints Vibrant Visuals water by simulating algae, mud and dissolved plant matter.',
        choices: {
          clear: 'Crystal clear (vanilla)',
          tropical: 'Tropical',
          ocean: 'Deep ocean',
          swamp: 'Swampy green',
          muddy: 'Muddy river',
          tea: 'Dark tea',
        },
      },
      biomeWaterColor: {
        label: 'Biome water colors',
        description: "Blends each biome's classic water color into Vibrant Visuals water (Minecraft 26.0 or newer).",
      },
      waves: {
        label: 'Surface waves',
        description: 'Animated ripples on the water surface (visual only; the water itself stays flat).',
      },
      waveHeight: {
        label: 'Wave height',
        description: 'How tall the ripples look.',
      },
      waveSpeed: {
        label: 'Wave speed',
        description: 'How fast the ripples move.',
      },
      caustics: {
        label: 'Underwater caustics',
        description: 'Moving patterns of light on surfaces under water.',
      },
      causticsStrength: {
        label: 'Caustics sharpness',
        description: 'Higher values give thinner, more defined light lines.',
      },
      brightness: {
        label: 'Brightness',
        description: 'Overall image brightness.',
      },
      contrast: {
        label: 'Contrast',
        description: 'Difference between dark and bright areas. Vanilla is 1.15.',
      },
      saturation: {
        label: 'Saturation',
        description: '0 is black and white.',
      },
      warmth: {
        label: 'Warmth',
        description: 'Shifts the whole image warmer (orange) or cooler (blue). Each biome keeps its own mood.',
      },
      tint: {
        label: 'Color tint',
        description: 'Gently tints the whole image. White means no tint.',
      },
      toneMapper: {
        label: 'Tone mapping',
        description: 'How bright light is squeezed onto your screen. Changes the overall film look.',
        choices: {
          generic: 'Vanilla (generic)',
          aces: 'Cinematic (ACES)',
          hable: 'Filmic (Hable)',
          reinhard: 'Soft (Reinhard)',
          reinhard_luma: 'Soft, rich color (Reinhard luma)',
          reinhard_luminance: 'Soft, bright (Reinhard luminance)',
        },
      },
      splitTone: {
        label: 'Split toning',
        description: 'Tint shadows and highlights with different colors, like a movie color grade.',
      },
      shadowTint: {
        label: 'Shadow tint',
        description: 'Color mixed into the darkest parts of the image.',
      },
      highlightTint: {
        label: 'Highlight tint',
        description: 'Color mixed into the brightest parts of the image.',
      },
      moonBrightness: {
        label: 'Moonlight brightness',
        description: 'How bright moonlit nights are. At 0 the moon is hidden.',
      },
      moonColor: {
        label: 'Moonlight color',
        description: 'Color of moonlight. Biomes with their own moonlight keep their character.',
      },
      nightSkyColor: {
        label: 'Night sky color',
        description: 'Color of the sky overhead at night.',
      },
      nightBrightness: {
        label: 'Brighter nights',
        description: 'Raises the minimum light after sunset so nights are easier to see in. Caves get brighter at night too (Minecraft 26.0 or newer).',
      },
    },
    presets: {
      default: { label: 'Default', description: 'Vibrant Visuals exactly as Minecraft ships it. A clean starting point.' },
      cinematic: { label: 'Cinematic', description: 'Film-style tone mapping, teal shadows and warm highlights, richer fog and sun glow.' },
      vivid: { label: 'Vivid', description: 'Punchy colors, a deep blue sky, tropical water and crisp sunlight.' },
      soft: { label: 'Soft & Dreamy', description: 'Gentle contrast, pastel sky, glowing haze and lavender-pink toning.' },
      noir: { label: 'Moody Noir', description: 'Almost black and white, hard contrast, dark shadows and heavy mist.' },
      golden: { label: 'Golden Hour', description: 'Warm, low-sun light all day with glowing sunsets and amber highlights.' },
      fantasy: { label: 'Fantasy', description: 'Violet skies, pink sunsets, bright magical moonlight and colored torch light.' },
      clearwater: { label: 'Clear Water', description: 'Glass-clear water with sharp caustics, gentle waves and long underwater view distance.' },
      performance: { label: 'Performance', description: 'Thin fog, no caustics or waves: a clean, light look. Frame rate mostly depends on your video settings.' },
      toon: { label: 'Blocky Toon', description: 'Pixel-sharp shadows, bold colors and soft tone mapping for a cartoon look.' },
    },
    notes: {
      what: { title: 'What this makes', text: "A Vibrant Visuals pack: it tunes Minecraft's own built-in shader with official settings for sunlight, sky, fog, water, shadows and color grading. No mods needed." },
      devices: { title: 'Needs a Vibrant Visuals device', text: 'Vibrant Visuals runs on supported Windows PCs, Xbox and PlayStation consoles, and newer phones and tablets (not on Nintendo Switch 1, Chromebooks or Fire tablets). Servers can turn it off.' },
      graphics: { title: 'Switch the graphics mode', text: 'In Settings > Video, set Graphics Mode to Vibrant Visuals. In Simple or Fancy mode only the classic fog changes are visible.' },
      stacking: { title: 'Other packs can switch it off', text: 'Every active resource pack must support Vibrant Visuals. A regular texture pack in the list turns the graphics mode back to Fancy.' },
      limits: { title: 'What cannot be changed', text: 'Bedrock does not allow custom shader code (GLSL) in packs, so effects like bloom strength, exposure, reflections, clouds or waving leaves stay as Minecraft draws them.' },
      fog: { title: 'Classic fog works everywhere', text: 'Distance fog and underwater visibility changes apply in every graphics mode, not only Vibrant Visuals.' },
    },
  },
});

export type ShadersOptionsText = typeof ot;
