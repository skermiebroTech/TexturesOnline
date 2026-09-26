// Landing page: hero, tool cards with live previews, recent projects, how it works, footer.

import './home.css';
import type { RouteContext } from '../../core/router';
import { navigate } from '../../core/router';
import type { Project } from '../../core/types';
import { deleteProject, listProjects, saveProject } from '../../core/storage';
import { h, timeAgo } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { button, openMenu } from '../../ui/components';
import { confirmDialog, openModal, promptDialog } from '../../ui/modal';
import { toast } from '../../ui/toast';
import { siteFooter } from '../../app/footer';
import { heroBlock } from './hero-block';
import { shaderShowcase, skinShowcase, textureShowcase, type Showcase } from './art';

type ToolKey = 'textures' | 'skins' | 'shaders';

interface ToolInfo {
  key: ToolKey;
  title: string;
  icon: IconName;
  accent: string;
  blurb: string;
  features: string[];
  cta: string;
}

const TOOLS: ToolInfo[] = [
  {
    key: 'textures',
    title: 'Texture Packs',
    icon: 'image',
    accent: 'accent-green',
    blurb: 'Repaint any block, item or mob — or restyle the whole game with one click.',
    features: ['Every texture, any version', 'Pixel editor & effects', 'Open existing packs'],
    cta: 'Make a texture pack',
  },
  {
    key: 'skins',
    title: 'Skins',
    icon: 'human',
    accent: 'accent-blue',
    blurb: 'Paint your player on the 64×64 template while a 3D model updates live.',
    features: ['Classic & slim, both layers', 'Templates or any username', 'Java & Bedrock export'],
    cta: 'Design a skin',
  },
  {
    key: 'shaders',
    title: 'Shaders',
    icon: 'sparkles',
    accent: 'accent-purple',
    blurb: 'Dial in lighting, colour, fog and water with sliders and a live preview.',
    features: ['Iris / OptiFine packs', 'No-mod vanilla shaders', 'Bedrock Vibrant Visuals'],
    cta: 'Build a shader',
  },
];

function toolPreview(key: ToolKey, label: HTMLElement): { el: HTMLElement; show: Showcase } {
  const canvas = h('canvas', { class: 'pixelated', 'aria-hidden': 'true' });
  let show: Showcase;
  if (key === 'textures') show = textureShowcase(canvas, (name) => (label.textContent = name));
  else if (key === 'skins') show = skinShowcase(canvas);
  else show = shaderShowcase(canvas);
  if (key === 'skins') label.textContent = 'Paint pixel by pixel';
  if (key === 'shaders') label.textContent = 'Day & night preview';
  return { el: h('div', { class: `tool-preview preview-${key}` }, canvas, label), show };
}

function startDialog(): void {
  const options = TOOLS.map((t) =>
    h(
      'a',
      { class: ['start-option', t.accent], href: `#/${t.key}` },
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
  const LIMIT = 6;

  const render = () => {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
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
            { class: 'recent-link', href: `#/${info.route}/${encodeURIComponent(p.id)}` },
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
      const updated = { ...p, name } as Project;
      await saveProject(updated);
      projects = projects.map((x) => (x.id === p.id ? { ...updated, updatedAt: Date.now() } : x));
      render();
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
    destroy: () => urls.splice(0).forEach((u) => URL.revokeObjectURL(u)),
  };
}

export default function home(root: HTMLElement, _ctx: RouteContext): () => void {
  root.classList.add('home');
  const block = heroBlock();

  const hero = h(
    'section',
    { class: 'hero container' },
    h(
      'div',
      { class: 'hero-copy' },
      h('span', { class: 'hero-chip' }, icon('sparkle'), 'Free · No sign-up', h('span', { class: 'hide-sm' }, ' · Works offline')),
      h('h1', { class: 'hero-title' }, 'Craft your own ', h('span', { class: 'hero-accent' }, 'Minecraft'), ' look'),
      h('p', { class: 'hero-lead' }, 'Make texture packs, skins and shaders right in your browser — for Java and Bedrock, ready to drop into the game.'),
      h(
        'div',
        { class: 'hero-cta' },
        button({ label: 'Start creating', icon: 'magic-edit', variant: 'primary', size: 'lg', onClick: startDialog }),
        button({ label: 'How to install', icon: 'book-open', size: 'lg', onClick: () => navigate('/help') }),
      ),
      h(
        'ul',
        { class: 'edition-chips', 'aria-label': 'Supported editions' },
        h('li', { class: 'chip' }, icon('laptop'), 'Java 26.3'),
        h('li', { class: 'chip' }, icon('clock'), 'All versions 1.6.1+'),
        h('li', { class: 'chip' }, icon('gamepad'), 'Bedrock'),
      ),
    ),
    h('div', { class: 'hero-art' }, block.el, h('p', { class: 'hero-art-hint faint small', 'aria-hidden': 'true' }, icon('hand', { size: 24 }), 'Drag to spin')),
  );

  const showcases: Showcase[] = [];
  const cards = TOOLS.map((t) => {
    const label = h('span', { class: 'tool-preview-label' });
    const preview = toolPreview(t.key, label);
    showcases.push(preview.show);
    return h(
      'a',
      { class: ['tool-card', t.accent], href: `#/${t.key}` },
      preview.el,
      h(
        'div',
        { class: 'tool-card-body' },
        h('h3', { class: 'tool-card-title' }, h('span', { class: 'tool-card-icon' }, icon(t.icon)), t.title),
        h('p', { class: 'muted' }, t.blurb),
        h(
          'ul',
          { class: 'tool-features' },
          t.features.map((f) => h('li', null, icon('check'), h('span', null, f))),
        ),
        h('span', { class: 'tool-card-cta' }, t.cta, icon('arrow-right')),
      ),
    );
  });

  const tools = h(
    'section',
    { class: 'section tools container', 'aria-labelledby': 'tools-title' },
    h(
      'div',
      { class: 'section-head center' },
      h('span', { class: 'eyebrow' }, icon('tools'), 'Three tools, one place'),
      h('h2', { id: 'tools-title' }, 'What do you want to make?'),
      h('p', { class: 'lead' }, 'Everything you need to give Minecraft your own style. No installs, no accounts — just open a tool and start.'),
    ),
    h('div', { class: 'tool-grid' }, cards),
  );

  const recent = recentSection();

  const steps: { title: string; text: string; icon: IconName }[] = [
    { title: 'Pick your game', text: 'Java 26.3 is ready by default — or choose any Java version back to 1.6.1, or Bedrock.', icon: 'gamepad' },
    { title: 'Create', text: 'Paint pixels, stack one-click effects or move shader sliders, with live 3D previews as you go.', icon: 'brush' },
    { title: 'Export & play', text: 'Download a ready-to-use .zip or .mcpack, then follow the install guide to use it in game.', icon: 'download' },
  ];
  const how = h(
    'section',
    { class: 'section how container', 'aria-labelledby': 'how-title' },
    h(
      'div',
      { class: 'section-head center' },
      h('span', { class: 'eyebrow' }, icon('bulletlist'), 'How it works'),
      h('h2', { id: 'how-title' }, 'From idea to in-game in minutes'),
    ),
    h(
      'ol',
      { class: 'steps' },
      steps.map((s, i) =>
        h(
          'li',
          { class: 'step' },
          h('span', { class: 'step-num', 'aria-hidden': 'true' }, String(i + 1)),
          h('div', { class: 'step-body' }, h('h3', null, icon(s.icon), s.title), h('p', { class: 'muted' }, s.text)),
        ),
      ),
    ),
    h(
      'div',
      { class: 'values' },
      [
        { icon: 'lock' as IconName, title: 'Private by design', text: 'Your work never leaves your device. Game files are fetched from Mojang by your own browser.' },
        { icon: 'cloud' as IconName, title: 'Works offline', text: 'After the first visit the app and downloaded game files are kept on this device.' },
        { icon: 'check-double' as IconName, title: 'The right format, always', text: 'Pack files are written for the exact version you pick, so Minecraft loads them without complaints.' },
      ].map((v) => h('div', { class: 'value' }, h('span', { class: 'value-icon' }, icon(v.icon)), h('div', null, h('h3', null, v.title), h('p', { class: 'muted' }, v.text)))),
    ),
  );

  const cta = h(
    'section',
    { class: 'section final-cta container' },
    h(
      'div',
      { class: 'final-cta-box' },
      h('div', { class: 'stack', style: { '--gap': '8px' } }, h('h2', null, 'Ready to build something?'), h('p', { class: 'muted' }, 'Pick a tool and your first pack can be in game in a few minutes.')),
      h(
        'div',
        { class: 'row wrap' },
        button({ label: 'Start creating', icon: 'magic-edit', variant: 'primary', size: 'lg', onClick: startDialog }),
      ),
    ),
  );

  root.append(hero, tools, recent.el, how, cta, siteFooter());

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
