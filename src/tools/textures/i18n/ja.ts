// Japanese text of the Texture Pack Maker start screen, effects and pack notes (English source: ./start.ts, ./effects.ts, ./pack.ts).

import type { TexturesLanguage } from './load';

const JA: TexturesLanguage = {
  textures: {
    version: {
      bedrockLatest: '統合版 最新',
      bedrockPreview: '統合版 プレビュー',
      bedrock: '統合版 {version}',
    },
    hero: {
      eyebrow: 'Texture Pack Maker',
      title: 'Minecraftを{your}見た目に',
      your: '自分好みの',
      lead: 'どのブロック・アイテム・モブも描き直せて、自分の画像も読み込めて、ワンクリックで全体のスタイルも変えられます。Java版と統合版に対応しています。',
      otherEdition: '別のエディション用のパックですか？',
      convertIt: '変換する',
      original: '元の見た目',
    },
    create: {
      title: '新しいテクスチャパック',
      text: 'バニラのテクスチャから始めて、自分のものにしましょう。',
      name: 'パック名',
      namePlaceholder: 'すごいパック',
      edition: 'エディション',
      javaHint: 'Windows・Mac・LinuxパソコンのMinecraft用です。',
      bedrockHint: 'スマホ・タブレット・ゲーム機・Windows（マーケットプレイスがある版）用です。',
      gameVersion: 'ゲームのバージョン',
      resolution: '解像度',
      description: '説明（省略可）',
      descriptionPlaceholder: 'Texture Pack Makerで作成',
      button: 'パックを作る',
      defaultName: 'マイテクスチャパック',
      startWith: 'はじめ方',
      blank: 'バニラのテクスチャ',
      blankHint: 'すべてのテクスチャがゲームのまま',
      pvp: 'PvP／FPSパック',
      pvpHint: '低い炎、透明なガラス、すっきりした照準、小さい剣',
      fps: 'FPSパックにもする',
      fpsHint: 'ブロックのテクスチャを8 × 8にし、アニメーションをなくします（Java版）。性能の低いPC向けです。',
      pvpButton: 'PvPパックを作る',
      pvpName: 'マイPvPパック',
      failed: 'パックを作れませんでした',
    },
    open: {
      title: 'パックを開く',
      text: 'ここやほかの場所で作ったパックの続きを編集できます。',
      opening: 'パックを開いています…',
      drop: 'ここにパックをドロップするか、クリックして選択',
      dropTouch: 'タップしてパックを選択',
      dropHint: 'Java版は.zip・統合版は.mcpackか.mcaddon',
      convert: 'パックを変換',
      convertHint: 'Java版から統合版、統合版からJava版、またはJava版の別バージョンへ',
      merge: 'パックを結合',
      mergeHint: '複数のパックをひとつに（上のパックが優先）',
      openedTitle: 'パックを開きました',
      openedText: '「{name}」を編集できます（{version}、テクスチャ{count}枚）。知っておきたいこと：',
      openInEditor: 'エディターで開く',
      opened: '「{name}」を開きました',
    },
    howto: {
      title: '使い方',
      pick: '選ぶ',
      pickText: 'ブロック・アイテム・モブ・GUIなど、バニラのテクスチャをすべて見られます。',
      paint: '描く',
      paintText: 'ピクセルを描いたり、画像を読み込んだり、全体にワンクリック効果をかけたりできます。',
      export: '書き出す',
      exportText: 'Java版・統合版にそのまま入れられるパックができます。',
    },
    recent: {
      title: 'あなたのテクスチャパック',
      savedHere: 'このブラウザにだけ保存されます',
      emptyTitle: 'まだパックがありません',
      emptyText: '作ったパックや開いたパックがここに表示されるので、続きから再開できます。',
      moreActions: '{name}のその他の操作',
      open: '開く',
      rename: '名前を変更',
      duplicate: '複製',
      delete: '削除',
      untitled: '名前なし',
      edited: '{count}枚編集済み',
      effects: '効果{count}個',
      editedAgo: '{time}に編集',
      renameTitle: 'パックの名前を変更',
      renamed: 'パックの名前を変更しました',
      renameFailed: 'パックの名前を変更できませんでした',
      copyName: '{name}（コピー）',
      copied: '「{name}」のコピーを作りました',
      copyFailed: 'パックをコピーできませんでした',
      deleteTitle: 'このパックを削除しますか？',
      deleteText: '「{name}」がこのブラウザから削除されます。',
      deleted: '「{name}」を削除しました',
      undo: '元に戻す',
      restoreFailed: 'パックを元に戻せませんでした。',
      deleteFailed: 'パックを削除できませんでした。',
    },
    categories: {
      block: {
        label: 'ブロック',
        short: 'ブロック',
      },
      item: {
        label: 'アイテム',
        short: 'アイテム',
      },
      entity: {
        label: 'モブ',
        short: 'モブ',
      },
      armor: {
        label: '防具',
        short: '防具',
      },
      gui: {
        label: 'GUI',
        short: 'GUI',
      },
      particle: {
        label: 'パーティクル',
        short: 'パーティクル',
      },
      environment: {
        label: '空',
        short: '空',
      },
      painting: {
        label: '絵画',
        short: '絵画',
      },
      effect: {
        label: 'エフェクト',
        short: 'エフェクトアイコン',
      },
      font: {
        label: 'フォント',
        short: 'フォント',
      },
      map: {
        label: '地図',
        short: '地図',
      },
      colormap: {
        label: 'カラーマップ',
        short: 'カラーマップ',
      },
      misc: {
        label: 'その他',
        short: 'その他',
      },
      other: {
        label: 'ほか',
        short: 'ほか',
      },
    },
    resolution: {
      classic: '16×はMinecraftの定番の見た目です。元のゲームと同じく、ブロックの各面が16×16ピクセルになります。',
      hd: '{r}×ではブロックの各面が{r}×{r}ピクセルになり、細かさは{detail}です。編集を始めるとテクスチャが拡大されるので、より細かく描き込めます。',
      twice: '2倍',
      times: '{n}倍',
    },
  },
  'textures.effects': {
    effects: {
      hue: {
        label: '色相シフト',
        description: '色相環に沿って色を回転させます。すべての色にも、一部の色の範囲だけにもかけられます。',
      },
      saturation: {
        label: '彩度',
        description: '色を鮮やかにしたり、くすませたりします。',
      },
      brightness: {
        label: '明るさ',
        description: 'すべてのテクスチャを明るく、または暗くします。',
      },
      contrast: {
        label: 'コントラスト',
        description: '明るい部分と暗い部分の差を大きく、または小さくします。',
      },
      temperature: {
        label: '色温度',
        description: '暖かい（オレンジ）か涼しい（青）色合いにします。',
      },
      tint: {
        label: '色付け',
        description: 'テクスチャに色を重ねたり、完全に塗り替えたりします。',
      },
      grayscale: {
        label: 'グレースケール',
        description: '色を抜きます。',
      },
      sepia: {
        label: 'セピア',
        description: '古い写真のような茶色の色調です。',
      },
      invert: {
        label: '反転',
        description: '色をネガにするか、色相はそのままで明暗だけを反転します。',
      },
      posterize: {
        label: 'ポスタリゼーション',
        description: '色の段階を減らして、平たいグラフィック調にします。',
      },
      pastel: {
        label: 'パステル',
        description: 'やわらかく明るい、キャンディのような色合いです。',
      },
      vignette: {
        label: '縁と面取り',
        description: '各テクスチャの縁を暗くするか、ブロックを立体的に浮き上がらせます。',
      },
      outline: {
        label: '輪郭線',
        description: 'アイテムや形のまわりに線を引くか、各ブロックに枠をつけます。',
      },
      noise: {
        label: 'ノイズ・粒子',
        description: 'フィルムの粒子やざらつきを加えます。アニメーションのどのフレームでも同じです。',
      },
      sharpen: {
        label: 'シャープ',
        description: '細部をくっきりさせ、ピクセルのコントラストを強めます。',
      },
      blur: {
        label: 'ソフトぼかし',
        description: 'テクスチャをやわらかくします。ブロックのテクスチャはタイルの境目でもつなぎ目なくぼけます。',
      },
      pixelate: {
        label: 'ピクセル化',
        description: 'サイズと透明度はそのままで、解像度を下げて大きなピクセルにします。',
      },
      upscale: {
        label: 'なめらかHD拡大',
        description: 'ドット絵用のなめらかフィルター（Scale2x/Scale3x）で解像度を2倍か4倍にします。',
      },
      downscale: {
        label: '解像度を下げる',
        description: 'テクスチャを1ブロックあたり8または4ピクセルに縮小します。見た目がすっきりし、ビデオメモリも減ります（FPSパック向け）。',
      },
      stillFrames: {
        label: 'アニメーションなし',
        description: 'Java版：アニメーションするテクスチャを最初のコマだけにし、水・溶岩・炎・ポータルを止めます。',
      },
      dither: {
        label: 'ディザリング',
        description: '色の段階を減らしたレトロな規則的ディザリングです。',
      },
      glow: {
        label: '発光',
        description: '明るい部分が光ってにじみます。アイテムのまわりに光の輪もつけられます。',
      },
      flip: {
        label: '反転（左右・上下）',
        description: 'テクスチャを左右や上下に反転します（アニメーションのフレームごとに）。',
      },
      gradientMap: {
        label: 'グラデーションマップ',
        description: '暗い色・中間色・明るい色を、好きな3色に置き換えます。',
      },
      palette: {
        label: 'レトロパレット',
        description: 'すべての色を定番のゲーム機やドット絵のパレットに合わせます。',
      },
    },
    params: {
      shift: 'シフト',
      colours: '対象の色',
      amount: '量',
      warmth: '暖かさ',
      colour: '色',
      mode: 'モード',
      levels: '段階',
      style: 'スタイル',
      strength: '強さ',
      edgeWidth: '縁の幅',
      where: '場所',
      opacity: '不透明度',
      thickness: '太さ',
      includeCorners: '角も含める',
      monochromeGrain: 'モノクロの粒子',
      radius: '半径',
      pixelSize: 'ピクセルサイズ',
      scale: '倍率',
      filter: 'フィルター',
      patternStrength: 'パターンの強さ',
      glowFromBrightness: '光り始める明るさ',
      haloAroundShapes: '形のまわりの光の輪',
      flipHorizontally: '左右に反転',
      flipVertically: '上下に反転',
      shadows: 'シャドウ',
      midtones: '中間調',
      highlights: 'ハイライト',
      palette: 'パレット',
      matchBy: '合わせ方',
      dither: 'ディザリング',
      resolution: '解像度',
    },
    hints: {
      coolDown: 'マイナスの値でテクスチャが涼しい色合いになります',
      colourSteps: 'チャンネルごとの色の段階',
      edgeStyles: '縁と面取りのスタイルで使います',
      corners: '斜めに接するピクセルにも輪郭をつけます',
      halo: '明るいピクセルの隣の透明部分に、やわらかい光を加えます',
      paletteDither: 'パレットの色の間で規則的にディザリングします',
    },
    options: {
      allColours: 'すべての色',
      reds: '赤系',
      yellows: '黄系',
      greens: '緑系',
      cyans: 'シアン系',
      blues: '青系',
      magentas: 'マゼンタ系',
      softTint: 'やわらかく色付け',
      colorize: '塗り替え',
      multiply: '乗算',
      negative: 'ネガ（全チャンネル）',
      lightnessOnly: '明るさだけ（色相を保つ）',
      softVignette: 'やわらかい周辺減光',
      darkEdges: '暗い縁',
      bevel3d: '立体の面取り',
      automatic: '自動',
      aroundShapes: '形のまわり',
      insideShapeEdges: '形の縁の内側',
      blockBorder: 'ブロックの枠',
      smoothEdges: 'なめらかな縁（Scale2x/3x）',
      sharpPixels: 'くっきりピクセル（最近傍）',
      closestColour: 'いちばん近い色',
      brightnessFew: '明るさ（2〜4色のパレット向け）',
    },
    presets: {
      darkMode: {
        label: 'ダークモード',
        description: '少し涼しい色合いの、暗く落ち着いたワールドとメニュー。',
      },
      pastelDream: {
        label: 'パステルドリーム',
        description: 'やわらかなキャンディカラーで、明るくふんわり。',
      },
      neonOutline: {
        label: 'ネオン輪郭',
        description: '暗いブロックに光るシアンの枠、輪郭つきの輝くアイテム。',
      },
      retro8bit: {
        label: 'レトロ8ビット',
        description: '定番のゲーム機のパレットに合わせた、はっきりした色。',
      },
      autumn: {
        label: '秋',
        description: 'オレンジと赤の葉に、暖かい金色の光。',
      },
      winterFrost: {
        label: '冬の霜',
        description: '氷のような青緑の葉、淡い色、冷たい青い光。',
      },
      noir: {
        label: 'ノワール',
        description: 'フィルムの粒子が入った、コントラストの強い白黒。',
      },
      sepiaMemories: {
        label: 'セピアの思い出',
        description: '縁のやわらかい、暖かな古い写真の色調。',
      },
      inverted: {
        label: '反転',
        description: 'どこもネガ写真のような色。',
      },
      cartoon: {
        label: 'カートゥーン',
        description: '太い黒の輪郭線と、はっきりした平らな色。',
      },
      smoothHd: {
        label: 'なめらかHD（2x）',
        description: 'ドット絵の縁をなめらかにして解像度を2倍にします。',
      },
      vivid: {
        label: 'ビビッド',
        description: '豊かな色、強いコントラスト、くっきりした細部。',
      },
      goldenHour: {
        label: 'ゴールデンアワー',
        description: '夕焼けの輝き。暖かく明るく、少し夢のよう。',
      },
      gameBoy: {
        label: 'Game Boy',
        description: '元祖の携帯ゲーム機のような、4段階の緑。',
      },
      blocks3d: {
        label: '立体ブロック',
        description: 'すべてのブロックを浮き上がらせて、ごろっとした手ざわりの見た目に。',
      },
    },
  },
  'textures.pack': {
    notInGame: '「{file}」は{edition, select, java {Minecraft {version}} other {この統合版のバージョン}}のテクスチャではなく、このパックにもコピーがありません。',
    emptyImage: '画像が空です。',
    soundsNotOgg: '{count}個のサウンドファイルがOgg Vorbisではないため、Java版では再生されません：{files}。「サウンド」で置き換えてください。',
  },
};

export default JA;

/** Text that is rightly the same as in English (names) */
export const SAME_AS_ENGLISH = [
  'textures:hero.eyebrow',
  'textures:categories.gui.label',
  'textures:categories.gui.short',
  'textures.effects:presets.gameBoy.label',
];
