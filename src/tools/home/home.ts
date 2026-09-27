// Landing page: hero, tool cards with live previews, recent projects, how it works, footer.

import '../help/help.css';
import '../../app/content/content.css';
import './home.css';
import type { RouteContext } from '../../core/router';
import { href, navigate } from '../../core/router';
import type { Project } from '../../core/types';
import { deleteProject, getProject, listProjects, saveProject } from '../../core/storage';
import { h, timeAgo } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { button, openMenu } from '../../ui/components';
import { confirmDialog, openModal, promptDialog } from '../../ui/modal';
import { toast } from '../../ui/toast';
import { siteFooter } from '../../app/footer';
import { toDomAll } from '../../app/markup-dom';
import { heroBlock } from './hero-block';
import { shaderShowcase, skinShowcase, textureShowcase, type Showcase } from './art';
import { TOOLS, homePage, type ToolKey } from './content';

/** Starts the live preview inside a (prerendered) tool card. */
function toolPreview(card: HTMLElement, key: ToolKey): Showcase {
  const canvas = card.querySelector<HTMLCanvasElement>('.tool-preview canvas')!;
  const label = card.querySelector<HTMLElement>('.tool-preview-label')!;
  if (key === 'textures') return textureShowcase(canvas, (name) => (label.textContent = name));
  if (key === 'skins') return skinShowcase(canvas);
  return shaderShowcase(canvas);
}

function startDialog(): void {
  const options = TOOLS.map((t) =>
    h(
      'a',
      { class: ['start-option', t.accent], href: href(`/${t.key}`) },
      h('span', { class: 'start-option-icon' }, icon(t.icon)),
      h('span', { class: 'start-option-text' }, h('span', { class: 'start-option-title' }, t.title), h('span', { class: 'start-option-blurb' }, t.blurb)),
      icon('chevron-right', { class: 'start-option-go' }),
    ),
  );
  const m = openModal({
    title: 'What do you want to make?',
    width: 560,
    body: h('div', { class: 'start-options' }, options),
  });
  options.forEach((a) => a.addEventListener('click', () => m.close()));
  options[0]?.focus();
}

const KIND_INFO: Record<Project['kind'], { label: string; icon: IconName; route: ToolKey; accent: string }> = {
  texturepack: { label: 'Texture pack', icon: 'image', route: 'textures', accent: 'accent-green' },
  skin: { label: 'Skin', icon: 'human', route: 'skins', accent: 'accent-blue' },
  shader: { label: 'Shader', icon: 'sparkles', route: 'shaders', accent: 'accent-purple' },
};

function projectMeta(p: Project): string {
  if (p.kind === 'texturepack') return `${p.edition === 'java' ? 'Java' : 'Bedrock'} ${p.version === 'latest' ? 'latest' : p.version}`;
  if (p.kind === 'skin') return p.model === 'slim' ? 'Slim arms' : 'Classic arms';
  const target = p.target === 'iris' ? 'Iris / OptiFine' : p.target === 'java-vanilla' ? `Vanilla ${p.version}` : 'Vibrant Visuals';
  return target;
}

function hashHue(s: string): number {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  return x % 360;
}

async function drawSkinFace(blob: Blob, canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(blob);
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bmp, 8, 8, 8, 8, 0, 0, 8, 8);
    if (bmp.height >= 64 || bmp.width >= 64) ctx.drawImage(bmp, 40, 8, 8, 8, 0, 0, 8, 8);
    bmp.close();
    return true;
  } catch {
    return false;
  }
}

function projectThumb(p: Project, urls: string[]): HTMLElement {
  const info = KIND_INFO[p.kind];
  const wrap = h('div', { class: 'recent-thumb checker' });
  const fallback = () => {
    wrap.classList.remove('checker');
    wrap.style.background = `linear-gradient(135deg, hsl(${hashHue(p.id)} 55% 32%), hsl(${(hashHue(p.id) + 50) % 360} 60% 20%))`;
    wrap.replaceChildren(icon(info.icon));
  };
  if (p.kind === 'texturepack' && p.icon instanceof Blob) {
    const url = URL.createObjectURL(p.icon);
    urls.push(url);
    const img = h('img', { src: url, alt: '', class: 'pixelated', loading: 'lazy' });
    img.addEventListener('error', fallback);
    wrap.appendChild(img);
  } else if (p.kind === 'skin' && p.image instanceof Blob) {
    const c = h('canvas', { class: 'pixelated' });
    wrap.appendChild(c);
    void drawSkinFace(p.image, c).then((ok) => {
      if (!ok) fallback();
    });
  } else {
    fallback();
  }
  return wrap;
}

function recentSection(): { el: HTMLElement; destroy(): void } {
  const urls: string[] = [];
  const grid = h('div', { class: 'recent-grid' });
  const moreBtn = button({ label: 'Show all', variant: 'ghost', size: 'sm', iconEnd: 'chevron-down' });
  const el = h(
    'section',
    { class: 'section recent container', hidden: true, 'aria-labelledby': 'recent-title' },
    h(
      'div',
      { class: 'recent-head' },
      h('div', { class: 'stack', style: { '--gap': '8px' } }, h('span', { class: 'eyebrow' }, icon('clock'), 'Your projects'), h('h2', { id: 'recent-title' }, 'Continue where you left off')),
      moreBtn,
    ),
    grid,
    h('p', { class: 'recent-note faint small' }, icon('lock', { size: 24 }), 'Projects are saved in this browser only. Export them to keep a copy.'),
  );

  let projects: Project[] = [];
  let expanded = false;
  let destroyed = false;
  const LIMIT = 6;

  const render = () => {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    if (destroyed) return; // the list finished loading after the user left the page
    el.hidden = projects.length === 0;
    moreBtn.hidden = projects.length <= LIMIT;
    moreBtn.querySelector('.btn-label')!.textContent = expanded ? 'Show fewer' : `Show all ${projects.length}`;
    const shown = expanded ? projects : projects.slice(0, LIMIT);
    grid.replaceChildren(
      ...shown.map((p) => {
        const info = KIND_INFO[p.kind];
        const menuBtn = h('button', { type: 'button', class: 'icon-btn sm recent-menu', 'aria-label': `More actions for ${p.name}`, 'aria-haspopup': 'menu' }, icon('more-vertical'));
        menuBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openMenu(menuBtn, [
            { label: 'Open', icon: 'external-link', onClick: () => navigate(`/${info.route}/${encodeURIComponent(p.id)}`) },
            { label: 'Rename', icon: 'pen-square', onClick: () => void rename(p) },
            { label: 'Delete', icon: 'trash', danger: true, onClick: () => void remove(p) },
          ]);
        });
        return h(
          'article',
          { class: ['recent-card', info.accent] },
          h(
            'a',
            { class: 'recent-link', href: href(`/${info.route}/${encodeURIComponent(p.id)}`) },
            projectThumb(p, urls),
            h(
              'span',
              { class: 'recent-info' },
              h('span', { class: 'recent-name truncate' }, p.name || 'Untitled'),
              h('span', { class: 'recent-meta truncate', title: `${info.label} · ${projectMeta(p)}` }, h('span', { class: 'recent-kind' }, info.label), ` · ${projectMeta(p)}`),
              h('span', { class: 'recent-time faint small' }, `Edited ${timeAgo(p.updatedAt || p.createdAt)}`),
            ),
          ),
          menuBtn,
        );
      }),
    );
  };

  async function rename(p: Project) {
    const name = await promptDialog('Rename project', 'Project name', p.name, { confirmLabel: 'Rename', maxLength: 80 });
    if (!name || name === p.name) return;
    try {
      // start from the stored copy so edits saved since this page loaded are kept
      const fresh = (await getProject(p.id).catch(() => undefined)) ?? p;
      await saveProject({ ...fresh, name } as Project);
      await load();
      toast('Project renamed', { tone: 'success' });
    } catch (err) {
      console.error(err);
      toast("Couldn't rename the project. Your browser storage may be full or blocked.", { tone: 'error' });
    }
  }

  async function remove(p: Project) {
    const ok = await confirmDialog('Delete project?', `"${p.name || 'Untitled'}" will be removed from this browser. This can't be undone once you leave this page.`, 'Delete', true);
    if (!ok) return;
    try {
      await deleteProject(p.id);
      projects = projects.filter((x) => x.id !== p.id);
      render();
      toast(`Deleted "${p.name || 'Untitled'}"`, {
        tone: 'info',
        action: {
          label: 'Undo',
          onClick: () => {
            saveProject(p)
              .then(() => load())
              .catch(() => toast("Couldn't restore the project.", { tone: 'error' }));
          },
        },
      });
    } catch (err) {
      console.error(err);
      toast("Couldn't delete the project.", { tone: 'error' });
    }
  }

  async function load() {
    try {
      projects = (await listProjects()).filter((p) => p && KIND_INFO[p.kind]);
    } catch (err) {
      console.warn('Recent projects unavailable', err);
      projects = [];
    }
    render();
  }

  moreBtn.addEventListener('click', () => {
    expanded = !expanded;
    render();
  });
  void load();
  return {
    el,
    destroy: () => {
      destroyed = true;
      urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    },
  };
}

export default function home(root: HTMLElement, _ctx: RouteContext): () => void {
  root.classList.add('home');
  root.append(...toDomAll(homePage()), siteFooter());

  const block = heroBlock();
  root.querySelector('[data-hero-block]')?.replaceWith(block.el);

  root.querySelectorAll<HTMLAnchorElement>('a[data-action="start"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      startDialog();
    }),
  );

  const cards = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-tool-card]'));
  const showcases: Showcase[] = cards.map((card) => toolPreview(card, card.dataset.toolCard as ToolKey));

  const recent = recentSection();
  root.querySelector('.tools')?.after(recent.el);

  // Only animate previews while they are on screen.
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          for (const en of entries) {
            const i = cards.indexOf(en.target as HTMLAnchorElement);
            if (i < 0) continue;
            if (en.isIntersecting && !document.hidden) showcases[i].start();
            else showcases[i].stop();
          }
        }, { rootMargin: '80px' })
      : null;
  if (io) cards.forEach((c) => io.observe(c));
  else showcases.forEach((s) => s.start());
  const onVis = () => {
    if (document.hidden) showcases.forEach((s) => s.stop());
    else if (io) {
      cards.forEach((c) => {
        io.unobserve(c);
        io.observe(c);
      });
    }
  };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    block.destroy();
    showcases.forEach((s) => s.destroy());
    io?.disconnect();
    recent.destroy();
    document.removeEventListener('visibilitychange', onVis);
  };
}
