// Polish help page (see HelpText in src/tools/help/content.ts). Menu names are the ones the Polish
// game shows (./game-ui.ts).

import { el, type Child } from '../../app/markup';
import { backupButtons, callout, code, ext, folderTable, link, steps, strong, tabbed, uiPath } from '../../app/content/blocks';
import { REPO_URL } from '../../app/site';
import { F, LATEST, maxFormat, minFormat } from '../../app/content/facts';
import type { HelpText } from '../../tools/help/content';
import { UI_PL } from './ui';
import { BEDROCK, IRIS, JAVA, LAUNCHER, OPTIFINE } from './game-ui';

const p = (...c: Child[]) => el('p', null, ...c);
const FOLDER = UI_PL.folderTable;

const JAVA_PACK_STEPS: Child[] = [
  ['Wyeksportuj paczkę z Texture Pack Maker. Dostaniesz plik w rodzaju ', code('Moja paczka.zip'), '.'],
  ['Uruchom Minecraft Java Edition i otwórz ', uiPath(JAVA.options, JAVA.packs), '.'],
  ['Kliknij ', uiPath(JAVA.openFolder), '. Otworzy się folder ', code('resourcepacks'), '.'],
  ['Wrzuć ', code('.zip'), ` do tego folderu. Możesz też przeciągnąć go prosto na ekran „${JAVA.packsScreen}”.`],
  ['Na liście ', strong(JAVA.available), ' najedź myszką na swoją paczkę i kliknij strzałkę, żeby przenieść ją na listę ', strong(JAVA.selected), '. Paczki wyżej na liście wygrywają. Kliknij ', strong(JAVA.done), '.'],
];

const BEDROCK_PACK_STEPS: Child[] = [
  ['Wyeksportuj paczkę. Dostaniesz plik w rodzaju ', code('Moja paczka.mcpack'), '.'],
  ['Kliknij plik dwukrotnie. Minecraft się otworzy i pokaże ', el('em', null, BEDROCK.importStarted), ', a potem ', el('em', null, `${BEDROCK.imported}: …`), '.'],
  ['Przejdź do ', uiPath(BEDROCK.settings, BEDROCK.globalResources, BEDROCK.myPacks), ', wybierz swoją paczkę i stuknij ', strong(BEDROCK.activate), '.'],
  'Masz kilka aktywnych paczek? Przesuń swoją na górę, żeby wygrywała.',
];

const JAVA_SKIN_STEPS: Child[] = [
  ['Otwórz Minecraft Launcher i wybierz ', uiPath('Minecraft: Java Edition', LAUNCHER.skins), '.'],
  ['Kliknij ', strong(LAUNCHER.newSkin), ' (kartę z plusem).'],
  ['Nadaj mu nazwę i wybierz model gracza: ', strong(LAUNCHER.classic), ' albo ', strong(LAUNCHER.slim), '.'],
  ['Kliknij ', strong(LAUNCHER.browse), ', wybierz swój PNG, a potem ', strong(LAUNCHER.saveAndUse), '.'],
];

const BEDROCK_SKIN_STEPS: Child[] = [
  ['Wyeksportuj jako ', strong('paczkę skinów do Bedrocka'), '. Dostaniesz plik ', code('.mcpack'), '.'],
  'Otwórz plik (dwukrotnym kliknięciem na Windowsie, „Otwórz w Minecraft” na telefonach i tabletach), żeby go zaimportować.',
  ['W Minecrafcie przejdź do ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), '. Twoja paczka jest wśród zaimportowanych paczek.'],
  ['Wybierz swojego skina i stuknij ', strong(BEDROCK.equip), '.'],
];

const IRIS_STEPS: Child[] = [
  ['Pobierz Iris Installer z ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), '. Za jednym razem zainstaluje Fabric Loader, Iris i Sodium dla twojej wersji.'],
  ['Otwórz Minecraft Launcher, wybierz nowy profil ', strong('Iris & Sodium'), ' i uruchom grę raz.'],
  ['Wyeksportuj paczkę shaderów z kreatora shaderów (plik ', code('.zip'), ' – nie rozpakowuj go).'],
  ['W grze otwórz ', uiPath(JAVA.options, JAVA.video, IRIS.shaderPacks), ' i kliknij ', strong(IRIS.openFolder), '. Wrzuć tam zipa.'],
  ['Wybierz swoją paczkę i kliknij ', strong(IRIS.apply), '. W ', strong(IRIS.settings), ' dostroisz opcje w grze.'],
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Wyeksportuj z celem ', strong('czysta Java'), '. Dostaniesz paczkę zasobów jako ', code('.zip'), '.'],
  ['Zainstaluj ją jak paczkę tekstur: ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), ', wrzuć zipa.'],
  `Przenieś ją na listę „${JAVA.selected}” i kliknij „${JAVA.done}”. Nowy wygląd działa od razu.`,
];

const VIBRANT_STEPS: Child[] = [
  ['Wyeksportuj paczkę (', code('.mcpack'), ') i otwórz plik, żeby ją zaimportować.'],
  ['Przejdź do ', uiPath(BEDROCK.settings, BEDROCK.globalResources, BEDROCK.myPacks), ' i ją aktywuj.'],
  ['Otwórz ', uiPath(BEDROCK.settings, BEDROCK.video), ' i ustaw ', strong(BEDROCK.graphicsMode), ' na ', strong(BEDROCK.vibrantVisuals), ' (Vibrant Visuals).'],
];

export const HELP: HelpText = {
  sections: {
    'java-packs': {
      title: 'Paczki tekstur w Javie',
      short: 'Paczki Java',
      howto: { name: 'Jak zainstalować paczkę tekstur (paczkę zasobów) w Minecraft Java Edition', steps: JAVA_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Java Edition nazywa paczki tekstur ', el('em', null, 'paczkami zasobów'), '. Twój eksport to plik ', code('.zip'), ' – nie rozpakowuj go.'),
        steps(JAVA_PACK_STEPS),
        callout(
          'info',
          `„${JAVA.madeForOlder}” (albo nowszej)?`,
          'Paczki są zapisywane dla wersji, którą wybierasz w edytorze. Jeśli grasz w inną wersję, zmień wersję docelową albo zakres zgodności w zakładce ',
          strong('Paczka'),
          ' i wyeksportuj jeszcze raz. Paczki, które zmieniają tylko tekstury, zwykle i tak działają – możesz kliknąć ',
          strong(JAVA.yes),
          ', żeby jej mimo to użyć.',
        ),
        el('h3', { class: 'guide-sub' }, 'Gdzie jest folder'),
        folderTable('resourcepacks', FOLDER),
      ],
    },
    'bedrock-packs': {
      title: 'Paczki tekstur w Bedrocku',
      short: 'Paczki Bedrock',
      howto: { name: 'Jak zainstalować paczkę tekstur do Bedrocka (.mcpack) na Windowsie', steps: BEDROCK_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Paczki do Bedrocka eksportują się jako pliki ', code('.mcpack'), '. Kiedy otworzysz taki plik, Minecraft sam go zaimportuje.'),
        tabbed(
          'bedrock-packs',
          [
            { value: 'windows', label: 'Windows', icon: 'monitor', content: [steps(BEDROCK_PACK_STEPS)] },
            {
              value: 'mobile',
              label: 'Android i iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Pobierz ', code('.mcpack'), ' na telefon albo tablet.'],
                  [strong('Android: '), 'otwórz go w pobranych plikach albo aplikacji Pliki i wybierz ', strong('Minecraft'), '. ', strong('iPhone / iPad: '), 'stuknij plik w aplikacji Pliki, a potem ', uiPath('Udostępnij', 'Minecraft'), '.'],
                  ['Minecraft zaimportuje paczkę. Potem otwórz ', uiPath(BEDROCK.settings, BEDROCK.globalResources), ' i ją aktywuj.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Konsole',
              icon: 'gamepad',
              content: [
                el(
                  'p',
                  { class: 'muted' },
                  'Xbox, PlayStation i Switch nie mogą importować plików .mcpack. Dodaj paczkę do świata na PC albo telefonie i dołącz do tego świata albo graj na Realmie lub serwerze, który ma tę paczkę.',
                ),
              ],
            },
          ],
          UI_PL.platform,
        ),
        callout('tip', 'Tylko do jednego świata?', `Zamiast „${BEDROCK.globalResources}” otwórz `, uiPath(BEDROCK.editWorld, BEDROCK.packs), ' i aktywuj paczkę tam.'),
        callout(
          'info',
          'Aktualizacja paczki, która jest już zaimportowana',
          'Każdy eksport zachowuje ten sam identyfikator paczki i podnosi numer wersji, więc ponowny import zastępuje starą kopię, zamiast robić duplikat.',
        ),
      ],
    },
    'java-skins': {
      title: 'Skiny w Javie',
      short: 'Skiny Java',
      howto: { name: 'Jak zmienić skina w Minecraft Java Edition', steps: JAVA_SKIN_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Wyeksportuj skina jako ', code('.png'), '. Zapamiętaj, czy malujesz na modelu ', strong(LAUNCHER.classic), ' (ręce o szerokości 4 pikseli), czy ', strong(LAUNCHER.slim), ' (ręce o szerokości 3 pikseli).'),
        tabbed(
          'java-skins',
          [
            { value: 'launcher', label: 'Minecraft Launcher', icon: 'monitor', content: [steps(JAVA_SKIN_STEPS)] },
            {
              value: 'web',
              label: 'minecraft.net',
              icon: 'globe',
              content: [
                steps([
                  ['Zaloguj się na ', ext('https://www.minecraft.net/', 'minecraft.net'), ' i otwórz swój profil.'],
                  ['W sekcji skina wybierz model ', strong(LAUNCHER.classic), ' albo ', strong(LAUNCHER.slim), '.'],
                  ['Wgraj swój PNG i potwierdź. W grze pojawi się, gdy następnym razem wejdziesz do świata albo na serwer.'],
                ]),
              ],
            },
          ],
          UI_PL.platform,
        ),
        callout('info', 'Grasz w 1.7.10 albo starszą?', 'Te wersje znają tylko stary układ 64×32. Użyj opcji eksportu ', strong('Stary skin do Javy (64×32)'), '.'),
      ],
    },
    'bedrock-skins': {
      title: 'Skiny w Bedrocku',
      short: 'Skiny Bedrock',
      howto: { name: 'Jak zainstalować paczkę skinów do Bedrocka (.mcpack)', steps: BEDROCK_SKIN_STEPS },
      body: [
        tabbed(
          'bedrock-skins',
          [
            { value: 'pack', label: 'Paczka skinów (.mcpack)', icon: 'package', content: [steps(BEDROCK_SKIN_STEPS)] },
            {
              value: 'png',
              label: 'Jeden PNG',
              icon: 'image',
              content: [
                steps([
                  ['Wyeksportuj skina jako ', code('.png'), '.'],
                  ['Otwórz ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), ' i w sekcji ', strong(BEDROCK.ownedSkins), ' wybierz puste pole ', strong(BEDROCK.import), '.'],
                  ['Wybierz swój PNG, a potem model z szerokimi albo wąskimi rękami.'],
                ]),
              ],
            },
          ],
          UI_PL.platform,
        ),
        callout(
          'warn',
          'Znajomi widzą domyślnego skina?',
          'Gracze, którzy mają włączoną opcję ',
          strong(BEDROCK.trustedSkins),
          ', widzą własne skiny jako domyślne. To ich własne ustawienie. Konsole nie mogą importować plików skinów.',
        ),
      ],
    },
    iris: {
      title: 'Shadery z Irisem albo OptiFine',
      short: 'Iris / OptiFine',
      howto: { name: 'Jak zainstalować paczkę shaderów z Irisem', steps: IRIS_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Klasyczne paczki shaderów potrzebują moda do shaderów. ', strong('Iris'), ' jest najprostszy i najszybszy; OptiFine też działa.'),
        tabbed(
          'iris',
          [
            { value: 'iris', label: 'Iris (polecany)', icon: 'sparkles', content: [steps(IRIS_STEPS)] },
            {
              value: 'optifine',
              label: 'OptiFine',
              icon: 'gear',
              content: [
                steps([
                  ['Zainstaluj OptiFine dla swojej wersji Minecrafta z ', ext('https://optifine.net/', 'optifine.net'), ' i uruchom grę raz z profilem OptiFine.'],
                  ['Otwórz ', uiPath(JAVA.options, JAVA.video, OPTIFINE.shaders), ' i kliknij ', strong(OPTIFINE.folder), '.'],
                  'Wrzuć wyeksportowanego zipa do folderu, a potem wybierz go na liście.',
                ]),
              ],
            },
          ],
          UI_PL.platform,
        ),
        el('h3', { class: 'guide-sub' }, 'Folder z paczkami shaderów'),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    'vanilla-shaders': {
      title: 'Shadery bez modów (czysta Java)',
      short: 'Shadery bez modów',
      howto: { name: 'Jak zainstalować paczkę shaderów bez modów w Minecraft Java', steps: VANILLA_SHADER_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Działają w zwykłej grze, bo są ', strong('paczką zasobów'), ', która podmienia część własnych plików shaderów Minecrafta.'),
        steps(VANILLA_SHADER_STEPS),
        callout(
          'warn',
          'Zrobione dla jednej konkretnej wersji',
          'Mojang często zmienia pliki shaderów, dlatego paczka shaderów bez modów działa tylko w wersji, dla której ją zrobiono. Po aktualizacji Minecrafta otwórz swój projekt, wybierz nową wersję i wyeksportuj jeszcze raz.',
        ),
      ],
    },
    'vibrant-visuals': {
      title: 'Vibrant Visuals w Bedrocku',
      short: 'Vibrant Visuals',
      howto: { name: 'Jak używać paczki Vibrant Visuals w Minecraft Bedrock', steps: VIBRANT_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, `„Shadery” w Bedrocku to paczki ustawień Vibrant Visuals (w polskiej wersji gry „${BEDROCK.vibrantVisuals}”): światło, niebo, color grading, woda i mgła.`),
        steps(VIBRANT_STEPS),
        callout(
          'warn',
          'Nie da się wybrać Vibrant Visuals?',
          'Minecraft pozwala na to tylko wtedy, gdy każda aktywna paczka je obsługuje. Klasyczne paczki tekstur (także te, które robisz w Texture Pack Maker) je wyłączają, więc wyłącz inne paczki, kiedy używasz tej. Niektóre serwery też je wyłączają.',
        ),
        callout(
          'info',
          'Potrzebne jest obsługiwane urządzenie',
          'Vibrant Visuals działa na komputerach z Windowsem i DirectX 12, Xboksie i PlayStation (na Xbox One i PS4 jest na początku wyłączone), iPhonie i iPadzie od układu A12 i wielu nowych urządzeniach z Androidem. Nie ma go na pierwszym Nintendo Switch, Chromebookach i tabletach Fire. ',
          strong('Dostosowanie klasycznej mgły'),
          ' działa też w innych trybach grafiki.',
        ),
      ],
    },
    folders: {
      title: 'Gdzie jest folder Minecrafta',
      short: 'Foldery',
      body: [
        el('p', { class: 'guide-intro' }, 'Najszybciej jest przyciskiem ', strong(JAVA.openFolder), ' w Minecrafcie. Jeśli potrzebujesz ścieżki:'),
        el(
          'table',
          { class: 'paths-table' },
          el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'Co'), el('th', { scope: 'col' }, 'Gdzie'))),
          el(
            'tbody',
            null,
            el('tr', null, el('th', { scope: 'row' }, 'Java na Windowsie'), el('td', null, code('%APPDATA%\\.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java na macOS'), el('td', null, code('~/Library/Application Support/minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java na Linuksie'), el('td', null, code('~/.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Pliki gry (.jar)'), el('td', null, code('.minecraft/versions/<version>/<version>.jar'))),
            el('tr', null, el('th', { scope: 'row' }, 'Bedrock na Windowsie'), el('td', null, code('%APPDATA%\\Minecraft Bedrock\\users\\shared\\games\\com.mojang'))),
          ),
        ),
        el('p', { class: 'muted small' }, 'Na Windowsie wklej ścieżkę do paska adresu Eksploratora plików albo do okna Uruchamianie (Win + R).'),
      ],
    },
    backup: {
      title: 'Kopie zapasowe i przenoszenie projektów',
      short: 'Kopie zapasowe',
      body: [
        el('p', { class: 'guide-intro' }, 'Twoje projekty są zapisane tylko w tej przeglądarce. Jeśli usuniesz dane strony albo zmienisz przeglądarkę czy urządzenie, zostaną tutaj. Dlatego trzymaj kopię w pliku.'),
        backupButtons('Zapisz wszystkie projekty', 'Otwórz kopię zapasową'),
        el(
          'ul',
          { class: 'guide-list' },
          el('li', null, strong('Plik projektu'), ' (', code('.tpmproject'), '): jeden projekt ze wszystkim, czego potrzebujesz, żeby pracować dalej, na przykład zmienione tekstury, dźwięki i modele, efekty, wersja i edycja, skiny z paczki skinów, ustawienia shaderów i znaki czcionki. Zapisz go w edytorze przyciskiem ', strong('Zapisz plik projektu'), ' albo z menu projektu.'),
          el('li', null, strong('Kopia zapasowa'), ' (', code('.tpmbackup'), '): wszystkie paczki tekstur, skiny i shadery z tej przeglądarki, a do tego twoja peleryna i czcionka, w jednym pliku.'),
        ),
        el('h3', { class: 'guide-sub' }, 'Otwieranie w innej przeglądarce albo na innym urządzeniu'),
        steps([
          'Otwórz tam Texture Pack Maker (albo zainstalowaną aplikację).',
          ['Przeciągnij plik na obszar ', strong('Otwórz'), ' w edytorze albo użyj ', strong('Otwórz plik projektu'), '. Projekt otworzy się w swoim edytorze jako nowy projekt i niczego nie zastąpi.'],
          ['Przy kopii zapasowej wybierasz, co przywrócić. Projekty, które już są, zostaną pominięte albo, z opcją ', strong('Zachowaj oba'), ', zapisane obok twoich.'],
        ]),
        callout('info', 'To nie to samo co eksport', 'Wyeksportowany .zip albo .mcpack jest dla gry. Plik projektu zapisuje też stan edytora, więc wracasz dokładnie do miejsca, w którym przerwano pracę. Samych plików gry nie ma w żadnym z nich: znowu przychodzą od Mojang.'),
      ],
    },
  },
  faq: [
    {
      id: 'vanilla-source',
      q: 'Skąd pochodzą zwykłe tekstury z gry?',
      a: [
        p(
          'Kiedy zaczynasz projekt do Javy, twoja przeglądarka pobiera oficjalny plik gry tej wersji prosto z serwerów Mojang i zostawia na tym urządzeniu tylko tekstury, modele i shadery. Tekstury Bedrocka pochodzą z oficjalnego repozytorium Mojang ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' na GitHubie.',
        ),
        p('Nic od Mojang nie jest przechowywane w samym Texture Pack Maker – to statyczna strona bez własnych serwerów.'),
      ],
    },
    {
      id: 'paint-3d',
      q: 'Mogę malować na modelu 3D zamiast na płaskiej teksturze?',
      a: [
        p(
          'Tak. W edytorze tekstur użyj przełącznika ',
          strong('2D / 3D'),
          ' nad obszarem rysowania (albo naciśnij D). Każda ściana maluje dokładnie ten piksel, który pokazuje, także przy obróconych ścianach, nakładkach takich jak bok trawy, stanach włączonych i wyłączonych, skrzyniach i łóżkach. Działają ołówek, gumka, wypełnianie, wybór koloru (albo Alt + klik), rozmiar pędzla i odbicie lustrzane, a każda tekstura ma własne cofanie. Przeciąganie prawym przyciskiem albo dwoma palcami obraca model, przewijanie albo szczypanie przybliża, a F, B, L, R i T przeskakują do ściany.',
        ),
      ],
    },
    {
      id: 'mobs',
      q: 'Mogę edytować tekstury mobów?',
      a: [
        p(
          'Tak. Wybierz ',
          strong('Moby'),
          ' na liście tekstur (Bloki · Rzeczy · Moby · Całość) albo otwórz dowolną teksturę z folderu „entity”. Mob pojawi się w 3D i maluje się go jak blok. Polami wyboru obok (wariant, wiek, kolor wełny, profesja i tak dalej) dotrzesz do każdej tekstury, której używa; nakładki, takie jak wełna owcy, świecące oczy i ubrania osadników, malujesz na ich własnych teksturach. Na liście „Części” jednym kliknięciem ukrywasz część, żeby pomalować to, co zasłania, dwukrotne kliknięcie pokazuje tylko tę część, a „Pokaż wszystko” przywraca wszystko. Moby z Bedrocka używają własnych modeli Bedrocka, a maski barwienia w ich przezroczystych pikselach zostają zachowane.',
        ),
      ],
    },
    {
      id: 'gear',
      q: 'Mogę edytować siodła, zbroje i zbroje dla koni?',
      a: [
        p(
          'Tak. Moby, które mogą coś nosić, mają obok pól wyboru grupę ',
          strong('Noszone'),
          ': załóż siodło świni, magmołazowi, koniowi, wielbłądowi albo łodzikowi; ubierz w zbroję zombie, szkielety, pigliny i stojak na zbroję (wybierz materiał dla całego zestawu, potem włączaj i wyłączaj pojedyncze części, skórę farbuj przyciskiem ',
          strong('Barwnik'),
          '); daj koniom, wilkom i łodzikom ich zbroję, lamom dywan, a wesołemu ghastowi uprząż. Każda noszona część jest malowana na własnej teksturze i ma własny wpis w ',
          strong('Części'),
          ', więc możesz ją ukryć, żeby pomalować moba pod spodem. Kiedy otworzysz teksturę zbroi, siodła albo dywanu, zobaczysz ją na mobie, a ',
          strong('Używają'),
          ' wymienia każdego moba, który ją nosi. Starsze wersje używają tekstur zbroi i siodeł, które miały wtedy.',
        ),
        p(
          strong('Zdobienia zbroi: '),
          'kiedy humanoidalny mob nosi zbroję, w Noszone wybierasz wzór ',
          strong('Zdobienie'),
          ' i ',
          strong('Materiał zdobienia'),
          ' (Java od 1.20 i Bedrock). Gra koloruje szary wzór paletą materiału, a ciemniejszej palety używa, gdy zdobienie i zbroja są z tego samego materiału, na przykład żelazne zdobienie na żelaznej zbroi. Maluj zdobienie na modelu albo otwórz jego wzór: osiem odcieni szarości przyjmuje kolor zdobienia, a każdy inny kolor zostaje taki, jak go namalujesz. Zmień paletę materiału, żeby przekolorować go na każdym zdobieniu, i ukryj ',
          strong('Zdobienie'),
          ' w Częściach, żeby dostać się do zbroi pod spodem.',
        ),
      ],
    },
    {
      id: 'models',
      q: 'Mogę zmienić kształt bloków i przedmiotów, na przykład zrobić miecz 3D?',
      a: [
        p(
          'Tak, w paczkach do Javy (Minecraft od 1.8). Pokaż blok albo przedmiot w podglądzie i naciśnij ',
          strong('Edytuj kształt'),
          '. Edytor modeli otworzy model, którego używa gra, złożony z jego modeli nadrzędnych. Dodawaj sześciany, kopiuj je i usuwaj, wpisuj pozycję i rozmiar albo przeciągaj strzałki i uchwyty w 3D, przyciągane do siatki 16 × 16 albo drobniejszej, i obracaj sześcian wokół osi (przed Minecraftem 1.21.6 co 22,5°). W ',
          strong('Ściany'),
          ' każda ściana dostaje teksturę z twojej paczki albo nową, którą pomalujesz później, i przeciągasz fragment tekstury, który pokazuje; do tego obrót, kiedy jest ukrywana i czy jest barwiona. ',
          strong('Widok'),
          ' ustala, jak model wygląda w ekwipunku, w widoku z pierwszej i trzeciej osoby, na ziemi, w ramce i na głowie, każde z podglądem. Każdą zmianę można cofnąć.',
        ),
        p(
          'Na start bierzesz model z gry, pusty model, pełny sześcian, płytę, krzyżyk jak u kwiatów albo, dla przedmiotów, ',
          strong('Przedmiot 3D ze sprite’a'),
          ': płaski obrazek zamienia się w sześciany o głębokości 1 piksela, połączone w jak najmniej. Od 1.21.4 ',
          strong('Płaski w ekwipunku'),
          ' zostawia płaską ikonę w ekwipunku i pokazuje model 3D w ręce. Do paczki trafia plik modelu, a definicja przedmiotu albo stan bloku tylko wtedy, gdy gra ich potrzebuje; eksport sprawdza modele dla twojej wersji, a pliki modeli z otwartych paczek zostają i można je edytować. W Bedrocku nowe kształty bloków wymagają dodatku, a przedmioty 3D w ręce plików attachable, których edytor nie tworzy; możesz jednak pobrać model jako geometrię Bedrocka i na niej budować. Krok po kroku: ',
          link('/guides/make-3d-items-texture-pack', 'Jak zrobić przedmioty 3D'),
          '.',
        ),
      ],
    },
    {
      id: 'pvp',
      q: 'Mogę zrobić paczkę PvP albo FPS?',
      a: [
        p(
          'Tak. Przy tworzeniu paczki wybierz ', strong('Paczka PvP / FPS'), ': edytor włączy niski ogień, czyste szkło i szyby, brak ramki dyni, mniejszy celownik, mniejsze miecze i niżej trzymaną tarczę, o ile twoja wersja je ma. W zakładce ', strong('PvP'), ' każde z nich ma przełącznik, z opcjami takimi jak wysokość ognia, pięć celowników albo własnoręcznie narysowany i rozmiar miecza, do tego opcje FPS: tekstury 8× i brak animacji. Każda opcja zapisuje zwykłe pliki paczki dla twojej wersji (od Javy 1.6.1 do 26.3, z nazwami plików z 1.8.9) i można ją wyłączyć albo cofnąć. W Bedrocku działają czyste szkło, ramka dyni, celownik i tekstury 8×; ognia i trzymanych przedmiotów paczka nie może tam zmienić. Przybliżenie, licznik FPS albo brak mgły wymagają modów. Krok po kroku: ',
          link('/guides/make-a-pvp-texture-pack', 'Jak zrobić paczkę PvP'),
          '.',
        ),
      ],
    },
    {
      id: 'fonts',
      q: 'Mogę zmienić czcionkę w Minecrafcie?',
      a: [
        p(
          'Tak, ', link('/font-maker', 'kreatorem czcionek'), ': narysuj swoje litery piksel po pikselu, zacznij od wbudowanego stylu albo zamień czcionkę TTF, OTF lub WOFF na piksele i sprawdź ją na czacie, tabliczkach i w książkach. Java od 1.13 dostaje ', code('font/default.json'), ', który zastępuje tylko narysowane znaki (można dodać też plik TrueType); Java od 1.6.1 do 1.12.2 dostaje ', code('textures/font/ascii.png'), '; Bedrock dostaje ', code('font/default8.png'), ' i strony znaków. Jeśli w Javie tekst dalej wygląda zwyczajnie, wyłącz opcję „Czcionka unikodowa” w Ustawienia… › Język….',
        ),
      ],
    },
    {
      id: 'sounds',
      q: 'Mogę zmienić dźwięki w mojej paczce?',
      a: [
        p('Tak. W edytorze paczek tekstur naciśnij nutkę na końcu przełącznika Bloki · Rzeczy · Moby · Całość. Znajdź dźwięk po nazwie albo kategorii i naciśnij Odtwórz, żeby go usłyszeć. Otwórz go i zastąp plik przyciskiem ', strong('Zastąp'), ' własnym audio (MP3, WAV, OGG, M4A i inne) albo nagraj go mikrofonem. Przeciągaj uchwyty na wykresie fali, żeby przyciąć, ustaw głośność albo naciśnij ', strong('Normalizuj'), '; opcją Przywróć dźwięk z gry wracasz do oryginału. Podmienione dźwięki są zapisywane jako Ogg Vorbis i eksportowane z paczką: paczki do Javy kładą je w ', code('assets/minecraft/sounds'), ', paczki do Bedrocka w ', code('sounds/'), ' z pasującymi wpisami w ', code('sound_definitions.json'), '.'),
        p('Nagrywanie pyta o mikrofon dopiero po naciśnięciu Zacznij nagrywać; jeśli jest zablokowany, zezwól na niego dla tej strony ikoną w pasku adresu. Nagrania nigdy nie opuszczają twojego urządzenia. Większość dźwięków trzymaj w mono, żeby dochodziły z miejsca w świecie, a stereo używaj do muzyki i dźwięków menu. Dźwięki Javy przychodzą prosto z serwerów Mojang, które nie pozwalają stronom czytać audio: możesz ich posłuchać, ale przycinać możesz tylko wgrane albo nagrane dźwięki. Edycja dźwięków działa od Javy 1.7.10 i w Bedrocku.'),
      ],
    },
    {
      id: 'hd-skins',
      q: 'Mogę zrobić skina HD 128×128?',
      a: [
        p('Tak, do Bedrock Edition. Skiny HD mają dwa razy więcej pikseli niż zwykły skin (128×128 zamiast 64×64), więc twarze, cieniowanie i wzory są dokładniejsze. Zaczynając skina w edytorze skinów, wybierz w ', strong('Rozmiar'), ' opcję ', strong('HD 128×128'), ' albo przełącz gotowego skina w edytorze przez ', strong('Rozmiar'), ' › ', strong('HD 128'), ': każdy piksel zostaje podwojony, więc skin wygląda tak samo, dopóki nie dodasz szczegółów. Wyeksportuj ', strong('Skin do Bedrocka (.png)'), ' do importu w Przebieralni albo ', strong('Paczka skinów do Bedrocka (.mcpack)'), '. Paczka skinów może mieszać zwykłe skiny i skiny HD.'),
        p('Java Edition bez modów przyjmuje tylko skiny 64×64. Dlatego eksport do Javy robi kopię 64×64 (każdy blok 2×2 staje się jednym pikselem) i zachowuje twój oryginał HD. Z modem do skinów HD, takim jak CustomSkinLoader, wybierz zamiast tego ', strong('128×128 do modów'), '. Konsole nie mogą importować plików skinów, a rozmiary powyżej 128×128 nie są obsługiwane. Skiny HD działają też w kreatorze totemów.'),
      ],
    },
    {
      id: 'poses',
      q: 'Mogę ustawić skina w pozie i zapisać obrazek?',
      a: [
        p('Tak. W edytorze skinów pod podglądem 3D naciśnij ', strong('Poza i obrazek'), '. Wybierz jedną z dwunastu póz (stanie, chodzenie, bieg, machanie, siedzenie, skradanie, lot, T-poza, radość, dab, walka, wskazywanie) albo otwórz ', strong('Dostosuj'), ' i ruszaj suwakami głową, tułowiem i każdą ręką i nogą; każdą część można zresetować osobno. W ', strong('Scena'), ' wybierasz kąt kamery, przybliżenie, tło (albo ', strong('Przezroczyste'), ') i pelerynę albo elytry z ', link('/cape-maker', 'kreatora peleryn'), '. ', strong('Zapisz obrazek'), ' tworzy PNG w rozmiarze 1×, 2× albo 4×. Przeciągnij model, żeby obrócić kamerę, a przewijaj albo przybliżaj dwoma palcami.'),
      ],
    },
    {
      id: 'capes',
      q: 'Mogę zrobić własną pelerynę?',
      a: [
        p('Zaprojektować ją możesz w ', link('/cape-maker', 'kreatorze peleryn'), ': pomaluj teksturę peleryny 64×32 z podglądem 3D i pobierz PNG. To, gdzie się pojawi, zależy od gry. Java Edition pokazuje tylko oficjalne peleryny od Mojang, więc własna peleryna wymaga moda albo klienta z własną usługą peleryn, a widzą ją tylko gracze z tym samym modem. W Bedrocku peleryny to elementy kreatora postaci, a narzędzie Mojang do sprawdzania paczek zgłasza pelerynę w każdej paczce skinów spoza Mojang jako błąd. Dlatego kreator paczek skinów pomija peleryny.'),
        p('Bez modów działają elytry: kreator peleryn pobiera też paczkę tekstur z elytrami (Java 1.9 i nowsze albo Bedrock), która pokazuje twój wzór wszystkim, którzy używają paczki. Gracze z peleryną zamiast tego mają na elytrach wzór swojej peleryny.'),
      ],
    },
    {
      id: 'upload',
      q: 'Czy cokolwiek jest wysyłane?',
      a: [p('Nie. Twoje projekty, obrazki i wyeksportowane paczki nigdy nie opuszczają twojego urządzenia. Aplikacja tylko pobiera: pliki gry od Mojang, listę wersji i skiny, których szukasz po nicku.')],
    },
    {
      id: 'offline',
      q: 'Czy działa offline?',
      a: [
        p(
          'Tak, po pierwszym wczytaniu. Aplikacja i każda wersja, którą już otworzysz, zostają na tym urządzeniu, więc możesz pracować dalej bez internetu. Wersja, której jeszcze nie używasz, wymaga połączenia – albo wybierz ',
          strong('Użyj własnego pliku .jar'),
          ' i weź ją ze swojego folderu ',
          code('.minecraft/versions'),
          '.',
        ),
      ],
    },
    {
      id: 'storage',
      q: 'Gdzie są zapisywane moje projekty?',
      a: [p('W pamięci twojej przeglądarki na tym urządzeniu. Zostają, dopóki ich nie usuniesz albo nie wyczyścisz danych tej strony. Żeby zachować kopię albo przenieść je na inny komputer, zapisz plik projektu (', code('.tpmproject'), ') albo kopię zapasową wszystkich projektów (', code('.tpmbackup'), ') i otwórz ją tam. ', link('/help#backup', 'Jak robić i przywracać kopie zapasowe projektów'), '.')],
    },
    {
      id: 'versions',
      q: 'Które wersje Minecrafta są obsługiwane?',
      a: [p(`Domyślnie wybrana jest Java ${LATEST}, a działa każda wersja Javy aż do 1.6.1 (kiedy pojawiły się paczki zasobów) – jeśli chcesz, także snapshoty. W Bedrocku możesz wybrać najnowszą pełną wersję, najnowszą wersję preview i starsze wersje.`)],
    },
    {
      id: 'pack-format',
      q: `Jaki format paczki zasobów ma Minecraft Java ${LATEST}?`,
      a: [
        p(
          `Java ${LATEST} używa formatu paczki zasobów ${F(LATEST)}. Paczka tylko dla ${LATEST} podaje w swoim `,
          code('pack.mcmeta'),
          ' ',
          code(`"min_format": ${minFormat(LATEST)}`),
          ' i ',
          code(`"max_format": ${maxFormat(LATEST)}`),
          '. Texture Pack Maker zapisuje te pola za ciebie. Zobacz ',
          link('/guides/minecraft-pack-format-versions', 'format każdej wersji Javy'),
          '.',
        ),
      ],
    },
    {
      id: 'java-vs-bedrock',
      q: 'Czym różnią się paczki do Javy i do Bedrocka?',
      a: [
        p(
          'Paczka do Javy to ',
          code('.zip'),
          ' z plikiem ',
          code('pack.mcmeta'),
          ' i teksturami PNG w ',
          code('assets/minecraft/textures/'),
          '. Paczka do Bedrocka to ',
          code('.mcpack'),
          ' z plikiem ',
          code('manifest.json'),
          ' i teksturami w ',
          code('textures/'),
          ' (PNG albo TGA). Żadna edycja nie wczyta paczek drugiej. ',
          link('/guides/java-vs-bedrock-packs', 'Dokładne porównanie'),
          '.',
        ),
      ],
    },
    {
      id: 'no-mods',
      q: 'Mogę zrobić shadery bez modów?',
      a: [
        p(
          `Tak. Od Javy 1.17 paczka zasobów może zmieniać własne shadery Minecrafta (kolor, winieta, mgła, a w ${LATEST} także bloom). W Bedrocku paczka Vibrant Visuals zmienia wbudowane światło, niebo, mgłę i wodę. Prawdziwe cienie i odbicia w Javie dalej wymagają Irisa albo OptiFine. `,
          link('/guides/make-shaders-without-mods', 'Jak to działa'),
          '.',
        ),
      ],
    },
    {
      id: 'phone',
      q: 'Mogę używać tego na telefonie albo tablecie?',
      a: [p('Tak. Każde narzędzie działa z dotykiem, łącznie z przybliżaniem dwoma palcami w edytorach pikseli. Do szczegółowego pixel artu wygodniejszy jest większy ekran.')],
    },
    {
      id: 'official',
      q: 'Czy to jest darmowe? Czy to jest oficjalne?',
      a: [p('Jest za darmo i open source na licencji MIT.'), p('Texture Pack Maker nie jest oficjalnym produktem Minecraft i nie jest zatwierdzony przez Mojang ani Microsoft ani z nimi związany.')],
    },
    {
      id: 'bug',
      q: 'Coś poszło nie tak. Jak to zgłosić?',
      a: [p('Otwórz, proszę, zgłoszenie (issue) na ', ext(`${REPO_URL}/issues`, 'GitHubie'), ' i napisz, jakiej przeglądarki i wersji gry używasz i co akurat robisz. Zrzuty ekranu bardzo pomagają.')],
    },
  ],
  quick: { 'java-packs': 'Zainstaluj paczkę tekstur', 'java-skins': 'Zmień skina', iris: 'Użyj paczki shaderów', faq: 'Częste pytania' },
  toc: {
    title: 'Na tej stronie',
    textures: 'Paczki tekstur',
    skins: 'Skiny',
    shaders: 'Shadery',
    more: 'Więcej',
    irisOptifine: 'Iris / OptiFine',
    vanilla: 'Bez modów',
    vibrant: 'Vibrant Visuals',
    folders: 'Foldery',
    backup: 'Kopie zapasowe',
    faq: 'Pytania',
    allGuides: 'Wszystkie poradniki',
  },
  bothEditions: 'Java i Bedrock',
  eyebrow: 'Instalacja i pomoc',
  title: 'Jak zainstalować paczki tekstur, skiny i shadery',
  lead: 'Tak przeniesiesz swoje dzieła do Minecrafta: instrukcje krok po kroku dla Javy i Bedrocka na PC, Macu, telefonie i konsoli, a do tego odpowiedzi na częste pytania.',
  faqTitle: 'Najczęściej zadawane pytania',
};
