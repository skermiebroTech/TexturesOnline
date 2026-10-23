import type { StampsLanguage } from './load';

const DE: StampsLanguage = {
  'textures.stamps': {
    choose: 'Stempel wählen',
    current: 'Stempel: {name}',
    title: 'Stempel',
    presets: 'Vorlagen',
    presetsHint: 'Vorlagen werden in Tönen deiner Hauptfarbe gezeichnet.',
    yours: 'Deine Stempel',
    none: 'Noch keine eigenen Stempel. Wähle einen Bereich aus und speichere ihn als Stempel.',
    names: {
      ore: 'Erzflecken',
      cracks: 'Risse',
      moss: 'Moos',
      dither: 'Rastermuster',
      sparkles: 'Funkeln',
      pebbles: 'Kiesel',
    },
    stampName: 'Stempel {n}',
    size: '{width} × {height}',
    save: 'Auswahl als Stempel speichern',
    saveHint: 'Wähle zuerst einen Bereich aus (bis 32 × 32 Pixel)',
    saved: '„{name}“ als Stempel gespeichert.',
    tooBig: 'Stempel können bis zu 32 × 32 Pixel groß sein. Wähle einen kleineren Bereich aus.',
    empty: 'In der Auswahl sind keine Pixel für einen Stempel.',
    delete: '„{name}“ löschen',
    deleted: '„{name}“ gelöscht.',
    undo: 'Rückgängig',
    rotate: 'Stempel drehen (R)',
    rotateTouch: 'Stempel drehen',
    flipH: 'Stempel waagrecht spiegeln (H)',
    flipHTouch: 'Stempel waagrecht spiegeln',
    flipV: 'Stempel senkrecht spiegeln (Umschalt + H)',
    flipVTouch: 'Stempel senkrecht spiegeln',
    hint: 'Klicke zum Stempeln. Halte gedrückt und ziehe, um ihn erst zu platzieren, dann lass los. Rechtsklick stempelt seine Form in der Zweitfarbe.',
    hintTouch: 'Tippe zum Stempeln. Halte und ziehe, um ihn erst zu platzieren, dann heb den Finger.',
    kept: 'Deine Stempel bleiben in diesem Browser, und die in diesem Pack gespeicherten kommen mit seiner Projektdatei mit.',
  },
};

export default DE;
