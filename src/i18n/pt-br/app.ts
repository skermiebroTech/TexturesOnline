// Brazilian Portuguese texts of the installable-app features (see AppText in src/pwa/text.ts).

import type { AppText } from '../../pwa/text';

export const APP_TEXT_PT_BR: Partial<AppText> = {
  installApp: 'Instalar app',
  installTitle: 'Instalar o Texture Pack Maker',
  installWhy: 'Abra pela tela inicial ou pela área de trabalho como qualquer outro app. Também funciona offline.',
  installIos: ['Toque no botão Compartilhar na barra do Safari.', 'Escolha “Adicionar à Tela de Início”.', 'Toque em “Adicionar”.'],
  installMacSafari: ['Na barra de menus do Safari, escolha Arquivo › Adicionar ao Dock.', 'Clique em “Adicionar”.'],
  gotIt: 'Entendi',
  installed: 'O Texture Pack Maker foi instalado. Você vai encontrá-lo junto com seus outros apps.',
  exportHint: 'Dica: instale o Texture Pack Maker como app para abri-lo pela área de trabalho ou tela inicial, até offline.',
  install: 'Instalar',
  updateReady: 'Uma nova versão do Texture Pack Maker está pronta.',
  reload: 'Recarregar',
  cantOpen: 'O Texture Pack Maker não consegue abrir “{name}”. Escolha um pack .zip, .mcpack ou .mcaddon, ou uma skin ou textura .png.',
  privacy: 'Privacidade',
};
