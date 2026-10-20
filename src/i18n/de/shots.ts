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
  paint3d: {
    alt: 'Der Textur-Editor im 3D-Modus: Ein Ofenmodell füllt die Fläche, rote Striche sind direkt auf seine Vorderseite gemalt, daneben die flache Ofenfront-Textur mit denselben Strichen.',
    caption: 'Direkt auf den 3D-Ofen malen: Jede Seite bemalt die Textur, die sie zeigt.',
  },
  mobGear: {
    alt: 'Ein Pferdemodell im Textur-Editor mit Sattel und Lederrossharnisch, daneben die Auswahl für Fell, Abzeichen, Alter, Sattel und Rüstung.',
    caption: 'Mobs erscheinen auf ihren eigenen 3D-Modellen, mit Sätteln und Rüstungen, die du auch bemalen kannst.',
  },
  mobParts: {
    alt: 'Ein Zombie in Eisenrüstung, dessen Brustpanzer in der Teileliste ausgeblendet ist, damit sein Hemd in 3D bemalt werden kann.',
    caption: 'Blende ein Teil aus, hier den Brustpanzer, um zu bemalen, was es verdeckt.',
  },
  convertPack: {
    alt: 'Der Texture-Pack-Konverter mit einem gewählten Java-26.2-Pack (6 Texturen) und Bedrock Edition als Ziel, mit der Schaltfläche „Convert to Bedrock“.',
    caption: 'Wähle ein Pack und das Ziel der Umwandlung.',
  },
  convertResult: {
    alt: 'Das Ergebnis des Konverters: 4 von 6 Texturen von Java 26.2 zu Bedrock umgewandelt, mit Schaltflächen zum Herunterladen und Öffnen im Editor und Listen der übersprungenen Texturen samt Grund.',
    caption: 'Der Bericht zeigt, was umgewandelt wurde und warum etwas übersprungen wurde.',
  },
  mergeSettings: {
    alt: '„Merge Texture Packs“ mit drei Packs in Prioritätsreihenfolge (Top Pack, Extras und ein Java-1.12.2-Pack), dem Namen des zusammengeführten Packs, der Symbolwahl und Java 26.3 als Zielversion.',
    caption: 'Bring die Packs in Reihenfolge: Das oberste gewinnt jeden Konflikt.',
  },
  mergeResult: {
    alt: 'Das Ergebnis: 3 Packs zu einem zusammengeführt, mit einem Balken pro Pack für verwendete, zusammengeführte und nicht verwendete Dateien und der Liste der Konflikte.',
    caption: 'Das Ergebnis zeigt, wie viel von jedem Pack übernommen wurde, und jeden Konflikt.',
  },
  modelEditShape: {
    alt: 'Der Textur-Editor mit dem Diamantschwert in der Item-Liste: sein 16×16-Sprite im Pixel-Editor und im Tab „Preview“ das flache Schwert mit der Schaltfläche „Edit shape“ darunter.',
    caption: 'Zeig ein Item im Tab „Preview“ an und drücke „Edit shape“, um den Modell-Editor zu öffnen.',
  },
  modelSpriteStart: {
    alt: 'Der Modell-Editor mit dem Diamantschwert, einem flachen Sprite ohne Würfel: die Startpunkte „3D item from sprite“, „Full cube“, „Slab“, „Cross (plant)“ und „Empty“ in der 3D-Ansicht und im Tab „Model“.',
    caption: 'Ein flaches Item hat noch keine Würfel: Wähle „3D item from sprite“.',
  },
  model3dSword: {
    alt: 'Das Diamantschwert als 3D-Modell aus 19 Würfeln mit 1 Pixel Tiefe. Würfel 5 ist in der Liste gewählt und in der 3D-Ansicht mit Verschiebepfeilen zu sehen, mit Position (9, 11, 7,5) und Größe (5 × 1 × 1) im Tab „Cube“.',
    caption: 'Aus dem Sprite werden 19 Würfel. Wähle einen aus, um ihn zu verschieben, seine Größe oder seine Seiten zu ändern.',
  },
  modelDisplay: {
    alt: 'Der Tab „Display“ mit „Third person“: das 3D-Diamantschwert in der Hand eines Spielermodells und die Felder für Drehung (0, -90, 55), Position (0, 4, 0,5) und Größe (0,85) der rechten Hand.',
    caption: '„Display“ legt fest, wie das Modell gehalten, getragen und gezeigt wird, jeweils mit Vorschau.',
  },
  modelFlatInventory: {
    alt: 'Der Tab „Model“ mit eingeschaltetem „Flat in the inventory“, das das flache Symbol im Inventar, auf dem Boden und im Rahmen behält. Oben steht jetzt item/diamond_sword_3d.json.',
    caption: '„Flat in the inventory“ (ab 1.21.4) speichert die 3D-Form als zweites Modell für die Hand.',
  },
  modelBlock: {
    alt: 'Das Modell des Steinblocks als Treppenstufe: ein Würfel von 16×8×16 wie eine Stufe und ein zweiter Würfel von 16×8×8 auf seiner einen Hälfte, im Tab „Cube“ mit Position und Größe.',
    caption: 'Stein als Treppenstufe: der Startpunkt „Slab“ und ein weiterer Würfel.',
  },
});
