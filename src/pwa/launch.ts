// Files opened with the installed app (File Handling API: double-click a .mcpack, "Open with"),
// files shared to it (Web Share Target) and app shortcuts are routed to the right tool: the file is
// handed to that tool's own drop zone, exactly as if it had been dropped there. Project files and
// backups (.tpmproject, .tpmbackup) say which tool they belong to and open there directly.
// Loaded only when the app was launched with files, or by the share target.

import { unzipSync } from 'fflate';
import { appBasePath, appBaseUrl } from '../core/base';
import { currentLocale, navigate, onViewRendered, stripBase } from '../core/router';
import { fileMatchesAccept } from '../ui/format';
import { toast } from '../ui/toast';
import { PACK_EXT, PNG_EXT, planLaunch, pngSize, type LaunchFileFacts } from './route-file';
import { appText } from './text';
import { isProjectFileName } from '../shared/project-file/handoff';

/** Same names as src/pwa/sw-logic.ts (not imported: that module is bundled into the worker alone). */
const SHARE_CACHE = 'tpm-share';
const SHARE_TARGET_PATH = 'share-target/';
export const SHARE_PARAM = 'share-target';

async function factsOf(file: File): Promise<LaunchFileFacts> {
  const facts: LaunchFileFacts = { name: file.name };
  try {
    if (PACK_EXT.test(file.name)) {
      const entries: string[] = [];
      // Lists the entries only: nothing is decompressed.
      unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (f) => {
          entries.push(f.name);
          return false;
        },
      });
      facts.entries = entries;
    } else if (PNG_EXT.test(file.name)) {
      facts.png = pngSize(new Uint8Array(await file.slice(0, 24).arrayBuffer())) ?? undefined;
    }
  } catch (err) {
    console.warn(`Couldn't look inside ${file.name}`, err);
  }
  return facts;
}

/** Resolves with the root of the next view rendered for a route path (or null after a while). */
function nextView(route: string, ms = 20000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      off();
      resolve(null);
    }, ms);
    const off = onViewRendered((state, root) => {
      if (state.path !== route) return;
      clearTimeout(timer);
      off();
      resolve(root);
    });
  });
}

/** Waits for a file input of a drop zone that takes these files, inside the view. */
async function dropInput(root: HTMLElement, files: File[], ms = 15000): Promise<HTMLInputElement | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('.dropzone input[type="file"]'));
    const fit = inputs.find((i) => files.every((f) => fileMatchesAccept(f, i.accept)) && (files.length === 1 || i.multiple));
    if (fit && root.isConnected) return fit;
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

function cantOpen(name: string): void {
  toast(appText(currentLocale()).cantOpen.replace('{name}', name), { tone: 'error' });
}

/** Opens files in the tool that fits them. */
export async function openFiles(files: File[]): Promise<void> {
  if (!files.length) return;
  // A project file or backup knows its own tool (it opens there, or offers what to restore).
  const project = files.find((f) => isProjectFileName(f.name));
  if (project) {
    const { openProjectFile } = await import('../shared/project-file/ui');
    return openProjectFile(project);
  }
  const facts = await Promise.all(files.map(factsOf));
  const plan = planLaunch(facts);
  if (!plan) return cantOpen(files[0].name);
  const picked = plan.files.map((i) => files[i]);
  const rendered = nextView(plan.route);
  navigate(plan.route);
  const root = (await rendered) ?? document.querySelector<HTMLElement>('#main');
  const input = root ? await dropInput(root, picked) : null;
  if (!input) return cantOpen(picked[0].name);
  const dt = new DataTransfer();
  for (const f of picked) dt.items.add(f);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

interface LaunchParams {
  readonly targetURL?: string;
  readonly files: readonly FileSystemFileHandle[];
}
interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

/**
 * File Handling and launch_handler: files from the operating system, and launches that reuse the
 * open window (client_mode "focus-existing") with the address of a shortcut.
 */
export function consumeLaunches(): void {
  const queue = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
  if (!queue) return;
  queue.setConsumer((params) => {
    if (params.files?.length) {
      void Promise.all(params.files.map((h) => h.getFile()))
        .then(openFiles)
        .catch((err: unknown) => console.error('Could not open the launched files', err));
      return;
    }
    if (!params.targetURL) return;
    const target = new URL(params.targetURL);
    if (target.href === location.href) return;
    const path = stripBase(target.pathname, appBasePath());
    if (path !== null) navigate(path + target.search, { exact: true });
  });
}

/** Files the share target stored for this page ("?share-target=<id>"), handed to openFiles. */
export async function consumeShare(id: string): Promise<void> {
  const files: File[] = [];
  try {
    const cache = await caches.open(SHARE_CACHE);
    const prefix = new URL(`${SHARE_TARGET_PATH}${id}/`, appBaseUrl()).href;
    const keys = (await cache.keys()).filter((r) => r.url.startsWith(prefix)).sort((a, b) => Number(a.url.slice(prefix.length)) - Number(b.url.slice(prefix.length)));
    for (const req of keys) {
      const res = await cache.match(req);
      if (res) {
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get('x-file-name') ?? 'shared-file');
        files.push(new File([blob], name, { type: blob.type }));
      }
      await cache.delete(req);
    }
  } catch (err) {
    console.warn('Could not read the shared files', err);
  }
  if (files.length) await openFiles(files);
}
