// Install guides for packs, skins and shaders on every edition, plus FAQ. The markup comes from
// content.ts (the same tree is prerendered at build time); this file adds the behaviour.

import './help.css';
import '../../app/content/content.css';
import type { RouteContext } from '../../core/router';
import { isRestoringScroll, replacePath } from '../../core/router';
import { prefersReducedMotion } from '../../ui/dom';
import { siteFooter } from '../../app/footer';
import { toDomAll } from '../../app/markup-dom';
import { wireContent } from '../../app/content/wire';
import { FAQ, HELP_SECTION_IDS, helpPage } from './content';

export default function help(root: HTMLElement, ctx: RouteContext): () => void {
  root.classList.add('help');
  root.append(...toDomAll(helpPage()), siteFooter());
  const unwire = wireContent(root);

  const tocLinks = new Map<string, HTMLAnchorElement>();
  root.querySelectorAll<HTMLAnchorElement>('.toc-link[data-section]').forEach((a) => tocLinks.set(a.dataset.section!, a));
  const sectionEls = HELP_SECTION_IDS.map((id) => document.getElementById(`help-${id}`)).filter((s): s is HTMLElement => !!s);

  const behavior = (smooth: boolean): ScrollBehavior => (smooth && !prefersReducedMotion() ? 'smooth' : ('instant' as ScrollBehavior));

  const setActive = (id: string) => {
    tocLinks.forEach((a, key) => {
      if (key === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };

  // The URL is kept in sync through the router so links to the current section still work.
  const jump = (id: string, smooth = true) => {
    const target = document.getElementById(`help-${id}`);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: behavior(smooth) });
    replacePath(`/help?s=${id}`);
    setActive(id);
  };

  const openFaq = (id: string, smooth = true) => {
    const d = document.getElementById(`faq-${id}`) as HTMLDetailsElement | null;
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ block: 'center', behavior: behavior(smooth) });
    replacePath(`/help?s=${id}`);
    setActive('faq');
  };

  // Highlight the section being read
  const visible = new Map<string, number>();
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) => {
            for (const en of entries) {
              const id = (en.target as HTMLElement).id.replace(/^help-/, '');
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
    const s = url.searchParams.get('s');
    if (s && HELP_SECTION_IDS.includes(s)) {
      jump(s);
      document.getElementById(`help-${s}`)?.focus({ preventScroll: true });
    } else if (s && FAQ.some((f) => f.id === s)) {
      openFaq(s);
    } else {
      window.scrollTo({ top: 0, behavior: behavior(true) });
      replacePath('/help');
      setActive(HELP_SECTION_IDS[0]);
    }
  };
  root.addEventListener('click', onClick);

  const initial = ctx.query.get('s');
  setActive(initial && HELP_SECTION_IDS.includes(initial) ? initial : HELP_SECTION_IDS[0]);
  if (isRestoringScroll()) {
    // back/forward: the router puts the page back where the reader left it
  } else if (initial && HELP_SECTION_IDS.includes(initial)) {
    requestAnimationFrame(() => requestAnimationFrame(() => jump(initial, false)));
  } else if (initial && FAQ.some((f) => f.id === initial)) {
    requestAnimationFrame(() => openFaq(initial, false));
  }

  return () => {
    io?.disconnect();
    unwire();
    root.removeEventListener('click', onClick);
  };
}
