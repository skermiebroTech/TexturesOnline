// Japanese text of project files and backups (English source: ./text.ts).

import type { ProjectFileLanguage } from './load';

const JA: ProjectFileLanguage = {
  'shared.projectFile': {
    saved: '{file}を保存しました。このサイトでいつでも開いて、続きを編集できます。',
    saveFailed: 'プロジェクトファイルを保存できませんでした。',
    opened: '「{name}」を開きました',
    openedCopy: '「{name}」をコピーとして開きました。もとからあったプロジェクトはそのままです。',
    copyName: '{name}（コピー）',
    untitled: '無題',
    errors: {
      notZip: 'これはプロジェクトファイルではありません。プロジェクトファイルの拡張子は.tpmprojectか.tpmbackupです。',
      notProject: 'これはTexture Pack Makerのプロジェクトファイルではありません。パックを開くには、テクスチャパックメーカーの「パックを開く」を使ってください。',
      damaged: 'このプロジェクトファイルは壊れているため、開けません。',
      newer: 'このファイルは新しいバージョンのTexture Pack Makerで保存されています（形式 {version}）。ページを再読み込みして更新してから、もう一度開いてください。',
      empty: 'このファイルにはプロジェクトが入っていません。',
      item: '「{name}」は壊れているため、除外しました。',
    },
    types: {
      texturepack: 'テクスチャパック',
      skin: 'スキン',
      shader: 'シェーダー',
      cape: 'マント',
      font: 'フォント',
    },
    counts: {
      texturepack: 'テクスチャパック {count}個',
      skin: 'スキン {count}個',
      shader: 'シェーダー {count}個',
      cape: 'あなたのマント',
      font: 'あなたのフォント',
    },
    backup: {
      title: 'プロジェクトをバックアップ',
      intro: 'このブラウザーにあるすべてのプロジェクトを1つのファイルにまとめます。安全な場所に保管するか、別のブラウザーやデバイスで開くと、すべてを移せます。',
      none: 'このブラウザーにはまだプロジェクトがありません。',
      contains: 'バックアップの内容',
      gameFiles: 'ゲーム本体のファイルは含まれません。プロジェクトを開くと、Mojangからもう一度ダウンロードされます。',
      download: 'バックアップをダウンロード',
      done: 'バックアップを保存しました：{file}',
      failed: 'バックアップを作成できませんでした。',
    },
    restore: {
      title: 'バックアップから復元',
      intro: '{date}に保存されたバックアップです。このブラウザーに戻すものを選んでください。',
      choose: 'プロジェクト',
      already: 'すでにあります',
      existing: 'このブラウザーにすでにあるもの',
      skip: 'スキップ',
      keepBoth: '両方残す',
      skipNote: 'このブラウザーにあるものをそのまま残します',
      copyNote: 'コピーとして、今あるものの隣に復元します',
      replaceNote: 'このブラウザーにあるものと置き換えます',
      selectAll: 'すべて選択',
      selectNone: '選択を解除',
      restore: '{count, plural, =0 {復元} other {#個のプロジェクトを復元}}',
      done: '{count}個のプロジェクトを復元しました',
      failed: '「{name}」を復元できませんでした。',
      edited: '{date}に編集',
    },
    replace: {
      capeTitle: 'マントを置き換えますか？',
      capeText: 'マントメーカーに保存できるマントは1つだけなので、「{name}」を開くと、今作っているマントと置き換わります。残したい場合は、先にプロジェクトファイルとして保存してください。',
      saveFirst: '先に今のマントを保存',
      replace: '置き換える',
    },
  },
};

export default JA;
