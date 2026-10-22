// German text of project files and backups (English source: ./text.ts).

import type { ProjectFileLanguage } from './load';

const DE: ProjectFileLanguage = {
  'shared.projectFile': {
    saved: '{file} gespeichert. Öffne die Datei hier jederzeit, um weiterzuarbeiten.',
    saveFailed: 'Die Projektdatei konnte nicht gespeichert werden.',
    opened: '„{name}“ geöffnet',
    openedCopy: '„{name}“ wurde als Kopie geöffnet. Dein vorhandenes Projekt bleibt unverändert.',
    copyName: '{name} (Kopie)',
    untitled: 'Ohne Titel',
    errors: {
      notZip: 'Das ist keine Projektdatei. Projektdateien enden auf .tpmproject oder .tpmbackup.',
      notProject: 'Das ist keine Projektdatei von Texture Pack Maker. Ein Pack öffnest du im Texture-Pack-Editor mit „Pack öffnen“.',
      damaged: 'Diese Projektdatei ist beschädigt und lässt sich nicht öffnen.',
      newer: 'Diese Datei stammt aus einer neueren Version von Texture Pack Maker (Format {version}). Lade die Seite neu, um zu aktualisieren, und öffne sie dann noch einmal.',
      empty: 'In dieser Datei sind keine Projekte.',
      item: '„{name}“ ist beschädigt und wurde ausgelassen.',
    },
    types: {
      texturepack: 'Texture Pack',
      skin: 'Skin',
      shader: 'Shader',
      cape: 'Umhang',
      font: 'Schriftart',
    },
    counts: {
      texturepack: '{count, plural, one {# Texture Pack} other {# Texture Packs}}',
      skin: '{count, plural, one {# Skin} other {# Skins}}',
      shader: '{count, plural, one {# Shader} other {# Shader}}',
      cape: 'Dein Umhang',
      font: 'Deine Schriftart',
    },
    backup: {
      title: 'Projekte sichern',
      intro: 'Eine Datei mit allen Projekten in diesem Browser. Bewahre sie sicher auf oder öffne sie in einem anderen Browser oder auf einem anderen Gerät, um alles mitzunehmen.',
      none: 'In diesem Browser gibt es noch keine Projekte.',
      contains: 'In der Sicherung',
      gameFiles: 'Die Spieldateien selbst sind nicht dabei: Sie werden beim Öffnen eines Projekts wieder von Mojang geladen.',
      download: 'Sicherung herunterladen',
      done: 'Sicherung gespeichert: {file}',
      failed: 'Die Sicherung konnte nicht erstellt werden.',
    },
    restore: {
      title: 'Sicherung wiederherstellen',
      intro: 'Gespeichert am {date}. Wähle, was zurück in diesen Browser soll.',
      choose: 'Projekte',
      already: 'Schon da',
      existing: 'Schon in diesem Browser',
      skip: 'Überspringen',
      keepBoth: 'Beide behalten',
      skipNote: 'Bleibt in diesem Browser, wie es ist',
      copyNote: 'Wird als Kopie neben deinem wiederhergestellt',
      replaceNote: 'Ersetzt den in diesem Browser',
      selectAll: 'Alle auswählen',
      selectNone: 'Keine auswählen',
      restore: '{count, plural, =0 {Wiederherstellen} one {# Projekt wiederherstellen} other {# Projekte wiederherstellen}}',
      done: '{count, plural, one {# Projekt wiederhergestellt} other {# Projekte wiederhergestellt}}',
      failed: '„{name}“ konnte nicht wiederhergestellt werden.',
      edited: 'Bearbeitet {date}',
    },
    replace: {
      capeTitle: 'Umhang ersetzen?',
      capeText: 'Der Umhang-Editor hat immer nur einen Umhang, deshalb ersetzt „{name}“ den, an dem du gerade arbeitest. Speichere ihn vorher als Projektdatei, wenn du ihn behalten willst.',
      saveFirst: 'Erst aktuellen speichern',
      replace: 'Ersetzen',
    },
  },
};

/** Rightly the same as in English (the German names of these things). */
export const SAME_AS_ENGLISH = ['shared.projectFile:types.texturepack'];

export default DE;
