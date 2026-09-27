// Site-wide constants: address, names and search settings. Moving the site to another domain is a
// one-line change to SITE_URL (canonical links, Open Graph, JSON-LD, sitemap, robots.txt and
// llms.txt are all generated from it). Asset and page links stay relative, so a copy of the build
// served from another path (e.g. a GitHub Pages project URL) keeps working.

/** Public address of the site, with a trailing slash. */
export const SITE_URL = 'https://texturepackmaker.com/';

export const SITE_NAME = 'Texture Pack Maker';
export const SITE_ALT_NAME = 'TexturePackMaker';
/** Home-screen label (web app manifest short_name, 12 characters at most). */
export const SITE_SHORT_NAME = 'Pack Maker';
export const SITE_SUMMARY =
  'Free Minecraft texture pack, skin and shader maker that runs in the browser, for Java Edition (26.3 and every version back to 1.6.1) and Bedrock Edition.';

export const PUBLISHER = {
  name: 'Skermiebro Tech Tips',
  url: 'https://github.com/skermiebroTech',
};

/** Source code (the repository keeps its original name). */
export const REPO_URL = 'https://github.com/skermiebroTech/TexturesOnline';

export const OG_IMAGE = {
  path: 'og-image.png',
  width: 1200,
  height: 630,
  alt: 'Texture Pack Maker home page: make texture packs, skins and shaders for Minecraft Java and Bedrock',
};

export const THEME_COLOR = { dark: '#0d0f14', light: '#eef1f6' };

/**
 * Search engine ownership tokens (the "HTML tag" method). Leave empty to leave the tag out; paste
 * only the content="..." value, e.g. the part after content= in Google Search Console.
 */
export const GOOGLE_SITE_VERIFICATION = '';
export const BING_SITE_VERIFICATION = '';

/** When the guides and facts on the public pages were last checked. */
export const CONTENT_UPDATED = '2026-09-27';

/** Absolute URL of a site path: '/' -> SITE_URL, '/help' -> SITE_URL + 'help/', 'og-image.png' -> file URL. */
export function absoluteUrl(path: string): string {
  const clean = path.replace(/^\/+/, '');
  if (!clean) return SITE_URL;
  const isFile = /\.[a-z0-9]+$/i.test(clean.split(/[?#]/)[0]);
  const withSlash = isFile || clean.endsWith('/') || clean.includes('?') ? clean : `${clean}/`;
  return SITE_URL + withSlash;
}
