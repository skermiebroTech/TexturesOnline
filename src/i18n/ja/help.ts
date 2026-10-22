// Japanese help page (see HelpText in src/tools/help/content.ts). Menu names are the ones the
// Japanese game shows (Java: assets/minecraft/lang/ja_jp.json, Bedrock: texts/ja_JP.lang).

import { el, type Child } from '../../app/markup';
import { callout, code, ext, folderTable, link, steps, strong, tabbed, uiPath } from '../../app/content/blocks';
import { REPO_URL } from '../../app/site';
import { F, LATEST, maxFormat, minFormat } from '../../app/content/facts';
import type { HelpText } from '../../tools/help/content';
import { UI_JA } from './ui';

const p = (...c: Child[]) => el('p', null, ...c);
const FOLDER = UI_JA.folderTable;

const JAVA_PACK_STEPS: Child[] = [
  ['Texture Pack Makerでパックを書き出します。', code('My Pack.zip'), 'のようなファイルができます。'],
  ['Minecraft Java版を起動し、', uiPath('設定…', 'リソースパック…'), 'を開きます。'],
  [uiPath('パックフォルダーを開く'), 'をクリックすると、', code('resourcepacks'), 'フォルダーが開きます。'],
  [code('.zip'), 'をそのフォルダーに入れます。リソースパックの画面に直接ドラッグしても大丈夫です。'],
  [strong('利用可能'), 'の一覧で自分のパックにカーソルを合わせ、矢印をクリックして', strong('選択中'), 'に移します。上にあるパックほど優先されます。', strong('完了'), 'をクリックします。'],
];

const BEDROCK_PACK_STEPS: Child[] = [
  ['パックを書き出します。', code('My Pack.mcpack'), 'のようなファイルができます。'],
  ['ファイルをダブルクリックします。Minecraftが開き、', el('em', null, 'インポート開始...'), 'のあとにインポート完了と表示されます。'],
  [uiPath('設定', 'グローバル リソース', 'マイ パック'), 'でパックを選び、', strong('有効化'), 'を押します。'],
  '複数のパックを使う場合は、自分のパックをいちばん上に移すと優先されます。',
];

const JAVA_SKIN_STEPS: Child[] = [
  ['Minecraft Launcherを開き、', uiPath('Minecraft: Java Edition', 'スキン'), 'を選びます。'],
  [strong('新しいスキン'), '（＋のカード）をクリックします。'],
  ['名前をつけ、プレイヤーのモデルを', strong('クラシック'), 'か', strong('スリム'), 'から選びます。'],
  [strong('参照'), 'をクリックしてPNGを選び、', strong('保存して使用'), 'をクリックします。'],
];

const BEDROCK_SKIN_STEPS: Child[] = [
  [strong('統合版スキンパック'), 'として書き出すと、', code('.mcpack'), 'ファイルができます。'],
  'ファイルを開いてインポートします（Windowsはダブルクリック、スマホやタブレットは「Minecraftで開く」）。',
  ['Minecraftで', uiPath('更衣室', 'クラシック スキン'), 'を開くと、インポートしたパックの中に表示されます。'],
  ['スキンを選び、', strong('装備'), 'を押します。'],
];

const IRIS_STEPS: Child[] = [
  [ext('https://www.irisshaders.dev/', 'irisshaders.dev'), 'からIris Installerをダウンロードします。Fabric Loader、Iris、Sodiumを、遊ぶバージョン用にまとめてインストールしてくれます。'],
  ['Minecraft Launcherを開き、新しくできた', strong('Iris & Sodium'), 'のプロフィールで一度プレイします。'],
  ['Shader Makerでシェーダーパックを書き出します（', code('.zip'), 'のまま、解凍しません）。'],
  ['ゲーム内で', uiPath('設定…', 'ビデオ設定…', 'シェーダーパック...'), 'を開き、', strong('パックフォルダーを開く...'), 'をクリックしてzipを入れます。'],
  ['パックを選んで', strong('適応'), 'をクリックします。', strong('シェーダーの設定...'), 'ボタンから、ゲーム内で細かい設定を調整できます。'],
];

const VANILLA_SHADER_STEPS: Child[] = [
  [strong('Vanilla Java'), 'を選んで書き出すと、', code('.zip'), 'のリソースパックができます。'],
  ['テクスチャパックと同じように導入します：', uiPath('設定…', 'リソースパック…', 'パックフォルダーを開く'), 'を開き、zipを入れます。'],
  '「選択中」に移して「完了」を押せば、すぐに新しい見た目になります。',
];

const VIBRANT_STEPS: Child[] = [
  ['パック（', code('.mcpack'), '）を書き出し、ファイルを開いてインポートします。'],
  [uiPath('設定', 'グローバル リソース', 'マイ パック'), 'でパックを有効にします。'],
  [uiPath('設定', 'ビデオ'), 'を開き、', strong('グラフィックモード'), 'を', strong('バイブラントビジュアルズ'), 'にします。'],
];

export const HELP: HelpText = {
  sections: {
    'java-packs': {
      title: 'Java版のテクスチャパック',
      short: 'Java版のパック',
      howto: { name: 'Minecraft Java版にテクスチャパック（リソースパック）を入れる方法', steps: JAVA_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Java版ではテクスチャパックを', el('em', null, 'リソースパック'), 'と呼びます。書き出したファイルは', code('.zip'), 'で、解凍せずにそのまま使います。'),
        steps(JAVA_PACK_STEPS),
        callout(
          'info',
          '「旧バージョン向けに制作」（または新バージョン向け）と表示されたら？',
          'パックはエディターで選んだバージョン向けに作られます。別のバージョンで遊ぶなら、',
          strong('Pack'),
          'タブで対象バージョンか対応範囲を変えて書き出し直してください。テクスチャだけのパックならたいていそのまま動くので、',
          strong('はい'),
          'を押して使うこともできます。',
        ),
        el('h3', { class: 'guide-sub' }, 'フォルダーの場所'),
        folderTable('resourcepacks', FOLDER),
      ],
    },
    'bedrock-packs': {
      title: '統合版のテクスチャパック',
      short: '統合版のパック',
      howto: { name: 'Windowsで統合版（Bedrock）のテクスチャパック（.mcpack）を入れる方法', steps: BEDROCK_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, '統合版のパックは', code('.mcpack'), 'ファイルとして書き出されます。開くだけでMinecraftに自動でインポートされます。'),
        tabbed(
          'bedrock-packs',
          [
            { value: 'windows', label: 'Windows', icon: 'monitor', content: [steps(BEDROCK_PACK_STEPS)] },
            {
              value: 'mobile',
              label: 'Android・iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['スマホやタブレットに', code('.mcpack'), 'をダウンロードします。'],
                  [strong('Android：'), 'ダウンロードやファイルアプリから開き、', strong('Minecraft'), 'を選びます。', strong('iPhone / iPad：'), 'ファイルアプリでファイルをタップし、', uiPath('共有', 'Minecraft'), 'を選びます。'],
                  ['Minecraftがパックをインポートします。その後', uiPath('設定', 'グローバル リソース'), 'で有効にします。'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'ゲーム機',
              icon: 'gamepad',
              content: [
                el(
                  'p',
                  { class: 'muted' },
                  'Xbox、PlayStation、Switchでは.mcpackファイルをインポートできません。PCやスマホでワールドにパックを追加してそのワールドに参加するか、パックを含むRealmやサーバーで遊んでください。',
                ),
              ],
            },
          ],
          UI_JA.platform,
        ),
        callout('tip', '1つのワールドだけに使いたいときは？', 'グローバル リソースではなく', uiPath('ワールドを編集', 'リソースパック'), 'を開き、そこでパックを有効にします。'),
        callout('info', 'インポート済みのパックを更新する', '書き出すたびにパックIDは同じままバージョン番号が上がるので、もう一度インポートすると重複せず古いものが置き換わります。'),
      ],
    },
    'java-skins': {
      title: 'Java版のスキン',
      short: 'Java版のスキン',
      howto: { name: 'Minecraft Java版でスキンを変える方法', steps: JAVA_SKIN_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'スキンを', code('.png'), 'で書き出します。', strong('クラシック'), '（腕4ピクセル）と', strong('スリム'), '（腕3ピクセル）のどちらのモデルで描いたか覚えておきましょう。'),
        tabbed(
          'java-skins',
          [
            { value: 'launcher', label: 'Minecraft Launcher', icon: 'monitor', content: [steps(JAVA_SKIN_STEPS)] },
            {
              value: 'web',
              label: 'minecraft.net',
              icon: 'globe',
              content: [
                steps([
                  [ext('https://www.minecraft.net/', 'minecraft.net'), 'にサインインし、プロフィールを開きます。'],
                  ['スキンの項目で', strong('クラシック'), 'か', strong('スリム'), 'のモデルを選びます。'],
                  ['PNGをアップロードして確定します。次にワールドやサーバーに入ったときにゲームに反映されます。'],
                ]),
              ],
            },
          ],
          UI_JA.platform,
        ),
        callout('info', '1.7.10以前で遊んでいる場合は？', 'これらのバージョンは古い64×32の形式しか読めません。書き出しのオプションで', strong('古いJava版スキン（64×32）'), 'を選んでください。'),
      ],
    },
    'bedrock-skins': {
      title: '統合版のスキン',
      short: '統合版のスキン',
      howto: { name: '統合版のスキンパック（.mcpack）を入れる方法', steps: BEDROCK_SKIN_STEPS },
      body: [
        tabbed(
          'bedrock-skins',
          [
            { value: 'pack', label: 'スキンパック（.mcpack）', icon: 'package', content: [steps(BEDROCK_SKIN_STEPS)] },
            {
              value: 'png',
              label: 'PNG 1枚',
              icon: 'image',
              content: [
                steps([
                  ['スキンを', code('.png'), 'で書き出します。'],
                  [uiPath('更衣室', 'クラシック スキン'), 'を開き、', strong('所有中'), 'の空いている', strong('インポート'), '枠を選びます。'],
                  ['PNGを選び、腕のモデル（クラシックかスリム）を選びます。'],
                ]),
              ],
            },
          ],
          UI_JA.platform,
        ),
        callout('warn', '友達にはデフォルトのスキンに見える？', strong('信頼できるスキンのみ許可'), 'をオンにしているプレイヤーには、カスタムスキンがデフォルトのスキンで表示されます。相手側の設定です。ゲーム機ではスキンファイルをインポートできません。'),
      ],
    },
    iris: {
      title: 'IrisやOptiFineでシェーダー',
      short: 'Iris / OptiFine',
      howto: { name: 'Irisでシェーダーパックを入れる方法', steps: IRIS_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, '従来のシェーダーパックにはシェーダー用のMODが必要です。', strong('Iris'), 'がいちばん簡単で軽く、OptiFineでも動きます。'),
        tabbed(
          'iris',
          [
            { value: 'iris', label: 'Iris（おすすめ）', icon: 'sparkles', content: [steps(IRIS_STEPS)] },
            {
              value: 'optifine',
              label: 'OptiFine',
              icon: 'gear',
              content: [
                steps([
                  [ext('https://optifine.net/', 'optifine.net'), 'から遊んでいるバージョン用のOptiFineを入れ、OptiFineのプロフィールで一度プレイします。'],
                  [uiPath('設定…', 'ビデオ設定…', 'シェーダーの詳細設定...'), 'を開き、', strong('シェーダーフォルダー'), 'をクリックします。'],
                  '書き出したzipをフォルダーに入れ、一覧から選びます。',
                ]),
              ],
            },
          ],
          UI_JA.platform,
        ),
        el('h3', { class: 'guide-sub' }, 'シェーダーパックのフォルダー'),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    'vanilla-shaders': {
      title: 'バニラシェーダー（MODなし）',
      short: 'バニラシェーダー',
      howto: { name: 'Minecraft Java版にバニラ（MODなし）シェーダーパックを入れる方法', steps: VANILLA_SHADER_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Minecraft自身のシェーダーファイルの一部を差し替える', strong('リソースパック'), 'なので、通常のゲームで動きます。'),
        steps(VANILLA_SHADER_STEPS),
        callout('warn', '特定のバージョン専用', 'Mojangはシェーダーファイルをよく変更するので、バニラのシェーダーパックは作ったバージョンでしか動きません。Minecraftをアップデートしたら、プロジェクトを開いて新しいバージョンを選び、書き出し直してください。'),
      ],
    },
    'vibrant-visuals': {
      title: '統合版のバイブラントビジュアルズ',
      short: 'バイブラントビジュアルズ',
      howto: { name: 'Minecraft統合版でバイブラントビジュアルズ用パックを使う方法', steps: VIBRANT_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, '統合版の「シェーダー」は、バイブラントビジュアルズ（Vibrant Visuals）の設定パックです。ライティング、空、カラーグレーディング、水、霧を調整します。'),
        steps(VIBRANT_STEPS),
        callout('warn', 'バイブラントビジュアルズを選べない？', '有効なパックがすべて対応しているときだけ選べます。従来のテクスチャパック（Texture Pack Makerで作ったものも含む）はこれをオフにするので、使う間はほかのパックを無効にしてください。サーバーによってはオフになっていることもあります。'),
        callout(
          'info',
          '対応端末が必要',
          'バイブラントビジュアルズは、DirectX 12対応のWindows PC、XboxとPlayStation（Xbox OneとPS4では最初はオフ）、A12チップ以降のiPhoneとiPad、多くの最近のAndroid端末で動きます。初代Nintendo Switch、Chromebook、Fireタブレットでは使えません。',
          strong('クラシックな霧のカスタマイズ'),
          'はほかのグラフィックモードでも使えます。',
        ),
      ],
    },
    folders: {
      title: 'Minecraftのフォルダーを探す',
      short: 'フォルダー',
      body: [
        el('p', { class: 'guide-intro' }, 'いちばん早いのはMinecraftの', strong('パックフォルダーを開く'), 'ボタンです。パスが必要なときはこちら：'),
        el(
          'table',
          { class: 'paths-table' },
          el('thead', null, el('tr', null, el('th', { scope: 'col' }, '対象'), el('th', { scope: 'col' }, '場所'))),
          el(
            'tbody',
            null,
            el('tr', null, el('th', { scope: 'row' }, 'Java版（Windows）'), el('td', null, code('%APPDATA%\\.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java版（macOS）'), el('td', null, code('~/Library/Application Support/minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java版（Linux）'), el('td', null, code('~/.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'ゲームファイル（.jar）'), el('td', null, code('.minecraft/versions/<version>/<version>.jar'))),
            el('tr', null, el('th', { scope: 'row' }, '統合版（Windows）'), el('td', null, code('%APPDATA%\\Minecraft Bedrock\\users\\shared\\games\\com.mojang'))),
          ),
        ),
        el('p', { class: 'muted small' }, 'Windowsでは、エクスプローラーのアドレスバーか「ファイル名を指定して実行」（Win + R）にパスを貼り付けます。'),
      ],
    },
  },
  faq: [
    {
      id: 'vanilla-source',
      q: 'バニラのテクスチャはどこから来ていますか？',
      a: [
        p(
          'Java版のプロジェクトを始めると、ブラウザがそのバージョンの公式ゲームファイルをMojangのサーバーから直接ダウンロードし、テクスチャ、モデル、シェーダーだけをこの端末に保存します。統合版のテクスチャは、GitHubにあるMojang公式の',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          'リポジトリから取得します。',
        ),
        p('Texture Pack Maker自体にはMojangのファイルを一切置いていません。独自のサーバーを持たない静的なサイトです。'),
      ],
    },
    {
      id: 'paint-3d',
      q: '平面のテクスチャではなく3Dモデルに描けますか？',
      a: [
        p(
          'はい。テクスチャエディターでキャンバスの上の',
          strong('2D / 3D'),
          '切り替え（またはDキー）を使います。各面は表示しているピクセルそのものを塗るので、回転した面、草ブロックの側面のような重ね部分、点灯・消灯の状態、チェスト、ベッドにも対応します。ペン、消しゴム、塗りつぶし、カラーピッカー（Altクリックでも可）、ブラシサイズ、左右対称が使え、元に戻すはテクスチャごとです。右ドラッグか2本指でモデルを回し、スクロールかピンチでズーム、F・B・L・R・Tキーで各面に移動します。',
        ),
      ],
    },
    {
      id: 'mobs',
      q: 'モブのテクスチャを編集できますか？',
      a: [
        p(
          'はい。テクスチャ一覧で',
          strong('Mobs'),
          'を選ぶか（Blocks · Items · Mobs · All）、entityフォルダーのテクスチャを開きます。モブが3Dで表示され、ブロックと同じように塗れます。横の選択肢（バリエーション、年齢、羊毛の色、職業など）で、そのモブが使うすべてのテクスチャにたどり着けます。羊毛、光る目、村人の服などの重ねパーツは、それぞれのテクスチャに塗ります。Partsの一覧では、部位をクリックで隠して奥を塗り、ダブルクリックでその部位だけ表示、Show allで元に戻せます。統合版のモブは統合版自身のモデルを使い、透明なピクセルに隠された色付け用のマスクも保たれます。',
        ),
      ],
    },
    {
      id: 'gear',
      q: '鞍、防具、馬鎧を編集できますか？',
      a: [
        p(
          'はい。装備できるモブには、選択肢に',
          strong('Wearing'),
          'のグループが出ます。ブタ、ストライダー、ウマ、ラクダ、オウムガイに鞍をつけたり、ゾンビ、スケルトン、ピグリン、防具立てに防具を着せたり（セット全体の素材を選んでから部位ごとにオン・オフでき、革は',
          strong('Dye'),
          'で染められます）、ウマ・オオカミ・オウムガイに鎧、ラマにカーペット、ハッピーガストにハーネスをつけたりできます。身につけたものはそれぞれ専用のテクスチャに塗られ、',
          strong('Parts'),
          'にも項目ができるので、隠して下のモブを塗ることもできます。防具・鞍・カーペットのテクスチャを開くと着た状態で表示され、',
          strong('Used by'),
          'にそれを使うモブが一覧表示されます。古いバージョンでは当時の防具や鞍のテクスチャを使います。',
        ),
        p(
          strong('防具の装飾：'),
          '人型モブに防具を着せたら、Wearingで',
          strong('Trim'),
          'の模様と',
          strong('Material'),
          'を選べます（Java版1.20以降と統合版）。ゲームは灰色の模様を素材のパレットで色づけし、鉄の防具に鉄の装飾のように防具と同じ素材のときは暗めのパレットを使います。装飾はモデルの上で塗るか、模様のテクスチャを開いて塗ります。8つの灰色は装飾の色になり、それ以外の色は塗ったままの色で残ります。素材のパレットを編集するとすべての装飾でその素材の色が変わり、Partsで',
          strong('Trim'),
          'を隠すと下の防具を塗れます。',
        ),
      ],
    },
    {
      id: 'models',
      q: 'ブロックやアイテムの形を変えられますか？（3D の剣など）',
      a: [
        p(
          'はい、Java のパック（Minecraft 1.8 以降）で変えられます。プレビューにブロックかアイテムを表示して ',
          strong('形を編集'),
          ' を押します。モデルエディターには、親モデルをたどって組み立てた、ゲームが使うモデルが開きます。キューブを追加・コピー・削除し、位置とサイズを入力するか 3D の矢印とハンドルをドラッグします。16 × 16 のグリッドかもっと細かい間隔に合わせられ、キューブを 1 つの軸で回転できます（Minecraft 1.21.6 より前は 22.5° 刻み）。',
          strong('面'),
          ' では面ごとにパックのテクスチャ（あとで描く新しいテクスチャも）を選び、表示するテクスチャの範囲をドラッグし、回転、隠れる条件、色付けを設定します。',
          strong('表示'),
          ' ではインベントリ、一人称と三人称、地面、額縁、頭の上での見え方を、それぞれプレビューを見ながら決められます。どの変更も元に戻せます。',
        ),
        p(
          '最初の形には、ゲームのモデル、空のモデル、フルキューブ、ハーフブロック、花のような十字、アイテムなら ',
          strong('スプライトから3Dアイテム'),
          ' を選べます。これは平らな絵を奥行き 1 ピクセルのキューブにして、できるだけ少ない数にまとめます。1.21.4 以降は ',
          strong('インベントリでは平面'),
          ' で、インベントリでは平らなアイコンのまま、手に持つと 3D モデルを表示できます。パックにはモデルファイルが入り、アイテム定義やブロックステートはゲームが必要とするときだけ追加されます。エクスポート時にはバージョンに合わせてモデルをチェックし、開いたパックのモデルファイルもそのまま残して編集できます。統合版では、ブロックの形を変えるにはアドオンが、手に持つアイテムを3Dにするにはアタッチャブル（attachable）ファイルが必要で、どちらもこのエディターでは作れません。出発点として、モデルを Bedrock ジオメトリとしてダウンロードできます。手順は',
          link('/guides/make-3d-items-texture-pack', '3D アイテムの作り方'),
          'で解説しています。',
        ),
      ],
    },
    {
      id: 'pvp',
      q: 'PvPパックやFPSパックは作れますか？',
      a: [
        p(
          'はい。パックを作るときに', strong('PvP／FPSパック'), 'を選ぶと、低い炎、透明なガラスと板ガラス、カボチャの視界なし、小さな照準、小さい剣、低い盾が、バージョンにあるぶんだけオンになります。', strong('PvP'), 'タブにはそれぞれのスイッチがあり、炎の高さ、5種類の照準や自分で描く照準、剣の大きさを選べます。FPS向けには8×テクスチャとアニメーションなしもあります。どの設定もバージョンに合ったふつうのパックファイル（Java版1.6.1〜26.3、1.8.9のファイル名にも対応）を書き込み、オフにしたり元に戻したりできます。統合版では透明なガラス、カボチャ、照準、8×テクスチャが使えますが、炎と手に持ったアイテムはパックでは変えられません。ズーム、FPS表示、霧を消すにはMODが必要です。手順はこちら：',
          link('/guides/make-a-pvp-texture-pack', 'PvPテクスチャパックの作り方'),
          '。',
        ),
      ],
    },
    {
      id: 'fonts',
      q: 'Minecraft のフォントを変えられますか？',
      a: [
        p(
          'はい、', link('/font-maker', 'フォント作成'), 'で変えられます。文字を 1 ピクセルずつ描くか、組み込みのスタイルから始めるか、TTF・OTF・WOFF フォントをピクセルに変換して、チャット・看板・本で確かめます。Java版 1.13 以降には描いた文字だけを置き換える ', code('font/default.json'), ' が入り（TrueType ファイルも入れられます）、Java版 1.6.1〜1.12.2 には ', code('textures/font/ascii.png'), '、統合版には ', code('font/default8.png'), ' とグリフページが入ります。Java版で文字が変わらないときは、設定 › 言語設定の「Unicodeフォントを強制する」をオフにしてください。',
        ),
      ],
    },
    {
      id: 'sounds',
      q: 'パックのサウンドを変えられますか？',
      a: [
        p('はい。テクスチャパックエディターで、Blocks · Items · Mobs · All の切り替えの最後にある音符を押します。名前やカテゴリでサウンドを探し、再生ボタンで聴けます。開いたら ', strong('Replace'), ' で自分の音声ファイル（MP3、WAV、OGG、M4A など）に置き換えるか、マイクで録音します。波形のハンドルをドラッグして切り取り、音量を調整するか ', strong('Normalise'), ' を押し、Reset でゲームのサウンドに戻せます。置き換えたサウンドは Ogg Vorbis で保存され、パックと一緒に書き出されます。Java 版は ', code('assets/minecraft/sounds'), '、統合版は ', code('sounds/'), ' に入り、', code('sound_definitions.json'), ' に対応する項目が追加されます。'),
        p('録音では Start を押したときだけマイクの許可を求めます。ブロックされている場合は、アドレスバーのアイコンからこのサイトのマイクを許可してください。録音がデバイスの外に出ることはありません。ほとんどのサウンドはモノラルにすると、ワールド内の発生場所から聞こえます。ステレオは音楽やメニューの音に使いましょう。Java 版のゲームサウンドは Mojang のサーバーから直接再生され、Web ページから音声データを読めないため、聴くことはできますが、切り取れるのはアップロードまたは録音したサウンドだけです。サウンド編集は Java 1.7.10 以降と統合版で使えます。'),
      ],
    },
    {
      id: 'hd-skins',
      q: '128×128のHDスキンは作れますか？',
      a: [
        p('はい、統合版（Bedrock Edition）向けに作れます。HDスキンは通常のスキン（64×64）の2倍のピクセル（128×128）があるので、顔や陰影、模様をより細かく描けます。スキンエディターで新しく始めるときに', strong('サイズ'), 'で', strong('HD 128×128'), 'を選ぶか、エディターで', strong('サイズ'), ' › ', strong('HD 128'), 'に切り替えます。すべてのピクセルが2倍になるだけなので、描き足すまで見た目は変わりません。更衣室で読み込むなら', strong('統合版スキン（.png）'), '、スキンパックなら', strong('統合版スキンパック（.mcpack）'), 'を書き出します。1つのスキンパックに通常のスキンとHDスキンを混ぜても大丈夫です。'),
        p('Java版はMODなしでは64×64のスキンしか使えないため、Java用の書き出しでは64×64のコピー（2×2のブロックを1ピクセルにしたもの）を作り、HDの元データはそのまま残します。CustomSkinLoaderなどのHDスキンMODを使う場合は', strong('MOD用の128×128'), 'を選んでください。家庭用ゲーム機ではスキンファイルを読み込めず、128×128より大きいサイズには対応していません。HDスキンはトーテム作成でも使えます。'),
      ],
    },
    {
      id: 'poses',
      q: 'スキンにポーズをとらせて画像を保存できますか？',
      a: [
        p('はい。スキンエディターの3Dプレビューの下にある', strong('ポーズと画像'), 'を押します。12種類のポーズ（立つ、歩く、走る、手を振る、座る、スニーク、飛ぶ、Tポーズ、バンザイ、ダブ、構え、指さし）から選ぶか、', strong('調整'), 'で頭・体・両腕・両脚をスライダーで動かします。部位ごとにリセットできます。', strong('シーン'), 'ではカメラの角度、ズーム、背景（', strong('透明'), 'も可）と、', link('/cape-maker', 'マント作成ツール'), 'で作ったマントかエリトラを選べます。', strong('画像を保存'), 'で1×・2×・4×のPNGを作ります。モデルをドラッグするとカメラが回り、スクロールかピンチでズームします。'),
      ],
    },
    {
      id: 'capes',
      q: '自作のマントは作れますか？',
      a: [
        p('デザインは', link('/cape-maker', 'マント作成ツール'), 'でできます。3Dプレビューを見ながら64×32のマントテクスチャに描き、PNGをダウンロードします。どこで表示されるかはゲーム次第です。Java版で表示されるのはMojangの公式マントだけなので、自作のマントには独自のマントサービスを持つMODかクライアントが必要で、見えるのは同じMODを使うプレイヤーだけです。統合版のマントはキャラクタークリエイターのアイテムで、Mojang自身のパックチェッカーはMojang以外のスキンパックに入ったマントをエラーにするため、スキンパック作成ツールにはマントを入れていません。'),
        p('MODなしで使えるのはエリトラです。マント作成ツールではエリトラのテクスチャパック（Java版1.9以降か統合版）もダウンロードでき、パックを使う全員にデザインが表示されます。マントを着けているプレイヤーのエリトラには、そのマントのデザインが表示されます。'),
      ],
    },
    {
      id: 'upload',
      q: '何かアップロードされますか？',
      a: [p('いいえ。プロジェクト、画像、書き出したパックが端末の外に出ることはありません。アプリはダウンロードだけを行います：Mojangのゲームファイル、バージョン一覧、ユーザー名で検索したスキンです。')],
    },
    {
      id: 'offline',
      q: 'オフラインでも使えますか？',
      a: [p('はい、一度読み込んだあとは使えます。アプリと、これまでに開いたバージョンはこの端末に残るので、インターネットなしで編集を続けられます。まだ使っていないバージョンには接続が必要です。または', strong('Use my own .jar'), 'を選び、', code('.minecraft/versions'), 'フォルダーから選んでください。')],
    },
    {
      id: 'storage',
      q: 'プロジェクトはどこに保存されますか？',
      a: [p('この端末のブラウザのストレージです。削除するか、このサイトのデータを消すまで残ります。バックアップや別のパソコンへの移動には、書き出したファイルを移動先で', strong('パックを開く'), 'から開いてください。')],
    },
    {
      id: 'versions',
      q: '対応しているMinecraftのバージョンは？',
      a: [p(`標準はJava版${LATEST}で、1.6.1（リソースパックが導入されたバージョン）までのすべてのJava版に対応しています。設定でスナップショットも使えます。統合版は最新リリース、最新プレビュー、それ以前のバージョンを使えます。`)],
    },
    {
      id: 'pack-format',
      q: `Minecraft Java版${LATEST}のリソースパックのフォーマットは？`,
      a: [
        p(
          `Java版${LATEST}のリソースパックのフォーマットは${F(LATEST)}です。${LATEST}専用のパックは`,
          code('pack.mcmeta'),
          'に',
          code(`"min_format": ${minFormat(LATEST)}`),
          'と',
          code(`"max_format": ${maxFormat(LATEST)}`),
          'を書きます。Texture Pack Makerがこれらの項目を自動で書き込みます。',
          link('/guides/minecraft-pack-format-versions', '全Java版のフォーマット'),
          'もご覧ください。',
        ),
      ],
    },
    {
      id: 'java-vs-bedrock',
      q: 'Java版と統合版のパックの違いは？',
      a: [
        p(
          'Java版のパックは、',
          code('pack.mcmeta'),
          'ファイルと',
          code('assets/minecraft/textures/'),
          'に置いたPNGテクスチャを含む',
          code('.zip'),
          'です。統合版のパックは、',
          code('manifest.json'),
          'と',
          code('textures/'),
          'に置いたテクスチャ（PNGかTGA）を含む',
          code('.mcpack'),
          'です。どちらのエディションも、もう一方のパックは読み込めません。',
          link('/guides/java-vs-bedrock-packs', '詳しい比較'),
          '。',
        ),
      ],
    },
    {
      id: 'no-mods',
      q: 'MODなしでシェーダーを作れますか？',
      a: [
        p(
          `はい。Java版1.17以降では、リソースパックでMinecraft自身のシェーダーを変えられます（色、ビネット、霧、${LATEST}ではブルームも）。統合版では、バイブラントビジュアルズのパックで組み込みのライティング、空、霧、水を変えられます。Java版で本物の影や反射を出すには、今もIrisかOptiFineが必要です。`,
          link('/guides/make-shaders-without-mods', '仕組みを見る'),
          '。',
        ),
      ],
    },
    {
      id: 'phone',
      q: 'スマホやタブレットでも使えますか？',
      a: [p('はい。すべてのツールがタッチ操作に対応し、ピクセルエディターではピンチでズームできます。細かいドット絵を描くなら大きめの画面のほうが快適です。')],
    },
    {
      id: 'official',
      q: '無料ですか？公式のものですか？',
      a: [p('無料で、MITライセンスのオープンソースです。'), p('Texture Pack MakerはMinecraftの公式製品ではなく、Mojang・Microsoftの承認を受けておらず、両社とは関係ありません。')],
    },
    {
      id: 'bug',
      q: '不具合が起きました。どう報告すればいいですか？',
      a: [p(ext(`${REPO_URL}/issues`, 'GitHub'), 'でissueを作成し、使っているブラウザ、ゲームのバージョン、何をしていたかを書いてください。スクリーンショットがあるととても助かります。')],
    },
  ],
  quick: { 'java-packs': 'テクスチャパックを入れる', 'java-skins': 'スキンを変える', iris: 'シェーダーパックを使う', faq: 'よくある質問' },
  toc: {
    title: 'このページの内容',
    textures: 'テクスチャパック',
    skins: 'スキン',
    shaders: 'シェーダー',
    more: 'その他',
    irisOptifine: 'Iris / OptiFine',
    vanilla: 'バニラ（MODなし）',
    vibrant: 'バイブラントビジュアルズ',
    folders: 'フォルダー',
    faq: 'よくある質問',
    allGuides: 'すべてのガイド',
  },
  bothEditions: 'Java版・統合版',
  eyebrow: '導入ガイドとヘルプ',
  title: 'テクスチャパック・スキン・シェーダーの入れ方',
  lead: '作ったものをMinecraftに入れましょう。PC、Mac、スマホ、ゲーム機のJava版と統合版それぞれの手順と、よくある質問への答えをまとめました。',
  faqTitle: 'よくある質問',
};
