// German alt texts and captions of the screenshots (the images themselves show the English app).

import { localShots } from '../../app/content/shots';

export const SHOTS = localShots({
  newPack: {
    alt: 'Das Formular „New texture pack“: Name My First Pack, Edition Java, Version Java 26.3 (Pack-Format 97.1), Auflösung 32× und eine Beschreibung, daneben das Feld zum Öffnen eines Packs.',
    caption: 'Gib dem Pack einen Namen und wähle Edition, Spielversion und Auflösung.',
  },
  editor: {
    alt: 'Der Textur-Editor mit der Ofenfront im 16×16-Pixel-Editor, orange Striche um die Feueröffnung, dieselbe Farbe auf dem 3D-Modell des Ofens in der Vorschau.',
    caption: 'Die Ofenfront bemalen: Die 3D-Vorschau zeigt die Änderung am echten Blockmodell.',
  },
  effects: {
    alt: 'Der Tab „Effects“ mit dem Preset Autumn: Vorher-nachher-Streifen umgefärbter Texturen, Moosblöcke in der Blockliste in Orangebraun.',
    caption: 'Effekte wie Autumn gestalten mit einem Klick jede Textur um.',
  },
  packSettings: {
    alt: 'Die Karte zur Spielversion im Tab „Pack“: Das Pack ist für Java 26.3 (Pack-Format 97.1) gemacht und funktioniert auch von Java 1.21 (Pack-Format 34) bis 26.3.',
    caption: 'Mit einem Kompatibilitätsbereich lädt ein Pack in mehreren Java-Versionen.',
  },
  export: {
    alt: 'Der Exportdialog für My First Pack.zip: eine bearbeitete Textur, die Autumn-Effekte, gemacht für Java 26.3 mit Pack-Format 97.1, läuft in 1.21 bis 26.3, und eine Schaltfläche „Export .zip“.',
    caption: 'Der Exportdialog fasst zusammen, was ins Pack kommt, bevor du es herunterlädst.',
  },
  openPack: {
    alt: 'Ein vorhandenes Pack aus einer .zip geöffnet: Der Filter „Edited“ zeigt seine drei geänderten Texturen, die blau getönte Stein-Textur ist im Pixel-Editor und auf einem 3D-Steinblock zu sehen.',
    caption: 'Eine vorhandene .zip öffnen: Die geänderten Texturen des Packs sind aufgelistet und bereit zum Bearbeiten.',
  },
  skin2d: {
    alt: 'Der Skin-Editor auf der 64×64-Vorlage mit beschrifteten Körperbereichen und Spiegelmalen, blaue und gelbe Striche auf Brust und Armen, rechts die 3D-Vorschau des Skins.',
    caption: 'Malen auf der 64×64-Vorlage mit Spiegelung, während sich das 3D-Modell mitändert.',
  },
  skin3d: {
    alt: 'Der Skin-Editor im 3D-Malmodus: Das Modell ist leicht gedreht, sein linker Arm über die Körperteil-Figur ausgeblendet, rote Farbe auf der Brust.',
    caption: 'Direkt auf das 3D-Modell malen, mit ausgeblendetem Arm, um an den Körper zu kommen.',
  },
  skinPack: {
    alt: 'Der Dialog „Make a skin pack“: Packname Adventure Crew mit drei Skins, Wizard (breite Arme, dieser Skin), Robot (schmale Arme) und Explorer (breite Arme), und eine Schaltfläche „Download pack“.',
    caption: 'Drei Skins, breit und schmal, in einem Bedrock-Skinpaket.',
  },
  shaderVanilla: {
    alt: 'Der Shader Maker für Vanilla Java mit Reglern für Farbe und Ton (Helligkeit, Kontrast, Sättigung) neben einer 3D-Live-Vorschau einer Grasinsel.',
    caption: 'Ein Vanilla-Java-Shaderpaket: Farbregler mit Live-Vorschau, ganz ohne Mods.',
  },
  shaderIris: {
    alt: 'Der Shader Maker für Iris und OptiFine bei Sonnenuntergang: warmes, flaches Licht und lange Schatten in der Vorschau, dazu Presets und ein Regler für die Sonnenstärke.',
    caption: 'Ein Iris-/OptiFine-Shaderpaket mit echten Schatten in der Vorschau bei Sonnenuntergang.',
  },
  vibrantVisuals: {
    alt: 'Der Shader Maker für Bedrock Vibrant Visuals: helle Vorschau mit blauem Himmel, Presets, ein Regler für die Sonnenhelligkeit und Hinweise, dass keine Mods nötig sind.',
    caption: 'Ein Vibrant-Visuals-Paket für Bedrock mit Live-Vorschau erstellen.',
  },
});
