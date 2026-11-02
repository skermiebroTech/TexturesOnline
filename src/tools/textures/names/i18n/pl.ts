// Polish text of the name-based textures window (English source: ./text.ts). {item} is the item's
// name as the editor shows it, so sentences put it after "przedmiot".

import type { NamesLanguage } from './load';

const PL: NamesLanguage = {
  'textures.names': {
    title: 'Tekstury po nazwie',
    intro: 'Nazwij w kowadle przedmiot {item} jedną z tych nazw, a dostanie własną teksturę.',
    edition: {
      vanilla: 'Działa w Minecrafcie 1.21.5 i nowszym, bez modów.',
      range: 'Działa w Minecrafcie 1.21.5 i nowszym, bez modów. Dla starszych wersji z zakresu twojej paczki dodaje też pliki OptiFine.',
      optifine: 'Wymaga OptiFine albo moda CIT Resewn: Minecraft przed 1.21.5 sam tego nie umie. Gracze bez nich widzą zwykłą teksturę.',
      old: 'To wymaga Javy 1.8 albo nowszej. Wybierz nowszą wersję w zakładce Paczka.',
      bedrock: 'Bedrock Edition tego nie umie: jego paczki zasobów nie mogą zmieniać wyglądu przedmiotu według nazwy. Potrafią to tylko paczki do Java Edition.',
    },
    exact: 'Nazwa musi się zgadzać dokładnie, także wielkie litery: „Excalibur” i „excalibur” to różne nazwy (jeśli chcesz, dodaj obie). Nazwy pokolorowane komendami nie pasują.',
    notItem: 'Ta tekstura nie jest obrazkiem przedmiotu, więc nie może dostać tekstur po nazwie. Otwórz teksturę przedmiotu, np. miecza albo jabłka.',
    noModels: 'Nie udało się wczytać listy przedmiotów, więc nie wiadomo, do jakiego przedmiotu należy ta tekstura. Sprawdź połączenie i spróbuj ponownie.',
    loading: 'Wczytywanie przedmiotu…',
    looks: 'Nazwy i ich tekstury',
    add: 'Dodaj teksturę po nazwie',
    addIntro: 'Wpisz nazwę, którą dasz przedmiotowi {item} w kowadle. Jego nowa tekstura zaczyna się jako kopia zwykłej.',
    nameLabel: 'Nazwa',
    namePlaceholder: 'np. Excalibur',
    addName: 'Dodaj nazwę',
    moreNames: 'Kilka nazw może mieć tę samą teksturę: dodaj je też.',
    removeName: 'Usuń {name}',
    create: 'Utwórz i maluj',
    paint: 'Maluj',
    paintHint: 'Pomaluj teksturę dla tej nazwy',
    shape: 'Kształt 3D',
    shapeHint: 'Zmień kształt przedmiotu dla tej nazwy w edytorze modeli',
    shaped: '3D',
    editNames: 'Nazwy',
    editNamesHint: 'Zmień nazwy',
    save: 'Zapisz',
    remove: 'Usuń',
    removeHint: 'Usuń tę teksturę',
    removeTitle: 'Usunąć tę teksturę?',
    removeText: 'Tekstura dla {names} zostanie usunięta.',
    removed: 'Usunięto teksturę dla {names}',
    undo: 'Cofnij',
    created: 'Teraz pomaluj nową teksturę. Pokaże ją przedmiot {item} o nazwie {names}.',
    quoted: '„{name}”',
    nameEmpty: 'Najpierw wpisz nazwę.',
    nameTaken: '{name} ma już teksturę na tym przedmiocie.',
    nameCleaned: 'Kodów kolorów (§) nie da się wpisać w kowadle, więc zostały pominięte.',
    pattern: 'Reguła OptiFine',
    patternHint: 'Z otwartej paczki: reguła, którą rozumieją tylko OptiFine i CIT Resewn, więc działa tylko z nimi.',
    kept: 'Zachowane z otwartej paczki',
    keptHint: 'Te reguły OptiFine robią więcej niż wybór nazwy, więc zostają bez zmian.',
    slot: 'Tekstura dla {names}',
    failed: 'Nie udało się zrobić tekstury: {error}',
  },
};

export default PL;
