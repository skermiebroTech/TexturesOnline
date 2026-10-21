// Russian page titles, descriptions and short names (see MetaTranslation in src/app/seo/meta.ts).
// Wording follows what Russian players search for: «текстурпак» / «текстур пак», «ресурспак»,
// «скин», «шейдеры», with Minecraft written in Latin letters as in the game.

import type { MetaTranslation } from '../../app/seo/meta';
import { F, LATEST } from '../../app/content/facts';

export const META_RU: MetaTranslation = {
  pages: {
    '/': {
      title: 'Создать текстурпак для Minecraft онлайн — Java и Bedrock',
      description: `Сделай свой текстур пак для Майнкрафта: перерисуй блоки на 3D-моделях, примени эффекты в один клик и скачай .zip или .mcpack. Бесплатно, Java ${LATEST}.`,
      label: 'Главная',
    },
    '/textures': {
      title: 'Редактор текстурпаков Minecraft — создать ресурспак онлайн',
      description: 'Меняй любые текстуры Minecraft: рисуй блоки, предметы и мобов на 3D-моделях, загружай PNG или меняй стиль игры в один клик. Экспорт в .zip или .mcpack.',
      label: 'Текстурпаки',
    },
    '/texture-pack-converter': {
      title: 'Конвертер текстурпаков Minecraft: Java в Bedrock и обратно',
      description: 'Переведи текстурпак Minecraft из Java в Bedrock, из Bedrock в Java или на другую версию Java, либо собери .mcpack из PNG. Бесплатно, прямо в браузере.',
      label: 'Конвертер текстурпаков',
    },
    '/merge-texture-packs': {
      title: 'Объединить текстурпаки Minecraft онлайн — Java и Bedrock',
      description: 'Собери несколько текстурпаков Minecraft в один .zip или .mcpack. Расставь их по порядку: верхний пак побеждает, как в игре. Бесплатно, в браузере.',
      label: 'Объединение текстурпаков',
    },
    '/totem-maker': {
      title: 'Свой тотем бессмертия в Minecraft — Java и Bedrock',
      description: 'Преврати любой скин Minecraft в тотем бессмертия: загрузи PNG или введи ник, выбери стиль и скачай ресурспак .zip для Java или .mcpack для Bedrock.',
      label: 'Свой тотем',
    },
    '/skins': {
      title: 'Редактор скинов Minecraft — создать скин онлайн бесплатно',
      description: 'Нарисуй свой скин для Майнкрафта в 2D или 3D, с обычными или тонкими руками. Скачай PNG для Java или набор скинов .mcpack для Bedrock. Бесплатно.',
      label: 'Скины',
    },
    '/skin-pack-maker': {
      title: 'Создать набор скинов Minecraft (скинпак .mcpack) бесплатно',
      description: 'Собери свой набор скинов для Minecraft Bedrock онлайн: нарисуй или загрузи скины, смешай обычные и тонкие руки и скачай готовый .mcpack. Бесплатно.',
      label: 'Наборы скинов',
    },
    '/shaders': {
      title: 'Создать шейдеры для Minecraft: Iris, OptiFine и без модов',
      description: 'Собери шейдерпак для Iris или OptiFine, ванильные шейдеры без модов для Java или набор Vibrant Visuals для Bedrock: пресеты, ползунки и 3D-превью.',
      label: 'Шейдеры',
    },
    '/help': {
      title: 'Как установить текстурпак, скин и шейдеры в Minecraft',
      description: 'Как установить текстурпаки, скины и шейдеры в Minecraft Java и Bedrock на ПК, Mac, телефоне и консоли, где найти нужную папку и что делать при ошибках.',
      label: 'Помощь',
    },
    '/about': {
      title: 'О Texture Pack Maker: бесплатно и с открытым кодом',
      description: 'Кто делает Texture Pack Maker, чем он отличается (все версии Java с 1.6.1, Bedrock, конвертер, открытый код) и почему твои данные остаются у тебя.',
      label: 'О проекте',
    },
    '/privacy': {
      title: 'Конфиденциальность — Texture Pack Maker',
      description: 'В Texture Pack Maker нет аккаунтов, рекламы и слежки. Паки, скины и шейдеры остаются на твоём устройстве, ничего не загружается на сервер.',
      label: 'Конфиденциальность',
    },
    '/all': {
      title: 'Все инструменты для Minecraft: паки, скины и шейдеры',
      description: 'Все бесплатные инструменты, функции и гайды Texture Pack Maker на одной странице: текстурпаки, 3D-модели, звуки, скины, наборы скинов и шейдеры.',
      label: 'Всё на сайте',
    },
    '/guides': {
      title: 'Гайды по текстурпакам, скинам и шейдерам Minecraft',
      description: `Пошаговые гайды: как создать и установить текстурпак, скин и шейдеры для Minecraft, плюс форматы паков всех версий от 1.6.1 до ${LATEST}.`,
      label: 'Гайды',
    },
  },
  guides: {
    'make-a-texture-pack': {
      title: 'Как сделать текстурпак для Minecraft (Java и Bedrock)',
      h1: 'Как сделать свой текстурпак для Minecraft',
      description: 'Как бесплатно создать текстур пак для Майнкрафта: выбери версию, перерисуй текстуры и экспортируй .zip с pack.mcmeta (Java) или .mcpack (Bedrock).',
      label: 'Как сделать текстурпак',
      blurb: 'Выбери версию, перерисуй текстуры и экспортируй пак, который загрузит Minecraft.',
    },
    'install-resource-packs': {
      title: 'Как установить ресурспак в Minecraft (Java и Bedrock)',
      h1: 'Как установить текстурпаки, шейдеры и файлы .mcpack в Minecraft',
      description: 'Как установить ресурспак в Java, импортировать .mcpack в Bedrock на ПК и телефоне, подключить шейдеры через Iris или OptiFine и найти пропавший пак.',
      label: 'Установка паков и шейдеров',
      blurb: 'Ресурспаки Java, файлы .mcpack для Bedrock и шейдерпаки, плюс решения проблем.',
    },
    'texture-pack-not-working': {
      title: 'Не работает текстурпак в Minecraft? Все решения',
      h1: 'Текстурпак Minecraft не работает? Как это исправить',
      description: 'Пака нет в списке, «предназначен для более старой версии», фиолетово-чёрные блоки, серая трава, ошибка импорта: в чём причина и как это исправить.',
      label: 'Пак не работает: решения',
      blurb: 'Пропавшие паки, предупреждения о версии, фиолетово-чёрные блоки и другие проблемы.',
    },
    'minecraft-pack-format-versions': {
      title: `Pack format Minecraft ${LATEST} (${F(LATEST)}) и всех версий Java`,
      h1: `Формат пака (pack format) для каждой версии Minecraft Java: в ${LATEST} — ${F(LATEST)}`,
      description: `Все версии Minecraft Java от 1.6.1 до ${LATEST} с номером формата набора ресурсов (в ${LATEST} это ${F(LATEST)}) и то, как менялся pack.mcmeta с годами.`,
      label: 'Форматы паков всех версий',
      blurb: `Формат пака для каждой версии Java от 1.6.1 до ${LATEST}.`,
    },
    'make-a-skin': {
      title: 'Как сделать свой скин для Minecraft (Java и Bedrock)',
      h1: 'Как сделать свой скин для Minecraft',
      description: 'Как бесплатно создать скин для Майнкрафта онлайн: рисуй на шаблоне 64×64 или HD 128×128 в 2D или 3D, выбери обычные или тонкие руки, для Java или Bedrock.',
      label: 'Как сделать скин',
      blurb: 'Раскрась шаблон 64×64 или HD 128×128 для Java или набора скинов Bedrock.',
    },
    'make-shaders-without-mods': {
      title: 'Шейдеры Minecraft без модов и OptiFine (Java и Bedrock)',
      h1: 'Можно ли сделать шейдеры для Minecraft без модов?',
      description: 'Да: в Java с 1.17 ресурспак может заменить шейдеры игры без OptiFine и Iris, а в Bedrock есть Vibrant Visuals. Что можно, чего нельзя и как это сделать.',
      label: 'Шейдеры без модов',
      blurb: 'Что умеют ванильные шейдерпаки для Java и Vibrant Visuals в Bedrock.',
    },
    'java-vs-bedrock-packs': {
      title: 'Текстурпаки Java и Bedrock: отличия и конвертация',
      h1: 'Текстурпаки Java и Bedrock: чем отличаются и как перенести',
      description: 'Работают ли паки Java в Bedrock? Нет: в Java это .zip и pack.mcmeta, в Bedrock — .mcpack и manifest.json. Сравниваем папки, имена, шейдеры и скины.',
      label: 'Паки Java и Bedrock',
      blurb: 'Файлы, папки, форматы, шейдеры и скины: сравнение бок о бок.',
    },
    'bedrock-vibrant-visuals-settings': {
      title: 'Настройки Vibrant Visuals в Minecraft Bedrock: разбор',
      h1: 'Настройки Vibrant Visuals в Bedrock: что они меняют',
      description: 'Что меняет набор Vibrant Visuals в Bedrock (солнце, небо, туман, вода, тени, цвета), на каких устройствах он работает и как его включить.',
      label: 'Настройки Vibrant Visuals',
      blurb: 'Солнце, небо, туман, вода и цвета, плюс поддерживаемые устройства.',
    },
    'convert-java-to-bedrock-texture-pack': {
      title: 'Как перевести текстурпак Java в Bedrock (и обратно)',
      h1: 'Как конвертировать текстурпак Java в Bedrock',
      description: 'Как бесплатно превратить текстурпак Java в .mcpack для Bedrock (или Bedrock в Java): что переносится, что нет и как установить готовый пак.',
      label: 'Из Java в Bedrock',
      blurb: 'Сделай из пака Java файл .mcpack для Bedrock в пару кликов — или наоборот.',
    },
    'merge-texture-packs': {
      title: 'Как объединить текстурпаки Minecraft: пошаговый гайд',
      h1: 'Как объединить текстурпаки Minecraft в один',
      description: 'Как собрать несколько текстурпаков в один для сервера, Realm или друзей: какой пак побеждает, что объединяется и как это сделать онлайн или вручную.',
      label: 'Объединение текстурпаков',
      blurb: 'Собери несколько паков в один, в нужном тебе порядке.',
    },
    'make-a-bedrock-skin-pack': {
      title: 'Как сделать набор скинов для Minecraft Bedrock (.mcpack)',
      h1: 'Как сделать свой набор скинов для Minecraft Bedrock',
      description: 'Свой набор скинов (скинпак) для Minecraft Bedrock: нарисуй или загрузи скины, экспортируй .mcpack, импортируй на ПК или телефоне, обнови или собери сам.',
      label: 'Набор скинов для Bedrock',
      blurb: 'Собери свои скины в один .mcpack и носи их в гардеробной.',
    },
    'make-3d-items-texture-pack': {
      title: '3D-предметы в текстурпаке Minecraft: как сделать (Java)',
      h1: 'Как сделать 3D-предметы и свои модели в текстурпаке Minecraft',
      description: 'Как превратить плоские предметы Minecraft в 3D-модели и поменять форму блоков в ресурспаке Java: JSON моделей, определения предметов с 1.21.4, решения.',
      label: 'Как сделать 3D-предметы',
      blurb: 'Преврати плоские предметы в 3D-модели и измени форму блоков, файл за файлом.',
    },
    'make-a-pvp-texture-pack': {
      title: 'Как сделать PvP-текстурпак для Minecraft (Java и Bedrock)',
      h1: 'Как сделать PvP-текстурпак для Minecraft',
      description: 'Бесплатно сделай PvP-текстурпак Minecraft: низкий огонь, прозрачное стекло, маленькие мечи, свой прицел и FPS-текстуры 8×, для 1.8.9–26.3.',
      label: 'Как сделать PvP-пак',
      blurb: 'Низкий огонь, прозрачное стекло, маленькие мечи, прицел и FPS-текстуры.',
    },
  },
};
