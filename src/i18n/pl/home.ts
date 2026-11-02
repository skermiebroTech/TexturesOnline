// Polish home page (see HomeText in src/tools/home/content.ts).

import { el } from '../../app/markup';
import { link } from '../../app/content/blocks';
import { F, LATEST } from '../../app/content/facts';
import type { HomeText } from '../../tools/home/content';

const code = (t: string) => el('code', null, t);

export const HOME: HomeText = {
  tools: {
    textures: {
      title: 'Paczki tekstur',
      blurb: 'Pomaluj każdy blok, przedmiot i moba – albo jednym kliknięciem daj całej grze nowy wygląd.',
      features: ['Każda tekstura, każda wersja', 'Edytor pikseli i efekty', 'Otwieranie gotowych paczek'],
      cta: 'Zrób paczkę tekstur',
      previewLabel: '',
    },
    skins: {
      title: 'Skiny',
      blurb: 'Maluj swoją postać na szablonie 64×64, a model 3D zmienia się na żywo.',
      features: ['Szerokie i wąskie ręce, obie warstwy', 'Szablony albo dowolny nick', 'Eksport do Javy i Bedrocka'],
      cta: 'Zaprojektuj skina',
      previewLabel: 'Maluj piksel po pikselu',
    },
    shaders: {
      title: 'Shadery',
      blurb: 'Ustaw suwakami światło, kolory, mgłę i wodę i od razu zobacz efekt.',
      features: ['Paczki do Irisa i OptiFine', 'Shadery bez modów', 'Vibrant Visuals w Bedrocku'],
      cta: 'Zbuduj shadery',
      previewLabel: 'Podgląd w dzień i w nocy',
    },
  },
  faq: [
    {
      id: 'how',
      q: 'Jak zrobić paczkę tekstur do Minecrafta?',
      a: [
        el(
          'p',
          null,
          'Otwórz ',
          link('/textures', 'edytor paczek tekstur'),
          ', wybierz Javę albo Bedrocka i swoją wersję gry, a potem przemaluj tekstury, wgraj własne obrazki albo użyj efektu jednym kliknięciem. Wyeksportuj ',
          code('.zip'),
          ' (Java) albo ',
          code('.mcpack'),
          ' (Bedrock) i włącz paczkę w grze. ',
          link('/guides/make-a-texture-pack', 'Poradnik krok po kroku'),
          '.',
        ),
      ],
    },
    {
      id: 'what',
      q: 'Czym jest Texture Pack Maker?',
      a: [
        el(
          'p',
          null,
          'Texture Pack Maker to darmowa strona do robienia paczek tekstur (texture packów), skinów i shaderów do Minecrafta. Wszystko działa w przeglądarce: wybierasz wersję gry, edytujesz z podglądem na żywo i pobierasz paczkę, która od razu działa w Javie albo w Bedrocku.',
        ),
      ],
    },
    {
      id: 'free',
      q: 'Czy to jest darmowe? Potrzebuję konta?',
      a: [el('p', null, 'Jest za darmo, bez konta i bez logowania, a kod jest open source na licencji MIT. Twoje projekty zostają na twoim urządzeniu.')],
    },
    {
      id: 'bedrock',
      q: 'Czy działa też z Minecraft Bedrock?',
      a: [
        el(
          'p',
          null,
          'Tak. Paczki tekstur i skiny eksportują się jako ',
          code('.mcpack'),
          ', który Bedrock importuje po otwarciu, a kreator shaderów robi paczki Vibrant Visuals. Tutaj przeczytasz, ',
          link('/guides/java-vs-bedrock-packs', 'czym różnią się paczki do Javy i Bedrocka'),
          '.',
        ),
      ],
    },
    {
      id: 'versions',
      q: 'Dla jakich wersji Javy mogę robić paczki?',
      a: [
        el(
          'p',
          null,
          `Domyślnie wybrana jest Java ${LATEST}, ale działa każda wersja aż do 1.6.1. Każda paczka dostaje `,
          code('pack.mcmeta'),
          ` według zasad wybranej wersji (${LATEST} używa formatu paczki zasobów ${F(LATEST)}). `,
          link('/guides/minecraft-pack-format-versions', 'Wszystkie formaty paczek'),
          '.',
        ),
      ],
    },
    {
      id: 'resource',
      q: 'Czy paczka tekstur to to samo co paczka zasobów?',
      a: [
        el(
          'p',
          null,
          'Prawie. Java Edition nazywa je paczkami zasobów: oprócz tekstur mogą zmieniać też modele, dźwięki, czcionki i shadery. Bedrock też mówi o paczkach zasobów i używa plików ',
          code('.mcpack'),
          '. Ten kreator robi jedno i drugie.',
        ),
      ],
    },
    {
      id: 'skinpack',
      q: 'Mogę zrobić własną paczkę skinów?',
      a: [
        el(
          'p',
          null,
          'Tak. Narysuj skiny (z szerokimi albo wąskimi rękami) w ',
          link('/skins', 'edytorze skinów'),
          ' i wyeksportuj je razem jako paczkę skinów do Bedrocka albo pobierz PNG do Javy. ',
          link('/skin-pack-maker', 'Kreator paczek skinów'),
          '.',
        ),
      ],
    },
    {
      id: 'install',
      q: 'Muszę coś instalować?',
      a: [el('p', null, 'Nie. Działa w każdej nowej przeglądarce na komputerze, telefonie i tablecie. Po pierwszej wizycie aplikacja działa też offline.')],
    },
  ],
  appFeatures: [
    `Kreator paczek tekstur do Minecraft Java Edition (${LATEST} i każda wersja od 1.6.1) i Bedrock Edition`,
    'Edytor skinów do Minecrafta z podglądem 3D na żywo, modelem szerokim i wąskim, eksportem PNG do Javy i paczek skinów do Bedrocka',
    'Kreator shaderów: paczki shaderów do Irisa i OptiFine, shadery do Javy bez modów i paczki Vibrant Visuals do Bedrocka',
    'Eksportuje gotowe pliki .zip i .mcpack z pasującym pack.mcmeta albo manifest.json',
    'Działa w przeglądarce: bez logowania, bez wysyłania plików, po pierwszej wizycie także offline',
  ],
  hero: {
    chip: 'Za darmo · Bez logowania',
    chipOffline: ' · Działa offline',
    title: { pre: 'Twórz paczki tekstur do ', accent: 'Minecrafta' },
    lead: 'Rób własne paczki tekstur, skiny i shadery prosto w przeglądarce – darmowy kreator paczek zasobów do Javy i Bedrocka, a pobrane pliki od razu pasują do gry.',
    start: 'Zaczynamy',
    install: 'Jak zainstalować',
    everything: 'Zobacz wszystko, co możesz zrobić',
    editionsLabel: 'Obsługiwane edycje',
    chips: [`Java ${LATEST}`, 'Wszystkie wersje od 1.6.1', 'Bedrock'],
    blockLabel: 'Pikselowy blok trawy',
    dragHint: 'Przeciągnij, żeby obrócić',
  },
  toolsSection: {
    eyebrow: 'Trzy narzędzia, jedna strona',
    title: 'Co chcesz zrobić?',
    lead: 'Wszystko, czego potrzebujesz, żeby nadać Minecraftowi własny styl. Nic do instalowania, bez konta – po prostu otwórz narzędzie i działaj.',
  },
  converter: {
    title: 'Konwerter paczek tekstur',
    text: `Zamień paczkę z Javy na Bedrock albo odwrotnie, zaktualizuj starą paczkę do ${LATEST} albo zrób .mcpack z plików PNG.`,
    cta: 'Konwertuj paczkę',
  },
  features: {
    eyebrow: 'Darmowy kreator paczek',
    title: 'Wszystko, co powinien umieć kreator paczek tekstur',
    lead: 'Od jednego przemalowanego miecza po pełną paczkę zasobów HD – zrobioną i wyeksportowaną bez wychodzenia z przeglądarki.',
    titles: [
      'Edytor paczek tekstur z modelami 3D',
      'Generator paczek tekstur jednym kliknięciem',
      'Otwieraj i edytuj gotowe paczki',
      'Paczki zasobów do Javy i Bedrocka',
      'Edytor skinów i kreator paczek skinów',
      'Kreator shaderów, z modami lub bez',
    ],
    items: [
      ['Maluj każdy blok, przedmiot i moba ze swojej wersji prosto na prawdziwym modelu 3D: piece, skrzynie, schody i ponad 80 mobów, od creepera po osadnika.'],
      ['Zmień wygląd całej gry naraz efektami takimi jak Dark Mode, Pastel, Retro 8-bit, Autumn czy Smooth HD, a potem dopracuj szczegóły ręcznie.'],
      ['Wczytaj dowolny ', code('.zip'), ' z Javy albo ', code('.mcpack'), ' z Bedrocka i edytuj dalej, albo zamień go na drugą edycję ', link('/texture-pack-converter', 'konwerterem paczek'), '.'],
      ['Kreator paczek zasobów, który pisze dokładny ', code('pack.mcmeta'), ` dla Javy od ${LATEST} aż do 1.6.1 albo `, code('manifest.json'), ' dla Bedrocka.'],
      ['Projektuj skiny w 2D albo 3D, z szerokimi lub wąskimi rękami, i zbierz je w jeden .mcpack do Bedrocka ', link('/skin-pack-maker', 'kreatorem paczek skinów'), '.'],
      ['Buduj paczki shaderów do Irisa i OptiFine, shadery do Javy zupełnie bez modów albo paczki Vibrant Visuals do Bedrocka.'],
    ],
  },
  why: {
    eyebrow: 'Czym się wyróżnia',
    title: 'Dlaczego Texture Pack Maker?',
    lead: ['Za darmo, open source i prywatnie, z każdą wersją Javy od 1.6.1, Bedrockiem i dziesięcioma narzędziami w jednym miejscu. ', link('/about', 'O projekcie'), '.'],
  },
  how: {
    eyebrow: 'Jak to działa',
    title: 'Od pomysłu do gry w kilka minut',
    steps: [
      { title: 'Wybierz grę', text: `Java ${LATEST} jest już wybrana – albo wybierz dowolną wersję Javy aż do 1.6.1 lub Bedrocka.` },
      { title: 'Twórz', text: 'Maluj piksele, nakładaj efekty jednym kliknięciem albo przesuwaj suwaki shaderów – z podglądem 3D na żywo.' },
      { title: 'Eksportuj i graj', text: 'Pobierz gotowy .zip albo .mcpack i zainstaluj go w grze według poradnika.' },
    ],
    values: [
      { title: 'Prywatność od początku', text: 'Twoja praca nigdy nie opuszcza twojego urządzenia. Pliki gry twoja przeglądarka pobiera prosto od Mojang.' },
      { title: 'Działa offline', text: 'Po pierwszej wizycie aplikacja i pobrane pliki gry zostają na tym urządzeniu.' },
      { title: 'Zawsze właściwy format', text: 'Pliki paczki są pisane dokładnie pod wybraną wersję, więc Minecraft wczyta je bez marudzenia.' },
    ],
  },
  guides: { eyebrow: 'Poradniki', title: 'Poznaj podstawy', lead: 'Krótkie, sprawdzone poradniki o robieniu i instalowaniu paczek, skinów i shaderów.', all: 'Wszystkie poradniki' },
  faqHead: { eyebrow: 'Pytania', title: 'Warto wiedzieć' },
  cta: { title: 'Masz ochotę coś zbudować?', text: 'Wybierz narzędzie – twoja pierwsza paczka może być w grze już za kilka minut.', button: 'Zaczynamy' },
  startDialog: 'Co chcesz zrobić?',
};
