// Install guides for packs, skins and shaders on every edition, plus FAQ. The markup comes from
// content.ts (the same tree is prerendered at build time); this file adds the behaviour.

import './help.css';
import '../../app/content/content.css';
import type { ViewContext } from '../../core/router';
import { handleFragments, replacePath } from '../../core/router';
import { prefersReducedMotion } from '../../ui/dom';
import { siteFooter, wireFooter } from '../../app/footer';
import { toDomAll } from '../../app/markup-dom';
import { wireContent } from '../../app/content/wire';
import { FAQ, HELP_SECTION_IDS, helpPage } from './content';
import { loadContent } from '../../i18n/content';

/** The id a URL's '#fragment' names ('#java-packs' -> 'java-packs'; '' for none). */
function fragmentId(hash: string): string {
  const raw = hash.replace(/^#/, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** The page is the prerendered markup: on a first visit the router hands it over as it is. */
export const hydratable = true;

export default async function help(root: HTMLElement, ctx: ViewContext): Promise<() => void> {
  await loadContent(ctx.locale);
  root.classList.add('help');
  if (!ctx.hydrate) root.append(...toDomAll(helpPage(ctx.locale)), siteFooter());
  else wireFooter(root, ctx.locale);
  const unwire = wireContent(root);

  const tocLinks = new Map<string, HTMLAnchorElement>();
  root.querySelectorAll<HTMLAnchorElement>('.toc-link[data-section]').forEach((a) => tocLinks.set(a.dataset.section!, a));
  // Sections and FAQ answers carry their own id ('#faq', '#offline'), so a fragment works on the
  // static page too; with the app running they are opened here (offset for the sticky top bar).
  const sectionEl = (id: string) => root.querySelector<HTMLElement>(`.help-section#${CSS.escape(id)}`);
  const sectionEls = HELP_SECTION_IDS.map(sectionEl).filter((s): s is HTMLElement => !!s);
  const isSection = (id: string) => HELP_SECTION_IDS.includes(id);
  const isFaq = (id: string) => FAQ.some((f) => f.id === id);

  const behavior = (smooth: boolean): ScrollBehavior => (smooth && !prefersReducedMotion() ? 'smooth' : ('instant' as ScrollBehavior));

  const setActive = (id: string) => {
    tocLinks.forEach((a, key) => {
      if (key === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };

  // The address keeps the section's fragment (/help/#iris), so it can be copied and shared.
  const jump = (id: string, smooth = true) => {
    const target = sectionEl(id);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: behavior(smooth) });
    replacePath(`/help#${id}`);
    setActive(id);
  };

  const openFaq = (id: string, smooth = true) => {
    const d = root.querySelector<HTMLDetailsElement>(`details#${CSS.escape(id)}`);
    if (!d) return;
    d.open = true;
    // On a page load the browser may already have scrolled to it (the fragment is its id): no jump then.
    const top = d.getBoundingClientRect().top;
    if (smooth || top < 0 || top > window.innerHeight / 2) d.scrollIntoView({ block: 'center', behavior: behavior(smooth) });
    replacePath(`/help#${id}`);
    setActive('faq');
  };

  /** Shows what a fragment names; false when it names neither a section nor an FAQ answer. */
  const show = (id: string, smooth: boolean): boolean => {
    if (isSection(id)) {
      jump(id, smooth);
      if (smooth) sectionEl(id)?.focus({ preventScroll: true });
    } else if (isFaq(id)) {
      openFaq(id, smooth);
    } else {
      return false;
    }
    return true;
  };

  // Highlight the section being read
  const visible = new Map<string, number>();
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) => {
            for (const en of entries) {
              const id = (en.target as HTMLElement).id;
              if (en.isIntersecting) visible.set(id, en.boundingClientRect.top);
              else visible.delete(id);
            }
            const first = HELP_SECTION_IDS.find((id) => visible.has(id));
            if (first) setActive(first);
          },
          { rootMargin: '-96px 0px -55% 0px' },
        )
      : null;
  sectionEls.forEach((s) => io?.observe(s));

  // In-page links (table of contents, quick cards, footer) scroll instead of re-rendering the page.
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href]');
    if (!(a instanceof HTMLAnchorElement) || a.target) return;
    let url: URL;
    try {
      url = new URL(a.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    e.preventDefault();
    if (show(fragmentId(url.hash) || (url.searchParams.get('s') ?? ''), true)) return;
    window.scrollTo({ top: 0, behavior: behavior(true) });
    replacePath('/help');
    setActive(HELP_SECTION_IDS[0]);
  };
  root.addEventListener('click', onClick);
  // Fragments the router hands over: the first load, a link from another page, an edited address.
  const unhandle = handleFragments((id, { smooth }) => void show(id, smooth));

  // The backups section: every project as one file, or open a backup (the dialogs load on use).
  const onBackup = (e: MouseEvent) => {
    const b = (e.target as Element | null)?.closest?.<HTMLElement>('[data-backup]');
    if (!b) return;
    void import('../../shared/project-file/entry').then((m) => (b.dataset.backup === 'all' ? m.openBackupDialog() : m.pickProjectFile()));
  };
  root.addEventListener('click', onBackup);

  // Old links (/help/?s=sounds from search results and bookmarks) get the fragment address in
  // place; the router then opens the section like any other fragment.
  const legacy = ctx.query.get('s');
  if (legacy !== null) {
    const rest = new URLSearchParams(ctx.query);
    rest.delete('s');
    const qs = rest.toString();
    const fragment = isSection(legacy) || isFaq(legacy) ? `#${encodeURIComponent(legacy)}` : location.hash;
    replacePath(`/help${qs ? `?${qs}` : ''}${fragment}`);
  }
  const initial = fragmentId(location.hash);
  setActive(isSection(initial) ? initial : isFaq(initial) ? 'faq' : HELP_SECTION_IDS[0]);

  return () => {
    io?.disconnect();
    unwire();
    unhandle();
    root.removeEventListener('click', onClick);
    root.removeEventListener('click', onBackup);
  };
}
