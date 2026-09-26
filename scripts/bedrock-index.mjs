#!/usr/bin/env node
/**
 * Builds the Bedrock vanilla file catalogue shipped with the app (paths only, no game files):
 *   public/data/bedrock/index-<ref>.json   directory -> file names under bedrock-samples/resource_pack
 *   public/data/bedrock/versions.json      release/preview version lists + git tag names (offline fallback)
 *
 * Usage:
 *   node scripts/bedrock-index.mjs [ref ...]           default refs: main preview
 *   node scripts/bedrock-index.mjs --out <dir>         output directory (default public/data/bedrock)
 *   node scripts/bedrock-index.mjs --no-versions       skip versions.json
 *   node scripts/bedrock-index.mjs --from-tree main=tree.txt   use a saved `git ls-tree -r --name-only` listing
 *
 * Uses a blobless, checkout-free clone, so only a few MB are transferred per ref.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'https://github.com/Mojang/bedrock-samples.git';
const FORMAT = 1;
const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = { refs: [], out: resolve(here, '../public/data/bedrock'), versions: true, fromTree: new Map() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = resolve(argv[++i]);
    else if (a === '--no-versions') opts.versions = false;
    else if (a === '--from-tree') {
      const [ref, file] = String(argv[++i]).split('=');
      opts.fromTree.set(ref, resolve(file));
    } else if (a === '--help' || a === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 16).join('\n'));
      process.exit(0);
    } else opts.refs.push(a);
  }
  if (!opts.refs.length) opts.refs = opts.fromTree.size ? [...opts.fromTree.keys()] : ['main', 'preview'];
  return opts;
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Removes // and /* *\/ comments outside strings (vanilla atlas files start with a comment line). */
function stripComments(text) {
  let out = '';
  for (let i = 0; i < text.length; ) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function lenientJson(text) {
  return JSON.parse(stripComments(text.replace(/^﻿/, '')).replace(/,(\s*[}\]])/g, '$1'));
}

function buildIndex(ref, paths, extra) {
  const dirs = {};
  const rels = paths
    .filter((p) => p.startsWith('resource_pack/'))
    .map((p) => p.slice('resource_pack/'.length))
    .filter((p) => p && !p.startsWith('sounds/'))
    .sort();
  for (const p of rels) {
    const slash = p.lastIndexOf('/');
    const dir = slash < 0 ? '' : p.slice(0, slash);
    (dirs[dir] ??= []).push(p.slice(slash + 1));
  }
  return { format: FORMAT, ref, ...extra, dirs, _count: rels.length };
}

function readBlob(dir, path) {
  try {
    return git(['cat-file', '-p', `HEAD:${path}`], dir);
  } catch {
    return null;
  }
}

function indexRef(ref, opts) {
  const saved = opts.fromTree.get(ref);
  if (saved) {
    const paths = readFileSync(saved, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
    return { index: buildIndex(ref, paths, { generated: new Date().toISOString(), source: 'saved listing' }), versionJson: null };
  }
  const dir = mkdtempSync(join(tmpdir(), `bedrock-samples-${ref}-`));
  try {
    console.log(`Cloning ${ref} (paths only)…`);
    git(['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--no-checkout', '-b', ref, REPO, dir]);
    const commit = git(['rev-parse', 'HEAD'], dir).trim();
    const paths = git(['ls-tree', '-r', '--name-only', 'HEAD', '--', 'resource_pack'], dir).split('\n').filter(Boolean);
    const versionText = readBlob(dir, 'version.json');
    const versionJson = versionText ? lenientJson(versionText) : null;
    const version = versionJson?.latest?.version;
    let minEngine;
    const manifestText = readBlob(dir, 'resource_pack/manifest.json');
    if (manifestText) {
      const m = lenientJson(manifestText);
      if (Array.isArray(m?.header?.min_engine_version)) minEngine = m.header.min_engine_version;
    }
    let flipbook = [];
    const flipText = readBlob(dir, 'resource_pack/textures/flipbook_textures.json');
    if (flipText) {
      const arr = lenientJson(flipText);
      if (Array.isArray(arr)) flipbook = [...new Set(arr.map((e) => e?.flipbook_texture).filter((p) => typeof p === 'string' && p.startsWith('textures/')))].sort();
    }
    const index = buildIndex(ref, paths, { commit, version, minEngine, generated: new Date().toISOString(), flipbook });
    return { index, versionJson };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function listTags() {
  const out = git(['ls-remote', '--tags', '--refs', REPO]);
  return out
    .split('\n')
    .map((l) => l.split('\t')[1])
    .filter((r) => r && r.startsWith('refs/tags/'))
    .map((r) => r.slice('refs/tags/'.length).replace(/^v/, ''));
}

function versionKey(v) {
  return v.split(/[-+]/)[0].split('.').map((x) => parseInt(x, 10) || 0);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(opts.out, { recursive: true });
  const versionJsons = {};
  let failures = 0;
  for (const ref of opts.refs) {
    try {
      const { index, versionJson } = indexRef(ref, opts);
      const count = index._count;
      delete index._count;
      const file = join(opts.out, `index-${ref}.json`);
      writeFileSync(file, JSON.stringify(index) + '\n');
      console.log(`Wrote ${file}: ${count} files${index.version ? `, version ${index.version}` : ''}`);
      if (versionJson) versionJsons[ref] = versionJson;
    } catch (err) {
      failures++;
      console.error(`Failed to index ${ref}: ${err.message}`);
    }
  }
  if (opts.versions) {
    try {
      const tags = listTags().sort((a, b) => {
        const ka = versionKey(a), kb = versionKey(b);
        for (let i = 0; i < Math.max(ka.length, kb.length); i++) if ((ka[i] ?? 0) !== (kb[i] ?? 0)) return (kb[i] ?? 0) - (ka[i] ?? 0);
        return a < b ? 1 : -1;
      });
      const file = join(opts.out, 'versions.json');
      // Keep the branch that wasn't re-indexed this run (e.g. only `preview` was requested).
      let previous = {};
      try {
        previous = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        /* first run */
      }
      const snapshot = {
        format: FORMAT,
        generated: new Date().toISOString(),
        main: versionJsons.main ?? previous.main,
        preview: versionJsons.preview ?? previous.preview,
        tags,
      };
      writeFileSync(file, JSON.stringify(snapshot) + '\n');
      console.log(`Wrote ${file}: ${tags.length} tags`);
    } catch (err) {
      failures++;
      console.error(`Failed to list versions: ${err.message}`);
    }
  }
  if (failures) process.exit(1);
}

main();
