// Polish alt texts and captions of the screenshots (the images themselves show the English app,
// so short labels seen in them are quoted in English).

import { localShots } from '../../app/content/shots';

export const SHOTS = localShots({
  newPack: {
    alt: 'Formularz „New texture pack”: nazwa My First Pack, edycja Java, wersja Java 26.3 (format paczki 97.1), rozdzielczość 32× i opis, obok pole do otwarcia gotowej paczki.',
    caption: 'Nazwij paczkę i wybierz edycję, wersję gry i rozdzielczość.',
  },
  editor: {
    alt: 'Edytor tekstur z przodem pieca w edytorze pikseli 16×16, pomarańczowe kreski wokół paleniska i ten sam kolor na modelu 3D pieca w podglądzie.',
    caption: 'Malowanie przodu pieca: podgląd 3D pokazuje zmianę na prawdziwym modelu bloku.',
  },
  effects: {
    alt: 'Karta „Effects” z presetem Autumn: paski „przed i po” z przekolorowanymi teksturami, bloki mchu na liście bloków w pomarańczowo-brązowym kolorze.',
    caption: 'Efekty takie jak Autumn jednym kliknięciem zmieniają styl każdej tekstury.',
  },
  packSettings: {
    alt: 'Karta wersji gry w zakładce „Pack”: paczka jest zrobiona dla Javy 26.3 (format paczki 97.1) i działa też od Javy 1.21 (format paczki 34) do 26.3.',
    caption: 'Dzięki zakresowi zgodności jedna paczka wczytuje się w kilku wersjach Javy.',
  },
  export: {
    alt: 'Okno eksportu dla My First Pack.zip: jedna zmieniona tekstura, efekty Autumn, zrobiona dla Javy 26.3 z formatem paczki 97.1, działa w wersjach od 1.21 do 26.3, i przycisk „Export .zip”.',
    caption: 'Zanim pobierzesz paczkę, okno eksportu pokazuje, co do niej trafi.',
  },
  openPack: {
    alt: 'Gotowa paczka otwarta z pliku .zip: filtr „Edited” pokazuje jej trzy zmienione tekstury, a niebieskawa tekstura kamienia jest w edytorze pikseli i na bloku kamienia 3D w podglądzie.',
    caption: 'Otwieranie gotowego .zip: zmienione tekstury paczki są na liście i czekają na edycję.',
  },
  skin2d: {
    alt: 'Edytor skinów na szablonie 64×64 z podpisanymi częściami ciała i malowaniem lustrzanym, niebieskie i żółte kreski na klatce piersiowej i rękach, po prawej podgląd skina w 3D.',
    caption: 'Malowanie na szablonie 64×64 z odbiciem lustrzanym, a model 3D zmienia się razem z nim.',
  },
  skin3d: {
    alt: 'Edytor skinów w trybie malowania 3D: model jest lekko obrócony, jego lewa ręka ukryta przez figurkę części ciała, czerwona farba na klatce piersiowej.',
    caption: 'Malowanie prosto na modelu 3D, z ukrytą ręką, żeby dostać się do tułowia.',
  },
  skinPack: {
    alt: 'Okno „Make a skin pack”: nazwa paczki Adventure Crew z trzema skinami, Wizard (szerokie ręce, ten skin), Robot (wąskie ręce) i Explorer (szerokie ręce), i przycisk „Download pack”.',
    caption: 'Trzy skiny, szerokie i wąskie, w jednej paczce skinów do Bedrocka.',
  },
  shaderVanilla: {
    alt: 'Kreator shaderów dla czystej Javy z suwakami koloru i tonu (jasność, kontrast, nasycenie) obok podglądu 3D na żywo z trawiastą wyspą.',
    caption: 'Paczka shaderów do Javy bez modów: suwaki kolorów z podglądem na żywo.',
  },
  shaderIris: {
    alt: 'Kreator shaderów dla Irisa i OptiFine o zachodzie słońca: ciepłe, niskie światło i długie cienie w podglądzie, presety i suwak siły słońca.',
    caption: 'Paczka shaderów do Irisa i OptiFine z prawdziwymi cieniami w podglądzie o zachodzie słońca.',
  },
  vibrantVisuals: {
    alt: 'Kreator shaderów dla Vibrant Visuals w Bedrocku: jasny podgląd z niebieskim niebem, presety, suwak jasności słońca i informacja, że mody nie są potrzebne.',
    caption: 'Robienie paczki Vibrant Visuals do Bedrocka z podglądem na żywo.',
  },
  paint3d: {
    alt: 'Edytor tekstur w trybie 3D: model pieca wypełnia obszar, czerwone kreski są namalowane prosto na jego przodzie, obok płaska tekstura przodu pieca z tymi samymi kreskami.',
    caption: 'Malowanie prosto na piecu 3D: każda ściana maluje teksturę, którą pokazuje.',
  },
  mobGear: {
    alt: 'Model konia w edytorze tekstur z siodłem i skórzaną zbroją końską, obok wybór umaszczenia, znaczeń, wieku, siodła i zbroi.',
    caption: 'Moby pokazują się na własnych modelach 3D, z siodłami i zbrojami, które też możesz pomalować.',
  },
  mobParts: {
    alt: 'Zombie w żelaznej zbroi, któremu na liście części ukryto napierśnik, żeby pomalować jego koszulę w 3D.',
    caption: 'Ukryj część, tutaj napierśnik, żeby pomalować to, co zasłania.',
  },
  convertPack: {
    alt: 'Konwerter paczek tekstur z wybraną paczką do Javy 26.2 (6 tekstur) i Bedrock Edition jako celem, z przyciskiem „Convert to Bedrock”.',
    caption: 'Wybierz paczkę i cel konwersji.',
  },
  convertResult: {
    alt: 'Wynik konwertera: 4 z 6 tekstur przekonwertowane z Javy 26.2 na Bedrock, z przyciskami do pobrania i otwarcia w edytorze oraz listami pominiętych tekstur z powodem.',
    caption: 'Raport pokazuje, co zostało przekonwertowane i dlaczego coś pominięto.',
  },
  mergeSettings: {
    alt: '„Merge Texture Packs” z trzema paczkami w kolejności ważności (Top Pack, Extras i paczka do Javy 1.12.2), nazwą połączonej paczki, wyborem ikony i Javą 26.3 jako wersją docelową.',
    caption: 'Ustaw paczki w kolejności: ta na górze wygrywa każdy konflikt.',
  },
  mergeResult: {
    alt: 'Wynik: 3 paczki połączone w jedną, z paskiem dla każdej paczki pokazującym użyte, połączone i nieużyte pliki oraz listą konfliktów.',
    caption: 'Wynik pokazuje, ile wzięto z każdej paczki, i każdy konflikt.',
  },
  modelEditShape: {
    alt: 'Edytor tekstur z diamentowym mieczem na liście przedmiotów: jego sprite 16×16 w edytorze pikseli, a w zakładce „Preview” płaski miecz z przyciskiem „Edit shape” pod spodem.',
    caption: 'Pokaż przedmiot w zakładce „Preview” i naciśnij „Edit shape”, żeby otworzyć edytor modeli.',
  },
  modelSpriteStart: {
    alt: 'Edytor modeli z diamentowym mieczem, płaskim spritem bez sześcianów: punkty startowe „3D item from sprite”, „Full cube”, „Slab”, „Cross (plant)” i „Empty” w widoku 3D i w zakładce „Model”.',
    caption: 'Płaski przedmiot nie ma jeszcze sześcianów: wybierz „3D item from sprite”.',
  },
  model3dSword: {
    alt: 'Diamentowy miecz jako model 3D z 19 sześcianów o głębokości 1 piksela. Sześcian 5 jest wybrany na liście i widoczny w widoku 3D ze strzałkami przesuwania, z pozycją (9, 11, 7,5) i rozmiarem (5 × 1 × 1) w zakładce „Cube”.',
    caption: 'Ze sprite’a powstaje 19 sześcianów. Wybierz jeden, żeby go przesunąć, zmienić jego rozmiar albo ściany.',
  },
  modelDisplay: {
    alt: 'Zakładka „Display” z widokiem „Third person”: diamentowy miecz 3D w ręce modelu gracza i pola obrotu (0, -90, 55), pozycji (0, 4, 0,5) i rozmiaru (0,85) prawej ręki.',
    caption: '„Display” ustala, jak model jest trzymany, noszony i pokazywany, każde z podglądem.',
  },
  modelFlatInventory: {
    alt: 'Zakładka „Model” z włączoną opcją płaskiej ikony w ekwipunku, która zostawia płaską ikonę w ekwipunku, na ziemi i w ramce. Na górze widać teraz item/diamond_sword_3d.json.',
    caption: 'Płaska ikona w ekwipunku (od 1.21.4) zapisuje kształt 3D jako drugi model, do ręki.',
  },
  modelBlock: {
    alt: 'Model bloku kamienia jako stopień: sześcian 16×8×16 jak płyta i drugi sześcian 16×8×8 na jednej jego połowie, w zakładce „Cube” z pozycją i rozmiarem.',
    caption: 'Kamień jako stopień: punkt startowy „Slab” i jeszcze jeden sześcian.',
  },
  pvpStart: {
    alt: 'Formularz „New texture pack” z wybraną paczką PvP / FPS w polu startu, włączoną dodatkową paczką FPS, edycją Java, wersją Java 1.8.9 i przyciskiem tworzenia paczki PvP.',
    caption: 'Wybierz paczkę PvP / FPS i wersję, w którą grasz.',
  },
  pvpTweaks: {
    alt: 'Edytor tekstur paczki PvP do Javy 1.8.9: fire_layer_1 w edytorze pikseli z płomieniami przesuniętymi do dolnej połowy klatki i zakładka „PvP” z włączonym niskim ogniem, wysokością „niżej” i bez zmian dla bloków ognia.',
    caption: 'Zakładka „PvP”: każda opcja to przełącznik, z ustawieniami i plikami, które zmienia.',
  },
  pvpCrosshair: {
    alt: 'Powiększony icons.png z zaznaczonym kwadratem celownika 16×16 w lewym górnym rogu i szarym celownikiem w kształcie rombu, obok serca i ikony zbroi, oraz karta własnego celownika z pięcioma kształtami i przyciskiem do rysowania własnego.',
    caption: 'Rysowanie własnego celownika: do Javy 1.20.1 celownik to lewy górny róg pliku icons.png.',
  },
  pvpBedrock: {
    alt: 'Paczka PvP do Bedrocka: tekstura czerwonego szkła, przezroczysta w środku, z zachowaną ramką, i zakładka „PvP” z wyłączonym niskim ogniem i powodem, a pod nim włączone czyste szkło.',
    caption: 'W Bedrocku opcje, których paczka nie może zrobić, są wyłączone, z podanym powodem.',
  },
});
