// Shader Maker start screen: pick a target (with a real preview picture of each), then your recent
// shader projects.

import { siteFooter } from '../../../app/footer';
import { navigate } from '../../../core/router';
import { deleteProject, listProjects, saveProject } from '../../../core/storage';
import { friendlyError } from '../../../core/net';
import type { ShaderTarget } from '../../../core/types';
import { badge, button, iconButton, openMenu } from '../../../ui/components';
import { h, timeAgo } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { confirmDialog, promptDialog } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { TARGETS, targetInfo, type ShaderTargetInfo } from '../targets';
import { sceneSvg, TARGET_SCENES } from './art';
import { presetSettings } from './generator';
import { openNewProjectDialog } from './new-project';
import { cleanName, duplicateShaderProject, isShaderProject, type ShaderProjectData } from './project';
import { jobKey, renderPreviewImages, type RenderJob } from './thumbs';

function artEl(svg: string, cls: string): HTMLElement {
  const el = h('span', { class: cls, 'aria-hidden': 'true' });
  el.innerHTML = svg;
  return el;
}

function projectMeta(p: ShaderProjectData): string {
  const t = targetInfo(p.target);
  if (p.target === 'java-vanilla') return `${t.shortName} ${p.version}`;
  if (p.target === 'iris') return t.shortName;
  return t.shortName;
}

export function mountStart(root: HTMLElement): () => void {
  const urls: string[] = [];
  const ctrl = new AbortController();
  let destroyed = false;

  // ---------------------------------------------------------------- target cards
  const thumbs = new Map<ShaderTarget, HTMLElement>();
  const cards = TARGETS.map((t) => targetCard(t));

  function targetCard(t: ShaderTargetInfo): HTMLElement {
    const thumb = h(
      'div',
      { class: 'sh-card-thumb' },
      artEl(sceneSvg(TARGET_SCENES[t.id]), 'sh-card-art'),
      h(
        'div',
        { class: 'sh-card-badges' },
        badge(t.edition === 'java' ? 'Java' : 'Bedrock', t.edition === 'java' ? 'green' : 'blue'),
        t.needsMods ? badge('Needs a mod', 'gold') : badge('No mods', 'purple'),
      ),
    );
    thumbs.set(t.id, thumb);
    const start = button({ label: 'Start', iconEnd: 'arrow-right', variant: 'primary', class: 'sh-card-start', onClick: () => openNewProjectDialog(t.id) });
    start.setAttribute('aria-label', `Start a ${t.name}`);
    const card = h(
      'article',
      { class: 'sh-card', dataset: { target: t.id }, 'aria-labelledby': `sh-card-${t.id}` },
      thumb,
      h(
        'div',
        { class: 'sh-card-body' },
        h('h2', { class: 'sh-card-title', id: `sh-card-${t.id}` }, h('span', { class: 'sh-card-icon' }, icon(t.icon)), h('span', null, t.name)),
        h('p', { class: 'sh-card-tagline' }, t.tagline),
        h('h3', { class: 'sh-card-sub' }, 'What you get'),
        h('ul', { class: 'sh-card-list is-gets' }, t.gets.map((g) => h('li', null, icon('check'), h('span', null, g)))),
        h('h3', { class: 'sh-card-sub' }, 'Good to know'),
        h('ul', { class: 'sh-card-list is-limits' }, t.limits.map((g) => h('li', null, icon('info'), h('span', null, g)))),
      ),
      h('div', { class: 'sh-card-foot' }, start, h('a', { class: 'sh-card-help', href: `#/help?s=${t.helpSection}` }, icon('book-open'), h('span', null, 'Install guide'))),
    );
    card.addEventListener('dblclick', (e) => {
      if ((e.target as HTMLElement).closest('a, button')) return;
      openNewProjectDialog(t.id);
    });
    return card;
  }

  const chooser = h(
    'div',
    { class: 'sh-chooser', role: 'note' },
    h('span', { class: 'sh-chooser-title' }, icon('circle-question'), 'Not sure which one?'),
    h(
      'ul',
      null,
      h('li', null, h('span', { class: 'muted' }, 'Java with mods'), icon('arrow-right'), h('a', { href: '#', dataset: { jump: 'iris' } }, 'Iris / OptiFine')),
      h('li', null, h('span', { class: 'muted' }, 'Java, no mods'), icon('arrow-right'), h('a', { href: '#', dataset: { jump: 'java-vanilla' } }, 'Vanilla Java')),
      h('li', null, h('span', { class: 'muted' }, 'Bedrock (PC, console, phone)'), icon('arrow-right'), h('a', { href: '#', dataset: { jump: 'bedrock-vibrant' } }, 'Vibrant Visuals')),
    ),
  );
  chooser.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-jump]');
    if (!a) return;
    e.preventDefault();
    const card = cards.find((c) => c.dataset.target === a.dataset.jump);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('is-flash');
    void card.offsetWidth;
    card.classList.add('is-flash');
    card.querySelector<HTMLButtonElement>('.sh-card-start')?.focus({ preventScroll: true });
  });

  // ---------------------------------------------------------------- recent projects
  const recentGrid = h('div', { class: 'sh-recent-grid' });
  const recent = h(
    'section',
    { class: 'container sh-recent', hidden: true, 'aria-labelledby': 'sh-recent-title' },
    h('div', { class: 'sh-recent-head' }, h('span', { class: 'eyebrow' }, icon('clock'), 'Your shader projects'), h('h2', { id: 'sh-recent-title' }, 'Continue where you left off')),
    recentGrid,
  );

  function recentCard(p: ShaderProjectData): HTMLElement {
    const t = targetInfo(p.target);
    const thumb = h('div', { class: 'sh-recent-thumb' });
    if (p.thumb instanceof Blob && p.thumb.size) {
      const url = URL.createObjectURL(p.thumb);
      urls.push(url);
      const img = h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' });
      img.addEventListener('error', () => img.replaceWith(artEl(sceneSvg(TARGET_SCENES[p.target]), 'sh-card-art')));
      thumb.appendChild(img);
    } else {
      thumb.appendChild(artEl(sceneSvg(TARGET_SCENES[p.target]), 'sh-card-art'));
    }
    thumb.appendChild(h('span', { class: 'sh-recent-target' }, icon(t.icon), h('span', null, t.shortName)));
    const menuBtn = iconButton('more-vertical', `More actions for ${p.name}`, () => {
      openMenu(menuBtn, [
        { label: 'Open', icon: 'arrow-right', onClick: () => navigate(`/shaders/${p.id}`) },
        { label: 'Rename', icon: 'pencil', onClick: () => void rename(p) },
        { label: 'Duplicate', icon: 'copy', onClick: () => void duplicate(p) },
        { label: 'Delete', icon: 'trash', danger: true, onClick: () => void remove(p) },
      ]);
    }, { size: 'sm' });
    menuBtn.classList.add('sh-recent-menu');
    return h(
      'article',
      { class: 'sh-recent-card', dataset: { id: p.id } },
      h(
        'a',
        { class: 'sh-recent-link', href: `#/shaders/${p.id}` },
        thumb,
        h(
          'span',
          { class: 'sh-recent-info' },
          h('span', { class: 'sh-recent-name truncate' }, p.name),
          h('span', { class: 'sh-recent-meta truncate' }, `${projectMeta(p)} · ${timeAgo(p.updatedAt)}`),
        ),
      ),
      menuBtn,
    );
  }

  async function renderRecent(): Promise<void> {
    let list: ShaderProjectData[] = [];
    try {
      list = (await listProjects('shader')).filter(isShaderProject);
    } catch {
      list = [];
    }
    if (destroyed) return;
    for (const u of urls.splice(0)) URL.revokeObjectURL(u);
    recent.hidden = list.length === 0;
    recentGrid.replaceChildren(...list.slice(0, 24).map(recentCard));
  }

  async function rename(p: ShaderProjectData): Promise<void> {
    const n = await promptDialog('Rename pack', 'Pack name', p.name, { confirmLabel: 'Rename', maxLength: 80 });
    if (!n || n === p.name) return;
    p.name = cleanName(n) || p.name;
    try {
      await saveProject(p);
      toast('Pack renamed', { tone: 'success' });
    } catch (err) {
      toast(friendlyError(err, "Couldn't rename the pack"), { tone: 'error' });
    }
    void renderRecent();
  }

  async function duplicate(p: ShaderProjectData): Promise<void> {
    try {
      await saveProject(duplicateShaderProject(p));
      toast(`Made a copy of “${p.name}”`, { tone: 'success' });
    } catch (err) {
      toast(friendlyError(err, "Couldn't copy the pack"), { tone: 'error' });
    }
    void renderRecent();
  }

  async function remove(p: ShaderProjectData): Promise<void> {
    const ok = await confirmDialog('Delete this pack?', `“${p.name}” will be removed from this browser. Packs you already exported are not affected.`, 'Delete', true);
    if (!ok) return;
    try {
      await deleteProject(p.id);
      void renderRecent();
      toast(`Deleted “${p.name}”`, {
        action: {
          label: 'Undo',
          onClick: () =>
            void saveProject(p)
              .then(() => renderRecent())
              .catch(() => toast("Couldn't restore the pack.", { tone: 'error' })),
        },
      });
    } catch {
      toast("Couldn't delete the pack.", { tone: 'error' });
    }
  }

  // ---------------------------------------------------------------- real preview pictures
  async function renderShowcases(): Promise<void> {
    const jobs: (RenderJob & { target: ShaderTarget })[] = [];
    for (const t of TARGETS) {
      try {
        const gen = await t.load();
        const preset = gen.PRESETS.some((p) => p.id === t.showcase.preset) ? t.showcase.preset : 'default';
        const params = { ...gen.toPreviewParams(presetSettings(gen, preset)), timeOfDay: t.showcase.timeOfDay };
        jobs.push({ key: jobKey(t.id, params), params, target: t.id });
      } catch {
        /* that target keeps its drawn picture */
      }
      if (destroyed) return;
    }
    const byKey = new Map(jobs.map((j) => [j.key, j.target]));
    await renderPreviewImages(
      jobs,
      (key, blob) => {
        const tid = byKey.get(key);
        const thumb = tid ? thumbs.get(tid) : undefined;
        if (!thumb || destroyed) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        const img = h('img', { class: 'sh-card-render', src: url, alt: '' });
        img.addEventListener('load', () => img.classList.add('is-in'));
        thumb.querySelector('.sh-card-render')?.remove();
        thumb.insertBefore(img, thumb.querySelector('.sh-card-badges'));
      },
      { signal: ctrl.signal, width: 480, height: 300 },
    );
  }

  // ---------------------------------------------------------------- page
  const page = h(
    'div',
    { class: 'sh-start accent-purple' },
    h(
      'header',
      { class: 'container sh-hero' },
      h('span', { class: 'eyebrow' }, icon('sparkles'), 'Shader Maker'),
      h('h1', { class: 'pixel-shadow' }, 'Give Minecraft a whole new ', h('span', { class: 'accent' }, 'look')),
      h('p', { class: 'lead' }, 'Choose where you play, pick a preset, move a few sliders and watch the live preview. Then export a pack that’s ready to drop into the game.'),
    ),
    h('div', { class: 'container' }, chooser),
    h('div', { class: 'container sh-cards' }, cards),
    recent,
    siteFooter(),
  );
  root.appendChild(page);
  void renderRecent();
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const kick = () => void renderShowcases();
  if (idle) idle(kick, { timeout: 1200 });
  else setTimeout(kick, 300);

  return () => {
    destroyed = true;
    ctrl.abort();
    for (const u of urls.splice(0)) URL.revokeObjectURL(u);
  };
}
