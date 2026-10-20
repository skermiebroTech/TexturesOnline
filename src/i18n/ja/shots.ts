// Japanese alt texts and captions of the screenshots (the images themselves show the English app).

import { localShots } from '../../app/content/shots';

export const SHOTS = localShots({
  newPack: {
    alt: '「New texture pack」の入力フォーム。名前はMy First Pack、エディションはJava、バージョンはJava 26.3（パックフォーマット97.1）、解像度32×、説明文。隣にパックを開くエリア。',
    caption: 'パックに名前をつけ、エディション・ゲームのバージョン・解像度を選びます。',
  },
  editor: {
    alt: 'テクスチャエディターの16×16ピクセルエディターでかまどの正面を開き、火の口のまわりにオレンジの線を描いた画面。プレビューのかまどの3Dモデルにも同じ色が反映されている。',
    caption: 'かまどの正面を塗っているところ。3Dプレビューで実際のブロックモデルへの変化を確認できます。',
  },
  effects: {
    alt: '「Effects」タブでプリセットAutumnを適用した画面。色を変えたテクスチャの比較と、ブロック一覧で橙茶色になった苔ブロック。',
    caption: 'Autumnのようなワンクリック効果で、すべてのテクスチャの雰囲気をまとめて変えられます。',
  },
  packSettings: {
    alt: '「Pack」タブのゲームバージョンのカード。パックはJava 26.3（パックフォーマット97.1）向けで、Java 1.21（パックフォーマット34）から26.3まで動作する。',
    caption: '対応範囲を指定すると、1つのパックを複数のJava版で読み込めます。',
  },
  export: {
    alt: 'My First Pack.zipの書き出しダイアログ。編集したテクスチャ1枚、Autumnの効果、Java 26.3・パックフォーマット97.1向けで1.21〜26.3対応、「Export .zip」ボタン。',
    caption: '書き出しダイアログで、ダウンロード前にパックの中身を確認できます。',
  },
  openPack: {
    alt: '.zipから開いた既存のパック。「Edited」フィルターに変更済みのテクスチャ3枚が並び、青みがかった石のテクスチャがピクセルエディターと3Dの石ブロックに表示されている。',
    caption: '既存の.zipを開くと、変更済みのテクスチャが一覧に並び、そのまま編集できます。',
  },
  skin2d: {
    alt: '64×64テンプレート上のスキンエディター。体の部位に名前がつき、左右対称塗りがオン。胸と腕に青と黄色の線、右側にスキンの3Dプレビュー。',
    caption: '左右対称塗りで64×64テンプレートを塗ると、3Dモデルもすぐ更新されます。',
  },
  skin3d: {
    alt: '3D塗りモードのスキンエディター。モデルを少し回転させ、体の部位の図で左腕を非表示にし、胸に赤い色を塗っている。',
    caption: '3Dモデルに直接塗るところ。腕を隠して胴体に届くようにしています。',
  },
  skinPack: {
    alt: '「Make a skin pack」ダイアログ。パック名Adventure Crewに3つのスキン（Wizard：クラシックの腕・このスキン、Robot：スリムの腕、Explorer：クラシックの腕）と「Download pack」ボタン。',
    caption: 'クラシックとスリムの3つのスキンを、統合版のスキンパック1つにまとめます。',
  },
  shaderVanilla: {
    alt: 'Vanilla Java用のShader Maker。色と明るさのスライダー（明るさ・コントラスト・彩度）の隣に、草の島のリアルタイム3Dプレビュー。',
    caption: 'Java版バニラのシェーダーパック。プレビューを見ながら色を調整でき、MODは不要です。',
  },
  shaderIris: {
    alt: '夕暮れ時のIris・OptiFine用Shader Maker。プレビューに低く暖かい光と長い影、プリセットと太陽光の強さのスライダー。',
    caption: '本物の影が出るIris / OptiFineのシェーダーパックを、夕暮れのプレビューで確認。',
  },
  vibrantVisuals: {
    alt: '統合版バイブラントビジュアルズ用のShader Maker。青空の明るいプレビュー、プリセット、太陽の明るさのスライダー、MOD不要の表示。',
    caption: '統合版のバイブラントビジュアルズ用パックを、リアルタイムプレビューで作成。',
  },
});
