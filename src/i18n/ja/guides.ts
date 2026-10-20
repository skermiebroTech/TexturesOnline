// Japanese guides (see GuideText in src/tools/guides/content.ts). Facts come from the app data
// (src/app/content/facts.ts), menu names from the Japanese game files.

import { el, type Child, type ElNode } from '../../app/markup';
import { callout, code, ext, figure, folderTable, link, steps, strong, tabbed, uiPath } from '../../app/content/blocks';
import { F, LATEST, MIN_ENGINE, NEXT_SNAPSHOT, formatGroups, formatParts, maxFormat, mcmetaFor, mcmetaLegacy, mcmetaRange, minFormat } from '../../app/content/facts';
import type { GuideText, GuidesIndexText } from '../../tools/guides/content';
import { SHOTS } from './shots';
import { UI_JA } from './ui';

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
  [link('/shaders', 'Shader Maker'), 'を開き、', strong('Vanilla Java'), 'を選びます。'],
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
      'Minecraftのスキンは、プレイヤーのモデルに巻きつける64×64ピクセルのPNG画像です。ブラウザでデザインできます。テンプレートに描いて3Dモデルで確認し、Minecraft Launcherに登録する（Java版）か、スキンパックとしてインポートします（統合版）。',
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
      ],
    },
  ],
  faq: [
    { id: 'size', q: 'Minecraftのスキンのサイズは？', a: [p('64×64ピクセルのPNGです。64×32はJava版1.7.10以前のときだけ使います。')] },
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
          link('/guides/bedrock-vibrant-visuals-settings', 'バイブラントビジュアルズの設定解説（英語）'),
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

export const GUIDES: Record<string, GuideText> = {
  'make-a-texture-pack': makeATexturePack,
  'texture-pack-not-working': notWorking,
  'install-resource-packs': install,
  'minecraft-pack-format-versions': packFormats,
  'make-a-skin': makeASkin,
  'make-shaders-without-mods': shadersWithoutMods,
  'java-vs-bedrock-packs': javaVsBedrock,
};
