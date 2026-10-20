// Screenshots on the public pages: every AVIF copy a srcset names exists in public/, and every image
// keeps its width/height (no layout shift) and loads lazily.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { flatten, renderHtml, type Child, type ElNode } from '../../src/app/markup';
import { prerenderPages } from '../../src/app/seo/pages';
import { variantPath, variantWidths } from '../../src/app/responsive-image';
import { SHOTS } from '../../src/app/content/shots';

const publicDir = fileURLToPath(new URL('../../public/', import.meta.url));

function elements(children: Child[], tag: string, out: ElNode[] = []): ElNode[] {
  for (const n of flatten(children)) {
    if (typeof n === 'string' || n.kind !== 'el') continue;
    if (n.tag === tag) out.push(n);
    elements(n.children, tag, out);
  }
  return out;
}

test('screenshots are pictures with AVIF copies that exist', () => {
  let pictures = 0;
  for (const p of prerenderPages()) {
    const body = p.body(2026);
    for (const pic of elements(body, 'picture')) {
      pictures++;
      const [source] = elements(pic.children, 'source');
      const [img] = elements(pic.children, 'img');
      assert.ok(source && img, `${p.meta.path}: picture has a source and an img`);
      assert.equal(source.attrs.type, 'image/avif');
      assert.match(String(source.attrs.sizes), /^auto, /);
      for (const part of String(source.attrs.srcset).split(',')) {
        const [url, w] = part.trim().split(/\s+/);
        assert.match(w, /^\d+w$/);
        assert.ok(existsSync(publicDir + url.slice(1)), `${p.meta.path}: ${url} exists (run scripts/screenshot-variants.py)`);
      }
      assert.ok(Number(img.attrs.width) > 0 && Number(img.attrs.height) > 0, `${p.meta.path}: ${img.attrs.src} has a size`);
      assert.equal(img.attrs.loading, 'lazy');
    }
  }
  assert.ok(pictures > 10, 'guides and tool pages show screenshots');
});

test('every guide screenshot has its AVIF copies', () => {
  for (const shot of Object.values(SHOTS)) {
    for (const w of variantWidths(shot.width)) assert.ok(existsSync(publicDir + variantPath(shot.src, w).slice(1)), `${variantPath(shot.src, w)} exists`);
  }
  // nothing left over from screenshots that are gone
  const dir = publicDir + 'screenshots/guides/';
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.avif'))) assert.ok(existsSync(dir + f.replace(/-\d+w\.avif$/, '.jpg')), `${f} belongs to a screenshot`);
  assert.deepEqual(variantWidths(1280), [640, 1280]);
  assert.deepEqual(variantWidths(640), [640]);
});

test('srcset URLs are resolved like src for the page depth', () => {
  const html = renderHtml(
    { kind: 'el', tag: 'source', attrs: { srcset: '/screenshots/guides/a-640w.avif 640w, /screenshots/guides/a-1280w.avif 1280w' }, children: [] },
    { iconSvg: () => '', logoSvg: () => '<svg></svg>', link: (to) => `../..${to}` },
  );
  assert.equal(html, '<source srcset="../../screenshots/guides/a-640w.avif 640w, ../../screenshots/guides/a-1280w.avif 1280w">');
});
