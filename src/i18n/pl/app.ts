// Polish texts of the installable-app features (see AppText in src/pwa/text.ts).

import type { AppText } from '../../pwa/text';

export const APP_TEXT_PL: Partial<AppText> = {
  installApp: 'Zainstaluj aplikację',
  installTitle: 'Zainstaluj Texture Pack Maker',
  installWhy: 'Otwieraj go z ekranu początkowego albo pulpitu, jak każdą inną aplikację. Działa też bez internetu.',
  installIos: ['Stuknij przycisk Udostępnij na pasku Safari.', 'Wybierz „Do ekranu początkowego”.', 'Stuknij „Dodaj”.'],
  installMacSafari: ['Na pasku menu Safari wybierz Plik › Dodaj do Docka.', 'Kliknij „Dodaj”.'],
  gotIt: 'Rozumiem',
  installed: 'Texture Pack Maker jest zainstalowany. Znajdziesz go wśród swoich innych aplikacji.',
  exportHint: 'Wskazówka: zainstaluj Texture Pack Maker jako aplikację, żeby otwierać go z pulpitu albo ekranu początkowego, nawet bez internetu.',
  install: 'Zainstaluj',
  updateReady: 'Nowa wersja Texture Pack Maker jest gotowa.',
  reload: 'Odśwież',
  cantOpen: 'Texture Pack Maker nie może otworzyć „{name}”. Wybierz paczkę .zip, .mcpack lub .mcaddon albo skin lub teksturę .png.',
  privacy: 'Prywatność',
};
