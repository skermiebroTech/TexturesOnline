# Translating the editors

The public pages (home, help, guides, tool introductions) are translated in `src/i18n/<lang>/`.
The editors themselves (start screens, panels, dialogs, toasts, tooltips, aria-labels, errors) use
a separate, lighter system: `src/i18n/editor-text.ts`. Languages: `de` (du), `es` (tú), `pt-br`
(você), `ja` (です/ます), `ru` (ты), `fr` (tu). English is the source of truth and stays
byte-identical. A new language can get its public pages first: until its `src/ui/i18n/<lang>.ts`
exists, its editors show English and the unit tests skip it.

## Layout

Every owner of interface text has an `i18n/` folder next to its code:

| Folder | Sections | Loaded by |
| --- | --- | --- |
| `src/ui/i18n/` | `kit` (buttons, dialogs, toasts, colour picker, format helpers) | the router, before every page |
| `src/shared/i18n/` | `shared.pickers`, `shared.errors`, `shared.files`, `shared.packs`, `shared.canvas`, `shared.skins`, `shared.projects` | the router, before every tool page |
| `src/shared/project-file/i18n/` | `shared.projectFile` (saving and opening project files, the backup and restore dialogs) | `src/shared/project-file/ui.ts`, when it is first used |
| `src/tools/convert/i18n/` | `convert`, `convert.engine` | `convert/view.ts` |
| `src/tools/merge/i18n/` | `merge` | `merge/view.ts` |
| `src/tools/totem/i18n/` | `totem` | `totem/view.ts` |
| `src/tools/fonts/i18n/` | `fonts` | `fonts/view.ts` |
| `src/tools/doctor/i18n/` | `doctor` (start screen), `doctor.report` (the report and every problem) | `doctor/view.ts` |
| `src/tools/skins/i18n/` | `skins` (start screen), `skins.parts`, `skins.editor`, `skins.export`, `skins.pose` (the pose maker), `skins.cape` (the cape maker) | `skins/view.ts`, `skins/cape/view.ts` |
| `src/tools/shaders/i18n/` | `shaders` (start screen, targets, "New pack"), `shaders.import` | `shaders/view.ts` |
| `src/tools/shaders/ui/i18n/` | `shaders.editor`, `shaders.options` (settings, presets and notes by key), `shaders.messages` (the generators' messages) | `shaders/view.ts` for an editor route, and every `loadGenerator()` |
| `src/tools/shaders/packedit/i18n/` | `shaders.packedit` | `shaders/view.ts` for an editor route |
| `src/tools/textures/i18n/` | `textures` (start screen), `textures.effects`, `textures.pack` | `textures/view.ts` |
| `src/tools/textures/ui/i18n/` | `textures.editor`, `textures.sounds`, `textures.modelRules`, `textures.modelEditor` | `textures/view.ts`, with the editor's code |
| `src/tools/textures/pbr/i18n/` | `textures.pbr` (the Material tab) | the editor, when the tab first opens |
| `src/tools/textures/pvp/i18n/` | `textures.pvp` (the PvP / FPS tab) | the editor, when the tab first opens |
| `src/tools/textures/gui/i18n/` | `textures.gui` (the GUI section: library, live preview, splash texts) | the editor, when the section first opens |
| `src/tools/textures/names/i18n/` | `textures.names` (the name-based textures window) | the editor, when the window first opens |
| `src/tools/textures/anim/i18n/` | `textures.anim` (the animation maker: frames strip, timing, import and GIF windows) | `textures/view.ts`, with the editor's code |
| `src/tools/textures/layers/i18n/` | `textures.layers` (paint layers: the Layers button and panel, the eyedropper's option) | `textures/view.ts`, with the editor's code |
| `src/tools/textures/stamps/i18n/` | `textures.stamps` (the stamp tool: its options, the list of stamps, saving a selection) | `textures/view.ts`, with the editor's code |
| `src/tools/textures/swap/i18n/` | `textures.swap` (the colour swap: its button and window) | `textures/view.ts`, with the editor's code |
| `src/tools/textures/biomes/i18n/` | `textures.biomes` (biome colours: the colour map view, the biome names, the previews' biome picker) | `textures/view.ts`, with the editor's code |
| `src/shared/models/i18n/` | `shared.models` (texture roles, block states, mob looks and parts, model notes) | `textures/view.ts`, with the editor's code |

In a folder:

- **Section files** (any name, e.g. `text.ts`, `engine.ts`): English text, registered with
  `defineText('<section id>', { ... })`. Nested objects group keys; leaves are strings. They import
  nothing but `src/i18n/editor-text.ts` (the unit test imports them in Node).
- **`load.ts`**: the language-file type and its loader.
- **`de.ts`, `es.ts`, `pt-br.ts`, `ja.ts`, `ru.ts`, `fr.ts`**: one language file each, translating every section of
  the folder, keyed by section id. Optionally `export const SAME_AS_ENGLISH = ['<id>:<key.path>']`
  for text that is rightly identical to English (see Tests).

Why one folder per owner: each tool's agent edits only its own files (no shared registry), and a
tool's translations download as one small file, only on that language's pages.

## Chunks and weight

A section module goes into the chunk of the modules that import it, so put English text next to
the code that shows it. If a tool has a lazily loaded part with a lot of text (an editor behind a
start screen, an engine loaded on demand), give that part its own section file imported only by it
(as `convert/i18n/engine.ts`); the start screen then doesn't carry it. All sections of a folder can
still share one language file. English pages never load a language file. Check with
`npx vite build --manifest` that a start screen didn't gain a section it doesn't show.

## Applying it to a tool (phase B)

1. Create `src/tools/<tool>/i18n/text.ts` (more section files for lazy parts):

   ```ts
   import { defineText } from '../../../i18n/editor-text';

   export const t = defineText('textures', {
     start: { title: 'Texture packs', open: 'Open a pack' },
     /** Comments for translators survive in the type. */
     exported: '{count, plural, one {# texture} other {# textures}} exported',
   });

   export type TexturesText = typeof t;
   ```

   Section ids are unique across the app: use the tool id, then `<tool>.<part>`.

2. Create `load.ts`:

   ```ts
   import { textLoader, type Translation } from '../../../i18n/editor-text';
   import type { TexturesText } from './text';

   export interface TexturesLanguage {
     textures: Translation<TexturesText>;
   }

   export const loadTexturesText = textLoader<TexturesLanguage>({
     de: () => import('./de'),
     es: () => import('./es'),
     'pt-br': () => import('./pt-br'),
     ja: () => import('./ja'),
   });
   ```

   A big tool may use two loaders (start screen and editor) so the start screen downloads less.

3. In the view, before building any DOM: `await loadTexturesText(ctx.locale);` (the view's
   `RouteContext` has `locale`). A lazily imported part that has its own loader awaits it before
   rendering. Loading never throws: a missing file leaves English.

4. Replace literals: `'Open a pack'` → `t.start.open`; template strings → `fmt(t.x, { name })`;
   sentences with elements in them (a link, a `<code>`) → `h('p', null, fmtNodes(t.x, { link: h('a', …) }))`.
   Numbers: `num(n)` (not `toLocaleString('en-US')`); lists: `joinList(items, 'and' | 'or')`.
   Shared words: `kit.cancel`, `kit.tryAgain`, `kit.edition.java`, `fmt(kit.edition.javaVersion, { version })`.

5. Write `de.ts`, `es.ts`, `pt-br.ts`, `ja.ts`:

   ```ts
   import type { TexturesLanguage } from './load';

   const DE: TexturesLanguage = {
     textures: { start: { title: 'Texture Packs', open: 'Pack öffnen' }, exported: '…' },
   };

   export default DE;
   ```

   TypeScript reports every missing or extra key.

6. Run `npx tsc --noEmit -p .`, `npx tsx --test tests/unit/i18n-editors.test.ts`, the tool's
   English e2e (must pass unchanged) and `tests/e2e/i18n/editors.e2e.mjs` (add the tool's pages to it
   if you like; it is the model for the checks: English left, overflow at 390 px, console errors).

## Rules

- **Read text when it is needed**, never at module load: `defineText` returns a live object that
  is rewritten when the language changes. A module-level `const LABEL = t.x` or an array of
  `{ label: 'English' }` captured at import would stay in one language: use getters
  (`get label() { return t.x; }`) or functions (`label: () => t.x`), as `PIXEL_SHORTCUTS` and the
  totem `STYLES` do.
- **Never match on message text.** Errors that code tells apart get a `code`
  (`Object.assign(new Error(t.noPack), { code: 'no-pack' })`), as `textures/import.ts` and
  `convert/loose.ts` now do.
- **Data written into files stays as it is decided by the code**, but text the user sees in their
  pack (default names, descriptions) may be translated. Keep identifiers that the code parses back
  English (e.g. `convertedName()`'s "(Bedrock)" suffix, the Bedrock "Latest release (…)" version
  names, which `ui/format.ts` translates for display).
- **Keep untranslated**: file names and extensions (`pack.mcmeta`, `.mcpack`), Minecraft
  identifiers and paths, key names (`Ctrl`, `Shift`, `B`), code and colours (`#ff00aa`), product and
  person names (Texture Pack Maker, Mojang, Steve, Alex), and the totem style names Classic / Big
  head / Full body (the translated pages use them).
- **Terminology** follows `src/i18n/<lang>/`: de "Texture Pack", "Ressourcenpaket", "Skin",
  "Spieldateien", Java Edition / Bedrock Edition; es "texture pack", "paquete de recursos", "la
  skin"; pt-br "texture pack", "pacote de recursos", "a skin"; ja Java版 / 統合版 (from
  `kit.edition`), リソースパック, テクスチャパック, スキン; ru "текстурпак" (short "пак"), "набор
  ресурсов", "скин", "набор скинов", "шейдерпак", Java Edition / Bedrock Edition, and the game's
  ru_ru names for blocks, items and mobs (Броня, Отделка, Тотем бессмертия, Гардеробная). In-game menu
  paths use the game's own names (de Optionen → Ressourcenpakete, es Opciones → Paquetes de
  recursos, pt-br Opções → Pacotes de recursos, ja 設定 → リソースパック, ru Настройки → Наборы
  ресурсов; Bedrock Настройки → Глобальные ресурсы). fr (`src/i18n/fr/game-ui.ts` has the game's
  menu names): "pack de textures", "pack de ressources", "un skin" (masculine, as the game's fr_FR
  "Skins classiques"), "pack de shaders", "préréglage" (preset),
  "créature" for mob, "objet" for item, HUD, "viseur", "calque" (layer), "Matériau" (the Material
  tab), "Aperçu" (Preview), Graphismes éclatants, Vestiaire, Équiper, Totem d'immortalité, Élytres,
  Maj for Shift and Suppr for Delete; tools: Éditeur de packs de textures, Convertisseur de packs,
  Fusionner des packs, Éditeur de skins, Créateur de packs de skins / de capes / de totems / de
  polices / de shaders / de poses; Pack Doctor keeps its name; menus Options... → Packs de
  ressources... → Ouvrir le dossier des packs, Graphismes... → API graphique, Bedrock Paramètres →
  Ressources globales → Mes packs, Paramètres → Vidéo → Mode graphique. Blocks, items, biomes and
  villager jobs use the game's fr_fr names (Bloc d'herbe, Feuilles d'acajou, Forêt ambrée, Fléchier).
  French typography: a no-break space (U+00A0, typed as the character) before `: ; ! ?` and `%`, and
  inside « »; apostrophes are ’.
- **Touch screens**: a hint that says "Click", "Double-click" or names a key gets a twin ending in
  `Touch` (`partsHint` / `partsHintTouch`) with "Tap" / "Double-tap" and no keyboard. The code picks
  one when the text is shown (`byPointer(mouse, touch)` in `textures/ui/media.ts`, by
  `(pointer: coarse)`); translate both.
- **Fit**: German runs ~30 % longer, Russian too (and its pixel-font glyphs are wider), Japanese
  needs no spaces but wraps anywhere. Check at 390 px;
  prefer shorter wording over smaller buttons; use ` ` to keep "16 × 16" together.

## Message syntax

`fmt(message, params)` understands:

- `{name}`: a parameter; numbers get the language's grouping (1,234 / 1.234). Pass a number as a
  string when it must not be grouped (years, HTTP codes, versions).
- `{count, plural, =0 {none} one {# file} other {# files}}`: categories of `Intl.PluralRules`
  (`one`/`other` for de, es, pt-br — es and pt-br also have `many` for millions; Russian needs
  `one`/`few`/`many` plus `other` (fractions); Japanese only `other`, or just `{count}`), `#` is the formatted number. Branches may hold other parameters.
- `{model, select, slim {slim arms} other {classic arms}}`: by a string value.

A translation may drop a parameter English only uses to choose a plural form (Japanese often
does), but must show every parameter English shows and may not add new ones.

## Tests

`tests/unit/i18n-editors.test.ts` finds every `i18n/` folder and checks that each section is
translated once per language, keys and parameters match, plural forms exist in that language (and
a plural that tells forms apart gives every form whole numbers use, e.g. Russian one/few/many),
every message formats, and no English is left: an identical phrase (two or more words) or English
function words in a translation fail unless listed in that file's `SAME_AS_ENGLISH`. English
words that are also words of a language don't count there (`ALSO_NATIVE`: French "on", "or").

`tests/e2e/i18n/editors.e2e.mjs` drives the translated converter, merger and totem maker (and, in
French, Pack Doctor and the font maker) at 1280 and 390 px in both themes and fails on English
left in visible text or labels, overflow or clipped labels, and console errors (`--shots <dir>`
saves screenshots). `skins.e2e.mjs`, `shaders.e2e.mjs` and `textures.e2e.mjs` do the same for the
skin tools, the Shader Maker and the texture pack maker; `--langs fr` (`--locales fr` for shaders)
runs one language.

The pages quote the editors' buttons (`strong('Ouvrir un pack')`): when a label changes, change
the quotes in `src/i18n/<lang>/` too. Screenshot alt texts (`shots.ts`) describe the English
screenshots, so they keep the English labels.

## Left for later

- Block and item names: the editors show texture paths and English names. The game's own language
  files (`assets/minecraft/lang/<locale>.json`, e.g. `de_de.json`, `es_es.json`, `pt_br.json`,
  `ja_jp.json`) are in the Java asset index (`objects` in the version's asset index JSON, fetched
  from `resources.download.minecraft.net/<hash prefix>/<hash>`), not in the client jar we read. A
  loader could fetch the one file for the page's language (about 400–600 KB, cache it like other
  game files, never commit it) and map `block.minecraft.<id>` / `item.minecraft.<id>` to names, with
  English (`en_us.json`, inside the client jar) as the fallback. Bedrock's `texts/<Locale>.lang` in
  bedrock-samples works the same way. Not done yet: none of the phase-A tools shows block names.
