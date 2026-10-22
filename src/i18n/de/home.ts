// German home page (see HomeText in src/tools/home/content.ts).

import { el } from '../../app/markup';
import { link } from '../../app/content/blocks';
import { F, LATEST } from '../../app/content/facts';
import type { HomeText } from '../../tools/home/content';

const code = (t: string) => el('code', null, t);

export const HOME: HomeText = {
  tools: {
    textures: {
      title: 'Texture Packs',
      blurb: 'Bemale jeden Block, jedes Item und jeden Mob – oder gib dem ganzen Spiel mit einem Klick einen neuen Look.',
      features: ['Jede Textur, jede Version', 'Pixel-Editor & Effekte', 'Vorhandene Packs öffnen'],
      cta: 'Texture Pack erstellen',
      previewLabel: '',
    },
    skins: {
      title: 'Skins',
      blurb: 'Male deinen Spieler auf der 64×64-Vorlage, während sich ein 3D-Modell live mitändert.',
      features: ['Breit & schmal, beide Ebenen', 'Vorlagen oder jeder Spielername', 'Export für Java & Bedrock'],
      cta: 'Skin gestalten',
      previewLabel: 'Pixel für Pixel malen',
    },
    shaders: {
      title: 'Shader',
      blurb: 'Stelle Licht, Farben, Nebel und Wasser mit Reglern ein und sieh das Ergebnis live.',
      features: ['Iris- / OptiFine-Pakete', 'Vanilla-Shader ohne Mods', 'Bedrock Vibrant Visuals'],
      cta: 'Shader bauen',
      previewLabel: 'Vorschau bei Tag & Nacht',
    },
  },
  faq: [
    {
      id: 'how',
      q: 'Wie erstelle ich ein Minecraft Texture Pack?',
      a: [
        el(
          'p',
          null,
          'Öffne den ',
          link('/textures', 'Texture-Pack-Editor'),
          ', wähle Java oder Bedrock und deine Spielversion, dann bemalst du Texturen neu, lädst eigene Bilder hoch oder nutzt einen Effekt per Klick. Exportiere eine ',
          code('.zip'),
          ' (Java) oder ein ',
          code('.mcpack'),
          ' (Bedrock) und aktiviere es im Spiel. ',
          link('/guides/make-a-texture-pack', 'Schritt-für-Schritt-Anleitung'),
          '.',
        ),
      ],
    },
    {
      id: 'what',
      q: 'Was ist Texture Pack Maker?',
      a: [
        el(
          'p',
          null,
          'Texture Pack Maker ist eine kostenlose Website, mit der du Minecraft Texture Packs, Skins und Shader erstellst. Alles läuft in deinem Browser: Spielversion wählen, mit Live-Vorschau bearbeiten und ein Pack herunterladen, das sofort in Java oder Bedrock funktioniert.',
        ),
      ],
    },
    {
      id: 'free',
      q: 'Ist das kostenlos? Brauche ich ein Konto?',
      a: [el('p', null, 'Es ist kostenlos, es gibt kein Konto und keine Anmeldung, und der Code ist Open Source unter der MIT-Lizenz. Deine Projekte bleiben auf deinem eigenen Gerät.')],
    },
    {
      id: 'bedrock',
      q: 'Funktioniert es auch für Minecraft Bedrock?',
      a: [
        el(
          'p',
          null,
          'Ja. Texture Packs und Skins werden als ',
          code('.mcpack'),
          ' exportiert, das Bedrock beim Öffnen importiert, und der Shader Maker erstellt Vibrant-Visuals-Pakete. Hier steht, ',
          link('/guides/java-vs-bedrock-packs', 'wie sich Java- und Bedrock-Packs unterscheiden'),
          '.',
        ),
      ],
    },
    {
      id: 'versions',
      q: 'Für welche Java-Versionen kann ich Packs erstellen?',
      a: [
        el(
          'p',
          null,
          `Java ${LATEST} ist standardmäßig eingestellt, und jede Version zurück bis 1.6.1 funktioniert. Jedes Pack bekommt die `,
          code('pack.mcmeta'),
          `-Regeln der gewählten Version (${LATEST} nutzt das Ressourcenpaket-Format ${F(LATEST)}). `,
          link('/guides/minecraft-pack-format-versions', 'Alle Pack-Formate'),
          '.',
        ),
      ],
    },
    {
      id: 'resource',
      q: 'Ist ein Texture Pack dasselbe wie ein Ressourcenpaket?',
      a: [
        el(
          'p',
          null,
          'Fast. Java Edition nennt sie Ressourcenpakete: Außer Texturen können sie auch Modelle, Sounds, Schriftarten und Shader ändern. Bedrock spricht ebenfalls von Ressourcenpaketen und nutzt ',
          code('.mcpack'),
          '-Dateien. Dieser Maker erstellt beides.',
        ),
      ],
    },
    {
      id: 'skinpack',
      q: 'Kann ich ein eigenes Skinpaket erstellen?',
      a: [
        el(
          'p',
          null,
          'Ja. Male deine Skins (breite oder schmale Arme) im ',
          link('/skins', 'Skin-Editor'),
          ' und exportiere sie zusammen als ein Bedrock-Skinpaket, oder lade ein PNG für Java herunter. ',
          link('/skin-pack-maker', 'Skinpaket-Ersteller'),
          '.',
        ),
      ],
    },
    {
      id: 'install',
      q: 'Muss ich etwas installieren?',
      a: [el('p', null, 'Nein. Es läuft in jedem aktuellen Browser auf Computer, Handy oder Tablet. Nach dem ersten Besuch funktioniert die App auch offline.')],
    },
  ],
  appFeatures: [
    `Minecraft Texture Pack Maker für Java Edition (${LATEST} und jede Version seit 1.6.1) und Bedrock Edition`,
    'Minecraft-Skin-Editor mit 3D-Live-Vorschau, breitem und schmalem Modell, PNG-Export für Java und Skinpaket-Export für Bedrock',
    'Shader-Ersteller für Iris-/OptiFine-Shaderpakete, Vanilla-Java-Shader ohne Mods und Bedrock-Vibrant-Visuals-Pakete',
    'Exportiert fertige .zip- und .mcpack-Dateien mit passender pack.mcmeta oder manifest.json',
    'Läuft im Browser: keine Anmeldung, kein Upload, nach dem ersten Besuch auch offline',
  ],
  hero: {
    chip: 'Kostenlos · Ohne Anmeldung',
    chipOffline: ' · Auch offline',
    title: { accent: 'Minecraft', post: ' Texture Packs selbst erstellen' },
    lead: 'Erstelle eigene Texture Packs, Skins und Shader direkt im Browser – ein kostenloser Ressourcenpaket-Ersteller für Java und Bedrock, mit Downloads, die sofort ins Spiel passen.',
    start: 'Jetzt loslegen',
    install: 'So installierst du',
    everything: 'Alles ansehen, was du machen kannst',
    editionsLabel: 'Unterstützte Editionen',
    chips: [`Java ${LATEST}`, 'Alle Versionen ab 1.6.1', 'Bedrock'],
    blockLabel: 'Ein Grasblock in Pixelgrafik',
    dragHint: 'Zum Drehen ziehen',
  },
  toolsSection: {
    eyebrow: 'Drei Tools, eine Seite',
    title: 'Was möchtest du erstellen?',
    lead: 'Alles, was du brauchst, um Minecraft deinen eigenen Stil zu geben. Nichts installieren, kein Konto – einfach ein Tool öffnen und loslegen.',
  },
  converter: {
    title: 'Texture-Pack-Konverter',
    text: `Mach aus einem Java-Pack ein Bedrock-Pack oder umgekehrt, bring ein altes Pack auf ${LATEST} oder mach aus PNGs ein .mcpack.`,
    cta: 'Pack umwandeln',
  },
  features: {
    eyebrow: 'Kostenloser Pack-Ersteller',
    title: 'Alles, was ein Texture Pack Maker können muss',
    lead: 'Vom einzelnen neu bemalten Schwert bis zum kompletten HD-Ressourcenpaket – erstellt und exportiert, ohne den Browser zu verlassen.',
    titles: [
      'Texture-Pack-Editor mit 3D-Modellen',
      'Texture-Pack-Generator per Klick',
      'Vorhandene Packs öffnen und bearbeiten',
      'Ressourcenpakete für Java und Bedrock',
      'Skin-Editor und Skinpaket-Ersteller',
      'Shader-Ersteller, mit oder ohne Mods',
    ],
    items: [
      ['Bemale jeden Block, jedes Item und jeden Mob deiner Version direkt auf dem echten 3D-Modell: Öfen, Truhen, Treppen und über 80 Mobs vom Creeper bis zum Dorfbewohner.'],
      ['Gestalte das ganze Spiel auf einmal um, mit Effekten wie Dark Mode, Pastel, Retro 8-bit, Autumn oder Smooth HD, und feile dann von Hand nach.'],
      ['Lade eine beliebige Java-', code('.zip'), ' oder ein Bedrock-', code('.mcpack'), ' und bearbeite weiter, oder wandle es mit dem ', link('/texture-pack-converter', 'Pack-Konverter'), ' in die andere Edition um.'],
      ['Ein Ressourcenpaket-Baukasten, der die exakte ', code('pack.mcmeta'), ` für Java ${LATEST} bis zurück zu 1.6.1 schreibt, oder eine Bedrock-`, code('manifest.json'), '.'],
      ['Gestalte Skins in 2D oder 3D mit breiten oder schmalen Armen und bündle sie mit dem ', link('/skin-pack-maker', 'Skinpaket-Ersteller'), ' zu einem Bedrock-.mcpack.'],
      ['Baue Shaderpakete für Iris und OptiFine, Vanilla-Java-Shader ganz ohne Mods oder Vibrant-Visuals-Pakete für Bedrock.'],
    ],
  },
  why: {
    eyebrow: 'Was anders ist',
    title: 'Warum Texture Pack Maker?',
    lead: ['Kostenlos, Open Source und privat, mit jeder Java-Version seit 1.6.1, Bedrock und zehn Tools an einem Ort. ', link('/about', 'Über das Projekt'), '.'],
  },
  how: {
    eyebrow: 'So funktioniert’s',
    title: 'Von der Idee ins Spiel in wenigen Minuten',
    steps: [
      { title: 'Spiel wählen', text: `Java ${LATEST} ist schon eingestellt – oder wähle eine beliebige Java-Version bis zurück zu 1.6.1 oder Bedrock.` },
      { title: 'Gestalten', text: 'Pixel malen, Effekte per Klick stapeln oder Shader-Regler verschieben – mit 3D-Live-Vorschau.' },
      { title: 'Exportieren & spielen', text: 'Lade eine fertige .zip oder ein .mcpack herunter und folge der Installationsanleitung, um es im Spiel zu nutzen.' },
    ],
    values: [
      { title: 'Privat von Anfang an', text: 'Deine Arbeit verlässt nie dein Gerät. Die Spieldateien lädt dein eigener Browser direkt von Mojang.' },
      { title: 'Funktioniert offline', text: 'Nach dem ersten Besuch bleiben die App und die geladenen Spieldateien auf diesem Gerät.' },
      { title: 'Immer das richtige Format', text: 'Die Pack-Dateien werden für genau die gewählte Version geschrieben, damit Minecraft sie ohne Meckern lädt.' },
    ],
  },
  guides: { eyebrow: 'Anleitungen', title: 'Das Wichtigste lernen', lead: 'Kurze, geprüfte Anleitungen zum Erstellen und Installieren von Packs, Skins und Shadern.', all: 'Alle Anleitungen' },
  faqHead: { eyebrow: 'Fragen', title: 'Gut zu wissen' },
  cta: { title: 'Bereit, etwas zu bauen?', text: 'Wähle ein Tool – dein erstes Pack kann in wenigen Minuten im Spiel sein.', button: 'Jetzt loslegen' },
  startDialog: 'Was möchtest du erstellen?',
};
