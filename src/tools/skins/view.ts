// Skin Maker: '/skins' shows the start screen, '/skins/:id' opens the editor ('?pack=<id>': opened
// from a pack of the Skin Pack Maker, which its back button returns to), '/skin-pack-maker' is the
// Skin Pack Maker ('?pack=<id>' shows that pack).
import type { RouteContext } from '../../core/router';
import './view.css';
import { loadSkinsText } from './i18n/load';
import { mountStart } from './ui/start';

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  root.classList.add('skins-view');
  // The interface text in the page's language (English needs nothing).
  const text = loadSkinsText(ctx.locale);
  const id = ctx.params.id;
  const pack = ctx.query.get('pack');
  if (id) {
    root.classList.add('skins-editing');
    // The editor (pixel canvas, 3D preview) loads only when a skin opens.
    const [{ mountEditor }] = await Promise.all([import('./ui/editor'), text]);
    return mountEditor(root, decodeURIComponent(id), { pack });
  }
  if (ctx.path === '/skin-pack-maker') {
    const [{ mountPackBuilder }] = await Promise.all([import('./pack/builder'), text]);
    return mountPackBuilder(root, { packId: pack });
  }
  await text;
  return mountStart(root);
}
