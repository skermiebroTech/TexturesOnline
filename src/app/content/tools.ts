// What each tool does, how to use it and common questions. Prerendered as the content of
// /textures/, /skins/ and /shaders/ (the pages search engines and AI crawlers read) and shown
// below each tool's start screen once the app is running, so both say the same thing.
// The English text of each tool is a module of its own (src/app/content/intros/<tool>.ts, loaded on
// that tool's pages only); translations fill in ToolIntroText (src/i18n/<lang>/tools.ts).

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../markup';
import { breadcrumbs, steps, faqList, type FaqItem } from './blocks';
import { guideCards } from './guide-cards';
import { TOOL_META, pageMeta } from '../seo/meta';
import type { Locale } from '../../i18n/locales';
import { ui } from '../../i18n/ui';
import { contentOf, hasContent } from '../../i18n/content';

export type IntroTool = 'textures' | 'painting' | 'gui' | 'disc' | 'glint' | 'converter' | 'merge' | 'doctor' | 'totem' | 'fonts' | 'skins' | 'skinpack' | 'cape' | 'shaders';

export interface ToolIntro {
  tool: IntroTool;
  /** Tool whose start screen the page boots into, when it is not the page's own (skin pack maker → skins) */
  base?: 'textures' | 'convert' | 'merge' | 'doctor' | 'totem' | 'fonts' | 'skins' | 'shaders';
  accent: string;
  icon: IconName;
  eyebrow: string;
  heading: string;
  lead: Child[];
  /** Name used in structured data (WebApplication) */
  appName: string;
  features: Child[];
  /** Plain-text feature list for structured data */
  featureList: string[];
  howTitle: string;
  steps: Child[];
  /** Extra sections between the steps and the questions (sub = heading tag for their titles) */
  extra?: (sub: 'h2' | 'h3') => Child[];
  faq: FaqItem[];
  guides: string[];
  /** Other tools to suggest (route paths), shown as cards below the guides */
  related?: string[];
  cta: string;
}

/** A tool introduction as its module gives it: its look comes from TOOL_LOOK. */
export type ToolIntroBody = Omit<ToolIntro, 'tool' | 'accent' | 'icon'>;

/** The translatable part of a tool introduction. */
export type ToolIntroText = Pick<ToolIntro, 'eyebrow' | 'heading' | 'lead' | 'appName' | 'features' | 'featureList' | 'howTitle' | 'steps' | 'extra' | 'faq' | 'cta'> & {
  /** Alt text of the page's link-preview screenshot */
  screenshotCaption?: string;
};

/** A tool introduction in a language (English when that language has no text for it). */
export function toolIntroIn(tool: IntroTool, locale: Locale): ToolIntro & { locale: Locale; screenshotCaption?: string } {
  const text = locale !== 'en' && hasContent(locale) ? contentOf(locale).tools[tool] : undefined;
  const intro = introOf(tool);
  return text ? { ...intro, ...text, locale } : { ...intro, locale: 'en' };
}

/** Each tool's accent colour and icon (also on the cards that suggest it from other tools). */
const TOOL_LOOK: Record<IntroTool, Pick<ToolIntro, 'accent' | 'icon'>> = {
  textures: { accent: 'accent-green', icon: 'image' },
  painting: { accent: 'accent-green', icon: 'image' },
  gui: { accent: 'accent-green', icon: 'layout' },
  disc: { accent: 'accent-green', icon: 'music' },
  glint: { accent: 'accent-green', icon: 'sparkles' },
  converter: { accent: 'accent-green', icon: 'repeat' },
  merge: { accent: 'accent-green', icon: 'git-merge' },
  doctor: { accent: 'accent-green', icon: 'potion' },
  totem: { accent: 'accent-gold', icon: 'human-arms-up' },
  fonts: { accent: 'accent-green', icon: 'text-start-a' },
  skins: { accent: 'accent-blue', icon: 'human' },
  skinpack: { accent: 'accent-blue', icon: 'package' },
  cape: { accent: 'accent-blue', icon: 'bookmark' },
  shaders: { accent: 'accent-purple', icon: 'sparkles' },
};

/** Each tool's introduction is a chunk of its own: a page loads only its tool's. */
const INTRO_LOADERS: Record<IntroTool, () => Promise<{ INTRO: ToolIntroBody }>> = {
  textures: () => import('./intros/textures'),
  painting: () => import('./intros/painting'),
  gui: () => import('./intros/gui'),
  disc: () => import('./intros/disc'),
  glint: () => import('./intros/glint'),
  converter: () => import('./intros/converter'),
  merge: () => import('./intros/merge'),
  doctor: () => import('./intros/doctor'),
  totem: () => import('./intros/totem'),
  fonts: () => import('./intros/fonts'),
  skins: () => import('./intros/skins'),
  skinpack: () => import('./intros/skinpack'),
  cape: () => import('./intros/cape'),
  shaders: () => import('./intros/shaders'),
};

/** Source module of each tool's introduction (the build preloads it on the tool's pages). */
export const INTRO_MODULES: Record<IntroTool, string> = {
  textures: 'src/app/content/intros/textures.ts',
  painting: 'src/app/content/intros/painting.ts',
  gui: 'src/app/content/intros/gui.ts',
  disc: 'src/app/content/intros/disc.ts',
  glint: 'src/app/content/intros/glint.ts',
  converter: 'src/app/content/intros/converter.ts',
  merge: 'src/app/content/intros/merge.ts',
  doctor: 'src/app/content/intros/doctor.ts',
  totem: 'src/app/content/intros/totem.ts',
  fonts: 'src/app/content/intros/fonts.ts',
  skins: 'src/app/content/intros/skins.ts',
  skinpack: 'src/app/content/intros/skinpack.ts',
  cape: 'src/app/content/intros/cape.ts',
  shaders: 'src/app/content/intros/shaders.ts',
};

/** The introductions loaded so far (the build and the unit tests register all: src/i18n/all-content.ts). */
export const TOOL_INTROS: Partial<Record<IntroTool, ToolIntro>> = {};

export function registerToolIntro(tool: IntroTool, body: ToolIntroBody): void {
  TOOL_INTROS[tool] = { tool, ...TOOL_LOOK[tool], ...body };
}

const introLoads = new Map<IntroTool, Promise<void>>();

/** Makes sure a tool's introduction is ready for toolIntro() (at once when it is). A failed load can be tried again. */
export function loadToolIntro(tool: IntroTool): Promise<void> {
  if (TOOL_INTROS[tool]) return Promise.resolve();
  let p = introLoads.get(tool);
  if (!p) {
    p = INTRO_LOADERS[tool]().then(
      (mod) => registerToolIntro(tool, mod.INTRO),
      (err: unknown) => {
        introLoads.delete(tool);
        throw err;
      },
    );
    introLoads.set(tool, p);
  }
  return p;
}

function introOf(tool: IntroTool): ToolIntro {
  const intro = TOOL_INTROS[tool];
  if (!intro) throw new Error(`The ${tool} introduction has not been loaded`);
  return intro;
}

/**
 * The introduction as a page section. `prerender` renders it as the whole page content (h1, and a
 * link to the tool itself); otherwise it sits below the tool's own start screen (h2).
 */
export function toolIntro(tool: IntroTool, opts: { prerender: boolean; locale?: Locale }): ElNode {
  const t = toolIntroIn(tool, opts.locale ?? 'en');
  const u = ui(t.locale);
  const meta = pageMeta(TOOL_META[tool].path, t.locale) ?? TOOL_META[tool];
  const H = opts.prerender ? 'h1' : 'h2';
  const sub = opts.prerender ? 'h2' : 'h3';
  return el(
    'section',
    { class: ['tool-intro', 'container', t.accent, opts.prerender ? null : 'is-below'], 'aria-labelledby': `intro-${tool}-title`, 'data-tool-intro': tool },
    breadcrumbs([{ label: u.home, to: '/' }, { label: meta.label }], u.breadcrumb),
    el(
      'header',
      { class: 'tool-intro-head' },
      el('span', { class: 'eyebrow' }, ic(t.icon), t.eyebrow),
      el(H, { id: `intro-${tool}-title`, class: opts.prerender ? 'pixel-shadow' : null }, t.heading),
      el('p', { class: 'lead' }, t.lead),
      opts.prerender
        ? el(
            'noscript',
            null,
            el('p', { class: 'tool-intro-noscript' }, u.toolIntro.noscript),
          )
        : null,
    ),
    el(
      'div',
      { class: 'tool-intro-grid' },
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, u.toolIntro.whatYouCanDo),
        el(
          'ul',
          { class: 'tool-intro-list' },
          t.features.map((f) => el('li', null, ic('check'), el('span', null, f))),
        ),
      ),
      el('div', { class: 'tool-intro-card' }, el(sub, null, t.howTitle), steps(t.steps)),
    ),
    t.extra ? t.extra(sub) : null,
    el('div', { class: 'tool-intro-faq' }, el(sub, null, u.toolIntro.questions), el('div', { class: 'tool-intro-card flush' }, faqList(t.faq, { idPrefix: `${tool}-faq` }))),
    el('div', { class: 'tool-intro-guides' }, el(sub, null, u.toolIntro.guides), guideCards(t.guides, opts.prerender ? 'h3' : 'h4', 2, t.locale)),
    t.related?.length
      ? el('div', { class: 'tool-intro-guides tool-intro-related' }, el(sub, null, u.toolIntro.related), relatedTools(t.related, opts.prerender ? 'h3' : 'h4', t.locale))
      : null,
  );
}

/** Cards for other tools (route paths), named and described by their page meta in the language. */
function relatedTools(paths: string[], headingTag: string, locale: Locale): ElNode {
  const cards = paths.map((path) => {
    const meta = pageMeta(path, locale) ?? pageMeta(path, 'en');
    const tool = (Object.keys(TOOL_META) as IntroTool[]).find((t) => TOOL_META[t].path === path);
    const intro = tool ? TOOL_LOOK[tool] : undefined;
    if (!meta) return null;
    return el(
      'a',
      { class: ['guide-card', intro?.accent ?? 'accent-green'], to: path },
      el('span', { class: 'guide-card-icon' }, ic(intro?.icon ?? 'tools')),
      el('span', { class: 'guide-card-text' }, el(headingTag, { class: 'guide-card-title' }, meta.label), el('span', { class: 'guide-card-desc' }, meta.description)),
      ic('arrow-right', { class: 'guide-card-go' }),
    );
  });
  return el('div', { class: ['guide-grid', 'cols-2'] }, cards.filter((c): c is ElNode => !!c));
}
