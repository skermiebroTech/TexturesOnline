// German help page (see HelpText in src/tools/help/content.ts). Menu names are the ones the German
// game shows (Java: assets/minecraft/lang/de_de.json, Bedrock: texts/de_DE.lang).

import { el, type Child } from '../../app/markup';
import { callout, code, ext, folderTable, link, steps, strong, tabbed, uiPath } from '../../app/content/blocks';
import { REPO_URL } from '../../app/site';
import { F, LATEST, maxFormat, minFormat } from '../../app/content/facts';
import type { HelpText } from '../../tools/help/content';
import { UI_DE } from './ui';

const p = (...c: Child[]) => el('p', null, ...c);
const FOLDER = UI_DE.folderTable;

const JAVA_PACK_STEPS: Child[] = [
  ['Exportiere dein Pack aus dem Texture Pack Maker. Du bekommst eine Datei wie ', code('Mein Pack.zip'), '.'],
  ['Starte Minecraft Java Edition und öffne ', uiPath('Optionen …', 'Ressourcenpakete …'), '.'],
  ['Klicke auf ', uiPath('Paketordner öffnen'), '. Das öffnet den Ordner ', code('resourcepacks'), '.'],
  ['Leg die ', code('.zip'), ' in diesen Ordner. Du kannst sie auch direkt auf den Bildschirm „Ressourcenpakete“ ziehen.'],
  ['Fahre in der Liste ', strong('Verfügbar'), ' mit der Maus über dein Pack und klicke auf den Pfeil, um es nach ', strong('Ausgewählt'), ' zu verschieben. Packs weiter oben gewinnen. Klicke auf ', strong('Fertig'), '.'],
];

const BEDROCK_PACK_STEPS: Child[] = [
  ['Exportiere dein Pack. Du bekommst eine Datei wie ', code('Mein Pack.mcpack'), '.'],
  ['Doppelklicke auf die Datei. Minecraft öffnet sich und zeigt ', el('em', null, 'Import gestartet...'), ' und dann ', el('em', null, 'erfolgreich importiert'), '.'],
  ['Geh zu ', uiPath('Einstellungen', 'Globale Ressourcen', 'Meine Pakete'), ', wähle dein Pack und tippe auf ', strong('Aktivieren'), '.'],
  'Mehrere Packs aktiv? Schiebe deins nach oben, damit es gewinnt.',
];

const JAVA_SKIN_STEPS: Child[] = [
  ['Öffne den Minecraft Launcher und wähle ', uiPath('Minecraft: Java Edition', 'Skins'), '.'],
  ['Klicke auf ', strong('Neuer Skin'), ' (die Karte mit dem +).'],
  ['Gib ihm einen Namen und wähle das Spielermodell: ', strong('Klassisch'), ' oder ', strong('Schlank'), '.'],
  ['Klicke auf ', strong('Durchsuchen'), ', wähle dein PNG und dann ', strong('Speichern und verwenden'), '.'],
];

const BEDROCK_SKIN_STEPS: Child[] = [
  ['Exportiere als ', strong('Bedrock-Skinpaket'), '. Du bekommst eine ', code('.mcpack'), '-Datei.'],
  'Öffne die Datei (Doppelklick unter Windows, „Mit Minecraft öffnen“ auf Handys und Tablets), um sie zu importieren.',
  ['Geh in Minecraft zu ', uiPath('Ankleidezimmer', 'Klassische Skins'), '. Dein Paket steht bei den importierten Paketen.'],
  ['Wähle deinen Skin und tippe auf ', strong('Anlegen'), '.'],
];

const IRIS_STEPS: Child[] = [
  ['Lade den Iris Installer von ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ' herunter. Er installiert Fabric Loader, Iris und Sodium für deine Version in einem Rutsch.'],
  ['Öffne den Minecraft Launcher, wähle das neue Profil ', strong('Iris & Sodium'), ' und spiele einmal.'],
  ['Exportiere dein Shaderpaket aus dem Shader Maker (eine ', code('.zip'), ' – nicht entpacken).'],
  ['Öffne im Spiel ', uiPath('Optionen …', 'Grafikeinstellungen …', 'Shaderpakete ...'), ' und klicke auf ', strong('Shader-Ordner öffnen ...'), '. Leg die Zip hinein.'],
  ['Wähle dein Pack und klicke auf ', strong('Anwenden'), '. Über ', strong('Shader-Einstellungen ...'), ' kannst du die Optionen im Spiel feinjustieren.'],
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Exportiere mit dem Ziel ', strong('Vanilla Java'), '. Du bekommst ein Ressourcenpaket als ', code('.zip'), '.'],
  ['Installiere es wie ein Texture Pack: ', uiPath('Optionen …', 'Ressourcenpakete …', 'Paketordner öffnen'), ', Zip hineinlegen.'],
  'Schiebe es nach „Ausgewählt“ und klicke auf „Fertig“. Der neue Look gilt sofort.',
];

const VIBRANT_STEPS: Child[] = [
  ['Exportiere dein Pack (', code('.mcpack'), ') und öffne die Datei, um es zu importieren.'],
  ['Geh zu ', uiPath('Einstellungen', 'Globale Ressourcen', 'Meine Pakete'), ' und aktiviere es.'],
  ['Öffne ', uiPath('Einstellungen', 'Grafik'), ' und stelle den ', strong('Grafikmodus'), ' auf ', strong('Lebendige Grafik'), ' (Vibrant Visuals).'],
];

export const HELP: HelpText = {
  sections: {
    'java-packs': {
      title: 'Texture Packs in Java',
      short: 'Java-Packs',
      howto: { name: 'Texture Pack (Ressourcenpaket) in Minecraft Java Edition installieren', steps: JAVA_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Java Edition nennt Texture Packs ', el('em', null, 'Ressourcenpakete'), '. Dein Export ist eine ', code('.zip'), '-Datei – nicht entpacken.'),
        steps(JAVA_PACK_STEPS),
        callout(
          'info',
          '„Für eine ältere (oder neuere) Version von Minecraft erstellt“?',
          'Packs werden für die Version geschrieben, die du im Editor wählst. Spielst du eine andere Version, ändere die Zielversion oder den Kompatibilitätsbereich im Tab ',
          strong('Pack'),
          ' und exportiere noch einmal. Reine Textur-Packs funktionieren meist trotzdem – du kannst auf ',
          strong('Ja'),
          ' klicken, um sie trotzdem zu nutzen.',
        ),
        el('h3', { class: 'guide-sub' }, 'Wo der Ordner liegt'),
        folderTable('resourcepacks', FOLDER),
      ],
    },
    'bedrock-packs': {
      title: 'Texture Packs in Bedrock',
      short: 'Bedrock-Packs',
      howto: { name: 'Bedrock-Texture-Pack (.mcpack) unter Windows installieren', steps: BEDROCK_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Bedrock-Packs werden als ', code('.mcpack'), '-Dateien exportiert. Öffnest du eine, importiert Minecraft sie automatisch.'),
        tabbed(
          'bedrock-packs',
          [
            { value: 'windows', label: 'Windows', icon: 'monitor', content: [steps(BEDROCK_PACK_STEPS)] },
            {
              value: 'mobile',
              label: 'Android & iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Lade das ', code('.mcpack'), ' auf dein Handy oder Tablet herunter.'],
                  [strong('Android: '), 'öffne es in deinen Downloads oder der Dateien-App und wähle ', strong('Minecraft'), '. ', strong('iPhone / iPad: '), 'tippe in der Dateien-App auf die Datei, dann ', uiPath('Teilen', 'Minecraft'), '.'],
                  ['Minecraft importiert das Pack. Öffne dann ', uiPath('Einstellungen', 'Globale Ressourcen'), ' und aktiviere es.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Konsolen',
              icon: 'gamepad',
              content: [
                el(
                  'p',
                  { class: 'muted' },
                  'Xbox, PlayStation und Switch können keine .mcpack-Dateien importieren. Füge das Pack auf einem PC oder Handy einer Welt hinzu und tritt dieser Welt bei, oder spiel auf einem Realm oder Server, der das Pack mitbringt.',
                ),
              ],
            },
          ],
          UI_DE.platform,
        ),
        callout('tip', 'Nur für eine Welt?', 'Statt „Globale Ressourcen“ öffnest du ', uiPath('Welt bearbeiten', 'Ressourcenpakete'), ' und aktivierst das Pack dort.'),
        callout(
          'info',
          'Ein bereits importiertes Pack aktualisieren',
          'Jeder Export behält dieselbe Pack-ID und erhöht die Versionsnummer, sodass ein erneuter Import die alte Kopie ersetzt, statt ein Duplikat anzulegen.',
        ),
      ],
    },
    'java-skins': {
      title: 'Skins in Java',
      short: 'Java-Skins',
      howto: { name: 'Skin in Minecraft Java Edition ändern', steps: JAVA_SKIN_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Exportiere deinen Skin als ', code('.png'), '. Merk dir, ob du das Modell ', strong('Klassisch'), ' (4 Pixel breite Arme) oder ', strong('Schlank'), ' (3 Pixel breite Arme) bemalt hast.'),
        tabbed(
          'java-skins',
          [
            { value: 'launcher', label: 'Minecraft Launcher', icon: 'monitor', content: [steps(JAVA_SKIN_STEPS)] },
            {
              value: 'web',
              label: 'minecraft.net',
              icon: 'globe',
              content: [
                steps([
                  ['Melde dich auf ', ext('https://www.minecraft.net/', 'minecraft.net'), ' an und öffne dein Profil.'],
                  ['Wähle im Skin-Bereich das Modell ', strong('Klassisch'), ' oder ', strong('Schlank'), '.'],
                  ['Lade dein PNG hoch und bestätige. Im Spiel erscheint es, sobald du das nächste Mal einer Welt oder einem Server beitrittst.'],
                ]),
              ],
            },
          ],
          UI_DE.platform,
        ),
        callout('info', 'Spielst du 1.7.10 oder älter?', 'Diese Versionen kennen nur das alte 64×32-Layout. Nutze die Export-Option ', strong('Alter Java-Skin (64×32)'), '.'),
      ],
    },
    'bedrock-skins': {
      title: 'Skins in Bedrock',
      short: 'Bedrock-Skins',
      howto: { name: 'Bedrock-Skinpaket (.mcpack) installieren', steps: BEDROCK_SKIN_STEPS },
      body: [
        tabbed(
          'bedrock-skins',
          [
            { value: 'pack', label: 'Skinpaket (.mcpack)', icon: 'package', content: [steps(BEDROCK_SKIN_STEPS)] },
            {
              value: 'png',
              label: 'Einzelnes PNG',
              icon: 'image',
              content: [
                steps([
                  ['Exportiere den Skin als ', code('.png'), '.'],
                  ['Öffne ', uiPath('Ankleidezimmer', 'Klassische Skins'), ' und wähle unter ', strong('Freigeschaltet'), ' das leere Feld ', strong('Importieren'), '.'],
                  ['Wähle dein PNG und dann das breite oder schmale Armmodell.'],
                ]),
              ],
            },
          ],
          UI_DE.platform,
        ),
        callout(
          'warn',
          'Freunde sehen einen Standard-Skin?',
          'Spieler, die ',
          strong('Nur vertrauenswürdige Skins erlauben'),
          ' eingeschaltet haben, sehen eigene Skins als Standard-Skin. Das ist ihre eigene Einstellung. Konsolen können keine Skin-Dateien importieren.',
        ),
      ],
    },
    iris: {
      title: 'Shader mit Iris oder OptiFine',
      short: 'Iris / OptiFine',
      howto: { name: 'Shaderpaket mit Iris installieren', steps: IRIS_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Klassische Shaderpakete brauchen eine Shader-Mod. ', strong('Iris'), ' ist am einfachsten und schnellsten; OptiFine geht auch.'),
        tabbed(
          'iris',
          [
            { value: 'iris', label: 'Iris (empfohlen)', icon: 'sparkles', content: [steps(IRIS_STEPS)] },
            {
              value: 'optifine',
              label: 'OptiFine',
              icon: 'gear',
              content: [
                steps([
                  ['Installiere OptiFine für deine Minecraft-Version von ', ext('https://optifine.net/', 'optifine.net'), ' und spiele einmal mit dem OptiFine-Profil.'],
                  ['Öffne ', uiPath('Optionen …', 'Grafikeinstellungen …', 'Shader …'), ' und klicke auf ', strong('Shader-Ordner'), '.'],
                  'Leg deine exportierte Zip in den Ordner und wähle sie dann in der Liste aus.',
                ]),
              ],
            },
          ],
          UI_DE.platform,
        ),
        el('h3', { class: 'guide-sub' }, 'Ordner für Shaderpakete'),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    'vanilla-shaders': {
      title: 'Vanilla-Shader (ohne Mods)',
      short: 'Vanilla-Shader',
      howto: { name: 'Vanilla-Shaderpaket (ohne Mods) in Minecraft Java installieren', steps: VANILLA_SHADER_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Sie laufen im normalen Spiel, weil sie ein ', strong('Ressourcenpaket'), ' sind, das einige von Minecrafts eigenen Shader-Dateien ersetzt.'),
        steps(VANILLA_SHADER_STEPS),
        callout(
          'warn',
          'Für genau eine Version gemacht',
          'Mojang ändert die Shader-Dateien oft, deshalb läuft ein Vanilla-Shaderpaket nur in der Version, für die es gemacht wurde. Öffne nach einem Minecraft-Update dein Projekt, wähle die neue Version und exportiere noch einmal.',
        ),
      ],
    },
    'vibrant-visuals': {
      title: 'Vibrant Visuals in Bedrock',
      short: 'Vibrant Visuals',
      howto: { name: 'Vibrant-Visuals-Paket in Minecraft Bedrock nutzen', steps: VIBRANT_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, '„Shader“ in Bedrock sind Einstellungspakete für Vibrant Visuals (im deutschen Spiel „Lebendige Grafik“): Licht, Himmel, Color Grading, Wasser und Nebel.'),
        steps(VIBRANT_STEPS),
        callout(
          'warn',
          'Vibrant Visuals lässt sich nicht auswählen?',
          'Minecraft erlaubt es nur, wenn jedes aktive Pack es unterstützt. Klassische Texture Packs (auch die, die du im Texture Pack Maker machst) schalten es ab, deaktiviere also andere Packs, solange du dieses nutzt. Manche Server schalten es ebenfalls ab.',
        ),
        callout(
          'info',
          'Braucht ein unterstütztes Gerät',
          'Vibrant Visuals läuft auf Windows-PCs mit DirectX 12, Xbox und PlayStation (auf Xbox One und PS4 ist es anfangs ausgeschaltet), iPhone und iPad ab A12-Chip und vielen aktuellen Android-Geräten. Auf der ersten Nintendo Switch, auf Chromebooks und Fire-Tablets gibt es das nicht. ',
          strong('Klassischen Nebel anpassen'),
          ' funktioniert auch in den anderen Grafikmodi.',
        ),
      ],
    },
    folders: {
      title: 'Deinen Minecraft-Ordner finden',
      short: 'Ordner',
      body: [
        el('p', { class: 'guide-intro' }, 'Am schnellsten geht es mit der Schaltfläche ', strong('Paketordner öffnen'), ' in Minecraft. Falls du den Pfad brauchst:'),
        el(
          'table',
          { class: 'paths-table' },
          el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'Was'), el('th', { scope: 'col' }, 'Wo'))),
          el(
            'tbody',
            null,
            el('tr', null, el('th', { scope: 'row' }, 'Java unter Windows'), el('td', null, code('%APPDATA%\\.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java unter macOS'), el('td', null, code('~/Library/Application Support/minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java unter Linux'), el('td', null, code('~/.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Spieldateien (.jar)'), el('td', null, code('.minecraft/versions/<version>/<version>.jar'))),
            el('tr', null, el('th', { scope: 'row' }, 'Bedrock unter Windows'), el('td', null, code('%APPDATA%\\Minecraft Bedrock\\users\\shared\\games\\com.mojang'))),
          ),
        ),
        el('p', { class: 'muted small' }, 'Unter Windows fügst du den Pfad in die Adressleiste des Datei-Explorers oder ins Ausführen-Fenster (Win + R) ein.'),
      ],
    },
  },
  faq: [
    {
      id: 'vanilla-source',
      q: 'Woher kommen die Vanilla-Texturen?',
      a: [
        p(
          'Wenn du ein Java-Projekt startest, lädt dein Browser die offizielle Spieldatei dieser Version direkt von Mojangs Servern und behält nur Texturen, Modelle und Shader auf diesem Gerät. Bedrock-Texturen kommen aus Mojangs offiziellem Repository ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' auf GitHub.',
        ),
        p('Nichts von Mojang wird bei Texture Pack Maker selbst gespeichert – es ist eine statische Website ohne eigene Server.'),
      ],
    },
    {
      id: 'paint-3d',
      q: 'Kann ich auf das 3D-Modell statt auf die flache Textur malen?',
      a: [
        p(
          'Ja. Nutze im Textur-Editor den Schalter ',
          strong('2D / 3D'),
          ' über der Zeichenfläche (oder drücke D). Jede Seite bemalt genau das Pixel, das sie zeigt, auch bei gedrehten Seiten, Auflagen wie der Grasseite, an- und ausgeschalteten Zuständen, Truhen und Betten. Stift, Radierer, Füllen, Farbwähler (oder Alt-Klick), Pinselgröße und Spiegeln funktionieren, und jede Textur hat ihr eigenes Rückgängig. Rechts ziehen oder zwei Finger drehen das Modell, Scrollen oder Zusammenziehen zoomt, und F, B, L, R und T springen zu einer Seite.',
        ),
      ],
    },
    {
      id: 'mobs',
      q: 'Kann ich Mob-Texturen bearbeiten?',
      a: [
        p(
          'Ja. Wähle ',
          strong('Mobs'),
          ' in der Texturliste (Blocks · Items · Mobs · All) oder öffne eine beliebige Textur aus dem Ordner „entity“. Der Mob erscheint in 3D und lässt sich wie ein Block bemalen. Mit den Auswahlfeldern daneben (Variante, Alter, Wollfarbe, Beruf und so weiter) erreichst du jede Textur, die er nutzt; Auflagen wie Schafwolle, leuchtende Augen und Dorfbewohner-Kleidung bemalst du auf ihren eigenen Texturen. In der Liste „Parts“ blendest du ein Teil per Klick aus, um zu bemalen, was es verdeckt, ein Doppelklick zeigt nur dieses Teil, und „Show all“ holt alles zurück. Bedrock-Mobs nutzen die eigenen Modelle von Bedrock, und die Tönungsmasken in ihren transparenten Pixeln bleiben erhalten.',
        ),
      ],
    },
    {
      id: 'gear',
      q: 'Kann ich Sättel, Rüstungen und Pferderüstungen bearbeiten?',
      a: [
        p(
          'Ja. Mobs, die etwas tragen können, haben bei ihren Auswahlfeldern eine Gruppe ',
          strong('Wearing'),
          ': Setz einen Sattel auf Schwein, Schreiter, Pferd, Kamel oder Nautilus; zieh Zombies, Skeletten, Piglins und dem Rüstungsständer Rüstung an (Material für das ganze Set wählen, dann einzelne Teile an- oder ausschalten, Leder mit ',
          strong('Dye'),
          ' färben); gib Pferden, Wölfen und Nautilussen ihre Rüstung, Lamas einen Teppich und dem Glücklichen Ghast ein Geschirr. Jedes getragene Teil wird auf seiner eigenen Textur bemalt und hat einen eigenen Eintrag unter ',
          strong('Parts'),
          ', sodass du es ausblenden kannst, um den Mob darunter zu bemalen. Öffnest du eine Rüstungs-, Sattel- oder Teppichtextur, siehst du sie getragen, und ',
          strong('Used by'),
          ' listet jeden Mob, der sie trägt. Ältere Versionen nutzen die Rüstungs- und Satteltexturen, die sie damals hatten.',
        ),
        p(
          strong('Rüstungsbesätze: '),
          'Trägt ein menschenähnlicher Mob Rüstung, wählst du unter Wearing ein ',
          strong('Trim'),
          '-Muster und ein ',
          strong('Material'),
          ' (Java ab 1.20 und Bedrock). Das Spiel färbt das graue Muster mit der Palette des Materials und nimmt eine dunklere Palette, wenn Besatz und Rüstung aus demselben Material sind, etwa ein Eisenbesatz auf Eisenrüstung. Bemale den Besatz am Modell oder öffne sein Muster: Die acht Grautöne nehmen die Farbe des Besatzes an, jede andere Farbe bleibt so, wie du sie malst. Bearbeite die Palette eines Materials, um es auf jedem Besatz umzufärben, und blende ',
          strong('Trim'),
          ' unter Parts aus, um an die Rüstung darunter zu kommen.',
        ),
      ],
    },
    {
      id: 'models',
      q: 'Kann ich die Form von Blöcken und Items ändern, etwa für ein 3D-Schwert?',
      a: [
        p(
          'Ja, in Java-Packs (Minecraft ab 1.8). Zeig einen Block oder ein Item in der Vorschau und drücke ',
          strong('Form bearbeiten'),
          '. Der Modell-Editor öffnet das Modell, das das Spiel nutzt, zusammengesetzt aus seinen Eltern-Modellen. Füge Würfel hinzu, kopiere und lösche sie, tippe Position und Größe ein oder ziehe die Pfeile und Griffe in 3D, eingerastet im 16 × 16-Raster oder feiner, und drehe einen Würfel um eine Achse (vor Minecraft 1.21.6 in Schritten von 22,5°). Unter ',
          strong('Seiten'),
          ' bekommt jede Seite eine Textur aus deinem Pack oder eine neue, die du später bemalst, und du ziehst den Ausschnitt der Textur, den sie zeigt; dazu kommen Drehung, wann sie ausgeblendet wird und ob sie eingefärbt wird. ',
          strong('Anzeige'),
          ' legt fest, wie das Modell im Inventar, in der Ich- und der Dritte-Person-Ansicht, auf dem Boden, im Rahmen und auf dem Kopf sitzt, jeweils mit Vorschau. Jede Änderung lässt sich rückgängig machen.',
        ),
        p(
          'Als Start nimmst du das Modell des Spiels, ein leeres, einen vollen Würfel, eine Stufe, ein Kreuz wie bei Blumen oder bei Items ',
          strong('3D-Item aus dem Sprite'),
          ': Das flache Bild wird zu Würfeln mit 1 Pixel Tiefe, zu möglichst wenigen zusammengefasst. Ab 1.21.4 behält ',
          strong('Flach im Inventar'),
          ' das flache Symbol im Inventar und zeigt das 3D-Modell in der Hand. Ins Pack kommt die Modelldatei, dazu eine Item-Definition oder ein Blockzustand nur, wenn das Spiel sie braucht; der Export prüft die Modelle für deine Version, und Modelldateien aus geöffneten Packs bleiben erhalten und lassen sich bearbeiten. In Bedrock brauchen neue Blockformen eine Erweiterung und 3D-Items in der Hand Attachable-Dateien, die der Editor nicht erstellt; du kannst ein Modell aber als Bedrock-Geometrie herunterladen und darauf aufbauen. Schritt für Schritt: ',
          link('/guides/make-3d-items-texture-pack', '3D-Items erstellen'),
          '.',
        ),
      ],
    },
    {
      id: 'pvp',
      q: 'Kann ich ein PvP- oder FPS-Pack erstellen?',
      a: [
        p(
          'Ja. Wähle beim Erstellen eines Packs ', strong('PvP-/FPS-Pack'), ': Der Editor schaltet niedriges Feuer, klares Glas und klare Scheiben, keinen Kürbis-Rand, ein kleineres Fadenkreuz, kleinere Schwerter und einen tieferen Schild ein, soweit deine Version sie hat. Im Tab ', strong('PvP'), ' gibt es für alles einen Schalter, mit Optionen wie der Feuerhöhe, fünf Fadenkreuzen oder einem selbst gezeichneten und der Schwertgröße, dazu FPS-Optionen: 8×-Texturen und keine Animationen. Jede Option schreibt normale Pack-Dateien für deine Version (von Java 1.6.1 bis 26.3, mit den Dateinamen von 1.8.9) und lässt sich ausschalten oder rückgängig machen. In Bedrock gehen klares Glas, der Kürbis-Rand, das Fadenkreuz und 8×-Texturen; das Feuer und gehaltene Items kann ein Pack dort nicht ändern. Zoom, eine FPS-Anzeige oder kein Nebel brauchen Mods. Schritt für Schritt: ',
          link('/guides/make-a-pvp-texture-pack', 'PvP-Texture-Pack erstellen'),
          '.',
        ),
      ],
    },
    {
      id: 'sounds',
      q: 'Kann ich Sounds in meinem Pack ändern?',
      a: [
        p('Ja. Drücke im Texture-Pack-Editor die Musiknote am Ende des Schalters Blocks · Items · Mobs · All. Suche einen Sound nach Name oder Kategorie und drücke Play, um ihn zu hören. Öffne ihn und ersetze eine Datei mit ', strong('Replace'), ' durch eigenes Audio (MP3, WAV, OGG, M4A und mehr) oder nimm eine mit deinem Mikrofon auf. Ziehe die Griffe an der Wellenform, um zu kürzen, stelle die Lautstärke ein oder drücke ', strong('Normalise'), '; mit Reset kehrst du zum Spielsound zurück. Ersetzte Sounds werden als Ogg Vorbis gespeichert und mit deinem Pack exportiert: Java-Packs legen sie in ', code('assets/minecraft/sounds'), ' ab, Bedrock-Packs in ', code('sounds/'), ' mit passenden Einträgen in ', code('sound_definitions.json'), '.'),
        p('Die Aufnahme fragt erst beim Drücken von Start nach dem Mikrofon; ist es blockiert, erlaube es für diese Seite über das Symbol in der Adressleiste. Aufnahmen verlassen nie dein Gerät. Halte die meisten Sounds mono, damit sie von ihrem Ort in der Welt kommen, und nutze Stereo für Musik und Menüsounds. Die Java-Sounds des Spiels kommen direkt von Mojangs Servern, die Webseiten das Audio nicht lesen lassen: Du kannst sie anhören, aber nur hochgeladene oder aufgenommene Sounds kürzen. Sounds bearbeiten geht ab Java 1.7.10 und in Bedrock.'),
      ],
    },
    {
      id: 'hd-skins',
      q: 'Kann ich einen HD-Skin mit 128×128 erstellen?',
      a: [
        p('Ja, für die Bedrock Edition. HD-Skins haben doppelt so viele Pixel wie ein normaler Skin (128×128 statt 64×64), so werden Gesichter, Schattierungen und Muster feiner. Wähle beim Start eines Skins im Skin-Editor unter ', strong('Größe'), ' die Option ', strong('HD 128×128'), ' oder stelle einen vorhandenen Skin im Editor mit ', strong('Größe'), ' › ', strong('HD 128'), ' um: Jedes Pixel wird verdoppelt, der Skin sieht also gleich aus, bis du Details hinzufügst. Exportiere ', strong('Bedrock-Skin (.png)'), ' für den Import im Ankleidezimmer oder ein ', strong('Bedrock-Skinpaket (.mcpack)'), '. Ein Skinpaket kann normale und HD-Skins mischen.'),
        p('Die Java Edition nimmt ohne Mods nur Skins mit 64×64 an. Der Java-Export macht deshalb eine Kopie mit 64×64 (jeder 2×2-Block wird ein Pixel) und behält dein HD-Original. Mit einer HD-Skin-Mod wie CustomSkinLoader wählst du stattdessen ', strong('128×128 für Mods'), '. Konsolen können keine Skin-Dateien importieren, und Größen über 128×128 werden nicht unterstützt. HD-Skins funktionieren auch im Totem-Ersteller.'),
      ],
    },
    {
      id: 'poses',
      q: 'Kann ich meinen Skin in Pose bringen und ein Bild speichern?',
      a: [
        p('Ja. Drück im Skin-Editor unter der 3D-Vorschau auf ', strong('Pose & Bild'), '. Wähl eine von zwölf Posen (Stehen, Gehen, Rennen, Winken, Sitzen, Ducken, Fliegen, T-Pose, Jubel, Dab, Kämpfen, Zeigen) oder öffne ', strong('Anpassen'), ' und beweg Kopf, Körper und jeden Arm und jedes Bein mit Reglern; jedes Teil lässt sich einzeln zurücksetzen. Unter ', strong('Szene'), ' wählst du Kamerawinkel, Zoom, Hintergrund (oder ', strong('Durchsichtig'), ') und einen Umhang oder Elytren aus dem ', link('/cape-maker', 'Umhang-Ersteller'), '. ', strong('Bild speichern'), ' erstellt ein PNG in 1×, 2× oder 4× Größe. Zieh am Modell, um die Kamera zu drehen, und scrolle oder zoome mit zwei Fingern.'),
      ],
    },
    {
      id: 'capes',
      q: 'Kann ich einen eigenen Umhang erstellen?',
      a: [
        p('Gestalten kannst du ihn im ', link('/cape-maker', 'Umhang-Ersteller'), ': Bemale die 64×32-Umhangtextur mit 3D-Vorschau und lade das PNG herunter. Wo er erscheint, entscheidet das Spiel. Die Java Edition zeigt nur offizielle Umhänge von Mojang, ein eigener Umhang braucht also eine Mod oder einen Client mit eigenem Umhang-Dienst, und nur Spieler mit derselben Mod sehen ihn. In Bedrock sind Umhänge Gegenstände des Charakter-Editors, und Mojangs eigene Paketprüfung meldet einen Umhang in jedem Skinpaket, das nicht von Mojang ist, als Fehler. Deshalb lässt der Skinpaket-Ersteller Umhänge weg.'),
        p('Ohne Mods klappen die Elytren: Der Umhang-Ersteller lädt auch ein Elytren-Texture-Pack herunter (Java 1.9 und neuer oder Bedrock), das dein Design allen zeigt, die das Pack nutzen. Spieler mit Umhang zeigen stattdessen das Design ihres Umhangs auf den Elytren.'),
      ],
    },
    {
      id: 'upload',
      q: 'Wird irgendetwas hochgeladen?',
      a: [p('Nein. Deine Projekte, Bilder und exportierten Packs verlassen nie dein Gerät. Die App lädt nur herunter: Spieldateien von Mojang, die Versionsliste und Skins, die du per Benutzername suchst.')],
    },
    {
      id: 'offline',
      q: 'Funktioniert es offline?',
      a: [
        p(
          'Ja, nach dem ersten Laden. Die App und jede Version, die du schon geöffnet hast, bleiben auf diesem Gerät, du kannst also ohne Internet weiterarbeiten. Eine Version, die du noch nicht genutzt hast, braucht eine Verbindung – oder du wählst ',
          strong('Use my own .jar'),
          ' und nimmst sie aus deinem Ordner ',
          code('.minecraft/versions'),
          '.',
        ),
      ],
    },
    {
      id: 'storage',
      q: 'Wo werden meine Projekte gespeichert?',
      a: [p('Im Speicher deines Browsers auf diesem Gerät. Sie bleiben, bis du sie löschst oder die Daten dieser Website entfernst. Um ein Projekt zu sichern oder auf einen anderen Computer mitzunehmen, exportiere es und öffne die Datei dort mit ', strong('Pack öffnen'), '.')],
    },
    {
      id: 'versions',
      q: 'Welche Minecraft-Versionen werden unterstützt?',
      a: [p(`Java ${LATEST} ist voreingestellt, und jede Java-Version bis zurück zu 1.6.1 (als Ressourcenpakete eingeführt wurden) funktioniert – auf Wunsch auch Snapshots. Für Bedrock kannst du die neueste Vollversion, die neueste Preview und ältere Versionen nutzen.`)],
    },
    {
      id: 'pack-format',
      q: `Welches Ressourcenpaket-Format hat Minecraft Java ${LATEST}?`,
      a: [
        p(
          `Java ${LATEST} nutzt das Ressourcenpaket-Format ${F(LATEST)}. Ein Pack nur für ${LATEST} gibt in seiner `,
          code('pack.mcmeta'),
          ' ',
          code(`"min_format": ${minFormat(LATEST)}`),
          ' und ',
          code(`"max_format": ${maxFormat(LATEST)}`),
          ' an. Der Texture Pack Maker schreibt diese Felder für dich. Siehe ',
          link('/guides/minecraft-pack-format-versions', 'das Format jeder Java-Version'),
          '.',
        ),
      ],
    },
    {
      id: 'java-vs-bedrock',
      q: 'Was ist der Unterschied zwischen Java- und Bedrock-Packs?',
      a: [
        p(
          'Ein Java-Pack ist eine ',
          code('.zip'),
          ' mit einer ',
          code('pack.mcmeta'),
          '-Datei und PNG-Texturen unter ',
          code('assets/minecraft/textures/'),
          '. Ein Bedrock-Pack ist ein ',
          code('.mcpack'),
          ' mit einer ',
          code('manifest.json'),
          ' und Texturen unter ',
          code('textures/'),
          ' (PNG oder TGA). Keine Edition kann die Packs der anderen laden. ',
          link('/guides/java-vs-bedrock-packs', 'Ausführlicher Vergleich'),
          '.',
        ),
      ],
    },
    {
      id: 'no-mods',
      q: 'Kann ich Shader ohne Mods erstellen?',
      a: [
        p(
          `Ja. Ab Java 1.17 kann ein Ressourcenpaket Minecrafts eigene Shader ändern (Farbe, Vignette, Nebel und in ${LATEST} auch Bloom). In Bedrock ändert ein Vibrant-Visuals-Paket das eingebaute Licht, den Himmel, Nebel und Wasser. Echte Schatten und Spiegelungen in Java brauchen weiterhin Iris oder OptiFine. `,
          link('/guides/make-shaders-without-mods', 'So funktioniert es'),
          '.',
        ),
      ],
    },
    {
      id: 'phone',
      q: 'Kann ich es auf dem Handy oder Tablet nutzen?',
      a: [p('Ja. Jedes Tool funktioniert mit Touch, inklusive Zoom mit zwei Fingern in den Pixel-Editoren. Für detaillierte Pixel-Art ist ein größerer Bildschirm angenehmer.')],
    },
    {
      id: 'official',
      q: 'Ist das kostenlos? Ist das offiziell?',
      a: [p('Es ist kostenlos und Open Source unter der MIT-Lizenz.'), p('Texture Pack Maker ist kein offizielles Minecraft-Produkt und weder von Mojang noch von Microsoft genehmigt oder mit ihnen verbunden.')],
    },
    {
      id: 'bug',
      q: 'Etwas ist schiefgelaufen. Wie melde ich das?',
      a: [p('Eröffne bitte ein Issue auf ', ext(`${REPO_URL}/issues`, 'GitHub'), ' mit deinem Browser, der Spielversion und dem, was du gerade gemacht hast. Screenshots helfen sehr.')],
    },
  ],
  quick: { 'java-packs': 'Texture Pack installieren', 'java-skins': 'Skin ändern', iris: 'Shaderpaket nutzen', faq: 'Häufige Fragen' },
  toc: {
    title: 'Auf dieser Seite',
    textures: 'Texture Packs',
    skins: 'Skins',
    shaders: 'Shader',
    more: 'Mehr',
    irisOptifine: 'Iris / OptiFine',
    vanilla: 'Vanilla (ohne Mods)',
    vibrant: 'Vibrant Visuals',
    folders: 'Ordner',
    faq: 'FAQ',
    allGuides: 'Alle Anleitungen',
  },
  bothEditions: 'Java & Bedrock',
  eyebrow: 'Installationsanleitung & Hilfe',
  title: 'Texture Packs, Skins und Shader installieren',
  lead: 'So bringst du deine Werke in Minecraft: Schritt-für-Schritt-Anleitungen für Java und Bedrock auf PC, Mac, Handy und Konsole, dazu Antworten auf häufige Fragen.',
  faqTitle: 'Häufig gestellte Fragen',
};
