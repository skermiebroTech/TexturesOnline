import type { StampsLanguage } from './load';

const JA: StampsLanguage = {
  'textures.stamps': {
    choose: 'スタンプを選ぶ',
    current: 'スタンプ: {name}',
    title: 'スタンプ',
    presets: 'プリセット',
    presetsHint: 'プリセットはメインの色の濃淡で描かれます。',
    yours: '自分のスタンプ',
    none: '自分のスタンプはまだありません。範囲を選択してスタンプとして保存しましょう。',
    names: {
      ore: '鉱石の粒',
      cracks: 'ひび',
      moss: '苔',
      dither: 'ディザ模様',
      sparkles: 'きらめき',
      pebbles: '小石',
    },
    stampName: 'スタンプ {n}',
    size: '{width} × {height}',
    save: '選択範囲をスタンプとして保存',
    saveHint: '先に範囲を選択してください (32 × 32 ピクセルまで)',
    saved: '「{name}」をスタンプとして保存しました。',
    tooBig: 'スタンプは 32 × 32 ピクセルまでです。もっと小さい範囲を選択してください。',
    empty: '選択範囲にスタンプにできるピクセルがありません。',
    delete: '「{name}」を削除',
    deleted: '「{name}」を削除しました。',
    undo: '元に戻す',
    rotate: 'スタンプを回転 (R)',
    rotateTouch: 'スタンプを回転',
    flipH: 'スタンプを左右反転 (H)',
    flipHTouch: 'スタンプを左右反転',
    flipV: 'スタンプを上下反転 (Shift + H)',
    flipVTouch: 'スタンプを上下反転',
    hint: 'クリックでスタンプします。押したままドラッグして位置を決め、離すと置かれます。右クリックはサブの色で形だけをスタンプします。',
    hintTouch: 'タップでスタンプします。押したままドラッグして位置を決め、指を離すと置かれます。',
    kept: '自分のスタンプはこのブラウザに保存され、このパックで保存したものはパックのプロジェクトファイルにも入ります。',
  },
};

export default JA;
