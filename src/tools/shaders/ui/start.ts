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
import { openNewProjectDialog } from './new-project';
import { enablePageDrop, openPackSection } from '../import/start-card';
import { duplicateImported, importedKindLabel, isImportedPack, sweepOrphanedPackFiles } from '../packedit/store';
import { cleanName, cleanupPreviewPacks, duplicateShaderProject, isShaderProject, type ShaderProjectData } from './project';
import irisShowcase from './showcase/iris.webp';
import vanillaShowcase from './showcase/java-vanilla.webp';
import bedrockShowcase from './showcase/bedrock-vibrant.webp';
import { t as tx } from '../i18n/text';
import { kit } from '../../../ui/i18n/kit';
import { fmt, fmtNodes } from '../../../i18n/editor-text';
import { projectsText } from '../../../shared/i18n/projects';
import { onProjectsChanged } from '../../../shared/project-file/handoff';
import { saveProjectFile } from '../../../shared/project-file/entry';

/** Pictures rendered with the live preview (tests/harness/shaders-view/render-showcase.cjs). */
const SHOWCASE: Record<ShaderTarget, string> = {
  iris: irisShowcase,
  'java-vanilla': vanillaShowcase,
  'bedrock-vibrant': bedrockShowcase,
};

function artEl(svg: string, cls: string): HTMLElement {
  const el = h('span', { class: cls, 'aria-hidden': 'true' });
  el.innerHTML = svg;
  return el;
}

function projectMeta(p: ShaderProjectData): string {
  const when = fmt(tx.recent.edited, { when: timeAgo(p.updatedAt) });
  if (isImportedPack(p)) return fmt(tx.recent.files, { count: String(p.fileCount), when });
  if (p.target === 'java-vanilla') return `${fmt(kit.edition.javaVersion, { version: p.version })} · ${when}`;
  return when;
}

export function mountStart(root: HTMLElement): () => void {
  const urls: string[] = [];
  let destroyed = false;

  // ---------------------------------------------------------------- target cards
  const cards = TARGETS.map((t) => targetCard(t));

  function targetCard(t: ShaderTargetInfo): HTMLElement {
    const render = h('img', { class: 'sh-card-render', src: SHOWCASE[t.id], alt: '', decoding: 'async' });
    const art = artEl(sceneSvg(TARGET_SCENES[t.id]), 'sh-card-art');
    // Once the (opaque) picture has faded in over the drawn scene, the scene leaves the page's
    // rendering: its hundred-odd shapes would otherwise be restyled by every dialog and theme switch.
    const reveal = () => {
      render.classList.add('is-in');
      setTimeout(() => art.classList.add('is-covered'), 400);
    };
    if (render.complete && render.naturalWidth) reveal();
    else render.addEventListener('load', reveal);
    render.addEventListener('error', () => render.remove());
    const thumb = h(
      'div',
      { class: 'sh-card-thumb' },
      art,
      render,
      h(
        'div',
        { class: 'sh-card-badges' },
        badge(t.edition === 'java' ? kit.edition.java : kit.edition.bedrock, t.edition === 'java' ? 'green' : 'blue'),
        t.needsMods ? badge(tx.card.needsMod, 'gold') : badge(tx.card.noMods, 'purple'),
      ),
    );
    const start = button({ label: tx.card.start, iconEnd: 'arrow-right', variant: 'primary', class: 'sh-card-start', onClick: () => openNewProjectDialog(t.id) });
    start.setAttribute('aria-label', fmt(tx.card.startLabel, { name: t.name }));
    const card = h(
      'article',
      { class: 'sh-card', dataset: { target: t.id }, 'aria-labelledby': `sh-card-${t.id}` },
      thumb,
      h(
        'div',
        { class: 'sh-card-body' },
        h('h2', { class: 'sh-card-title', id: `sh-card-${t.id}` }, h('span', { class: 'sh-card-icon' }, icon(t.icon)), h('span', null, t.name)),
        h('p', { class: 'sh-card-tagline' }, t.tagline),
        h('h3', { class: 'sh-card-sub' }, tx.card.gets),
        h('ul', { class: 'sh-card-list is-gets' }, t.gets.map((g) => h('li', null, icon('check'), h('span', null, g)))),
        h('h3', { class: 'sh-card-sub' }, tx.card.limits),
        h('ul', { class: 'sh-card-list is-limits' }, t.limits.map((g) => h('li', null, icon('info'), h('span', null, g)))),
      ),
      h('div', { class: 'sh-card-foot' }, start, h('a', { class: 'sh-card-help', href: `#/help?s=${t.helpSection}` }, icon('book-open'), h('span', null, tx.card.installGuide))),
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
    h('span', { class: 'sh-chooser-title' }, icon('circle-question'), tx.chooser.title),
    h(
      'ul',
      null,
      h('li', null, h('span', { class: 'muted' }, tx.chooser.javaMods), icon('arrow-right'), h('a', { href: '#', dataset: { jump: 'iris' } }, tx.targets.iris.shortName)),
      h('li', null, h('span', { class: 'muted' }, tx.chooser.javaNoMods), icon('arrow-right'), h('a', { href: '#', dataset: { jump: 'java-vanilla' } }, tx.targets.vanilla.shortName)),
      h('li', null, h('span', { class: 'muted' }, kit.edition.bedrock), icon('arrow-right'), h('a', { href: '#', dataset: { jump: 'bedrock-vibrant' } }, tx.targets.bedrock.shortName)),
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
    h('div', { class: 'sh-recent-head' }, h('span', { class: 'eyebrow' }, icon('clock'), tx.recent.eyebrow), h('h2', { id: 'sh-recent-title' }, tx.recent.title)),
    recentGrid,
  );

  function recentCard(p: ShaderProjectData): HTMLElement {
    const t = targetInfo(p.target);
    const thumb = h('div', { class: 'sh-recent-thumb' }, artEl(sceneSvg(TARGET_SCENES[p.target]), 'sh-card-art'));
    if (p.thumb instanceof Blob && p.thumb.size) {
      const url = URL.createObjectURL(p.thumb);
      urls.push(url);
      const img = h('img', { class: 'sh-card-render', src: url, alt: '', decoding: 'async' });
      img.addEventListener('load', () => img.classList.add('is-in'));
      img.addEventListener('error', () => img.remove());
      thumb.appendChild(img);
    }
    thumb.appendChild(h('span', { class: 'sh-recent-target' }, icon(t.icon), h('span', null, isImportedPack(p) ? importedKindLabel(p) : t.shortName)));
    if (isImportedPack(p)) thumb.appendChild(h('span', { class: 'pe-recent-badge' }, badge(tx.recent.imported, 'gold')));
    const menuBtn = iconButton('more-vertical', fmt(tx.recent.more, { name: p.name }), () => {
      openMenu(menuBtn, [
        { label: tx.recent.open, icon: 'arrow-right', onClick: () => navigate(`/shaders/${p.id}`) },
        { label: tx.recent.rename, icon: 'pencil', onClick: () => void rename(p) },
        { label: tx.recent.duplicate, icon: 'copy', onClick: () => void duplicate(p) },
        { label: projectsText.save, icon: 'save', onClick: () => void saveProjectFile({ id: p.id }) },
        { label: tx.recent.delete, icon: 'trash', danger: true, onClick: () => void remove(p) },
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
          h('span', { class: 'sh-recent-meta truncate' }, projectMeta(p)),
        ),
      ),
      menuBtn,
    );
  }

  let cleaned = false;
  async function renderRecent(): Promise<void> {
    let list: ShaderProjectData[] = [];
    try {
      list = (await listProjects('shader')).filter(isShaderProject);
      if (!cleaned) {
        // once per visit (not after a delete, which can still be undone): drop unused preview packs
        cleaned = true;
        void cleanupPreviewPacks(list).catch(() => undefined);
      }
    } catch {
      list = [];
    }
    if (destroyed) return;
    for (const u of urls.splice(0)) URL.revokeObjectURL(u);
    recent.hidden = list.length === 0;
    recentGrid.replaceChildren(...list.slice(0, 24).map(recentCard));
  }

  async function rename(p: ShaderProjectData): Promise<void> {
    const n = await promptDialog(tx.recent.renameTitle, tx.recent.packName, p.name, { confirmLabel: tx.recent.rename, maxLength: 80 });
    if (!n || n === p.name) return;
    p.name = cleanName(n) || p.name;
    try {
      await saveProject(p);
      toast(tx.recent.renamed, { tone: 'success' });
    } catch (err) {
      toast(friendlyError(err, tx.recent.renameFailed), { tone: 'error' });
    }
    void renderRecent();
  }

  async function duplicate(p: ShaderProjectData): Promise<void> {
    try {
      await saveProject(isImportedPack(p) ? await duplicateImported(p) : duplicateShaderProject(p));
      toast(fmt(tx.recent.copied, { name: p.name }), { tone: 'success' });
    } catch (err) {
      toast(friendlyError(err, tx.recent.copyFailed), { tone: 'error' });
    }
    void renderRecent();
  }

  async function remove(p: ShaderProjectData): Promise<void> {
    const ok = await confirmDialog(tx.recent.deleteTitle, fmt(tx.recent.deleteText, { name: p.name }), tx.recent.delete, true);
    if (!ok) return;
    try {
      await deleteProject(p.id);
      // an imported pack's files go a little later, so Undo can still bring it back
      if (isImportedPack(p)) sweepOrphanedPackFiles();
      void renderRecent();
      toast(fmt(tx.recent.deleted, { name: p.name }), {
        action: {
          label: tx.recent.undo,
          onClick: () =>
            void saveProject(p)
              .then(() => renderRecent())
              .catch(() => toast(tx.recent.restoreFailed, { tone: 'error' })),
        },
      });
    } catch {
      toast(tx.recent.deleteFailed, { tone: 'error' });
    }
  }

  // ---------------------------------------------------------------- page
  const page = h(
    'div',
    { class: 'sh-start accent-purple' },
    h(
      'header',
      { class: 'container sh-hero' },
      h('span', { class: 'eyebrow' }, icon('sparkles'), tx.hero.eyebrow),
      h('h1', { class: 'pixel-shadow' }, fmtNodes(tx.hero.title, { look: h('span', { class: 'accent' }, tx.hero.look) })),
      h('p', { class: 'lead' }, tx.hero.lead),
    ),
    h('div', { class: 'container' }, chooser),
    h('div', { class: 'container sh-cards' }, cards),
    openPackSection(),
    recent,
    siteFooter(),
  );
  root.appendChild(page);
  void renderRecent();
  const stopDrop = enablePageDrop(root);
  const offProjects = onProjectsChanged(() => void renderRecent());

  return () => {
    destroyed = true;
    stopDrop();
    offProjects();
    for (const u of urls.splice(0)) URL.revokeObjectURL(u);
  };
}
