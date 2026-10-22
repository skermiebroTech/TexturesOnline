# Texture Pack Maker

Make Minecraft **texture packs**, **skins** and **shaders** right in your browser — for **Java Edition**
(26.3 by default, and every version back to 1.6.1) and **Bedrock Edition**. Free, no sign-up, and it works
offline after the first visit.

**Live site:** https://texturepackmaker.com (formerly https://skermiebrotech.github.io/TexturesOnline/ — the
repository keeps its original name, `TexturesOnline`).

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
- Paint straight onto the 3D model (2D / 3D switch, or press D): each face paints the texture and pixel it
  shows, through rotated faces, overlays such as the grass side, lit and unlit states, stairs, slabs and the
  blocks the game draws itself (chests, beds...), with pencil, eraser, fill, colour picker, brush size and
  mirror, in the same undo history as the flat editor.
- Mob textures on their mob models (Java: about 80 mobs with baby, variant, wool, profession and collar
  choices; Bedrock: drawn from Bedrock's own geometry, posed the way they stand still), paintable in 3D,
  with overlay layers (wool, eyes, clothes) and body parts you can hide or show on their own. Mobs can
  wear what the game puts on them: saddles, horse, wolf and nautilus armour, llama carpets, the happy
  ghast's harness and humanoid armour (leather dyeable, with armour trims in every pattern and material,
  coloured from the pack's trim palettes), each its own part on its own texture.
- Change the shape of blocks and items (Java 1.8+): a model editor opens the model the game uses (resolved
  through its parents) and edits its cubes with fields or move / resize handles in 3D, on a 16-pixel grid
  or finer: rotation with each version's angle rules, face textures (the pack's own and new ones), UVs on
  the texture, cull faces, tints, and display transforms with a preview in the inventory, in hand, on the
  ground, in an item frame and on a head. Start from the game's model, an empty model, a full cube, a slab,
  a cross, or a 3D item made from the flat sprite. Saved as `assets/minecraft/models/...` in the pack, plus an
  item definition (1.21.4+, e.g. a 3D model in hand with the flat icon in the inventory) or a blockstate only
  when the game needs one; models in opened packs load into the editor. Bedrock shows a note instead (shapes
  need an add-on) and models can be downloaded as Bedrock geometry.
- PvP / FPS packs: start a pack as a PvP / FPS pack, or use the PvP tab, for low fire (the screen overlay's
  `fire_1` / 1.8's `fire_layer_1` lowered, fire blocks kept on a copy), clear glass and panes, no pumpkin blur,
  a custom crosshair (`gui/icons.png` before 1.20.2 and on Bedrock, `gui/sprites/hud/crosshair.png` after; five
  designs or your own), smaller swords and weapons and a lower shield in first person (display transforms in the
  item models, merged with models made in the model editor; Java 1.8+ / 1.9+), and FPS options: 8× textures and
  no animations (Java). Each tweak writes the right files for the pack's version, can be switched off (files
  painted since are kept) or undone; tweaks a version or Bedrock can't have are shown off with the reason.
- Sounds: browse the game's sound events by category, play them, and replace any sound with your own file
  (MP3, WAV, OGG, M4A...) or a microphone recording, trimmed on its waveform and levelled. Replacements are
  saved as Ogg Vorbis (Java: `assets/minecraft/sounds/`; Bedrock: `sounds/` plus `sound_definitions.json`
  entries). Java sounds play straight from Mojang's servers; Bedrock's come from bedrock-samples (FSB5,
  decoded in the browser).
- Exports a `.zip` with the exact `pack.mcmeta` rules of the chosen Java version, or a Bedrock `.mcpack`.

### Skins
- Paint on the 64x64 template with part outlines and a live 3D preview (classic and slim arms).
- Paint straight onto the 3D model too: pencil, eraser, face fill and eyedropper, brushes that wrap
  around edges, mirror, part locks and base/outer layers, all in the same undo history as the template.
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
- Presets, grouped sliders and a live 3D preview with a day/night cycle, shown with the real Minecraft
  textures by default, or with one of your texture packs (made here or imported as a `.zip` / `.mcpack`).
  The preview textures never change what gets exported.
- **Open any shader pack:** packs exported here open again with all their settings. Other Iris / OptiFine
  packs get a pack editor with their own menus (screens, sliders with the pack's values and names,
  switches, profiles, search) and export with your choices as the new defaults — only those lines change —
  or as a settings `.txt` for the untouched pack. Vanilla shader resource packs and Bedrock packs open in a
  file editor (JSON checking, pretty/minify); Bedrock exports keep their uuids and raise the version.

## How it works

Everything runs in your browser. Vanilla game files are never stored in this repository: when you pick a
version, your browser downloads what it needs straight from Mojang (`piston-meta` / `piston-data`, using
HTTP range requests so only the textures are fetched from the client jar) or, for Bedrock, from Mojang's
official [bedrock-samples](https://github.com/Mojang/bedrock-samples) repository. Files are cached in
IndexedDB on your device. Your projects are saved locally too — nothing is uploaded anywhere.

### Project files and backups

Because projects live only in the browser, every editor can save a **project file** (`.tpmproject`): the
texture pack, skin (with the skins of its Bedrock pack), shader project (an imported shader pack with its
files and edits), cape or font, with everything needed to keep editing it. **Back up all** on the home page
(or **Help → Backups**) writes every project, the cape and the font into one `.tpmbackup`. Opening either
one (an editor's **Open a project file**, a drop on any drop zone, or a double-click in the installed app)
adds the project to this browser in its own editor and never replaces one; a backup asks what to restore
and skips projects that are already there (or keeps both).

A project file is a zip: `manifest.json` (`format: "texture-pack-maker"`, a format `version`, the `tool` it
opens in, the app's build date and the list of projects with their ids) and one folder per project with an
`item.json` (the stored record) and its files next to it, under their own paths (edited textures as PNG at
their pack path, sounds as Ogg). Game files are never in it: they download again from Mojang. Files from a
newer format version are refused with a message; older ones are migrated (`MIGRATIONS` in
`src/shared/project-file/format.ts`).

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
NODE_PATH=$(npm root -g) node tests/e2e/textures/paint3d.e2e.cjs   # painting textures on the 3D model
NODE_PATH=$(npm root -g) node tests/e2e/textures/mobs.e2e.cjs      # mob models: painting, body parts, saddles, armour and trims, Bedrock
NODE_PATH=$(npm root -g) node tests/e2e/textures/sounds.e2e.cjs    # sounds: list, play, upload / record, trim, export as Ogg Vorbis
NODE_PATH=$(npm root -g) node tests/e2e/textures/models.e2e.cjs    # model editor: block and 3D item models, display, export, phone layout
NODE_PATH=$(npm root -g) node tests/e2e/textures/phone.e2e.cjs     # phones with touch, portrait and landscape: Paint tab, finger painting, pinch, tap targets
NODE_PATH=$(npm root -g) node tests/e2e/skins/skins.e2e.mjs
NODE_PATH=$(npm root -g) node tests/e2e/skins/skins-3d.e2e.mjs
NODE_PATH=$(npm root -g) node tests/e2e/shaders/shaders.e2e.cjs
NODE_PATH=$(npm root -g) node tests/e2e/seo/pages.e2e.mjs   # public pages, routing, 404 fallback, old #/ links
NODE_PATH=$(npm root -g) node tests/e2e/seo/pwa.e2e.mjs     # installable app: manifest, offline start, updates, share target
NODE_PATH=$(npm root -g) node tests/e2e/shaders/import.e2e.cjs
NODE_PATH=$(npm root -g) node tests/e2e/shaders/preview-textures.e2e.cjs
NODE_PATH=$(npm root -g) node tests/e2e/projects/project-files.e2e.cjs  # project files in every editor, backup and restore
```

The Bedrock texture catalogue (file paths only) is generated with `node scripts/bedrock-index.mjs`.

### Project layout

```
src/core/       shared types, storage (IndexedDB), zip, PNG/TGA, networking, router
src/editions/   Java (versions, jar range reader, pack.mcmeta) and Bedrock (versions, catalogue, manifests)
src/ui/         design system components; src/styles/ tokens and global CSS
src/shared/     pixel editor engine, the 3D/WebGL previews, project files and backups (project-file/)
src/tools/      the pages: home, textures, skins, shaders (iris / vanilla / bedrock generators), help, guides
src/app/        shell (top bar, footer), site constants, head tags, page content trees, SEO generation (seo/)
tests/          unit tests, end-to-end suites and test harnesses
```

## Deployment

Pushing to `main` builds the site and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). In the repository settings, **Pages → Build and deployment → Source**
must be set to **GitHub Actions**.

### Custom domain

The site lives at **https://texturepackmaker.com** (`public/CNAME`). To finish the switch:

1. **Settings → Pages → Custom domain:** enter `texturepackmaker.com`, then tick **Enforce HTTPS** once the
   certificate is ready. GitHub then redirects `skermiebrotech.github.io/TexturesOnline/…` to the domain.
2. **DNS** at the registrar: `A` records for the apex to `185.199.108.153`, `185.199.109.153`,
   `185.199.110.153` and `185.199.111.153` (optionally `AAAA` to `2606:50c0:8000::153` … `2606:50c0:8003::153`),
   plus a `CNAME` from `www` to `skermiebrotech.github.io`. Verifying the domain for the account
   (account Settings → Pages) protects it from takeovers.
3. Projects are stored per website address (IndexedDB), so work saved on the old github.io address stays
   there: make a backup there (**Back up all** on the home page) and open it on the new domain.

The build works at any address: asset links are relative and the router works out the site root at runtime,
so the old project URL keeps working until the redirect is in place. To move to another domain, change
`SITE_URL` in `src/app/site.ts` (canonical links, Open Graph tags, structured data, `sitemap.xml`,
`robots.txt` and `llms.txt` are generated from it) and `public/CNAME`.

### URLs, prerendering and SEO

- **Real URLs.** The router (`src/core/router.ts`) uses the History API. `/`, `/textures/`, `/skins/`,
  `/shaders/`, `/help/`, `/guides/` and `/guides/<guide>/` are public pages. Project pages
  (`/textures/<id>`, `/skins/<id>`, `/shaders/<id>`) and `/kit/` are private and get `noindex`. Old
  `#/…` links are redirected to the matching path, and internal links navigate without a reload.
- **Prerendered pages.** A Vite plugin (`vite.config.ts` → `src/app/seo/build.ts`) writes a static HTML file
  for every public page: its own title, description, canonical link, Open Graph/Twitter tags, JSON-LD
  (WebSite, Organization, WebApplication, FAQPage, HowTo, TechArticle, BreadcrumbList) and the real page
  content, so search engines and AI crawlers that do not run JavaScript read the full text. The content comes
  from the same markup trees the app renders (`src/tools/*/content.ts`, `src/app/content/`), so the booted
  page matches the static one. On `/textures/`, `/skins/` and `/shaders/` the app shows the tool first and
  the same introduction below it.
- **`404.html`** boots the app: GitHub Pages serves it for every unknown path, so project links such as
  `/textures/<id>` open directly. It carries `noindex`.
- **Generated files:** `sitemap.xml` (all public pages, build date as `lastmod`), `robots.txt` (everything
  allowed, AI crawlers listed by name, sitemap line), `llms.txt` (llmstxt.org summary with links to every
  page and guide) and `llms-full.txt` (all public text as Markdown).
- **Search Console:** add a property for `https://texturepackmaker.com`, verify it with a DNS record
  (recommended) or by pasting the HTML-tag token into `GOOGLE_SITE_VERIFICATION` in `src/app/site.ts`
  (Bing Webmaster Tools: `BING_SITE_VERIFICATION`), then submit `https://texturepackmaker.com/sitemap.xml`.
  `robots.txt` is only read at the root of a host, which the custom domain provides (on a github.io project
  path it was advisory only).
- **Images:** `public/og-image.png` (`tests/harness/ui/og-image.cjs`), `public/screenshots/*.jpg`
  (`tests/harness/seo/screenshots.cjs`) and the app icons in `public/icons/` and
  `public/apple-touch-icon.png` (`npx tsx scripts/gen-icons.ts`, drawn from the logo in `src/ui/logo.ts`).
  Re-run them after visible UI changes.
  The install-dialog screenshots in `public/screenshots/app/` and the Store screenshots in `docs/store/`
  come from `tests/harness/seo/store-screenshots.cjs`.
  The guide screenshots in `public/screenshots/guides/` (`tests/harness/seo/guide-screenshots.cjs`) also have
  AVIF copies the pages offer through `srcset`: run `python3 scripts/screenshot-variants.py` after changing one.
- **Installable app:** `public/site.webmanifest`, the service worker `src/pwa/sw.ts` (built to `/sw.js`
  with this build's precache list) and the install, update and file-opening code in `src/pwa/`. Publishing
  on the Microsoft Store (and later Google Play): `docs/microsoft-store.md`.
- Facts on the guide pages (pack formats, version rules) come from the app's own data (`src/editions/`);
  the "Updated" date shown on guides is `CONTENT_UPDATED` in `src/app/site.ts`.

## Credits

- UI font **Texel**: a modified version of [Minecraft-Font](https://github.com/IdreesInc/Minecraft-Font) and
  [Monocraft](https://github.com/IdreesInc/Monocraft) by Idrees Hassan, under the SIL Open Font License 1.1
  (`public/fonts/OFL.txt`).
- Icons: [pixelarticons](https://github.com/halfmage/pixelarticons) (MIT).
- Libraries: [three.js](https://threejs.org/), [skinview3d](https://github.com/bs-community/skinview3d),
  [fflate](https://github.com/101arrowz/fflate), [fast-png](https://github.com/image-js/fast-png),
  [idb-keyval](https://github.com/jakearchibald/idb-keyval), built with [Vite](https://vite.dev/).
- Ogg Vorbis encoding: [wasm-media-encoders](https://github.com/arseneyr/wasm-media-encoders) (MIT), libogg and
  libvorbis by Xiph.Org (BSD). The FSB5 / FADPCM reader follows the format notes of
  [vgmstream](https://github.com/vgmstream/vgmstream).

## License

MIT — see [LICENSE](LICENSE).

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
