# TexturesOnline

Make Minecraft **texture packs**, **skins** and **shaders** right in your browser — for **Java Edition**
(26.3 by default, and every version back to 1.6.1) and **Bedrock Edition**. Free, no sign-up, and it works
offline after the first visit.

**Live site:** https://skermiebrotech.github.io/TexturesOnline/

## What you can make

### Texture packs (Java + Bedrock)
- Browse every vanilla texture of the version you pick, with search and categories.
- Paint pixels with a full editor: pencil, eraser, fill, eyedropper, line, rectangle, ellipse,
  lighten/darken, noise, selection and move, mirror painting, undo/redo, tiled preview and zoom.
- Upload your own PNGs (auto-resized to the texture, 16x up to 512x) and edit animated textures frame by frame.
- One-click whole-pack effects (Dark Mode, Pastel, Neon Outline, Retro 8-bit, Autumn, Winter, Noir, Cartoon,
  Smooth HD and more), stacked non-destructively and applied on export.
- Open an existing `.zip` / `.mcpack` pack and keep editing.
- 3D block preview, pack icon and description, and a Java compatibility range.
- Exports a `.zip` with the exact `pack.mcmeta` rules of the chosen Java version, or a Bedrock `.mcpack`.

### Skins
- Paint on the 64x64 template with part outlines and a live 3D preview (classic and slim arms).
- True body mirroring (paint the left arm, the right arm follows), per-part locking, base/outer layer editing.
- Start from a blank skin, a colour-coded template, original starter characters, an uploaded PNG
  (legacy 64x32 skins are converted), any player's skin by username, or Steve/Alex from the game files.
- Export a Java PNG (plus legacy 64x32) or a Bedrock skin pack `.mcpack`.

### Shaders
- **Iris / OptiFine shader packs** (Java, needs the mod): shadows, waving plants, water, bloom, god rays,
  tone mapping and colour grading, all adjustable in game as well.
- **Vanilla Java (no mods):** a resource pack that patches the chosen version's own shaders — colour
  grading, vignette, fog and, on 26.3+, full-screen bloom. Every generated shader is compile-checked.
- **Bedrock Vibrant Visuals:** lighting, sky, fog, water and colour grading settings packs.
- Presets, grouped sliders and a live 3D preview with a day/night cycle.

## How it works

Everything runs in your browser. Vanilla game files are never stored in this repository: when you pick a
version, your browser downloads what it needs straight from Mojang (`piston-meta` / `piston-data`, using
HTTP range requests so only the textures are fetched from the client jar) or, for Bedrock, from Mojang's
official [bedrock-samples](https://github.com/Mojang/bedrock-samples) repository. Files are cached in
IndexedDB on your device. Your projects are saved locally too — nothing is uploaded anywhere.

## Development

Requires Node.js 20.19+ (22 recommended).

```sh
npm install
npm run dev        # local dev server
npm run build      # type-check + production build into dist/
npm test           # unit tests
```

Some tests use real game files and a GLSL validator when they are available, and skip themselves otherwise:

- `TO_FIXTURES` — a folder holding `client-26.3.jar`, `manifest.json` and `research-cache/jars/<version>.jar`
- `GLSLANG_VALIDATOR` — path to `glslangValidator` (or have it on `PATH`)

Browser end-to-end suites (need Playwright + Chromium):

```sh
NODE_PATH=$(npm root -g) node tests/e2e/textures/e2e.cjs
NODE_PATH=$(npm root -g) node tests/e2e/skins/skins.e2e.mjs
NODE_PATH=$(npm root -g) node tests/e2e/shaders/shaders.e2e.cjs
```

The Bedrock texture catalogue (file paths only) is generated with `node scripts/bedrock-index.mjs`.

### Project layout

```
src/core/       shared types, storage (IndexedDB), zip, PNG/TGA, networking, router
src/editions/   Java (versions, jar range reader, pack.mcmeta) and Bedrock (versions, catalogue, manifests)
src/ui/         design system components; src/styles/ tokens and global CSS
src/shared/     pixel editor engine and the 3D/WebGL previews
src/tools/      the pages: home, textures, skins, shaders (iris / vanilla / bedrock generators), help
tests/          unit tests, end-to-end suites and test harnesses
```

## Deployment

Pushing to `main` builds the site and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). In the repository settings, **Pages → Build and deployment → Source**
must be set to **GitHub Actions**.

## Credits

- UI font **Texel**: a modified version of [Minecraft-Font](https://github.com/IdreesInc/Minecraft-Font) and
  [Monocraft](https://github.com/IdreesInc/Monocraft) by Idrees Hassan, under the SIL Open Font License 1.1
  (`public/fonts/OFL.txt`).
- Icons: [pixelarticons](https://github.com/halfmage/pixelarticons) (MIT).
- Libraries: [three.js](https://threejs.org/), [skinview3d](https://github.com/bs-community/skinview3d),
  [fflate](https://github.com/101arrowz/fflate), [fast-png](https://github.com/image-js/fast-png),
  [idb-keyval](https://github.com/jakearchibald/idb-keyval), built with [Vite](https://vite.dev/).

## License

MIT — see [LICENSE](LICENSE).

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
