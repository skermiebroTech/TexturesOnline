import type { SwapLanguage } from './load';

const DE: SwapLanguage = {
  'textures.swap': {
    button: 'Farbe tauschen',
    buttonHint: 'Eine Farbe durch eine andere ersetzen: in dieser Textur, in der Auswahl oder im ganzen Pack',
    title: 'Farbe tauschen',
    from: 'Zu ersetzende Farbe',
    to: 'Neue Farbe',
    exchange: 'Die beiden Farben vertauschen',
    pickFrom: 'Aus dieser Textur wählen:',
    tolerance: 'Ähnliche Farben',
    toleranceHint: 'Nimmt auch so nahe Farben mit. Jede behält ihren kleinen Unterschied, die Schattierung darin bleibt also.',
    ramp: 'Ganze Farbabstufung tauschen',
    rampHint: 'Ihre dunkleren und helleren Töne in dieser Textur wandern mit und behalten ihre Farbtonverschiebung.',
    rampShades: '{count, plural, one {# Ton} other {# Töne}}',
    where: 'Wo',
    scope: {
      texture: 'Diese Textur',
      selection: 'Auswahl',
      pack: 'Ganzes Pack',
    },
    layersNote: 'Jede nicht gesperrte Ebene der Textur ändert sich.',
    selectionNote: 'Nur der ausgewählte Bereich der Ebene, auf der du malst, ändert sich.',
    before: 'Vorher',
    after: 'Nachher',
    pixels: '{count, plural, =0 {Kein Pixel ändert sich} one {# Pixel ändert sich} other {# Pixel ändern sich}}',
    packNote: 'Texturen deines Packs, die die Farbe nutzen:',
    gameToo: 'Auch die Texturen des Spiels durchsuchen (langsamer)',
    searching: 'Durchsuche {done} von {total} Texturen …',
    none: 'Keine Textur nutzt diese Farbe.',
    rowPixels: '{count, plural, one {# Pixel} other {# Pixel}}',
    include: '{name} ändern',
    apply: 'Tauschen',
    applyCount: '{count, plural, one {In # Textur tauschen} other {In # Texturen tauschen}}',
    done: 'Farbe in {name} getauscht',
    doneMany: '{count, plural, one {Farbe in # Textur getauscht} other {Farbe in # Texturen getauscht}}',
    nothing: 'Nichts zu tauschen: Kein Pixel hat diese Farbe.',
    locked: 'Die Ebene, auf der du malst, ist gesperrt oder ausgeblendet.',
  },
};

export default DE;
