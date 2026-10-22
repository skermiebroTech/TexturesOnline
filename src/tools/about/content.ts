// The About page (who makes the site, what it does differently, privacy and how it works) and the
// short list of differences reused on the home page. Prerendered at build time, rendered to DOM by
// about.ts. The English text is ABOUT_EN; translations fill in the same AboutText
// (src/i18n/<lang>/about.ts).

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../../app/markup';
import { breadcrumbs, code, ext, faqList, link, strong, type FaqItem } from '../../app/content/blocks';
import { ABOUT_META, pageMeta } from '../../app/seo/meta';
import { PUBLISHER, REPO_URL, SITE_NAME, SOCIAL_PROFILES } from '../../app/site';
import { F, LATEST } from '../../app/content/facts';
import type { Locale } from '../../i18n/locales';
import { ui } from '../../i18n/ui';
import { contentOf } from '../../i18n/content';

interface Difference {
  title: string;
  text: Child[];
}

type Six<T> = [T, T, T, T, T, T];
type Ten<T> = [T, T, T, T, T, T, T, T, T, T];

/** Every text on the About page (and the differences on the home page). */
export interface AboutText {
  differences: Six<Difference>;
  faq: FaqItem[];
  eyebrow: string;
  title: string;
  intro: string;
  differentTitle: string;
  toolsTitle: string;
  /** One list item per tool, links included */
  tools: Ten<Child[]>;
  howTitle: string;
  how: Child[];
  makerTitle: string;
  maker: Child[];
  notOfficial: string;
  questions: string;
}

const DIFFERENCE_ICONS: Six<IconName> = ['clock', 'repeat', 'sparkles', 'lock', 'code', 'cloud'];

export const ABOUT_EN: AboutText = {
  differences: [
    {
      title: 'Every Java version since 1.6.1',
      text: [`Not just the latest: make a pack for ${LATEST}, 1.21.11, 1.20.1 or 1.8.9, each with its own textures and the right pack.mcmeta.`],
    },
    {
      title: 'Java and Bedrock, and a converter',
      text: ['Make packs for either edition, then turn a Java pack into a Bedrock one or back with the ', link('/texture-pack-converter', 'texture pack converter'), '.'],
    },
    {
      title: 'Textures, skins and shaders',
      text: ['One site for texture packs, skins and skin packs, and shaders for Iris, OptiFine, vanilla Java and Bedrock Vibrant Visuals.'],
    },
    {
      title: 'Nothing is uploaded',
      text: ['Everything runs in your browser. Game files come straight from Mojang, and your work stays on your device.'],
    },
    {
      title: 'Free and open source',
      text: ['No account, no ads and no paid tiers. The code is public under the MIT licence on ', ext(REPO_URL, 'GitHub'), '.'],
    },
    {
      title: 'Works offline',
      text: ['After the first visit the app and the game files you used are kept on your device, so it keeps working without a connection.'],
    },
  ],
  faq: [
    {
      id: 'who',
      q: `Who makes ${SITE_NAME}?`,
      a: [el('p', null, `${SITE_NAME} is made by ${PUBLISHER.name}, an independent creator. It is a fan-made tool and is not affiliated with Mojang or Microsoft.`)],
    },
    {
      id: 'cost',
      q: 'Does it cost anything?',
      a: [el('p', null, 'No. Every tool is free, with no account, no ads and no limits on how many packs you make.')],
    },
    {
      id: 'files',
      q: 'Where do the Minecraft textures come from?',
      a: [
        el(
          'p',
          null,
          'Your browser downloads them from Mojang when you pick a version: Java textures from the official game files, Bedrock textures from Mojang’s ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' repository. They are kept on your device and never stored on this site.',
        ),
      ],
    },
    {
      id: 'contact',
      q: 'How do I report a bug or suggest a feature?',
      a: [el('p', null, 'Open an issue on ', ext(`${REPO_URL}/issues`, 'GitHub'), '. Please say which tool, edition and version you were using.')],
    },
  ],
  eyebrow: 'About',
  title: `About ${SITE_NAME}`,
  intro: `${SITE_NAME} is a free, open-source website for making Minecraft texture packs, skins and shaders in the browser, for Java Edition (${LATEST} and every release back to 1.6.1) and Bedrock Edition. It is made by ${PUBLISHER.name}.`,
  differentTitle: `What makes ${SITE_NAME} different`,
  toolsTitle: 'The tools',
  tools: [
    [link('/textures', 'Texture pack maker'), ': repaint any block, item or mob on its 3D model, upload your own images, replace sounds, restyle the whole pack in one click, or open an existing pack.'],
    [link('/texture-pack-converter', 'Texture pack converter'), ': Java to Bedrock, Bedrock to Java, between Java versions, or PNG textures to an .mcpack.'],
    [link('/merge-texture-packs', 'Merge texture packs'), ': combine up to eight packs into one, in the order you choose.'],
    [link('/pack-doctor', 'Pack Doctor'), ': find out why a Java or Bedrock pack doesn’t work in the game, and fix it in one click.'],
    [link('/totem-maker', 'Totem maker'), ': turn any skin into a custom Totem of Undying resource pack for Java or Bedrock.'],
    [link('/font-maker', 'Font maker'), ': draw a pixel font or convert a font file, preview it in chat, signs and books, and download it as a resource pack.'],
    [link('/skins', 'Skin editor'), ' and ', link('/skin-pack-maker', 'skin pack maker'), ': paint skins in 2D or 3D with classic or slim arms, and bundle them into a Bedrock skin pack.'],
    [link('/cape-maker', 'Cape maker'), ': paint a cape and its elytra in 3D on the 64×32 template, then download the PNG or an elytra texture pack.'],
    [link('/shaders', 'Shader maker'), ': Iris and OptiFine shader packs, vanilla Java shaders that need no mods, and Bedrock Vibrant Visuals packs.'],
    [link('/guides', 'Guides'), ': making, installing and fixing packs, and the pack format of every Java version.'],
  ],
  howTitle: 'How it works',
  how: [
    'When you pick a game version, your browser downloads that version’s textures straight from Mojang and keeps them on your device. Your projects are saved in the browser too (IndexedDB), and exports are built on your device: a Java ',
    code('.zip'),
    ' with the right ',
    code('pack.mcmeta'),
    ` (Java ${LATEST} uses pack format ${F(LATEST)}) or a Bedrock `,
    code('.mcpack'),
    ' with a ',
    code('manifest.json'),
    '. Nothing you make is sent to a server.',
  ],
  makerTitle: 'Who makes it',
  maker: [`${SITE_NAME} is made by `, strong(PUBLISHER.name), '. The source code is public, so anyone can see how it works, suggest changes or report problems.'],
  notOfficial: 'Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.',
  questions: 'Questions',
};

/** The About texts of a language. */
export function aboutText(locale: Locale = 'en'): AboutText {
  return locale === 'en' ? ABOUT_EN : (contentOf(locale).about ?? ABOUT_EN);
}

/** What sets the site apart, as short facts (English; home page and About page). */
export const DIFFERENCES: { icon: IconName; title: string; text: Child[] }[] = ABOUT_EN.differences.map((d, i) => ({ icon: DIFFERENCE_ICONS[i], ...d }));

const differenceGrid = (headingTag: 'h2' | 'h3', locale: Locale): ElNode =>
  el(
    'div',
    { class: 'diff-grid' },
    aboutText(locale).differences.map((d, i) =>
      el('div', { class: 'diff-item' }, el('span', { class: 'diff-icon' }, ic(DIFFERENCE_ICONS[i])), el('div', null, el(headingTag, null, d.title), el('p', { class: 'muted' }, d.text))),
    ),
  );

/** The six differences as a grid (home page section body). */
export function differences(headingTag: 'h2' | 'h3' = 'h3', locale: Locale = 'en'): ElNode {
  return differenceGrid(headingTag, locale);
}

const section = (id: string, title: string, ...body: Child[]): ElNode =>
  el('section', { class: 'guide-section', id, 'aria-labelledby': `${id}-title` }, el('h2', { id: `${id}-title` }, title), ...body);

export function aboutPage(locale: Locale = 'en'): ElNode {
  const t = aboutText(locale);
  const u = ui(locale);
  const meta = pageMeta(ABOUT_META.path, locale) ?? ABOUT_META;
  const profiles = [{ label: 'GitHub', url: REPO_URL }, ...SOCIAL_PROFILES];
  return el(
    'article',
    { class: ['guide-page', 'about-page', 'container', 'accent-green'], 'aria-labelledby': 'about-title' },
    breadcrumbs([{ label: u.home, to: '/' }, { label: meta.label }], u.breadcrumb),
    el(
      'header',
      { class: 'guide-hero' },
      el('span', { class: 'eyebrow' }, ic('circle-info'), t.eyebrow),
      el('h1', { id: 'about-title', class: 'pixel-shadow' }, t.title),
      el('div', { class: 'guide-intro-text lead' }, el('p', null, t.intro)),
    ),
    el(
      'div',
      { class: 'guide-layout' },
      el(
        'div',
        { class: 'guide-body' },
        section('different', t.differentTitle, differenceGrid('h3', locale)),
        section('tools', t.toolsTitle, el('ul', { class: 'guide-list' }, t.tools.map((item) => el('li', null, item)))),
        section('how', t.howTitle, el('p', null, t.how)),
        section(
          'maker',
          t.makerTitle,
          el('p', null, t.maker),
          el('ul', { class: 'guide-list about-links' }, profiles.map((p) => el('li', null, ext(p.url, p.label)))),
          el('p', { class: 'faint small' }, t.notOfficial),
        ),
        el('section', { class: 'guide-section', id: 'questions', 'aria-labelledby': 'questions-title' }, el('h2', { id: 'questions-title' }, t.questions), el('div', { class: 'guide-faq accent-gold' }, faqList(t.faq, { idPrefix: 'about-faq' }))),
      ),
    ),
  );
}

/** English questions (structured data of the English page). */
export const ABOUT_FAQ: FaqItem[] = ABOUT_EN.faq;
