// Installable app: offline support and updates (service worker), the install entries, and files
// or shortcuts the operating system opens the app with. Started once the router runs.

import './pwa.css';
import { registerServiceWorker } from './register';
import { initInstall, isInstalledApp } from './install';

const SHARE_PARAM = 'share-target';

export function initPwa(entryUrl: string): void {
  initInstall();
  if (import.meta.env.DEV) return;
  registerServiceWorker(entryUrl);
  const shared = new URLSearchParams(location.search).get(SHARE_PARAM);
  // Files and shortcut launches only reach an installed app's window.
  const launched = 'launchQueue' in window && isInstalledApp();
  if (!shared && !launched) return;
  void import('./launch')
    .then((m) => {
      if (launched) m.consumeLaunches();
      if (shared) {
        // The address goes back to the plain home page; the files go to their tool.
        const url = new URL(location.href);
        url.searchParams.delete(SHARE_PARAM);
        history.replaceState(history.state, '', url.href);
        void m.consumeShare(shared);
      }
    })
    .catch((err: unknown) => console.warn('Could not open the files the app was launched with', err));
}
