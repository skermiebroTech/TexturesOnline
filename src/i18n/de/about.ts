// German About page (see AboutText in src/tools/about/content.ts).

import { el } from '../../app/markup';
import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL } from '../../app/site';
import { F, LATEST } from '../../app/content/facts';
import type { AboutText } from '../../tools/about/content';

export const ABOUT: AboutText = {
  differences: [
    {
      title: 'Jede Java-Version seit 1.6.1',
      text: [`Nicht nur die neueste: Erstelle ein Pack für ${LATEST}, 1.21.11, 1.20.1 oder 1.8.9, jeweils mit den eigenen Texturen und der passenden pack.mcmeta.`],
    },
    {
      title: 'Java und Bedrock, plus Konverter',
      text: ['Erstelle Packs für beide Editionen und mach mit dem ', link('/texture-pack-converter', 'Texture-Pack-Konverter'), ' aus einem Java-Pack ein Bedrock-Pack oder umgekehrt.'],
    },
    {
      title: 'Texturen, Skins und Shader',
      text: ['Eine Seite für Texture Packs, Skins und Skinpakete sowie Shader für Iris, OptiFine, Vanilla Java und Bedrock Vibrant Visuals.'],
    },
    {
      title: 'Nichts wird hochgeladen',
      text: ['Alles läuft in deinem Browser. Die Spieldateien kommen direkt von Mojang, und deine Arbeit bleibt auf deinem Gerät.'],
    },
    {
      title: 'Kostenlos und Open Source',
      text: ['Kein Konto, keine Werbung, keine Bezahlstufen. Der Code ist öffentlich unter der MIT-Lizenz auf ', ext(REPO_URL, 'GitHub'), '.'],
    },
    {
      title: 'Funktioniert offline',
      text: ['Nach dem ersten Besuch bleiben die App und die genutzten Spieldateien auf deinem Gerät, sodass sie auch ohne Verbindung weiterläuft.'],
    },
  ],
  faq: [
    {
      id: 'who',
      q: 'Wer macht Texture Pack Maker?',
      a: [el('p', null, `Texture Pack Maker wird von ${PUBLISHER.name} gemacht, einem unabhängigen Creator. Es ist ein Fan-Projekt und nicht mit Mojang oder Microsoft verbunden.`)],
    },
    {
      id: 'cost',
      q: 'Kostet es etwas?',
      a: [el('p', null, 'Nein. Jedes Tool ist kostenlos – ohne Konto, ohne Werbung und ohne Grenze, wie viele Packs du machst.')],
    },
    {
      id: 'files',
      q: 'Woher kommen die Minecraft-Texturen?',
      a: [
        el(
          'p',
          null,
          'Dein Browser lädt sie von Mojang herunter, wenn du eine Version wählst: Java-Texturen aus den offiziellen Spieldateien, Bedrock-Texturen aus Mojangs Repository ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          '. Sie bleiben auf deinem Gerät und werden nie auf dieser Website gespeichert.',
        ),
      ],
    },
    {
      id: 'contact',
      q: 'Wie melde ich einen Fehler oder schlage eine Funktion vor?',
      a: [el('p', null, 'Eröffne ein Issue auf ', ext(`${REPO_URL}/issues`, 'GitHub'), '. Schreib bitte dazu, welches Tool, welche Edition und welche Version du genutzt hast.')],
    },
  ],
  eyebrow: 'Über uns',
  title: 'Über Texture Pack Maker',
  intro: `Texture Pack Maker ist eine kostenlose Open-Source-Website, mit der du Minecraft Texture Packs, Skins und Shader im Browser erstellst – für die Java Edition (${LATEST} und jede Version bis zurück zu 1.6.1) und die Bedrock Edition. Sie wird von ${PUBLISHER.name} gemacht.`,
  differentTitle: 'Was Texture Pack Maker anders macht',
  toolsTitle: 'Die Tools',
  tools: [
    [link('/textures', 'Texture Pack Maker'), ': jeden Block, jedes Item und jeden Mob auf seinem 3D-Modell neu bemalen, eigene Bilder hochladen, Sounds ersetzen, das ganze Pack per Klick umgestalten oder ein vorhandenes Pack öffnen.'],
    [link('/texture-pack-converter', 'Texture-Pack-Konverter'), ': Java zu Bedrock, Bedrock zu Java, zwischen Java-Versionen oder PNG-Texturen zu einem .mcpack.'],
    [link('/merge-texture-packs', 'Texture Packs zusammenführen'), ': bis zu acht Packs in der gewünschten Reihenfolge zu einem kombinieren.'],
    [link('/totem-maker', 'Totem-Ersteller'), ': jeden Skin in ein eigenes Totem der Unsterblichkeit verwandeln, als Ressourcenpaket für Java oder Bedrock.'],
    [link('/font-maker', 'Schriftart-Ersteller'), ': eine Pixelschrift zeichnen oder eine Schriftdatei umwandeln, sie in Chat, Schildern und Büchern ansehen und als Ressourcenpaket laden.'],
    [link('/skins', 'Skin-Editor'), ' und ', link('/skin-pack-maker', 'Skinpaket-Ersteller'), ': Skins in 2D oder 3D mit breiten oder schmalen Armen malen und zu einem Bedrock-Skinpaket bündeln.'],
    [link('/shaders', 'Shader-Ersteller'), ': Shaderpakete für Iris und OptiFine, Vanilla-Java-Shader ganz ohne Mods und Vibrant-Visuals-Pakete für Bedrock.'],
    [link('/guides', 'Anleitungen'), ': Packs erstellen, installieren und reparieren, und das Pack-Format jeder Java-Version.'],
  ],
  howTitle: 'So funktioniert es',
  how: [
    'Wenn du eine Spielversion wählst, lädt dein Browser die Texturen dieser Version direkt von Mojang und behält sie auf deinem Gerät. Auch deine Projekte werden im Browser gespeichert (IndexedDB), und die Exporte entstehen auf deinem Gerät: eine Java-',
    code('.zip'),
    ' mit der passenden ',
    code('pack.mcmeta'),
    ` (Java ${LATEST} nutzt das Pack-Format ${F(LATEST)}) oder ein Bedrock-`,
    code('.mcpack'),
    ' mit einer ',
    code('manifest.json'),
    '. Nichts, was du machst, wird an einen Server geschickt.',
  ],
  makerTitle: 'Wer dahintersteckt',
  maker: ['Texture Pack Maker wird von ', strong(PUBLISHER.name), ' gemacht. Der Quellcode ist öffentlich, sodass jeder sehen kann, wie es funktioniert, Änderungen vorschlagen oder Probleme melden kann.'],
  notOfficial: 'Kein offizielles Minecraft-Produkt. Nicht von Mojang oder Microsoft genehmigt oder mit ihnen verbunden.',
  questions: 'Häufige Fragen',
};
