// Polish privacy policy (see PrivacyText in src/tools/privacy/content.ts).

import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL, SITE_NAME } from '../../app/site';
import type { PrivacyText } from '../../tools/privacy/content';

export const PRIVACY: PrivacyText = {
  eyebrow: 'Prywatność',
  title: 'Polityka prywatności',
  intro: `${SITE_NAME} jest zbudowany tak, żeby twoja praca nigdy nie opuszczała twojego urządzenia. Nie ma tu kont, reklam ani śledzenia. Ta strona wyjaśnia, co to znaczy w praktyce, dla strony internetowej i dla zainstalowanej aplikacji.`,
  updated: 'Ostatnia zmiana',
  sections: [
    {
      id: 'nothing-uploaded',
      title: 'Nic, co tworzysz, nie jest wysyłane',
      body: [
        [
          'Każde narzędzie działa w twojej przeglądarce. Paczki, skiny, shadery i obrazki, które otwierasz, edytujesz i eksportujesz, są przetwarzane na twoim urządzeniu i nie trafiają ani na tę stronę, ani do nikogo innego. Eksporty (',
          code('.zip'),
          ', ',
          code('.mcpack'),
          ', ',
          code('.png'),
          ') powstają na twoim urządzeniu i lądują prosto w twoich pobranych plikach.',
        ],
      ],
    },
    {
      id: 'no-tracking',
      title: 'Bez kont, bez reklam, bez śledzenia',
      body: [
        ['Nie ma rejestracji ani logowania. Strona nie ma reklam, ciasteczek śledzących ani trackerów innych firm. Żadne dane osobowe nie są zbierane, sprzedawane ani udostępniane.'],
        [
          'Żeby wiedzieć, które strony i narzędzia są używane, strona liczy wizyty przez ',
          ext('https://www.cloudflare.com/web-analytics/', 'Cloudflare Web Analytics'),
          '. Działa to bez ciasteczek, nie śledzi cię na innych stronach i nie tworzy twojego profilu: zapisywana jest strona, strona, z której przychodzisz, twój kraj oraz rodzaj przeglądarki i urządzenia. To, co tworzysz, nigdy do tego nie należy.',
        ],
      ],
    },
    {
      id: 'on-your-device',
      title: 'Co jest zapisywane na twoim urządzeniu',
      body: [
        [
          strong('Twoje projekty'),
          ' są przechowywane w pamięci przeglądarki (IndexedDB), żeby dało się do nich wrócić później. ',
          strong('Pliki gry'),
          ', które pobierzesz, też tam leżą, żeby narzędzia działały offline. ',
          strong('Ustawienia'),
          ', na przykład jasny lub ciemny motyw, są w pamięci lokalnej, a pliki samej aplikacji są zapisywane w pamięci podręcznej, żeby uruchamiała się bez internetu.',
        ],
        ['Wszystko to zostaje na twoim urządzeniu. Jeśli usuniesz projekt w aplikacji, znika. Żeby usunąć wszystko, wyczyść dane tej strony w ustawieniach przeglądarki albo odinstaluj aplikację.'],
      ],
    },
    {
      id: 'other-services',
      title: 'Usługi, z którymi łączy się twoja przeglądarka',
      body: [
        [
          'Kiedy wybierasz wersję gry, twoja przeglądarka pobiera jej pliki prosto od Mojang (',
          code('piston-meta.mojang.com'),
          ', ',
          code('piston-data.mojang.com'),
          ', ',
          code('resources.download.minecraft.net'),
          '). Pliki Bedrocka pochodzą z repozytorium Mojang ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' przez GitHuba i jsDelivr, a lista wersji Javy z jsDelivr.',
        ],
        [
          'Lista dźwięków gry i obrazy ekranu tytułowego, których nie ma w pobieranym pliku Javy, pochodzą z repozytorium ',
          ext('https://github.com/misode/mcmeta', 'misode/mcmeta'),
          ' przez GitHuba i jsDelivr.',
        ],
        ['Jeśli szukasz skina gracza po nicku, ten nick jest wysyłany do playerdb.co (albo mc-heads.net), żeby znaleźć skina, który potem jest pobierany z textures.minecraft.net.'],
        ['Te usługi dostają zwykłe informacje o zapytaniu, na przykład twój adres IP, jak przy każdej stronie internetowej, i mają własne polityki prywatności. Nic, co stworzysz, nie jest do nich wysyłane.'],
      ],
    },
    {
      id: 'hosting',
      title: 'Hosting',
      body: [
        [
          'Strona działa na GitHub Pages. GitHub może zapisywać dane techniczne, takie jak adresy IP, żeby prowadzić i chronić usługę; zobacz ',
          ext('https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement', 'politykę prywatności GitHuba'),
          '.',
        ],
      ],
    },
    {
      id: 'app',
      title: 'Zainstalowana aplikacja',
      body: [['Aplikacja, którą instalujesz z przeglądarki albo ze Sklepu Microsoft, to dokładnie ta strona w osobnym oknie. Wszystko na tej stronie dotyczy jej tak samo.']],
    },
    {
      id: 'children',
      title: 'Dzieci',
      body: [[`${SITE_NAME} nie zbiera od nikogo danych osobowych, także od dzieci.`]],
    },
    {
      id: 'contact',
      title: 'Zmiany i pytania',
      body: [
        ['Jeśli ta polityka się zmieni, ta strona zostanie zaktualizowana z nową datą.'],
        [`${SITE_NAME} robi ${PUBLISHER.name}. Pytania możesz zadać, otwierając zgłoszenie (issue) na `, ext(`${REPO_URL}/issues`, 'GitHubie'), '. Więcej o projekcie znajdziesz na stronie ', link('/about', 'O projekcie'), '.'],
      ],
    },
  ],
};
