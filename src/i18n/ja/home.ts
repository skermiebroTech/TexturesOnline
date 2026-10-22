// Japanese home page (see HomeText in src/tools/home/content.ts).

import { el } from '../../app/markup';
import { link } from '../../app/content/blocks';
import { F, LATEST } from '../../app/content/facts';
import type { HomeText } from '../../tools/home/content';

const code = (t: string) => el('code', null, t);

export const HOME: HomeText = {
  tools: {
    textures: {
      title: 'テクスチャパック',
      blurb: 'ブロック、アイテム、モブを好きに描き直したり、ワンクリックでゲーム全体の雰囲気を変えたり。',
      features: ['全テクスチャ・全バージョン', 'ピクセルエディターと効果', '手持ちのパックも開ける'],
      cta: 'テクスチャパックを作る',
      previewLabel: '',
    },
    skins: {
      title: 'スキン',
      blurb: '64×64のテンプレートにプレイヤーを描くと、3Dモデルがリアルタイムで変わります。',
      features: ['クラシック／スリム、2レイヤー', 'テンプレートやユーザー名から', 'Java版・統合版で書き出し'],
      cta: 'スキンをデザイン',
      previewLabel: '1ピクセルずつ描ける',
    },
    shaders: {
      title: 'シェーダー',
      blurb: '光、色、霧、水をスライダーで調整し、リアルタイムのプレビューで確認できます。',
      features: ['Iris / OptiFine用パック', 'MODなしのバニラシェーダー', '統合版のバイブラントビジュアルズ'],
      cta: 'シェーダーを作る',
      previewLabel: '昼と夜のプレビュー',
    },
  },
  faq: [
    {
      id: 'how',
      q: 'Minecraftのテクスチャパックはどうやって作りますか？',
      a: [
        el(
          'p',
          null,
          link('/textures', 'テクスチャパックエディター'),
          'を開き、Java版か統合版とゲームのバージョンを選んで、テクスチャを描き直すか、自分の画像を読み込むか、ワンクリックの効果をかけます。',
          code('.zip'),
          '（Java版）か',
          code('.mcpack'),
          '（統合版）で書き出し、ゲームで有効にすれば完成です。',
          link('/guides/make-a-texture-pack', '手順を詳しく見る'),
          '。',
        ),
      ],
    },
    {
      id: 'what',
      q: 'Texture Pack Makerとは何ですか？',
      a: [
        el(
          'p',
          null,
          'Texture Pack Makerは、Minecraftのテクスチャパック、スキン、シェーダーを作れる無料のサイトです。すべてブラウザ内で動きます。ゲームのバージョンを選び、プレビューを見ながら編集して、Java版や統合版ですぐ使えるパックをダウンロードできます。',
        ),
      ],
    },
    {
      id: 'free',
      q: '無料ですか？アカウントは必要ですか？',
      a: [el('p', null, '無料で、アカウントや登録も不要です。コードはMITライセンスのオープンソースです。プロジェクトはあなたの端末に保存されます。')],
    },
    {
      id: 'bedrock',
      q: '統合版（Bedrock）でも使えますか？',
      a: [
        el(
          'p',
          null,
          'はい。テクスチャパックとスキンは',
          code('.mcpack'),
          'として書き出され、開くだけで統合版に取り込まれます。Shader Makerではバイブラントビジュアルズ用のパックも作れます。',
          link('/guides/java-vs-bedrock-packs', 'Java版と統合版のパックの違い'),
          'もご覧ください。',
        ),
      ],
    },
    {
      id: 'versions',
      q: 'どのJava版向けにパックを作れますか？',
      a: [
        el(
          'p',
          null,
          `最初からJava版${LATEST}が選ばれていて、1.6.1までのすべてのバージョンに対応しています。パックには選んだバージョン用の`,
          code('pack.mcmeta'),
          `が書き込まれます（${LATEST}のリソースパックのフォーマットは${F(LATEST)}）。`,
          link('/guides/minecraft-pack-format-versions', 'パックフォーマット一覧'),
          '。',
        ),
      ],
    },
    {
      id: 'resource',
      q: 'テクスチャパックとリソースパックは同じものですか？',
      a: [
        el(
          'p',
          null,
          'ほぼ同じです。Java版ではリソースパックと呼ばれ、テクスチャのほかにモデル、サウンド、フォント、シェーダーも変えられます。統合版でもリソースパックと呼ばれ、',
          code('.mcpack'),
          'ファイルを使います。このツールはどちらも作れます。',
        ),
      ],
    },
    {
      id: 'skinpack',
      q: 'オリジナルのスキンパックは作れますか？',
      a: [
        el(
          'p',
          null,
          'はい。',
          link('/skins', 'スキンエディター'),
          'でスキン（クラシックまたはスリムの腕）を描き、まとめて統合版のスキンパックとして書き出せます。Java版用にPNGでダウンロードすることもできます。',
          link('/skin-pack-maker', 'スキンパック作成'),
          '。',
        ),
      ],
    },
    {
      id: 'install',
      q: '何かインストールする必要はありますか？',
      a: [el('p', null, 'いいえ。パソコン、スマホ、タブレットの最新のブラウザで動きます。一度開けば、その後はオフラインでも使えます。')],
    },
  ],
  appFeatures: [
    `Java版（${LATEST}と1.6.1以降の全バージョン）と統合版に対応したMinecraftテクスチャパック作成ツール`,
    '3Dプレビュー付きのMinecraftスキンエディター。クラシック／スリムの両モデル、Java版用PNGと統合版スキンパックの書き出しに対応',
    'Iris / OptiFine用シェーダーパック、MODなしのJava版バニラシェーダー、統合版のバイブラントビジュアルズ用パックを作れるシェーダー作成ツール',
    '正しいpack.mcmetaやmanifest.jsonを含む、すぐ使える.zipと.mcpackを書き出し',
    'ブラウザで動作：登録不要、アップロードなし、2回目以降はオフラインでも利用可能',
  ],
  hero: {
    chip: '無料 · 登録不要',
    chipOffline: ' · オフライン対応',
    title: { accent: 'Minecraft', post: ' テクスチャパック作成ツール' },
    lead: 'テクスチャパック、スキン、シェーダーをブラウザだけで自作。Java版と統合版に対応した無料のリソースパック作成ツールで、ダウンロードしたファイルはそのままゲームで使えます。',
    start: '作り始める',
    install: '入れ方を見る',
    everything: '作れるものをすべて見る',
    editionsLabel: '対応エディション',
    chips: [`Java版 ${LATEST}`, '1.6.1以降の全バージョン', '統合版'],
    blockLabel: 'ドット絵の草ブロック',
    dragHint: 'ドラッグで回転',
  },
  toolsSection: {
    eyebrow: '3つのツールをひとつに',
    title: '何を作りますか？',
    lead: 'Minecraftを自分好みにするための道具がそろっています。インストールもアカウントも不要。ツールを開いてすぐ始められます。',
  },
  converter: {
    title: 'テクスチャパック変換ツール',
    text: `Java版のパックを統合版用に、またはその逆に変換。古いパックを${LATEST}向けに更新したり、PNGを.mcpackにしたりもできます。`,
    cta: 'パックを変換',
  },
  features: {
    eyebrow: '無料のテクスチャパック作成ツール',
    title: 'テクスチャパック作りに必要なものがすべて',
    lead: '剣1本の描き直しから、HDのリソースパック丸ごとまで。作成も書き出しもブラウザだけで完結します。',
    titles: [
      '3Dモデル付きのテクスチャパックエディター',
      'ワンクリックのテクスチャパック生成',
      '既存のパックを開いて編集',
      'Java版・統合版のリソースパック',
      'スキンエディターとスキンパック作成',
      'MODあり・なしのシェーダー作成',
    ],
    items: [
      ['遊んでいるバージョンのブロック、アイテム、モブを、本物の3Dモデルの上で直接塗れます。かまど、チェスト、階段、クリーパーから村人まで80種類以上のモブに対応。'],
      ['Dark Mode、Pastel、Retro 8-bit、Autumn、Smooth HDなどの効果でゲーム全体を一気に変えてから、手作業で仕上げられます。'],
      ['Java版の', code('.zip'), 'や統合版の', code('.mcpack'), 'を読み込んで編集を続けたり、', link('/texture-pack-converter', 'パック変換ツール'), 'でもう一方のエディション用に変換したりできます。'],
      [`Java版${LATEST}から1.6.1までに合った`, code('pack.mcmeta'), '、または統合版の', code('manifest.json'), 'を正確に書き出すリソースパック作成ツールです。'],
      ['クラシックやスリムの腕のスキンを2Dや3Dでデザインし、', link('/skin-pack-maker', 'スキンパック作成'), 'で統合版の.mcpack 1つにまとめられます。'],
      ['Iris・OptiFine用のシェーダーパック、MODなしで動くJava版バニラシェーダー、統合版のバイブラントビジュアルズ用パックを作れます。'],
    ],
  },
  why: {
    eyebrow: 'ここが違う',
    title: 'Texture Pack Makerを選ぶ理由',
    lead: ['無料・オープンソースでプライバシーも安心。1.6.1以降の全Java版と統合版に対応し、8つのツールがひとつの場所にそろっています。', link('/about', 'このプロジェクトについて'), '。'],
  },
  how: {
    eyebrow: '使い方',
    title: 'アイデアから数分でゲームへ',
    steps: [
      { title: 'ゲームを選ぶ', text: `最初からJava版${LATEST}が選ばれています。1.6.1までの好きなJava版や統合版も選べます。` },
      { title: '作る', text: 'ピクセルを塗る、ワンクリック効果を重ねる、シェーダーのスライダーを動かす。どれも3Dプレビューで確認できます。' },
      { title: '書き出して遊ぶ', text: 'すぐ使える.zipか.mcpackをダウンロードし、導入ガイドに沿ってゲームに入れます。' },
    ],
    values: [
      { title: 'プライバシー重視', text: '作品が端末の外に出ることはありません。ゲームのファイルはあなたのブラウザがMojangから直接取得します。' },
      { title: 'オフライン対応', text: '一度開けば、アプリとダウンロードしたゲームファイルがこの端末に保存されます。' },
      { title: 'いつも正しい形式', text: 'パックのファイルは選んだバージョンに合わせて書き出されるので、Minecraftが警告なしで読み込みます。' },
    ],
  },
  guides: { eyebrow: 'ガイド', title: '基本を学ぶ', lead: 'パック、スキン、シェーダーの作り方と入れ方を、要点をしぼった確かな情報で解説します。', all: 'すべてのガイド' },
  faqHead: { eyebrow: 'よくある質問', title: '知っておきたいこと' },
  cta: { title: '何か作ってみませんか？', text: 'ツールを選べば、数分後には最初のパックがゲームの中に。', button: '作り始める' },
  startDialog: '何を作りますか？',
};
