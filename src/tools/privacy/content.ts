// The privacy policy: nothing uploaded, no accounts, no tracking, what stays on the device and
// which other services the browser talks to. Prerendered at build time, rendered to DOM by
// privacy.ts. A translation fills in the same PrivacyText (src/i18n/<lang>/privacy.ts).

import { el, ic, type Child, type ElNode } from '../../app/markup';
import { breadcrumbs, code, ext, link, strong } from '../../app/content/blocks';
import { PRIVACY_META, pageMeta } from '../../app/seo/meta';
import { PUBLISHER, REPO_URL, SITE_NAME } from '../../app/site';
import type { Locale } from '../../i18n/locales';
import { ui } from '../../i18n/ui';
import { contentOf } from '../../i18n/content';

/** When the policy last changed (shown on the page). */
export const PRIVACY_UPDATED = '2026-10-20';

interface Section {
  id: string;
  title: string;
  body: Child[][];
}

export interface PrivacyText {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: Section[];
}

export const PRIVACY_EN: PrivacyText = {
  eyebrow: 'Privacy',
  title: 'Privacy policy',
  intro: `${SITE_NAME} is built so that your work never leaves your device. There are no accounts, no ads and no tracking. This page explains what that means in practice, for the website and for the installed app.`,
  updated: 'Last updated',
  sections: [
    {
      id: 'nothing-uploaded',
      title: 'Nothing you make is uploaded',
      body: [
        [
          'Every tool runs in your browser. The packs, skins, shaders and images you open, edit and export are handled on your device and are not sent to this site or to anyone else. Exports (',
          code('.zip'),
          ', ',
          code('.mcpack'),
          ', ',
          code('.png'),
          ') are built on your device and saved straight to your downloads.',
        ],
      ],
    },
    {
      id: 'no-tracking',
      title: 'No accounts, ads or tracking',
      body: [
        ['There is no sign-up or login. The site has no ads, no analytics, no tracking cookies and no third-party trackers. No personal information is collected, sold or shared.'],
      ],
    },
    {
      id: 'on-your-device',
      title: 'What is kept on your device',
      body: [
        [
          strong('Your projects'),
          ' are saved in your browser’s storage (IndexedDB) so you can come back to them. ',
          strong('Game files'),
          ' you downloaded are kept there too, so the tools work offline. ',
          strong('Settings'),
          ' such as the light or dark theme are kept in local storage, and the app’s own files are cached so it opens without a connection.',
        ],
        ['All of this stays on your device. Deleting a project in the app removes it. To remove everything, clear this site’s data in your browser’s settings, or uninstall the app.'],
      ],
    },
    {
      id: 'other-services',
      title: 'Services your browser connects to',
      body: [
        [
          'When you pick a game version, your browser downloads that version’s files directly from Mojang (',
          code('piston-meta.mojang.com'),
          ', ',
          code('piston-data.mojang.com'),
          ', ',
          code('resources.download.minecraft.net'),
          '). Bedrock files come from Mojang’s ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' repository through GitHub and jsDelivr, and the list of Java versions from jsDelivr.',
        ],
        ['If you look up a player’s skin by name, that name is sent to playerdb.co (or mc-heads.net) to find the skin, which then loads from textures.minecraft.net.'],
        ['These services receive ordinary request details such as your IP address, as with any website, and have their own privacy policies. Nothing you made is sent to them.'],
      ],
    },
    {
      id: 'hosting',
      title: 'Hosting',
      body: [
        [
          'The site is hosted on GitHub Pages. GitHub may log technical details such as IP addresses to run and protect its service; see the ',
          ext('https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement', 'GitHub privacy statement'),
          '.',
        ],
      ],
    },
    {
      id: 'app',
      title: 'The installed app',
      body: [['The app you install from your browser or from the Microsoft Store is this same website in its own window. Everything on this page applies to it in the same way.']],
    },
    {
      id: 'children',
      title: 'Children',
      body: [[`${SITE_NAME} does not collect personal information from anyone, including children.`]],
    },
    {
      id: 'contact',
      title: 'Changes and questions',
      body: [
        ['If this policy changes, this page will be updated with a new date.'],
        [`${SITE_NAME} is made by ${PUBLISHER.name}. Questions are welcome as an issue on `, ext(`${REPO_URL}/issues`, 'GitHub'), '. More about the project is on the ', link('/about', 'About page'), '.'],
      ],
    },
  ],
};

/** The policy's texts in a language. */
export function privacyText(locale: Locale = 'en'): PrivacyText {
  return locale === 'en' ? PRIVACY_EN : (contentOf(locale).privacy ?? PRIVACY_EN);
}

export function privacyPage(locale: Locale = 'en'): ElNode {
  const t = privacyText(locale);
  const u = ui(locale);
  const meta = pageMeta(PRIVACY_META.path, locale) ?? PRIVACY_META;
  return el(
    'article',
    { class: ['guide-page', 'privacy-page', 'container', 'accent-green'], 'aria-labelledby': 'privacy-title' },
    breadcrumbs([{ label: u.home, to: '/' }, { label: meta.label }], u.breadcrumb),
    el(
      'header',
      { class: 'guide-hero' },
      el('span', { class: 'eyebrow' }, ic('lock'), t.eyebrow),
      el('h1', { id: 'privacy-title', class: 'pixel-shadow' }, t.title),
      el('div', { class: 'guide-intro-text lead' }, el('p', null, t.intro)),
      el('p', { class: 'faint small' }, `${t.updated}: `, el('time', { datetime: PRIVACY_UPDATED }, PRIVACY_UPDATED)),
    ),
    el(
      'div',
      { class: 'guide-layout' },
      el(
        'div',
        { class: 'guide-body' },
        t.sections.map((s) =>
          el('section', { class: 'guide-section', id: s.id, 'aria-labelledby': `${s.id}-title` }, el('h2', { id: `${s.id}-title` }, s.title), s.body.map((p) => el('p', null, p))),
        ),
      ),
    ),
  );
}
