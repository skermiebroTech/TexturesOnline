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

const makeASkin: GuideText = {
  image: SHOTS.skin2d,
  intro: [
    p(
      'Skin w Minecrafcie to obrazek PNG o wymiarach 64×64 piksele, który owija się wokół modelu gracza; Bedrock przyjmuje też skiny HD 128×128. Możesz zaprojektować go w przeglądarce: pomalować na szablonie, sprawdzić na modelu 3D, a potem wgrać w Minecraft Launcherze (Java) albo zaimportować jako paczkę skinów (Bedrock). W polskiej wersji gry skiny nazywają się „skórki”.',
    ),
  ],
  quick: {
    title: 'W skrócie',
    items: ['Otwórz edytor skinów i wybierz szablon albo skina startowego.', 'Pomaluj go, patrząc na podgląd 3D.', 'Wyeksportuj PNG do Javy albo .mcpack do Bedrocka i go wgraj.'],
  },
  howto: { name: 'Jak zrobić własnego skina do Minecrafta online', steps: SKIN_STEPS },
  sections: [
    { id: 'steps', title: 'Krok po kroku', body: [steps(SKIN_STEPS), figure(SHOTS.skin2d), figure(SHOTS.skin3d)] },
    {
      id: 'template',
      title: 'Jak działa szablon skina',
      body: [
        ul([
          ['Obrazek ma ', strong('64×64'), ' piksele. Java 1.7.10 i starsze używają starego układu ', strong('64×32'), ' bez osobnej lewej ręki i lewej nogi; Bedrock przyjmuje też skiny HD ', strong('128×128'), '.'],
          ['Są dwie warstwy. ', strong('Warstwa podstawowa'), ' to ciało; ', strong('warstwa zewnętrzna'), ' (kapelusz, kurtka, rękawy i nogawki) unosi się tuż nad nią i może być przezroczysta.'],
          [strong('Szerokie'), ' ręce (Steve) mają 4 piksele szerokości, ', strong('wąskie'), ' ręce (Alex) 3 piksele. Wgraj skina z tym samym modelem, na którym go malujesz.'],
          'Nieużywane obszary szablonu powinny zostać całkowicie przezroczyste.',
        ]),
      ],
    },
    {
      id: 'hd-skins',
      title: 'Skiny HD 128×128',
      body: [
        p(
          'Skin HD to ten sam szablon w podwójnej rozdzielczości: 128×128 zamiast 64×64 piksele. Każda twarz, każdy rękaw i każdy but mają więc cztery razy więcej pikseli na cieniowanie, oczy i drobne wzory. Gdzie działa:',
        ),
        ul([
          [strong('Bedrock Edition'), ` (Windows, Android, iPhone i iPad): zaimportuj PNG w menu „${BEDROCK.dressingRoom}” albo spakuj go w paczkę skinów. Jedna paczka może mieszać skiny 64×64 i skiny HD.`],
          [strong('Java Edition'), ': Minecraft Launcher i minecraft.net przyjmują tylko skiny 64×64. Do skina HD potrzebujesz moda, który wczytuje skiny HD, na przykład CustomSkinLoader.'],
        ]),
        h3('Jak zrobić go w edytorze skinów'),
        steps([
          ['Na ekranie startowym ustaw ', strong('Rozmiar'), ' na ', strong('HD 128×128'), ' i wybierz punkt startowy. Szablony i skiny startowe są podwajane do 128×128, a wgrany PNG 128×128 zostaje w HD.'],
          ['Malujesz już skina 64×64? W edytorze ustaw ', strong('Rozmiar'), ' na ', strong('HD 128'), ' i potwierdź przyciskiem ', strong('Zamień na HD'), '. Każdy piksel staje się blokiem 2×2, więc skin wygląda tak samo, dopóki nie namalujesz drobniejszych szczegółów. Przez ', strong('Rozmiar'), ' › ', strong('64×64'), ' i ', strong('Zmniejsz do 64×64'), ' wracasz.'],
          ['Wyeksportuj ', strong('Skin do Bedrocka (.png)'), ` do importu w menu „${BEDROCK.dressingRoom}” albo `, strong('Paczka skinów do Bedrocka (.mcpack)'), '. Oba zachowują 128×128.'],
          ['Do Javy ', strong('Skin do Javy (.png)'), ' pobiera kopię 64×64, w której każdy blok 2×2 staje się jednym pikselem; twój skin HD zostaje bez zmian. Używasz moda do skinów HD? Wybierz wtedy ', strong('128×128 do modów'), '.'],
        ]),
        callout(
          'warn',
          'Ograniczenia',
          `Konsole nie mogą importować plików skinów w żadnym rozmiarze. Skiny większe niż 128×128 nie są obsługiwane. Gracze z włączoną opcją „${BEDROCK.trustedSkins}” widzą każdy własny skin, HD czy nie, jako domyślny.`,
        ),
      ],
    },
    {
      id: 'java',
      title: 'Skin w Javie',
      body: [
        steps([
          ['Otwórz Minecraft Launcher i przejdź do ', uiPath('Minecraft: Java Edition', LAUNCHER.skins), '.'],
          ['Kliknij ', strong(LAUNCHER.newSkin), ', nadaj mu nazwę i wybierz ', strong(LAUNCHER.classic), ' albo ', strong(LAUNCHER.slim), '.'],
          ['Kliknij ', strong(LAUNCHER.browse), ', wybierz swój PNG, a potem ', strong(LAUNCHER.saveAndUse), '.'],
        ]),
        p('Możesz go też wgrać w swoim profilu na ', ext('https://www.minecraft.net/', 'minecraft.net'), '.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Własna paczka skinów do Bedrocka',
      body: [
        p(
          `Paczka skinów (w grze „${BEDROCK.skinPack}”) to `,
          code('.mcpack'),
          ' z jednym albo kilkoma skinami. Edytor skinów buduje ją za ciebie; w środku są ',
          code('manifest.json'),
          ' (typ modułu ',
          code('skin_pack'),
          '), ',
          code('skins.json'),
          ', który wymienia każdy skin z modelem szerokim (',
          code('geometry.humanoid.custom'),
          ') albo wąskim (',
          code('geometry.humanoid.customSlim'),
          ') i ',
          code('"type": "free"'),
          ', pliki PNG skinów na najwyższym poziomie i nazwy w ',
          code('texts/en_US.lang'),
          '.',
        ),
        steps([
          ['Maluj każdy skin jako osobny projekt. Szerokie i wąskie skiny mieszczą się w jednej paczce.'],
          ['Wybierz ', strong('Eksportuj'), ' › ', strong('Paczka skinów do Bedrocka (.mcpack)'), ', nazwij paczkę i zaznacz pozostałe skiny.'],
          'Otwórz .mcpack (dwukrotnym kliknięciem na Windowsie, „Otwórz w Minecraft” na Androidzie, „Udostępnij › Minecraft” na iPhonie i iPadzie).',
          ['W Minecrafcie przejdź do ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), ', znajdź swoją paczkę, wybierz skina i stuknij ', strong(BEDROCK.equip), '.'],
        ]),
        figure(SHOTS.skinPack),
        callout('warn', 'Warto wiedzieć', `Konsole nie mogą importować plików skinów. Gracze z włączoną opcją „${BEDROCK.trustedSkins}” widzą własne skiny jako domyślne. W zaimportowanych paczkach skinów nie wolno używać własnych modeli, tylko szerokiego i wąskiego.`),
        p('Instalacja, aktualizacja i pliki w paczce krok po kroku: ', link('/guides/make-a-bedrock-skin-pack', 'Jak zrobić paczkę skinów do Minecraft Bedrock'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'size', q: 'Jaki rozmiar powinien mieć skin do Minecrafta?', a: [p('64×64 piksele, zapisany jako PNG. 64×32 tylko dla Javy 1.7.10 i starszych. Bedrock przyjmuje też skiny HD 128×128.')] },
    {
      id: 'hd',
      q: 'Mogę zrobić skina 128×128 do Minecrafta?',
      a: [
        p(
          'Tak, do Bedrock Edition. W edytorze skinów przed startem ustaw ',
          strong('Rozmiar'),
          ' na ',
          strong('HD 128×128'),
          ' albo przełącz gotowego skina na ',
          strong('HD 128'),
          ', a potem wyeksportuj PNG do Bedrocka albo paczkę skinów. Java Edition bez modów pokazuje tylko skiny 64×64, dlatego eksport do Javy robi kopię 64×64; mody do skinów HD, takie jak CustomSkinLoader, mogą używać pliku 128×128.',
        ),
      ],
    },
    { id: 'username', q: 'Mogę zacząć od skina kogoś innego?', a: [p('Tak. Edytor skinów może wczytać aktualny skin dowolnego gracza Javy po nicku, żeby zrobić z niego remiks. Szanuj przy tym pracę innych.')] },
    { id: 'phone', q: 'Mogę zrobić skina na telefonie?', a: [p('Tak. Edytor działa z dotykiem, łącznie z przybliżaniem dwoma palcami.')] },
    {
      id: 'slim-pack',
      q: 'Czy paczka skinów może mieszać szerokie i wąskie skiny?',
      a: [p('Tak. Każdy skin w paczce ma własny model, więc twoja paczka skinów może mieć obok siebie skiny szerokie (ręce o szerokości 4 pikseli) i wąskie (ręce o szerokości 3 pikseli).')],
    },
    {
      id: 'update-pack',
      q: 'Jak zaktualizować już zaimportowaną paczkę skinów?',
      a: [p('Wyeksportuj ją jeszcze raz z tego samego projektu i otwórz nowy .mcpack. Paczka zachowuje swoje identyfikatory i dostaje wyższy numer wersji, więc Minecraft zastąpi starą, zamiast robić kopię.')],
    },
  ],
  ctaLabel: 'Otwórz edytor skinów',
};

const shadersWithoutMods: GuideText = {
  image: SHOTS.shaderVanilla,
  intro: [
    p(
      strong('Tak, z ograniczeniami.'),
      ` Do prostych efektów shaderów nie potrzebujesz OptiFine, Irisa ani żadnego innego moda. Od Javy 1.17 zwykła paczka zasobów może podmienić część własnych plików shaderów Minecrafta – tak dostajesz color grading, winietę, inną mgłę, a w ${LATEST} także bloom, bez instalowania czegokolwiek. W Bedrocku własny kod shaderów jest niedozwolony, ale paczka Vibrant Visuals dostraja wbudowane światło, niebo, mgłę i wodę. Prawdziwe cienie i odbicia w Javie dalej wymagają Irisa albo OptiFine.`,
    ),
  ],
  howto: { name: 'Jak zrobić paczkę shaderów do Minecraft Java bez modów', steps: VANILLA_SHADER_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Java: shadery w paczce zasobów',
      body: [
        p('Od 1.17 Minecraft rysuje świat plikami shaderów, które paczka zasobów może nadpisać. To, co potrafi paczka shaderów bez modów, zależy od wersji:'),
        table(
          ['Efekt', 'Działa w'],
          [
            ['Color grading (jasność, kontrast, nasycenie, ciepło, czerń i biel, sepia)', 'Java 1.17 i nowsze'],
            ['Winieta', 'Java 1.17 i nowsze'],
            ['Zasięg i kolor mgły', 'Java 1.17 i nowsze'],
            ['Bloom (poświata na cały ekran)', `Java ${LATEST} i nowsze`],
            ['Falujące rośliny', 'tylko 1.17 – 1.21.4 i 1.21.6 – 1.21.10'],
            ['Prawdziwe cienie, odbicia, promienie światła', 'Niemożliwe bez Irisa albo OptiFine'],
          ],
        ),
        p(`Java ${LATEST} wprowadziła zawsze aktywny efekt pełnoekranowy, dlatego działają tam bloom i czystszy color grading. Wersje 1.16.5 i starsze nie mają shaderów świata, które dałoby się podmienić.`),
        callout('warn', 'Dokładnie jedna wersja', 'Mojang często zmienia te pliki shaderów, dlatego paczka shaderów bez modów działa tylko w wersji, dla której ją zrobiono. Zepsuty shader może sprawić, że Minecraft wyłączy wszystkie twoje paczki zasobów – dlatego każdy shader, który pisze kreator shaderów, jest wcześniej sprawdzany pod kątem błędów kompilacji.'),
        h3('Zrób to samodzielnie'),
        steps(VANILLA_SHADER_STEPS),
        figure(SHOTS.shaderVanilla),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock: Vibrant Visuals zamiast shaderów',
      body: [
        p('Bedrock nie wczytuje własnego kodu shaderów, odkąd przeszedł na silnik RenderDragon (1.16.200 na Windowsie i konsolach, 1.18.30 na innych urządzeniach). Narzędzia, które podmieniają skompilowane pliki shaderów gry, wymagają zmienionej instalacji gry i psują się przy aktualizacjach.'),
        p(
          'Oficjalny sposób to ',
          strong('Vibrant Visuals'),
          ` (w polskiej wersji gry „${BEDROCK.vibrantVisuals}”): nowoczesny renderer Bedrocka, w stabilnej grze od 1.21.90 (czerwiec 2025). Paczka zasobów może zmieniać jego ustawienia: światło słońca i księżyca, kolory nieba, mgłę, wodę, cienie i color grading, zależnie od pory dnia i biomu. `,
          link('/guides/bedrock-vibrant-visuals-settings', 'Ustawienia Vibrant Visuals wyjaśnione'),
          '.',
        ),
      ],
    },
    {
      id: 'mods',
      title: 'Shadery bez OptiFine: weź Irisa',
      body: [
        p(
          `Jeśli „bez modów” tak naprawdę znaczy „bez OptiFine”, odpowiedzią jest Iris. Wczytuje te same paczki shaderów (prawdziwe cienie od słońca, falujące liście, odbijającą wodę, promienie światła), działa razem z modem na wydajność Sodium i jest dostępny dla Javy od 1.16.5 do ${LATEST}. W chwili pisania tego poradnika OptiFine sięga do 26.2.`,
        ),
        steps([
          ['Pobierz instalator Irisa z ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ' i go uruchom. Zainstaluje Irisa i Sodium dla wybranej wersji.'],
          'Uruchom grę raz z nowym profilem Irisa w Minecraft Launcherze.',
          ['Otwórz ', uiPath(JAVA.options, JAVA.video, IRIS.shaderPacks), ', kliknij ', strong(IRIS.openFolder), ' i wrzuć tam zipa z paczką shaderów.'],
          `Wybierz paczkę na liście i kliknij „${IRIS.apply}”. Lżejsze paczki pasują do laptopów; cięższe potrzebują mocnej karty graficznej.`,
        ]),
        figure(SHOTS.shaderIris),
        p('Z Forge albo NeoForge poszukaj wersji Irisa dla tego loadera. Własną paczkę shaderów do Irisa i OptiFine z presetami i podglądem na żywo zbudujesz też w ', link('/shaders', 'kreatorze shaderów'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'optifine', q: 'Czy shadery bez modów potrzebują OptiFine?', a: [p('Nie. Paczki shaderów bez modów to zwykłe paczki zasobów. Działają bez moda w wersji, dla której je zrobiono.')] },
    { id: 'servers', q: 'Czy shadery bez modów działają na serwerach?', a: [p('Tak. Paczki zasobów stosuje twoja własna gra, więc działają też, kiedy grasz na serwerze.')] },
    { id: 'bedrock', q: 'Mogę używać shaderów z Javy w Bedrocku?', a: [p('Nie. Bedrock nie może wczytywać kodu shaderów z paczek. Zamiast tego użyj paczki Vibrant Visuals.')] },
  ],
  ctaLabel: 'Otwórz kreator shaderów',
};

const javaVsBedrock: GuideText = {
  intro: [
    p(
      'Java i Bedrock mają paczki zasobów, ale ich plików nie da się zamieniać. Paczka do ',
      strong('Javy'),
      ' to ',
      code('.zip'),
      ' z ',
      code('pack.mcmeta'),
      ' i teksturami PNG w ',
      code('assets/minecraft/textures/'),
      '. Paczka do ',
      strong('Bedrocka'),
      ' to ',
      code('.mcpack'),
      ' z ',
      code('manifest.json'),
      ' i teksturami w ',
      code('textures/'),
      '. Dla obu edycji robisz więc paczkę dwa razy.',
    ),
  ],
  quick: {
    title: 'Szybka odpowiedź: czy paczki tekstur z Javy działają w Bedrocku?',
    items: [
      'Nie. Bedrock nie wczyta .zip z Javy, a zmiana rozszerzenia na .mcpack nie pomaga.',
      'Obie edycje używają innych folderów, nazw plików i plików z opisem.',
      'Paczkę można przekonwertować, przenosząc jej obrazki, zmieniając ich nazwy i dodając manifest.json, albo zrobić ją od nowa w projekcie do Bedrocka.',
    ],
  },
  sections: [
    {
      id: 'compare',
      title: 'Porównanie obok siebie',
      body: [
        table(
          ['', 'Java Edition', 'Bedrock Edition'],
          [
            ['Plik', [code('.zip'), ' (albo folder)'], [code('.mcpack'), ' (zip ze zmienionym rozszerzeniem)']],
            ['Plik z opisem', [code('pack.mcmeta')], [code('manifest.json'), ' z dwoma UUID i numerem wersji']],
            ['Wersja docelowa', ['Numer formatu paczki, np. ', F(LATEST), ' dla ', LATEST], ['Minimalna wersja silnika, np. ', code(MIN_ENGINE)]],
            ['Przykładowa ścieżka tekstury', [code('assets/minecraft/textures/block/stone.png')], [code('textures/blocks/stone.png')]],
            ['Formaty obrazków', 'PNG', 'PNG albo TGA (zachowaj rozszerzenie pliku z gry)'],
            ['Ikona', [code('pack.png')], [code('pack_icon.png')]],
            ['Instalacja', ['Wrzuć do folderu ', code('resourcepacks')], 'Otwórz plik; Minecraft go zaimportuje'],
            ['Shadery', 'Paczki shaderów do Irisa i OptiFine albo shadery bez modów jako paczka zasobów (1.17+)', 'Bez własnego kodu shaderów; paczki ustawień Vibrant Visuals'],
            ['Skiny', 'PNG wgrany w launcherze albo na minecraft.net', `Paczka skinów (.mcpack) albo PNG zaimportowany w menu „${BEDROCK.dressingRoom}”`],
            ['Konsole', 'Nie dotyczy', 'Nie mogą importować plików; użyj świata, Realmu albo serwera z paczką'],
          ],
        ),
      ],
    },
    {
      id: 'textures',
      title: 'Różnice w teksturach, na które trzeba uważać',
      body: [
        ul([
          'Nazwy plików różnią się między edycjami, na przykład block/grass_block_top.png w Javie i blocks/grass_top.png w Bedrocku.',
          'Wiele tekstur Bedrocka trzyma w przezroczystych pikselach maski barwienia, więc edytory nie mogą wyrzucać koloru niewidocznych pikseli. Texture Pack Maker zachowuje piksele dokładnie takie, jakie są.',
          'Java może objąć zakresem zgodności kilka wersji w jednej paczce; paczki do Bedrocka podają jedną minimalną wersję.',
        ]),
      ],
    },
    {
      id: 'convert',
      title: 'Czy da się zamienić paczkę tekstur z Javy na Bedrock?',
      body: [
        p('Tak, ale nie przez zmianę nazwy pliku. Konwersja to złożenie paczki od nowa według układu Bedrocka:'),
        steps([
          ['Skopiuj obrazki z ', code('assets/minecraft/textures/'), ' do folderów Bedrocka w ', code('textures/'), ' (', code('block'), ' → ', code('blocks'), ', ', code('item'), ' → ', code('items'), ').'],
          ['Zmień nazwy plików, które się różnią, na przykład ', code('grass_block_top.png'), ' → ', code('grass_top.png'), '. Tekstury bez odpowiednika w Bedrocku odpadają.'],
          ['Napisz ', code('manifest.json'), ' z dwoma nowymi UUID, wersją i ', code('min_engine_version'), ' i zmień nazwę ', code('pack.png'), ' na ', code('pack_icon.png'), '.'],
          ['Sprawdź przypadki szczególne: animacje w Bedrocku są w ', code('textures/flipbook_textures.json'), ' zamiast w plikach ', code('.png.mcmeta'), ', a niektóre tekstury to pliki ', code('.tga'), ' z maskami barwienia w przezroczystych pikselach.'],
          ['Spakuj zawartość do zipa i zmień jego rozszerzenie na ', code('.mcpack'), '.'],
        ]),
        p(
          'Własny poradnik Mojang to ',
          ext('https://learn.microsoft.com/pl-pl/minecraft/creator/documents/convertingtexturepacks', 'Converting Texture Packs from Java Edition to Bedrock Edition'),
          '. Szybki sposób to ',
          link('/texture-pack-converter', 'konwerter paczek tekstur'),
          ': przenosi każdą teksturę i zmienia jej nazwę, robi z animacji wpisy flipbooka, pisze manifest i wymienia wszystko, czego nie mógł przekonwertować.',
        ),
      ],
    },
    {
      id: 'mcpack',
      title: 'Czy .mcpack to po prostu zip?',
      body: [
        p(
          'Tak. ',
          code('.mcpack'),
          ' to zwykły zip z innym rozszerzeniem, żeby Bedrock wiedział, że ma go zaimportować. Zmień rozszerzenie na ',
          code('.zip'),
          ', żeby zajrzeć do środka. Paczką do Bedrocka czyni go zawartość: ',
          code('manifest.json'),
          ' na najwyższym poziomie i układ folderów Bedrocka. Pliki ',
          code('.mcaddon'),
          ' łączą kilka paczek, a pliki ',
          code('.mcworld'),
          ' zawierają cały świat.',
        ),
      ],
    },
    {
      id: 'both',
      title: 'Jedna paczka do obu edycji',
      body: [
        steps([
          ['W ', link('/textures', 'edytorze paczek tekstur'), ' zrób projekt do Javy i pomaluj tekstury.'],
          'Zrób projekt do Bedrocka i pomaluj (albo wgraj) tam te same tekstury; lista plików będzie z Bedrocka.',
          'Wyeksportuj oba i udostępnij oba pliki.',
        ]),
      ],
    },
  ],
  faq: [
    { id: 'convert', q: 'Mogę zamienić paczkę z Javy na Bedrock?', a: [p('Nie przez zmianę nazwy pliku. Foldery, nazwy i plik z opisem są inne, więc obrazki trzeba przenieść, zmienić ich nazwy i dodać manifest.json. ', link('/texture-pack-converter', 'Konwerter paczek tekstur'), ' zrobi to za ciebie.')] },
    { id: 'back', q: 'Mogę zamienić paczkę z Bedrocka na Javę?', a: [p('Tak samo, tylko odwrotnie: przenieś obrazki do ', code('assets/minecraft/textures/'), ', nadaj im nazwy z Javy, zamień pliki .tga na PNG i dodaj ', code('pack.mcmeta'), '.')] },
    { id: 'missing', q: 'Dlaczego po konwersji brakuje niektórych tekstur?', a: [p('Każda edycja ma tekstury, których nie ma w drugiej, a niektóre są inaczej podzielone albo połączone (na przykład skrzynie, obrazy i interfejs). Te trzeba pomalować od nowa dla drugiej edycji.')] },
    { id: 'which', q: 'W którą edycję gram?', a: [p('Jeśli grasz na konsoli, telefonie albo tablecie albo masz Minecrafta ze Sklepu Microsoft jako „Minecraft dla Windows”, to Bedrock. Java działa na Windowsie, macOS i Linuksie przez Minecraft Launcher.')] },
  ],
  ctaLabel: 'Otwórz edytor paczek tekstur',
};

// ---------------------------------------------------------------- vibrant visuals

const VV_STEPS: Child[] = [
  ['Zrób paczkę w ', link('/shaders', 'kreatorze shaderów'), ' (wybierz ', strong('Vibrant Visuals w Bedrocku'), ') i wyeksportuj ', code('.mcpack'), '.'],
  'Otwórz plik. Minecraft sam go zaimportuje.',
  ['Przejdź do ', uiPath(BEDROCK.settings, BEDROCK.globalResources, BEDROCK.myPacks), ' i aktywuj paczkę. Wyłącz klasyczne paczki tekstur, które nie obsługują Vibrant Visuals.'],
  ['Otwórz ', uiPath(BEDROCK.settings, BEDROCK.video), ' i ustaw ', strong(BEDROCK.graphicsMode), ' na ', strong(BEDROCK.vibrantVisuals), ' (Vibrant Visuals).'],
];

const vibrantVisuals: GuideText = {
  image: SHOTS.vibrantVisuals,
  intro: [
    p(
      strong('Vibrant Visuals'),
      ` (w polskiej wersji gry „${BEDROCK.vibrantVisuals}”) to nowoczesny tryb grafiki w Minecraft Bedrock, z kierunkowym światłem słońca, miękkimi cieniami, mgłą wolumetryczną, odbijającą wodą i materiałami opartymi na fizyce. Od 1.21.90 (czerwiec 2025) nie jest już eksperymentem i na obsługiwanych urządzeniach jest domyślnym trybem grafiki. Paczka zasobów może zmieniać jego ustawienia, ale nie może dodać nowego kodu shaderów.`,
    ),
  ],
  howto: { name: 'Jak używać paczki Vibrant Visuals w Minecraft Bedrock', steps: VV_STEPS },
  sections: [
    {
      id: 'settings',
      title: 'Co może zmienić paczka Vibrant Visuals',
      body: [
        table(
          ['Folder paczki', 'Czym steruje'],
          [
            [code('lighting/'), 'Jasność, kolor i nachylenie drogi słońca i księżyca, światło otoczenia (w jaskiniach), światło nieba i to, jak świecą kolorowe bloki.'],
            [code('atmospherics/'), 'Kolory nieba w górze i przy horyzoncie i to, jak światło rozprasza się w powietrzu (gęstość nieba, zachody słońca).'],
            [code('color_grading/'), 'Metoda tone mappingu, kontrast, nasycenie, wzmocnienie, gamma i temperatura barwowa: filmowy wygląd.'],
            [code('water/'), 'Kolor wody, fale i kaustyka (wzory światła pod wodą).'],
            [code('shadows/'), 'Kanciaste albo miękkie cienie.'],
            [code('fogs/'), 'Gęstość i kolor mgły wolumetrycznej oraz klasyczna mgła odległości.'],
            [code('local_lighting/'), 'Kolor światła bloków, takich jak pochodnie i latarnie.'],
          ],
        ),
        p('Ustawienia mogą zmieniać się z porą dnia, a własne wartości Minecrafta są różne w różnych biomach – dlatego dobra paczka dopasowuje każdy biom, zamiast podmieniać tylko jeden ogólny plik.'),
        p(strong('Nie da się ustawić paczką: '), 'bloomu, ekspozycji, odbić w przestrzeni ekranu, oświetlenia chmur, samej krzywej tone mappingu, zasięgu widzenia i wygładzania krawędzi. To wszystko siedzi w rendererze gry, a nie w paczkach zasobów.'),
      ],
    },
    {
      id: 'devices',
      title: 'Które urządzenia je obsługują',
      body: [
        ul(['Komputery z Windowsem i DirectX 12.', 'Xbox Series i PlayStation 5; na Xbox One i PS4 jest domyślnie wyłączone.', 'iPhone i iPad od układu A12.', 'Wiele nowych urządzeń z Androidem.']),
        p('Nie ma go na pierwszym Nintendo Switch, Chromebookach i tabletach Fire. Serwery mogą je wyłączyć, a na podzielonym ekranie używana jest zamiast tego klasyczna grafika (Dokładna).'),
      ],
    },
    {
      id: 'enable',
      title: 'Włączanie z paczką',
      body: [
        steps(VV_STEPS),
        callout(
          'warn',
          'Vibrant Visuals jest wyszarzone?',
          'Minecraft pozwala je włączyć tylko wtedy, gdy każda aktywna paczka zasobów je obsługuje. Klasyczne paczki tekstur je wyłączają, więc je dezaktywuj (albo użyj paczki zrobionej pod Vibrant Visuals). Opcja wymaga też obsługiwanego urządzenia.',
        ),
        figure(SHOTS.vibrantVisuals),
      ],
    },
  ],
  faq: [
    { id: 'what', q: 'Czym jest Vibrant Visuals w Minecrafcie?', a: [p(`Wbudowany nowoczesny tryb grafiki w Bedrocku (w polskiej wersji gry „${BEDROCK.vibrantVisuals}”), wydany w 1.21.90. Daje kierunkowe światło, cienie, mgłę wolumetryczną, odbicia na wodzie i materiały PBR, zupełnie bez dodatków.`)] },
    { id: 'textures', q: 'Czy Vibrant Visuals potrzebuje specjalnej paczki tekstur?', a: [p('Nie, działa ze zwykłymi teksturami. Ale klasyczna paczka tekstur, która nie deklaruje obsługi Vibrant Visuals, wyłącza ten tryb, dopóki jest aktywna.')] },
    { id: 'classic-fog', q: 'Czy zmiany mgły działają bez Vibrant Visuals?', a: [p('Klasyczną mgłę odległości możesz zmienić w każdym trybie grafiki. Mgła wolumetryczna i ustawienia światła działają tylko z Vibrant Visuals.')] },
  ],
  ctaLabel: 'Zbuduj paczkę Vibrant Visuals',
};

// ---------------------------------------------------------------- convert java to bedrock

const CONVERT_STEPS: Child[] = [
  ['Otwórz ', link('/texture-pack-converter', 'konwerter paczek tekstur'), ' i wybierz paczkę: ', code('.zip'), ' z Javy, ', code('.mcpack'), ' z Bedrocka albo tekstury PNG.'],
  ['Wybierz cel: ', strong('Bedrock Edition'), ' albo ', strong('Java Edition'), ' z wersją.'],
  ['Kliknij ', strong('Konwertuj'), '. Twoja przeglądarka pobierze listę tekstur edycji docelowej i przekonwertuje każdą teksturę, którą da się przekonwertować.'],
  'Przeczytaj raport: ile tekstur przekonwertowano, które pominięto i dlaczego.',
  'Pobierz przekonwertowaną paczkę albo otwórz ją w edytorze, żeby najpierw pomalować pominięte tekstury.',
];

const convertJavaToBedrock: GuideText = {
  image: SHOTS.convertResult,
  intro: [
    p(
      'Paczka tekstur z Javy nie działa w Bedrocku, a zmiana rozszerzenia z ',
      code('.zip'),
      ' na ',
      code('.mcpack'),
      ' nie pomaga: obie edycje używają innych folderów, nazw plików i plików z opisem. Żeby przekonwertować paczkę, każdą teksturę trzeba przenieść do folderu Bedrocka, zmienić jej nazwę na nazwę z Bedrocka i dodać ',
      code('manifest.json'),
      '. Darmowy ',
      link('/texture-pack-converter', 'konwerter paczek tekstur'),
      ' robi to w kilka sekund w twojej przeglądarce i działa też w drugą stronę.',
    ),
  ],
  quick: {
    title: 'W skrócie',
    items: [
      ['Otwórz ', link('/texture-pack-converter', 'konwerter paczek tekstur'), ' i wybierz swój ', code('.zip'), ' z Javy.'],
      ['Wybierz ', strong('Bedrock Edition'), ' i kliknij ', strong('Konwertuj na Bedrocka'), '.'],
      ['Pobierz ', code('.mcpack'), ' i go otwórz: Minecraft go zaimportuje.'],
    ],
  },
  howto: { name: 'Jak zamienić paczkę tekstur z Javy na Bedrock', steps: CONVERT_STEPS },
  sections: [
    { id: 'steps', title: 'Krok po kroku', body: [steps(CONVERT_STEPS), figure(SHOTS.convertPack), figure(SHOTS.convertResult)] },
    {
      id: 'what',
      title: 'Co się konwertuje, a co nie',
      body: [
        p('Konwerter wie, która tekstura z Javy pełni tę samą rolę co która tekstura z Bedrocka – ustalone na podstawie plików gry obu edycji. Większość tekstur pokazuje w obu ten sam obrazek i można ją po prostu przenieść.'),
        table(
          ['Konwertuje się', 'Nie konwertuje się'],
          [
            ['Większość tekstur bloków i przedmiotów (mniej więcej cztery na pięć)', 'Tekstury, które są tylko w jednej edycji'],
            ['Wiele tekstur mobów i otoczenia (słońce, księżyc, chmury)', 'Inaczej zbudowane tekstury: skrzynie, wiele skinów mobów, sztandary, menu i cząsteczki'],
            ['Animowane tekstury: z .png.mcmeta powstaje wpis flipbooka', 'Modele, dźwięki, czcionki, napisy powitalne i shadery'],
            ['Ikona, nazwa i opis paczki', 'Dodatki z OptiFine, takie jak połączone tekstury i własne tekstury przedmiotów'],
          ],
        ),
        p('Wszystko, co pominięto, jest w raporcie z powodem, więc wiesz dokładnie, co trzeba pomalować od nowa. Otwórz przekonwertowaną paczkę w ', link('/textures', 'edytorze paczek tekstur'), ', żeby poprawić te tekstury na ich modelach 3D przed pobraniem.'),
        callout('tip', 'Jedna paczka, dwie edycje', `Trzymaj paczkę do Javy jako oryginał i konwertuj ją od nowa po każdej zmianie. Zanim zaimportujesz nową wersję do Bedrocka, usuń starą w „${BEDROCK.settings} › ${BEDROCK.storage}”, żeby nie mieć dwóch kopii.`),
      ],
    },
    {
      id: 'bedrock-to-java',
      title: 'Zamiana paczki z Bedrocka na Javę',
      body: [
        p(
          'Wybierz ',
          code('.mcpack'),
          ' z Bedrocka (albo ',
          code('.mcaddon'),
          '), a potem ',
          strong('Java Edition'),
          ' i wersję, w którą grasz. Tekstury trafiają do folderów i pod nazwy z Javy, obrazki ',
          code('.tga'),
          ' stają się plikami PNG, animacje z flipbooka stają się plikami ',
          code('.png.mcmeta'),
          ', a paczka dostaje pasujący ',
          code('pack.mcmeta'),
          ' dla tej wersji.',
        ),
      ],
    },
    {
      id: 'old-java',
      title: 'Aktualizacja starej paczki do Javy do nowej wersji',
      body: [
        p(
          'Ten sam konwerter aktualizuje paczki do Javy między wersjami. Wiele tekstur zmieniło nazwy przez lata, zwłaszcza w 1.13, kiedy ',
          code('textures/blocks'),
          ' zmienił się w ',
          code('textures/block'),
          ', a setki plików dostały nowe nazwy. Wybierz starą paczkę, potem ',
          strong('Javę'),
          ' i swoją wersję, a każda tekstura ze zmienioną nazwą dostanie nową nazwę. Nazwy tekstur we własnych modelach paczki też są poprawiane.',
        ),
        p(`Działa to także wstecz, na przykład żeby zrobić z paczki do ${LATEST} paczkę do 1.8.9.`),
      ],
    },
    {
      id: 'install',
      title: 'Instalacja przekonwertowanej paczki',
      body: [
        ul([
          ['Bedrock: otwórz ', code('.mcpack'), ' (dwukrotnym kliknięciem na Windowsie, „Otwórz w Minecraft” na telefonie) i aktywuj go w ', uiPath(BEDROCK.settings, BEDROCK.globalResources), '.'],
          ['Java: wrzuć ', code('.zip'), ' do folderu ', code('resourcepacks'), ` i przenieś go do „${JAVA.selected}”.`],
        ]),
        p('Więcej w poradniku ', link('/guides/install-resource-packs', 'Jak zainstalować paczki tekstur'), '. Jeśli coś wygląda źle, pomoże ', link('/guides/texture-pack-not-working', 'Paczka tekstur nie działa'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: 'Czy konwerter jest darmowy?', a: [p('Tak, bez konta i bez limitów. Paczka jest konwertowana w twojej przeglądarce i nigdy nie jest wysyłana.')] },
    { id: 'look', q: 'Czy paczka w Bedrocku wygląda tak samo?', a: [p('Przekonwertowane tekstury wyglądają tak samo. W miejsce pominiętych tekstur wchodzą tekstury z Bedrocka, a oświetlenie Bedrocka i Vibrant Visuals mogą sprawić, że kolory wyglądają trochę inaczej.')] },
    { id: 'shaders', q: 'Mogę zamienić paczkę shaderów z Javy na Bedrock?', a: [p('Nie. Bedrock nie wczytuje własnego kodu shaderów. Zamiast tego użyj paczki ', link('/guides/bedrock-vibrant-visuals-settings', 'Vibrant Visuals'), ', którą zrobisz w ', link('/shaders', 'kreatorze shaderów'), '.')] },
    { id: 'png', q: 'Mogę zamienić pliki PNG w .mcpack?', a: [p('Tak. Wybierz PNG albo zip z plikami PNG nazwanymi tak jak tekstury gry (na przykład ', code('stone.png'), ') i przekonwertuj je na Bedrocka.')] },
    { id: 'console', q: 'Mogę używać przekonwertowanej paczki na konsoli?', a: [p('Konsole nie mogą importować plików. Dodaj paczkę do świata na PC albo telefonie i dołącz do tego świata albo użyj Realmu lub serwera, który ją ma.')] },
  ],
  ctaLabel: 'Otwórz konwerter paczek tekstur',
};

// ---------------------------------------------------------------- merge packs

const MERGE_STEPS: Child[] = [
  ['Otwórz ', link('/merge-texture-packs', 'łączenie paczek tekstur'), ' i dodaj od dwóch do ośmiu paczek: pliki ', code('.zip'), ' z Javy albo ', code('.mcpack'), ' z Bedrocka.'],
  'Ustaw je w kolejności, przeciągając albo strzałkami. Tam, gdzie dwie paczki zmieniają ten sam plik, wygrywa paczka na górze.',
  'Nazwij nową paczkę i wybierz jej ikonę. W Javie wybierz też wersję, w którą grasz.',
  ['Kliknij ', strong('Połącz'), ' i przejrzyj listę konfliktów.'],
  'Pobierz połączoną paczkę albo otwórz ją w edytorze, żeby pracować dalej.',
];

const mergePacks: GuideText = {
  image: SHOTS.mergeResult,
  intro: [
    p(
      'Minecraft już umie układać paczki tekstur jedna na drugiej: włącz kilka, a tam, gdzie dwie zmieniają tę samą teksturę, wygrywa ta wyżej na liście. Łączenie robi z kilku paczek jedną, z tą kolejnością wbudowaną na stałe. Przydaje się na serwerze albo Realmie, który przyjmuje tylko jedną paczkę, żeby podzielić się ulubionym zestawem albo żeby mieć krótką listę paczek. Darmowe narzędzie ',
      link('/merge-texture-packs', 'Łączenie paczek tekstur'),
      ' robi to w twojej przeglądarce.',
    ),
  ],
  quick: {
    title: 'W skrócie',
    items: [
      ['Otwórz ', link('/merge-texture-packs', 'łączenie paczek tekstur'), ' i dodaj od dwóch do ośmiu paczek tej samej edycji.'],
      'Przeciągnij je w kolejności: paczka na górze wygrywa każdy konflikt.',
      'Kliknij „Połącz”, sprawdź listę konfliktów i pobierz paczkę.',
    ],
  },
  howto: { name: 'Jak połączyć paczki tekstur do Minecrafta', steps: MERGE_STEPS },
  sections: [
    { id: 'steps', title: 'Krok po kroku', body: [steps(MERGE_STEPS), figure(SHOTS.mergeSettings), figure(SHOTS.mergeResult)] },
    {
      id: 'wins',
      title: 'Która paczka wygrywa?',
      body: [
        p('Ta sama zasada co w Minecrafcie: przy każdym pliku wygrywa paczka, która jest najwyżej na liście. Tekstura i jej plik animacji zawsze zostają razem, więc animacja z niższej paczki nigdy nie trafia do obrazka z wyższej.'),
        p('Niektóre pliki są łączone zamiast zastępowane, żeby nic przydatnego nie zginęło:'),
        ul([
          [strong('Java: '), 'pliki językowe (wpis po wpisie), ', code('sounds.json'), ' (dźwięk po dźwięku), atlasy tekstur i czcionki.'],
          [strong('Bedrock: '), code('terrain_texture.json'), ', ', code('item_texture.json'), ', ', code('flipbook_textures.json'), ', ', code('blocks.json'), ', definicje dźwięków i pliki językowe.'],
        ]),
        p('Wynik wymienia każdy konflikt, na przykład „block/stone.png z paczki A, zastępuje paczkę B”, i ile plików dała każda paczka.'),
      ],
    },
    {
      id: 'versions',
      title: 'Paczki do różnych wersji',
      body: [
        p(
          'Paczki do różnych wersji Javy da się połączyć: wybierz wersję, w którą grasz, a starsze paczki najpierw dostaną jej nazwy tekstur (te same zmiany nazw, których używa ',
          link('/texture-pack-converter', 'konwerter'),
          `), więc paczka do 1.12 i paczka do ${LATEST} będą do siebie pasować. Paczek do Javy i do Bedrocka nie da się połączyć bezpośrednio: najpierw przekonwertuj jedną z nich.`,
        ),
      ],
    },
    {
      id: 'by-hand',
      title: 'Ręczne łączenie paczek',
      body: [
        steps([
          'Rozpakuj każdą paczkę do osobnego folderu.',
          'Zrób nowy folder i skopiuj do niego najpierw paczkę o najniższym priorytecie, potem każdą wyższą na wierzch, zastępując pliki, kiedy komputer zapyta.',
          ['Pliki, które powinny być łączone (', code('sounds.json'), ', pliki językowe, atlasy), połącz ręcznie – inaczej wygra ostatnia kopia.'],
          ['Zostaw jeden ', code('pack.mcmeta'), ' (Java) albo napisz nowy ', code('manifest.json'), ' z nowymi identyfikatorami (Bedrock), a potem spakuj zawartość do zipa.'],
        ]),
        p('Narzędzie robi to wszystko, łącznie z łączonymi plikami i właściwym formatem paczki – ręcznie opłaca się to tylko przy nietypowych paczkach.'),
      ],
    },
  ],
  faq: [
    { id: 'how-many', q: 'Ile paczek mogę połączyć?', a: [p('Od dwóch do ośmiu naraz. Żeby połączyć więcej, połącz wynik jeszcze raz z kolejnymi paczkami.')] },
    { id: 'shaders', q: 'Mogę łączyć paczki shaderów?', a: [p('Nie. Paczki shaderów do Irisa i OptiFine zawsze działają pojedynczo. Paczki zasobów z shaderami bez modów da się połączyć jak każdą paczkę zasobów, ale dwie paczki, które zmieniają ten sam plik shadera, nie łączą swoich efektów.')] },
    { id: 'server', q: 'Mogę użyć połączonej paczki jako paczki zasobów serwera?', a: [p('Tak. Wgraj połączony ', code('.zip'), ' tam, gdzie trzymasz paczki serwera, i wpisz go w ', code('server.properties'), ' jak każdą inną paczkę.')] },
    { id: 'upload', q: 'Czy moje paczki są gdzieś wysyłane?', a: [p('Nie. Paczki są łączone w twojej przeglądarce i zostają na twoim urządzeniu.')] },
  ],
  ctaLabel: 'Połącz paczki tekstur',
};

// ---------------------------------------------------------------- bedrock skin pack

const SKIN_PACK_STEPS: Child[] = [
  ['Otwórz ', link('/skin-pack-maker', 'kreator paczek skinów'), ' i zacznij skina: pusty albo kolorowy szablon, PNG, który już masz, skina gracza Javy po nicku albo jeden z domyślnych skinów. Wybierz szerokie (4 piksele) albo wąskie (3 piksele) ręce.'],
  'Pomaluj go na szablonie 64×64 albo prosto na modelu 3D. Każdy skin jest zapisywany na twoim urządzeniu jako osobny projekt, a jego nazwa to nazwa, którą gracze zobaczą w grze.',
  'Tak samo zrób pozostałe skiny do paczki.',
  ['Otwórz jeden z nich, wybierz ', strong('Eksportuj'), ' › ', strong('Paczka skinów do Bedrocka (.mcpack)'), ', nazwij paczkę, zaznacz pozostałe skiny i naciśnij ', strong('Pobierz paczkę'), '.'],
  ['Otwórz ', code('.mcpack'), ' na Windowsie, Androidzie, iPhonie albo iPadzie. Minecraft go zaimportuje.'],
  ['W Minecrafcie przejdź do ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), ', znajdź swoją paczkę, wybierz skina i stuknij ', strong(BEDROCK.equip), '.'],
];

const bedrockSkinPack: GuideText = {
  image: SHOTS.skinPack,
  intro: [
    p(
      strong('Tak, możesz za darmo zrobić własną paczkę skinów do Minecraft Bedrock.'),
      ` Paczka skinów (skin pack, w polskiej wersji gry „${BEDROCK.skinPack}”) to plik `,
      code('.mcpack'),
      ' z jednym albo kilkoma skinami i dwoma małymi plikami z opisem, ',
      code('manifest.json'),
      ' i ',
      code('skins.json'),
      '. Narysuj albo wgraj skiny w ',
      link('/skin-pack-maker', 'kreatorze paczek skinów'),
      `, pobierz paczkę, otwórz ją na Windowsie, Androidzie, iPhonie albo iPadzie i noś swoje skiny w menu „${BEDROCK.dressingRoom}”. Sprzedawanie paczki na Minecraft Marketplace (w grze „Rynek”) to coś innego: publikują tam tylko partnerzy Marketplace zatwierdzeni przez Mojang.`,
    ),
  ],
  quick: {
    title: 'W skrócie',
    items: [
      ['Narysuj albo wgraj każdego skina w ', link('/skin-pack-maker', 'kreatorze paczek skinów'), ', z szerokimi albo wąskimi rękami.'],
      ['Wybierz ', strong('Eksportuj'), ' › ', strong('Paczka skinów do Bedrocka (.mcpack)'), ', nazwij paczkę i zaznacz pozostałe skiny.'],
      ['Otwórz ', code('.mcpack'), ' i załóż skina w ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), '.'],
    ],
  },
  howto: { name: 'Jak zrobić paczkę skinów do Minecraft Bedrock', steps: SKIN_PACK_STEPS },
  sections: [
    {
      id: 'what',
      title: 'Co jest w paczce skinów?',
      body: [
        p('Paczka skinów to plik zip z rozszerzeniem ', code('.mcpack'), '. Na jej najwyższym poziomie leżą te pliki:'),
        table(
          ['Plik', 'Do czego służy'],
          [
            [code('manifest.json'), ['Nazwa paczki, dwa unikalne identyfikatory (UUID) i numer wersji. Typ modułu ', code('skin_pack'), ' mówi Minecraftowi, że to paczka skinów, a nie paczka tekstur.']],
            [code('skins.json'), ['Lista skinów: dla każdego klucz nazwy, jego PNG, model (', code('geometry.humanoid.custom'), ' dla szerokich rąk, ', code('geometry.humanoid.customSlim'), ' dla wąskich) i ', code('"type": "free"'), '.']],
            ['Obrazki skinów', ['Jeden PNG 64×64 na skina, tuż obok ', code('manifest.json'), '.']],
            [code('texts/en_US.lang'), [`Nazwy w menu „${BEDROCK.dressingRoom}” dla paczki i każdego skina. `, code('texts/languages.json'), ' wymienia pliki językowe.']],
          ],
        ),
        p(code('"type": "free"'), ' znaczy, że każdy, kto ma paczkę, może nosić tego skina. Paczki z Marketplace oznaczają większość skinów jako ', code('"paid"'), ' – te odblokowują się dopiero po zakupie. Dlatego własna paczka zawsze używa „free”.'),
      ],
    },
    {
      id: 'steps',
      title: 'Z kreatorem paczek skinów',
      body: [
        steps(SKIN_PACK_STEPS),
        figure(SHOTS.skinPack),
        p(
          'Kreator zapisuje za ciebie ',
          code('manifest.json'),
          ', ',
          code('skins.json'),
          ' i plik językowy, z nowymi identyfikatorami dla każdej paczki. Szerokie i wąskie skiny mieszczą się w jednej paczce, każdy skin zachowuje swoją nazwę, a nazwa paczki, którą wpiszesz, jest widoczna dla wszystkich nad skinami.',
        ),
        figure(SHOTS.skin3d),
      ],
    },
    {
      id: 'install',
      title: 'Instalacja na Windowsie, Androidzie i iOS',
      body: [
        tabbed(
          'install-skin-pack',
          [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  ['Kliknij dwukrotnie ', code('.mcpack'), '. Minecraft się otworzy i pokaże ', el('em', null, BEDROCK.importStarted), ', a potem ', el('em', null, `${BEDROCK.imported}: …`), '.'],
                  ['Otwórz ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), ', wybierz skina ze swojej paczki i stuknij ', strong(BEDROCK.equip), '.'],
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
                  ['Otwórz ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), ' i załóż skina ze swojej paczki.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Konsole',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation i Switch nie mogą importować paczek skinów ani plików skinów. Na konsolach własny wygląd pochodzi z kreatora postaci albo z paczek skinów z Marketplace.')],
            },
          ],
          UI_PL.platform,
        ),
        callout(
          'tip',
          'Tylko jeden skin?',
          `Do jednego skina nie potrzebujesz paczki: w „${BEDROCK.classicSkins}” otwórz „${BEDROCK.ownedSkins}”, wybierz „${BEDROCK.import}” i wskaż PNG 64×64. Paczka jest wygodniejsza przy kilku skinach, zachowuje ich nazwy i instaluje się tak samo na każdym urządzeniu.`,
        ),
      ],
    },
    {
      id: 'update',
      title: 'Aktualizacja albo usuwanie paczki skinów',
      body: [
        p('Żeby zmienić już zaimportowaną paczkę, edytuj skiny, wyeksportuj paczkę jeszcze raz z tego samego projektu i otwórz nowy plik. Kreator zachowuje oba identyfikatory paczki i podnosi jej wersję (1.0.0, potem 1.0.1 i tak dalej), więc Minecraft zastąpi zainstalowaną paczkę, zamiast pokazywać ją dwa razy.'),
        p('Paczka zrobiona ręcznie? Zachowaj oba UUID i podnieś wersję w ', code('manifest.json'), ', w nagłówku i w module. Nowe UUID dają drugą paczkę, a ta sama wersja nie zaimportuje się drugi raz, bo paczka jest już zainstalowana.'),
        p('Żeby ją usunąć, przejdź do ', uiPath(BEDROCK.settings, BEDROCK.storage), ', wybierz paczkę i ją usuń.'),
      ],
    },
    {
      id: 'arms',
      title: 'Szerokie czy wąskie ręce',
      body: [
        p(
          'Każdy skin w paczce ma własny model, więc paczka może mieszać oba. ',
          strong('Szerokie'),
          ' ręce (Steve) mają 4 piksele szerokości i używają ',
          code('geometry.humanoid.custom'),
          '; ',
          strong('wąskie'),
          ' ręce (Alex) mają 3 piksele szerokości i używają ',
          code('geometry.humanoid.customSlim'),
          '. Model musi pasować do tego, jak skin był malowany, bo inaczej ręce wyglądają na ucięte albo mają przezroczysty pasek.',
        ),
        p('Zaimportowane paczki mogą używać tylko tych dwóch modeli. Własne kształty, na przykład ogromna głowa, są niedozwolone w paczce skinów importowanej samodzielnie.'),
      ],
    },
    {
      id: 'by-hand',
      title: 'Ręczne budowanie paczki skinów',
      body: [
        p('Pliki możesz też napisać samodzielnie w dowolnym edytorze tekstu. Paczka z dwoma skinami wygląda tak:'),
        pre(SKIN_PACK_TREE),
        p(code('manifest.json'), ' potrzebuje dwóch różnych UUID. Wygeneruj własne dowolnym generatorem UUID, zamiast kopiować te niżej, i zachowaj je na późniejsze aktualizacje:'),
        pre(SKIN_PACK_MANIFEST.trimEnd()),
        p(code('skins.json'), ' wymienia skiny. ', code('serialize_name'), ' i ', code('localization_name'), ' to identyfikator paczki: jedno słowo bez spacji, którego nie używa żadna inna paczka. Kreator paczek skinów dla pewności dokleja początek UUID paczki.'),
        pre(SKIN_PACK_SKINS_JSON.trimEnd()),
        p(code('texts/en_US.lang'), ' zawiera nazwy pokazywane w grze, a ', code('texts/languages.json'), ' zawiera ', code('["en_US"]'), ':'),
        pre(SKIN_PACK_LANG.trimEnd()),
        steps([
          ['Ułóż pliki w folderze jak wyżej, z plikami PNG tuż obok ', code('manifest.json'), '.'],
          'Zaznacz pliki w folderze, a nie sam folder, i spakuj je do zipa.',
          ['Zmień rozszerzenie zipa z ', code('.zip'), ' na ', code('.mcpack'), ' i go otwórz.'],
        ]),
        p('Jeśli import się nie udaje, zwykle winny jest folder wokół plików w zipie, literówka w JSON-ie albo dwa takie same UUID. ', link('/skin-pack-maker', 'Kreator paczek skinów'), ' pisze dokładnie te pliki – możesz więc też wyeksportować paczkę, zmienić rozszerzenie na ', code('.zip'), ' i zajrzeć do środka.'),
      ],
    },
    {
      id: 'marketplace',
      title: 'Paczki z Marketplace a własne paczki',
      body: [
        p('Chcesz zrobić paczkę skinów na Minecraft Marketplace? Publikują tam tylko partnerzy Marketplace: studia i twórcy, których Mojang przyjął do programu partnerskiego i którzy wysyłają każdą paczkę do sprawdzenia. Z gry ani ze strony internetowej nie da się wgrać paczki na Marketplace.'),
        ul([
          [strong('Własna paczka skinów: '), 'za darmo, może ją zrobić każdy, importuje się z pliku ', code('.mcpack'), ' na Windowsie, Androidzie, iPhonie i iPadzie. Plikiem możesz podzielić się ze znajomymi.'],
          [strong('Paczka skinów z Marketplace: '), 'zrobiona przez zatwierdzonego partnera, kupiona za Minecoins albo darmowa, dostępna na każdym urządzeniu, także na konsolach.'],
        ]),
        p('Wkładaj do paczki tylko skiny, które zrobisz samodzielnie albo którymi wolno ci się dzielić.'),
      ],
    },
    {
      id: 'trusted',
      title: 'Dlaczego znajomi mogą widzieć domyślnego skina',
      body: [
        p('Bedrock ma ustawienie ', strong(BEDROCK.trustedSkins), '. Gracze, którzy je włączą, widzą każdy własny skin, także te z zaimportowanych paczek, jako domyślnego skina, takiego jak Steve czy Alex. To ustawienie po ich stronie, więc nie możesz go za nich zmienić. Wszyscy inni widzą twojego skina tak, jak go zrobisz.'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: 'Czy można za darmo robić paczki skinów do Minecraft Bedrock?', a: [p('Tak. Własne paczki skinów robi się i używa za darmo, na Windowsie, Androidzie, iPhonie i iPadzie. Kreator paczek skinów nie wymaga konta, a twoje skiny zostają na twoim urządzeniu.')] },
    { id: 'java', q: 'Czy paczki skinów działają w Java Edition?', a: [p('Nie. Paczki skinów są tylko w Bedrocku. W Javie nosisz jednego skina naraz, wgranego jako PNG w Minecraft Launcherze. ', link('/guides/make-a-skin', 'Jak zrobić skina'), '.')] },
    { id: 'console', q: 'Mogę używać własnej paczki skinów na Xboksie, PlayStation albo Switchu?', a: [p('Nie. Konsole nie mogą importować paczek skinów ani plików skinów. Windows, Android, iPhone i iPad mogą.')] },
    { id: 'marketplace', q: 'Mogę sprzedawać moją paczkę skinów na Marketplace?', a: [p('Tylko jako zatwierdzony partner Minecraft Marketplace. Własną paczką możesz się dzielić jako plikiem .mcpack, ale nie możesz jej sprzedawać w grze.')] },
    { id: 'failed', q: 'Dlaczego import się nie udaje?', a: [p('Zwykle w zipie jest folder wokół plików, JSON ma literówkę, oba UUID są takie same albo paczka z tymi samymi identyfikatorami i tą samą wersją jest już zainstalowana. Paczki z kreatora paczek skinów unikają wszystkich czterech błędów.')] },
  ],
  ctaLabel: 'Otwórz kreator paczek skinów',
};
