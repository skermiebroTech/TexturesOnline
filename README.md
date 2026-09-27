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
NODE_PATH=$(npm root -g) node tests/e2e/skins/skins-3d.e2e.mjs
NODE_PATH=$(npm root -g) node tests/e2e/shaders/shaders.e2e.cjs
NODE_PATH=$(npm root -g) node tests/e2e/seo/pages.e2e.mjs   # public pages, routing, 404 fallback, old #/ links
NODE_PATH=$(npm root -g) node tests/e2e/shaders/import.e2e.cjs
NODE_PATH=$(npm root -g) node tests/e2e/shaders/preview-textures.e2e.cjs
```

The Bedrock texture catalogue (file paths only) is generated with `node scripts/bedrock-index.mjs`.

### Project layout

```
src/core/       shared types, storage (IndexedDB), zip, PNG/TGA, networking, router
src/editions/   Java (versions, jar range reader, pack.mcmeta) and Bedrock (versions, catalogue, manifests)
src/ui/         design system components; src/styles/ tokens and global CSS
src/shared/     pixel editor engine and the 3D/WebGL previews
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
   there: export it there and open the file on the new domain with **Open a pack**.

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

## License

MIT — see [LICENSE](LICENSE).

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
