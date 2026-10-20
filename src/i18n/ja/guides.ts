// Japanese guides (see GuideText in src/tools/guides/content.ts). Facts come from the app data
// (src/app/content/facts.ts), menu names from the Japanese game files.

import { el, type Child, type ElNode } from '../../app/markup';
import { callout, code, ext, figure, folderTable, link, steps, strong, tabbed, uiPath } from '../../app/content/blocks';
import { F, LATEST, MIN_ENGINE, NEXT_SNAPSHOT, formatGroups, formatParts, maxFormat, mcmetaFor, mcmetaLegacy, mcmetaRange, minFormat } from '../../app/content/facts';
import type { GuideText, GuidesIndexText } from '../../tools/guides/content';
import { SHOTS } from './shots';
import { UI_JA } from './ui';
import { SKIN_PACK_LANG, SKIN_PACK_MANIFEST, SKIN_PACK_SKINS_JSON, SKIN_PACK_TREE } from '../../tools/guides/skin-pack-files';
import { MODEL_BLOCK_EXAMPLE, MODEL_FILES, MODEL_FLAT_DEFINITION, MODEL_SPRITE_CUBE, MODEL_STONE_BLOCKSTATE } from '../../tools/guides/model-files';

const p = (...c: Child[]): ElNode => el('p', null, ...c);
const ul = (items: Child[]): ElNode => el('ul', { class: 'guide-list' }, items.map((i) => el('li', null, i)));
const pre = (text: string): ElNode => el('pre', { class: 'guide-code' }, el('code', null, text));
const h3 = (text: string): ElNode => el('h3', { class: 'guide-sub' }, text);
const table = (head: string[], rows: Child[][], cls = 'guide-table'): ElNode =>
  el(
    'div',
    { class: 'table-scroll' },
    el(
      'table',
      { class: cls },
      el('thead', null, el('tr', null, head.map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', null, rows.map((r) => el('tr', null, r.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, c) : el('td', null, c)))))),
    ),
  );
const FOLDER = UI_JA.folderTable;
const OPTIONS = '設定…';
const PACKS = 'リソースパック…';
const OPEN_FOLDER = 'パックフォルダーを開く';
const VIDEO = 'ビデオ設定…';
const IRIS_SHADERS = 'シェーダーパック...';

export const GUIDES_INDEX: GuidesIndexText = {
  eyebrow: 'ガイド',
  title: 'Minecraftのパック・スキン・シェーダーのガイド',
  lead: 'Minecraftクリエイターのための、わかりやすく確かな情報。Java版と統合版でのテクスチャパック・スキン・シェーダーの作り方と入れ方、Java版の各バージョンに必要なパックフォーマットを解説します。',
  more: ['すべての環境の導入手順を知りたいときは、', link('/help', '導入ガイドとよくある質問'), 'をご覧ください。'],
};

// ---------------------------------------------------------------- shared steps

const MAKE_PACK_STEPS: Child[] = [
  [link('/textures', 'Texture Pack Maker'), 'を開き、パックに名前をつけて、Java版か統合版、遊んでいるバージョン、解像度を選び、', strong('Create pack'), 'をクリックします。'],
  '検索ボックスやカテゴリからテクスチャを探し、ピクセルエディターで描き直すか、自分のPNGを読み込みます。',
  'お好みで：Dark Mode、Pastel、Retro 8-bitなどのワンクリック効果で、パック全体の雰囲気を変えます。',
  [strong('Pack'), 'タブで説明文とアイコンを設定し、', code('.zip'), '（Java版）か', code('.mcpack'), '（統合版）で書き出します。'],
  ['Minecraftにパックを入れて確認します。', link('/guides/install-resource-packs', '入れ方'), '。'],
];

const INSTALL_JAVA_STEPS: Child[] = [
  ['Minecraft Java版を起動し、', uiPath(OPTIONS, PACKS), 'を開きます。'],
  [uiPath(OPEN_FOLDER), 'をクリックすると、', code('resourcepacks'), 'フォルダーが開きます。'],
  ['パックの', code('.zip'), 'をフォルダーに入れます（解凍しません）。リソースパックの画面にドラッグしても入れられます。'],
  ['矢印で', strong('利用可能'), 'から', strong('選択中'), 'へパックを移し、複数使うならいちばん上に置きます。', strong('完了'), 'をクリックします。'],
];

const SKIN_STEPS: Child[] = [
  [link('/skins', 'Skin Maker'), 'を開き、始め方を選びます：白紙のスキン、色分けテンプレート、最初から使えるキャラクター、手持ちのPNG、Java版プレイヤーのユーザー名から取ったスキン、デフォルトスキンのどれか。'],
  '腕の形を選びます：クラシック（幅4ピクセル）かスリム（幅3ピクセル）。',
  '64×64のテンプレートに描くか、3Dに切り替えてモデルに直接描きます。部位を隠せば下の面にも届きます。左右対称を使えば両腕・両脚を一度に塗れ、仕上がった部位はロックできます。',
  '外側レイヤーで立体感を出します。帽子、髪、上着、袖、ズボンのすそは体の少し外側に重なります。',
  ['Java版用に', code('.png'), '（1.7.10以前用の64×32のコピーも）か、統合版用にスキンパック', code('.mcpack'), 'を書き出します。'],
  '登録します：Minecraft Launcherで（Java版）、または.mcpackを開いて更衣室で選びます（統合版）。',
];

const VANILLA_SHADER_STEPS: Child[] = [
  [link('/shaders', 'Shader Maker'), 'を開き、', strong('Java版バニラ'), 'を選びます。'],
  `遊んでいるMinecraftのバージョンを正確に選びます（Java版1.17以降。標準は${LATEST}）。`,
  'プリセットから始め、プレビューを見ながら明るさ、コントラスト、色、ビネット、霧を調整します。',
  [code('.zip'), 'を書き出し、ほかのリソースパックと同じように入れます：', uiPath(OPTIONS, PACKS, OPEN_FOLDER), '。'],
];

// ---------------------------------------------------------------- guides

const makeATexturePack: GuideText = {
  image: SHOTS.editor,
  intro: [
    p(
      'Minecraftのテクスチャパックは、ゲームの絵（ブロック、アイテム、モブ、空、メニュー）を自分の絵に置き換えるものです。Java版ではテクスチャパックを',
      el('em', null, 'リソースパック'),
      'と呼び、',
      code('pack.mcmeta'),
      'ファイルと、元と同じパスに置いたPNG画像を含む',
      code('.zip'),
      'です。統合版は',
      code('manifest.json'),
      'を含む',
      code('.mcpack'),
      'ファイルを使います。どちらもブラウザで数分あれば作れます。',
    ),
  ],
  quick: {
    title: 'かんたんに言うと',
    items: ['Java版か統合版と、遊んでいるバージョンを選ぶ。', 'テクスチャを描き直すか、自分の画像を読み込むか、ワンクリック効果をかける。', 'パックを書き出してMinecraftに入れる。'],
  },
  howto: { name: 'Texture Pack MakerでMinecraftのテクスチャパックを作る方法', steps: MAKE_PACK_STEPS },
  sections: [
    {
      id: 'step-1',
      title: 'ステップ1：パックを作ってバージョンを選ぶ',
      body: [
        p(MAKE_PACK_STEPS[0]),
        ul([
          [strong('エディション：'), 'Java版（Minecraft LauncherでPC・Mac・Linux）か統合版（Windows、スマホ、タブレット、ゲーム機）。必要なファイルが違うので、エディションごとにプロジェクトを作ります。', link('/guides/java-vs-bedrock-packs', '自分はどちら？')],
          [strong('バージョン：'), `最初はJava版${LATEST}が選ばれています。1.6.1までのすべてのバージョンに対応しているので、1.21.11、26.2、1.8.9向けのパックも同じように作れます。パックにはそのバージョンに合った`, code('pack.mcmeta'), 'がつきます。'],
          [strong('解像度：'), '16×がバニラの見た目（ブロックの1面が16×16ピクセル）。32×や64×なら細かく描け、128×以上はリアル系のパック向けです。'],
        ]),
        p('するとブラウザがそのバージョンの元のテクスチャをMojangから直接ダウンロードして端末に保存するので、次のパックはすぐに始められます。'),
        figure(SHOTS.newPack),
      ],
    },
    {
      id: 'step-2',
      title: 'ステップ2：テクスチャを探して描き直す',
      body: [
        p(MAKE_PACK_STEPS[1]),
        p(
          'どのテクスチャも本物の3Dモデルの上に表示されます。かまどなら正面・側面・上面、階段やハーフブロックなら形、モブなら体の部位が見えます。ペン、塗りつぶし、直線、図形、ノイズ、カラーピッカーで描き、左右対称にしたり、何でも元に戻したりできます。タイル表示で地面に並べたときの見え方がわかるので、つなぎ目が目立ちません。',
        ),
        p(
          'ブロックを見ながら描きたいなら、エディターを',
          strong('3D'),
          'に切り替えて（またはDキー）モデルに直接描けます。各面は表示しているテクスチャを塗ります。背景をドラッグするか2本指でブロックを回せます。モブのテクスチャも同じで、テクスチャ一覧でMobsを選び、部位を隠せば下の面にも届きます。',
        ),
        p(
          'Java版では形も変えられます。Previewタブで',
          strong('Edit shape'),
          'を押すと、平らなアイテムを3Dにしたり、ブロックの形を変えたりできます。',
          link('/guides/make-3d-items-texture-pack', '3Dアイテムの作り方'),
          '。',
        ),
        ul([
          'よく目にするブロックから始めましょう：草、土、石、原木、板材。',
          '草、葉、ツタ、水は灰色で保存され、バイオームに合わせてゲームが色をつけます。明るい灰色のままにしておきましょう。',
          '水、溶岩、シーランタンなどのアニメーションテクスチャは、1コマずつ編集できます。',
        ]),
        figure(SHOTS.editor),
      ],
    },
    {
      id: 'step-3',
      title: 'ステップ3：ワンクリックでパック全体の雰囲気を変える（任意）',
      body: [
        p(MAKE_PACK_STEPS[2]),
        p('効果は互いに重ねられ、自分で描いた部分を変えずにその上にかかります。書き出すときにすべてのテクスチャに適用されます。AutumnとSmooth HD、Dark ModeとNeon Outlineを組み合わせてから、手で描き足すこともできます。'),
        figure(SHOTS.effects),
      ],
    },
    {
      id: 'step-4',
      title: 'ステップ4：アイコンと説明をつけて書き出す',
      body: [
        p(MAKE_PACK_STEPS[3]),
        p(
          'Java版では対応範囲も選べるので、1つのパックを「旧バージョン向けに制作」の警告なしで複数のバージョンで読み込めます。書き出しではゲームに必要なファイルがすべて作られます：Java版は',
          code('pack.mcmeta'),
          'と',
          code('pack.png'),
          '、統合版は新しい固有ID入りの',
          code('manifest.json'),
          'と',
          code('pack_icon.png'),
          'です。',
        ),
        figure(SHOTS.packSettings),
        figure(SHOTS.export),
      ],
    },
    {
      id: 'step-5',
      title: 'ステップ5：入れて確認する',
      body: [
        p(MAKE_PACK_STEPS[4]),
        ul([
          ['Java版：', uiPath(OPTIONS, PACKS, OPEN_FOLDER), 'を開いて', code('.zip'), 'を入れ（解凍しない）、パックを', strong('選択中'), 'へ移します。変更したらゲーム内でF3 + Tを押して再読み込みします。'],
          ['統合版：', code('.mcpack'), 'を開き、', uiPath('設定', 'グローバル リソース'), 'で有効にします。'],
        ]),
        p('どこかおかしい？', link('/guides/texture-pack-not-working', 'テクスチャパックが反映されないときの直し方'), '。'),
      ],
    },
    {
      id: 'inside',
      title: 'テクスチャパックの中身',
      body: [
        h3('Java版（.zip）'),
        ul([
          [code('pack.mcmeta'), '（zipの直下に必須）：パックの説明と、対応するゲームのバージョン。'],
          [code('pack.png'), '（任意）：パック一覧のアイコン。Minecraft自身のものは128×128で、32×32で表示されます。'],
          [code('assets/minecraft/textures/…'), '：元と同じフォルダーとファイル名で置いた画像。たとえば', code('assets/minecraft/textures/block/stone.png'), '。1.13より前のバージョンは', code('block'), 'と', code('item'), 'ではなく', code('blocks'), 'と', code('items'), 'フォルダーを使います。'],
          ['アニメーションテクスチャには、画像の隣に対応する', code('.png.mcmeta'), 'ファイルがあります。'],
        ]),
        h3('統合版（.mcpack）'),
        ul([
          [code('manifest.json'), '（直下に必須）：名前、2つの固有ID、更新のたびに上がるバージョン番号、対応する最も古いゲームのバージョン（ここでは標準で', code(`"min_engine_version": ${MIN_ENGINE}`), '）。'],
          [code('pack_icon.png'), '（任意）：パックのアイコン。'],
          [code('textures/'), '以下のテクスチャ。たとえば', code('textures/blocks/stone.png'), '。バニラのテクスチャには', code('.tga'), 'ファイルもあるので、元と同じ名前と拡張子を保ってください。'],
        ]),
        callout('tip', 'ファイル名が大事', 'Minecraftは、元とまったく同じパスのファイルだけを置き換えます。Java版のパスは小文字（a-z、0-9、_ - . と /）でなければなりません。Texture Pack Makerが自動で対応します。'),
        h3('フォルダー構成の比較'),
        pre(
          [
            'Java: MyPack.zip',
            '├── pack.mcmeta',
            '├── pack.png',
            '└── assets/minecraft/textures/',
            '    ├── block/stone.png',
            '    └── item/diamond_sword.png',
            '',
            'Bedrock: MyPack.mcpack',
            '├── manifest.json',
            '├── pack_icon.png',
            '└── textures/',
            '    ├── blocks/stone.png',
            '    └── items/diamond_sword.png',
          ].join('\n'),
        ),
        table(
          ['', 'Java版 pack.mcmeta', '統合版 manifest.json'],
          [
            ['必須', 'はい、zipの直下', 'はい、.mcpackの直下'],
            ['パックの識別', 'ファイル名かフォルダー名', '2つの固有ID（UUID）'],
            ['ゲームのバージョン', `パックフォーマット番号（${LATEST}は${F(LATEST)}）`, [code('min_engine_version'), '（対応する最も古いバージョン）']],
            ['更新', 'ファイルを置き換える', 'IDはそのままでバージョン番号を上げる'],
          ],
        ),
      ],
    },
    {
      id: 'mcmeta',
      title: 'pack.mcmetaファイル（Java版）',
      body: [
        p('このファイルで、パックがどのバージョン向けかをMinecraftに伝えます。フォーマット番号はほぼアップデートのたびに変わり、Java版', LATEST, 'のリソースパックのフォーマットは', strong(F(LATEST)), 'です。', LATEST, '専用のパックは次のようになります：'),
        pre(mcmetaFor(LATEST, `Minecraft ${LATEST}用のパック`)),
        p(
          '1.21.9以降、パックは',
          code('min_format'),
          'と',
          code('max_format'),
          'で範囲を指定します。古いバージョンでも読み込ませたいパックには、さらに',
          code('pack_format'),
          'と',
          code('supported_formats'),
          'が必要です。Texture Pack Makerは、選んだバージョンと範囲に合った組み合わせを書き込みます。',
          link('/guides/minecraft-pack-format-versions', '全バージョンのパックフォーマット'),
          'もご覧ください。',
        ),
        callout('warn', '説明がない？', `Java版${LATEST}では、pack.mcmetaに説明がないパックや、正しいJSONでないパックは一覧にすら表示されません。pack.mcmetaはフォルダーの中ではなく、zipの直下に置いてください。`),
      ],
    },
    {
      id: 'by-hand',
      title: '手作業でテクスチャパックを作る',
      body: [
        p('好きな画像編集ソフトで自分でパックを組み立てることもできます。時間はかかりますが、パックの仕組みがよくわかります：'),
        h3('Java版'),
        steps([
          ['元のテクスチャを探します：', code('.minecraft'), 'フォルダーから', code('versions/<version>/<version>.jar'), 'をコピーし、コピーの拡張子を', code('.zip'), 'に変えて開きます。画像は', code('assets/minecraft/textures'), 'にあります。'],
          ['パック用の新しいフォルダーを作り、', code('pack.mcmeta'), '（下記参照）と、元と同じ', code('assets/minecraft/textures/…'), 'のフォルダーを用意します。'],
          '変えたいPNGだけをコピーして編集します。名前はそのまま、サイズの比率（16×16、32×32など）も保ちます。',
          ['フォルダーそのものではなく、フォルダーの', strong('中身'), 'をzipにして、', code('pack.mcmeta'), 'がzipの直下に来るようにします。zipを', code('resourcepacks'), 'に入れます。'],
        ]),
        h3('統合版'),
        steps([
          ['Mojangの', ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'), 'リポジトリ（', code('resource_pack/textures'), '）から元のテクスチャを入手します。'],
          ['新しい固有ID（UUID）を2つ書いた', code('manifest.json'), 'と、', code('textures/'), '以下に編集した画像を置いたフォルダーを作ります。'],
          ['フォルダーの中身をzipにし、拡張子を', code('.zip'), 'から', code('.mcpack'), 'に変えて、開いてインポートします。'],
        ]),
        callout('tip', '面倒な作業はおまかせ', 'Texture Pack Makerなら、コピー、フォルダー名、pack.mcmeta、UUID、zip化をすべて自動で行い、描いている間もテクスチャを3Dモデル上で見られます。'),
      ],
    },
    {
      id: 'tips',
      title: 'いいパックを作るコツ',
      body: [
        ul([
          '小さく始めましょう：よく見るブロック（草、土、石、木）をいくつか描き直し、全部やる前にゲームで確認します。',
          'パック全体で解像度をそろえます。16×と64×が混ざるとちぐはぐに見えます。',
          '3Dブロックプレビューで、ブロックの各面のつながりを確認します。',
          '繰り返し並ぶブロックはタイル表示で確認し、つなぎ目が目立たないようにします。',
          '自分のパックは「選択中」の一番上に置きます。上にあるパックが優先されます。',
        ]),
      ],
    },
  ],
  faq: [
    {
      id: 'both',
      q: '1つのテクスチャパックでJava版と統合版の両方に使えますか？',
      a: [p('使えません。2つのエディションはファイルもフォルダーも違います。どちらかのエディション用に作り、', link('/texture-pack-converter', 'テクスチャパック変換ツール'), 'でもう一方に変換してください。', link('/guides/java-vs-bedrock-packs', 'Java版と統合版のパック'), '。')],
    },
    {
      id: 'free',
      q: 'ソフトをインストールする必要はありますか？',
      a: [p('ありません。Texture Pack Makerはパソコン、スマホ、タブレットのブラウザで動き、何もアップロードされません。')],
    },
    {
      id: 'edit',
      q: '既存のテクスチャパックを変更できますか？',
      a: [p('はい。Texture Pack Makerで', strong('Open a pack'), 'を選び、', code('.zip'), 'か', code('.mcpack'), 'を選びます。編集を続けて書き出し直せます。'), figure(SHOTS.openPack)],
    },
    {
      id: 'code',
      q: 'テクスチャパックを作るのにプログラミングの知識は必要ですか？',
      a: [p('必要ありません。テクスチャパックは画像と小さな説明ファイルだけで、そのファイルはTexture Pack Makerが書いてくれます。あなたは絵を描くだけです。')],
    },
    {
      id: 'older',
      q: '1.21.11や1.8.9のような古いバージョン用のテクスチャパックはどう作りますか？',
      a: [p('パックを作るときにそのバージョンを選んでください。そのバージョン自身のテクスチャとフォルダー名を読み込み、そのパックフォーマットを書き込みます。', link('/guides/minecraft-pack-format-versions', '全バージョンのパックフォーマット'), '。')],
    },
    {
      id: 'originals',
      q: 'Minecraftの元のテクスチャはどこにありますか？',
      a: [p('Java版はゲームの', code('.jar'), 'ファイルの中（', code('assets/minecraft/textures'), '）、統合版はMojangのbedrock-samplesリポジトリにあります。Texture Pack Makerなら、バージョンを選ぶとMojangから自動で読み込みます。')],
    },
    {
      id: 'mobile',
      q: 'スマホでテクスチャパックを作れますか？',
      a: [p('はい。Texture Pack Makerはパソコンや Chromebook と同じように、Android、iPhone、iPadのブラウザでも動きます。統合版なら、書き出した', code('.mcpack'), 'を開けばMinecraftに取り込まれます。')],
    },
    {
      id: 'time',
      q: 'テクスチャパックを作るのにどれくらいかかりますか？',
      a: [p('いくつかのブロックを変えるだけの小さなパックや、Dark Modeのようなパック全体の効果なら数分です。数百枚のテクスチャを手描きする本格的なパックは何週間もかかることがありますが、途中でいつでも書き出して確認できます。')],
    },
    {
      id: 'hd',
      q: 'テクスチャパックの解像度はどれがいいですか？',
      a: [p('16×はバニラと同じで、いちばん早く描けます。32×や64×なら細かく描け、128×以上はリアル系のパック向けで、高性能なパソコンが必要です。パック全体で解像度はそろえましょう。')],
    },
  ],
  ctaLabel: 'Texture Pack Makerを開く',
};

const notWorking: GuideText = {
  image: SHOTS.packSettings,
  intro: [
    p(
      'テクスチャパックのトラブルの原因は、ほとんどが次の3つです。パックの説明ファイル（Java版は',
      code('pack.mcmeta'),
      '、統合版は',
      code('manifest.json'),
      '）がない、または場所が違う。パックが別のバージョン向けに作られている。テクスチャがMinecraftの探すパスにぴったり置かれていない。下から今の症状を探して、直し方を試してください。',
    ),
  ],
  quick: {
    title: 'まずはここを確認',
    items: [
      ['Java版：zipを開くと、フォルダーではなく', code('pack.mcmeta'), 'と', code('assets'), 'がすぐに見える。'],
      'パックが遊んでいるバージョン向けに作られている（または対応範囲にそのバージョンが含まれている）。',
      'パックが「選択中」（Java版）や有効な一覧（統合版）にあり、同じテクスチャを変えるパックより上にある。',
      'ファイル名とフォルダーが元とまったく同じ（Java版は小文字）。',
    ],
  },
  sections: [
    {
      id: 'not-listed',
      title: 'パックが一覧に表示されない',
      body: [
        p('Java版は、zipやフォルダーの直下に正しい', code('pack.mcmeta'), 'がある場合だけパックを表示します。'),
        ul([
          [strong('フォルダーが二重：'), 'パックのフォルダーごとzipにすると、すべてが1階層深くなります（', code('MyPack.zip/MyPack/pack.mcmeta'), '）。フォルダーの中身をzipにしてください。'],
          [strong('pack.mcmetaが壊れている：'), `カンマや引用符が1つ欠けるだけで正しいJSONではなくなります。Java版${LATEST}では、説明のないパックも表示されません。`],
          [strong('フォルダーが違う：'), 'zipは', code('shaderpacks'), 'や', code('mods'), 'ではなく', code('resourcepacks'), 'に入れます。', uiPath(OPTIONS, PACKS, OPEN_FOLDER), 'で正しいフォルダーを開けます。'],
          [strong('ダウンロード途中・ブロックされている：'), 'ブラウザが途中までのファイルを', code('.crdownload'), 'や', code('.part'), 'として保存していることがあります。もう一度ダウンロードしてください。'],
        ]),
      ],
    },
    {
      id: 'version',
      title: '「旧バージョン向けに制作」「新バージョン向けに制作」',
      body: [
        p(
          'Java版は',
          code('pack.mcmeta'),
          'のパックフォーマットを自分の番号と比べています（',
          LATEST,
          'は',
          strong(F(LATEST)),
          '）。テクスチャだけを変えるパックなら、',
          strong('はい'),
          'を押せばたいてい動きますが、ないテクスチャや名前の変わったテクスチャがおかしく見えることがあります。きちんと直すには、自分のバージョン向けに書き出し直すか、そのバージョンを含む対応範囲を設定します。自分で作っていない古いパックなら、',
          link('/texture-pack-converter', 'テクスチャパック変換ツール'),
          'がテクスチャを自分のバージョンの名前に変え、新しいpack.mcmetaを書き出します。',
        ),
        p(
          '1.21.9以降、',
          code('pack_format'),
          'の番号しかないパックや、新しいルールに合わない項目があるパックは、',
          el('em', null, '破損または非対応'),
          'と表示されることがあります。新しいパックは',
          code('min_format'),
          'と',
          code('max_format'),
          'を使います。',
          link('/guides/minecraft-pack-format-versions', '全バージョンのパックフォーマット'),
          '。',
        ),
        figure(SHOTS.packSettings),
      ],
    },
    {
      id: 'purple',
      title: '紫と黒のブロック',
      body: [
        p(
          '紫と黒のチェック柄は「テクスチャが見つからない」ことを表します。モデルが、そのパスに存在しない画像を求めています。ファイル名が変わった、フォルダーが違う、別のバージョンのフォルダー名を使っている、などが原因です。たとえば1.13より前のバージョンは',
          code('textures/blocks'),
          'と',
          code('textures/items'),
          '、1.13以降は',
          code('textures/block'),
          'と',
          code('textures/item'),
          'を使います。',
        ),
        p('独自のモデルを追加した場合は、その中のテクスチャのパスをすべて確認してください。Texture Pack Makerで作ったパックは、選んだバージョンと同じパスを正確に使います。'),
      ],
    },
    {
      id: 'some-textures',
      title: '一部のテクスチャしか変わらない',
      body: [
        ul([
          [strong('名前やパスが1文字違う：'), 'ファイルは元とまったく同じ名前とフォルダーでなければなりません。Java版は大文字や空白を含むパスを無視します。'],
          [strong('別のパックが優先されている：'), '一覧で上にあるパックが同じテクスチャを置き換えます。自分のパックをいちばん上に移すか、', link('/merge-texture-packs', 'テクスチャパックを結合'), 'で好きな順番に1つにまとめてください。'],
          [strong('そのブロックの別のファイル：'), '複数の画像を使うブロックがあります（かまどの正面・側面・上面、草ブロックの上面・側面・側面の重ね）。すべて編集するか、3Dプレビューでどの画像がどこに使われるか確認してください。'],
          [strong('統合版で画像の形式が違う：'), '統合版のバニラテクスチャには', code('.tga'), 'ファイルもあります。元と同じ名前と形式にしないと置き換わりません。'],
        ]),
      ],
    },
    {
      id: 'grey',
      title: '草や葉が灰色に見える',
      body: [
        p(
          '画像ファイルではそれが普通です。草、葉、ツタ、水などのテクスチャは灰色で保存され、バイオームごとにゲームが色をつけます。明るい灰色で塗り、ゲームで確認してください。緑で塗ると、ゲームが色をつけたときにずっと暗く、または変な色に見えます。',
        ),
      ],
    },
    {
      id: 'animation',
      title: 'アニメーションテクスチャが縦長の帯になる',
      body: [
        p(
          'アニメーションテクスチャは、コマを縦に積み重ねた縦長の画像と、同じ名前の',
          code('.png.mcmeta'),
          'ファイル（たとえば',
          code('sea_lantern.png.mcmeta'),
          '）でできています。このファイルがないと、Java版は帯全体を1つのブロックに押し込めます。統合版はアニメーションテクスチャを',
          code('textures/flipbook_textures.json'),
          'に登録します。Texture Pack Makerは、アニメーションのコマを編集するとこれらのファイルを書き出します。',
        ),
      ],
    },
    {
      id: 'all-off',
      title: 'リソースパックがすべてオフになった（Java版）',
      body: [
        p(
          'コンパイルできないシェーダーを含むリソースパックがあると、Java版はすべてのパックをオフにして標準に戻します。Mojangはこれらのシェーダーファイルをよく変更するため、別のバージョン向けに作られたバニラのシェーダーパックでよく起こります。パックを外すか、自分のバージョン向けに書き出し直してください。',
          link('/shaders', 'Shader Maker'),
          'が書き出すシェーダーは、すべて事前にコンパイルチェックされています。',
        ),
      ],
    },
    {
      id: 'bedrock-import',
      title: '統合版：インポートに失敗した',
      body: [
        ul([
          [strong('インポート失敗：'), code('manifest.json'), 'がない、正しくない、またはファイルの直下にありません。パックを書き出し直して、新しいファイルを開いてください。'],
          [strong('パックの重複：'), '同じIDと同じバージョン番号のパックがすでに入っています。バージョンを上げるか（Texture Pack Makerは書き出すたびに上げます）、', uiPath('設定', 'ストレージ'), 'で古いものを削除してください。'],
          [strong('ファイルの種類が違う：'), 'Java版の', code('.zip'), 'を', code('.mcpack'), 'に名前変更しても動きません。統合版には専用のファイルとフォルダーが必要です。', link('/texture-pack-converter', 'テクスチャパック変換ツール'), 'で変換してください。'],
          [strong('ゲーム機：'), 'Xbox、PlayStation、Switchではファイルをインポートできません。パックを含むワールド、Realm、サーバーに参加してください。'],
        ]),
      ],
    },
    {
      id: 'bedrock-nothing',
      title: '統合版：インポートしたのに何も変わらない',
      body: [
        ul([
          ['有効にします：', uiPath('設定', 'グローバル リソース', 'マイ パック'), 'でパックを選び、', strong('有効化'), 'を押します。1つのワールドだけなら', uiPath('ワールドを編集', 'リソースパック'), 'を使います。'],
          '同じテクスチャを変える、ほかの有効なパックより上に移します。',
          ['パックがあなたより新しいゲームを必要としているなら、', code('min_engine_version'), 'が高すぎます。Minecraftを更新するか、最小バージョンを下げて書き出してください。'],
          '従来のグラフィック向けのパックは、バイブラントビジュアルズがオンだと見た目が変わったりオフにされたりします。グラフィックモードを切り替えてみてください。',
        ]),
      ],
    },
    {
      id: 'shaders',
      title: 'シェーダーパックが表示されない',
      body: [
        ul([
          ['IrisやOptiFineのシェーダーパックは、', code('resourcepacks'), 'ではなく、', uiPath(OPTIONS, VIDEO, IRIS_SHADERS), 'から開く', code('shaderpacks'), 'フォルダーに入れます。'],
          ['IrisにはOpenGLが必要です。Java版26.2以降で「Vulkanでは動作しない」と出たら、', strong('グラフィックスAPI'), 'を', strong('デフォルト'), 'か', strong('OpenGLを優先'), 'にしてください。'],
          ['バニラ（MODなし）のシェーダーパックはリソースパックで、作ったバージョンでしか動きません。', link('/guides/make-shaders-without-mods', 'MODなしのシェーダー'), '。'],
        ]),
      ],
    },
  ],
  faq: [
    {
      id: 'why-red',
      q: 'リソースパックの一覧でパックが赤く表示されるのはなぜ？',
      a: [p('赤は、パックのフォーマットがゲームのバージョンと合っていないことを示します。それでも動くことはありますが、確実にするなら自分のバージョン向けに書き出し直してください。')],
    },
    {
      id: 'reload',
      q: 'パックを変えたらMinecraftを再起動する必要がありますか？',
      a: [p('ありません。Java版ではF3 + Tでリソースパックを再読み込みするか、パックをオフにしてからオンにします。統合版ではワールドから出て入り直します。')],
    },
    {
      id: 'server',
      q: 'サーバーでテクスチャが変わるのはなぜ？',
      a: [p('サーバーは独自のリソースパックを送ることができ、それはあなたのパックより上に来ます。マルチプレイ画面のサーバー設定で断れますが、必須にしているサーバーもあります。')],
    },
  ],
  ctaLabel: 'Texture Pack Makerを開く',
};

const install: GuideText = {
  intro: [
    p(
      strong('Java版'),
      'では、パックの',
      code('.zip'),
      'を',
      code('resourcepacks'),
      'フォルダーに入れ、「設定 › リソースパック」でオンにします。',
      strong('統合版'),
      'では、',
      code('.mcpack'),
      'ファイルを開くとMinecraftに取り込まれるので、「設定 › グローバル リソース」で有効にします。Java版のシェーダーパックにはIrisかOptiFineが必要です。',
    ),
  ],
  quick: {
    title: 'かんたんな答え',
    items: [
      ['Java版：', uiPath(OPTIONS, PACKS, OPEN_FOLDER), 'に', code('.zip'), 'を入れ、パックを「選択中」に移して「完了」をクリック。'],
      ['統合版：', code('.mcpack'), 'ファイルを開き、', uiPath('設定', 'グローバル リソース'), 'で有効にする。'],
      ['シェーダー（Java版）：IrisかOptiFineを入れ、シェーダーのzipを', code('shaderpacks'), 'フォルダーに入れる。'],
    ],
  },
  howto: { name: 'Minecraft Java版にリソースパックを入れる方法', steps: INSTALL_JAVA_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Java版にリソースパックを入れる',
      body: [steps(INSTALL_JAVA_STEPS), h3('resourcepacksフォルダーはどこ？'), folderTable('resourcepacks', FOLDER)],
    },
    {
      id: 'order',
      title: '複数のパックを使う',
      body: [
        p(
          'パックはいくつでもオンにできます。2つのパックが同じテクスチャを変えている場合は、',
          strong('選択中'),
          '（Java版）や有効な一覧（統合版）で上にあるほうが優先され、変えていない部分は下のパックのものが使われます。よくある使い方は、自分で調整した小さなパックを上に、まるごとのパックを下に置く方法です。',
        ),
        p('重ねたパックを1つのパックにまとめたいとき（共有したいときや、リソースパックを1つしか送れないサーバー用）は、', link('/merge-texture-packs', 'テクスチャパックを結合'), 'を使います。同じルールで、一覧のいちばん上のパックが優先されます。'),
        p('Lunar ClientやBadlion Clientなどのサードパーティ製ランチャーも、標準で', code('.minecraft'), '内の同じ', code('resourcepacks'), 'フォルダーを使い、パックをオンにする独自のリソースパックメニューがあります。'),
      ],
    },
    {
      id: 'bedrock',
      title: '統合版に.mcpackを入れる',
      body: [
        tabbed(
          'install-bedrock',
          [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  [code('.mcpack'), 'をダブルクリックします。Minecraftが開き、', el('em', null, 'インポート開始...'), 'のあとにインポート完了と表示されます。'],
                  [uiPath('設定', 'グローバル リソース', 'マイ パック'), 'でパックを選び、', strong('有効化'), 'を押します。'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android・iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['スマホやタブレットに', code('.mcpack'), 'をダウンロードします。'],
                  [strong('Android：'), 'ダウンロードやファイルアプリから開き、Minecraftを選びます。', strong('iPhone / iPad：'), 'ファイルアプリでタップし、', uiPath('共有', 'Minecraft'), 'を選びます。'],
                  [uiPath('設定', 'グローバル リソース'), 'で有効にします。'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'ゲーム機',
              icon: 'gamepad',
              content: [p('Xbox、PlayStation、Switchではファイルをインポートできません。PCやスマホでワールドにパックを追加してそのワールドに参加するか、パックを含むRealmやサーバーで遊んでください。')],
            },
          ],
          UI_JA.platform,
        ),
        callout('tip', '1つのワールドだけ？', 'グローバル リソースではなく、', uiPath('ワールドを編集', 'リソースパック'), 'を開いてそこでパックを有効にします。'),
      ],
    },
    {
      id: 'shaders',
      title: 'シェーダーパックを入れる',
      body: [
        ul([
          [strong('Iris（Java版）：'), ext('https://www.irisshaders.dev/', 'irisshaders.dev'), 'のインストーラーでIrisを入れ、Irisのプロフィールで一度プレイしてから、', uiPath(OPTIONS, VIDEO, IRIS_SHADERS), 'を開いて', strong('パックフォルダーを開く...'), 'をクリックし、zipを入れます。'],
          [strong('OptiFine（Java版）：'), uiPath(OPTIONS, VIDEO, 'シェーダーの詳細設定...'), 'から', strong('シェーダーフォルダー'), 'を開きます。'],
          [strong('バニラシェーダー（Java版・MODなし）：'), 'リソースパックなので、ほかのパックと同じく', code('resourcepacks'), 'フォルダーに入れます。'],
          [strong('バイブラントビジュアルズ（統合版）：'), code('.mcpack'), 'を開いて有効にし、', uiPath('設定', 'ビデオ', 'グラフィックモード'), 'をバイブラントビジュアルズにします。'],
        ]),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    {
      id: 'skins',
      title: 'スキンを入れる',
      body: [
        ul([
          [strong('Java版：'), 'Minecraft Launcher › スキン › 新しいスキンで、クラシックかスリムを選び、PNGを参照して「保存して使用」をクリック。minecraft.netのプロフィールからアップロードすることもできます。'],
          [strong('統合版：'), 'スキンパックの', code('.mcpack'), 'を開き、更衣室 › クラシック スキンでスキンを選ぶか、そこでPNGを1枚インポートします。'],
        ]),
        p('詳しくは', link('/guides/make-a-skin', 'Minecraftのオリジナルスキンの作り方'), 'をご覧ください。'),
      ],
    },
    {
      id: 'troubleshooting',
      title: 'パックが動かない？',
      body: [
        p('よくある問題をまとめました。', link('/guides/texture-pack-not-working', '原因と直し方をすべて見る'), '。'),
        table(
          ['症状', '原因', '直し方'],
          [
            ['「旧バージョン向けに制作」「新バージョン向けに制作」', 'pack.mcmetaのパックフォーマットがゲームと合っていない。', '自分のバージョン向けに書き出し直すか、対応範囲を広げる。テクスチャだけのパックなら「はい」でたいてい動く。'],
            ['「破損または非対応」（Java版1.21.9以降）', 'pack.mcmetaにpack_formatしかない、または項目がルールに合っていない。', 'min_formatとmax_formatを書き込むTexture Pack Makerで書き出し直す。'],
            ['パックが一覧にまったく表示されない', 'pack.mcmetaがない、zipの直下にない、正しいJSONでない、または説明がない。', 'zipを開いたとき、フォルダーではなくpack.mcmetaとassetsがすぐ見えるようにする。'],
            ['統合版でインポートに失敗する', 'manifest.jsonがない、ファイルの直下にない、または正しくない。', '.mcpackとして書き出し直し、新しいファイルを開く。'],
            ['統合版のパックで何も変わらない', '上にある別のパックが同じテクスチャを置き換えている。', '有効な一覧で自分のパックをいちばん上に移す。'],
          ],
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'unzip',
      q: 'リソースパックは解凍したほうがいいですか？',
      a: [p('いいえ。Java版はzipのままのパックを直接読み込めます。pack.mcmetaが直下にあれば解凍したフォルダーでも動きますが、zipのままのほうが簡単です。')],
    },
    {
      id: 'order',
      q: '2つのパックが同じテクスチャを変えている場合、どちらが優先されますか？',
      a: [p('「選択中」（Java版）や有効な一覧（統合版）で上にあるほうです。', link('/merge-texture-packs', 'テクスチャパックを結合'), 'も、同じ順番で複数のパックを1つにまとめます。')],
    },
    {
      id: 'realms',
      q: 'ゲーム機のプレイヤーもカスタムパックを使えますか？',
      a: [p('ファイルのインポートではできません。パックを含むワールド、Realm、サーバーに参加すれば使えます。')],
    },
  ],
  ctaLabel: 'すべての環境の導入ガイド',
};

const packFormats: GuideText = {
  intro: [
    p(
      'Java版のリソースパックは、',
      code('pack.mcmeta'),
      'ファイルに',
      strong('パックフォーマット'),
      'の番号を書き、Minecraftは自分の番号と比べてパックが合うかを判断します。',
      strong(`Minecraft Java版${LATEST}のリソースパックのフォーマットは${F(LATEST)}です。`),
      'リソースパックは1.6.1から始まりました。それより前のバージョンは仕組みの違うテクスチャパックを使っていました。',
    ),
  ],
  quick: {
    title: `かんたんな答え：Minecraft ${LATEST}`,
    items: [
      ['リソースパックのフォーマット：', strong(F(LATEST)), '。'],
      [code('pack.mcmeta'), 'には', code(`"min_format": ${minFormat(LATEST)}`), 'と', code(`"max_format": ${maxFormat(LATEST)}`), 'を書きます（1.21.9以降、フォーマットはメジャー番号とマイナー番号に分かれています）。'],
      ['古いバージョンでも使うパックには、さらに', code('pack_format'), 'と', code('supported_formats'), 'が必要です。全バージョンは下の表のとおりです。'],
    ],
  },
  sections: [
    {
      id: 'table',
      title: 'Java版の全リリースのリソースパックフォーマット',
      body: [
        p('1.6.1から', LATEST, 'までのすべての正式リリースです。スナップショット、プレリリース、リリース候補には別の番号があります。'),
        table(
          ['パックフォーマット', 'Minecraft Java版のバージョン'],
          formatGroups()
            .reverse()
            .map((g) => [g.format, g.versions.join(', ')]),
          'guide-table formats-table',
        ),
        p(
          '1.21.9の開発サイクル以降、フォーマットにはマイナー番号もつきます。',
          F(LATEST),
          `はメジャー${formatParts(LATEST).major}、マイナー${formatParts(LATEST).minor}という意味です。Mojangは、古いパックを壊さない追加のときにマイナー番号を上げます。この記事の執筆時点で、${NEXT_SNAPSHOT.version}の最初のスナップショットは${NEXT_SNAPSHOT.format}を使っています。`,
        ),
      ],
    },
    {
      id: 'eras',
      title: 'pack.mcmetaの移り変わり',
      body: [
        table(
          ['ゲームのバージョン', 'ゲームが読む項目'],
          [
            ['1.6.1 – 1.8.7', [code('pack_format'), 'と', code('description'), '。バージョンの確認はまったくないので、どの番号でも読み込まれます。']],
            ['1.8.8 – 1.20.1', [code('pack_format'), 'だけ。ゲームの番号と同じなら対応とみなし、違えば警告が出ますが使うことはできます。']],
            ['1.20.2 – 1.21.8', [code('pack_format'), '（必須）と、任意の範囲指定', code('supported_formats'), '（例：', code('[15, 64]'), '）。']],
            [`1.21.9 – ${LATEST}`, [code('min_format'), 'と', code('max_format'), '（両方必須）。範囲がフォーマット64以下まで及ぶパックは、', code('pack_format'), 'と', code('supported_formats'), 'も必要です。1.21.9以降専用のパックは', code('supported_formats'), 'を使ってはいけません。']],
          ],
        ),
      ],
    },
    {
      id: 'examples',
      title: '例',
      body: [
        h3(`Java版${LATEST}専用`),
        pre(mcmetaFor(LATEST, `Minecraft ${LATEST}用のパック`)),
        p(code('max_format'), `に数字だけを書くと「マイナー番号は問わない」という意味になり、${maxFormat(LATEST)}なら${maxFormat(LATEST)}.0と${F(LATEST)}の両方が含まれます。ここに`, code(`[${maxFormat(LATEST)}, 0]`), `と書くと、${LATEST}には古すぎるパックになります。`),
        h3(`1.20.1から${LATEST}まで`),
        pre(mcmetaRange('1.20.1', LATEST, `Minecraft 1.20.1 - ${LATEST}用のパック`)),
        p('1.20.1は', code('pack_format'), 'を、1.20.2〜1.21.8は', code('supported_formats'), 'を、1.21.9以降は', code('min_format'), 'と', code('max_format'), 'を読みます。'),
        h3('1.20.1（と1.20）専用'),
        pre(mcmetaLegacy('1.20.1', 'Minecraft 1.20.1用のパック')),
        callout('tip', 'ツールにおまかせ', 'Texture Pack Makerでバージョンを選び、必要ならPackタブで対応範囲を選ぶだけ。書き出したパックには、各バージョンに必要な項目がぴったり入ります。'),
      ],
    },
    {
      id: 'bedrock',
      title: '統合版は？',
      body: [
        p(
          '統合版のパックにはパックフォーマットの番号がありません。',
          code('manifest.json'),
          'は',
          code('"format_version": 2'),
          'と、',
          code(MIN_ENGINE),
          'のような',
          code('min_engine_version'),
          'を使います。統合版のバージョン番号は今は年にもとづいています（26.0は2026年2月に公開）が、マニフェストは昔の書き方のままなので、26.50は',
          code('[1, 26, 50]'),
          'と書きます。',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'latest',
      q: `Minecraft ${LATEST}のリソースパックのフォーマットは？`,
      a: [p(`${F(LATEST)}です。${LATEST}専用のパックなら、pack.mcmetaに"min_format": ${minFormat(LATEST)}と"max_format": ${maxFormat(LATEST)}を書きます。`)],
    },
    {
      id: '1211',
      q: '1.21.1と1.20.1のパックフォーマットは？',
      a: [p(`1.21と1.21.1は${F('1.21.1')}、1.20と1.20.1は${F('1.20.1')}です。1.8.9と、1.6.1以降のそれより古い1.xは${F('1.8.9')}です。`)],
    },
    {
      id: 'broken',
      q: 'パックに「破損または非対応」と表示されるのはなぜ？',
      a: [p('1.21.9以降では、大きなpack_format（64より上）だけがあり、min_format / max_formatがないパックはチェックに通りません。それでも有効にはできますが、両方の項目を追加するのがおすすめです。')],
    },
  ],
  ctaLabel: '正しいフォーマットでパックを作る',
};

const makeASkin: GuideText = {
  image: SHOTS.skin2d,
  intro: [
    p(
      'Minecraftのスキンは、プレイヤーのモデルに巻きつける64×64ピクセルのPNG画像です。統合版では128×128ピクセルのHDスキンも使えます。ブラウザでデザインできます。テンプレートに描いて3Dモデルで確認し、Minecraft Launcherに登録する（Java版）か、スキンパックとしてインポートします（統合版）。',
    ),
  ],
  quick: {
    title: 'かんたんに言うと',
    items: ['Skin Makerを開き、テンプレートか元にするスキンを選ぶ。', '3Dプレビューを見ながら描く。', 'Java版用にPNG、統合版用に.mcpackを書き出して登録する。'],
  },
  howto: { name: 'Minecraftのオリジナルスキンをオンラインで作る方法', steps: SKIN_STEPS },
  sections: [
    { id: 'steps', title: '手順', body: [steps(SKIN_STEPS), figure(SHOTS.skin2d), figure(SHOTS.skin3d)] },
    {
      id: 'template',
      title: 'スキンテンプレートの仕組み',
      body: [
        ul([
          ['画像は', strong('64×64'), 'ピクセルです。Java版1.7.10以前は、左腕と左脚が独立していない古い', strong('64×32'), 'の形式を使います。統合版は', strong('128×128'), 'のHDスキンにも対応しています。'],
          ['レイヤーは2つあります。', strong('ベースレイヤー'), 'が体で、', strong('外側レイヤー'), '（帽子、上着、袖、ズボンのすそ）はそのすぐ外側に浮いていて、透明にもできます。'],
          [strong('クラシック'), '（スティーブ）の腕は幅4ピクセル、', strong('スリム'), '（アレックス）は3ピクセルです。描いたときと同じモデルでスキンを登録してください。'],
          'テンプレートの使わない部分は、完全に透明のままにしておきます。',
        ]),
      ],
    },
    {
      id: 'hd-skins',
      title: '128×128のHDスキン',
      body: [
        p(
          'HDスキンは、同じテンプレートを2倍の解像度にしたものです。64×64ではなく128×128ピクセルなので、顔、袖、靴のどこでも4倍のピクセルで陰影や目、細かい模様を描けます。使える場所は次のとおりです。',
        ),
        ul([
          [strong('統合版'), '（Windows、Android、iPhone、iPad）：PNGを更衣室で読み込むか、スキンパックに入れます。1つのパックに64×64とHDのスキンを混ぜられます。'],
          [strong('Java版'), '：Minecraft Launcherとminecraft.netは64×64のスキンしか受け付けません。HDスキンを使うには、CustomSkinLoaderなどHDスキンを読み込むMODが必要です。'],
        ]),
        h3('Skin Makerで作る'),
        steps([
          ['スタート画面で', strong('サイズ'), 'を', strong('HD 128×128'), 'にしてから、元にするものを選びます。テンプレートや最初のスキンは128×128に拡大され、128×128のPNGを読み込んだ場合はHDのままです。'],
          ['64×64のスキンをもう描いているなら、エディターで', strong('サイズ'), 'を', strong('HD 128'), 'に切り替え、', strong('HDにする'), 'で確定します。1ピクセルが2×2のブロックになるだけなので、細かく描き足すまで見た目は変わりません。', strong('サイズ'), ' › ', strong('64×64'), 'と', strong('64×64に縮小'), 'で元に戻せます。'],
          ['更衣室で読み込むなら', strong('統合版スキン（.png）'), '、スキンパックなら', strong('統合版スキンパック（.mcpack）'), 'を書き出します。どちらも128×128のままです。'],
          ['Java版用には、', strong('Java skin (.png)'), 'が2×2のブロックを1ピクセルにした64×64のコピーをダウンロードします。HDスキン自体はそのまま残ります。HDスキンMODを使うなら、代わりに', strong('MOD用の128×128'), 'を選びます。'],
        ]),
        callout(
          'warn',
          '制限',
          'ゲーム機では、どのサイズのスキンファイルも読み込めません。128×128より大きいスキンには対応していません。「信頼できるスキンのみ許可」をオンにしているプレイヤーには、HDかどうかにかかわらずカスタムスキンがデフォルトのスキンに見えます。',
        ),
      ],
    },
    {
      id: 'java',
      title: 'Java版で使う',
      body: [
        steps([
          ['Minecraft Launcherを開き、', uiPath('Minecraft: Java Edition', 'スキン'), 'に進みます。'],
          [strong('新しいスキン'), 'をクリックし、名前をつけて', strong('クラシック'), 'か', strong('スリム'), 'を選びます。'],
          [strong('参照'), 'をクリックしてPNGを選び、', strong('保存して使用'), 'をクリックします。'],
        ]),
        p(ext('https://www.minecraft.net/', 'minecraft.net'), 'のプロフィールからアップロードすることもできます。'),
      ],
    },
    {
      id: 'bedrock',
      title: '統合版のオリジナルスキンパックを作る',
      body: [
        p(
          'スキンパックは、1つ以上のスキンを含む',
          code('.mcpack'),
          'です。Skin Makerが自動で作ります。中には',
          code('manifest.json'),
          '（モジュールタイプは',
          code('skin_pack'),
          '）、各スキンをクラシック（',
          code('geometry.humanoid.custom'),
          '）またはスリム（',
          code('geometry.humanoid.customSlim'),
          '）のモデルと',
          code('"type": "free"'),
          'とともに並べた',
          code('skins.json'),
          '、直下に置いたスキンのPNG、名前を書いた',
          code('texts/en_US.lang'),
          'が入っています。',
        ),
        steps([
          ['スキンを1つずつ別のプロジェクトとして描きます。クラシックとスリムのスキンを1つのパックに入れられます。'],
          [strong('Export'), ' › ', strong('Bedrock skin pack'), 'を選び、パックに名前をつけて、入れるほかのスキンにチェックします。'],
          '.mcpackを開きます（Windowsはダブルクリック、Androidは「Minecraftで開く」、iPhoneとiPadは「共有 › Minecraft」）。',
          ['Minecraftで', uiPath('更衣室', 'クラシック スキン'), 'を開き、自分のパックからスキンを選んで', strong('装備'), 'を押します。'],
        ]),
        figure(SHOTS.skinPack),
        callout('warn', '知っておきたいこと', 'ゲーム機ではスキンファイルをインポートできません。「信頼できるスキンのみ許可」をオンにしているプレイヤーには、カスタムスキンがデフォルトのスキンに見えます。インポートするスキンパックでは独自のモデルは使えず、クラシックとスリムだけです。'),
        p('入れ方、更新のしかた、パックの中身を順に解説：', link('/guides/make-a-bedrock-skin-pack', 'Minecraft統合版のスキンパックの作り方'), '。'),
      ],
    },
  ],
  faq: [
    { id: 'size', q: 'Minecraftのスキンのサイズは？', a: [p('64×64ピクセルのPNGです。64×32はJava版1.7.10以前のときだけ使います。統合版では128×128ピクセルのHDスキンも使えます。')] },
    {
      id: 'hd',
      q: '128×128のMinecraftスキンは作れますか？',
      a: [
        p(
          'はい、統合版向けに作れます。Skin Makerで始める前に',
          strong('サイズ'),
          'を',
          strong('HD 128×128'),
          'にするか、今のスキンを',
          strong('HD 128'),
          'に切り替えて、統合版のPNGかスキンパックを書き出します。Java版はMODなしでは64×64のスキンしか表示しないため、Java用の書き出しでは64×64のコピーを作ります。CustomSkinLoaderなどのHDスキンMODなら128×128のファイルを使えます。',
        ),
      ],
    },
    { id: 'username', q: 'ほかの人のスキンをもとにできますか？', a: [p('はい。Skin Makerは、Java版プレイヤーの今のスキンをユーザー名から読み込めるので、アレンジできます。ほかの人の作品は尊重してください。')] },
    { id: 'phone', q: 'スマホでスキンを作れますか？', a: [p('はい。エディターはタッチ操作に対応し、ピンチでのズームもできます。')] },
    {
      id: 'slim-pack',
      q: 'スキンパックにクラシックとスリムのスキンを混ぜられますか？',
      a: [p('はい。パックの各スキンはそれぞれのモデルを持つので、オリジナルのスキンパックにクラシック（腕4ピクセル）とスリム（腕3ピクセル）のスキンを並べられます。')],
    },
    {
      id: 'update-pack',
      q: 'インポート済みのスキンパックを更新するには？',
      a: [p('同じプロジェクトから書き出し直し、新しい.mcpackを開きます。パックIDは同じままバージョン番号が上がるので、Minecraftはコピーを増やさず古いものを置き換えます。')],
    },
  ],
  ctaLabel: 'Skin Makerを開く',
};

const shadersWithoutMods: GuideText = {
  image: SHOTS.shaderVanilla,
  intro: [
    p(
      strong('はい、ある程度までは。'),
      `基本的なシェーダー効果なら、OptiFineやIrisなどのMODは必要ありません。Java版1.17以降では、普通のリソースパックでMinecraft自身のシェーダーファイルの一部を差し替えられるので、何もインストールせずにカラーグレーディング、ビネット、霧の変更、${LATEST}ではブルームも使えます。統合版では独自のシェーダーコードは使えませんが、バイブラントビジュアルズのパックで組み込みのライティング、空、霧、水を調整できます。Java版で本物の影や反射を出すには、今もIrisかOptiFineが必要です。`,
    ),
  ],
  howto: { name: 'MODなしでMinecraft Java版のシェーダーパックを作る方法', steps: VANILLA_SHADER_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Java版：リソースパックでシェーダー',
      body: [
        p('1.17以降、Minecraftはリソースパックで差し替えられるシェーダーファイルで世界を描いています。バニラのシェーダーパックでできることはバージョンによって違います：'),
        table(
          ['効果', '対応バージョン'],
          [
            ['カラーグレーディング（明るさ、コントラスト、彩度、色温度、白黒、セピア）', 'Java版1.17以降'],
            ['ビネット', 'Java版1.17以降'],
            ['霧の距離と色', 'Java版1.17以降'],
            ['ブルーム（画面全体の光のにじみ）', `Java版${LATEST}以降`],
            ['揺れる植物', '1.17〜1.21.4と1.21.6〜1.21.10のみ'],
            ['本物の影、反射、光の筋', 'IrisかOptiFineなしでは不可能'],
          ],
        ),
        p(`Java版${LATEST}で常に有効な画面全体のエフェクトが追加されたため、ブルームやきれいなカラーグレーディングが使えるようになりました。1.16.5以前には差し替えられるワールドのシェーダーがありません。`),
        callout('warn', '特定のバージョン専用', 'Mojangはこれらのシェーダーファイルをよく変更するので、バニラのシェーダーパックは作ったバージョンでしか動きません。壊れたシェーダーがあるとMinecraftがすべてのリソースパックをオフにすることがあるため、Shader Makerが書き出すシェーダーはすべて事前にコンパイルチェックされています。'),
        h3('作ってみる'),
        steps(VANILLA_SHADER_STEPS),
        figure(SHOTS.shaderVanilla),
      ],
    },
    {
      id: 'bedrock',
      title: '統合版：シェーダーの代わりにバイブラントビジュアルズ',
      body: [
        p('統合版は、RenderDragonエンジンに移行したとき（Windowsとゲーム機は1.16.200、その他の端末は1.18.30）から独自のシェーダーコードを読み込まなくなりました。ゲームのコンパイル済みシェーダーファイルを差し替えるツールは、ゲームを改造して入れる必要があり、アップデートで動かなくなります。'),
        p(
          '公式の方法は',
          strong('バイブラントビジュアルズ'),
          '（Vibrant Visuals）です。統合版の新しいレンダラーで、1.21.90（2025年6月）から正式版に入っています。リソースパックで、太陽と月の光、空の色、霧、水、影、カラーグレーディングを、時間帯やバイオームごとに変えられます。',
          link('/guides/bedrock-vibrant-visuals-settings', 'バイブラントビジュアルズの設定解説'),
          '。',
        ),
      ],
    },
    {
      id: 'mods',
      title: 'OptiFineなしでシェーダー：Irisを使う',
      body: [
        p(
          `「MODなし」が「OptiFineなし」という意味なら、答えはIrisです。同じシェーダーパック（太陽による本物の影、揺れる葉、反射する水、光の筋）を読み込め、軽量化MODのSodiumと一緒に動き、Java版1.16.5〜${LATEST}に対応しています。この記事の執筆時点で、OptiFineは26.2までの対応です。`,
        ),
        steps([
          [ext('https://www.irisshaders.dev/', 'irisshaders.dev'), 'からIrisのインストーラーをダウンロードして実行します。選んだバージョン用にIrisとSodiumが入ります。'],
          'Minecraft Launcherで新しいIrisのプロフィールを使い、一度ゲームを起動します。',
          [uiPath(OPTIONS, VIDEO, IRIS_SHADERS), 'を開き、', strong('パックフォルダーを開く...'), 'をクリックしてシェーダーパックのzipを入れます。'],
          '一覧からパックを選んで「適応」をクリックします。軽いパックはノートパソコン向け、重いパックには高性能なグラフィックカードが必要です。',
        ]),
        figure(SHOTS.shaderIris),
        p('ForgeやNeoForgeでは、そのローダー向けのIrisの移植版を探してください。プリセットとリアルタイムプレビューつきで、Iris / OptiFine用のオリジナルシェーダーパックを', link('/shaders', 'Shader Maker'), 'で作ることもできます。'),
      ],
    },
  ],
  faq: [
    { id: 'optifine', q: 'バニラシェーダーにOptiFineは必要ですか？', a: [p('いいえ。バニラのシェーダーパックは普通のリソースパックです。作ったバージョンなら、MODなしで動きます。')] },
    { id: 'servers', q: 'バニラのシェーダーパックはサーバーでも動きますか？', a: [p('はい。リソースパックは自分のゲームが適用するので、サーバーで遊ぶときも動きます。')] },
    { id: 'bedrock', q: 'Java版のシェーダーを統合版で使えますか？', a: [p('使えません。統合版はパックからシェーダーコードを読み込めません。代わりにバイブラントビジュアルズのパックを使ってください。')] },
  ],
  ctaLabel: 'Shader Makerを開く',
};

const javaVsBedrock: GuideText = {
  intro: [
    p(
      'Java版にも統合版にもリソースパックはありますが、ファイルに互換性はありません。',
      strong('Java版'),
      'のパックは、',
      code('pack.mcmeta'),
      'と',
      code('assets/minecraft/textures/'),
      '以下のPNGテクスチャを含む',
      code('.zip'),
      'です。',
      strong('統合版'),
      'のパックは、',
      code('manifest.json'),
      'と',
      code('textures/'),
      '以下のテクスチャを含む',
      code('.mcpack'),
      'です。両方に対応するには、パックを2回作ります。',
    ),
  ],
  quick: {
    title: 'かんたんな答え：Java版のテクスチャパックは統合版で使える？',
    items: [
      '使えません。統合版はJava版の.zipを読み込めず、.mcpackに名前を変えても同じです。',
      '2つのエディションは、フォルダー、ファイル名、説明ファイルがそれぞれ違います。',
      '画像を移動・改名してmanifest.jsonを加えれば変換できます。または統合版のプロジェクトで作り直します。',
    ],
  },
  sections: [
    {
      id: 'compare',
      title: '並べて比較',
      body: [
        table(
          ['', 'Java版', '統合版'],
          [
            ['ファイル', [code('.zip'), '（またはフォルダー）'], [code('.mcpack'), '（名前を変えたzip）']],
            ['説明ファイル', [code('pack.mcmeta')], [code('manifest.json'), '（2つのUUIDとバージョン番号）']],
            ['対象バージョン', ['パックフォーマット番号（例：', LATEST, 'は', F(LATEST), '）'], ['最小エンジンバージョン（例：', code(MIN_ENGINE), '）']],
            ['テクスチャのパスの例', [code('assets/minecraft/textures/block/stone.png')], [code('textures/blocks/stone.png')]],
            ['画像形式', 'PNG', 'PNGまたはTGA（バニラのファイルと同じ拡張子）'],
            ['アイコン', [code('pack.png')], [code('pack_icon.png')]],
            ['導入', [code('resourcepacks'), 'フォルダーに入れる'], 'ファイルを開くとMinecraftが取り込む'],
            ['シェーダー', 'Iris / OptiFineのシェーダーパック、またはバニラシェーダーのリソースパック（1.17以降）', '独自のシェーダーコードは不可。バイブラントビジュアルズの設定パック'],
            ['スキン', 'ランチャーかminecraft.netでPNGを登録', 'スキンパック（.mcpack）、または更衣室でPNGをインポート'],
            ['ゲーム機', '該当なし', 'ファイルのインポートは不可。パックを含むワールド、Realm、サーバーを使う'],
          ],
        ),
      ],
    },
    {
      id: 'textures',
      title: '気をつけたいテクスチャの違い',
      body: [
        ul([
          'ファイル名がエディションで違います。たとえばJava版のblock/grass_block_top.pngは、統合版ではblocks/grass_top.pngです。',
          '統合版の多くのテクスチャは、透明なピクセルに色付けや染色のマスクを保存しているので、エディターは見えないピクセルの色を捨ててはいけません。Texture Pack Makerはピクセルを正確に保ちます。',
          'Java版は対応範囲で1つのパックを複数のバージョンに対応させられますが、統合版のパックは最小バージョンを1つだけ指定します。',
        ]),
      ],
    },
    {
      id: 'convert',
      title: 'Java版のテクスチャパックは統合版に変換できる？',
      body: [
        p('できますが、ファイル名を変えるだけではだめです。変換とは、統合版の構成でパックを組み直すことです：'),
        steps([
          [code('assets/minecraft/textures/'), 'の画像を、統合版の', code('textures/'), 'フォルダーにコピーします（', code('block'), ' → ', code('blocks'), '、', code('item'), ' → ', code('items'), '）。'],
          ['名前が違うファイルの名前を変えます。たとえば', code('grass_block_top.png'), ' → ', code('grass_top.png'), '。統合版に対応するものがないテクスチャは外します。'],
          ['新しいUUIDを2つ、バージョン、', code('min_engine_version'), 'を書いた', code('manifest.json'), 'を作り、', code('pack.png'), 'を', code('pack_icon.png'), 'に名前変更します。'],
          ['特別な場合を確認します：統合版のアニメーションは', code('.png.mcmeta'), 'ファイルではなく', code('textures/flipbook_textures.json'), 'に登録し、一部のテクスチャは透明ピクセルに色付けマスクを持つ', code('.tga'), 'ファイルです。'],
          ['中身をzipにして、拡張子を', code('.mcpack'), 'に変えます。'],
        ]),
        p(
          'Mojang自身の資料は',
          ext('https://learn.microsoft.com/ja-jp/minecraft/creator/documents/convertingtexturepacks', 'Converting Texture Packs from Java Edition to Bedrock Edition'),
          'です。手早く済ませるなら',
          link('/texture-pack-converter', 'テクスチャパック変換ツール'),
          'を使いましょう。すべてのテクスチャを移動・改名し、アニメーションをフリップブックの項目に変え、マニフェストを書き、変換できなかったものを一覧にします。',
        ),
      ],
    },
    {
      id: 'mcpack',
      title: '.mcpackはただのzipファイル？',
      body: [
        p(
          'そうです。',
          code('.mcpack'),
          'は、統合版にインポートするものだと伝えるために拡張子を変えた普通のzipです。',
          code('.zip'),
          'に名前を変えれば中身を見られます。統合版のパックかどうかは中身で決まります。直下の',
          code('manifest.json'),
          'と、統合版のフォルダー構成です。',
          code('.mcaddon'),
          'ファイルは複数のパックをまとめたもので、',
          code('.mcworld'),
          'ファイルにはワールドがまるごと入っています。',
        ),
      ],
    },
    {
      id: 'both',
      title: '両方のエディション用にパックを作る',
      body: [
        steps([
          [link('/textures', 'Texture Pack Maker'), 'でJava版のプロジェクトを作り、テクスチャを描きます。'],
          '統合版のプロジェクトを作り、同じテクスチャを描き直すか読み込みます。ファイルの一覧は統合版のものです。',
          'それぞれ書き出し、両方のファイルを共有します。',
        ]),
      ],
    },
  ],
  faq: [
    { id: 'convert', q: 'Java版のパックを統合版に変換できますか？', a: [p('ファイル名を変えるだけではできません。フォルダー、名前、説明ファイルが違うので、画像を移動・改名してmanifest.jsonをつける必要があります。', link('/texture-pack-converter', 'テクスチャパック変換ツール'), 'なら自動でやってくれます。')] },
    { id: 'back', q: '統合版のパックをJava版に変換できますか？', a: [p('逆の手順でできます。画像を', code('assets/minecraft/textures/'), 'に移し、Java版の名前に変え、.tgaファイルをPNGにして、', code('pack.mcmeta'), 'を加えます。')] },
    { id: 'missing', q: '変換したら一部のテクスチャがなくなったのはなぜ？', a: [p('エディションごとに、もう一方にないテクスチャがあり、分け方やまとめ方が違うものもあります（チェスト、絵画、GUIなど）。それらはもう一方のエディション用に描き直す必要があります。')] },
    { id: 'which', q: '自分が遊んでいるのはどちらのエディション？', a: [p('ゲーム機、スマホ、タブレットで遊んでいる場合や、Microsoft Storeの「Minecraft for Windows」で入手した場合は統合版です。Java版はMinecraft LauncherからWindows、macOS、Linuxで動きます。')] },
  ],
  ctaLabel: 'Texture Pack Makerを開く',
};

// ---------------------------------------------------------------- vibrant visuals

const VV_STEPS: Child[] = [
  [link('/shaders', 'Shader Maker'), 'でパックを作り（', strong('統合版 Vibrant Visuals'), 'を選びます）、', code('.mcpack'), 'を書き出します。'],
  'ファイルを開きます。Minecraftが自動でインポートします。',
  [uiPath('設定', 'グローバル リソース', 'マイ パック'), 'でパックを有効にします。バイブラントビジュアルズに対応していない従来のテクスチャパックは無効にします。'],
  [uiPath('設定', 'ビデオ'), 'を開き、', strong('グラフィックモード'), 'を', strong('バイブラントビジュアルズ'), 'にします。'],
];

const vibrantVisuals: GuideText = {
  image: SHOTS.vibrantVisuals,
  intro: [
    p(
      strong('バイブラントビジュアルズ'),
      '（Vibrant Visuals）は、Minecraft統合版の新しいグラフィックモードです。向きのある太陽光、やわらかい影、ボリュームのある霧、反射する水、物理ベースの質感（PBR）が使えます。1.21.90（2025年6月）で実験的機能を卒業し、対応端末では標準のグラフィックモードになっています。リソースパックで設定を調整できますが、新しいシェーダーコードは追加できません。',
    ),
  ],
  howto: { name: 'Minecraft統合版でバイブラントビジュアルズ用パックを使う方法', steps: VV_STEPS },
  sections: [
    {
      id: 'settings',
      title: 'バイブラントビジュアルズのパックで変えられること',
      body: [
        table(
          ['パックのフォルダー', '調整できる内容'],
          [
            [code('lighting/'), '太陽と月の明るさ・色・通り道の傾き、環境光（洞窟の中）、空からの光、光るブロックの色の鮮やかさ。'],
            [code('atmospherics/'), '頭上と地平線の空の色と、空気中での光の散らばり方（空の濃さ、夕焼けの光）。'],
            [code('color_grading/'), 'トーンマッピングの方式、コントラスト、彩度、ゲイン、ガンマ、色温度。映画のような色味を決めます。'],
            [code('water/'), '水の色、波、コースティクス（水中にできる光の模様）。'],
            [code('shadows/'), 'ブロック状の影か、やわらかい影か。'],
            [code('fogs/'), 'ボリュームフォグの濃さと色、従来の距離による霧。'],
            [code('local_lighting/'), '松明やランタンなど、ブロックが出す光の色。'],
          ],
        ),
        p('設定は時間帯で変えられ、Minecraft自体の値もバイオームごとに違います。いいパックは、全体用のファイルを1つ置き換えるのではなく、バイオームごとに調整しています。'),
        p(strong('パックでは変えられないもの：'), 'ブルーム、露出、スクリーンスペース反射、雲のライティング、トーンマッピングのカーブそのもの、描画距離、アンチエイリアス。これらはリソースパックではなく、ゲームのレンダラー側にあります。'),
      ],
    },
    {
      id: 'devices',
      title: '対応している端末',
      body: [
        ul(['DirectX 12対応のWindows PC。', 'Xbox SeriesとPlayStation 5。Xbox OneとPS4では初期設定でオフです。', 'A12チップ以降のiPhoneとiPad。', '多くの最近のAndroid端末。']),
        p('初代Nintendo Switch、Chromebook、Fireタブレットでは使えません。サーバー側でオフにされることもあり、画面分割プレイでは代わりに従来のグラフィックになります。'),
      ],
    },
    {
      id: 'enable',
      title: 'パックを使ってオンにする',
      body: [
        steps(VV_STEPS),
        callout('warn', 'バイブラントビジュアルズが選べない？', '有効なリソースパックがすべて対応しているときだけ選べます。従来のテクスチャパックはこれをオフにするので、無効にしてください（またはバイブラントビジュアルズ向けに作られたパックを使います）。対応端末であることも必要です。'),
        figure(SHOTS.vibrantVisuals),
      ],
    },
  ],
  faq: [
    { id: 'what', q: 'Minecraftのバイブラントビジュアルズとは？', a: [p('統合版に組み込まれた新しいグラフィックモードで、1.21.90で正式に登場しました。アドオンなしで、向きのある光、影、ボリュームフォグ、水の反射、PBRの質感が加わります。')] },
    { id: 'textures', q: 'バイブラントビジュアルズには専用のテクスチャパックが必要？', a: [p('いいえ、デフォルトのテクスチャで動きます。ただし、バイブラントビジュアルズ対応を宣言していない従来のテクスチャパックが有効な間は、このモードがオフになります。')] },
    { id: 'classic-fog', q: '霧の変更はバイブラントビジュアルズ以外でも効きますか？', a: [p('従来の距離による霧は、どのグラフィックモードでも変えられます。ボリュームフォグとライティングの設定は、バイブラントビジュアルズのときだけ効きます。')] },
  ],
  ctaLabel: 'バイブラントビジュアルズのパックを作る',
};

// ---------------------------------------------------------------- convert java to bedrock

const CONVERT_STEPS: Child[] = [
  [link('/texture-pack-converter', 'テクスチャパック変換ツール'), 'を開き、パックを選びます。Java版の', code('.zip'), '、統合版の', code('.mcpack'), '、またはPNGのテクスチャです。'],
  ['変換先を選びます：', strong('Bedrock Edition'), '（統合版）、または', strong('Java Edition'), 'とバージョン。'],
  [strong('Convert'), 'をクリックします。ブラウザが変換先のテクスチャ一覧を読み込み、変換できるテクスチャをすべて変換します。'],
  'レポートを確認します。いくつ変換できたか、どれがなぜスキップされたかがわかります。',
  '変換したパックをダウンロードするか、エディターで開いてスキップされたテクスチャを先に描き直します。',
];

const convertJavaToBedrock: GuideText = {
  image: SHOTS.convertResult,
  intro: [
    p(
      'Java版のテクスチャパックは統合版では動きません。',
      code('.zip'),
      'を',
      code('.mcpack'),
      'に名前変更してもだめです。2つのエディションでは、フォルダー、ファイル名、説明ファイルが違うからです。変換するには、テクスチャを1つずつ統合版のフォルダーに移し、統合版のファイル名に変え、',
      code('manifest.json'),
      'を付ける必要があります。無料の',
      link('/texture-pack-converter', 'テクスチャパック変換ツール'),
      'なら、ブラウザで数秒で終わり、逆方向の変換もできます。',
    ),
  ],
  quick: {
    title: 'かんたんに言うと',
    items: [
      [link('/texture-pack-converter', 'テクスチャパック変換ツール'), 'を開き、Java版の', code('.zip'), 'を選びます。'],
      [strong('Bedrock Edition'), 'を選び、', strong('Convert to Bedrock'), 'をクリックします。'],
      [code('.mcpack'), 'をダウンロードして開けば、Minecraftに取り込まれます。'],
    ],
  },
  howto: { name: 'Java版のテクスチャパックを統合版に変換する方法', steps: CONVERT_STEPS },
  sections: [
    { id: 'steps', title: '手順', body: [steps(CONVERT_STEPS), figure(SHOTS.convertPack), figure(SHOTS.convertResult)] },
    {
      id: 'what',
      title: '変換できるもの・できないもの',
      body: [
        p('変換ツールは、Java版のどのテクスチャが統合版のどのテクスチャと同じ役割かを知っています。両方のエディションのゲームファイルから調べたものです。ほとんどのテクスチャは両方で同じ絵なので、そのままコピーできます。'),
        table(
          ['変換できる', '変換できない'],
          [
            ['ほとんどのブロックとアイテムのテクスチャ（およそ5つに4つ）', '片方のエディションにしかないテクスチャ'],
            ['多くのモブや環境のテクスチャ（太陽、月、雲）', '配置が違うテクスチャ：チェスト、多くのモブのスキン、旗、メニュー、パーティクル'],
            ['アニメーションするテクスチャ：.png.mcmetaはフリップブックの項目になります', 'モデル、サウンド、フォント、スプラッシュテキスト、シェーダー'],
            ['パックのアイコン、名前、説明', 'OptiFineの追加機能（連結テクスチャ、カスタムアイテムテクスチャなど）'],
          ],
        ),
        p('スキップされたものは理由と一緒にレポートに載るので、何を描き直せばいいかがはっきりわかります。変換したパックを', link('/textures', 'Texture Pack Maker'), 'で開けば、ダウンロードする前にそれらのテクスチャを3Dモデルの上で直せます。'),
        callout('tip', '1つのパックを両方のエディションで', 'Java版のパックを元データとして残し、変更するたびに変換し直しましょう。新しいバージョンを統合版にインポートする前に、設定 › ストレージで古いほうを削除すると、2つに増えません。'),
      ],
    },
    {
      id: 'bedrock-to-java',
      title: '統合版のパックをJava版に変換する',
      body: [
        p(
          '統合版の',
          code('.mcpack'),
          '（または',
          code('.mcaddon'),
          '）を選び、',
          strong('Java Edition'),
          'と遊んでいるバージョンを選びます。テクスチャはJava版のフォルダーと名前に移り、',
          code('.tga'),
          '画像はPNGに、フリップブックのアニメーションは',
          code('.png.mcmeta'),
          'ファイルになり、パックにはそのバージョン用の正しい',
          code('pack.mcmeta'),
          'が付きます。',
        ),
      ],
    },
    {
      id: 'old-java',
      title: '古いJava版のパックを新しいバージョンに更新する',
      body: [
        p(
          '同じ変換ツールで、Java版のパックをバージョン間で更新できます。多くのテクスチャは年々名前が変わってきました。とくに1.13では',
          code('textures/blocks'),
          'が',
          code('textures/block'),
          'になり、何百ものファイルが新しい名前になりました。古いパックを選び、',
          strong('Java'),
          'と自分のバージョンを選ぶと、名前が変わったテクスチャはすべて新しい名前に移ります。パック内のモデルに書かれたテクスチャ名も更新されます。',
        ),
        p(`逆方向にも使えます。たとえば${LATEST}用のパックを1.8.9用にできます。`),
      ],
    },
    {
      id: 'install',
      title: '変換したパックを入れる',
      body: [
        ul([
          ['統合版：', code('.mcpack'), 'を開き（Windowsはダブルクリック、スマホは「Minecraftで開く」）、', uiPath('設定', 'グローバル リソース'), 'で有効にします。'],
          ['Java版：', code('.zip'), 'を', code('resourcepacks'), 'フォルダーに入れ、「選択中」に移します。'],
        ]),
        p('くわしくは', link('/guides/install-resource-packs', 'テクスチャパックの入れ方'), 'へ。おかしいところがあれば', link('/guides/texture-pack-not-working', 'テクスチャパックが反映されないとき'), 'を見てください。'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: '変換ツールは無料ですか？', a: [p('はい。アカウントも制限もありません。パックはブラウザの中で変換され、アップロードされることはありません。')] },
    { id: 'look', q: '統合版でも同じ見た目になりますか？', a: [p('変換したテクスチャは同じ見た目です。スキップされたテクスチャは統合版のものになり、統合版のライティングやバイブラントビジュアルズで色が少し違って見えることがあります。')] },
    { id: 'shaders', q: 'Java版のシェーダーパックを統合版に変換できますか？', a: [p('できません。統合版は独自のシェーダーコードを読み込みません。代わりに', link('/guides/bedrock-vibrant-visuals-settings', 'バイブラントビジュアルズ'), 'のパックを使いましょう。', link('/shaders', 'Shader Maker'), 'で作れます。')] },
    { id: 'png', q: 'PNGファイルを.mcpackにできますか？', a: [p('はい。ゲームのテクスチャと同じ名前（たとえば', code('stone.png'), '）のPNG、またはPNGをまとめたzipを選び、統合版に変換します。')] },
    { id: 'console', q: '変換したパックをゲーム機で使えますか？', a: [p('ゲーム機ではファイルをインポートできません。PCやスマホでパックをワールドに追加してそのワールドに参加するか、パックの入ったRealmやサーバーを使ってください。')] },
  ],
  ctaLabel: 'テクスチャパック変換ツールを開く',
};

// ---------------------------------------------------------------- merge packs

const MERGE_STEPS: Child[] = [
  [link('/merge-texture-packs', 'テクスチャパックを結合'), 'を開き、Java版の', code('.zip'), 'か統合版の', code('.mcpack'), 'のパックを2〜8個追加します。'],
  'ドラッグか矢印ボタンで順番を決めます。2つのパックが同じファイルを変えているところでは、上のパックが優先されます。',
  '結合したパックの名前とアイコンを決めます。Java版なら、遊んでいるバージョンも選びます。',
  [strong('Merge'), 'をクリックし、競合の一覧を確認します。'],
  '結合したパックをダウンロードするか、エディターで開いて作業を続けます。',
];

const mergePacks: GuideText = {
  image: SHOTS.mergeResult,
  intro: [
    p(
      'Minecraftはもともとテクスチャパックを重ねて使えます。いくつか有効にすると、同じテクスチャを変えているところでは一覧で上にあるパックが優先されます。結合は、その順番を組み込んだまま、複数のパックから1つのパックを作ることです。パックを1つしか受け付けないサーバーやRealm、お気に入りの組み合わせを配りたいとき、パック一覧をすっきりさせたいときに便利です。無料の',
      link('/merge-texture-packs', 'テクスチャパックを結合'),
      'ツールなら、ブラウザでできます。',
    ),
  ],
  quick: {
    title: 'かんたんに言うと',
    items: [
      [link('/merge-texture-packs', 'テクスチャパックを結合'), 'を開き、同じエディションのパックを2〜8個追加します。'],
      'ドラッグして並べます。競合はすべて上のパックが優先されます。',
      'Mergeをクリックし、競合の一覧を確認してパックをダウンロードします。',
    ],
  },
  howto: { name: 'Minecraftのテクスチャパックを結合する方法', steps: MERGE_STEPS },
  sections: [
    { id: 'steps', title: '手順', body: [steps(MERGE_STEPS), figure(SHOTS.mergeSettings), figure(SHOTS.mergeResult)] },
    {
      id: 'wins',
      title: 'どのパックが優先される？',
      body: [
        p('Minecraftと同じルールです。ファイルごとに、一覧でいちばん上にあるパックが優先されます。テクスチャとそのアニメーションファイルはいつもセットなので、下のパックのアニメーションが上のパックの絵にくっつくことはありません。'),
        p('役に立つ内容が消えないよう、置き換えるのではなく中身を合わせるファイルもあります：'),
        ul([
          [strong('Java版：'), '言語ファイル（キーごと）、', code('sounds.json'), '（サウンドごと）、テクスチャアトラス、フォント。'],
          [strong('統合版：'), code('terrain_texture.json'), '、', code('item_texture.json'), '、', code('flipbook_textures.json'), '、', code('blocks.json'), '、サウンド定義、言語ファイル。'],
        ]),
        p('結果には「block/stone.pngはパックAのものを使用、パックBを上書き」のように競合がすべて表示され、各パックから何ファイル入ったかもわかります。'),
      ],
    },
    {
      id: 'versions',
      title: 'バージョンの違うパック',
      body: [
        p(
          '別々のバージョン向けに作られたJava版のパックも結合できます。遊んでいるバージョンを選ぶと、古いパックは先にそのバージョンのテクスチャ名に変えられます（',
          link('/texture-pack-converter', '変換ツール'),
          `と同じ名前変更です）。なので1.12のパックと${LATEST}のパックも組み合わせられます。Java版と統合版のパックは直接結合できないので、先にどちらかを変換してください。`,
        ),
      ],
    },
    {
      id: 'by-hand',
      title: '手作業でパックを結合する',
      body: [
        steps([
          'それぞれのパックを別々のフォルダーに展開します。',
          '新しいフォルダーを作り、優先度のいちばん低いパックを最初にコピーし、その上に優先度の高いパックを順にコピーします。聞かれたらファイルを置き換えます。',
          ['合わせるべきファイル（', code('sounds.json'), '、言語ファイル、アトラス）は手で合わせます。そうしないと最後にコピーしたものだけが残ります。'],
          [code('pack.mcmeta'), 'を1つだけ残すか（Java版）、新しいIDで', code('manifest.json'), 'を書き直し（統合版）、中身をzipにまとめます。'],
        ]),
        p('ツールなら、合わせるファイルや正しいパックフォーマットも含めて全部やってくれます。手作業が向いているのは、特殊なパックのときだけです。'),
      ],
    },
  ],
  faq: [
    { id: 'how-many', q: 'いくつのパックを結合できますか？', a: [p('一度に2〜8個です。もっと結合したいときは、結果を次のパックと一緒にもう一度結合します。')] },
    { id: 'shaders', q: 'シェーダーパックも結合できますか？', a: [p('できません。IrisやOptiFineのシェーダーパックは一度に1つしか動きません。バニラのシェーダー用リソースパックは普通のリソースパックと同じように結合できますが、同じシェーダーファイルを変える2つのパックの効果が足し合わされることはありません。')] },
    { id: 'server', q: '結合したパックをサーバーリソースパックに使えますか？', a: [p('はい。結合した', code('.zip'), 'をサーバー用パックの置き場所にアップロードし、ほかのパックと同じように', code('server.properties'), 'で指定します。')] },
    { id: 'upload', q: 'パックはアップロードされますか？', a: [p('いいえ。パックはブラウザの中で結合され、端末に残ります。')] },
  ],
  ctaLabel: 'テクスチャパックを結合を開く',
};

// ---------------------------------------------------------------- bedrock skin pack

const SKIN_PACK_STEPS: Child[] = [
  [link('/skin-pack-maker', 'スキンパック作成ツール'), 'を開き、スキンを始めます。白紙か色分けのテンプレート、手元のPNG、ユーザー名から取ったJava版プレイヤーのスキン、デフォルトスキンから選べます。腕はクラシック（4ピクセル）かスリム（3ピクセル）を選びます。'],
  '64×64のテンプレートか3Dモデルの上で直接塗ります。スキンはそれぞれ別のプロジェクトとして端末に保存され、その名前がゲーム内で表示されるスキン名になります。',
  'パックに入れるほかのスキンも同じように作ります。',
  ['そのうちの1つを開き、', strong('Export'), ' › ', strong('統合版スキンパック（.mcpack）'), 'を選んでパックに名前をつけ、入れるほかのスキンにチェックして', strong('パックをダウンロード'), 'を押します。'],
  ['Windows、Android、iPhone、iPadで', code('.mcpack'), 'を開きます。Minecraftに取り込まれます。'],
  ['Minecraftで', uiPath('更衣室', 'クラシック スキン'), 'を開き、自分のパックからスキンを選んで', strong('装備'), 'を押します。'],
];

const bedrockSkinPack: GuideText = {
  image: SHOTS.skinPack,
  intro: [
    p(
      strong('はい、Minecraft統合版のスキンパックは無料で自作できます。'),
      'スキンパックは、1つ以上のスキンと、',
      code('manifest.json'),
      'と',
      code('skins.json'),
      'という2つの小さな説明ファイルが入った',
      code('.mcpack'),
      'ファイルです。',
      link('/skin-pack-maker', 'スキンパック作成ツール'),
      'でスキンを描くか読み込み、パックをダウンロードしてWindows、Android、iPhone、iPadで開けば、更衣室から自分のスキンを着られます。Minecraftマーケットプレイスでパックを販売するのは別の話で、Mojangに認められたマーケットプレイスのパートナーしか公開できません。',
    ),
  ],
  quick: {
    title: 'かんたんに言うと',
    items: [
      [link('/skin-pack-maker', 'スキンパック作成ツール'), 'で、スキンを1つずつ描くか読み込みます（クラシックかスリム）。'],
      [strong('Export'), ' › ', strong('統合版スキンパック（.mcpack）'), 'を選び、パックに名前をつけてほかのスキンにチェックします。'],
      [code('.mcpack'), 'を開き、', uiPath('更衣室', 'クラシック スキン'), 'でスキンを装備します。'],
    ],
  },
  howto: { name: 'Minecraft統合版のスキンパックを作る方法', steps: SKIN_PACK_STEPS },
  sections: [
    {
      id: 'what',
      title: 'スキンパックの中身',
      body: [
        p('スキンパックは、拡張子を', code('.mcpack'), 'に変えたzipファイルです。いちばん上の階層に次のファイルが入っています：'),
        table(
          ['ファイル', '役割'],
          [
            [code('manifest.json'), ['パックの名前、2つの固有ID（UUID）、バージョン番号。モジュールタイプの', code('skin_pack'), 'で、テクスチャパックではなくスキンパックだとMinecraftに伝えます。']],
            [code('skins.json'), ['スキンの一覧。スキンごとに名前のキー、PNG、モデル（クラシックの腕は', code('geometry.humanoid.custom'), '、スリムの腕は', code('geometry.humanoid.customSlim'), '）、', code('"type": "free"'), 'を書きます。']],
            ['スキン画像', ['スキン1つにつき64×64のPNGを1枚、', code('manifest.json'), 'と同じ場所に置きます。']],
            [code('texts/en_US.lang'), ['更衣室に表示されるパックとスキンの名前。', code('texts/languages.json'), 'には言語ファイルの一覧を書きます。']],
          ],
        ),
        p(code('"type": "free"'), 'は、パックを持っている人なら誰でもそのスキンを着られるという意味です。マーケットプレイスのパックはほとんどのスキンが', code('"paid"'), 'で、パックを買わないと使えません。自作のパックはいつも「free」です。'),
      ],
    },
    {
      id: 'steps',
      title: 'スキンパック作成ツールで作る',
      body: [
        steps(SKIN_PACK_STEPS),
        figure(SHOTS.skinPack),
        p(
          'ツールが',
          code('manifest.json'),
          '、',
          code('skins.json'),
          '、言語ファイルを、パックごとに新しいIDで自動作成します。クラシックとスリムのスキンを1つのパックに入れられ、スキンはそれぞれの名前のまま。入力したパック名は、スキンの上に見出しとして表示されます。',
        ),
        figure(SHOTS.skin3d),
      ],
    },
    {
      id: 'install',
      title: 'Windows・Android・iOSで入れる',
      body: [
        tabbed(
          'install-skin-pack',
          [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  [code('.mcpack'), 'をダブルクリックします。Minecraftが開き、', el('em', null, 'インポート開始...'), 'のあとにインポート完了と表示されます。'],
                  [uiPath('更衣室', 'クラシック スキン'), 'を開き、自分のパックのスキンを選んで', strong('装備'), 'を押します。'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android・iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['スマホやタブレットに', code('.mcpack'), 'をダウンロードします。'],
                  [strong('Android：'), 'ダウンロードかファイルアプリから開き、Minecraftを選びます。', strong('iPhone / iPad：'), 'ファイルアプリでファイルをタップし、', uiPath('共有', 'Minecraft'), 'を選びます。'],
                  [uiPath('更衣室', 'クラシック スキン'), 'を開き、自分のパックのスキンを装備します。'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'ゲーム機',
              icon: 'gamepad',
              content: [p('Xbox、PlayStation、Switchでは、スキンパックもスキンファイルもインポートできません。ゲーム機で見た目を変えるには、キャラクタークリエイターかマーケットプレイスのスキンパックを使います。')],
            },
          ],
          UI_JA.platform,
        ),
        callout('tip', 'スキンが1つだけなら', 'スキン1つならパックは要りません。クラシック スキンで自分のスキンを開き、インポートを選んで64×64のPNGを指定します。スキンがいくつもあるならパックが便利で、名前もそのまま残り、どの端末でも同じ手順で入れられます。'),
      ],
    },
    {
      id: 'update',
      title: 'スキンパックを更新・削除する',
      body: [
        p('インポート済みのパックを変えたいときは、スキンを編集し、同じプロジェクトからパックを書き出し直して新しいファイルを開きます。ツールはパックの2つのIDをそのままにバージョンを上げる（1.0.0、次は1.0.1……）ので、Minecraftは2つ並べずに導入済みのパックを置き換えます。'),
        p('手作業で作ったパックなら、2つのUUIDはそのままにして、', code('manifest.json'), 'のヘッダーとモジュールの両方でバージョンを上げます。UUIDを新しくすると別のパックになり、同じバージョンのままだと導入済みとみなされてインポートされません。'),
        p('パックを削除するには、', uiPath('設定', 'ストレージ'), 'でパックを選んで削除します。'),
      ],
    },
    {
      id: 'arms',
      title: 'クラシックとスリムの腕',
      body: [
        p(
          'パックの各スキンはそれぞれのモデルを持つので、1つのパックに両方を混ぜられます。',
          strong('クラシック'),
          '（スティーブ）の腕は幅4ピクセルで',
          code('geometry.humanoid.custom'),
          '、',
          strong('スリム'),
          '（アレックス）の腕は幅3ピクセルで',
          code('geometry.humanoid.customSlim'),
          'を使います。スキンを描いたときの腕に合ったモデルにしないと、腕が欠けて見えたり、透明なすき間ができたりします。',
        ),
        p('インポートするパックで使えるのはこの2つのモデルだけです。大きな頭のような独自の形は、自分でインポートするスキンパックでは使えません。'),
      ],
    },
    {
      id: 'by-hand',
      title: 'スキンパックを手作業で作る',
      body: [
        p('ファイルはテキストエディターで自分で書くこともできます。スキン2つのパックはこうなります：'),
        pre(SKIN_PACK_TREE),
        p(code('manifest.json'), 'には、違うUUIDが2つ必要です。下の例をコピーせず、UUIDジェネレーターで自分用のものを作り、あとの更新のためにとっておきましょう：'),
        pre(SKIN_PACK_MANIFEST.trimEnd()),
        p(code('skins.json'), 'にはスキンを並べます。', code('serialize_name'), 'と', code('localization_name'), 'はパックのIDで、ほかのパックと重ならない、スペースなしの1語にします。スキンパック作成ツールは、念のためパックのUUIDの先頭を付け足しています。'),
        pre(SKIN_PACK_SKINS_JSON.trimEnd()),
        p(code('texts/en_US.lang'), 'にはゲーム内に表示される名前を書き、', code('texts/languages.json'), 'には', code('["en_US"]'), 'と書きます：'),
        pre(SKIN_PACK_LANG.trimEnd()),
        steps([
          ['図のようにファイルを1つのフォルダーに置きます。PNGは', code('manifest.json'), 'と同じ場所です。'],
          'フォルダーそのものではなく、フォルダーの中のファイルを選んでzipにまとめます。',
          ['zipの拡張子を', code('.zip'), 'から', code('.mcpack'), 'に変えて開きます。'],
        ]),
        p('インポートに失敗するときは、たいていzipの中でファイルがフォルダーに入っている、JSONに打ち間違いがある、2つのUUIDが同じ、のどれかです。', link('/skin-pack-maker', 'スキンパック作成ツール'), 'はまさにこのファイルを書き出すので、パックを書き出して拡張子を', code('.zip'), 'に変え、中を見てみるのも手です。'),
      ],
    },
    {
      id: 'marketplace',
      title: 'マーケットプレイスのパックと自作のパック',
      body: [
        p('マーケットプレイス向けのスキンパックを作りたい？マーケットプレイスで公開できるのは、Mojangのパートナープログラムに参加を認められたスタジオやクリエイターだけで、パックは1つずつ審査に出されます。ゲームやWebサイトから、マーケットプレイスにパックをアップロードする方法はありません。'),
        ul([
          [strong('自作のスキンパック：'), '無料で誰でも作れ、Windows、Android、iPhone、iPadで', code('.mcpack'), 'からインポートします。ファイルは友達と共有できます。'],
          [strong('マーケットプレイスのスキンパック：'), '認められたパートナーが作るもので、マインコインで買うか無料。ゲーム機を含むすべての端末で使えます。'],
        ]),
        p('パックに入れるのは、自分で作ったスキンか、共有してよいと許可されたスキンだけにしましょう。'),
      ],
    },
    {
      id: 'trusted',
      title: '友達にデフォルトのスキンで見えるのはなぜ？',
      body: [
        p('統合版には', strong('信頼できるスキンのみ許可'), 'という設定があります。これをオンにしたプレイヤーには、インポートしたパックのものも含め、カスタムスキンがすべてスティーブやアレックスなどのデフォルトのスキンに見えます。相手側の設定なので、こちらから変えることはできません。それ以外のプレイヤーには、作ったとおりのスキンで見えます。'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: '統合版のスキンパックは無料で作れますか？', a: [p('はい。自作のスキンパックは、Windows、Android、iPhone、iPadで無料で作って使えます。スキンパック作成ツールはアカウント不要で、スキンは端末に残ります。')] },
    { id: 'java', q: 'スキンパックはJava版で使えますか？', a: [p('使えません。スキンパックは統合版の機能です。Java版では一度に1つのスキンを、Minecraft LauncherでPNGとして登録して使います。', link('/guides/make-a-skin', 'スキンの作り方'), '。')] },
    { id: 'console', q: '自作のスキンパックをXbox、PlayStation、Switchで使えますか？', a: [p('使えません。ゲーム機はスキンパックもスキンファイルもインポートできません。Windows、Android、iPhone、iPadならできます。')] },
    { id: 'marketplace', q: '自作のスキンパックをマーケットプレイスで売れますか？', a: [p('Minecraftマーケットプレイスの認定パートナーでなければ売れません。自作のパックは.mcpackファイルとして共有できますが、ゲーム内で販売はできません。')] },
    { id: 'failed', q: 'インポートに失敗するのはなぜ？', a: [p('たいていは、zipの中でファイルがフォルダーに入っている、JSONに打ち間違いがある、2つのUUIDが同じ、同じIDとバージョンのパックがすでに入っている、のどれかです。スキンパック作成ツールで書き出したパックなら、この4つは起きません。')] },
  ],
  ctaLabel: 'スキンパック作成ツールを開く',
};

// ---------------------------------------------------------------- 3D items

const MODEL_STEPS: Child[] = [
  [link('/textures', 'Texture Pack Maker'), 'を開き、遊んでいるバージョンの', strong('Java'), 'パックを作ります。1.8以降に対応し、インベントリでアイテムを平らなままにするなら1.21.4以降が必要です。'],
  ['一覧を', strong('Items'), 'に切り替えて、ダイヤモンドの剣などのアイテムを開きます。', strong('Preview'), 'タブで', strong('Edit shape'), 'を押します。'],
  [strong('3D item from sprite'), 'を選びます。平らな絵のピクセルがすべて、奥行き1ピクセルのキューブの一部になります。'],
  ['形を変えます。3Dビューか一覧でキューブをクリックし、動かす、大きさを変える、コピーする、新しく追加するといった操作をします。', strong('Faces'), 'では、面に別のテクスチャやテクスチャの別の部分を割り当てます。'],
  [strong('Display'), 'を開き、インベントリ、一人称と三人称、地面、額縁、頭の上でのモデルを確認します。おかしく見えるところは回転、位置、大きさを直します。'],
  ['必要なら（1.21.4以降）：', strong('Model'), 'タブで', strong('Flat in the inventory'), 'をオンにすると、インベントリでは平らなアイコンのまま、手に持つと3Dモデルになります。'],
  [strong('Done'), 'を押し、パックを', code('.zip'), 'で書き出して', code('resourcepacks'), 'フォルダーに入れ、ゲームで確かめます。'],
];

const make3dItems: GuideText = {
  image: SHOTS.model3dSword,
  intro: [
    p(
      'Minecraft Java版のブロックやアイテムの形は、その',
      strong('モデル'),
      'で決まります。リソースパックの中にある、キューブを並べた小さなJSONファイルです。テクスチャパックに新しいモデルを入れれば、MODもOptiFineもなしで形が変わります。平らな剣が3Dの剣になり、ブロックがハーフブロックや階段の段になります。',
      link('/textures', 'Texture Pack Maker'),
      'には、これをブラウザでできるモデルエディターがあります。アイテムの平らなスプライトを1クリックで3Dのキューブにし、キューブを1つずつ変えられ、ゲームのバージョンに必要なファイルを書き出します。統合版のしくみは違うので、下で説明します。',
    ),
  ],
  quick: {
    title: 'かんたんに言うと',
    items: [
      ['Texture Pack Makerの', strong('Preview'), 'タブにアイテムを表示し、', strong('Edit shape'), 'を押す。'],
      [strong('3D item from sprite'), 'を選び、キューブと手に持ったときの見え方を整える。'],
      ['パックを書き出す。モデルは', code('models/item/'), 'に入り、1.21.4以降は必要なときだけ', code('items/'), 'にアイテム定義が入る。'],
    ],
  },
  howto: { name: 'Minecraftのテクスチャパックで3Dアイテムを作る方法', steps: MODEL_STEPS },
  sections: [
    {
      id: 'what',
      title: 'Minecraftのモデルとは',
      body: [
        p('Java版1.8以降では、ほとんどのブロックとアイテムをリソースパックのモデルファイルから描きます。'),
        ul([
          [code('assets/minecraft/models/block/'), 'にはブロックのモデルが入っています（', code('oak_slab.json'), 'など）。', code('blockstates/'), 'にある', strong('ブロックステート'), 'のファイルが、状態ごとにどのモデルを使うかを決めます。下付きか上付きのハーフブロック、横倒しの原木などです。'],
          [code('assets/minecraft/models/item/'), 'にはアイテムのモデルが入っています。ほとんどのアイテムは平らなモデル（', code('item/generated'), '）で、16×16のスプライトをゲームが自動で薄い形にします。1.21.4からは、', code('assets/minecraft/items/'), 'の', strong('アイテム定義'), 'が、アイテムに表示するモデルを決めます。'],
        ]),
        p('モデルファイルの主な部分は4つです。'),
        ul([
          [code('textures'), '：モデルが使うテクスチャの名前。たとえば', code('"oak_planks": "minecraft:block/oak_planks"'), 'です。', code('particle'), 'は壊したときのパーティクルのテクスチャです。'],
          [code('elements'), '：キューブ。それぞれ一方の角（', code('from'), '）から反対の角（', code('to'), '）までで、16 × 16 × 16のブロックのピクセル単位で表し、各軸-16から32まで使えます。', code('rotation'), 'でキューブを回転できます。'],
          [code('faces'), '：キューブの各面（', code('down'), '、', code('up'), '、', code('north'), '、', code('south'), '、', code('west'), '、', code('east'), '）に表示するテクスチャ、その範囲（', code('uv'), '）、そして', code('cullface'), '。', code('cullface'), 'は、その側を完全なブロックがふさいでいるときに面を描かない設定です。'],
          [code('display'), '：インベントリ（', code('gui'), '）、手の中、地面、額縁（', code('fixed'), '）、頭の上で、モデルをどう回し、動かし、拡大縮小するか。'],
        ]),
        p('これはハーフブロックの形をしたキューブ1つだけのモデルで、モデルエディターが書き出すのと同じ並びです。エディターで作ったファイルには、インベントリだけでなくすべての表示場所の設定が入ります。'),
        pre(MODEL_BLOCK_EXAMPLE.trimEnd()),
        p(
          '手書きのモデルは、よく',
          code('"parent"'),
          'で別のモデルのテクスチャ、キューブ、表示設定を借ります。モデルエディターは単体で完結したファイルを書き出します。親モデルから読み込んだものはすべてコピーされるので、ほかのファイルに頼りません。',
        ),
        callout('tip', '座標はピクセル単位', '1ブロックは各軸16なので、8で半ブロックです。モデルエディターはこのグリッドか、½や¼ピクセルにスナップし、大きさを「16 = one block」として表示します。'),
      ],
    },
    {
      id: 'steps',
      title: '3Dアイテムを作る手順',
      body: [steps(MODEL_STEPS), figure(SHOTS.modelEditShape), figure(SHOTS.modelSpriteStart), figure(SHOTS.model3dSword)],
    },
    {
      id: 'sprite',
      title: '「3D item from sprite」のしくみ',
      body: [
        p(
          '平らなアイテムは1枚の絵、つまりスプライトで、ふつうは16×16ピクセルです。このスタート地点は透明でないピクセルをすべて拾い、奥行き1ピクセルのキューブにします。位置はゲームの平らなアイテムと同じく中央（Z軸の7.5から8.5）です。横に並んだピクセルは1本の長いキューブにまとめ、同じ並びの行が縦に続けば長方形にまとめるので、ダイヤモンドの剣はピクセルごとではなく19個のキューブになります。隣のピクセルで完全に隠れる面は省きます。',
        ),
        p('各面にはスプライトの対応するピクセルが表示されます。3行目の5～7列に並んだ3つのピクセルは、次のキューブになります。'),
        pre(MODEL_SPRITE_CUBE.trimEnd()),
        p(
          '表（',
          code('south'),
          '）はピクセルをそのまま、裏（',
          code('north'),
          '）は絵を裏から見たように左右反転して表示します。キューブはアイテム自身のテクスチャ（',
          code('#layer0'),
          '）を使い続けるので、スプライトを塗り直せば3Dアイテムの色も変わります。ピクセルを足したり消したりしたときは、もう一度',
          strong('3D item from sprite'),
          'を選ぶまで形は変わりません。ポーションや革の防具のように複数のレイヤーがあるアイテムは、レイヤーごとにキューブができ、ゲームによる色付けもそのまま残ります。',
        ),
        p('そこから自分らしく仕上げましょう。'),
        ul([
          '刃を厚くする：刃のキューブを選び、Zの位置と大きさを、たとえば7.5と1から7と2に変えます。',
          [strong('+'), 'ボタン（またはNキー）でつばや宝石のキューブを足し、', uiPath('Faces', 'Change'), 'で面に別のテクスチャを割り当てます。'],
          [strong('Rotation'), 'でキューブを回転します。Minecraft 1.21.6より前は1つの軸だけで、-45°、-22.5°、0°、22.5°、45°のどれかです。エディターはバージョンで使える角度だけを出します。'],
          'どの変更もCtrl+Zで元に戻せます。',
        ]),
      ],
    },
    {
      id: 'display',
      title: '持ったときの見え方：Display',
      body: [
        p(strong('Display'), 'タブでは、6か所でのモデルをプレビューできます。それぞれ回転（度）、位置（ピクセル、±80まで）、大きさ（1が標準、最大4）があります。'),
        table(
          ['エディターの表示', '見える場所', 'ファイル内の名前'],
          [
            ['Inventory', 'インベントリとホットバー', code('gui')],
            ['First person', '自分の手の中', [code('firstperson_righthand'), '（左手は左右反転）']],
            ['Third person', 'ほかのプレイヤーの手の中、またはF5の視点', code('thirdperson_righthand')],
            ['Ground', '地面に落としたとき', code('ground')],
            ['Item frame', '額縁の中', code('fixed')],
            ['Head', '頭にかぶったとき', code('head')],
          ],
        ),
        p(
          strong('3D item from sprite'),
          'はアイテム本来の表示設定を引き継ぐので、3Dの剣も平らな剣と同じように持ちます。',
          strong('Game’s default'),
          'でその場所をゲームの値に戻し、',
          strong('No change'),
          'で設定を消します。Java版1.21.9では棚用の',
          code('on_shelf'),
          'が加わりました。エディターはゲームのモデルにある値をそのまま残します。',
        ),
        figure(SHOTS.modelDisplay),
      ],
    },
    {
      id: 'flat',
      title: 'インベントリでは平らなアイコンのままにする（1.21.4以降）',
      body: [
        p(
          '3Dパックの多くは、インベントリではおなじみの平らなアイコンを残し、手に持ったときだけ3Dモデルを見せます。Java版1.21.4からは、アイテム定義でアイテムの表示場所ごとにモデルを選べます。',
          strong('Model'),
          'タブで',
          strong('Flat in the inventory'),
          'をオンにすると、エディターは次のようにします。',
        ),
        ul([
          ['形を2つ目のモデル', code('models/item/diamond_sword_3d.json'), 'として保存し、平らな', code('diamond_sword.json'), 'はそのまま残します。'],
          [code('items/diamond_sword.json'), 'を書き出します。インベントリ（', code('gui'), '）、地面、額縁（', code('fixed'), '）では平らなモデル、それ以外では3Dモデルを表示します。'],
        ]),
        pre(MODEL_FLAT_DEFINITION.trimEnd()),
        p('1.21.4より前のバージョンにはアイテム定義がないため、アイテムはどこでも同じモデルになり、このスイッチは表示されません。'),
        figure(SHOTS.modelFlatInventory),
      ],
    },
    {
      id: 'blocks',
      title: 'ブロックの形を変える',
      body: [
        p(
          'ブロックも同じです。Previewタブにブロックを表示し、',
          strong('Edit shape'),
          'を押します。エディターは、表示している状態でブロックが使うモデルを開き、上のメニューにはほかのモデル（上付きのハーフブロックや2枚重ねなど）が並びます。ゲームのモデルをそのまま使うか、',
          strong('Full cube'),
          '、',
          strong('Slab'),
          '、',
          strong('Cross (plant)'),
          '、',
          strong('Empty'),
          'から始めて、キューブを足し、動かし、大きさを変えます。石を階段の段にするなら、Slabから始めてキューブを1つ足すだけです。',
        ),
        figure(SHOTS.modelBlock),
        ul([
          [strong('共有されるモデル：'), '同じモデルファイルを使うブロックもあります。編集中のモデルをほかのブロックも使っていると、エディターがそのブロックを教えてくれます。そちらも一緒に変わります。'],
          [strong('アイテムは別扱い：'), '手に持ったハーフブロックのように、ブロックのモデルを表示するアイテムは、アイテムを編集すると専用のアイテムモデルができます。ブロックの形は変わりません。'],
          [strong('変わるのは見た目だけ：'), '当たり判定、衝突、光はゲームのコードで決まります。段の形にした石ブロックも完全なブロックとして体を止め、隣のブロックは接している面を隠したままなので、すき間から向こうが見えてしまうことがあります。'],
          [strong('コードで描かれるブロック：'), 'チェスト、ベッド、看板、旗など、ゲーム自身が描くブロックにはブロックモデルがないので、Edit shapeは出ません。盾のようにコードで描かれるアイテムにはモデルを付けられ、その見た目を置き換えます。'],
        ]),
        p(
          '石などいくつかのブロックは、2つのモデル（石と左右反転したコピー、それぞれ向きを回したもの）からランダムに選ばれます。Modelタブの',
          strong('Use for every random variant'),
          'を使うと、ブロックのブロックステートファイルを書き出して、すべてに自分の形を使います。',
          code('"y": 180'),
          'の項目でランダムな向きが残り、',
          code('weight'),
          'は各項目が選ばれる頻度です。',
        ),
        pre(MODEL_STONE_BLOCKSTATE.trimEnd()),
      ],
    },
    {
      id: 'files',
      title: 'パックに入るファイル',
      body: [
        table(
          ['変えるもの', 'パックに入るファイル'],
          [
            ['3Dアイテム', code(MODEL_FILES.sword.latest[0])],
            ['3Dアイテム（インベントリでは平ら、1.21.4以降）', [code(MODEL_FILES.swordFlat.latest[0]), 'と', code(MODEL_FILES.swordFlat.latest[1])]],
            ['ブロックの形', code(MODEL_FILES.slab.latest[0])],
            ['ランダムな種類すべてのブロックの形', [code(MODEL_FILES.stoneEvery.latest[0]), 'と', code(MODEL_FILES.stoneEvery.latest[1])]],
          ],
        ),
        p(
          'パスはすべて',
          code('assets/minecraft/'),
          'の中です。1.8以降のJava版ならどれも同じファイルになり、インベントリで平らにするのだけは1.21.4以降が必要です。エディターがアイテム定義やブロックステートを加えるのはゲームが必要とするときだけで、開いたパックにすでにあるモデルファイルは残り、編集もできます。書き出すときには、すべてのモデルをゲームのバージョンに照らしてチェックし、読み込めないものがあれば警告します。',
        ),
        h3('バージョンごとの変更点'),
        table(
          ['バージョン', 'モデルについての変更'],
          [
            ['1.8', 'ブロックとアイテムのモデルが、リソースパックで差し替えられるJSONファイルになりました。キューブは1つの軸で-45°、-22.5°、0°、22.5°、45°に回せます。'],
            ['1.13', ['テクスチャのフォルダー名が', code('blocks'), 'と', code('items'), 'から', code('block'), 'と', code('item'), 'に変わり、モデル内のテクスチャ名も変わりました。']],
            ['1.15.2', [code('gui_light'), 'で、インベントリのアイコンを横から（ブロック向け）照らすか正面から（アイテム向け）照らすかを決められるようになりました。']],
            ['1.19.3', ['モデルのテクスチャは、ゲームのテクスチャアトラスが読むフォルダー（', code('textures/block/'), 'や', code('textures/item/'), 'など）に置く必要があります。']],
            ['1.21.4', [code('items/'), 'のアイテム定義がアイテムのモデルを選びます。表示場所ごとに選ぶこともできます。']],
            ['1.21.6', 'キューブを-45°から45°の好きな角度で回せるようになりました。'],
            ['1.21.9', ['表示場所', code('on_shelf'), 'が加わりました。']],
            ['1.21.11', 'キューブを複数の軸で同時に、好きな角度で回せるようになりました。'],
          ],
        ),
        p('モデルエディターは、パックの対象バージョンのルールに従います。'),
      ],
    },
    {
      id: 'install',
      title: '入れて試す',
      body: [
        steps([
          [strong('Done'), 'でモデルエディターを閉じ、', strong('Export'), 'でパックを', code('.zip'), 'として書き出します。'],
          ['Minecraftで', uiPath(OPTIONS, PACKS, OPEN_FOLDER), 'を開き、zipを入れて（解凍しません）、パックをほかのパックより上の', strong('選択中'), 'に移します。'],
          'アイテムを持ち、F5で三人称にし、地面に落とし、額縁に入れて、すべての表示を確かめます。',
          'モデルを変えたら書き出し直してzipを置き換え、ゲーム内でF3 + Tを押してパックを再読み込みします。',
        ]),
        p('くわしくは', link('/guides/install-resource-packs', 'リソースパックの入れ方'), 'と', link('/guides/texture-pack-not-working', 'テクスチャパックが反映されないとき'), 'をご覧ください。'),
      ],
    },
    {
      id: 'bedrock',
      title: '統合版（Bedrock Edition）',
      body: [
        p('統合版のパックはしくみが違い、モデルエディターが作るのはJava版のモデルだけです。'),
        ul([
          [strong('ブロック：'), '統合版のリソースパックでは、ゲームのブロックの形を変えられません。独自の形のブロックは新しいブロックで、ビヘイビアーパックとジオメトリファイルを含むアドオンで追加します。'],
          [strong('手に持つアイテム：'), '統合版ではアタッチャブル（attachables）で、手に持ったアイテムに3Dモデルを付けます。統合版のジオメトリとアニメーションを使うリソースパックのファイルです。Texture Pack Makerでは作れませんが、', ext('https://www.blockbench.net/', 'Blockbench'), 'で作れます。'],
          [strong('出発点として：'), 'モデルエディターのメニューの', strong('Download as Bedrock geometry'), 'で、モデルを', code('.geo.json'), 'ファイル（フォーマット1.12.0、ボーン1つ、すべてのキューブ）として保存し、Blockbenchやアドオンに読み込めます。統合版のジオメトリはテクスチャを1枚しか使わないので、各面は自分のテクスチャ上の位置をそのまま保ちます。'],
        ]),
        p('統合版のパックでは、', strong('Edit shape'), 'を押すとエディターを開く代わりにこの説明が出ます。テクスチャを描くのはいつもどおりできます。'),
      ],
    },
    {
      id: 'problems',
      title: 'よくある問題',
      body: [
        ul([
          [strong('紫と黒の面：'), 'ゲームが見つけられないテクスチャを面が使っています。', code('textures'), 'にない名前（', code('#…'), '）、ゲームにもパックにもないファイル、1.19.3以降ならアトラスのフォルダー外のテクスチャです。Modelタブに、どのキューブの問題かとともに一覧が出ます。'],
          [strong('モデルの代わりに紫と黒のキューブ：'), 'ファイルが読み込まれていません。よくある原因は、壊れたJSON、-16～32からはみ出したキューブ、そのバージョンで使えない回転です。ゲームのログにファイル名が出ます。'],
          [strong('モデルがまったく出ない：'), 'パックが選択中でほかのパックより上にあるか、ファイルが置き換えるモデルとまったく同じ名前とフォルダーか、1.21.4以降なら新しいモデル（', code('_3d'), 'のコピーなど）を指すアイテム定義があるかを確かめます。'],
          [strong('手では良いのにインベントリで変：'), ['Inventoryの表示を調整するか、インベントリの光（横か正面）を切り替えるか、', strong('Flat in the inventory'), 'をオンにします。']],
          [strong('キューブが多すぎる：'), 'キューブが増えるほど描く面が増えます。手に持つアイテムならほとんど影響しませんが、何千個も置くブロックはシンプルにしましょう。3D item from spriteがまとめたキューブは分けずに使いましょう。'],
          [strong('角度が使えない：'), '1.21.6より前は、キューブは1つの軸で22.5°刻み、45°までしか回せません。90°回したいならキューブの2つの軸の大きさを入れ替え、それ以外の形はキューブを増やして作ります。'],
        ]),
        p('パック全般の直し方：', link('/guides/texture-pack-not-working', 'テクスチャパックが反映されない？原因と直し方'), '。'),
      ],
    },
  ],
  faq: [
    {
      id: 'mods',
      q: '3DアイテムにはOptiFineやMODが必要ですか？',
      a: [p('いいえ。Java版のリソースパックは1.8からブロックとアイテムのモデルを差し替えられるので、モデルファイルの入ったパックは通常のゲームで動きます。その種類のアイテムがすべて変わります。')],
    },
    {
      id: 'renamed',
      q: '名前を変えたアイテムだけを3Dにできますか？',
      a: [
        p(
          'モデルを差し替えるだけではできません。名前を変えたアイテムだけを変えるパックは、OptiFineのCustom Item Textures（CIT）か、それを読むMODを使います。1.21.4からはアイテム定義で',
          code('custom_model_data'),
          'によってモデルを選ぶこともでき、サーバーや配布マップの作者がコマンドで設定します。モデルエディターは、その種類のアイテムをすべて変えます。',
        ),
      ],
    },
    {
      id: 'bedrock',
      q: '統合版で3Dアイテムを作れますか？',
      a: [p('はい。Blockbenchなどで作ったアタッチャブルを統合版のリソースパックに入れます。このモデルエディターが作るのはJava版のモデルですが、出発点としてモデルを統合版のジオメトリでダウンロードできます。統合版のリソースパックでは、ゲームのブロックの形は変えられません。')],
    },
    {
      id: 'blockbench',
      q: 'Blockbenchで作ったモデルは使えますか？',
      a: [p('はい。BlockbenchからエクスポートしたJava版のブロックやアイテムのモデルは、普通のモデルファイルです。置き換えるモデルと同じ名前でパックに入れ、', strong('Open a pack'), 'でパックを開けば、ファイルはそのまま残り、モデルエディターで開いて変更できます。')],
    },
    {
      id: 'undo',
      q: '元の形に戻すには？',
      a: [p('モデルエディターのメニューで', strong('Put back the original model'), 'を選びます。そのモデルのファイルがパックから消え、ゲームのモデルに戻ります。')],
    },
    {
      id: 'phone',
      q: 'スマホで3Dアイテムを作れますか？',
      a: [p('はい。スマホでは3Dビューがパネルの上に表示され、タッチで操作します。ただしパックはJava版用なので、遊ぶのはパソコンです。')],
    },
  ],
  ctaLabel: 'Texture Pack Makerを開く',
};

export const GUIDES: Record<string, GuideText> = {
  'make-a-texture-pack': makeATexturePack,
  'texture-pack-not-working': notWorking,
  'install-resource-packs': install,
  'minecraft-pack-format-versions': packFormats,
  'make-a-skin': makeASkin,
  'make-shaders-without-mods': shadersWithoutMods,
  'java-vs-bedrock-packs': javaVsBedrock,
  'bedrock-vibrant-visuals-settings': vibrantVisuals,
  'convert-java-to-bedrock-texture-pack': convertJavaToBedrock,
  'merge-texture-packs': mergePacks,
  'make-a-bedrock-skin-pack': bedrockSkinPack,
  'make-3d-items-texture-pack': make3dItems,
};
