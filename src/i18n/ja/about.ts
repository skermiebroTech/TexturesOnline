// Japanese About page (see AboutText in src/tools/about/content.ts).

import { el } from '../../app/markup';
import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL } from '../../app/site';
import { F, LATEST } from '../../app/content/facts';
import type { AboutText } from '../../tools/about/content';

export const ABOUT: AboutText = {
  differences: [
    {
      title: '1.6.1以降のすべてのJava版',
      text: [`最新版だけではありません。${LATEST}、1.21.11、1.20.1、1.8.9などのパックを、それぞれのテクスチャと正しいpack.mcmetaで作れます。`],
    },
    {
      title: 'Java版と統合版、そして変換ツール',
      text: ['どちらのエディション用のパックも作れて、', link('/texture-pack-converter', 'テクスチャパック変換ツール'), 'でJava版のパックを統合版用に、またはその逆に変換できます。'],
    },
    {
      title: 'テクスチャ、スキン、シェーダー',
      text: ['テクスチャパック、スキンとスキンパック、そしてIris・OptiFine・Java版バニラ・統合版バイブラントビジュアルズ用のシェーダーを、ひとつのサイトで。'],
    },
    {
      title: 'アップロードなし',
      text: ['すべてブラウザ内で動きます。ゲームのファイルはMojangから直接届き、作品はあなたの端末に残ります。'],
    },
    {
      title: '無料・オープンソース',
      text: ['アカウントなし、広告なし、有料プランなし。コードはMITライセンスで', ext(REPO_URL, 'GitHub'), 'に公開しています。'],
    },
    {
      title: 'オフライン対応',
      text: ['一度開けば、アプリと使ったゲームファイルが端末に保存されるので、接続がなくても使い続けられます。'],
    },
  ],
  faq: [
    {
      id: 'who',
      q: 'Texture Pack Makerは誰が作っていますか？',
      a: [el('p', null, `Texture Pack Makerは、個人クリエイターの${PUBLISHER.name}が作っています。ファンによるツールで、Mojang・Microsoftとは関係ありません。`)],
    },
    {
      id: 'cost',
      q: 'お金はかかりますか？',
      a: [el('p', null, 'かかりません。すべてのツールが無料で、アカウントも広告もなく、作れるパックの数にも制限はありません。')],
    },
    {
      id: 'files',
      q: 'Minecraftのテクスチャはどこから来ていますか？',
      a: [
        el(
          'p',
          null,
          'バージョンを選ぶと、ブラウザがMojangからダウンロードします。Java版のテクスチャは公式のゲームファイルから、統合版のテクスチャはMojangの',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          'リポジトリからです。テクスチャはあなたの端末に保存され、このサイトに置かれることはありません。',
        ),
      ],
    },
    {
      id: 'contact',
      q: '不具合の報告や機能の提案はどうすればいいですか？',
      a: [el('p', null, ext(`${REPO_URL}/issues`, 'GitHub'), 'でissueを作成してください。使っていたツール、エディション、バージョンも書いてください。')],
    },
  ],
  eyebrow: 'このサイトについて',
  title: 'Texture Pack Makerについて',
  intro: `Texture Pack Makerは、Minecraftのテクスチャパック、スキン、シェーダーをブラウザで作れる無料・オープンソースのサイトです。Java版（${LATEST}と1.6.1までの全バージョン）と統合版に対応しています。作っているのは${PUBLISHER.name}です。`,
  differentTitle: 'Texture Pack Makerのここが違う',
  toolsTitle: 'ツール',
  tools: [
    [link('/textures', 'テクスチャパック作成'), '：ブロック、アイテム、モブを3Dモデル上で描き直したり、自分の画像を読み込んだり、ワンクリックでパック全体の雰囲気を変えたり、既存のパックを開いたりできます。'],
    [link('/texture-pack-converter', 'テクスチャパック変換'), '：Java版から統合版、統合版からJava版、Java版のバージョン間、PNGテクスチャから.mcpackへ。'],
    [link('/merge-texture-packs', 'テクスチャパックを結合'), '：最大8個のパックを、好きな順番で1つにまとめます。'],
    [link('/skins', 'スキンエディター'), 'と', link('/skin-pack-maker', 'スキンパック作成'), '：クラシックやスリムの腕のスキンを2D・3Dで描き、統合版のスキンパックにまとめます。'],
    [link('/shaders', 'シェーダー作成'), '：Iris・OptiFine用のシェーダーパック、MODなしで動くJava版バニラシェーダー、統合版のバイブラントビジュアルズ用パック。'],
    [link('/guides', 'ガイド'), '：パックの作り方・入れ方・直し方と、全Java版のパックフォーマット。'],
  ],
  howTitle: '仕組み',
  how: [
    'ゲームのバージョンを選ぶと、ブラウザがそのバージョンのテクスチャをMojangから直接ダウンロードし、あなたの端末に保存します。プロジェクトもブラウザ内（IndexedDB）に保存され、書き出しも端末上で行われます。Java版なら正しい',
    code('pack.mcmeta'),
    `つきの`,
    code('.zip'),
    `（Java版${LATEST}のパックフォーマットは${F(LATEST)}）、統合版なら`,
    code('manifest.json'),
    'つきの',
    code('.mcpack'),
    'です。作ったものがサーバーに送られることはありません。',
  ],
  makerTitle: '作っている人',
  maker: ['Texture Pack Makerは', strong(PUBLISHER.name), 'が作っています。ソースコードは公開されているので、誰でも仕組みを確認したり、変更を提案したり、問題を報告したりできます。'],
  notOfficial: 'Minecraftの公式製品ではありません。Mojang・Microsoftの承認を受けておらず、両社とは関係ありません。',
  questions: 'よくある質問',
};
