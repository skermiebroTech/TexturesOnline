import type { SwapLanguage } from './load';

const JA: SwapLanguage = {
  'textures.swap': {
    button: '色を置き換え',
    buttonHint: 'このテクスチャ、選択範囲、またはパック全体で、ある色を別の色に置き換えます',
    title: '色を置き換え',
    from: '置き換える色',
    to: '新しい色',
    exchange: '2 つの色を入れ替え',
    pickFrom: 'このテクスチャから選ぶ:',
    tolerance: '近い色',
    toleranceHint: 'これくらい近い色も対象にします。それぞれ元の小さな差を保つので、陰影は残ります。',
    ramp: '濃淡の段階をまとめて置き換え',
    rampHint: 'このテクスチャにあるその色の暗い色と明るい色も、色相のずれを保ったまま一緒に変わります。',
    rampShades: '{count} 段階',
    where: '範囲',
    scope: {
      texture: 'このテクスチャ',
      selection: '選択範囲',
      pack: 'パック全体',
    },
    layersNote: 'ロックされていないすべてのレイヤーが変わります。',
    selectionNote: '描いているレイヤーの選択範囲だけが変わります。',
    before: '前',
    after: '後',
    pixels: '{count, plural, =0 {変わるピクセルはありません} other {# ピクセルが変わります}}',
    packNote: 'この色を使っているパックのテクスチャ:',
    gameToo: 'ゲームのテクスチャも探す (時間がかかります)',
    searching: '{total} 個中 {done} 個のテクスチャを確認中…',
    none: 'この色を使っているテクスチャはありません。',
    rowPixels: '{count} ピクセル',
    include: '{name} を変更',
    apply: '置き換え',
    applyCount: '{count} 個のテクスチャで置き換え',
    done: '{name} の色を置き換えました',
    doneMany: '{count} 個のテクスチャで色を置き換えました',
    nothing: '置き換えるものがありません。その色のピクセルはありません。',
    locked: '描いているレイヤーはロックされているか非表示です。',
  },
};

export default JA;
