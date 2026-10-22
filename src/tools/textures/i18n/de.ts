// German text of the Texture Pack Maker start screen, effects and pack notes (English source: ./start.ts, ./effects.ts, ./pack.ts).

import type { TexturesLanguage } from './load';

const DE: TexturesLanguage = {
  textures: {
    version: {
      bedrockLatest: 'Bedrock (neueste)',
      bedrockPreview: 'Bedrock (Preview)',
      bedrock: 'Bedrock {version}',
    },
    hero: {
      eyebrow: 'Texture Pack Maker',
      title: 'Gestalte Minecraft {your}',
      your: 'nach deinem Geschmack',
      lead: 'Bemale jeden Block, jedes Item und jeden Mob neu, lade eigene Bilder hoch oder gib allem mit einem Klick einen neuen Stil. Für Java und Bedrock.',
      otherEdition: 'Pack für die andere Edition? ',
      convertIt: 'Umwandeln',
      original: 'Original',
    },
    create: {
      title: 'Neues Texture Pack',
      text: 'Starte mit den Vanilla-Texturen und mach sie zu deinen.',
      name: 'Name des Packs',
      namePlaceholder: 'Mein geniales Pack',
      edition: 'Edition',
      javaHint: 'Für Minecraft auf Windows-, Mac- und Linux-Computern.',
      bedrockHint: 'Für Handys, Tablets, Konsolen und Windows (die Version mit Marketplace).',
      gameVersion: 'Spielversion',
      resolution: 'Auflösung',
      description: 'Beschreibung (optional)',
      descriptionPlaceholder: 'Erstellt mit Texture Pack Maker',
      button: 'Pack erstellen',
      defaultName: 'Mein Texture Pack',
      startWith: 'Start mit',
      blank: 'Originaltexturen',
      blankHint: 'Alle Texturen so wie im Spiel',
      pvp: 'PvP-/FPS-Pack',
      pvpHint: 'Niedriges Feuer, klares Glas, sauberes Fadenkreuz, kleinere Schwerter',
      fps: 'Auch ein FPS-Pack',
      fpsHint: 'Blocktexturen mit 8 × 8 Pixeln und keine Animationen (Java), für schwächere Computer.',
      pvpButton: 'PvP-Pack erstellen',
      pvpName: 'Mein PvP-Pack',
      failed: 'Das Pack konnte nicht erstellt werden',
    },
    open: {
      title: 'Pack öffnen',
      text: 'Bearbeite ein Pack weiter, das du hier oder woanders erstellt hast.',
      opening: 'Pack wird geöffnet …',
      drop: 'Zieh ein Pack hierher oder klick zum Auswählen',
      dropTouch: 'Tippe, um ein Pack auszuwählen',
      dropHint: '.zip für Java · .mcpack oder .mcaddon für Bedrock',
      convert: 'Pack umwandeln',
      convertHint: 'Java zu Bedrock, Bedrock zu Java oder eine andere Java-Version',
      merge: 'Packs zusammenführen',
      mergeHint: 'Mehrere Packs zu einem vereinen, oberstes Pack zuerst',
      openedTitle: 'Pack geöffnet',
      openedText: '„{name}“ ist bereit zum Bearbeiten ({version}, {count, plural, one {# Textur} other {# Texturen}}). Gut zu wissen:',
      openInEditor: 'Im Editor öffnen',
      opened: '„{name}“ geöffnet',
    },
    howto: {
      title: 'So funktioniert’s',
      pick: 'Auswählen',
      pickText: 'Durchstöbere alle Vanilla-Texturen – Blöcke, Items, Mobs, GUI und mehr.',
      paint: 'Malen',
      paintText: 'Male Pixel, lade Bilder hoch oder gib allem Effekte per Klick.',
      export: 'Exportieren',
      exportText: 'Hol dir ein installationsfertiges Pack für Java oder Bedrock.',
    },
    recent: {
      title: 'Deine Texture Packs',
      savedHere: 'Nur in diesem Browser gespeichert',
      emptyTitle: 'Noch keine Packs',
      emptyText: 'Packs, die du erstellst oder öffnest, erscheinen hier, damit du später weitermachen kannst.',
      moreActions: 'Weitere Aktionen für {name}',
      open: 'Öffnen',
      rename: 'Umbenennen',
      duplicate: 'Duplizieren',
      delete: 'Löschen',
      untitled: 'Ohne Namen',
      edited: '{count} bearbeitet',
      effects: '{count, plural, one {# Effekt} other {# Effekte}}',
      editedAgo: 'Bearbeitet {time}',
      renameTitle: 'Pack umbenennen',
      renamed: 'Pack umbenannt',
      renameFailed: 'Das Pack konnte nicht umbenannt werden',
      copyName: '{name} (Kopie)',
      copied: 'Kopie von „{name}“ erstellt',
      copyFailed: 'Das Pack konnte nicht kopiert werden',
      deleteTitle: 'Dieses Pack löschen?',
      deleteText: '„{name}“ wird aus diesem Browser entfernt.',
      deleted: '„{name}“ gelöscht',
      undo: 'Rückgängig',
      restoreFailed: 'Das Pack konnte nicht wiederhergestellt werden.',
      deleteFailed: 'Das Pack konnte nicht gelöscht werden.',
    },
    categories: {
      block: {
        label: 'Blöcke',
        short: 'Block',
      },
      item: {
        label: 'Items',
        short: 'Item',
      },
      entity: {
        label: 'Mobs',
        short: 'Mob',
      },
      armor: {
        label: 'Rüstung',
        short: 'Rüstung',
      },
      gui: {
        label: 'GUI',
        short: 'GUI',
      },
      particle: {
        label: 'Partikel',
        short: 'Partikel',
      },
      environment: {
        label: 'Himmel',
        short: 'Himmel',
      },
      painting: {
        label: 'Gemälde',
        short: 'Gemälde',
      },
      effect: {
        label: 'Effekte',
        short: 'Effektsymbol',
      },
      font: {
        label: 'Schriften',
        short: 'Schrift',
      },
      map: {
        label: 'Karten',
        short: 'Karte',
      },
      colormap: {
        label: 'Farbtabellen',
        short: 'Farbtabelle',
      },
      misc: {
        label: 'Sonstiges',
        short: 'Sonstiges',
      },
      other: {
        label: 'Andere',
        short: 'Andere',
      },
    },
    resolution: {
      classic: '16× ist der klassische Minecraft-Look: Jede Blockseite hat 16×16 Pixel, genau wie im Originalspiel.',
      hd: '{r}× gibt jeder Blockseite {r}×{r} Pixel – {detail} so viele Details. Texturen werden hochskaliert, sobald du sie bearbeitest, damit du feinere Details malen kannst.',
      twice: 'doppelt',
      times: '{n}-mal',
    },
  },
  'textures.effects': {
    effects: {
      hue: {
        label: 'Farbton verschieben',
        description: 'Dreht die Farben auf dem Farbkreis – alle oder nur einen Farbbereich.',
      },
      saturation: {
        label: 'Sättigung',
        description: 'Macht Farben kräftiger oder blasser.',
      },
      brightness: {
        label: 'Helligkeit',
        description: 'Hellt jede Textur auf oder dunkelt sie ab.',
      },
      contrast: {
        label: 'Kontrast',
        description: 'Verstärkt oder verringert den Unterschied zwischen Hell und Dunkel.',
      },
      temperature: {
        label: 'Farbtemperatur',
        description: 'Warme (orange) oder kühle (blaue) Farbbalance.',
      },
      tint: {
        label: 'Tönen / Einfärben',
        description: 'Überzieht Texturen mit einer Farbe oder färbt sie komplett um.',
      },
      grayscale: {
        label: 'Graustufen',
        description: 'Entfernt die Farbe.',
      },
      sepia: {
        label: 'Sepia',
        description: 'Braune Töne wie auf alten Fotos.',
      },
      invert: {
        label: 'Invertieren',
        description: 'Negative Farben oder nur Hell und Dunkel tauschen, Farbtöne bleiben.',
      },
      posterize: {
        label: 'Tontrennung',
        description: 'Weniger Farbstufen für einen flachen, grafischen Look.',
      },
      pastel: {
        label: 'Pastell',
        description: 'Weiche, helle Bonbontöne.',
      },
      vignette: {
        label: 'Ränder & Relief',
        description: 'Dunkelt die Ränder jeder Textur ab oder gibt Blöcken ein erhabenes 3D-Relief.',
      },
      outline: {
        label: 'Umriss',
        description: 'Zieht eine Linie um Items und Formen oder einen Rahmen um jeden Block.',
      },
      noise: {
        label: 'Rauschen / Körnung',
        description: 'Fügt Filmkorn oder eine raue Struktur hinzu. Auf jedem Animationsbild gleich.',
      },
      sharpen: {
        label: 'Schärfen',
        description: 'Klarere Details und stärkerer Pixelkontrast.',
      },
      blur: {
        label: 'Weichzeichnen',
        description: 'Macht Texturen weicher. Blocktexturen werden nahtlos über die Kanten weichgezeichnet.',
      },
      pixelate: {
        label: 'Verpixeln',
        description: 'Senkt die Auflösung zu größeren Pixeln; Größe und Transparenz bleiben.',
      },
      upscale: {
        label: 'Glattes HD-Hochskalieren',
        description: 'Verdoppelt oder vervierfacht die Auflösung mit einem Glättungsfilter für Pixel-Art (Scale2x/Scale3x).',
      },
      downscale: {
        label: 'Niedrigere Auflösung',
        description: 'Verkleinert Texturen auf 8 oder 4 Pixel pro Block: klarerer Look und weniger Grafikspeicher (FPS-Packs).',
      },
      stillFrames: {
        label: 'Keine Animationen',
        description: 'Java: Von animierten Texturen bleibt nur das erste Bild, Wasser, Lava, Feuer und Portale stehen still.',
      },
      dither: {
        label: 'Dithering',
        description: 'Geordnetes Retro-Dithering mit weniger Farbstufen.',
      },
      glow: {
        label: 'Leuchten',
        description: 'Helle Stellen strahlen und blühen, optional mit Lichthof um Items.',
      },
      flip: {
        label: 'Spiegeln',
        description: 'Spiegelt Texturen horizontal und/oder vertikal (jedes Animationsbild einzeln).',
      },
      gradientMap: {
        label: 'Verlaufsumsetzung',
        description: 'Ersetzt dunkle, mittlere und helle Töne durch drei Farben deiner Wahl.',
      },
      palette: {
        label: 'Retro-Palette',
        description: 'Rastet jede Farbe auf eine klassische Konsolen- oder Pixel-Art-Palette ein.',
      },
    },
    params: {
      shift: 'Verschiebung',
      colours: 'Farben',
      amount: 'Stärke',
      warmth: 'Wärme',
      colour: 'Farbe',
      mode: 'Modus',
      levels: 'Stufen',
      style: 'Stil',
      strength: 'Stärke',
      edgeWidth: 'Randbreite',
      where: 'Wo',
      opacity: 'Deckkraft',
      thickness: 'Dicke',
      includeCorners: 'Ecken einbeziehen',
      monochromeGrain: 'Einfarbige Körnung',
      radius: 'Radius',
      pixelSize: 'Pixelgröße',
      scale: 'Faktor',
      filter: 'Filter',
      patternStrength: 'Musterstärke',
      glowFromBrightness: 'Leuchten ab Helligkeit',
      haloAroundShapes: 'Lichthof um Formen',
      flipHorizontally: 'Horizontal spiegeln',
      flipVertically: 'Vertikal spiegeln',
      shadows: 'Tiefen',
      midtones: 'Mitteltöne',
      highlights: 'Lichter',
      palette: 'Palette',
      matchBy: 'Zuordnen nach',
      dither: 'Dithering',
      resolution: 'Auflösung',
    },
    hints: {
      coolDown: 'Negative Werte kühlen die Texturen ab',
      colourSteps: 'Farbstufen pro Kanal',
      edgeStyles: 'Für die Stile Ränder und Relief',
      corners: 'Auch diagonal angrenzende Pixel umranden',
      halo: 'Fügt neben hellen Pixeln weiches Licht in transparente Bereiche ein',
      paletteDither: 'Geordnetes Dithering zwischen den Palettenfarben',
    },
    options: {
      allColours: 'Alle Farben',
      reds: 'Rottöne',
      yellows: 'Gelbtöne',
      greens: 'Grüntöne',
      cyans: 'Cyantöne',
      blues: 'Blautöne',
      magentas: 'Magentatöne',
      softTint: 'Sanft tönen',
      colorize: 'Einfärben',
      multiply: 'Multiplizieren',
      negative: 'Negativ (alle Kanäle)',
      lightnessOnly: 'Nur Helligkeit (Farbtöne bleiben)',
      softVignette: 'Weiche Vignette',
      darkEdges: 'Dunkle Ränder',
      bevel3d: '3D-Relief',
      automatic: 'Automatisch',
      aroundShapes: 'Um Formen herum',
      insideShapeEdges: 'Innen an den Formrändern',
      blockBorder: 'Blockrahmen',
      smoothEdges: 'Glatte Kanten (Scale2x/3x)',
      sharpPixels: 'Scharfe Pixel (nächster Nachbar)',
      closestColour: 'Nächstliegende Farbe',
      brightnessFew: 'Helligkeit (für Paletten mit 2–4 Farben)',
    },
    presets: {
      darkMode: {
        label: 'Dunkelmodus',
        description: 'Düstere, dunklere Welt und Menüs mit etwas kühleren Farben.',
      },
      pastelDream: {
        label: 'Pastelltraum',
        description: 'Weiche Bonbonfarben, hell und luftig.',
      },
      neonOutline: {
        label: 'Neon-Umriss',
        description: 'Dunkle Blöcke mit leuchtenden Cyan-Rändern und umrandeten, strahlenden Items.',
      },
      retro8bit: {
        label: 'Retro 8-Bit',
        description: 'Knallige Farben, eingerastet auf eine klassische Konsolenpalette.',
      },
      autumn: {
        label: 'Herbst',
        description: 'Orange und rote Blätter in warmem, goldenem Licht.',
      },
      winterFrost: {
        label: 'Winterfrost',
        description: 'Eisig türkisfarbene Blätter, blasse Farben und kaltes, blaues Licht.',
      },
      noir: {
        label: 'Noir',
        description: 'Kontrastreiches Schwarz-Weiß mit Filmkorn.',
      },
      sepiaMemories: {
        label: 'Sepia-Erinnerungen',
        description: 'Warme Töne wie auf alten Fotos, mit weichen Rändern.',
      },
      inverted: {
        label: 'Invertiert',
        description: 'Überall Farben wie im Fotonegativ.',
      },
      cartoon: {
        label: 'Cartoon',
        description: 'Kräftige, flache Farben mit dunklen Tuschekonturen.',
      },
      smoothHd: {
        label: 'Glattes HD (2x)',
        description: 'Verdoppelt die Auflösung mit geglätteten Pixel-Art-Kanten.',
      },
      vivid: {
        label: 'Lebendig',
        description: 'Sattere Farben, mehr Kontrast und schärfere Details.',
      },
      goldenHour: {
        label: 'Goldene Stunde',
        description: 'Sonnenuntergangsleuchten: warm, hell und ein bisschen verträumt.',
      },
      gameBoy: {
        label: 'Game Boy',
        description: 'Vier Grüntöne, wie auf dem originalen Handheld.',
      },
      blocks3d: {
        label: '3D-Blöcke',
        description: 'Ein erhabenes Relief auf jedem Block für einen klobigen, greifbaren Look.',
      },
    },
  },
  'textures.pack': {
    notInGame: '„{file}“ ist keine Textur in {edition, select, java {Minecraft {version}} other {dieser Bedrock-Version}}, und dieses Pack hat keine Kopie davon.',
    emptyImage: 'Das Bild ist leer.',
    soundsNotOgg: '{count, plural, one {# Sounddatei ist kein Ogg Vorbis, daher spielt Java sie nicht ab: {files}. Ersetze sie unter Sounds.} other {# Sounddateien sind kein Ogg Vorbis, daher spielt Java sie nicht ab: {files}. Ersetze sie unter Sounds.}}',
  },
};

export default DE;

/** Text that is rightly the same as in English (names) */
export const SAME_AS_ENGLISH = [
  'textures:hero.eyebrow',
  'textures.effects:presets.gameBoy.label',
];
