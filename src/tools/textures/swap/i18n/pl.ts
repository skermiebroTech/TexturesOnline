// Polish text of the colour swap (English source: ./text.ts).

import type { SwapLanguage } from './load';

const PL: SwapLanguage = {
  'textures.swap': {
    button: 'Zamień kolor',
    buttonHint: 'Zamień kolor na inny w tej teksturze, w zaznaczeniu albo w całej paczce',
    title: 'Zamień kolor',
    from: 'Kolor do zamiany',
    to: 'Nowy kolor',
    exchange: 'Zamień te dwa kolory miejscami',
    pickFrom: 'Wybierz go z tej tekstury:',
    tolerance: 'Podobne kolory',
    toleranceHint: 'Bierze też kolory tak bliskie. Każdy zachowuje swoją małą różnicę, więc cieniowanie w środku zostaje.',
    ramp: 'Zamień całą gamę odcieni',
    rampHint: 'Jego ciemniejsze i jaśniejsze odcienie w tej teksturze zmieniają się razem z nim, zachowując przesunięcie barwy.',
    rampShades: '{count, plural, one {# odcień} few {# odcienie} many {# odcieni} other {# odcienia}}',
    where: 'Gdzie',
    scope: {
      texture: 'Ta tekstura',
      selection: 'Zaznaczenie',
      pack: 'Cała paczka',
    },
    layersNote: 'Zmienia się każda odblokowana warstwa tekstury.',
    selectionNote: 'Zmienia się tylko zaznaczony obszar warstwy, na której malujesz.',
    before: 'Przed',
    after: 'Po',
    pixels: '{count, plural, =0 {Żaden piksel się nie zmienia} one {Zmienia się # piksel} few {Zmieniają się # piksele} many {Zmienia się # pikseli} other {Zmienia się # piksela}}',
    packNote: 'Tekstury twojej paczki, które używają tego koloru:',
    gameToo: 'Szukaj też w teksturach gry (wolniej)',
    searching: 'Przeglądanie {done} z {total} tekstur…',
    none: 'Żadna tekstura nie używa tego koloru.',
    rowPixels: '{count, plural, one {# piksel} few {# piksele} many {# pikseli} other {# piksela}}',
    include: 'Zmień {name}',
    apply: 'Zamień',
    applyCount: '{count, plural, one {Zamień w # teksturze} few {Zamień w # teksturach} many {Zamień w # teksturach} other {Zamień w # tekstury}}',
    done: 'Zamieniono kolor w {name}',
    doneMany: '{count, plural, one {Zamieniono kolor w # teksturze} few {Zamieniono kolor w # teksturach} many {Zamieniono kolor w # teksturach} other {Zamieniono kolor w # tekstury}}',
    nothing: 'Nie ma czego zamieniać: żaden piksel nie ma tego koloru.',
    locked: 'Warstwa, na której malujesz, jest zablokowana albo ukryta.',
  },
};

export default PL;
