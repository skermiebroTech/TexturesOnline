// Polish guides (see GuideText in src/tools/guides/content.ts). Facts come from the app data
// (src/app/content/facts.ts), menu names from the Polish game files (./game-ui.ts). Buttons of the
// site's own editors are quoted as the Polish editors will name them.

import { el, type Child, type ElNode } from '../../app/markup';
import { anchor, callout, code, ext, figure, folderTable, gameMessage, link, steps, strong, tabbed, toolCallout, uiPath } from '../../app/content/blocks';
import { F, LATEST, MIN_ENGINE, NEXT_SNAPSHOT, formatGroups, formatParts, maxFormat, mcmetaFor, mcmetaLegacy, mcmetaRange, minFormat } from '../../app/content/facts';
import type { GuideText, GuidesIndexText } from '../../tools/guides/content';
import { SHOTS } from './shots';
import { UI_PL } from './ui';
import { BEDROCK, IRIS, JAVA, LAUNCHER, OPTIFINE } from './game-ui';
import { SKIN_PACK_LANG, SKIN_PACK_MANIFEST, SKIN_PACK_SKINS_JSON, SKIN_PACK_TREE } from '../../tools/guides/skin-pack-files';
import { MODEL_BLOCK_EXAMPLE, MODEL_FILES, MODEL_FLAT_DEFINITION, MODEL_SPRITE_CUBE, MODEL_STONE_BLOCKSTATE } from '../../tools/guides/model-files';
import { PVP_EXAMPLE_FILES, PVP_SWORD_189, PVP_SWORD_LATEST } from '../../tools/guides/pvp-files';
import { PBR_MANIFEST, PBR_TEXTURE_SET, PBR_UNIFORM_SET } from '../../tools/guides/pbr-files';
import { NAMES_CIT, NAMES_DEFINITION, NAMES_MODEL } from '../../tools/guides/names-files';
import { ANIM_FLIPBOOK, ANIM_MCMETA, ANIM_MCMETA_WIDE } from '../../tools/guides/anim-files';

const p = (...c: Child[]): ElNode => el('p', null, ...c);
const ul = (items: Child[]): ElNode => el('ul', { class: 'guide-list' }, items.map((i) => el('li', null, i)));
const pre = (text: string): ElNode => el('pre', { class: 'guide-code' }, el('code', null, text));
const h3 = (text: string): ElNode => el('h3', { class: 'guide-sub' }, text);
const table = (head: string[], rows: Child[][], cls = 'guide-table'): ElNode =>
  el(
    'div',
    { class: 'table-scroll' },
    el(
      'table',
      { class: cls },
      el('thead', null, el('tr', null, head.map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', null, rows.map((r) => el('tr', null, r.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, c) : el('td', null, c)))))),
    ),
  );
const FOLDER = UI_PL.folderTable;

export const GUIDES_INDEX: GuidesIndexText = {
  eyebrow: 'Poradniki',
  title: 'Poradniki o paczkach, skinach i shaderach do Minecrafta',
  lead: 'Jasne, sprawdzone odpowiedzi dla twórców Minecrafta: jak robić i instalować paczki tekstur, skiny i shadery do Javy i Bedrocka i jakiego formatu paczki potrzebuje każda wersja Javy.',
  more: ['Szukasz instrukcji instalacji krok po kroku dla każdej platformy? Zajrzyj do strony ', link('/help', 'Instalacja i pytania'), '.'],
};

// ---------------------------------------------------------------- shared steps

const MAKE_PACK_STEPS: Child[] = [
  ['Otwórz ', link('/textures', 'edytor paczek tekstur'), ', nazwij paczkę i wybierz Javę albo Bedrocka, swoją wersję gry i rozdzielczość. Potem kliknij ', strong('Utwórz paczkę'), '.'],
  'Znajdź teksturę przez wyszukiwarkę albo kategorie i przemaluj ją w edytorze pikseli albo wgraj własny PNG.',
  'Jeśli chcesz: zmień styl całej paczki efektami jednym kliknięciem, na przykład Dark Mode, Pastel albo Retro 8-bit.',
  ['Otwórz zakładkę ', strong('Paczka'), ', żeby ustawić opis i ikonę, a potem wyeksportuj ', code('.zip'), ' (Java) albo ', code('.mcpack'), ' (Bedrock).'],
  ['Zainstaluj paczkę w Minecrafcie i ją przetestuj. ', link('/guides/install-resource-packs', 'Jak ją zainstalować'), '.'],
];

const INSTALL_JAVA_STEPS: Child[] = [
  ['Uruchom Minecraft Java Edition i otwórz ', uiPath(JAVA.options, JAVA.packs), '.'],
  ['Kliknij ', uiPath(JAVA.openFolder), '. Otworzy się folder ', code('resourcepacks'), '.'],
  ['Wrzuć ', code('.zip'), ` paczki do tego folderu (nie rozpakowuj go). Możesz też przeciągnąć plik na ekran „${JAVA.packsScreen}”.`],
  ['Przenieś paczkę strzałką z ', strong(JAVA.available), ' do ', strong(JAVA.selected), ' i, jeśli używasz kilku paczek, ustaw ją na samej górze. Kliknij ', strong(JAVA.done), '.'],
];

const SKIN_STEPS: Child[] = [
  ['Otwórz ', link('/skins', 'edytor skinów'), ' i wybierz punkt startowy: pustego skina, kolorowy szablon, postać startową, PNG, który już masz, skina gracza Javy po nicku albo jeden z domyślnych skinów.'],
  'Wybierz kształt rąk: szerokie (4 piksele) albo wąskie (3 piksele).',
  'Maluj na szablonie 64×64 albo przełącz na 3D i maluj prosto na modelu. Ukrywaj części ciała, żeby dostać się do ścian pod spodem. Odbiciem lustrzanym malujesz obie ręce albo nogi naraz, a gotowe części możesz zablokować.',
  'Daj skinowi głębię warstwą zewnętrzną: kapelusze, włosy, kurtki, rękawy i nogawki leżą trochę nad ciałem.',
  ['Wyeksportuj ', code('.png'), ' do Javy (plus kopię 64×32 dla 1.7.10 i starszych) albo paczkę skinów ', code('.mcpack'), ' do Bedrocka.'],
  `Wgraj go: w Minecraft Launcherze (Java) albo otwierając .mcpack i wybierając skina w menu „${BEDROCK.dressingRoom}” (Bedrock).`,
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Otwórz ', link('/shaders', 'kreator shaderów'), ' i wybierz ', strong('czystą Javę'), '.'],
  `Wybierz dokładnie tę wersję Minecrafta, w którą grasz (Java 1.17 albo nowsza; domyślnie ${LATEST}).`,
  'Zacznij od presetu i ustaw jasność, kontrast, kolor, winietę i mgłę, a podgląd będzie się aktualizował.',
  ['Wyeksportuj ', code('.zip'), ' i zainstaluj go jak każdą paczkę zasobów: ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), '.'],
];

// ---------------------------------------------------------------- guides

const makeATexturePack: GuideText = {
  image: SHOTS.editor,
  intro: [
    p(
      'Paczka tekstur do Minecrafta (texture pack) zastępuje obrazki z gry (bloki, przedmioty, moby, niebo i menu) twoimi własnymi. Java Edition nazywa paczki tekstur ',
      el('em', null, 'paczkami zasobów'),
      ': to ',
      code('.zip'),
      ' z plikiem ',
      code('pack.mcmeta'),
      ' i obrazkami PNG pod tymi samymi ścieżkami co oryginały. Bedrock używa plików ',
      code('.mcpack'),
      ' z plikiem ',
      code('manifest.json'),
      '. Jedno i drugie zrobisz w kilka minut w przeglądarce.',
    ),
  ],
  quick: {
    title: 'W skrócie',
    items: ['Wybierz Javę albo Bedrocka i wersję, w którą grasz.', 'Przemaluj tekstury, wgraj własne obrazki albo użyj efektu jednym kliknięciem.', 'Wyeksportuj paczkę i wrzuć ją do Minecrafta.'],
  },
  howto: { name: 'Jak zrobić paczkę tekstur do Minecrafta w Texture Pack Maker', steps: MAKE_PACK_STEPS },
  sections: [
    {
      id: 'step-1',
      title: 'Krok 1 – utwórz paczkę i wybierz wersję',
      body: [
        p(MAKE_PACK_STEPS[0]),
        ul([
          [strong('Edycja: '), 'Java Edition (PC, Mac i Linux przez Minecraft Launcher) albo Bedrock Edition (Windows, telefony, tablety i konsole). Każda potrzebuje innych plików, więc zrób osobny projekt dla każdej edycji. ', link('/guides/java-vs-bedrock-packs', 'Którą mam?')],
          [strong('Wersja: '), `domyślnie wybrana jest Java ${LATEST}; działa każda wersja aż do 1.6.1, więc paczkę do 1.21.11, 26.2 albo 1.8.9 zrobisz równie szybko. Paczka dostaje pasujący `, code('pack.mcmeta'), ' dla tej wersji.'],
          [strong('Rozdzielczość: '), '16× to wygląd zwykłej gry (16×16 pikseli na ścianę bloku). 32× i 64× dają miejsce na więcej szczegółów; 128× i więcej to rozdzielczości dla realistycznych paczek.'],
        ]),
        p('Potem twoja przeglądarka pobiera oryginalne tekstury tej wersji prosto od Mojang i trzyma je na twoim urządzeniu, żeby następna paczka startowała od razu.'),
        figure(SHOTS.newPack),
      ],
    },
    {
      id: 'step-2',
      title: 'Krok 2 – znajdź tekstury i je przemaluj',
      body: [
        p(MAKE_PACK_STEPS[1]),
        p(
          'Każda tekstura jest pokazana na swoim prawdziwym modelu 3D: piec pokazuje przód, boki i górę, schody i płyty swój kształt, a moby swoje części ciała. Maluj ołówkiem, wypełnianiem, linią, kształtami, szumem i wyborem koloru, odbijaj swoje kreski i cofaj wszystko. Podgląd kafelków pokazuje, jak blok powtarza się na ziemi, żeby nie było widać krawędzi.',
        ),
        p(
          'Wolisz widzieć blok podczas malowania? Przełącz edytor na ',
          strong('3D'),
          ' (albo naciśnij D) i maluj prosto na modelu: każda ściana maluje teksturę, którą pokazuje. Przeciągnij tło albo użyj dwóch palców, żeby obrócić blok. Tekstury mobów działają tak samo: wybierz moby na liście tekstur i ukrywaj części ciała, żeby dostać się do ścian pod spodem.',
        ),
        p(
          'W Javie możesz też zmieniać kształty: w zakładce Preview naciśnij ',
          strong('Edytuj kształt'),
          ', żeby zrobić z płaskiego przedmiotu przedmiot 3D albo zmienić kształt bloku. ',
          link('/guides/make-3d-items-texture-pack', 'Jak zrobić przedmioty 3D'),
          '.',
        ),
        p('Paczka do PvP albo na więcej FPS? Przy tworzeniu wybierz ', strong('Paczka PvP / FPS'), ', a edytor sam włączy niski ogień, czyste szkło, czystszy celownik i mniejsze miecze. ', link('/guides/make-a-pvp-texture-pack', 'Jak zrobić paczkę PvP'), '.'),
        ul([
          'Zacznij od bloków, które widzisz cały czas: trawy, ziemi, kamienia, pni i desek.',
          'Trawa, liście, pnącza i woda są zapisane na szaro, a gra koloruje je zależnie od biomu. Zostaw je jasnoszare.',
          'Animowane tekstury, takie jak woda, lawa i latarnie morskie, edytujesz klatka po klatce.',
        ]),
        figure(SHOTS.editor),
      ],
    },
    {
      id: 'step-3',
      title: 'Krok 3 – zmień styl całej paczki jednym kliknięciem (jeśli chcesz)',
      body: [
        p(MAKE_PACK_STEPS[2]),
        p('Efekty nakładają się na siebie i na twoje malowanie, nie zmieniając go, i przy eksporcie trafiają do każdej tekstury. Połącz Autumn ze Smooth HD albo Dark Mode z Neon Outline i maluj dalej ręcznie.'),
        figure(SHOTS.effects),
      ],
    },
    {
      id: 'step-4',
      title: 'Krok 4 – dodaj ikonę i opis, potem wyeksportuj',
      body: [
        p(MAKE_PACK_STEPS[3]),
        p(
          `W Javie możesz też wybrać zakres zgodności, żeby paczka wczytywała się w kilku wersjach bez ostrzeżenia „${JAVA.madeForOlder}”. Eksport zapisuje każdy plik, którego potrzebuje gra: `,
          code('pack.mcmeta'),
          ' i ',
          code('pack.png'),
          ' w Javie albo ',
          code('manifest.json'),
          ' ze świeżymi, unikalnymi identyfikatorami i ',
          code('pack_icon.png'),
          ' w Bedrocku.',
        ),
        figure(SHOTS.packSettings),
        figure(SHOTS.export),
      ],
    },
    {
      id: 'step-5',
      title: 'Krok 5 – zainstaluj i przetestuj',
      body: [
        p(MAKE_PACK_STEPS[4]),
        ul([
          ['Java: otwórz ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), ', wrzuć tam ', code('.zip'), ' (nie rozpakowuj) i przenieś paczkę do ', strong(JAVA.selected), '. Po zmianach naciśnij w grze F3 + T, żeby przeładować zasoby.'],
          ['Bedrock: otwórz ', code('.mcpack'), ' i aktywuj go w ', uiPath(BEDROCK.settings, BEDROCK.globalResources), '.'],
        ]),
        p('Coś wygląda źle? ', link('/guides/texture-pack-not-working', 'Paczka tekstur nie działa: rozwiązania'), '.'),
      ],
    },
    {
      id: 'inside',
      title: 'Co jest w paczce tekstur?',
      body: [
        h3('Java Edition (.zip)'),
        ul([
          [code('pack.mcmeta'), ' w głównym folderze zipa (wymagany): opis paczki i wersje gry, dla których jest zrobiona.'],
          [code('pack.png'), ' (opcjonalny): ikona na liście paczek. Ta z Minecrafta ma 128×128 i jest pokazywana w rozmiarze 32×32.'],
          [code('assets/minecraft/textures/…'), ': twoje obrazki, z tymi samymi folderami i nazwami plików co oryginały, na przykład ', code('assets/minecraft/textures/block/stone.png'), '. Wersje przed 1.13 używają folderów ', code('blocks'), ' i ', code('items'), ' zamiast ', code('block'), ' i ', code('item'), '.'],
          ['Animowane tekstury mają obok obrazka pasujący plik ', code('.png.mcmeta'), '.'],
        ]),
        h3('Bedrock Edition (.mcpack)'),
        ul([
          [code('manifest.json'), ' w głównym folderze (wymagany): nazwa, dwa unikalne identyfikatory, numer wersji, który rośnie z każdą aktualizacją, i najstarsza obsługiwana wersja gry (tutaj domyślnie ', code(`"min_engine_version": ${MIN_ENGINE}`), ').'],
          [code('pack_icon.png'), ' (opcjonalny): ikona paczki.'],
          ['Tekstury w ', code('textures/'), ', na przykład ', code('textures/blocks/stone.png'), '. Niektóre tekstury z gry to pliki ', code('.tga'), '; zachowaj nazwę i rozszerzenie oryginału.'],
        ]),
        callout('tip', 'Nazwy plików są ważne', 'Minecraft zastępuje teksturę tylko wtedy, gdy twój plik ma dokładnie taką samą ścieżkę jak oryginał. W Javie ścieżki muszą być pisane małymi literami (a-z, 0-9, _ - . i /). Texture Pack Maker robi to za ciebie.'),
        h3('Porównanie struktury folderów'),
        pre(
          [
            'Java: MyPack.zip',
            '├── pack.mcmeta',
            '├── pack.png',
            '└── assets/minecraft/textures/',
            '    ├── block/stone.png',
            '    └── item/diamond_sword.png',
            '',
            'Bedrock: MyPack.mcpack',
            '├── manifest.json',
            '├── pack_icon.png',
            '└── textures/',
            '    ├── blocks/stone.png',
            '    └── items/diamond_sword.png',
          ].join('\n'),
        ),
        table(
          ['', 'Java pack.mcmeta', 'Bedrock manifest.json'],
          [
            ['Wymagany', 'Tak, na samej górze zipa', 'Tak, na samej górze .mcpack'],
            ['Rozpoznaje paczkę po', 'Nazwie pliku albo folderu', 'Dwóch unikalnych identyfikatorach (UUID)'],
            ['Wersja gry', `Numery formatu paczki (${LATEST} używa ${F(LATEST)})`, [code('min_engine_version'), ', najstarsza obsługiwana wersja gry']],
            ['Aktualizacje', 'Podmień plik', 'Podnieś numer wersji, zachowaj identyfikatory'],
          ],
        ),
      ],
    },
    {
      id: 'mcmeta',
      title: 'Plik pack.mcmeta (Java)',
      body: [
        p('Ten plik mówi Minecraftowi, dla których wersji jest paczka. Numer formatu zmienia się prawie z każdą aktualizacją: Java ', LATEST, ' używa formatu paczki zasobów ', strong(F(LATEST)), '. Paczka tylko dla ', LATEST, ' wygląda tak:'),
        pre(mcmetaFor(LATEST, `Moja paczka do Minecrafta ${LATEST}`)),
        p(
          'Od 1.21.9 paczki podają zakres przez ',
          code('min_format'),
          ' i ',
          code('max_format'),
          '. Paczka, która ma się wczytywać także w starszych wersjach, potrzebuje do tego ',
          code('pack_format'),
          ' i ',
          code('supported_formats'),
          '. Texture Pack Maker zapisuje właściwe połączenie dla wersji i zakresu, które wybierzesz. Zobacz ',
          link('/guides/minecraft-pack-format-versions', 'format paczki każdej wersji'),
          '.',
        ),
        callout('warn', 'Brakuje opisu?', `W Javie ${LATEST} paczka, której pack.mcmeta nie ma opisu albo nie jest poprawnym JSON-em, w ogóle się nie pokazuje. Trzymaj pack.mcmeta na najwyższym poziomie zipa, nie w folderze.`),
      ],
    },
    {
      id: 'by-hand',
      title: 'Jak zrobić paczkę tekstur ręcznie',
      body: [
        p('Paczkę możesz też zbudować sam w dowolnym programie graficznym. Trwa to dłużej, ale pokazuje, jak działa paczka:'),
        h3('Java Edition'),
        steps([
          ['Znajdź oryginalne tekstury: skopiuj ', code('versions/<version>/<version>.jar'), ' ze swojego folderu ', code('.minecraft'), ', zmień rozszerzenie kopii na ', code('.zip'), ' i ją otwórz. Obrazki są w ', code('assets/minecraft/textures'), '.'],
          ['Zrób nowy folder dla swojej paczki, z plikiem ', code('pack.mcmeta'), ' (zobacz niżej) i tymi samymi folderami ', code('assets/minecraft/textures/…'), ' co oryginały.'],
          'Skopiuj tam tylko pliki PNG, które chcesz zmienić, i je edytuj – zachowaj nazwy, a rozmiary w tych samych proporcjach (16×16, 32×32 i tak dalej).',
          ['Spakuj do zipa ', strong('zawartość'), ' folderu, a nie sam folder, żeby ', code('pack.mcmeta'), ' leżał na samej górze zipa. Wrzuć zipa do ', code('resourcepacks'), '.'],
        ]),
        h3('Bedrock Edition'),
        steps([
          ['Pobierz oryginalne tekstury z repozytorium Mojang ', ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'), ' (', code('resource_pack/textures'), ').'],
          ['Zrób folder z plikiem ', code('manifest.json'), ', który ma dwa nowe, unikalne identyfikatory (UUID), i swoimi zmienionymi obrazkami w ', code('textures/'), '.'],
          ['Spakuj zawartość folderu do zipa i zmień rozszerzenie pliku z ', code('.zip'), ' na ', code('.mcpack'), '. Potem otwórz go, żeby zaimportować.'],
        ]),
        callout('tip', 'Oszczędź sobie żmudnej roboty', 'Texture Pack Maker robi za ciebie kopiowanie, nazwy folderów, pack.mcmeta, UUID i pakowanie do zipa, a każdą teksturę pokazuje podczas malowania na jej modelu 3D.'),
      ],
    },
    {
      id: 'tips',
      title: 'Wskazówki na dobrą paczkę',
      body: [
        ul([
          'Zacznij od małego: przemaluj kilka bloków, które widzisz cały czas (trawę, ziemię, kamień, drewno), i sprawdź je w grze, zanim zrobisz wszystko.',
          'Trzymaj w całej paczce tę samą rozdzielczość. Pomieszane tekstury 16× i 64× wyglądają niespójnie.',
          'Sprawdzaj w podglądzie 3D bloku, jak ściany bloku do siebie pasują.',
          'Używaj podglądu kafelków dla bloków, które się powtarzają, żeby nie było widać krawędzi.',
          `Ustaw swoją paczkę na samej górze listy „${JAVA.selected}”. Paczki wyżej na liście wygrywają.`,
        ]),
      ],
    },
  ],
  faq: [
    {
      id: 'both',
      q: 'Czy paczka tekstur działa w Javie i w Bedrocku?',
      a: [p('Nie. Obie edycje używają innych plików i folderów. Zrób paczkę dla jednej edycji, a potem zamień ją na drugą ', link('/texture-pack-converter', 'konwerterem paczek tekstur'), '. ', link('/guides/java-vs-bedrock-packs', 'Paczki Java a Bedrock'), '.')],
    },
    {
      id: 'free',
      q: 'Muszę instalować jakiś program?',
      a: [p('Nie. Texture Pack Maker działa w przeglądarce na komputerze, telefonie i tablecie, i nic nie jest wysyłane.')],
    },
    {
      id: 'edit',
      q: 'Mogę zmienić gotową paczkę tekstur?',
      a: [p('Tak. W Texture Pack Maker wybierz ', strong('Otwórz paczkę'), ' i wskaż ', code('.zip'), ' albo ', code('.mcpack'), '. Możesz pracować nad nią dalej i wyeksportować ją jeszcze raz.'), figure(SHOTS.openPack)],
    },
    {
      id: 'code',
      q: 'Muszę umieć programować, żeby zrobić paczkę tekstur?',
      a: [p('Nie. Paczka tekstur to obrazki i mały plik z opisem, a ten plik Texture Pack Maker pisze za ciebie. Musisz tylko malować.')],
    },
    {
      id: 'older',
      q: 'Jak zrobić paczkę tekstur do starszej wersji, na przykład 1.21.11 albo 1.8.9?',
      a: [p('Wybierz tę wersję przy tworzeniu paczki. Kreator wczyta tekstury i nazwy folderów dokładnie tej wersji i zapisze jej format paczki. ', link('/guides/minecraft-pack-format-versions', 'Formaty paczek wszystkich wersji'), '.')],
    },
    {
      id: 'originals',
      q: 'Gdzie znajdę oryginalne tekstury Minecrafta?',
      a: [p('W Javie w pliku ', code('.jar'), ' gry (', code('assets/minecraft/textures'), '), w Bedrocku w repozytorium Mojang bedrock-samples. Texture Pack Maker pobiera je za ciebie od Mojang, kiedy wybierasz wersję.')],
    },
    {
      id: 'mobile',
      q: 'Mogę zrobić paczkę tekstur na telefonie?',
      a: [p('Tak. Texture Pack Maker działa w przeglądarce na Androidzie, iPhonie i iPadzie tak samo jak na komputerach i Chromebookach. W Bedrocku otwórz wyeksportowany ', code('.mcpack'), ', a Minecraft go zaimportuje.')],
    },
    {
      id: 'time',
      q: 'Ile trwa zrobienie paczki tekstur?',
      a: [p('Kilka minut, jeśli to mała paczka, która zmienia kilka bloków, albo efekt typu Dark Mode na całej paczce. Paczka w całości malowana ręcznie, z setkami tekstur, może zająć tygodnie; eksportować i testować możesz w każdej chwili po drodze.')],
    },
    {
      id: 'hd',
      q: 'Jaką rozdzielczość powinna mieć moja paczka tekstur?',
      a: [p('16× to rozdzielczość zwykłej gry i najszybciej się ją maluje. 32× i 64× dają miejsce na więcej szczegółów; 128× i więcej to rozdzielczości dla realistycznych paczek i wymagają mocniejszego komputera. Trzymaj w całej paczce jedną rozdzielczość.')],
    },
  ],
  ctaLabel: 'Otwórz edytor paczek tekstur',
};

const notWorking: GuideText = {
  image: SHOTS.packSettings,
  intro: [
    p(
      'Większość problemów z paczkami tekstur ma trzy przyczyny: plik z opisem paczki (',
      code('pack.mcmeta'),
      ' w Javie, ',
      code('manifest.json'),
      ' w Bedrocku) nie istnieje albo leży w złym miejscu, paczka jest zrobiona dla innej wersji gry albo tekstura nie leży dokładnie pod ścieżką, której oczekuje Minecraft. Znajdź niżej to, co widzisz, i zastosuj rozwiązanie albo sprawdź ',
      anchor('error-messages', 'dokładny komunikat błędu'),
      '.',
    ),
    toolCallout('Niech Pack Doctor znajdzie problem', ['Przeciągnij paczkę do ', link('/pack-doctor', 'Pack Doctor'), ': sprawdzi każdy plik według zasad wersji, w którą grasz, wyjaśni każdy znaleziony problem, naprawi bezpieczne jednym kliknięciem i da ci naprawioną paczkę.'], { to: '/pack-doctor', label: 'Sprawdź moją paczkę', icon: 'potion' }),
  ],
  quick: {
    title: 'Najpierw sprawdź to',
    items: [
      ['Java: zip otwiera się od razu na ', code('pack.mcmeta'), ' i ', code('assets'), ', a nie na folderze.'],
      'Paczka jest zrobiona dla wersji, w którą grasz (albo jej zakres zgodności ją obejmuje).',
      `Paczka jest na liście „${JAVA.selected}” (Java) albo jest aktywna (Bedrock), nad paczkami, które zmieniają te same tekstury.`,
      'Nazwy plików i folderów są dokładnie takie jak w oryginale, w Javie pisane małymi literami.',
    ],
  },
  sections: [
    {
      id: 'not-listed',
      title: 'Paczki nie ma na liście',
      body: [
        p('Java pokazuje paczkę tylko wtedy, gdy znajdzie poprawny ', code('pack.mcmeta'), ' na najwyższym poziomie zipa albo folderu.'),
        ul([
          [strong('Folder w folderze: '), 'jeśli spakujesz do zipa sam folder paczki, wszystko leży o poziom za głęboko (', code('MyPack.zip/MyPack/pack.mcmeta'), '). Spakuj zamiast tego zawartość folderu.'],
          [strong('Zepsuty pack.mcmeta: '), `brakujący przecinek albo cudzysłów sprawia, że JSON jest niepoprawny. W Javie ${LATEST} nie pokazuje się też paczka bez opisu.`],
          [strong('Zły folder: '), 'zip musi leżeć w ', code('resourcepacks'), ', a nie w ', code('shaderpacks'), ' ani ', code('mods'), '. Właściwy otworzysz przez ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), '.'],
          [strong('Jeszcze się pobiera albo jest zablokowany: '), 'przeglądarki czasem zapisują niedokończone pliki jako ', code('.crdownload'), ' albo ', code('.part'), '. Pobierz paczkę jeszcze raz.'],
        ]),
      ],
    },
    {
      id: 'version',
      title: '„Stworzona dla starszej / nowszej wersji Minecrafta”',
      body: [
        p(
          'Java porównuje format paczki w ',
          code('pack.mcmeta'),
          ' ze swoim (',
          LATEST,
          ' używa ',
          strong(F(LATEST)),
          '). Paczka, która zmienia tylko tekstury, zwykle i tak działa, jeśli klikniesz ',
          strong(JAVA.yes),
          ', ale brakujące albo przemianowane tekstury mogą wyglądać źle. Porządne rozwiązanie: wyeksportuj paczkę jeszcze raz dla swojej wersji albo daj jej zakres zgodności, który ją obejmuje. Starej paczce, która nie jest twoja, ',
          link('/texture-pack-converter', 'konwerter paczek tekstur'),
          ' zmieni nazwy tekstur dla twojej wersji i zapisze nowy pack.mcmeta.',
        ),
        p(
          'Od 1.21.9 paczka, która ma tylko numer ',
          code('pack_format'),
          ' albo pola łamiące nowe zasady, może być pokazana jako ',
          el('em', null, JAVA.incompatible.toLowerCase()),
          '. Nowsze paczki używają ',
          code('min_format'),
          ' i ',
          code('max_format'),
          '. ',
          link('/guides/minecraft-pack-format-versions', 'Format paczki każdej wersji'),
          '.',
        ),
        figure(SHOTS.packSettings),
      ],
    },
    {
      id: 'purple',
      title: 'Fioletowo-czarne bloki',
      body: [
        p(
          'Fioletowo-czarna szachownica to „brakująca tekstura”. Model chce obrazka, którego nie ma pod tą ścieżką: plik ma zmienioną nazwę, leży w złym folderze albo paczka używa nazw folderów z innej wersji. Wersje przed 1.13 używają na przykład ',
          code('textures/blocks'),
          ' i ',
          code('textures/items'),
          ', a 1.13 i nowsze ',
          code('textures/block'),
          ' i ',
          code('textures/item'),
          '.',
        ),
        p('Jeśli dodajesz własne modele, sprawdź każdą ścieżkę tekstury w nich. Paczki z Texture Pack Maker używają dokładnie tych ścieżek, których używa wybrana wersja.'),
      ],
    },
    {
      id: 'some-textures',
      title: 'Zmieniły się tylko niektóre tekstury',
      body: [
        ul([
          [strong('Nazwa albo ścieżka różni się o jedną literę: '), 'plik musi mieć dokładnie tę samą nazwę i folder co oryginał. Java ignoruje ścieżki z wielkimi literami albo spacjami.'],
          [strong('Wygrywa inna paczka: '), 'paczki wyżej na liście zastępują te same tekstury. Przesuń swoją wyżej albo połącz paczki w jedną, w wybranej kolejności, narzędziem ', link('/merge-texture-packs', 'Łączenie paczek tekstur'), '.'],
          [strong('Zły plik dla tego bloku: '), 'niektóre bloki używają kilku obrazków (piec: przód, bok i góra; blok trawy: góra, bok i nakładka boku). Edytuj wszystkie albo sprawdź w podglądzie 3D, który obrazek gdzie trafia.'],
          [strong('Zły typ obrazka w Bedrocku: '), 'niektóre tekstury z gry w Bedrocku to pliki ', code('.tga'), '. Zachowaj nazwę i typ pliku oryginału, żeby twój plik go zastąpił.'],
        ]),
      ],
    },
    {
      id: 'grey',
      title: 'Trawa i liście są szare',
      body: [
        p(
          'W pliku z obrazkiem to normalne. Trawa, liście, pnącza, woda i kilka innych tekstur są zapisane na szaro, a gra koloruje je zależnie od biomu. Maluj je więc jasnymi odcieniami szarości i sprawdzaj w grze. Jeśli pomalujesz je na zielono, po zabarwieniu będą o wiele ciemniejsze albo dziwnie zabarwione.',
        ),
      ],
    },
    {
      id: 'animation',
      title: 'Animowana tekstura wygląda jak długi pasek',
      body: [
        p(
          'Animowane tekstury to wysoki obrazek z klatkami ułożonymi jedna nad drugą plus plik ',
          code('.png.mcmeta'),
          ' o tej samej nazwie (na przykład ',
          code('sea_lantern.png.mcmeta'),
          '). Jeśli tego pliku brakuje, Java ściska cały pasek do jednego bloku. Bedrock wymienia animowane tekstury zamiast tego w ',
          code('textures/flipbook_textures.json'),
          '. Texture Pack Maker zapisuje te pliki, kiedy edytujesz klatki animacji.',
        ),
      ],
    },
    {
      id: 'all-off',
      title: 'Wszystkie moje paczki zasobów się wyłączyły (Java)',
      body: [
        p(
          'Kiedy paczka zasobów ma shader, którego nie da się skompilować, Java wyłącza wszystkie paczki i wraca do ustawień domyślnych. Zdarza się to z paczkami shaderów bez modów zrobionymi dla innej wersji, bo Mojang często zmienia te pliki shaderów. Usuń paczkę albo wyeksportuj ją jeszcze raz dla swojej dokładnej wersji; każdy shader, który pisze ',
          link('/shaders', 'kreator shaderów'),
          ', jest wcześniej sprawdzany pod kątem błędów kompilacji.',
        ),
      ],
    },
    {
      id: 'bedrock-import',
      title: 'Bedrock: import się nie udał',
      body: [
        ul([
          [strong('Import się nie udał: '), code('manifest.json'), ' nie istnieje, jest niepoprawny albo nie leży na najwyższym poziomie pliku. Wyeksportuj paczkę jeszcze raz i otwórz nowy plik.'],
          [strong('Zduplikowana paczka: '), 'paczka z tymi samymi identyfikatorami i tym samym numerem wersji jest już zainstalowana. Podnieś wersję (Texture Pack Maker robi to przy każdym eksporcie) albo usuń starą kopię w ', uiPath(BEDROCK.settings, BEDROCK.storage), '.'],
          [strong('Zły typ pliku: '), code('.zip'), ' z Javy ze zmienioną nazwą na ', code('.mcpack'), ' nie działa; Bedrock potrzebuje własnych plików i folderów. Zamiast tego przekonwertuj go ', link('/texture-pack-converter', 'konwerterem paczek tekstur'), '.'],
          [strong('Konsola: '), 'Xbox, PlayStation i Switch w ogóle nie mogą importować plików. Dołącz do świata, Realmu albo serwera, który ma tę paczkę.'],
        ]),
      ],
    },
    {
      id: 'bedrock-nothing',
      title: 'Bedrock: zaimportowana, ale nic się nie zmienia',
      body: [
        ul([
          ['Aktywuj ją: ', uiPath(BEDROCK.settings, BEDROCK.globalResources, BEDROCK.myPacks), ', wybierz paczkę i stuknij ', strong(BEDROCK.activate), '. Dla jednego świata użyj ', uiPath(BEDROCK.editWorld, BEDROCK.packs), '.'],
          'Przesuń ją nad inne aktywne paczki, które zmieniają te same tekstury.',
          ['Jeśli paczka potrzebuje nowszej gry niż twoja, jej ', code('min_engine_version'), ' jest za wysoka: zaktualizuj Minecrafta albo wyeksportuj z niższym minimum.'],
          `Paczki do klasycznej grafiki mogą wyglądać inaczej albo zostać wyłączone przy włączonym Vibrant Visuals. Na próbę zmień „${BEDROCK.graphicsMode}”.`,
        ]),
      ],
    },
    {
      id: 'shaders',
      title: 'Paczka shaderów się nie pokazuje',
      body: [
        ul([
          ['Paczki shaderów do Irisa i OptiFine idą do folderu ', code('shaderpacks'), ', który otwierasz przez ', uiPath(JAVA.options, JAVA.video, IRIS.shaderPacks), ', a nie do ', code('resourcepacks'), '.'],
          ['Iris potrzebuje OpenGL. W Javie 26.2 i nowszych ustaw ', strong(JAVA.graphicsApi), ' na ', strong(JAVA.graphicsApiDefault), ' albo ', strong(JAVA.graphicsApiOpenGl), ', jeśli Iris mówi, że nie działa z Vulkanem.'],
          ['Paczki shaderów bez modów to paczki zasobów i działają tylko w wersji, dla której je zrobiono. ', link('/guides/make-shaders-without-mods', 'Shadery bez modów'), '.'],
        ]),
      ],
    },
    {
      id: 'error-messages',
      title: 'Komunikaty błędów słowo w słowo',
      body: [
        p(
          'To komunikaty, które Minecraft pokazuje, kiedy z paczką zasobów jest coś nie tak, skopiowane z polskich plików językowych gry (Java 26.3, Bedrock 1.26.50). Tam, gdzie gra wstawia nazwę albo liczbę, jest tu „…”. Wyszukaj na stronie (Ctrl + F) kilka słów z tego, co pokazuje twoja gra.',
        ),
        h3('Java Edition'),
        gameMessage(
          ['Niezgodna', '(Stworzona dla starszej wersji Minecrafta)'],
          'Pokazuje się na czerwono, kiedy na liście paczek zasobów najedziesz na paczkę: jej format jest starszy niż format twojej gry (po angielsku ',
          el('span', { lang: 'en' }, '“Made for an older version of Minecraft”'),
          '). Paczka z późniejszej wersji pokazuje „(Stworzona dla nowszej wersji Minecrafta)”, a od 1.21.9 paczka, której wersji gra nie umie odczytać, pokazuje „(Zepsuta lub niekompatybilna)”. ',
          strong('Rozwiązanie: '),
          'wyeksportuj paczkę jeszcze raz dla swojej wersji albo zaktualizuj starą paczkę ',
          link('/texture-pack-converter', 'konwerterem paczek tekstur'),
          '. Więcej w ',
          anchor('version', '„Stworzona dla starszej / nowszej wersji Minecrafta”'),
          '.',
        ),
        gameMessage(
          ['Czy na pewno chcesz załadować tę paczkę?', 'Ta paczka została stworzona dla starszej wersji Minecrafta i może już nie działać poprawnie.'],
          'Pojawia się, kiedy przenosisz taką paczkę do ',
          strong(JAVA.selected),
          '. Przy nowszej paczce druga linijka brzmi „Ta paczka została stworzona dla nowszej wersji Minecrafta i może już nie działać poprawnie.”, a przy zepsutej „Ta paczka jest uszkodzona lub stworzona dla nieznanej wersji Minecrafta i może nie działać poprawnie.” ',
          strong(JAVA.yes),
          ' i tak ją wczytuje; paczka, która zmienia tylko tekstury, często działa. ',
          strong('Rozwiązanie: '),
          link('/pack-doctor', 'Pack Doctor'),
          ' zapisze ',
          code('pack.mcmeta'),
          ' na nowo dla twojej wersji (',
          link('/guides/minecraft-pack-format-versions', 'format paczki każdej wersji'),
          ').',
        ),
        gameMessage(
          ['Elementy spoza paczki', 'Następujące paczki były nieprawidłowe i nie zostały przekopiowane:', '…'],
          'Po przeciągnięciu plików na ekran paczek zasobów (od 1.20.2): Minecraft nie znalazł ',
          code('pack.mcmeta'),
          ' na górze tych zipów albo folderów. Ten komunikat dostają też paczki shaderów i pliki ',
          code('.mcpack'),
          ' z Bedrocka. ',
          strong('Rozwiązanie: '),
          'zobacz ',
          anchor('not-listed', 'Paczki nie ma na liście'),
          '; ',
          link('/texture-pack-converter', 'konwerter paczek tekstur'),
          ' zamieni paczkę z Bedrocka na paczkę do Javy.',
        ),
        gameMessage(
          ['Ponowne załadowanie zasobów nie powiodło się', 'Wykryto błąd paczki zasobów'],
          'Komunikat w rogu: paczka zepsuła się przy wczytywaniu albo (z drugą linijką, od 1.21.2) w trakcie gry, często przez shader w paczce shaderów bez modów. Minecraft wyłączył wszystkie paczki zasobów i wrócił do domyślnego wyglądu. ',
          strong('Rozwiązanie: '),
          'zobacz ',
          anchor('all-off', 'Wszystkie moje paczki zasobów się wyłączyły'),
          '. ',
          code('logs/latest.log'),
          ' podaje plik, który nie zadziałał, a ',
          link('/pack-doctor', 'Pack Doctor'),
          ' znajduje zepsuty JSON i obrazki.',
        ),
        gameMessage(
          ['Nie udało się pobrać … z … pakietów'],
          'Kiedy dołączasz do serwera, który wysyła paczkę zasobów (od 1.20.3): pobieranie się nie udało. ',
          strong('Rozwiązanie: '),
          'dołącz jeszcze raz. Jeśli to twój serwer, link w ',
          code('server.properties'),
          ' musi pobierać bezpośrednio zipa (a nie stronę internetową), zip musi mieć mniej niż 250 MB, a ',
          code('resource-pack-sha1'),
          ' musi pasować do pliku albo zostać pusty.',
        ),
        h3('Bedrock Edition'),
        p(
          'Problemy z importem pokazują się na górze ekranu. Komunikaty o ',
          code('manifest.json'),
          ' (w polskiej wersji gry „manifest paczki”) trafiają do dziennika treści: otwórz ',
          uiPath(BEDROCK.settings, BEDROCK.creator),
          ' i wybierz ',
          strong(BEDROCK.contentLog),
          '.',
        ),
        gameMessage(
          ["Nieudane importowanie: '…'", 'Wykryto zduplikowaną paczkę'],
          'Paczka z tym samym UUID i wersją jest już zainstalowana, zwykle starsza kopia tej samej paczki. ',
          strong('Rozwiązanie: '),
          'podnieś wersję w ',
          code('manifest.json'),
          ' (Texture Pack Maker robi to przy każdym eksporcie) albo usuń starą kopię w ',
          uiPath(BEDROCK.settings, BEDROCK.storage),
          ' i zaimportuj jeszcze raz.',
        ),
        gameMessage(
          ["Nieudane importowanie: '…'", 'Zobacz plik dziennika, żeby dowiedzieć się więcej'],
          'Bedrock nie mógł odczytać pliku jako paczki. Druga linijka może też brzmieć „Nieprawidłowe archiwum zip”: plik nie jest zipem albo pobieranie się przerwało. ',
          strong('Rozwiązanie: '),
          'zobacz ',
          anchor('bedrock-import', 'Bedrock: import się nie udał'),
          ' i sprawdź plik w ',
          link('/pack-doctor', 'Pack Doctor'),
          '.',
        ),
        gameMessage(
          ['Nie można znaleźć manifestu w paczce.'],
          'Na górze paczki nie ma ',
          code('manifest.json'),
          ': leży o jeden folder za głęboko albo to paczka do Javy (która ma zamiast niego ',
          code('pack.mcmeta'),
          '). ',
          strong('Rozwiązanie: '),
          'spakuj zawartość folderu paczki, a nie sam folder. Paczkę do Javy zamienisz na paczkę do Bedrocka ',
          link('/texture-pack-converter', 'konwerterem paczek tekstur'),
          '.',
        ),
        gameMessage(
          ["Dostarczony element ('pack.name') ma nieprawidłową wartość w manifeście paczki. Nastąpi powrót do paczki zasobów."],
          'Część w nawiasie wstawia gra; wielu graczy widzi tam ',
          code('pack.name'),
          ' (po angielsku ',
          el('span', { lang: 'en' }, "“Provided 'pack.name' element has an invalid value in pack manifest; Defaulting to resource pack.”"),
          '). Bedrock nie rozpoznał typu paczki w ',
          code('manifest.json'),
          ' (pola ',
          code('"type"'),
          ' w ',
          code('"modules"'),
          '), więc wczytuje paczkę jako paczkę zasobów. ',
          strong('Rozwiązanie: '),
          'typ modułu paczki zasobów musi brzmieć dokładnie ',
          code('"resources"'),
          ' (paczki zachowań ',
          code('"data"'),
          ', paczki skinów ',
          code('"skin_pack"'),
          '). ',
          link('/pack-doctor', 'Pack Doctor'),
          ' to sprawdza.',
        ),
        gameMessage(
          ['Nie można sparsować manifestu paczki stosem: …'],
          code('manifest.json'),
          ' nie jest poprawnym JSON-em: brakuje przecinka albo cudzysłowu, po ostatnim elemencie jest przecinek albo jest o jeden nawias za dużo. ',
          strong('Rozwiązanie: '),
          link('/pack-doctor', 'Pack Doctor'),
          ' pokazuje linijkę z błędem i może zapisać działający manifest.',
        ),
        gameMessage(
          ["Dostarczony element UUID '…' już znajduje się w manifeście paczki."],
          'Dwa UUID się gryzą: nagłówek i moduł mają ten sam albo używa go już inna zainstalowana paczka. Każda paczka potrzebuje własnych UUID. ',
          strong('Rozwiązanie: '),
          link('/pack-doctor', 'Pack Doctor'),
          ' daje paczce nowe; stare kopie usuń w ',
          uiPath(BEDROCK.settings, BEDROCK.storage),
          '.',
        ),
        gameMessage(
          ['Brakujące treści zależne', 'Dla tego pakietu brak pewnych treści zależnych. Czy mimo to chcesz go użyć?'],
          'Pojawia się, kiedy aktywujesz paczkę, której ',
          code('manifest.json'),
          ' wymienia w ',
          code('"dependencies"'),
          " inne paczki, które nie są zainstalowane, zwykle drugą połowę dodatku. Dziennik treści je podaje: „Brakująca zależność: ID '…', wersja '…'.” ",
          strong('Rozwiązanie: '),
          'zaimportuj też pasującą paczkę zachowań albo zasobów. Sama paczka tekstur nie potrzebuje żadnych zależności.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'why-red',
      q: 'Dlaczego moja paczka tekstur jest czerwona na liście paczek zasobów?',
      a: [p('Czerwony kolor znaczy, że format paczki nie pasuje do twojej wersji gry. Paczka może i tak działać; dla pewności wyeksportuj ją jeszcze raz dla swojej wersji.')],
    },
    {
      id: 'reload',
      q: 'Muszę uruchamiać Minecrafta od nowa po zmianie paczki?',
      a: [p('Nie. W Javie naciśnij F3 + T, żeby przeładować paczki zasobów, albo wyłącz i włącz paczkę. W Bedrocku wyjdź ze świata i wejdź do niego jeszcze raz.')],
    },
    {
      id: 'server',
      q: 'Dlaczego serwer zmienia moje tekstury?',
      a: [p('Serwery mogą wysyłać własną paczkę zasobów, która leży nad twoją. Możesz ją odrzucić w ustawieniach serwera na ekranie gry wieloosobowej, ale niektóre serwery jej wymagają.')],
    },
    {
      id: 'pack-name-error',
      q: "Co znaczy komunikat „Dostarczony element ('pack.name') ma nieprawidłową wartość w manifeście paczki”?",
      a: [
        p(
          'Bedrock nie rozpoznał typu paczki w ',
          code('manifest.json'),
          ' i zamiast tego wczytuje paczkę jako paczkę zasobów („Nastąpi powrót do paczki zasobów.”). W paczce tekstur ustaw ',
          code('"type"'),
          ' modułu na ',
          code('"resources"'),
          '; ',
          link('/pack-doctor', 'Pack Doctor'),
          ' sprawdza manifest.',
        ),
      ],
    },
  ],
  ctaLabel: 'Napraw moją paczkę w Pack Doctor',
};

const install: GuideText = {
  intro: [
    p(
      'W ',
      strong('Javie'),
      ' wrzucasz ',
      code('.zip'),
      ' paczki do folderu ',
      code('resourcepacks'),
      ` i włączasz ją w „${JAVA.options} › ${JAVA.packs}”. W `,
      strong('Bedrocku'),
      ' otwierasz plik ',
      code('.mcpack'),
      `, Minecraft go importuje, a ty aktywujesz go w „${BEDROCK.settings} › ${BEDROCK.globalResources}”. Paczki shaderów do Javy potrzebują Irisa albo OptiFine.`,
    ),
  ],
  quick: {
    title: 'Szybka odpowiedź',
    items: [
      ['Java: ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), ', wrzuć ', code('.zip'), `, przenieś paczkę do „${JAVA.selected}” i kliknij „${JAVA.done}”.`],
      ['Bedrock: otwórz plik ', code('.mcpack'), ' i aktywuj go w ', uiPath(BEDROCK.settings, BEDROCK.globalResources), '.'],
      ['Shadery (Java): zainstaluj Irisa albo OptiFine i wrzuć zipa z shaderami do folderu ', code('shaderpacks'), '.'],
    ],
  },
  howto: { name: 'Jak zainstalować paczkę zasobów w Minecraft Java Edition', steps: INSTALL_JAVA_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Instalacja paczki zasobów w Javie',
      body: [steps(INSTALL_JAVA_STEPS), h3('Gdzie jest folder resourcepacks?'), folderTable('resourcepacks', FOLDER)],
    },
    {
      id: 'order',
      title: 'Kilka paczek naraz',
      body: [
        p(
          'Możesz włączyć tyle paczek, ile chcesz. Kiedy dwie paczki zmieniają tę samą teksturę, wygrywa ta, która jest wyżej na liście ',
          strong(JAVA.selected),
          ' (Java) albo na liście aktywnych paczek (Bedrock), a wszystko, czego ona nie zmienia, pochodzi z paczek pod nią. Typowy zestaw to mała paczka z twoimi poprawkami na samej górze i pełna paczka pod nią.',
        ),
        p('Żeby zrobić z takiego stosu jedną paczkę, na przykład żeby się nią podzielić albo dla serwera, który może wysłać tylko jedną paczkę zasobów, użyj narzędzia ', link('/merge-texture-packs', 'Łączenie paczek tekstur'), ': działa tam ta sama zasada, wygrywa paczka na górze listy.'),
        p('Launchery innych firm, takie jak Lunar Client i Badlion Client, domyślnie używają tego samego folderu ', code('resourcepacks'), ' w ', code('.minecraft'), ' i mają własne menu paczek zasobów do włączania paczek.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Instalacja pliku .mcpack w Bedrocku',
      body: [
        tabbed(
          'install-bedrock',
          [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  ['Kliknij dwukrotnie ', code('.mcpack'), '. Minecraft się otworzy i pokaże ', el('em', null, BEDROCK.importStarted), ', a potem ', el('em', null, `${BEDROCK.imported}: …`), '.'],
                  ['Przejdź do ', uiPath(BEDROCK.settings, BEDROCK.globalResources, BEDROCK.myPacks), ', wybierz paczkę i stuknij ', strong(BEDROCK.activate), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android i iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Pobierz ', code('.mcpack'), ' na telefon albo tablet.'],
                  [strong('Android: '), 'otwórz go w pobranych plikach albo aplikacji Pliki i wybierz Minecrafta. ', strong('iPhone / iPad: '), 'stuknij go w aplikacji Pliki, a potem ', uiPath('Udostępnij', 'Minecraft'), '.'],
                  ['Aktywuj go w ', uiPath(BEDROCK.settings, BEDROCK.globalResources), '.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Konsole',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation i Switch nie mogą importować plików. Dodaj paczkę do świata na PC albo telefonie i dołącz do tego świata albo graj na Realmie lub serwerze, który ją ma.')],
            },
          ],
          UI_PL.platform,
        ),
        callout('tip', 'Tylko jeden świat?', 'Otwórz ', uiPath(BEDROCK.editWorld, BEDROCK.packs), ` i aktywuj paczkę tam zamiast w „${BEDROCK.globalResources}”.`),
      ],
    },
    {
      id: 'shaders',
      title: 'Instalacja paczki shaderów',
      body: [
        ul([
          [strong('Iris (Java):'), ' zainstaluj Irisa instalatorem z ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ', uruchom grę raz z profilem Irisa, potem otwórz ', uiPath(JAVA.options, JAVA.video, IRIS.shaderPacks), ', kliknij ', strong(IRIS.openFolder), ' i wrzuć tam zipa.'],
          [strong('OptiFine (Java):'), ' ', uiPath(JAVA.options, JAVA.video, OPTIFINE.shaders), ', a potem ', strong(OPTIFINE.folder), '.'],
          [strong('Shadery bez modów (Java):'), ' to paczki zasobów. Instalujesz je jak każdą inną paczkę w folderze ', code('resourcepacks'), '.'],
          [strong('Vibrant Visuals (Bedrock):'), ' otwórz ', code('.mcpack'), ', aktywuj go, a potem w ', uiPath(BEDROCK.settings, BEDROCK.video, BEDROCK.graphicsMode), ` wybierz „${BEDROCK.vibrantVisuals}” (Vibrant Visuals).`],
        ]),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    {
      id: 'skins',
      title: 'Instalacja skina',
      body: [
        ul([
          [strong('Java:'), ` Minecraft Launcher › ${LAUNCHER.skins} › ${LAUNCHER.newSkin}, wybierz „${LAUNCHER.classic}” albo „${LAUNCHER.slim}”, wskaż PNG i kliknij „${LAUNCHER.saveAndUse}”. Albo wgraj go w swoim profilu na minecraft.net.`],
          [strong('Bedrock:'), ' otwórz paczkę skinów jako ', code('.mcpack'), ` i wybierz skina w „${BEDROCK.dressingRoom} › ${BEDROCK.classicSkins}” albo zaimportuj tam pojedynczy PNG.`],
        ]),
        p('Więcej w poradniku ', link('/guides/make-a-skin', 'Jak zrobić własnego skina do Minecrafta'), '.'),
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Paczka nie działa?',
      body: [
        p('Najczęstsze problemy są niżej. ', link('/guides/texture-pack-not-working', 'Wszystkie rozwiązania z wyjaśnieniami'), '.'),
        table(
          ['Co widzisz', 'Dlaczego', 'Rozwiązanie'],
          [
            [`„${JAVA.madeForOlder}” (albo nowszej)`, 'Format paczki w pack.mcmeta nie pasuje do twojej gry.', `Wyeksportuj jeszcze raz dla swojej wersji albo rozszerz zakres zgodności. Paczki, które zmieniają tylko tekstury, zwykle działają, jeśli klikniesz „${JAVA.yes}”.`],
            [`„${JAVA.incompatible}” (Java 1.21.9+)`, 'pack.mcmeta ma tylko pack_format albo jego pola łamią zasady.', 'Wyeksportuj jeszcze raz z Texture Pack Maker, który zapisuje min_format i max_format.'],
            ['Paczki w ogóle nie ma na liście', 'pack.mcmeta nie istnieje, nie leży na samej górze zipa, nie jest poprawnym JSON-em albo nie ma opisu.', 'Upewnij się, że zip otwiera się od razu na pack.mcmeta i assets, a nie na folderze.'],
            ['Bedrock mówi, że import się nie udał', 'manifest.json nie istnieje, nie leży na samej górze pliku albo jest niepoprawny.', 'Wyeksportuj jeszcze raz jako .mcpack i otwórz nowy plik.'],
            ['Paczka w Bedrocku niczego nie zmienia', 'Inna paczka nad nią zastępuje te same tekstury.', 'Przesuń swoją paczkę na samą górę listy aktywnych paczek.'],
          ],
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'unzip',
      q: 'Czy trzeba rozpakować paczkę zasobów?',
      a: [p('Nie. Java wczytuje spakowane paczki bezpośrednio. Rozpakowany folder też działa, jeśli pack.mcmeta leży prosto w nim, ale trzymanie zipa jest prostsze.')],
    },
    {
      id: 'order',
      q: 'Która paczka wygrywa, kiedy dwie zmieniają tę samą teksturę?',
      a: [p(`Ta, która jest wyżej na liście „${JAVA.selected}” (Java) albo na liście aktywnych paczek (Bedrock). `, link('/merge-texture-packs', 'Łączenie paczek tekstur'), ' używa tej samej kolejności, żeby zrobić z kilku paczek jedną.')],
    },
    {
      id: 'realms',
      q: 'Czy gracze na konsolach mogą używać własnych paczek?',
      a: [p('Nie przez importowanie plików. Mogą dołączyć do świata, Realmu albo serwera, który ma tę paczkę.')],
    },
  ],
  ctaLabel: 'Pełna instrukcja instalacji na każdą platformę',
};

const packFormats: GuideText = {
  intro: [
    p(
      'Każda paczka zasobów w Java Edition podaje w pliku ',
      code('pack.mcmeta'),
      ' swój ',
      strong('format paczki'),
      ', a Minecraft porównuje go ze swoim, żeby zdecydować, czy paczka pasuje. ',
      strong(`Minecraft Java ${LATEST} używa formatu paczki zasobów ${F(LATEST)}.`),
      ' Paczki zasobów istnieją od 1.6.1; starsze wersje używały paczek tekstur, które działają inaczej.',
    ),
  ],
  quick: {
    title: `Szybka odpowiedź: Minecraft ${LATEST}`,
    items: [
      ['Format paczki zasobów: ', strong(F(LATEST)), '.'],
      ['Wpisz w ', code('pack.mcmeta'), ' ', code(`"min_format": ${minFormat(LATEST)}`), ' i ', code(`"max_format": ${maxFormat(LATEST)}`), ' (od 1.21.9 format dzieli się na numer główny i numer poboczny).'],
      ['Paczka, która ma działać także w starszych wersjach, potrzebuje do tego ', code('pack_format'), ' i ', code('supported_formats'), '. Tabela niżej wymienia każdą wersję.'],
    ],
  },
  sections: [
    {
      id: 'table',
      title: 'Format paczki zasobów każdej wersji Javy',
      body: [
        p('Każda pełna wersja od 1.6.1 do ', LATEST, '. Snapshoty, pre-release’y i release candidate’y mają własne numery.'),
        table(
          ['Format paczki', 'Wersje Minecraft Java'],
          formatGroups()
            .reverse()
            .map((g) => [g.format, g.versions.join(', ')]),
          'guide-table formats-table',
        ),
        p(
          'Od cyklu 1.21.9 format może mieć też numer poboczny: ',
          F(LATEST),
          ` znaczy numer główny ${formatParts(LATEST).major}, numer poboczny ${formatParts(LATEST).minor}. Mojang podnosi numer poboczny przy dodatkach, które nie psują starszych paczek. W chwili pisania tego poradnika pierwszy snapshot ${NEXT_SNAPSHOT.version} używa formatu ${NEXT_SNAPSHOT.format}.`,
        ),
      ],
    },
    {
      id: 'eras',
      title: 'Jak zmieniał się pack.mcmeta',
      body: [
        table(
          ['Wersje gry', 'Pola, które czyta gra'],
          [
            ['1.6.1 – 1.8.7', [code('pack_format'), ' i ', code('description'), '. Nie ma żadnego sprawdzania wersji, każdy numer się wczytuje.']],
            ['1.8.8 – 1.20.1', ['Tylko ', code('pack_format'), '. Paczka jest zgodna, jeśli numer jest równy numerowi gry; w przeciwnym razie Minecraft ostrzega, ale pozwala jej użyć.']],
            ['1.20.2 – 1.21.8', [code('pack_format'), ' (wymagany) plus opcjonalny zakres ', code('supported_formats'), ', na przykład ', code('[15, 64]'), '.']],
            [`1.21.9 – ${LATEST}`, [code('min_format'), ' i ', code('max_format'), ' (tylko razem). Paczka, której zakres sięga formatu 64 albo niższego, potrzebuje do tego ', code('pack_format'), ' i ', code('supported_formats'), '; paczka tylko dla 1.21.9+ nie może używać ', code('supported_formats'), '.']],
          ],
        ),
      ],
    },
    {
      id: 'examples',
      title: 'Przykłady',
      body: [
        h3(`Tylko Java ${LATEST}`),
        pre(mcmetaFor(LATEST, `Moja paczka do Minecrafta ${LATEST}`)),
        p('Pojedyncza liczba w ', code('max_format'), ` znaczy „każda wersja poboczna”, więc ${maxFormat(LATEST)} obejmuje ${maxFormat(LATEST)}.0 i ${F(LATEST)}. Z `, code(`[${maxFormat(LATEST)}, 0]`), ` w tym miejscu paczka byłaby za stara dla ${LATEST}.`),
        h3(`Od 1.20.1 do ${LATEST}`),
        pre(mcmetaRange('1.20.1', LATEST, `Moja paczka do Minecrafta 1.20.1 - ${LATEST}`)),
        p('1.20.1 czyta ', code('pack_format'), ', 1.20.2 – 1.21.8 czytają ', code('supported_formats'), ', a 1.21.9 i nowsze czytają ', code('min_format'), ' i ', code('max_format'), '.'),
        h3('Tylko 1.20.1 (i 1.20)'),
        pre(mcmetaLegacy('1.20.1', 'Moja paczka do Minecrafta 1.20.1')),
        callout('tip', 'Niech zrobi to narzędzie', 'Wybierz w Texture Pack Maker swoją wersję i, jeśli chcesz, zakres zgodności w zakładce „Paczka”. Eksport dostanie dokładnie te pola, których potrzebuje każda wersja.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'A co z Bedrockiem?',
      body: [
        p(
          'Paczki do Bedrocka nie mają numeru formatu paczki. Ich ',
          code('manifest.json'),
          ' używa ',
          code('"format_version": 2'),
          ' i ',
          code('min_engine_version'),
          ', na przykład ',
          code(MIN_ENGINE),
          '. Numery wersji Bedrocka idą teraz według roku (26.0 wyszła w lutym 2026), ale manifesty zachowują stary schemat, więc 26.50 zapisuje się jako ',
          code('[1, 26, 50]'),
          '.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'latest',
      q: `Jaki format paczki zasobów ma Minecraft ${LATEST}?`,
      a: [p(`${F(LATEST)}. W pack.mcmeta paczki tylko dla ${LATEST} wpisz "min_format": ${minFormat(LATEST)} i "max_format": ${maxFormat(LATEST)}.`)],
    },
    {
      id: '1211',
      q: 'Jaki format paczki mają 1.21.1 i 1.20.1?',
      a: [p(`1.21 i 1.21.1 używają ${F('1.21.1')}; 1.20 i 1.20.1 używają ${F('1.20.1')}. 1.8.9 i starsze wersje 1.x od 1.6.1 używają ${F('1.8.9')}.`)],
    },
    {
      id: 'broken',
      q: `Dlaczego przy mojej paczce jest napisane „${JAVA.incompatible}”?`,
      a: [p('Od 1.21.9 paczka, która ma tylko wysoki pack_format (powyżej 64) i nie ma min_format / max_format, nie przechodzi sprawdzania. Możesz ją i tak włączyć, ale lepiej dodać oba pola.')],
    },
  ],
  ctaLabel: 'Zrób paczkę z właściwym formatem',
};
