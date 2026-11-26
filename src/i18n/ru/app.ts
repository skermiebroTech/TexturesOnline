// Russian texts of the installable-app features (see AppText in src/pwa/text.ts).

import type { AppText } from '../../pwa/text';

export const APP_TEXT_RU: Partial<AppText> = {
  installApp: 'Установить приложение',
  installTitle: 'Установить Texture Pack Maker',
  installWhy: 'Открывай его с экрана «Домой» или рабочего стола, как любое другое приложение. Работает и без интернета.',
  installIos: ['Нажми кнопку «Поделиться» на панели Safari.', 'Выбери «На экран „Домой“».', 'Нажми «Добавить».'],
  installMacSafari: ['В строке меню Safari выбери Файл › Добавить в Dock.', 'Нажми «Добавить».'],
  gotIt: 'Понятно',
  installed: 'Texture Pack Maker установлен. Он появится среди других твоих приложений.',
  exportHint: 'Совет: установи Texture Pack Maker как приложение, чтобы открывать его с рабочего стола или экрана «Домой», даже без интернета.',
  install: 'Установить',
  updateReady: 'Готова новая версия Texture Pack Maker.',
  reload: 'Обновить',
  cantOpen: 'Texture Pack Maker не может открыть «{name}». Выбери пак .zip, .mcpack или .mcaddon либо скин или текстуру .png.',
  privacy: 'Конфиденциальность',
};
