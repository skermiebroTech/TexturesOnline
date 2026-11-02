// Polish text of the PvP / FPS tab (English source: ./text.ts). Tweak and option names match the
// Polish PvP guide (Niski ogień, Czyste szkło, Lekko zabarwione, Tekstury 8×, Bez animacji).

import type { PvpLanguage } from './load';

const PL: PvpLanguage = {
  'textures.pvp': {
    intro: 'Co zmieniają paczki PvP i FPS, każda rzecz jednym kliknięciem, dla {version}. Każda zmiana zapisuje w paczce zwykłe pliki: dalej możesz je malować, a po wyłączeniu wracają poprzednie pliki.',
    preset: {
      button: 'Włącz szablon PvP',
      hint: 'Niski ogień, czyste szkło, bez ramki dyni, czystszy celownik, mniejsze miecze i niższa tarcza, o ile ta wersja je ma.',
      applied: 'Szablon PvP: {count, plural, one {włączono # zmianę} few {włączono # zmiany} many {włączono # zmian} other {włączono # zmiany}}',
      none: 'Każda zmiana z szablonu jest już włączona.',
    },
    groups: { pvp: 'PvP', fps: 'FPS' },
    switchLabel: '{name}: wł. albo wył.',
    changes: 'Zmienia',
    worksIn: 'Działa w',
    more: '+{count} więcej',
    tweaks: {
      lowFire: { title: 'Niski ogień', text: 'Płomienie na ekranie, kiedy się palisz, są niżej, więc dalej widzisz walkę.' },
      clearGlass: { title: 'Czyste szkło', text: 'Szkło, barwione szkło i szyby są w środku przezroczyste i zachowują ramkę.' },
      noPumpkin: { title: 'Bez ramki dyni', text: 'Wydrążona dynia na głowie nie przyciemnia już ekranu.' },
      crosshair: { title: 'Własny celownik', text: 'Mniejszy, czystszy celownik. Gra rysuje go w odwróconych kolorach na tym, co jest za nim, więc najlepiej działa biały.' },
      swords: { title: 'Mniejsze miecze', text: 'Miecze (albo cała broń) wyglądają w ręce mniejsze i są niżej w widoku z pierwszej osoby. Inni gracze, widok z trzeciej osoby i ekwipunek się nie zmieniają.' },
      shield: { title: 'Niższa tarcza', text: 'Tarcza jest niżej na ekranie w widoku z pierwszej osoby, także przy blokowaniu.' },
      lowRes: { title: 'Tekstury 8×', text: 'Tekstury bloków (i przedmiotów, jeśli chcesz) w 8 × 8 pikseli: płaski, czysty wygląd i mniej pamięci wideo. Działa przy eksporcie.' },
      still: { title: 'Bez animacji', text: 'Woda, lawa, ogień, portale i inne animowane tekstury stoją w miejscu. Działa przy eksporcie.' },
    },
    support: {
      java: 'Java (każda wersja)',
      javaBedrock: 'Java (każda wersja) i Bedrock',
      models: 'Java 1.8 i nowsza',
      shield: 'Java 1.9 i nowsza',
    },
    unsupported: {
      bedrockFire: 'Nie w Bedrocku: Bedrock rysuje ogień na ekranie po swojemu i paczka tekstur nie obniży go niezawodnie.',
      bedrockHeld: 'Nie w Bedrocku: tam pozycję przedmiotów w ręce ustawiają pliki attachable (jak w dodatkach), których ten edytor nie robi.',
      bedrockAnimations: 'Nie w Bedrocku: Bedrock odtwarza animowane tekstury z listy klatek, której paczka nie może zabrać.',
      noModels: 'Wymaga Javy 1.8 albo nowszej: starsze wersje nie mają plików modeli do zmiany.',
      noShield: 'Tarcze doszły w Javie 1.9.',
    },
    options: {
      height: 'Wysokość',
      low: 'Nisko',
      lower: 'Niżej',
      lowest: 'Najniżej',
      keepBlocks: 'Zostaw bloki ognia bez zmian',
      keepBlocksHint: 'Bloki ognia dostają kopię starej tekstury, więc niżej jest tylko ogień na ekranie i na płonących graczach.',
      glass: 'Środek',
      clear: 'Czyste',
      tint: 'Lekko zabarwione',
      design: 'Wzór',
      designs: { dot: 'Kropka', cross: 'Mały krzyżyk', gap: 'Krzyżyk z przerwą', circle: 'Kółko', x: 'X' },
      drawOwn: 'Narysuj własny',
      size: 'Rozmiar',
      small: 'Mały',
      smaller: 'Mniejszy',
      tiny: 'Malutki',
      weapons: 'Które',
      swords: 'Miecze',
      allWeapons: 'Cała broń',
      allWeaponsHint: 'Miecze, siekiery, buzdygan i włócznie, o ile ta wersja je ma.',
      textures: 'Tekstury',
      blocks: 'Bloki',
      blocksItems: 'Bloki i przedmioty',
    },
    draw: {
      sheet: 'Celownik to kwadrat 16 × 16 w lewym górnym rogu, teraz zaznaczony. Maluj w nim.',
      sprite: 'To jest celownik. Maluj go na biało: gra odwraca jego kolory na tym, co jest za nim.',
    },
    toasts: {
      on: '{name}: włączone',
      updated: '{name}: zmienione',
      off: '{name}: wyłączone',
      kept: '{count, plural, one {Zachowano # plik, który od tamtej pory zmieniono.} few {Zachowano # pliki, które od tamtej pory zmieniono.} many {Zachowano # plików, które od tamtej pory zmieniono.} other {Zachowano # pliku, które od tamtej pory zmieniono.}}',
      undo: 'Cofnij',
      undone: 'Cofnięto',
      failed: 'Nie udało się zmienić: {name} ({error})',
    },
    mods: {
      title: 'To wymaga moda, nie paczki',
      text: 'Zoom, licznik FPS, podgląd klawiszy, przełączanie sprintu, brak mgły, rozmycie ruchu i duże przyrosty FPS (mniej rysowanych chunków, bytów i cząsteczek) dają mody, takie jak OptiFine albo Sodium, klienty PvP albo Ustawienia graficzne gry. Paczka tekstur tego nie zmieni.',
    },
    stale: 'Zrobione dla {version}: ta wersja może inaczej nazywać pliki. Zapisz je jeszcze raz dla tej wersji.',
    update: 'Zaktualizuj',
    guide: 'Jak zrobić paczkę tekstur PvP',
  },
};

export default PL;
