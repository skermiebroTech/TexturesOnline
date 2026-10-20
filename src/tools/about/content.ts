// The About page (who makes the site, what it does differently, privacy and how it works) and the
// short list of differences reused on the home page. Prerendered at build time, rendered to DOM by
// about.ts.

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../../app/markup';
import { breadcrumbs, code, ext, faqList, link, strong, type FaqItem } from '../../app/content/blocks';
import { ABOUT_META } from '../../app/seo/meta';
import { PUBLISHER, REPO_URL, SITE_NAME, SOCIAL_PROFILES } from '../../app/site';
import { KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../editions/java/packformats';

/** What sets the site apart, as short facts (home page and About page). */
export const DIFFERENCES: { icon: IconName; title: string; text: Child[] }[] = [
  {
    icon: 'clock',
    title: 'Every Java version since 1.6.1',
    text: ['Not just the latest: make a pack for 26.3, 1.21.11, 1.20.1 or 1.8.9, each with its own textures and the right pack.mcmeta.'],
  },
  {
    icon: 'repeat',
    title: 'Java and Bedrock, and a converter',
    text: ['Make packs for either edition, then turn a Java pack into a Bedrock one or back with the ', link('/texture-pack-converter', 'texture pack converter'), '.'],
  },
  {
    icon: 'sparkles',
    title: 'Textures, skins and shaders',
    text: ['One site for texture packs, skins and skin packs, and shaders for Iris, OptiFine, vanilla Java and Bedrock Vibrant Visuals.'],
  },
  {
    icon: 'lock',
    title: 'Nothing is uploaded',
    text: ['Everything runs in your browser. Game files come straight from Mojang, and your work stays on your device.'],
  },
  {
    icon: 'code',
    title: 'Free and open source',
    text: ['No account, no ads and no paid tiers. The code is public under the MIT licence on ', ext(REPO_URL, 'GitHub'), '.'],
  },
  {
    icon: 'cloud',
    title: 'Works offline',
    text: ['After the first visit the app and the game files you used are kept on your device, so it keeps working without a connection.'],
  },
];

const FAQ: FaqItem[] = [
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
];

const f263 = formatPackFormat(KNOWN_RELEASE_FORMATS['26.3']);

const differenceGrid = (headingTag: 'h2' | 'h3'): ElNode =>
  el(
    'div',
    { class: 'diff-grid' },
    DIFFERENCES.map((d) =>
      el('div', { class: 'diff-item' }, el('span', { class: 'diff-icon' }, ic(d.icon)), el('div', null, el(headingTag, null, d.title), el('p', { class: 'muted' }, d.text))),
    ),
  );

/** The six differences as a grid (home page section body). */
export function differences(headingTag: 'h2' | 'h3' = 'h3'): ElNode {
  return differenceGrid(headingTag);
}

const section = (id: string, title: string, ...body: Child[]): ElNode =>
  el('section', { class: 'guide-section', id, 'aria-labelledby': `${id}-title` }, el('h2', { id: `${id}-title` }, title), ...body);

export function aboutPage(): ElNode {
  const profiles = [{ label: 'GitHub', url: REPO_URL }, ...SOCIAL_PROFILES];
  return el(
    'article',
    { class: ['guide-page', 'about-page', 'container', 'accent-green'], 'aria-labelledby': 'about-title' },
    breadcrumbs([{ label: 'Home', to: '/' }, { label: ABOUT_META.label }]),
    el(
      'header',
      { class: 'guide-hero' },
      el('span', { class: 'eyebrow' }, ic('circle-info'), 'About'),
      el('h1', { id: 'about-title', class: 'pixel-shadow' }, `About ${SITE_NAME}`),
      el(
        'div',
        { class: 'guide-intro-text lead' },
        el(
          'p',
          null,
          `${SITE_NAME} is a free, open-source website for making Minecraft texture packs, skins and shaders in the browser, for Java Edition (26.3 and every release back to 1.6.1) and Bedrock Edition. It is made by ${PUBLISHER.name}.`,
        ),
      ),
    ),
    el(
      'div',
      { class: 'guide-layout' },
      el(
        'div',
        { class: 'guide-body' },
        section('different', `What makes ${SITE_NAME} different`, differenceGrid('h3')),
        section(
          'tools',
          'The tools',
          el(
            'ul',
            { class: 'guide-list' },
            el('li', null, link('/textures', 'Texture pack maker'), ': repaint any block, item or mob on its 3D model, upload your own images, replace sounds, restyle the whole pack in one click, or open an existing pack.'),
            el('li', null, link('/texture-pack-converter', 'Texture pack converter'), ': Java to Bedrock, Bedrock to Java, between Java versions, or PNG textures to an .mcpack.'),
            el('li', null, link('/merge-texture-packs', 'Merge texture packs'), ': combine up to eight packs into one, in the order you choose.'),
            el('li', null, link('/totem-maker', 'Totem maker'), ': turn any skin into a custom Totem of Undying resource pack for Java or Bedrock.'),
            el('li', null, link('/skins', 'Skin editor'), ' and ', link('/skin-pack-maker', 'skin pack maker'), ': paint skins in 2D or 3D with classic or slim arms, and bundle them into a Bedrock skin pack.'),
            el('li', null, link('/shaders', 'Shader maker'), ': Iris and OptiFine shader packs, vanilla Java shaders that need no mods, and Bedrock Vibrant Visuals packs.'),
            el('li', null, link('/guides', 'Guides'), ': making, installing and fixing packs, and the pack format of every Java version.'),
          ),
        ),
        section(
          'how',
          'How it works',
          el(
            'p',
            null,
            'When you pick a game version, your browser downloads that version’s textures straight from Mojang and keeps them on your device. Your projects are saved in the browser too (IndexedDB), and exports are built on your device: a Java ',
            code('.zip'),
            ' with the right ',
            code('pack.mcmeta'),
            ` (Java 26.3 uses pack format ${f263}) or a Bedrock `,
            code('.mcpack'),
            ' with a ',
            code('manifest.json'),
            '. Nothing you make is sent to a server.',
          ),
        ),
        section(
          'maker',
          'Who makes it',
          el(
            'p',
            null,
            `${SITE_NAME} is made by `,
            strong(PUBLISHER.name),
            '. The source code is public, so anyone can see how it works, suggest changes or report problems.',
          ),
          el('ul', { class: 'guide-list about-links' }, profiles.map((p) => el('li', null, ext(p.url, p.label)))),
          el('p', { class: 'faint small' }, 'Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.'),
        ),
        el('section', { class: 'guide-section', id: 'questions', 'aria-labelledby': 'questions-title' }, el('h2', { id: 'questions-title' }, 'Questions'), el('div', { class: 'guide-faq accent-gold' }, faqList(FAQ, { idPrefix: 'about-faq' }))),
      ),
    ),
  );
}

export { FAQ as ABOUT_FAQ };
