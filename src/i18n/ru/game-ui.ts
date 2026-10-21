// Menu and button names as the Russian game shows them, quoted by the help page and the guides.
// Java: assets/minecraft/lang/ru_ru.json (26.3). Bedrock: texts/ru_RU.lang. Iris: its ru_ru.json.
// OptiFine and the Minecraft Launcher: their Russian interface.

export const JAVA = {
  options: 'Настройки...',
  packs: 'Наборы ресурсов...',
  /** Title of the Resource Packs screen */
  packsScreen: 'Выбор наборов ресурсов',
  openFolder: 'Папка с наборами',
  available: 'Доступные',
  selected: 'Выбранные',
  done: 'Готово',
  yes: 'Да',
  video: 'Настройки графики...',
  graphicsApi: 'Графический API',
  graphicsApiDefault: 'По умолчанию',
  graphicsApiOpenGl: 'OpenGL',
  /** Shown under a pack made for another version */
  madeForOlder: 'Предназначен для более старой версии Minecraft',
  madeForNewer: 'Предназначен для более новой версии Minecraft',
  incompatible: 'Неисправен или несовместим',
} as const;

export const IRIS = {
  shaderPacks: 'Наборы шейдеров...',
  openFolder: 'Папка с наборами',
  apply: 'Применить',
  settings: 'Настройки набора шейдеров',
} as const;

export const OPTIFINE = {
  shaders: 'Шейдеры...',
  folder: 'Папка шейдеров',
} as const;

export const BEDROCK = {
  settings: 'Настройки',
  globalResources: 'Глобальные ресурсы',
  myPacks: 'Мои наборы',
  activate: 'Активировать',
  storage: 'Хранилище',
  editWorld: 'Изменить мир',
  packs: 'Наборы ресурсов',
  video: 'Видео',
  graphicsMode: 'Графический режим',
  /** Vibrant Visuals in the Graphics Mode list */
  vibrantVisuals: 'Яркие виз. эффекты',
  dressingRoom: 'Гардеробная',
  classicSkins: 'Классические скины',
  ownedSkins: 'Скины во владении',
  import: 'Импорт',
  equip: 'Надеть',
  trustedSkins: 'Разрешить только проверенные скины',
  importStarted: 'Импорт запущен...',
  imported: 'Успешный импорт',
} as const;

export const LAUNCHER = {
  skins: 'Скины',
  newSkin: 'Новый скин',
  classic: 'Классическая',
  slim: 'Тонкая',
  browse: 'Обзор',
  saveAndUse: 'Сохранить и использовать',
} as const;
