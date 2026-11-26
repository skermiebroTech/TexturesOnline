// Japanese texts of the installable-app features (see AppText in src/pwa/text.ts).

import type { AppText } from '../../pwa/text';

export const APP_TEXT_JA: Partial<AppText> = {
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
};
