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
      description: 'Minecraft-Skin gratis online erstellen: 64×64-Vorlage in 2D oder 3D bemalen, breite oder schmale Arme wählen, in Java hochladen oder als Bedrock-Skinpaket.',
      label: 'Skin erstellen',
      blurb: 'Die 64×64-Vorlage bemalen und in Java oder als Bedrock-Skinpaket nutzen.',
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
  },
};
