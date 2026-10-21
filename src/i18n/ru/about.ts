// Russian About page (see AboutText in src/tools/about/content.ts).

import { el } from '../../app/markup';
import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL } from '../../app/site';
import { F, LATEST } from '../../app/content/facts';
import type { AboutText } from '../../tools/about/content';

export const ABOUT: AboutText = {
  differences: [
    {
      title: 'Все версии Java с 1.6.1',
      text: [`Не только последняя: делай пак для ${LATEST}, 1.21.11, 1.20.1 или 1.8.9 — каждый со своими текстурами и правильным pack.mcmeta.`],
    },
    {
      title: 'Java, Bedrock и конвертер',
      text: ['Делай паки для любого издания, а потом переводи пак из Java в Bedrock или обратно с помощью ', link('/texture-pack-converter', 'конвертера текстурпаков'), '.'],
    },
    {
      title: 'Текстуры, скины и шейдеры',
      text: ['Один сайт для текстурпаков, скинов и наборов скинов, а ещё шейдеров для Iris, OptiFine, ванильной Java и Vibrant Visuals в Bedrock.'],
    },
    {
      title: 'Ничего не загружается на сервер',
      text: ['Всё работает в браузере. Файлы игры берутся напрямую у Mojang, а твоя работа остаётся на твоём устройстве.'],
    },
    {
      title: 'Бесплатно и с открытым кодом',
      text: ['Ни аккаунта, ни рекламы, ни платных тарифов. Код открыт под лицензией MIT на ', ext(REPO_URL, 'GitHub'), '.'],
    },
    {
      title: 'Работает офлайн',
      text: ['После первого посещения приложение и нужные файлы игры остаются на устройстве, так что всё работает и без интернета.'],
    },
  ],
  faq: [
    {
      id: 'who',
      q: 'Кто делает Texture Pack Maker?',
      a: [el('p', null, `Texture Pack Maker делает ${PUBLISHER.name} — независимый автор. Это фанатский проект, он не связан с Mojang и Microsoft.`)],
    },
    {
      id: 'cost',
      q: 'Это платно?',
      a: [el('p', null, 'Нет. Все инструменты бесплатны: без аккаунта, без рекламы и без ограничений на количество паков.')],
    },
    {
      id: 'files',
      q: 'Откуда берутся текстуры Minecraft?',
      a: [
        el(
          'p',
          null,
          'Твой браузер скачивает их у Mojang, когда ты выбираешь версию: текстуры Java — из официальных файлов игры, текстуры Bedrock — из репозитория Mojang ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          '. Они хранятся на твоём устройстве и никогда не сохраняются на этом сайте.',
        ),
      ],
    },
    {
      id: 'contact',
      q: 'Как сообщить об ошибке или предложить идею?',
      a: [el('p', null, 'Создай issue на ', ext(`${REPO_URL}/issues`, 'GitHub'), '. Укажи, пожалуйста, инструмент, издание и версию игры.')],
    },
  ],
  eyebrow: 'О проекте',
  title: 'О Texture Pack Maker',
  intro: `Texture Pack Maker — бесплатный сайт с открытым кодом, где можно делать текстурпаки, скины и шейдеры для Minecraft прямо в браузере: для Java Edition (${LATEST} и все версии вплоть до 1.6.1) и Bedrock Edition. Его делает ${PUBLISHER.name}.`,
  differentTitle: 'Чем отличается Texture Pack Maker',
  toolsTitle: 'Инструменты',
  tools: [
    [link('/textures', 'Редактор текстурпаков'), ': перерисовывай любой блок, предмет или моба на его 3D-модели, загружай свои картинки, заменяй звуки, меняй стиль всего пака в один клик или открывай готовый пак.'],
    [link('/texture-pack-converter', 'Конвертер текстурпаков'), ': из Java в Bedrock, из Bedrock в Java, между версиями Java или из PNG-текстур в .mcpack.'],
    [link('/merge-texture-packs', 'Объединение текстурпаков'), ': собери до восьми паков в один, в нужном тебе порядке.'],
    [link('/totem-maker', 'Свой тотем'), ': преврати любой скин в собственный тотем бессмертия — ресурспак для Java или Bedrock.'],
    [link('/skins', 'Редактор скинов'), ' и ', link('/skin-pack-maker', 'наборы скинов'), ': рисуй скины в 2D или 3D, с обычными или тонкими руками, и собирай их в набор скинов для Bedrock.'],
    [link('/shaders', 'Конструктор шейдеров'), ': шейдерпаки для Iris и OptiFine, ванильные шейдеры для Java без модов и наборы Vibrant Visuals для Bedrock.'],
    [link('/guides', 'Гайды'), ': как делать, устанавливать и чинить паки, плюс формат пака каждой версии Java.'],
  ],
  howTitle: 'Как это работает',
  how: [
    'Когда ты выбираешь версию игры, браузер скачивает её текстуры напрямую у Mojang и хранит их на твоём устройстве. Твои проекты тоже сохраняются в браузере (IndexedDB), а экспорт собирается прямо на устройстве: ',
    code('.zip'),
    ' для Java с правильным ',
    code('pack.mcmeta'),
    ` (в Java ${LATEST} формат пака — ${F(LATEST)}) или `,
    code('.mcpack'),
    ' для Bedrock с файлом ',
    code('manifest.json'),
    '. Ничего из того, что ты делаешь, не отправляется на сервер.',
  ],
  makerTitle: 'Кто его делает',
  maker: ['Texture Pack Maker делает ', strong(PUBLISHER.name), '. Исходный код открыт: любой может посмотреть, как всё устроено, предложить изменения или сообщить о проблеме.'],
  notOfficial: 'Не является официальным продуктом Minecraft. Не одобрен компаниями Mojang и Microsoft и не связан с ними.',
  questions: 'Частые вопросы',
};
