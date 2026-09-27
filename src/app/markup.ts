// A tiny element tree for the public pages. The same tree is rendered to HTML at build time (the
// prerendered pages search engines and AI crawlers read), to DOM at runtime (markup-dom.ts, so the
// booted page matches the prerendered one exactly), to plain text (structured data) and to
// Markdown (llms-full.txt). No DOM or Node APIs here.

import type { IconName } from '../ui/icons';

export type AttrValue = string | number | boolean | null | undefined;
export type ClassValue = string | false | null | undefined | ClassValue[];

export interface Attrs {
  class?: ClassValue;
  /** Internal route path ('/textures', '/help?s=faq'); becomes the href */
  to?: string;
  [name: string]: AttrValue | ClassValue;
}

export interface ElNode {
  kind: 'el';
  tag: string;
  attrs: Attrs;
  children: Child[];
}
export interface IconNode {
  kind: 'icon';
  name: IconName;
  class?: string;
  size?: number;
  label?: string;
}
export interface LogoNode {
  kind: 'logo';
  size: number;
  label?: string;
}
export type MNode = ElNode | IconNode | LogoNode;
export type Child = MNode | string | number | null | undefined | false | Child[];

export function el(tag: string, attrs?: Attrs | null, ...children: Child[]): ElNode {
  return { kind: 'el', tag, attrs: attrs ?? {}, children };
}

export function ic(name: IconName, opts: { class?: string; size?: number; label?: string } = {}): IconNode {
  return { kind: 'icon', name, ...opts };
}

export function logo(size = 32, label?: string): LogoNode {
  return { kind: 'logo', size, label };
}

export function classString(c: ClassValue): string {
  if (!c) return '';
  if (Array.isArray(c)) return c.map(classString).filter(Boolean).join(' ');
  return String(c);
}

export function flatten(children: Child[], out: (MNode | string)[] = []): (MNode | string)[] {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) flatten(c, out);
    else if (typeof c === 'number') out.push(String(c));
    else out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------- HTML

export interface HtmlContext {
  /** Inner markup (paths) of a pixel icon's 24x24 SVG */
  iconSvg(name: IconName): string;
  /** Full <svg> markup of the logo on a 32x32 view box */
  logoSvg(): string;
  /** href for an internal route path */
  link(to: string): string;
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Attributes as the DOM renderer will set them (same order, same values). */
export function resolvedAttrs(attrs: Attrs, link: (to: string) => string): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') {
      const cls = classString(v as ClassValue);
      if (cls) out.push(['class', cls]);
    } else if (k === 'to') {
      if (typeof v === 'string') out.push(['href', link(v)]);
    } else if (v === true) {
      out.push([k, '']);
    } else if (v !== false && v !== null && v !== undefined) {
      out.push([k, String(v)]);
    }
  }
  return out;
}

function iconHtml(n: IconNode, ctx: HtmlContext): string {
  const cls = n.class ? `icon ${n.class}` : 'icon';
  const style = n.size && n.size !== 24 ? ` style="--icon-size: ${n.size}px;"` : '';
  const a11y = n.label ? ` role="img" aria-label="${escapeAttr(n.label)}"` : ' aria-hidden="true"';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${ctx.iconSvg(n.name)}</svg>`;
  return `<span class="${cls}"${style} data-icon="${n.name}"${a11y}>${svg}</span>`;
}

function logoHtml(n: LogoNode, ctx: HtmlContext): string {
  const a11y = n.label ? ` role="img" aria-label="${escapeAttr(n.label)}"` : ' aria-hidden="true"';
  return ctx.logoSvg().replace('<svg ', `<svg width="${n.size}" height="${n.size}" class="logo-mark"${a11y} `);
}

export function renderHtml(node: Child, ctx: HtmlContext): string {
  if (node === null || node === undefined || node === false) return '';
  if (Array.isArray(node)) return node.map((c) => renderHtml(c, ctx)).join('');
  if (typeof node === 'string') return escapeHtml(node);
  if (typeof node === 'number') return String(node);
  if (node.kind === 'icon') return iconHtml(node, ctx);
  if (node.kind === 'logo') return logoHtml(node, ctx);
  const attrs = resolvedAttrs(node.attrs, ctx.link)
    .map(([k, v]) => (v === '' && k !== 'alt' && k !== 'content' && k !== 'value' ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`))
    .join('');
  if (VOID.has(node.tag)) return `<${node.tag}${attrs}>`;
  return `<${node.tag}${attrs}>${node.children.map((c) => renderHtml(c, ctx)).join('')}</${node.tag}>`;
}

// ---------------------------------------------------------------- Text

const BLOCK = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'section', 'tr', 'summary', 'dt', 'dd', 'pre', 'table', 'ul', 'ol', 'aside', 'header', 'footer', 'figcaption']);

function isHidden(n: ElNode): boolean {
  return n.attrs['aria-hidden'] === 'true' || n.attrs['aria-hidden'] === true || n.attrs['data-md'] === 'skip';
}

/** Readable plain text of a tree (whitespace collapsed); icons and aria-hidden parts are skipped. */
export function renderText(node: Child): string {
  const parts: string[] = [];
  const walk = (c: Child) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) return c.forEach(walk);
    if (typeof c === 'string' || typeof c === 'number') {
      parts.push(String(c));
      return;
    }
    if (c.kind !== 'el' || isHidden(c)) return;
    const block = BLOCK.has(c.tag);
    if (block) parts.push(' ');
    if (c.tag === 'br') parts.push(' ');
    c.children.forEach(walk);
    if (c.tag === 'td' || c.tag === 'th') parts.push(' ');
    if (block) parts.push(' ');
  };
  walk(node);
  return parts.join('').replace(/\s+/g, ' ').replace(/\s+([.,;:!?)])(?=\s|$)/g, '$1').trim();
}

/** Text exactly as written (for preformatted blocks). */
function rawText(children: Child[]): string {
  return flatten(children)
    .map((c) => (typeof c === 'string' ? c : c.kind === 'el' ? rawText(c.children) : ''))
    .join('');
}

// ---------------------------------------------------------------- Markdown

export interface MarkdownContext {
  /** Absolute URL for an internal route path */
  link(to: string): string;
}

function mdInline(children: Child[], ctx: MarkdownContext): string {
  let out = '';
  for (const c of flatten(children)) {
    if (typeof c === 'string') {
      out += c.replace(/\s+/g, ' ');
      continue;
    }
    if (c.kind !== 'el' || isHidden(c)) continue;
    const inner = mdInline(c.children, ctx);
    // Keep spaces outside the emphasis markers: "**Android:** open", not "**Android: **open".
    const wrap = (mark: string) => {
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
      return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : inner;
    };
    switch (c.tag) {
      case 'strong':
      case 'b':
        out += wrap('**');
        break;
      case 'em':
      case 'i':
        out += wrap('*');
        break;
      case 'code':
      case 'kbd':
        out += `\`${inner.replace(/`/g, "'")}\``;
        break;
      case 'a': {
        const to = c.attrs.to;
        const href = typeof to === 'string' ? ctx.link(to) : typeof c.attrs.href === 'string' ? c.attrs.href : '';
        out += href ? `[${inner.trim()}](${href})` : inner;
        break;
      }
      case 'br':
        out += '  \n';
        break;
      default:
        out += inner;
    }
  }
  return out;
}

function mdTable(table: ElNode, ctx: MarkdownContext): string {
  const rows: string[][] = [];
  const collect = (n: Child) => {
    for (const c of flatten([n])) {
      if (typeof c === 'string' || c.kind !== 'el') continue;
      if (c.tag === 'tr') {
        rows.push(
          flatten(c.children)
            .filter((x): x is ElNode => typeof x !== 'string' && x.kind === 'el' && (x.tag === 'td' || x.tag === 'th'))
            .map((cell) => mdInline(cell.children, ctx).trim().replace(/\|/g, '\\|')),
        );
      } else collect(c.children);
    }
  };
  collect(table.children);
  if (!rows.length) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`;
  return [line(rows[0]), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n');
}

const BLOCK_TAGS = new Set(['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'section', 'header']);

function hasBlockChild(n: ElNode): boolean {
  return flatten(n.children).some((c) => typeof c !== 'string' && c.kind === 'el' && (BLOCK_TAGS.has(c.tag) || hasBlockChild(c)));
}

function findHeading(n: ElNode): ElNode | null {
  for (const c of flatten(n.children)) {
    if (typeof c === 'string' || c.kind !== 'el') continue;
    if (/^h[1-6]$/.test(c.tag)) return c;
    const inner = findHeading(c);
    if (inner) return inner;
  }
  return null;
}

/** Children with one node (at any depth) left out; inline wrappers become blocks so their text stays apart. */
function withoutNode(children: Child[], skip: ElNode | null): Child[] {
  return flatten(children).map((c) => {
    if (typeof c === 'string' || c.kind !== 'el') return c;
    if (c === skip) return null;
    const tag = c.tag === 'span' ? 'div' : c.tag;
    return { ...c, tag, children: withoutNode(c.children, skip) };
  });
}

function mdBlocks(children: Child[], ctx: MarkdownContext, depth: number, out: string[]): void {
  let inline: Child[] = [];
  const flushInline = () => {
    const text = mdInline(inline, ctx).trim();
    if (text) out.push(text);
    inline = [];
  };
  for (const c of flatten(children)) {
    if (typeof c === 'string' || c.kind !== 'el') {
      inline.push(c);
      continue;
    }
    if (isHidden(c)) continue;
    const heading = /^h([1-6])$/.exec(c.tag);
    if (heading) {
      flushInline();
      const text = mdInline(c.children, ctx).trim();
      if (text) out.push(`${'#'.repeat(Number(heading[1]))} ${text}`);
      continue;
    }
    switch (c.tag) {
      case 'p':
      case 'figcaption':
        flushInline();
        {
          const text = mdInline(c.children, ctx).trim();
          if (text) out.push(text);
        }
        break;
      case 'ul':
      case 'ol': {
        flushInline();
        const items = flatten(c.children).filter((x): x is ElNode => typeof x !== 'string' && x.kind === 'el' && x.tag === 'li' && !isHidden(x));
        const lines = items.map((li, i) => {
          const sub: string[] = [];
          mdBlocks(li.children, ctx, depth + 1, sub);
          const bullet = c.tag === 'ol' ? `${i + 1}.` : '-';
          const pad = ' '.repeat(bullet.length + 1);
          return `${bullet} ${sub.join('\n').replace(/\n+/g, `\n${pad}`)}`;
        });
        if (lines.length) out.push(lines.join('\n'));
        break;
      }
      case 'table':
        flushInline();
        {
          const t = mdTable(c, ctx);
          if (t) out.push(t);
        }
        break;
      case 'pre':
        flushInline();
        out.push('```\n' + rawText(c.children).replace(/^\n+|\n+$/g, '') + '\n```');
        break;
      case 'details': {
        flushInline();
        const summary = flatten(c.children).find((x): x is ElNode => typeof x !== 'string' && x.kind === 'el' && x.tag === 'summary');
        if (summary) out.push(`**${mdInline(summary.children, ctx).trim()}**`);
        mdBlocks(
          c.children.filter((x) => x !== summary),
          ctx,
          depth,
          out,
        );
        break;
      }
      case 'aside': {
        flushInline();
        const sub: string[] = [];
        mdBlocks(c.children, ctx, depth, sub);
        if (sub.length) out.push(sub.map((s) => s.replace(/^/gm, '> ')).join('\n>\n'));
        break;
      }
      case 'a':
        if (hasBlockChild(c)) {
          // A card link: its heading becomes a linked heading, the rest a paragraph.
          flushInline();
          const to = c.attrs.to;
          const href = typeof to === 'string' ? ctx.link(to) : typeof c.attrs.href === 'string' ? c.attrs.href : '';
          const heading = findHeading(c);
          const title = heading ? mdInline(heading.children, ctx).trim() : '';
          const level = heading ? Number(heading.tag.slice(1)) : 3;
          if (title) out.push(`${'#'.repeat(level)} ${href ? `[${title}](${href})` : title}`);
          mdBlocks(withoutNode(c.children, heading), ctx, depth, out);
        } else inline.push(c);
        break;
      case 'strong':
      case 'b':
      case 'em':
      case 'i':
      case 'code':
      case 'kbd':
      case 'span':
      case 'br':
        inline.push(c);
        break;
      default: {
        flushInline();
        const label = c.attrs['data-md-heading'];
        if (typeof label === 'string' && label) out.push(`**${label}**`);
        mdBlocks(c.children, ctx, depth, out);
      }
    }
  }
  flushInline();
}

/** Markdown for a tree: headings, paragraphs, lists, tables and links (absolute URLs). */
export function renderMarkdown(node: Child, ctx: MarkdownContext): string {
  const out: string[] = [];
  mdBlocks([node], ctx, 0, out);
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
