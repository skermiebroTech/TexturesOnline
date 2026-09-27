// Keeps the document head in step with in-app navigation: description, canonical link, robots and
// social tags for public pages; "noindex" for private project pages and the UI kit. (Search engines
// get the same values in the prerendered HTML; this matters once someone navigates inside the app.)

import { onRouteChange } from '../core/router';
import { publicPageMeta } from './seo/meta';
import { absoluteUrl } from './site';

export const ROBOTS_PUBLIC = 'index,follow,max-image-preview:large';
export const ROBOTS_PRIVATE = 'noindex,follow';

function metaEl(attr: 'name' | 'property', key: string): HTMLMetaElement {
  let m = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!m) {
    m = document.createElement('meta');
    m.setAttribute(attr, key);
    document.head.appendChild(m);
  }
  return m;
}

function setMeta(attr: 'name' | 'property', key: string, value: string): void {
  const m = metaEl(attr, key);
  if (m.content !== value) m.content = value;
}

function setCanonical(url: string | null): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!url) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  if (link.href !== url) link.href = url;
}

export function initHead(): void {
  onRouteChange((state) => {
    const meta = publicPageMeta(state.path);
    setMeta('name', 'robots', meta ? ROBOTS_PUBLIC : ROBOTS_PRIVATE);
    if (!meta) {
      setCanonical(null);
      return;
    }
    const url = absoluteUrl(meta.path);
    setCanonical(url);
    setMeta('name', 'description', meta.description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', meta.description);
    setMeta('name', 'twitter:title', meta.title);
    setMeta('name', 'twitter:description', meta.description);
  });
}
