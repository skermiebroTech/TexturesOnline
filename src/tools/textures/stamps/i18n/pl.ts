// Polish text of the stamp tool (English source: ./text.ts).

import type { StampsLanguage } from './load';

const PL: StampsLanguage = {
  'textures.stamps': {
    choose: 'Wybierz stempel',
    current: 'Stempel: {name}',
    title: 'Stemple',
    presets: 'Gotowe',
    presetsHint: 'Gotowe stemple rysują się w odcieniach twojego głównego koloru.',
    yours: 'Twoje stemple',
    none: 'Nie masz jeszcze własnych stempli. Zaznacz obszar i zapisz go jako stempel.',
    names: {
      ore: 'Plamki rudy',
      cracks: 'Pęknięcia',
      moss: 'Mech',
      dither: 'Łata rastra',
      sparkles: 'Błyski',
      pebbles: 'Kamyki',
    },
    stampName: 'Stempel {n}',
    size: '{width} × {height}',
    save: 'Zapisz zaznaczenie jako stempel',
    saveHint: 'Najpierw zaznacz obszar (do 32 × 32 pikseli)',
    saved: 'Zapisano „{name}” jako stempel.',
    tooBig: 'Stemple mogą mieć do 32 × 32 pikseli. Zaznacz mniejszy obszar.',
    empty: 'W zaznaczeniu nie ma pikseli, z których da się zrobić stempel.',
    delete: 'Usuń „{name}”',
    deleted: 'Usunięto „{name}”.',
    undo: 'Cofnij',
    rotate: 'Obróć stempel (R)',
    rotateTouch: 'Obróć stempel',
    flipH: 'Odbij stempel w poziomie (H)',
    flipHTouch: 'Odbij stempel w poziomie',
    flipV: 'Odbij stempel do góry nogami (Shift + H)',
    flipVTouch: 'Odbij stempel do góry nogami',
    hint: 'Kliknij, żeby przystawić stempel. Przytrzymaj i przeciągnij, żeby najpierw go ustawić, a potem puść. Prawy przycisk przystawia jego kształt drugim kolorem.',
    hintTouch: 'Stuknij, żeby przystawić stempel. Przytrzymaj i przeciągnij, żeby najpierw go ustawić, a potem podnieś palec.',
    kept: 'Twoje stemple są zapisane w tej przeglądarce, a te zapisane w tej paczce trafiają do jej pliku projektu.',
  },
};

export default PL;
