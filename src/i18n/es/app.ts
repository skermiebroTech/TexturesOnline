// Spanish texts of the installable-app features (see AppText in src/pwa/text.ts).

import type { AppText } from '../../pwa/text';

export const APP_TEXT_ES: Partial<AppText> = {
  installApp: 'Instalar app',
  installTitle: 'Instalar Texture Pack Maker',
  installWhy: 'Ábrelo desde tu pantalla de inicio o escritorio como cualquier otra app. También funciona sin conexión.',
  installIos: ['Toca el botón Compartir en la barra de Safari.', 'Elige «Añadir a pantalla de inicio».', 'Toca «Añadir».'],
  installMacSafari: ['En la barra de menús de Safari, elige Archivo › Añadir al Dock.', 'Haz clic en «Añadir».'],
  gotIt: 'Entendido',
  installed: 'Texture Pack Maker está instalado. Lo encontrarás junto a tus otras apps.',
  exportHint: 'Consejo: instala Texture Pack Maker como app para abrirlo desde el escritorio o la pantalla de inicio, incluso sin conexión.',
  install: 'Instalar',
  updateReady: 'Hay una nueva versión de Texture Pack Maker lista.',
  reload: 'Recargar',
  cantOpen: 'Texture Pack Maker no puede abrir «{name}». Elige un pack .zip, .mcpack o .mcaddon, o una skin o textura .png.',
  privacy: 'Privacidad',
};
