// Menu and button names as the Polish game shows them, quoted by the help page and the guides.
// Java: assets/minecraft/lang/pl_pl.json (26.3). Bedrock: texts/pl_PL.lang. Iris: its pl_pl.json.
// OptiFine and the Minecraft Launcher: their Polish interface.

export const JAVA = {
  /** menu.options (the button on the title screen; the screen itself is titled "Opcje") */
  options: 'Ustawienia…',
  packs: 'Paczki zasobów…',
  /** Title of the Resource Packs screen */
  packsScreen: 'Wybierz paczki zasobów',
  openFolder: 'Otwórz folder z paczkami',
  available: 'Dostępne',
  selected: 'Wybrane',
  done: 'Gotowe',
  yes: 'Tak',
  video: 'Ustawienia graficzne…',
  graphicsApi: 'API graficzne',
  graphicsApiDefault: 'Domyślne',
  graphicsApiOpenGl: 'Preferuj OpenGL',
  /** Shown under a pack made for another version */
  madeForOlder: 'Stworzona dla starszej wersji Minecrafta',
  madeForNewer: 'Stworzona dla nowszej wersji Minecrafta',
  incompatible: 'Zepsuta lub niekompatybilna',
  skinCustomisation: 'Dostosowywanie skórki…',
} as const;

export const IRIS = {
  shaderPacks: 'Pakiety Shaderów...',
  openFolder: 'Otwórz folder z pakietem Shaderów...',
  apply: 'Zastosuj',
  settings: 'Ustawienia pakietu Shader...',
} as const;

export const OPTIFINE = {
  shaders: 'Shadery...',
  folder: 'Folder shaderów',
} as const;

export const BEDROCK = {
  settings: 'Ustawienia',
  globalResources: 'Zasoby globalne',
  myPacks: 'Moje zestawy',
  activate: 'Aktywuj',
  storage: 'Schowek',
  editWorld: 'Edytuj świat',
  packs: 'Paczki zasobów',
  video: 'Wideo',
  graphicsMode: 'Tryb grafiki',
  /** Vibrant Visuals in the Graphics Mode list */
  vibrantVisuals: 'Odświeżona szata graficzna',
  creator: 'Twórca',
  contentLog: 'Historia dziennika treści',
  dressingRoom: 'Przebieralnia',
  classicSkins: 'Klasyczne skórki',
  ownedSkins: 'Posiadane skórki',
  chooseNewSkin: 'Wybierz nową skórkę',
  import: 'Importuj',
  equip: 'Załóż',
  trustedSkins: 'Zezwalaj tylko na zaufane skórki',
  importStarted: 'Importowanie rozpoczęte...',
  /** content.import.succeeded, without the pack name */
  imported: 'Udało się zaimportować',
  /** What the game calls a skin pack */
  skinPack: 'Zestaw skórek',
} as const;

export const LAUNCHER = {
  skins: 'Skórki',
  newSkin: 'Nowa skórka',
  classic: 'Klasyczny',
  slim: 'Smukły',
  browse: 'Przeglądaj',
  saveAndUse: 'Zapisz i użyj',
} as const;
