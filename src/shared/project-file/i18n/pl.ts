// Polish text of project files and backups (English source: ./text.ts).

import type { ProjectFileLanguage } from './load';

const PL: ProjectFileLanguage = {
  'shared.projectFile': {
    saved: 'Zapisano {file}. Otwórz go tutaj kiedy chcesz, żeby edytować dalej.',
    saveFailed: 'Nie udało się zapisać pliku projektu.',
    opened: 'Otwarto „{name}”',
    openedCopy: 'Otwarto „{name}” jako kopię. Ten, który już masz, się nie zmienił.',
    copyName: '{name} (kopia)',
    untitled: 'Bez nazwy',
    errors: {
      notZip: 'To nie jest plik projektu. Pliki projektu kończą się na .tpmproject albo .tpmbackup.',
      notProject: 'To nie jest plik projektu Texture Pack Maker. Żeby otworzyć paczkę, użyj „Otwórz paczkę” w Edytorze paczek tekstur.',
      damaged: 'Ten plik projektu jest uszkodzony i nie da się go otworzyć.',
      newer: 'Ten plik zapisała nowsza wersja Texture Pack Maker (format {version}). Odśwież stronę, żeby zaktualizować, i otwórz go jeszcze raz.',
      empty: 'W tym pliku nie ma żadnych projektów.',
      item: '„{name}” jest uszkodzony i został pominięty.',
    },
    types: {
      texturepack: 'Paczka tekstur',
      skin: 'Skin',
      shader: 'Shader',
      cape: 'Peleryna',
      font: 'Czcionka',
    },
    counts: {
      texturepack: '{count, plural, one {# paczka tekstur} few {# paczki tekstur} many {# paczek tekstur} other {# paczki tekstur}}',
      skin: '{count, plural, one {# skin} few {# skiny} many {# skinów} other {# skina}}',
      shader: '{count, plural, one {# shader} few {# shadery} many {# shaderów} other {# shadera}}',
      cape: 'Twoja peleryna',
      font: 'Twoja czcionka',
    },
    backup: {
      title: 'Zrób kopię zapasową projektów',
      intro: 'Jeden plik z każdym projektem z tej przeglądarki. Trzymaj go w bezpiecznym miejscu albo otwórz w innej przeglądarce lub na innym urządzeniu, żeby przenieść wszystko.',
      none: 'W tej przeglądarce nie ma jeszcze projektów.',
      contains: 'W kopii zapasowej',
      gameFiles: 'Plików samej gry tu nie ma: pobiorą się ponownie od Mojangu, gdy otworzysz projekt.',
      download: 'Pobierz kopię zapasową',
      done: 'Zapisano kopię zapasową: {file}',
      failed: 'Nie udało się zrobić kopii zapasowej.',
    },
    restore: {
      title: 'Przywróć kopię zapasową',
      intro: 'Zapisana {date}. Wybierz, co przywrócić do tej przeglądarki.',
      choose: 'Projekty',
      already: 'Już jest',
      existing: 'Już są w tej przeglądarce',
      skip: 'Pomiń',
      keepBoth: 'Zachowaj oba',
      skipNote: 'Zostaje taki, jaki jest w tej przeglądarce',
      copyNote: 'Przywrócony jako kopia obok twojego',
      replaceNote: 'Zastępuje ten z tej przeglądarki',
      selectAll: 'Zaznacz wszystko',
      selectNone: 'Odznacz wszystko',
      restore: '{count, plural, =0 {Przywróć} one {Przywróć # projekt} few {Przywróć # projekty} many {Przywróć # projektów} other {Przywróć # projektu}}',
      done: '{count, plural, one {Przywrócono # projekt} few {Przywrócono # projekty} many {Przywrócono # projektów} other {Przywrócono # projektu}}',
      failed: 'Nie udało się przywrócić „{name}”.',
      edited: 'Edytowano {date}',
    },
    replace: {
      capeTitle: 'Zastąpić twoją pelerynę?',
      capeText: 'Kreator peleryn trzyma jedną pelerynę naraz, więc otwarcie „{name}” zastąpi tę, nad którą pracujesz. Jeśli chcesz ją zachować, najpierw zapisz ją jako plik projektu.',
      saveFirst: 'Najpierw zapisz obecną',
      replace: 'Zastąp',
    },
  },
};

export default PL;
