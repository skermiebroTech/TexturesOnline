// Polish page titles, descriptions and short names (see MetaTranslation in src/app/seo/meta.ts).

import type { MetaTranslation } from '../../app/seo/meta';
import { F, LATEST } from '../../app/content/facts';

export const META_PL: MetaTranslation = {
  pages: {
    '/': {
      title: 'Zrób paczkę tekstur do Minecrafta – za darmo, Java i Bedrock',
      description: `Stwórz własny texture pack do Minecrafta: maluj bloki na modelach 3D, dodaj efekty jednym kliknięciem i pobierz .zip lub .mcpack. Za darmo, Java ${LATEST}.`,
      label: 'Start',
    },
    '/textures': {
      title: 'Edytor paczek tekstur – zrób paczkę zasobów do Minecrafta',
      description: 'Edytuj każdą teksturę Minecrafta: maluj bloki, przedmioty i moby na modelach 3D, wgraj własne PNG albo zmień styl całej paczki. Eksport do .zip lub .mcpack.',
      label: 'Paczki tekstur',
    },
    '/texture-pack-converter': {
      title: 'Konwerter paczek tekstur Minecraft – Java na Bedrock i z powrotem',
      description: 'Zamień paczkę tekstur Minecrafta z Javy na Bedrock, z Bedrocka na Javę albo między wersjami Javy, lub zrób .mcpack z plików PNG. Za darmo w przeglądarce.',
      label: 'Konwerter paczek tekstur',
    },
    '/merge-texture-packs': {
      title: 'Łączenie paczek tekstur Minecraft – Java i Bedrock',
      description: 'Połącz kilka paczek tekstur Minecrafta w jeden plik .zip lub .mcpack. Ustaw kolejność: paczka na górze wygrywa, tak samo jak w grze. Za darmo.',
      label: 'Łączenie paczek tekstur',
    },
    '/pack-doctor': {
      title: 'Napraw zepsutą paczkę tekstur Minecraft – Pack Doctor',
      description: 'Paczka tekstur nie działa? Pack Doctor sprawdza paczkę do Javy lub Bedrocka, wyjaśnia każdy problem i naprawia go jednym kliknięciem. Za darmo.',
      label: 'Pack Doctor',
    },
    '/totem-maker': {
      title: 'Zrób własny totem do Minecrafta – Java i Bedrock',
      description: 'Zamień dowolny skin z Minecrafta w Totem nieśmiertelności: wgraj PNG albo wpisz nick, wybierz styl i pobierz .zip do Javy lub .mcpack do Bedrocka.',
      label: 'Kreator totemów',
    },
    '/font-maker': {
      title: 'Zrób czcionkę do Minecrafta – własna czcionka w paczce',
      description: 'Własna czcionka w Minecrafcie: narysuj pikselowe litery albo zamień plik TTF/OTF, sprawdź ją na czacie, tabliczkach i w książkach, pobierz .zip lub .mcpack.',
      label: 'Kreator czcionek',
    },
    '/skins': {
      title: 'Edytor skinów Minecraft i własna paczka skinów',
      description: 'Narysuj własnego skina do Minecrafta w 2D lub 3D, z szerokimi albo wąskimi rękami. Pobierz PNG do Javy albo paczkę skinów do Bedrocka (.mcpack). Za darmo.',
      label: 'Skiny',
    },
    '/skin-pack-maker': {
      title: 'Zrób paczkę skinów do Minecrafta – za darmo jako .mcpack',
      description: 'Zrób online własną paczkę skinów do Minecrafta: narysuj lub wgraj skiny, mieszaj szerokie i wąskie ręce i pobierz .mcpack do Bedrocka. Za darmo.',
      label: 'Kreator paczek skinów',
    },
    '/cape-maker': {
      title: 'Zrób pelerynę do Minecrafta – kreator peleryn i elytr',
      description: 'Zaprojektuj własną pelerynę i elytry do Minecrafta na szablonie 64×32 z podglądem 3D. Pobierz PNG albo paczkę tekstur z elytrami. Za darmo.',
      label: 'Kreator peleryn',
    },
    '/shaders': {
      title: 'Zrób shadery do Minecrafta – Iris, OptiFine i bez modów',
      description: 'Twórz paczki shaderów do Irisa lub OptiFine, shadery bez modów do Javy albo paczki Vibrant Visuals do Bedrocka, z presetami, suwakami i podglądem 3D.',
      label: 'Shadery',
    },
    '/help': {
      title: 'Jak zainstalować paczki tekstur, skiny i shadery w Minecrafcie',
      description: 'Krok po kroku dla Javy i Bedrocka na Windowsie, Macu, Androidzie, iPhonie i konsoli: znajdź folder resourcepacks, włącz paczkę i napraw błędy.',
      label: 'Pomoc',
    },
    '/about': {
      title: 'O Texture Pack Maker – darmowe narzędzia open source',
      description: 'Kto stoi za Texture Pack Maker, co go wyróżnia (każda wersja Javy od 1.6.1, Bedrock, konwerter, open source) i dlaczego twoje dane zostają prywatne.',
      label: 'O projekcie',
    },
    '/privacy': {
      title: 'Prywatność – Texture Pack Maker',
      description: 'Texture Pack Maker nie ma kont, reklam ani śledzenia. Paczki, skiny i shadery zostają na twoim urządzeniu, nic nie jest wysyłane.',
      label: 'Prywatność',
    },
    '/all': {
      title: 'Wszystkie narzędzia do paczek, skinów i shaderów Minecraft',
      description: 'Wszystkie darmowe narzędzia, funkcje i poradniki Texture Pack Maker w jednym miejscu: paczki tekstur, modele 3D, dźwięki, skiny, paczki skinów i shadery.',
      label: 'Wszystko na jednej stronie',
    },
    '/guides': {
      title: 'Poradniki: paczki tekstur, skiny i shadery do Minecrafta',
      description: `Poradniki krok po kroku: jak zrobić i zainstalować paczkę tekstur, skina i shadery do Minecrafta, plus format paczki każdej wersji od 1.6.1 do ${LATEST}.`,
      label: 'Poradniki',
    },
  },
  guides: {
    'make-a-texture-pack': {
      title: 'Jak zrobić paczkę tekstur do Minecrafta (Java i Bedrock)',
      h1: 'Jak zrobić paczkę tekstur do Minecrafta',
      description: 'Zrób za darmo własną paczkę tekstur do Minecrafta: wybierz wersję, pomaluj tekstury i wyeksportuj .zip z pack.mcmeta (Java) lub .mcpack (Bedrock).',
      label: 'Jak zrobić paczkę tekstur',
      blurb: 'Wybierz wersję, pomaluj tekstury i wyeksportuj paczkę, którą Minecraft wczyta.',
    },
    'install-resource-packs': {
      title: 'Jak zainstalować paczkę tekstur w Minecrafcie (Java i Bedrock)',
      h1: 'Jak zainstalować paczki tekstur, shadery i pliki .mcpack',
      description: 'Zainstaluj paczkę zasobów w Javie, zaimportuj .mcpack w Bedrocku na PC lub telefonie, włącz shadery z Irisem lub OptiFine i napraw brakujące paczki.',
      label: 'Instalacja paczek i shaderów',
      blurb: 'Paczki zasobów do Javy, pliki .mcpack do Bedrocka i paczki shaderów, plus rozwiązania.',
    },
    'texture-pack-not-working': {
      title: 'Paczka tekstur nie działa w Minecrafcie? Rozwiązania',
      h1: 'Paczka tekstur nie działa? Tak to naprawisz',
      description: 'Paczki nie ma na liście, „Stworzona dla starszej wersji”, fioletowo-czarne bloki, szara trawa, komunikaty błędów: skąd się biorą i jak je naprawić.',
      label: 'Paczka nie działa? Rozwiązania',
      blurb: 'Brakujące paczki, ostrzeżenia o wersji, fioletowo-czarne bloki i inne rozwiązania.',
    },
    'minecraft-pack-format-versions': {
      title: `Format paczki Minecraft ${LATEST} (${F(LATEST)}) i wszystkie wersje Javy`,
      h1: `Format paczki dla każdej wersji Javy (${LATEST} używa ${F(LATEST)})`,
      description: `Każda wersja Minecraft Java od 1.6.1 do ${LATEST} z formatem paczki zasobów (${LATEST} używa ${F(LATEST)}) i to, jak pack.mcmeta zmieniał się przez lata.`,
      label: 'Formaty paczek wszystkich wersji',
      blurb: `Format paczki każdej wersji Javy od 1.6.1 do ${LATEST}.`,
    },
    'make-a-skin': {
      title: 'Jak zrobić własnego skina do Minecrafta (Java i Bedrock)',
      h1: 'Jak zrobić własnego skina do Minecrafta',
      description: 'Zrób za darmo skina do Minecrafta online: pomaluj szablon 64×64 albo HD 128×128 w 2D lub 3D, wybierz szerokie lub wąskie ręce, do Javy lub Bedrocka.',
      label: 'Jak zrobić skina',
      blurb: 'Pomaluj szablon 64×64 lub HD 128×128, do Javy albo do paczki skinów Bedrock.',
    },
    'make-shaders-without-mods': {
      title: 'Shadery do Minecrafta bez modów i OptiFine (Java i Bedrock)',
      h1: 'Czy da się mieć shadery w Minecrafcie bez modów?',
      description: 'Tak, bez OptiFine i Irisa: paczki zasobów od Javy 1.17 zmieniają shadery gry, a Bedrock ma Vibrant Visuals. Zrób własne za darmo, suwakami.',
      label: 'Shadery bez modów',
      blurb: 'Co potrafią shadery bez modów w Javie i Vibrant Visuals w Bedrocku.',
    },
    'java-vs-bedrock-packs': {
      title: 'Paczka tekstur z Javy w Bedrocku? Zamień ją w minutę',
      h1: 'Paczki tekstur Java i Bedrock: różnice i konwersja',
      description: 'Nie bezpośrednio: paczka do Javy to .zip z pack.mcmeta, a Bedrock potrzebuje .mcpack. Zamień swoją za darmo w przeglądarce, plik po pliku.',
      label: 'Paczki Java a Bedrock',
      blurb: 'Pliki, foldery, formaty, shadery i skiny porównane obok siebie.',
    },
    'bedrock-vibrant-visuals-settings': {
      title: 'Minecraft Bedrock: ustawienia Vibrant Visuals wyjaśnione',
      h1: 'Ustawienia Vibrant Visuals w Bedrocku wyjaśnione',
      description: 'Co paczka Vibrant Visuals może zmienić w Bedrocku (słońce, niebo, mgła, woda, cienie, kolory), które urządzenia ją obsługują i jak ją włączyć.',
      label: 'Ustawienia Vibrant Visuals',
      blurb: 'Słońce, niebo, mgła, woda i kolory, plus obsługiwane urządzenia.',
    },
    'convert-java-to-bedrock-texture-pack': {
      title: 'Jak zamienić paczkę tekstur z Javy na Bedrock (i z powrotem)',
      h1: 'Jak zamienić paczkę tekstur z Javy na Bedrock',
      description: 'Zamień za darmo paczkę tekstur z Javy na .mcpack do Bedrocka (albo z Bedrocka na Javę): co się da przenieść, czego nie i jak ją zainstalować.',
      label: 'Konwersja z Javy na Bedrock',
      blurb: 'Zrób z paczki do Javy plik .mcpack do Bedrocka w kilka kliknięć, albo odwrotnie.',
    },
    'merge-texture-packs': {
      title: 'Jak połączyć paczki tekstur w Minecrafcie: poradnik',
      h1: 'Jak połączyć paczki tekstur w Minecrafcie',
      description: 'Połącz kilka paczek tekstur w jedną, na serwer, Realm albo żeby się nią podzielić: która paczka wygrywa, co się łączy, online lub ręcznie.',
      label: 'Łączenie paczek tekstur',
      blurb: 'Połącz kilka paczek w jedną, w kolejności, którą wybierzesz.',
    },
    'make-a-bedrock-skin-pack': {
      title: 'Jak zrobić paczkę skinów do Minecraft Bedrock (.mcpack)',
      h1: 'Jak zrobić paczkę skinów do Minecraft Bedrock',
      description: 'Własna paczka skinów do Minecraft Bedrock: narysuj lub wgraj skiny, wyeksportuj .mcpack, zaimportuj na PC lub telefonie, zaktualizuj albo zbuduj ręcznie.',
      label: 'Paczka skinów do Bedrocka',
      blurb: 'Zbierz swoje skiny w jednym .mcpack i noś je w Przebieralni.',
    },
    'make-3d-items-texture-pack': {
      title: 'Przedmioty 3D w paczce tekstur do Minecrafta (Java)',
      h1: 'Przedmioty 3D i własne modele w paczce tekstur',
      description: 'Zamień płaskie przedmioty z Minecrafta w modele 3D i zmień kształty bloków w paczce zasobów do Javy: JSON modelu, definicje przedmiotów od 1.21.4, rozwiązania.',
      label: 'Przedmioty 3D',
      blurb: 'Zrób z płaskich przedmiotów modele 3D i zmień kształt bloków, plik po pliku.',
    },
    'make-a-pvp-texture-pack': {
      title: 'Jak zrobić paczkę tekstur PvP do Minecrafta (Java i Bedrock)',
      h1: 'Jak zrobić paczkę tekstur PvP do Minecrafta',
      description: 'Zrób za darmo paczkę PvP do Minecrafta: niski ogień, czyste szkło, mniejsze miecze, własny celownik i tekstury 8× dla FPS, od 1.8.9 do 26.3.',
      label: 'Paczka PvP',
      blurb: 'Niski ogień, czyste szkło, mniejsze miecze, celownik i tekstury dla FPS.',
    },
    'make-a-pbr-texture-pack': {
      title: 'Paczka tekstur PBR do Vibrant Visuals i shaderów',
      h1: 'Jak zrobić paczkę tekstur PBR do Vibrant Visuals i shaderów',
      description: 'Zrób za darmo paczkę PBR do Minecrafta: połysk, metal, świecenie i wypukłość jako zestawy tekstur do Vibrant Visuals i mapy labPBR do Irisa i OptiFine.',
      label: 'Paczka PBR',
      blurb: 'Połysk, metal, świecenie i wypukłość do Vibrant Visuals i shaderów labPBR.',
    },
    'rename-items-texture-pack': {
      title: 'Zmiana tekstury przedmiotu po zmianie nazwy (Minecraft)',
      h1: 'Zmień nazwę przedmiotu i jego teksturę',
      description: 'Zrób za darmo paczkę, w której przedmioty po zmianie nazwy wyglądają inaczej: definicje przedmiotów od Javy 1.21.5, CIT z OptiFine dla starszych wersji.',
      label: 'Zmiana nazwy przedmiotów',
      blurb: 'Daj przedmiotowi z nową nazwą własną teksturę, na przykład mieczowi „Excalibur”.',
    },
    'make-animated-textures': {
      title: 'Jak zrobić animowane tekstury do Minecrafta (Java i Bedrock)',
      h1: 'Jak zrobić animowane tekstury',
      description: 'Animuj za darmo w przeglądarce każdy blok i przedmiot z Minecrafta: klatki, czas w tickach, import GIF-ów, .png.mcmeta do Javy i flipbooki do Bedrocka.',
      label: 'Animowane tekstury',
      blurb: 'Animuj każdy blok i przedmiot: klatki, ticki, GIF-y, .mcmeta i flipbooki.',
    },
  },
};
