// Polish About page (see AboutText in src/tools/about/content.ts).

import { el } from '../../app/markup';
import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL } from '../../app/site';
import { F, LATEST } from '../../app/content/facts';
import type { AboutText } from '../../tools/about/content';

export const ABOUT: AboutText = {
  differences: [
    {
      title: 'Każda wersja Javy od 1.6.1',
      text: [`Nie tylko najnowsza: zrób paczkę do ${LATEST}, 1.21.11, 1.20.1 albo 1.8.9, za każdym razem z teksturami tej wersji i pasującym pack.mcmeta.`],
    },
    {
      title: 'Java i Bedrock, plus konwerter',
      text: ['Rób paczki do obu edycji i zamieniaj paczkę z Javy na Bedrock albo odwrotnie ', link('/texture-pack-converter', 'konwerterem paczek tekstur'), '.'],
    },
    {
      title: 'Tekstury, skiny i shadery',
      text: ['Jedna strona do paczek tekstur, skinów i paczek skinów oraz shaderów do Irisa, OptiFine, czystej Javy i Vibrant Visuals w Bedrocku.'],
    },
    {
      title: 'Nic nie jest wysyłane',
      text: ['Wszystko działa w twojej przeglądarce. Pliki gry przychodzą prosto od Mojang, a twoja praca zostaje na twoim urządzeniu.'],
    },
    {
      title: 'Za darmo i open source',
      text: ['Bez konta, bez reklam, bez płatnych wersji. Kod jest publiczny na licencji MIT na ', ext(REPO_URL, 'GitHubie'), '.'],
    },
    {
      title: 'Działa offline',
      text: ['Po pierwszej wizycie aplikacja i używane pliki gry zostają na twoim urządzeniu, więc działa dalej także bez internetu.'],
    },
  ],
  faq: [
    {
      id: 'who',
      q: 'Kto robi Texture Pack Maker?',
      a: [el('p', null, `Texture Pack Maker robi ${PUBLISHER.name}, niezależny twórca. To projekt fanowski, niezwiązany z Mojang ani Microsoftem.`)],
    },
    {
      id: 'cost',
      q: 'Czy to coś kosztuje?',
      a: [el('p', null, 'Nie. Każde narzędzie jest za darmo – bez konta, bez reklam i bez limitu, ile paczek zrobisz.')],
    },
    {
      id: 'files',
      q: 'Skąd pochodzą tekstury Minecrafta?',
      a: [
        el(
          'p',
          null,
          'Twoja przeglądarka pobiera je od Mojang, kiedy wybierasz wersję: tekstury Javy z oficjalnych plików gry, tekstury Bedrocka z repozytorium Mojang ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          '. Zostają na twoim urządzeniu i nigdy nie są zapisywane na tej stronie.',
        ),
      ],
    },
    {
      id: 'contact',
      q: 'Jak zgłosić błąd albo zaproponować nową funkcję?',
      a: [el('p', null, 'Otwórz zgłoszenie (issue) na ', ext(`${REPO_URL}/issues`, 'GitHubie'), '. Napisz, proszę, jakiego narzędzia, edycji i wersji gry używasz.')],
    },
  ],
  eyebrow: 'O projekcie',
  title: 'O Texture Pack Maker',
  intro: `Texture Pack Maker to darmowa strona open source, na której robisz paczki tekstur, skiny i shadery do Minecrafta w przeglądarce – do Java Edition (${LATEST} i każda wersja aż do 1.6.1) i Bedrock Edition. Robi ją ${PUBLISHER.name}.`,
  differentTitle: 'Co wyróżnia Texture Pack Maker',
  toolsTitle: 'Narzędzia',
  tools: [
    [link('/textures', 'Edytor paczek tekstur'), ': przemaluj każdy blok, przedmiot i moba na jego modelu 3D, wgraj własne obrazki, podmień dźwięki, zmień styl całej paczki jednym kliknięciem albo otwórz gotową paczkę.'],
    [link('/texture-pack-converter', 'Konwerter paczek tekstur'), ': z Javy na Bedrock, z Bedrocka na Javę, między wersjami Javy albo z tekstur PNG do pliku .mcpack.'],
    [link('/merge-texture-packs', 'Łączenie paczek tekstur'), ': połącz do ośmiu paczek w jedną, w wybranej kolejności.'],
    [link('/pack-doctor', 'Pack Doctor'), ': sprawdź, dlaczego paczka do Javy albo Bedrocka nie działa w grze, i napraw ją jednym kliknięciem.'],
    [link('/totem-maker', 'Kreator totemów'), ': zamień dowolnego skina we własny Totem nieśmiertelności, jako paczkę zasobów do Javy lub Bedrocka.'],
    [link('/font-maker', 'Kreator czcionek'), ': narysuj pikselową czcionkę albo zamień plik czcionki, zobacz ją na czacie, tabliczkach i w książkach i pobierz jako paczkę zasobów.'],
    [link('/skins', 'Edytor skinów'), ' i ', link('/skin-pack-maker', 'kreator paczek skinów'), ': maluj skiny w 2D albo 3D, z szerokimi lub wąskimi rękami, i zbierz je w paczkę skinów do Bedrocka.'],
    [link('/cape-maker', 'Kreator peleryn'), ': pomaluj pelerynę i elytry na szablonie 64×32 w 3D i pobierz PNG albo paczkę tekstur z elytrami.'],
    [link('/shaders', 'Kreator shaderów'), ': paczki shaderów do Irisa i OptiFine, shadery do Javy zupełnie bez modów i paczki Vibrant Visuals do Bedrocka.'],
    [link('/guides', 'Poradniki'), ': jak robić, instalować i naprawiać paczki oraz format paczki każdej wersji Javy.'],
  ],
  howTitle: 'Jak to działa',
  how: [
    'Kiedy wybierasz wersję gry, twoja przeglądarka pobiera tekstury tej wersji prosto od Mojang i trzyma je na twoim urządzeniu. Twoje projekty też są zapisywane w przeglądarce (IndexedDB), a eksporty powstają na twoim urządzeniu: ',
    code('.zip'),
    ' do Javy z pasującym ',
    code('pack.mcmeta'),
    ` (Java ${LATEST} używa formatu paczki ${F(LATEST)}) albo `,
    code('.mcpack'),
    ' do Bedrocka z plikiem ',
    code('manifest.json'),
    '. Nic, co robisz, nie trafia na żaden serwer.',
  ],
  makerTitle: 'Kto za tym stoi',
  maker: ['Texture Pack Maker robi ', strong(PUBLISHER.name), '. Kod źródłowy jest publiczny, więc każdy może zobaczyć, jak to działa, zaproponować zmiany albo zgłosić problem.'],
  notOfficial: 'To nie jest oficjalny produkt Minecraft. Nie jest zatwierdzony przez Mojang ani Microsoft i nie jest z nimi związany.',
  questions: 'Częste pytania',
};
