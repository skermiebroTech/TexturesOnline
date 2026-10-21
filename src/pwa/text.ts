// Texts of the installable-app features (install entry, update notice, opening files) and the
// privacy link. A translation fills in the same keys for its language (anything left out falls
// back to English).

import type { Locale } from '../i18n/locales';

export interface AppText {
  /** Footer link and phone menu item */
  installApp: string;
  /** Install dialog title (iPhone/iPad and Safari on Mac, which have no install prompt) */
  installTitle: string;
  /** Why install, one line (dialog and the one-time hint) */
  installWhy: string;
  /** iPhone / iPad steps */
  installIos: string[];
  /** Safari on macOS steps */
  installMacSafari: string[];
  /** Dialog close button */
  gotIt: string;
  /** Toast after the app has been installed */
  installed: string;
  /** One-time hint after the first export */
  exportHint: string;
  /** Action button on the hint */
  install: string;
  /** Update notice */
  updateReady: string;
  /** Update notice action */
  reload: string;
  /** A file opened with the app (or shared to it) that it can't use; {name} is the file name */
  cantOpen: string;
  /** Footer link to the privacy page */
  privacy: string;
}

export const APP_TEXT_EN: AppText = {
  installApp: 'Install app',
  installTitle: 'Install Texture Pack Maker',
  installWhy: 'Open it from your home screen or desktop like any other app. It works offline too.',
  installIos: ['Tap the Share button in Safari’s toolbar.', 'Choose “Add to Home Screen”.', 'Tap “Add”.'],
  installMacSafari: ['In Safari’s menu bar, choose File › Add to Dock.', 'Click “Add”.'],
  gotIt: 'Got it',
  installed: 'Texture Pack Maker is installed. You’ll find it with your other apps.',
  exportHint: 'Tip: install Texture Pack Maker as an app to open it from your desktop or home screen, even offline.',
  install: 'Install',
  updateReady: 'A new version of Texture Pack Maker is ready.',
  reload: 'Reload',
  cantOpen: 'Texture Pack Maker can’t open “{name}”. Choose a .zip, .mcpack or .mcaddon pack, or a .png skin or texture.',
  privacy: 'Privacy',
};

/** Translations, by language (partial: missing keys use English). */
export const APP_TEXT: Partial<Record<Locale, Partial<AppText>>> = {
  de: {
    installApp: 'App installieren',
    installTitle: 'Texture Pack Maker installieren',
    installWhy: 'Öffne sie wie jede andere App vom Startbildschirm oder Desktop. Sie funktioniert auch offline.',
    installIos: ['Tippe in der Safari-Leiste auf „Teilen“.', 'Wähle „Zum Home-Bildschirm“.', 'Tippe auf „Hinzufügen“.'],
    installMacSafari: ['Wähle in der Menüleiste von Safari Ablage › Zum Dock hinzufügen.', 'Klicke auf „Hinzufügen“.'],
    gotIt: 'Verstanden',
    installed: 'Texture Pack Maker ist installiert. Du findest ihn bei deinen anderen Apps.',
    exportHint: 'Tipp: Installiere Texture Pack Maker als App, um ihn vom Desktop oder Startbildschirm zu öffnen, sogar offline.',
    install: 'Installieren',
    updateReady: 'Eine neue Version von Texture Pack Maker ist bereit.',
    reload: 'Neu laden',
    cantOpen: 'Texture Pack Maker kann „{name}“ nicht öffnen. Wähle ein .zip-, .mcpack- oder .mcaddon-Pack oder einen Skin bzw. eine Textur als .png.',
    privacy: 'Datenschutz',
  },
  es: {
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
  },
  'pt-br': {
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
  },
  ja: {
    installApp: 'アプリをインストール',
    installTitle: 'Texture Pack Makerをインストール',
    installWhy: 'ほかのアプリと同じようにホーム画面やデスクトップから開けます。オフラインでも使えます。',
    installIos: ['Safariのツールバーにある共有ボタンをタップします。', '「ホーム画面に追加」を選びます。', '「追加」をタップします。'],
    installMacSafari: ['Safariのメニューバーで ファイル › Dockに追加 を選びます。', '「追加」をクリックします。'],
    gotIt: 'OK',
    installed: 'Texture Pack Makerをインストールしました。ほかのアプリと同じ場所にあります。',
    exportHint: 'ヒント：Texture Pack Makerをアプリとしてインストールすると、デスクトップやホーム画面からオフラインでも開けます。',
    install: 'インストール',
    updateReady: 'Texture Pack Makerの新しいバージョンが利用できます。',
    reload: '再読み込み',
    cantOpen: 'Texture Pack Makerは「{name}」を開けません。.zip、.mcpack、.mcaddonのパック、または.pngのスキンやテクスチャを選んでください。',
    privacy: 'プライバシー',
  },
  ru: {
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
  },
};

export function appText(locale: Locale = 'en'): AppText {
  return { ...APP_TEXT_EN, ...(APP_TEXT[locale] ?? {}) };
}
