# Publishing Texture Pack Maker on the Microsoft Store

Texture Pack Maker is an installable web app (PWA). The Microsoft Store lists PWAs as normal
Windows apps: [PWABuilder](https://www.pwabuilder.com) wraps the live site in a signed MSIX
package, the Store signs and distributes it, and the installed app always runs the current version
of https://texturepackmaker.com/ (every deploy reaches Store users without a new submission).

Nothing here needs a server or a paid tool. The steps below are the ones only the owner can do
(signing in, verifying identity, submitting). Everything the site needs is already in the repo.

Checked on 2026-10-20 against the Microsoft and PWABuilder documentation. Store screens get
renamed now and then; if a label differs, the field descriptions below still apply.

---

## What the site already provides

| Requirement | Where |
| --- | --- |
| Web app manifest (name, id, start URL, scope, standalone + window controls overlay, colours, icons incl. maskable and monochrome, screenshots, shortcuts, file handlers, share target, launch handler, categories) | `public/site.webmanifest` |
| Service worker: offline start on every route and language, update notice, cache versioning | `src/pwa/sw.ts`, built to `/sw.js` by `vite.config.ts` |
| HTTPS | GitHub Pages with the custom domain |
| Privacy policy | https://texturepackmaker.com/privacy/ (`src/tools/privacy/content.ts`) |
| App icons (PWABuilder makes every Windows tile size from the 1024px icon) | `public/icons/` (made by `scripts/gen-icons.ts`) |
| Store screenshots, 1920x1080 | `docs/store/screenshots/` |
| Store logos: 300x300 tile icon, 1080x1080 box art, 720x1080 poster art | `docs/store/` |

PWABuilder's manifest checks (`@pwabuilder/manifest-validation`, the library behind the
pwabuilder.com report card) pass: 24 of 24, no required or recommended field missing. The only
members it lists as absent are the optional `related_applications` and `iarc_rating_id`, which only
exist after the app is published (see "After publishing").

Before you start, make sure the version of the site with these files is deployed: these must open
in a browser:

- https://texturepackmaker.com/site.webmanifest
- https://texturepackmaker.com/sw.js
- https://texturepackmaker.com/privacy/

---

## 1. Create a Microsoft Store developer account (free for individuals)

Since September 2025 an **individual** developer account costs nothing (it used to be a one-time
$19) and no credit card is needed. A **company** account is still a one-time **$99** and goes
through business verification. An individual account is enough to publish this app.

1. Go to https://storedeveloper.microsoft.com and choose to sign up as an individual developer.
2. Sign in with a **personal Microsoft account** (an outlook.com/hotmail.com/live.com address, or
   any address registered as a Microsoft account). Use one you will keep; the app belongs to it.
3. Verify your identity when asked: scan a government-issued photo ID and take a selfie.
4. Fill in the profile. **Publisher display name**: `Skermiebro Tech Tips` (this name appears
   under the app in the Store; it must not be a name you have no right to use).
5. When the verification is done you land in **Partner Center**
   (https://partner.microsoft.com/dashboard).

## 2. Reserve the name "Texture Pack Maker"

1. Partner Center › **Apps and games** › **+ New product** › **MSIX or PWA app**.
2. Enter `Texture Pack Maker` and choose **Check availability**, then **Reserve product name**.
   - Don't put "Minecraft" in the app's name: the Minecraft usage guidelines don't allow it in a
     product name, and Store certification checks for trademark use.
   - If the name is already taken, reserve `Texture Pack Maker Studio` (or similar) and use that
     exact name in step 3 as PWABuilder's **App name**. The website keeps its own name.
3. Open the new product › **Product management** › **Product identity**. Copy three values:

| Partner Center shows | PWABuilder field | Looks like |
| --- | --- | --- |
| Package/Identity/Name | **Package ID** | `12345SkermiebroTechTips.TexturePackMaker` |
| Package/Identity/Publisher | **Publisher ID** | `CN=1A2B3C4D-5E6F-7A8B-9C0D-1E2F3A4B5C6D` |
| Package/Properties/PublisherDisplayName | **Publisher display name** | `Skermiebro Tech Tips` |

Paste them exactly (copy-paste, no extra spaces). They are specific to your account, which is why
they can't be filled in ahead of time.

## 3. Package the app with PWABuilder (Windows, signed by the Store)

1. Open https://www.pwabuilder.com, enter `https://texturepackmaker.com/` and choose **Start**.
2. The report card should show the manifest, the service worker and security as passing. (If it
   says the service worker is missing, the deploy from "Before you start" isn't live yet.)
3. Choose **Package for stores** › **Windows** › **Generate package**, and fill in:

| Field | Value |
| --- | --- |
| Package ID | from step 2 |
| Publisher display name | from step 2 |
| Publisher ID | from step 2 |
| App name | `Texture Pack Maker` (exactly the reserved name) |
| App version | `1.0.0` (raise it for every new package, e.g. `1.0.1`, `1.1.0`) |
| Classic package version | `0.9.0` (must be lower than the app version; raise it too) |
| Language | `en-us` |
| URL | `https://texturepackmaker.com/` |
| Start URL / Manifest URL | leave PWABuilder's values (`/` and `/site.webmanifest`) |
| Icon URL | leave the default (the 1024px icon from the manifest) |
| Display mode | standalone (from the manifest) |
| Everything else (widgets, Windows actions, sign-in, Xbox) | leave off |

4. Choose **Download package**. The zip contains:
   - `Texture Pack Maker.msixbundle`: for current Windows 10 and Windows 11.
   - `Texture Pack Maker.classic.appxbundle`: for older Windows 10 versions.
   - a test package and instructions for trying the app before submitting (optional).
   Keep the zip; you don't need any signing certificate (the Store signs the packages).

## 4. Fill in the submission

Partner Center › Apps and games › Texture Pack Maker › **Start your submission**. Complete each
section:

### Pricing and availability
- Markets: all markets.
- Visibility: **Public audience**, discoverable in the Store.
- Pricing: **Free**. Free trial: none.
- Release: as soon as it passes certification (or pick a date).

### Properties
- Category: **Utilities & tools** (it is a tool for a game, not a game; Store "Games" requires a
  game).
- Privacy policy URL: `https://texturepackmaker.com/privacy/`
- Website: `https://texturepackmaker.com/`
- Support contact info: `https://github.com/skermiebroTech/TexturesOnline/issues`
- System requirements: nothing to tick. Optional note under "additional requirements": "An internet
  connection the first time each game version is used."
- Product declarations: none of the boxes apply (no in-app purchases, no ads, no account, not
  for children's privacy programmes). You may tick "This app has been tested to meet accessibility
  guidelines" (the site scores 100 for accessibility in Lighthouse).

### Age ratings (IARC questionnaire)
Answer for an app that is **not** a game. Suggested answers:

| Question | Answer |
| --- | --- |
| Product category | **Utility, productivity, communication or other** (not a game, not social) |
| Violence, fear, sexual content, nudity, crude humour, language | No |
| Drugs, alcohol, tobacco, gambling / simulated gambling | No |
| Can users interact or exchange content with other users (chat, sharing, posting)? | **No** (projects stay on the device; nothing is uploaded) |
| Does the app share the user's current physical location? | No |
| Does the app allow purchases of digital goods? | No |
| Does the app provide unrestricted internet access (a web browser, search)? | No |
| Does the app collect or share personal information? | No |
| Minecraft content? | Mention it only if asked about third-party content: the app downloads Mojang's official game textures from Mojang's servers so users can edit them. |

Expected result: **IARC 3+ / PEGI 3 / ESRB Everyone / USK 0**.

### Packages
Drag in both files from step 3: the `.msixbundle` and the `.classic.appxbundle`. Device families:
**Windows 10/11 Desktop** only (untick Xbox, Team, HoloLens if shown). Warnings about restricted
capabilities (`runFullTrust`, `packageManagement`) are expected for PWAs and can be ignored.

### Store listing (English, United States)

**Product name**: Texture Pack Maker

**Short description** (shown first; also used on Xbox and the web Store):

> Make Minecraft texture packs, skins and shaders for Java and Bedrock. Repaint blocks on real 3D
> models, convert packs between editions and export files that load straight into the game. Free,
> no account, works offline.

**Description**:

> Texture Pack Maker is a free, open-source studio for Minecraft creators. Repaint any block, item
> or mob on its real 3D model, give the whole game a new look in one click, paint skins in 2D or 3D
> and build shader packs with a live preview, then export a pack that loads straight into the game.
>
> TEXTURE PACKS
> Pick Java Edition (26.3 and every version back to 1.6.1) or Bedrock Edition. The app downloads that
> version's own textures from Mojang, so you always start from the real game. Paint with pixel
> tools on the texture or directly on the 3D model, upload your own images, replace sounds, or apply
> a one-click style to every texture at once. Export a .zip with the right pack.mcmeta for Java or an
> .mcpack with a manifest.json for Bedrock.
>
> CONVERT AND MERGE
> Turn a Java pack into a Bedrock pack or back, move a pack to another Java version, or merge up to
> eight packs into one, top pack first.
>
> SKINS
> Paint a skin on the 64×64 template with a live 3D preview, classic or slim arms, and bundle several
> skins into a Bedrock skin pack. Turn any skin into a custom Totem of Undying.
>
> SHADERS
> Build Iris and OptiFine shader packs, vanilla Java shaders that need no mods, or Bedrock Vibrant
> Visuals packs with presets, sliders and a live preview.
>
> MADE FOR WINDOWS
> Open .zip, .mcpack and .mcaddon packs and skin PNGs straight from File Explorer with "Open with",
> jump to a tool from the taskbar menu, and keep working offline.
>
> PRIVATE BY DESIGN
> No account, no ads, no tracking. Your projects are saved on your device and nothing you make is
> uploaded.
>
> Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.

**What's new in this version**: First release on the Microsoft Store.

**Product features** (one per line, up to 20):

1. Texture pack editor: repaint blocks, items and mobs on their 3D models
2. Every Java Edition version from 1.6.1 to 26.3, plus Bedrock Edition
3. One-click styles that restyle a whole pack
4. Exports ready-to-use .zip (Java) and .mcpack (Bedrock) files
5. Texture pack converter: Java to Bedrock, Bedrock to Java, or another Java version
6. Merge up to eight texture packs into one
7. Skin editor with a live 3D preview, classic and slim arms
8. Bedrock skin pack maker
9. Custom Totem of Undying maker
10. Shader maker for Iris, OptiFine, vanilla Java and Bedrock Vibrant Visuals
11. Opens .zip, .mcpack, .mcaddon and skin .png files from File Explorer
12. Works offline after the first use
13. No account, no ads, nothing uploaded
14. Free and open source (MIT licence)

**Screenshots** (Desktop; 1920x1080 PNG; upload in this order; captions are optional, up to 200
characters):

| File | Caption |
| --- | --- |
| `docs/store/screenshots/02-texture-editor.png` | Repaint any block on its real 3D model |
| `docs/store/screenshots/03-texture-effects.png` | Restyle the whole pack in one click |
| `docs/store/screenshots/04-skin-editor.png` | Paint skins with a live 3D preview |
| `docs/store/screenshots/05-shader-maker.png` | Build shader packs with a live preview |
| `docs/store/screenshots/01-home.png` | Texture packs, skins and shaders for Java and Bedrock |

The Store needs at least one desktop screenshot of 1366x768 or larger (up to 10, PNG, under 50 MB
each); these are 1920x1080.

**Store logos** (under "Store logos" / "Additional art assets"):

| Slot | File | Size |
| --- | --- | --- |
| 1:1 Box art (recommended for Windows 10/11 display) | `docs/store/box-art-1080.png` | 1080x1080 |
| 2:3 Poster art (recommended for Windows 10/11 display) | `docs/store/poster-art-720x1080.png` | 720x1080 |
| 1:1 App tile icon (optional) | `docs/store/store-logo-300.png` | 300x300 |

The app's own Start menu, taskbar and tile icons are inside the package: PWABuilder makes all of
them (44x44 up to 310x310 and the 620x300 wide tile, at every scale) from the 1024px manifest
icon. Nothing to upload for those.

**Search terms** (up to 7): `texture pack`, `resource pack`, `skin editor`, `shader maker`,
`mcpack`, `pack converter`, `pixel art`

**Copyright and trademark info**: `© 2026 Skermiebro Tech Tips. Not an official Minecraft product.
Not approved by or associated with Mojang or Microsoft.`

**Developed by**: `Skermiebro Tech Tips`

Other languages: Partner Center can add listings in German, Spanish, Portuguese (Brazil) and
Japanese, matching the site's translated pages. Optional; English is used everywhere otherwise.

### Submission options › Notes for certification

> Texture Pack Maker is a progressive web app (https://texturepackmaker.com/) packaged with
> PWABuilder. No sign-in or test account is needed. To try it: open the app, choose Textures, keep
> the default Java 26.3 and choose Create pack; the game's textures download from Mojang (an internet
> connection is needed the first time). Paint a block and use Export to download a .zip. It is a
> fan-made tool and is not affiliated with Mojang or Microsoft; it downloads Mojang's own game files
> at the user's request and does not redistribute them.

Then **Submit to the Store**. Certification usually takes 24 to 48 hours (sometimes up to a few
days); Partner Center emails you the result.

---

## After publishing

- **Updates**: deploying the website updates the Store app too. Make a new PWABuilder package
  (with a higher App version and Classic package version) only when the app's identity or icons
  change, then submit it as an update with the new packages.
- **IARC rating ID**: once rated, Partner Center shows an IARC rating ID. It can go into the
  manifest as `"iarc_rating_id": "<id>"`.
- **Store link from the site**: the Store product ID (Product management › Product identity, e.g.
  `9NXXXXXXXXXX`) gives `https://apps.microsoft.com/detail/<id>`. To let the site know the Windows
  app is installed, add to the manifest:
  `"related_applications": [{ "platform": "windows", "id": "<Package family name>!App" }]`
  (keep `"prefer_related_applications": false`, so browsers still offer the web app).
- **Ratings prompt** (optional): navigating to `ms-windows-store://review/?ProductId=<id>` opens the
  Store's review dialog.

## Checking the app before and after submitting

```sh
npx tsx --test tests/unit/pwa-manifest.test.ts tests/unit/pwa-sw.test.ts
npm run build && NODE_PATH=$(npm root -g) node tests/e2e/seo/pwa.e2e.mjs dist
```

The E2E test checks Chrome's own installability verdict, the service worker, offline start of
every kind of page at the domain root and under a project path, the update notice, files shared to
the app and the install entries.

To redo the screenshots after a design change (needs the 26.3 game file fixtures, see
`tests/harness/seo/guide-screenshots.cjs`):

```sh
TO_FIXTURES=/path/to/fixtures NODE_PATH=$(npm root -g) node tests/harness/seo/store-screenshots.cjs
```

To redo the icons and Store logos: `npx tsx scripts/gen-icons.ts`.

---

## Optional later: Google Play

Android can install the web app from the browser already. A Google Play listing is possible with a
Trusted Web Activity (TWA), built by PWABuilder's **Android** package (which uses Google's
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)).

- Google Play developer account: one-time **$25**. New personal accounts must run a closed test
  with at least 12 testers for 14 days before they can publish to production.
- PWABuilder › Package for stores › **Android** › Google Play. Package ID e.g.
  `com.texturepackmaker.app`; signing key **New** for the first release. **Keep the
  `signing.keystore` and `signing-key-info.txt` from the zip safe**: every later update needs them.
- Upload the `.aab` to the Play Console. Set the target audience to 13+ (PWABuilder's advice for
  TWAs).
- **Digital Asset Links** (required, or the app shows a browser address bar): publish
  `public/.well-known/assetlinks.json`, served at
  `https://texturepackmaker.com/.well-known/assetlinks.json`, with the SHA-256 fingerprint of the
  **Play app signing key** (Play Console › Setup › App integrity › App signing) and of your upload
  key. That fingerprint only exists once the owner has created the app and its key, so the file
  isn't in the repo yet. PWABuilder's zip contains a starting `assetlinks.json`; add Google's
  fingerprint to it after the first upload.
- The deploy workflow uploads `dist/` with `actions/upload-pages-artifact`, which leaves out
  files and folders starting with a dot unless told otherwise: when adding `.well-known/`, set
  `include-hidden-files: true` on that step and check that the URL above answers after the deploy.
