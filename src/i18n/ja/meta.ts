// Japanese page titles, descriptions and short names (see MetaTranslation in src/app/seo/meta.ts).
// Bedrock Edition is "統合版" in Japan; titles name both so searches for either find the page.

import type { MetaTranslation } from '../../app/seo/meta';
import { F, LATEST } from '../../app/content/facts';

export const META_JA: MetaTranslation = {
  pages: {
    '/': {
      title: 'マイクラ テクスチャパック作成ツール｜無料・Java版/統合版',
      description: `Minecraftのテクスチャパックを数分で作成。本物の3Dモデルにブロックを描き、ワンクリックで雰囲気を変え、.zip/.mcpackで書き出し。無料・登録不要、Java版${LATEST}対応。`,
      label: 'ホーム',
    },
    '/textures': {
      title: 'テクスチャパック エディター｜リソースパック作成（Java/統合版）',
      description: 'Minecraftのあらゆるテクスチャを編集。ブロック・アイテム・モブを3Dモデル上で塗り、PNGを読み込み、ワンクリックで全体を変更して.zip/.mcpackで書き出せます。',
      label: 'テクスチャパック',
    },
    '/texture-pack-converter': {
      title: 'テクスチャパック変換ツール｜Java版⇔統合版（Bedrock）',
      description: 'MinecraftのテクスチャパックをJava版から統合版へ、統合版からJava版へ、Java版のバージョン間で変換。PNGを.mcpackにもできます。ブラウザで無料。',
      label: 'テクスチャパック変換',
    },
    '/merge-texture-packs': {
      title: 'テクスチャパックを結合｜マイクラ Java版・統合版対応',
      description: '複数のMinecraftテクスチャパックを1つの.zip/.mcpackにまとめます。ゲームと同じく、並べた順で上のパックが優先。ブラウザで無料で使えます。',
      label: 'テクスチャパックを結合',
    },
    '/skins': {
      title: 'マイクラ スキンエディター＆スキンパック作成',
      description: 'Minecraftのスキンを2Dや3Dで描いて作成。クラシック/スリムの腕に対応し、Java版用PNGや統合版のスキンパック（.mcpack）で書き出せます。無料。',
      label: 'スキン',
    },
    '/skin-pack-maker': {
      title: 'マイクラ スキンパック作成｜統合版.mcpackを無料で',
      description: 'Minecraftのスキンパックをブラウザで作成。スキンを描くか読み込み、クラシックとスリムを混ぜて、統合版でそのまま開ける.mcpackをダウンロード。無料。',
      label: 'スキンパック作成',
    },
    '/shaders': {
      title: 'マイクラ シェーダー作成｜Iris・OptiFine・MODなし',
      description: 'Iris/OptiFine用シェーダーパック、MODなしで動くJava版バニラシェーダー、統合版のバイブラントビジュアルズ用パックを、プリセットと3Dプレビューで作成。',
      label: 'シェーダー',
    },
    '/help': {
      title: 'テクスチャパック・スキン・シェーダーの入れ方',
      description: 'MinecraftのJava版と統合版で、テクスチャパック・スキン・シェーダーを入れる方法。PC・Mac・スマホ・ゲーム機別の手順、resourcepacksフォルダーの場所、よくあるエラーの直し方。',
      label: 'ヘルプ',
    },
    '/about': {
      title: 'Texture Pack Makerについて｜無料・オープンソース',
      description: 'Texture Pack Makerの作者、ほかとの違い（1.6.1以降の全Java版、統合版、変換ツール、オープンソース）と、作品を外に送らない仕組みを紹介します。',
      label: 'このサイトについて',
    },
    '/guides': {
      title: 'マイクラ テクスチャパック・スキン・シェーダーのガイド',
      description: `Minecraftのテクスチャパック、スキン、シェーダーの作り方と入れ方を手順つきで解説。1.6.1から${LATEST}までの全Java版のパックフォーマットも掲載。`,
      label: 'ガイド',
    },
  },
  guides: {
    'make-a-texture-pack': {
      title: 'マイクラ テクスチャパックの作り方（Java版・統合版）',
      h1: 'Minecraftのテクスチャパックの作り方',
      description: '自作テクスチャパックを無料で作る手順。バージョンを選び、テクスチャを描き、pack.mcmeta入りの.zip（Java版）か.mcpack（統合版）で書き出して導入します。',
      label: 'テクスチャパックを作る',
      blurb: 'バージョンを選び、テクスチャを描き、Minecraftで読み込めるパックを書き出す。',
    },
    'install-resource-packs': {
      title: 'テクスチャパックの入れ方（Java版・統合版）',
      h1: 'Minecraftにテクスチャパック・シェーダー・.mcpackを入れる方法',
      description: 'Java版でのリソースパックの導入、PCやスマホでの統合版.mcpackのインポート、IrisやOptiFineでのシェーダー導入、表示されないパックの直し方。',
      label: 'パックとシェーダーの入れ方',
      blurb: 'Java版のリソースパック、統合版の.mcpack、シェーダーパックの入れ方と対処法。',
    },
    'texture-pack-not-working': {
      title: 'テクスチャパックが反映されない？原因と直し方',
      h1: 'Minecraftのテクスチャパックが反映されないときの直し方',
      description: '一覧に出ない、「旧バージョン向けに制作」、紫と黒のブロック、草が灰色、.mcpackのインポート失敗。それぞれの原因と直し方をまとめました。',
      label: 'パックが反映されない時',
      blurb: '一覧に出ない、バージョン警告、紫と黒のブロックなどの直し方。',
    },
    'minecraft-pack-format-versions': {
      title: `マイクラ パックフォーマット一覧（${LATEST}は${F(LATEST)}）`,
      h1: `Java版全バージョンのパックフォーマット（${LATEST}は${F(LATEST)}）`,
      description: `1.6.1から${LATEST}までのMinecraft Java版と、それぞれのリソースパックのフォーマット番号（${LATEST}は${F(LATEST)}）。pack.mcmetaの書き方の移り変わりも解説。`,
      label: 'バージョン別パックフォーマット',
      blurb: `1.6.1から${LATEST}までのJava版のパックフォーマット。`,
    },
    'make-a-skin': {
      title: 'マイクラ スキンの作り方（Java版・統合版）',
      h1: 'Minecraftのオリジナルスキンの作り方',
      description: 'Minecraftのスキンをブラウザで無料作成。64×64のテンプレートを2Dや3Dで塗り、クラシックかスリムを選んで、Java版に登録するか統合版のスキンパックにします。',
      label: 'スキンを作る',
      blurb: '64×64のテンプレートを塗り、Java版や統合版のスキンパックで使う。',
    },
    'make-shaders-without-mods': {
      title: 'MODなし・OptiFineなしで使えるマイクラのシェーダー',
      h1: 'MODなしでMinecraftにシェーダーは入れられる？',
      description: 'できます。Java版1.17以降はリソースパックでゲームのシェーダーを差し替えられ（OptiFine・Iris不要）、統合版にはバイブラントビジュアルズがあります。できることと限界を解説。',
      label: 'MODなしのシェーダー',
      blurb: 'Java版のバニラシェーダーと統合版のバイブラントビジュアルズでできること。',
    },
    'java-vs-bedrock-packs': {
      title: 'Java版と統合版のテクスチャパックの違い',
      h1: 'Java版と統合版（Bedrock）のテクスチャパックの違いと変換方法',
      description: 'Java版のテクスチャパックは統合版で使える？使えません。Java版は.zip＋pack.mcmeta、統合版は.mcpack＋manifest.json。フォルダー、ファイル名、シェーダー、スキンを比較。',
      label: 'Java版と統合版のパック',
      blurb: 'ファイル、フォルダー、形式、シェーダー、スキンを並べて比較。',
    },
  },
};
