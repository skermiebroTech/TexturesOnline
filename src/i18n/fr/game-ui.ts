// Menu and button names as the French game shows them, quoted by the help page and the guides.
// Java: assets/minecraft/lang/fr_fr.json (26.3). Bedrock: texts/fr_FR.lang. Iris: its fr_fr.json
// (its "Shader Pack Settings..." button has no French text, so Iris shows it in English).
// OptiFine and the Minecraft Launcher: their French interface.

export const JAVA = {
  options: 'Options...',
  packs: 'Packs de ressources...',
  /** Title of the Resource Packs screen */
  packsScreen: 'Choix des packs de ressources',
  openFolder: 'Ouvrir le dossier des packs',
  available: 'Disponibles',
  selected: 'Sélectionnés',
  done: 'Terminé',
  yes: 'Oui',
  video: 'Graphismes...',
  graphicsApi: 'API graphique',
  graphicsApiDefault: 'Par défaut',
  graphicsApiOpenGl: 'OpenGL',
  /** Shown under a pack made for another version */
  madeForOlder: 'Conçu pour une ancienne version de Minecraft',
  madeForNewer: 'Conçu pour une version plus récente de Minecraft',
  incompatible: 'Endommagé ou incompatible',
} as const;

export const IRIS = {
  shaderPacks: 'Packs de shaders...',
  openFolder: 'Ouvrir le dossier des packs de shaders...',
  apply: 'Appliquer',
  /** Not translated in Iris: shown in English */
  settings: 'Shader Pack Settings...',
} as const;

export const OPTIFINE = {
  shaders: 'Shaders...',
  folder: 'Dossier des shaders',
} as const;

export const BEDROCK = {
  settings: 'Paramètres',
  globalResources: 'Ressources globales',
  myPacks: 'Mes packs',
  activate: 'Activer',
  storage: 'Stockage',
  editWorld: 'Modifier le monde',
  packs: 'Packs de ressources',
  video: 'Vidéo',
  graphicsMode: 'Mode graphique',
  /** Vibrant Visuals in the Graphics Mode list */
  vibrantVisuals: 'Graphismes éclatants',
  dressingRoom: 'Vestiaire',
  classicSkins: 'Skins classiques',
  ownedSkins: 'Skins possédés',
  import: 'Importer',
  equip: 'Équiper',
  trustedSkins: 'Autoriser uniquement les skins de confiance',
  importStarted: 'Importation lancée...',
  /** "L'importation de … a abouti" */
  imported: 'L’importation de … a abouti',
} as const;

export const LAUNCHER = {
  skins: 'Skins',
  newSkin: 'Nouveau skin',
  classic: 'Classique',
  slim: 'Fin',
  browse: 'Parcourir',
  saveAndUse: 'Enregistrer et utiliser',
} as const;
