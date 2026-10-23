// German page titles, descriptions and short names (see MetaTranslation in src/app/seo/meta.ts).

import type { MetaTranslation } from '../../app/seo/meta';
import { F, LATEST } from '../../app/content/facts';

export const META_DE: MetaTranslation = {
  pages: {
    '/': {
      title: 'Minecraft Texture Pack erstellen – kostenlos, Java & Bedrock',
      description: `Erstelle dein eigenes Minecraft Texture Pack: Blöcke auf echten 3D-Modellen bemalen, Effekte per Klick, Export als .zip oder .mcpack. Gratis, Java ${LATEST}.`,
      label: 'Start',
    },
    '/textures': {
      title: 'Texture Pack Editor – Ressourcenpaket erstellen (Java)',
      description: 'Jede Minecraft-Textur bearbeiten: Blöcke, Items und Mobs auf 3D-Modellen bemalen, PNGs hochladen oder alles per Klick umstylen. Export: .zip oder .mcpack.',
      label: 'Texture Packs',
    },
    '/texture-pack-converter': {
      title: 'Minecraft Texture Pack Konverter – Java zu Bedrock & zurück',
      description: 'Minecraft Texture Packs von Java zu Bedrock, von Bedrock zu Java oder zwischen Java-Versionen umwandeln oder PNGs zum .mcpack machen. Gratis im Browser.',
      label: 'Texture-Pack-Konverter',
    },
    '/merge-texture-packs': {
      title: 'Minecraft Texture Packs zusammenführen – Java & Bedrock',
      description: 'Mehrere Minecraft Texture Packs zu einer .zip oder einem .mcpack kombinieren. Reihenfolge festlegen, das oberste Pack gewinnt – wie im Spiel. Kostenlos.',
      label: 'Texture Packs zusammenführen',
    },
    '/pack-doctor': {
      title: 'Kaputtes Minecraft Texture Pack reparieren – Pack Doctor',
      description: 'Texture Pack funktioniert nicht? Pack Doctor prüft dein Java- oder Bedrock-Pack, erklärt jedes Problem und repariert es per Klick. Kostenlos.',
      label: 'Pack Doctor',
    },
    '/totem-maker': {
      title: 'Eigenes Minecraft Totem erstellen – Java & Bedrock',
      description: 'Mach aus jedem Minecraft-Skin ein Totem der Unsterblichkeit: PNG hochladen oder Namen eingeben, Stil wählen, als Java-.zip oder Bedrock-.mcpack laden.',
      label: 'Totem-Ersteller',
    },
    '/font-maker': {
      title: 'Minecraft Schriftart erstellen – eigene Schrift als Pack',
      description: 'Eigene Minecraft-Schrift: Pixelbuchstaben zeichnen oder TTF/OTF umwandeln, im Chat, auf Schildern und in Büchern testen, als .zip oder .mcpack laden.',
      label: 'Schriftart-Ersteller',
    },
    '/skins': {
      title: 'Minecraft Skin Editor & eigenes Skinpaket erstellen',
      description: 'Male deinen eigenen Minecraft-Skin in 2D oder 3D, mit breiten oder schmalen Armen. Export als PNG für Java oder als Bedrock-Skinpaket (.mcpack). Kostenlos.',
      label: 'Skins',
    },
    '/skin-pack-maker': {
      title: 'Minecraft Skinpaket erstellen – kostenlos als .mcpack',
      description: 'Eigenes Minecraft-Skinpaket online erstellen: Skins malen oder hochladen, breite und schmale Arme mischen und ein Bedrock-.mcpack herunterladen. Kostenlos.',
      label: 'Skinpaket-Ersteller',
    },
    '/cape-maker': {
      title: 'Minecraft Umhang erstellen – Cape Maker mit Elytren',
      description: 'Gestalte deinen eigenen Minecraft-Umhang und die Elytren auf der 64×32-Vorlage mit 3D-Vorschau. Download als PNG oder Elytren-Texture-Pack. Kostenlos.',
      label: 'Umhang-Ersteller',
    },
    '/shaders': {
      title: 'Minecraft Shader erstellen – Iris, OptiFine & ohne Mods',
      description: 'Shaderpakete für Iris oder OptiFine, Vanilla-Shader ohne Mods für Java oder Vibrant-Visuals-Pakete für Bedrock bauen, mit Presets, Reglern und 3D-Vorschau.',
      label: 'Shader',
    },
    '/help': {
      title: 'Texture Packs, Skins & Shader in Minecraft installieren',
      description: 'So installierst du Texture Packs, Skins und Shader in Minecraft Java und Bedrock auf PC, Mac, Handy und Konsole, findest den Ordner und behebst Fehler.',
      label: 'Hilfe',
    },
    '/about': {
      title: 'Über Texture Pack Maker – kostenlose Open-Source-Tools',
      description: 'Wer hinter Texture Pack Maker steckt, was die Seite ausmacht (jede Java-Version ab 1.6.1, Bedrock, Konverter, Open Source) und wie Daten privat bleiben.',
      label: 'Über uns',
    },
    '/privacy': {
      title: 'Datenschutz – Texture Pack Maker',
      description: 'Texture Pack Maker hat keine Konten, keine Werbung und kein Tracking. Packs, Skins und Shader bleiben auf deinem Gerät, nichts wird hochgeladen.',
      label: 'Datenschutz',
    },
    '/all': {
      title: 'Alle Minecraft-Tools für Packs, Skins und Shader',
      description: 'Alle kostenlosen Tools, Funktionen und Anleitungen von Texture Pack Maker an einem Ort: Texture Packs, 3D-Modelle, Sounds, Skins, Skinpakete und Shader.',
      label: 'Alles auf einen Blick',
    },
    '/guides': {
      title: 'Anleitungen zu Minecraft Texture Packs, Skins & Shadern',
      description: `Schritt-für-Schritt-Anleitungen zum Erstellen und Installieren von Minecraft Texture Packs, Skins und Shadern, plus jedes Pack-Format von 1.6.1 bis ${LATEST}.`,
      label: 'Anleitungen',
    },
  },
  guides: {
    'make-a-texture-pack': {
      title: 'Minecraft Texture Pack erstellen: Anleitung (Java & Bedrock)',
      h1: 'Minecraft Texture Pack erstellen – so geht’s',
      description: 'Eigenes Minecraft Texture Pack kostenlos erstellen: Version wählen, Texturen bemalen, als .zip mit pack.mcmeta (Java) oder .mcpack (Bedrock) exportieren.',
      label: 'Texture Pack erstellen',
      blurb: 'Version wählen, Texturen bemalen und ein Pack exportieren, das Minecraft lädt.',
    },
    'install-resource-packs': {
      title: 'Minecraft Texture Pack installieren (Java & Bedrock)',
      h1: 'Minecraft Texture Packs, Shader und .mcpack-Dateien installieren',
      description: 'Ressourcenpaket in Java installieren, Bedrock-.mcpack auf PC oder Handy importieren, Shader mit Iris oder OptiFine nutzen und fehlende Packs reparieren.',
      label: 'Packs & Shader installieren',
      blurb: 'Java-Ressourcenpakete, Bedrock-.mcpack-Dateien und Shaderpakete, plus Lösungen.',
    },
    'texture-pack-not-working': {
      title: 'Minecraft Texture Pack funktioniert nicht? Die Lösungen',
      h1: 'Minecraft Texture Pack funktioniert nicht? So behebst du es',
      description: 'Pack fehlt in der Liste, „für eine ältere Version erstellt“, lila-schwarze Blöcke, graues Gras, Import schlägt fehl: was dahintersteckt und wie du es löst.',
      label: 'Pack geht nicht? Lösungen',
      blurb: 'Fehlende Packs, Versionswarnungen, lila-schwarze Blöcke und weitere Lösungen.',
    },
    'minecraft-pack-format-versions': {
      title: `Minecraft Pack Format ${LATEST} (${F(LATEST)}) und alle Java-Versionen`,
      h1: `Minecraft Pack Format für jede Java-Version (${LATEST} nutzt ${F(LATEST)})`,
      description: `Jede Minecraft-Java-Version von 1.6.1 bis ${LATEST} mit ihrem Ressourcenpaket-Format (${LATEST} nutzt ${F(LATEST)}) und wie sich pack.mcmeta über die Jahre verändert hat.`,
      label: 'Pack-Formate aller Versionen',
      blurb: `Das Pack-Format jeder Java-Version von 1.6.1 bis ${LATEST}.`,
    },
    'make-a-skin': {
      title: 'Eigenen Minecraft Skin erstellen (Java & Bedrock)',
      h1: 'Eigenen Minecraft Skin erstellen',
      description: 'Minecraft-Skin gratis online erstellen: 64×64- oder HD-128×128-Vorlage in 2D oder 3D bemalen, breite oder schmale Arme wählen, für Java oder Bedrock.',
      label: 'Skin erstellen',
      blurb: 'Die Vorlage mit 64×64 oder HD 128×128 bemalen, für Java oder ein Bedrock-Skinpaket.',
    },
    'make-shaders-without-mods': {
      title: 'Minecraft Shader ohne Mods oder OptiFine (Java & Bedrock)',
      h1: 'Gibt es Minecraft Shader ohne Mods?',
      description: 'Ja: Ressourcenpakete ab Java 1.17 ersetzen die Shader des Spiels (ohne OptiFine oder Iris), Bedrock hat Vibrant Visuals. Was geht, was nicht, und wie.',
      label: 'Shader ohne Mods',
      blurb: 'Was Vanilla-Shaderpakete für Java und Vibrant Visuals in Bedrock können.',
    },
    'java-vs-bedrock-packs': {
      title: 'Java vs. Bedrock Texture Packs: Unterschiede & Umwandlung',
      h1: 'Java- vs. Bedrock-Texture-Packs: Unterschiede und Umwandlung',
      description: 'Laufen Java Texture Packs auf Bedrock? Nein: Java nutzt .zip + pack.mcmeta, Bedrock .mcpack + manifest.json. Ordner, Namen, Shader und Skins im Vergleich.',
      label: 'Java- vs. Bedrock-Packs',
      blurb: 'Dateien, Ordner, Formate, Shader und Skins im direkten Vergleich.',
    },
    'bedrock-vibrant-visuals-settings': {
      title: 'Minecraft Bedrock: Vibrant-Visuals-Einstellungen erklärt',
      h1: 'Vibrant-Visuals-Einstellungen in Bedrock erklärt',
      description: 'Was ein Vibrant-Visuals-Paket in Bedrock ändern kann (Sonne, Himmel, Nebel, Wasser, Schatten, Farben), welche Geräte es können und wie du es einschaltest.',
      label: 'Vibrant-Visuals-Einstellungen',
      blurb: 'Sonne, Himmel, Nebel, Wasser und Farben, plus unterstützte Geräte.',
    },
    'convert-java-to-bedrock-texture-pack': {
      title: 'Java Texture Pack in Bedrock umwandeln (und zurück)',
      h1: 'Java Texture Pack in Bedrock umwandeln – so geht’s',
      description: 'Java-Texture-Pack kostenlos in ein Bedrock-.mcpack umwandeln (oder Bedrock zu Java): was sich umwandeln lässt, was nicht und wie du es installierst.',
      label: 'Java zu Bedrock umwandeln',
      blurb: 'Ein Java-Pack mit wenigen Klicks zum Bedrock-.mcpack machen, oder zurück.',
    },
    'merge-texture-packs': {
      title: 'Minecraft Texture Packs zusammenführen: Anleitung',
      h1: 'So führst du Minecraft Texture Packs zusammen',
      description: 'Mehrere Texture Packs zu einem kombinieren, für Server, Realm oder zum Teilen: welches Pack gewinnt, was zusammengeführt wird, online oder von Hand.',
      label: 'Texture Packs zusammenführen',
      blurb: 'Mehrere Packs zu einem kombinieren, in der Reihenfolge, die du wählst.',
    },
    'make-a-bedrock-skin-pack': {
      title: 'Minecraft Bedrock Skinpaket erstellen (gratis, .mcpack)',
      h1: 'Minecraft-Bedrock-Skinpaket erstellen – so geht’s',
      description: 'Eigenes Skinpaket für Minecraft Bedrock: Skins malen oder hochladen, als .mcpack exportieren, am PC oder Handy importieren, updaten oder selbst bauen.',
      label: 'Bedrock-Skinpaket erstellen',
      blurb: 'Deine Skins in einem .mcpack bündeln und im Ankleidezimmer tragen.',
    },
    'make-3d-items-texture-pack': {
      title: '3D-Items im Minecraft Texture Pack erstellen (Java)',
      h1: '3D-Items und eigene Modelle im Minecraft Texture Pack erstellen',
      description: 'Flache Minecraft-Items zu 3D-Modellen machen und Blockformen im Java-Ressourcenpaket ändern: Modell-JSON, Item-Definitionen ab 1.21.4, Haltung, Lösungen.',
      label: '3D-Items erstellen',
      blurb: 'Flache Items zu 3D-Modellen machen und Blockformen ändern, Datei für Datei.',
    },
    'make-a-pvp-texture-pack': {
      title: 'PvP-Texture-Pack für Minecraft erstellen (Java & Bedrock)',
      h1: 'PvP-Texture-Pack für Minecraft erstellen',
      description: 'Minecraft-PvP-Texture-Pack gratis erstellen: niedriges Feuer, klares Glas, kleinere Schwerter, eigenes Fadenkreuz und 8×-FPS-Texturen, für 1.8.9 bis 26.3.',
      label: 'PvP-Pack erstellen',
      blurb: 'Niedriges Feuer, klares Glas, kleinere Schwerter, Fadenkreuz und FPS-Texturen.',
    },
    'make-a-pbr-texture-pack': {
      title: 'PBR-Texture-Pack für Vibrant Visuals und Shader erstellen',
      h1: 'PBR-Texture-Pack für Vibrant Visuals und Shader erstellen',
      description: 'Minecraft-PBR-Texture-Pack gratis erstellen: Glanz, Metall, Leuchten und Relief als Texture-Sets für Vibrant Visuals und labPBR-Maps für Iris und OptiFine.',
      label: 'PBR-Pack erstellen',
      blurb: 'Glanz, Metall, Leuchten und Relief für Vibrant Visuals und labPBR-Shader.',
    },
    'rename-items-texture-pack': {
      title: 'Item-Textur durch Umbenennen ändern (Minecraft)',
      h1: 'Items umbenennen und ihre Textur ändern',
      description: 'Erstelle gratis ein Minecraft-Pack, in dem umbenannte Items anders aussehen: Item-Definitionen für Java 1.21.5+, OptiFine-CIT für ältere Versionen.',
      label: 'Items umbenennen',
      blurb: 'Gib einem umbenannten Item eine eigene Textur, etwa einem Schwert namens „Excalibur“.',
    },
  },
};
