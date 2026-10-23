// German guides (see GuideText in src/tools/guides/content.ts). Facts come from the app data
// (src/app/content/facts.ts), menu names from the German game files.

import { el, type Child, type ElNode } from '../../app/markup';
import { callout, code, ext, figure, folderTable, link, steps, strong, tabbed, toolCallout, uiPath } from '../../app/content/blocks';
import { F, LATEST, MIN_ENGINE, NEXT_SNAPSHOT, formatGroups, formatParts, maxFormat, mcmetaFor, mcmetaLegacy, mcmetaRange, minFormat } from '../../app/content/facts';
import type { GuideText, GuidesIndexText } from '../../tools/guides/content';
import { SHOTS } from './shots';
import { UI_DE } from './ui';
import { SKIN_PACK_LANG, SKIN_PACK_MANIFEST, SKIN_PACK_SKINS_JSON, SKIN_PACK_TREE } from '../../tools/guides/skin-pack-files';
import { MODEL_BLOCK_EXAMPLE, MODEL_FILES, MODEL_FLAT_DEFINITION, MODEL_SPRITE_CUBE, MODEL_STONE_BLOCKSTATE } from '../../tools/guides/model-files';
import { PVP_EXAMPLE_FILES, PVP_SWORD_189, PVP_SWORD_LATEST } from '../../tools/guides/pvp-files';
import { PBR_MANIFEST, PBR_TEXTURE_SET, PBR_UNIFORM_SET } from '../../tools/guides/pbr-files';
import { NAMES_CIT, NAMES_DEFINITION, NAMES_MODEL } from '../../tools/guides/names-files';

const p = (...c: Child[]): ElNode => el('p', null, ...c);
const ul = (items: Child[]): ElNode => el('ul', { class: 'guide-list' }, items.map((i) => el('li', null, i)));
const pre = (text: string): ElNode => el('pre', { class: 'guide-code' }, el('code', null, text));
const h3 = (text: string): ElNode => el('h3', { class: 'guide-sub' }, text);
const table = (head: string[], rows: Child[][], cls = 'guide-table'): ElNode =>
  el(
    'div',
    { class: 'table-scroll' },
    el(
      'table',
      { class: cls },
      el('thead', null, el('tr', null, head.map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', null, rows.map((r) => el('tr', null, r.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, c) : el('td', null, c)))))),
    ),
  );
const FOLDER = UI_DE.folderTable;
const OPTIONS = 'Optionen …';
const PACKS = 'Ressourcenpakete …';
const OPEN_FOLDER = 'Paketordner öffnen';

export const GUIDES_INDEX: GuidesIndexText = {
  eyebrow: 'Anleitungen',
  title: 'Anleitungen zu Minecraft Packs, Skins und Shadern',
  lead: 'Klare, geprüfte Antworten für Minecraft-Creator: wie du Texture Packs, Skins und Shader für Java und Bedrock erstellst und installierst, und welches Pack-Format jede Java-Version braucht.',
  more: ['Suchst du Schritt-für-Schritt-Installationsanleitungen für jede Plattform? Sieh dir die ', link('/help', 'Installationsanleitung & FAQ'), ' an.'],
};

// ---------------------------------------------------------------- shared steps

const MAKE_PACK_STEPS: Child[] = [
  ['Öffne den ', link('/textures', 'Texture Pack Maker'), ', gib deinem Pack einen Namen und wähle Java oder Bedrock, deine Spielversion und eine Auflösung. Klicke dann auf ', strong('Pack erstellen'), '.'],
  'Such eine Textur über das Suchfeld oder die Kategorien und bemale sie im Pixel-Editor neu, oder lade ein eigenes PNG hoch.',
  'Optional: Gestalte das ganze Pack mit Effekten per Klick um, etwa Dark Mode, Pastel oder Retro 8-bit.',
  ['Öffne den Tab ', strong('Pack'), ', um Beschreibung und Symbol festzulegen, und exportiere dann eine ', code('.zip'), ' (Java) oder ein ', code('.mcpack'), ' (Bedrock).'],
  ['Installiere das Pack in Minecraft und teste es. ', link('/guides/install-resource-packs', 'So installierst du es'), '.'],
];

const INSTALL_JAVA_STEPS: Child[] = [
  ['Starte Minecraft Java Edition und öffne ', uiPath(OPTIONS, PACKS), '.'],
  ['Klicke auf ', uiPath(OPEN_FOLDER), '. Der Ordner ', code('resourcepacks'), ' öffnet sich.'],
  ['Leg die ', code('.zip'), ' des Packs in den Ordner (nicht entpacken). Du kannst sie auch auf den Bildschirm „Ressourcenpakete“ ziehen.'],
  ['Verschiebe das Pack mit dem Pfeil von ', strong('Verfügbar'), ' nach ', strong('Ausgewählt'), ' und setz es nach ganz oben, wenn du mehrere Packs nutzt. Klicke auf ', strong('Fertig'), '.'],
];

const SKIN_STEPS: Child[] = [
  ['Öffne den ', link('/skins', 'Skin Maker'), ' und wähle einen Startpunkt: einen leeren Skin, eine farbcodierte Vorlage, einen Start-Charakter, ein PNG, das du schon hast, den Skin eines Java-Spielers per Benutzername oder einen der Standard-Skins.'],
  'Wähle die Armform: breit (4 Pixel) oder schmal (3 Pixel).',
  'Male auf der 64×64-Vorlage oder wechsle zu 3D und male direkt auf das Modell. Blende Körperteile aus, um an die Seiten darunter zu kommen. Mit Spiegeln bemalst du beide Arme oder Beine gleichzeitig, und fertige Teile kannst du sperren.',
  'Gib dem Skin mit der Außenebene Tiefe: Hüte, Haare, Jacken, Ärmel und Hosenbeine sitzen leicht über dem Körper.',
  ['Exportiere ein ', code('.png'), ' für Java (plus eine 64×32-Kopie für 1.7.10 und älter) oder ein Skinpaket ', code('.mcpack'), ' für Bedrock.'],
  'Hochladen: im Minecraft Launcher (Java) oder indem du das .mcpack öffnest und den Skin im Ankleidezimmer wählst (Bedrock).',
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Öffne den ', link('/shaders', 'Shader Maker'), ' und wähle ', strong('Vanilla Java'), '.'],
  `Wähle genau die Minecraft-Version, die du spielst (Java 1.17 oder neuer; ${LATEST} ist voreingestellt).`,
  'Starte mit einem Preset und stelle Helligkeit, Kontrast, Farbe, Vignette und Nebel ein, während sich die Vorschau aktualisiert.',
  ['Exportiere die ', code('.zip'), ' und installiere sie wie jedes Ressourcenpaket: ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), '.'],
];

// ---------------------------------------------------------------- guides

const makeATexturePack: GuideText = {
  image: SHOTS.editor,
  intro: [
    p(
      'Ein Minecraft Texture Pack ersetzt die Bilder des Spiels (Blöcke, Items, Mobs, Himmel und Menüs) durch deine eigenen. Die Java Edition nennt Texture Packs ',
      el('em', null, 'Ressourcenpakete'),
      ': eine ',
      code('.zip'),
      ' mit einer ',
      code('pack.mcmeta'),
      '-Datei und PNG-Bildern unter denselben Pfaden wie die Originale. Bedrock nutzt ',
      code('.mcpack'),
      '-Dateien mit einer ',
      code('manifest.json'),
      '. Beides kannst du in wenigen Minuten im Browser erstellen.',
    ),
  ],
  quick: {
    title: 'Die Kurzfassung',
    items: ['Wähle Java oder Bedrock und die Version, die du spielst.', 'Bemale Texturen neu, lade eigene Bilder hoch oder nutze einen Effekt per Klick.', 'Exportiere das Pack und zieh es in Minecraft.'],
  },
  howto: { name: 'Minecraft Texture Pack mit Texture Pack Maker erstellen', steps: MAKE_PACK_STEPS },
  sections: [
    {
      id: 'step-1',
      title: 'Schritt 1 – Pack anlegen und Version wählen',
      body: [
        p(MAKE_PACK_STEPS[0]),
        ul([
          [strong('Edition: '), 'Java Edition (PC, Mac und Linux über den Minecraft Launcher) oder Bedrock Edition (Windows, Handys, Tablets und Konsolen). Die beiden brauchen unterschiedliche Dateien, also leg pro Edition ein Projekt an. ', link('/guides/java-vs-bedrock-packs', 'Welche habe ich?')],
          [strong('Version: '), `Java ${LATEST} ist voreingestellt; jede Version bis zurück zu 1.6.1 funktioniert, ein Pack für 1.21.11, 26.2 oder 1.8.9 ist also genauso schnell gemacht. Das Pack bekommt die passende `, code('pack.mcmeta'), ' für diese Version.'],
          [strong('Auflösung: '), '16× ist der Vanilla-Look (16×16 Pixel pro Blockseite). 32× und 64× lassen Platz für mehr Details; 128× und mehr sind für realistische Packs.'],
        ]),
        p('Dein Browser lädt dann die Originaltexturen dieser Version direkt von Mojang und behält sie auf deinem Gerät, damit das nächste Pack sofort startet.'),
        figure(SHOTS.newPack),
      ],
    },
    {
      id: 'step-2',
      title: 'Schritt 2 – Texturen finden und neu bemalen',
      body: [
        p(MAKE_PACK_STEPS[1]),
        p(
          'Jede Textur wird auf ihrem echten 3D-Modell gezeigt: Ein Ofen zeigt Vorderseite, Seiten und Oberseite, Treppen und Stufen ihre Form, Mobs ihre Körperteile. Male mit Stift, Füllen, Linie, Formen, Rauschen und Farbwähler, spiegle deine Striche und mach alles rückgängig. Die Kachelvorschau zeigt, wie sich ein Block auf dem Boden wiederholt, damit keine Kanten sichtbar sind.',
        ),
        p(
          'Lieber den Block beim Malen sehen? Schalte den Editor auf ',
          strong('3D'),
          ' (oder drücke D) und male direkt auf das Modell: Jede Seite bemalt die Textur, die sie zeigt. Zieh am Hintergrund oder nutze zwei Finger, um den Block zu drehen. Mob-Texturen funktionieren genauso: Wähle Mobs in der Texturliste und blende Körperteile aus, um an die Seiten darunter zu kommen.',
        ),
        p(
          'In Java kannst du auch Formen ändern: Drücke im Tab Preview auf ',
          strong('Form bearbeiten'),
          ', um aus einem flachen Item ein 3D-Item zu machen oder einen Block umzuformen. ',
          link('/guides/make-3d-items-texture-pack', '3D-Items erstellen'),
          '.',
        ),
        p('Ein Pack für PvP oder mehr FPS? Wähle beim Erstellen ', strong('PvP-/FPS-Pack'), ', dann schaltet der Editor niedriges Feuer, klares Glas, ein saubereres Fadenkreuz und kleinere Schwerter für dich ein. ', link('/guides/make-a-pvp-texture-pack', 'PvP-Texture-Pack erstellen'), '.'),
        ul([
          'Fang mit Blöcken an, die du ständig siehst: Gras, Erde, Stein, Stämme und Bretter.',
          'Gras, Laub, Ranken und Wasser sind in Grau gespeichert und werden vom Spiel je nach Biom eingefärbt. Halte sie hellgrau.',
          'Animierte Texturen wie Wasser, Lava und Seelaternen lassen sich Bild für Bild bearbeiten.',
        ]),
        figure(SHOTS.editor),
      ],
    },
    {
      id: 'step-3',
      title: 'Schritt 3 – Das ganze Pack per Klick umgestalten (optional)',
      body: [
        p(MAKE_PACK_STEPS[2]),
        p('Effekte stapeln sich übereinander und über deine eigene Malerei, ohne sie zu verändern, und werden beim Export auf jede Textur angewendet. Kombiniere Autumn mit Smooth HD oder Dark Mode mit Neon Outline und male dann von Hand weiter.'),
        figure(SHOTS.effects),
      ],
    },
    {
      id: 'step-4',
      title: 'Schritt 4 – Symbol und Beschreibung hinzufügen, dann exportieren',
      body: [
        p(MAKE_PACK_STEPS[3]),
        p(
          'In Java kannst du zusätzlich einen Kompatibilitätsbereich wählen, damit ein Pack in mehreren Versionen ohne die Warnung „für eine ältere Version erstellt“ lädt. Der Export schreibt jede Datei, die das Spiel braucht: ',
          code('pack.mcmeta'),
          ' und ',
          code('pack.png'),
          ' in Java, oder ',
          code('manifest.json'),
          ' mit frischen eindeutigen IDs und ',
          code('pack_icon.png'),
          ' in Bedrock.',
        ),
        figure(SHOTS.packSettings),
        figure(SHOTS.export),
      ],
    },
    {
      id: 'step-5',
      title: 'Schritt 5 – Installieren und testen',
      body: [
        p(MAKE_PACK_STEPS[4]),
        ul([
          ['Java: Öffne ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ', leg die ', code('.zip'), ' hinein (nicht entpacken) und verschiebe das Pack nach ', strong('Ausgewählt'), '. Drücke im Spiel F3 + T, um nach Änderungen neu zu laden.'],
          ['Bedrock: Öffne das ', code('.mcpack'), ' und aktiviere es unter ', uiPath('Einstellungen', 'Globale Ressourcen'), '.'],
        ]),
        p('Sieht etwas falsch aus? ', link('/guides/texture-pack-not-working', 'Texture Pack funktioniert nicht: Lösungen'), '.'),
      ],
    },
    {
      id: 'inside',
      title: 'Was steckt in einem Texture Pack?',
      body: [
        h3('Java Edition (.zip)'),
        ul([
          [code('pack.mcmeta'), ' im Hauptverzeichnis der Zip (Pflicht): die Beschreibung des Packs und die Spielversionen, für die es gemacht ist.'],
          [code('pack.png'), ' (optional): das Symbol in der Pack-Liste. Minecrafts eigenes ist 128×128 groß und wird mit 32×32 angezeigt.'],
          [code('assets/minecraft/textures/…'), ': deine Bilder, mit denselben Ordnern und Dateinamen wie die Originale, zum Beispiel ', code('assets/minecraft/textures/block/stone.png'), '. Versionen vor 1.13 nutzen die Ordner ', code('blocks'), ' und ', code('items'), ' statt ', code('block'), ' und ', code('item'), '.'],
          ['Animierte Texturen haben eine passende ', code('.png.mcmeta'), '-Datei neben dem Bild.'],
        ]),
        h3('Bedrock Edition (.mcpack)'),
        ul([
          [code('manifest.json'), ' im Hauptverzeichnis (Pflicht): der Name, zwei eindeutige IDs, eine Versionsnummer, die mit jedem Update steigt, und die älteste unterstützte Spielversion (hier standardmäßig ', code(`"min_engine_version": ${MIN_ENGINE}`), ').'],
          [code('pack_icon.png'), ' (optional): das Symbol des Packs.'],
          ['Texturen unter ', code('textures/'), ', zum Beispiel ', code('textures/blocks/stone.png'), '. Manche Vanilla-Texturen sind ', code('.tga'), '-Dateien; behalte Namen und Endung des Originals bei.'],
        ]),
        callout('tip', 'Dateinamen sind wichtig', 'Minecraft ersetzt eine Textur nur, wenn deine Datei genau denselben Pfad hat wie das Original. In Java müssen Pfade kleingeschrieben sein (a-z, 0-9, _ - . und /). Der Texture Pack Maker erledigt das für dich.'),
        h3('Ordnerstruktur im Vergleich'),
        pre(
          [
            'Java: MyPack.zip',
            '├── pack.mcmeta',
            '├── pack.png',
            '└── assets/minecraft/textures/',
            '    ├── block/stone.png',
            '    └── item/diamond_sword.png',
            '',
            'Bedrock: MyPack.mcpack',
            '├── manifest.json',
            '├── pack_icon.png',
            '└── textures/',
            '    ├── blocks/stone.png',
            '    └── items/diamond_sword.png',
          ].join('\n'),
        ),
        table(
          ['', 'Java pack.mcmeta', 'Bedrock manifest.json'],
          [
            ['Pflicht', 'Ja, ganz oben in der Zip', 'Ja, ganz oben im .mcpack'],
            ['Erkennt das Pack an', 'Seinem Datei- oder Ordnernamen', 'Zwei eindeutigen IDs (UUIDs)'],
            ['Spielversion', `Pack-Format-Nummern (${LATEST} nutzt ${F(LATEST)})`, [code('min_engine_version'), ', die älteste unterstützte Spielversion']],
            ['Updates', 'Datei ersetzen', 'Versionsnummer erhöhen, IDs behalten'],
          ],
        ),
      ],
    },
    {
      id: 'mcmeta',
      title: 'Die Datei pack.mcmeta (Java)',
      body: [
        p('Diese Datei sagt Minecraft, für welche Versionen das Pack gedacht ist. Die Format-Nummer ändert sich mit fast jedem Update: Java ', LATEST, ' nutzt das Ressourcenpaket-Format ', strong(F(LATEST)), '. Ein Pack nur für ', LATEST, ' sieht so aus:'),
        pre(mcmetaFor(LATEST, `Mein Pack für Minecraft ${LATEST}`)),
        p(
          'Seit 1.21.9 geben Packs einen Bereich mit ',
          code('min_format'),
          ' und ',
          code('max_format'),
          ' an. Ein Pack, das auch in älteren Versionen laden soll, braucht zusätzlich ',
          code('pack_format'),
          ' und ',
          code('supported_formats'),
          '. Der Texture Pack Maker schreibt die richtige Kombination für Version und Bereich, die du wählst. Siehe ',
          link('/guides/minecraft-pack-format-versions', 'das Pack-Format jeder Version'),
          '.',
        ),
        callout('warn', 'Beschreibung fehlt?', `In Java ${LATEST} wird ein Pack, dessen pack.mcmeta keine Beschreibung hat oder kein gültiges JSON ist, gar nicht angezeigt. Lass die pack.mcmeta auf der obersten Ebene der Zip, nicht in einem Ordner.`),
      ],
    },
    {
      id: 'by-hand',
      title: 'Ein Texture Pack von Hand erstellen',
      body: [
        p('Du kannst ein Pack auch selbst mit einem beliebigen Bildprogramm bauen. Das dauert länger, zeigt aber, wie ein Pack funktioniert:'),
        h3('Java Edition'),
        steps([
          ['Original-Texturen finden: Kopiere ', code('versions/<version>/<version>.jar'), ' aus deinem Ordner ', code('.minecraft'), ', benenne die Kopie in ', code('.zip'), ' um und öffne sie. Die Bilder liegen in ', code('assets/minecraft/textures'), '.'],
          ['Leg einen neuen Ordner für dein Pack an, mit einer ', code('pack.mcmeta'), ' (siehe unten) und denselben Ordnern ', code('assets/minecraft/textures/…'), ' wie die Originale.'],
          'Kopiere nur die PNGs hinein, die du ändern willst, und bearbeite sie – Namen behalten, Größen im gleichen Verhältnis (16×16, 32×32 und so weiter).',
          ['Packe den ', strong('Inhalt'), ' des Ordners als Zip, nicht den Ordner selbst, damit ', code('pack.mcmeta'), ' ganz oben in der Zip liegt. Leg die Zip in ', code('resourcepacks'), '.'],
        ]),
        h3('Bedrock Edition'),
        steps([
          ['Hol dir die Original-Texturen aus Mojangs Repository ', ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'), ' (', code('resource_pack/textures'), ').'],
          ['Leg einen Ordner mit einer ', code('manifest.json'), ' an, die zwei neue eindeutige IDs (UUIDs) enthält, und deine bearbeiteten Bilder unter ', code('textures/'), '.'],
          ['Packe den Inhalt des Ordners als Zip und benenne die Datei von ', code('.zip'), ' in ', code('.mcpack'), ' um. Öffne sie dann zum Importieren.'],
        ]),
        callout('tip', 'Spar dir die Fleißarbeit', 'Der Texture Pack Maker übernimmt Kopieren, Ordnernamen, pack.mcmeta, UUIDs und Zippen für dich und zeigt jede Textur beim Malen auf ihrem 3D-Modell.'),
      ],
    },
    {
      id: 'tips',
      title: 'Tipps für ein gutes Pack',
      body: [
        ul([
          'Fang klein an: Bemale ein paar Blöcke, die du ständig siehst (Gras, Erde, Stein, Holz), und teste im Spiel, bevor du alles machst.',
          'Behalte im ganzen Pack dieselbe Auflösung. Gemischte 16×- und 64×-Texturen wirken uneinheitlich.',
          'Prüfe mit der 3D-Blockvorschau, wie die Seiten eines Blocks zusammenpassen.',
          'Nutze die Kachelvorschau für Blöcke, die sich wiederholen, damit keine Kanten zu sehen sind.',
          'Setz dein Pack in der Liste „Ausgewählt“ ganz nach oben. Packs weiter oben gewinnen.',
        ]),
      ],
    },
  ],
  faq: [
    {
      id: 'both',
      q: 'Funktioniert ein Texture Pack in Java und Bedrock?',
      a: [p('Nein. Die beiden Editionen nutzen unterschiedliche Dateien und Ordner. Erstelle das Pack für eine Edition und wandle es dann mit dem ', link('/texture-pack-converter', 'Texture-Pack-Konverter'), ' in die andere um. ', link('/guides/java-vs-bedrock-packs', 'Java- vs. Bedrock-Packs'), '.')],
    },
    {
      id: 'free',
      q: 'Muss ich Software installieren?',
      a: [p('Nein. Texture Pack Maker läuft im Browser auf Computer, Handy oder Tablet, und nichts wird hochgeladen.')],
    },
    {
      id: 'edit',
      q: 'Kann ich ein vorhandenes Texture Pack ändern?',
      a: [p('Ja. Wähle im Texture Pack Maker ', strong('Pack öffnen'), ' und such dir eine ', code('.zip'), ' oder ein ', code('.mcpack'), ' aus. Du kannst weiter daran arbeiten und erneut exportieren.'), figure(SHOTS.openPack)],
    },
    {
      id: 'code',
      q: 'Muss ich programmieren können, um ein Texture Pack zu erstellen?',
      a: [p('Nein. Ein Texture Pack besteht aus Bildern und einer kleinen Beschreibungsdatei, und die schreibt der Texture Pack Maker für dich. Du musst nur malen.')],
    },
    {
      id: 'older',
      q: 'Wie erstelle ich ein Texture Pack für eine ältere Version wie 1.21.11 oder 1.8.9?',
      a: [p('Wähle diese Version beim Anlegen des Packs. Der Maker lädt die Texturen und Ordnernamen genau dieser Version und schreibt ihr Pack-Format. ', link('/guides/minecraft-pack-format-versions', 'Pack-Formate aller Versionen'), '.')],
    },
    {
      id: 'originals',
      q: 'Wo finde ich die originalen Minecraft-Texturen?',
      a: [p('Für Java in der ', code('.jar'), '-Datei des Spiels (', code('assets/minecraft/textures'), '), für Bedrock in Mojangs Repository bedrock-samples. Der Texture Pack Maker lädt sie für dich von Mojang, wenn du eine Version wählst.')],
    },
    {
      id: 'mobile',
      q: 'Kann ich ein Texture Pack am Handy erstellen?',
      a: [p('Ja. Der Texture Pack Maker läuft im Browser auf Android, iPhone und iPad genauso wie auf Computern und Chromebooks. In Bedrock öffnest du das exportierte ', code('.mcpack'), ' und Minecraft importiert es.')],
    },
    {
      id: 'time',
      q: 'Wie lange dauert es, ein Texture Pack zu erstellen?',
      a: [p('Ein paar Minuten für ein kleines Pack, das eine Handvoll Blöcke ändert, oder für einen Effekt wie Dark Mode auf dem ganzen Pack. Ein komplett handgemaltes Pack mit Hunderten Texturen kann Wochen dauern; exportieren und testen kannst du jederzeit zwischendurch.')],
    },
    {
      id: 'hd',
      q: 'Welche Auflösung sollte mein Texture Pack haben?',
      a: [p('16× entspricht dem Vanilla-Spiel und ist am schnellsten gemalt. 32× und 64× lassen Platz für mehr Details; 128× und mehr sind für realistische Packs und brauchen einen stärkeren Computer. Bleib im ganzen Pack bei einer Auflösung.')],
    },
  ],
  ctaLabel: 'Texture Pack Maker öffnen',
};

const notWorking: GuideText = {
  image: SHOTS.packSettings,
  intro: [
    p(
      'Die meisten Probleme mit Texture Packs haben drei Ursachen: Die Beschreibungsdatei des Packs (',
      code('pack.mcmeta'),
      ' in Java, ',
      code('manifest.json'),
      ' in Bedrock) fehlt oder liegt an der falschen Stelle, das Pack wurde für eine andere Spielversion gemacht, oder eine Textur liegt nicht genau unter dem Pfad, den Minecraft erwartet. Such unten heraus, was du siehst, und wende die Lösung an.',
    ),
    toolCallout('Lass Pack Doctor das Problem finden', ['Zieh das Pack in ', link('/pack-doctor', 'Pack Doctor'), ': Es prüft jede Datei nach den Regeln der Version, die du spielst, erklärt jedes gefundene Problem, repariert die sicheren mit einem Klick und gibt dir das reparierte Pack.'], { to: '/pack-doctor', label: 'Mein Pack prüfen', icon: 'potion' }),
  ],
  quick: {
    title: 'Prüf zuerst das',
    items: [
      ['Java: Die Zip öffnet sich direkt mit ', code('pack.mcmeta'), ' und ', code('assets'), ', nicht mit einem Ordner.'],
      'Das Pack wurde für die Version gemacht, die du spielst (oder sein Kompatibilitätsbereich schließt sie ein).',
      'Das Pack steht in der Liste „Ausgewählt“ (Java) oder ist aktiv (Bedrock), über Packs, die dieselben Texturen ändern.',
      'Dateinamen und Ordner entsprechen genau den Originalen, in Java kleingeschrieben.',
    ],
  },
  sections: [
    {
      id: 'not-listed',
      title: 'Das Pack steht nicht in der Liste',
      body: [
        p('Java zeigt ein Pack nur an, wenn es eine gültige ', code('pack.mcmeta'), ' auf der obersten Ebene der Zip oder des Ordners findet.'),
        ul([
          [strong('Verschachtelter Ordner: '), 'Wenn du den Pack-Ordner selbst zippst, liegt alles eine Ebene zu tief (', code('MyPack.zip/MyPack/pack.mcmeta'), '). Zippe stattdessen den Inhalt des Ordners.'],
          [strong('Kaputte pack.mcmeta: '), `ein fehlendes Komma oder Anführungszeichen macht das JSON ungültig. In Java ${LATEST} wird auch ein Pack ohne Beschreibung nicht angezeigt.`],
          [strong('Falscher Ordner: '), 'Die Zip muss in ', code('resourcepacks'), ' liegen, nicht in ', code('shaderpacks'), ' oder ', code('mods'), '. Mit ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ' öffnest du den richtigen.'],
          [strong('Noch im Download oder blockiert: '), 'Browser speichern halb geladene Dateien manchmal als ', code('.crdownload'), ' oder ', code('.part'), '. Lade das Pack noch einmal herunter.'],
        ]),
      ],
    },
    {
      id: 'version',
      title: '„Für eine ältere / neuere Version von Minecraft erstellt“',
      body: [
        p(
          'Java vergleicht das Pack-Format in der ',
          code('pack.mcmeta'),
          ' mit dem eigenen (',
          LATEST,
          ' nutzt ',
          strong(F(LATEST)),
          '). Ein Pack, das nur Texturen ändert, funktioniert meist trotzdem, wenn du auf ',
          strong('Ja'),
          ' klickst, aber fehlende oder umbenannte Texturen können falsch aussehen. Die saubere Lösung: das Pack für deine Version neu exportieren oder ihm einen Kompatibilitätsbereich geben, der sie einschließt. Für ein altes Pack, das nicht von dir ist, benennt der ',
          link('/texture-pack-converter', 'Texture-Pack-Konverter'),
          ' die Texturen für deine Version um und schreibt eine neue pack.mcmeta.',
        ),
        p(
          'Ab 1.21.9 kann ein Pack, das nur eine ',
          code('pack_format'),
          '-Nummer hat oder Felder, die gegen die neuen Regeln verstoßen, als ',
          el('em', null, 'defekt oder inkompatibel'),
          ' angezeigt werden. Neuere Packs nutzen ',
          code('min_format'),
          ' und ',
          code('max_format'),
          '. ',
          link('/guides/minecraft-pack-format-versions', 'Das Pack-Format jeder Version'),
          '.',
        ),
        figure(SHOTS.packSettings),
      ],
    },
    {
      id: 'purple',
      title: 'Lila-schwarze Blöcke',
      body: [
        p(
          'Das lila-schwarze Schachbrett ist die „fehlende Textur“. Ein Modell will ein Bild, das unter diesem Pfad nicht existiert: Die Datei wurde umbenannt, liegt im falschen Ordner, oder das Pack nutzt Ordnernamen einer anderen Version. Versionen vor 1.13 nutzen zum Beispiel ',
          code('textures/blocks'),
          ' und ',
          code('textures/items'),
          ', während 1.13 und neuer ',
          code('textures/block'),
          ' und ',
          code('textures/item'),
          ' nutzen.',
        ),
        p('Wenn du eigene Modelle hinzugefügt hast, prüf jeden Texturpfad darin. Packs aus dem Texture Pack Maker nutzen genau die Pfade der gewählten Version.'),
      ],
    },
    {
      id: 'some-textures',
      title: 'Nur manche Texturen haben sich geändert',
      body: [
        ul([
          [strong('Name oder Pfad weicht um einen Buchstaben ab: '), 'Die Datei braucht exakt denselben Namen und Ordner wie das Original. Java ignoriert Pfade mit Großbuchstaben oder Leerzeichen.'],
          [strong('Ein anderes Pack gewinnt: '), 'Packs weiter oben in der Liste ersetzen dieselben Texturen. Schieb deins nach oben oder kombiniere die Packs mit ', link('/merge-texture-packs', 'Texture Packs zusammenführen'), ' in der gewünschten Reihenfolge zu einem.'],
          [strong('Falsche Datei für diesen Block: '), 'Manche Blöcke nutzen mehrere Bilder (Ofen: Vorderseite, Seite und Oberseite; Grasblock: Oberseite, Seite und Seitenauflage). Bearbeite alle oder schau in der 3D-Vorschau nach, welches Bild wohin gehört.'],
          [strong('Falscher Bildtyp in Bedrock: '), 'Manche Vanilla-Texturen in Bedrock sind ', code('.tga'), '-Dateien. Behalte Namen und Dateityp des Originals, damit deine Datei es ersetzt.'],
        ]),
      ],
    },
    {
      id: 'grey',
      title: 'Gras und Laub sehen grau aus',
      body: [
        p(
          'In der Bilddatei ist das normal. Gras, Laub, Ranken, Wasser und ein paar andere Texturen sind in Grau gespeichert und werden vom Spiel je nach Biom eingefärbt. Male sie also in hellen Grautönen und prüfe sie im Spiel. Malst du sie grün, wirken sie nach dem Einfärben viel dunkler oder seltsam gefärbt.',
        ),
      ],
    },
    {
      id: 'animation',
      title: 'Eine animierte Textur erscheint als langer Streifen',
      body: [
        p(
          'Animierte Texturen sind ein hohes Bild mit übereinander gestapelten Einzelbildern plus einer ',
          code('.png.mcmeta'),
          '-Datei mit demselben Namen (zum Beispiel ',
          code('sea_lantern.png.mcmeta'),
          '). Fehlt diese Datei, quetscht Java den ganzen Streifen in einen Block. Bedrock listet animierte Texturen stattdessen in ',
          code('textures/flipbook_textures.json'),
          '. Der Texture Pack Maker schreibt diese Dateien, wenn du Animationsbilder bearbeitest.',
        ),
      ],
    },
    {
      id: 'all-off',
      title: 'Alle meine Ressourcenpakete wurden ausgeschaltet (Java)',
      body: [
        p(
          'Wenn ein Ressourcenpaket einen Shader enthält, der sich nicht kompilieren lässt, schaltet Java alle Packs aus und kehrt zu den Standardwerten zurück. Das passiert mit Vanilla-Shaderpaketen, die für eine andere Version gemacht wurden, weil Mojang diese Shader-Dateien oft ändert. Entferne das Pack oder exportiere es für deine genaue Version neu; jeder Shader, den der ',
          link('/shaders', 'Shader Maker'),
          ' schreibt, wird vorher auf Kompilierfehler geprüft.',
        ),
      ],
    },
    {
      id: 'bedrock-import',
      title: 'Bedrock: Der Import ist fehlgeschlagen',
      body: [
        ul([
          [strong('Import fehlgeschlagen: '), code('manifest.json'), ' fehlt, ist ungültig oder liegt nicht auf der obersten Ebene der Datei. Exportiere das Pack neu und öffne die neue Datei.'],
          [strong('Doppeltes Pack: '), 'Ein Pack mit denselben IDs und derselben Versionsnummer ist schon installiert. Erhöhe die Version (der Texture Pack Maker macht das bei jedem Export) oder lösche die alte Kopie unter ', uiPath('Einstellungen', 'Speicherung'), '.'],
          [strong('Falscher Dateityp: '), 'Eine Java-', code('.zip'), ', die in ', code('.mcpack'), ' umbenannt wurde, funktioniert nicht; Bedrock braucht eigene Dateien und Ordner. Wandle sie stattdessen mit dem ', link('/texture-pack-converter', 'Texture-Pack-Konverter'), ' um.'],
          [strong('Konsole: '), 'Xbox, PlayStation und Switch können überhaupt keine Dateien importieren. Tritt einer Welt, einem Realm oder einem Server bei, der das Pack mitbringt.'],
        ]),
      ],
    },
    {
      id: 'bedrock-nothing',
      title: 'Bedrock: Importiert, aber nichts ändert sich',
      body: [
        ul([
          ['Aktivieren: ', uiPath('Einstellungen', 'Globale Ressourcen', 'Meine Pakete'), ', Pack auswählen und auf ', strong('Aktivieren'), ' tippen. Für eine einzelne Welt nutze ', uiPath('Welt bearbeiten', 'Ressourcenpakete'), '.'],
          'Schieb es über andere aktive Packs, die dieselben Texturen ändern.',
          ['Braucht das Pack ein neueres Spiel als deins, ist seine ', code('min_engine_version'), ' zu hoch: Aktualisiere Minecraft oder exportiere mit einem niedrigeren Minimum.'],
          'Packs für klassische Grafik können mit Vibrant Visuals anders aussehen oder abgeschaltet werden. Wechsle testweise den Grafikmodus.',
        ]),
      ],
    },
    {
      id: 'shaders',
      title: 'Ein Shaderpaket wird nicht angezeigt',
      body: [
        ul([
          ['Iris- und OptiFine-Shaderpakete gehören in den Ordner ', code('shaderpacks'), ', den du über ', uiPath(OPTIONS, 'Grafikeinstellungen …', 'Shaderpakete ...'), ' öffnest, nicht in ', code('resourcepacks'), '.'],
          ['Iris braucht OpenGL. Stelle in Java 26.2 und neuer die ', strong('Grafikschnittstelle'), ' auf ', strong('Standard'), ' oder ', strong('OpenGL bevorzugen'), ', wenn Iris meldet, dass es nicht mit Vulkan läuft.'],
          ['Vanilla-Shaderpakete (ohne Mods) sind Ressourcenpakete und laufen nur in der Version, für die sie gemacht wurden. ', link('/guides/make-shaders-without-mods', 'Shader ohne Mods'), '.'],
        ]),
      ],
    },
  ],
  faq: [
    {
      id: 'why-red',
      q: 'Warum ist mein Texture Pack in der Liste der Ressourcenpakete rot?',
      a: [p('Rot heißt, dass das Format des Packs nicht zu deiner Spielversion passt. Es kann trotzdem funktionieren; exportiere es für deine Version neu, um sicherzugehen.')],
    },
    {
      id: 'reload',
      q: 'Muss ich Minecraft nach einer Änderung am Pack neu starten?',
      a: [p('Nein. In Java drückst du F3 + T, um die Ressourcenpakete neu zu laden, oder schaltest das Pack aus und wieder ein. In Bedrock verlässt du die Welt und trittst ihr erneut bei.')],
    },
    {
      id: 'server',
      q: 'Warum ändert ein Server meine Texturen?',
      a: [p('Server können ein eigenes Ressourcenpaket schicken, das über deinem liegt. Du kannst es in den Servereinstellungen im Mehrspieler-Menü ablehnen, manche Server verlangen es aber.')],
    },
  ],
  ctaLabel: 'Mein Pack mit Pack Doctor reparieren',
};

const install: GuideText = {
  intro: [
    p(
      'In ',
      strong('Java'),
      ' legst du die ',
      code('.zip'),
      ' des Packs in den Ordner ',
      code('resourcepacks'),
      ' und schaltest es unter „Optionen › Ressourcenpakete“ ein. In ',
      strong('Bedrock'),
      ' öffnest du die ',
      code('.mcpack'),
      '-Datei, Minecraft importiert sie, und du aktivierst sie unter „Einstellungen › Globale Ressourcen“. Shaderpakete für Java brauchen Iris oder OptiFine.',
    ),
  ],
  quick: {
    title: 'Die schnelle Antwort',
    items: [
      ['Java: ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ', die ', code('.zip'), ' hineinlegen, das Pack nach „Ausgewählt“ verschieben und auf „Fertig“ klicken.'],
      ['Bedrock: die ', code('.mcpack'), '-Datei öffnen und unter ', uiPath('Einstellungen', 'Globale Ressourcen'), ' aktivieren.'],
      ['Shader (Java): Iris oder OptiFine installieren und die Shader-Zip in den Ordner ', code('shaderpacks'), ' legen.'],
    ],
  },
  howto: { name: 'Ressourcenpaket in Minecraft Java Edition installieren', steps: INSTALL_JAVA_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Ressourcenpaket in Java installieren',
      body: [steps(INSTALL_JAVA_STEPS), h3('Wo ist der Ordner resourcepacks?'), folderTable('resourcepacks', FOLDER)],
    },
    {
      id: 'order',
      title: 'Mehrere Packs gleichzeitig nutzen',
      body: [
        p(
          'Du kannst so viele Packs einschalten, wie du willst. Wenn zwei Packs dieselbe Textur ändern, gewinnt das, das in der Liste ',
          strong('Ausgewählt'),
          ' (Java) oder in der Liste der aktiven Packs (Bedrock) weiter oben steht, und alles, was es nicht ändert, kommt aus den Packs darunter. Ein typisches Setup ist ein kleines Pack mit deinen eigenen Anpassungen ganz oben und ein komplettes Pack darunter.',
        ),
        p('Um so einen Stapel zu einem einzigen Pack zu machen, etwa zum Teilen oder für einen Server, der nur ein Ressourcenpaket schicken kann, nutze ', link('/merge-texture-packs', 'Texture Packs zusammenführen'), ': Dort gilt dieselbe Regel, das Pack ganz oben in der Liste gewinnt.'),
        p('Launcher von Drittanbietern wie Lunar Client und Badlion Client nutzen standardmäßig denselben Ordner ', code('resourcepacks'), ' in ', code('.minecraft'), ' und haben ein eigenes Menü für Ressourcenpakete, um Packs einzuschalten.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Ein .mcpack in Bedrock installieren',
      body: [
        tabbed(
          'install-bedrock',
          [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  ['Doppelklicke auf das ', code('.mcpack'), '. Minecraft öffnet sich und zeigt ', el('em', null, 'Import gestartet...'), ' und dann ', el('em', null, 'erfolgreich importiert'), '.'],
                  ['Geh zu ', uiPath('Einstellungen', 'Globale Ressourcen', 'Meine Pakete'), ', wähle das Pack und tippe auf ', strong('Aktivieren'), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android & iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Lade das ', code('.mcpack'), ' auf das Handy oder Tablet herunter.'],
                  [strong('Android: '), 'öffne es in den Downloads oder der Dateien-App und wähle Minecraft. ', strong('iPhone / iPad: '), 'tippe es in der Dateien-App an, dann ', uiPath('Teilen', 'Minecraft'), '.'],
                  ['Aktiviere es unter ', uiPath('Einstellungen', 'Globale Ressourcen'), '.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Konsolen',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation und Switch können keine Dateien importieren. Füge das Pack auf einem PC oder Handy einer Welt hinzu und tritt dieser Welt bei, oder spiel auf einem Realm oder Server, der es mitbringt.')],
            },
          ],
          UI_DE.platform,
        ),
        callout('tip', 'Nur eine Welt?', 'Öffne ', uiPath('Welt bearbeiten', 'Ressourcenpakete'), ' und aktiviere das Pack dort statt unter „Globale Ressourcen“.'),
      ],
    },
    {
      id: 'shaders',
      title: 'Ein Shaderpaket installieren',
      body: [
        ul([
          [strong('Iris (Java):'), ' installiere Iris mit dem Installer von ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ', spiele einmal mit dem Iris-Profil, öffne dann ', uiPath(OPTIONS, 'Grafikeinstellungen …', 'Shaderpakete ...'), ', klicke auf ', strong('Shader-Ordner öffnen ...'), ' und leg die Zip hinein.'],
          [strong('OptiFine (Java):'), ' ', uiPath(OPTIONS, 'Grafikeinstellungen …', 'Shader …'), ', dann ', strong('Shader-Ordner'), '.'],
          [strong('Vanilla-Shader (Java, ohne Mods):'), ' Das sind Ressourcenpakete. Installiere sie wie jedes andere Pack im Ordner ', code('resourcepacks'), '.'],
          [strong('Vibrant Visuals (Bedrock):'), ' öffne das ', code('.mcpack'), ', aktiviere es und stelle dann ', uiPath('Einstellungen', 'Grafik', 'Grafikmodus'), ' auf „Lebendige Grafik“ (Vibrant Visuals).'],
        ]),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    {
      id: 'skins',
      title: 'Einen Skin installieren',
      body: [
        ul([
          [strong('Java:'), ' Minecraft Launcher › Skins › Neuer Skin, Klassisch oder Schlank wählen, das PNG auswählen und auf „Speichern und verwenden“ klicken. Oder lade ihn in deinem Profil auf minecraft.net hoch.'],
          [strong('Bedrock:'), ' öffne ein Skinpaket als ', code('.mcpack'), ' und wähle den Skin unter Ankleidezimmer › Klassische Skins, oder importiere dort ein einzelnes PNG.'],
        ]),
        p('Mehr dazu in ', link('/guides/make-a-skin', 'Eigenen Minecraft Skin erstellen'), '.'),
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Pack funktioniert nicht?',
      body: [
        p('Die häufigsten Probleme stehen unten. ', link('/guides/texture-pack-not-working', 'Alle Lösungen mit Erklärungen'), '.'),
        table(
          ['Was du siehst', 'Warum', 'Lösung'],
          [
            ['„Für eine ältere / neuere Version von Minecraft erstellt“', 'Das Pack-Format in der pack.mcmeta passt nicht zu deinem Spiel.', 'Für deine Version neu exportieren oder den Kompatibilitätsbereich erweitern. Reine Textur-Packs funktionieren meist, wenn du auf „Ja“ klickst.'],
            ['„Defekt oder inkompatibel“ (Java 1.21.9+)', 'Die pack.mcmeta hat nur pack_format, oder ihre Felder verstoßen gegen die Regeln.', 'Neu aus dem Texture Pack Maker exportieren, der min_format und max_format schreibt.'],
            ['Das Pack steht gar nicht in der Liste', 'pack.mcmeta fehlt, liegt nicht ganz oben in der Zip, ist kein gültiges JSON oder hat keine Beschreibung.', 'Sicherstellen, dass die Zip direkt mit pack.mcmeta und assets aufgeht, nicht mit einem Ordner.'],
            ['Bedrock meldet, dass der Import fehlgeschlagen ist', 'manifest.json fehlt, liegt nicht ganz oben in der Datei oder ist ungültig.', 'Neu als .mcpack exportieren und die neue Datei öffnen.'],
            ['Bedrock-Pack ändert nichts', 'Ein anderes Pack darüber ersetzt dieselben Texturen.', 'Dein Pack in der Liste der aktiven Packs nach ganz oben schieben.'],
          ],
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'unzip',
      q: 'Sollte ich ein Ressourcenpaket entpacken?',
      a: [p('Nein. Java lädt gezippte Packs direkt. Ein entpackter Ordner funktioniert auch, wenn pack.mcmeta direkt darin liegt, aber die Zip zu behalten ist einfacher.')],
    },
    {
      id: 'order',
      q: 'Welches Pack gewinnt, wenn zwei dieselbe Textur ändern?',
      a: [p('Das, das in der Liste „Ausgewählt“ (Java) oder in der Liste der aktiven Packs (Bedrock) weiter oben steht. ', link('/merge-texture-packs', 'Texture Packs zusammenführen'), ' nutzt dieselbe Reihenfolge, um mehrere Packs zu einem zu kombinieren.')],
    },
    {
      id: 'realms',
      q: 'Können Konsolenspieler eigene Packs nutzen?',
      a: [p('Nicht durch Importieren von Dateien. Sie können einer Welt, einem Realm oder einem Server beitreten, der das Pack mitbringt.')],
    },
  ],
  ctaLabel: 'Komplette Installationsanleitung für jede Plattform',
};

const packFormats: GuideText = {
  intro: [
    p(
      'Jedes Ressourcenpaket der Java Edition nennt in seiner ',
      code('pack.mcmeta'),
      '-Datei ein ',
      strong('Pack-Format'),
      ', und Minecraft vergleicht es mit dem eigenen, um zu entscheiden, ob das Pack passt. ',
      strong(`Minecraft Java ${LATEST} nutzt das Ressourcenpaket-Format ${F(LATEST)}.`),
      ' Ressourcenpakete gibt es seit 1.6.1; ältere Versionen nutzten Texture Packs, die anders funktionieren.',
    ),
  ],
  quick: {
    title: `Schnelle Antwort: Minecraft ${LATEST}`,
    items: [
      ['Ressourcenpaket-Format: ', strong(F(LATEST)), '.'],
      ['Schreib in die ', code('pack.mcmeta'), ' ', code(`"min_format": ${minFormat(LATEST)}`), ' und ', code(`"max_format": ${maxFormat(LATEST)}`), ' (seit 1.21.9 ist das Format in eine Haupt- und eine Nebennummer geteilt).'],
      ['Ein Pack, das auch in älteren Versionen laufen soll, braucht zusätzlich ', code('pack_format'), ' und ', code('supported_formats'), '. Die Tabelle unten listet jede Version.'],
    ],
  },
  sections: [
    {
      id: 'table',
      title: 'Ressourcenpaket-Format jeder Java-Version',
      body: [
        p('Jede Vollversion von 1.6.1 bis ', LATEST, '. Snapshots, Pre-Releases und Release Candidates haben eigene Nummern.'),
        table(
          ['Pack-Format', 'Minecraft-Java-Versionen'],
          formatGroups()
            .reverse()
            .map((g) => [g.format, g.versions.join(', ')]),
          'guide-table formats-table',
        ),
        p(
          'Seit dem Zyklus von 1.21.9 kann ein Format auch eine Nebennummer haben: ',
          F(LATEST),
          ` bedeutet Hauptnummer ${formatParts(LATEST).major}, Nebennummer ${formatParts(LATEST).minor}. Mojang erhöht die Nebennummer für Ergänzungen, die ältere Packs nicht kaputt machen. Beim Schreiben dieser Anleitung nutzt der erste Snapshot von ${NEXT_SNAPSHOT.version} das Format ${NEXT_SNAPSHOT.format}.`,
        ),
      ],
    },
    {
      id: 'eras',
      title: 'Wie sich pack.mcmeta verändert hat',
      body: [
        table(
          ['Spielversionen', 'Felder, die das Spiel liest'],
          [
            ['1.6.1 – 1.8.7', [code('pack_format'), ' und ', code('description'), '. Es gibt überhaupt keine Versionsprüfung, jede Nummer lädt.']],
            ['1.8.8 – 1.20.1', ['Nur ', code('pack_format'), '. Das Pack gilt als kompatibel, wenn die Nummer der des Spiels entspricht; sonst warnt Minecraft, lässt dich es aber nutzen.']],
            ['1.20.2 – 1.21.8', [code('pack_format'), ' (Pflicht) plus ein optionaler Bereich ', code('supported_formats'), ' wie ', code('[15, 64]'), '.']],
            [`1.21.9 – ${LATEST}`, [code('min_format'), ' und ', code('max_format'), ' (nur zusammen). Ein Pack, dessen Bereich bis Format 64 oder darunter zurückreicht, braucht zusätzlich ', code('pack_format'), ' und ', code('supported_formats'), '; ein Pack nur für 1.21.9+ darf ', code('supported_formats'), ' nicht nutzen.']],
          ],
        ),
      ],
    },
    {
      id: 'examples',
      title: 'Beispiele',
      body: [
        h3(`Nur Java ${LATEST}`),
        pre(mcmetaFor(LATEST, `Mein Pack für Minecraft ${LATEST}`)),
        p('Eine einzelne Zahl in ', code('max_format'), ` bedeutet „jede Nebenversion“, ${maxFormat(LATEST)} deckt also ${maxFormat(LATEST)}.0 und ${F(LATEST)} ab. Mit `, code(`[${maxFormat(LATEST)}, 0]`), ` an dieser Stelle wäre das Pack zu alt für ${LATEST}.`),
        h3(`Von 1.20.1 bis ${LATEST}`),
        pre(mcmetaRange('1.20.1', LATEST, `Mein Pack für Minecraft 1.20.1 - ${LATEST}`)),
        p('1.20.1 liest ', code('pack_format'), ', 1.20.2 – 1.21.8 lesen ', code('supported_formats'), ', und 1.21.9 und neuer lesen ', code('min_format'), ' und ', code('max_format'), '.'),
        h3('Nur 1.20.1 (und 1.20)'),
        pre(mcmetaLegacy('1.20.1', 'Mein Pack für Minecraft 1.20.1')),
        callout('tip', 'Lass das Tool das machen', 'Wähle im Texture Pack Maker deine Version und, wenn du willst, im Tab „Pack“ einen Kompatibilitätsbereich. Der Export bekommt genau die Felder, die jede Version braucht.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Und Bedrock?',
      body: [
        p(
          'Bedrock-Packs haben keine Pack-Format-Nummer. Ihre ',
          code('manifest.json'),
          ' nutzt ',
          code('"format_version": 2'),
          ' und eine ',
          code('min_engine_version'),
          ' wie ',
          code(MIN_ENGINE),
          '. Bedrock-Versionsnummern richten sich inzwischen nach dem Jahr (26.0 erschien im Februar 2026), Manifeste behalten aber das alte Schema, also wird 26.50 als ',
          code('[1, 26, 50]'),
          ' geschrieben.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'latest',
      q: `Welches Ressourcenpaket-Format hat Minecraft ${LATEST}?`,
      a: [p(`${F(LATEST)}. Schreib "min_format": ${minFormat(LATEST)} und "max_format": ${maxFormat(LATEST)} in die pack.mcmeta eines Packs nur für ${LATEST}.`)],
    },
    {
      id: '1211',
      q: 'Welches Pack-Format haben 1.21.1 und 1.20.1?',
      a: [p(`1.21 und 1.21.1 nutzen ${F('1.21.1')}; 1.20 und 1.20.1 nutzen ${F('1.20.1')}. 1.8.9 und ältere 1.x-Versionen ab 1.6.1 nutzen ${F('1.8.9')}.`)],
    },
    {
      id: 'broken',
      q: 'Warum steht bei meinem Pack „Defekt oder inkompatibel“?',
      a: [p('Ab 1.21.9 fällt ein Pack mit nur einem hohen pack_format (über 64) und ohne min_format / max_format durch die Prüfung. Du kannst es trotzdem aktivieren, besser ist es aber, beide Felder hinzuzufügen.')],
    },
  ],
  ctaLabel: 'Pack mit dem richtigen Format erstellen',
};

const makeASkin: GuideText = {
  image: SHOTS.skin2d,
  intro: [
    p(
      'Ein Minecraft-Skin ist ein PNG-Bild mit 64×64 Pixeln, das sich um das Spielermodell legt; Bedrock nimmt auch HD-Skins mit 128×128 Pixeln. Du kannst einen im Browser gestalten: auf der Vorlage malen, auf einem 3D-Modell prüfen und dann im Minecraft Launcher hochladen (Java) oder als Skinpaket importieren (Bedrock).',
    ),
  ],
  quick: {
    title: 'Die Kurzfassung',
    items: ['Öffne den Skin Maker und wähle eine Vorlage oder einen Start-Skin.', 'Bemale ihn und behalte die 3D-Vorschau im Blick.', 'Exportiere ein PNG für Java oder ein .mcpack für Bedrock und lade es hoch.'],
  },
  howto: { name: 'Eigenen Minecraft Skin online erstellen', steps: SKIN_STEPS },
  sections: [
    { id: 'steps', title: 'Schritt für Schritt', body: [steps(SKIN_STEPS), figure(SHOTS.skin2d), figure(SHOTS.skin3d)] },
    {
      id: 'template',
      title: 'So funktioniert die Skinvorlage',
      body: [
        ul([
          ['Das Bild ist ', strong('64×64'), ' Pixel groß. Java 1.7.10 und älter nutzen das alte ', strong('64×32'), '-Layout ohne eigenen linken Arm und eigenes linkes Bein; Bedrock akzeptiert auch HD-Skins mit ', strong('128×128'), '.'],
          ['Es gibt zwei Ebenen. Die ', strong('Grundebene'), ' ist der Körper; die ', strong('Außenebene'), ' (Hut, Jacke, Ärmel und Hosenbeine) schwebt knapp darüber und darf transparent sein.'],
          [strong('Breite'), ' Arme (Steve) sind 4 Pixel breit, ', strong('schmale'), ' Arme (Alex) 3 Pixel. Lade den Skin mit demselben Modell hoch, mit dem du ihn gemalt hast.'],
          'Ungenutzte Bereiche der Vorlage sollten komplett transparent bleiben.',
        ]),
      ],
    },
    {
      id: 'hd-skins',
      title: 'HD-Skins mit 128×128',
      body: [
        p(
          'Ein HD-Skin ist dieselbe Vorlage in doppelter Auflösung: 128×128 statt 64×64 Pixel. Jedes Gesicht, jeder Ärmel und jeder Schuh hat also viermal so viele Pixel für Schattierungen, Augen und feine Muster. Wo er funktioniert:',
        ),
        ul([
          [strong('Bedrock Edition'), ' (Windows, Android, iPhone und iPad): Importiere das PNG im Ankleidezimmer oder pack es in ein Skinpaket. Ein Paket kann Skins mit 64×64 und HD-Skins mischen.'],
          [strong('Java Edition'), ': Der Minecraft Launcher und minecraft.net nehmen nur Skins mit 64×64 an. Für einen HD-Skin brauchst du eine Mod, die HD-Skins lädt, etwa CustomSkinLoader.'],
        ]),
        h3('So erstellst du einen im Skin Maker'),
        steps([
          ['Stell auf dem Startbildschirm ', strong('Größe'), ' auf ', strong('HD 128×128'), ' und wähle dann einen Startpunkt. Vorlagen und Start-Skins werden auf 128×128 verdoppelt, und ein hochgeladenes PNG mit 128×128 bleibt HD.'],
          ['Du malst schon an einem Skin mit 64×64? Stell im Editor ', strong('Größe'), ' auf ', strong('HD 128'), ' und bestätige mit ', strong('Zu HD machen'), '. Jedes Pixel wird zu einem 2×2-Block, der Skin sieht also gleich aus, bis du feinere Details malst. Mit ', strong('Größe'), ' › ', strong('64×64'), ' und ', strong('Auf 64×64 verkleinern'), ' geht es zurück.'],
          ['Exportiere ', strong('Bedrock-Skin (.png)'), ' für den Import im Ankleidezimmer oder ein ', strong('Bedrock-Skinpaket (.mcpack)'), '. Beide behalten 128×128.'],
          ['Für Java lädt ', strong('Java skin (.png)'), ' eine Kopie mit 64×64 herunter, bei der jeder 2×2-Block zu einem Pixel wird; dein HD-Skin bleibt, wie er ist. Du nutzt eine HD-Skin-Mod? Dann wähle stattdessen ', strong('128×128 für Mods'), '.'],
        ]),
        callout(
          'warn',
          'Grenzen',
          'Konsolen können Skin-Dateien in keiner Größe importieren. Skins größer als 128×128 werden nicht unterstützt. Spieler mit eingeschaltetem „Nur vertrauenswürdige Skins erlauben“ sehen jeden eigenen Skin, ob HD oder nicht, als Standard-Skin.',
        ),
      ],
    },
    {
      id: 'java',
      title: 'In Java nutzen',
      body: [
        steps([
          ['Öffne den Minecraft Launcher und geh zu ', uiPath('Minecraft: Java Edition', 'Skins'), '.'],
          ['Klicke auf ', strong('Neuer Skin'), ', gib ihm einen Namen und wähle ', strong('Klassisch'), ' oder ', strong('Schlank'), '.'],
          ['Klicke auf ', strong('Durchsuchen'), ', wähle dein PNG und dann ', strong('Speichern und verwenden'), '.'],
        ]),
        p('Du kannst ihn auch in deinem Profil auf ', ext('https://www.minecraft.net/', 'minecraft.net'), ' hochladen.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Ein eigenes Bedrock-Skinpaket erstellen',
      body: [
        p(
          'Ein Skinpaket ist ein ',
          code('.mcpack'),
          ' mit einem oder mehreren Skins. Der Skin Maker baut es für dich; darin liegen eine ',
          code('manifest.json'),
          ' (Modultyp ',
          code('skin_pack'),
          '), eine ',
          code('skins.json'),
          ', die jeden Skin mit dem breiten (',
          code('geometry.humanoid.custom'),
          ') oder schmalen (',
          code('geometry.humanoid.customSlim'),
          ') Modell und ',
          code('"type": "free"'),
          ' auflistet, die Skin-PNGs auf der obersten Ebene und die Namen in ',
          code('texts/en_US.lang'),
          '.',
        ),
        steps([
          ['Male jeden Skin als eigenes Projekt. Breite und schmale Skins passen in ein Paket.'],
          ['Wähle ', strong('Exportieren'), ' › ', strong('Bedrock-Skinpaket (.mcpack)'), ', gib dem Paket einen Namen und hake die anderen Skins an.'],
          'Öffne das .mcpack (Doppelklick unter Windows, „Mit Minecraft öffnen“ auf Android, „Teilen › Minecraft“ auf iPhone und iPad).',
          ['Geh in Minecraft zu ', uiPath('Ankleidezimmer', 'Klassische Skins'), ', such dein Paket, wähle den Skin und tippe auf ', strong('Anlegen'), '.'],
        ]),
        figure(SHOTS.skinPack),
        callout('warn', 'Gut zu wissen', 'Konsolen können keine Skin-Dateien importieren. Spieler mit eingeschaltetem „Nur vertrauenswürdige Skins erlauben“ sehen eigene Skins als Standard-Skins. Eigene Modelle sind in importierten Skinpaketen nicht erlaubt, nur breit und schmal.'),
        p('Installieren, aktualisieren und die Dateien im Paket, Schritt für Schritt: ', link('/guides/make-a-bedrock-skin-pack', 'Minecraft-Bedrock-Skinpaket erstellen'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'size', q: 'Wie groß sollte ein Minecraft-Skin sein?', a: [p('64×64 Pixel, als PNG gespeichert. 64×32 nur für Java 1.7.10 und älter. Bedrock nimmt auch HD-Skins mit 128×128 Pixeln.')] },
    {
      id: 'hd',
      q: 'Kann ich einen Minecraft-Skin mit 128×128 erstellen?',
      a: [
        p(
          'Ja, für die Bedrock Edition. Stell im Skin Maker vor dem Start ',
          strong('Größe'),
          ' auf ',
          strong('HD 128×128'),
          ' oder stell einen vorhandenen Skin auf ',
          strong('HD 128'),
          ' um und exportiere dann ein Bedrock-PNG oder ein Skinpaket. Die Java Edition zeigt ohne Mods nur Skins mit 64×64, darum macht der Java-Export eine Kopie mit 64×64; HD-Skin-Mods wie CustomSkinLoader können die Datei mit 128×128 nutzen.',
        ),
      ],
    },
    { id: 'username', q: 'Kann ich mit dem Skin von jemand anderem anfangen?', a: [p('Ja. Der Skin Maker kann den aktuellen Skin jedes Java-Spielers per Benutzername laden, sodass du ihn remixen kannst. Bitte respektiere dabei die Arbeit anderer.')] },
    { id: 'phone', q: 'Kann ich einen Skin am Handy erstellen?', a: [p('Ja. Der Editor funktioniert mit Touch, inklusive Zoom mit zwei Fingern.')] },
    {
      id: 'slim-pack',
      q: 'Kann ein Skinpaket breite und schmale Skins mischen?',
      a: [p('Ja. Jeder Skin in einem Paket hat sein eigenes Modell, ein eigenes Skinpaket kann also breite (4 Pixel breite Arme) und schmale (3 Pixel breite Arme) Skins nebeneinander enthalten.')],
    },
    {
      id: 'update-pack',
      q: 'Wie aktualisiere ich ein Skinpaket, das ich schon importiert habe?',
      a: [p('Exportiere es aus demselben Projekt neu und öffne das neue .mcpack. Das Paket behält seine IDs und bekommt eine höhere Versionsnummer, sodass Minecraft das alte ersetzt, statt eine Kopie anzulegen.')],
    },
  ],
  ctaLabel: 'Skin Maker öffnen',
};

const shadersWithoutMods: GuideText = {
  image: SHOTS.shaderVanilla,
  intro: [
    p(
      strong('Ja, mit Einschränkungen.'),
      ` Für einfache Shader-Effekte brauchst du weder OptiFine noch Iris noch eine andere Mod. Ab Java 1.17 kann ein ganz normales Ressourcenpaket einige von Minecrafts eigenen Shader-Dateien ersetzen – so bekommst du Color Grading, eine Vignette, anderen Nebel und in ${LATEST} auch Bloom, ohne etwas zu installieren. In Bedrock ist eigener Shader-Code nicht erlaubt, aber ein Vibrant-Visuals-Paket stimmt das eingebaute Licht, den Himmel, Nebel und Wasser ab. Echte Schatten und Spiegelungen brauchen in Java weiterhin Iris oder OptiFine.`,
    ),
  ],
  howto: { name: 'Minecraft-Java-Shaderpaket ohne Mods erstellen', steps: VANILLA_SHADER_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Java: Shader in einem Ressourcenpaket',
      body: [
        p('Seit 1.17 zeichnet Minecraft die Welt mit Shader-Dateien, die ein Ressourcenpaket überschreiben kann. Was ein Vanilla-Shaderpaket kann, hängt von der Version ab:'),
        table(
          ['Effekt', 'Funktioniert in'],
          [
            ['Color Grading (Helligkeit, Kontrast, Sättigung, Wärme, Schwarz-Weiß, Sepia)', 'Java 1.17 und neuer'],
            ['Vignette', 'Java 1.17 und neuer'],
            ['Nebelweite und -farbe', 'Java 1.17 und neuer'],
            ['Bloom (Leuchten über den ganzen Bildschirm)', `Java ${LATEST} und neuer`],
            ['Wehende Pflanzen', 'nur 1.17 – 1.21.4 und 1.21.6 – 1.21.10'],
            ['Echte Schatten, Spiegelungen, Lichtstrahlen', 'Ohne Iris oder OptiFine nicht möglich'],
          ],
        ),
        p(`Java ${LATEST} hat einen immer aktiven Vollbild-Effekt eingeführt, deshalb funktionieren dort Bloom und saubereres Color Grading. Versionen 1.16.5 und älter haben keine ersetzbaren Welt-Shader.`),
        callout('warn', 'Genau eine Version', 'Mojang ändert diese Shader-Dateien oft, deshalb läuft ein Vanilla-Shaderpaket nur in der Version, für die es gemacht wurde. Ein kaputter Shader kann dazu führen, dass Minecraft alle deine Ressourcenpakete ausschaltet – deshalb wird jeder Shader, den der Shader Maker schreibt, vorher auf Kompilierfehler geprüft.'),
        h3('Selbst erstellen'),
        steps(VANILLA_SHADER_STEPS),
        figure(SHOTS.shaderVanilla),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock: Vibrant Visuals statt Shadern',
      body: [
        p('Bedrock lädt keinen eigenen Shader-Code mehr, seit es auf die RenderDragon-Engine umgestiegen ist (1.16.200 auf Windows und Konsolen, 1.18.30 auf anderen Geräten). Tools, die die kompilierten Shader-Dateien des Spiels austauschen, brauchen veränderte Spielinstallationen und gehen bei Updates kaputt.'),
        p(
          'Der offizielle Weg ist ',
          strong('Vibrant Visuals'),
          ' (im deutschen Spiel „Lebendige Grafik“): der moderne Renderer von Bedrock, seit 1.21.90 (Juni 2025) im stabilen Spiel. Ein Ressourcenpaket kann seine Einstellungen ändern: Sonnen- und Mondlicht, Himmelsfarben, Nebel, Wasser, Schatten und Color Grading, je nach Tageszeit und Biom. ',
          link('/guides/bedrock-vibrant-visuals-settings', 'Vibrant-Visuals-Einstellungen erklärt'),
          '.',
        ),
      ],
    },
    {
      id: 'mods',
      title: 'Shader ohne OptiFine: nimm Iris',
      body: [
        p(
          `Wenn „ohne Mods“ eigentlich „ohne OptiFine“ heißt, ist die Antwort Iris. Es lädt dieselben Shaderpakete (echte Sonnenschatten, wehende Blätter, spiegelndes Wasser, Lichtstrahlen), läuft zusammen mit der Performance-Mod Sodium und ist für Java 1.16.5 bis ${LATEST} verfügbar. Beim Schreiben dieser Anleitung reicht OptiFine bis 26.2.`,
        ),
        steps([
          ['Lade den Iris-Installer von ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ' herunter und starte ihn. Er installiert Iris und Sodium für die gewählte Version.'],
          'Starte das Spiel einmal mit dem neuen Iris-Profil im Minecraft Launcher.',
          ['Öffne ', uiPath(OPTIONS, 'Grafikeinstellungen …', 'Shaderpakete ...'), ', klicke auf ', strong('Shader-Ordner öffnen ...'), ' und leg eine Shaderpaket-Zip hinein.'],
          'Wähle das Pack in der Liste und klicke auf „Anwenden“. Leichtere Packs passen zu Laptops; schwerere brauchen eine starke Grafikkarte.',
        ]),
        figure(SHOTS.shaderIris),
        p('Mit Forge oder NeoForge suchst du nach einer Iris-Portierung für diesen Loader. Ein eigenes Iris-/OptiFine-Shaderpaket mit Presets und Live-Vorschau kannst du auch im ', link('/shaders', 'Shader Maker'), ' bauen.'),
      ],
    },
  ],
  faq: [
    { id: 'optifine', q: 'Braucht man OptiFine für Vanilla-Shader?', a: [p('Nein. Vanilla-Shaderpakete sind normale Ressourcenpakete. Sie laufen ohne Mod in der Version, für die sie gemacht wurden.')] },
    { id: 'servers', q: 'Funktionieren Vanilla-Shaderpakete auf Servern?', a: [p('Ja. Ressourcenpakete wendet dein eigenes Spiel an, deshalb funktionieren sie auch, wenn du auf einem Server spielst.')] },
    { id: 'bedrock', q: 'Kann ich Java-Shader in Bedrock nutzen?', a: [p('Nein. Bedrock kann keinen Shader-Code aus Packs laden. Nutze stattdessen ein Vibrant-Visuals-Paket.')] },
  ],
  ctaLabel: 'Shader Maker öffnen',
};

const javaVsBedrock: GuideText = {
  intro: [
    p(
      'Java und Bedrock haben beide Ressourcenpakete, aber die Dateien sind nicht austauschbar. Ein ',
      strong('Java'),
      '-Pack ist eine ',
      code('.zip'),
      ' mit ',
      code('pack.mcmeta'),
      ' und PNG-Texturen unter ',
      code('assets/minecraft/textures/'),
      '. Ein ',
      strong('Bedrock'),
      '-Pack ist ein ',
      code('.mcpack'),
      ' mit ',
      code('manifest.json'),
      ' und Texturen unter ',
      code('textures/'),
      '. Für beide Editionen machst du das Pack also zweimal.',
    ),
  ],
  quick: {
    title: 'Schnelle Antwort: Laufen Java Texture Packs auf Bedrock?',
    items: [
      'Nein. Bedrock kann keine Java-.zip laden, und das Umbenennen in .mcpack hilft nicht.',
      'Die beiden Editionen nutzen unterschiedliche Ordner, Dateinamen und Beschreibungsdateien.',
      'Du kannst ein Pack umwandeln, indem du seine Bilder verschiebst, umbenennst und eine manifest.json hinzufügst, oder es in einem Bedrock-Projekt neu machen.',
    ],
  },
  sections: [
    {
      id: 'compare',
      title: 'Im direkten Vergleich',
      body: [
        table(
          ['', 'Java Edition', 'Bedrock Edition'],
          [
            ['Datei', [code('.zip'), ' (oder ein Ordner)'], [code('.mcpack'), ' (eine umbenannte Zip)']],
            ['Beschreibungsdatei', [code('pack.mcmeta')], [code('manifest.json'), ' mit zwei UUIDs und einer Versionsnummer']],
            ['Zielversion', ['Eine Pack-Format-Nummer, z. B. ', F(LATEST), ' für ', LATEST], ['Eine minimale Engine-Version, z. B. ', code(MIN_ENGINE)]],
            ['Beispiel für einen Texturpfad', [code('assets/minecraft/textures/block/stone.png')], [code('textures/blocks/stone.png')]],
            ['Bildformate', 'PNG', 'PNG oder TGA (Endung der Vanilla-Datei behalten)'],
            ['Symbol', [code('pack.png')], [code('pack_icon.png')]],
            ['Installation', ['In den Ordner ', code('resourcepacks'), ' legen'], 'Datei öffnen; Minecraft importiert sie'],
            ['Shader', 'Iris-/OptiFine-Shaderpakete oder Vanilla-Shader als Ressourcenpaket (1.17+)', 'Kein eigener Shader-Code; Einstellungspakete für Vibrant Visuals'],
            ['Skins', 'Ein PNG, hochgeladen im Launcher oder auf minecraft.net', 'Ein Skinpaket (.mcpack) oder ein im Ankleidezimmer importiertes PNG'],
            ['Konsolen', 'Nicht zutreffend', 'Können keine Dateien importieren; Welt, Realm oder Server mit dem Pack nutzen'],
          ],
        ),
      ],
    },
    {
      id: 'textures',
      title: 'Textur-Unterschiede, auf die du achten solltest',
      body: [
        ul([
          'Die Dateinamen unterscheiden sich zwischen den Editionen, zum Beispiel block/grass_block_top.png in Java und blocks/grass_top.png in Bedrock.',
          'Viele Bedrock-Texturen speichern in ihren transparenten Pixeln Tönungs- oder Färbemasken, Editoren dürfen die Farbe unsichtbarer Pixel also nie verwerfen. Der Texture Pack Maker behält die Pixel exakt bei.',
          'Java kann mit einem Kompatibilitätsbereich mehrere Versionen in einem Pack abdecken; Bedrock-Packs geben eine einzige Mindestversion an.',
        ]),
      ],
    },
    {
      id: 'convert',
      title: 'Kann man ein Java Texture Pack in Bedrock umwandeln?',
      body: [
        p('Ja, aber nicht durch Umbenennen der Datei. Umwandeln heißt, das Pack im Aufbau von Bedrock neu zusammenzusetzen:'),
        steps([
          ['Kopiere die Bilder aus ', code('assets/minecraft/textures/'), ' in die Bedrock-Ordner unter ', code('textures/'), ' (', code('block'), ' → ', code('blocks'), ', ', code('item'), ' → ', code('items'), ').'],
          ['Benenne Dateien um, deren Namen sich unterscheiden, zum Beispiel ', code('grass_block_top.png'), ' → ', code('grass_top.png'), '. Texturen ohne Gegenstück in Bedrock fallen weg.'],
          ['Schreib eine ', code('manifest.json'), ' mit zwei neuen UUIDs, einer Version und einer ', code('min_engine_version'), ' und benenne ', code('pack.png'), ' in ', code('pack_icon.png'), ' um.'],
          ['Prüf die Sonderfälle: Bedrock-Animationen stehen in ', code('textures/flipbook_textures.json'), ' statt in ', code('.png.mcmeta'), '-Dateien, und manche Texturen sind ', code('.tga'), '-Dateien mit Tönungsmasken in ihren transparenten Pixeln.'],
          ['Zippe den Inhalt und benenne die Zip in ', code('.mcpack'), ' um.'],
        ]),
        p(
          'Mojangs eigene Referenz ist ',
          ext('https://learn.microsoft.com/de-de/minecraft/creator/documents/convertingtexturepacks', 'Converting Texture Packs from Java Edition to Bedrock Edition'),
          '. Der schnelle Weg ist der ',
          link('/texture-pack-converter', 'Texture-Pack-Konverter'),
          ': Er verschiebt und benennt jede Textur um, macht aus Animationen Flipbook-Einträge, schreibt das Manifest und listet alles, was er nicht umwandeln konnte.',
        ),
      ],
    },
    {
      id: 'mcpack',
      title: 'Ist ein .mcpack nur eine Zip-Datei?',
      body: [
        p(
          'Ja. Ein ',
          code('.mcpack'),
          ' ist eine ganz normale Zip mit einer anderen Endung, damit Bedrock weiß, dass es importiert werden soll. Benenne es in ',
          code('.zip'),
          ' um, um hineinzuschauen. Zu einem Bedrock-Pack macht es sein Inhalt: ',
          code('manifest.json'),
          ' auf der obersten Ebene und der Ordneraufbau von Bedrock. ',
          code('.mcaddon'),
          '-Dateien bündeln mehrere Packs, und ',
          code('.mcworld'),
          '-Dateien enthalten eine ganze Welt.',
        ),
      ],
    },
    {
      id: 'both',
      title: 'Ein Pack für beide Editionen',
      body: [
        steps([
          ['Leg im ', link('/textures', 'Texture Pack Maker'), ' ein Java-Projekt an und bemale deine Texturen.'],
          'Leg ein Bedrock-Projekt an und bemale (oder lade) dort dieselben Texturen; die Dateiliste ist die von Bedrock.',
          'Exportiere beide und teile beide Dateien.',
        ]),
      ],
    },
  ],
  faq: [
    { id: 'convert', q: 'Kann ich ein Java-Pack in Bedrock umwandeln?', a: [p('Nicht durch Umbenennen der Datei. Ordner, Namen und Beschreibungsdatei unterscheiden sich, die Bilder müssen also verschoben, umbenannt und mit einer manifest.json versehen werden. Der ', link('/texture-pack-converter', 'Texture-Pack-Konverter'), ' erledigt das für dich.')] },
    { id: 'back', q: 'Kann ich ein Bedrock-Pack in Java umwandeln?', a: [p('Genauso, nur umgekehrt: Verschiebe die Bilder nach ', code('assets/minecraft/textures/'), ', benenne sie mit den Java-Namen, wandle .tga-Dateien in PNG um und füge eine ', code('pack.mcmeta'), ' hinzu.')] },
    { id: 'missing', q: 'Warum fehlen nach dem Umwandeln manche Texturen?', a: [p('Jede Edition hat Texturen, die es in der anderen nicht gibt, und manche sind anders aufgeteilt oder zusammengefasst (zum Beispiel Truhen, Gemälde und die Benutzeroberfläche). Die müssen für die andere Edition neu gemalt werden.')] },
    { id: 'which', q: 'Welche Edition spiele ich?', a: [p('Spielst du auf Konsole, Handy oder Tablet oder hast Minecraft aus dem Microsoft Store als „Minecraft für Windows“, ist es Bedrock. Java läuft unter Windows, macOS und Linux über den Minecraft Launcher.')] },
  ],
  ctaLabel: 'Texture Pack Maker öffnen',
};

// ---------------------------------------------------------------- vibrant visuals

const VV_STEPS: Child[] = [
  ['Erstelle ein Pack mit dem ', link('/shaders', 'Shader Maker'), ' (wähle ', strong('Bedrock Vibrant Visuals'), ') und exportiere das ', code('.mcpack'), '.'],
  'Öffne die Datei. Minecraft importiert sie automatisch.',
  ['Geh zu ', uiPath('Einstellungen', 'Globale Ressourcen', 'Meine Pakete'), ' und aktiviere das Pack. Deaktiviere klassische Texture Packs, die Vibrant Visuals nicht unterstützen.'],
  ['Öffne ', uiPath('Einstellungen', 'Grafik'), ' und stelle den ', strong('Grafikmodus'), ' auf ', strong('Lebendige Grafik'), ' (Vibrant Visuals).'],
];

const vibrantVisuals: GuideText = {
  image: SHOTS.vibrantVisuals,
  intro: [
    p(
      strong('Vibrant Visuals'),
      ' (im deutschen Spiel „Lebendige Grafik“) ist der moderne Grafikmodus von Minecraft Bedrock, mit gerichtetem Sonnenlicht, weichen Schatten, Volumennebel, spiegelndem Wasser und physikalisch basierten Materialien. Seit 1.21.90 (Juni 2025) ist er kein Experiment mehr und auf unterstützten Geräten der Standard-Grafikmodus. Ein Ressourcenpaket kann seine Einstellungen anpassen, aber keinen neuen Shader-Code hinzufügen.',
    ),
  ],
  howto: { name: 'Vibrant-Visuals-Paket in Minecraft Bedrock nutzen', steps: VV_STEPS },
  sections: [
    {
      id: 'settings',
      title: 'Was ein Vibrant-Visuals-Paket ändern kann',
      body: [
        table(
          ['Paketordner', 'Was er steuert'],
          [
            [code('lighting/'), 'Helligkeit, Farbe und Bahnneigung von Sonne und Mond, Umgebungslicht (in Höhlen), Himmelslicht und wie farbig leuchtende Blöcke strahlen.'],
            [code('atmospherics/'), 'Himmelsfarben oben und am Horizont und wie sich Licht in der Luft streut (Dichte des Himmels, Abendrot).'],
            [code('color_grading/'), 'Tone-Mapping-Verfahren, Kontrast, Sättigung, Verstärkung, Gamma und Farbtemperatur: der Film-Look.'],
            [code('water/'), 'Wasserfarbe, Wellen und Kaustiken (Lichtmuster unter Wasser).'],
            [code('shadows/'), 'Blockige oder weiche Schatten.'],
            [code('fogs/'), 'Dichte und Farbe des Volumennebels und der klassische Entfernungsnebel.'],
            [code('local_lighting/'), 'Die Lichtfarbe von Blöcken wie Fackeln und Laternen.'],
          ],
        ),
        p('Einstellungen können sich mit der Tageszeit ändern, und Minecrafts eigene Werte sind je nach Biom verschieden – ein gutes Paket passt deshalb jedes Biom an, statt nur eine globale Datei zu ersetzen.'),
        p(strong('Nicht per Paket einstellbar: '), 'Bloom, Belichtung, Bildschirmraum-Spiegelungen, die Beleuchtung der Wolken, die Tone-Mapping-Kurve selbst, Sichtweite und Kantenglättung. Das alles steckt im Renderer des Spiels, nicht in Ressourcenpaketen.'),
      ],
    },
    {
      id: 'devices',
      title: 'Welche Geräte es unterstützen',
      body: [
        ul(['Windows-PCs mit DirectX 12.', 'Xbox Series und PlayStation 5; auf Xbox One und PS4 ist es standardmäßig ausgeschaltet.', 'iPhone und iPad ab A12-Chip.', 'Viele aktuelle Android-Geräte.']),
        p('Auf der ersten Nintendo Switch, auf Chromebooks und Fire-Tablets gibt es das nicht. Server können es abschalten, und im Splitscreen wird stattdessen die klassische Grafik (Fancy) genutzt.'),
      ],
    },
    {
      id: 'enable',
      title: 'Mit einem Paket einschalten',
      body: [
        steps(VV_STEPS),
        callout(
          'warn',
          'Vibrant Visuals ausgegraut?',
          'Minecraft erlaubt es nur, wenn jedes aktive Ressourcenpaket es unterstützt. Klassische Texture Packs schalten es ab, deaktiviere sie also (oder nutze ein Pack, das für Vibrant Visuals gemacht ist). Außerdem braucht die Option ein unterstütztes Gerät.',
        ),
        figure(SHOTS.vibrantVisuals),
      ],
    },
  ],
  faq: [
    { id: 'what', q: 'Was ist Vibrant Visuals in Minecraft?', a: [p('Der eingebaute moderne Grafikmodus von Bedrock (im deutschen Spiel „Lebendige Grafik“), erschienen in 1.21.90. Er bringt gerichtetes Licht, Schatten, Volumennebel, Spiegelungen auf Wasser und PBR-Materialien, ganz ohne Add-ons.')] },
    { id: 'textures', q: 'Braucht Vibrant Visuals ein spezielles Texture Pack?', a: [p('Nein, es funktioniert mit den Standardtexturen. Aber ein klassisches Texture Pack, das keine Unterstützung für Vibrant Visuals angibt, schaltet den Modus ab, solange es aktiv ist.')] },
    { id: 'classic-fog', q: 'Funktionieren Nebeländerungen ohne Vibrant Visuals?', a: [p('Den klassischen Entfernungsnebel kannst du in jedem Grafikmodus ändern. Volumennebel und die Lichteinstellungen gelten nur mit Vibrant Visuals.')] },
  ],
  ctaLabel: 'Vibrant-Visuals-Paket bauen',
};

// ---------------------------------------------------------------- convert java to bedrock

const CONVERT_STEPS: Child[] = [
  ['Öffne den ', link('/texture-pack-converter', 'Texture-Pack-Konverter'), ' und wähle dein Pack: eine Java-', code('.zip'), ', ein Bedrock-', code('.mcpack'), ' oder PNG-Texturen.'],
  ['Wähle das Ziel: ', strong('Bedrock Edition'), ' oder ', strong('Java Edition'), ' mit einer Version.'],
  ['Klicke auf ', strong('Convert'), '. Dein Browser lädt die Texturliste der Ziel-Edition und wandelt jede Textur um, die er umwandeln kann.'],
  'Lies den Bericht: wie viele Texturen umgewandelt wurden, welche übersprungen wurden und warum.',
  'Lade das umgewandelte Pack herunter oder öffne es im Editor, um die übersprungenen Texturen vorher neu zu malen.',
];

const convertJavaToBedrock: GuideText = {
  image: SHOTS.convertResult,
  intro: [
    p(
      'Ein Java Texture Pack funktioniert nicht in Bedrock, und die ',
      code('.zip'),
      ' in ',
      code('.mcpack'),
      ' umzubenennen hilft nicht: Die beiden Editionen nutzen unterschiedliche Ordner, Dateinamen und Beschreibungsdateien. Zum Umwandeln muss jede Textur in den Ordner von Bedrock verschoben, auf den Bedrock-Dateinamen umbenannt und mit einer ',
      code('manifest.json'),
      ' versehen werden. Der kostenlose ',
      link('/texture-pack-converter', 'Texture-Pack-Konverter'),
      ' erledigt das in wenigen Sekunden in deinem Browser, und er funktioniert auch andersherum.',
    ),
  ],
  quick: {
    title: 'Die Kurzfassung',
    items: [
      ['Öffne den ', link('/texture-pack-converter', 'Texture-Pack-Konverter'), ' und wähle deine Java-', code('.zip'), '.'],
      ['Wähle ', strong('Bedrock Edition'), ' und klicke auf ', strong('Convert to Bedrock'), '.'],
      ['Lade das ', code('.mcpack'), ' herunter und öffne es: Minecraft importiert es.'],
    ],
  },
  howto: { name: 'Java Texture Pack in Bedrock umwandeln', steps: CONVERT_STEPS },
  sections: [
    { id: 'steps', title: 'Schritt für Schritt', body: [steps(CONVERT_STEPS), figure(SHOTS.convertPack), figure(SHOTS.convertResult)] },
    {
      id: 'what',
      title: 'Was sich umwandeln lässt und was nicht',
      body: [
        p('Der Konverter weiß, welche Java-Textur dieselbe Rolle spielt wie welche Bedrock-Textur – ermittelt aus den Spieldateien beider Editionen. Die meisten Texturen zeigen in beiden dasselbe Bild und können einfach übernommen werden.'),
        table(
          ['Wird umgewandelt', 'Wird nicht umgewandelt'],
          [
            ['Die meisten Block- und Item-Texturen (etwa vier von fünf)', 'Texturen, die es nur in einer Edition gibt'],
            ['Viele Mob- und Umgebungstexturen (Sonne, Mond, Wolken)', 'Anders aufgebaute Texturen: Truhen, viele Mob-Skins, Banner, die Menüs und Partikel'],
            ['Animierte Texturen: Aus .png.mcmeta wird ein Flipbook-Eintrag', 'Modelle, Sounds, Schriftarten, Splash-Texte und Shader'],
            ['Pack-Symbol, Name und Beschreibung', 'OptiFine-Extras wie verbundene Texturen und eigene Item-Texturen'],
          ],
        ),
        p('Alles Übersprungene steht mit Grund im Bericht, du weißt also genau, was du neu malen musst. Öffne das umgewandelte Pack im ', link('/textures', 'Texture Pack Maker'), ', um diese Texturen vor dem Herunterladen auf ihren 3D-Modellen zu korrigieren.'),
        callout('tip', 'Ein Pack, zwei Editionen', 'Behalte dein Java-Pack als Original und wandle es nach jeder Änderung neu um. Bevor du die neue Version in Bedrock importierst, lösche die alte unter Einstellungen › Speicherung, damit du nicht zwei Kopien hast.'),
      ],
    },
    {
      id: 'bedrock-to-java',
      title: 'Ein Bedrock-Pack in Java umwandeln',
      body: [
        p(
          'Wähle ein Bedrock-',
          code('.mcpack'),
          ' (oder ',
          code('.mcaddon'),
          ') und dann ',
          strong('Java Edition'),
          ' und die Version, die du spielst. Die Texturen kommen in die Ordner und unter die Namen von Java, ',
          code('.tga'),
          '-Bilder werden zu PNG, Flipbook-Animationen werden zu ',
          code('.png.mcmeta'),
          '-Dateien, und das Pack bekommt die passende ',
          code('pack.mcmeta'),
          ' für diese Version.',
        ),
      ],
    },
    {
      id: 'old-java',
      title: 'Ein altes Java-Pack auf eine neue Version bringen',
      body: [
        p(
          'Derselbe Konverter aktualisiert Java-Packs zwischen Versionen. Viele Texturen wurden über die Jahre umbenannt, vor allem in 1.13, als aus ',
          code('textures/blocks'),
          ' der Ordner ',
          code('textures/block'),
          ' wurde und Hunderte Dateien neue Namen bekamen. Wähle das alte Pack, dann ',
          strong('Java'),
          ' und deine Version, und jede umbenannte Textur bekommt ihren neuen Namen. Auch Texturnamen in den eigenen Modellen des Packs werden angepasst.',
        ),
        p(`Es geht auch rückwärts, zum Beispiel um aus einem ${LATEST}-Pack eines für 1.8.9 zu machen.`),
      ],
    },
    {
      id: 'install',
      title: 'Das umgewandelte Pack installieren',
      body: [
        ul([
          ['Bedrock: Öffne das ', code('.mcpack'), ' (Doppelklick unter Windows, „Mit Minecraft öffnen“ auf dem Handy) und aktiviere es unter ', uiPath('Einstellungen', 'Globale Ressourcen'), '.'],
          ['Java: Leg die ', code('.zip'), ' in den Ordner ', code('resourcepacks'), ' und verschiebe sie nach „Ausgewählt“.'],
        ]),
        p('Mehr dazu in ', link('/guides/install-resource-packs', 'Texture Packs installieren'), '. Sieht etwas falsch aus, hilft ', link('/guides/texture-pack-not-working', 'Texture Pack funktioniert nicht'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: 'Ist der Konverter kostenlos?', a: [p('Ja, ohne Konto und ohne Grenzen. Das Pack wird in deinem Browser umgewandelt und nie hochgeladen.')] },
    { id: 'look', q: 'Sieht das Pack in Bedrock gleich aus?', a: [p('Umgewandelte Texturen sehen gleich aus. Übersprungene Texturen fallen auf die von Bedrock zurück, und Bedrocks Beleuchtung sowie Vibrant Visuals können Farben etwas anders wirken lassen.')] },
    { id: 'shaders', q: 'Kann ich ein Java-Shaderpaket in Bedrock umwandeln?', a: [p('Nein. Bedrock lädt keinen eigenen Shader-Code. Nutze stattdessen ein ', link('/guides/bedrock-vibrant-visuals-settings', 'Vibrant-Visuals'), '-Paket, das du mit dem ', link('/shaders', 'Shader Maker'), ' erstellen kannst.')] },
    { id: 'png', q: 'Kann ich PNG-Dateien in ein .mcpack umwandeln?', a: [p('Ja. Wähle ein PNG oder eine Zip mit PNGs, die wie die Texturen des Spiels benannt sind (zum Beispiel ', code('stone.png'), '), und wandle sie in Bedrock um.')] },
    { id: 'console', q: 'Kann ich das umgewandelte Pack auf einer Konsole nutzen?', a: [p('Konsolen können keine Dateien importieren. Füge das Pack auf einem PC oder Handy einer Welt hinzu und tritt dieser Welt bei, oder nutze einen Realm oder Server, der es hat.')] },
  ],
  ctaLabel: 'Texture-Pack-Konverter öffnen',
};

// ---------------------------------------------------------------- merge packs

const MERGE_STEPS: Child[] = [
  ['Öffne ', link('/merge-texture-packs', 'Texture Packs zusammenführen'), ' und füge zwei bis acht Java-', code('.zip'), '- oder Bedrock-', code('.mcpack'), '-Packs hinzu.'],
  'Bring sie per Ziehen oder mit den Pfeiltasten in eine Reihenfolge. Das oberste Pack gewinnt, wo zwei Packs dieselbe Datei ändern.',
  'Gib dem neuen Pack einen Namen und wähle sein Symbol. Für Java wählst du außerdem die Version, die du spielst.',
  ['Klicke auf ', strong('Merge'), ' und sieh dir die Liste der Konflikte an.'],
  'Lade das zusammengeführte Pack herunter oder öffne es im Editor, um weiterzumachen.',
];

const mergePacks: GuideText = {
  image: SHOTS.mergeResult,
  intro: [
    p(
      'Minecraft kann Texture Packs schon stapeln: Schalte mehrere ein, und das weiter oben in der Liste gewinnt, wo zwei dieselbe Textur ändern. Zusammenführen baut aus mehreren Packs eines, mit genau dieser Reihenfolge fest eingebaut. Das ist praktisch für einen Server oder Realm, der nur ein Pack nimmt, zum Teilen deiner Lieblingskombination oder für eine kurze Pack-Liste. Das kostenlose Tool ',
      link('/merge-texture-packs', 'Texture Packs zusammenführen'),
      ' erledigt das in deinem Browser.',
    ),
  ],
  quick: {
    title: 'Die Kurzfassung',
    items: [
      ['Öffne ', link('/merge-texture-packs', 'Texture Packs zusammenführen'), ' und füge zwei bis acht Packs derselben Edition hinzu.'],
      'Zieh sie in eine Reihenfolge: Das oberste Pack gewinnt jeden Konflikt.',
      'Klicke auf „Merge“, prüf die Konfliktliste und lade das Pack herunter.',
    ],
  },
  howto: { name: 'Minecraft Texture Packs zusammenführen', steps: MERGE_STEPS },
  sections: [
    { id: 'steps', title: 'Schritt für Schritt', body: [steps(MERGE_STEPS), figure(SHOTS.mergeSettings), figure(SHOTS.mergeResult)] },
    {
      id: 'wins',
      title: 'Welches Pack gewinnt?',
      body: [
        p('Dieselbe Regel wie in Minecraft: Bei jeder Datei gewinnt das Pack, das in der Liste am weitesten oben steht. Eine Textur und ihre Animationsdatei bleiben immer zusammen, die Animation eines unteren Packs hängt also nie am Bild eines oberen.'),
        p('Manche Dateien werden kombiniert statt ersetzt, damit nichts Nützliches verloren geht:'),
        ul([
          [strong('Java: '), 'Sprachdateien (Eintrag für Eintrag), ', code('sounds.json'), ' (Sound für Sound), Texturatlanten und Schriftarten.'],
          [strong('Bedrock: '), code('terrain_texture.json'), ', ', code('item_texture.json'), ', ', code('flipbook_textures.json'), ', ', code('blocks.json'), ', Sound-Definitionen und Sprachdateien.'],
        ]),
        p('Das Ergebnis listet jeden Konflikt, etwa „block/stone.png aus Pack A, ersetzt Pack B“, und wie viele Dateien jedes Pack beigesteuert hat.'),
      ],
    },
    {
      id: 'versions',
      title: 'Packs für verschiedene Versionen',
      body: [
        p(
          'Java-Packs für verschiedene Versionen lassen sich zusammenführen: Wähle die Version, die du spielst, und ältere Packs bekommen zuerst deren Texturnamen (dieselben Umbenennungen, die der ',
          link('/texture-pack-converter', 'Konverter'),
          ` nutzt), sodass ein 1.12-Pack und ein ${LATEST}-Pack zusammenpassen. Java- und Bedrock-Packs lassen sich nicht direkt zusammenführen: Wandle zuerst eines davon um.`,
        ),
      ],
    },
    {
      id: 'by-hand',
      title: 'Packs von Hand zusammenführen',
      body: [
        steps([
          'Entpacke jedes Pack in einen eigenen Ordner.',
          'Leg einen neuen Ordner an und kopiere zuerst das Pack mit der niedrigsten Priorität hinein, dann jedes höhere darüber, und ersetze Dateien, wenn du gefragt wirst.',
          ['Führe Dateien, die kombiniert werden sollen (', code('sounds.json'), ', Sprachdateien, Atlanten), von Hand zusammen – sonst gewinnt die letzte Kopie.'],
          ['Behalte eine ', code('pack.mcmeta'), ' (Java) oder schreib eine neue ', code('manifest.json'), ' mit neuen IDs (Bedrock) und zippe dann den Inhalt.'],
        ]),
        p('Das Tool erledigt all das, inklusive der kombinierten Dateien und des richtigen Pack-Formats – von Hand lohnt sich nur bei ungewöhnlichen Packs.'),
      ],
    },
  ],
  faq: [
    { id: 'how-many', q: 'Wie viele Packs kann ich zusammenführen?', a: [p('Zwei bis acht auf einmal. Für mehr führst du das Ergebnis erneut mit den nächsten Packs zusammen.')] },
    { id: 'shaders', q: 'Kann ich Shaderpakete zusammenführen?', a: [p('Nein. Iris- und OptiFine-Shaderpakete laufen immer nur einzeln. Vanilla-Shader-Ressourcenpakete lassen sich wie jedes Ressourcenpaket zusammenführen, aber zwei Packs, die dieselbe Shader-Datei ändern, kombinieren ihre Effekte nicht.')] },
    { id: 'server', q: 'Kann ich ein zusammengeführtes Pack als Server-Ressourcenpaket nutzen?', a: [p('Ja. Lade die zusammengeführte ', code('.zip'), ' dort hoch, wo du Server-Packs ablegst, und trag sie wie jedes andere Pack in der ', code('server.properties'), ' ein.')] },
    { id: 'upload', q: 'Werden meine Packs hochgeladen?', a: [p('Nein. Die Packs werden in deinem Browser zusammengeführt und bleiben auf deinem Gerät.')] },
  ],
  ctaLabel: 'Texture Packs zusammenführen',
};

// ---------------------------------------------------------------- bedrock skin pack

const SKIN_PACK_STEPS: Child[] = [
  ['Öffne den ', link('/skin-pack-maker', 'Skinpaket-Ersteller'), ' und starte einen Skin: eine leere oder farbcodierte Vorlage, ein PNG, das du schon hast, den Skin eines Java-Spielers per Benutzername oder einen der Standard-Skins. Wähle breite (4 Pixel) oder schmale (3 Pixel) Arme.'],
  'Bemale ihn auf der 64×64-Vorlage oder direkt auf dem 3D-Modell. Jeder Skin wird als eigenes Projekt auf deinem Gerät gespeichert, und sein Name ist der Name, den Spieler im Spiel sehen.',
  'Erstelle die anderen Skins für das Paket auf dieselbe Weise.',
  ['Öffne einen davon, wähle ', strong('Exportieren'), ' › ', strong('Bedrock-Skinpaket (.mcpack)'), ', gib dem Paket einen Namen, hake die anderen Skins an und drücke ', strong('Paket herunterladen'), '.'],
  ['Öffne das ', code('.mcpack'), ' unter Windows, Android, auf dem iPhone oder iPad. Minecraft importiert es.'],
  ['Geh in Minecraft zu ', uiPath('Ankleidezimmer', 'Klassische Skins'), ', such dein Paket, wähle einen Skin und tippe auf ', strong('Anlegen'), '.'],
];

const bedrockSkinPack: GuideText = {
  image: SHOTS.skinPack,
  intro: [
    p(
      strong('Ja, du kannst kostenlos dein eigenes Skinpaket für Minecraft Bedrock erstellen.'),
      ' Ein Skinpaket (Skin Pack) ist eine ',
      code('.mcpack'),
      '-Datei mit einem oder mehreren Skins und zwei kleinen Beschreibungsdateien, ',
      code('manifest.json'),
      ' und ',
      code('skins.json'),
      '. Male deine Skins im ',
      link('/skin-pack-maker', 'Skinpaket-Ersteller'),
      ' oder lade sie hoch, lade das Paket herunter, öffne es unter Windows, Android, auf dem iPhone oder iPad und trag deine Skins im Ankleidezimmer. Ein Paket im Minecraft Marketplace (im Spiel „Marktplatz“) zu verkaufen ist etwas anderes: Dort veröffentlichen nur Marketplace-Partner, die Mojang zugelassen hat.',
    ),
  ],
  quick: {
    title: 'Die Kurzfassung',
    items: [
      ['Male jeden Skin im ', link('/skin-pack-maker', 'Skinpaket-Ersteller'), ' oder lade ihn hoch, mit breiten oder schmalen Armen.'],
      ['Wähle ', strong('Exportieren'), ' › ', strong('Bedrock-Skinpaket (.mcpack)'), ', gib dem Paket einen Namen und hake die anderen Skins an.'],
      ['Öffne das ', code('.mcpack'), ' und leg einen Skin unter ', uiPath('Ankleidezimmer', 'Klassische Skins'), ' an.'],
    ],
  },
  howto: { name: 'Minecraft-Bedrock-Skinpaket erstellen', steps: SKIN_PACK_STEPS },
  sections: [
    {
      id: 'what',
      title: 'Was steckt in einem Skinpaket?',
      body: [
        p('Ein Skinpaket ist eine Zip-Datei mit der Endung ', code('.mcpack'), '. Auf ihrer obersten Ebene liegen diese Dateien:'),
        table(
          ['Datei', 'Wozu sie da ist'],
          [
            [code('manifest.json'), ['Name des Pakets, zwei eindeutige IDs (UUIDs) und eine Versionsnummer. Der Modultyp ', code('skin_pack'), ' sagt Minecraft, dass es ein Skinpaket ist und kein Texture Pack.']],
            [code('skins.json'), ['Die Liste der Skins: für jeden sein Namensschlüssel, sein PNG, das Modell (', code('geometry.humanoid.custom'), ' für breite Arme, ', code('geometry.humanoid.customSlim'), ' für schmale) und ', code('"type": "free"'), '.']],
            ['Skin-Bilder', ['Ein 64×64-PNG pro Skin, direkt neben der ', code('manifest.json'), '.']],
            [code('texts/en_US.lang'), ['Die Namen im Ankleidezimmer, für das Paket und jeden Skin. ', code('texts/languages.json'), ' listet die Sprachdateien.']],
          ],
        ),
        p(code('"type": "free"'), ' heißt, dass jeder mit dem Paket den Skin tragen darf. Marketplace-Pakete markieren die meisten Skins als ', code('"paid"'), ' – die werden erst nach dem Kauf freigeschaltet. Ein selbst gemachtes Paket nutzt deshalb immer „free“.'),
      ],
    },
    {
      id: 'steps',
      title: 'Mit dem Skinpaket-Ersteller',
      body: [
        steps(SKIN_PACK_STEPS),
        figure(SHOTS.skinPack),
        p(
          'Der Ersteller schreibt ',
          code('manifest.json'),
          ', ',
          code('skins.json'),
          ' und die Sprachdatei für dich, mit neuen IDs für jedes Paket. Breite und schmale Skins passen in ein Paket, jeder Skin behält seinen Namen, und der Paketname, den du eingibst, steht für alle sichtbar über den Skins.',
        ),
        figure(SHOTS.skin3d),
      ],
    },
    {
      id: 'install',
      title: 'Unter Windows, Android und iOS installieren',
      body: [
        tabbed(
          'install-skin-pack',
          [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  ['Doppelklicke auf das ', code('.mcpack'), '. Minecraft öffnet sich und zeigt ', el('em', null, 'Import gestartet...'), ' und dann ', el('em', null, 'erfolgreich importiert'), '.'],
                  ['Öffne ', uiPath('Ankleidezimmer', 'Klassische Skins'), ', wähle einen Skin aus deinem Paket und tippe auf ', strong('Anlegen'), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android & iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Lade das ', code('.mcpack'), ' auf das Handy oder Tablet herunter.'],
                  [strong('Android: '), 'öffne es in den Downloads oder der Dateien-App und wähle Minecraft. ', strong('iPhone / iPad: '), 'tippe es in der Dateien-App an, dann ', uiPath('Teilen', 'Minecraft'), '.'],
                  ['Öffne ', uiPath('Ankleidezimmer', 'Klassische Skins'), ' und leg einen Skin aus deinem Paket an.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Konsolen',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation und Switch können keine Skinpakete oder Skin-Dateien importieren. Auf Konsolen kommen eigene Looks aus dem Charaktereditor oder aus Skinpaketen im Marketplace.')],
            },
          ],
          UI_DE.platform,
        ),
        callout(
          'tip',
          'Nur ein Skin?',
          'Für einen einzelnen Skin brauchst du kein Paket: Öffne unter „Klassische Skins“ deine eigenen Skins, wähle „Importieren“ und such ein 64×64-PNG aus. Ein Paket ist praktischer für mehrere Skins, behält ihre Namen und lässt sich auf jedem Gerät gleich installieren.',
        ),
      ],
    },
    {
      id: 'update',
      title: 'Skinpaket aktualisieren oder löschen',
      body: [
        p('Um ein schon importiertes Paket zu ändern, bearbeite die Skins, exportiere das Paket aus demselben Projekt noch einmal und öffne die neue Datei. Der Ersteller behält die beiden IDs des Pakets und erhöht seine Version (1.0.0, dann 1.0.1 und so weiter), sodass Minecraft das installierte Paket ersetzt, statt es doppelt aufzulisten.'),
        p('Paket von Hand gebaut? Behalte beide UUIDs und erhöhe die Version in der ', code('manifest.json'), ', im Header und im Modul. Neue UUIDs ergeben ein zweites Paket, und dieselbe Version wird nicht noch einmal importiert, weil das Paket schon installiert ist.'),
        p('Zum Löschen geh zu ', uiPath('Einstellungen', 'Speicherung'), ', wähle das Paket aus und lösche es.'),
      ],
    },
    {
      id: 'arms',
      title: 'Breite oder schmale Arme',
      body: [
        p(
          'Jeder Skin in einem Paket hat sein eigenes Modell, ein Paket kann also beides mischen. ',
          strong('Breite'),
          ' Arme (Steve) sind 4 Pixel breit und nutzen ',
          code('geometry.humanoid.custom'),
          '; ',
          strong('schmale'),
          ' Arme (Alex) sind 3 Pixel breit und nutzen ',
          code('geometry.humanoid.customSlim'),
          '. Das Modell muss dazu passen, wie der Skin gemalt wurde, sonst wirken die Arme abgeschnitten oder bekommen einen durchsichtigen Streifen.',
        ),
        p('Importierte Pakete können nur diese beiden Modelle nutzen. Eigene Formen, etwa ein übergroßer Kopf, sind in einem selbst importierten Skinpaket nicht erlaubt.'),
      ],
    },
    {
      id: 'by-hand',
      title: 'Ein Skinpaket von Hand bauen',
      body: [
        p('Du kannst die Dateien auch selbst in einem beliebigen Texteditor schreiben. Ein Paket mit zwei Skins sieht so aus:'),
        pre(SKIN_PACK_TREE),
        p(code('manifest.json'), ' braucht zwei verschiedene UUIDs. Erzeuge eigene mit einem beliebigen UUID-Generator, statt die unten zu kopieren, und behalte sie für spätere Updates:'),
        pre(SKIN_PACK_MANIFEST.trimEnd()),
        p(code('skins.json'), ' listet die Skins. ', code('serialize_name'), ' und ', code('localization_name'), ' sind die ID des Pakets: ein Wort ohne Leerzeichen, das kein anderes Paket nutzt. Der Skinpaket-Ersteller hängt zur Sicherheit den Anfang der UUID des Pakets an.'),
        pre(SKIN_PACK_SKINS_JSON.trimEnd()),
        p(code('texts/en_US.lang'), ' enthält die Namen, die im Spiel angezeigt werden, und ', code('texts/languages.json'), ' enthält ', code('["en_US"]'), ':'),
        pre(SKIN_PACK_LANG.trimEnd()),
        steps([
          ['Leg die Dateien wie gezeigt in einen Ordner, die PNGs direkt neben der ', code('manifest.json'), '.'],
          'Markiere die Dateien im Ordner, nicht den Ordner selbst, und pack sie in eine Zip.',
          ['Benenne die Zip von ', code('.zip'), ' in ', code('.mcpack'), ' um und öffne sie.'],
        ]),
        p('Schlägt der Import fehl, liegt es meist an einem Ordner um die Dateien in der Zip, einem Tippfehler im JSON oder zwei gleichen UUIDs. Der ', link('/skin-pack-maker', 'Skinpaket-Ersteller'), ' schreibt genau diese Dateien – du kannst also auch ein Paket exportieren, in ', code('.zip'), ' umbenennen und hineinschauen.'),
      ],
    },
    {
      id: 'marketplace',
      title: 'Marketplace-Pakete und eigene Pakete',
      body: [
        p('Du willst ein Skinpaket für den Minecraft Marketplace machen? Dort veröffentlichen nur Marketplace-Partner: Studios und Creator, die Mojang in sein Partnerprogramm aufgenommen hat und die jedes Paket zur Prüfung einreichen. Aus dem Spiel oder von einer Webseite aus kannst du kein Paket in den Marketplace hochladen.'),
        ul([
          [strong('Eigenes Skinpaket: '), 'kostenlos, kann jeder machen, wird aus einem ', code('.mcpack'), ' unter Windows, Android, auf iPhone und iPad importiert. Die Datei kannst du mit Freunden teilen.'],
          [strong('Marketplace-Skinpaket: '), 'von einem zugelassenen Partner gemacht, mit Minecoins gekauft oder kostenlos, auf jedem Gerät verfügbar, auch auf Konsolen.'],
        ]),
        p('Pack nur Skins in ein Paket, die du selbst gemacht hast oder teilen darfst.'),
      ],
    },
    {
      id: 'trusted',
      title: 'Warum Freunde vielleicht einen Standard-Skin sehen',
      body: [
        p('Bedrock hat eine Einstellung namens ', strong('Nur vertrauenswürdige Skins erlauben'), '. Spieler, die sie einschalten, sehen jeden eigenen Skin, auch die aus importierten Paketen, als Standard-Skin wie Steve oder Alex. Das ist eine Einstellung auf ihrer Seite, du kannst sie also nicht für sie ändern. Alle anderen sehen deinen Skin so, wie du ihn gemacht hast.'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: 'Kann man Skinpakete für Minecraft Bedrock kostenlos erstellen?', a: [p('Ja. Eigene Skinpakete sind kostenlos zu erstellen und zu nutzen, unter Windows, Android, auf iPhone und iPad. Der Skinpaket-Ersteller braucht kein Konto, und deine Skins bleiben auf deinem Gerät.')] },
    { id: 'java', q: 'Funktionieren Skinpakete in der Java Edition?', a: [p('Nein. Skinpakete gibt es nur in Bedrock. In Java trägst du einen Skin auf einmal, hochgeladen als PNG im Minecraft Launcher. ', link('/guides/make-a-skin', 'Skin erstellen'), '.')] },
    { id: 'console', q: 'Kann ich ein eigenes Skinpaket auf Xbox, PlayStation oder Switch nutzen?', a: [p('Nein. Konsolen können keine Skinpakete oder Skin-Dateien importieren. Windows, Android, iPhone und iPad schon.')] },
    { id: 'marketplace', q: 'Kann ich mein Skinpaket im Marketplace verkaufen?', a: [p('Nur als zugelassener Partner des Minecraft Marketplace. Ein eigenes Paket kannst du als .mcpack-Datei teilen, aber nicht im Spiel verkaufen.')] },
    { id: 'failed', q: 'Warum schlägt der Import fehl?', a: [p('Meist liegt ein Ordner um die Dateien in der Zip, das JSON hat einen Tippfehler, die beiden UUIDs sind gleich, oder ein Paket mit denselben IDs und derselben Version ist schon installiert. Pakete aus dem Skinpaket-Ersteller vermeiden alle vier Fehler.')] },
  ],
  ctaLabel: 'Skinpaket-Ersteller öffnen',
};

// ---------------------------------------------------------------- 3D items

const MODEL_STEPS: Child[] = [
  ['Öffne den ', link('/textures', 'Texture Pack Maker'), ' und erstelle ein ', strong('Java'), '-Pack für deine Version: 1.8 oder neuer, oder 1.21.4 oder neuer, wenn das Item im Inventar flach bleiben soll.'],
  ['Stell die Liste auf ', strong('Items'), ' und öffne das Item, zum Beispiel das Diamantschwert. Drücke im Tab ', strong('Preview'), ' auf ', strong('Form bearbeiten'), '.'],
  ['Wähle ', strong('3D-Item aus dem Sprite'), '. Jedes Pixel des flachen Bildes wird Teil eines Würfels mit 1 Pixel Tiefe.'],
  ['Ändere die Form: Klicke einen Würfel in der 3D-Ansicht oder in der Liste an und verschiebe, vergrößere oder kopiere ihn oder füge neue hinzu. Unter ', strong('Seiten'), ' bekommt eine Seite eine andere Textur oder einen anderen Ausschnitt.'],
  ['Öffne ', strong('Anzeige'), ' und prüfe das Modell im Inventar, in der Ich- und der Dritte-Person-Ansicht, auf dem Boden, im Rahmen und auf dem Kopf. Passe Drehung, Position oder Größe an, wo es nicht passt.'],
  ['Optional ab 1.21.4: Schalte im Tab ', strong('Modell'), ' die Option ', strong('Flach im Inventar'), ' ein, damit das flache Symbol im Inventar bleibt und das 3D-Modell in der Hand erscheint.'],
  ['Drücke ', strong('Fertig'), ', exportiere das Pack als ', code('.zip'), ', leg es in deinen Ordner ', code('resourcepacks'), ' und teste es im Spiel.'],
];

const make3dItems: GuideText = {
  image: SHOTS.model3dSword,
  intro: [
    p(
      'Die Form eines Blocks oder Items in Minecraft Java Edition kommt aus seinem ',
      strong('Modell'),
      ': einer kleinen JSON-Datei aus Würfeln im Ressourcenpaket. Leg ein neues Modell in dein Texture Pack und die Form ändert sich, ganz ohne Mods und ohne OptiFine: Aus einem flachen Schwert wird ein 3D-Schwert, aus einem Block eine Stufe oder eine Treppe. Der ',
      link('/textures', 'Texture Pack Maker'),
      ' hat einen Modell-Editor, der das im Browser erledigt. Er macht mit einem Klick aus dem flachen Sprite eines Items 3D-Würfel, lässt dich jeden Würfel ändern und schreibt die Dateien, die deine Spielversion braucht. Bedrock funktioniert anders, mehr dazu weiter unten.',
    ),
  ],
  quick: {
    title: 'Die Kurzfassung',
    items: [
      ['Zeig das Item im Texture Pack Maker im Tab ', strong('Preview'), ' an und drücke ', strong('Form bearbeiten'), '.'],
      ['Wähle ', strong('3D-Item aus dem Sprite'), ' und verfeinere dann die Würfel und die Haltung in der Hand.'],
      ['Exportiere das Pack. Es enthält das Modell in ', code('models/item/'), ' und ab 1.21.4, wenn nötig, eine Item-Definition in ', code('items/'), '.'],
    ],
  },
  howto: { name: '3D-Item in einem Minecraft Texture Pack erstellen', steps: MODEL_STEPS },
  sections: [
    {
      id: 'what',
      title: 'Was ein Minecraft-Modell ist',
      body: [
        p('Java Edition ab 1.8 zeichnet die meisten Blöcke und Items aus Modelldateien im Ressourcenpaket:'),
        ul([
          [code('assets/minecraft/models/block/'), ' enthält Blockmodelle wie ', code('oak_slab.json'), '. Eine ', strong('Blockzustand'), '-Datei in ', code('blockstates/'), ' legt fest, welches Modell ein Block in jedem Zustand nutzt: eine Stufe unten oder oben, ein liegender Stamm.'],
          [code('assets/minecraft/models/item/'), ' enthält Item-Modelle. Die meisten Items nutzen ein flaches Modell (', code('item/generated'), '): Das Spiel macht aus dem 16×16-Sprite selbst eine dünne Form. Seit 1.21.4 legt eine ', strong('Item-Definition'), ' in ', code('assets/minecraft/items/'), ' fest, welches Modell ein Item zeigt.'],
        ]),
        p('Eine Modelldatei hat vier Hauptteile:'),
        ul([
          [code('textures'), ': Namen für die Texturen, die das Modell nutzt, etwa ', code('"oak_planks": "minecraft:block/oak_planks"'), '. ', code('particle'), ' ist die Textur der Partikel beim Abbauen.'],
          [code('elements'), ': die Würfel. Jeder reicht von einer Ecke (', code('from'), ') zur gegenüberliegenden (', code('to'), '), gemessen in Pixeln eines Blocks von 16 × 16 × 16, und darf auf jeder Achse von -16 bis 32 gehen. Mit ', code('rotation'), ' lässt sich ein Würfel drehen.'],
          [code('faces'), ': für jede Seite eines Würfels (', code('down'), ', ', code('up'), ', ', code('north'), ', ', code('south'), ', ', code('west'), ', ', code('east'), ') die Textur, ihr Ausschnitt (', code('uv'), ') und ', code('cullface'), ', das die Seite weglässt, wenn ein voller Block sie verdeckt.'],
          [code('display'), ': wie das Modell gedreht, verschoben und skaliert wird, im Inventar (', code('gui'), '), in den Händen, auf dem Boden, im Rahmen (', code('fixed'), ') und auf dem Kopf.'],
        ]),
        p('Hier ein Modell aus einem einzigen Würfel in Form einer Stufe, so aufgebaut, wie der Modell-Editor es schreibt. Eine Datei aus dem Editor enthält die Darstellung aller Plätze, nicht nur die im Inventar:'),
        pre(MODEL_BLOCK_EXAMPLE.trimEnd()),
        p(
          'Von Hand geschriebene Modelle nutzen oft ',
          code('"parent"'),
          ', um Texturen, Würfel oder Darstellung von einem anderen Modell zu übernehmen. Der Modell-Editor schreibt dagegen vollständige Dateien: Alles, was er aus den Eltern-Modellen gelesen hat, steht mit drin, deine Datei hängt also von keiner anderen ab.',
        ),
        callout('tip', 'Koordinaten sind Pixel', 'Ein Block ist auf jeder Achse 16 Einheiten groß, 8 ist also ein halber Block. Der Modell-Editor rastet in diesem Raster ein, oder in ½ oder ¼ Pixel, und zeigt Größen als „16 = one block“.'),
      ],
    },
    {
      id: 'steps',
      title: 'Ein 3D-Item Schritt für Schritt',
      body: [steps(MODEL_STEPS), figure(SHOTS.modelEditShape), figure(SHOTS.modelSpriteStart), figure(SHOTS.model3dSword)],
    },
    {
      id: 'sprite',
      title: 'So funktioniert „3D item from sprite“',
      body: [
        p(
          'Ein flaches Item ist ein einziges Bild, sein Sprite, meist 16×16 Pixel. Der Startpunkt nimmt jedes Pixel, das nicht durchsichtig ist, und baut daraus Würfel mit 1 Pixel Tiefe, mittig wie die flachen Items des Spiels (von 7,5 bis 8,5 auf der Z-Achse). Pixel in einer Reihe werden zu einem langen Würfel zusammengefasst, gleiche Reihen untereinander zu einem Rechteck. So wird das Diamantschwert zu 19 Würfeln statt zu einem Würfel pro Pixel. Seiten, die ein benachbartes Pixel ganz verdeckt, fallen weg.',
        ),
        p('Jede Seite zeigt die passenden Pixel des Sprites. Drei Pixel in einer Reihe, in den Spalten 5 bis 7 der Zeile 3, ergeben diesen Würfel:'),
        pre(MODEL_SPRITE_CUBE.trimEnd()),
        p(
          'Die Vorderseite (',
          code('south'),
          ') zeigt die Pixel, wie sie sind, die Rückseite (',
          code('north'),
          ') gespiegelt, so wie man ein Bild von hinten sieht. Die Würfel nutzen weiter die Textur des Items (',
          code('#layer0'),
          '): Bemalst du das Sprite neu, bekommt das 3D-Item die neuen Farben. Pixel, die du hinzufügst oder löschst, ändern die Form erst, wenn du ',
          strong('3D-Item aus dem Sprite'),
          ' noch einmal wählst. Items aus mehreren Ebenen wie Tränke oder Lederrüstung bekommen Würfel für jede Ebene, und das Spiel färbt sie weiterhin ein.',
        ),
        p('Dann mach es zu deinem eigenen:'),
        ul([
          'Mach die Klinge dicker: Wähle ihre Würfel aus und ändere Z-Position und -Größe, zum Beispiel von 7,5 und 1 auf 7 und 2.',
          ['Füg mit dem Knopf ', strong('+'), ' (oder N) einen Würfel für eine Parierstange oder einen Edelstein hinzu und gib seinen Seiten unter ', uiPath('Faces', 'Change'), ' eine andere Textur.'],
          ['Dreh einen Würfel unter ', strong('Rotation'), '. Vor Minecraft 1.21.6 dreht sich ein Würfel nur um eine Achse, um -45°, -22,5°, 0°, 22,5° oder 45°; der Editor bietet an, was deine Version erlaubt.'],
          'Jede Änderung machst du mit Strg+Z rückgängig.',
        ]),
      ],
    },
    {
      id: 'display',
      title: 'Die Haltung festlegen: Display',
      body: [
        p('Der Tab ', strong('Anzeige'), ' zeigt das Modell an sechs Stellen in der Vorschau. Jede hat eine Drehung in Grad, eine Position in Pixeln (bis ±80) und eine Größe (1 ist normal, höchstens 4).'),
        table(
          ['Im Editor', 'Wo es zu sehen ist', 'Name in der Datei'],
          [
            ['Inventory', 'Inventar und Schnellzugriffsleiste', code('gui')],
            ['First person', 'In deiner eigenen Hand', [code('firstperson_righthand'), ' (die linke Hand ist das Spiegelbild)']],
            ['Third person', 'In der Hand eines Spielers, den du ansiehst, oder in der F5-Ansicht', code('thirdperson_righthand')],
            ['Ground', 'Auf den Boden geworfen', code('ground')],
            ['Item frame', 'In einem Rahmen', code('fixed')],
            ['Head', 'Auf dem Kopf getragen', code('head')],
          ],
        ),
        p(
          strong('3D-Item aus dem Sprite'),
          ' übernimmt die Darstellung des Items, ein 3D-Schwert wird also gehalten wie das flache. ',
          strong('Game’s default'),
          ' setzt einen Platz auf die Werte des Spiels zurück, ',
          strong('No change'),
          ' entfernt die Einstellung. Java 1.21.9 hat den Platz ',
          code('on_shelf'),
          ' für Regale eingeführt; der Editor übernimmt den Wert aus dem Modell des Spiels.',
        ),
        figure(SHOTS.modelDisplay),
      ],
    },
    {
      id: 'flat',
      title: 'Flaches Symbol im Inventar behalten (ab 1.21.4)',
      body: [
        p(
          'Viele 3D-Packs behalten im Inventar das gewohnte flache Symbol und zeigen das 3D-Modell nur in der Hand. Seit Java 1.21.4 kann eine Item-Definition das Modell danach wählen, wo das Item gezeigt wird. Schalte im Tab ',
          strong('Modell'),
          ' die Option ',
          strong('Flach im Inventar'),
          ' ein, dann:',
        ),
        ul([
          ['speichert der Editor deine Form als zweites Modell, ', code('models/item/diamond_sword_3d.json'), ', und lässt das flache ', code('diamond_sword.json'), ' unverändert;'],
          ['schreibt er ', code('items/diamond_sword.json'), ', das im Inventar (', code('gui'), '), auf dem Boden und im Rahmen (', code('fixed'), ') das flache Modell zeigt und überall sonst das 3D-Modell:'],
        ]),
        pre(MODEL_FLAT_DEFINITION.trimEnd()),
        p('Versionen vor 1.21.4 haben keine Item-Definitionen. Dort zeigt ein Item überall dasselbe Modell, und der Schalter fehlt.'),
        figure(SHOTS.modelFlatInventory),
      ],
    },
    {
      id: 'blocks',
      title: 'Die Form eines Blocks ändern',
      body: [
        p(
          'Bei Blöcken geht es genauso. Zeig einen Block im Tab Preview an und drücke ',
          strong('Form bearbeiten'),
          '. Der Editor öffnet das Modell, das der Block in dem Zustand nutzt, den du gerade siehst, und das Menü oben listet seine anderen Modelle, etwa die obere und die doppelte Stufe. Behalte das Modell des Spiels oder beginne mit ',
          strong('Full cube'),
          ', ',
          strong('Slab'),
          ', ',
          strong('Cross (plant)'),
          ' oder ',
          strong('Empty'),
          ' und füge dann Würfel hinzu, verschiebe sie und ändere ihre Größe. Aus Stein wird eine Treppenstufe mit dem Startpunkt Slab und einem weiteren Würfel:',
        ),
        figure(SHOTS.modelBlock),
        ul([
          [strong('Geteilte Modelle: '), 'Manche Blöcke nutzen dieselbe Modelldatei. Nutzt ein anderer Block das Modell, das du bearbeitest, sagt dir der Editor welcher; er ändert sich mit.'],
          [strong('Items bleiben getrennt: '), 'Ein Item, das ein Blockmodell zeigt, etwa eine Stufe in der Hand, bekommt ein eigenes Item-Modell, wenn du das Item bearbeitest. Der Block behält also seine Form.'],
          [strong('Nur das Aussehen ändert sich: '), 'Hitbox, Kollision und Licht kommen aus dem Code des Spiels. Ein Steinblock in Form einer Stufe hält dich weiter auf wie ein voller Block, und die Blöcke daneben blenden weiter ihre anliegenden Seiten aus. Dadurch können Lücken entstehen, durch die man hindurchsieht.'],
          [strong('Vom Spiel gezeichnete Blöcke: '), 'Truhen, Betten, Schilder, Banner und andere Blöcke, die das Spiel selbst zeichnet, haben kein Blockmodell, darum gibt es für sie kein Edit shape. Vom Code gezeichnete Items wie der Schild können ein Modell bekommen, das dieses Aussehen ersetzt.'],
        ]),
        p(
          'Stein und einige andere Blöcke wählen zufällig zwischen zwei Modellen: Stein und einer gespiegelten Kopie, jeweils auch gedreht. ',
          strong('Use for every random variant'),
          ' im Tab Model setzt deine Form auf alle davon, indem der Editor die Blockzustandsdatei des Blocks schreibt. Der Eintrag ',
          code('"y": 180'),
          ' erhält die zufällige Drehung, und ',
          code('weight'),
          ' legt fest, wie oft jeder Eintrag gewählt wird:',
        ),
        pre(MODEL_STONE_BLOCKSTATE.trimEnd()),
      ],
    },
    {
      id: 'files',
      title: 'Welche Dateien ins Pack kommen',
      body: [
        table(
          ['Was du änderst', 'Dateien im Pack'],
          [
            ['Ein 3D-Item', code(MODEL_FILES.sword.latest[0])],
            ['Ein 3D-Item, flach im Inventar (ab 1.21.4)', [code(MODEL_FILES.swordFlat.latest[0]), ' und ', code(MODEL_FILES.swordFlat.latest[1])]],
            ['Die Form eines Blocks', code(MODEL_FILES.slab.latest[0])],
            ['Die Form eines Blocks für jede Zufallsvariante', [code(MODEL_FILES.stoneEvery.latest[0]), ' und ', code(MODEL_FILES.stoneEvery.latest[1])]],
          ],
        ),
        p(
          'Alle Pfade liegen in ',
          code('assets/minecraft/'),
          '. Jede Java-Version ab 1.8 bekommt dieselben Dateien; nur „flach im Inventar“ braucht 1.21.4 oder neuer. Der Editor fügt eine Item-Definition oder einen Blockzustand nur hinzu, wenn das Spiel sie braucht, und Modelldateien, die schon in einem geöffneten Pack liegen, bleiben erhalten und lassen sich bearbeiten. Beim Export wird jedes Modell für deine Spielversion geprüft, und du bekommst eine Warnung zu allem, was nicht laden würde.',
        ),
        h3('Was sich zwischen den Versionen geändert hat'),
        table(
          ['Version', 'Was sich für Modelle geändert hat'],
          [
            ['1.8', 'Block- und Item-Modelle wurden JSON-Dateien, die Ressourcenpakete ersetzen können. Würfel drehen sich um eine Achse, um -45°, -22,5°, 0°, 22,5° oder 45°.'],
            ['1.13', ['Die Texturordner heißen nicht mehr ', code('blocks'), ' und ', code('items'), ', sondern ', code('block'), ' und ', code('item'), '. Damit änderten sich auch die Texturnamen in Modellen.']],
            ['1.15.2', [code('gui_light'), ' legt fest, ob das Inventarsymbol von der Seite (Blöcke) oder von vorn (Items) beleuchtet wird.']],
            ['1.19.3', ['Modelltexturen müssen in einem Ordner liegen, den die Texturatlanten des Spiels lesen, etwa ', code('textures/block/'), ' oder ', code('textures/item/'), '.']],
            ['1.21.4', ['Item-Definitionen in ', code('items/'), ' wählen das Modell eines Items, auch danach, wo es gezeigt wird.']],
            ['1.21.6', 'Würfel lassen sich um jeden Winkel von -45° bis 45° drehen.'],
            ['1.21.9', ['Neuer Darstellungsplatz ', code('on_shelf'), '.']],
            ['1.21.11', 'Würfel drehen sich um mehrere Achsen gleichzeitig und um jeden Winkel.'],
          ],
        ),
        p('Der Modell-Editor hält sich an diese Regeln für die Version, für die dein Pack gemacht ist.'),
      ],
    },
    {
      id: 'install',
      title: 'Installieren und testen',
      body: [
        steps([
          ['Drücke ', strong('Fertig'), ', um den Modell-Editor zu verlassen, und exportiere das Pack dann mit ', strong('Exportieren'), ' als ', code('.zip'), '.'],
          ['Öffne in Minecraft ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ', leg die Zip hinein (nicht entpacken) und verschiebe das Pack nach ', strong('Ausgewählt'), ', über andere Packs.'],
          'Halte das Item, drücke F5 für die Dritte-Person-Ansicht, wirf es auf den Boden und häng es in einen Rahmen, um jede Darstellung zu prüfen.',
          'Nach einer Änderung am Modell exportierst du neu, ersetzt die Zip und drückst im Spiel F3 + T, um die Packs neu zu laden.',
        ]),
        p('Mehr Hilfe: ', link('/guides/install-resource-packs', 'Ressourcenpakete installieren'), ' und ', link('/guides/texture-pack-not-working', 'Texture Pack funktioniert nicht'), '.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock Edition',
      body: [
        p('Bedrock-Packs funktionieren anders, und der Modell-Editor macht nur Java-Modelle:'),
        ul([
          [strong('Blöcke: '), 'Ein Bedrock-Ressourcenpaket kann die Form der Blöcke des Spiels nicht ändern. Ein Block mit eigener Form ist ein neuer Block, hinzugefügt von einer Erweiterung mit Verhaltenspaket und Geometriedatei.'],
          [strong('Items in der Hand: '), 'Bedrock gibt Items mit Attachables ein 3D-Modell in der Hand. Das sind Dateien in einem Ressourcenpaket, die Bedrock-Geometrie und Animationen nutzen. Der Texture Pack Maker erstellt sie nicht, ', ext('https://www.blockbench.net/', 'Blockbench'), ' schon.'],
          [strong('Ein Ausgangspunkt: '), 'Im Menü des Modell-Editors speichert ', strong('Als Bedrock-Geometrie herunterladen'), ' dein Modell als ', code('.geo.json'), '-Datei (Format 1.12.0, ein Knochen, alle Würfel), die du in Blockbench oder eine Erweiterung importieren kannst. Bedrock-Geometrie nutzt eine einzige Textur, darum behält jede Seite ihre Stelle auf ihrer eigenen Textur.'],
        ]),
        p('In einem Bedrock-Pack erklärt ', strong('Form bearbeiten'), ' das, statt den Editor zu öffnen. Texturen bemalen funktioniert wie gewohnt.'),
      ],
    },
    {
      id: 'problems',
      title: 'Häufige Probleme',
      body: [
        ul([
          [strong('Lila-schwarze Seiten: '), 'Eine Seite nutzt eine Textur, die das Spiel nicht findet: einen Namen (', code('#…'), '), der unter ', code('textures'), ' fehlt, eine Datei, die weder im Spiel noch im Pack ist, oder seit 1.19.3 eine Textur außerhalb der Atlas-Ordner. Der Tab Model listet diese Probleme mit dem Würfel, an dem sie liegen.'],
          [strong('Ein lila-schwarzer Würfel statt des Modells: '), 'Die Datei wurde nicht geladen. Häufige Gründe sind kaputtes JSON, ein Würfel außerhalb von -16 bis 32 oder eine Drehung, die die Version nicht erlaubt. Das Protokoll des Spiels nennt die Datei.'],
          [strong('Das Modell erscheint gar nicht: '), 'Prüfe, dass das Pack ausgewählt ist und über anderen Packs steht, dass die Datei genau den Namen und Ordner des Modells hat, das sie ersetzt, und ab 1.21.4, dass ein neues Modell (etwa eine ', code('_3d'), '-Kopie) eine Item-Definition hat, die darauf zeigt.'],
          [strong('In der Hand gut, im Inventar seltsam: '), ['Passe die Darstellung Inventory an, probiere das andere Inventarlicht (seitlich oder von vorn) oder schalte ', strong('Flach im Inventar'), ' ein.']],
          [strong('Zu viele Würfel: '), 'Jeder Würfel bringt Seiten, die gezeichnet werden müssen. Für ein Item in der Hand spielt das kaum eine Rolle, aber ein Block, der tausendfach platziert wird, sollte einfach bleiben. Behalte die zusammengefassten Würfel von 3D item from sprite, statt sie aufzuteilen.'],
          [strong('Ein Winkel ist nicht erlaubt: '), 'Vor 1.21.6 dreht sich ein Würfel in Schritten von 22,5° bis 45°, um eine Achse. Für eine Vierteldrehung tauschst du stattdessen die Größe auf zwei Achsen; andere Formen baust du aus mehr Würfeln.'],
        ]),
        p('Weitere Lösungen für Packs allgemein: ', link('/guides/texture-pack-not-working', 'Texture Pack funktioniert nicht? Lösungen'), '.'),
      ],
    },
  ],
  faq: [
    {
      id: 'mods',
      q: 'Brauche ich OptiFine oder eine Mod für 3D-Items?',
      a: [p('Nein. Java-Ressourcenpakete können Block- und Item-Modelle seit 1.8 ersetzen, ein Pack mit Modelldateien funktioniert also im normalen Spiel. Es ändert jedes Item dieser Sorte.')],
    },
    {
      id: 'renamed',
      q: 'Kann nur ein umbenanntes Item 3D sein?',
      a: [
        p(
          'Nicht mit einer einfachen Modelländerung. Packs, die nur umbenannte Items ändern, nutzen die Custom Item Textures (CIT) von OptiFine oder eine Mod, die sie liest. Seit 1.21.4 können Item-Definitionen ein Modell auch nach ',
          code('custom_model_data'),
          ' wählen, das Server und Kartenbauer mit Befehlen setzen. Der Modell-Editor ändert jedes Item einer Sorte.',
        ),
      ],
    },
    {
      id: 'bedrock',
      q: 'Kann ich 3D-Items für Bedrock machen?',
      a: [p('Ja, mit Attachables in einem Bedrock-Ressourcenpaket, erstellt mit einem Werkzeug wie Blockbench. Dieser Modell-Editor macht Java-Modelle, kann ein Modell aber als Bedrock-Geometrie zum Weiterarbeiten herunterladen. Die Form der Blöcke des Spiels können Bedrock-Ressourcenpakete nicht ändern.')],
    },
    {
      id: 'blockbench',
      q: 'Kann ich Modelle aus Blockbench verwenden?',
      a: [p('Ja. Aus Blockbench exportierte Java-Block- und -Item-Modelle sind normale Modelldateien. Leg sie unter dem Namen des Modells, das sie ersetzen, in dein Pack und öffne das Pack mit ', strong('Pack öffnen'), ': Die Dateien bleiben erhalten, und der Modell-Editor kann sie öffnen und ändern.')],
    },
    {
      id: 'undo',
      q: 'Wie bekomme ich die ursprüngliche Form zurück?',
      a: [p('Wähle im Menü des Modell-Editors ', strong('Put back the original model'), '. Deine Dateien für dieses Modell werden aus dem Pack entfernt, und das Spiel nutzt wieder sein eigenes Modell.')],
    },
    {
      id: 'phone',
      q: 'Kann ich 3D-Items am Handy erstellen?',
      a: [p('Ja. Auf dem Handy sitzt die 3D-Ansicht über den Feldern, und du arbeitest mit Touch. Das Pack bleibt ein Java-Pack, gespielt wird also am Computer.')],
    },
  ],
  ctaLabel: 'Texture Pack Maker öffnen',
};

// ---------------------------------------------------------------- PvP pack

const PVP_STEPS: Child[] = [
  ['Öffne den ', link('/textures', 'Texture Pack Maker'), ', gib deinem Pack einen Namen und wähle ', strong('PvP-/FPS-Pack'), '. Schalte ', strong('Auch ein FPS-Pack'), ' ein, wenn du 8×-Texturen und keine Animationen willst.'],
  ['Wähle Java oder Bedrock und die Version, die du spielst, zum Beispiel Java 1.8.9 für 1.8-PvP-Server, und drücke ', strong('PvP-Pack erstellen'), '.'],
  ['Der Editor lädt die Texturen dieser Version und schaltet die PvP-Vorlage ein: niedriges Feuer, klares Glas, kein Kürbis-Rand, ein saubereres Fadenkreuz, kleinere Schwerter und einen tieferen Schild, soweit es sie in der Version gibt.'],
  ['Ändere im Tab ', strong('PvP'), ', was du willst: die Feuerhöhe, die Form des Fadenkreuzes, die Schwertgröße, die Höhe des Schilds. Jede Änderung lässt sich über ihre Meldung rückgängig machen.'],
  'Optional: Male alles andere, etwa klarere Wollfarben oder eine kürzere Schwerttextur.',
  ['Drücke ', strong('Exportieren'), ', leg das Pack in Minecraft und wähle es über deinen anderen Packs aus.'],
];

const pvpLabel = (l: string) => l;

const pvpPack: GuideText = {
  image: SHOTS.pvpTweaks,
  intro: [
    p(
      'Ein PvP-Texture-Pack ändert, was dir im Kampf im Weg ist: das Feuer, das den halben Bildschirm verdeckt, wenn du brennst, Glas, durch das du nicht siehst, die dunkle Kürbis-Sicht, ein großes Fadenkreuz und ein Schwert, das den Spieler verdeckt, den du triffst. FPS-Packs gehen weiter und machen Texturen kleiner und unbewegt, damit schwächere Computer mitkommen. Das alles sind normale Dateien eines Ressourcenpakets, ganz ohne Mods. Der ',
      link('/textures', 'Texture Pack Maker'),
      ' erstellt sie im Browser mit je einem Schalter, für Java 1.8.9 (die Version, auf der viele PvP-Server aufbauen) bis ',
      LATEST,
      ' und zum Teil für Bedrock.',
    ),
  ],
  quick: {
    title: 'Die Kurzfassung',
    items: [
      ['Wähle im Texture Pack Maker ', strong('PvP-/FPS-Pack'), ' und deine Minecraft-Version, dann ', strong('PvP-Pack erstellen'), '.'],
      ['Wähle im Tab ', strong('PvP'), ' Feuerhöhe, Fadenkreuz, Schwertgröße und die FPS-Optionen, die du willst.'],
      ['Exportiere das Pack und wähle es in Minecraft über deinen anderen Packs aus.'],
    ],
  },
  howto: { name: 'PvP-Texture-Pack mit dem Texture Pack Maker erstellen', steps: PVP_STEPS },
  sections: [
    {
      id: 'what',
      title: 'Was ein PvP-Pack ändert',
      body: [
        p('Die meisten PvP- und FPS-Packs, vom Bedwars-Pack bis zum „FPS-Boost“-Pack, bestehen aus denselben wenigen Änderungen. Jede davon ist ein Schalter im Tab „PvP“ des Editors:'),
        table(
          ['Änderung', 'Was sie macht', 'Java', 'Bedrock'],
          [
            ['Niedriges Feuer', 'Die Flammen auf dem Bildschirm sitzen tiefer, wenn du brennst.', 'Jede Version', 'Nein'],
            ['Klares Glas', 'Glas, gefärbtes Glas und Scheiben sind innen durchsichtig und behalten ihren Rand.', 'Jede Version', 'Ja'],
            ['Kein Kürbis-Rand', 'Ein geschnitzter Kürbis auf dem Kopf verdunkelt den Bildschirm nicht mehr.', 'Jede Version', 'Ja'],
            ['Eigenes Fadenkreuz', 'Ein kleineres Fadenkreuz: Punkt, kleines Kreuz, Kreuz mit Lücke, Kreis oder X-Form, oder ein selbst gezeichnetes.', 'Jede Version', 'Ja'],
            ['Kleinere Schwerter', 'Schwerter oder alle Waffen wirken in der Ego-Ansicht kleiner und tiefer.', 'Ab 1.8', 'Nein'],
            ['Tieferer Schild', 'Der Schild sitzt in der Ego-Ansicht tiefer, auch beim Blocken.', 'Ab 1.9', 'Nein'],
            ['8×-Texturen', 'Blöcke (und Items) mit 8 × 8 Pixeln.', 'Jede Version', 'Ja'],
            ['Keine Animationen', 'Wasser, Lava, Feuer und Portale stehen still.', 'Jede Version', 'Nein'],
          ],
        ),
        p('Jeder Schalter schreibt normale Pack-Dateien, du kannst also weiter darauf malen. Schaltest du einen aus, kommen die Dateien zurück, die er geändert hat, außer denen, die du seitdem bemalt oder bearbeitet hast. Die Tabelle am Ende nennt die genauen Dateien für jede Version.'),
      ],
    },
    {
      id: 'steps',
      title: 'Ein PvP-Pack Schritt für Schritt',
      body: [steps(PVP_STEPS), figure(SHOTS.pvpStart), figure(SHOTS.pvpTweaks)],
    },
    {
      id: 'fire',
      title: 'Niedriges Feuer',
      body: [
        p(
          'Java zeichnet das Feuer auf dem Bildschirm mit einer einzigen Textur: ',
          code('textures/block/fire_1.png'),
          ' (vor 1.13 ',
          code('textures/blocks/fire_layer_1.png'),
          '). Sie ist ein animierter Streifen mit 32 Bildern, und „Niedriges Feuer“ schiebt die Flammen in jedem Bild um 5, 8 oder 11 von 16 Pixeln nach unten (',
          strong('Tief'),
          ', ',
          strong('Tiefer'),
          ', ',
          strong('Ganz tief'),
          '), damit der obere Teil des Bildschirms frei bleibt. Die Animation läuft weiter.',
        ),
        p(
          'Feuerblöcke nutzen dieselbe Textur, ein einfaches Low-Fire-Pack lässt also auch Feuer in der Welt abgeschnitten aussehen. Mit ',
          strong('Feuerblöcke so lassen, wie sie sind'),
          ' (Java ab 1.8) bekommt das Pack eine Kopie der ursprünglichen Textur, ',
          code('fire_1_world.png'),
          ', und die Modelle der Feuerblöcke zeigen darauf. Brennende Spieler und Mobs zeigen weiter die tieferen Flammen.',
        ),
      ],
    },
    {
      id: 'glass',
      title: 'Klares Glas und kein Kürbis-Rand',
      body: [
        p(
          '„Klares Glas“ behält den äußeren Pixelring, einen Pixel bei 16× und zwei bei 32×, und macht alles darin durchsichtig. Das gilt für ',
          code('glass.png'),
          ' und die 16 Texturen für gefärbtes Glas (',
          code('red_stained_glass.png'),
          ' usw.; vor 1.13 ',
          code('glass_red.png'),
          ', mit ',
          code('glass_silver.png'),
          ' für Hellgrau). Glasscheiben nutzen dieselben Texturen und werden ebenfalls klar. Wähle ',
          strong('Leicht getönt'),
          ', damit gefärbtes Glas eine schwache Farbe behält und Teams sich weiter unterscheiden lassen.',
        ),
        p('„Kein Kürbis-Rand“ ersetzt ', code('textures/misc/pumpkinblur.png'), ', das Bild, das das Spiel über deine Sicht legt, solange du einen geschnitzten Kürbis trägst, durch ein völlig durchsichtiges in derselben Größe. In Bedrock heißt die Datei ebenfalls ', code('textures/misc/pumpkinblur.png'), '.'),
      ],
    },
    {
      id: 'crosshair',
      title: 'Eigenes Fadenkreuz',
      body: [
        p('Wo das Fadenkreuz liegt, hängt von der Version ab:'),
        ul([
          [strong('Java 1.20.1 und älter sowie Bedrock: '), 'das 16 × 16 große Feld oben links in ', code('textures/gui/icons.png'), ', einem Bogen, auf dem auch Herzen, Hunger und Rüstung liegen. Nur dieses Feld ändert sich.'],
          [strong('Java 1.20.2 und neuer: '), 'eine eigene Datei mit 15 × 15 Pixeln, ', code('textures/gui/sprites/hud/crosshair.png'), '.'],
        ]),
        p(
          'Wähle eine von fünf Formen, die für den Editor gezeichnet sind, oder drücke ',
          strong('Selbst zeichnen'),
          ': Der Editor öffnet die Textur des Fadenkreuzes und wählt auf einem Bogen gleich das richtige Feld aus. Java zeichnet das Fadenkreuz invertiert über den Hintergrund, male es also weiß oder grau; andere Farben kommen verändert heraus. Das Spiel setzt den mittleren Pixel (7, 7) in die Bildschirmmitte.',
        ),
        figure(SHOTS.pvpCrosshair),
      ],
    },
    {
      id: 'swords',
      title: 'Kleinere Schwerter und ein tieferer Schild',
      body: [
        p(
          'Wie ein Item in deiner Hand sitzt, steht im Teil ',
          code('display'),
          ' seiner Modelldatei: eine Drehung, eine Position und eine Größe für jeden Ort, an dem es gezeigt wird. „Kleinere Schwerter“ ändert nur die Ego-Ansicht, auf 80, 65 oder 50 % der Größe und etwas tiefer, damit der Griff nah an der Hand bleibt. Andere Spieler, die Third-Person-Ansicht und das Inventar zeigen weiter das normale Schwert. ',
          strong('Alle Waffen'),
          ' macht dasselbe für Äxte, den Streitkolben und Speere, soweit es sie in deiner Version gibt.',
        ),
        p('Java 1.8 hat einen Eintrag, ', code('firstperson'), ', in der eigenen Datei jedes Schwerts. So sieht das Diamantschwert mit ', strong('Kleiner'), ' aus:'),
        pre(PVP_SWORD_189.trimEnd()),
        p(
          'Ab 1.9 gibt es zwei Einträge, ',
          code('firstperson_righthand'),
          ' und ',
          code('firstperson_lefthand'),
          ', und Schwerter übernehmen sie von ',
          code('item/handheld'),
          '. Die Datei behält ihr Eltern-Modell, das Schwert bleibt also ein flaches Item, und bekommt beide Einträge:',
        ),
        pre(PVP_SWORD_LATEST.trimEnd()),
        p(
          '„Tieferer Schild“ setzt den Schild in ',
          code('models/item/shield.json'),
          ' und ',
          code('shield_blocking.json'),
          ' um 3 oder 6 Pixel tiefer (Java ab 1.9; auch ab 1.21.4 liest das Spiel die Haltung des Schilds aus diesen Dateien). Hast du im ',
          link('/guides/make-3d-items-texture-pack', 'Modell-Editor'),
          ' ein eigenes Schwert- oder Schildmodell gebaut, ändern sich nur seine Einträge für die Ego-Ansicht, und deine Form bleibt.',
        ),
      ],
    },
    {
      id: 'fps',
      title: 'FPS-Boost: 8×-Texturen und keine Animationen',
      body: [
        p(
          strong('8×-Texturen'),
          ' verkleinert Blocktexturen und auf Wunsch Items beim Exportieren auf 8 × 8 Pixel. Blätter, Glas und Pflanzen behalten harte Kanten. ',
          strong('Keine Animationen'),
          ' behält nur das erste Bild animierter Texturen und streicht die Animation aus der ',
          code('.mcmeta'),
          '-Datei, sodass das Spiel sie nicht mehr in jedem Tick aktualisiert (Java; Kompass und Uhr funktionieren weiter). Beides sind Effektebenen, die auch im Tab „Effekte“ stehen; deine eigenen Texturen bleiben unverändert.',
        ),
        callout(
          'info',
          'Wie viel schneller?',
          'Kleinere, unbewegte Texturen brauchen weniger Grafikspeicher und weniger Arbeit pro Bild. Das hilft am meisten auf älteren Computern und mit integrierter Grafik. Die größten FPS-Gewinne bringen die Sichtweite, Partikel und Mods wie Sodium oder OptiFine, und die kann ein Texture Pack nicht ändern.',
        ),
      ],
    },
    {
      id: 'files',
      title: 'Welche Dateien ins Pack kommen',
      body: [
        table(
          ['', ...PVP_EXAMPLE_FILES.map((e) => pvpLabel(e.label))],
          [
            ['Niedriges Feuer', ...PVP_EXAMPLE_FILES.map((e) => (e.files.lowFire ? code(e.files.lowFire) : '—'))],
            ['Klares Glas', ...PVP_EXAMPLE_FILES.map((e) => code(e.files.glass))],
            ['Kein Kürbis-Rand', ...PVP_EXAMPLE_FILES.map((e) => code(e.files.pumpkin))],
            ['Fadenkreuz', ...PVP_EXAMPLE_FILES.map((e) => code(e.files.crosshair))],
            ['Kleinere Schwerter', ...PVP_EXAMPLE_FILES.map((e) => (e.files.sword ? code(e.files.sword) : '—'))],
            ['Tieferer Schild', ...PVP_EXAMPLE_FILES.map((e) => (e.files.shield ? code(e.files.shield) : '—'))],
          ],
        ),
        p('Das Glas steht für jede Glastextur daneben, das Schwert für jedes Schwert. Der Editor findet die Pfade für die Version deines Packs selbst.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock Edition',
      body: [
        p('Klares Glas, kein Kürbis-Rand, das Fadenkreuz und 8×-Texturen funktionieren in einem Bedrock-Pack. Die anderen sind dort ausgeschaltet, mit dem Grund:'),
        ul([
          [strong('Niedriges Feuer: '), 'Bedrock zeichnet das Feuer auf dem Bildschirm auf eigene Weise, die ein Texture Pack nicht zuverlässig tiefer setzen kann.'],
          [strong('Schwerter und Schild: '), 'Bedrock legt die Haltung von Items in Attachable-Dateien fest, wie Add-ons, und die erstellt der Editor nicht.'],
          [strong('Keine Animationen: '), 'Bedrock spielt animierte Texturen nach einer Bildliste in ', code('flipbook_textures.json'), ' ab, die ein Pack nicht entfernen kann.'],
        ]),
        figure(SHOTS.pvpBedrock),
      ],
    },
    {
      id: 'install',
      title: 'Installieren und testen',
      body: [
        steps([
          ['Drücke ', strong('Exportieren'), ' und lade die ', code('.zip'), ' (Java) oder das ', code('.mcpack'), ' (Bedrock) herunter.'],
          ['Java: Öffne ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ', leg die Zip hinein und schiebe das Pack in ', strong('Ausgewählt'), ' ganz nach oben. Bedrock: Öffne das .mcpack und aktiviere das Pack unter ', uiPath('Einstellungen', 'Globale Ressourcen'), '.'],
          'Zünde dich an, schau durch Glas, setz einen Kürbis auf und halte Schwert und Schild, um jede Änderung zu prüfen.',
        ]),
        p(
          'Nicht wie erwartet? Ein anderes Pack darüber ersetzt vielleicht dieselben Dateien. Mehr Hilfe: ',
          link('/guides/install-resource-packs', 'Ressourcenpakete installieren'),
          ' und ',
          link('/guides/texture-pack-not-working', 'Texture Pack funktioniert nicht'),
          '.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'allowed',
      q: 'Sind PvP-Texture-Packs auf Servern erlaubt?',
      a: [p('Ein Texture Pack ändert nur, wie das Spiel aussieht, und die Änderungen hier (tieferes Feuer, klares Glas, ein kleineres Schwert) erlauben die meisten Server. Packs, die zeigen, was du sonst nicht sehen könntest, etwa Erze durch Stein, sind meist verboten. Jeder Server hat eigene Regeln, also lies sie nach.')],
    },
    {
      id: 'fps',
      q: 'Bringt ein FPS-Pack wirklich mehr FPS?',
      a: [p('Etwas, vor allem auf schwächeren Computern: 8×-Texturen brauchen weniger Grafikspeicher, und unbewegte Texturen sparen in jedem Tick Arbeit. Auf einem schnellen PC ist der Unterschied klein. Sichtweite, Partikel und Mods wie Sodium oder OptiFine machen viel mehr aus.')],
    },
    {
      id: 'version',
      q: 'Für welche Version sollte ich mein PvP-Pack erstellen?',
      a: [p('Für die Version, die du spielst. Viele PvP-Server laufen auf 1.8.9, und ein 1.8.9-Pack hat andere Dateinamen als ein neues. Um ein Pack in mehreren Versionen zu nutzen, stell im Tab ', strong('Pack'), ' einen Bereich ein: Das Spiel zeigt es dann als kompatibel an, aber Dateien wirken nur dort, wo die Namen passen.')],
    },
    {
      id: 'short',
      q: 'Kann ich statt eines kleinen ein kurzes Schwert machen?',
      a: [p('Ja: Male eine kürzere Klinge auf die Textur des Schwerts, wie es viele 1.8.9-Packs tun. Das ändert das Schwert überall, auch im Inventar und in den Händen anderer Spieler. „Kleinere Schwerter“ ändert nur, wie groß es in deiner eigenen Hand wirkt. Du kannst beides machen.')],
    },
    {
      id: 'crosshair',
      q: 'Warum hat mein farbiges Fadenkreuz die falsche Farbe?',
      a: [p('Java zeichnet das Fadenkreuz invertiert über den Hintergrund: Ein weißes Fadenkreuz wirkt vor hellem Himmel dunkel und vor dunklem Boden hell. Farben mischen sich genauso mit dem Hintergrund. Nimm Weiß oder Grau.')],
    },
    {
      id: 'mods',
      q: 'Kann ein Texture Pack Zoom, eine FPS-Anzeige oder „kein Nebel“ hinzufügen?',
      a: [p('Nein. Zoom, FPS- und Tastenanzeigen, Dauersprinten, kein Nebel und Bewegungsunschärfe brauchen eine Mod (OptiFine, Sodium und andere), einen PvP-Client oder die Einstellungen des Spiels. Ein Pack ändert nur Texturen, Modelle, Sounds und ähnliche Dateien.')],
    },
  ],
  ctaLabel: 'PvP-Pack erstellen',
};

const PBR_STEPS: Child[] = [
  ['Öffne den ', link('/textures', 'Texture Pack Maker'), ' und erstelle ein Pack für Java oder Bedrock, oder öffne eines, das du schon hast.'],
  'Wähle eine Block- oder Item-Textur, zum Beispiel Diamanterz, und öffne den Tab „Material“ neben „Vorschau“.',
  ['Wähle ein schnelles Material wie ', strong('Metall'), ', ', strong('Glas'), ' oder ', strong('Leuchtende Punkte'), '. Der beleuchtete 3D-Block zeigt es unter einer wandernden Sonne.'],
  ['Stell ', strong('Glanz'), ', ', strong('Metall'), ', ', strong('Leuchten'), ' und ', strong('Licht durch'), ' für die ganze Textur ein, oder füge einen Teil hinzu (bunte, helle oder dunkle Pixel, bestimmte Farben oder ein ausgewählter Bereich) mit eigenen Werten.'],
  ['Schalte ', strong('Relief aus den Farben'), ' ein und stell die Stärke ein, dann gib mit ', strong('Auf ähnliche Texturen anwenden'), ' jedem Erz, jedem Brett oder Stamm dasselbe Material.'],
  ['Klicke auf ', strong('Exportieren'), '. Java bekommt ', code('_n.png'), ' und ', code('_s.png'), ' neben jeder Textur, Bedrock Texture-Sets und die Fähigkeit ', code('pbr'), '.'],
];

const pbrPack: GuideText = {
  intro: [
    p(
      'Ein PBR-Texture-Pack gibt Blöcken mehr als Farben: wie stark sie glänzen, welche Teile Metall sind, welche leuchten und wie uneben sie im Licht wirken. Vibrant Visuals in Minecraft Bedrock liest diese Maps aus Texture-Sets, und in Java lesen PBR-Shader für Iris und OptiFine sie im Format labPBR. Der ',
      link('/textures', 'Texture Pack Maker'),
      ' erstellt beides im Browser aus deinen Texturen, mit schnellen Materialien wie Metall, Glas und leuchtenden Erzpunkten.',
    ),
  ],
  quick: {
    title: 'Die Kurzfassung',
    items: [
      ['Öffne eine Textur und den Tab ', strong('Material'), '.'],
      ['Wähle ein schnelles Material und stell Glanz, Metall, Leuchten und Relief am beleuchteten 3D-Block fein ein.'],
      ['Exportiere: Der Editor schreibt die richtigen Dateien für deine Edition neben die Texturen.'],
    ],
  },
  howto: { name: 'PBR-Texture-Pack mit dem Texture Pack Maker erstellen', steps: PBR_STEPS },
  sections: [
    {
      id: 'maps',
      title: 'Was die Maps machen',
      body: [
        p('Jedes Pixel einer Textur bekommt ein paar zusätzliche Zahlen. Der Tab „Material“ nennt sie nach dem, was du siehst; die Tabelle zeigt, wo sie in den Dateien landen:'),
        table(
          ['Im Editor', 'Was es macht', 'Java (labPBR)', 'Bedrock (Texture-Set)'],
          [
            ['Glanz', 'Glatte Flächen zeigen scharfe Lichter und Spiegelungen, raue wirken matt.', [code('_s'), ' Rot: Glätte'], ['MER Blau: Rauheit']],
            ['Metall', 'Metall spiegelt den Himmel in seiner eigenen Farbe, wie Eisen oder Gold.', [code('_s'), ' Grün: 230–255'], ['MER Rot: Metallanteil']],
            ['Leuchten', 'Gibt Licht ab, auch nachts, wie Leuchtstein oder die Edelsteine in Erzen.', [code('_s'), ' Alpha: 0–254'], ['MER Grün: Leuchten']],
            ['Licht durch', 'Durch dünne Teile scheint Licht, wie bei Blättern.', [code('_s'), ' Blau: 65–255'], ['MERS Alpha (nur Vibrant Visuals)']],
            ['Relief', 'Licht und Schatten zeigen Beulen und Dellen auf einer flachen Seite.', [code('_n'), ' Rot und Grün, Höhe in Alpha'], ['Eine Normal-Map']],
          ],
        ),
        p('Ohne Material sieht eine Textur aus wie immer. In Java bleibt die Farbtextur, wo sie ist; die Maps liegen daneben.'),
      ],
    },
    {
      id: 'steps',
      title: 'Schritt für Schritt',
      body: [steps(PBR_STEPS)],
    },
    {
      id: 'parts',
      title: 'Leuchtende Erzpunkte und andere Teile',
      body: [
        p(
          'Ein Teil gibt einigen Pixeln eigene Werte. ',
          strong('Bunte Pixel'),
          ' findet die Edelsteine eines Erzes im grauen Stein, ',
          strong('Helle Pixel'),
          ' das Licht einer Lampe, ',
          strong('Pixel bestimmter Farben'),
          ' genau die Farben, die du anklickst, und ',
          strong('Ein ausgewählter Bereich'),
          ' ein Rechteck, das du mit dem Auswahlwerkzeug gezogen hast. Ein kleines Bild zeigt, welche Pixel ein Teil umfasst.',
        ),
        p(
          strong('Auf ähnliche Texturen anwenden'),
          ' kopiert das Material auf die anderen Seiten desselben Blocks und auf jede Textur, deren Name mit demselben Wort endet oder beginnt: alle ',
          code('*_ore'),
          '-Texturen, alle ',
          code('oak_*'),
          ' und so weiter. Jede behält ihre eigenen Farben, daher folgen Teile und Relief ihren Pixeln.',
        ),
      ],
    },
    {
      id: 'java',
      title: 'Java: labPBR-Maps für Shader',
      body: [
        p(
          'Java hat kein eigenes PBR: Ein Shaderpaket in Iris oder OptiFine zeichnet es. Der Editor schreibt die beiden labPBR-Maps neben jede Textur, zum Beispiel ',
          code('assets/minecraft/textures/block/stone_n.png'),
          ' und ',
          code('stone_s.png'),
          ' (vor 1.13 ',
          code('textures/blocks/'),
          '), in der Größe, mit der die Textur exportiert wird. Die Glätte ist wahrnehmungsbezogen (1 minus Rauheit), Nichtmetalle bekommen ein F0 von etwa 4 %, und ein Pixel ohne Leuchten hat Alpha 255, damit Bilder ohne Alpha nie leuchten.',
        ),
        p(
          'Schalte einen Shader ein, der labPBR-Maps liest; in seinen Einstellungen heißt das oft labPBR oder Ressourcenpaket-Unterstützung, und der Shader bestimmt, wie stark Spiegelungen und Leuchten sind. Die Shader aus dem ',
          link('/shaders', 'Shader-Maker'),
          ' dieser Seite nutzen diese Maps noch nicht.',
        ),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock: Texture-Sets für Vibrant Visuals',
      body: [
        p('Bedrock liest ein Texture-Set neben der Farbtextur. Leuchtende Punkte und Relief sind Bilder:'),
        pre(PBR_TEXTURE_SET.trimEnd()),
        p('Ein Wert für die ganze Textur braucht kein Bild:'),
        pre(PBR_UNIFORM_SET.trimEnd()),
        p(
          'Licht durch ist der vierte Kanal von ',
          code('metalness_emissive_roughness_subsurface'),
          ' (Format 1.21.30, nur Vibrant Visuals) und wird als TGA geschrieben, damit sein Alpha bleibt, wie es ist. Ein Texture-Set darf nur Bilder aus demselben Pack nennen, deshalb legt der Editor auch die Farbtextur dazu, selbst wenn du sie nicht bemalt hast. Das Pack meldet die Fähigkeit ',
          code('pbr'),
          ', ohne die Vibrant Visuals aus bleibt:',
        ),
        pre(PBR_MANIFEST.trimEnd()),
        p(
          'Das Spiel hat für die meisten Blöcke eigene Texture-Sets. Mit Vibrant Visuals würde ein Set des Spiels dessen Farbtextur statt deiner zeigen, deshalb bekommt jede Textur, die du ohne Material änderst, eine Kopie des Sets aus dem Spiel in dein Pack. ',
          link('/guides/bedrock-vibrant-visuals-settings', 'Vibrant-Visuals-Einstellungen erklärt'),
          '.',
        ),
      ],
    },
    {
      id: 'open',
      title: 'Ein Pack mit PBR-Maps öffnen',
      body: [p('Öffne ein Java-Pack mit labPBR-Maps oder ein Bedrock-Pack mit Texture-Sets, und seine Maps erscheinen im Tab „Material“ ihrer Texturen. Sie werden genau so exportiert, wie sie waren, bis du das Material änderst.')],
    },
  ],
  faq: [
    {
      id: 'rtx',
      q: 'Brauche ich eine RTX-Grafikkarte?',
      a: [p('Nein. Vibrant Visuals läuft auf vielen PCs, Konsolen und neueren Handys, und labPBR-Shader laufen auf den meisten Grafikkarten, die Shader können. Der ältere Raytracing-Modus von Bedrock liest dieselben Texture-Sets, außer Materialien, die Licht durchlassen: Die nutzen eine Ebene, die nur Vibrant Visuals liest.')],
    },
    {
      id: 'same',
      q: 'Warum sieht mein Pack im Spiel gleich aus?',
      a: [p('Bedrock: Stell den Grafikmodus auf „Lebendige Grafik“ (Vibrant Visuals) und setz das Pack in den globalen Ressourcen ganz nach oben. Java: Schalte einen Shader mit labPBR-Unterstützung ein und prüf seine Material- oder Ressourcenpaket-Einstellung. Ohne eins davon zeigt Minecraft nur die Farben.')],
    },
    {
      id: 'items',
      q: 'Funktionieren Materialien auf Items und Mobs?',
      a: [p('Ja, in Vibrant Visuals und in den meisten labPBR-Shadern. Der Editor schreibt immer Normal-Maps, nie Höhen-Maps, weil Vibrant Visuals Höhen-Maps auf Items nicht nutzen kann.')],
    },
    {
      id: 'metal',
      q: 'Warum sollte Metall 0 oder 100 sein?',
      a: [p('Echte Dinge sind Metall oder nicht, und labPBR wie Vibrant Visuals behandeln ein Pixel als das eine oder das andere. Werte dazwischen wirken grau und stumpf. Für glänzenden Stein erhöhst du den Glanz und lässt Metall auf 0.')],
    },
  ],
  ctaLabel: 'Texture Pack Maker öffnen',
};

const NAMES_STEPS: Child[] = [
  ['Öffne den ', link('/textures', 'Texture Pack Maker'), ' und erstelle ein Java-Pack, oder öffne eines, das du schon hast.'],
  ['Öffne die Textur eines Items, zum Beispiel des Diamantschwerts, und wähl in ihrem Menü (⋮) ', strong('Namenstexturen'), ', oder ', strong('Namen'), ' unter der 3D-Vorschau.'],
  ['Tipp den Namen ein, zum Beispiel ', strong('Excalibur'), '. Füg weitere Namen hinzu, wenn sie dieselbe Textur nutzen sollen.'],
  ['Klicke auf ', strong('Erstellen und malen'), '. Die neue Textur beginnt als Kopie der Item-Textur, also mal sie einfach um. Mit ', strong('3D-Form'), ' bekommt sie auch ein eigenes Modell.'],
  ['Klicke auf ', strong('Exportieren'), ', installier das Pack, benenne das Item am Amboss genau so um und nimm es in die Hand.'],
];

const renameItems: GuideText = {
  intro: [
    p(
      'In Minecraft kannst du jedes Item am Amboss umbenennen. Ein Ressourcenpaket kann einem umbenannten Item eine eigene Textur geben: Ein Diamantschwert namens „Excalibur“ kann golden glänzen, während alle anderen Diamantschwerter bleiben, wie sie sind. Java 1.21.5 und neuer können das ohne Mods; ältere Versionen brauchen OptiFine oder die Mod CIT Resewn. Der ',
      link('/textures', 'Texture Pack Maker'),
      ' schreibt die richtigen Dateien für deine Version.',
    ),
  ],
  quick: {
    title: 'Die Kurzfassung',
    items: [
      ['Öffne die Textur eines Items und wähl ', strong('Namenstexturen'), '.'],
      ['Tipp den Namen ein und mal die neue Textur.'],
      ['Exportiere und benenne das Item am Amboss genau so um.'],
    ],
  },
  howto: { name: 'Einem umbenannten Item mit dem Texture Pack Maker eine eigene Textur geben', steps: NAMES_STEPS },
  sections: [
    {
      id: 'steps',
      title: 'Schritt für Schritt',
      body: [steps(NAMES_STEPS)],
    },
    {
      id: 'names',
      title: 'Wann ein Name passt',
      body: [
        ul([
          ['Der Name muss genau gleich sein, auch Groß- und Kleinschreibung: ', strong('Excalibur'), ' und ', strong('excalibur'), ' sind verschiedene Namen. Füg beide hinzu, wenn beide funktionieren sollen.'],
          'Mehrere Namen können sich eine Textur teilen, und ein Item kann viele Namenstexturen haben.',
          'Am Amboss gehen Namen mit bis zu 50 Zeichen, ohne Farbcodes. Ein Name, der mit Befehlen gefärbt oder fett gemacht wurde, passt nicht zu einem einfachen Namen.',
          'Das Item ändert sich in der Hand, im Inventar, auf dem Boden und in Rahmen. Ein Block, den du aus einem umbenannten Item setzt, sieht aus wie immer.',
        ]),
      ],
    },
    {
      id: 'vanilla',
      title: 'Java 1.21.5 und neuer: ohne Mods',
      body: [
        p(
          'Seit 1.21.5 kann eine Item-Definition (',
          code('assets/minecraft/items/<item>.json'),
          ') ein Modell nach dem Namen des Items wählen, mit einem ',
          code('minecraft:select'),
          ' auf der Eigenschaft ',
          code('minecraft:component'),
          ' und der Komponente ',
          code('minecraft:custom_name'),
          '. Alles andere zeigt das normale Modell des Items:',
        ),
        pre(NAMES_DEFINITION.trimEnd()),
        p('Das Modell für den Namen ist das eigene Modell des Items mit dem neuen Bild, deshalb hält man das Schwert weiter wie ein Schwert:'),
        pre(NAMES_MODEL.trimEnd()),
        p(
          'Ändert das Pack diese Item-Definition schon, zum Beispiel mit einem 3D-Modell aus dem Modell-Editor, kommen die Namen davor. Java 1.21.4 hat zwar Item-Definitionen, kann den Namen eines Items aber noch nicht lesen, deshalb bekommt es die OptiFine-Dateien unten. ',
          link('/guides/make-3d-items-texture-pack', 'So funktionieren Item-Definitionen und 3D-Items'),
          '.',
        ),
      ],
    },
    {
      id: 'optifine',
      title: 'Vor 1.21.5: OptiFine oder CIT Resewn',
      body: [
        p(
          'Ältere Versionen können eine Textur nicht von selbst nach dem Namen wählen. Die Custom Item Textures (CIT) von OptiFine können es, und die Fabric-Mod CIT Resewn auch. Der Editor schreibt für jede Namenstextur eine ',
          code('.properties'),
          '-Datei in ',
          code('assets/minecraft/optifine/cit/'),
          ':',
        ),
        pre(NAMES_CIT.trimEnd()),
        p(
          'Ein einzelner Name wird so geschrieben, wie er ist; mehrere werden zu einer ',
          code('regex:'),
          '-Regel. Ab 1.20.5 schreibt der Editor ',
          code('components.custom_name'),
          ' statt ',
          code('nbt.display.Name'),
          '; beide Mods lesen beides. Eine Textur mit 3D-Form nutzt ',
          code('model='),
          ' statt ',
          code('texture='),
          '. Reicht der Versionsbereich eines Packs von vor 1.21.5 bis danach, bekommt es beide Arten von Dateien.',
        ),
        callout('warn', 'Spieler brauchen die Mod', 'Ohne OptiFine oder CIT Resewn zeigt Minecraft vor 1.21.5 die normale Textur, egal wie das Item heißt.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock Edition',
      body: [
        p('Ressourcenpakete für Bedrock können nicht ändern, wie ein Item je nach Namen aussieht. Die Item-Namen in Molang (etwa ', code('query.is_item_name_any'), ') sind Item-IDs wie ', code('minecraft:diamond_sword'), ', nicht die Namen, die Spieler am Amboss vergeben. Deshalb bietet der Editor für Bedrock-Packs keine Namenstexturen an.'),
      ],
    },
    {
      id: 'open',
      title: 'Ein Pack öffnen, das welche hat',
      body: [
        p(
          'Öffne ein Java-Pack, und seine Namenstexturen erscheinen unter der Textur des Items und im Fenster: OptiFine-CIT-Regeln für ein Item mit einem Namen und einer Textur oder einem Modell, und Item-Definitionen ab 1.21.5, die ein Modell nach dem Namen wählen. Regeln, die mehr als den Namen prüfen (Schaden, Verzauberungen, mehrere Items), bleiben unverändert im Pack. Eine Regel mit einem OptiFine-Muster wie ',
          code('ipattern:*sword*'),
          ' behält es und funktioniert weiter nur mit OptiFine und CIT Resewn.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'not-working',
      q: 'Mein umbenanntes Item sieht noch normal aus. Warum?',
      a: [p('Prüf, ob der Name genau gleich ist, auch Großbuchstaben und Leerzeichen, ob das Pack aktiv ist und über anderen Packs steht und ob du 1.21.5 oder neuer spielst oder in einer älteren Version OptiFine oder CIT Resewn hast. Auch ein Item, das du vor dem Pack umbenannt hast, funktioniert: Der Name wird jedes Mal geprüft, wenn das Item gezeichnet wird.')],
    },
    {
      id: 'case',
      q: 'Kann ein Name Groß- und Kleinschreibung ignorieren?',
      a: [p('In Vanilla-Minecraft nicht: Der Name muss genau passen. Füg jede Schreibweise, die du willst, als eigenen Namen hinzu. OptiFine-Packs können Muster nutzen, die Großbuchstaben ignorieren; geöffnete Packs behalten ihre.')],
    },
    {
      id: 'shape',
      q: 'Kann ein umbenanntes Item 3D sein?',
      a: [p('Ja. Klicke bei einer Namenstextur auf 3D-Form, um sie im Modell-Editor zu öffnen, und fang mit einem 3D-Item aus deinem neuen Bild an.')],
    },
    {
      id: 'servers',
      q: 'Sehen andere Spieler das?',
      a: [p('Wer dein Pack nutzt, sieht es, auch auf Servern. Der Name selbst gehört zum Item, den sehen also alle; nur für die Textur braucht man das Pack.')],
    },
  ],
  ctaLabel: 'Texture Pack Maker öffnen',
};

export const GUIDES: Record<string, GuideText> = {
  'make-a-texture-pack': makeATexturePack,
  'texture-pack-not-working': notWorking,
  'install-resource-packs': install,
  'minecraft-pack-format-versions': packFormats,
  'make-a-skin': makeASkin,
  'make-shaders-without-mods': shadersWithoutMods,
  'java-vs-bedrock-packs': javaVsBedrock,
  'bedrock-vibrant-visuals-settings': vibrantVisuals,
  'convert-java-to-bedrock-texture-pack': convertJavaToBedrock,
  'merge-texture-packs': mergePacks,
  'make-a-bedrock-skin-pack': bedrockSkinPack,
  'make-3d-items-texture-pack': make3dItems,
  'make-a-pvp-texture-pack': pvpPack,
  'make-a-pbr-texture-pack': pbrPack,
  'rename-items-texture-pack': renameItems,
};
