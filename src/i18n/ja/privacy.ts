// Japanese privacy policy (see PrivacyText in src/tools/privacy/content.ts).

import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL, SITE_NAME } from '../../app/site';
import type { PrivacyText } from '../../tools/privacy/content';

export const PRIVACY: PrivacyText = {
  eyebrow: 'プライバシー',
  title: 'プライバシーポリシー',
  intro: `${SITE_NAME}は、あなたの作品が端末の外に出ないように作られています。アカウントも広告もトラッキングもありません。このページでは、それが実際にどういうことなのかを、ウェブサイトとインストールしたアプリの両方について説明します。`,
  updated: '最終更新日',
  sections: [
    {
      id: 'nothing-uploaded',
      title: '作ったものはアップロードされません',
      body: [
        [
          'すべてのツールはブラウザの中で動きます。開いたり編集したり書き出したりするパック、スキン、シェーダー、画像はあなたの端末で処理され、このサイトにもほかの誰にも送られません。書き出したファイル（',
          code('.zip'),
          '、',
          code('.mcpack'),
          '、',
          code('.png'),
          '）は端末の中で作られ、そのままダウンロードフォルダに保存されます。',
        ],
      ],
    },
    {
      id: 'no-tracking',
      title: 'アカウント・広告・トラッキングなし',
      body: [
        ['会員登録もログインもありません。広告、トラッキング用Cookie、第三者のトラッカーは一切使っていません。個人情報を集めたり、売ったり、共有したりすることはありません。'],
        [
          'どのページやツールが使われているかを知るために、',
          ext('https://www.cloudflare.com/web-analytics/', 'Cloudflare Web Analytics'),
          'で訪問数を数えています。Cookieは使わず、ほかのサイトをまたいで追跡したり、あなたのプロフィールを作ったりはしません。記録するのは、見たページ、どのサイトから来たか、国、ブラウザと端末の種類だけです。あなたが作ったものが含まれることはありません。',
        ],
      ],
    },
    {
      id: 'on-your-device',
      title: '端末に保存されるもの',
      body: [
        [
          strong('プロジェクト'),
          'は、あとで続きができるようにブラウザのストレージ（IndexedDB）に保存されます。ダウンロードした',
          strong('ゲームファイル'),
          'もそこに保存され、オフラインでもツールが使えます。ライト／ダークテーマなどの',
          strong('設定'),
          'はローカルストレージに保存され、アプリ自体のファイルも接続なしで開けるようにキャッシュされます。',
        ],
        ['これらはすべて端末の中に残ります。アプリでプロジェクトを削除すると消えます。すべて消すには、ブラウザの設定でこのサイトのデータを削除するか、アプリをアンインストールしてください。'],
      ],
    },
    {
      id: 'other-services',
      title: 'ブラウザが接続するサービス',
      body: [
        [
          'ゲームのバージョンを選ぶと、ブラウザがそのバージョンのファイルをMojangから直接ダウンロードします（',
          code('piston-meta.mojang.com'),
          '、',
          code('piston-data.mojang.com'),
          '、',
          code('resources.download.minecraft.net'),
          '）。統合版のファイルはMojangの',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          'リポジトリからGitHubとjsDelivr経由で、Java版のバージョン一覧はjsDelivrから取得します。',
        ],
        ['プレイヤー名でスキンを探すと、その名前がスキンを見つけるためにplayerdb.co（またはmc-heads.net）に送られ、スキン自体はtextures.minecraft.netから読み込まれます。'],
        ['これらのサービスは、どのウェブサイトとも同じように、IPアドレスなど通常のリクエスト情報を受け取ります。それぞれに独自のプライバシーポリシーがあります。あなたが作ったものが送られることはありません。'],
      ],
    },
    {
      id: 'hosting',
      title: 'ホスティング',
      body: [
        [
          'このサイトはGitHub Pagesでホストされています。GitHubはサービスの運営と保護のためにIPアドレスなどの技術情報を記録することがあります。詳しくは',
          ext('https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement', 'GitHubのプライバシーステートメント'),
          'をご覧ください。',
        ],
      ],
    },
    {
      id: 'app',
      title: 'インストールしたアプリ',
      body: [['ブラウザやMicrosoft Storeからインストールするアプリは、このウェブサイトそのものを専用のウィンドウで開いたものです。このページの内容はすべて、アプリにも同じように当てはまります。']],
    },
    {
      id: 'children',
      title: 'お子さまについて',
      body: [[`${SITE_NAME}は、お子さまを含め、誰からも個人情報を集めていません。`]],
    },
    {
      id: 'contact',
      title: '変更とお問い合わせ',
      body: [
        ['このポリシーを変更したときは、新しい日付でこのページを更新します。'],
        [`${SITE_NAME}は${PUBLISHER.name}が作っています。質問は`, ext(`${REPO_URL}/issues`, 'GitHub'), 'のissueでお気軽にどうぞ。プロジェクトについては', link('/about', 'このサイトについて'), 'のページをご覧ください。'],
      ],
    },
  ],
};
