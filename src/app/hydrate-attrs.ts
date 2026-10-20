// Prerendered pages the app takes over as they are (home, help, about, guides): the build marks the
// view element with the page it was made for and the footer's year, and the router reuses that
// markup on the first render of that same page (app/pages.ts, adoptPrerenderedView).

export const PRERENDERED_ATTR = 'data-prerendered';
export const PRERENDERED_YEAR_ATTR = 'data-year';

/** Value of PRERENDERED_ATTR: language and route path without the language folder ('de:/help'). */
export const prerenderedKey = (locale: string, path: string): string => `${locale}:${path}`;
